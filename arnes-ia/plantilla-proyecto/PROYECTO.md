# PROYECTO.md — Lo propio de este proyecto

> El arnés (`core/`) es genérico. Este archivo le dice a la IA de qué trata **este** proyecto. Se copia a `docs/PROYECTO.md` y se llena.

## Dominio en 5 líneas
<Qué hace el sistema, para quién y cuál es su regla más delicada.>

## Fuentes de verdad
- Requerimientos: `docs/requerimientos.md` (IDs `RF`, `RNF`, `RN`, `CA`, `P`).
- Arquitectura: `ARCHITECTURE.md` · Decisiones: `docs/adr/`.
- Contrato de API: `<openapi.yaml>`.

## Equipo y dueños
| Integrante | Módulos | IDs |
|---|---|---|
| <nombre> | <módulos> | <RF-xx–yy> |

## Términos que la IA suele confundir
| Término | Significa | No confundir con |
|---|---|---|
| <término> | <definición> | <otro> |

## Comandos
```bash
<instalar>
<levantar BD>
<migrar + seed>
<dev>
<test>  <lint>  <depcruise>
```

## Herramienta de IA
<Una sola herramienta, declarada aquí y en el README.> Trailer de commit: `Asistido-por: <herramienta>`.
