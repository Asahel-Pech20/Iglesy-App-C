# specs.md — Especificación técnica y planeamiento

> Documento de planeamiento de **AppIglesia**: alcance, tecnologías, arquitectura, modelo de datos, contrato de API y división del trabajo.
> Reglas de diseño y restricciones → [AGENTS.md](AGENTS.md). Memoria / información clave → [CLAUDE.md](CLAUDE.md).
> **Expansión Ecclesia:** el proyecto se complementa con el caso de la Coordinación Nacional de Templos. Las §1–§11 describen la base ya construida; lo que el caso agrega o cambia está en la [§12](#12-expansión-ecclesia), que **prevalece** si hay diferencias.

---

## 1. Descripción general

AppIglesia es una aplicación web para la administración interna de una iglesia: usuarios del sistema con roles, miembros, asistencia, eventos, ministerios, donaciones, comunicados, dashboard, reportes y configuración institucional.

- **Usuarios del sistema**: personal de la iglesia (administrador, pastor, secretario, tesorero, coordinador). Son los únicos que inician sesión.
- **Miembros**: personas de la congregación. Se registran como datos; **no** inician sesión.
- No existe registro público: los usuarios los crea un administrador.
- Existe una **cartelera pública** de solo lectura (anuncios vigentes + próximos eventos + horarios).

---

## 2. Requerimientos funcionales (con IDs de trazabilidad)

Cada tarea en `docs/` referencia estos IDs.

### RF-01. Inicio de sesión y usuarios
| ID | Requerimiento |
|----|---------------|
| RF-01.1 | Registrar usuarios del sistema (solo administrador). |
| RF-01.2 | Iniciar y cerrar sesión. |
| RF-01.3 | Autenticación mediante correo y contraseña. |
| RF-01.4 | Recuperar o restablecer contraseñas (enlace por correo con token). |
| RF-01.5 | Roles: `ADMIN`, `PASTOR`, `SECRETARIO`, `TESORERO`, `COORDINADOR`. |
| RF-01.6 | Restringir el acceso a funciones según el rol (backend **y** frontend). |

### RF-02. Gestión de miembros
| ID | Requerimiento |
|----|---------------|
| RF-02.1 | Registrar nuevos miembros. |
| RF-02.2 | Consultar el listado de miembros (paginado). |
| RF-02.3 | Editar información personal. |
| RF-02.4 | Campos mínimos: nombre, teléfono, correo, fecha de ingreso. |
| RF-02.5 | Buscar miembros por nombre. |
| RF-02.6 | Filtrar activos / inactivos. |
| RF-02.7 | Desactivar sin eliminar (soft delete). |

### RF-03. Control de asistencia
| ID | Requerimiento |
|----|---------------|
| RF-03.1 | Registrar asistencia a cultos, reuniones y actividades. |
| RF-03.2 | Seleccionar fecha y evento correspondiente. |
| RF-03.3 | Marcar miembros presentes y ausentes. |
| RF-03.4 | Consultar historial de asistencia (por evento y por miembro). |
| RF-03.5 | Reportes semanales y mensuales de asistencia. |

### RF-04. Gestión de eventos
| ID | Requerimiento |
|----|---------------|
| RF-04.1 | Crear eventos religiosos y administrativos. |
| RF-04.2 | Título, fecha, hora, lugar y descripción. |
| RF-04.3 | Asignar responsables. |
| RF-04.4 | Modificar o cancelar eventos (cancelar ≠ borrar). |
| RF-04.5 | Visualizar eventos en calendario (mes / semana / lista). |

### RF-05. Administración de ministerios
| ID | Requerimiento |
|----|---------------|
| RF-05.1 | Registrar ministerios (ej. música, jóvenes, niños, enseñanza, servicio). |
| RF-05.2 | Asignar coordinadores. |
| RF-05.3 | Vincular miembros a cada ministerio. |
| RF-05.4 | Consultar integrantes y actividades programadas. |

### RF-06. Donaciones y aportaciones
| ID | Requerimiento |
|----|---------------|
| RF-06.1 | Registrar aportaciones económicas. |
| RF-06.2 | Fecha, monto, concepto y método de recepción. |
| RF-06.3 | Consultar ingresos por periodo. |
| RF-06.4 | Resumen mensual. |
| RF-06.5 | Información financiera solo para personal autorizado. |
| RF-06.6 | Registros anónimos (sin miembro asociado). |

### RF-07. Comunicados y anuncios
| ID | Requerimiento |
|----|---------------|
| RF-07.1 | Publicar anuncios. |
| RF-07.2 | Editar y eliminar publicaciones. |
| RF-07.3 | Indicar fecha de publicación. |
| RF-07.4 | Mostrar próximos eventos y avisos importantes. |

### RF-08. Dashboard
| ID | Requerimiento |
|----|---------------|
| RF-08.1 | Total de miembros activos. |
| RF-08.2 | Eventos próximos. |
| RF-08.3 | Número de asistencias registradas. |
| RF-08.4 | Cantidad de ministerios. |
| RF-08.5 | Resumen de ingresos (solo roles autorizados). |
| RF-08.6 | Gráficas estadísticas. |

### RF-09. Reportes
| ID | Requerimiento |
|----|---------------|
| RF-09.1 | Reporte general de miembros. |
| RF-09.2 | Reporte de asistencia por evento. |
| RF-09.3 | Reporte de participación por ministerio. |
| RF-09.4 | Reporte de ingresos por periodo. |
| RF-09.5 | Exportar a PDF o Excel. |

### RF-10. Configuración de la iglesia
| ID | Requerimiento |
|----|---------------|
| RF-10.1 | Nombre de la iglesia. |
| RF-10.2 | Logotipo. |
| RF-10.3 | Dirección y datos de contacto. |
| RF-10.4 | Horarios habituales de reuniones. |
| RF-10.5 | Actualizar información institucional. |

---

## 3. Roles y matriz de permisos

Leyenda: **C** crear · **L** leer · **E** editar · **D** desactivar/cancelar/eliminar · `—` sin acceso · *(propio)* = solo ministerios donde es coordinador.

| Módulo | ADMIN | PASTOR | SECRETARIO | TESORERO | COORDINADOR |
|---|---|---|---|---|---|
| Usuarios | CLED | — | — | — | — |
| Configuración iglesia | LE | L | L | L | L |
| Miembros | CLED | CLED | CLED | L | L |
| Ministerios | CLED | CLED | L | L | L · E *(propio: integrantes)* |
| Eventos | CLED | CLED | CLED | L | L · CED *(propio)* |
| Asistencia | CLE | CLE | CLE | — | CLE *(propio)* |
| Anuncios | CLED | CLED | CLED | L | L |
| Donaciones | CLED | L | — | CLED | — |
| Dashboard | completo | completo | sin ingresos | completo | sin ingresos |
| Reportes miembros / asistencia / ministerios | ✔ | ✔ | ✔ | — | ✔ *(propio)* |
| Reportes ingresos | ✔ | ✔ | — | ✔ | — |

- La matriz se implementa **una sola vez** en `backend/src/config/permisos.ts` y se replica en `frontend/src/lib/permisos.ts` (mismo nombre de permisos).
- Formato de permiso: `modulo:accion` (ej. `donaciones:crear`, `miembros:leer`).
- "Donaciones D" = **anular** (nunca borrar).

**Nombres de permisos** (B1-08, `config/permisos.ts`):
- Por módulo `usuarios`, `miembros`, `ministerios`, `eventos`, `anuncios`, `donaciones`: `:crear`, `:leer`, `:editar`, `:eliminar` (D = desactivar / cancelar / eliminar / anular según el módulo).
- `configuracion:leer`, `configuracion:editar` · `asistencia:crear`, `asistencia:leer`, `asistencia:editar` · `dashboard:leer` · `usuarios:opciones` (ADMIN, PASTOR).
- Reportes: `reportes:generales` (miembros / asistencia / ministerios) y `reportes:ingresos`.
- Variantes *(propio)* del COORDINADOR con sufijo `-propio`: `ministerios:editar-propio`, `eventos:crear-propio`, `eventos:editar-propio`, `eventos:eliminar-propio`, `asistencia:crear-propio`, `asistencia:leer-propio`, `asistencia:editar-propio`, `reportes:generales-propio`. El endpoint verifica además `esCoordinadorDe(usuarioId, ministerioId)`.
- Ver ingresos del dashboard = tener `donaciones:leer`.

---

## 4. Stack tecnológico

### Backend
| Área | Tecnología |
|---|---|
| Runtime | Node.js LTS (22.x) |
| Lenguaje | TypeScript (modo `strict`) |
| Framework HTTP | Express 5 |
| Base de datos | PostgreSQL 16 |
| ORM / migraciones | Prisma |
| Validación | Zod |
| Autenticación | JWT (access token 15 min en header `Authorization: Bearer`) + refresh token 7 días en cookie `httpOnly` |
| Hash de contraseñas | bcrypt (cost 12) |
| Correo | Nodemailer (dev: Mailpit en Docker) |
| Subida de archivos | Multer (logo, disco local `uploads/`) |
| Exportación | PDFKit (PDF) · ExcelJS (XLSX) |
| Documentación API | OpenAPI 3 + swagger-ui-express en `/api/docs` |
| Seguridad | helmet, cors, express-rate-limit |
| Logs | pino |
| Pruebas | Vitest + Supertest (BD de pruebas en Docker) |
| Calidad | ESLint + Prettier |

### Frontend
| Área | Tecnología |
|---|---|
| Framework | Angular 21 (componentes standalone, signals, control flow `@if`/`@for`) |
| Lenguaje | TypeScript (modo `strict`) |
| Enrutamiento | Angular Router (guards `rutaProtegida`, `cambiosSinGuardar`) |
| Estado servidor | Servicios + `rxResource` (signals) |
| Formularios | Reactive Forms con validadores propios (`core/validadores.ts`) |
| Estilos / UI | Angular Material (CDK) + tokens CSS de AGENTS.md §4 + lucide-angular |
| HTTP | HttpClient (interceptor de token / refresh, `core/api.ts`) |
| Calendario | FullCalendar (`@fullcalendar/angular`) — pendiente F3 |
| Gráficas | por definir en F4 (Recharts es solo de React) |
| Fechas | date-fns (locale `es`) |
| Mocks durante desarrollo | Handlers de MSW ejecutados por un interceptor HTTP (sin Service Worker) |
| Pruebas | Vitest (`ng test`) + TestBed + RouterTestingHarness |
| Calidad | ESLint + Prettier |

### Infraestructura / herramientas
- Monorepo con `pnpm` workspaces (`backend/`, `frontend/`).
- `docker-compose.yml`: `postgres`, `postgres-test`, `mailpit`.
- Git + GitHub (ramas por tarea, PR obligatorio).
- CI (GitHub Actions): lint + typecheck + tests en cada PR.

---

## 5. Arquitectura y estructura del repositorio

```
AppIglesia/
├── CLAUDE.md  AGENTS.md  specs.md
├── docker-compose.yml
├── docs/
│   ├── README.md                       # índice de tareas
│   ├── backend/  B1..B4/               # plan.md + tasks-*.md
│   └── frontend/ F1..F4/
├── backend/
│   ├── prisma/  schema.prisma  migrations/  seed.ts
│   ├── uploads/                        # logos (git-ignored)
│   └── src/
│       ├── app.ts  server.ts
│       ├── config/       env.ts permisos.ts
│       ├── middlewares/  auth.ts autorizar.ts validar.ts errores.ts
│       ├── lib/          prisma.ts mailer.ts paginacion.ts exportadores/
│       └── modules/
│           └── <modulo>/ <modulo>.routes.ts  .controller.ts  .service.ts  .schemas.ts  <modulo>.test.ts
└── frontend/
    └── src/
        ├── app/          router.tsx providers.tsx
        ├── components/   ui/ (shadcn)  layout/  comunes/
        ├── lib/          api.ts permisos.ts formato.ts queryClient.ts
        ├── hooks/
        ├── types/        # tipos del contrato API (espejo de specs §6-§7)
        ├── mocks/        # handlers MSW
        └── features/
            └── <modulo>/ api.ts  hooks.ts  pages/  components/  schemas.ts
```

**Capas backend**: `routes` (ruta + middlewares) → `controller` (HTTP in/out) → `service` (lógica de negocio, único que usa Prisma). Un módulo **no** importa Prisma de otro módulo directamente para lógica de negocio: usa el `service` exportado del módulo dueño.

Módulos backend: `auth`, `usuarios`, `configuracion`, `miembros`, `ministerios`, `eventos`, `asistencia`, `anuncios`, `donaciones`, `dashboard`, `reportes`, `public`.

---

## 6. Modelo de datos (Prisma, resumen)

> IDs `String @id @default(uuid())`. Todas las tablas con `createdAt` / `updatedAt` salvo tablas puente. Dinero `Decimal(12,2)`. Fechas en UTC.

```prisma
enum Rol { ADMIN PASTOR SECRETARIO TESORERO COORDINADOR }
enum TipoEvento { RELIGIOSO ADMINISTRATIVO }
enum CategoriaEvento { CULTO REUNION ACTIVIDAD OTRO }
enum EstadoEvento { PROGRAMADO CANCELADO REALIZADO }
enum ConceptoDonacion { DIEZMO OFRENDA PRIMICIA DONACION_ESPECIAL OTRO }
enum MetodoPago { EFECTIVO TRANSFERENCIA TARJETA CHEQUE OTRO }
enum PrioridadAnuncio { NORMAL IMPORTANTE }

model Usuario {
  id String @id @default(uuid())
  nombre String
  email String @unique
  passwordHash String?   // null mientras el usuario no configura su contraseña (invitación, B1-14)
  rol Rol
  activo Boolean @default(true)
  ultimoAcceso DateTime?
  // relaciones: refreshTokens, resetTokens, ministeriosCoordinados, eventosCreados, donacionesRegistradas, anuncios
}

model RefreshToken      { id, usuarioId, tokenHash, expiraEn, revocadoEn? }
model PasswordResetToken{ id, usuarioId, tokenHash, expiraEn (1 h), usadoEn? }

model Miembro {
  id, nombre, apellidos, telefono?, email?, fechaIngreso DateTime @db.Date,
  fechaNacimiento? @db.Date, direccion?, notas?,
  activo Boolean @default(true), fechaBaja?, motivoBaja?
  @@index([apellidos, nombre])
}

model Ministerio {
  id, nombre @unique, descripcion?, activo Boolean @default(true)
}
model MinisterioCoordinador { ministerioId, usuarioId  @@id([ministerioId, usuarioId]) }
model MiembroMinisterio {
  miembroId, ministerioId, fechaUnion DateTime @default(now()), fechaSalida?, activo Boolean @default(true)
  @@id([miembroId, ministerioId])
}

model Evento {
  id, titulo, descripcion?, tipo TipoEvento, categoria CategoriaEvento,
  fechaInicio DateTime, fechaFin DateTime?, lugar,
  estado EstadoEvento @default(PROGRAMADO), motivoCancelacion?,
  ministerioId String?, creadoPorId String
  @@index([fechaInicio])
}
model EventoResponsable { eventoId, miembroId  @@id([eventoId, miembroId]) }

model Asistencia {
  id, eventoId, miembroId, presente Boolean, registradoPorId, registradoEn DateTime @default(now())
  @@unique([eventoId, miembroId])
}

model Donacion {
  id, fecha DateTime @db.Date, monto Decimal @db.Decimal(12,2),
  concepto ConceptoDonacion, conceptoDetalle?, metodo MetodoPago,
  miembroId String?, anonima Boolean @default(false), referencia?, notas?,
  anulada Boolean @default(false), motivoAnulacion?, anuladaEn?,
  registradoPorId String, actualizadoPorId String?
  @@index([fecha])
}

model Anuncio {
  id, titulo, contenido (texto plano / markdown simple), prioridad PrioridadAnuncio @default(NORMAL),
  fechaPublicacion DateTime, fechaExpiracion DateTime?, eventoId String?, autorId String
}

model ConfiguracionIglesia {   // fila única, id fijo = 1
  id Int @id @default(1), nombre, logoUrl?, direccion?, ciudad?, telefono?, email?, sitioWeb?,
  moneda String @default("MXN"), zonaHoraria String @default("America/Mexico_City")
}
model HorarioReunion { id, nombre, diaSemana Int (0=domingo..6), horaInicio "HH:mm", horaFin "HH:mm"?, lugar?, activo Boolean }
```

**Reglas de integridad**
- `Donacion.anonima = true` ⇒ `miembroId = null`. Si `miembroId` es null ⇒ se trata como anónima.
- `Asistencia` solo para eventos `PROGRAMADO`/`REALIZADO` y miembros activos al momento del registro.
- `Evento.fechaFin`, si existe, ≥ `fechaInicio`.
- Usuarios, miembros, ministerios y donaciones **nunca** se borran físicamente. Anuncios y horarios sí.

---

## 7. Contrato de API

### 7.1 Convenciones
- Base: `/api/v1`. JSON en `camelCase`. Fechas ISO 8601 (`2026-10-30` para `@db.Date`, `2026-10-30T18:00:00.000Z` para `DateTime`).
- Paginación: `?page=1&limit=20` (máx. 100). Búsqueda: `?q=`. Orden: `?orden=campo:asc|desc`.
- Respuesta lista: `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`
- Respuesta objeto: `{ "data": { ... } }`
- Error: `{ "error": { "code": "VALIDATION_ERROR", "message": "texto en español", "details": [...] } }`

| HTTP | `code` |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED` / `TOKEN_EXPIRED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `BUSINESS_RULE` (ej. registrar asistencia en evento cancelado) |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |

- Exportaciones: `?formato=json|pdf|xlsx` → `Content-Disposition: attachment; filename="reporte-miembros-2026-10-30.pdf"`.

### 7.2 Endpoints

**Auth** (B1)
| Método | Ruta | Acceso |
|---|---|---|
| POST | `/auth/login` | público (rate limit 5/min/IP) |
| POST | `/auth/refresh` | cookie refresh |
| POST | `/auth/logout` | cookie refresh (no requiere access token) |
| POST | `/auth/forgot-password` | público (responde 204 siempre) |
| POST | `/auth/reset-password` | público (token) |
| GET | `/auth/me` | autenticado → usuario + `permisos[]` |
| PATCH | `/auth/me/password` | autenticado |

Respuestas de auth (B1):
- `POST /auth/login` → `{ data: { accessToken, usuario, permisos[] } }` + cookie `refreshToken` (httpOnly).
- `POST /auth/refresh` → `{ data: { accessToken } }` y rota la cookie. `GET /auth/me` → `{ data: { usuario, permisos[] } }`.
- `usuario` = `{ id, nombre, email, rol, activo, ultimoAcceso, createdAt, updatedAt }` (nunca `passwordHash`).
- `PATCH /auth/me/password` body `{ passwordActual, passwordNueva }`; `POST /auth/reset-password` body `{ token, password }` (también fija la contraseña inicial de la invitación). Errores de campo en `details[].campo`.

**Usuarios** (B1) — solo ADMIN
`GET /usuarios` · `POST /usuarios` · `GET /usuarios/:id` · `PATCH /usuarios/:id` · `PATCH /usuarios/:id/estado` · `POST /usuarios/:id/reenviar-invitacion`
`POST /usuarios` body `{ nombre, email, rol, password? }`: sin `password` se envía un correo de invitación (enlace de 48 h).
`GET /usuarios/opciones?rol=` → `[{ id, nombre, rol }]` solo activos (ADMIN y PASTOR; para elegir coordinadores)

**Configuración** (B1)
`GET /configuracion` (público; `logoUrl` es URL absoluta) · `PUT /configuracion` (ADMIN) · `POST /configuracion/logo` (ADMIN, multipart, png/jpg/svg/webp ≤ 2 MB)
`GET /configuracion/horarios` (público) · `POST|PATCH|DELETE /configuracion/horarios[/:id]` (ADMIN)

**Miembros** (B2)
`GET /miembros?q&estado=activo|inactivo|todos&ministerioId` · `POST /miembros` · `GET /miembros/:id` · `PATCH /miembros/:id` · `PATCH /miembros/:id/estado`

**Ministerios** (B2)
`GET /ministerios` · `POST /ministerios` · `GET /ministerios/:id` · `PATCH /ministerios/:id` · `PATCH /ministerios/:id/estado`
`GET /ministerios/:id/miembros` · `POST /ministerios/:id/miembros` (`{ miembroIds[] }`) · `DELETE /ministerios/:id/miembros/:miembroId` (desvincula, soft)
`PUT /ministerios/:id/coordinadores` (`{ usuarioIds[] }`)
Actividades del ministerio → `GET /eventos?ministerioId=` (B3).

**Eventos** (B3)
`GET /eventos?desde&hasta&tipo&categoria&estado&ministerioId` · `GET /eventos/proximos?limit=5` · `POST /eventos` · `GET /eventos/:id` · `PATCH /eventos/:id` · `PATCH /eventos/:id/cancelar` (`{ motivo }`) · `PUT /eventos/:id/responsables` (`{ miembroIds[] }`)

**Asistencia** (B3)
`GET /eventos/:id/asistencia` (miembros esperados + estado) · `PUT /eventos/:id/asistencia` (`{ registros: [{ miembroId, presente }] }`, upsert masivo)
`GET /asistencias?miembroId&eventoId&desde&hasta` · `GET /asistencias/resumen?periodo=semanal|mensual&desde&hasta`

**Anuncios** (B3)
`GET /anuncios?vigentes=true&prioridad&estado=vigentes|programados|expirados` · `GET /anuncios/:id` · `POST /anuncios` · `PATCH /anuncios/:id` · `DELETE /anuncios/:id`

**Público** (B3)
`GET /public/cartelera` → `{ iglesia, horarios, anuncios (vigentes), eventosProximos }`

**Donaciones** (B4) — ADMIN, TESORERO (PASTOR solo lectura)
`GET /donaciones?desde&hasta&concepto&metodo&miembroId&anonima&incluirAnuladas` · `POST /donaciones` · `GET /donaciones/:id` · `PATCH /donaciones/:id` · `PATCH /donaciones/:id/anular` (`{ motivo }`)
`GET /donaciones/resumen?desde&hasta&agrupar=dia|semana|mes|concepto|metodo` · `GET /donaciones/resumen-mensual?anio&mes`

**Dashboard** (B4)
`GET /dashboard` →
```json
{ "data": {
  "miembrosActivos": 120, "totalMinisterios": 6,
  "asistenciasRegistradas": { "mesActual": 340, "semanaActual": 85 },
  "eventosProximos": [ { "id": "", "titulo": "", "fechaInicio": "", "lugar": "" } ],
  "anunciosImportantes": [ ],
  "graficas": {
    "asistenciaSemanal": [ { "semana": "2026-W43", "presentes": 80 } ],
    "miembrosPorMinisterio": [ { "ministerio": "Jóvenes", "total": 25 } ],
    "altasMiembrosPorMes": [ { "mes": "2026-10", "total": 4 } ]
  },
  "ingresos": { "mesActual": "15230.00", "mesAnterior": "14100.00", "porMes": [ ] }
} }
```
`ingresos` solo aparece (no es `null`, **se omite**) si el rol tiene `donaciones:leer`.

**Reportes** (B4) — todos aceptan `formato=json|pdf|xlsx`
`GET /reportes/miembros?estado` · `GET /reportes/asistencia?eventoId | desde&hasta` · `GET /reportes/ministerios?ministerioId` · `GET /reportes/ingresos?desde&hasta&agrupar`

---

## 8. Requerimientos no funcionales

| ID | Requerimiento |
|---|---|
| RNF-01 | Seguridad: contraseñas con bcrypt; JWT firmados; autorización por rol en **cada** endpoint; CORS limitado a `FRONTEND_URL`; helmet; rate limit en auth. |
| RNF-02 | Rendimiento: listados paginados; respuesta < 500 ms con 5 000 miembros. |
| RNF-03 | Usabilidad: interfaz en español, responsive (≥ 360 px), accesible (WCAG 2.1 AA). |
| RNF-04 | Integridad: soft delete en entidades principales; donaciones auditables (quién registró / editó / anuló). |
| RNF-05 | Mantenibilidad: TypeScript strict, lint sin errores, pruebas automatizadas por endpoint. |
| RNF-06 | Portabilidad: levantar todo con `docker compose up -d` + `pnpm dev`. |

---

## 9. División del trabajo

Cada integrante es dueño de **una subsección de backend y su par en frontend** (mismo dominio, propiedad vertical). Esto reduce dependencias y conflictos de merge.

| Integrante | Backend | Frontend | RF |
|---|---|---|---|
| **Santiago Asahel Pech Ake** | [B1 – Infraestructura, Auth, Usuarios, Configuración](docs/backend/B1-auth-usuarios-config/plan.md) | [F1 – Base UI, Layout, Auth, Usuarios, Configuración](docs/frontend/F1-base-auth-config/plan.md) | RF-01, RF-10 |
| **Nataly Marisol Santos Miam** | [B2 – Miembros, Ministerios, Seed](docs/backend/B2-miembros-ministerios/plan.md) | [F2 – Miembros, Ministerios, selector de miembros](docs/frontend/F2-miembros-ministerios/plan.md) | RF-02, RF-05 |
| **Genaro Aurelio Antonio Pacheco** | [B3 – Eventos, Asistencia, Anuncios, Público](docs/backend/B3-eventos-asistencia-anuncios/plan.md) | [F3 – Calendario, Asistencia, Anuncios, Cartelera](docs/frontend/F3-eventos-asistencia-anuncios/plan.md) | RF-03, RF-04, RF-07 |
| **Oscar Michel Matos May** | [B4 – Donaciones, Dashboard, Reportes](docs/backend/B4-donaciones-dashboard-reportes/plan.md) | [F4 – Donaciones, Dashboard, Reportes](docs/frontend/F4-donaciones-dashboard-reportes/plan.md) | RF-06, RF-08, RF-09 |

### Dependencias entre subsecciones
```
B1 (infra + auth + permisos + schema inicial) ──► B2, B3, B4
B2 (miembros, ministerios) ──► B3 (asistencia, responsables) ──► B4 (dashboard, reportes)
F1 (layout, componentes base, api client, guards) ──► F2, F3, F4
F2 (SelectorMiembros) ──► F3 (asistencia, responsables), F4 (donaciones)
```
Para no bloquearse: el frontend trabaja contra **mocks MSW** basados en §7 hasta que el endpoint real exista; el backend expone stubs que responden el contrato desde la Fase 1.

Reparto de los módulos que agrega Ecclesia → §12.6.

---

## 10. Cronograma por fases

| Fase | Semanas | Objetivo | Entregable |
|---|---|---|---|
| **0. Arranque** | 1 | Monorepo, Docker, schema Prisma completo, CI, layout vacío, componentes base | `pnpm dev` levanta backend + frontend; login simulado |
| **1. Núcleo** | 2–3 | Auth real, permisos, usuarios, configuración, CRUD miembros y ministerios, eventos básicos | Se puede iniciar sesión y gestionar miembros |
| **2. Módulos** | 4–6 | Asistencia, calendario, anuncios, donaciones, vínculos ministerio-miembro | Todos los CRUD funcionando end-to-end |
| **3. Integración** | 7–8 | Dashboard, reportes PDF/Excel, cartelera pública, pruebas, pulido UI, documentación | Versión 1.0 demostrable |

Cada `plan.md` detalla qué tareas caen en cada fase. Calendario de Ecclesia → §12.7.

---

## 11. Variables de entorno

`backend/.env.example`
```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://iglesia:iglesia@localhost:5432/iglesia
DATABASE_URL_TEST=postgresql://iglesia:iglesia@localhost:5433/iglesia_test
JWT_ACCESS_SECRET=cambiar
JWT_REFRESH_SECRET=cambiar
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
FRONTEND_URL=http://localhost:5173
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="AppIglesia <no-reply@iglesia.local>"
UPLOAD_DIR=uploads
API_PUBLIC_URL=http://localhost:3000
SEED_PASSWORD=Iglesia123
```

`frontend/.env.example`
```
VITE_API_URL=http://localhost:3000/api/v1
VITE_USE_MOCKS=true
```

---

## 12. Expansión Ecclesia

> **Estado: propuesta para revisión del equipo** (2026-11-06). Decisión en [ADR-0006](docs/ecclesia/adr/0006-complemento-de-appiglesia.md).

### 12.1 Qué cambia

El sistema pasa de administrar **una** iglesia a ser el **sistema nacional** de la Coordinación Nacional de Templos. Lo construido no se tira: se convierte en la **gestión interna de cada iglesia**, y Ecclesia agrega el nivel nacional, el público y los dominios nuevos.

| Nivel | Quién | Qué hace | Origen |
|---|---|---|---|
| Público | Visitante, investigador, solicitante | Consulta iglesias, servicios, pláticas, misas y reconocidas; pide espacios con folio y clave | Caso (nuevo) |
| Nacional | Personal de la Coordinación | Administra catálogos, iglesias, usuarios y criterios del índice | Caso (nuevo) |
| Iglesia: lo que pide el caso | Administrador y tesorero | Datos, objetos, servicios, pláticas, padres, horarios, misas, solicitudes y diezmo de **su** iglesia | Caso (nuevo) |
| Iglesia: gestión interna | Personal de cada iglesia | Miembros, ministerios, eventos, asistencia, anuncios, donaciones, dashboard y reportes | AppIglesia (§2) |

**Fuentes y precedencia**
- Requerimientos del caso: [docs/requerimientos.md](docs/requerimientos.md) (`RF-01`…, `RN-`, `CA-`, `RNF-`). Aquí no se duplican.
- Gestión interna: §2 de este archivo (`RF-01.1`…). Se llaman **requerimientos heredados**: no tienen origen en el caso, así que no entran en la matriz de trazabilidad de Ecclesia y su continuidad se pregunta al cliente (P-20).
- Si un heredado contradice al caso, gana el caso.

### 12.2 Cómo se complementa lo existente

| Base AppIglesia | Con Ecclesia | Tipo de cambio |
|---|---|---|
| `ConfiguracionIglesia` (fila única, `id = 1`) | `Iglesia`: una fila por iglesia, con sus datos, contacto, logo, moneda y zona horaria | Se reemplaza |
| `HorarioReunion` | Se conserva por iglesia para reuniones; las misas usan `HorarioMisa` | Se amplía |
| `Usuario` | Agrega `iglesiaId` (null solo en la Coordinación) | Se amplía |
| Roles (§3) | Ver §12.3 | Se amplía |
| `Miembro`, `Ministerio`, `Evento`, `Anuncio`, `Donacion` | Agregan `iglesiaId`; `Asistencia` la obtiene de su evento | Se amplía |
| `Evento` y `Asistencia` | Siguen para actividades internas; una misa **no** es un evento: usa `HorarioMisa` y `MisaCelebrada` | Convive |
| `Donacion` | Sigue para aportaciones por persona; el diezmo de cada misa usa `Diezmo` | Convive |
| Dashboard y reportes | Se limitan a la iglesia del usuario; se agregan los reportes de diezmo | Se amplía |
| `/public/cartelera` | Una por iglesia, dentro de la ficha pública | Se amplía |
| Auth, permisos, errores, paginación, OpenAPI, exportadores, CI, base de Angular | Se reutilizan | Sin cambio de fondo |

Toda consulta de gestión interna se filtra por iglesia y pasa por `alcanceIglesia`. Los datos actuales se migran a una iglesia inicial. Los cambios a `schema.prisma` siguen la regla de siempre: PR propio revisado por B1 y el dueño del modelo.

### 12.3 Roles

Se conservan los de §3 y se agrega el nivel nacional. Unifica [ADR-0004](docs/ecclesia/adr/0004-autenticacion.md) con la matriz existente.

| Rol | Alcance | Puede | Origen |
|---|---|---|---|
| `COORDINACION` | Nacional | Catálogos, iglesias, usuarios y criterios del índice. **No** ve datos de solicitantes | Caso |
| `ADMIN_IGLESIA` (hoy `ADMIN`) | Su iglesia | Datos, objetos, servicios, pláticas, padres, horarios, misas y solicitudes; además, lo de `ADMIN` en §3, salvo los usuarios, que pasan a la Coordinación | Caso + heredado |
| `TESORERO` | Su iglesia | Capturar y corregir el diezmo; lo de `TESORERO` en §3 | Caso + heredado |
| `PASTOR`, `SECRETARIO`, `COORDINADOR` | Su iglesia | Lo que indica §3 | Heredado |

Nadie modifica información de otra iglesia. Se debe aclarar con el cliente quién de la iglesia y si la Coordinación ven los reportes de diezmo (P-21).

### 12.4 Modelo de datos que se agrega

Borrador: la versión definitiva va en `docs/modelo-datos.md` con su diagrama entidad-relación, y se ajusta con las respuestas del cliente. Decisiones de datos en [ADR-0003](docs/ecclesia/adr/0003-acceso-a-datos.md).

| Módulo | Entidades | Puntos clave del caso |
|---|---|---|
| `catalogos` | `Estado`, `Municipio`, `Localidad` | Claves oficiales del INEGI |
| `iglesias` | `Iglesia` | Tipo, ubicación, capacidad, año, contacto, coordenadas; cierre sin borrar historia |
| `patrimonio` | `ObjetoPatrimonial`, `CriterioIndice` | Siglo → mitad del siglo; INAH; estados vigente, perdido, prestado y baja; criterios ajustables |
| `servicios` | `Servicio`, `Platica` y sus horarios | Costo, gratuito o donativo; requisitos, duración y cita; sesiones, cupo, lugar y quién imparte |
| `misas` | `Padre`, `PadreIglesia`, `HorarioMisa`, `MisaCelebrada` | Tipo e idioma; sin choques de un padre; una hora por defecto; hora local; quién ofició, quién cambió y por qué |
| `diezmo` | `Diezmo`, `DiezmoCorreccion` | Una captura por misa celebrada; historial de solo inserción; `Decimal(12,2)` |
| `espacios` | `TipoEspacio`, `SolicitudEspacio`, `Cotizacion` | Folio + clave con hash; vigencia de 15 días; datos privados; diagrama de estados |

### 12.5 API que se agrega

Grupos previstos bajo `/api/v1`; las rutas exactas se definen en el diseño de la API de la Entrega 1 y se documentan en `backend/openapi.yaml`. Convenciones de §7.1 sin cambios.

| Grupo | Acceso |
|---|---|
| `/public/*`: iglesias por estado, ficha, reconocidas, búsqueda por patrimonio, misas, servicios y pláticas | Sin sesión; nunca devuelve datos privados |
| `/public/solicitudes-espacio`: crear y dar seguimiento con folio y clave | Sin sesión, con límite de intentos |
| `/catalogos`, `/iglesias`, `/criterios-indice`, `/usuarios` | `COORDINACION`; el administrador edita los datos de la suya |
| `/iglesias/:iglesiaId/*`: objetos, servicios, pláticas, padres, horarios, misas, diezmos, solicitudes y gestión interna | Personal de esa iglesia, con `alcanceIglesia` |
| Agenda semanal de cada padre | Por definir con los requerimientos de Genaro |

### 12.6 Reparto

Se mantiene la propiedad vertical: cada quien conserva sus módulos y suma los del caso más afines.

| Integrante | Mantiene | Suma de Ecclesia | Requerimientos |
|---|---|---|---|
| **Santiago** | B1, F1 | Alcance por iglesia, roles, cambios a `Usuario`, migración a varias iglesias, arnés, integración, modelo de datos | RNF-01–20 |
| **Nataly** | B2, F2 | Catálogos, iglesias, patrimonio, índice, ranking, búsqueda; listado, ficha y reconocidas | RF-01–29 |
| **Genaro** | B3, F3 | Servicios, pláticas, padres, horarios, misas celebradas, agenda; sus consultas públicas | RF-30–59 |
| **Oscar (líder)** | B4, F4 | Diezmo y sus reportes, espacios y cotizaciones, diagrama de estados; reúne OpenAPI y Postman | RF-60–89 |

`usuarios` queda con Santiago, su dueño actual; Oscar conserva la redacción de «Quién usará el sistema». Cada quien aporta sus seeds, sus rutas en OpenAPI, sus pantallas y sus entradas de bitácora.

Dependencias: `Usuario` + `alcanceIglesia` ► todos · `Iglesia` ► servicios, misas, espacios · `MisaCelebrada` (Genaro) ► `Diezmo` (Oscar), a acordar antes de programar.

### 12.7 Calendario

Calendario sugerido por el caso; el docente ajusta las fechas.

| Fase | Semanas | Contenido | Entrega |
|---|---|---|---|
| **0. Análisis y arnés** | 1–2 | Requerimientos, reglas, preguntas al cliente; arnés v1, arquitectura, ADR, modelo de datos y API | Documento de requerimientos, diseño y arnés v1 |
| **1. Base y catálogos** | 3–4 | Migraciones, seeds, iglesias, listado por estado, roles; objetos, servicios, costos y pláticas | Iglesias por estado, login y catálogos |
| **2. Misas y procesos** | 5–6 | Padres, horario de misas, celebraciones, diezmos; solicitudes y cotizaciones | Misas, diezmos y solicitudes |
| **3. Consultas e interfaz** | 7 | Índice, ranking, reportes de diezmo, interfaz pública | Versión candidata |
| **4. Cierre** | 8 | Pruebas, documentación, portabilidad, reflexión, defensa | Entrega final |

La gestión interna se adapta a varias iglesias en la Fase 1 (`iglesiaId`, `alcanceIglesia`), sin desplazar lo que evalúa el caso.

### 12.8 Lineamientos del curso que se suman

- **Arquitectura:** `ARCHITECTURE.md` y reglas con dependency-cruiser en verde; índice como función pura.
- **Pruebas:** al menos una por regla de negocio, integración en endpoints principales y cobertura mínima de 70 % en dominio y servicios.
- **Rama principal** sin pruebas fallando; README que levante el sistema en menos de 10 minutos.
- **IA:** una sola herramienta (Claude Code), commits con `Asistido-por: Claude Code`, flujo plan → aprobación → paso pequeño → verificaciones → revisión; bitácora con ≥ 20 entradas y ≥ 5 errores.
- **Arnés compartido por el equipo:** `arnes-ia/`, con al menos 5 ADR y 5 plantillas, módulo de referencia, CHANGELOG y prueba de portabilidad; se publica también como repositorio aparte.

**Seeds mínimos:** 32 estados y sus municipios (INEGI) · localidades con iglesias · 40 iglesias en ≥ 3 estados y ≥ 8 municipios, con todos los tipos · 120 objetos (≥ 15 de 200 años o más, ≥ 5 de 300 o más) · bautizo, primera comunión, confirmación y matrimonio en cada iglesia · ≥ 2 tipos de plática por iglesia · 15 padres (≥ 3 en más de una iglesia) · al menos una misa cada día de la semana en cada iglesia · 4 semanas de celebraciones y diezmos en ≥ 6 iglesias · 12 solicitudes (≥ 1 por estado del flujo) · un usuario por rol. Nombres de personas siempre inventados; datos ficticios marcados.

**Entrega final:** requerimientos con trazabilidad · repositorio del proyecto · repositorio del arnés · OpenAPI y Postman · `docs/` con modelo de datos, diagrama de estados, arquitectura, ADR y bitácora · portabilidad (repositorio, video de máximo 5 minutos y nota) · reflexión de 1–2 páginas · defensa oral de 20 minutos.
