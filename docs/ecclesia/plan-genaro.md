# Plan de Genaro — Servicios, pláticas, misas y padres (Ecclesia)

**Dueño:** Genaro Aurelio Antonio Pacheco · **Requerimientos:** RF-30–52, RN-20–33, CA-10–17, P-10–19 de [requerimientos.md](../requerimientos.md) · **Alcance general:** `specs.md §12`

> Mismo formato que los planes de Santiago, Nataly y Oscar. Las fases son las del calendario sugerido del caso. «Funcionalidad» vale 25 puntos y nombra expresamente «las misas con su padre», así que **misas va primero** y servicios después.

## Cómo se ejecuta cada tarea

Una tarea a la vez: **plan → aprobación → paso pequeño → verificaciones → revisión con la checklist → commit y bitácora**. Los commits llevan `Asistido-por: Claude Code`.

```text
Lee AGENTS.md, docs/ecclesia/ARCHITECTURE.md, docs/ecclesia/plan-genaro.md y el módulo de referencia.
Tarea: E3-xx. Cubre solo los IDs que indica el plan, de docs/requerimientos.md.
Usa la plantilla arnes-ia/core/prompts/<nuevo-modulo|nuevo-endpoint|migracion|pruebas>.md.
Primero muéstrame un plan: archivos a crear o modificar, validaciones y pruebas.
No escribas código hasta que apruebe el plan. Si falta una respuesta del cliente, usa el supuesto de este plan y márcalo.
```

## Supuestos mientras el cliente responde P-10–P-19

Cada supuesto se lleva a la sesión con el docente (E3-01). Si la respuesta es distinta, se ajusta la tarea que lo usa.

| Pregunta | Supuesto | Lo usa |
|---|---|---|
| P-10 | La lista de servicios es abierta: cada iglesia escribe los suyos. Bautizo, primera comunión, confirmación y casamiento se siembran en todas las iglesias (lo pide el seed), pero no son obligatorios. | E3-11 |
| P-11 | El costo es un monto único (`Decimal(12,2)`, en la `moneda` de la iglesia), `GRATUITO` o `DONATIVO`. El donativo puede llevar un monto sugerido opcional. | E3-11 |
| P-12 | Un servicio tiene cero o más horarios fijos semanales (día y hora) y la marca «requiere cita». Si requiere cita y no tiene horarios, se muestra «con cita». | E3-11 |
| P-13 | El cupo es informativo, sin inscripciones. La plática tiene días y hora semanales, sin ciclos. Solo los cuatro tipos de RN-24. | E3-13 |
| P-14 | «Quién la da» es texto libre; opcionalmente se enlaza a un padre de la iglesia. | E3-13 |
| P-15 | Hay choque si los intervalos `[inicio, inicio + duración)` se empalman en el **mismo momento real** (UTC), usando la zona horaria de cada iglesia. Misas seguidas (una termina cuando empieza la otra) no chocan. No se exige tiempo de traslado. | E3-04, E3-07 |
| P-16 | Una misa especial puede estar en el horario semanal como cualquier otra (por ejemplo, la misa de sanación de los jueves). Una especial de una sola fecha se registra como misa celebrada. | E3-07, E3-09 |
| P-17 | Lo registra el administrador de la iglesia, solo cuando la misa ya empezó (no a futuro). Hay una celebración por misa del horario y día. El sustituto debe estar asociado a la iglesia y no puede tener otra misa del horario empalmada (RN-26). | E3-09 |
| P-18 | La agenda la ve solo el personal (Coordinación e iglesias del padre). Se arma con el horario normal; las iglesias cerradas salen de la agenda. | E3-08 |
| P-19 | Del padre se guardan nombre y título (Pbro., Fr., Mons.…); el público ve solo «título + nombre». La Coordinación crea y edita los datos del padre. El administrador de una iglesia lo asocia o desasocia de **su** iglesia, y solo crea un padre si no existe. Los idiomas son una lista fija: español y las lenguas indígenas más habladas (náhuatl, maya, tseltal, tsotsil, mixteco, zapoteco, otomí, totonaco, mazateco, chol) más «otra». | E3-05, E3-06 |

## Tareas

### Fase 0 · Análisis y diseño

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E3-01 | Llevar P-10–P-19 (con los supuestos de arriba) a la sesión con el docente y anotar las respuestas en la sección 8 | Sección 8 | Sesión con el docente | Pendiente |
| E3-02 | Definir en `docs/modelo-datos.md`: `PadreIglesia`, `HorarioMisa`, `SustitucionMisa`, ampliar `Padre` y `MisaCelebrada`; `Servicio`, `HorarioServicio` y `Platica` | RN-20–33 | Santiago integra el modelo | Hecha (en revisión): misas en E3-05; servicios y pláticas en E3-11 y E3-13 |
| E3-03 | Diseñar las rutas (`docs/ecclesia/api-misas-servicios.md`) y agregarlas a `openapi.yaml` y a Postman | RF-30–52 | E3-02 | Pendiente |

### Fase 2 · Misas y padres (prioridad)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E3-04 | Dominio puro `misas/dominio/solapes.ts`: intervalo de una misa (hora local → UTC con `instanteLocal` de E1-04), duración por defecto de 60 min y detección de choques; el «ahora» llega como parámetro | RN-26, RN-27, RN-31, P-15 | E1-04 (hecha) | Hecha (en revisión) |
| E3-05 | Migración: `Padre` + título; `PadreIglesia` (padre ↔ iglesia); `HorarioMisa` (día, hora local, tipo, idioma, duración, padre); `MisaCelebrada` + `horarioMisaId` y `padreProgramadoId`; `SustitucionMisa` inmutable. Sin romper el diezmo de Oscar | RF-40–43, RF-46, RN-20, RN-21, RN-28–30 | E3-02, revisión de Santiago y Oscar | Hecha (en revisión de Santiago y Oscar) |
| E3-06 | Padres: la Coordinación crea y edita; la iglesia asocia y desasocia los suyos; listar padres de una iglesia | RF-40, RF-41, RN-28, RN-32 | E3-05 | Hecha (en revisión) |
| E3-07 | Horario semanal: crear, cambiar y dar de baja misas con su padre; rechaza el choque (409) e indica la iglesia, el día y la hora de la misa con la que choca | RF-42, RF-43, RF-45, RF-46, RN-26, CA-12–14 | E3-04, E3-06 | Hecha (en revisión) |
| E3-08 | Agenda semanal de un padre: sus misas de todas las iglesias, en la hora local de cada una | RF-47, CA-17, P-18 | E3-07 | Hecha (en revisión) |
| E3-09 | Misa celebrada a partir del horario y sustitución con motivo; la sustitución guarda quién cambió, programado, real, motivo y fecha, y no se edita | RF-48–51, RN-29, RN-30, CA-15, P-17 | E3-07 | Hecha (en revisión) |
| E3-10 | Consulta pública del horario de misas con su padre, en la hora local de la iglesia; función del `service` para la ficha de Nataly (E2-11) | RF-44, RF-52, RN-31, RN-33, CA-12, CA-16 | E3-07 | Hecha (en revisión) |

### Fase 1 · Servicios y pláticas

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E3-11 | Migración y CRUD de servicios con costo, gratuito o donativo, requisitos, duración, cita y horarios | RF-30–34, RN-22, RN-23, CA-10 | E3-02 | Hecha (en revisión) |
| E3-12 | Consulta pública de servicios de una iglesia, con función del `service` para la ficha | RF-35, RN-33 | E3-11 | Hecha (en revisión) |
| E3-13 | Migración y CRUD de pláticas: tipo, días y hora, sesiones, costo exacto, cupo, lugar y quién la da | RF-36, RF-37, RN-24, RN-25, CA-11 | E3-02 | Hecha (en revisión) |
| E3-14 | Consulta pública de pláticas y «¿cuándo son las pláticas de bautizo?» (filtro por tipo) | RF-38, RF-39, CA-11 | E3-13 | Hecha (en revisión) |

### Interfaz (Angular)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E3-15 | Panel de la iglesia: padres, horario semanal (con el aviso del choque), misas celebradas y sustituciones | RF-40–51 | E3-06 a E3-09 | Hecha (en revisión) |
| E3-16 | Agenda semanal del padre (Coordinación y personal) | RF-47 | E3-08 | Hecha (en revisión) |
| E3-17 | Panel de la iglesia: servicios y pláticas | RF-30–37 | E3-11, E3-13 | Hecha (en revisión) |
| E3-18 | Ficha pública: servicios, pláticas (con filtro por tipo) y horario de misas con su padre, junto con Nataly | RF-35, RF-38, RF-39, RF-44 | E3-10, E3-12, E3-14, E2-11 | Hecha (en revisión) |

### Datos de prueba y cierre

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E3-19 | `seed-misas-servicios.ts`: bautizo, primera comunión, confirmación y matrimonio en cada iglesia; ≥ 2 tipos de plática por iglesia; 15 padres (≥ 3 en más de una iglesia); al menos una misa cada día de la semana en cada iglesia, sin choques. Con Oscar: 4 semanas de misas celebradas con diezmo en ≥ 6 iglesias | Seeds mínimos de `specs.md §12.8` | E3-05, E3-11, E3-13 | Hecha (en revisión): horario, servicios, pláticas y 15 padres. Las 4 semanas de misas con diezmo siguen siendo las del seed de Oscar, sin enlazar al horario |
| E3-20 | Pruebas: al menos una por regla RN-20–33, integración de los endpoints principales y cobertura ≥ 70 % en dominio y servicios de mis módulos | `specs.md §12.8` | Todas | Pendiente |
| E3-21 | Bitácora (`docs/bitacora-ia.md`) con mis entradas y errores de la IA; matriz de trazabilidad de RF-30–52 | Sección 9 | Todas | Pendiente |

## Lo que necesito de otros

| Quién | Qué | Para |
|---|---|---|
| Santiago | Revisar la migración (E3-05, E3-11, E3-13) y que use `alcanceIglesia` e `iglesiaDe` como el resto | E3-05 |
| Oscar | Confirmar que `MisaCelebrada` ampliada sigue sirviendo al diezmo (E4-12/E4-13) y repartir el seed de 4 semanas | E3-05, E3-19 |
| Nataly | Las funciones del `service` que usa la ficha pública (E2-11) | E3-10, E3-12, E3-14 |

## Entregables de equipo que siguen pendientes (no son solo míos)

Colección de Postman, `docs/reflexion-final.md`, prueba de portabilidad (repositorio, video y nota), arnés aparte con guía y CHANGELOG, cobertura ≥ 70 % medida en todo el proyecto y la defensa oral.
