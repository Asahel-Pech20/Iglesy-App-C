-- E2-08 y E2-10 (Nataly): objetos patrimoniales y criterios del índice (RF-13–RF-17, RF-22,
-- RN-10, RN-11, RN-14, RN-16, ADR-0005). Solo crea tablas nuevas: no toca datos existentes.

-- CreateEnum
CREATE TYPE "TipoObjeto" AS ENUM ('IMAGEN', 'RETABLO', 'PINTURA', 'MURAL', 'ORGANO', 'PIANO', 'ORFEBRERIA', 'MOBILIARIO_LITURGICO', 'DOCUMENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoObjeto" AS ENUM ('VIGENTE', 'PERDIDO', 'PRESTADO', 'BAJA');

-- CreateTable
CREATE TABLE "objetos_patrimoniales" (
    "id" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoObjeto" NOT NULL,
    "anio" INTEGER,
    "siglo" INTEGER,
    "material" TEXT NOT NULL,
    "estadoConservacion" TEXT NOT NULL,
    "ubicacionEnTemplo" TEXT NOT NULL,
    "catalogadoInah" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoObjeto" NOT NULL DEFAULT 'VIGENTE',
    "fechaEstado" DATE,
    "motivoEstado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objetos_patrimoniales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criterios_indice" (
    "id" TEXT NOT NULL,
    "rangosEdad" JSONB NOT NULL,
    "multiplicadores" JSONB NOT NULL,
    "puntosInah" DECIMAL(5,1) NOT NULL,
    "distinciones" JSONB NOT NULL,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "criterios_indice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "objetos_patrimoniales_iglesiaId_estado_idx" ON "objetos_patrimoniales"("iglesiaId", "estado");

-- CreateIndex
CREATE INDEX "objetos_patrimoniales_tipo_estado_idx" ON "objetos_patrimoniales"("tipo", "estado");

-- CreateIndex
CREATE INDEX "criterios_indice_createdAt_idx" ON "criterios_indice"("createdAt");

-- AddForeignKey
ALTER TABLE "objetos_patrimoniales" ADD CONSTRAINT "objetos_patrimoniales_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criterios_indice" ADD CONSTRAINT "criterios_indice_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RN-10: sin año ni siglo no se puede calificar el objeto
ALTER TABLE "objetos_patrimoniales" ADD CONSTRAINT "objetos_anio_o_siglo"
  CHECK ("anio" IS NOT NULL OR "siglo" IS NOT NULL);

ALTER TABLE "objetos_patrimoniales" ADD CONSTRAINT "objetos_datos_validos"
  CHECK (("anio" IS NULL OR "anio" BETWEEN 1 AND 2100)
     AND ("siglo" IS NULL OR "siglo" BETWEEN 1 AND 21));

-- RN-11: un objeto que dejó de ser vigente guarda la fecha y el motivo del cambio
ALTER TABLE "objetos_patrimoniales" ADD CONSTRAINT "objetos_estado_consistente"
  CHECK ("estado" = 'VIGENTE' OR ("fechaEstado" IS NOT NULL AND "motivoEstado" IS NOT NULL));

ALTER TABLE "criterios_indice" ADD CONSTRAINT "criterios_inah_valido" CHECK ("puntosInah" >= 0);
