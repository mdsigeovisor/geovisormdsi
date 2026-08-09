import { Routes } from '@angular/router';

export default [
  {
    path: 'map',
    title: 'Mapa',
    loadComponent: () => import('./components/map/map').then(m => m.MapComponent),
  },
  {
    path: 'dashboard',
    title: 'Dashboard',
    loadComponent: () => import('./components/dashboard/dashboard').then(m => m.Dashboard),
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
