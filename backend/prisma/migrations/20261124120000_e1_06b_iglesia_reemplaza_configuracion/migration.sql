-- E1-06b (Santiago): Iglesia reemplaza a ConfiguracionIglesia (specs.md §12.2, ADR-0006, ADR-0007).
-- Cada iglesia tiene su moneda, zona horaria, logo y sitio web. Fecha posterior a 20261122120000
-- (nombre por municipio) y a 20261123120000 (E1-06). La tabla configuracion_iglesia NO se borra:
-- queda sin uso hasta que el equipo lo confirme.

ALTER TABLE "iglesias" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'MXN';
ALTER TABLE "iglesias" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "iglesias" ADD COLUMN "sitioWeb" TEXT;

-- La fila única de la configuración (id fijo = 1) pasa a la iglesia inicial: la más antigua, la
-- misma que recibió los usuarios (S-03) y la gestión interna (E1-06). Moneda, zona horaria, logo y
-- sitio web se copian; dirección, teléfono y correo solo si la iglesia no los tiene.
UPDATE "iglesias" AS i
SET "moneda"      = c."moneda",
    "zonaHoraria" = c."zonaHoraria",
    "logoUrl"     = c."logoUrl",
    "sitioWeb"    = c."sitioWeb",
    "direccion"   = COALESCE(NULLIF(i."direccion", ''), c."direccion"),
    "telefono"    = COALESCE(NULLIF(i."telefono", ''), c."telefono"),
    "correo"      = COALESCE(NULLIF(i."correo", ''), c."email")
FROM "configuracion_iglesia" AS c
WHERE c."id" = 1
  AND i."id" = (SELECT "id" FROM "iglesias" ORDER BY "createdAt", "id" LIMIT 1);
