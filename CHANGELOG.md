# Historial de Cambios (Changelog)

Este documento registra todos los cambios notables realizados en el "Visor Geográfico Municipal - Distrito de San Isidro".

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

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

