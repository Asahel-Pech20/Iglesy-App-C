# AGENTS.md — Contexto para el asistente de IA

> Archivo base del arnés. Se copia a la raíz del proyecto como `AGENTS.md` y se importa desde `CLAUDE.md` (`@AGENTS.md`).
> Lo propio del proyecto (dominio, IDs, comandos) va en `docs/PROYECTO.md`; aquí solo reglas que valen para cualquier proyecto.

Antes de escribir código, lee: `docs/PROYECTO.md`, `docs/requerimientos.md` (solo los IDs de la tarea), `ARCHITECTURE.md` y los ADR de `docs/adr/`.

## Siempre

1. **Trabaja desde un requerimiento.** Cada cambio cita su ID (`RF-xx`, `RN-xx`, `RNF-xx`). Si no hay ID, pregunta antes de programar.
2. **Respeta las capas**: `routes → middlewares (auth, autorizar, validar) → controller → service → repositorio/ORM`. El controller solo lee la petición, llama al service y responde. La lógica de negocio vive en el service o en funciones puras de `dominio/`.
3. **Valida toda entrada** (body, params, query) con un esquema (Zod) antes de que llegue al service. En creación y edición, rechaza campos desconocidos.
4. **Autoriza en el servidor** cada ruta, incluido el alcance por organización (p. ej. «solo su iglesia»). Ocultar un botón no es seguridad.
5. **Usa el formato de respuesta único**: `{ data, meta? }` o `{ error: { code, message, details? } }`, con los códigos HTTP del contrato.
6. **Dinero en decimal exacto** (`Decimal(12,2)` en BD, string en JSON). Nunca `number` flotante para sumar.
7. **Fechas en UTC en la BD**; convierte a la zona horaria del recurso (p. ej. la iglesia) solo al mostrar o al interpretar una hora local.
8. **Escribe la prueba con el código**: al menos un caso feliz, uno de validación (400) y uno de permisos (401/403) por endpoint, y una prueba dedicada por regla de negocio.
9. **Funciones puras para cálculos** (índices, totales, solapes de horario): sin BD ni fechas implícitas; el «ahora» entra como parámetro.
10. **Pagina los listados** (default 20, máx. 100) y usa `select` explícito.
11. **Operaciones de varias escrituras en una transacción.**
12. **Registra auditoría** (quién, cuándo, valor anterior) donde el requerimiento lo pida.
13. **Al terminar**, lista archivos cambiados, pruebas ejecutadas e IDs cubiertos, y propone la entrada de la bitácora (`docs/bitacora-ia.md`).
14. **Commits** en Conventional Commits, en español, terminando con `Asistido-por: <herramienta>`.

## Nunca

1. **Nunca** inventes endpoints, campos, enums ni reglas que no estén en `docs/requerimientos.md` o en el contrato. Si falta algo, pregúntalo.
2. **Nunca** borres físicamente lo que el requerimiento pide conservar (historia, auditoría); se desactiva o se marca.
3. **Nunca** devuelvas contraseñas, hashes, tokens ni datos privados de terceros en respuestas o logs.
4. **Nunca** leas, edites ni pidas el contenido de archivos `.env`, llaves o contraseñas reales. Solo `.env.example`.
5. **Nunca** importes el ORM desde un controller ni desde `routes`; nunca importes un módulo ajeno salvo por su `service` público.
6. **Nunca** desactives una regla de lint, una prueba o una validación para «hacer pasar» el código (`eslint-disable`, `@ts-ignore`, `it.skip`).
7. **Nunca** agregues dependencias sin justificarlo en el PR.
8. **Nunca** ejecutes `migrate reset`, `DROP`, `rm -rf`, `git push --force` ni cambios en `main` sin confirmación humana.
9. **Nunca** edites una migración ya fusionada; crea una nueva.
10. **Nunca** dejes `console.log`, código comentado ni `TODO` sin ID de tarea.
11. **Nunca** des por verificado algo que no ejecutaste: si no corriste las pruebas, dilo.

## Cómo pedir ayuda a la IA

Usa las plantillas de `arnes-ia/core/prompts/`. Cada una pide: IDs de requerimiento, archivos a tocar, criterios de aceptación y cómo se verifica.
