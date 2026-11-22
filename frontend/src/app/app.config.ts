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
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { INTERCEPTORES_MOCKS } from '@/mocks/interceptores';
import { interceptorApi } from './core/api';
import { SesionService } from './core/sesion.service';
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
    // Restaura la sesión con la cookie de refresh antes de resolver la primera ruta
    provideAppInitializer(() => inject(SesionService).restaurar()),
  ],
};
