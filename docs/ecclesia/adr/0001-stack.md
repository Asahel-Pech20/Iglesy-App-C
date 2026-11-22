# ADR-0001: Express 5 + TypeScript en el backend y Angular en el frontend

- **Estado:** Aceptado · **Fecha:** 2026-11-06 · **Decide:** equipo completo
- **Requerimientos relacionados:** lineamientos técnicos del curso, RNF-02, RNF-16

## Contexto
El caso permite Express, NestJS o PHP. Tenemos poco tiempo y el equipo ya construyó AppIglesia con Express 5 + Prisma + Zod + Vitest y frontend Angular 21 + Material.

## Opciones consideradas
1. **Express 5 + TS** — a favor: experiencia del equipo, plantilla y pruebas ya probadas; en contra: la estructura la imponemos nosotros (lo cubre el arnés).
2. **NestJS** — a favor: estructura de módulos de fábrica; en contra: curva de aprendizaje con el plazo actual.
3. **PHP** — en contra: nadie del equipo lo usa a diario.

## Decisión
**Express 5 + TypeScript strict**, con Angular 21 + Material para el frontend (responsive para el uso desde celular, RNF-02).

## Consecuencias
- Reutilizamos el arnés (`arnes-ia/stacks/express`).
- La disciplina de capas no la da el framework: la exigen ESLint y dependency-cruiser en el pre-commit y el CI.
