# OSC-04 · Una iglesia cerrada no acepta misas ni diezmo

- **Integrante:** Oscar
- **Cubre:** RF-11, RF-12, RN-07 en misas y diezmo (Auditoría 2, A2-E4-01)
- **Estado:** resuelto sin usarlo (2026-11-21): `alcanceIglesia` ya rechaza las escrituras de una iglesia cerrada (A2-E1-01) y `backend/src/modules/diezmo/iglesia-cerrada.test.ts` lo comprueba en las rutas reales de padres, misas y diezmo.
- **Antes de usar:** confirma con Santiago si lo resuelve en `alcanceIglesia` (Auditoría 2, A2-E1-01). Si lo hace él, este prompt ya no hace falta. Necesita PostgreSQL para las pruebas.

```text
Soy Oscar Michel Matos May. Corrige el punto 2 de mi revisión del PR #6 de Nataly: una iglesia cerrada sigue aceptando misas y capturas de diezmo.

PREPARACIÓN
1. Muéstrame la rama actual y git status. Debo estar en feat/E2-05-06-catalogos-iglesias, al día con origin. Si hay cambios sin commit, detente y avísame.
2. Propón crear la rama fix/E4-iglesia-cerrada desde ahí, porque obtenerActiva() solo existe en esa rama. No cambies de rama hasta que lo apruebe.

LEE
AGENTS.md; RF-11, RF-12, RN-07, RF-60–63 y RF-48 de docs/requerimientos.md; obtenerActiva() en backend/src/modules/iglesias/iglesias.service.ts; zonaDe() y las funciones que escriben en backend/src/modules/misas/misas.service.ts y backend/src/modules/diezmo/diezmo.service.ts, con sus pruebas.

TAREA
- Las escrituras de una iglesia cerrada se rechazan con 422 y un mensaje claro: registrar misa (registrarMisa), capturar diezmo (capturar) y corregir diezmo (corregir). Revisa si hay otra escritura en esos dos módulos y dime cuál.
- Las lecturas siguen funcionando para el personal, para no perder la historia (RF-12, RN-07): listar misas, ver diezmos y reportes.
- Usa iglesiasService.obtenerActiva() por el service del módulo dueño (ADR-0002), sin copiar la consulta. Si zonaDe() sigue siendo útil para las lecturas, consérvalo y dime cómo evitas consultar la iglesia dos veces.
- Que las escrituras se rechacen y las lecturas sigan es un supuesto: el caso solo dice que una iglesia cerrada no aparece en consultas y conserva su historia. Anótalo como supuesto, sin presentarlo como regla del cliente.

LÍMITES
- No toques los módulos de iglesias ni de catálogos (son de Nataly) ni schema.prisma.
- Sin migraciones ni dependencias nuevas.
- No cambies pruebas existentes para que pasen; si alguna falla, explícame por qué.
- No hagas push ni PR.

PRUEBAS
Por cada escritura: con la iglesia cerrada responde 422 y no guarda nada; con la iglesia activa sigue funcionando. Agrega una de lectura con la iglesia cerrada.
Estas pruebas necesitan la BD de pruebas. Revisa si existen backend/.env y PostgreSQL en el puerto de DATABASE_URL_TEST. Si no hay base de datos, no instales nada: detente y dime qué opciones hay según docs/requisitos.md.

FORMA DE TRABAJO
Primero muéstrame un plan: archivos, funciones, pruebas y el supuesto. No escribas código hasta que lo apruebe.
Al terminar:
- Ejecuta las pruebas de misas y diezmo, lint, typecheck, formato y dependency-cruiser, y muéstrame el resultado real de cada uno.
- Agrega la entrada a docs/bitacora-ia.md, con los errores de la IA que se hayan detectado.
- Dame los archivos cambiados y lo que no pudiste verificar.
- Cuando lo apruebe, crea un commit local con Conventional Commits en español, terminado en «Asistido-por: Claude Code».
```
