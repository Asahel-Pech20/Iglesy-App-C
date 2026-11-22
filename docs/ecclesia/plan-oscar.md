# Plan de Oscar — Diezmo y espacios (Ecclesia)

**Dueño:** Oscar Michel Matos May · **Requerimientos:** RF-60–87, RN-40–54, CA-20–29, sección 7 de [requerimientos.md](../requerimientos.md) · **Alcance general:** `specs.md §12`

> Propuesta para trabajar por tareas pequeñas. Las fases son las del calendario sugerido del caso; el docente ajusta las fechas. `usuarios` y `alcanceIglesia` son de Santiago (`specs.md §12.6`).

## Cómo se ejecuta cada tarea

Una tarea a la vez, con el flujo del caso: **plan → aprobación → paso pequeño → verificaciones → revisión con la checklist → commit y bitácora**. Si la IA repite un error, se mejora el arnés.

Instrucción base (cambia el ID y las plantillas según la tarea):

```text
Lee AGENTS.md, docs/ecclesia/ARCHITECTURE.md, docs/ecclesia/plan-oscar.md y el módulo de referencia.
Tarea: E4-xx. Cubre solo los IDs que indica el plan, de docs/requerimientos.md.
Usa la plantilla arnes-ia/core/prompts/<nuevo-modulo|nuevo-endpoint|migracion|pruebas>.md.
Primero muéstrame un plan: archivos a crear o modificar, validaciones y pruebas.
No escribas código hasta que apruebe el plan. Si falta una respuesta del cliente, detente y pregunta.
```

## Tareas

### Fase 0 · Análisis y diseño (Entrega 1)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E4-01 | Llevar P-21–P-29 a la sesión con el docente y anotar las respuestas | Sección 8 | Sesión con el docente | Pendiente |
| E4-02 | Ajustar requerimientos y diagrama de estados con esas respuestas | Secciones 2.3 y 7 | E4-01 | Pendiente |
| E4-03 | Definir `Diezmo`, `DiezmoCorreccion`, `TipoEspacio`, `SolicitudEspacio` y `Cotizacion` para `docs/modelo-datos.md` | RN-40–54 | Santiago integra el modelo | Pendiente |
| E4-04 | Diseñar las rutas de diezmo y espacios | RF-60–82 | E4-03 | Pendiente |
| E4-05 | Reunir el diseño de la API de todos en OpenAPI y Postman | `specs.md §12.6` | Rutas de cada integrante | Pendiente |

### Fase 2 · Espacios (Entrega 3)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E4-06 | Dominio puro: transiciones de la solicitud y vigencia de la cotización, con el «ahora» como parámetro | Sección 7, RN-51, RN-52 | E4-02 | Pendiente |
| E4-07 | Migración de los modelos de espacios | RN-47, RN-49 | Revisión de Santiago, `Iglesia` | Pendiente |
| E4-08 | Tipos de espacio: administrar y consultar en público, sin precios | RF-70, RF-71, RN-47, RN-48, CA-26 | E4-07, ficha de Nataly | Pendiente |
| E4-09 | Solicitud pública: crear, folio y clave con hash, consulta y límite de intentos | RF-72–74, RN-49, RNF-14, CA-26 | E4-07 | Pendiente |
| E4-10 | Panel: ver solicitudes, avisar que no hay lugar y cotizar | RF-75–77, RN-50, RN-53, CA-27, CA-28 | E4-06, `alcanceIglesia` | Pendiente |
| E4-11 | Respuesta de la persona: aceptar, rechazar, cancelar y vencimiento | RF-78–80, RN-51, RN-52, CA-28, CA-29 | E4-06, E4-09, E4-10 | Pendiente |

### Fase 2 · Diezmo (Entrega 3)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E4-12 | Acordar con Genaro qué expone `MisaCelebrada` (ID, iglesia, fecha, hora, horario, padre que ofició) | RF-48, RF-60, P-17, P-22 | Genaro | Pendiente |
| E4-13 | Migración de los modelos de diezmo, con una captura única por misa | RN-41, RNF-06 | E4-12, revisión de Santiago | Pendiente |
| E4-14 | Captura: solo misa celebrada de su iglesia y una sola vez | RF-60, RF-61, RN-40, RN-41, CA-20, CA-21 | E4-13, `alcanceIglesia` | Pendiente |
| E4-15 | Corrección en transacción con historial de solo inserción | RF-62, RF-63, RN-42, RN-43, CA-22 | E4-14 | Pendiente |

### Fase 3 · Reportes e interfaz (Entrega 4)

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E4-16 | Reportes: total, promedio y extremos, con sumas en SQL | RF-64, RF-65, RN-44, RN-45, CA-23 | E4-14, P-23 | Pendiente |
| E4-17 | Agrupar por día, semana, mes, horario y padre | RF-66–68, CA-24 | E4-16 | Pendiente |
| E4-18 | Permisos de reportes y datos privados, con pruebas de otra iglesia y sin sesión | RF-69, RF-82, RN-46, RN-53, RN-54, CA-25 | E4-16, P-21, Santiago | Pendiente |
| E4-19 | Pantallas públicas: tipos en la ficha, solicitud y seguimiento, a 360 px | RF-71–74, RF-78, RF-80 | E4-09, E4-11 | Pendiente |
| E4-20 | Panel: solicitudes y cotización; captura, corrección e historial de diezmo; reportes | RF-60–69, RF-75–77 | Tareas de backend | Pendiente |

### Fase 3 y 4 · Cierre

| ID | Tarea | Cubre | Depende de | Estado |
|---|---|---|---|---|
| E4-21 | Seeds: 12 solicitudes, al menos una por estado; 4 semanas de diezmos en al menos 6 iglesias | Datos de prueba | Seeds de iglesias y misas | Pendiente |
| E4-22 | Adaptar donaciones, dashboard y reportes a varias iglesias | `specs.md §12.2`, P-20 | P-20, migración de Santiago | Pendiente |
| E4-23 | Completar en la matriz las filas de RF-60–87 con su código y prueba | Sección 9 | Tareas anteriores | Pendiente |
| E4-24 | Cobertura mínima de 70 % en dominio y servicios de estos módulos | RNF-18 | Tareas anteriores | Pendiente |

### Si alcanza el tiempo

| ID | Tarea | Cubre | Valor |
|---|---|---|---|
| E4-25 | Exportar reportes de diezmo a PDF o CSV, reutilizando `lib/exportadores` (hoy PDF y Excel) | Puntos extra | 1 punto |
| E4-26 | Aviso por correo al emitir una cotización, si P-25 lo permite | Puntos extra | 1 punto |
| E4-27 | Comparar el diezmo entre iglesias, solo Coordinación | RF-85 | 1 punto |
| E4-28 | Inventario de criptas | RF-86 | 1 punto |

RF-83 (Genaro o Nataly) y RF-84 (Genaro) quedan como deseables por asignar: dependen de sus módulos.

## Dependencias con el equipo

| Con | Qué necesito | Para |
|---|---|---|
| Santiago | `Iglesia`, roles, `alcanceIglesia`, `usuarios`, login y revisión de migraciones | Todo el panel |
| Genaro | `MisaCelebrada`, `HorarioMisa` y padre que ofició, por su `service` | E4-13 a E4-17 |
| Nataly | Lugar para los tipos de espacio en la ficha de la iglesia (RF-06) | E4-08, E4-19 |

Para no bloquearse: espacios solo depende de la base, así que puede avanzar antes que diezmo.

## Decisiones técnicas por confirmar en el plan de cada tarea

- **Vencimiento:** propongo calcularlo al consultar o responder con el «ahora» como parámetro, sin tarea programada ni dependencias nuevas, como se hizo con los eventos en B3. Requiere revisar que los reportes vean el mismo estado.
- **Dinero:** `Decimal(12,2)` y `SUM` en SQL; nunca `number`. El redondeo del promedio queda sujeto a P-23.
- **Folio y clave:** el formato de ADR-0004, con el alcance del folio sujeto a P-25.
- **Reutilizable de AppIglesia:** exportadores, paginación, errores y auth. `Donacion` no se reutiliza para el diezmo (ADR-0006).

## Antes de programar

- [ ] Respuestas a P-17, P-21, P-22, P-23, P-26, P-27 y P-28
- [ ] `docs/modelo-datos.md` y diseño de la API aprobados
- [ ] `Iglesia` y `alcanceIglesia` disponibles, o acordados con Santiago
- [ ] PostgreSQL disponible en esta laptop (`docs/requisitos.md`)
