import { Routes } from '@angular/router';

export default [
	{
		path: 'bienvenidos',
		title: 'Bienvenidos',
		loadComponent: () => import('./components/bienvenido/bienvenido').then(m => m.Bienvenido),
	},
	{
		path: 'login',
		title: 'Login',
		loadComponent: () => import('./components/login/login').then(m => m.Login),
	},

	{
		path: '',
		redirectTo: 'bienvenidos',
		pathMatch: 'full',
	},
] as Routes
