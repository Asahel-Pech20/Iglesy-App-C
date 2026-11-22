-- CreateEnum
CREATE TYPE "ClaseEspacio" AS ENUM ('CRIPTA', 'NICHO', 'COLUMBARIO', 'OSARIO');

-- CreateEnum
CREATE TYPE "EstadoSolicitudEspacio" AS ENUM ('RECIBIDA', 'SIN_LUGAR', 'COTIZADA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "RespuestaCotizacion" AS ENUM ('ACEPTADA', 'RECHAZADA', 'VENCIDA');

-- CreateTable
CREATE TABLE "tipos_espacio" (
    "id" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "clase" "ClaseEspacio" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_espacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_espacio" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "claveHash" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "tipoEspacioId" TEXT NOT NULL,
    "contactoNombre" TEXT NOT NULL,
    "contactoTelefono" TEXT,
    "contactoCorreo" TEXT,
    "comentarios" TEXT,
    "estado" "EstadoSolicitudEspacio" NOT NULL DEFAULT 'RECIBIDA',
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_espacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "condiciones" TEXT NOT NULL,
    "emitidaEn" TIMESTAMP(3) NOT NULL,
    "venceEn" TIMESTAMP(3) NOT NULL,
    "respuesta" "RespuestaCotizacion",
    "respondidaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_espacio_iglesiaId_clase_key" ON "tipos_espacio"("iglesiaId", "clase");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_espacio_folio_key" ON "solicitudes_espacio"("folio");

-- CreateIndex
CREATE INDEX "solicitudes_espacio_iglesiaId_estado_idx" ON "solicitudes_espacio"("iglesiaId", "estado");

-- CreateIndex
CREATE INDEX "solicitudes_espacio_tipoEspacioId_idx" ON "solicitudes_espacio"("tipoEspacioId");

-- CreateIndex
CREATE INDEX "cotizaciones_solicitudId_idx" ON "cotizaciones"("solicitudId");

-- AddForeignKey
ALTER TABLE "tipos_espacio" ADD CONSTRAINT "tipos_espacio_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_espacio" ADD CONSTRAINT "solicitudes_espacio_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_espacio" ADD CONSTRAINT "solicitudes_espacio_tipoEspacioId_fkey" FOREIGN KEY ("tipoEspacioId") REFERENCES "tipos_espacio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_espacio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Reglas que Prisma no modela (E4-07, RN-47 a RN-53) ----------

-- Dinero: la cotización siempre cuesta algo (RN-44) y vence después de emitirse (RN-51)
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_monto_positivo" CHECK ("monto" > 0);
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_vence_despues_de_emitirse" CHECK ("venceEn" > "emitidaEn");
ALTER TABLE "solicitudes_espacio" ADD CONSTRAINT "solicitudes_espacio_intentos_no_negativos" CHECK ("intentosFallidos" >= 0);

-- A lo sumo una cotización sin respuesta por solicitud. Se permiten varias en total, así que si el
-- cliente acepta volver a cotizar (P-26) no hace falta otra migración: la anterior se cierra con una respuesta.
CREATE UNIQUE INDEX "cotizaciones_una_vigente_por_solicitud"
  ON "cotizaciones" ("solicitudId")
  WHERE "respuesta" IS NULL;

-- La solicitud es de la misma iglesia que el tipo de espacio que pide (alcance por iglesia, RNF-10)
CREATE FUNCTION "solicitudes_espacio_misma_iglesia_que_su_tipo"() RETURNS trigger AS $$
BEGIN
  IF NEW."iglesiaId" IS DISTINCT FROM (SELECT "iglesiaId" FROM "tipos_espacio" WHERE "id" = NEW."tipoEspacioId") THEN
    RAISE EXCEPTION 'La solicitud debe pertenecer a la misma iglesia que su tipo de espacio.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "solicitudes_espacio_iglesia_del_tipo"
BEFORE INSERT OR UPDATE ON "solicitudes_espacio"
FOR EACH ROW EXECUTE FUNCTION "solicitudes_espacio_misma_iglesia_que_su_tipo"();

-- Número consecutivo del folio legible (ESP-2026-000123). Es nacional: no se repite entre iglesias (P-25).
CREATE SEQUENCE "solicitudes_espacio_folio_seq";
