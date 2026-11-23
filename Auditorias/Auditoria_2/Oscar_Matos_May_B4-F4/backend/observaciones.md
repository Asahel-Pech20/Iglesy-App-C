# Auditoría 2 · E4 — Diezmo y espacios (Oscar)

> Lee solo este archivo y los que cita. Contexto general: [../../README.md](../../README.md).
> Rama: `feat/E4-diezmo-completo` (`66ce901`), incluida en las ramas de Santiago y Nataly.

## Resultado

- **Espacios (E4-06):** las reglas puras pasan sus 71 pruebas sin BD (comprobado el 2026-11-06), sin violaciones de dependencias, con el «ahora» como parámetro y los supuestos de P-26 y P-27 en un solo archivo.
- **Diezmo:** está hecho de punta a punta según `CLAUDE.md`. No se volvió a probar en esta auditoría.
- **Iglesias:** tu `GET` y `POST` siguen funcionando dentro de la ampliación de Nataly.

## Observaciones

| ID | Sev. | Dónde | Observación | Acción sugerida | Estado |
|---|---|---|---|---|---|
| A2-E4-01 | Media | `modules/misas/misas.service.ts:24`, `:52`; `modules/diezmo/diezmo.service.ts:83`, `:115`, `:163` | `zonaDe()` no revisa si la iglesia está activa: una iglesia cerrada sigue aceptando misas, capturas y correcciones de diezmo (RN-07). | Si Santiago no lo resuelve en `alcanceIglesia` (A2-E1-01), usar `iglesiasService.obtenerActiva()` en las escrituras. Prompt listo: [`Prompts/Oscar/OSC-04`](../../../../Prompts/Oscar/OSC-04-iglesia-cerrada-misas-diezmo.md). | [x] Resuelto sin cambios de código: `alcanceIglesia` ya rechaza las escrituras de una iglesia cerrada (A2-E1-01) y `backend/src/modules/diezmo/iglesia-cerrada.test.ts` lo comprueba en las rutas reales de padres, misas y diezmo (8 pruebas; sin la regla fallan 4). OSC-04 ya no hace falta. |
| A2-E4-02 | Baja | `modules/espacios/dominio/supuestos.ts:21`; `solicitud-espacio.test.ts:252` | Citan CA-29 como «emitida hace 15 días», pero CA-29 dice 16. Así parece que el cliente respalda un supuesto que sigue pendiente en P-26. | Quitar la cita y agregar una prueba de CA-29 con 16 días (paso 1 de [`OSC-03`](../../../../Prompts/Oscar/OSC-03-E4-06-correccion-y-E4-14a-dominio-diezmo.md)). | [x] Hecho en el paso 0 de OSC-06 (commit `e02f131`): CA-29 se prueba con 16 y 5 días y el límite de 15 días queda como supuesto de P-26. |
| A2-E4-03 | Info | `docs/ecclesia/plan-oscar.md:37` | El plan marca todo como «Pendiente», aunque E4-06, E4-14 y el diezmo completo ya están hechos. | Actualizar los estados del plan. | [x] Hecho en el paso 0 de OSC-06 (commit `e02f131`) y de nuevo al terminar espacios. |
| A2-E4-04 | Media | `lib/exportadores/pdf.ts:7`, `excel.ts:13`; `modules/reportes/reportes.service.ts:18`; `modules/dashboard/dashboard.service.ts:12` | dependency-cruiser marca 9 violaciones heredadas en todo el backend, varias en tus módulos: un ciclo entre `reporte.ts` y los exportadores, y `reportes` y `dashboard` importan `eventos.fechas` sin pasar por un service. El caso evalúa «reglas de dependencias en verde». | Romper el ciclo con un módulo de tipos compartido y pedir a Genaro las funciones de fechas por su service (o moverlas a `lib/`). Coordinar con Santiago el hook (A2-E1, pendientes). | [ ] |
| A2-E4-05 | Info | PR #6 | Nataly pregunta si el nombre de la iglesia es único en el país (hoy) o por municipio (su propuesta). | Responder en el PR. Recomendación: por municipio; dos «Parroquia de San Miguel» en estados distintos es algo normal. | [ ] |

## Pendientes de tu plan

- Espacios completo: migración, API y pantallas (E4-07 a E4-11).
- Abrir el PR de `feat/E4-diezmo-completo`, o integrarlo en el de Santiago, para que la cadena se revise en orden.
- E4-05 (OpenAPI y Postman), E4-21 (seeds) y E4-22 (gestión interna por iglesia).
