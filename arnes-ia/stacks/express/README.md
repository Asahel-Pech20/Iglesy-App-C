# Stack Express + TypeScript

Lo que el arnés agrega a un proyecto Express 5 + TypeScript + Prisma + Zod + Vitest.

| Archivo | Para qué | Cómo se ejecuta |
|---|---|---|
| `eslint.config.plantilla.js` (copiar como `eslint.config.js`) | Lint: sin `any`, sin `@ts-ignore`, sin `console.log`, sin `.only/.skip`, controllers sin ORM | `eslint .` |
| `.prettierrc.json` | Formato único | `prettier --check .` |
| `.dependency-cruiser.cjs` | Reglas de arquitectura: sin ciclos, controllers sin ORM, `dominio/` puro, módulos solo por su service, producción sin importar pruebas | `depcruise src --config .dependency-cruiser.cjs` |
| `hooks/pre-commit` | Formato → lint → dependencias → pruebas unitarias sobre lo que está en stage | automático con `git config core.hooksPath arnes-ia/stacks/express/hooks` |
| `hooks/commit-msg` | Conventional Commits + trailer `Asistido-por:` | automático |
| `vitest.config.mjs` | Pruebas unitarias del módulo de referencia (sin BD) | `vitest run --config …/vitest.config.mjs` |
| `modulo-referencia/iglesias/` | Ejemplo de la forma de un módulo; su `dominio/indice-patrimonial.ts` es el cálculo del índice con su prueba (caso del cliente: 35.5) | — |

## Módulo de referencia

```
modules/iglesias/
├── iglesias.routes.ts       ruta + autenticar + autorizar + validar
├── iglesias.controller.ts   lee req, llama al service, responde { data }
├── iglesias.service.ts      lógica y Prisma; lanza AppError(code)
├── iglesias.schemas.ts      Zod (.strict() en crear/editar)
├── dominio/                 reglas puras (aquí: índice patrimonial)
└── iglesias.test.ts         feliz + 400 + 401/403 + reglas
```

En este repositorio la forma completa de routes/controller/service está en `backend/src/modules/_plantilla/`; el arnés trae la parte que no depende del framework (`dominio/`), que es la que se reutiliza tal cual.

## Probado (2026-11-06)

- `vitest run`: 7/7 pruebas del índice, incluida la de 35.5 del cliente.
- `depcruise` sobre el backend de AppIglesia (126 módulos): las reglas sí leen TypeScript y encontraron 9 violaciones reales (ciclos entre services e imports de `eventos.fechas.ts` desde otros módulos). Por eso el pre-commit aplica las reglas solo a la carpeta del código nuevo (`RUTAS_DEPENDENCIAS` en `hooks/verificar.mjs`).
- Requiere dependency-cruiser ≥ 18 con TypeScript 6 (la 16 no lee TS 6: «0 modules cruised»).
