import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  // 1. On injecte TOUT de façon synchrone au début
  const auth = inject(AuthService);
  const router = inject(Router);

  // 2. Ensuite seulement, on peut utiliser await
  await auth.ready;

  // 3. On utilise l'instance du router qu'on a récupérée plus haut
  return auth.isLoggedIn() ? true : router.createUrlTree(['/connexion']);
};