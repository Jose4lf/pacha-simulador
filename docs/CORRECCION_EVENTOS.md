# Corrección: eventos por año dentro de cada simulación

Implementa la corrección solicitada sobre el módulo de eventos (doc §10, §11, §15):

> "los eventos tienen que ocurrir dentro de las simulaciones de los estudiantes y ocurren
> por años y puede ser configurado para que ocurra en un año determinado además de que
> puede tener de uno a tres eventos por año pero que no sean de la misma categoría"

## Qué cambió

| Antes | Ahora |
| --- | --- |
| El motor activaba el calendario festivo completo de Bolivia (~22 eventos) **todos los años**, igual para todas las simulaciones, más extraordinarios sorteados. | Cada **simulación (industria)** tiene su propio **plan de eventos por año**: solo ocurre lo planificado (o autocompletado) para ese año. |
| Sin control del docente sobre el año de cada evento. | El docente **fija un evento para un año determinado** (Año 1…Año N) desde su panel. |
| Sin límite de eventos por año. | **De 1 a 3 eventos por año** (validado en la API y en la UI). |
| Posibles eventos repetidos de la misma categoría el mismo año. | **Nunca dos eventos de la misma categoría en el mismo año** (FESTIVO, SOCIAL, ECONOMICO, LOGISTICO, CLIMATICO). |
| — | Los años sin planificación se **autocompletan** (1–3 eventos, categorías distintas) con semilla registrada, y quedan visibles/editables para el docente. |

## Implementación

- **Nuevo modelo `EventoPlan`** (Prisma): plan por `industriaId + anio + catalogoId`, con `origen`
  `DOCENTE | AUTO`. Los eventos resueltos del periodo siguen guardándose en `EventoPeriodo`
  (congelados al ejecutar, inmutables, doc §18.12).
- **`src/lib/pacha/eventos.ts`**: nuevo `resolverEventosDesdePlan()` (determinista por semilla,
  conserva la regla de meses de cada evento: Navidad → diciembre, móviles por Pascua, etc.) y
  `elegirEventosAuto()` para completar años vacíos con 1–3 eventos de categorías distintas.
- **`src/lib/pacha/config-bolivia.ts`**: `EVENTOS_IMPACTO.eventosPorAnio = { min: 1, max: 3 }`
  (reemplaza «2–5 positivos / 1–3 negativos por año» según la corrección). Configs antiguas
  congeladas siguen funcionando (fallback `{min:1,max:3}`).
- **`src/lib/pacha/simulacion.ts`**: `planDeEventos()`, `asignarEventoPlan()`, `quitarEventoPlan()`,
  `autocompletarPlan()`; `prepararPeriodo()` resuelve los eventos desde el plan del año.
  Los años ya ejecutados son inmutables.
- **API `/api/profesor/eventos`**: `GET` (plan + catálogo), `POST` (acciones `asignar` / `quitar` /
  `autocompletar` con todas las validaciones) y `PATCH` (ajuste fino de un evento ya resuelto del
  periodo, como antes).
- **UI**: nueva sección «Plan de eventos por año» en el panel del docente
  (`src/components/game/plan-eventos.tsx`), integrada bajo el entorno nacional del periodo; la
  vista previa del periodo marca cada evento como «planificado» o «automático».
- **Reportes del alumno**: cada reporte anual sigue mostrando la trazabilidad de los eventos que
  ocurrieron en ese año de su simulación (variable, región, mes, efecto y peso).
- **Seed**: la industria demo «Helados Markestrat Bolivia» arranca con un plan de ejemplo
  (1–3 eventos por año en los Años 1–8; los Años 9–10 quedan vacíos para mostrar la
  autocompletación).
- **Pruebas**: `tests/motor-bolivia.test.ts` §7 reescrito para el plan (determinismo, 1–3 por año,
  categorías distintas, respeto de lo ya planificado). `bun test` → 33 pruebas OK.

## Validación end-to-end (smoke test)

1. Plan sembrado demo visible año por año (regla 1–3, sin categorías repetidas). ✔
2. `asignar` evento al Año 9 → OK; duplicar categoría → error claro; 4º evento del Año 3 → error. ✔
3. `autocompletar` llenó el Año 10 con 3 eventos de categorías distintas. ✔
4. Vista previa del Año 1 = exactamente los 2 eventos planificados (`PLAN_DOCENTE`), Navidad en
   diciembre. ✔
5. Ronda del Año 1 ejecutada: 2 eventos aplicados al motor. ✔
6. Reporte del alumno (colibri) Año 1: trazabilidad de eventos (p. ej. Navidad, mes 12, demanda
   +12 %, peso 100 %). ✔
