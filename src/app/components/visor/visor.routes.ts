import { Routes } from '@angular/router';

export default [
  {
    path: 'map',
    title: 'Geovisor Catastral',
    loadComponent: () => import('./components/map/map').then(m => m.MapComponent),
  },
  {
    path: 'dashboard',
    title: 'Dashboard · Geovisor Catastral',
    loadComponent: () => import('./components/dashboard/dashboard-page').then(m => m.DashboardPage),
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

