---
description: Cambia el modelo de datos con una migración nueva y segura
argument-hint: <descripcion_corta> <IDs>
---

# Prompt: migración de base de datos

Necesito cambiar el modelo para **<RF/RN-xx>**: <qué entidad/campo/índice/restricción>.

## Reglas
- Edita `schema.prisma` y genera **una migración nueva**: `prisma migrate dev --name <descripcion_corta>`. Nunca edites una migración ya fusionada.
- Campos de dinero: `Decimal(12,2)`. Fechas sin hora: `@db.Date`. Fechas con hora: UTC.
- Historia que el requerimiento pide conservar: campo `activo`/`fechaBaja`/`motivo`, nunca borrado.
- Si la columna es obligatoria y ya hay datos, define un valor por defecto o una migración en dos pasos; explica cuál.
- Agrega índices para los filtros que pide el requerimiento (p. ej. estado → municipio).
- Actualiza el seed si el cambio lo necesita.

## Prohibido
`prisma migrate reset`, `DROP` manual o borrar datos de desarrollo sin mi confirmación.

## Al terminar
Muestra el SQL generado, explica si es reversible, y corre `typecheck` y `test`.
