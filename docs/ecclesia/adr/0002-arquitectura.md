# ADR-0002: Monolito modular en capas con dominio puro

- **Estado:** Aceptado · **Fecha:** 2026-11-06 · **Decide:** equipo completo
- **Requerimientos relacionados:** RNF-10, RNF-13, RNF-19

## Contexto
Cuatro personas trabajan en paralelo en dominios distintos (iglesias/patrimonio, misas, diezmo/espacios). Las reglas delicadas (índice, solapes, centavos, vigencia de 15 días) deben poder probarse sin BD.

## Opciones consideradas
1. **Monolito modular** (`routes → controller → service → Prisma`, más `dominio/` puro por módulo).
2. **Microservicios** — excesivo para el alcance y el equipo.
3. **Capas globales** (`controllers/`, `services/` de todo el sistema) — mezcla los dominios de cada integrante y genera conflictos de merge.

## Decisión
**Monolito modular**: una carpeta por módulo; los módulos se usan solo a través de su `service`; las reglas de negocio calculables viven en `dominio/` como funciones puras.

## Consecuencias
- Cada integrante es dueño de sus carpetas; menos conflictos.
- dependency-cruiser hace cumplir las reglas (`modulos-solo-por-service`, `dominio-puro`, `sin-ciclos`).
- En AppIglesia la misma regla encontró 9 violaciones; aquí se activan desde el primer commit para no acumular esa deuda.
