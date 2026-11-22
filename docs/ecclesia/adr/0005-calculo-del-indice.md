# ADR-0005: Índice patrimonial como función pura con criterios en BD y aritmética en décimas

- **Estado:** Aceptado · **Fecha:** 2026-11-06 · **Decide:** Nataly (dueña) y Santiago (arnés)
- **Requerimientos relacionados:** RN-01–RN-06, CA-01, RNF-13

## Contexto
El índice suma puntos por antigüedad × multiplicador por tipo + 5 si es INAH. El cliente quiere «ajustarlos sin tener que reprogramar». Con flotantes, `7 × 1.3` da `9.100000000000001` y los límites de distinción (20, 40) pueden fallar por una millonésima.

## Opciones consideradas
1. **Calcular en SQL** — difícil de probar y de ajustar.
2. **Guardar el índice ya calculado** — rápido de leer, pero se desactualiza al cambiar criterios u objetos.
3. **Función pura en `dominio/` + criterios como datos**, recalculada al consultar (con caché si hace falta).

## Decisión
**Opción 3.** `indiceIglesia(objetos, anioCalculo, criterios)` en `iglesias/dominio/indice-patrimonial.ts`:
- Criterios (rangos de edad, multiplicadores, puntos INAH, distinciones) en una tabla `CriteriosIndice` editable por la Coordinación.
- Aritmética en **décimas enteras** (multiplicadores con un decimal); se divide entre 10 solo al final.
- Siglo → mitad del siglo (`(siglo − 1) × 100 + 50`).
- El año de cálculo entra como parámetro (por defecto, el año actual en la zona de la iglesia).

## Consecuencias
- Prueba CA-01 con el ejemplo del cliente: **35.5 → Alto valor patrimonial** (pasa; ver `arnes-ia/stacks/express/modulo-referencia`).
- Si un criterio necesita más de un decimal, hay que cambiar la escala (de décimas a centésimas): queda anotado aquí.
- Ranking: se calcula sobre iglesias activas con al menos un objeto vigente.
