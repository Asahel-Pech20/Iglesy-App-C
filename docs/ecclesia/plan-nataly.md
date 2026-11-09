# Plan de Nataly: catálogos, iglesias, patrimonio e iglesias reconocidas (Ecclesia)

**Dueña:** Nataly Marisol Santos Miam · **Requerimientos:** RF-01–23, RN-01–16, CA-01–09, P-01–09 de [requerimientos.md](../requerimientos.md) · **Alcance general:** `specs.md §12` (propuesta de Oscar, rama `docs/ecclesia-expansion-specs`) · **Rutas:** [api-iglesias-patrimonio.md](api-iglesias-patrimonio.md)

> Propuesta para trabajar por tareas pequeñas, con el mismo formato que `plan-oscar.md` de Oscar (rama `docs/ecclesia-expansion-specs`). Las fases son las del calendario sugerido del caso; el docente ajusta las fechas. `Usuario`, roles, `alcanceIglesia` y las migraciones las revisa Santiago (`specs.md §12.6`).

## Cómo se ejecuta cada tarea

Una tarea a la vez, con el flujo del caso: **plan → aprobación → paso pequeño → verificaciones → revisión con la checklist → commit y bitácora**. Si la IA repite un error, se mejora el arnés.

```text
Lee AGENTS.md, docs/ecclesia/ARCHITECTURE.md, docs/ecclesia/plan-nataly.md y el módulo de referencia.
Tarea: E2-xx. Cubre solo los IDs que indica el plan, de docs/requerimientos.md.
Usa la plantilla arnes-ia/core/prompts/<nuevo-modulo|nuevo-endpoint|migracion|pruebas>.md.
Primero muéstrame un plan: archivos a crear o modificar, validaciones y pruebas.
No escribas código hasta que apruebe el plan. Si falta una respuesta del cliente, detente y pregunta.
```

## Tareas

### Fase 0 · Análisis y diseño (Entrega 1)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E2-01 | Llevar P-01–P-09 a la sesión con el docente y anotar las respuestas | Sección 8 | Sesión con el docente | Pendiente |
| E2-02 | Ajustar requerimientos con esas respuestas (en especial RN-15 con P-01) | Sección 2.1 | E2-01 | Pendiente |
| E2-03 | Definir `Estado`, `Municipio`, `Localidad`, la ampliación de `Iglesia`, `ObjetoPatrimonial` y `CriteriosIndice` para `docs/modelo-datos.md` | RN-07–RN-16 | Santiago integra el modelo | Propuesta abajo |
| E2-04 | Diseñar las rutas de catálogos, iglesias, patrimonio, índice, ranking y búsqueda | RF-01–RF-23 | E2-03 | Propuesta en [api-iglesias-patrimonio.md](api-iglesias-patrimonio.md) |

### Fase 1 · Base y catálogos (Entrega 2)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E2-05 | Migración y carga del catálogo del INEGI: 32 estados, sus municipios y las localidades donde haya iglesias | RF-09, RF-10, RN-09, RNF-05 | Revisión de Santiago | Pendiente |
| E2-06 | Ampliar `Iglesia` (ubicación, dirección, capacidad, año, contacto, coordenadas, cierre) sobre el módulo mínimo de Oscar | RF-07, RF-08, RF-11, RF-12, RN-07–RN-09, CA-09 | E2-05, `alcanceIglesia` | Pendiente |
| E2-07 | Lista pública por estado con filtros de municipio, localidad, tipo, nombre y capacidad | RF-01–RF-05, CA-02, CA-03 | E2-06, P-02, P-03 | Pendiente |
| E2-08 | Objetos: migración, registro, edición y cambio de estado (perdido, prestado, baja) | RF-13–RF-15, RF-17, RN-10, RN-11, RN-16 | E2-06, P-06, P-08 | Pendiente |
| E2-09 | Seeds: 40 iglesias en ≥ 3 estados y ≥ 8 municipios con todos los tipos; 120 objetos (≥ 15 de 200 años o más y ≥ 5 de 300 o más) | Datos de prueba | E2-05, E2-08 | Pendiente |

### Fase 3 · Índice, consultas e interfaz (Entrega 4)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E2-10 | Llevar `indice-patrimonial.ts` del módulo de referencia a `modules/iglesias/dominio/`, con los tipos de RN-16 y los criterios leídos de la BD; rutas para consultarlos y cambiarlos | RF-18, RF-22, RN-01–RN-06, RN-14, RN-15, CA-01, CA-05, CA-07 | E2-08, P-01 | Pendiente |
| E2-11 | Ficha pública: datos, objetos vigentes, índice y distinción, más servicios, pláticas, misas con su padre y tipos de espacio de los otros módulos | RF-06, RF-16, RF-18, CA-04 | E2-10, services de Genaro y Oscar, P-05 | Pendiente |
| E2-12 | Ranking del país, estado, municipio o ciudad | RF-19–RF-21, RN-12, RN-13, CA-06 | E2-10, P-07 | Pendiente |
| E2-13 | Búsqueda del investigador por tipo de objeto y antigüedad en un lugar | RF-23, CA-08 | E2-10, P-09 | Pendiente |
| E2-14 | Pantallas públicas en Angular, a 360 px: lista por estado, ficha, reconocidas y búsqueda | RF-01–RF-06, RF-16, RF-19–RF-23, RNF-02 | E2-07, E2-11–E2-13 | Pendiente |
| E2-15 | Panel en Angular: ampliar la pantalla de iglesias de Oscar; objetos y criterios del índice | RF-07–RF-15, RF-17, RF-22 | Tareas de backend | Pendiente |

### Fase 3 y 4 · Cierre

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E2-16 | Adaptar miembros y ministerios a varias iglesias (`iglesiaId`, `alcanceIglesia`) | `specs.md §12.2`, P-20 de Oscar | P-20, migración de Santiago | Pendiente |
| E2-17 | Completar en la matriz las filas de RF-01–23 con su código y prueba | Sección 9 | Tareas anteriores | Pendiente |
| E2-18 | Cobertura mínima de 70 % en dominio y servicios de estos módulos | RNF-18 | Tareas anteriores | Pendiente |

### Si alcanza el tiempo

| ID | Tarea | Cubre | Valor |
|---|---|---|---|
| E2-19 | Caché del ranking que se invalide al cambiar un objeto o un criterio | Puntos extra | 1 punto |
| E2-20 | Mapa de iglesias con Leaflet y OpenStreetMap usando las coordenadas (dependencia nueva: requiere acuerdo del equipo) | Puntos extra | 2 puntos |

## Modelo de datos propuesto (E2-03)

Borrador para que Santiago lo integre en `docs/modelo-datos.md`; se ajusta con las respuestas del cliente.

| Entidad | Campos | Reglas |
|---|---|---|
| `Estado` | `clave` (2 dígitos del INEGI, llave), `nombre` | Solo valores del catálogo (RNF-05) |
| `Municipio` | `clave` (5 dígitos: estado + municipio, llave), `estadoClave`, `nombre` | Pertenece a un estado |
| `Localidad` | `clave` (9 dígitos: estado + municipio + localidad, llave), `municipioClave`, `nombre` | Solo se cargan las que tienen iglesias (datos de prueba del caso) |
| `Iglesia` (amplía la de Oscar) | Se agregan `direccion`, `estadoClave`, `municipioClave`, `localidadClave`, `capacidad?`, `anioConstruccion?`, `telefono?`, `correo?`, `latitud?` y `longitud?` (`Decimal(9,6)`), `fechaCierre?`, `motivoCierre?` | RN-08 (enum `TipoIglesia`, ya existe) · RN-09 se valida en el service: el municipio es del estado y la localidad del municipio · `activa = false` al cerrar, sin borrar (RN-07, RNF-11) |
| `ObjetoPatrimonial` | `id`, `iglesiaId`, `descripcion` (qué es), `tipo`, `anio?`, `siglo?`, `material`, `estadoConservacion`, `ubicacionEnTemplo`, `catalogadoInah`, `estado` (`VIGENTE`, `PERDIDO`, `PRESTADO`, `BAJA`), `fechaEstado?`, `motivoEstado?` | `CHECK (anio IS NOT NULL OR siglo IS NOT NULL)` (RN-10) · nunca se borra (RN-11) |
| `CriteriosIndice` | `id`, `vigenteDesde`, `rangosEdad` (JSON), `multiplicadores` (JSON por grupo), `puntosInah`, `distinciones` (JSON), `creadoPorId` | Cada cambio crea una versión nueva y la última es la vigente; así queda el historial de los criterios de cada año (RF-22, RN-14) · el JSON se valida con Zod con la forma de `CriteriosIndice` del módulo de referencia |

**Tipo de objeto** (RN-16): `IMAGEN`, `RETABLO`, `PINTURA`, `MURAL`, `ORGANO`, `PIANO`, `ORFEBRERIA`, `MOBILIARIO_LITURGICO`, `DOCUMENTO`, `OTRO`. El dominio los agrupa en los cinco grupos del multiplicador; el módulo de referencia hoy recibe directamente el grupo, y E2-10 agrega esa traducción.

**Índice:** no se guarda; se calcula al consultar con los criterios vigentes y el año de cálculo (ADR-0005, RN-14).

## Dependencias con el equipo

| Con | Qué necesito | Para |
|---|---|---|
| Santiago | Revisión de migraciones, `alcanceIglesia`, roles y la integración del modelo de datos | E2-03, E2-05, E2-06, E2-08 |
| Oscar | El módulo mínimo de `Iglesia` (hoy en su rama `feat/E4-diezmo-completo`) y una función de su `service` con los tipos de espacio públicos de una iglesia | E2-06, E2-11 |
| Genaro | Funciones de sus `services` con los servicios, las pláticas y el horario de misas con su padre de una iglesia | E2-11 |

| Para | Lo que entrego | Tarea |
|---|---|---|
| Oscar (E4-08, E4-19) | Lugar para los tipos de espacio en la ficha de la iglesia (RF-06) | E2-11 |
| Genaro y Oscar | `iglesiasService.obtenerActiva(id)` para validar que la iglesia existe y no está cerrada | E2-06 |

## Decisiones técnicas por confirmar en el plan de cada tarea

- **Nombre repetido:** el módulo mínimo rechaza dos iglesias con el mismo nombre en todo el país, pero hay muchas «Parroquia de San Miguel» en distintos municipios. Propongo que el nombre sea único **por municipio**. Se acuerda con Oscar en E2-06.
- **Búsqueda por nombre sin acentos:** reutilizar el `translate(lower(...))` que ya usa B2 en miembros, sin extensiones nuevas (sujeto a P-02).
- **Ranking:** se cargan las iglesias activas del lugar con al menos un objeto, se calcula el índice en el dominio, se ordena y se pagina. Con los datos de prueba (40 iglesias) es suficiente; si crece, se agrega la caché de E2-19.
- **Año de cálculo:** el año en curso en la zona horaria de la iglesia, como dice ADR-0005, hasta que se responda P-01.
- **Catálogo del INEGI:** se carga desde el archivo oficial con un script (`db:catalogos`) y desde la ruta de importación de la Coordinación; sin dependencias nuevas.

## Antes de programar

- [ ] Respuestas a P-01–P-09
- [ ] `docs/modelo-datos.md` y diseño de la API aprobados
- [ ] Módulo mínimo de `Iglesia` y `alcanceIglesia` en la rama base (hoy están en la rama de Oscar)
- [ ] Archivo del catálogo del INEGI descargado y fuera del repositorio si es muy grande
