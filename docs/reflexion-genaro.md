# Reflexión de Genaro — Trabajo con IA en Ecclesia

> **Borrador** para reescribir con mis palabras. Los datos salen de mis entradas de [`bitacora-ia.md`](bitacora-ia.md) (68 a 74 y 79 a 81). Mi parte: servicios, pláticas, misas y padres (E3, RF-30–52, más los deseables RF-83 y RF-84).

## Cómo trabajé

Usé solo Claude Code, con el flujo del arnés: le pedía un plan, yo lo aprobaba, avanzaba un paso pequeño, corríamos las verificaciones (pruebas, lint, typecheck, formato, dependency-cruiser) y después venía el commit con su entrada de bitácora. Cuando el cliente no había respondido una pregunta (P-10 a P-19), la IA usaba el supuesto escrito en mi plan y lo marcaba como tal. Registré 10 entradas; en 9 la IA se equivocó en algo.

## Qué hizo bien la IA

- **Partir la lógica difícil en una función pura.** Los choques de misas (E3-04) quedaron en `misas/dominio/solapes.ts`, con 28 pruebas y 100 % de líneas: misas seguidas que no chocan, choques que cruzan la medianoche y semanas de enero y julio por el horario de verano de la frontera. Después el horario, la agenda y la sustitución reutilizaron esa misma función.
- **Pensar en la concurrencia sin que yo se lo pidiera.** El horario bloquea la fila del padre con `FOR UPDATE`, y hay una prueba de dos altas simultáneas (E3-07) y otra de dos registros de la misma misa en paralelo (E3-09).
- **Respetar lo de los demás.** La migración de E3-05 no rompió el diezmo de Oscar (el seed siguió con sus 120 misas con diezmo), y la sustitución quedó de solo inserción, igual que el historial del diezmo.
- **Probar contra el sistema real, no solo con pruebas unitarias.** Hizo recorridos con la API de desarrollo, por ejemplo una sustitución que respondió 201 con su motivo y la ficha pública sin sesión. También revisó las pantallas a 1024 y 375 px y corrió la colección de Postman contra la API local: al final, sus 32 peticiones respondieron lo esperado (33 de 33 ejecuciones, con una repetida con el tesorero).
- **Dejar el trabajo documentado:** OpenAPI, modelo de datos, la matriz de RF-30 a RF-52 y la bitácora al día en cada paso.

## Sus errores y cómo los detecté

Casi ningún error lo vi leyendo el código. Los encontró una verificación automática o una prueba real:

| Entrada | Error de la IA | Qué lo detectó |
|---|---|---|
| 68 | Lanzó `corepack pnpm install` en segundo plano y se quedó esperando una confirmación de descarga, sin mostrar error | Tras varios minutos no había `node_modules`; se repitió sin la pregunta |
| 69 | Usó `prisma migrate dev --create-only`, que necesita una terminal interactiva | El mensaje de Prisma; se generó el SQL con `migrate diff` y se comprobó con `--exit-code` |
| 70 | Le dio `misas:leer` a la Coordinación, aunque la prueba de permisos de Santiago lo prohíbe (el diezmo es privado) | `permisos.test.ts` en la suite completa |
| 72 | Metió un `as const` que Prisma no acepta, y el error de tipos escondió un campo; además agregó una ruta pública sin declararla | `tsc` y `rutasProtegidas.test.ts` |
| 73 | Usó en una plantilla un valor que podía ser `undefined`; además había textos encimados y faltaba el marco de la ficha | `ng build` (tsc no revisa plantillas) y capturas en el navegador real |
| 74 | El seed se detenía si un padre no tenía hora libre, y usó `sinAlcance` donde no estaba permitido | El propio `db:seed` falló y `contextoIglesia.test.ts` |
| 79 | Las misas del diezmo armadas desde el horario creaban 0 sustituciones | Conté los datos en una base desechable recién sembrada |
| 80 | En la prueba de RF-84 tomaba el botón «Anterior» equivocado y leía un `span` vacío de Material | La suite completa del frontend y un diagnóstico temporal |
| 81 | La colección de Postman tenía un orden que rompía las peticiones siguientes y variables que se pisaban | Correrla contra la API local: 10 respuestas inesperadas en la primera vuelta |

Lo que veo en común: la IA casi siempre escribía código que compilaba y se veía razonable, pero se equivocaba en **lo que conecta con el resto**: los permisos de otro integrante, las reglas del arnés, cómo se comportan las herramientas en una terminal sin interacción, o datos reales que no se parecen a los del ejemplo. Varias veces la prueba de una sola parte pasaba y lo que fallaba era la suite completa.

## Qué aprendí

1. **Correr la suite completa, no solo la de mi módulo.** Los errores de las entradas 70, 72 y 80 solo aparecieron así.
2. **`tsc` no es suficiente en Angular.** `ng build` revisa las plantillas, y en la entrada 73 fue el que encontró el error.
3. **Medir con datos reales.** Un seed o una colección «correcta» puede producir 0 sustituciones o 10 errores. Hay que contar lo que de verdad quedó en la base o correrlo contra la API.
4. **Un plan aprobado no sustituye la revisión.** Yo aprobaba el plan, pero los errores estaban en detalles que el plan no decía. La bitácora me sirvió para ver patrones y no repetirlos.
5. **Separar hechos de supuestos.** Las preguntas P-10 a P-19 siguen sin respuesta del cliente; todo lo que depende de ellas está marcado como supuesto, y si el docente responde otra cosa, se ajusta.

## Lo que haría distinto

Pediría desde el principio que la IA corra la suite completa y `ng build` antes de decir que algo está listo, y que pruebe cualquier entregable (seed, colección, pantalla) contra el sistema real. Así los errores de las entradas 73, 79 y 81 se habrían visto antes. También llevaría las preguntas al docente al inicio y no al final, para no depender tanto de supuestos.
