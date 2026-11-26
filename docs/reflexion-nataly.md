# Reflexión sobre el uso de IA — Nataly Marisol Santos Miam

> **Borrador generado con Claude Code a partir de mis entradas en `docs/bitacora-ia.md`.** Los datos son reales; la redacción la voy a reescribir con mis palabras antes de entregarla.

## Contexto

En Ecclesia me tocaron los catálogos del INEGI, las iglesias, el patrimonio con su índice, el ranking de iglesias reconocidas, la búsqueda del investigador y las pantallas públicas (RF-01 a RF-23), además de miembros y ministerios de la gestión interna. Usé una sola herramienta, Claude Code, con el flujo del curso: plan, aprobación, paso pequeño, verificaciones y revisión. Registré 26 entradas en la bitácora entre el 6 y el 25 de noviembre: en 17 la IA cometió algún error y en 9 no.

## Lo que la IA hizo bien

- **Trabajo largo y repetitivo con reglas claras.** Implementó el índice patrimonial como función pura con los criterios leídos de la base de datos, el ranking, la búsqueda y la ficha pública, con pruebas por cada regla (entradas 47, 48 y 51). Los números de los criterios de aceptación (35.5, 33.1 y 40.5) se recalcularon con el código y coincidieron.
- **Aplicó lo aprendido.** Después de que la Auditoría 2 encontró que mis `PATCH` validaban solo lo que llegaba y no lo guardado (entrada 23), esa regla se usó desde el inicio en `editarObjeto()` y ya no volvió a pasar (entrada 48).
- **Revisión visual con evidencia.** En el estilo colonial revisó 15 secciones a 360 y 1280 px, en claro y en oscuro, y comprobó que no hubiera desplazamiento horizontal (entradas 60 a 63). También midió contrastes con la fórmula de WCAG en lugar de suponerlos (entrada 58).
- **Integración con el trabajo de los demás.** Tomó los services de Oscar y de Genaro para la ficha en lugar de reescribir sus consultas, y respetó a los dueños de cada módulo (entradas 54 y 59).

## Sus errores

Los agrupo por tipo, porque se repitieron patrones:

1. **Inventar o suponer datos.** Escribió entre comillas tres «citas» del caso que no existían (entrada 6), números de párrafo del caso que no comprobó (53) y un contraste de 12:1 que nunca midió; el real era 9.90:1 (58).
2. **No leer el contrato antes de programar.** Creó la lista pública con una ruta distinta a la de mi propio diseño de rutas (49) y enlazó documentos que solo existían en ramas de Oscar (55).
3. **Errores al editar con scripts o reemplazos.** Un `sed` cambió también una prueba que no tocaba (51), un script de YAML quitó las barras invertidas de los patrones (50), al resolver un conflicto de `schema.prisma` duplicó relaciones (54) y escribió un carácter BOM invisible en una expresión regular (22).
4. **No pensar en el estado intermedio ni en todos los casos.** Guardar estado y municipio en dos sentencias rompía un `CHECK` de la base y daba 500 (21). Una ruta padre con `path: ''` dejaba sin inicio a la Coordinación (52). Cerrar sesión desde `/` no hacía nada porque el router ignora ir a la misma URL (75).
5. **Detalles visuales.** Etiquetas cortadas a 200 px (56), un monto encimado con un botón por una celda con `display: flex` (65) y un foco de teclado invisible en la barra (66).

## Cómo los detecté

- **Pruebas automáticas:** las mías (21) y las de mis compañeros (52, con las de Oscar).
- **Herramientas:** ESLint (22) y `prisma validate` (54) los marcaron antes de correr las pruebas.
- **Leer el diff y releer lo generado antes del commit:** así salieron 49, 50, 51, 53 y 55.
- **Comparar contra la fuente:** un script comparó las 63 citas contra el texto del caso; 3 no estaban (6).
- **Abrir la pantalla:** con capturas a varios anchos y en modo oscuro (56, 64, 65, 75).
- **Revisión de otras personas:** la Auditoría 2 de Oscar (23) y Santiago navegando con el teclado (66). Hubo errores que ni las pruebas ni yo veíamos y que solo salieron porque otro integrante revisó.

## Qué aprendí

- **La IA escribe con mucha seguridad aunque no haya comprobado nada.** Ahora pido que cada número, cita o archivo mencionado se compruebe con el código o con el documento antes de aceptarlo.
- **El contrato va primero.** Antes de crear un endpoint hay que leer el diseño de rutas del dueño; lo anoté como regla para el arnés.
- **Los cambios masivos con `sed` o scripts son peligrosos.** Se revisa el diff completo y se valida (lint, `prisma validate`, pruebas) después de cada integración.
- **En un `PATCH`, las reglas entre campos se validan contra lo guardado**, no solo contra lo que llega.
- **«Pasan las pruebas» no es lo mismo que «funciona».** Varios errores solo se vieron al abrir la pantalla o al navegar con el teclado.
- **La revisión de mis compañeros es parte del proceso**, no un trámite: encontró errores que la IA y yo dejamos pasar.

En resumen, la IA me ahorró mucho tiempo en lo repetitivo y en lo que tenía reglas claras, pero la responsabilidad de comprobar fue siempre mía. Las reglas que salieron de estos errores las anoté en la bitácora como reglas para el arnés, para que no se repitan.
