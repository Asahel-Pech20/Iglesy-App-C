---
description: Agrega un endpoint a un módulo existente respetando el contrato
argument-hint: <MÉTODO /ruta> <IDs>
---

# Prompt: nuevo endpoint

Agrega **`<MÉTODO> /api/v1/<ruta>`** al módulo **`<modulo>`** para cubrir **<RF-xx>**.

## Especificación
- **Quién puede llamarlo:** <público | rol(es)> · **Alcance:** <p. ej. solo la iglesia del usuario>
- **Entrada:** params `<…>`, query `<…>`, body `<…>` (tipos y límites).
- **Salida feliz:** `<código HTTP>` con `{ data: … }` (listado: `{ data, meta }`).
- **Errores esperados:** `400 VALIDATION_ERROR` · `401` · `403 FORBIDDEN` · `404 NOT_FOUND` · `409 CONFLICT` · `422 BUSINESS_RULE (<regla RN-yy>)`.

## Pasos
1. Esquema Zod en `<modulo>.schemas.ts`.
2. Función en el service (la regla de negocio va en `dominio/` si es un cálculo).
3. Controller delgado y ruta con sus middlewares.
4. Pruebas: feliz, 400, 401/403 y una por cada error de negocio listado.
5. Documentar en OpenAPI.

## Restricciones
Igual que `AGENTS.md`. No cambies la forma de respuestas existentes.

## Al terminar
Muestra un `curl` de ejemplo, la salida de las pruebas y los IDs cubiertos.
