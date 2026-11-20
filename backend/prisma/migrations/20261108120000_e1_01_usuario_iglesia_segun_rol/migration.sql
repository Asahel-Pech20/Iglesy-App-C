-- E1-01 (Santiago) sobre la base de iglesias de 20261106170000: integridad de Usuario.iglesiaId.

-- Una iglesia con personal no se borra: antes quedaba su personal sin iglesia (SET NULL).
-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_iglesiaId_fkey";

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Datos previos al CHECK. La Coordinación no tiene iglesia.
UPDATE "usuarios" SET "iglesiaId" = NULL WHERE "rol" = 'COORDINACION' AND "iglesiaId" IS NOT NULL;

-- Personal sin iglesia: NO se le asigna una al azar, porque vería los datos privados (diezmo,
-- solicitudes) de una iglesia ajena (A2-E1-03). La migración se detiene y lo lista para que la
-- Coordinación decida a qué iglesia pertenece cada persona.
DO $$
DECLARE
  sin_iglesia TEXT;
BEGIN
  SELECT string_agg("email", ', ' ORDER BY "email") INTO sin_iglesia
  FROM "usuarios"
  WHERE "rol" <> 'COORDINACION' AND "iglesiaId" IS NULL;
  IF sin_iglesia IS NOT NULL THEN
    RAISE EXCEPTION 'Hay personal sin iglesia: %. Asigna su iglesia (UPDATE usuarios SET "iglesiaId" = ...) y vuelve a aplicar la migración.', sin_iglesia;
  END IF;
END $$;

-- La Coordinación es nacional (sin iglesia); todo otro rol pertenece a una iglesia.
-- Prisma no modela CHECK: vive solo aquí y lo prueba middlewares/alcanceIglesia.test.ts.
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_iglesia_segun_rol" CHECK (
  ("rol" = 'COORDINACION' AND "iglesiaId" IS NULL)
  OR ("rol" <> 'COORDINACION' AND "iglesiaId" IS NOT NULL)
);
