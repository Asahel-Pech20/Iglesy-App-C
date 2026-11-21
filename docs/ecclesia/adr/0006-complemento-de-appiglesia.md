# ADR-0006: Ecclesia complementa a AppIglesia en un solo sistema

- **Estado:** Propuesto, pendiente de revisión del equipo · **Fecha:** 2026-11-06 · **Propone:** Oscar (líder)
- **Requerimientos relacionados:** RF-01–89, requerimientos heredados de `specs.md §2`, P-20, P-21

## Contexto
`specs.md` describe AppIglesia: la administración interna de una sola iglesia. El caso pide un sistema nacional, con dominios que AppIglesia no tiene y roles distintos. El documento del caso plantea la modalidad como individual; el proyecto se trabaja en conjunto y el arnés es compartido por el equipo.

## Opciones consideradas
1. **Complementar en un solo sistema:** AppIglesia pasa a ser la gestión interna de cada iglesia y Ecclesia agrega lo nacional, lo público y los dominios nuevos. A favor: conserva el trabajo y una sola visión. En contra: hay que migrar a varias iglesias y cuidar que lo heredado no quite tiempo a lo que evalúa el caso.
2. **Módulos de Ecclesia aparte, con AppIglesia congelada:** menos riesgo inicial; en contra: dos sistemas en un repositorio, con roles y usuarios duplicados.
3. **Rehacer desde cero:** en contra: desperdicia infraestructura ya probada.

## Decisión
**Opción 1.** `Iglesia` reemplaza a la fila única de configuración; las entidades de gestión interna reciben `iglesiaId` y pasan por `alcanceIglesia`; los roles se unifican (`specs.md §12.3`). Los dominios del caso son módulos nuevos. Misas y diezmo no se fuerzan sobre `Evento` ni `Donacion`, porque sus reglas son distintas. Los reportes y el dashboard se limitan a la iglesia del usuario.

## Consecuencias
- Los requerimientos heredados no tienen origen en el caso: quedan fuera de la matriz de trazabilidad y su continuidad se pregunta al cliente (P-20).
- Si un heredado contradice al caso, gana el caso.
- `schema.prisma` cambia con PR propio revisado por Santiago y los dueños de los modelos.
- El reparto cambia: `usuarios` queda con Santiago, su dueño actual en AppIglesia.
- La adaptación de los módulos heredados debe caber en la Fase 1; si no alcanza el tiempo, tiene prioridad lo que pide el caso.
