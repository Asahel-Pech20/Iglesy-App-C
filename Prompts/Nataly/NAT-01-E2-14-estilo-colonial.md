# NAT-01 · E2-14 y E2-15: estilo colonial de las pantallas públicas

- **Integrante:** Nataly (lo redactó el orquestador de Oscar a partir del ejemplo visual que Nataly eligió con el equipo)
- **Cubre:** E2-14 (pantallas públicas) y el resumen del índice de E2-15; RNF-02 (360 px) y WCAG 2.1 AA
- **Estado:** usado. Plan aprobado por Nataly; commit `8d20a84` en `feat/E2-14-estilo-colonial` (PR #28) y entrada 56 de la bitácora.
- **Notas antes de usar:**
  - Salió del ejemplo «colonial» que eligió el equipo; los números en Inter ligera fueron la opción 2 de la votación.
  - Se ejecutó desde la rama local del PR #20, que ya traía `main` integrado, y no desde `origin/feat/E2-07-lista-publica`.
  - Ajustes que salieron de las capturas: «Cupo mínimo» y «Cupo máximo» en lugar de «Caben al menos / como máximo», y la píldora en un solo renglón.

```text
Lee AGENTS.md (§4 Diseño visual), CLAUDE.md y frontend/src/styles.scss.

BASE
Trabaja sobre la rama del PR #20 de Nataly: crea feat/E2-14-estilo-colonial desde origin/feat/E2-07-lista-publica. Hoy explorar/ y patrimonio/ solo existen ahí. E2-14 y E2-15 son de Nataly: este cambio se le avisa y ella revisa el PR.

TAREA
Aplicar el estilo "colonial" a las pantallas públicas de Ecclesia (E2-14) y darle detalles del mismo estilo al panel de patrimonio (E2-15), SIN cambiar lógica, rutas, servicios ni lo que comprueban las pruebas. Si una prueba falla por un selector, ajusta el selector, nunca lo que la prueba comprueba.

PALETA
- Usa los tokens que ya existen: --primario, --primario-texto, --acento, --acento-texto, --texto, --texto-suave, --superficie, --exito y --peligro.
- Agrega en styles.scss solo dos tokens nuevos, con su versión en .dark:
  - --pergamino (#FBF7EF; oscuro #1A1F2E) para el fondo de lo público.
  - --marco (#E7D7B5; oscuro #5C4A2A) para marcos y líneas decorativas.
- Ningún color suelto en los componentes, tampoco "white". El texto sobre fondo --primario va en --primario-texto, y sobre fondo --acento, en --acento-texto: así se sigue leyendo en modo oscuro, donde esos fondos son claros.

TIPOGRAFÍA
- Títulos (h1, h2, nombres de iglesias y de objetos): font-family Georgia, 'Times New Roman', serif.
- NÚMEROS (índice, puntos y años en las tarjetas) en Inter ligera y grande:
  - font-weight 300, letter-spacing -0.5px y font-variant-numeric: tabular-nums.
  - Tamaños: 26 px en el sello de la ficha y 19-20 px en las tarjetas. Nunca menos de 18 px.
  - Inter ya es variable (@fontsource-variable/inter), así que el peso 300 existe.
- El resto del texto sigue en Inter normal. No instales fuentes nuevas.

ARCHIVOS (solo estos)
- frontend/src/app/features/explorar/:
  - explorar-layout.ts (marco)
  - templos.page.ts (lista)
  - ficha.page.ts
  - reconocidas.page.ts (ranking)
  - busqueda.page.ts
  - tarjeta-iglesia.ts
  - selector-lugar.ts
- frontend/src/app/features/patrimonio/patrimonio.page.ts (solo el resumen del índice)
- frontend/src/styles.scss (solo los dos tokens nuevos)

CAMBIOS
1. Marco público:
   - Fondo --pergamino.
   - Barra superior con fondo --primario y texto --primario-texto. El nombre "Ecclesia" va en serifa.
   - Debajo del nombre, el subtítulo "PATRIMONIO DE MÉXICO": pequeño, con letras espaciadas y en color --marco (es el único que contrasta con el azul en los dos modos).
   - Borde inferior doble de 3 px en --acento.
   - El enlace activo va subrayado en --marco.
2. Títulos de página centrados y en serifa, con un adorno debajo: dos líneas --marco y la cruz de lucide (Cross) pequeña en --acento al centro.
3. Tarjeta de iglesia:
   - Fondo --superficie, borde de 1 px --marco, outline de 1 px --marco con outline-offset de 3 px (doble marco) y radio de 4 px.
   - Arriba, el tipo y el año en mayúsculas pequeñas.
   - A la derecha, el índice en Inter ligera grande: --acento si es sobresaliente, --primario si es alto y --texto-suave si no tiene distinción.
4. Distinciones como píldoras:
   - Sobresaliente: fondo --acento, texto --acento-texto e ícono Award.
   - Alto valor: fondo --primario y texto --primario-texto.
   - Valor patrimonial: borde --exito.
   - Sin distinción: borde --marco y texto --texto-suave.
5. Ficha:
   - Encabezado con fondo --primario, centrado. El nombre va en serifa y "TIPO · LUGAR · AÑO" debajo, todo en --primario-texto.
   - Debajo del encabezado y sobre --superficie o --pergamino (nunca dentro del azul), un sello del índice: círculo de 2 px --acento más un outline de 1 px con offset de 3 px, y el número en Inter ligera de 26 px.
   - Datos con íconos en --acento.
   - La sección "Patrimonio" lleva el mismo adorno de cruz.
   - "INAH" como píldora con borde --primario.
6. Filtros:
   - Los campos llevan borde --acento o conservan el contorno de Material. NO uses --marco en los campos: no llega al contraste de 3:1 que exige un borde de control (WCAG 1.4.11).
   - Etiquetas pequeñas en mayúsculas, en --primario.
   - En computadora (768 px o más), los filtros van en un panel a la izquierda (unos 200 px) y las tarjetas en 2 columnas (3 desde 1200 px), con un ancho máximo de 64rem centrado.
   - En celular, todo en una columna.
7. Panel de patrimonio: el resumen del índice usa el mismo sello dorado y los mismos números en Inter ligera. El resto del panel no cambia.

REGLAS
- Modo oscuro (.dark) legible y contraste mínimo de 4.5:1 en texto (WCAG AA). Revisa sobre todo los números dorados delgados sobre el pergamino: dan 4.7:1, justo en el límite. Si en la captura no se leen bien, súbelos a font-weight 400 en ese caso y avísame.
- Sin desplazamiento horizontal a 360 px (RNF-02).
- Íconos solo de lucide-angular. Sin dependencias nuevas.
- No toques componentes compartidos de F1 (compartido/ y core/), salvo los dos tokens de styles.scss, ni pantallas de otros integrantes.
- No hagas push.

FORMA DE TRABAJO
Primero muéstrame un plan con los archivos a cambiar. No escribas código hasta que lo apruebe. Al terminar:
- Corre pruebas del frontend, typecheck, lint, formato y ng build, y dame el resultado real.
- Toma capturas a 360 px y a 1280 px, en claro y en oscuro.
- Agrega la entrada en docs/bitacora-ia.md.
- Haz un commit local que termine en «Asistido-por: Claude Code».
```
