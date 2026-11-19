// Reglas de arquitectura del arnés (stack Express). Se ejecuta desde la carpeta del backend:
//   npx depcruise src --config ../arnes-ia/stacks/express/.dependency-cruiser.cjs
// Capas: routes → middlewares → controller → service → ORM; dominio/ es puro.
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
      comment: 'Controllers y routes no acceden a la BD: eso lo hace el service.',
      from: { path: '\\.(controller|routes)\\.ts$' },
      to: { path: ['(^|/)generated/', '@prisma', '(^|/)lib/prisma'] },
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
