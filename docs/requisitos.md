# Requisitos del equipo y opciones según tu computadora

> **Lectura obligatoria antes de tu primera tarea.** No todas las laptops pueden correr lo mismo: esta guía te dice qué necesitas para **tu** parte y qué hacer si tu equipo no alcanza.

## Paso 1 — Revisa tu computadora (1 minuto)

Instala solo **Node.js 22.12 o superior, o 24 o superior** (<https://nodejs.org>, versión LTS; Angular 21 no funciona con Node 23 ni con un Node 22 anterior al 22.12) y **Git** (<https://git-scm.com>), clona el repo y ejecuta en la carpeta del proyecto:

```bash
node scripts/verificar-equipo.mjs
```

El script revisa sistema operativo, RAM, disco, Node, pnpm, Git, Docker y los puertos del proyecto, y al final te dice **qué opción usar**. Si dice ❌, esa herramienta **no funcionará en tu laptop**: usa la alternativa que te indica.

## Paso 2 — ¿Qué necesitas según tu parte?

| Tu trabajo | Necesitas | ¿Docker? |
|---|---|---|
| **Frontend** (F2, F3, F4) | Node 22.12+ o 24+, pnpm, Git, un editor o IDE con IA | **No.** El frontend funciona con datos simulados (MSW) sin backend ni base de datos |
| **Backend** (B2, B3, B4) | Lo anterior + **PostgreSQL 16** (opción A, B o C) | Opcional: hay alternativas |
| **Probar todo junto / demo** | Todo lo anterior corriendo a la vez | Recomendado (opción A) |

- **Mailpit** (correos) solo lo usa B1 (recuperar contraseña e invitaciones). B2–B4 **no** lo necesitan: en las pruebas los correos se guardan en memoria.
- Exportar PDF/Excel (B4) usa librerías de JavaScript puro: no requiere instalar nada extra.
- pnpm: `npm install -g pnpm` (si falla por permisos en Windows, abre la terminal como administrador solo para ese comando).

## Paso 3 — Elige tu opción para la base de datos

### Recursos aproximados

| Programa | RAM mientras corre | Disco |
|---|---|---|
| Docker Desktop + contenedores del proyecto | ~2 GB | ~4–5 GB |
| PostgreSQL instalado directo | ~100–300 MB | ~300 MB |
| Node + backend + frontend (`pnpm dev`) | ~0.5–1 GB | ~1 GB (`node_modules`) |
| Navegador | 0.5–2 GB | — |
| IDE con IA (Antigravity, Cursor, VS Code) | ~1–2 GB | ~1 GB |
| Claude Code en terminal | ~0.3 GB | — |

**Regla rápida:** suma lo que vas a tener abierto. Si pasa del ~70 % de tu RAM, la laptop se pondrá lenta.

### Opción A — Docker (lo estándar del equipo)

**Úsala si:** 64 bits, **8 GB de RAM o más** (con 8 GB irá justo; 16 GB es cómodo), **10 GB libres** en disco y virtualización activa.

**No la uses si:** tienes menos de 6 GB de RAM, Windows de 32 bits, Windows en procesador ARM, Windows 10 anterior a 22H2, o la virtualización está bloqueada (equipos escolares o de oficina). En esos casos Docker no arranca o deja la laptop inutilizable → usa **B** o **C**.

1. Windows: en PowerShell **como administrador** `wsl --install` y reinicia.
2. Instala Docker Desktop (<https://www.docker.com/products/docker-desktop>; en Windows también `winget install -e --id Docker.DockerDesktop`).
3. En Docker Desktop → *Settings → General* desmarca **"Start Docker Desktop when you sign in"** para que no consuma recursos cuando no programas.
4. En el proyecto: `docker compose up -d`. Al terminar: clic derecho en la ballena → *Quit Docker Desktop*.

### Opción B — PostgreSQL instalado directo (sin Docker, la más ligera)

**Úsala si:** tu laptop tiene 4–8 GB de RAM, poco disco, o Docker no funciona en ella.

1. Instala **PostgreSQL 16**:
   - Windows: instalador de <https://www.postgresql.org/download/windows/> (anota la contraseña del usuario `postgres`). Después, en *Servicios* (`services.msc`) cambia "postgresql-x64-16" a **Manual** para que no corra en segundo plano; lo inicias cuando programes.
   - macOS: `brew install postgresql@16` y `brew services start postgresql@16`.
   - Linux (Ubuntu): `sudo apt install postgresql`.
2. Crea el usuario y las dos bases (en Windows usa la terminal "SQL Shell (psql)" o `psql -U postgres`; en Linux antepón `sudo -u postgres`):
   ```bash
   psql -U postgres -c "CREATE USER iglesia WITH PASSWORD 'iglesia' CREATEDB;"
   ```
   ```bash
   psql -U postgres -c "CREATE DATABASE iglesia OWNER iglesia;"
   ```
   ```bash
   psql -U postgres -c "CREATE DATABASE iglesia_test OWNER iglesia;"
   ```
3. En `backend/.env` cambia la línea de pruebas al puerto 5432 (el nombre debe terminar en `_test`, si no las pruebas se niegan a correr para proteger tus datos):
   ```
   DATABASE_URL_TEST=postgresql://iglesia:iglesia@localhost:5432/iglesia_test
   ```
4. Sigue igual que todos: `pnpm --filter backend db:deploy`, `db:seed`, `test`.

### Opción C — En la nube con GitHub Codespaces (no usa tu laptop)

**Úsala si:** tu laptop es muy limitada (menos de 4 GB de RAM, 32 bits, disco casi lleno) o no puedes instalar programas.

1. En GitHub, en el repositorio: *Code → Codespaces → Create codespace* en tu rama. El repo trae `.devcontainer/` con Node 22, pnpm y Docker ya configurados.
2. En la terminal del Codespace: `docker compose up -d`, luego `cp backend/.env.example backend/.env` y los comandos de siempre.
3. Funciona bien para **backend y sus pruebas**, y para el **frontend con mocks**. Conectar el frontend al backend real dentro del Codespace requiere ajustar URLs; para la integración completa usen la laptop de un compañero con la opción A.
4. Las cuentas gratuitas de GitHub tienen horas gratis al mes (revisa la cuota vigente en tu cuenta; el GitHub Student Developer Pack da más). **Detén el Codespace al terminar** para no gastarlas.

### Siempre posible — Solo frontend con mocks

Si tu parte es frontend, no necesitas base de datos: `pnpm install` y `pnpm --filter frontend dev`. El frontend usa datos simulados (`frontend/src/mocks/`) y puedes entrar con `admin@iglesia.local` / `Iglesia123` (o `pastor@…`, `tesorero@…`, etc.).

## Paso 4 — Instrucciones para tu IA (Claude Code, Antigravity u otra)

Todos usamos IA para este proyecto. Claude Code lee `CLAUDE.md` y `AGENTS.md` automáticamente; otras herramientas (Antigravity, Cursor, etc.) puede que no. **En tu primera sesión, pega este mensaje a tu IA:**

```text
Antes de programar, lee AGENTS.md, CLAUDE.md y docs/requisitos.md de este repositorio.
Luego ejecuta `node scripts/verificar-equipo.mjs` y dime, sin rodeos:
1) qué herramientas de este proyecto NO podré usar en mi laptop y por qué (según sus especificaciones),
2) cuál de las opciones A, B o C de docs/requisitos.md me conviene para mi parte (soy dueño de <B2/F2, B3/F3 o B4/F4>),
3) qué debo instalar, en orden, con los comandos exactos para mi sistema operativo.
No instales nada ni cambies configuración del sistema sin mi permiso: solo recomiéndame.
```

### Reglas para la IA (cualquier herramienta)

- Revisar las especificaciones del equipo con `node scripts/verificar-equipo.mjs` **antes** de recomendar o instalar programas.
- Si un programa no es viable en esa laptop, **decirlo directamente** ("Docker no es viable en tu laptop porque tiene 4 GB de RAM") y ofrecer la alternativa de esta guía; no insistir con la opción estándar.
- No instalar programas, activar funciones de Windows (WSL, virtualización) ni cambiar la BIOS por su cuenta: explicar y que la persona lo haga.
- No crear ni leer el archivo `backend/.env` con contraseñas reales; para el desarrollo basta copiar `.env.example`.
- Seguir `AGENTS.md` (contrato, permisos, pruebas, Git) igual que cualquier integrante.

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `pnpm` "no se reconoce como comando" | pnpm no instalado | `npm install -g pnpm` o usa `corepack pnpm …` |
| `docker compose up` falla con "port is already allocated" en 5432 | Ya tienes un PostgreSQL instalado corriendo | Detén ese servicio, o usa la opción B con ese PostgreSQL |
| Docker Desktop: "Virtualization support not detected" | Virtualización desactivada en la BIOS | Activa Intel VT-x / AMD-V en la BIOS, o usa la opción B |
| Docker Desktop muy lento / la laptop se congela | Poca RAM | Opción B |
| Pruebas: "solo pueden usar una BD cuyo nombre termine en _test" | `DATABASE_URL_TEST` apunta a la BD de desarrollo | Corrige `DATABASE_URL_TEST` en `backend/.env` |
| Pruebas del backend: error de conexión | PostgreSQL apagado | Abre Docker (`docker compose up -d`) o inicia el servicio de PostgreSQL |
