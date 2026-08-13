## 📦 Diagrama de componentes:

```mermaid
graph TB
  %% =========================
  %% COMPONENTES
  %% =========================
  subgraph "Cliente Web"
    FRONT[GeoVisor-MDSI]
  end

  subgraph "Capa de Servicios (APIs)"
    AUTH[mdsi-auth]
    SYS[mdsi-sys]
    API[mdsi-api]
    ARM[mdsi-arm]
    REPO[mdsi-repo]
    POLI[mdsi-poli]
    EXPO[mdsi-expo]
  end

  subgraph "Bases de Datos"
    DB1[(BD Catastral - 192.168.40.57)]
  end

  subgraph "Servicios Geoespaciales"
    GEOSERVER[GeoServer]
  end

  %% =========================
  %% RELACIONES
  %% =========================
  FRONT --> AUTH
  FRONT --> SYS
  FRONT --> API
  FRONT --> GEOSERVER

  AUTH --> DB1
  SYS --> DB1
  API --> DB1
  GEOSERVER -- "PostgreSQL" --> DB1

  %% =========================
  %% ESTILOS
  %% =========================
  classDef front fill:#0f172a,stroke:#334155,stroke-width:1px,color:#fff;
  classDef service fill:#111827,stroke:#374151,stroke-width:1px,color:#fff;
  classDef db fill:#fde68a,stroke:#92400e,stroke-width:1px,color:#111827;

  class FRONT front;
  class AUTH,SYS,API,ARM,REPO,POLI,EXPO,GEOSERVER service;
  class DB1 db;
```