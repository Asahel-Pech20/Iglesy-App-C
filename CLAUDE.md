# CLAUDE.md — Memoria del proyecto AppIglesia

> Lo esencial para trabajar en el proyecto sin releer todo. Detalle técnico → `specs.md`. Reglas → `AGENTS.md`.
> Mantener este archivo **corto y actualizado**: cuando se tome una decisión importante, agregarla a "Decisiones" con fecha.

@AGENTS.md
@specs.md

---

## Qué es
Aplicación web de administración interna de una iglesia (proyecto de la materia *Aplicaciones Web*, 4.º cuatrimestre). Equipo de **4 integrantes**, cada uno dueño de un dominio en backend y frontend.

## Stack (resumen)
- **Backend**: Node 22 + Express 5 + TypeScript + Prisma + PostgreSQL 16 + Zod + JWT. Pruebas: Vitest + Supertest.
- **Frontend**: **Angular 21** + TypeScript + Angular Material + Reactive Forms + signals (`rxResource`) + lucide-angular. Mocks: handlers de MSW vía interceptor HTTP. Migración desde React completa (F1–F4) ([docs/migracion-angular.md](docs/migracion-angular.md)).
- **Monorepo** pnpm: `backend/`, `frontend/`, `docs/`. Docker: postgres, postgres-test, mailpit.

## Arnés de IA
Claude Code configurado en `.claude/`: permisos (`settings.json`), hooks de formateo y verificación (`hooks/`) y el comando `/tarea <ID>` (`commands/tarea.md`). Detalle → [docs/arnes.md](docs/arnes.md). Preferencias personales en `.claude/settings.local.json` (git-ignored).

## Comandos
**Equipo nuevo:** primero `node scripts/verificar-equipo.mjs` y [docs/requisitos.md](docs/requisitos.md) (qué instalar según tu parte y tu laptop; opciones sin Docker).
Requiere pnpm instalado (`npm install -g pnpm`): los scripts raíz lo llaman directamente. El hook `Stop` usa `corepack pnpm` si no lo encuentra.
```bash
docker compose up -d                 # BD + correo
pnpm install
pnpm --filter backend prisma migrate dev
pnpm --filter backend db:seed
pnpm dev                             # backend :3000 + frontend :5173
pnpm test                            # pruebas de ambos
pnpm lint && pnpm typecheck
```
- API: `http://localhost:3000/api/v1` · Swagger: `/api/docs` · Mailpit: `http://localhost:8025`

## Dueños
| Integrante | Backend | Frontend | Dominio |
|---|---|---|---|
| Santiago Asahel Pech Ake | B1 | F1 | Infraestructura, auth, usuarios, permisos, configuración, componentes base UI, `schema.prisma` |
| Nataly Marisol Santos Miam | B2 | F2 | Miembros, ministerios, seed, `SelectorMiembros` |
| Genaro Aurelio Antonio Pacheco | B3 | F3 | Eventos, calendario, asistencia, anuncios, cartelera pública |
| Oscar Michel Matos May | B4 | F4 | Donaciones, dashboard, reportes PDF/Excel |

Tareas: `docs/README.md` → `docs/{backend,frontend}/<subseccion>/plan.md` → `tasks-*.md`.
Auditorías: `Auditorias/Auditoria_<n>/README.md` (índice) → `<Integrante>/{backend,frontend}/observaciones.md`. Cada quien lee solo su archivo.

## Hechos clave (no olvidar)
- **Usuarios ≠ Miembros.** Solo los usuarios (personal) inician sesión. Los miembros son registros.
- Roles: `ADMIN`, `PASTOR`, `SECRETARIO`, `TESORERO`, `COORDINADOR`. Matriz en `specs.md §3`; código en `config/permisos.ts` (back) y `lib/permisos.ts` (front). Permisos con formato `modulo:accion`.
- Sin registro público: el ADMIN crea usuarios. El seed crea un ADMIN inicial (credenciales en `backend/.env.example` / `seed.ts`).
- Soft delete en usuarios, miembros, ministerios. Donaciones se **anulan** con motivo. Anuncios y horarios sí se borran.
- Donación anónima ⇔ `miembroId = null`.
- Dinero: `Decimal(12,2)` en BD, **string** en JSON.
- Datos financieros se **omiten** de la respuesta si el rol no tiene `donaciones:leer`.
- COORDINADOR solo gestiona asistencia/eventos/integrantes de **sus** ministerios.
- Asistencia ligada a un **evento** (no a una fecha suelta); no se registra en eventos cancelados.
- Respuestas: `{ data, meta? }` / `{ error: { code, message, details? } }`.
- Configuración de la iglesia = fila única (`id = 1`); define moneda (default MXN) y zona horaria (default America/Mexico_City).
- Frontend arranca con mocks (`environment.usarMocks = true` en `src/environments/environment.ts`) para no depender del backend.

## Decisiones
| Fecha | Decisión |
|---|---|
| 2026-10-30 | Stack definido (ver arriba). Propiedad vertical por dominio (B_n + F_n = integrante n). |
| 2026-10-30 | Responsables de evento y vínculos de ministerio apuntan a **Miembro**; coordinadores de ministerio apuntan a **Usuario**. |
| 2026-10-30 | Un solo `schema.prisma`, creado completo por B1 en Fase 0; cambios vía PR revisado por B1. |
| 2026-10-30 | Equipo: Santiago Asahel Pech Ake (B1/F1), Nataly Marisol Santos Miam (B2/F2), Genaro Aurelio Antonio Pacheco (B3/F3), Oscar Michel Matos May (B4/F4). |
| 2026-10-30 | Cartelera pública (`/public/cartelera`) de solo lectura para mostrar anuncios y eventos a los miembros. |
| 2026-10-31 | TypeScript fijado en `~6.0` (typescript-eslint aún no soporta TS 7). pnpm fijado en `packageManager`. `@types/node` 22 (Node del spec). |
| 2026-10-31 | Arnés de Claude Code en `.claude/` (permisos, hooks, `/tarea`). Ver `docs/arnes.md`. |
| 2026-10-31 | Prisma 7 con `prisma.config.ts` y adaptador `pg`; cliente generado en `backend/src/generated` (git-ignored). |
| 2026-10-31 | `Usuario.passwordHash` opcional: el ADMIN crea usuarios sin contraseña y reciben invitación (48 h). |
| 2026-10-31 | Formato de respuestas de auth y listas permitidas de moneda/zona horaria definidas por B1 (ver `specs.md §7.2`). |
| 2026-10-31 | CI con `actions/checkout@v7` y `setup-node@v7` (Node 24) en `ubuntu-24.04` fijo (aviso de Oscar). |
| 2026-10-31 | Permisos del coordinador con sufijo `-propio` (`specs.md §3`); se usan con `autorizarAlguno` + `esCoordinadorDe`. |
| 2026-10-31 | B2: búsqueda de miembros sin acentos con `translate(lower(...))` en SQL (sin extensión `unaccent`, sin cambiar el schema). Seed B2 sin `@faker-js/faker` (generador con semilla fija) para no agregar dependencias. `POST /miembros` advierte duplicados en `meta: { posibleDuplicado, duplicadoId }`. |
| 2026-10-31 | B3: los eventos `PROGRAMADO` cuya fecha pasó se marcan `REALIZADO` al consultarlos (sin `node-cron`, sin dependencias nuevas). Pase de lista con un solo `INSERT … ON CONFLICT` en transacción. Fechas sin hora (`desde`/`hasta` de eventos e historial, resumen) son días completos en la zona horaria de la configuración, no en UTC (`eventos/eventos.fechas.ts`; mismo criterio de la revisión del PR #3). F3: FullCalendar 6.1 y Recharts (ya previstos en `specs.md §4`); markdown simple de anuncios renderizado sin `dangerouslySetInnerHTML`. |
| 2026-11-03 | Frontend migrado a **Angular 21** (los cursos anteriores usaban Express + Angular; React se eligió por descuido). Angular Material con los tokens de AGENTS.md §4; mocks de MSW sin Service Worker (interceptor `src/mocks/interceptor.ts`, fuera del bundle de producción). Angular 21 y no 22 porque 22 pide Node ≥ 24.15. |
| 2026-11-04 | F3 y F4 migrados a Angular: calendario propio (sin FullCalendar), gráficas HTML/CSS (sin Recharts), descargas Blob en `ReportesService`. Ver `docs/migracion-angular.md`. |
| 2026-11-02 | B4: `pdfkit` 0.20 y `exceljs` 4.4 (previstos en `specs.md §4`). PDF con Helvetica estándar (WinAnsi cubre acentos y ñ), máx. 5 000 filas (más → 422, usar Excel). La cache del dashboard se invalida con una "huella" de los datos (conteos y `max(updatedAt)`), sin tocar los módulos de B2/B3. Los reportes leen de los services dueños; solo la tabla de eventos del reporte por periodo y el % por integrante son consultas de solo lectura propias de `reportes.service.ts`. |
| 2026-11-06 | **Ecclesia complementa a AppIglesia** en un solo sistema; proyecto en conjunto con arnés compartido. Propuesta pendiente de revisión del equipo: `specs.md §12` y [ADR-0006](docs/ecclesia/adr/0006-complemento-de-appiglesia.md). |

## Estado actual
- **Expansión Ecclesia** (2026-11-06): el caso de la Coordinación Nacional de Templos amplía el proyecto a nivel nacional; AppIglesia pasa a ser la gestión interna de cada iglesia. Requerimientos en `docs/requerimientos.md`; alcance, reparto y calendario en `specs.md §12`. Hecho: iglesias/roles/`alcanceIglesia`, usuarios por iglesia y **diezmo completo** (backend + pantalla `/diezmo` en Angular; rama `feat/E4-diezmo-completo`: backend 630 pruebas, frontend 120, recorrido HTTP real 18/18). También hecho (mínimo para que el diezmo funcione de punta a punta): `GET/POST /iglesias` (solo Coordinación), pantalla `/iglesias`, selector de iglesia al crear usuarios y un inicio propio para la Coordinación (backend 640 pruebas, frontend 131). Pendiente: espacios (E4-07…11), alcance por iglesia en la gestión interna (E4-22) y ampliar iglesias (ubicación, patrimonio, cierre; Nataly).
- **Correcciones del PR #9 de Genaro (original) traídas al backend de la copia** (2026-11-04): eventos reprogramados vuelven a `PROGRAMADO`, coordinador limitado a sus integrantes, tope de 2 años en el resumen, búsqueda sin acentos en eventos y anuncios, `GET /anuncios?estado=`, pase de lista hasta 5 000 y seed de B3. Backend: 379 pruebas en verde.
- **Copia en Angular** (repo `Asahel-Pech20/Copia-de-las-iglesias`, 2026-11-03): frontend de F1 (base, auth, usuarios, configuración) y F2 (miembros, ministerios, `SelectorMiembros`) reescrito en Angular 21 + Material; backend sin cambios. 27 pruebas de frontend (Vitest), lint, typecheck, formato y `ng build` en verde. 
- **B1 y F1 completos** (rama `feat/B1-F1-base`, PR [Surer46/IglesyApp#1](https://github.com/Surer46/IglesyApp/pull/1), fusionado en `develop` y `main`). Backend: 152 pruebas; frontend: 85. Probado de punta a punta: login real, sesión al recargar, invitación por Mailpit, logo servido desde el backend, Swagger.
- Criterios de B1 aún abiertos: revisión del schema por B3/B4 (B2 la hizo: sus modelos funcionan sin cambios), `prisma studio` sin verificar.
- **Ya desbloqueado para el equipo:** `autenticar`, `autorizar`, `autorizarAlguno`, `esCoordinadorDe` (`middlewares/auth.ts`), `validar`, `AppError`, paginación, plantilla `modules/_plantilla/`, `loginComo(rol)` para pruebas, componentes de `components/comunes` y MSW. Guía: `backend/README.md`.
- **B2 y F2 implementados** y conectados con F3 y F4 en Angular: `resumenAsistencia` en `GET /miembros/:id` (se omite sin `asistencia:leer`), pestañas *Asistencia* y *Aportaciones* del perfil y *Actividades* del ministerio. Auditoría 1 de B2 atendida (A1-B2-01 y 02); las de F2 las cierra el PR #2. Pruebas de F2 en `prueba/f2.spec.ts`.
- **B3 y F3 implementados** (rama `feat/B3-F3-eventos-asistencia-anuncios`, sobre `develop`, sin push): eventos, calendario, responsables, cancelación, pase de lista, historial, resumen semanal/mensual, anuncios y cartelera pública (`/cartelera`). Verificado: backend 282 pruebas y frontend 137, lint, typecheck y formato en verde; pantallas revisadas a 360 px y escritorio contra el backend real. Abiertos: confirmación de B4 (B3-11) y F4 (F3-12), Lighthouse de la cartelera.
- Para B4/F4: servicios de B3 en `backend/README.md`; en frontend `useEventosProximos`, `ListaEventos`, `useAsistencias`, `TarjetaAnuncio compacta` y `useAnunciosVigentes`.
- **B4 implementado** (rama `feat/B4-F4-donaciones-dashboard-reportes`, sobre `develop`, commit `1e7220b`, sin push): donaciones (CRUD, anulación, resúmenes), `/dashboard` con cache e `ingresos` omitido sin permiso, 4 reportes en JSON/PDF/Excel (`lib/exportadores/`), seed de 12 meses de aportaciones (`prisma/seed-b4.ts`) y rutas en `openapi.yaml`. Verificado: backend 371 pruebas, lint, typecheck y formato en verde. Pendiente: revisar a ojo un PDF en un visor.
- **F4 implementado** (misma rama que B4, segundo commit, sin push): `/donaciones` (pestañas Aportaciones / Resumen / Resumen mensual, registro con interruptor anónima, detalle con auditoría, anulación con motivo), dashboard en `/` (reemplaza `InicioPage`; `ingresos` solo si la respuesta lo trae), `/reportes` (tarjetas por permiso, `?tipo=`, vista previa genérica, descarga PDF/Excel con `responseType: 'blob'`, el error en Blob se lee en `features/reportes/api.ts`) y `BotonExportar`. Verificado: frontend 184 pruebas, lint, typecheck, format y `vite build` en verde; pantallas revisadas en el navegador con mocks a 360, 1024 y 1280 px y en modo oscuro (Auditoría 1, observaciones A1-F4-01 … 05 corregidas). **Falta** probar contra el backend real.
  - Para F2 (PR #8): `AportacionesDelMiembro` (`features/donaciones/components/`, props `miembroId`, `limite?`) para la pestaña *Aportaciones* del perfil; se oculta solo sin `donaciones:leer`. No se tocaron `MiembroPerfilPage.tsx`, `MiembrosPage.tsx` ni `DataTable.tsx`.
  - Para F2/F3 (F4-11): `<BotonExportar tipo filtros />` (`features/reportes/components/`) se oculta solo si el rol no ve ese reporte. Otros reutilizables: `TarjetaGrafica`/`GraficaBarras`/`GraficaDona` (`features/dashboard/components/Graficas.tsx`, con "Ver como tabla"), `useFormatoMoneda` (`hooks/`).
  - Contrato: la auditoría "anulada por" sale de `actualizadoPor` (el backend no tiene campo `anuladaPor`). `lib/formato.ts` ganó etiquetas de concepto/método/agrupación, `formatearMes` y `etiquetaClave`. Formato numérico es-MX (decimal con punto).
- **Auditoría 1** (2026-11-02, commit `bb91c07`, misma rama que B4/F4): 35 observaciones por integrante y capa en [Auditorias/Auditoria_1/](Auditorias/Auditoria_1/README.md), ninguna de severidad alta. Corregidas: A1-F4-01 … 05. Las demás están pendientes de cada dueño.
- Entorno de esta laptop: no hay Docker ni pnpm global. Se usó `npx pnpm@12.16.1` y un PostgreSQL 16 portátil (`embedded-postgres`, puerto 5433) fuera del repo. Para seguir: instalar pnpm y PostgreSQL o Docker (`docs/requisitos.md`).

### Cómo levantar todo
1. `docker compose up -d` · 2. `cp backend/.env.example backend/.env` (una vez) · 3. `pnpm install` · 4. `pnpm --filter backend db:deploy` y `db:seed` · 5. `pnpm dev`.
- El frontend usa mocks por defecto en desarrollo; para usar el backend real: `pnpm --filter frontend dev:real` (usa `environment.real.ts`).
- Usuarios: `<rol>@iglesia.local` / `SEED_PASSWORD` (backend real) o `Iglesia123` (mocks, `frontend/src/mocks/datos/b1.ts`).

## Pendientes / preguntas abiertas
- Confirmar moneda y zona horaria de la iglesia real.
- Definir dónde se desplegará (opcional para la entrega).
