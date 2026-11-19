# Definición de terminado (DoD)

Una tarea está terminada cuando **todo** esto es cierto:

- [ ] Cita sus IDs (`RF`, `RN`, `RNF`, `CA`) y los cumple todos.
- [ ] No agrega endpoints, campos ni reglas fuera de `docs/requerimientos.md` (o los agrega allí en el mismo PR con su origen).
- [ ] Cada RN tocada tiene prueba unitaria con valores límite; cada CA tocado tiene su prueba Dado/Cuando/Entonces.
- [ ] Cada endpoint nuevo tiene prueba feliz, de validación (400) y de permisos (401/403), incluida la de otra organización.
- [ ] `lint`, `format:check`, `typecheck`, `depcruise` y `test` en verde (lo garantiza el pre-commit y el CI).
- [ ] Cobertura de dominio y services ≥ 70 %.
- [ ] Sin `console.log`, `@ts-ignore`, `eslint-disable` ni `it.skip` nuevos.
- [ ] OpenAPI actualizado; `ARCHITECTURE.md` y ADR actualizados si cambió una decisión.
- [ ] Matriz de trazabilidad actualizada (requerimiento → código → prueba).
- [ ] Entrada en `docs/bitacora-ia.md` si participó la IA, y commits con `Asistido-por:`.
- [ ] Revisado por otra persona con `revision-de-codigo.md`.
