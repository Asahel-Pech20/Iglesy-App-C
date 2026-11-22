---
description: Crea un módulo completo (routes, controller, service, schemas, dominio, pruebas) a partir de requerimientos
argument-hint: <modulo> <IDs de requerimientos>
---

# Prompt: nuevo módulo

Crea el módulo **`<modulo>`** para cubrir **<RF-xx, RN-yy, CA-zz>** de `docs/requerimientos.md`.

## Contexto que debes leer primero
- `AGENTS.md` (siempre / nunca), `ARCHITECTURE.md` y los ADR de `docs/adr/`.
- Solo las filas de los IDs indicados en `docs/requerimientos.md`, con su origen en el caso.
- El módulo de referencia: `arnes-ia/stacks/<stack>/modulo-referencia/` (copia su forma, no su dominio).

## Qué entregar
1. `<modulo>.schemas.ts`: esquemas Zod de entrada (`.strict()` en creación/edición).
2. `<modulo>.service.ts`: lógica y acceso a datos; errores de dominio con `AppError(code)`.
3. `dominio/*.ts`: reglas puras de los RN (sin BD, sin `new Date()` implícito).
4. `<modulo>.controller.ts` y `<modulo>.routes.ts` con `autenticar`, `autorizar('<modulo>:<accion>')` y `validar(...)`.
5. Pruebas: por endpoint 1 feliz + 1 de 400 + 1 de 401/403; por RN, una prueba del dominio; por CA, un caso Dado/Cuando/Entonces.
6. Rutas en la documentación OpenAPI.

## Restricciones
- No agregues campos ni endpoints fuera del requerimiento; si algo falta, **detente y pregunta**.
- No toques otros módulos; si los necesitas, usa su `service` y avísame.

## Al terminar
Lista archivos, comandos ejecutados con su resultado (`lint`, `typecheck`, `test`, `depcruise`) e IDs cubiertos. Propón la fila para `docs/bitacora-ia.md` y la(s) fila(s) de la matriz de trazabilidad.
