-- E3-25: corrige el CHECK de excepciones_misa. Con "horaNueva" NULL, la comparación con la expresión
-- regular da NULL y un CHECK que da NULL se acepta, así que OTRA_HORA sin hora pasaba. Ahora la hora
-- se exige con IS NOT NULL antes de compararla.
ALTER TABLE "excepciones_misa" DROP CONSTRAINT "excepciones_misa_hora_segun_tipo";
ALTER TABLE "excepciones_misa" ADD CONSTRAINT "excepciones_misa_hora_segun_tipo" CHECK (
  ("tipo" = 'OTRA_HORA' AND "horaNueva" IS NOT NULL AND "horaNueva" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  OR ("tipo" = 'SIN_MISA' AND "horaNueva" IS NULL)
);
