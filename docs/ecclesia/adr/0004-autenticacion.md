# ADR-0004: JWT con roles y alcance por iglesia; solicitantes con folio y clave

- **Estado:** Aceptado · **Fecha:** 2026-11-06 · **Decide:** equipo completo
- **Requerimientos relacionados:** RNF-01, RNF-08, RNF-09, RNF-10, RNF-14, RNF-15

## Contexto
Hay tres tipos de acceso: público sin cuenta, personal con cuenta (Coordinación, administrador de iglesia, tesorero) y solicitantes de espacio que **no** crean cuenta pero siguen su solicitud.

## Decisión
- **Personal**: access token JWT (15 min, header) + refresh token en cookie `httpOnly` que rota; contraseñas con bcrypt (cost 12). Mismo esquema probado en AppIglesia.
- **Roles**: `COORDINACION` (nacional), `ADMIN_IGLESIA` y `TESORERO` (con `iglesiaId`). Permisos `modulo:accion`.
- **Alcance**: middleware `alcanceIglesia` que obtiene la `iglesiaId` del recurso desde la BD y la compara con la del usuario; si no coincide → 403. Nunca se confía en una `iglesiaId` enviada por el cliente.
- **Solicitantes**: folio legible (`CR-2026-000123`) + clave aleatoria de 32 bytes guardada con hash; la consulta exige ambos. Rate limit en ese endpoint.

## Consecuencias
- Cada endpoint de iglesia tiene prueba de «otra iglesia → 403».
- Los reportes de diezmo solo para `ADMIN_IGLESIA` y `TESORERO` de esa iglesia (P- pendiente: ¿la Coordinación también?).
