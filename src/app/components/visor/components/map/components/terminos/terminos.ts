import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
//Servicio
import { MapService } from '@app/services/map.service';

/**
 * Cláusulas numeradas del cuerpo del modal (párrafos 1 a 7).
 * Se mantienen como datos para que la plantilla las recorra con @for
 * en lugar de repetir el mismo bloque de marcado siete veces.
 */
const CLAUSULAS_TERMINOS: readonly string[] = [
  'La información gráfica, los polígonos, las áreas y los perímetros mostrados en el visor provienen de la base de datos catastral institucional y se encuentran georreferenciados en el sistema oficial de coordenadas (UTM WGS84-18S / SIRGAS). No obstante, tienen carácter estrictamente referencial y no constituyen un certificado de catastro, certificado de parámetros urbanísticos, ni título de propiedad, por lo que no surten efectos jurídicos para procesos administrativos formales, trámites de licencias de obra o procesos judiciales.',
  'La base de datos catastral se encuentra en constante proceso de actualización, revisión e incorporación técnica por parte de la Subgerencia de Planeamiento Urbano y Catastro. La información mostrada corresponde al estado de la cartografía a la fecha de la consulta.',
  'Los datos técnicos visualizados se obtienen mediante la consulta por código catastral, código CUC, dirección, o mediante la navegación directa sobre el mapa. Si detecta alguna incongruencia técnica o cartográfica, puede canalizar sus observaciones a través del correo institucional de la subgerencia o mediante los mecanismos de soporte habilitados para el proyecto.',
  'El usuario se obliga a emplear la plataforma de manera correcta, cerniéndose a las directrices y criterios técnicos de la municipalidad. Queda prohibido utilizar la herramienta con fines ilícitos, intentar vulnerar los sistemas de seguridad, extraer masivamente la información mediante bots o scripts no autorizados, o alterar, modificar y comercializar los mapas e imágenes obtenidas a través del servicio.',
  'La Municipalidad de San Isidro está facultada para supervisar el uso del visor, así como para realizar mantenimientos preventivos o correctivos, interrupciones temporales del servicio por actualización de datos o mejoras tecnológicas, sin previo aviso.',
  'La municipalidad podrá modificar los presentes términos y condiciones en cualquier momento para adaptarlos a nuevas normativas (como los lineamientos del SNCP) o mejoras de la plataforma. Las modificaciones entrarán en vigor a partir de su publicación en el mismo portal del visor.',
  'El uso de este visor implica la aceptacion plena de los presentes términos y condiciones.',
];

/**
 * Modal global de Términos y Condiciones del Geovisor Catastral.
 * Se muestra automáticamente cuando el usuario hace zoom sobre el distrito de
 * San Isidro (ver MapService.setupTermsOnZoom) o al pulsar el botón
 * "Ver Términos y Condiciones" del panel "Acerca de".
 */
@Component({
  selector: 'app-terminos',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './terminos.html',
  styleUrl: './terminos.css',
})
export class TermsModal {
  public readonly mapService = inject(MapService);

  /**
   * Duración (ms) de la animación de salida definida en terminos.css
   * (.animate-fade-out / .animate-scale-out). Debe mantenerse sincronizada.
   */
  private static readonly CLOSE_ANIMATION_MS = 300;

  /** Cláusulas numeradas del cuerpo del modal */
  protected readonly clausulas = CLAUSULAS_TERMINOS;

  /** Estado del checkbox "He leído y acepto los términos." */
  readonly modalTermsAccepted = signal(false);

  /** Indica que el modal está animando su salida (efecto inverso a la aparición) */
  readonly isClosing = signal(false);

  /** URL pública del sitio de la Municipalidad de San Isidro a la que se redirige al rechazar los términos */
  private readonly institutionalUrl = 'https://msi.gob.pe';

  /** El usuario no acepta los términos: cierra la aplicación y sale hacia el sitio web de la municipalidad */
  rejectAndExit(): void {
    this.modalTermsAccepted.set(false);
    this.mapService.closeTermsModal();
    // El visor puede estar embebido en un iframe del portal municipal. Si ocurre,
    // lo correcto es navegar la ventana superior para "salir" de la aplicación;
    // si no se puede (embedding cross-origin restringido), navegamos la actual.
    try {
      window.top!.location.assign(this.institutionalUrl);
    } catch {
      window.location.assign(this.institutionalUrl);
    }
  }

  /** Registra la aceptación de los términos, anima la salida y cierra el modal */
  acceptAndEnter(): void {
    // Evita disparar la animación más de una vez (doble clic)
    if (this.isClosing()) {
      return;
    }
    // Activa la animación de salida (ver clases animate-*-out en terminos.css)
    this.isClosing.set(true);
    // Espera a que termine la animación antes de remover el modal del DOM
    setTimeout(() => {
      this.mapService.acceptTerms();
      this.modalTermsAccepted.set(false);
      this.isClosing.set(false);
    }, TermsModal.CLOSE_ANIMATION_MS);
  }
}