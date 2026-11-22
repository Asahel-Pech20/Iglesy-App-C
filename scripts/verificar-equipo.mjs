#!/usr/bin/env node
// Revisa si esta computadora puede correr AppIglesia y recomienda la opción viable.
// Uso (no necesita nada instalado salvo Node):  node scripts/verificar-equipo.mjs
// Guía completa: docs/requisitos.md
import { execSync } from 'node:child_process';
import { statfsSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';

const GB = 1024 ** 3;
// Angular 21 pide Node ^22.12 o >=24 (la 23 no la soporta); el backend, 22 o superior
const NODE_REQUERIDO = '22.12 o superior (o 24 o superior)';
function nodeCompatible(version) {
  const [mayor, menor] = version.split('.').map(Number);
  return (mayor === 22 && menor >= 12) || mayor >= 24;
}
const PNPM_ESPERADO = '12.16.1';
const PUERTOS = {
  5432: 'PostgreSQL',
  5433: 'PostgreSQL de pruebas',
  1025: 'Mailpit SMTP',
  8025: 'Mailpit web',
  3000: 'backend',
  5173: 'frontend',
};

const ok = (t) => console.log(`  ✅ ${t}`);
const aviso = (t) => console.log(`  ⚠️  ${t}`);
const falla = (t) => console.log(`  ❌ ${t}`);
const titulo = (t) => console.log(`\n${t}`);

function comando(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function puertoLibre(puerto) {
  return new Promise((resolve) => {
    const s = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => s.close(() => resolve(true)))
      .listen(puerto, '127.0.0.1');
  });
}

const ramTotal = os.totalmem() / GB;
const ramLibre = os.freemem() / GB;
let discoLibre = null;
try {
  const st = statfsSync(process.platform === 'win32' ? process.cwd().slice(0, 3) : '/');
  discoLibre = (st.bavail * st.bsize) / GB;
} catch {
  // Node antiguo sin statfs
}
const plataforma =
  { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[process.platform] ?? process.platform;

titulo('🖥️  Equipo');
console.log(`  Sistema: ${plataforma} ${os.release()} (${os.arch()})`);
console.log(`  CPU: ${os.cpus()[0]?.model ?? '?'} · ${os.cpus().length} hilos`);
console.log(`  RAM: ${ramTotal.toFixed(1)} GB total, ${ramLibre.toFixed(1)} GB libres ahora`);
if (discoLibre !== null) console.log(`  Disco libre: ${discoLibre.toFixed(1)} GB`);

const problemas = [];

titulo('🧰 Herramientas');
if (nodeCompatible(process.versions.node)) ok(`Node ${process.versions.node}`);
else {
  falla(
    `Node ${process.versions.node}: se necesita Node ${NODE_REQUERIDO}. Instala la versión LTS de https://nodejs.org`,
  );
  problemas.push('node');
}

const git = comando('git --version');
if (git) ok(git);
else {
  falla('Git no está instalado (https://git-scm.com)');
  problemas.push('git');
}

const pnpm = comando('pnpm --version');
const pnpmCorepack = pnpm ? null : comando('corepack pnpm --version');
if (pnpm)
  ok(
    `pnpm ${pnpm}${pnpm === PNPM_ESPERADO ? '' : ` (el proyecto fija ${PNPM_ESPERADO}; corepack la usará sola)`}`,
  );
else if (pnpmCorepack)
  aviso(`pnpm solo vía corepack (${pnpmCorepack}). Instálalo global: npm install -g pnpm`);
else {
  falla('pnpm no está disponible. Instálalo: npm install -g pnpm');
  problemas.push('pnpm');
}

// En Windows la terminal puede no tener Docker en el PATH aunque esté instalado
const rutasDocker = ['docker'];
if (process.platform === 'win32') {
  rutasDocker.push('"C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"');
}
const binDocker = rutasDocker.find((r) => comando(`${r} --version`));
const docker = binDocker ? comando(`${binDocker} --version`) : null;
const dockerActivo = binDocker ? comando(`${binDocker} info --format "{{.ServerVersion}}"`) : null;
if (docker && dockerActivo) ok(`${docker} (motor activo)`);
else if (docker) aviso(`${docker} instalado pero el motor no está corriendo: abre Docker Desktop`);
else aviso('Docker no está instalado (solo hace falta para backend; ver recomendación abajo)');

if (process.platform === 'win32' && !docker) {
  const wsl = comando('wsl --status');
  if (wsl === null) aviso('WSL 2 no está instalado (Docker Desktop lo necesita en Windows)');
}

titulo('🔌 Puertos del proyecto');
for (const [puerto, uso] of Object.entries(PUERTOS)) {
  if (await puertoLibre(Number(puerto))) ok(`${puerto} libre (${uso})`);
  else
    aviso(
      `${puerto} ocupado (${uso}). Normal si ya tienes el proyecto corriendo; si no, otro programa lo usa`,
    );
}

// ───────── Recomendación ─────────
titulo('📋 Recomendación para este equipo');
const es64 = ['x64', 'arm64'].includes(os.arch());
const armWindows = process.platform === 'win32' && os.arch() === 'arm64';
const poco_disco = discoLibre !== null && discoLibre < 10;

if (problemas.length) {
  falla(`Primero instala/actualiza: ${problemas.join(', ')}. Sin eso no funciona ninguna opción.`);
}

let opcion;
if (!es64) {
  opcion = 'C';
  falla('Sistema de 32 bits: NO puede usar Docker ni las herramientas actuales del proyecto.');
} else if (ramTotal < 6 || armWindows || poco_disco) {
  opcion = 'B';
  const motivo =
    ramTotal < 6
      ? `solo ${ramTotal.toFixed(1)} GB de RAM`
      : armWindows
        ? 'Windows en ARM'
        : `solo ${discoLibre.toFixed(1)} GB libres en disco`;
  falla(
    `Docker Desktop NO es recomendable en esta laptop (${motivo}): iría muy lenta o no arrancaría.`,
  );
} else if (ramTotal < 10) {
  opcion = 'A-justo';
  aviso(
    `Docker funciona, pero con ${ramTotal.toFixed(1)} GB de RAM irá justo. Cierra otras apps o usa la opción B.`,
  );
} else {
  opcion = 'A';
  ok(`Docker Desktop es viable (${ramTotal.toFixed(1)} GB de RAM).`);
}

const opciones = {
  A: 'Opción A — Docker (lo estándar del equipo): docker compose up -d',
  B: 'Opción B — PostgreSQL instalado directo (sin Docker, ~300 MB, mucho más ligero)',
  C: 'Opción C — Trabajar en la nube con GitHub Codespaces (no usa los recursos de tu laptop)',
  F: 'Siempre posible — Solo frontend con mocks (MSW): no necesita base de datos ni Docker',
};
console.log('');
if (opcion === 'A' || opcion === 'A-justo') console.log(`  👉 ${opciones.A}`);
if (opcion !== 'A') console.log(`  👉 ${opciones.B}`);
console.log(`  👉 ${opciones.C}`);
if (es64) console.log(`  👉 ${opciones.F}`);
console.log('\n  Detalle de cada opción: docs/requisitos.md\n');

process.exitCode = problemas.length ? 1 : 0;
