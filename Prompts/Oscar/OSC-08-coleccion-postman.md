# OSC-08 · Colección de Postman del equipo

- **Integrante:** Oscar (líder: «reúne OpenAPI y Postman», `specs.md §12.6`)
- **Cubre:** el entregable «OpenAPI y Postman» de la entrega final (`specs.md §12.8`)
- **Estado:** usado (rama `feat/postman-coleccion`)
- **Antes de usar:** se puede correr ya. Cuando entre el PR #34 de Genaro, basta con volver a generar la colección para que incluya sus rutas.

```text
Soy Oscar Michel Matos May, líder del equipo. La entrega final pide «OpenAPI y Postman» y en main no hay ninguna colección de Postman. Quiero una colección generada desde backend/openapi.yaml, para que no se desfase cuando cada quien agregue rutas.

BASE
Crea la rama feat/postman-coleccion desde origin/main actualizado (git fetch --prune antes). Lee AGENTS.md, CLAUDE.md, specs.md §7 y §12.5, backend/openapi.yaml, backend/src/routes.ts y backend/src/rutasProtegidas.test.ts.

QUÉ HACER
1. Cobertura de OpenAPI (primero, porque la colección sale de ahí):
   - Compara las rutas que registra Express (como lo hace rutasProtegidas.test.ts) con los paths de openapi.yaml y dame la lista de lo que falta o sobra, con el dueño de cada ruta (specs.md §9 y §12.6).
   - Agrega una prueba que falle si una ruta de Express no está en openapi.yaml. Si hoy faltan rutas ajenas, NO las documentes tú: deja una lista de excepciones con su dueño y un comentario «pendiente de <integrante>», para que la prueba pase y la deuda quede a la vista.
2. Generador (sin dependencias nuevas: el backend ya tiene `yaml`):
   - Script backend/scripts/generar-postman.ts con su comando `pnpm --filter backend postman`.
   - Lee openapi.yaml y escribe docs/postman/ecclesia.postman_collection.json (formato Postman v2.1) y docs/postman/local.postman_environment.json.
   - Carpetas por grupo (auth, usuarios, iglesias, diezmo, espacios, public…), con el método, la ruta y los parámetros de path y query; el cuerpo de ejemplo sale de los `example` del esquema cuando existen.
   - Variables: baseUrl (http://localhost:3000/api/v1), accessToken, iglesiaId, y para espacios folio y clave. Ningún secreto real: las contraseñas del entorno son las del seed de desarrollo (SEED_PASSWORD de .env.example) y van marcadas como de prueba.
   - Autenticación Bearer {{accessToken}} a nivel de colección. Las rutas públicas de openapi (`security: []`) quedan sin autenticación.
   - Una carpeta «0. Iniciar sesión» con un login por rol (coordinacion, admin, tesorero…) cuyo script de prueba guarde accessToken y, si viene, iglesiaId.
   - Una carpeta «Recorrido de la demo», escrita a mano en el script (no sale de openapi): login de tesorero → misas y diezmo de su iglesia → reporte de diezmo; solicitud pública de espacio → guarda folio y clave → consulta → login de admin → cotiza → aceptación pública. Cada paso con un test de Postman del código HTTP esperado.
   - El resultado debe ser determinista: correr el comando dos veces sin cambios en openapi.yaml no cambia el JSON.
3. Prueba del generador (Vitest): la colección tiene un request por cada operación de openapi.yaml, ninguna ruta pública lleva autenticación y no hay ningún valor que parezca un token o un hash.
4. Comprobación real: con el backend levantado sobre la semilla, ejecuta el «Recorrido de la demo» con un script de Node que lea la colección y haga las peticiones con fetch (no instales newman). Dame el resultado paso por paso.
5. docs/postman/README.md (corto): cómo importar la colección y el entorno, el orden para usarla, y que se regenera con `pnpm --filter backend postman` cada vez que cambie openapi.yaml.

REGLAS
- No cambies rutas, controladores ni el contrato. Si openapi.yaml tiene un error en una ruta mía (diezmo, espacios, donaciones, dashboard, reportes), corrígelo en un commit aparte; si es de otro, solo anótalo en la lista.
- Sin dependencias nuevas. Sin secretos. No hagas push.

FORMA DE TRABAJO
Muéstrame primero el plan en máximo 15 líneas, con la lista de rutas que faltan en openapi.yaml, y espera mi aprobación. Luego un commit por paso (prueba de cobertura → generador → recorrido → README). Al final dame el resultado real de pruebas del backend, tsc, eslint, prettier y dependency-cruiser, el número de requests de la colección y el resultado del recorrido. Agrega la entrada en docs/bitacora-ia.md citando OSC-08 y marca la tarea en docs/ecclesia/plan-oscar.md. Cada commit termina en «Asistido-por: Claude Code».
```
