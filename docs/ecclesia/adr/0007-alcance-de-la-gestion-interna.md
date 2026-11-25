# ADR-0007: Alcance por iglesia de la gestión interna en el cliente de Prisma

- **Estado:** Propuesto, en revisión (PR de E1-06) · **Fecha:** 2026-11-22 · **Propone:** Santiago (B1)
- **Requerimientos relacionados:** RNF-10, RF-82, RN-54, `specs.md` §12.2, ADR-0004, ADR-0006, supuesto S-05 (P-20)

## Contexto
La gestión interna heredada de AppIglesia (miembros, ministerios, eventos, asistencia, anuncios, donaciones, horarios, dashboard y reportes) se escribió para **una** iglesia. Con Ecclesia hay varias (ADR-0006) y nadie debe ver ni tocar datos de otra (RNF-10). Las rutas de estos módulos no llevan `/iglesias/:iglesiaId`, así que `alcanceIglesia` no basta: el filtro tiene que estar en cada consulta. Son unas 70 consultas en módulos de cuatro dueños, y bastaría olvidar un `where` en una sola para mezclar iglesias.

## Opciones consideradas
1. **Agregar `iglesiaId` a mano en cada consulta.** A favor: explícito. En contra: depende de que nadie olvide uno, hoy ni en cada cambio futuro; un olvido devuelve datos de todas las iglesias sin ningún error.
2. **Seguridad a nivel de fila de PostgreSQL (RLS).** A favor: la BD lo garantiza. En contra: hay que fijar la iglesia en cada conexión (`SET` por transacción con el adaptador `pg`), lo que complica las pruebas, las semillas y las migraciones, y el equipo no lo conoce.
3. **Extensión del cliente de Prisma con un contexto por petición.** `autenticar` fija la iglesia del usuario en un `AsyncLocalStorage` y una extensión `$allOperations` agrega el filtro a toda consulta de gestión interna. **Sin contexto, la consulta lanza.**

## Decisión
**Opción 3**, con estas reglas:

1. **Contexto** (`lib/contextoIglesia.ts`). `autenticar` corre el resto de la petición con la iglesia del usuario, leída de la BD y nunca del cliente. La Coordinación queda como `nacional`.
2. **Extensión** (`lib/prisma.ts` y la función pura `lib/alcancePrisma.ts`). En `Miembro`, `Ministerio`, `Evento`, `Anuncio`, `Donacion` y `HorarioReunion`:
   - las lecturas y los `updateMany`/`deleteMany` se combinan con `AND iglesiaId`;
   - con llave única, la iglesia va junto a la llave, así que una fila de otra iglesia «no existe» (404);
   - al crear se pone la iglesia del contexto, aunque los datos traigan otra.
   Las tablas puente (`Asistencia`, `EventoResponsable`, `MiembroMinisterio` y `MinisterioCoordinador`) se filtran por su extremo. Una operación de Prisma que la extensión no conozca lanza en vez de pasar sin filtro.
3. **Sin contexto la extensión lanza** `SinContextoDeIglesia` (500). También lanza con el contexto de la Coordinación: un olvido se nota como error, nunca como fuga.
4. **`sinAlcance(motivo, fn)`** es la única salida y tiene tres motivos: `coordinacion`, `seed` y `script`. Hoy solo la usa `prisma/seed.ts`. `contextoIglesia.test.ts` falla si otro archivo la usa, o la usa con un motivo que no corresponde a su carpeta.
5. **SQL crudo.** `consultarDeIglesia` y `ejecutarDeIglesia` entregan la iglesia del contexto, y lanzan **antes de ejecutar** si no aparece entre los parámetros de la consulta. `sqlDeIglesia.test.ts` falla si un `$queryRaw`/`$executeRaw` de `modules/` no lleva encima `// sql-sin-iglesia: <motivo>`. Hoy esa marca está en el catálogo del INEGI (nacional), el diezmo (filtra por la iglesia de la ruta) y el folio de espacios (secuencia nacional).
6. **Vínculos entre iglesias → 422.** `exigirMismaIglesia` revisa que los dos extremos de un vínculo sean de la misma iglesia. Aplica a las tablas puente y a `Evento.ministerioId`, `Anuncio.eventoId` y `Donacion.miembroId`. Sin esto, el filtro haría que el id ajeno pareciera no existir (404). Solo revela que el id existe en otra iglesia, nunca sus datos. Hay una prueba por vínculo en cada módulo.
7. **Páginas públicas heredadas.** La cartelera y `GET /configuracion/horarios` sin sesión fijan de forma explícita la **iglesia inicial** (la más antigua, supuesto S-03) hasta E1-06b. Con sesión, `GET /configuracion/horarios` muestra los horarios de la iglesia del usuario (`autenticarOpcional`).
8. **Pruebas.** Preparan datos con su propio cliente sin alcance (`test/bd.ts`); `produccion-sin-pruebas` impide que `src/` lo importe. Las que llaman a un service sin petición HTTP usan `enIglesiaDePrueba`.

## Consecuencias
- Un módulo nuevo de gestión interna queda protegido al agregarlo a `MODELOS_CON_IGLESIA` (o a `MODELOS_POR_RELACION`).
- El dashboard guarda su cache por iglesia: antes la clave era solo la vista (con o sin ingresos) y una iglesia habría recibido el panel de otra.
- Las consultas de Prisma son perezosas: `conIglesia` y `sinAlcance` esperan el resultado **dentro** del contexto. Una promesa de Prisma que se crea en un contexto y se espera fuera de él corre sin contexto y lanza.
- Tipos: el cliente extendido no es `Prisma.TransactionClient`. Las transacciones se tipan con `TransaccionPrisma` o `ClientePrisma` (`lib/prisma.ts`).
- Los services siguen poniendo `iglesiaId: iglesiaDelContexto()` al crear, porque los tipos de Prisma lo exigen. Es el mismo valor que pone la extensión.
- Riesgo que queda: la BD no impide un vínculo entre iglesias si alguien escribe saltándose la API. Si hiciera falta, se agrega un disparador como el de espacios (y se traduce `P0001` en `errores.ts`).
- E1-06b (hecho, aprobado por el orquestador con las tres decisiones y ocho ajustes): `Iglesia` reemplaza a `ConfiguracionIglesia` (moneda, zona horaria, logo y sitio web por iglesia; la tabla vieja se conserva sin uso). `configuracionService.obtener()` lee la iglesia del **contexto** y lanza sin él. Las lecturas con sesión opcional siguen esta regla: el personal ve la suya, la Coordinación pasa `?iglesiaId=` (400 sin él) y un visitante usa `?iglesiaId=` o, de forma explícita, la inicial. `PUT /configuracion` es estricto (moneda, zona, sitio web): nombre y contacto se editan en la ficha. Cartelera de cada iglesia en `/public/iglesias/:iglesiaId/cartelera` (cache por iglesia); `/public/cartelera` es el alias de la inicial.
