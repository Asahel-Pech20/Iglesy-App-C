# Changelog del arnés

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/).

## [0.1.0] — 2026-11-06

### Agregado
- `core/AGENTS.base.md`: contexto para la IA con secciones «Siempre» y «Nunca», adaptado de las reglas de AppIglesia (`AGENTS.md` y `docs/arnes.md`).
- Plantillas de `ARCHITECTURE.md` y de ADR.
- Cinco plantillas de prompt: nuevo módulo, nuevo endpoint, migración, pruebas y revisión de código.
- Checklists de definición de terminado y de revisión de código.
- Stack Express: ESLint, Prettier, reglas de dependencias (dependency-cruiser), hook de pre-commit sin dependencias extra y módulo de referencia `iglesias` (cálculo del índice patrimonial con su prueba).
- `plantilla-proyecto/`: `PROYECTO.md` y formato de bitácora de IA.

### Origen
- Las reglas de capas, respuestas `{ data, meta? }` / `{ error }`, permisos y soft delete vienen del arnés de AppIglesia (`.claude/settings.json`, hooks `formatear.mjs` y `verificar.mjs`, comando `/tarea`).
