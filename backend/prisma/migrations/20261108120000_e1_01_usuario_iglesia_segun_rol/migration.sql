-- E1-01 (Santiago) sobre la base de iglesias de 20261106170000: integridad de Usuario.iglesiaId.

-- Una iglesia con personal no se borra: antes quedaba su personal sin iglesia (SET NULL).
-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_iglesiaId_fkey";

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Datos previos al CHECK (supuesto S-03 de docs/ecclesia/plan-santiago.md): la Coordinación no
-- tiene iglesia, y el personal que haya quedado sin iglesia pasa a la iglesia inicial (la más antigua).
UPDATE "usuarios" SET "iglesiaId" = NULL WHERE "rol" = 'COORDINACION' AND "iglesiaId" IS NOT NULL;
UPDATE "usuarios"
SET "iglesiaId" = (SELECT "id" FROM "iglesias" ORDER BY "createdAt", "id" LIMIT 1)
WHERE "rol" <> 'COORDINACION' AND "iglesiaId" IS NULL;

-- La Coordinación es nacional (sin iglesia); todo otro rol pertenece a una iglesia.
-- Prisma no modela CHECK: vive solo aquí y lo prueba middlewares/alcanceIglesia.test.ts.
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_iglesia_segun_rol" CHECK (
  ("rol" = 'COORDINACION' AND "iglesiaId" IS NULL)
  OR ("rol" <> 'COORDINACION' AND "iglesiaId" IS NOT NULL)
);
