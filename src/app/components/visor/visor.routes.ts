import { Routes } from '@angular/router';

export default [
  {
    path: 'map',
    title: 'Mapa',
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
