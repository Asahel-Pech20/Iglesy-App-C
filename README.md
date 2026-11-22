# AppIglesia (frontend en Angular)

> Copia del proyecto con el **frontend reescrito en Angular 21**. Migrados: F1 (base, sesión, usuarios, configuración) y F2 (miembros y ministerios). Pendientes: F3 y F4. Detalle en [docs/migracion-angular.md](docs/migracion-angular.md).

Aplicación web para la administración interna de una iglesia: usuarios con roles, miembros, asistencia, eventos, ministerios, donaciones, anuncios, dashboard, reportes y configuración institucional.

- Qué se construye y con qué → [specs.md](specs.md)
- Reglas obligatorias → [AGENTS.md](AGENTS.md)
- Memoria del proyecto → [CLAUDE.md](CLAUDE.md)
- Tareas por integrante → [docs/README.md](docs/README.md)
- Arnés de IA (Claude Code) → [docs/arnes.md](docs/arnes.md)

## Requisitos

> **¿Tu laptop puede con esto?** Ejecuta `node scripts/verificar-equipo.mjs` y lee [docs/requisitos.md](docs/requisitos.md): qué necesitas según tu parte, cuánto consume cada programa y opciones sin Docker (PostgreSQL directo o GitHub Codespaces). El frontend se puede trabajar sin base de datos.

| Herramienta | Versión | Instalación |
|---|---|---|
| Node.js | 22.12 o superior, o 24 o superior (Angular 21 no soporta la 23) | <https://nodejs.org> |
| pnpm | la fijada en `package.json` (`packageManager`) | `npm install -g pnpm` o `corepack enable` (como administrador) |
| Docker Desktop (opcional, ver requisitos) | con `docker compose` | <https://www.docker.com/products/docker-desktop> |

## Puesta en marcha

```bash
docker compose up -d     # postgres (5432), postgres-test (5433), mailpit (1025 / 8025)
pnpm install             # instala backend y frontend (workspaces) y activa los hooks de git del arnés
pnpm dev                 # backend + frontend en paralelo
```

Mailpit (correos de prueba): <http://localhost:8025>

## Scripts de la raíz

| Script | Qué hace |
|---|---|
| `pnpm dev` | Corre `dev` de cada paquete en paralelo |
| `pnpm test` | Corre las pruebas (Vitest) de cada paquete |
| `pnpm lint` | ESLint sobre todo el repositorio |
| `pnpm typecheck` | `tsc --noEmit` en cada paquete |
| `pnpm format` / `pnpm format:check` | Prettier (escribe / solo revisa) |

## Estructura

```
.
├── .claude/              # arnés de Claude Code (permisos, hooks, comando /tarea)
├── backend/              # API Express + Prisma (ver backend/README.md)
├── frontend/             # Angular 21 + Material (mocks en desarrollo)
├── docs/                 # planes y tareas por subsección
├── docker-compose.yml    # servicios de desarrollo
├── eslint.config.js      # ESLint compartido
├── .prettierrc.json      # Prettier compartido
├── tsconfig.base.json    # opciones TypeScript strict compartidas
└── pnpm-workspace.yaml
```

## Configuración compartida

- **TypeScript**: `tsconfig.base.json` en modo `strict` (+ `noUncheckedIndexedAccess`). Cada paquete lo extiende.
- **ESLint** (flat config): reglas recomendadas de JS y TypeScript, prohíbe `any`, avisa de `console.log`. Desactiva lo que choca con Prettier.
- **Prettier**: comillas simples, punto y coma, 100 columnas. Los `.md` no se formatean para respetar las tablas de la documentación.
- **EditorConfig** y `.gitattributes`: UTF-8, saltos de línea LF, 2 espacios.

> TypeScript está fijado en `~6.0` porque `typescript-eslint` todavía no soporta TypeScript 7.
