# Colección de Postman de Ecclesia

La colección sale de `backend/openapi.yaml`: **no se edita a mano**. Cada vez que cambie ese archivo:

```bash
pnpm --filter backend postman
```

Reescribe `ecclesia.postman_collection.json` y `local.postman_environment.json` (Postman v2.1). Dos corridas sin cambios en el YAML dan el mismo resultado. Una ruta nueva de Express sin documentar en `openapi.yaml` hace fallar la prueba `openapiCobertura.test.ts`, así que la colección no se desfasa.

## Cómo importarla

1. Postman → **Import** → elige los dos archivos de esta carpeta.
2. Arriba a la derecha selecciona el entorno **Ecclesia local**.
3. Levanta la API (`pnpm dev`) con la base sembrada (`pnpm --filter backend db:seed`).

## Orden para usarla

1. **0. Iniciar sesión:** corre el login del rol que necesites (coordinación, admin, pastor, secretario, tesorero o coordinador). Guarda `accessToken` y, si el usuario tiene iglesia, `iglesiaId` en el entorno. Todas las demás carpetas usan ese token.
2. **Recorrido de la demo:** 13 pasos en orden (diezmo del tesorero → solicitud pública de espacio → cotización → aceptación). Cada paso prueba su código HTTP.
3. Las carpetas por grupo (Auth, Usuarios, Iglesias, Misas, Diezmo, Espacios, Público…) traen un request por cada operación del YAML. Las públicas van sin autenticación.

Variables del entorno: `baseUrl`, `accessToken`, `iglesiaId`, `folio`, `clave` y `passwordPrueba`. Esta última es la contraseña de los usuarios del seed de desarrollo (`SEED_PASSWORD` de `backend/.env.example`): es **solo de prueba**, no un secreto. Los usuarios son `<rol>@iglesia.local` (`admin@` es el encargado).

## Ojo con el límite del login

`POST /auth/login` permite **5 por minuto por IP**. La carpeta «0. Iniciar sesión» tiene 6 logins: no la corras completa de golpe (responde 429). El recorrido de la demo usa 2.

## Correr el recorrido sin Postman

```bash
pnpm --filter backend postman:recorrido -- --url http://localhost:3000/api/v1
```

Lee la colección y hace las peticiones con `fetch` (sin newman). Úsalo solo con la API local sobre la **base temporal de pruebas** con la semilla cargada, nunca la de desarrollo: crea una solicitud de espacio en cada corrida. Se niega a correr si la URL no es localhost. No forma parte de `pnpm test` ni del CI.
