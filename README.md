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

## 📁 Estructura del proyecto
src/
 ├── app/
 │   ├── animation/       # Componentes, pipes y utilidades reutilizables
 │   ├── components/      # 
 │   ├── core/            # Servicios globales, interceptores, guards
 │   ├── css/             #
 │   ├── interfaces/      #
 │   ├── models/          #
 │   ├── services/        #
 │   ├── util/            #
 │   ├── features/        # Módulos por dominio/funcionalidad
 │   └── app.module.ts
 ├── assets/
 ├── environments/
 │   ├── environment.ts
 │   └── environment.prod.ts
 ├── typings/
 └── main.ts
```
