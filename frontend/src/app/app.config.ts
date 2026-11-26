import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
import {
  type ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { INTERCEPTORES_MOCKS } from '@/mocks/interceptores';
import { interceptorApi } from './core/api';
import { URL_APLICACION } from './core/config';
import { SesionService } from './core/sesion.service';
import { soloLanding } from './core/solo-landing';
import { routes } from './app.routes';

registerLocaleData(localeEsMx);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    // En desarrollo los handlers de MSW responden el contrato de specs.md §7 sin backend
    provideHttpClient(withInterceptors([interceptorApi, ...INTERCEPTORES_MOCKS])),
    { provide: LOCALE_ID, useValue: 'es-MX' },
    // subscriptSizing dynamic: una ayuda o un error de dos líneas no se encima en el campo de abajo
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline', subscriptSizing: 'dynamic' },
    },
    // Restaura la sesión con la cookie de refresh antes de resolver la primera ruta. En el build
    // «landing» (sitio principal de Render) no hay sesión: lo demás se abre en el sitio de la app.
    provideAppInitializer(() => {
      if (URL_APLICACION) return soloLanding(inject(Router), URL_APLICACION);
      return inject(SesionService).restaurar();
    }),
  ],
};
