import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./components/auth/auth'),
    loadChildren: () => import('./components/auth/auth.routes')
  },
   {
    path: 'visor',
    loadComponent: () => import('./components/visor/visor'),
    loadChildren: () => import('./components/visor/visor.routes')
  },
  {
    path: 'manual',
    title: 'Manual de Usuario · Geovisor Catastral — Municipalidad de San Isidro',
    loadComponent: () => import('./components/visor/components/map/components/sidebar/components/manual/mancompleto/manualCompleto')
      .then(m => m.ManualCompleto),
  },
  {
		path: '',
		redirectTo: '/visor',
		pathMatch: 'full',
	},
	{
		path: '**',
		redirectTo: '/visor',
		pathMatch: 'full',
	},
];

