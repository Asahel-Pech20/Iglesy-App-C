# Colección de Postman de Ecclesia

**Esta es la colección del equipo.** Se genera desde `backend/openapi.yaml` y **no se edita a mano**. Cada vez que cambie ese archivo:

```bash
pnpm --filter backend postman
```

Reescribe `ecclesia.postman_collection.json` y `local.postman_environment.json` (Postman v2.1). Dos corridas sin cambios en el YAML dan el mismo resultado. Una ruta nueva de Express sin documentar en `openapi.yaml` hace fallar la prueba `openapiCobertura.test.ts`, así que la colección no se desfasa.

Las colecciones de `docs/ecclesia/postman/` (la de Genaro, de misas y servicios, y la de Nataly, de iglesias y patrimonio) son **recorridos probados por cada quien**: se mantienen a mano, aparte de esta, y el generador no las lee ni las modifica.

## Cómo importarla

1. Postman → **Import** → elige los dos archivos de esta carpeta.
2. Arriba a la derecha selecciona el entorno **Ecclesia local**.
3. Levanta la API (`pnpm dev`) con la base sembrada (`pnpm --filter backend db:seed`).

## Carpetas

| Carpeta | Contenido |
|---|---|
| 0. Iniciar sesión | Un login por rol |
| Recorrido de la demo | 13 pasos escritos a mano en el generador |
| Santiago | Sistema (`/health`), auth, usuarios y configuración |
| Nataly | Iglesias, catálogos, patrimonio, criterios del índice y sus consultas públicas |
| Genaro | Padres, horario de misas, misas celebradas, agenda, servicios y pláticas (también las públicas) |
| Oscar | Donaciones, dashboard, reportes, diezmo y espacios (también las públicas) |
| Gestión interna | Miembros y ministerios (Nataly); eventos, asistencia, anuncios y cartelera (Genaro) |

Los dueños salen de `specs.md §9` y `§12.6`. Cada carpeta agrupa los requests por la etiqueta de `openapi.yaml`, con un request por operación; las públicas van sin autenticación. Si aparece una etiqueta nueva, sus rutas caen en «Sin dueño asignado» hasta agregarla en `backend/scripts/generar-postman.ts`.

## Orden para usarla

1. **0. Iniciar sesión:** corre el login del rol que necesites (coordinación, admin, pastor, secretario, tesorero o coordinador). Guarda `token` y, si el usuario tiene iglesia, `iglesiaId` en el entorno. Todas las demás carpetas usan ese token.
2. **Recorrido de la demo:** 13 pasos en orden (diezmo del tesorero → solicitud pública de espacio → cotización → aceptación). Cada paso prueba su código HTTP.
3. **Carpetas por integrante:** el request que necesites.

Variables del entorno: `baseUrl`, `token`, `iglesiaId`, `folio`, `clave` y `passwordPrueba`. Esta última es la contraseña de los usuarios del seed de desarrollo (`SEED_PASSWORD` de `backend/.env.example`): es **solo de prueba**, no un secreto. Los usuarios son `<rol>@iglesia.local` (`admin@` es el encargado).

## Ojo con el límite del login

`POST /auth/login` permite **5 por minuto por IP**. La carpeta «0. Iniciar sesión» tiene 6 logins: no la corras completa de golpe (responde 429). El recorrido de la demo usa 2.

## Correr el recorrido sin Postman

```bash
pnpm --filter backend postman:recorrido -- --url http://localhost:3000/api/v1
```

Lee la colección y hace las peticiones con `fetch` (sin newman). Úsalo solo con la API local sobre la **base temporal de pruebas** con la semilla cargada, nunca la de desarrollo: crea una solicitud de espacio en cada corrida. Se niega a correr si la URL no es localhost. No forma parte de `pnpm test` ni del CI.
