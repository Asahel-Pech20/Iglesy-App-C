# Prompts de Claude Code por integrante

Prompts listos para pegar en Claude Code (terminal) al trabajar en Ecclesia. Cada uno sigue el flujo del caso: **plan → aprobación → paso pequeño → verificaciones → revisión → commit y bitácora**.

## Identificadores

`<INTEGRANTE>-<nn>`, numerados en el orden en que se escribieron:

| Prefijo | Integrante | Carpeta |
|---|---|---|
| `OSC` | Oscar Michel Matos May | [Oscar/](Oscar/) |
| `GEN` | Genaro Aurelio Antonio Pacheco | [Genaro/](Genaro/) |
| `SAN` | Santiago Asahel Pech Ake | [Santiago/](Santiago/) |
| `NAT` | Nataly Marisol Santos Miam | [Nataly/](Nataly/) |

Cita el ID en la entrada de `docs/bitacora-ia.md` (columna «Prompt») cuando uses uno.

## Índice

| ID | Integrante | Tarea | Estado |
|---|---|---|---|
| [OSC-01](Oscar/OSC-01-requerimientos-2.2-y-2.3.md) | Oscar | Requerimientos de las secciones 2.2 (Genaro) y 2.3 (Oscar) | Usado |
| [OSC-02](Oscar/OSC-02-E4-06-dominio-espacios.md) | Oscar | E4-06: reglas puras de la solicitud de espacio | Usado (commit `54ea064`) |
| [OSC-03](Oscar/OSC-03-E4-06-correccion-y-E4-14a-dominio-diezmo.md) | Oscar | Corrección de E4-06 y E4-14a: reglas puras del diezmo | Paso 2 hecho (commit `3268c9a`); paso 1 pendiente |
| [OSC-04](Oscar/OSC-04-iglesia-cerrada-misas-diezmo.md) | Oscar | Una iglesia cerrada no acepta misas ni diezmo | Pendiente |
| [OSC-05](Oscar/OSC-05-criptas-minimo-viernes.md) | Oscar | Criptas y otros espacios: lo mínimo para el viernes | Pendiente |
| [GEN-01](Genaro/GEN-01-E3-01-plan-y-dominio-misas.md) | Genaro | Plan de Genaro y E3-01: choques de horario de misas | Pendiente |
| [GEN-02](Genaro/GEN-02-horario-misas-y-platicas-minimo.md) | Genaro (lo ejecuta Oscar) | Horario de misas y pláticas: lo mínimo para el viernes | Pendiente; reemplaza a GEN-01 si no hubo avance |
| [SAN-01](Santiago/SAN-01-E1-01-base-ecclesia.md) | Santiago | E1-01: base mínima (iglesia, roles, alcanceIglesia) | Enviado; E1-01 está en `feat/E1-01-base-fusion` |

Nataly todavía no tiene prompts aquí.

## Cómo agregar uno

1. Guárdalo en la carpeta del integrante como `<ID>-<tarea>.md`, con el siguiente número libre.
2. Copia el encabezado de los existentes: integrante, tarea, IDs que cubre, estado y notas antes de usar.
3. Agrégalo al índice y actualiza su estado cuando se use.
