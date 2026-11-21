# Changelog del arnés

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/).

## [0.3.1] — 2026-11-20

### Corregido
- `commit-msg` acepta los mensajes automáticos de merge de git y de GitHub (`Merge branch…`, `Merge remote-tracking branch…`, `Merge pull request…`); antes había que reescribirlos con `-m`. Las reglas viven en `hooks/reglas-mensaje.mjs`, con pruebas.

## [0.3.0] — 2026-11-18

### Agregado
- Activación automática de los hooks con un script `prepare` (`scripts/activar-hooks.mjs` en AppIglesia): todo el equipo los tiene al hacer `pnpm install`; en el CI se omite.

### Cambiado
- El pre-commit aplica las reglas de dependencias a todo `backend/src` con la lista de violaciones conocidas (`CONOCIDAS_DEPENDENCIAS`), igual que el CI; antes solo revisaba el módulo de referencia.

## [0.2.0] — 2026-11-11

### Agregado
- Stack Express: guía para proyectos con violaciones heredadas (lista de conocidas con `--ignore-known`), usada en el CI de AppIglesia con `pnpm arquitectura`.

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
