# Checklist de revisión de código

Úsalo al revisar un PR **y** antes de aceptar código propuesto por la IA.

## Requerimientos
- [ ] El PR dice qué IDs cubre y cada uno se cumple en el código.
- [ ] Nada inventado: todo campo, endpoint o regla tiene origen en `docs/requerimientos.md`.
- [ ] Los límites de las reglas coinciden con el caso (≥ vs >, rangos cerrados o abiertos).

## Seguridad y datos
- [ ] Cada ruta autentica y autoriza en el servidor; el alcance por organización se verifica con datos de la BD, no del cliente.
- [ ] Ninguna respuesta ni log incluye contraseñas, hashes, tokens o datos privados de terceros.
- [ ] Toda entrada pasa por un esquema Zod; los campos desconocidos se rechazan.
- [ ] Dinero con decimal exacto; fechas en UTC y conversión a la zona del recurso solo al mostrar.
- [ ] Nada se borra si el requerimiento pide conservar historia; las correcciones guardan quién, cuándo y valor anterior.

## Arquitectura
- [ ] Controllers delgados; la lógica en services o en `dominio/`.
- [ ] Sin imports del ORM fuera de services/lib; sin imports entre módulos salvo su service (`depcruise` en verde).
- [ ] Operaciones de varias escrituras en transacción.
- [ ] Listados paginados con `select` explícito.

## Pruebas
- [ ] Hay pruebas para el caso feliz, validación, permisos y cada regla de negocio.
- [ ] Las pruebas fallarían si se quitara la regla (no son triviales).
- [ ] No dependen del reloj real ni del orden de ejecución.

## Calidad
- [ ] Nombres en español del dominio, sin acentos en código; textos al usuario con acentos.
- [ ] Sin código muerto, `console.log`, `TODO` sin ID ni reglas desactivadas.
- [ ] Commits con Conventional Commits y `Asistido-por:` cuando aplica.
