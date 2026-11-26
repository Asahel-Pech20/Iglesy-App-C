-- E3-25 (supuesto P-33): días inhábiles. En una fecha, una misa del horario no se celebra (SIN_MISA)
-- o se celebra a otra hora (OTRA_HORA), con su motivo. Generada con `prisma migrate diff`.

-- CreateEnum
CREATE TYPE "TipoExcepcionMisa" AS ENUM ('SIN_MISA', 'OTRA_HORA');

-- CreateTable
CREATE TABLE "excepciones_misa" (
    "id" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "horarioMisaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoExcepcionMisa" NOT NULL,
    "horaNueva" TEXT,
    "motivo" TEXT NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excepciones_misa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "excepciones_misa_iglesiaId_fecha_idx" ON "excepciones_misa"("iglesiaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "excepciones_misa_horarioMisaId_fecha_key" ON "excepciones_misa"("horarioMisaId", "fecha");

-- AddForeignKey
ALTER TABLE "excepciones_misa" ADD CONSTRAINT "excepciones_misa_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepciones_misa" ADD CONSTRAINT "excepciones_misa_horarioMisaId_fkey" FOREIGN KEY ("horarioMisaId") REFERENCES "horarios_misa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepciones_misa" ADD CONSTRAINT "excepciones_misa_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Coherencia del tipo: OTRA_HORA lleva una hora «HH:mm» válida; SIN_MISA no lleva hora
ALTER TABLE "excepciones_misa" ADD CONSTRAINT "excepciones_misa_hora_segun_tipo" CHECK (
  ("tipo" = 'OTRA_HORA' AND "horaNueva" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  OR ("tipo" = 'SIN_MISA' AND "horaNueva" IS NULL)
);
ALTER TABLE "excepciones_misa" ADD CONSTRAINT "excepciones_misa_motivo" CHECK (length(btrim("motivo")) BETWEEN 3 AND 300);

-- La excepción es de la misma iglesia que su misa del horario (alcance por iglesia, RNF-10)
CREATE FUNCTION "excepciones_misa_misma_iglesia_que_su_horario"() RETURNS trigger AS $$
BEGIN
  IF NEW."iglesiaId" IS DISTINCT FROM
     (SELECT "iglesiaId" FROM "horarios_misa" WHERE "id" = NEW."horarioMisaId") THEN
    RAISE EXCEPTION 'La excepción debe pertenecer a la misma iglesia que su misa del horario.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "excepciones_misa_iglesia_del_horario"
BEFORE INSERT OR UPDATE ON "excepciones_misa"
FOR EACH ROW EXECUTE FUNCTION "excepciones_misa_misma_iglesia_que_su_horario"();
