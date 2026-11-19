---
description: Escribe pruebas para requerimientos, reglas de negocio y criterios de aceptación
argument-hint: <archivo o módulo> <IDs>
---

# Prompt: pruebas

Escribe pruebas para **<archivo o módulo>** que cubran **<RN-xx, CA-yy, RF-zz>**.

## Qué probar
1. **Reglas de negocio (RN):** prueba unitaria de la función pura de `dominio/`, con los valores **límite** (p. ej. 49/50, 99/100, 299/300 años; 19.99/20 y 39.99/40 puntos).
2. **Criterios de aceptación (CA):** una prueba por CA, con nombre `CA-yy: <flujo>` y estructura Dado / Cuando / Entonces. Usa los datos exactos del caso cuando existan.
3. **Endpoints:** feliz, 400, 401/403 y cada error de negocio (409/422).
4. **Alcance:** un usuario de otra organización recibe 403 (o 404 si así lo define el contrato).

## Reglas
- La prueba debe **fallar** si quitas la regla (pruébalo mentalmente o de verdad y dilo).
- Sin `it.skip`, sin `only`, sin depender del reloj real: el «ahora» se inyecta.
- Usa la BD de pruebas, nunca la de desarrollo.

## Al terminar
Muestra la salida de las pruebas y la cobertura del módulo (meta ≥ 70 % en dominio y services).
