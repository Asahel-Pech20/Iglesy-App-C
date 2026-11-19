-- Ecclesia: padres, misas celebradas y diezmo (con historial de correcciones de solo inserción).

-- CreateTable
CREATE TABLE "padres" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "padres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "misas_celebradas" (
    "id" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "padreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "misas_celebradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diezmos" (
    "id" TEXT NOT NULL,
    "misaId" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "capturadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diezmos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diezmo_correcciones" (
    "id" TEXT NOT NULL,
    "diezmoId" TEXT NOT NULL,
    "montoAnterior" DECIMAL(12,2) NOT NULL,
    "montoNuevo" DECIMAL(12,2) NOT NULL,
    "hechaPorId" TEXT NOT NULL,
    "hechaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diezmo_correcciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "misas_celebradas_iglesiaId_inicio_idx" ON "misas_celebradas"("iglesiaId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "diezmos_misaId_key" ON "diezmos"("misaId");

-- CreateIndex
CREATE INDEX "diezmos_iglesiaId_idx" ON "diezmos"("iglesiaId");

-- CreateIndex
CREATE INDEX "diezmo_correcciones_diezmoId_idx" ON "diezmo_correcciones"("diezmoId");

-- AddForeignKey
ALTER TABLE "misas_celebradas" ADD CONSTRAINT "misas_celebradas_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "misas_celebradas" ADD CONSTRAINT "misas_celebradas_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "padres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diezmos" ADD CONSTRAINT "diezmos_misaId_fkey" FOREIGN KEY ("misaId") REFERENCES "misas_celebradas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diezmos" ADD CONSTRAINT "diezmos_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diezmos" ADD CONSTRAINT "diezmos_capturadoPorId_fkey" FOREIGN KEY ("capturadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diezmo_correcciones" ADD CONSTRAINT "diezmo_correcciones_diezmoId_fkey" FOREIGN KEY ("diezmoId") REFERENCES "diezmos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diezmo_correcciones" ADD CONSTRAINT "diezmo_correcciones_hechaPorId_fkey" FOREIGN KEY ("hechaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Dinero: nunca negativo (RN-44)
ALTER TABLE "diezmos" ADD CONSTRAINT "diezmos_monto_no_negativo" CHECK ("monto" >= 0);
ALTER TABLE "diezmo_correcciones" ADD CONSTRAINT "diezmo_correcciones_montos_no_negativos" CHECK ("montoAnterior" >= 0 AND "montoNuevo" >= 0);

-- El historial de correcciones solo se inserta: no se edita ni se borra (RN-43, RNF-12)
CREATE FUNCTION "diezmo_correcciones_solo_insercion"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'El historial de correcciones del diezmo no se puede modificar ni borrar.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "diezmo_correcciones_inmutable"
BEFORE UPDATE OR DELETE ON "diezmo_correcciones"
FOR EACH ROW EXECUTE FUNCTION "diezmo_correcciones_solo_insercion"();

-- El diezmo siempre es de la misma iglesia que su misa (alcance por iglesia, RNF-10)
CREATE FUNCTION "diezmos_misma_iglesia_que_su_misa"() RETURNS trigger AS $$
BEGIN
  IF NEW."iglesiaId" IS DISTINCT FROM (SELECT "iglesiaId" FROM "misas_celebradas" WHERE "id" = NEW."misaId") THEN
    RAISE EXCEPTION 'El diezmo debe pertenecer a la misma iglesia que su misa.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "diezmos_iglesia_de_la_misa"
BEFORE INSERT OR UPDATE ON "diezmos"
FOR EACH ROW EXECUTE FUNCTION "diezmos_misma_iglesia_que_su_misa"();
