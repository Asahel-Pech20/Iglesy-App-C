-- E1-09 (Santiago): cada iglesia tiene un solo encargado (ADMIN_IGLESIA) activo, como pidió el docente
-- (2026-11-19). La Coordinación lo reemplaza: desactiva o cambia de rol al actual y da de alta al nuevo.

-- Si ya hay iglesias con más de un encargado activo, NO se elige uno al azar: la migración se detiene
-- y los lista para que la Coordinación decida a quién conservar.
DO $$
DECLARE
  repetidos TEXT;
BEGIN
  SELECT string_agg(i."nombre" || ' (' || x.correos || ')', '; ' ORDER BY i."nombre") INTO repetidos
  FROM (
    SELECT "iglesiaId", string_agg("email", ', ' ORDER BY "email") AS correos
    FROM "usuarios"
    WHERE "rol" = 'ADMIN_IGLESIA' AND "activo"
    GROUP BY "iglesiaId"
    HAVING count(*) > 1
  ) AS x
  JOIN "iglesias" AS i ON i."id" = x."iglesiaId";
  IF repetidos IS NOT NULL THEN
    RAISE EXCEPTION 'Hay iglesias con más de un encargado activo: %. Desactiva a los que sobran (UPDATE usuarios SET activo = false ...) y vuelve a aplicar la migración.', repetidos;
  END IF;
END $$;

-- Índice único parcial: solo cuenta a los encargados activos (los desactivados conservan su historia).
-- Prisma no modela índices parciales, pero tampoco los borra: `prisma migrate diff` sale vacío.
CREATE UNIQUE INDEX "usuarios_un_encargado_por_iglesia"
  ON "usuarios" ("iglesiaId")
  WHERE "rol" = 'ADMIN_IGLESIA' AND "activo";
