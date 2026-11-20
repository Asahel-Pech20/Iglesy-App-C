# Auditoría 2 · E2 — Catálogo del INEGI e iglesias (Nataly)

> Lee solo este archivo y los que cita. Contexto general: [../../README.md](../../README.md).
> Rama: `feat/E2-05-06-catalogos-iglesias` (PR #6, `7b421f4`).

## Resultado

Va bien encaminado:
- **Base respetada:** se conservan el `GET` y el `POST` de iglesias de Oscar y sus 8 pruebas; se agregan 12.
- **Catálogo:** las claves del INEGI se validan en Zod, en el service y con `CHECK` en la BD.
- **Ubicación:** las tres claves se escriben en un solo `UPDATE`, para que el `CHECK` nunca vea un estado intermedio.
- **Importación:** inserta y actualiza sin borrar, en una transacción.
- **Para otros módulos:** `obtenerActiva()` ya existe para servicios, misas y espacios.

Antes de fusionar conviene atender A2-E2-01 y A2-E2-03.

## Observaciones

| ID | Sev. | Dónde | Observación | Acción sugerida | Estado |
|---|---|---|---|---|---|
| A2-E2-01 | Media | `modules/iglesias/iglesias.schemas.ts:88` | `coordenadasJuntas` solo revisa lo que llega, no lo guardado. Con una iglesia que ya tiene coordenadas, `PATCH {"latitud": null}` pasa Zod, viola el `CHECK iglesias_datos_validos` y responde 500. Lo mismo con `{"latitud": 20}` en una iglesia sin coordenadas. | Traducir la violación de `CHECK` en `errores.ts` (ver A2-E1-02) o validar en el service contra lo guardado. | [ ] |
| A2-E2-02 | Info | `modules/iglesias/iglesias.service.ts:190` | `obtenerActiva()` existe, pero misas y diezmo no la usan: una iglesia cerrada sigue aceptando escrituras. | Nada de tu lado: lo atiende Santiago (A2-E1-01) u Oscar (A2-E4-01). | [ ] |
| A2-E2-03 | Media | `modules/iglesias/iglesias.service.ts:146` | `editar()` toma cualquier `estado` recibido como cambio de estado y pone municipio y localidad en `null`, aunque sea el mismo valor guardado. Un formulario que mande `{"estado": "21", "nombre": "…"}` borra la ubicación sin querer. | Limpiar municipio y localidad solo si el estado realmente cambia. | [ ] |
| A2-E2-04 | Media | `modules/catalogos/catalogos.service.ts:8`, `:12`, `:22` | Los catálogos públicos devuelven listas completas. Un municipio puede tener más de mil localidades. `AGENTS.md` §3: «Listados siempre paginados (default 20, máx. 100)». | Paginar, o anotar la excepción con su justificación (catálogo para selectores) en `AGENTS.md`. | [ ] |
| A2-E2-05 | Baja | `modules/iglesias/iglesias.schemas.ts:42` | `opcional()` solo convierte en `null` el texto exactamente vacío. Una coordenada de solo espacios se recorta a `''` y `Number('')` da 0: la iglesia queda en 0,0. | Recortar antes de comparar con `''` en `opcional()`, o rechazar texto vacío en `coordenada()`. | [ ] |
| A2-E2-06 | Baja | `modules/iglesias/iglesias.service.ts:78` | `nombreRepetido()` consulta y después inserta, sin índice único en la BD. Dos altas simultáneas con el mismo nombre pueden guardarse las dos. | Índice único en la BD según la regla que se decida (A2-E4-05); requiere migración revisada por Santiago. | [ ] |
| A2-E2-07 | Baja | `modules/iglesias/iglesias.schemas.ts:24` | `clave(n)` repite `digitos(n)` de `catalogos.schemas.ts:7`. Si cambia uno, la misma clave se acepta en un módulo y se rechaza en el otro. | Exportar `digitos` y reutilizarlo. | [ ] |
| A2-E2-08 | Baja | `modules/iglesias/iglesias.service.ts:112` | En `crear()`, `nombre` y `tipo` ya vienen en `aColumnas(resto)` y se vuelven a asignar. | Dejar solo `...aColumnas(resto)` y la ubicación. | [ ] |
| A2-E2-09 | Info | PR #6 | Preguntaste si el nombre de la iglesia es único en el país o por municipio. | Ver A2-E4-05: lo decide Oscar en el PR. | [ ] |

## Pendientes de tu plan

- **E2-07:** lista pública por estado. **E2-09:** seeds con el catálogo real. **E2-15:** pantalla de iglesias del panel con los campos nuevos.
- **Plan:** `plan-nataly.md` (PR #5) marca E2-05 y E2-06 como «Pendiente». Actualízalo al fusionar.
