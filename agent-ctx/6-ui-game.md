# Task 6 — Interfaz de usuario tipo VIDEOJUEGO · PACHA Simulador

## Resumen
Se crearon los 8 archivos de UI (rol frontend) del simulador PACHA, consumiendo exclusivamente
`@/lib/pacha/api-client` (api + tipos) y `@/lib/pacha/catalogo` (constantes puras + probabilidadExito/presupuestoNormal).
No se modificó ningún archivo existente (page.tsx, hud.tsx, login-screen.tsx, globals.css, backend y prisma intactos).

## Archivos creados
1. `src/components/game/alumno-app.tsx` — shell del alumno: carga con SplashCarga, panel de error elegante (p. ej. "sin equipo"), HUD con stats (Contribución, Cuota, Puesto con medallas, I+D), 5 tabs con badge de I+D, banner FINALIZADA, contenido animado con framer-motion y footer sticky.
2. `src/components/game/alumno/decisiones.tsx` — hoja de decisiones: borrador local (patrón reset-en-render por clave año:estado), tarjetas por marca con sliders+input sincronizados (precio 1-60·0.5, publicidad 0-2000·25, producción 0-5000·25, vendedores 3 canales con cobertura % y costo de fuerza de ventas), sección NUEVA MARCA (I+D) con select de proyectos APROBADO, grid de 15 estudios con Checkbox (comprados bloqueados), barra sticky con inversión estimada + Guardar borrador + Enviar (AlertDialog; guarda borrador antes de enviar porque el backend lo exige).
3. `src/components/game/alumno/estudios.tsx` — visor de los 15 estudios: fetch al montar, agrupado por año en Accordion (abierto el último), renderer por tipo (awareness, panel-consumidores, panel-distribuidores, escala-semántica con Table, mapa perceptual con recharts ScatterChart dominio [0,100] + tooltip custom, pronóstico, publicidad/fuerza de ventas de la competencia, experimento de precio/atributos, segmentación emergente DORADA 💎 con vectores ideales). Firmas propias resaltadas con el color del equipo. Pendientes agrupados "⏳ Esperando al profesor".
4. `src/components/game/alumno/proyectos.tsx` — laboratorio I+D: tarjetas con badges por estado (EN_DESARROLLO ámbar pulsante, APROBADO, FALLIDO con nota, APLICADO), formulario con borde morado (6 sliders 1-10 + presupuesto con config), feedback en vivo con `probabilidadExito`/`presupuestoNormal`, barra de probabilidad por umbrales (rojo/ámbar/esmeralda), validación de nombre, contadores y reglas.
5. `src/components/game/alumno/reportes.tsx` — reportes: chips de año (fetch bajo demanda con patrón sin setState síncrono en effect para cumplir `react-hooks/set-state-in-effect`), banner sinDecision, 4 KPIs, desglose de gastos, BarChart de evolución de contribución (Cell verde/rojo), tabla por marca y mini-gráficos por canal/segmento (CANALES/SEGMENTOS) por marca.
6. `src/components/game/alumno/ranking.tsx` — podio top-3 (medallas, pacha-glow en 1º, dot de color) + tabla general con fila propia resaltada (ring-pink).
7. `src/components/game/profesor-panel.tsx` — panel profesor: HUD sin tabs con pendientes, Dialog "Nueva simulación" (textarea de equipos, default Colibrí/Kallpa/Inti/Pachamama), tarjetas por industria con Progress de año, botón gradiente "⚙️ Procesar ronda" con AlertDialog (avisa equipos sin decisión), toast con ventas del mercado y finalización, tabla de equipos con Select para asignar/desasignar alumno (sentinel `0x-sin-asignar` → null porque Radix no admite value="") y mini-ranking lateral.
8. `src/components/game/decano-panel.tsx` — panel decanato: 4 tarjetas de stats, alta de usuarios (Dialog con rol), reset de contraseña a 321, tabla de simulaciones con líder 🥇.

## Verificación
- `bun run lint` → **0 errores, 0 warnings** (se corrigió 1 error `react-hooks/set-state-in-effect` en reportes.tsx derivando el estado de carga).
- `bunx tsc --noEmit` → **0 errores en los archivos de components/game** (los errores restantes son preexistentes en `examples/`, `skills/` y backend `src/app/api/*`, `src/lib/pacha/{estudios,seed}.ts` — fuera de alcance).
- `GET /` → 200 y `✓ Compiled` en dev.log.

## Decisiones de diseño
- Sliders tematizados por arbitrary variants sobre `data-slot` (track blanco/10, range rosa, thumb zinc) porque el tema base shadcn es claro.
- Se reutiliza `SliderControl`/`VendedoresControl` para SLI + input numérico con texto intermedio (permite tipear decimales sin saltos).
- Enviar decisión hace `guardarBorrador` + `enviarDecision`: el backend rechaza enviar sin borrador ("No hay borrador para enviar").
- Paleta rosa/ámbar/esmeralda/morado/naranja/teal; cero azul/índigo. Emojis en títulos, tono de videojuego.
- Nota para otros agentes: la seed del backend falla con Prisma (`orderBy createdAt` no existe en Equipo) — es un error preexistente fuera de mis 8 archivos.

## Estado
COMPLETADO — Task 6 lista para integración.
