# Despliegue en Render (plan gratis, tres servicios)

Render gratis da un solo nivel de subdominio (`<nombre>.onrender.com`), así que se usa guion:

| Servicio | Dirección | Qué es |
|---|---|---|
| `api-iglesy` | `https://api-iglesy.onrender.com` | La API (Express + Prisma) con Render Postgres |
| `principal-iglesy` | `https://principal-iglesy.onrender.com` | El sistema real: landing, consultas públicas y panel |
| `demo-iglesy` | `https://demo-iglesy.onrender.com` | La misma app con datos de prueba (mocks), sin backend |

> La dirección sale del **nombre del servicio al crearlo** y no se cambia después. Si un nombre está
> ocupado, usa otro y cambia esta guía (las reglas de reescritura apuntan a la API por su dirección).

## Cómo se conectan principal y api

El navegador solo habla con `principal-iglesy`. Render **reescribe** `/api/*` y `/uploads/*` hacia
`api-iglesy` (hace de proxy), así que para el navegador el frontend y la API están en el mismo sitio:

- la cookie de refresh sigue como pide AGENTS.md §3 (`httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`);
- no hace falta CORS (`environment.prod.ts` usa `apiUrl: '/api/v1'`, relativa);
- los logos (`/uploads/…`) salen de la misma dirección.

Como todas las peticiones llegan a la API desde el proxy, la API necesita `TRUST_PROXY` para ver la IP
real del cliente; si no, el límite de intentos del login (5 por minuto) sería uno solo para todos.

## 1. Base de datos: Render Postgres

**New → Postgres**, nombre `iglesy-db`, plan **Free** (caduca a los 30 días). Copia la **Internal
Database URL** (para la API) y la **External Database URL** (para cargar los datos desde tu laptop).

## 2. API: Web Service `api-iglesy`

**New → Web Service**, repo `Iglesy-App-C`, la rama que se vaya a publicar.

| Campo | Valor |
|---|---|
| Root Directory | *(vacío)* |
| Build Command | `npx pnpm@12.16.1 install --frozen-lockfile --prod=false --filter backend... && npx pnpm@12.16.1 --filter backend db:deploy` |
| Start Command | `npx pnpm@12.16.1 --filter backend start` |
| Instance Type | Free |

`--prod=false` instala también `tsx` y `prisma`, que el arranque y las migraciones necesitan.

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `22.12.0` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | la *Internal Database URL* de `iglesy-db` |
| `JWT_ACCESS_SECRET` | botón **Generate** |
| `JWT_REFRESH_SECRET` | botón **Generate** (distinto del anterior) |
| `FRONTEND_URL` | `https://principal-iglesy.onrender.com` |
| `API_PUBLIC_URL` | `https://principal-iglesy.onrender.com` (los logos se piden por la reescritura) |
| `TRUST_PROXY` | `2` (la reescritura del frontend y el balanceador de Render; ver «Comprobar») |
| `SEED_PASSWORD` | la contraseña inicial de los usuarios del seed (no la subas al repo) |

**Datos iniciales (una sola vez), desde tu laptop**, con la *External Database URL*:

```powershell
$env:DATABASE_URL = "<External Database URL>"; $env:SEED_PASSWORD = "<la misma de Render>"
pnpm --filter backend db:catalogos
pnpm --filter backend db:seed
Remove-Item Env:DATABASE_URL, Env:SEED_PASSWORD
```

## 3. Sistema real: Static Site `principal-iglesy`

| Campo | Valor |
|---|---|
| Root Directory | *(vacío)* |
| Build Command | `npx pnpm@12.16.1 install --frozen-lockfile --filter frontend... && cd frontend && node scripts/ng-terminar.mjs build` |
| Publish Directory | `frontend/dist/frontend/browser` |
| Variable | `NODE_VERSION` = `22.12.0` |

**Redirects/Rewrites**, en este orden (la primera que coincide gana):

| Source | Destination | Action |
|---|---|---|
| `/api/*` | `https://api-iglesy.onrender.com/api/*` | Rewrite |
| `/uploads/*` | `https://api-iglesy.onrender.com/uploads/*` | Rewrite |
| `/*` | `/index.html` | Rewrite |

`ng-terminar.mjs` es necesario: con Angular 21.2 `ng build` termina el paquete pero el proceso no sale
(esbuild queda abierto) y Render esperaría para siempre.

## 4. Demo: Static Site `demo-iglesy`

| Campo | Valor |
|---|---|
| Build Command | `npx pnpm@12.16.1 install --frozen-lockfile --filter frontend... && cd frontend && node scripts/ng-terminar.mjs build --configuration development` |
| Publish Directory | `frontend/dist/frontend/browser` |
| Redirects/Rewrites | `/*` → `/index.html`, **Rewrite** |

La configuración `development` incluye los datos de prueba. Cuentas: `<rol>@iglesia.local` con la
contraseña de `frontend/src/mocks/datos/b1.ts`. Los datos se reinician al recargar.

## Comprobar después de desplegar

1. `https://principal-iglesy.onrender.com/api/docs` abre Swagger: la reescritura llega a la API.
2. Inicia sesión, recarga la página y sigue la sesión: la cookie pasa por la reescritura.
3. Seis intentos de login fallidos seguidos dan «Demasiados intentos»; desde otro dispositivo
   (otra red) se puede entrar: el límite es por persona. Si el límite se comparte, ajusta `TRUST_PROXY`.
4. Sube un logo en Configuración y que se vea (hasta el siguiente despliegue).

## Limitaciones del plan gratis

- La API se duerme tras ~15 min sin uso: la primera petición tarda ~1 min. Ábrela antes de la demo.
- La base de datos gratis caduca a los 30 días.
- Los logos subidos (`uploads/`) se pierden en cada despliegue: el disco del Web Service no persiste.
- Los correos (invitaciones, recuperar contraseña) no salen sin un SMTP real (`SMTP_HOST`, `SMTP_PORT`).
