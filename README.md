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

El siguiente diagrama ilustra la arquitectura general del sistema, mostrando la interacción entre el frontend, los servicios backend y las fuentes de datos externas.

```mermaid
graph TB
  %% =========================
  %% COMPONENTES
  %% =========================
  subgraph L1[Frontend]
    direction LR
    FRONT[Visor Geográfico (Angular)]
  end

  subgraph L2[Servicios Geoespaciales]
    direction LR
    GEOSERVER[GeoServer]
    ORTOFOTOS[Servidor de Ortofotos (XYZ)]
  end

  subgraph L3[Servicios de Datos Legacy]
    direction LR
    LEGACY_API[API de Fichas (ASP)]
  end

  subgraph L4[Fuentes de Datos Externas]
    direction LR
    GOOGLE_MAPS[Google Maps API]
    OSM[OpenStreetMap]
  end

  subgraph L5[Base de Datos]
    direction LR
    DB_POSTGIS[(PostGIS / BD Catastral)]
  end

  %% =========================
  %% RELACIONES
  %% =========================
  FRONT -- "WMS/WFS <br/> (Capas, Búsquedas, Consultas)" --> GEOSERVER
  FRONT -- "XYZ Tiles <br/> (Ortofotos)" --> ORTOFOTOS
  FRONT -- "HTTP GET <br/> (Ficha de Lote, Fotos Dron)" --> LEGACY_API
  FRONT -- "XYZ Tiles <br/> (Mapa Satelital)" --> GOOGLE_MAPS
  FRONT -- "XYZ Tiles <br/> (Mapa de Calles)" --> OSM

  GEOSERVER -- "JDBC" --> DB_POSTGIS

  %% =========================
  %% ESTILOS
  %% =========================
  classDef front fill:#0f172a,stroke:#334155,stroke-width:1px,color:#fff;
  classDef service fill:#111827,stroke:#374151,stroke-width:1px,color:#fff;
  classDef db fill:#fde68a,stroke:#92400e,stroke-width:1px,color:#111827;
  classDef external fill:#e0f2fe,stroke:#0284c7,stroke-width:1px,color:#0f172a;

  class FRONT front;
  class GEOSERVER,ORTOFOTOS,LEGACY_API service;
  class GOOGLE_MAPS,OSM external;
  class DB_POSTGIS db;

  linkStyle 0,1,2,3,4 stroke:#60a5fa,stroke-width:2px;
  linkStyle 5 stroke:#f59e0b,stroke-width:2px,stroke-dasharray:5 3;
```

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
