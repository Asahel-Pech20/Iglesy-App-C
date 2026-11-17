# Auditoría 2 — Ecclesia

- **Fecha:** 2026-11-17
- **Ramas auditadas** (cada una se apoya en la anterior):
  - `feat/E4-diezmo-completo` (Oscar, `66ce901`)
  - `feat/E1-01-base-fusion` (Santiago, `8b115c8`)
  - `feat/E2-05-06-catalogos-iglesias` (Nataly, `7b421f4`, PR #6)
- **Fuera de alcance:** el frontend, el PR #5 (plan de Nataly, solo documentos) y el PR #2.
- **Referencias:** `AGENTS.md`, `specs.md` §12, `docs/requerimientos.md` y los `docs/ecclesia/plan-*.md`.

## Cómo usar esta carpeta

Igual que en la [Auditoría 1](../Auditoria_1/README.md): cada integrante lee **solo** su archivo, que se entiende solo y cita archivo y línea.

Al atender una observación:
1. Corrígela en una rama `fix/<subseccion>-auditoria2-<id>` (por ejemplo, `fix/E2-auditoria2-01`).
2. En el mismo PR, marca su casilla en la tabla de tu archivo.
3. Si no la vas a corregir, explica el motivo en la columna «Estado».

Los IDs siguen el formato `A2-<subsección de Ecclesia>-<nn>`: E1 Santiago, E2 Nataly, E3 Genaro y E4 Oscar.

| Carpeta | Integrante | Observaciones |
|---|---|---|
| [Santiago_Pech_Ake_B1-F1](Santiago_Pech_Ake_B1-F1/backend/observaciones.md) | Santiago Asahel Pech Ake | E1 · 6 |
| [Nataly_Santos_Miam_B2-F2](Nataly_Santos_Miam_B2-F2/backend/observaciones.md) | Nataly Marisol Santos Miam | E2 · 9 |
| [Genaro_Antonio_Pacheco_B3-F3](Genaro_Antonio_Pacheco_B3-F3/backend/observaciones.md) | Genaro Aurelio Antonio Pacheco | E3 · 1 |
| [Oscar_Matos_May_B4-F4](Oscar_Matos_May_B4-F4/backend/observaciones.md) | Oscar Michel Matos May | E4 · 5 |

## Severidad

Misma escala de la Auditoría 1:

| Nivel | Significado |
|---|---|
| **Alta** | Rompe una regla de oro de `AGENTS.md` §1, expone datos o da un resultado incorrecto. Se corrige antes de fusionar a `main`. |
| **Media** | Incumple una regla de `AGENTS.md` o un criterio de aceptación, sin riesgo inmediato. Se corrige en la fase actual. |
| **Baja** | Mejora de calidad, UX o mantenimiento. Se puede programar. |
| **Info** | Coordinación entre integrantes o pendiente de documentación. |

**Resultado:** no hay observaciones de severidad Alta. El alcance por iglesia no confía en la `iglesiaId` del cliente, los datos privados quedan fuera del alcance de la Coordinación y los supuestos están marcados como tales.

## Temas que cruzan a varios integrantes

| Tema | Observaciones | Quién decide |
|---|---|---|
| Una iglesia cerrada sigue aceptando escrituras | A2-E1-01, A2-E2-02, A2-E4-01 | Santiago (si se resuelve en `alcanceIglesia`) u Oscar (en misas y diezmo) |
| Violaciones de `CHECK` terminan en 500 | A2-E1-02, A2-E2-01 | Santiago (`errores.ts`) |
| Nombre de iglesia: ¿único en el país o por municipio? | A2-E4-05 | Oscar responde en el PR #6 |

## Verificación

Solo se leyó el código. **No se ejecutaron pruebas:** esta laptop no tiene PostgreSQL. Las cifras de pruebas que aparecen son las que reportó cada autor:

| Rama | Reportado por su autor |
|---|---|
| `feat/E1-01-base-fusion` | Backend 650/650, frontend 131/131 |
| `feat/E2-05-06-catalogos-iglesias` | Backend 680/680 |

En la Auditoría 1 sí se corrieron; aquí quedan pendientes de comprobar.

## Lo que no se verificó

- Las pruebas del backend y del frontend de las tres ramas.
- El frontend de Ecclesia (pantallas de diezmo e iglesias).
- La carga real del catálogo del INEGI con `db:catalogos`.
