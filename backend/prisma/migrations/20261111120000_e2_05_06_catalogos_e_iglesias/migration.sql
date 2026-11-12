-- E2-05 y E2-06 (Nataly): catálogo del INEGI y datos completos de la iglesia (RF-07–RF-12, RN-07, RN-09).

-- CreateTable
CREATE TABLE "estados" (
    "clave" CHAR(2) NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "estados_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "municipios" (
    "clave" CHAR(5) NOT NULL,
    "estadoClave" CHAR(2) NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "municipios_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "localidades" (
    "clave" CHAR(9) NOT NULL,
    "municipioClave" CHAR(5) NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "localidades_pkey" PRIMARY KEY ("clave")
);

-- AlterTable
ALTER TABLE "iglesias" ADD COLUMN     "anioConstruccion" INTEGER,
ADD COLUMN     "capacidad" INTEGER,
ADD COLUMN     "correo" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "estadoClave" CHAR(2),
ADD COLUMN     "fechaCierre" DATE,
ADD COLUMN     "latitud" DECIMAL(9,6),
ADD COLUMN     "localidadClave" CHAR(9),
ADD COLUMN     "longitud" DECIMAL(9,6),
ADD COLUMN     "motivoCierre" TEXT,
ADD COLUMN     "municipioClave" CHAR(5),
ADD COLUMN     "telefono" TEXT;

-- CreateIndex
CREATE INDEX "municipios_estadoClave_idx" ON "municipios"("estadoClave");

-- CreateIndex
CREATE INDEX "localidades_municipioClave_idx" ON "localidades"("municipioClave");

-- CreateIndex
CREATE INDEX "iglesias_estadoClave_activa_idx" ON "iglesias"("estadoClave", "activa");

-- CreateIndex
CREATE INDEX "iglesias_municipioClave_idx" ON "iglesias"("municipioClave");

-- AddForeignKey
ALTER TABLE "municipios" ADD CONSTRAINT "municipios_estadoClave_fkey" FOREIGN KEY ("estadoClave") REFERENCES "estados"("clave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localidades" ADD CONSTRAINT "localidades_municipioClave_fkey" FOREIGN KEY ("municipioClave") REFERENCES "municipios"("clave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iglesias" ADD CONSTRAINT "iglesias_estadoClave_fkey" FOREIGN KEY ("estadoClave") REFERENCES "estados"("clave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iglesias" ADD CONSTRAINT "iglesias_municipioClave_fkey" FOREIGN KEY ("municipioClave") REFERENCES "municipios"("clave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iglesias" ADD CONSTRAINT "iglesias_localidadClave_fkey" FOREIGN KEY ("localidadClave") REFERENCES "localidades"("clave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no modela (CHECK): viven solo aquí y las prueban catalogos.test.ts e iglesias.test.ts.
-- Las claves tienen exactamente sus dígitos y cada nivel empieza con la clave de su padre.
ALTER TABLE "estados" ADD CONSTRAINT "estados_clave_valida" CHECK ("clave" ~ '^[0-9]{2}$');
ALTER TABLE "municipios" ADD CONSTRAINT "municipios_clave_valida"
  CHECK ("clave" ~ '^[0-9]{5}$' AND left("clave", 2) = "estadoClave");
ALTER TABLE "localidades" ADD CONSTRAINT "localidades_clave_valida"
  CHECK ("clave" ~ '^[0-9]{9}$' AND left("clave", 5) = "municipioClave");

-- RN-09: el municipio es del estado y la localidad del municipio; no hay localidad sin municipio
-- ni municipio sin estado. El service da el mensaje por campo; esto protege los datos.
ALTER TABLE "iglesias" ADD CONSTRAINT "iglesias_ubicacion_consistente" CHECK (
  ("municipioClave" IS NULL OR ("estadoClave" IS NOT NULL AND left("municipioClave", 2) = "estadoClave"))
  AND ("localidadClave" IS NULL OR ("municipioClave" IS NOT NULL AND left("localidadClave", 5) = "municipioClave"))
);

-- Datos con sentido: capacidad positiva, año razonable, coordenadas en rango y ambas o ninguna.
ALTER TABLE "iglesias" ADD CONSTRAINT "iglesias_datos_validos" CHECK (
  ("capacidad" IS NULL OR "capacidad" > 0)
  AND ("anioConstruccion" IS NULL OR "anioConstruccion" BETWEEN 1500 AND 2100)
  AND (("latitud" IS NULL) = ("longitud" IS NULL))
  AND ("latitud" IS NULL OR "latitud" BETWEEN -90 AND 90)
  AND ("longitud" IS NULL OR "longitud" BETWEEN -180 AND 180)
);

-- RN-07: una iglesia con fecha de cierre está cerrada (activa = false).
ALTER TABLE "iglesias" ADD CONSTRAINT "iglesias_cierre_consistente" CHECK (
  "fechaCierre" IS NULL OR "activa" = false
);
