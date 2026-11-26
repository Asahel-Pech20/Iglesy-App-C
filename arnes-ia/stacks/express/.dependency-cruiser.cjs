// Reglas de arquitectura del arnés (stack Express). Se ejecuta desde la raíz del repositorio:
//   npx depcruise src --config arnes-ia/stacks/express/.dependency-cruiser.cjs
// Capas: routes → middlewares → controller → service → acceso a datos; dominio/ es puro.
const { existsSync, readFileSync } = require('node:fs');

// Qué cuenta como acceso a datos para «controller-sin-orm». Por defecto, Prisma; un proyecto con otro
// ORM o con un almacén propio lo declara en arnes.config.json → dependencias.accesoDatos (expresiones regulares).
const ACCESO_DATOS_PRISMA = ['(^|/)generated/', '@prisma', '(^|/)lib/prisma'];

function accesoDatos() {
  if (!existsSync('arnes.config.json')) return ACCESO_DATOS_PRISMA;
  const propios = JSON.parse(readFileSync('arnes.config.json', 'utf8'))?.dependencias?.accesoDatos;
  return Array.isArray(propios) && propios.length > 0 ? propios : ACCESO_DATOS_PRISMA;
}

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'sin-ciclos',
      severity: 'error',
      comment: 'Un ciclo entre archivos indica capas mezcladas.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'controller-sin-orm',
      severity: 'error',
      comment: 'Controllers y routes no acceden a los datos: eso lo hace el service.',
      from: { path: '\\.(controller|routes)\\.ts$' },
      to: { path: accesoDatos() },
    },
    {
      name: 'dominio-puro',
      severity: 'error',
      comment: 'dominio/ solo contiene funciones puras: no importa Express, el ORM ni otras capas.',
      from: { path: '/dominio/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: ['/dominio/'] },
    },
    {
      name: 'modulos-solo-por-service',
      severity: 'error',
      comment: 'Un módulo usa otro solo a través de su service (o sus tipos/esquemas públicos).',
      from: { path: '(^|/)modules/([^/]+)/', pathNot: '\\.test\\.ts$' },
      to: {
        path: '(^|/)modules/([^/]+)/',
        pathNot: [
          '(^|/)modules/$2/',
          '\\.service\\.ts$',
          '\\.schemas\\.ts$',
          '\\.tipos\\.ts$',
          '(^|/)modules/_plantilla/',
        ],
      },
    },
    {
      name: 'produccion-sin-pruebas',
      severity: 'error',
      comment: 'El código de producción no importa archivos de prueba.',
      from: { pathNot: ['\\.test\\.ts$', '(^|/)test/'] },
      to: { path: ['\\.test\\.ts$', '(^|/)test/'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['(^|/)generated/'] },
    tsPreCompilationDeps: true,
    // Si el proyecto usa alias de rutas: tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
