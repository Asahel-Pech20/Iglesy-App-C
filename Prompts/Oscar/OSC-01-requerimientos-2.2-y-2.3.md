# OSC-01 · Requerimientos de las secciones 2.2 y 2.3

- **Integrante:** Oscar (también redacta la sección de Genaro)
- **Cubre:** RF-30–59, RN-20–39, CA-10–19, P-10–19 (Genaro) · RF-60–89, RN-40–59, CA-20–29, P-20–29 (Oscar)
- **Estado:** usado (2026-11-06); resultado en `docs/requerimientos.md`
- **Antes de usar de nuevo:** las secciones ya están escritas; úsalo solo como base para otra sección.

```text
Soy Oscar Michel Matos May, líder del proyecto. Voy a completar en docs/requerimientos.md mi sección y la de Genaro Aurelio Antonio Pacheco. Trabajamos en equipo con un arnés compartido.

ANTES DE EMPEZAR
1. Confirma que estás en la rama docs/ecclesia-expansion-specs. Si no, detente y avísame. Hay cambios sin commit que son míos: consérvalos.
2. Lee CLAUDE.md, AGENTS.md, specs.md §12, docs/ecclesia/adr/0006-complemento-de-appiglesia.md, docs/bitacora-ia.md y todo docs/requerimientos.md. Usa la sección 2.1 de Nataly como referencia de formato y nivel de detalle.
3. Extrae el texto completo de docs/ecclesia/Proyecto_Ecclesia_Sistema_Nacional_de_Gestion_de_Iglesias.docx. Es la fuente de todas las citas. Si necesitas un script, déjalo fuera del repositorio.

ALCANCE
Genaro, apartados «Los servicios y las pláticas» y «Las misas y los padres»:
- RF-30–59, RN-20–39, CA-10–19, P-10–19

Oscar, apartados «El diezmo», «Las criptas y otros espacios», «Quién usará el sistema» y «Si alcanza el tiempo»:
- RF-60–89, RN-40–59, CA-20–29, P-20–29
- P-20 y P-21 ya existen: continúa desde P-22 y no repitas P-30, P-31 ni P-32
- Revisa la tabla de actores (sección 1) y agrega lo que falte
- Revisa RF-08 y RF-14 de Nataly, que tocan los roles de mi apartado. No los modifiques: repórtame lo que encuentres
- Redacta la sección 7, los estados y transiciones de la solicitud de espacio, indicando quién provoca cada cambio. Los que el caso no deje claros van como pregunta

REGLAS DEL DOCUMENTO
- Sigue «Cómo se llena este documento». Cada requerimiento lleva ID, redacción verificable, prioridad y origen.
- El origen es una cita textual del caso entre «» con su apartado. Sin origen, se descarta.
- Usa «» solo para citas reales. Tus ejemplos van con comillas normales.
- Lo ambiguo no se inventa: va como pregunta en la sección 8.
- Lo de «Si alcanza el tiempo» va como Deseable.
- specs.md y los ADR no son origen de un requerimiento. Si encuentras una contradicción con ellos, repórtamela.
- Los módulos heredados de AppIglesia no entran aquí: solo lo que sale del caso.
- Agrega los términos de estos apartados al glosario y marca las casillas de «Párrafos a cubrir» con sus IDs.
- Los criterios de aceptación siguen el formato Dado/Cuando/Entonces de la sección 5 y cubren los flujos principales: misas sin choques de padre, sustitución de oficiante, captura y corrección de diezmo, reportes, y solicitud, cotización y vencimiento.

LÍMITES
- No toques la sección 2.1, RN-01–19, CA-01–09, P-01–09, los RNF ni la matriz de trazabilidad.
- Solo edita docs/requerimientos.md y docs/bitacora-ia.md.
- No escribas código ni cambies schema.prisma.
- No hagas commit, push ni PR.

FORMA DE TRABAJO
Paso 1. Muéstrame un plan: para cada apartado, los requerimientos, reglas y preguntas que propones, en una lista corta. No edites nada hasta que lo apruebe.
Paso 2. Con mi aprobación, escribe la sección de Genaro y detente para que la revise.
Paso 3. Con mi aprobación, escribe la mía y detente para que la revise.
Paso 4. Al terminar, haz lo siguiente:
- Comprueba con un script que cada cita «…» de estas secciones esté palabra por palabra en el caso, y corrige las que fallen.
- Comprueba que cada párrafo de estos apartados quede cubierto por al menos un requerimiento.
- Agrega a docs/bitacora-ia.md las entradas de este trabajo a mi nombre (Oscar), aclarando cuáles corresponden a la sección de Genaro. Registra con honestidad los errores de la IA que se hayan detectado.
- Dame la lista de archivos cambiados, los IDs creados, las preguntas abiertas y lo que no pudiste verificar.
```
