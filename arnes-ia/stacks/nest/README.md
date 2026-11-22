# Stack NestJS (equivalencias)

`core/` se usa igual. Cambia solo lo del framework:

| Express (arnés) | NestJS |
|---|---|
| `*.routes.ts` + middlewares | `*.controller.ts` con decoradores, `@UseGuards(AuthGuard, PermisoGuard)` |
| `validar(esquemaZod)` | `ZodValidationPipe` (o `class-validator` con `whitelist` + `forbidNonWhitelisted`) |
| `*.service.ts` | `@Injectable()` service del módulo |
| módulos solo por su service | exportar el service en `exports` del `@Module`; dependency-cruiser con la misma regla `modulos-solo-por-service` |
| `errores.ts` | `ExceptionFilter` global con el formato `{ error: { code, message, details } }` |

ESLint, Prettier, dependency-cruiser, hooks y `dominio/` se copian sin cambios.
