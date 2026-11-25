# Prueba de portabilidad (arnés 0.4.0)

> Copia de la nota que acompaña al repositorio de la prueba (`prestamo-libros`, `docs/nota-portabilidad.md`).

**Alumno:** Santiago Pech · **Fecha:** 2026-11-25 · **Arnés:** de 0.3.1 (el que usaba Ecclesia) a 0.4.0 · **Herramienta de IA:** Claude Code

## Qué se hizo

1. Repositorio nuevo `prestamo-libros` (Express 5 + TypeScript + Zod + Vitest; datos en memoria para no depender de una BD).
2. Se instaló el arnés siguiendo su README tal cual: `AGENTS.md`, `docs/PROYECTO.md`, `ARCHITECTURE.md`, ADR, ESLint, Prettier, dependency-cruiser y hooks de git.
3. Se llenó `docs/PROYECTO.md` (dominio, términos que se confunden, comandos) y `docs/requerimientos.md` (RF-01–RF-06, RN-01–RN-06).
4. Se pidió a la IA el módulo `libros` y luego, con la plantilla `core/prompts/nuevo-modulo.md`, el módulo completo `prestamos`: primero el plan, luego la aprobación, luego el código.

**Resultado:** 47 pruebas (dominio puro, integración por endpoint con caso feliz, 400 y 401/403, y una por regla de negocio); lint, tipos, formato y reglas de dependencias en verde. Para comprobar que las pruebas sí revisan algo se rompieron a propósito dos reglas (máximo de 3 préstamos y redondeo de la multa): fallaron 4 pruebas.

## Qué hubo que ajustar del arnés

| # | Qué pasó al instalarlo | Por qué | Ajuste (arnés 0.4.0) |
|---|---|---|---|
| 1 | El primer commit falló en las reglas de dependencias y en las pruebas: `Can't open 'backend/arquitectura-conocidas.json'` | `hooks/verificar.mjs` tenía fijas las rutas de Ecclesia (`backend/src`, su lista de violaciones conocidas y las pruebas en `backend/`) | Archivo `arnes.config.json` por proyecto, con valores por defecto (`src/`, pruebas en la raíz) y su prueba (`hooks/ajustes.test.mjs`) |
| 2 | ESLint rechazó los `console.log` de los propios hooks del arnés y Prettier reacomodaba 18 archivos `.md` del arnés | Ecclesia ya tenía esas excepciones en su configuración, pero nunca se pasaron a las plantillas | Excepción para `arnes-ia/**/hooks/*.mjs` en la plantilla de ESLint; plantillas de `.prettierignore` y `.gitattributes` (LF en Windows) |
| 3 | **Un controller que leía el almacén de datos pasó el pre-commit** (se probó a propósito y el commit entró; se deshizo) | La regla `controller-sin-orm` solo reconocía las rutas de Prisma; con otro acceso a datos no protegía nada | `dependencias.accesoDatos` en `arnes.config.json` (lo lee `.dependency-cruiser.cjs`); probado otra vez: ahora la bloquea |
| 4 | Al hacer el ajuste 3, el propio hook rechazó el commit: `require()` prohibido en `.dependency-cruiser.cjs` | La plantilla de ESLint no distinguía archivos CommonJS | Bloque para `**/*.cjs` en la plantilla de ESLint |
| 5 | Los comandos de instalación usan `cp`/`mv` y `pnpm` | En Windows sin pnpm no corren en PowerShell | El README dice que se usen en Git Bash y acepta `npm` |

## Qué funcionó sin cambios

- `AGENTS.md` (siempre / nunca) y `core/` no mencionan a Ecclesia: se usaron tal cual.
- La plantilla `nuevo-modulo.md` llevó a un plan revisable antes del código, con las pruebas por endpoint y por regla.
- `commit-msg` (Conventional Commits + `Asistido-por:`) funcionó sin tocarlo.
- Las reglas `dominio-puro`, `modulos-solo-por-service` y `sin-ciclos`: `prestamos` usa `libros` solo por su service.

## Lo que queda

- `stacks/nest/` y `stacks/php/` siguen siendo solo una guía; esta prueba usó el stack Express.
- La regla de ESLint que prohíbe importar el acceso a datos en los controllers aún se edita a mano (la de dependency-cruiser ya lee `arnes.config.json`).
