# Rutas de catálogos, iglesias, patrimonio e iglesias reconocidas (E2-04)

> **Dueña:** Nataly · **Cubre:** RF-01–RF-23, RN-01–RN-16, CA-01–CA-09 de [requerimientos.md](../requerimientos.md) · **Estado:** propuesta de diseño, sin código. Oscar la reúne con las de los demás en OpenAPI y Postman (E4-05).
> Convenciones de [`specs.md §7.1`](../../specs.md): base `/api/v1`, JSON en `camelCase`, `{ data, meta? }` y `{ error: { code, message, details? } }`, listados paginados con `?page&limit` (por omisión 20, máximo 100). Mismo formato que `api-diezmo-espacios.md` de Oscar (rama `feat/E4-diezmo-completo`).

## Reglas comunes

- **Públicas** (`/public/...`): sin sesión, solo **iglesias activas** y **objetos vigentes**; nunca devuelven datos que P-05 marque como privados (RNF-01, RN-07, RN-11).
- **Panel**: JWT + `autorizar(permiso)`. Las rutas de una iglesia (`/iglesias/:iglesiaId/...`) pasan además por `alcanceIglesia`, que compara con la iglesia del recurso leída de la BD (RNF-10, ADR-0004).
- **Índice y distinción** salen siempre de `dominio/indice-patrimonial.ts` con los criterios vigentes y el año de cálculo (ADR-0005, RN-14, RN-15). No se guardan en la BD.
- **Ubicación** con claves del INEGI: `estado` (2 dígitos), `municipio` (5) y `localidad` (9), como en el modelo de [plan-nataly.md](plan-nataly.md).

| Situación | HTTP | `code` |
|---|---|---|
| Campo inválido, objeto sin año ni siglo (RN-10), clave que no existe en el catálogo | 400 | `VALIDATION_ERROR` (con `details[].campo`) |
| El municipio no es del estado o la localidad no es del municipio (RN-09) | 400 | `VALIDATION_ERROR` (`details[].campo = "municipio"` o `"localidad"`) |
| Iglesia que ya existe con ese nombre en el mismo municipio | 409 | `CONFLICT` |
| Editar una iglesia cerrada o cerrar una que ya lo está | 422 | `BUSINESS_RULE` |
| Iglesia de otro usuario de iglesia | 403 | `FORBIDDEN` |
| Iglesia cerrada o inexistente en una ruta pública | 404 | `NOT_FOUND` |

- **Permisos nuevos** (formato `modulo:accion`): `catalogos:gestionar`, `iglesias:editar`, `iglesias:cerrar`, `patrimonio:leer`, `patrimonio:gestionar`, `criterios:leer`, `criterios:editar`. `iglesias:leer` e `iglesias:crear` ya existen en el módulo mínimo de Oscar. Propuesta mientras se responde P-04: `COORDINACION` → todos los de iglesias, catálogos y criterios; `ADMIN_IGLESIA` → `iglesias:editar` (la suya), `patrimonio:*`.

## Catálogos (público)

| Método | Ruta | Qué hace | Cubre |
|---|---|---|---|
| `GET` | `/public/estados` | Los 32 estados `[{ clave, nombre }]`, sin paginar | RF-01, RF-09 |
| `GET` | `/public/estados/:clave/municipios` | Municipios del estado, sin paginar | RF-02, RF-09 |
| `GET` | `/public/municipios/:clave/localidades` | Localidades del municipio que tienen iglesias | RF-02, RF-09 |

## Catálogos (panel)

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `POST` | `/catalogos/importacion` | `catalogos:gestionar` | Carga o actualiza estados, municipios y localidades desde el archivo oficial del INEGI (CSV, multipart). Responde cuántos se agregaron y actualizaron. Nunca borra una clave que use una iglesia | RF-10, RNF-05 |

## Iglesias (público)

| Método | Ruta | Qué hace | Cubre |
|---|---|---|---|
| `GET` | `/public/iglesias?estado&municipio&localidad&tipo&q&capacidadMin&page&limit` | Iglesias activas del estado (obligatorio). Cada una con `id`, `nombre`, `tipo`, municipio, localidad, `indice` y `distincion` | RF-01–RF-05, RF-18, RN-07, CA-02, CA-03 |
| `GET` | `/public/iglesias/:id` | Ficha completa (ver abajo). 404 si está cerrada | RF-06, RF-16, RF-18, CA-04 |
| `GET` | `/public/reconocidas?estado&municipio&localidad&page&limit` | Ranking: iglesias activas con objetos, de mayor a menor índice. Sin filtro de lugar es el ranking nacional; acepta un solo nivel de lugar | RF-19–RF-21, RN-12, RN-13, CA-06 |
| `GET` | `/public/busqueda-patrimonio?tipoObjeto&antiguedadMin&estado\|municipio\|localidad&page&limit` | Iglesias activas del lugar con al menos un objeto vigente de ese tipo y antigüedad. Exige un lugar | RF-23, CA-08 |

- `q` busca por nombre sin distinguir mayúsculas ni acentos (sujeto a P-02). `capacidadMin` sigue la propuesta de P-03.
- **Ficha** `GET /public/iglesias/:id`:
  ```json
  { "data": {
    "id": "", "nombre": "", "tipo": "PARROQUIA",
    "ubicacion": { "direccion": "", "localidad": { "clave": "", "nombre": "" },
                   "municipio": { "clave": "", "nombre": "" }, "estado": { "clave": "", "nombre": "" } },
    "capacidad": 400, "anioConstruccion": 1765, "contacto": { "telefono": "", "correo": "" },
    "coordenadas": { "latitud": "19.043100", "longitud": "-98.198200" },
    "indice": 35.5, "distincion": "Alto valor patrimonial", "anioCalculo": 2026,
    "objetos": [ { "id": "", "descripcion": "", "tipo": "IMAGEN", "anio": 1720, "siglo": null,
                   "material": "", "catalogadoInah": true } ],
    "servicios": [], "platicas": [], "misas": [], "tiposEspacio": []
  } }
  ```
  - `coordenadas` se omite si no se conocen. Las coordenadas viajan como texto para no perder decimales.
  - `objetos`: solo vigentes. Si P-05 lo permite, se agregan `estadoConservacion` y `ubicacionEnTemplo`.
  - `servicios` y `platicas` (Genaro), `misas` con su padre (Genaro) y `tiposEspacio` sin precios (Oscar, E4-08) se piden a los `services` de cada dueño, no con consultas propias.
- **Empates** en el ranking: por nombre, hasta que se responda P-07.

## Iglesias (panel)

`GET /iglesias` y `POST /iglesias` ya existen en el módulo mínimo de Oscar; se amplían.

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `GET` | `/iglesias?estado&municipio&tipo&q&situacion=activas\|cerradas\|todas&page&limit` | `iglesias:leer` | Lista nacional para la Coordinación, incluidas las cerradas | RF-12 |
| `POST` | `/iglesias` | `iglesias:crear` | Body con `nombre`, `tipo`, `direccion`, `estado`, `municipio`, `localidad`, `capacidad?`, `anioConstruccion?`, `telefono?`, `correo?`, `latitud?`, `longitud?`, `zonaHoraria`. 400 ubicación inconsistente · 409 nombre repetido en el municipio | RF-07, RF-09, RN-08, RN-09, CA-09 |
| `GET` | `/iglesias/:iglesiaId` | `iglesias:leer` o personal de esa iglesia | Detalle con fecha y motivo de cierre, si aplica | RF-08, RF-12 |
| `PATCH` | `/iglesias/:iglesiaId` | `iglesias:editar` + `alcanceIglesia` | Cambia sus datos. 422 si está cerrada | RF-08, RN-09 |
| `POST` | `/iglesias/:iglesiaId/cierre` | `iglesias:cerrar` | Cierra. Body `{ fecha, motivo }`. Deja `activa = false` sin borrar nada. 422 si ya está cerrada | RF-11, RN-07, CA-02 |

- **Reabrir** una iglesia queda fuera hasta que se responda P-04.

## Patrimonio (panel)

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `GET` | `/iglesias/:iglesiaId/objetos?estado&tipo&page&limit` | `patrimonio:leer` | Todos los objetos de la iglesia, de cualquier estado, con sus puntos | RF-14, RF-15 |
| `POST` | `/iglesias/:iglesiaId/objetos` | `patrimonio:gestionar` | Body `{ descripcion, tipo, anio?, siglo?, material, estadoConservacion, ubicacionEnTemplo, catalogadoInah }`. 400 sin año ni siglo | RF-13, RF-17, RN-10, RN-16 |
| `PATCH` | `/iglesias/:iglesiaId/objetos/:id` | `patrimonio:gestionar` | Cambia sus datos (no el estado) | RF-14 |
| `POST` | `/iglesias/:iglesiaId/objetos/:id/estado` | `patrimonio:gestionar` | Body `{ estado: "PERDIDO" \| "PRESTADO" \| "BAJA", fecha, motivo }`. El objeto deja de contar y no se borra | RF-15, RN-11, CA-05 |

- No hay `DELETE` de objetos (RN-11, RNF-11). Volver a `VIGENTE` un objeto prestado depende de P-08.

## Criterios del índice (panel)

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `GET` | `/criterios-indice` | `criterios:leer` | Criterios vigentes: rangos de antigüedad, multiplicadores, puntos INAH y distinciones | RF-22 |
| `PUT` | `/criterios-indice` | `criterios:editar` | Guarda una versión nueva. Valida que los rangos y las distinciones vayan ordenados y sin huecos, y que los multiplicadores tengan un decimal (ADR-0005) | RF-22, RN-14, CA-07 |
| `GET` | `/criterios-indice/historial` | `criterios:leer` | Versiones anteriores con fecha y quién las cambió | RF-22 |

## Lo que se deja fuera (con motivo)

- **Mapa de iglesias:** son puntos extra y usa una dependencia nueva (E2-20); las coordenadas ya viajan en la ficha.
- **Desglose de puntos por objeto en público:** el caso no lo pide; el panel sí lo muestra en `GET /iglesias/:iglesiaId/objetos`.

## Puntos abiertos que afectan las rutas

- **P-01:** año de cálculo (hoy, el año en curso en la zona de la iglesia).
- **P-02, P-03:** forma de buscar por nombre y de filtrar por capacidad.
- **P-04:** quién cierra y si se reabre (permiso `iglesias:cerrar` y una posible ruta de reapertura).
- **P-05:** qué campos de los objetos son públicos.
- **P-06:** si la lista de tipos de objeto es cerrada.
- **P-07:** iglesias con objetos pero ninguno vigente, sin distinción y empates en el ranking.
- **P-08:** regreso de un objeto prestado.
- **P-09:** varios tipos o un rango de antigüedad en la búsqueda.
- **Con Genaro y Oscar:** nombres de las funciones de sus `services` que usa la ficha.
