import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'connexion',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'galerie',
    loadComponent: () => import('./features/gallery/gallery').then((m) => m.Gallery),
    canActivate: [authGuard],
  },
  {
    path: '',
    loadComponent: () => import('./features/map/map').then((m) => m.Map),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];