-- Foto de la iglesia por URL (sin subir archivos) y lo que su licencia pide mostrar
ALTER TABLE "iglesias" ADD COLUMN     "fotoAutor" TEXT,
ADD COLUMN     "fotoEnlace" TEXT,
ADD COLUMN     "fotoLicencia" TEXT,
ADD COLUMN     "fotoLicenciaUrl" TEXT,
ADD COLUMN     "fotoUrl" TEXT;
