-- Ecclesia: iglesias, alcance por iglesia y roles nacionales.

-- Roles: ADMIN pasa a ADMIN_IGLESIA y se agrega COORDINACION (alcance nacional)
ALTER TYPE "Rol" RENAME VALUE 'ADMIN' TO 'ADMIN_IGLESIA';
ALTER TYPE "Rol" ADD VALUE 'COORDINACION' BEFORE 'ADMIN_IGLESIA';

-- CreateEnum
CREATE TYPE "TipoIglesia" AS ENUM ('CATEDRAL', 'BASILICA', 'PARROQUIA', 'TEMPLO', 'CAPILLA', 'SANTUARIO');

-- CreateTable
CREATE TABLE "iglesias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoIglesia" NOT NULL,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iglesias_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "iglesiaId" TEXT;

-- CreateIndex
CREATE INDEX "usuarios_iglesiaId_idx" ON "usuarios"("iglesiaId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los datos actuales pasan a una iglesia inicial (con el nombre y la zona horaria de la configuración)
INSERT INTO "iglesias" ("id", "nombre", "tipo", "zonaHoraria", "updatedAt")
SELECT gen_random_uuid()::text,
       COALESCE(c."nombre", 'Mi Iglesia'),
       'PARROQUIA',
       COALESCE(c."zonaHoraria", 'America/Mexico_City'),
       CURRENT_TIMESTAMP
FROM (SELECT 1) AS base
LEFT JOIN "configuracion_iglesia" AS c ON c."id" = 1;

UPDATE "usuarios" SET "iglesiaId" = (SELECT "id" FROM "iglesias" LIMIT 1);
