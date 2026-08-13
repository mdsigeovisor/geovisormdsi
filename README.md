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


## 🏛️ Arquitectura de la Aplicación

La aplicación sigue una arquitectura de microservicios orientada a la web, donde el frontend actúa como un cliente inteligente que consume datos de diversas fuentes especializadas. A continuación, se detalla cada componente principal:

*   **Frontend (Visor Geográfico):** Es la interfaz de usuario desarrollada en **Angular**. Se encarga de la renderización del mapa, la gestión de la interacción del usuario y la orquestación de las llamadas a los diferentes servicios backend.

*   **Servicios Geoespaciales:**
    *   **GeoServer:** Actúa como el motor geoespacial principal. Publica los datos catastrales almacenados en PostGIS a través de estándares OGC como **WMS** (para la visualización de capas) y **WFS** (para consultas de datos vectoriales).
    *   **Servidor de Ortofotos (XYZ):** Un servicio dedicado a servir teselas (tiles) de ortofotos históricas, optimizado para un alto rendimiento en la visualización de imágenes aéreas.

*   **Servicios de Datos Legacy:**
    *   **API de Fichas (ASP):** Una API existente que provee acceso a información detallada de los predios (fichas) y a recursos como las fotografías de dron. El visor se integra con este sistema para mantener la continuidad del negocio.

*   **Fuentes de Datos Externas:**
    *   **Google Maps API y OpenStreetMap:** Proveen las capas base de mapa satelital y de calles, respectivamente, enriqueciendo el contexto geográfico del visor.

*   **Base de Datos:**
    *   **PostGIS / BD Catastral:** Es el repositorio central de la información geoespacial. Utiliza PostgreSQL con la extensión PostGIS para almacenar y gestionar de forma eficiente los datos de lotes, vías, y otra información territorial.

```mermaid
graph TB
  subgraph "Cliente Web"
    FRONT[Visor Geográfico (Angular)]
  end

  subgraph "Servicios Geoespaciales"
    GEOSERVER[GeoServer]
    ORTOFOTOS[Servidor de Ortofotos (XYZ)]
  end

  subgraph "Servicios de Datos"
    LEGACY_API[API de Fichas (ASP)]
  end

  subgraph "Fuentes Externas"
    GOOGLE_MAPS[Google Maps API]
    OSM[OpenStreetMap]
  end

  subgraph "Almacenamiento"
    DB_POSTGIS[(PostGIS / BD Catastral)]
  end

  FRONT -- "WMS/WFS (Capas y Consultas)" --> GEOSERVER
  FRONT -- "XYZ Tiles (Ortofotos)" --> ORTOFOTOS
  FRONT -- "HTTP GET (Ficha de Lote)" --> LEGACY_API
  FRONT -- "XYZ Tiles (Mapas Base)" --> GOOGLE_MAPS
  FRONT -- "XYZ Tiles (Mapas Base)" --> OSM
  GEOSERVER -- "JDBC" --> DB_POSTGIS

  classDef front fill:#0f172a,stroke:#334155,stroke-width:1px,color:#fff;
  classDef service fill:#111827,stroke:#374151,stroke-width:1px,color:#fff;
  classDef db fill:#fde68a,stroke:#92400e,stroke-width:1px,color:#111827;
  classDef external fill:#e0f2fe,stroke:#0284c7,stroke-width:1px,color:#0f172a;

  class FRONT front;
  class GEOSERVER,ORTOFOTOS,LEGACY_API service;
  class GOOGLE_MAPS,OSM external;
  class DB_POSTGIS db;

  linkStyle 0,1,2,3,4 stroke:#60a5fa,stroke-width:2px;
  linkStyle 5 stroke:#f59e0b,stroke-width:2px,stroke-dasharray:5 3
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
