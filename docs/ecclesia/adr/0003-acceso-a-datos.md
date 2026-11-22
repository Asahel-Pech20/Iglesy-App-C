# ADR-0003: PostgreSQL 16 con Prisma, decimales exactos y bajas lógicas

- **Estado:** Aceptado · **Fecha:** 2026-11-06 · **Decide:** equipo completo
- **Requerimientos relacionados:** RNF-05, RNF-06, RNF-07, RNF-11, RNF-12

## Contexto
El caso exige: catálogo INEGI (estado → municipio → localidad), «no aceptamos diferencias de centavos», horas locales de cada iglesia, historia de iglesias cerradas y objetos dados de baja, y auditoría de correcciones de diezmo.

## Opciones consideradas
1. **Prisma + PostgreSQL** — migraciones versionadas, tipos generados, `Decimal`, transacciones; el equipo ya lo usa.
2. **SQL a mano (pg)** — más control, más código repetido y sin tipos.
3. **MongoDB** — sin integridad referencial para el catálogo INEGI.

## Decisión
**PostgreSQL 16 + Prisma 7.**
- Dinero: `Decimal(12,2)`; en JSON como string.
- Fechas y horas: `timestamptz` en UTC; cada iglesia guarda su `zonaHoraria` (IANA) y la conversión se hace en `lib/zona-horaria`.
- Bajas: `activa/cerradaEn/motivo` en iglesias; `estado` (VIGENTE, PERDIDO, PRESTADO, BAJA) en objetos. Nunca `DELETE`.
- Correcciones de diezmo: tabla de historial de solo inserción (quién, cuándo, monto anterior).
- Catálogo INEGI: tablas `Estado`, `Municipio`, `Localidad` con claves oficiales y FK desde la iglesia.

## Consecuencias
- Sumas exactas en SQL (`SUM` sobre `numeric`).
- Las consultas públicas filtran siempre `activa = true` y objetos `VIGENTE`.
