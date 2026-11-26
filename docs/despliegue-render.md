# Despliegue en Render (plan gratis, tres servicios)

Tres direcciones `*.onrender.com`, sin dominio propio:

| Servicio | Dirección | Qué es |
|---|---|---|
| `iglesy-demo` | `https://iglesy-demo.onrender.com` | Demo con datos de prueba (mocks); no usa la API |
| `iglesy` | `https://iglesy.onrender.com` | El sistema real (Angular, build de producción) |
| `iglesy-api` | `https://iglesy-api.onrender.com` | La API (Express + Prisma) con Render Postgres |

> La dirección sale del **nombre del servicio al crearlo**. Si Render dice que el nombre ya está
> ocupado, usa otro y cambia las direcciones de esta guía y de `frontend/src/environments/environment.prod.ts`.

## Por qué la cookie va con `SameSite=None`

Cada `*.onrender.com` es un sitio distinto para el navegador (está en la *Public Suffix List*), así que
con `SameSite=Strict` (AGENTS.md §3) la cookie de refresh no viajaría de `iglesy` a `iglesy-api` y la
sesión se perdería al recargar. Con `COOKIE_SAMESITE=none`:

- la cookie va `Secure` y `httpOnly`, con `Path=/api/v1/auth`;
- `POST /auth/refresh` y `POST /auth/logout` solo se aceptan con `Origin` igual a `FRONTEND_URL` (contra CSRF);
- CORS ya solo permite `FRONTEND_URL`.

En local y en las pruebas sigue `strict` (valor por defecto).

## 1. Base de datos: Render Postgres

**New → Postgres**, nombre `iglesy-db`, plan **Free** (caduca a los 30 días). Al terminar, copia la
**Internal Database URL** (para la API) y la **External Database URL** (para el seed desde tu laptop).

## 2. API: Web Service `iglesy-api`

**New → Web Service**, repo `Iglesy-App-C`, rama la que se vaya a publicar.

| Campo | Valor |
|---|---|
| Root Directory | *(vacío)* |
| Build Command | `npx pnpm@12.16.1 install --frozen-lockfile --prod=false --filter backend... && npx pnpm@12.16.1 --filter backend db:deploy` |
| Start Command | `npx pnpm@12.16.1 --filter backend start` |
| Instance Type | Free |

Variables de entorno:

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `22.12.0` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | la *Internal Database URL* de `iglesy-db` |
| `JWT_ACCESS_SECRET` | botón **Generate** |
| `JWT_REFRESH_SECRET` | botón **Generate** (distinto del anterior) |
| `FRONTEND_URL` | `https://iglesy.onrender.com` |
| `API_PUBLIC_URL` | `https://iglesy-api.onrender.com` |
| `COOKIE_SAMESITE` | `none` |
| `SEED_PASSWORD` | la contraseña inicial de los usuarios del seed (no la subas al repo) |

`--prod=false` instala también `tsx` y `prisma`, que el arranque y las migraciones necesitan.

**Datos iniciales (una sola vez), desde tu laptop**, con la *External Database URL*:

```powershell
$env:DATABASE_URL = "<External Database URL>"; $env:SEED_PASSWORD = "<la misma de Render>"
pnpm --filter backend db:catalogos
pnpm --filter backend db:seed
Remove-Item Env:DATABASE_URL, Env:SEED_PASSWORD
```

## 3. Sistema real: Static Site `iglesy`

| Campo | Valor |
|---|---|
| Root Directory | *(vacío)* |
| Build Command | `npx pnpm@12.16.1 install --frozen-lockfile --filter frontend... && cd frontend && node scripts/ng-terminar.mjs build` |
| Publish Directory | `frontend/dist/frontend/browser` |
| Variable | `NODE_VERSION` = `22.12.0` |
| Redirects/Rewrites | Source `/*` → Destination `/index.html`, Action **Rewrite** |

`ng-terminar.mjs` es necesario: con Angular 21.2 `ng build` termina el paquete pero el proceso no sale
(esbuild queda abierto) y Render esperaría para siempre.

El build de producción toma la API de `environment.prod.ts` (`https://iglesy-api.onrender.com/api/v1`).

## 4. Demo: Static Site `iglesy-demo`

Igual que el anterior, pero con `ng build --configuration development`, que incluye los datos de prueba:

| Campo | Valor |
|---|---|
| Build Command | `npx pnpm@12.16.1 install --frozen-lockfile --filter frontend... && cd frontend && node scripts/ng-terminar.mjs build --configuration development` |
| Publish Directory | `frontend/dist/frontend/browser` |
| Redirects/Rewrites | `/*` → `/index.html`, **Rewrite** |

Cuentas: `<rol>@iglesia.local` con la contraseña de `frontend/src/mocks/datos/b1.ts`. Los datos se
reinician al recargar y no se comparten entre visitantes.

## Limitaciones del plan gratis

- La API se duerme tras ~15 min sin uso: la primera petición tarda ~1 min.
- La base de datos gratis caduca a los 30 días.
- Los logos subidos (`uploads/`) se pierden en cada despliegue: el disco del Web Service no persiste.
- Los correos (invitaciones, recuperar contraseña) no salen sin un SMTP real (`SMTP_HOST`, `SMTP_PORT`).
