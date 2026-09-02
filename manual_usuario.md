# 📘 Manual de Usuario — Geovisor Catastral
### Municipalidad de San Isidro (MDSI)

**Versión del documento:** 1.0 · **Versión de la aplicación:** 1.0.0

---

## 1. Introducción

El **Geovisor Catastral** es la aplicación web de la Municipalidad de San Isidro que permite a la ciudadanía, a los servidores municipales y a entidades públicas **consultar y visualizar la información geoespacial, la cartografía oficial y los datos técnicos de los predios del distrito**, sobre una base cartográfica y de imágenes satelitales actualizadas.

### 1.1. ¿A quién va dirigido este manual?

Este manual está dirigido a **cualquier persona que ingrese por primera vez al Geovisor**, sin conocimientos técnicos previos de sistemas de información geográfica (SIG). Cada función del visor se explica paso a paso.

### 1.2. Acceso a la aplicación

| Elemento | Detalle |
|---|---|
| URL de la aplicación | Portal institucional de la Municipalidad de San Isidro (Geovisor Catastral) |
| Navegadores recomendados | Google Chrome, Microsoft Edge, Mozilla Firefox (versiones recientes) |
| Resolución recomendada | 1366 × 768 píxeles o superior |
| Conexión | Se requiere conexión a Internet (las capas y el mapa se cargan en línea) |

> **Nota:** al abrir la aplicación, la ruta principal (`/visor`) redirige automáticamente al mapa. Cualquier dirección incorrecta también lo llevará al visor.

### 1.3. Aviso importante (carácter referencial de la información)

La información gráfica, los polígonos, las áreas y los perímetros mostrados provienen de la base de datos catastral institucional (georreferenciada en **UTM WGS84‑18S / SIRGAS**) y tienen **carácter estrictamente referencial**. **No constituyen** certificado de catastro, certificado de parámetros urbanísticos ni título de propiedad, y **no surten efectos jurídicos** en procesos administrativos, licencias de obra o procesos judiciales.

El **usuario es el único responsable** del uso correcto, adecuado y legal de la información, así como de los productos o resultados que genere a partir de ella.

---

## 2. Primer ingreso: Términos y Condiciones

La primera vez que entra al visor se muestra una ventana modal con los **Términos y Condiciones para el uso del Servicio**.

**Pasos:**

1. Lea el contenido desplazándose por la ventana.
2. Marque la casilla **"He leído y acepto los términos."**
3. Presione el botón **"Acepto e ingresar"**.
   - Si presiona **"No acepto"**, no podrá acceder al visor.
4. Aceptado el texto, se abrirá el mapa principal.

Puede volver a consultar los términos en cualquier momento desde el panel **Acerca de** (botón *"Ver Términos y Condiciones"*).

---

## 3. Descripción general de la pantalla principal

Al ingresar, la pantalla del Geovisor se organiza así:

```
┌─────────────────────────────────────────────────────────────────┐
│  BARRA SUPERIOR (Navbar): Logo · Visitas · Título · Tour ·      │
│  Observatorio · Acceder/Salir                                   │
├───────────┬─────────────────────────────────────┬───────────────┤
│           │                                     │  PANEL DE     │
│  PANEL    │           MAPA PRINCIPAL            │  FUNCIONES    │
│  LATERAL  │   (cartografía catastral)           │  (derecha):   │
│  (izq.):  │                                     │  zoom, home,  │
│  Consultas│  · Ficha del lote al hacer clic     │  ubicación,   │
│  Capas    │  · Leyenda flotante                 │  mapa base,   │
│  Leyenda  │  · Mini-mapa de ubicación           │  herramientas │
│  Coorden. │  · Coordenadas del cursor           │               │
│  Imprimir │                                     │               │
│  Descargas│                                     │               │
│  Acerca de│                                     │               │
└───────────┴─────────────────────────────────────┴───────────────┘
```

---

## 4. Barra superior (Navbar)

Ubicada en la parte superior de la pantalla, contiene:

| Elemento | Descripción |
|---|---|
| **Logo MSI** | Identificación institucional de la Municipalidad de San Isidro. |
| **Visitas** | Contador público de visitas al geovisor. Se incrementa con cada carga de la página. |
| **Geovisor Catastral** | Título principal de la aplicación. |
| **Tour (ℹ)** | Lanza el **recorrido interactivo guiado**: una secuencia de pasos que resalta cada elemento del visor con su explicación. Muy recomendado para primeros ingresos. Navegue con los botones *Siguiente / Anterior* y ciérrelo con ✕ o el botón *Finalizar*. |
| **Observatorio** | Enlace externo que abre en una **pestaña nueva** el Observatorio Urbano de la comuna. |
| **Acceder / Salir** | Abre el formulario de inicio de sesión (o cierra la sesión con confirmación). Ver sección 10. |


---

## 5. Panel lateral izquierdo

Se abre con los botones de la esquina superior izquierda del mapa. Cada icono muestra un módulo distinto:

### 5.1. 🔍 Consultas

Permite localizar predios y elementos del catastro mediante distintos criterios (pestañas):

| Pestaña | Descripción | Requiere sesión |
|---|---|---|
| **Por Código Catastral** | Búsqueda precisa por código de Sector, Manzana y Lote. | No |
| **Por Código CUC** | Búsqueda por Código Único Catastral. | **Sí** |
| **Por Código Predial** | Búsqueda por el código del predio. | No |
| **Por Dirección** | Encuentra un predio por nombre de vía y número. | No |
| **Por Habilitación Urbana** | Búsqueda de habilitaciones urbanas. | No |
| **Por Titular / Denominación / Parque** | Otros criterios de consulta disponibles según el módulo. | Algunos: Sí |

**Uso general:** seleccione la pestaña del criterio → escriba el valor (los resultados suelen mostrarse mientras escribe) → haga clic en el resultado → el mapa se centrará en el predio y se mostrará su información.

> 💡 Las consultas marcadas como restringidas (p. ej. **CUC** y **Titular**) solo aparecen cuando ha iniciado sesión (ver sección 10).

### 5.2. 🗂️ Capas

Módulo para **activar o desactivar las capas cartográficas** visibles en el mapa.

**Uso:**

1. Abra el panel *Capas*: verá las capas agrupadas en **secciones** plegables.
2. Toque la cabecera de una sección para expandirla o contraerla.
3. Active/desactive cada capa con su interruptor (checkbox). El mapa se actualiza al instante.
4. Use los botones de acción de cada sección para **activar/desactivar todas las capas de la sección de una sola vez**.

> 💡 Si el mapa se ve sobrecargado, desactive las capas que no necesite; la leyenda (sección 5.3) solo reflejará las capas activas.

### 5.3. 🗺️ Leyenda

Abre una **ventana flotante sobre el mapa** con la simbología de las capas activas.

- **Arrastrar:** mantenga presionada la barra de título y arrastre a cualquier posición.
- **Minimizar / Expandir:** botón con la flecha (▲/▼).
- **Cerrar:** botón ✕.

### 5.4. 📍 Coordenadas (Búsqueda por coordenadas)

Ubica un punto en el mapa ingresando sus coordenadas. Elija primero el sistema:

| Sistema | Campos |
|---|---|
| **Geográficas** | Latitud (Y), ej.: `-12.098` · Longitud (X), ej.: `-77.043` |
| **UTM** | Este (X), Norte (Y) y **Zona** (17S, 18S o 19S). Ej.: Este `279530`, Norte `8659795`, Zona `18S` |

Escriba los valores y presione el botón de ubicación: el mapa se desplazará al punto y se marcará con un indicador. Si los valores no son válidos, se muestra un mensaje de error en rojo indicando la corrección necesaria.

### 5.5. 🖨️ Imprimir / Exportar

Genera un **PDF** o envía a la impresora la vista actual del mapa, con **título, logo institucional y fecha/hora de impresión**, incluyendo cuadrícula, medidas y la ficha del lote seleccionado.

**Pasos:**

1. Centre y configure el mapa como desea que aparezca (capas activas, zoom, selección del lote).
2. Abra *Imprimir* y complete el **Paso 1 · Selección del lote** y los datos de la plantilla.
3. Confirme la acción. Aparecerá una pantalla de proceso con el avance: *"Capturando el mapa con su cuadrícula, medidas y ficha del lote..."*.
4. Al finalizar, se descargará el PDF (o se abrirá el diálogo de impresión). La ventana de proceso se cierra automáticamente.

> ⏳ No cierre ni recargue la página mientras se genera el documento.

### 5.6. 📥 Descargas

Lista de **documentos y formatos de descarga disponibles** (p. ej. planos oficiales en PDF como *Plano de Zonificación* o *Sistema Vial Metropolitano de Lima en la Jurisdicción de San Isidro*). Haga clic en el documento; se abre o descarga según su navegador.

### 5.7. ℹ️ Acerca de

Muestra la información del sistema: nombre del aplicativo, versión (1.0.0), propósito, botón **"Ver Términos y Condiciones"** y enlace al **Observatorio Urbano**.

---

## 6. Panel de funciones (lado derecho del mapa)

Columna flotante de botones verticales:

| Botón (icono) | Función |
|---|---|
| ➕ **Acercar zoom** | Aumenta el nivel de zoom para ver más detalle. |
| ➖ **Alejar zoom** | Reduce el zoom para ver un área más amplia. |
| 🏠 **Vista general (Home)** | Restablece la vista a la extensión inicial del distrito de San Isidro. |
| 📍 **Mi ubicación** | Centra el mapa en su posición actual (el navegador solicitará permiso de geolocalización). |
| 🛰️ **Cambiar mapa base** | Alterna entre las vistas **Satélite → Calles → Mapa en blanco**. Al pulsarlo se despliega un pequeño selector de bases. |
| 🛠️ **Herramientas de dibujo** | Abre el panel de herramientas para **medir distancias y áreas, y dibujar sobre el mapa**. El botón se resalta cuando las herramientas están activas. |

**Navegación con el mouse:** use la **rueda del ratón** para hacer zoom y **arrastre** (mantener clic) para desplazarse por el mapa.

---

## 7. Interacción con el mapa

- **Clic sobre un lote/predio:** se selecciona el predio, se resalta en el mapa y se muestra su **ficha catastral** con los datos técnicos disponibles.
- **Panel de coordenadas del cursor:** al mover el ratón se visualizan las coordenadas de la posición del cursor.
- **Mini-mapa (Overview Map):** ventana pequeña que muestra la ubicación general de la vista actual respecto al distrito; útil cuando se trabaja con mucho zoom.
- **Leyenda flotante:** consulte la simbología en todo momento (sección 5.3).


---

## 8. Inicio de sesión (Acceder)

El acceso con credenciales **desbloquea funcionalidades restringidas**, como las consultas por **CUC** y por **Titular**, y capas restringidas.

**Pasos:**

1. En la barra superior, pulse **"Acceder"**.
2. Se abrirá una ventana de inicio de sesión (indicada como *"Acceso restringido al personal autorizado"*).
3. Ingrese **Usuario o Correo** y su **Contraseña**.
4. Pulse el botón de ingreso (o presione **Enter**).
5. Si las credenciales son incorrectas, se mostrará un mensaje de error en rojo; corríjalo e intente de nuevo.

**Cerrar sesión:**

1. Pulse **"Salir"** en la barra superior.
2. Confirme en el cuadro de diálogo *"¿Está seguro de que desea cerrar la sesión?"* con **Cerrar Sesión** (o **Cancelar** para volver).

---

## 9. Tour interactivo (recomendado para nuevos usuarios)

El **Tour** es la forma más rápida de aprender el visor:

1. Pulse el botón **Tour (ℹ)** de la barra superior.
2. La aplicación resaltará, uno a uno, cada elemento: navbar, contador de visitas, mapa principal, panel de consultas, capas, leyenda, coordenadas, impresión, descargas, controles de zoom, cambio de mapa base, herramientas y acceso/salida.
3. Navegue con **Anterior / Siguiente**; finalice con **Finalizar** o cierre con ✕ en cualquier momento.
4. Puede repetirlo las veces que necesite.

---

## 10. Preguntas frecuentes (FAQ)

**¿La información sirve para un trámite legal?**
No. Es referencial y no surte efectos jurídicos (ver sección 1.3). Para certificados oficiales, diríjase a la Subgerencia de Planeamiento Urbano y Catastro.

**¿Por qué no veo la opción de búsqueda "Por Código CUC"?**
Es una función restringida. Debe **iniciar sesión** con credenciales autorizadas.

**No encuentro mi predio. ¿Qué hago?**
Verifique el criterio de búsqueda (código catastral completo: sector‑manzana‑lote, o dirección con tipo de vía y número) y que la capa catastral esté **activa** en el panel *Capas*.

**El mapa está muy cargado de información.**
Desactive capas que no necesite en *Capas* y pulse 🏠 **Home** para volver a la vista general.

**¿Puedo usar el visor sin iniciar sesión?**
Sí. La consulta general del mapa, capas, consultas públicas, impresión y descargas están disponibles para cualquier visitante.

**¿A qué coordenadas corresponde el visor?**
La cartografía está georreferenciada en **UTM WGS84 zona 18S (SIRGAS)**; el buscador acepta también coordenadas geográficas y UTM de las zonas 17S, 18S y 19S.

---

## 11. Glosario

| Término | Definición |
|---|---|
| **Catastro** | Inventario georreferenciado de los predios del distrito. |
| **CUC** | Código Único Catastral: identificador nacional del predio. |
| **Lote / Predio** | Unidad territorial con límites definidos dentro de una manzana. |
| **Habilitación Urbana** | Núcleo urbano (urbanización, asociación, cooperativa, etc.) con trazado definido. |
| **Capa** | Conjunto de información geográfica superpuesta al mapa (zonificación, vías, lotes…). |
| **Leyenda** | Explicación gráfica de la simbología usada en el mapa. |
| **Mapa base** | Fondo cartográfico (satélite, calles o blanco) sobre el que se dibujan las capas. |
| **UTM WGS84‑18S / SIRGAS** | Sistema oficial de coordenadas con el que está georreferenciada la cartografía. |
| **Georreferenciación** | Asociación de la información con coordenadas reales sobre la Tierra. |

---

## 12. Soporte

Para consultas, reporte de errores o solicitudes de acceso con credenciales, contacte a la **Subgerencia de Planeamiento Urbano y Catastro — Municipalidad de San Isidro**, o a través del Observatorio Urbano: <https://test.munisanisidro.gob.pe/WebObservatorioUrbano/>

---
*Documento generado a partir de la versión 1.0.0 del aplicativo Geovisor Catastral (Municipalidad de San Isidro).*
