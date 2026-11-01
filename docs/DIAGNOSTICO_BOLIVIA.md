# PACHA Simulador · Adaptación al mercado de helados de Bolivia

Implementación del documento «Prompt corregido: simulador de helados de Bolivia (versión revisada el 31 de octubre de 2026)». Este documento resume el diagnóstico de la arquitectura, los cambios realizados y la tabla que separa los datos oficiales de Bolivia de las hipótesis de equilibrio del juego (entregable 11).

---

## 1. Diagnóstico de la arquitectura existente

| Capa del documento (Flask) | Equivalente real del proyecto | Estado |
| --- | --- | --- |
| `presentacion` | `src/components/game/*` (React 19, App Router) | Roles decano/profesor/alumno ya existían |
| `aplicacion` | `src/app/api/*` (route handlers Next.js) | Sesiones por cookie firmada + `x-pacha-session` |
| `core` | `src/lib/pacha/motor.ts`, `simulacion.ts`, `catalogo.ts` | Motor anual determinista, 5 cargos, borradores, penalizaciones |
| `infraestructura` | Prisma 6 + SQLite (`db/custom.db`), resolución de ruta en runtime | Migraciones con `prisma db push` |

Diferencias respecto al enunciado (documentadas, no bloqueantes):

- La aplicación **no es Flask**: es Next.js 16 + React 19 + Bun + Prisma/SQLite. El enunciado describe un despliegue anterior; el mapeo de roles (decano → DECANO, profesor → PROFESOR, alumno → ALUMNO) y de capas es 1 a 1, por lo que la adaptación se hizo sobre esta arquitectura sin duplicar tablas ni lógica.
- Unidades del motor: **miles de litros** y **miles de Bs** (el documento razona en litros y Bs; 15.911.466 L → 15.911,466 kL).
- El calendario usa el **año de simulación** para resolver fechas móviles (Pascua del año 1, 2, …): simplificación declarada.

## 2. Lista de archivos modificados / creados

**Nuevos**

- `src/lib/pacha/config-bolivia.ts` — todos los parámetros centralizados con `tipo`, `fuente`, `anio`, `fechaConsulta`; validaciones de sumas; `crearConfigIndustria()` congela la config por simulación.
- `src/lib/pacha/eventos.ts` — catálogo de eventos de Bolivia (§10), Pascua móvil, resolución calendario + extraordinarios con semilla, agrupación 100/50/25 con topes (§15), señales de inflación por traspaso (§18.6).
- `src/lib/pacha/inflacion.ts` — πₜ con piso/techo, escenarios, factores limitados a ±5 pp, π_c (§18.7), poder adquisitivo real (§18.8), neutralidad, índice de precios.
- `src/components/game/entorno-periodo.tsx` — vista previa del periodo para el docente (escenario, πₜ, factores, eventos activables).
- `src/components/game/panel-administrativo.tsx` — panel del decano (§16): catálogo CRUD + peso del Resto del mercado + validación.
- `tests/motor-bolivia.test.ts` — 32 pruebas (§17 y las 4 obligatorias de §18.12).
- `docs/DIAGNOSTICO_BOLIVIA.md` — este documento.

**Modificados**

- `prisma/schema.prisma` — `Industria.configJson/semillaEventos`; `Equipo.coberturaJson/capacidadInstalada/capacidadMaxima/deuda/efectivo`; modelos nuevos `EventoCatalogo`, `EventoPeriodo`, `MacroPeriodo` (migración aplicada con `prisma db push`); `Reporte.detalleJson`.
- `src/lib/pacha/motor.ts` — **motor mensual de 12 pasos** (§13): demanda regional por segmento con estacionalidad por zona (§12), Resto del mercado (§1.2), producción/inventarios/merma/quiebres (§5), costos π_c por componente (§18.7), impuestos IVA/IT/IUE e intereses (§9), trazabilidad de eventos (§15).
- `src/lib/pacha/simulacion.ts` — preparación del periodo (eventos + πₜ congelados al ejecutar, §18.10), ejecución con `simularAnioBolivia`, historial de Bolivia, inversión en capacidad (§5), compatibilidad con simulaciones ya creadas.
- `src/lib/pacha/tipos.ts` — `inversionCapacidad` en borrador de producción y decisión.
- `src/lib/pacha/seed.ts` — demo: 5 empresas bolivianas (Delizia, PIL Andina, Frigo, Panda, Cabrera), 10 marcas (agua+crema), catálogo de eventos sembrado.
- API: `api/profesor/preparar` (nueva), `api/profesor/eventos` (nueva), `api/decano/eventos` (nueva), `api/decano/parametros` (nueva), `api/alumno/reportes` (ampliada).
- UI: `profesor-panel.tsx` (entorno del periodo), `reportes.tsx` (mercado total, mensual, departamentos, finanzas, acontecimientos, inflación), `decano-panel.tsx`, `decisiones.tsx` (inversión en capacidad), `manual.tsx` (capítulo Bolivia).

## 3. Modelos de base de datos y migraciones

Sin tablas duplicadas (regla §17): el catálogo de eventos es global, los eventos de cada periodo y las variables macro se guardan por industria y año. `prisma db push` aplicó los cambios de forma aditiva (columnas nuevas con default, tablas nuevas). Las simulaciones existentes reciben su `configJson` la primera vez que se procesan.

## 4. Integración con el motor (flujo del periodo)

1. El docente abre el panel → `prepararPeriodo()`: resuelve eventos (calendario + extraordinarios con semilla registrada) y calcula πₜ = clamp(πₜ₋₁ + Δ_esc + Σ sₖ·aₖ, 0%, 30%) con los factores del traspaso del 20%.
2. Puede fijar el escenario (Favorable/Estable/Desfavorable) o ajustar/desactivar eventos (topes §11).
3. Al ejecutar: eventos y macro se **congelan** (`MacroPeriodo.ejecutado`), el motor corre **12 pasos mensuales** (estacionalidad normalizada × zona, eventos por región/mes, Resto del mercado con marketing/distribución/calidad relativa, capacidad, merma 2%, cadena de frío 2%), los costos evolucionan con π_c (parte importada sigue al TC) y se calculan IVA 13%, IT 3%, IUE 25%, intereses 12% y deuda (tope 60% de ventas).
4. Los alumnos ven el historial hasta el último periodo ejecutado; nunca la inflación del periodo en curso (§18.10).

## 5. Tabla: datos oficiales de Bolivia vs hipótesis de simulación

### 5.1 Datos oficiales / verificados

| Dato | Valor | Fuente | Fecha de consulta |
| --- | --- | --- | --- |
| Población total | 11.365.333 | INE, Censo 2024 (resultados agosto 2025) | 31-10-2026 |
| Población urbana / rural | 7.846.708 (69,0%) / 3.518.625 (31,0%) | INE, Censo 2024 | 31-10-2026 |
| Población por departamento | Santa Cruz 3.122.605 · La Paz 3.030.917 · Cochabamba 2.016.357 · Potosí 861.292 · Chuquisaca 606.027 · Oruro 571.471 · Tarija 534.210 · Beni 488.260 · Pando 134.194 (suma validada = 11.365.333) | INE, Censo 2024 | 31-10-2026 |
| Tipo de cambio Año 0 | Bs 11,8/US$ (23-10-2026: Bs 11,84; fin del tipo fijo de 6,96 el 29-06-2026) | BCB | 31-10-2026 |
| Inflación Año 0 | 5,70% interanual (mensual 0,85%; acumulada ene-sep 3,88%; 2025: 20,40%) | INE, septiembre 2026 | 31-10-2026 |
| Tasa de interés anual | 12% (rango empresarial 10-13%) | BCB (referencia) | 31-10-2026 |
| Impuestos IVA/IT/IUE | 13% / 3% / 25% | **Por confirmar en impuestos.gob.bo antes de fijar** (editables) | 31-10-2026 |
| Calendario festivo | 22 eventos con regiones y reglas de fecha | Calendario oficial; fechas móviles por Pascua | 31-10-2026 |
| Combustibles y energía | Sin valores fijos: cargar ANH y tarifas vigentes al implementar | ANH / distribuidoras | pendiente |

### 5.2 Referencias débiles

| Dato | Valor | Fuente |
| --- | --- | --- |
| Consumo per cápita | 1,4 L/hab/año (dimensiona el Año 0: 15.911.466 L) | Tesis universitaria con datos de 2017 — editable |

### 5.3 Hipótesis de equilibrio del juego (editables desde el panel)

| Grupo | Hipótesis |
| --- | --- |
| Mercado | Consumidores potenciales 65%; crecimiento base 4% anual en volumen; 5 empresas con 2 marcas (agua+crema), máximo 5; 10 periodos |
| Segmentos | Familias 30% · Jóvenes 25% · Niños 20% · Premium 15% · Saludables 10%; atributos 1-10; elasticidad ingreso 0,6-1,4 |
| Canales | Tradicional 45%/20% · Supermercados 35%/25% · HORECA y Eventos 20%/30%; unidades de cobertura simuladas 2.500/250/350 |
| Producción | Capacidad 1.000.000 L inicial, 3.000.000 máxima; utilización 70%; inventario inicial 10%, seguridad 5%; merma 2%; almacenamiento 2%; capacidad nueva Bs 5/L (70% importado) |
| Costos | 6 componentes con pesos 35/12/15/18/12/8 y proporción importada 10/5/30/40/0/0; β 0,5-1,2; escala de precios Bs/L del Año 0 |
| Marketing | Publicidad 4% · promoción 3% · investigación 5% · comisión 3% · descuento máx. 15% · presupuesto comercial máx. 20% · precio/costo 2,5-3,0 |
| Distribución | Logística 6% de ventas (factor por región 0,9-1,8); cadena de frío 2%; entregas a tiempo 90%; cobertura regional 1-10 |
| Finanzas | Endeudamiento máx. 60%; reserva de efectivo 5%; crédito 30 días |
| Eventos | 2-5 positivos y 1-3 negativos por año; topes demanda +25%/−20%, costos +30%/−10%; duración 1-3 meses; probabilidades adversas 20%/15%/20%; pesos simultáneos 100/50/25 |
| Inflación | Escenarios 25/50/25 con Δ −2..−0,5 / ±0,5 / +1..+4 pp; factores ±0,3..±1,5 pp (total ±5); piso 0% techo 30%; traspaso eventos 20% |
| Resto del mercado | 78% inicial (editable por el decano); responde a precio promedio, inflación y marketing/distribución/calidad relativas |
| Estacionalidad | Índices 6-10 (suma 98, promedio 8,17); k zona: altiplano 1,3 · valles 1,0 · llanos 0,6 |

## 6. Pruebas

`bun test tests/motor-bolivia.test.ts` — 32 pruebas, incluidas las 4 obligatorias del §18.12:

1. Piso y techo de πₜ ✓
2. Equivalencia tasa mensual ↔ anual ((1+m)¹² = 1+π) ✓
3. Cálculo de π_c (parte importada sigue al TC, no al IPC) ✓
4. Neutralidad: precios y costos suben πₜ → margen constante ✓
5. Además: población suma exacta, segmentos/canales/costos 100%, estacionalidad normalizada, Pascua móvil (Carnaval 2026 = 17 de febrero), agrupación 100/50/25 con topes, deduplicación de eventos, escala del mercado (15.911,466 kL) y captura ≈ 22%, trazabilidad determinista por semilla.
