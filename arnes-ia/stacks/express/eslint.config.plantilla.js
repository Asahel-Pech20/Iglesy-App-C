// ESLint del arnés para proyectos Express + TypeScript (flat config).
// Copiar a la raíz del proyecto como eslint.config.js (aquí lleva otro nombre para que ESLint no lo tome como config de esta carpeta).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules', '**/dist', '**/coverage', '**/generated', 'uploads'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      // Reglas del arnés (AGENTS.base.md «Nunca»)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error', // sin @ts-ignore
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: 'error',
    },
  },
  {
    // Los controllers y routes no importan el ORM (también lo revisa dependency-cruiser)
    files: ['**/*.controller.ts', '**/*.routes.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/**', '@prisma/*', '**/lib/prisma'],
              message: 'El acceso a datos va en el service.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.property.name='only']", message: 'Sin .only' },
        { selector: "CallExpression[callee.property.name='skip']", message: 'Sin .skip' },
      ],
    },
  },
  prettier,
);
