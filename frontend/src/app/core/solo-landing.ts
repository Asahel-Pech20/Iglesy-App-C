import { NavigationStart, type Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Build «landing» (sitio principal de Render): este sitio solo muestra la landing en «/». Cualquier
 * otra navegación —un botón, la barra, o alguien que escriba /login— se manda a la aplicación en su
 * propio sitio, con la misma ruta, para que la dirección cambie.
 * Con `urlAplicacion` vacía (desarrollo, demo, app completa) no hace nada.
 */
export function soloLanding(
  router: Router,
  urlAplicacion: string,
  abrir: (url: string) => void = (url) => window.location.assign(url),
) {
  if (!urlAplicacion) return;
  const base = urlAplicacion.replace(/\/+$/, '');
  router.events
    .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
    .subscribe((e) => {
      const ruta = e.url.split(/[?#]/)[0];
      if (ruta === '/' || ruta === '') return;
      // Se cancela la navegación interna y se abre la aplicación en su sitio
      void router.navigateByUrl('/', { replaceUrl: true });
      abrir(base + e.url);
    });
}
