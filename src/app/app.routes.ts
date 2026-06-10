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
