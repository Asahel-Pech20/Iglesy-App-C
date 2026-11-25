-- E1-06 (Santiago): la gestión interna heredada de AppIglesia pasa a ser de cada iglesia
-- (specs.md §12.2, ADR-0006, ADR-0007; supuesto S-05: se conserva la gestión interna, P-20).
-- Miembros, ministerios, eventos, anuncios, donaciones y horarios de reunión llevan iglesiaId.
-- Asistencia y las tablas puente la obtienen de sus extremos (el service exige la misma iglesia).
-- Fecha posterior a 20261121120000_e4_07_espacios (Oscar) y 20261122120000 (nombre por municipio).

-- 1. Columnas, nulas mientras se llenan
ALTER TABLE "miembros"         ADD COLUMN "iglesiaId" TEXT;
ALTER TABLE "ministerios"      ADD COLUMN "iglesiaId" TEXT;
ALTER TABLE "eventos"          ADD COLUMN "iglesiaId" TEXT;
ALTER TABLE "anuncios"         ADD COLUMN "iglesiaId" TEXT;
ALTER TABLE "donaciones"       ADD COLUMN "iglesiaId" TEXT;
ALTER TABLE "horarios_reunion" ADD COLUMN "iglesiaId" TEXT;

-- 2. Los datos que ya existen son de la iglesia inicial: la más antigua, la misma a la que
--    20261106170000 pasó a los usuarios de AppIglesia (supuesto S-03). Si hay datos y ninguna
--    iglesia, se detiene: no se inventa una.
DO $$
DECLARE
  inicial TEXT;
  hay_datos BOOLEAN;
BEGIN
  SELECT "id" INTO inicial FROM "iglesias" ORDER BY "createdAt", "id" LIMIT 1;
  SELECT EXISTS (SELECT 1 FROM "miembros") OR EXISTS (SELECT 1 FROM "ministerios")
      OR EXISTS (SELECT 1 FROM "eventos") OR EXISTS (SELECT 1 FROM "anuncios")
      OR EXISTS (SELECT 1 FROM "donaciones") OR EXISTS (SELECT 1 FROM "horarios_reunion")
    INTO hay_datos;
  IF hay_datos AND inicial IS NULL THEN
    RAISE EXCEPTION 'Hay datos de gestión interna pero ninguna iglesia. Crea la iglesia inicial y vuelve a aplicar la migración.';
  END IF;
  UPDATE "miembros"         SET "iglesiaId" = inicial;
  UPDATE "ministerios"      SET "iglesiaId" = inicial;
  UPDATE "eventos"          SET "iglesiaId" = inicial;
  UPDATE "anuncios"         SET "iglesiaId" = inicial;
  UPDATE "donaciones"       SET "iglesiaId" = inicial;
  UPDATE "horarios_reunion" SET "iglesiaId" = inicial;
END $$;

-- 3. Obligatorias
ALTER TABLE "miembros"         ALTER COLUMN "iglesiaId" SET NOT NULL;
ALTER TABLE "ministerios"      ALTER COLUMN "iglesiaId" SET NOT NULL;
ALTER TABLE "eventos"          ALTER COLUMN "iglesiaId" SET NOT NULL;
ALTER TABLE "anuncios"         ALTER COLUMN "iglesiaId" SET NOT NULL;
ALTER TABLE "donaciones"       ALTER COLUMN "iglesiaId" SET NOT NULL;
ALTER TABLE "horarios_reunion" ALTER COLUMN "iglesiaId" SET NOT NULL;

-- 4. El nombre del ministerio es único dentro de cada iglesia (antes, en todo el sistema)
DROP INDEX "ministerios_nombre_key";
CREATE UNIQUE INDEX "ministerios_iglesiaId_nombre_key" ON "ministerios"("iglesiaId", "nombre");

-- 5. Índices para filtrar por iglesia
CREATE INDEX "miembros_iglesiaId_activo_idx" ON "miembros"("iglesiaId", "activo");
CREATE INDEX "eventos_iglesiaId_fechaInicio_idx" ON "eventos"("iglesiaId", "fechaInicio");
CREATE INDEX "anuncios_iglesiaId_fechaPublicacion_idx" ON "anuncios"("iglesiaId", "fechaPublicacion");
CREATE INDEX "donaciones_iglesiaId_fecha_idx" ON "donaciones"("iglesiaId", "fecha");
CREATE INDEX "horarios_reunion_iglesiaId_diaSemana_idx" ON "horarios_reunion"("iglesiaId", "diaSemana");

-- 6. Llaves foráneas con RESTRICT: una iglesia con historia no se borra (se cierra, RN-07)
ALTER TABLE "miembros" ADD CONSTRAINT "miembros_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ministerios" ADD CONSTRAINT "ministerios_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "anuncios" ADD CONSTRAINT "anuncios_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donaciones" ADD CONSTRAINT "donaciones_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_reunion" ADD CONSTRAINT "horarios_reunion_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
