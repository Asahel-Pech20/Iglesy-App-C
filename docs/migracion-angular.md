# Migración del frontend a Angular

> Los cursos anteriores usaban **Express + Angular**. El frontend se había hecho en React por descuido; esta copia lo reescribe en **Angular 21** con **Angular Material**. El backend no cambia: mismo contrato (`specs.md §7`).

## Estado

| Parte | Estado |
|---|---|
| **F1**: base, layout, sesión, permisos, usuarios, configuración | ✅ Migrado |
| **F2**: miembros, ministerios, `SelectorMiembros` | ✅ Migrado |
| **F3**: eventos, calendario, asistencia, anuncios, cartelera | ✅ Migrado |
| **F4**: donaciones, dashboard, reportes | ✅ Migrado |

Verificado: 82 pruebas de frontend (`ng test`), lint, typecheck, formato y `ng build` en verde; pantallas revisadas en el navegador con mocks.

¿Por qué Angular 21 y no 22? Angular 22 pide Node ≥ 24.15 y el equipo usa Node 22/24.12. Angular 21 funciona con ambos, siempre que Node 22 sea **22.12 o posterior** (`node scripts/verificar-equipo.mjs` lo revisa).

## Cómo correrlo

```bash
pnpm install
pnpm --filter frontend dev      # http://localhost:5173 con datos simulados
pnpm --filter frontend test     # pruebas (Vitest)
pnpm --filter frontend build    # producción (sin mocks)
```

Usuarios de los mocks: `<rol>@iglesia.local` / `Iglesia123`. Para usar el backend real (con `pnpm --filter backend dev` corriendo): `pnpm --filter frontend dev:real`. Probado el 2026-11-04: login, dashboard, aportación, evento y pase de lista contra el backend real, sin errores.

## Equivalencias React → Angular (para migrar F3 y F4)

| En React | En Angular | Archivo |
|---|---|---|
| `lib/api.ts` (Axios + refresh) | `Api` + `interceptorApi` (HttpClient) | `core/api.ts` |
| `AuthProvider` / `useSesion()` | `SesionService` (signals) | `core/sesion.service.ts` |
| `usePermiso('x')` | `sesion.puede('x')` | `core/sesion.service.ts` |
| `<Puede permiso="x">` | `*appPuede="'x'"` | `core/puede.directive.ts` |
| `<RutaProtegida permiso="x">` | `canActivate: [rutaProtegida]`, `data: { permiso: 'x' }` | `core/guards.ts`, `app.routes.ts` |
| `useBlocker` (salir sin guardar) | `canDeactivate: [cambiosSinGuardar]` | `core/cambios-sin-guardar.ts` |
| `useFiltrosURL` | `filtrosURL()` | `core/filtros-url.ts` |
| `useQuery` | `rxResource` + servicio del módulo; leer con `valorDe()` fuera de la rama sin error | `core/recurso.ts` |
| `useMutation` + invalidar | llamada al servicio + `recurso.reload()` | — |
| React Hook Form + Zod | Reactive Forms + validadores con mensaje | `core/validadores.ts` |
| `notificar.exito()` | `NotificarService` (snackbar) | `core/notificar.service.ts` |
| `ConfirmDialog` | `ConfirmarService.abrir({...})` | `compartido/confirmar-dialogo.ts` |
| `PageHeader`, `EmptyState`, `ErrorState`, `SkeletonTabla`, `Paginacion`, `BadgeEstado`, `CampoBusqueda` | `app-page-header`, `app-estado-vacio`, `app-estado-error`, `app-esqueleto`, `app-paginacion`, `app-badge-estado`, `app-campo-busqueda` | `compartido/` |
| `DataTable` | `mat-table` dentro de `.contenedor-tabla` (scroll horizontal en móvil) | `styles.scss` |
| `SelectorMiembros` | `<app-selector-miembros [(seleccion)]="ids" />` | `features/miembros/selector-miembros.ts` |
| MSW con Service Worker | los mismos handlers, ejecutados por `interceptorMocks` | `mocks/interceptor.ts` |
| `renderApp('/ruta', { como })` | `abrirApp('/ruta', { como: 'admin@iglesia.local' })` | `prueba/entorno.ts` |

## Para migrar un módulo de F3/F4

1. Copiar sus tipos de `src/types/` (ya están en `src/app/tipos/`), sus datos de mocks (`mocks/datos/b3.ts`, `b4.ts`) y handlers, y registrarlos en `mocks/db.ts` y `mocks/handlers/index.ts`.
2. Crear `features/<modulo>/<modulo>.service.ts` con las llamadas del contrato.
3. Escribir las páginas con Material y los componentes de `compartido/`.
4. Registrar las rutas en `app.routes.ts` con su permiso y quitar `pendiente: true` en `core/menu.ts`.
5. Conectar lo que F2 dejó esperando: pestañas *Asistencia* y *Aportaciones* del perfil y *Actividades* del ministerio.

## Decisiones de F3 y F4

- **Calendario**: componente propio (`features/eventos/calendario-eventos`, mes / semana / lista) con date-fns, sin FullCalendar: la versión Angular de FullCalendar (v7) exige `temporal-polyfill` y cambia el empaquetado; no se agregan dependencias (AGENTS.md regla 8).
- **Gráficas**: `compartido/graficas.ts` (barras y dona en HTML/CSS con los tokens de color, tabla alternativa "Ver como tabla"); sin Recharts.
- **Descargas de reportes**: `ReportesService` usa `responseType: 'blob'`; `interceptorApi` lee el JSON de los errores que llegan como Blob (así funcionan el 422 y el refresh de token).
- `rxResource` envuelve los errores del stream; `normalizarError` los desenvuelve por `cause`.
- Conexiones de F2: pestañas *Asistencia* y *Aportaciones* del perfil y *Actividades* del ministerio ya usan `app-asistencia-del-miembro`, `app-aportaciones-del-miembro` y `app-actividades-ministerio`.
- Rutas nuevas: `/eventos…`, `/asistencia`, `/anuncios`, `/donaciones`, `/reportes`, `/cartelera` (pública) y el dashboard en `/`.

## Pendientes conocidos

- Catálogo de componentes `/_dev/ui` de React: no se migró.
- No se probó contra el backend real; solo con mocks.
- `ng test` termina las pruebas en segundos pero en esta laptop el proceso no sale solo: usar `timeout`.
