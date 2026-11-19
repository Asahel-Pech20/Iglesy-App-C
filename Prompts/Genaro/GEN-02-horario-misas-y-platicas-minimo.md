# GEN-02 · Horario de misas y pláticas: lo mínimo para el viernes

- **Integrante:** Genaro (lo ejecuta Oscar por falta de tiempo)
- **Cubre:** RF-36–39 (pláticas) y RF-42–46 (horario semanal, padre asignado, choques y duración), más los días inhábiles como supuesto
- **Estado:** pendiente
- **Antes de usar:** reemplaza a GEN-01 si no hubo avance. Corre después de OSC-05 o en otra copia del repositorio: los dos agregan modelos a `schema.prisma`. Sale de la lista mínima de las notas del 2026-11-19: horarios de las misas, cura por misa según el horario, fecha de las pláticas y «modificar los horarios, aceptar o no en días inhábiles».

```text
Soy Oscar Michel Matos May y avanzo la parte de Genaro por falta de tiempo. La entrega es el viernes 2026-11-20 y esto es parte de lo MÍNIMO que pidió el profesor. Prioriza que funcione de punta a punta.

BASE
Crea la rama feat/E3-misas-platicas-minimo desde origin/feat/E2-05-06-catalogos-iglesias (PR #6). Si ya existe feat/E4-07-11-espacios con su migración, sal de ella para no chocar en schema.prisma. Lee AGENTS.md, docs/ecclesia/ARCHITECTURE.md, la sección 2.2 de docs/requerimientos.md (RF-36–52, RN de Genaro, P-10–19) y backend/src/modules/misas/ (Padre y MisaCelebrada ya existen: amplíalos, no los dupliques).

ALCANCE MÍNIMO
1. Horario semanal de misas (RF-42–46):
   - Modelo HorarioMisa por iglesia: día de la semana, hora local, tipo (diaria, dominical o especial), idioma, duración (60 min por defecto) y padre asignado.
   - Choques: rechazar asignar un padre que ya tiene otra misa que se traslapa, aunque sea en otra iglesia, y decir con cuál choca (422). Pon esa regla en modules/misas/dominio/, pura y con pruebas sin BD.
   - Padre en varias iglesias (RF-41): si hoy Padre pertenece a una sola, agrega la relación mínima necesaria.
   - MisaCelebrada puede salir de un HorarioMisa (RF-48), sin romper el diezmo.
2. Días inhábiles (SUPUESTO, pendiente de confirmar con el profesor): el administrador marca una fecha en la que una misa del horario no se celebra (o se celebra con otro horario), con motivo. El público ve la excepción. Regístralo en un supuestos.ts y en docs/requerimientos.md como pregunta abierta, nunca como regla del cliente.
3. Pláticas (RF-36–39): modelo Platica por iglesia con tipo (prebautismal, primera comunión, confirmación, prematrimonial), días y hora, sesiones, cupo, lugar y quién imparte. El visitante filtra por tipo y ve días y hora.
4. API: administrador de la iglesia (alcanceIglesia) crea y modifica horarios, excepciones y pláticas; público sin cuenta consulta el horario con el nombre del padre y las pláticas de una iglesia. Horas en la zona de la iglesia, sin convertir (RF-52).
5. Frontend mínimo, a 360 px y escritorio: en el panel, pestañas «Horario de misas» y «Pláticas» con formularios; en público, horario semanal con padre y pláticas por tipo.
6. Seed: un horario semanal con dos padres, una excepción y tres pláticas en la iglesia inicial.

FUERA POR AHORA
Servicios (RF-30–35), sustitución con historial (RF-49–51) y agenda del padre (RF-47). Déjalos anotados en docs/ecclesia/plan-genaro.md (créalo con el formato de plan-oscar.md).

REGLAS
- Cada endpoint: caso feliz, 400 y 401/403; prueba de que el administrador de otra iglesia no ve ni edita (404).
- No toques módulos ajenos fuera de misas y el nuevo de pláticas; si hace falta, detente y avísame. Sin dependencias nuevas. No hagas push.

FORMA DE TRABAJO
Muéstrame primero el plan (modelos, rutas, pantallas y supuestos) en máximo 25 líneas y espera mi aprobación. Luego un commit local por paso: dominio de choques → migración → API → pantallas → seed. Al final dame el resultado real de pruebas, lint, typecheck, formato y dependency-cruiser y agrega la entrada en docs/bitacora-ia.md citando GEN-02. Cada commit termina en «Asistido-por: Claude Code».
```
