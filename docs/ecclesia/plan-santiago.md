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
| E1-08 | dependency-cruiser en el CI sobre `backend/src` y bajar las 9 violaciones heredadas | RNF-19 | — | CI hecho (`pnpm arquitectura`); quedan 8 heredadas, de otros dueños (ver abajo) |

## Lo que E1-01 deja a otros

- **Nataly:** el resto de los campos de `Iglesia` (dirección, catálogo INEGI, capacidad, año, contacto, coordenadas) y su edición. Hoy existen `id`, `nombre`, `tipo`, `zonaHoraria` y `activa`, y `GET`/`POST /iglesias` mínimos de Oscar. Cuando exista la edición, se retira el marcador S-04.
- **Genaro y Oscar:** usar `alcanceIglesia` (con `SUPUESTOS_ALCANCE.datosIglesia` donde la Coordinación deba entrar) e `iglesiaDe` en sus rutas (`backend/README.md`). Las rutas de diezmo y misas no cambian: la Coordinación sigue con 403.

## Violaciones de arquitectura heredadas (E1-08)

`pnpm arquitectura` corre dependency-cruiser sobre `backend/src` y **falla con cualquier violación nueva**. Las 8 heredadas de AppIglesia están en `backend/arquitectura-conocidas.json` y se ignoran hasta que su dueño las corrija; no se desactivó ninguna regla. Al corregir una, regenerar la lista con `pnpm arquitectura:conocidas` (solo debe **bajar**).

| Regla | Desde → hacia | Dueño | Arreglo sugerido |
|---|---|---|---|
| `modulos-solo-por-service` | `asistencia.service`, `dashboard.service`, `reportes.service` → `eventos/eventos.fechas.ts` (3) | Genaro (archivo); Oscar lo usa | Mover las funciones de fechas a `lib/dominio/` o exponerlas desde `eventos.service` |
| `sin-ciclos` | `asistencia.service` → `eventos.service`, `miembros.service`, `ministerios.service` (3) | Genaro, con Nataly | Romper el ciclo: que `asistencia` reciba lo que necesita o mover lo compartido a un archivo sin dependencias de vuelta |
| `sin-ciclos` | `lib/exportadores/excel.ts` y `pdf.ts` → `reporte.ts` (2) | Oscar | Sacar los tipos compartidos a un archivo que no importe a los exportadores |

Corregida en E1-08: `auth.service` importaba `usuarios.select.ts`; el archivo ahora es `usuarios.tipos.ts` (forma pública del usuario).

## Auditoría 2 (rama `fix/E1-auditoria2`)

| ID | Sev. | Estado |
|---|---|---|
| A2-E1-01 | Media | Hecho: `alcanceIglesia` responde 422 a POST, PUT, PATCH y DELETE en una iglesia cerrada; GET sigue permitido. Lo heredan misas y diezmo sin cambiar sus rutas, así que A2-E4-01 (Oscar) ya no hace falta. |
| A2-E1-02 | Media | Hecho: `errores.ts` traduce SQLSTATE 23514 a 422 `BUSINESS_RULE`, sin devolver la fila (puede traer datos personales). Cubre también A2-E2-01 de Nataly. |
| A2-E1-03 | Media | Hecho: la migración `e1_01_usuario_iglesia_segun_rol` ya no asigna la iglesia más antigua; se detiene y lista al personal sin iglesia. Las BD que ya la aplicaron siguen al día con `migrate deploy`; `migrate dev` puede avisar que el archivo cambió (los datos son de prueba). |
| A2-E1-04 | Baja | Hecho: las pruebas del `CHECK` y del `RESTRICT` exigen el nombre de la restricción. |
| A2-E1-05 | Baja | Hecho: `test/setup.ts` no vacía la BD en las pruebas de carpetas `dominio/` (funciones puras). Las de dominio pasaron de 14.5 s a 6.9 s. |
| A2-E1-06 | Info | S-04 se retira **después** de fusionar el PR #6: ahí vive `iglesias:editar`, y el PR toca las mismas líneas de `permisos.ts` (quitarlo antes le daría un conflicto a Nataly). Falta abrir el PR de `feat/E1-01-base-fusion`. |
