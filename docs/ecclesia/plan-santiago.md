# Plan de Santiago — Base multi-iglesia, roles, usuarios y arnés (Ecclesia)

**Dueño:** Santiago Asahel Pech Ake · **Requerimientos:** RNF-01–20, RF-81, RF-82, RF-87, RN-54 (alcance) · **Alcance general:** `specs.md §12` · **Mantiene:** B1, F1 (auth, usuarios, permisos, configuración, `schema.prisma`)

> Propuesta para trabajar por tareas pequeñas, con el mismo formato que [plan-oscar.md](plan-oscar.md). `Usuario` + `alcanceIglesia` desbloquean a todos (`specs.md §12.6`).
>
> **2026-11-08 — Base fusionada.** Se compararon dos bases: la E1-01 de Santiago (local) y la de Oscar (`feat/E4-diezmo-completo`), sobre la que ya funcionan el diezmo y las iglesias mínimas. Se conserva la de Oscar y se le agrega lo que solo tenía E1-01 (rama `feat/E1-01-base-fusion`): `CHECK` de iglesia según rol, `RESTRICT` al borrar una iglesia, la opción `coordinacion` con `SUPUESTOS_ALCANCE`, `iglesiaAlcanceDe`, `iglesiaDe` y sus pruebas.

## Cómo se ejecuta cada tarea

Una tarea a la vez: **plan → aprobación → paso pequeño → verificaciones → revisión con la checklist → commit y bitácora**.

```text
Lee AGENTS.md, CLAUDE.md, specs.md §12, docs/ecclesia/ARCHITECTURE.md, ADR-0003, ADR-0004, ADR-0006 y docs/ecclesia/plan-santiago.md.
Tarea: E1-xx. Cubre solo los IDs que indica el plan, de docs/requerimientos.md.
Usa la plantilla arnes-ia/core/prompts/<migracion|nuevo-endpoint|pruebas>.md.
Primero muéstrame un plan: archivos, migración, pruebas y riesgos. No escribas código hasta que lo apruebe.
```

## Supuestos vigentes (un solo lugar)

Mientras el cliente no responda, se trabaja con estos supuestos. **No son reglas del cliente.**

| Supuesto | Depende de | Dónde vive en el código |
|---|---|---|
| S-02: la Coordinación entra a los datos de cualquier iglesia (RF-07, RF-08); en datos privados (diezmo, solicitudes) se le **deniega**, que es lo que hace `alcanceIglesia` por omisión. | P-21, P-28 | `middlewares/alcanceIglesia.ts` (`SUPUESTOS_ALCANCE`) |
| S-03: los usuarios existentes de AppIglesia pasan a la iglesia inicial (la más antigua); el administrador crea personal en su iglesia y la Coordinación indica la iglesia. | P-20, P-28 | migraciones `ecclesia_iglesias_y_roles` y `e1_01_usuario_iglesia_segun_rol`, `usuarios.service.ts` |
| S-04: `configuracion:editar` de la Coordinación es un **marcador**: se conserva hasta que exista la edición de iglesias (Nataly) y entonces se quita y se adapta. Acordado con Oscar. | Módulo de iglesias | `config/permisos.ts` (back y front) |

## Tareas

### Fase 1 · Base y catálogos (Entrega 2)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E1-01 | Base mínima: `Iglesia`, `Usuario.iglesiaId` (null solo en la Coordinación, con `CHECK`), rol `COORDINACION`, middleware `alcanceIglesia`, iglesia inicial y un usuario por rol en el seed | RNF-10, RF-82, RN-54 (alcance) | — | Fusionada con la base de Oscar; en revisión |
| E1-02 | Frontend: rol `COORDINACION` en menú y permisos; iglesia del usuario en la sesión y en la barra superior | RF-87 | E1-01 | Pendiente |
| E1-03 | Usuarios por iglesia: la Coordinación crea usuarios y les asigna iglesia y rol; revisar la regla del último administrador | RF-81, RF-82 | E1-01, P-28 | Hecho en la base de Oscar (último administrador por iglesia); falta revisarlo |
| E1-04 | `lib/zona-horaria`: hora local de cada iglesia para guardar y mostrar (la usa Genaro en misas) | RNF-07 | E1-01 | Pendiente |
| E1-05 | Renombrar `ADMIN` → `ADMIN_IGLESIA` (migración, pruebas, seed, frontend, mocks) | §12.3 | E1-03 | Hecho en la base de Oscar |
| E1-06 | `Iglesia` reemplaza a `ConfiguracionIglesia`; `iglesiaId` en la gestión interna, con revisión de cada dueño | §12.2, ADR-0006 | E1-05, P-20, catálogo de Nataly | Pendiente |

### Fase 0 · Diseño (Entrega 1)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E1-07 | Integrar `docs/modelo-datos.md` con el diagrama entidad-relación de todos | §12.4 | Modelos de cada integrante | Pendiente |

### Fase 4 · Cierre

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E1-08 | dependency-cruiser en el CI sobre `backend/src` y bajar las 9 violaciones heredadas | RNF-19 | — | Pendiente |

## Lo que E1-01 deja a otros

- **Nataly:** el resto de los campos de `Iglesia` (dirección, catálogo INEGI, capacidad, año, contacto, coordenadas) y su edición. Hoy existen `id`, `nombre`, `tipo`, `zonaHoraria` y `activa`, y `GET`/`POST /iglesias` mínimos de Oscar. Cuando exista la edición, se retira el marcador S-04.
- **Genaro y Oscar:** usar `alcanceIglesia` (con `SUPUESTOS_ALCANCE.datosIglesia` donde la Coordinación deba entrar) e `iglesiaDe` en sus rutas (`backend/README.md`). Las rutas de diezmo y misas no cambian: la Coordinación sigue con 403.
