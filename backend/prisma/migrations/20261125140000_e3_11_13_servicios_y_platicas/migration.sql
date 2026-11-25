-- E3-11 y E3-13 (Genaro): servicios y pláticas de cada iglesia, con sus horarios.

-- CreateEnum
CREATE TYPE "FormaCosto" AS ENUM ('MONTO', 'GRATUITO', 'DONATIVO');

-- CreateEnum
CREATE TYPE "TipoPlatica" AS ENUM ('PREBAUTISMAL', 'PRIMERA_COMUNION', 'CONFIRMACION', 'PREMATRIMONIAL');

-- CreateTable
CREATE TABLE "servicios" (
    "id" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "formaCosto" "FormaCosto" NOT NULL,
    "monto" DECIMAL(12,2),
    "requisitos" TEXT,
    "duracionMin" INTEGER,
    "requiereCita" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_servicio" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "hora" TEXT NOT NULL,

    CONSTRAINT "horarios_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platicas" (
    "id" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "tipo" "TipoPlatica" NOT NULL,
    "sesiones" INTEGER NOT NULL,
    "costo" DECIMAL(12,2) NOT NULL,
    "cupo" INTEGER NOT NULL,
    "lugar" TEXT NOT NULL,
    "imparte" TEXT NOT NULL,
    "padreId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_platica" (
    "id" TEXT NOT NULL,
    "platicaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "hora" TEXT NOT NULL,

    CONSTRAINT "horarios_platica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servicios_iglesiaId_activo_idx" ON "servicios"("iglesiaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_servicio_servicioId_diaSemana_hora_key" ON "horarios_servicio"("servicioId", "diaSemana", "hora");

-- CreateIndex
CREATE INDEX "platicas_iglesiaId_activo_tipo_idx" ON "platicas"("iglesiaId", "activo", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_platica_platicaId_diaSemana_hora_key" ON "horarios_platica"("platicaId", "diaSemana", "hora");

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_servicio" ADD CONSTRAINT "horarios_servicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platicas" ADD CONSTRAINT "platicas_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platicas" ADD CONSTRAINT "platicas_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "padres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_platica" ADD CONSTRAINT "horarios_platica_platicaId_fkey" FOREIGN KEY ("platicaId") REFERENCES "platicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Servicio: el monto concuerda con la forma de costo (RN-22, supuesto P-11)
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_costo_consistente" CHECK (
  ("formaCosto" = 'MONTO' AND "monto" IS NOT NULL AND "monto" > 0) OR
  ("formaCosto" = 'GRATUITO' AND "monto" IS NULL) OR
  ("formaCosto" = 'DONATIVO' AND ("monto" IS NULL OR "monto" > 0))
);
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_duracion_valida" CHECK ("duracionMin" IS NULL OR "duracionMin" BETWEEN 1 AND 1440);
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_nombre_no_vacio" CHECK (length(btrim("nombre")) > 0);
-- Un mismo servicio no se repite en una iglesia (sin distinguir mayúsculas); los dados de baja no cuentan
CREATE UNIQUE INDEX "servicios_nombre_por_iglesia" ON "servicios" ("iglesiaId", lower("nombre")) WHERE "activo";

-- Plática: sesiones y cupo positivos, costo no negativo (RN-25)
ALTER TABLE "platicas" ADD CONSTRAINT "platicas_datos_validos" CHECK (
  "sesiones" BETWEEN 1 AND 100 AND "cupo" BETWEEN 1 AND 10000 AND "costo" >= 0
);
ALTER TABLE "platicas" ADD CONSTRAINT "platicas_textos_no_vacios" CHECK (
  length(btrim("lugar")) > 0 AND length(btrim("imparte")) > 0
);

-- Horarios: día 0 (domingo) a 6 (sábado) y hora «HH:mm»
ALTER TABLE "horarios_servicio" ADD CONSTRAINT "horarios_servicio_validos" CHECK (
  "diaSemana" BETWEEN 0 AND 6 AND "hora" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
);
ALTER TABLE "horarios_platica" ADD CONSTRAINT "horarios_platica_validos" CHECK (
  "diaSemana" BETWEEN 0 AND 6 AND "hora" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
);
