# OSC-03 · Corrección de E4-06 y E4-14a: reglas puras del diezmo

- **Integrante:** Oscar
- **Cubre:** paso 1, detalles de E4-06; paso 2, RF-60–68, RN-40–45 y CA-20–24
- **Estado:** la tarea del paso 2 está hecha (commit `3268c9a`, rama `feat/E4-14-dominio-diezmo`). **El paso 1 sigue pendiente:** `supuestos.ts` y la prueba aún citan CA-29 con 15 días, y `plan-oscar.md` sigue con E4-06 como «Pendiente» (Auditoría 2, A2-E4-02 y A2-E4-03).
- **Antes de usar de nuevo:** ejecuta solo el paso 1, sobre la rama más reciente del equipo.

```text
Soy Oscar Michel Matos May. Tengo poco tiempo: avancemos en pasos pequeños, sin esperar respuestas del cliente.

PASO 1: CORREGIR E4-06 (rama feat/E4-06-dominio-espacios)
- supuestos.ts y el título de la prueba citan CA-29 como «emitida hace 15 días», pero docs/requerimientos.md dice 16. Quita esa cita: el vencimiento en el instante exacto es un supuesto de P-26, no algo que diga CA-29.
- Agrega una prueba de CA-29 con 16 días, tal como está escrito.
- Marca E4-06 como hecha en docs/ecclesia/plan-oscar.md, aclarando que solo cubre las reglas puras de RF-76–80; la API y las pantallas siguen en E4-09 a E4-11, E4-19 y E4-20.
- Corre las pruebas de dominio y crea un commit local terminado en «Asistido-por: Claude Code».

PASO 2: NUEVA TAREA E4-14a, DOMINIO DE DIEZMO
Crea la rama feat/E4-14a-dominio-diezmo desde docs/ecclesia-expansion-specs. Lee AGENTS.md, docs/ecclesia/ARCHITECTURE.md, backend/src/modules/espacios/dominio/ como ejemplo, y RF-60–68, RN-40–45, CA-20–24, P-22 y P-23 de docs/requerimientos.md.
Crea en backend/src/modules/diezmo/dominio/ las reglas puras:
- Si se puede capturar: la misa ya se celebró y no tiene captura (RN-40, RN-41).
- Si se puede corregir, y qué se guarda en el historial: quién, cuándo y cantidad anterior (RN-42, RN-43).
- Total, promedio, misas con más y con menos, y agrupación por día, semana, mes, horario y padre (RF-64–68).
Agrega E4-14a al plan.

REGLAS
- Montos sin number de punto flotante: trabájalos en centavos enteros o con un tipo exacto, y justifica cuál eliges (RN-44, RNF-06). CA-23 y CA-24 deben dar exactamente esos montos.
- Sin Prisma, sin Express, sin reloj implícito y sin dependencias nuevas.
- En producción, las sumas de reportes irán en SQL (ADR-0003). Estas funciones definen el resultado esperado y sirven para los casos que SQL no resuelva: explícame en tu plan qué hace cada capa, sin duplicar reglas.
- Lo que falte de P-22 y P-23 va en un supuestos.ts, marcado como supuesto: redondeo del promedio, cuántas misas con más y con menos, inicio de semana, padre programado o real, y misas sin captura.
- No toques schema.prisma ni módulos ajenos. No hagas push.

Para correr estas pruebas sin base de datos, usa una configuración de Vitest temporal fuera del repositorio, sin cambiar backend/vitest.config.ts.

FORMA DE TRABAJO
Primero haz el paso 1. Después muéstrame el plan del paso 2 (archivos, firmas, supuestos y pruebas) y espera mi aprobación. Al terminar, muéstrame el resultado real de las pruebas, lint, typecheck, formato y dependency-cruiser; agrega la entrada a docs/bitacora-ia.md y, cuando lo apruebe, crea el commit local.
```
