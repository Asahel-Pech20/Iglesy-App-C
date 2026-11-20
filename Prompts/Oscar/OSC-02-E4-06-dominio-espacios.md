# OSC-02 · E4-06: reglas puras de la solicitud de espacio

- **Integrante:** Oscar
- **Cubre:** sección 7, RN-51, RN-52, reglas de RF-76–80, CA-27–29
- **Estado:** usado (2026-11-06); commit `54ea064` en `feat/E4-06-dominio-espacios`
- **Antes de usar de nuevo:** la rama base ya cambió; hoy conviene partir de la rama más reciente del equipo.

```text
Soy Oscar Michel Matos May. Vamos a empezar a programar mi parte de Ecclesia, una tarea a la vez.

PREPARACIÓN
1. Confirma que estás en la rama docs/ecclesia-expansion-specs y muéstrame git status. Los cambios sin commit son míos.
2. Propón cómo separar esos documentos del código en una rama nueva, feat/E4-06-dominio-espacios, sin perderlos. No hagas commit ni cambies de rama hasta que lo apruebe. No incluyas docs/Proyecto_Ecclesia_Sistema_Nacional_de_Gestion_de_Iglesias.docx.
3. Con mi aprobación, ejecuta pnpm install, porque esta rama cambia el lockfile.

LEE
AGENTS.md, docs/ecclesia/ARCHITECTURE.md, docs/ecclesia/plan-oscar.md, ADR-0002 y ADR-0004, la sección 7 y las filas RN-51, RN-52, RF-76–80, CA-27–29, P-26 y P-27 de docs/requerimientos.md, y arnes-ia/stacks/express/modulo-referencia/ como ejemplo de dominio puro y sus pruebas.

TAREA: E4-06
Crea en backend/src/modules/espacios/dominio/ las reglas puras de la solicitud de espacio:
- Las transiciones de la sección 7: cuáles son válidas y quién puede provocar cada una.
- La vigencia de 15 días, recibiendo el «ahora» como parámetro.
- El estado efectivo de una solicitud cotizada cuya cotización ya venció, aunque nadie la haya actualizado.
Usa la plantilla arnes-ia/core/prompts/pruebas.md.

LÍMITES
- Sin Prisma, sin Express, sin controladores, sin migraciones y sin new Date() implícito.
- No toques schema.prisma ni módulos de otros integrantes.
- Sin dependencias nuevas.
- P-26 y P-27 siguen sin respuesta: cómo se cuentan los 15 días y qué estados son finales. Muéstrame qué supones, deja cada supuesto en un solo lugar fácil de cambiar y anótalo. No lo presentes como regla del cliente.
- No desactives reglas de lint, de dependencias ni pruebas para que algo pase.
- No hagas push ni PR.

PRUEBAS
Al menos una por transición válida, una por transición prohibida y los casos de CA-27, CA-28 y CA-29, incluido el límite de los 15 días.
La configuración de Vitest del backend usa un globalSetup que puede pedir PostgreSQL, y esta laptop no lo tiene. Si eso impide correr estas pruebas, muéstrame la forma de correr solo las de dominio sin base de datos, sin cambiar esa configuración. Si no hay forma, detente y pregúntame.

FORMA DE TRABAJO
Primero muéstrame un plan: archivos, funciones con sus firmas, supuestos y lista de pruebas. No escribas código hasta que lo apruebe.
Al terminar:
- Ejecuta las pruebas, lint, typecheck, formato y dependency-cruiser, y muéstrame el resultado real de cada uno.
- Agrega la entrada a docs/bitacora-ia.md, con los errores de la IA que se hayan detectado.
- Dame los archivos cambiados, los IDs cubiertos, lo que no pudiste verificar y, cuando yo lo apruebe, crea un commit local con Conventional Commits en español, terminado en «Asistido-por: Claude Code».
```
