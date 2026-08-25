import { Component, HostListener, signal, inject, effect, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Spinner } from '@app/animations/spinner/spinner';
import { jsPDF } from 'jspdf';
import { firstValueFrom } from 'rxjs';
import { GeoJSON, getCenter, OlMap } from '@app/modules/openlayers.module';
import { MapService } from '../../../../../../../../services/map.service';
import { GeoJSONFeature } from '@app/interfaces/geoLayers';

/** Opciones de orientación del plano */
type Orientacion = 'vertical' | 'horizontal';
/** Formatos de papel soportados */
type FormatoPapel = 'a4' | 'a3';

const LOGO_SRC = 'assets/images/logo_visor.png';
const COLOR_INSTITUCIONAL: [number, number, number] = [27, 42, 78]; // #1b2a4e
const COLOR_VERDE: [number, number, number] = [70, 87, 15];         // #46570f

/**
 * Panel de impresión/exportación del visor.
 * Genera un PDF local (jsPDF) o envía a la impresora la vista actual del mapa,
 * incluyendo logo institucional, título editable y fecha/hora de impresión.
 */
@Component({
  selector: 'app-imprimir',
  standalone: true,
  imports: [CommonModule, FormsModule, Spinner],
  templateUrl: './imprimir.html',
  styleUrl: './imprimir.css',
  // Necesario para que las reglas @media print afecten a todo el documento
  encapsulation: ViewEncapsulation.None,
})
export class Imprimir {
  readonly mapService = inject(MapService);

  /** Título editable que se estampará en el plano */
  titulo = signal('Plano Catastral - Municipalidad de San Isidro');
  /** Orientación del papel */
  orientacion = signal<Orientacion>('vertical');
  /** Tamaño de papel */
  formato = signal<FormatoPapel>('a4');
  /** Indica si se está generando el PDF o preparando la impresión */
  generando = signal(false);
  /** Texto principal del spinner de proceso (según la acción en curso) */
  mensajeProceso = signal<string>('Generando PDF…');
  /** Mensaje de error para el usuario */
  error = signal<string | null>(null);
  /** Data URL del mapa capturado para la vista de impresora */
  imagenMapa = signal<string | null>(null);
  /** Fecha/hora formateada que se estampará */
  fechaHora = signal(this.formatearFecha(new Date()));

  /** Dimensiones reales (px) del último mapa capturado */
  private mapaAnchoPx = 1;
  private mapaAltoPx = 1;
  /** Resolución de la última captura (metros reales por píxel) para la barra de escala */
  private resolucionCapturaMpx = 0;
  /**
   * Caché de la última captura válida. Si la segunda impresión usa el mismo
   * lote/escala/formato/orientación/tamaño de recuadro, se reutiliza la imagen
   * sin volver a manipular el mapa (evita congelamientos por reproceso).
   */
  private cacheCaptura?: {
    clave: string;
    imagen: string;
    anchoPx: number;
    altoPx: number;
    resolucion: number;
  };
  private estiloPagina?: HTMLStyleElement;

  /** Formatea una fecha como DD/MM/YYYY HH:mm:ss (es-PE) */
  private formatearFecha(fecha: Date): string {
    const dia = fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${dia} ${hora}`;
  }

  /** Al cerrar el diálogo de impresión limpiamos los recursos temporales */
  @HostListener('window:afterprint')
  onAfterPrint(): void {
    this.imagenMapa.set(null);
    this.estiloPagina?.remove();
    this.estiloPagina = undefined;
    this.generando.set(false);
  }

  /**
   * Captura el mapa adaptándolo temporalmente al aspecto del recuadro destino
   * del plano: el lienzo se redimensiona a las proporciones exactas de la caja
   * del PDF (150 dpi), de modo que la imagen llene por completo el marco sin
   * bandas vacías. Activa además la cuadrícula UTM-18S durante la toma y
   * restaura tamaño/vista originales al terminar.
   */
  private async capturarMapa(cajaMm: { w: number; h: number }): Promise<string> {
    const olMap = this.mapService.map();
    if (!olMap) return this.capturarMapaSimple();

    const dpi = 150;
    // Tope de seguridad: nunca lienzos gigantes que bloqueen el hilo principal
    const pxW = Math.min(2600, Math.max(360, Math.round((cajaMm.w / 25.4) * dpi)));
    const pxH = Math.min(2600, Math.max(360, Math.round((cajaMm.h / 25.4) * dpi)));

    const view = olMap.getView();
    const centroOriginal = view.getCenter()?.slice() as number[] | undefined;
    const resolucionOriginal = view.getResolution() ?? undefined;

    try {
      console.time('[Imprimir] captura');
      // Cuadrícula UTM-18S eventual (solo durante la captura). Es decorativa:
      // un fallo en su generación (p. ej. RangeError con vistas patológicas
      // tras el redimensionado) NUNCA debe abortar la toma del mapa ni la
      // generación del PDF.
      try {
        this.mapService.activarCuadriculaUtm();
      } catch (errCuadricula) {
        console.warn('[Imprimir] Cuadrícula UTM omitida:', errCuadricula);
      }

      // Adaptamos el lienzo del mapa al aspecto del recuadro del plano
      const sizeActual = olMap.getSize();
      if (!sizeActual || sizeActual[0] !== pxW || sizeActual[1] !== pxH) {
        olMap.setSize([pxW, pxH]);
      }
      // Margen mayor de estabilización tras el redimensionado del lienzo
      // (los servicios WMS necesitan re-planificar sus peticiones)
      await new Promise(res => setTimeout(res, 120));

      // Encuadre según la escala elegida (usa el nuevo ancho en píxeles)
      if (this.mapService.loteSeleccionadoCodigo()) {
        await this.prepararVista(cajaMm.w);
      } else {
        await new Promise(res => setTimeout(res, 120));
      }

      // Esperamos a que terminen de pintarse todas las capas
      await this.esperarRenderCompleto(olMap);

      const canvas = this.mapService.getMapCanvas();
      if (!canvas || !canvas.width) {
        throw new Error('El mapa aún no está listo para exportarse.');
      }
      this.mapaAnchoPx = canvas.width;
      this.mapaAltoPx = canvas.height;
      this.resolucionCapturaMpx = view.getResolution() ?? 0;
      return canvas.toDataURL('image/jpeg', 0.92);
    } finally {
      this.mapService.desactivarCuadriculaUtm();
      // Cancelamos animaciones pendientes y devolvemos el visor a su estado
      // original: el tamaño se recalcula DESDE el contenedor (setSize(undefined))
      // para no arrastrar estados de resize inconsistentes entre impresiones.
      try {
        view.cancelAnimations();
        if (centroOriginal) view.setCenter(centroOriginal);
        if (resolucionOriginal) view.setResolution(resolucionOriginal);
      } catch {
        // La vista pudo cambiar; seguimos con la restauración del lienzo
      }
      olMap.setSize(undefined);
      olMap.updateSize();
      console.timeEnd('[Imprimir] captura');
    }
  }

  /** Captura simple (sin adaptación de recuadro): respaldo si no hay mapa OL. */
  private async capturarMapaSimple(): Promise<string> {
    // Pequeña espera para que terminen de cargar los tiles en curso
    await new Promise(res => setTimeout(res, 300));
    const canvas = this.mapService.getMapCanvas();
    if (!canvas || !canvas.width) {
      throw new Error('El mapa aún no está listo para exportarse.');
    }
    this.mapaAnchoPx = canvas.width;
    this.mapaAltoPx = canvas.height;
    this.resolucionCapturaMpx = this.mapService.map()?.getView().getResolution() ?? 0;
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  /** Resuelve cuando el mapa termina de renderizar (con tope de espera). */
  private esperarRenderCompleto(olMap: OlMap): Promise<void> {
    return new Promise(res => {
      let listo = false;
      const fin = () => {
        if (!listo) {
          listo = true;
          res();
        }
      };
      olMap.once('rendercomplete', fin);
      // Tope generoso: 'rendercomplete' solo se emite cuando TODOS los tiles
      // (ortofoto/WMS) están cargados y compuestos. El tope anterior (900 ms)
      // recortaba la espera en redes lentas y producía capturas con solo un
      // "pedazo" de la fotografía aérea en lotes grandes. 3 s cubre el caso
      // normal; si aun así no termina, se captura lo disponible.
      setTimeout(fin, 3000);
    });
  }

  /**
   * Carga una imagen y resuelve cuando está disponible.
   */
  private cargarImagen(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src}`));
      img.src = src;
    });
  }

  /** Normaliza el título para usarlo en el nombre del archivo */
  private slug(texto: string): string {
    const base = texto.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
    return (base || 'plano').slice(0, 60);
  }

  // --- Selección e información del lote ---
  /** Escala del plano: fija (1/250 … 1/2000) o automática según la vista */
  escala = signal<'auto' | '250' | '500' | '750' | '1000' | '1250' | '2000'>('auto');
  /** Propiedades cualitativas del lote seleccionado (WFS vw_tg_lote) */
  datosLote = signal<Record<string, unknown> | null>(null);
  /** Filas [etiqueta, valor] de la tabla cualitativa para el PDF */
  filasTabla = signal<[string, string][]>([]);
  /** Fotografía del lote obtenida de la ficha en línea (DataURL) o null */
  fotoLote = signal<string | null>(null);
  /** Indica si se están cargando los datos del lote */
  cargandoDatos = signal(false);
  /** URL de la ficha completa del lote (enlace en PDF/impresión) */
  fichaUrl = signal<string | null>(null);
  /** Filas [etiqueta, valor] de la ficha pública (LotePublico.asp) del marco inferior */
  infoPublicaFilas = signal<[string, string][]>([]);

  /** Feature crudo del lote seleccionado (para centrar/ajustar la vista) */
  private featureLote: GeoJSONFeature | null = null;

  constructor() {
    // Cuando cambia el lote seleccionado en el mapa, cargamos sus datos
    effect(() => {
      const codigo = this.mapService.loteSeleccionadoCodigo();
      if (codigo) {
        void this.cargarDatosLote(codigo);
      } else {
        this.featureLote = null;
        this.datosLote.set(null);
        this.filasTabla.set([]);
        this.fotoLote.set(null);
        this.fichaUrl.set(null);
        this.infoPublicaFilas.set([]);
      }
    });
  }

  /**
   * Carga los atributos cualitativos del lote (WFS) y su fotografía.
   */
  private async cargarDatosLote(codigo: string): Promise<void> {
    this.cargandoDatos.set(true);
    this.error.set(null);
    try {
      const feature = await firstValueFrom(this.mapService.searchLoteByCodigoCatastral(codigo));
      this.featureLote = feature ?? null;
      const props = (feature?.properties ?? {}) as Record<string, unknown>;
      this.datosLote.set(feature ? props : null);
      this.filasTabla.set(feature ? this.construirFilas(props, codigo) : [['Código Catastral', codigo], ['Estado', 'Sin datos cualitativos disponibles']]);
      this.fichaUrl.set(`http://192.168.41.160/DataGIS_WGS84/WEBFILES/informacion.asp?codigo_i=${codigo}`);
      // La fotografía es opcional: si falla (p. ej. CORS), se usa un enlace en el PDF
      this.fotoLote.set(await this.obtenerFotoLote(codigo));
      // La ficha pública es opcional: si falla, el marco mostrará un aviso
      this.infoPublicaFilas.set(await this.obtenerInfoPublica(codigo));
    } catch {
      this.error.set('No se pudieron cargar los datos del lote.');
    } finally {
      this.cargandoDatos.set(false);
    }
  }

  /**
   * Construye las filas cualitativas de la tabla a partir de los
   * atributos del feature WFS (con fallbacks defensivos).
   */
  private construirFilas(p: Record<string, unknown>, codigo: string): [string, string][] {
    const texto = (clave: string): string => String(p[clave] ?? '').trim();
    const filas: [string, string][] = [
      ['Código Catastral', texto('id_lote') || codigo],
      ['Dirección', texto('direccion') || texto('ubicacion')],
      ['Titular / Propietario', texto('propietario') || 'Información reservada'],
      ['Área de terreno', p['area_lote'] != null && p['area_lote'] !== '' ? `${p['area_lote']} m²` : ''],
      ['Zonificación', texto('zonificacion')],
      ['N° de pisos', p['pisos'] != null && p['pisos'] !== '' ? String(p['pisos']) : ''],
      ['Urb. / Habilitación', texto('urbanizaci') || texto('habilitacion')],
      ['Manzana - Lote urb.', [texto('mzaurb'), texto('loteurb')].filter(Boolean).join(' - ')],
    ];
    return filas.filter(fila => fila[1].length > 0);
  }

  /**
   * Obtiene la ficha pública del lote desde LotePublico.asp (la misma que ve
   * el ciudadano) y la convierte en filas [etiqueta, valor] para el marco
   * inferior del plano. Devuelve [] si no está disponible (CORS/red/timeout).
   */
  private async obtenerInfoPublica(codigo: string): Promise<[string, string][]> {
    const html = await this.descargarPaginaDataGIS('WEBFILES/LotePublico.asp', codigo);
    if (!html) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const limpiar = (texto: string | null | undefined): string =>
      (texto ?? '').replace(/\s+/g, ' ').trim();
    const filas: [string, string][] = [];

    const agregarPar = (clave: string, valor: string): void => {
      const k = limpiar(clave).replace(/:$/, '');
      const v = limpiar(valor);
      // Descartamos rótulos de navegación/encabezado y valores vacíos
      if (!k || !v) return;
      if (/^(ficha|ver fotos|consultas|informacion de lote)/i.test(k)) return;
      if (/^\d+$/.test(k)) return;
      filas.push([k, v]);
    };

    // 1) Tablas HTML: clasificamos cada celda por su clase CSS de la ficha
    //    ("Subtitulo" = etiqueta, "Dato" = valor); soporta filas dobles
    //    [Etiqueta | Valor | Etiqueta | Valor] sin mezclar campos.
    doc.querySelectorAll('tr').forEach(tr => {
      let etiquetaPendiente: string | null = null;
      tr.querySelectorAll('td,th').forEach(td => {
        const clase = td.getAttribute('class') ?? '';
        const texto = limpiar(td.textContent);
        if (!texto) return;
        if (/subtitulo/i.test(clase)) {
          etiquetaPendiente = texto.replace(/:$/, '');
        } else if (/\bdato\b/i.test(clase)) {
          if (etiquetaPendiente) {
            agregarPar(etiquetaPendiente, texto);
            etiquetaPendiente = null;
          }
        } else if (etiquetaPendiente) {
          agregarPar(etiquetaPendiente, texto);
          etiquetaPendiente = null;
        }
      });
      // Fila residual: etiqueta sin clase y última celda como valor
      if (etiquetaPendiente) {
        const celdas = Array.from(tr.querySelectorAll('td,th')).map(x => limpiar(x.textContent));
        if (celdas.length >= 2) agregarPar(etiquetaPendiente, celdas[celdas.length - 1]);
      }
    });

    // 2) Bloques de texto con pares "Etiqueta: valor" (formato real de la ficha)
    if (filas.length === 0) {
      doc.querySelectorAll('td, p, div, b, strong, font, li').forEach(el => {
        // Solo nodos hoja para no duplicar el texto de los contenedores
        if (el.querySelector('td, p, div, b, strong, li')) return;
        const texto = limpiar(el.textContent);
        if (!texto || texto.length > 200) return;
        // Un mismo nodo puede traer varios campos: "N1: v1 - N2: v2"
        const partes = texto.split(/\s+-\s+(?=[A-ZÁÉÍÓÚÑÜ][^:]{2,40}:)/);
        for (const parte of partes) {
          let m = /^([^:]{2,45}?)\s*:\s*(.+)$/.exec(parte);
          if (m) {
            agregarPar(m[1], m[2]);
            continue;
          }
          // Campo sin dos puntos: "Urbanización URBANIZACION COUNTRY CLUB , ..."
          m = /^(Urbanizaci[oó]n)\s+(\S.*)$/i.exec(parte);
          if (m) agregarPar(m[1], m[2]);
        }
      });
    }

    // Sin duplicados consecutivos (tablas anidadas/contenedores) y tope de 18
    const unicas: [string, string][] = [];
    for (const fila of filas) {
      const previa = unicas[unicas.length - 1];
      if (!previa || previa[0].toLowerCase() !== fila[0].toLowerCase() || previa[1] !== fila[1]) {
        unicas.push(fila);
      }
      if (unicas.length >= 18) break;
    }
    console.info(`[Imprimir] Ficha pública (${codigo}): ${unicas.length} campos`);
    return unicas;
  }

  /**
   * Descarga una página ASP del servidor DataGIS probando primero la ruta
   * relativa (proxy de desarrollo / same-origin en producción) y luego la URL
   * absoluta. Decodifica correctamente ISO-8859-1 (codificación del ASP).
   * Devuelve el HTML o null si ambos intentos fallan.
   */
  private async descargarPaginaDataGIS(ruta: string, codigo: string): Promise<string | null> {
    return this.descargarUrlDataGIS(`/DataGIS_WGS84/${ruta}?codigo_i=${encodeURIComponent(codigo)}`);
  }

  /**
   * Descarga un recurso del servidor DataGIS probando primero la ruta
   * relativa (proxy de desarrollo / same-origin en producción) y luego la
   * misma ruta contra el host absoluto. Decodifica ISO-8859-1 si corresponde.
   */
  private async descargarUrlDataGIS(destino: string): Promise<string | null> {
    const candidatas = destino.startsWith('http')
      ? [destino.replace(/^https?:\/\/[^/]+/i, ''), destino]
      : [destino, `http://192.168.41.160${destino}`];
    for (const base of candidatas) {
      try {
        const controlador = new AbortController();
        const timeout = setTimeout(() => controlador.abort(), 6000);
        const respuesta = await fetch(base, {
          signal: controlador.signal,
        });
        clearTimeout(timeout);
        if (!respuesta.ok) continue;

        // El ASP responde ISO-8859-1: decodificamos según cabecera/meta
        const buffer = await respuesta.arrayBuffer();
        let html = new TextDecoder('utf-8').decode(buffer);
        const tipo = respuesta.headers.get('content-type') ?? '';
        if (
          /iso-8859-1|windows-1252|latin[-_]?1/i.test(tipo) ||
          /<meta[^>]+charset=["']?(iso-8859-1|windows-1252)/i.test(html.slice(0, 900))
        ) {
          html = new TextDecoder('windows-1252').decode(buffer);
        }
        return html;
      } catch {
        // Intentamos la siguiente ruta (sin proxy o bloqueo CORS)
      }
    }
    console.warn('[Imprimir] No se pudo descargar:', destino);
    return null;
  }

  /**
   * Intenta obtener la fotografía del lote desde la ficha ASP.
   * Estrategia:
   *  1) Descarga informacion.asp (vía proxy relativo) y recolecta los <img src>.
   *  2) Si la ficha enlaza una página de fotos ("Ver Fotos"), la descarga y
   *     suma también sus imágenes.
   *  3) Cada candidato se baja como blob (evita CORS y canvas contaminado),
   *     se convierte a DataURL y se descartan iconos diminutos.
   * Devuelve null si no hay foto usable; el PDF incluirá el enlace en línea.
   */
  private async obtenerFotoLote(codigo: string): Promise<string | null> {
    try {
      const baseFicha = '/DataGIS_WGS84/WEBFILES/informacion.asp';
      const htmlFicha = await this.descargarUrlDataGIS(`${baseFicha}?codigo_i=${encodeURIComponent(codigo)}`);
      if (!htmlFicha) return null;

      type Candidato = { ruta: string; prioridad: number };
      const candidatos: Candidato[] = [];
      const procesarPagina = (html: string, rutaPagina: string): void => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src') ?? '';
          // La imagen principal de la ficha se marca con name="IMAGEN_LOTE"
          const esPrincipal = /imagen_lote/i.test(img.getAttribute('name') ?? '');
          const extraPrioridad = esPrincipal ? -1 : 0;
          for (const c of this.rutasCandidatasDeSrc(src, rutaPagina.split('?')[0])) {
            candidatos.push({ ruta: c.ruta, prioridad: extraPrioridad + c.prioridad });
          }
          // Algunas fichas traen la foto sólo en el enlace de ampliación
          const contenedor = img.closest('a');
          const onClick = contenedor?.getAttribute('onclick') ?? '';
          const m = /https?:\/\/[^'"\s]+/i.exec(onClick);
          if (m && !src) {
            for (const c of this.rutasCandidatasDeSrc(m[0], rutaPagina.split('?')[0])) {
              candidatos.push({ ruta: c.ruta, prioridad: extraPrioridad + c.prioridad });
            }
          }
        });
      };

      procesarPagina(htmlFicha, baseFicha);

      // Ordenamos por prioridad, sin duplicados y descartando iconos
      const vistas = new Set<string>();
      const unicas: Candidato[] = [];
      for (const c of candidatos.sort((a, b) => a.prioridad - b.prioridad)) {
        if (/icon|bullet|arrow|flecha|logo|banner|fondo/i.test(c.ruta)) continue;
        if (vistas.has(c.ruta)) continue;
        vistas.add(c.ruta);
        unicas.push(c);
        if (unicas.length >= 8) break;
      }

      for (const c of unicas) {
        const dataUrl = await this.descargarImagenComoDataURL(c.ruta);
        if (dataUrl) {
          console.info('[Imprimir] Fotografía del lote obtenida:', c.ruta);
          return dataUrl;
        }
      }
      console.info('[Imprimir] Sin fotografía usable para el lote', codigo,
        '· candidatos revisados:', unicas.length);
      return null;
    } catch {
      return null; // Sin imagen disponible: el PDF usará el enlace a la ficha
    }
  }

  /**
   * Normaliza un src/href a una ruta del servidor DataGIS con forma
   * '/DataGIS_WGS84/...' (para pasarla por el proxy). Devuelve null si el
   * valor no es utilizable o apunta a otro host.
   */
  /**
   * Convierte un src/href en la lista ordenada de URLs descargables:
   *  - DataGIS (192.168.41.160): relativa al proxy + absoluta.
   *  - Portal municipal (www.munisanisidro.gob.pe): relativa (proxy
   *    "/GaleriaFotosCatastro" en desarrollo) + absoluta.
   * Devuelve [] si el valor no es utilizable o apunta a otro host.
   */
  private rutasCandidatasDeSrc(valor: string, rutaBase?: string): { ruta: string; prioridad: number }[] {
    const limpio = valor.trim();
    if (!limpio || /^(data:|javascript:|mailto:|#)/i.test(limpio)) return [];
    let url: URL;
    try {
      url = new URL(limpio, `http://192.168.41.160${rutaBase ?? '/DataGIS_WGS84/'}`);
    } catch {
      return [];
    }
    const destino = `${url.pathname}${url.search}`;
    const host = url.hostname.toLowerCase();
    if (host === '192.168.41.160') {
      return [
        { ruta: destino, prioridad: 0 },
        { ruta: `http://192.168.41.160${destino}`, prioridad: 1 },
      ];
    }
    if (/munisanisidro\.gob\.pe$/i.test(host)) {
      // La foto pública vive en el portal municipal (p. ej.
      // /GaleriaFotosCatastro/<cod>/FL-<cod>/FLFoto-N.jpg)
      return [
        { ruta: destino, prioridad: 0 }, // vía proxy "/GaleriaFotosCatastro" o same-origin
        { ruta: `${url.protocol}//${url.hostname}${destino}`, prioridad: 1 },
      ];
    }
    return [];
  }

  /**
   * Descarga una imagen como DataURL probando primero la ruta relativa
   * (proxy/same-origin) y luego la absoluta. Rechaza respuestas que no sean
   * imágenes o iconos demasiado pequeños (<60 px o <1,2 kB).
   */
  private async descargarImagenComoDataURL(url: string): Promise<string | null> {
    try {
      const controlador = new AbortController();
      const timeout = setTimeout(() => controlador.abort(), 6000);
      const respuesta = await fetch(url, { signal: controlador.signal });
      clearTimeout(timeout);
      if (!respuesta.ok) return null;
      const tipo = respuesta.headers.get('content-type') ?? '';
      if (!tipo.startsWith('image')) return null;
      const blob = await respuesta.blob();
      if (blob.size < 1200) return null; // descarta iconos/bullets

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result as string);
        lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        lector.readAsDataURL(blob);
      });
      const img = await this.cargarImagen(dataUrl);
      if (img.naturalWidth < 60 || img.naturalHeight < 60) return null;
      this.fotoProporcion = img.naturalWidth / Math.max(img.naturalHeight, 1);
      return dataUrl;
    } catch {
      return null;
    }
  }

  /**
   * Ajusta la vista antes de capturar:
   * - "Automática": encuadra el lote completo.
   * - Escala fija (1/500 o 1/250): centra el lote y calcula la resolución
   *   equivalente a esa escala de impresión según el ancho real del recuadro.
   */
  private async prepararVista(anchoCajaMm?: number): Promise<void> {
    const olMap = this.mapService.map();
    if (!olMap || !this.featureLote) return;
    const view = olMap.getView();
    const geometria = new GeoJSON().readGeometry(this.featureLote.geometry, {
      dataProjection: 'EPSG:32718',
      featureProjection: view.getProjection(),
    });
    if (!geometria) return;
    const centro = getCenter(geometria.getExtent());

    const eleccion = this.escala();
    if (eleccion !== 'auto') {
      const horizontal = this.orientacion() === 'horizontal';
      const base = this.formato() === 'a3'
        ? { v: 297, h: 420 }
        : { v: 210, h: 297 };
      const anchoPapelMm = horizontal ? base.h : base.v;
      const anchoMapaMm = anchoCajaMm ?? (anchoPapelMm - 22); // ancho real del recuadro impreso
      const cssWidth = olMap.getSize()?.[0] ?? 1;
      // denominadorEscala = metrosRealesRepresentados / metrosEnPapel
      const resolucion = (Number(eleccion) * (anchoMapaMm / 1000)) / cssWidth;
      view.setCenter(centro as number[]);
      view.setResolution(resolucion);
    } else {
      view.fit(geometria.getExtent(), { padding: [80, 80, 80, 80], duration: 0 });
    }
    // Esperamos al repintado tras el cambio de vista/resolución (margen mayor
    // para dar tiempo a que los nuevos tiles de ortofoto lleguen a solicitarse)
    await new Promise(res => setTimeout(res, 650));
  }

  /**
   * Genera un PDF con el mapa actual: encabezado con logo institucional,
   * título centrado, fecha/hora de impresión, marco del mapa y pie de página.
   */
  async generarPdf(): Promise<void> {
    if (this.generando()) return;
    this.mensajeProceso.set('Generando PDF…');
    this.generando.set(true);
    this.error.set(null);
    this.fechaHora.set(this.formatearFecha(new Date()));
    try {
      const horizontal = this.orientacion() === 'horizontal';
      const pdf = new jsPDF({
        orientation: horizontal ? 'landscape' : 'portrait',
        unit: 'mm',
        format: this.formato(),
      });
      const ancho = pdf.internal.pageSize.getWidth();
      const alto = pdf.internal.pageSize.getHeight();
      const margen = 10;

      // --- Geometría según norma ISO 5457 ---
      // Márgenes de 10 mm por lado ⇒ área útil: A4V 190×277 mm · A3H 400×277 mm
      const gapBloques = 3;
      const yLinea = margen + 15;          // línea separadora del encabezado
      const areaY = yLinea + 3;
      const areaW = ancho - margen * 2;    // 190 (A4 vertical) · 400 (A3 horizontal)
      const areaH = (alto - margen) - areaY - 9; // pie reservado DENTRO del área útil

      const filas = this.filasTabla();
      const tieneTabla = filas.length > 0 && !!this.mapService.loteSeleccionadoCodigo();
      const filasInfo = tieneTabla ? this.infoPublicaFilas() : [];
      const foto = this.fotoLote();

      // Mapa a TODO el ancho útil; en la parte inferior, tres marcos:
      // fotografía · datos cualitativos · ficha pública (LotePublico.asp)
      let mapaX = margen, mapaY = areaY, mapaW = areaW, mapaH = areaH;
      let yInferior = areaY;
      let altoInferior = 0;
      let fotoX = 0, fotoW = 0;
      let tablaX = 0, tablaW = 0;
      let infoX = 0, infoW = 0;
      if (tieneTabla) {
        const necesarias = Math.max(filas.length, filasInfo.length) * 5.2 + 10;
        altoInferior = Math.min(Math.max(necesarias, 48), 92);
        mapaH = areaH - altoInferior - gapBloques;
        yInferior = mapaY + mapaH + gapBloques;

        // Fotografía al DOBLE del ancho anterior (32 → 64 mm) ocupando todo
        // el espacio sobrante del cuerpo inferior; el reparto exacto entre
        // los tres marcos lo calcula calcularRepartoInferior().
        fotoX = margen;
        ({ fotoW, tablaW, infoW } = this.calcularRepartoInferior(areaW, gapBloques));
        tablaX = fotoX + fotoW + gapBloques;
        infoX = tablaX + tablaW + gapBloques;
      }

      // Red de seguridad: garantiza resaltado rojo + medidas antes de capturar
      if (this.mapService.loteSeleccionadoCodigo()) {
        this.mapService.asegurarResaltadoLoteSeleccionado();
      }

      // Caché: la 2ª impresión con el mismo contexto reutiliza la captura
      const claveCaptura = [
        this.mapService.loteSeleccionadoCodigo() ?? 'sin-lote',
        this.escala(),
        this.formato(),
        this.orientacion(),
        Math.round(mapaW),
        Math.round(mapaH),
      ].join('|');

      let imagenMapa: string;
      if (this.cacheCaptura && this.cacheCaptura.clave === claveCaptura) {
        console.info('[Imprimir] Reutilizando captura en caché');
        imagenMapa = this.cacheCaptura.imagen;
        this.mapaAnchoPx = this.cacheCaptura.anchoPx;
        this.mapaAltoPx = this.cacheCaptura.altoPx;
        this.resolucionCapturaMpx = this.cacheCaptura.resolucion;
      } else {
        imagenMapa = await this.capturarMapa({ w: mapaW, h: mapaH });
        this.cacheCaptura = {
          clave: claveCaptura,
          imagen: imagenMapa,
          anchoPx: this.mapaAnchoPx,
          altoPx: this.mapaAltoPx,
          resolucion: this.resolucionCapturaMpx,
        };
      }

      // --- Encabezado (contenido dentro de los márgenes ISO de 10 mm) ---
      try {
        const logo = await this.cargarImagen(LOGO_SRC);
        const logoAlto = 12;
        const logoAncho = (logo.width / logo.height) * logoAlto;
        pdf.addImage(logo, 'PNG', margen, margen, logoAncho, logoAlto);
      } catch {
        // Si el logo no está disponible continuamos sin él
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(...COLOR_INSTITUCIONAL);
      pdf.text(this.titulo(), ancho / 2, margen + 3.5, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(90, 90, 90);
      pdf.text('Municipalidad de San Isidro · Visor Cartográfico Catastral', ancho / 2, margen + 8, { align: 'center' });
      pdf.text(`Fecha de impresión: ${this.fechaHora()}   ·   Escala: ${this.etiquetaEscala()}`, ancho / 2, margen + 12, { align: 'center' });

      // --- Línea separadora ---
      pdf.setDrawColor(...COLOR_VERDE);
      pdf.setLineWidth(0.6);
      pdf.line(margen, yLinea, ancho - margen, yLinea);

      if (tieneTabla) {
        // Recuadro del mapa a todo el ancho útil (más ancho y con cuadrícula)
        this.dibujarMapa(pdf, imagenMapa, mapaX, mapaY, mapaW, mapaH);
        this.dibujarBarraEscala(pdf, mapaX, mapaY + mapaH, mapaW);

        // Marco inferior 1 · fotografía del lote
        this.dibujarFoto(pdf, foto, fotoX, yInferior, fotoW, altoInferior);

        // Marco inferior 2 · datos cualitativos (WFS)
        this.dibujarTabla(pdf, filas, tablaX, yInferior, tablaW, altoInferior);

        // Marco inferior 3 · ficha pública (LotePublico.asp)
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLOR_INSTITUCIONAL);
        pdf.text('Información pública del lote', infoX, yInferior + 2.5);
        if (filasInfo.length > 0) {
          this.dibujarTabla(pdf, filasInfo, infoX, yInferior, infoW, altoInferior, '', 0.55);
        } else {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(6.8);
          pdf.setTextColor(110, 110, 110);
          pdf.text('Sin datos públicos disponibles.', infoX, yInferior + 11);
          pdf.textWithLink(
            'Ver ficha en línea',
            infoX,
            yInferior + 16,
            { url: `http://192.168.41.160/DataGIS_WGS84/WEBFILES/LotePublico.asp?codigo_i=${this.mapService.loteSeleccionadoCodigo()}` },
          );
        }
      } else {
        // Sin lote: el mapa ocupa todo el cuerpo
        this.dibujarMapa(pdf, imagenMapa, mapaX, mapaY, mapaW, mapaH);
        this.dibujarBarraEscala(pdf, mapaX, mapaY + mapaH, mapaW);
      }

      // --- Pie de página (dentro del área útil ISO de 10 mm inferior) ---
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(80, 80, 80);
      pdf.text('Subgerencia de Planeamiento Urbano y Catastro', margen, alto - margen - 2);
      pdf.text(`Impreso: ${this.fechaHora()}`, ancho - margen, alto - margen - 2, { align: 'right' });

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      pdf.save(`${this.slug(this.titulo())}_${stamp}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
      this.error.set(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
    } finally {
      this.generando.set(false);
    }
  }

  /**
   * Envía la vista actual a la impresora usando una hoja dedicada
   * (título, logo, fecha/hora y mapa), sin bloquear el resto del visor.
   */
  async enviarAImpresora(): Promise<void> {
    if (this.generando()) return;
    this.mensajeProceso.set('Preparando impresión…');
    this.generando.set(true);
    this.error.set(null);
    this.fechaHora.set(this.formatearFecha(new Date()));
    try {
      // Ajustamos la vista según la escala elegida antes de capturar
      if (this.mapService.loteSeleccionadoCodigo()) {
        // Red de seguridad: garantiza el resaltado rojo y las medidas antes de imprimir
        this.mapService.asegurarResaltadoLoteSeleccionado();
        await this.prepararVista();
      }
      this.imagenMapa.set(await this.capturarMapaSimple());

      // Definimos tamaño/orientación de la hoja de impresión
      this.estiloPagina?.remove();
      this.estiloPagina = document.createElement('style');
      this.estiloPagina.id = 'msi-print-page-style';
      this.estiloPagina.textContent =
        `@page { size: ${this.formato()} ${this.orientacion() === 'horizontal' ? 'landscape' : 'portrait'}; margin: 8mm; }`;
      document.head.appendChild(this.estiloPagina);

      // Esperamos a que la imagen del mapa se pinte antes de abrir el diálogo
      setTimeout(() => window.print(), 250);
    } catch (err) {
      console.error('Error preparando la impresión:', err);
      this.error.set(err instanceof Error ? err.message : 'No se pudo preparar la impresión.');
      this.generando.set(false);
    }
  }

  /** Etiqueta legible de la escala elegida */
  private etiquetaEscala(): string {
    switch (this.escala()) {
      case '250': return '1/250';
      case '500': return '1/500';
      case '750': return '1/750';
      case '1000': return '1/1000';
      case '1250': return '1/1250';
      case '2000': return '1/2000';
      default: return 'Automática';
    }
  }

  /** Proporción (ancho/alto) de la última fotografía cargada */
  private fotoProporcion = 4 / 3;

  /** Ancho del marco de fotografía: el DOBLE del diseño original (32 mm) */
  private static readonly FOTO_ANCHO_MM = 64;
  /** Anchos mínimo/máximo garantizados de los marcos contiguos (mm) */
  private static readonly TABLA_MIN_MM = 52;
  private static readonly TABLA_MAX_MM = 84;
  private static readonly INFO_MIN_MM = 44;

  /**
   * Reparte el ancho útil del cuerpo inferior del plano entre los tres marcos:
   * fotografía (prioritaria, al doble del ancho original), tabla de datos
   * cualitativos y ficha pública. La fotografía ocupa el espacio sobrante y
   * se garantiza un mínimo legible para las dos columnas de texto.
   * @param areaW Ancho útil total del cuerpo (mm).
   * @param gapBloques Separación entre marcos (mm).
   */
  calcularRepartoInferior(
    areaW: number,
    gapBloques: number,
  ): { fotoW: number; tablaW: number; infoW: number } {
    const fotoW = Imprimir.FOTO_ANCHO_MM;
    const disponible = areaW - fotoW - gapBloques * 2;
    let tablaW = Math.max(
      Imprimir.TABLA_MIN_MM,
      Math.min(Imprimir.TABLA_MAX_MM, Math.round(disponible * 0.55)),
    );
    let infoW = disponible - tablaW;

    // Red de seguridad: si la ficha pública quedara demasiado estrecha,
    // cedemos milímetros a la columna cualitativa (nunca bajo su mínimo).
    if (infoW < Imprimir.INFO_MIN_MM && tablaW > Imprimir.TABLA_MIN_MM) {
      tablaW -= Imprimir.INFO_MIN_MM - infoW;
      infoW = disponible - tablaW;
    }
    return { fotoW, tablaW, infoW };
  }

  /**
   * Dibuja la imagen del mapa ajustada (contain) dentro del área dada,
   * centrada y con marco institucional.
   */
  private dibujarMapa(pdf: jsPDF, imagen: string, x: number, y: number, w: number, h: number): void {
    const escala = Math.min(w / this.mapaAnchoPx, h / this.mapaAltoPx);
    const mapaW = this.mapaAnchoPx * escala;
    const mapaH = this.mapaAltoPx * escala;
    const mapaX = x + (w - mapaW) / 2;
    const mapaY = y + (h - mapaH) / 2;
    pdf.addImage(imagen, 'JPEG', mapaX, mapaY, mapaW, mapaH);
    pdf.setDrawColor(...COLOR_INSTITUCIONAL);
    pdf.setLineWidth(0.35);
    pdf.rect(mapaX - 1, mapaY - 1, mapaW + 2, mapaH + 2);
  }

  /**
   * Dibuja la tabla cualitativa del lote con filas alternadas y bordes sutiles.
   */
  /**
   * Dibuja una tabla de filas [etiqueta, valor] con encabezado configurable.
   */
  private dibujarTabla(
    pdf: jsPDF,
    filas: [string, string][],
    x: number,
    y: number,
    w: number,
    h: number,
    titulo: string = 'Datos cualitativos del lote',
    pctClave: number = 0.45,
  ): void {
    const rowH = Math.min(7, Math.max((h - 6) / filas.length, 4.5));
    const colClave = w * pctClave; // columna de etiquetas adaptable al marco
    let cursorY = y + 5; // espacio para el título del bloque

    if (titulo) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...COLOR_INSTITUCIONAL);
      pdf.text(titulo, x, y + 2.5);
    }

    filas.forEach((fila, i) => {
      if (i % 2 === 0) {
        pdf.setFillColor(243, 244, 246); // gris muy claro
        pdf.rect(x, cursorY, w, rowH, 'F');
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(w < 80 ? 6.3 : 7); // fuente menor en marcos estrechos
      pdf.setTextColor(70, 70, 70);
      pdf.text(fila[0], x + 1.5, cursorY + rowH - 1.8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(20, 20, 20);
      pdf.text(this.truncarTexto(pdf, fila[1], w - colClave - 4), x + colClave, cursorY + rowH - 1.8);
      pdf.setDrawColor(215, 215, 215);
      pdf.setLineWidth(0.12);
      pdf.line(x, cursorY + rowH, x + w, cursorY + rowH);
      cursorY += rowH;
    });
  }

  /** Recorta un texto con elipsis para que quepa en el ancho indicado (mm) */
  private truncarTexto(pdf: jsPDF, texto: string, anchoMm: number): string {
    if (pdf.getTextWidth(texto) <= anchoMm) return texto;
    let t = texto;
    while (t.length > 1 && pdf.getTextWidth(t + '…') > anchoMm) {
      t = t.slice(0, -1);
    }
    return t.trimEnd() + '…';
  }

  /**
   * Dibuja la fotografía del lote (si está disponible) o el enlace a la
   * ficha en línea cuando no lo está.
   */
  private dibujarFoto(pdf: jsPDF, foto: string | null, x: number, y: number, w: number, h: number): void {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLOR_INSTITUCIONAL);
    pdf.text('Registro fotográfico', x, y + 2.5);

    const fotoY = y + 5;
    const fotoH = h - 5 - (this.fichaUrl() ? 4 : 0);
    if (foto) {
      try {
        const fw = Math.min(w, fotoH * this.fotoProporcion);
        const fh = fw / this.fotoProporcion;
        const fx = x + (w - fw) / 2;
        const fy = fotoY + (fotoH - fh) / 2;
        pdf.addImage(foto, 'JPEG', fx, fy, fw, fh);
        pdf.setDrawColor(...COLOR_INSTITUCIONAL);
        pdf.setLineWidth(0.25);
        pdf.rect(fx, fy, fw, fh);
      } catch {
        // Si falla la incrustación continuamos con el enlace
      }
    } else {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Sin fotografía disponible.', x, fotoY + 4);
    }

    if (this.fichaUrl()) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(20, 60, 160);
      pdf.textWithLink('Ver ficha completa en línea', x, y + h - 1, { url: this.fichaUrl()! });
    }
  }

  /**
   * Dibuja una barra de escala gráfica dentro del recuadro del mapa
   * (abajo-izquierda): 4 segmentos alternados con etiquetas de distancia,
   * calculada con la resolución real (m/px) de la última captura.
   */
  private dibujarBarraEscala(pdf: jsPDF, xRecuadro: number, yBaseRecuadro: number, anchoRecuadroMm: number): void {
    if (this.resolucionCapturaMpx <= 0 || this.mapaAnchoPx <= 1 || anchoRecuadroMm <= 10) return;
    // Metros reales representados por cada milímetro de papel en el recuadro
    const metrosPorMm = this.resolucionCapturaMpx * (this.mapaAnchoPx / anchoRecuadroMm);
    if (!isFinite(metrosPorMm) || metrosPorMm <= 0) return;

    // Barra objetivo ≈ 38 mm redondeada a un valor legible (1/2/5 × 10^n)
    const distancia = this.numeroAgradable(metrosPorMm * 38);
    const largoMm = distancia / metrosPorMm;
    if (distancia <= 0 || largoMm < 8 || largoMm > anchoRecuadroMm - 6) return;

    const x = xRecuadro + 3;              // margen interior izquierdo
    const y = yBaseRecuadro - 8;          // margen interior inferior
    const seg = largoMm / 4;

    // Fondo blanco para legibilidad sobre cualquier parte del mapa
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(30, 30, 30);
    pdf.setLineWidth(0.15);
    pdf.rect(x - 1.5, y - 4.4, largoMm + 3, 7.6, 'FD');

    // Segmentos alternados negro/blanco
    for (let i = 0; i < 4; i++) {
      const sx = x + i * seg;
      if (i % 2 === 0) {
        pdf.setFillColor(30, 30, 30);
        pdf.rect(sx, y - 2, seg, 2.6, 'F');
      } else {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(sx, y - 2, seg, 2.6, 'FD');
      }
    }
    // Contorno general de la barra
    pdf.setDrawColor(30, 30, 30);
    pdf.rect(x, y - 2, largoMm, 2.6);

    // Etiquetas de los ticks
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.6);
    pdf.setTextColor(25, 25, 25);
    pdf.text('0', x, y - 2.7, { align: 'center' });
    pdf.text(this.formatearDistanciaM(distancia / 2), x + largoMm / 2, y - 2.7, { align: 'center' });
    pdf.text(this.formatearDistanciaM(distancia), x + largoMm, y - 2.7, { align: 'left' });
  }

  /** Redondea un valor positivo al "número agradable" (1/2/5 × 10^n) inmediato inferior. */
  private numeroAgradable(valor: number): number {
    if (valor <= 0) return 0;
    const base = Math.pow(10, Math.floor(Math.log10(valor)));
    for (const factor of [5, 2, 1]) {
      const candidato = factor * base;
      if (candidato <= valor * 1.001) return candidato;
    }
    return base;
  }

  /** Formatea una distancia para las etiquetas de la barra de escala. */
  private formatearDistanciaM(metros: number): string {
    if (metros >= 1000) {
      const km = metros / 1000;
      const texto = Number.isInteger(km) ? String(km) : km.toFixed(km < 10 ? 2 : 1);
      return `${texto} km`;
    }
    return `${Math.round(metros)} m`;
  }
}

