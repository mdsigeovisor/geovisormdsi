## Visor Geográfico Municipal - Distrito de San Isidro

Este proyecto es un visor cartográfico avanzado desarrollado para la **Municipalidad de San Isidro**, diseñado para fortalecer la atención al ciudadano y la gestión del territorio. Permite la visualización interactiva de predios, zonificación y herramientas de búsqueda geoespacial dentro de la jurisdicción distrital.

Desarrollado con **Angular 20** y **OpenLayers**.

## 🚀 Características Principales

- **Arquitectura Standalone:** Uso de componentes independientes para mayor modularidad.
- **Gestión de Estado con Signals:** Reactividad eficiente para el manejo de capas, coordenadas y estados del visor en tiempo real.
- **Mapa Interactivo:** 
  - Soporte para mapas base (Google Satellite y OpenStreetMap).
  - Integración de servicios WMS (Zonificación, Lotes, Manzanas, Vías y Equipamiento Urbano).
  - Control de vista general (Overview Map).
  - Geolocalización en tiempo real.
- **Búsqueda Catastral y Urbana:** Localización de predios por dirección municipal, código catastral y datos del ciudadano/contribuyente.

## 🛠️ Tecnologías y Dependencias

- **Angular:** Framework principal.
- **OpenLayers (ol):** Motor de renderizado de mapas.
 - **GeoServer:** Gestión y publicación de datos espaciales municipales.
- **Google Maps API:** Capas satelitales.

### 📂 Estructura del Proyecto

```text
src/
├── app/
│   ├── animation/      # Animaciones, transiciones y lógica visual reutilizable.
│   ├── components/     # Componentes comunes compartidos en toda la aplicación.
│   ├── core/           # Servicios singleton, interceptores y guards globales.
│   ├── css/            # Estilos globales y configuraciones de diseño (Tailwind/PostCSS).
│   ├── interfaces/     # Definiciones de tipos y contratos de datos (interfaces).
│   ├── models/         # Clases de dominio y modelos de datos.
│   ├── services/       # Lógica de negocio y comunicación con APIs externas.
│   ├── util/           # Funciones auxiliares y utilidades puras.
│   ├── features/       # Módulos organizados por dominio o funcionalidad de negocio.
│   └── app.module.ts   # Módulo raíz principal de la aplicación.
├── assets/             # Recursos estáticos (imágenes, iconos, fuentes).
├── environments/       # Configuraciones por entorno (desarrollo, producción).
│   ├── environment.ts
│   └── environment.prod.ts
├── typings/            # Definiciones de tipos globales (.d.ts).
└── main.ts             # Punto de entrada de la aplicación para el bootstrap.
```
```
