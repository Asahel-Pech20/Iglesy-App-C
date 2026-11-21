# OSC-06 · Espacios completo desde `main` (criptas, nichos, columbarios y osarios)

- **Integrante:** Oscar
- **Cubre:** E4-07 a E4-11, la parte de espacios de E4-19, E4-20 y E4-21, y los pendientes A2-E4-02 y A2-E4-03 (RF-70–80, RN-47–53, CA-26–29, P-24–27)
- **Estado:** pendiente
- **Reemplaza a:** OSC-05, que nunca se ejecutó y salía de una rama anterior a la integración del 2026-11-20. También absorbe el paso 1 de OSC-03.
- **Antes de usar:** `git switch main && git pull`. Si el PR #20 de Nataly (patrimonio y ficha pública) ya se fusionó, vuelve a hacer `pull`: la sección de espacios va dentro de su ficha.

```text
Soy Oscar Michel Matos May. Mi parte pendiente de Ecclesia es «Las criptas y otros espacios»: hoy solo existen las reglas puras de E4-06 en backend/src/modules/espacios/dominio/. El diezmo ya está completo en main. Es parte de lo mínimo que pidió el profesor («pagos de las criptas: cuánto cuesta y con quién se hace»). Prioriza que funcione de punta a punta.

PREPARACIÓN
1. Crea la rama feat/E4-07-11-espacios desde main actualizado. Corre node scripts/activar-hooks.mjs si los hooks no están activos en esta copia.
2. Lee AGENTS.md, docs/ecclesia/ARCHITECTURE.md, docs/ecclesia/plan-oscar.md (E4-07 a E4-11 y E4-19 a E4-21), docs/modelo-datos.md (E1-07), docs/ecclesia/api-diezmo-espacios.md (tu diseño de rutas, E4-04), RF-70–80, RN-47–53, CA-26–29 y P-24–27 de docs/requerimientos.md, y backend/README.md (alcanceIglesia, iglesiaDe, aceptaEscrituras, lib/dominio/zona.ts y la regla de un solo encargado de E1-09).
3. Revisa si el PR #20 de Nataly ya está en main (ficha pública en frontend/src/app/features/explorar/ficha.page.ts y GET /public/iglesias/:iglesiaId). Si no está, NO lo copies: expón tu endpoint público y deja la sección de la ficha para cuando se fusione; anótalo en el plan.

PASO 0: PENDIENTES DE LA AUDITORÍA 2 (commit aparte)
- A2-E4-02: solicitud-espacio.test.ts (líneas 68, 252 y 276) y supuestos.ts citan CA-29 con 15 días, pero docs/requerimientos.md dice 16. Quita la cita a CA-29 de esas pruebas: el vencimiento en el instante exacto es un supuesto de P-26. Agrega una prueba de CA-29 con 16 días, tal como está escrita.
- A2-E4-03: actualiza los estados de docs/ecclesia/plan-oscar.md con lo que ya está en main: E4-04, E4-06 y E4-12 a E4-17 hechas (diezmo completo y pantallas de diezmo de E4-20). Revisa E4-18 con las pruebas existentes antes de marcarla.

PASO 1: MIGRACIÓN (E4-07)
- TipoEspacio por iglesia (cripta, nicho, columbario u osario; disponible sí o no), SolicitudEspacio (folio legible, hash de la clave, datos de contacto según P-25, tipo, estado, intentos fallidos) y Cotizacion (monto Decimal(12,2), condiciones, emitidaEn, venceEn, respuesta).
- iglesiaId obligatorio, RESTRICT, CHECK de monto > 0 y de estados válidos. Una sola cotización vigente por solicitud.
- El nombre de la migración debe tener una fecha posterior a todas las de main y a 20261120130000 (la de patrimonio del PR #20), para no chocar si entra después.
- Actualiza docs/modelo-datos.md con estos modelos.

PASO 2: API (E4-08 a E4-11)
- Público, sin cuenta (con el rate limit que ya usa public.routes.ts):
  - GET tipos de espacio de una iglesia, SIN precios (RN-48).
  - POST solicitud: devuelve folio y clave una sola vez; la clave se guarda solo como hash.
  - GET seguimiento con folio y clave: estado y cotización si existe, con «con quién se hace» = nombre de la iglesia y su contacto. Bloqueo temporal tras varios intentos fallidos (supuesto en supuestos.ts).
  - POST aceptar, rechazar o cancelar con folio y clave (RF-78, RF-80).
- Administrador de la iglesia (alcanceIglesia; la Coordinación según SUPUESTOS_ALCANCE, sin ver datos privados si así lo dice RN-54):
  - CRUD de tipos de espacio; listado paginado de solicitudes de su iglesia con contacto; marcar «no hay lugar»; emitir cotización con monto y condiciones.
  - Una iglesia cerrada no acepta escrituras: alcanceIglesia ya lo aplica con aceptaEscrituras (A2-E1-01); verifica con una prueba que también cubre tus rutas.
- Las transiciones y el vencimiento salen de espacios/dominio; el vencimiento se evalúa al leer o escribir, con el «ahora» como parámetro, sin cron. Muestra fechas en la hora local de la iglesia (lib/dominio/zona.ts).
- Sigue las rutas de docs/ecclesia/api-diezmo-espacios.md; si cambias alguna, actualiza ese archivo. Rutas en openapi.yaml.

PASO 3: PANTALLAS (E4-19 y la parte de espacios de E4-20), a 360 px y escritorio
- Público: solicitar un espacio en una iglesia (elegir tipo, datos de contacto, ver folio y clave con aviso de guardarlos) y consultar seguimiento con aceptar, rechazar y cancelar con ConfirmDialog.
- Panel: «Espacios» en el menú con su permiso; pestañas Tipos y Solicitudes; detalle con «no hay lugar» y formulario de cotización.
- Estados de carga, vacío y error; mocks MSW para los endpoints nuevos.

PASO 4: SEED (E4-21, parte de espacios)
- 12 solicitudes con al menos una por estado, repartidas en varias iglesias del seed, y tipos de espacio en esas iglesias. Idempotente.

REGLAS
- Dinero con Prisma.Decimal y string en JSON; nunca number.
- Cada endpoint: caso feliz, 400 y 401/403. Pruebas de que el administrador de otra iglesia no ve ni cotiza (404), de que la clave nunca vuelve a salir y de que no se acepta una cotización vencida.
- Solo tocas espacios, su pantalla, rutas, openapi, mocks y seed. Si necesitas tocar el módulo de otro (iglesias, public, explorar), detente y dímelo. Sin dependencias nuevas. No hagas push.
- Lo que no digan P-24–P-27 va en espacios/dominio/supuestos.ts como supuesto, nunca como regla del cliente.

FORMA DE TRABAJO
Haz primero el paso 0 y muéstrame el resultado. Luego muéstrame el plan de los pasos 1 a 4 (modelos, rutas, pantallas y supuestos) en máximo 30 líneas y espera mi aprobación. Después, un commit local por paso. Al final dame el resultado real de pruebas, lint, typecheck, formato y dependency-cruiser, marca las tareas en plan-oscar.md y agrega la entrada en docs/bitacora-ia.md citando OSC-06. Cada commit termina en «Asistido-por: Claude Code».
```
