import { Routes } from '@angular/router';

export default [
  {
    path: 'map',
    title: 'Visor Cartográfico Catastral',
    loadComponent: () => import('./components/map/map').then(m => m.MapComponent),
  },  
  {
    path: '',
    redirectTo: 'map',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'map',
    pathMatch: 'full',
  },
] as Routes
