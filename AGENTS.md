# AGENTS.md — Reglas de diseño, convenciones y restricciones

> Reglas obligatorias para **todas las personas y agentes de IA** que trabajen en AppIglesia.
> Qué se construye y con qué → [specs.md](specs.md). Memoria del proyecto → [CLAUDE.md](CLAUDE.md).
> Si una regla de este archivo contradice el código, **gana esta regla**; si se quiere cambiar, se cambia aquí primero (PR revisado por el equipo).

---

## 1. Reglas de oro (no negociables)

1. **El contrato manda.** Endpoints, nombres de campos, enums y formato de respuesta son los de `specs.md §6–§7`. Cambiarlos requiere actualizar `specs.md` en el mismo PR y avisar a los dueños afectados.
2. **Autorización en el backend siempre.** Ocultar un botón en el frontend no es seguridad. Cada ruta declara su permiso con `autorizar('modulo:accion')`.
3. **Nada se borra físicamente** salvo anuncios y horarios. Usuarios, miembros y ministerios se desactivan; donaciones se **anulan** con motivo.
4. **La información financiera** (donaciones, ingresos del dashboard, reporte de ingresos) solo se envía a roles con `donaciones:leer`. Si no hay permiso, el campo **se omite** de la respuesta (no `null`, no `0`).
5. **Nunca** devolver `passwordHash`, tokens ni hashes de tokens en ninguna respuesta ni log.
6. **Sin secretos en git.** Solo `.env.example`. Los `.env` están en `.gitignore`.
7. **Cada módulo tiene un dueño** (ver `specs.md §9`). Para modificar un módulo ajeno: abrir issue o avisar al dueño y pedirle revisión del PR.
8. **No agregar dependencias** nuevas sin acuerdo del equipo (comentarlo en el PR con justificación).

---

## 2. Idioma y nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Dominio (entidades, campos, rutas, archivos de módulo) | Español, sin acentos ni ñ | `Miembro`, `fechaIngreso`, `/ministerios`, `anio` |
| Términos técnicos genéricos | Inglés aceptado | `service`, `controller`, `hooks`, `utils` |
| Variables / funciones | `camelCase` | `obtenerMiembros()` |
| Tipos / componentes / modelos | `PascalCase` | `MiembroForm`, `EventoResponsable` |
| Enums (valores) | `UPPER_SNAKE_CASE` | `DONACION_ESPECIAL` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_LIMIT` |
| Archivos backend | `<modulo>.<capa>.ts` | `miembros.service.ts` |
| Archivos Angular | `kebab-case` con sufijo de tipo | `miembros.page.ts`, `miembros.service.ts`, `usuario-form.dialogo.ts` |
| Tablas BD | Modelo Prisma `PascalCase`, `@@map` a `snake_case` plural | `Miembro` → `miembros` |
| Textos de UI y mensajes de error | Español neutro, con acentos | "El correo ya está registrado." |
| Comentarios de código | Español, breves, solo cuando aportan | |

---

## 3. Reglas de backend

### Arquitectura
- Flujo: `routes → middlewares (auth, autorizar, validar) → controller → service → Prisma`.
- **Controller**: solo lee `req`, llama al service y responde. Sin lógica de negocio, sin Prisma.
- **Service**: toda la lógica y el acceso a datos. Lanza errores de dominio (`AppError`) con `code` de `specs.md §7.1`.
- Un módulo que necesita datos de otro **llama al service del dueño** (ej. `reportes` usa `asistenciaService.resumenPorPeriodo`), no reescribe la consulta.
- Errores: siempre por el middleware `errores.ts`. Prohibido `res.status(500).send(err)`.

### Validación
- Todo `body`, `params` y `query` pasa por un esquema Zod (`<modulo>.schemas.ts`) con el middleware `validar`.
- Strings con `.trim()`; emails en minúsculas; montos `> 0` con máximo 2 decimales; fechas ISO.
- Rechazar campos desconocidos (`.strict()`) en creación/edición.

### Base de datos
- **Un solo `schema.prisma`** compartido. Lo crea B1 en Fase 0 a partir de `specs.md §6`. Cualquier cambio: PR propio con la migración, revisado por B1 y el dueño del modelo.
- Nombre de migraciones: `YYYYMMDDHHMM_descripcion_corta` (lo genera Prisma con `--name descripcion_corta`).
- Nunca editar una migración ya fusionada en `main`; crear una nueva.
- Operaciones de varias escrituras (ej. asistencia masiva, vincular miembros) dentro de `prisma.$transaction`.
- Dinero: `Prisma.Decimal` en backend y **string** en JSON (`"1500.00"`). Nunca `number` flotante para sumas.
- Listados siempre paginados (default 20, máx. 100) y con `select` explícito.

### Seguridad
- JWT access en header; refresh en cookie `httpOnly; Secure (prod); SameSite=Strict; Path=/api/v1/auth`.
- Refresh tokens rotan en cada uso; se guardan hasheados; logout los revoca.
- Reset de contraseña: token aleatorio de 32 bytes, guardado hasheado, expira en 1 h, un solo uso. `forgot-password` responde 204 exista o no el correo.
- Contraseña mínima: 8 caracteres, al menos una letra y un número.
- Subida de archivos: validar MIME y tamaño, renombrar con UUID, nunca usar el nombre original como ruta.
- Usuario desactivado ⇒ no puede iniciar sesión y sus refresh tokens se revocan.
- Un ADMIN no puede desactivarse a sí mismo ni quitar el último ADMIN activo.

### Pruebas
- Cada endpoint: al menos 1 caso feliz, 1 de validación (400) y 1 de permisos (401/403).
- Reglas de negocio críticas (anonimato de donaciones, asistencia en evento cancelado, último admin) con prueba dedicada.
- Las pruebas usan la BD `postgres-test`; nunca la de desarrollo.

---

## 4. Reglas de frontend

### Arquitectura
- Una carpeta por módulo en `src/app/features/<modulo>/` con `<modulo>.service.ts` (llamadas al API), páginas `*.page.ts` y diálogos/componentes.
- Las páginas **no** usan HttpClient directamente: usan el servicio del módulo (`MiembrosService`) y `rxResource` para las lecturas.
- Query keys: `['<modulo>', 'lista', filtros]`, `['<modulo>', 'detalle', id]`. Invalidar el módulo tras cada mutación.
- Tipos del contrato en `src/types/` (espejo exacto de `specs.md`). Prohibido `any`; usar `unknown` y estrechar.
- Formularios: Reactive Forms con los validadores de `core/validadores.ts`; mismas reglas que el esquema backend.
- Permisos: `SesionService.puede('donaciones:leer')` y la directiva `*appPuede="'...'"`. Las rutas protegidas usan `canActivate: [rutaProtegida]` con `data: { permiso }`.
- Usar **solo** los componentes compartidos de `components/comunes` y `components/ui` (los mantiene F1). Si falta uno genérico, se pide a F1 o se agrega con su revisión.

### Diseño visual
**Tokens** (definidos en `tailwind.config` / variables CSS por F1; no usar colores sueltos):

| Token | Uso | Valor claro | Valor oscuro |
|---|---|---|---|
| `--primario` | Botones principales, enlaces, menú activo | `#1E3A8A` (azul profundo) | `#93C5FD` |
| `--acento` | Detalles, badges destacados | `#B45309` (dorado/ámbar) | `#FBBF24` |
| `--fondo` | Fondo de página | `#F8FAFC` | `#0F172A` |
| `--superficie` | Tarjetas, modales | `#FFFFFF` | `#1E293B` |
| `--texto` | Texto principal | `#0F172A` | `#F1F5F9` |
| `--texto-suave` | Texto secundario | `#475569` | `#94A3B8` |
| `--exito` / `--alerta` / `--peligro` | Estados | `#15803D` / `#B45309` / `#B91C1C` | `#4ADE80` / `#FBBF24` / `#F87171` |

- Tipografía: **Inter** (fallback `system-ui`). Escala: 12 / 14 (base) / 16 / 20 / 24 / 30 px.
- Espaciado en múltiplos de 4 px. Bordes redondeados `rounded-lg` (8 px). Sombras suaves (`shadow-sm`).
- Íconos: solo `lucide-react`, 16–20 px.
- Modo oscuro soportado vía clase `dark` (respeta preferencia del sistema).

### Layout
- Escritorio: barra lateral fija (240 px) con menú filtrado por permisos + barra superior (nombre/logo de la iglesia, usuario, cerrar sesión).
- Móvil (< 768 px): menú en `Sheet` desplegable; tablas se convierten en tarjetas o tienen scroll horizontal dentro de su contenedor (nunca la página).
- Toda página: `PageHeader` (título + acciones) → filtros → contenido.
- Estados obligatorios en cada vista de datos: **cargando** (skeleton), **vacío** (`EmptyState` con acción), **error** (mensaje + reintentar).

### UX
- Acciones destructivas o irreversibles (desactivar, cancelar evento, anular donación, eliminar anuncio) piden confirmación con `ConfirmDialog`; las que exigen motivo lo piden en el mismo diálogo.
- Feedback con toast tras cada mutación ("Miembro guardado").
- Búsquedas con debounce de 300 ms. Filtros reflejados en la URL (`?q=&estado=`).
- Formatos (helpers en `lib/formato.ts`): fecha `dd/MM/yyyy`, fecha-hora `dd/MM/yyyy HH:mm`, moneda `Intl.NumberFormat('es-MX', { style: 'currency', currency })` con la moneda de la configuración.
- Botones de envío deshabilitados mientras la mutación está en curso.

### Accesibilidad (WCAG 2.1 AA)
- Contraste mínimo 4.5:1. Todo input con `<label>`. Errores asociados con `aria-describedby`.
- Navegable con teclado; foco visible; modales atrapan el foco (Angular CDK ya lo hace).
- Gráficas con resumen en texto o tabla alternativa.

### Pruebas
- Cada formulario: prueba de validación y envío. Cada página de listado: render con datos mock y estado vacío (`src/app/prueba/entorno.ts`).

---

## 5. Flujo de trabajo con Git

- Rama principal `main` protegida; rama de integración `develop`.
- Ramas: `feat/<subseccion>-<id-tarea>-<descripcion>` → ej. `feat/B2-03-buscar-miembros`. Correcciones: `fix/...`.
- Commits con **Conventional Commits** en español: `feat(miembros): agrega filtro por estado`.
- PR hacia `develop` con: descripción, IDs de tarea y RF, capturas (si es UI), checklist de criterios de aceptación.
- Mínimo **1 revisión aprobada** de otro integrante. CI en verde (lint, typecheck, tests).
- PRs pequeños (idealmente < 400 líneas). Al terminar una tarea, marcar su checkbox en el `tasks-*.md` correspondiente dentro del mismo PR.
- `develop` → `main` al cierre de cada fase.

---

## 6. Definición de "Terminado" (DoD)

Una tarea está terminada cuando:
- [ ] Cumple todos sus criterios de aceptación.
- [ ] Respeta el contrato de `specs.md` (o lo actualiza en el mismo PR).
- [ ] Tiene pruebas según §3 / §4 y pasan.
- [ ] Lint y typecheck sin errores ni `// @ts-ignore` nuevos.
- [ ] Permisos verificados con al menos un rol sin acceso.
- [ ] Textos en español, sin `console.log` olvidados.
- [ ] Documentación OpenAPI actualizada (backend) / ruta agregada al menú con su permiso (frontend).
- [ ] PR revisado y fusionado en `develop`.

---

## 7. Restricciones para agentes de IA

- Leer `CLAUDE.md`, este archivo y la sección relevante de `specs.md` **antes** de generar código.
- En un equipo nuevo, ejecutar `node scripts/verificar-equipo.mjs` y seguir [docs/requisitos.md](docs/requisitos.md) antes de recomendar o instalar programas. Si algo no es viable por las especificaciones de la laptop, decirlo directamente y ofrecer la alternativa de esa guía.
- No instalar programas ni cambiar configuración del sistema (WSL, BIOS, servicios) sin permiso de la persona.
- Trabajar solo dentro del módulo de la tarea asignada; si se requiere tocar otro módulo, detenerse y señalarlo.
- No inventar endpoints, campos ni enums fuera del contrato.
- No ejecutar `prisma migrate reset`, `DROP`, ni borrar datos en la BD de desarrollo sin confirmación humana.
- No hacer `git push`, merges ni cambios en `main`/`develop` sin instrucción explícita.
- No desactivar validaciones, reglas de lint ni pruebas para "hacer pasar" el código.
- Al terminar: listar archivos cambiados, pruebas ejecutadas y criterios de aceptación cubiertos.
