# Rutas de diezmo y espacios (E4-04)

> **Dueño:** Oscar · **Cubre:** RF-60–RF-82, RN-40–RN-54, CA-20–CA-29 de [requerimientos.md](../requerimientos.md) · **Estado:** propuesta de diseño, sin código. E4-05 la reúne con las de los demás en OpenAPI y Postman.
> Convenciones de [`specs.md §7.1`](../../specs.md): base `/api/v1`, JSON en `camelCase`, `{ data, meta? }` y `{ error: { code, message, details? } }`, listados paginados con `?page&limit`. Los montos viajan como **texto** (`"1250.50"`), nunca como número.

## Reglas comunes

- **Públicas** (`/public/...`): sin sesión, nunca devuelven datos privados (RNF-01, RNF-08).
- **Panel** (`/iglesias/:iglesiaId/...`): JWT + `autorizar(permiso)` + `alcanceIglesia`. El middleware compara la iglesia del usuario con la **del recurso leída de la BD**, no con la del cliente; si no coincide responde 403 (RNF-10, ADR-0004). Un recurso que no existe en esa iglesia responde 404.
- **Reglas de negocio** salen de `dominio/` y el `service` las traduce a errores:

| Resultado del dominio | HTTP | `code` |
|---|---|---|
| `MONTO_INVALIDO` | 400 | `VALIDATION_ERROR` (con `details[].campo = "monto"`) |
| `YA_TIENE_CAPTURA` | 409 | `CONFLICT` |
| `MISA_NO_CELEBRADA`, `SIN_CAMBIO` | 422 | `BUSINESS_RULE` |
| `ACTOR_NO_AUTORIZADO` | 403 | `FORBIDDEN` |
| `TRANSICION_NO_PERMITIDA`, `COTIZACION_VENCIDA`, `COTIZACION_VIGENTE` | 422 | `BUSINESS_RULE` |

- **Vencimiento de la cotización:** no hay tarea programada. El estado se calcula al consultar o al responder con `estadoEfectivo(solicitud, ahora)`; cuando se detecta vencida se guarda `VENCIDA`. Así el panel, la persona y los reportes ven el mismo estado.
- **Permisos nuevos** (formato `modulo:accion`): `diezmo:capturar`, `diezmo:leer`, `espacios:leer`, `espacios:gestionar`. A quién se asignan depende de P-21 y P-28; mientras tanto: `TESORERO` → `diezmo:*`; `ADMIN_IGLESIA` → `espacios:*`.

## Diezmo (panel)

La misa es la `MisaCelebrada` de Genaro (E4-12 acuerda cómo se llama su ruta y qué expone).

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `POST` | `/iglesias/:iglesiaId/misas-celebradas/:misaId/diezmo` | `diezmo:capturar` | Captura el monto. Body `{ monto }`. 201 con la captura. 400 monto inválido · 422 misa no celebrada · 409 ya tiene captura | RF-60, RF-61, RN-40, RN-41, CA-20, CA-21 |
| `GET` | `/iglesias/:iglesiaId/misas-celebradas/:misaId/diezmo` | `diezmo:leer` | Captura vigente con su historial de correcciones (quién, cuándo, cantidad anterior). 404 si aún no hay | RF-63, RN-43 |
| `PATCH` | `/iglesias/:iglesiaId/misas-celebradas/:misaId/diezmo` | `diezmo:capturar` | Corrige el monto. Body `{ monto }`. Guarda la corrección en la misma transacción. 400 · 404 · 422 sin cambio | RF-62, RN-42, RN-43, CA-22 |
| `GET` | `/iglesias/:iglesiaId/diezmos?desde&hasta` | `diezmo:leer` | Lista paginada de capturas del periodo, con misa, padre y monto | RF-64 |
| `GET` | `/iglesias/:iglesiaId/diezmo/resumen?desde&hasta` | `diezmo:leer` | `{ misas, total, promedio, conMas[], conMenos[] }` | RF-64, RF-65, RN-45, CA-23 |
| `GET` | `/iglesias/:iglesiaId/diezmo/agrupado?desde&hasta&por=dia\|semana\|mes\|horario\|padre` | `diezmo:leer` | `[{ clave, misas, total }]`, con día, semana, mes y horario en la hora local de la iglesia | RF-66–RF-68, CA-24 |

- `desde` y `hasta` son fechas `yyyy-MM-dd` en la zona horaria de la iglesia (como en eventos). Si falta alguna, el periodo por omisión es el mes en curso.
- No hay `DELETE`: una captura no se borra, se corrige (RN-42).
- Sumas, promedio y agrupación se calculan **en SQL** sobre `Decimal(12,2)`; `dominio/reportes.ts` define el resultado esperado.

## Espacios (público)

Sin sesión. Los datos de contacto nunca salen de estas rutas.

| Método | Ruta | Qué hace | Cubre |
|---|---|---|---|
| `GET` | `/public/iglesias/:iglesiaId/espacios` | Tipos de espacio que ofrece la iglesia, **sin precios** | RF-71, RN-47, RN-48 |
| `POST` | `/public/iglesias/:iglesiaId/solicitudes-espacio` | Crea la solicitud. Body `{ tipoEspacioId, contacto: { nombre, telefono?, correo? }, comentarios? }`. 201 con `{ folio, clave }`; **la clave se muestra una sola vez** | RF-72, RF-73, RN-49, CA-26 |
| `POST` | `/public/solicitudes-espacio/:folio/consulta` | Estado y cotización de la solicitud. Body `{ clave }` | RF-74, CA-26 |
| `POST` | `/public/solicitudes-espacio/:folio/aceptar` | Acepta el precio. Body `{ clave }`. 422 si venció | RF-78, CA-28, CA-29 |
| `POST` | `/public/solicitudes-espacio/:folio/rechazar` | Rechaza el precio. Body `{ clave }` | RF-78 |
| `POST` | `/public/solicitudes-espacio/:folio/cancelar` | Cancela. Body `{ clave }`. 422 si ya aceptó | RF-80, RN-52, CA-29 |

- **Folio y clave** (ADR-0004): folio legible tipo `CR-2026-000123`; clave aleatoria de 32 bytes guardada con hash. La clave va en el **cuerpo**, no en la URL, para que no quede en bitácoras.
- Folio inexistente o clave incorrecta responden igual (404 `NOT_FOUND`), para no revelar qué folios existen.
- Límite de intentos en las rutas con clave y en la creación (429 `RATE_LIMITED`). Cifra por definir; propuesta: la del login (5 por minuto por IP).
- Las acciones se validan con `evaluarTransicion(solicitud, accion, 'SOLICITANTE', ahora)`.

## Espacios (panel)

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `GET` | `/iglesias/:iglesiaId/tipos-espacio` | `espacios:leer` | Tipos que ofrece la iglesia | RF-70 |
| `POST` | `/iglesias/:iglesiaId/tipos-espacio` | `espacios:gestionar` | Agrega un tipo (cripta, nicho, columbario u osario). 409 si ya existe | RF-70, RN-47 |
| `PATCH` | `/iglesias/:iglesiaId/tipos-espacio/:id` | `espacios:gestionar` | Cambia el tipo o lo activa o desactiva (no se borra, para conservar las solicitudes) | RF-70 |
| `GET` | `/iglesias/:iglesiaId/solicitudes-espacio?estado&page&limit` | `espacios:leer` | Solicitudes de la iglesia con datos de contacto. `estado` filtra por el estado **efectivo** | RF-75, RN-53 |
| `GET` | `/iglesias/:iglesiaId/solicitudes-espacio/:id` | `espacios:leer` | Detalle con contacto y cotización | RF-75 |
| `POST` | `/iglesias/:iglesiaId/solicitudes-espacio/:id/cotizacion` | `espacios:gestionar` | Cotiza. Body `{ precio, condiciones }`. Fija la fecha de emisión; vale 15 días. 422 si no está Recibida | RF-77, RN-50, RN-51, CA-28 |
| `POST` | `/iglesias/:iglesiaId/solicitudes-espacio/:id/sin-lugar` | `espacios:gestionar` | Registra que no hay lugar. 422 si no está Recibida | RF-76, CA-27 |

- Las acciones del administrador se validan con `evaluarTransicion(..., 'ADMINISTRADOR', ahora)`.
- `precio` es texto con 2 decimales, mayor que cero, con el mismo formato de dinero que el diezmo.

## Se deja fuera (con motivo)

- **RF-81 (usuarios de la Coordinación):** la ruta es de Santiago (`/usuarios`), solo cambia el rol y la iglesia.
- **RF-82 (alcance por iglesia):** no es una ruta, es `alcanceIglesia` en todas las del panel; lo cubre CA-25.
- **Deseables RF-85 y RF-86:** comparar diezmo entre iglesias y el inventario de criptas se diseñan si alcanza el tiempo. Sería `GET /diezmo/comparativo` solo para `COORDINACION`, y recursos de inventario ligados a una solicitud aceptada.

## Puntos abiertos que afectan las rutas

- **P-21, P-28:** quién ve los reportes de diezmo y quién captura (cambia los permisos de las tablas).
- **P-22:** qué es «misa celebrada» fija si la ruta exige que exista la `MisaCelebrada` (hoy se supone que sí).
- **P-25:** qué datos de contacto y de solicitud se piden, y si el folio es único en el país o por iglesia (cambia el formato del folio y el cuerpo del `POST`).
- **P-26, P-27:** si se puede volver a cotizar tras rechazo o vencimiento (agregaría rutas o permitiría `cotizacion` desde otros estados).
- **E4-12:** el nombre de la ruta de la misa celebrada y lo que expone Genaro.
