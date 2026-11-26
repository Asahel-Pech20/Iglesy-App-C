# Arnés de IA — Ecclesia

Conjunto reutilizable de reglas, plantillas, prompts y verificaciones automáticas para trabajar con **un asistente de IA** (en este equipo: **Claude Code**) sin perder el control del código. Se diseñó para el Proyecto Ecclesia y sirve para cualquier proyecto Express / NestJS / PHP del curso.

> Repositorio del arnés (entregable del curso). El proyecto Ecclesia lleva una copia en su carpeta `arnes-ia/`; los cambios se hacen aquí primero y se anotan en el [CHANGELOG](CHANGELOG.md).
>
> Versión actual: **0.4.0**. Probado en Ecclesia y en un proyecto nuevo de préstamo de libros ([prueba de portabilidad](docs/portabilidad.md)).

## Qué trae

```
arnes-ia/
├── README.md                     ← este archivo (guía de instalación)
├── CHANGELOG.md
├── core/                         ← independiente del stack
│   ├── AGENTS.base.md            ← archivo de contexto: «siempre» y «nunca»
│   ├── arquitectura/
│   │   ├── ARCHITECTURE.plantilla.md
│   │   └── adr-plantilla.md
│   ├── prompts/                  ← 5 plantillas de prompt
│   │   ├── nuevo-modulo.md
│   │   ├── nuevo-endpoint.md
│   │   ├── migracion.md
│   │   ├── pruebas.md
│   │   └── revision-de-codigo.md
│   └── checklists/
│       ├── definicion-de-terminado.md
│       └── revision-de-codigo.md
├── stacks/
│   ├── express/                  ← stack que usa Ecclesia
│   │   ├── README.md
│   │   ├── .dependency-cruiser.cjs
│   │   ├── eslint.config.plantilla.js
│   │   ├── .prettierrc.json
│   │   ├── arnes.config.plantilla.json   ← carpetas y pruebas del proyecto para el pre-commit
│   │   ├── prettierignore.plantilla  gitattributes.plantilla
│   │   ├── hooks/                ← pre-commit, commit-msg y sus pruebas
│   │   └── modulo-referencia/    ← módulo «iglesias» de ejemplo
│   ├── nest/README.md
│   └── php/README.md
└── plantilla-proyecto/
    ├── PROYECTO.md               ← lo que cada proyecto llena (dominio, IDs, comandos)
    └── bitacora-ia.md            ← formato de la bitácora de uso de IA
```

## Instalación en un proyecto nuevo (≈ 10 min)

Requisitos: Node 22.12+ o 24+, npm o pnpm, git, Claude Code. Los comandos usan `cp` y `mv`: en Windows, córrelos en Git Bash.

1. **Copiar el núcleo y el stack**
   ```bash
   cp arnes-ia/core/AGENTS.base.md AGENTS.md
   cp arnes-ia/plantilla-proyecto/PROYECTO.md docs/PROYECTO.md
   cp arnes-ia/plantilla-proyecto/bitacora-ia.md docs/bitacora-ia.md
   cp arnes-ia/core/arquitectura/ARCHITECTURE.plantilla.md ARCHITECTURE.md
   mkdir -p docs/adr && cp arnes-ia/core/arquitectura/adr-plantilla.md docs/adr/0000-plantilla.md
   cp arnes-ia/stacks/express/.prettierrc.json .
   cp arnes-ia/stacks/express/eslint.config.plantilla.js eslint.config.js
   cp arnes-ia/stacks/express/arnes.config.plantilla.json arnes.config.json
   cp arnes-ia/stacks/express/prettierignore.plantilla .prettierignore
   cp arnes-ia/stacks/express/gitattributes.plantilla .gitattributes
   ```
2. **Llenar `docs/PROYECTO.md`** (dominio, glosario corto, comandos) y enlazarlo desde `AGENTS.md`. Si el código no está en `src/` o las pruebas no corren desde la raíz, ajusta `arnes.config.json` (ejemplo de un monorepo: `{ "dependencias": { "rutas": ["backend/src"] }, "pruebas": { "cwd": "backend" } }`).
3. **Dependencias de verificación** (dev):
   ```bash
   npm install -D eslint @eslint/js typescript-eslint eslint-config-prettier globals prettier dependency-cruiser vitest
   ```
4. **Hook de pre-commit** (sin dependencias extra; git lo ejecuta desde la carpeta del arnés). Para que todo el equipo lo tenga sin configurarlo a mano, copia `plantilla-proyecto/` o usa un script `prepare` como `scripts/activar-hooks.mjs` de AppIglesia, que lo activa en cada `pnpm install` (y no hace nada en el CI). A mano:
   ```bash
   git config core.hooksPath arnes-ia/stacks/express/hooks
   ```
   Si el proyecto ya tenía violaciones de arquitectura, genera su lista de conocidas (`npx depcruise src --config arnes-ia/stacks/express/.dependency-cruiser.cjs --output-type baseline --output-to arquitectura-conocidas.json`) y ponla en `dependencias.conocidas` de `arnes.config.json` (la misma que use el CI): el commit falla solo con violaciones nuevas.
   Corre en este orden y detiene el commit si algo falla: formato (Prettier) → lint (ESLint) → reglas de dependencias (dependency-cruiser) → pruebas (Vitest), y revisa que el mensaje tenga `Asistido-por:` cuando la IA participó (ver `core/AGENTS.base.md`).
5. **Claude Code**: `CLAUDE.md` del proyecto debe importar `@AGENTS.md`. Los prompts de `core/prompts/` se copian a `.claude/commands/` para usarlos como `/nuevo-modulo`, `/nuevo-endpoint`, etc.
6. **Probar el arnés**: hacer un commit con un `console.log` o un import prohibido (p. ej. un controller que importa Prisma): el hook debe rechazarlo.

## Cómo se usa en el día a día

1. Elegir la plantilla de prompt que corresponda (`core/prompts/`) y llenar sus huecos con IDs de `docs/requerimientos.md`.
2. Revisar lo que propone la IA con `core/checklists/revision-de-codigo.md` **antes** de aceptarlo.
3. Registrar en `docs/bitacora-ia.md` qué se pidió, qué salió y si hubo error de la IA.
4. Commit con el trailer `Asistido-por: Claude Code`. El pre-commit verifica el resto.
5. La tarea está terminada solo si cumple `core/checklists/definicion-de-terminado.md`.

## Prueba de portabilidad

El arnés no depende de Ecclesia: `core/` no menciona dominio; lo propio del proyecto vive en `docs/PROYECTO.md` y `arnes.config.json`. Para otro stack se usa `stacks/nest/` o `stacks/php/` en lugar de `stacks/express/`.

Se probó instalándolo en una API nueva de préstamo de libros: qué se tuvo que ajustar y cómo quedó en [docs/portabilidad.md](docs/portabilidad.md).
