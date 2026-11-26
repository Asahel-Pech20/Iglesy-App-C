-- E3-06 (Genaro): cada padre queda asociado a las iglesias donde ya ofició misas (RF-41, RN-28).
-- Las misas que registró el diezmo antes de E3-05 no tenían asociación; sin esto, la lista de
-- padres de la iglesia (`GET /iglesias/:id/padres`, que ahora solo muestra asociados) saldría vacía.
INSERT INTO "padres_iglesias" ("padreId", "iglesiaId", "activo", "createdAt", "updatedAt")
SELECT DISTINCT m."padreId", m."iglesiaId", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "misas_celebradas" m
ON CONFLICT ("padreId", "iglesiaId") DO NOTHING;
