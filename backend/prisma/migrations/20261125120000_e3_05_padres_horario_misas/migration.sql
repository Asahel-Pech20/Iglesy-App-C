-- E3-05 (Genaro): padres en varias iglesias, horario semanal de misas y sustituciones.
-- Los campos nuevos de misas_celebradas son opcionales: las misas que ya registra el diezmo siguen igual.

-- CreateEnum
CREATE TYPE "TipoMisa" AS ENUM ('DIARIA', 'DOMINICAL', 'ESPECIAL');

-- CreateEnum
CREATE TYPE "IdiomaMisa" AS ENUM ('ESPANOL', 'NAHUATL', 'MAYA', 'TSELTAL', 'TSOTSIL', 'MIXTECO', 'ZAPOTECO', 'OTOMI', 'TOTONACO', 'MAZATECO', 'CHOL', 'OTRO');

-- AlterTable
ALTER TABLE "misas_celebradas" ADD COLUMN     "duracionMin" INTEGER,
ADD COLUMN     "fecha" DATE,
ADD COLUMN     "horarioMisaId" TEXT,
ADD COLUMN     "registradoPorId" TEXT;

-- AlterTable
ALTER TABLE "padres" ADD COLUMN     "titulo" TEXT;

-- CreateTable
CREATE TABLE "padres_iglesias" (
    "padreId" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "padres_iglesias_pkey" PRIMARY KEY ("padreId","iglesiaId")
);

-- CreateTable
CREATE TABLE "horarios_misa" (
    "id" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "hora" TEXT NOT NULL,
    "tipo" "TipoMisa" NOT NULL,
    "idioma" "IdiomaMisa" NOT NULL DEFAULT 'ESPANOL',
    "duracionMin" INTEGER,
    "padreId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horarios_misa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sustituciones_misa" (
    "id" TEXT NOT NULL,
    "misaCelebradaId" TEXT NOT NULL,
    "padreProgramadoId" TEXT NOT NULL,
    "padreRealId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "hechaPorId" TEXT NOT NULL,
    "hechaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sustituciones_misa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "padres_iglesias_iglesiaId_activo_idx" ON "padres_iglesias"("iglesiaId", "activo");

-- CreateIndex
CREATE INDEX "horarios_misa_iglesiaId_activo_diaSemana_idx" ON "horarios_misa"("iglesiaId", "activo", "diaSemana");

-- CreateIndex
CREATE INDEX "horarios_misa_padreId_activo_idx" ON "horarios_misa"("padreId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "sustituciones_misa_misaCelebradaId_key" ON "sustituciones_misa"("misaCelebradaId");

-- CreateIndex
CREATE INDEX "sustituciones_misa_padreProgramadoId_idx" ON "sustituciones_misa"("padreProgramadoId");

-- CreateIndex
CREATE INDEX "misas_celebradas_padreId_inicio_idx" ON "misas_celebradas"("padreId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "misas_celebradas_horarioMisaId_fecha_key" ON "misas_celebradas"("horarioMisaId", "fecha");

-- AddForeignKey
ALTER TABLE "padres_iglesias" ADD CONSTRAINT "padres_iglesias_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "padres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padres_iglesias" ADD CONSTRAINT "padres_iglesias_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_misa" ADD CONSTRAINT "horarios_misa_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_misa" ADD CONSTRAINT "horarios_misa_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "padres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "misas_celebradas" ADD CONSTRAINT "misas_celebradas_horarioMisaId_fkey" FOREIGN KEY ("horarioMisaId") REFERENCES "horarios_misa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "misas_celebradas" ADD CONSTRAINT "misas_celebradas_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sustituciones_misa" ADD CONSTRAINT "sustituciones_misa_misaCelebradaId_fkey" FOREIGN KEY ("misaCelebradaId") REFERENCES "misas_celebradas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sustituciones_misa" ADD CONSTRAINT "sustituciones_misa_padreProgramadoId_fkey" FOREIGN KEY ("padreProgramadoId") REFERENCES "padres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sustituciones_misa" ADD CONSTRAINT "sustituciones_misa_padreRealId_fkey" FOREIGN KEY ("padreRealId") REFERENCES "padres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sustituciones_misa" ADD CONSTRAINT "sustituciones_misa_hechaPorId_fkey" FOREIGN KEY ("hechaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Horario semanal: día 0 (domingo) a 6 (sábado), hora «HH:mm» y duración de 1 a 720 min (RN-27)
ALTER TABLE "horarios_misa" ADD CONSTRAINT "horarios_misa_dia_valido" CHECK ("diaSemana" BETWEEN 0 AND 6);
ALTER TABLE "horarios_misa" ADD CONSTRAINT "horarios_misa_hora_valida" CHECK ("hora" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "horarios_misa" ADD CONSTRAINT "horarios_misa_duracion_valida" CHECK ("duracionMin" IS NULL OR "duracionMin" BETWEEN 1 AND 720);

-- Misa celebrada: duración válida y, si sale del horario, con su fecha local (una por día, P-17)
ALTER TABLE "misas_celebradas" ADD CONSTRAINT "misas_celebradas_duracion_valida" CHECK ("duracionMin" IS NULL OR "duracionMin" BETWEEN 1 AND 720);
ALTER TABLE "misas_celebradas" ADD CONSTRAINT "misas_celebradas_fecha_con_horario" CHECK ("horarioMisaId" IS NULL OR "fecha" IS NOT NULL);

-- Sustitución: el sustituto es otro padre y el motivo no está vacío (RF-49, RN-30)
ALTER TABLE "sustituciones_misa" ADD CONSTRAINT "sustituciones_misa_padres_distintos" CHECK ("padreProgramadoId" <> "padreRealId");
ALTER TABLE "sustituciones_misa" ADD CONSTRAINT "sustituciones_misa_motivo_no_vacio" CHECK (length(btrim("motivo")) > 0);

-- La misa celebrada es de la misma iglesia que su misa del horario (alcance por iglesia, RNF-10)
CREATE FUNCTION "misas_celebradas_misma_iglesia_que_su_horario"() RETURNS trigger AS $$
BEGIN
  IF NEW."horarioMisaId" IS NOT NULL AND NEW."iglesiaId" IS DISTINCT FROM
     (SELECT "iglesiaId" FROM "horarios_misa" WHERE "id" = NEW."horarioMisaId") THEN
    RAISE EXCEPTION 'La misa celebrada debe pertenecer a la misma iglesia que su misa del horario.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "misas_celebradas_iglesia_del_horario"
BEFORE INSERT OR UPDATE ON "misas_celebradas"
FOR EACH ROW EXECUTE FUNCTION "misas_celebradas_misma_iglesia_que_su_horario"();

-- El padre real de la sustitución es el que ofició la misa celebrada (RN-29)
CREATE FUNCTION "sustituciones_misa_padre_real_de_la_misa"() RETURNS trigger AS $$
BEGIN
  IF NEW."padreRealId" IS DISTINCT FROM
     (SELECT "padreId" FROM "misas_celebradas" WHERE "id" = NEW."misaCelebradaId") THEN
    RAISE EXCEPTION 'El padre real de la sustitución debe ser el que ofició la misa celebrada.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "sustituciones_misa_padre_real"
BEFORE INSERT ON "sustituciones_misa"
FOR EACH ROW EXECUTE FUNCTION "sustituciones_misa_padre_real_de_la_misa"();

-- Las sustituciones solo se insertan: no se editan ni se borran (RF-50, RN-30, RNF-12)
CREATE FUNCTION "sustituciones_misa_solo_insercion"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Las sustituciones de misa no se pueden modificar ni borrar.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "sustituciones_misa_inmutable"
BEFORE UPDATE OR DELETE ON "sustituciones_misa"
FOR EACH ROW EXECUTE FUNCTION "sustituciones_misa_solo_insercion"();
