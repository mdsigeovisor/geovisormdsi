# Historial de Cambios (Changelog)

Este documento registra todos los cambios notables realizados en el "Visor Geográfico Municipal - Distrito de San Isidro".

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---
---

## [1.1.0] - 2026-08-24

### ✨ Added (Nuevas Características)

*   **Selección de Lote para Impresión Mejorada:**
    *   Al hacer clic sobre un lote en modo selección, ahora se **resalta con una línea roja gruesa** (con halo blanco para visibilidad sobre ortofotos).
    *   **Medidas perimetrales eventuales:** se estampan sobre la gráfica las distancias en metros de cada arista real del polígono (fusionando vértices casi colineales), visibles en el mapa e incluidas automáticamente en el PDF/impresión.
    *   El resaltado y las medidas desaparecen al quitar o cambiar la selección del lote.

### 🔧 Changed (Cambios)

*   **Módulo de Impresión (PDF):**
    *   Se aumentó el alto de la parte gráfica del plano (~75% del cuerpo, antes 62%) compactando el bloque de tabla cualitativa/fotografía y el pie de página.
    *   **Recuadro del mapa duplicado:** nuevo layout de dos paneles — el mapa ocupa todo el alto del cuerpo (panel izquierdo) y la tabla/fotografía pasan a una columna derecha; además la captura se adapta al aspecto exacto del recuadro (150 dpi), eliminando bandas vacías.
    *   **Cuadrícula UTM-18S:** líneas de cuadrícula eventuales con etiquetas Este/Norte estampadas solo durante la captura del plano.
    *   **Barra de escala gráfica:** barra vectorial de 4 segmentos dentro del recuadro, calculada con la resolución real de la captura y redondeada a valores legibles (m/km).
    *   **Marco inferior de ficha pública:** nuevo marco con la información de `LotePublico.asp` (misma ficha del ciudadano) usando el código catastral capturado al hacer clic; parser HTML de tablas con respaldo "Etiqueta: valor" y aviso/enlace en línea si no está disponible.
    *   **Márgenes ISO 5457:** márgenes de impresión de 10 mm por lado ⇒ área útil A4V 190×277 mm · A3H 400×277 mm; encabezado y pie reubicados dentro del área útil.
    *   **Mapa a todo el ancho útil:** el recuadro del mapa pasa a ocupar los 190/400 mm completos del área útil (antes compartía columna), con la fila inferior compuesta por fotografía · datos cualitativos · ficha pública.
    *   **Corrección (SRS):** el resaltado rojo y las medidas no aparecían porque el GetFeatureInfo devuelve la geometría en la proyección de la vista (EPSG:3857) y se interpretaba como UTM 18S. Ahora se detecta el SRS real del GeoJSON (miembro `crs` o proyección de la vista), las medidas se calculan siempre sobre coordenadas UTM 18S y existe una red de seguridad que recupera la geometría vía WFS al generar el PDF/impresión si no estuviera dibujada.
    *   **Corrección (ficha pública):** la llamada a `LotePublico.asp` fallaba por CORS desde el entorno de desarrollo. Ahora se descarga vía ruta relativa `/DataGIS_WGS84` (nueva entrada en `proxy.conf.json`) con fallback a la URL absoluta, decodifica ISO-8859-1 y el parser reconoce el formato real de la ficha (pares con/sin dos puntos, campos múltiples por nodo como `Niveles construidos / Niveles Zonificación`). Mismo arreglo aplicado a la descarga de la fotografía (`informacion.asp`).

---


## [1.0.0] - 2026-08-12

### ✨ Added (Nuevas Características)

*   **Módulo de Búsqueda Avanzada:**
    *   Implementación de panel de consultas con múltiples pestañas para facilitar el acceso a la información.
    *   **Búsqueda Catastral:** Búsqueda de predios por Código Catastral (`Sector-Manzana-Lote`).
    *   **Búsqueda por CUC:** Localización de predios mediante su Código Único Catastral.
    *   **Búsqueda por Dirección:**
        *   Función de autocompletado de vías para minimizar errores de tipeo.
        *   Al seleccionar una vía, el mapa se centra y resalta su trazado completo.
    *   **Búsqueda por Habilitación Urbana:**
        *   Sistema de autocompletado en cascada: Habilitación -> Manzana -> Lote.
        *   Permite localizar un predio específico a partir de su información urbana.
    *   **Búsqueda por Parques:**
        *   Autocompletado para encontrar parques y áreas recreativas por su denominación.
        *   El mapa se ajusta automáticamente a la geometría del parque seleccionado.
    *   **Búsqueda por Ciudadano:** (Funcionalidad para usuarios autenticados)
        *   Permite buscar propiedades asociadas a un ciudadano por DNI o por nombre completo.
        *   Muestra una lista de predios vinculados, permitiendo navegar a cada uno.

*   **Interacción con el Mapa:**
    *   **Información en Clic (GetFeatureInfo):**
        *   Al hacer clic sobre un lote, se abre una ventana modal con su ficha de información detallada.
        *   Habilitada la consulta de Fotos de Dron (años 2018 y 2024) al hacer clic en las capas correspondientes.
    *   **Resaltado de Búsquedas:** Las geometrías resultantes de una búsqueda (lotes, vías, parques) se resaltan visualmente en el mapa y la vista se ajusta para una correcta visualización.
    *   **Marcador de Búsqueda:** Se añade un marcador distintivo en el centroide del predio encontrado para una fácil identificación.

*   **Gestión de Capas:**
    *   **Nuevas Ortofotos:** Se ha añadido la capa de ortofoto del año **2025**.
    *   **Control de Capas Mejorado:** La visibilidad de las capas de ortofotos ahora funciona como un grupo de radio-botones, permitiendo que solo una esté activa a la vez para evitar superposiciones.

*   **Navegación y Experiencia de Usuario:**
    *   **Mapa de Vista General (OverviewMap):** Integrado un mini-mapa en la esquina para facilitar la orientación espacial.
    *   **Animación de "Vuelo":** Se ha implementado una animación de navegación suave al usar funciones como "Ir a San Isidro", mejorando la experiencia de transición entre vistas lejanas y cercanas.
    *   **Pantalla de Bienvenida:** Diseño de una página de bienvenida (`/login`) con un carrusel de imágenes representativas del distrito.

### 🐛 Fixed (Correcciones)

*   **Búsqueda por Dirección:** Se normaliza la entrada del usuario (ej. "CA " a "CA.") para asegurar la consistencia entre el autocompletado y la búsqueda final.
*   **Mapa de Vista General:** Solucionado un problema donde el mapa de vista general no se renderizaba correctamente al iniciar la aplicación.

### 🛠️ Refactor (Refactorización)

*   **Gestión de Estado:** Se utiliza `Signals` de Angular para una gestión de estado más moderna y reactiva en la visibilidad de capas, herramientas activas y resultados de búsqueda.
*   **Servicios:** Se ha centralizado toda la lógica de interacción con OpenLayers y los servicios de GeoServer en `MapService`, promoviendo una arquitectura más limpia y mantenible.
*   **Arquitectura:** El proyecto se estructura con componentes `standalone`, mejorando la modularidad y reduciendo la dependencia de `NgModules`.

---

