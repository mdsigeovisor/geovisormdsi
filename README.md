# Aplicativo Visor Geográfico del Visor Municipalidad de San Isidro

Aplicación frontend desarrollada con **Angular 20**.

---

## 🚀 Tecnologías

- Angular 20.0.0
- TypeScript
- RxJS
- Angular CLI
- HTML5 / TAILWIND
- Node.js ≥ 20

---

## 📦 Requisitos previos

- Node.js 20 o superior
- npm 9+ o yarn
- Angular CLI

```bash
npm install -g @angular/cli
```

---



## 🔐 Configuración de entornos

Los entornos se configuran en:

```
src/environments/
```

### Ambientes disponibles

| Archivo | Ambiente | Portal | API WSGEOVISOR | GeoServer |
|---|---|---|---|---|
| `environment.ts` | **Desarrollo** | `https://test.munisanisidro.gob.pe` | Ruta relativa (proxy local) | `http://192.168.40.58:8081/geoserver` (red interna) |
| `environment.qa.ts` | **QA** | `https://test.munisanisidro.gob.pe` | Ruta relativa (proxy inverso) | `http://192.168.40.58:8081/geoserver` (red interna) |
| `environment.prod.ts` | **Producción** | `https://geovisorcatastral.munisanisidro.gob.pe/` | `/api/WSGEOVISOR` (proxy inverso) | `https://geomapas.munisanisidro.gob.pe/geoserver` (público) |

Los tres archivos se generan con la fábrica `crearEnvironment()` de
`src/environments/environment.model.ts`, que centraliza toda la configuración
(GeoServer, DataGIS, TUSNE, APIs WSGEOVISOR, Observatorio Urbano, etc.).
Si algún servidor interno cambia por ambiente, se pasa como override:

```ts
export const environment = crearEnvironment({
  production: true,
  ambiente: 'Producción',
  portalUrl: 'https://geovisorcatastral.munisanisidro.gob.pe/',
  wsgeovisorUrl: '/api/WSGEOVISOR',
  // overrides opcionales de servidores internos:
  // geoserverUrl, ortofotoServerUrl, dataGisServerUrl, tusneServerUrl
});
```

### Comandos por ambiente

| Ambiente | Servir localmente | Generar build | Archivo de entorno | GeoServer incluido |
|---|---|---|---|---|
| **Desarrollo** | `npm start` | `ng build --configuration development` | `environment.ts` | `http://192.168.40.58:8081/geoserver` |
| **QA** | `npm run start:qa` | `npm run build:qa` | `environment.qa.ts` | `http://192.168.40.58:8081/geoserver` |
| **Producción** | `npm run start:prod` | `npm run build:prod` | `environment.prod.ts` | `https://geomapas.munisanisidro.gob.pe/geoserver` |

`npm run watch` también compila en modo desarrollo y vuelve a compilar al guardar.

> **Importante:** `npm run build` genera un build de **producción**; es equivalente
> a `npm run build:prod` (`ng build -c production`). No uses ese comando para
> generar el build de QA ni el de desarrollo. Para esos ambientes, usa los
> comandos explícitos de la tabla.

Los comandos `start` sirven la aplicación localmente; no generan el paquete final.
El build se genera en `dist/visor-mdsi/browser/`, listo para publicarse. Angular
selecciona el archivo de entorno mediante `fileReplacements` en `angular.json`:
`qa` reemplaza `environment.ts` por `environment.qa.ts` y `production` lo
reemplaza por `environment.prod.ts`. Por eso, las URLs de GeoServer incluidas
en el bundle corresponden al ambiente elegido al compilarlo.

---


## 📏 Estándares y buenas prácticas

- Arquitectura modular
- Lazy loading para módulos
- Tipado estricto habilitado
- ESLint configurado
- Angular Style Guide
- Separación clara de responsabilidades

---

## 🔀 Flujo de trabajo Git

- Rama principal: `main`
- Desarrollo y Producción: `main`
- Features: `feature/hu*`
- Fixes: `hotfix/*`


---

## 📦 Diagrama de componentes:

```mermaid
graph TB
  %% =========================
  %% COMPONENTES
  %% =========================
  subgraph "Cliente Web"
    FRONT[Geovisor-MDSI]
  end 

  subgraph "Auth"
    AUTH[AUTH]
  end

  subgraph "Mapa"
    MAPA[MAPA]
  end

  subgraph "Bases de Datos PostgreSQL"
    DB1[(MDSIBDE - 192.168.40.57:5432)]
  end

  subgraph "Bases de Datos ArcGIS"
    DB2[(MDSIBDE - 192.168.40.57:5433)]
  end
  
  subgraph "Servidor de Mapas"
    GEOSERVER_PROD[GeoServer 3.0 - Produccion]
  end

  subgraph "Servidor de Mapas"
    GEOSERVER_DEV[GeoServer 3.0 - Desarrollo]
  end

  subgraph "Servicios Ortofotos"
    ORTOFOTOS[tiles_static_app]
  end

  subgraph "Interoperatibilidad"
    INTER[http://192.168.41.160/DataGIS_WGS84/WEBFILES]
  end

  subgraph "Capa de Servicios (APIs)"
    SEGURIDAD[Seguridad]
  end  

  %% =========================
  %% RELACIONES
  %% =========================
  FRONT --> AUTH
  FRONT --> MAPA
  AUTH --> SEGURIDAD
  MAPA --> GEOSERVER_PROD
  MAPA --> GEOSERVER_DEV
  MAPA --> ORTOFOTOS
  MAPA --> INTER
  DB1 --> DB2
  
  GEOSERVER_PROD -- "PostgreSQL" --> DB1
  GEOSERVER_DEV -- "PostgreSQL" --> DB1
  

  %% =========================
  %% ESTILOS
  %% =========================
  classDef front fill:#518330,stroke:#3b6d22,stroke-width:2px,color:#fff;
  classDef service fill:#f0fdf4,stroke:#84cc16,stroke-width:1px,color:#166534;
  classDef db fill:#fefce8,stroke:#eab308,stroke-width:1px,color:#854d0e;
  classDef external fill:#fafafa,stroke:#a1a1aa,stroke-width:1px,color:#3f3f46;

  class FRONT front;
  class AUTH,MAPA,GEOSERVER_PROD,GEOSERVER_DEV,ORTOFOTOS,SEGURIDAD service;
  class INTER external;
  class DB1 db;
  class DB2 db;
```
---

## 🌍 Links de las publicaciones:

[Local](http://localhost:4200/)

[Producción - URL](https://geovisorcatastral.munisanisidro.gob.pe)

[Producción - GeoServer](https://geomapas.munisanisidro.gob.pe)