---
description: Revisa un cambio contra los requerimientos y las reglas del arnés
argument-hint: <rama, PR o archivos>
---

# Prompt: revisión de código

Revisa **<rama / PR / archivos>** contra `arnes-ia/core/checklists/revision-de-codigo.md` y los IDs **<RF/RN-xx>** que dice cubrir.

## Cómo reportar
Para cada hallazgo:

| Severidad | Archivo:línea | Qué está mal | Escenario concreto que falla | Cómo arreglarlo |
|---|---|---|---|---|

Severidades: **Alta** (dato incorrecto, fuga de datos, permisos, dinero) · **Media** (regla de negocio incompleta, falta prueba) · **Baja** (estilo, nombres).

## Revisa sobre todo
- ¿Cada requerimiento citado se cumple de verdad? ¿Hay prueba que falle si se rompe?
- Autorización y **alcance** por organización en el servidor.
- Dinero, zonas horarias, límites de rangos (≥ vs >).
- Datos privados en respuestas y logs.
- Capas: ¿algún controller usa el ORM? ¿algún import cruzado entre módulos?

## Reglas
No corrijas nada en esta pasada: solo reporta. Si no estás seguro de un hallazgo, márcalo como «por confirmar» y di qué habría que ejecutar para confirmarlo.
