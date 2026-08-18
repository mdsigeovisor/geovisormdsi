import { Routes } from '@angular/router';

export default [
	{
		path: 'login',
		title: 'Login',
		loadComponent: () => import('./components/login/login').then(m => m.Login),
	},
	{
		path: '',
		redirectTo: 'login',
		pathMatch: 'full',
	},
	{
		path: '**',
		redirectTo: 'login',
		pathMatch: 'full',
	},
] as Routes
