// Verificaciones del arnés para los hooks de git (sin dependencias extra: solo Node).
//   node verificar.mjs pre-commit           → formato, lint, reglas de dependencias y pruebas unitarias
//   node verificar.mjs commit-msg <archivo> → el mensaje sigue Conventional Commits y trae «Asistido-por:»
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Ajustes por proyecto ──────────────────────────────────────────────────────────────
// Carpetas con el código de Ecclesia a las que se aplican las reglas de arquitectura.
const RUTAS_DEPENDENCIAS = ['arnes-ia/stacks/express/modulo-referencia'];
const CONFIG_DEPENDENCIAS = 'arnes-ia/stacks/express/.dependency-cruiser.cjs';
const CONFIG_PRUEBAS = '../arnes-ia/stacks/express/vitest.config.mjs'; // relativo a backend/
const EXTENSIONES_LINT = /\.(ts|tsx|js|mjs|cjs)$/;
// ──────────────────────────────────────────────────────────────────────────────────────

const bin = (nombre) => join('node_modules', '.bin', nombre);

function correr(titulo, comando, args, cwd = '.') {
  process.stdout.write(`▸ ${titulo}… `);
  const r = spawnSync(comando, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (r.status === 0) {
    console.log('ok');
    return true;
  }
  console.log('FALLÓ');
  console.log(`${r.stdout ?? ''}${r.stderr ?? ''}`.trim());
  return false;
}

function archivosEnStage() {
  const r = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  });
  return r.stdout.split('\n').filter(Boolean);
}

function preCommit() {
  const archivos = archivosEnStage();
  if (archivos.length === 0) return true;
  const citar = (lista) => lista.map((a) => `"${a}"`);
  const lint = archivos.filter((a) => EXTENSIONES_LINT.test(a));
  const resultados = [
    correr('Formato (Prettier)', bin('prettier'), [
      '--check',
      '--ignore-unknown',
      ...citar(archivos),
    ]),
    lint.length === 0 ||
      correr('Lint (ESLint)', bin('eslint'), ['--max-warnings=0', ...citar(lint)]),
    correr('Reglas de dependencias (dependency-cruiser)', bin('depcruise'), [
      ...RUTAS_DEPENDENCIAS,
      '--config',
      CONFIG_DEPENDENCIAS,
    ]),
    correr(
      'Pruebas unitarias (Vitest)',
      bin('vitest'),
      ['run', '--config', CONFIG_PRUEBAS],
      'backend',
    ),
  ];
  return resultados.every(Boolean);
}

function commitMsg(archivo) {
  const mensaje = readFileSync(archivo, 'utf8');
  const primera = mensaje.split('\n')[0];
  const errores = [];
  if (
    !/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w-]+\))?!?: .+/.test(
      primera,
    )
  )
    errores.push(
      'La primera línea debe seguir Conventional Commits: «tipo(alcance): descripción».',
    );
  if (!/^Asistido-por: .+/m.test(mensaje))
    errores.push('Falta el trailer «Asistido-por: <herramienta>» (o «Asistido-por: ninguno»).');
  for (const e of errores) console.log(`✗ ${e}`);
  return errores.length === 0;
}

const [modo, archivo] = process.argv.slice(2);
const ok = modo === 'commit-msg' ? commitMsg(archivo) : preCommit();
if (!ok) {
  console.log('\nCommit detenido por el arnés. Corrige lo anterior y vuelve a intentar.');
  process.exit(1);
}
