-- A2-E2-06 (decisión de Oscar, 2026-11-21): el nombre de una iglesia es único por municipio,
-- sin distinguir mayúsculas. Antes la regla era nacional y solo vivía en el service.
-- Fecha posterior a 20261121120000_e4_07_espacios (Oscar) a propósito.

-- Si ya hay repetidos en un mismo municipio, NO se renombra nada: se detiene y los lista.
DO $$
DECLARE
  repetidos TEXT;
BEGIN
  SELECT string_agg(x.nombre || ' (municipio ' || x."municipioClave" || ')', '; ' ORDER BY x.nombre)
    INTO repetidos
  FROM (
    SELECT "municipioClave", min("nombre") AS nombre
    FROM "iglesias"
    WHERE "municipioClave" IS NOT NULL
    GROUP BY "municipioClave", lower("nombre")
    HAVING count(*) > 1
  ) AS x;
  IF repetidos IS NOT NULL THEN
    RAISE EXCEPTION 'Hay iglesias con el mismo nombre en un municipio: %. Renombra una de cada par y vuelve a aplicar la migración.', repetidos;
  END IF;
END $$;

-- Índice de expresión (lower) para no distinguir mayúsculas. Prisma no lo modela pero tampoco lo
-- borra: `prisma migrate diff` sale vacío. Las iglesias sin municipio las compara el service.
CREATE UNIQUE INDEX "iglesias_nombre_por_municipio"
  ON "iglesias" ("municipioClave", lower("nombre"))
  WHERE "municipioClave" IS NOT NULL;
