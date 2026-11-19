# Stack PHP (equivalencias)

`core/` se usa igual. Herramientas equivalentes:

| Express (arnés) | PHP (Laravel / Slim) |
|---|---|
| ESLint | PHPStan nivel ≥ 6 |
| Prettier | PHP-CS-Fixer (PSR-12) |
| dependency-cruiser | Deptrac (capas Controller → Service → Repository; `Dominio` sin dependencias) |
| Vitest | PHPUnit / Pest |
| Zod | Form Requests (Laravel) o `respect/validation` |
| hooks de git | mismos scripts `pre-commit` y `commit-msg`, llamando a `vendor/bin/*` |

El índice patrimonial (`dominio/`) se traduce a una clase pura con la misma tabla de pruebas.
