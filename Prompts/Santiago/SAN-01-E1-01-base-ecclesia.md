# SAN-01 · E1-01: base mínima de Ecclesia

- **Integrante:** Santiago
- **Cubre:** `Iglesia` mínima, `Usuario.iglesiaId`, rol `COORDINACION`, `alcanceIglesia`, seed por rol (RF-81, RF-82, RF-87, RN-54, RNF-10)
- **Estado:** enviado. E1-01 quedó en `feat/E1-01-base-fusion` (commit `8b115c8`), fusionada con la base de Oscar; no consta si se usó este prompt tal cual.
- **Antes de usar de nuevo:** E1-01 ya está hecha; tómalo como plantilla para E1-02 en adelante (`docs/ecclesia/plan-santiago.md`).

```text
Soy Santiago Asahel Pech Ake, dueño de B1 y F1 (infraestructura, auth, usuarios, permisos y schema.prisma). Vamos a crear la base mínima de Ecclesia, una tarea a la vez. Oscar y Genaro dependen de esto, así que prioriza lo más pequeño que los desbloquee.

PREPARACIÓN
1. Ejecuta git fetch origin y muéstrame git status. Si hay cambios sin commit, detente y avísame.
2. Propón crear la rama feat/E1-01-base-ecclesia desde origin/docs/ecclesia-expansion-specs. No cambies de rama hasta que lo apruebe.

LEE
AGENTS.md, CLAUDE.md, specs.md §3 y §12 (sobre todo 12.2, 12.3 y 12.6), docs/ecclesia/ARCHITECTURE.md, ADR-0003, ADR-0004 y ADR-0006; RF-07–09, RF-81, RF-82, RF-87, RN-54, RNF-10 y P-20, P-28 de docs/requerimientos.md; backend/prisma/schema.prisma, backend/src/middlewares/auth.ts, backend/src/config/permisos.ts, el módulo configuracion y frontend/src/app/core/permisos.

specs.md §12 y ADR-0006 son una propuesta de Oscar. Si algo no te parece viable, repórtamelo antes de programar.

PASO 1: ANÁLISIS, SIN EDITAR NADA
Muéstrame:
- Qué se rompe si ConfiguracionIglesia pasa a Iglesia y si ADMIN pasa a ADMIN_IGLESIA: módulos, pruebas, seed, frontend y cartelera pública.
- La forma más segura de hacerlo por pasos pequeños. Evalúa empezar agregando lo nuevo sin renombrar ni quitar nada, y dejar el cambio de ADMIN y el reemplazo de la configuración para una tarea posterior, si eso desbloquea antes al equipo.
- Qué campos de Iglesia crea esta tarea y cuáles quedan para Nataly (catálogo del INEGI y datos completos), para no chocar con ella.
- La propuesta de tareas E1-xx para docs/ecclesia/plan-santiago.md, con el mismo formato de plan-oscar.md.
Espera mi aprobación.

PASO 2: TAREA E1-01, BASE MÍNIMA
Con el alcance que yo apruebe:
- Modelo Iglesia mínimo y migración nueva, con Usuario.iglesiaId (null solo para la Coordinación).
- Rol COORDINACION y sus permisos en backend y frontend.
- Middleware alcanceIglesia (ADR-0004): obtiene la iglesiaId del recurso desde la BD, la compara con la del usuario y responde 403 si no coincide. Nunca confía en una iglesiaId enviada por el cliente.
- Iglesia inicial y un usuario de prueba por rol en el seed.
- Actualiza backend/README.md con cómo usar alcanceIglesia en una ruta.

REGLAS
- Nunca edites una migración ya fusionada. No ejecutes migrate reset, DROP ni borres datos sin confirmación.
- Las pruebas usan la BD de pruebas, no la de desarrollo.
- Sin dependencias nuevas sin mi aprobación.
- No toques los módulos de negocio de otros integrantes, salvo el ajuste mínimo que exija la migración; lístalo aparte para pedirles revisión.
- No inventes campos ni reglas: lo que dependa de P-20 o P-28 va como supuesto, en un solo lugar, y no se presenta como regla del cliente.
- No desactives reglas de lint, de dependencias ni pruebas para que algo pase.
- No hagas push ni PR sin mi instrucción.

PRUEBAS
- Por alcanceIglesia: misma iglesia permitido, otra iglesia 403, sin sesión 401, Coordinación según lo aprobado, e intento de enviar otra iglesiaId en la petición.
- Las pruebas existentes deben seguir pasando. Si alguna falla, explícame por qué antes de cambiarla.
- La misma iglesia y los roles deben funcionar en una base recién migrada y sembrada.

FORMA DE TRABAJO
Antes del código, muéstrame un plan: archivos, migración, pruebas y riesgos. No escribas código hasta que lo apruebe.
Al terminar:
- Ejecuta pruebas, lint, typecheck, formato y dependency-cruiser, y muéstrame el resultado real de cada uno. Las 9 violaciones heredadas no deben aumentar.
- Dame, listo para pasarle a Oscar y a Genaro: nombres de roles, el campo iglesiaId y la firma de alcanceIglesia.
- Agrega la entrada a docs/bitacora-ia.md a mi nombre, con los errores de la IA que se hayan detectado.
- Dame los archivos cambiados, los IDs cubiertos y lo que no pudiste verificar.
- Cuando lo apruebe, crea un commit con Conventional Commits en español, terminado en «Asistido-por: Claude Code».
```
