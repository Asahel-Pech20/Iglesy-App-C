# GEN-01 · Plan de Genaro y E3-01: choques de horario de misas

- **Integrante:** Genaro (dueño). Lo escribió Oscar para ejecutarlo por falta de tiempo; quien lo use se anota en la bitácora.
- **Cubre:** plan de RF-30–52; E3-01: RF-45, RF-46, RF-52, RN-26–28, RN-31, RNF-07, CA-13, CA-14, CA-16
- **Estado:** pendiente
- **Antes de usar:** el paso de preparación pide partir del commit con los documentos de Ecclesia. Hoy conviene partir de la rama más reciente del equipo (`feat/E2-05-06-catalogos-iglesias` o la que la reemplace), que ya trae `Padre` y `MisaCelebrada` mínimos: revísalos antes de crear modelos nuevos.

```text
Soy Oscar Michel Matos May, líder del proyecto. Por falta de tiempo voy a avanzar la parte de Genaro Aurelio Antonio Pacheco: servicios, pláticas, padres, horarios y misas. Una tarea a la vez.

PREPARACIÓN
1. Muéstrame la rama actual y git status. Si hay cambios sin commit o E4-06 no está terminada, detente y avísame.
2. Propón crear la rama feat/E3-01-dominio-misas desde el commit que contiene los documentos de Ecclesia (specs.md §12 y docs/requerimientos.md completos), sin incluir el código de E4-06. No cambies de rama hasta que lo apruebe.

LEE
AGENTS.md, docs/ecclesia/ARCHITECTURE.md, ADR-0002 y ADR-0003, specs.md §12, docs/ecclesia/plan-oscar.md como formato, y de docs/requerimientos.md la sección 2.2, RN-20–33, CA-10–18 y P-10–19. Usa arnes-ia/stacks/express/modulo-referencia/ como ejemplo de dominio puro y sus pruebas.

PASO 1: PLAN DE TAREAS
Propón docs/ecclesia/plan-genaro.md con el mismo formato de plan-oscar.md:
- Tareas E3-xx pequeñas para RF-30–52, RN-20–33 y CA-10–18, por las fases del calendario del caso.
- Dependencias con Santiago (Iglesia, alcanceIglesia, roles, zona horaria), con Nataly (ficha de la iglesia) y conmigo: el diezmo necesita de MisaCelebrada el ID, la iglesia, la fecha, la hora, el horario y el padre que ofició (E4-12).
- Las preguntas que bloquean cada tarea.
Dueño del plan: Genaro; ejecuta por ahora: Oscar. Muéstramelo y no sigas hasta que lo apruebe.

PASO 2: TAREA E3-01
Crea en backend/src/modules/misas/dominio/ las reglas puras:
- Detectar si dos misas de un padre chocan e indicar con cuál (RF-45, RN-26), en la misma iglesia o en templos distintos.
- Duración de una hora, salvo otra indicada (RF-46, RN-27).
- Un padre en varias iglesias (RN-28).
- Comparación correcta entre iglesias de distintas zonas horarias, sin alterar la hora local que se muestra (RF-52, RN-31, RNF-07).
Usa la plantilla arnes-ia/core/prompts/pruebas.md.

LÍMITES
- Sin Prisma, sin Express, sin controladores, sin migraciones y sin new Date() implícito: el «ahora», las fechas y las zonas horarias llegan como parámetros.
- No toques schema.prisma ni módulos de otros integrantes.
- Sin dependencias nuevas. Si la conversión de zona horaria no cabe en el dominio, propón dónde va, sin crearla en un módulo ajeno.
- P-15 sigue sin respuesta: si cuentan los empalmes por duración, si se admiten misas seguidas, y si se compara el momento real o la hora local. CA-14 exige aceptar 18:00 de una hora con 19:00. Muéstrame qué supones, deja cada supuesto en un solo lugar fácil de cambiar y anótalo. No lo presentes como regla del cliente.
- P-17 tampoco tiene respuesta: no programes la sustitución en esta tarea.
- No desactives reglas de lint, de dependencias ni pruebas para que algo pase.
- No hagas push ni PR.

PRUEBAS
Los casos de CA-13, CA-14 y CA-16, y además: misma iglesia, días distintos, empalme parcial por duración mayor, misas seguidas y dos zonas horarias distintas.
La configuración de Vitest del backend usa un globalSetup que puede pedir PostgreSQL, y esta laptop no lo tiene. Si eso impide correrlas, muéstrame la forma de correr solo las de dominio sin base de datos, sin cambiar esa configuración. Si no hay forma, detente y pregúntame.

FORMA DE TRABAJO
Antes del código, muéstrame un plan: archivos, funciones con sus firmas, supuestos y lista de pruebas. No escribas código hasta que lo apruebe.
Al terminar:
- Ejecuta las pruebas, lint, typecheck, formato y dependency-cruiser, y muéstrame el resultado real de cada uno.
- Agrega la entrada a docs/bitacora-ia.md a mi nombre (Oscar), indicando que es trabajo de la parte de Genaro, con los errores de la IA que se hayan detectado.
- Dame los archivos cambiados, los IDs cubiertos, lo que no pudiste verificar y una explicación breve del algoritmo para pasársela a Genaro.
- Cuando yo lo apruebe, crea un commit local con Conventional Commits en español, terminado en «Asistido-por: Claude Code».
```
