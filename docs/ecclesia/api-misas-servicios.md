# Rutas de servicios, pláticas, misas y padres (E3-03)

> **Dueño:** Genaro · **Cubre:** RF-30–RF-52, RN-20–RN-33, CA-10–CA-17 y los deseables RF-83 y RF-84 de [requerimientos.md](../requerimientos.md) · **Estado:** implementado en `main` (PR #34); RF-83 y RF-84 en el PR #40. Este documento describe lo que ya está programado; el detalle de cada campo está en [`backend/openapi.yaml`](../../backend/openapi.yaml) y la colección para probarlas en [`postman/misas-servicios.postman_collection.json`](postman/misas-servicios.postman_collection.json).
> Convenciones de [`specs.md §7.1`](../../specs.md): base `/api/v1`, JSON en `camelCase`, `{ data, meta? }` y `{ error: { code, message, details? } }`. Mismo formato que [`api-iglesias-patrimonio.md`](api-iglesias-patrimonio.md) y [`api-diezmo-espacios.md`](api-diezmo-espacios.md).

## Reglas comunes

- **Públicas** (`/public/...` y la ficha `GET /public/iglesias/:iglesiaId`): sin sesión, solo iglesias activas y lo que está activo. Nunca devuelven IDs internos ni datos del padre más allá de «título + nombre» (RN-33, P-19).
- **Panel**: JWT + `autorizar(permiso)`. Las rutas de una iglesia (`/iglesias/:iglesiaId/...`) pasan además por `alcanceIglesia`: el personal solo toca su iglesia (RN-32, RNF-10) y una iglesia cerrada no acepta cambios.
- **Hora local**: el día (`diaSemana`, 0 = domingo) y la hora (`HH:mm`) son los de la iglesia, sin convertir a la de quien consulta (RN-31, RF-52). Los choques se comparan en el momento real (UTC) con la zona horaria de cada iglesia (P-15, `misas/dominio/solapes.ts`).
- **Bajas lógicas**: quitar un servicio, una plática o una misa del horario la da de baja (`activo = false`); no se borra.

| Situación | HTTP | `code` |
|---|---|---|
| Campo inválido o desconocido; costo incoherente con su forma (RN-22); sustitución sin motivo | 400 | `VALIDATION_ERROR` (con `details[].campo`) |
| Sin sesión | 401 | `UNAUTHENTICATED` |
| Rol sin el permiso, o iglesia de otro usuario | 403 | `FORBIDDEN` |
| Padre, horario, servicio o plática que no existe o es de otra iglesia; iglesia cerrada o inexistente en una ruta pública | 404 | `NOT_FOUND` |
| El padre ya tiene una misa que se empalma (RN-26): el mensaje dice el día, la hora y la iglesia de la otra misa · nombre repetido · misa ya registrada en esa fecha | 409 | `CONFLICT` |
| Padre que no es de la iglesia; quitar a un padre con misas en el horario; misa con fecha futura o en otro día del horario; iglesia cerrada | 422 | `BUSINESS_RULE` |

**Permisos** (`config/permisos.ts`):
- `misas:programar` (`ADMIN_IGLESIA`): padres de su iglesia y horario semanal.
- `misas:leer` (`ADMIN_IGLESIA`, `TESORERO`): consultar padres, horario y misas celebradas.
- `misas:registrar` (`ADMIN_IGLESIA`): registrar misas celebradas.
- `servicios:gestionar` (`ADMIN_IGLESIA`): servicios y pláticas.
- `padres:gestionar` (`COORDINACION`): padres de todo el país. La Coordinación consulta padres y horario de cualquier iglesia, pero **no** recibe `misas:leer`: las misas celebradas van con el diezmo, que es privado.

## Padres

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `GET` | `/padres?q&page&limit` | `padres:gestionar` o `misas:programar` | Busca padres de todo el país con sus iglesias (la iglesia busca antes de crear uno) | RF-40, RF-41, P-19 |
| `POST` | `/padres` | `padres:gestionar` | La Coordinación crea un padre `{ nombre, titulo? }`; nombre repetido → 409 | RF-40, P-19 |
| `PATCH` | `/padres/:padreId` | `padres:gestionar` | Corrige `nombre`, `titulo` o lo da de baja (`activo: false`); con misas en algún horario → 422 | RF-40, P-19 |
| `GET` | `/padres/:padreId/agenda?semana=AAAA-MM-DD` | `padres:gestionar` o `misas:leer` | Agenda semanal: sus misas de todas las iglesias, en la hora local de cada una y en orden real. Sin `semana`, la actual. Otra iglesia → 403 | RF-47, CA-17, P-18 |
| `GET` | `/iglesias/:iglesiaId/padres` | `misas:leer` o `padres:gestionar` | Padres asociados a la iglesia | RF-40, RF-41 |
| `POST` | `/iglesias/:iglesiaId/padres` | `misas:programar` o `misas:registrar` | Crea un padre y lo asocia a la iglesia; si ya existe → 409 (se asocia con `PUT`) | RF-40 |
| `PUT` | `/iglesias/:iglesiaId/padres/:padreId` | `misas:programar` | Asocia un padre que ya existe (el párroco atiende sus capillas) | RF-41, RN-28 |
| `DELETE` | `/iglesias/:iglesiaId/padres/:padreId` | `misas:programar` | Lo desasocia sin borrarlo; si tiene misas en el horario → 422 | RF-41 |

## Horario semanal de misas

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `GET` | `/iglesias/:iglesiaId/horario-misas` | `misas:leer` o `padres:gestionar` | Horario por día y hora con su padre | RF-42, RF-43 |
| `POST` | `/iglesias/:iglesiaId/horario-misas` | `misas:programar` | Programa una misa `{ diaSemana, hora, tipo, idioma?, duracionMin?, padreId }`. `tipo`: `DIARIA`, `DOMINICAL` o `ESPECIAL`; `idioma` por omisión `ESPANOL` (también lenguas indígenas); `duracionMin` por omisión 60. Choque del padre → 409 con la misa con la que choca | RF-42, RF-43, RF-45, RF-46, RN-20, RN-21, RN-26, RN-27, CA-13, CA-14 |
| `PATCH` | `/iglesias/:iglesiaId/horario-misas/:horarioId` | `misas:programar` | Cambia la misa y vuelve a revisar los choques (la propia no choca consigo) | RF-45, CA-13 |
| `DELETE` | `/iglesias/:iglesiaId/horario-misas/:horarioId` | `misas:programar` | Baja lógica; libera la hora | RF-42 |

## Misas celebradas

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `GET` | `/iglesias/:iglesiaId/misas-celebradas?desde&hasta&page&limit` | `misas:leer` | Misas celebradas con quién la dio, la sustitución (programado, quién cambió, motivo y fecha) y su diezmo si existe | RF-51 |
| `POST` | `/iglesias/:iglesiaId/misas-celebradas` | `misas:registrar` | Dos formas: **desde el horario** `{ horarioMisaId, fecha, padreId?, motivo? }` (si `padreId` es otro, es una sustitución y el motivo es obligatorio) o **suelta**, la del diezmo, `{ inicio, padreId }`. Solo misas que ya empezaron; una por misa del horario y fecha (409); el sustituto debe ser de la iglesia (422) y estar libre a esa hora (409). La sustitución no se edita ni se borra | RF-48–RF-50, RN-29, RN-30, CA-15, P-17 |
| `GET` | `/iglesias/:iglesiaId/semana-misas?semana=AAAA-MM-DD` | `misas:leer` | *(Deseable, supuesto P-29.)* La semana armada desde el horario: cada misa con su fecha, el padre programado y su estado (`REGISTRADA`, `PENDIENTE` si ya empezó y falta, o `FUTURA`). `semana` es cualquier día; sin él, la actual | RF-84 |
| `POST` | `/iglesias/:iglesiaId/misas-celebradas/semana` | `misas:registrar` | *(Deseable.)* `{ semana? }`: registra de una vez las pendientes con su padre programado, con el mismo registro que una misa individual. Responde `creadas`, `yaRegistradas`, `futuras` y `omitidas` (con motivo). Una sustitución se registra antes, misa por misa | RF-84 |

El registro del diezmo de una misa (`/misas-celebradas/:misaId/diezmo`) es de Oscar: ver [`api-diezmo-espacios.md`](api-diezmo-espacios.md).

## Servicios y pláticas (panel)

| Método | Ruta | Permiso | Qué hace | Cubre |
|---|---|---|---|---|
| `GET` | `/iglesias/:iglesiaId/servicios` | `servicios:gestionar` | Servicios activos de la iglesia | RF-30–RF-34 |
| `POST` | `/iglesias/:iglesiaId/servicios` | `servicios:gestionar` | `{ nombre, formaCosto, monto?, requisitos?, duracionMin?, requiereCita?, horarios? }`. `formaCosto`: `MONTO` (monto > 0 obligatorio), `GRATUITO` (sin monto) o `DONATIVO` (monto sugerido opcional). `horarios`: `[{ diaSemana, hora }]`, hasta 21, sin repetir. Nombre repetido en la iglesia → 409 | RF-30–RF-33, RN-22, RN-23, CA-10, P-10–P-12 |
| `PATCH` | `/iglesias/:iglesiaId/servicios/:servicioId` | `servicios:gestionar` | Modifica; los horarios se reemplazan completos y el costo se revisa con los datos combinados | RF-34 |
| `DELETE` | `/iglesias/:iglesiaId/servicios/:servicioId` | `servicios:gestionar` | Baja lógica | RF-34 |
| `GET` | `/iglesias/:iglesiaId/platicas` | `servicios:gestionar` | Pláticas activas | RF-36, RF-37 |
| `POST` | `/iglesias/:iglesiaId/platicas` | `servicios:gestionar` | `{ tipo, sesiones, costo, cupo, lugar, imparte, padreId?, horarios }`. `tipo`: `PREBAUTISMAL`, `PRIMERA_COMUNION`, `CONFIRMACION` o `PREMATRIMONIAL`; `costo` en string con 2 decimales (`"0.00"` = gratuita); al menos un horario; `padreId` opcional, de la misma iglesia (422 si no) | RF-36, RN-24, RN-25, CA-11, P-13, P-14 |
| `PATCH` | `/iglesias/:iglesiaId/platicas/:platicaId` | `servicios:gestionar` | Modifica; horarios reemplazados | RF-37 |
| `DELETE` | `/iglesias/:iglesiaId/platicas/:platicaId` | `servicios:gestionar` | Baja lógica | RF-37 |

## Consultas públicas (sin sesión)

| Método | Ruta | Qué hace | Cubre |
|---|---|---|---|
| `GET` | `/public/iglesias/:iglesiaId` | La ficha de Nataly (E2-11) trae `misas` (día, hora, tipo, idioma, duración y «título + nombre» del padre), `servicios` y `platicas`, sin IDs | RF-35, RF-38, RF-44, RF-52, RN-33, CA-10, CA-12, CA-16 |
| `GET` | `/public/iglesias/:iglesiaId/platicas?tipo=` | «¿Cuándo son las pláticas de bautizo?»: `?tipo=PREBAUTISMAL`. Iglesia cerrada o inexistente → 404 | RF-38, RF-39, CA-11 |
| `GET` | `/public/platicas?tipo=&municipio=` | *(Deseable, supuesto P-29.)* Pláticas de un tipo en todas las iglesias abiertas de un municipio (clave INEGI de 5 dígitos), en orden alfabético. Sin `tipo` o con un municipio no válido → 400 | RF-83 |

## Supuestos

Las rutas usan los supuestos P-10 a P-19 (y P-29 para RF-83 y RF-84) de [plan-genaro.md](plan-genaro.md). Si el docente responde otra cosa (E3-01), se ajusta la ruta y este documento.
