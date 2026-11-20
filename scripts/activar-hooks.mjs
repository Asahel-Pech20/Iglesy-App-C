// Activa los hooks de git del arnés al instalar dependencias (`pnpm install` corre `prepare`).
// Así todo el equipo tiene el pre-commit y el commit-msg sin configurarlo a mano (RNF-19).
// Nunca hace fallar la instalación: si no hay git o es el CI, solo avisa.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CARPETA_HOOKS = 'arnes-ia/stacks/express/hooks';

/** Decide qué hacer; pura para poder probarla. */
export function decidir({ esCi, hayRepositorio, hayHooks, actual }) {
  if (esCi) return { accion: 'omitir', motivo: 'en el CI no se usan hooks' };
  if (!hayRepositorio) return { accion: 'omitir', motivo: 'no es un repositorio de git' };
  if (!hayHooks) return { accion: 'omitir', motivo: `no existe ${CARPETA_HOOKS}` };
  if (actual === CARPETA_HOOKS) return { accion: 'nada', motivo: 'ya estaban activos' };
  return {
    accion: 'activar',
    motivo: actual ? `reemplaza core.hooksPath=${actual}` : 'primera vez',
  };
}

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return { ok: r.status === 0, salida: (r.stdout ?? '').trim() };
}

function main() {
  const repo = git(['rev-parse', '--is-inside-work-tree']);
  const decision = decidir({
    esCi: Boolean(process.env.CI),
    hayRepositorio: repo.ok && repo.salida === 'true',
    hayHooks: existsSync(CARPETA_HOOKS),
    actual: git(['config', '--get', 'core.hooksPath']).salida,
  });
  if (decision.accion === 'activar') {
    const r = git(['config', 'core.hooksPath', CARPETA_HOOKS]);
    console.log(
      r.ok
        ? `Hooks del arnés activos (${decision.motivo}): formato, lint, arquitectura, pruebas y mensaje de commit.`
        : 'No se pudieron activar los hooks; actívalos con: git config core.hooksPath ' +
            CARPETA_HOOKS,
    );
  } else if (decision.accion === 'omitir') {
    console.log(`Hooks del arnés: se omiten (${decision.motivo}).`);
  }
}

// Solo se ejecuta al correr el script, no al importarlo en las pruebas
if (process.argv[1]?.endsWith('activar-hooks.mjs')) main();
