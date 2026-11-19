# Auditoría 2 · E1 — Base multi-iglesia, roles y alcance (Santiago)

> Lee solo este archivo y los que cita. Contexto general: [../../README.md](../../README.md).
> Rama: `feat/E1-01-base-fusion` (`8b115c8`).

## Resultado

Está bien resuelto:
- **Firma conservada:** `alcanceIglesia` no cambió su firma, así que diezmo y misas siguen igual.
- **Supuestos en un lugar:** `SUPUESTOS_ALCANCE` deja la regla de la Coordinación en un solo sitio y marcada como supuesto.
- **Riesgo cubierto:** hay pruebas de que enviar otra `iglesiaId` en body, query o cabecera no cambia nada.
- **Integridad:** el `CHECK usuarios_iglesia_segun_rol` y el `RESTRICT` protegen los datos en la BD.

## Observaciones

| ID | Sev. | Dónde | Observación | Acción sugerida | Estado |
|---|---|---|---|---|---|
| A2-E1-01 | Media | `middlewares/alcanceIglesia.ts:68` | `iglesiaDeLaRuta` solo comprueba que la iglesia exista, no que esté activa. Con el cierre del PR #6, el personal de una iglesia cerrada sigue registrando misas y diezmos. | Una opción en `alcanceIglesia` para las rutas que escriben (por ejemplo `{ soloActiva: true }`) que responda 422. Así lo heredan todos los módulos. Si lo haces tú, avisa a Oscar: ya no hace falta A2-E4-01. | [ ] |
| A2-E1-02 | Media | `middlewares/errores.ts:47` | Solo se traducen P2002 y P2025. Una violación de `CHECK` que no anticipe Zod (`usuarios_iglesia_segun_rol` y los cinco del PR #6) responde 500 en vez de 4xx. Ya pasa con las coordenadas (A2-E2-01). | Traducir SQLSTATE 23514 a 400 o 422 con un mensaje claro. | [ ] |
| A2-E1-03 | Media | `prisma/migrations/20261108120000_e1_01_usuario_iglesia_segun_rol/migration.sql` | La migración asigna la iglesia más antigua a todo el personal sin iglesia (supuesto S-03). Casi no debería pasar, pero si pasa, esa persona queda con acceso a datos privados (diezmo y solicitudes) de una iglesia que no es la suya. | Desactivar a ese personal (`activo = false`) o hacer que la migración falle con un mensaje claro. Como la migración aún no está en `main`, todavía se puede cambiar. | [ ] |
| A2-E1-04 | Baja | `middlewares/alcanceIglesia.test.ts:196`, `:218` | Las pruebas del `CHECK` y del `RESTRICT` usan `rejects.toThrow()` sin indicar qué error esperan. Pasarían por cualquier fallo, por ejemplo un correo repetido. | Comprobar el nombre de la restricción en el error. | [ ] |
| A2-E1-05 | Baja | `test/setup.ts:26` | `beforeEach` vacía toda la BD antes de **cada** prueba, también las de dominio puro que no la usan. Nataly reportó un *timeout* en `espacios/dominio` por esto. | Vaciar la BD solo en las suites que la usan, o separar en Vitest las pruebas de dominio. | [ ] |
| A2-E1-06 | Info | `config/permisos.ts:88`; sin PR | El marcador S-04 (`configuracion:editar` de la Coordinación) ya se puede retirar: existe la edición de iglesias. Además, tu rama no tiene PR y el PR #6 apunta a ella. | Retirar S-04 cuando convenga y abrir el PR de `feat/E1-01-base-fusion` para fusionar la cadena en orden. | [ ] |

## Pendientes de tu plan

- E1-02, E1-04 y E1-06 a E1-08 de `docs/ecclesia/plan-santiago.md`.
- **Hook de pre-commit:** no está activo en la copia de Oscar (`core.hooksPath`), y dependency-cruiser marca 9 violaciones heredadas en todo el backend; el CI no lo ejecuta. Decide si se corrigen primero o si el hook revisa solo lo nuevo (ver A2-E4-04).
