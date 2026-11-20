# OSC-05 · Criptas y otros espacios: lo mínimo para el viernes

- **Integrante:** Oscar
- **Cubre:** E4-07 a E4-11 y una versión mínima de E4-19 y E4-20 (RF-70–80, RN-47–53, CA-26–29)
- **Estado:** pendiente
- **Antes de usar:** pausa E1-06 en la otra terminal. Este prompt sale de la lista mínima de las notas del 2026-11-19: «Pagos de las criptas: cuánto cuesta y con quién se hace».

```text
Soy Oscar Michel Matos May. La entrega es el viernes 2026-11-20 y esto es parte de lo MÍNIMO que pidió el profesor: «pagos de las criptas: cuánto cuesta y con quién se hace». Prioriza que funcione de punta a punta sobre cubrir todo.

BASE
Crea la rama feat/E4-07-11-espacios desde origin/feat/E2-05-06-catalogos-iglesias (PR #6, aprobado). Lee AGENTS.md, docs/ecclesia/ARCHITECTURE.md, docs/ecclesia/plan-oscar.md (E4-07 a E4-11, E4-19 y E4-20) y RF-70–80, RN-47–53, CA-26–29 y P-24–27 de docs/requerimientos.md.
Las reglas puras ya existen en backend/src/modules/espacios/dominio/ (E4-06): úsalas, no las reescribas. Si hace falta, corrige ahí la cita de CA-29 (dice 15 días y CA-29 dice 16; ver paso 1 de OSC-03).

ALCANCE MÍNIMO
1. Migración (E4-07): TipoEspacio por iglesia (cripta, nicho, columbario u osario), SolicitudEspacio (folio, hash de la clave, contacto, estado) y la cotización (monto Decimal(12,2), condiciones, emitida y vence). Con iglesiaId, RESTRICT y CHECK donde aplique. Nombre de migración con fecha posterior a todas las existentes.
2. API (E4-08 a E4-11):
   - Público, sin cuenta: tipos de espacio de una iglesia SIN precio; crear solicitud (devuelve folio y clave una sola vez); consultar con folio y clave; aceptar, rechazar o cancelar. Límite de intentos en la consulta.
   - Administrador de la iglesia (alcanceIglesia): administrar tipos; ver solicitudes de su iglesia con contacto; marcar «no hay lugar»; emitir cotización con cuánto cuesta y en qué condiciones. «Con quién se hace» = la iglesia y su encargado: muéstralo en la cotización (nombre de la iglesia y su contacto).
   - El vencimiento se calcula al consultar (sin cron), con el «ahora» como parámetro del dominio.
3. Frontend mínimo (E4-19 y E4-20), a 360 px y escritorio:
   - Página pública: elegir iglesia, ver tipos, enviar solicitud, ver folio y clave; consulta con folio y clave con botones aceptar, rechazar y cancelar.
   - Panel del administrador: lista de solicitudes, detalle, «no hay lugar» y formulario de cotización.
4. Seed: dos tipos de espacio y tres solicitudes en distintos estados en la iglesia inicial.

REGLAS
- Dinero en Decimal y string en JSON; nunca number.
- La clave se guarda con hash; nunca se devuelve después de crearla.
- Cada endpoint: caso feliz, 400 y 401/403; prueba de que el administrador de otra iglesia no ve ni cotiza (404).
- No toques módulos ajenos ni E1-06. Sin dependencias nuevas. No hagas push.

FORMA DE TRABAJO
Muéstrame primero el plan (modelos, rutas, pantallas y supuestos) en máximo 25 líneas y espera mi aprobación. Luego avanza en este orden y haz un commit local por paso: migración → API → pantallas → seed. Al final dame el resultado real de pruebas, lint, typecheck, formato y dependency-cruiser, marca las tareas en plan-oscar.md y agrega la entrada en docs/bitacora-ia.md citando OSC-05. Cada commit termina en «Asistido-por: Claude Code».
```
