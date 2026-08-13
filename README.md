## 📦 Diagrama de componentes:

```mermaid
graph TB
  %% =========================
  %% COMPONENTES
  %% =========================
  subgraph "Cliente Web"
    FRONT[GeoVisor-MDSI]
  end  

  subgraph "Bases de Datos PostgreSQL"
    DB1[(mdsibde - 192.168.40.57:5432)]
  end

  subgraph "Bases de Datos ArcGIS"
    DB2[(mdsibde - 192.168.40.57:5433)]
  end
  
  subgraph "Servicios Geoespaciales"
    GEOSERVER_PROD[GeoServer 3.0 - Produccion]
  end

  subgraph "Servicios Geoespaciales"
    GEOSERVER_DEV[GeoServer 3.0 - Desarrollo]
  end

  subgraph "Servicios Ortofotos"
    ORTOFOTOS[tiles_static_app]
  end

  subgraph "Interoperatibilidad"
    INTER[http://192.168.41.160/DataGIS_WGS84/WEBFILES]
  end

  subgraph "Capa de Servicios (APIs)"
    AUTH[Seguridad]
  end  

  %% =========================
  %% RELACIONES
  %% =========================
  FRONT --> AUTH
  FRONT --> GEOSERVER_PROD
  FRONT --> GEOSERVER_DEV
  FRONT --> ORTOFOTOS
  FRONT --> INTER
  DB1 --> DB2
  
  GEOSERVER_PROD -- "PostgreSQL" --> DB1
  GEOSERVER_DEV -- "PostgreSQL" --> DB1
  

  %% =========================
  %% ESTILOS
  %% =========================
  classDef front fill:#0f172a,stroke:#334155,stroke-width:1px,color:#fff;
  classDef service fill:#111827,stroke:#374151,stroke-width:1px,color:#fff;
  classDef db fill:#fde68a,stroke:#92400e,stroke-width:1px,color:#111827;

  class FRONT front;
  class AUTH,GEOSERVER service;
  class DB1 db;
  class DB2 db;
```

## 🌍 Links de las publicaciones:

[Local](http://localhost:4200/)

[Desarrollo](http://192.168.40.58:80)

[Producción - IP](http://192.168.40.58:80)

[Producción - URL](https://visor.mdsi.gob.pe/)

[Producción - GeoServer](https://geoserver.mdsi.gob.pe/)