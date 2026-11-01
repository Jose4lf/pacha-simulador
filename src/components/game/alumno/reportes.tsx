'use client'

import { useEffect, useState } from 'react'
import { Coins, Loader2, Package, PieChart, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchReporte, type AlumnoEstado, type ReporteDetalle } from '@/lib/pacha/api-client'
import { LineChart, Line, Legend } from 'recharts'
import { CANALES_BOLIVIA, SEGMENTOS_BOLIVIA, REGIONES } from '@/lib/pacha/config-bolivia'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + 'k'
const fmtU = (v: number) => v.toLocaleString('es-BO', { maximumFractionDigits: 1 }) + 'k u'
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')

const ROSA = '#f472b6'
const TEAL = '#2dd4bf'
const ZINC = '#a1a1aa'
const EJE = { stroke: 'rgba(255,255,255,0.2)', tick: { fill: ZINC, fontSize: 11 } }

function colorContribucion(v: number): string {
  return v >= 0 ? 'text-emerald-300' : 'text-red-300'
}

function TooltipSimple({
  active,
  payload,
  label,
  formato,
}: {
  active?: boolean
  payload?: { value?: number | string }[]
  label?: string | number
  formato?: (v: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  const v = Number(payload[0]?.value ?? 0)
  return (
    <div className="rounded-lg border border-white/10 bg-[#1c1528] px-3 py-1.5 text-xs shadow-xl">
      <p className="font-bold text-zinc-100">{label}</p>
      <p className="text-zinc-400">{formato ? formato(v) : v.toLocaleString('es-BO')}</p>
    </div>
  )
}

function MiniGraficoBarras({
  titulo,
  data,
  color,
  formato,
}: {
  titulo: string
  data: { nombre: string; ventas: number }[]
  color: string
  formato: (v: number) => string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <h5 className="mb-1 text-[11px] font-black uppercase tracking-wide text-zinc-400">{titulo}</h5>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="nombre" {...EJE} interval={0} tick={{ fill: ZINC, fontSize: 10 }} />
          <YAxis {...EJE} tick={{ fill: ZINC, fontSize: 10 }} />
          <Tooltip content={<TooltipSimple formato={formato} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="ventas" radius={[4, 4, 0, 0]} fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AlumnoReportes({ estado }: { estado: AlumnoEstado }) {
  const anios = estado.reportes.map((r) => r.anio)
  const anioInicial = anios.length > 0 ? Math.max(...anios) : null
  const [anio, setAnio] = useState<number | null>(anioInicial)
  const [cargandoAnio, setCargandoAnio] = useState<number | null>(anioInicial)
  const [reporte, setReporte] = useState<ReporteDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargando = anio !== null && cargandoAnio === anio

  function cambiarAnio(a: number) {
    setAnio(a)
    setCargandoAnio(a)
  }

  useEffect(() => {
    if (anio === null) return
    let vivo = true
    fetchReporte(anio)
      .then((r) => {
        if (!vivo) return
        setReporte(r)
        setError(null)
        setCargandoAnio(null)
      })
      .catch((e) => {
        if (!vivo) return
        setReporte(null)
        setError(msg(e))
        setCargandoAnio(null)
      })
    return () => {
      vivo = false
    }
  }, [anio])

  if (anios.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">📊 Reportes</h2>
        <div className="pacha-panel flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-5xl" aria-hidden="true">📊</p>
          <p className="max-w-sm text-sm text-zinc-400">
            Aún no hay reportes. Cuando el profesor procese la primera ronda, aquí verás tus resultados.
          </p>
        </div>
      </div>
    )
  }

  const aniosVisibles = anios.filter((a) => a >= 0)
  const r = reporte
  const contribucionTotal = estado.reportes.reduce((s, x) => s + x.contribucion, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">📊 Reportes</h2>
          <p className="mt-0.5 text-sm text-zinc-400">
            {anio === 0
              ? 'Reporte general: la historia del mercado de los 3 años anteriores a tu gestión.'
              : 'Los números de tu imperio de helados, año por año.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Elegir año">
          {aniosVisibles.map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={a === anio}
              onClick={() => cambiarAnio(a)}
              className={`min-h-[36px] rounded-lg px-3.5 text-sm font-black transition-colors ${
                a === anio
                  ? 'bg-gradient-to-r from-pink-500/30 to-amber-500/30 text-white ring-1 ring-pink-400/50'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
              }`}
            >
              {a === 0 ? 'Año 0 · General' : `Año ${a}`}
            </button>
          ))}
        </div>
      </div>

      {cargando && (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-pink-400" aria-label="Cargando reporte" />
        </div>
      )}

      {!cargando && error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!cargando && r && !error && (
        <>
          {/* Historia del mercado (solo Año 0): los 3 años anteriores */}
          {r.anio === 0 && r.historia && r.historia.length > 0 && (
            <div className="pacha-panel p-4">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">
                📜 Reporte general del mercado · 3 años anteriores
              </h3>
              <p className="mb-3 text-xs text-zinc-500">
                Así venía el mercado antes de tu gestión: ventas totales de la industria, tu participación y tu
                contribución en cada año histórico.
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-zinc-400">Año</TableHead>
                    <TableHead className="text-right text-zinc-400">Ventas del mercado</TableHead>
                    <TableHead className="text-right text-zinc-400">Ventas de tu empresa</TableHead>
                    <TableHead className="text-right text-zinc-400">Tu cuota</TableHead>
                    <TableHead className="text-right text-zinc-400">Tu contribución</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.historia.map((h) => (
                    <TableRow key={h.anio} className="border-white/5">
                      <TableCell className="text-xs font-black text-zinc-100">Año {h.anio}</TableCell>
                      <TableCell className="text-right text-xs text-zinc-300">{fmtU(h.ventasMercado)}</TableCell>
                      <TableCell className="text-right text-xs text-zinc-300">{fmtU(h.ventasEquipo)}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-pink-300">{h.participacion.toFixed(1)}%</TableCell>
                      <TableCell className={`text-right text-xs font-black ${colorContribucion(h.contribucion)}`}>
                        {fmtBs(h.contribucion)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {r.sinDecision && (
            <div
              role="status"
              className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm font-bold text-amber-200"
            >
              ⚠️ Este año el motor usó los valores vigentes: tu equipo no envió decisión.
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="pacha-panel p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <Package className="h-3.5 w-3.5 text-pink-300" aria-hidden="true" /> Ventas
              </p>
              <p className="mt-1 text-xl font-black text-pink-300">{fmtU(r.ventas)}</p>
            </div>
            <div className="pacha-panel p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <Coins className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" /> Ingresos
              </p>
              <p className="mt-1 text-xl font-black text-amber-300">{fmtBs(r.ingresos)}</p>
            </div>
            <div className="pacha-panel p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <TrendingUp className={`h-3.5 w-3.5 ${r.contribucion >= 0 ? 'text-emerald-300' : 'text-red-300'}`} aria-hidden="true" /> Contribución
              </p>
              <p className={`mt-1 text-xl font-black ${colorContribucion(r.contribucion)}`}>{fmtBs(r.contribucion)}</p>
            </div>
            <div className="pacha-panel p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <PieChart className="h-3.5 w-3.5 text-pink-300" aria-hidden="true" /> Cuota de mercado
              </p>
              <p className="mt-1 text-xl font-black text-pink-300">{r.participacion.toFixed(1)}%</p>
            </div>
          </div>

          {/* Desglose de gastos */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {[
              { label: 'Costos de producto', valor: r.costos },
              { label: 'Publicidad', valor: r.publicidad },
              { label: 'Fuerza de ventas', valor: r.fuerzaVentas },
              { label: 'Investigación de mercado', valor: r.investigacionMercado },
            ].map((g) => (
              <span
                key={g.label}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-semibold text-zinc-300"
              >
                {g.label}: <b className="text-zinc-100">{fmtBs(g.valor)}</b>
              </span>
            ))}
          </div>

          {/* Evolución de contribución */}
          <div className="pacha-panel p-4">
            <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-zinc-300">
              📈 Evolución de contribución por año
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={estado.reportes} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="anio" {...EJE} tickFormatter={(v: number) => `A${v}`} />
                <YAxis {...EJE} />
                <Tooltip content={<TooltipSimple formato={fmtBs} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="contribucion" radius={[4, 4, 0, 0]}>
                  {estado.reportes.map((x) => (
                    <Cell key={x.anio} fill={x.contribucion >= 0 ? '#34d399' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla por marca */}
          <div className="pacha-panel overflow-x-auto p-4">
            <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-zinc-300">
              🍨 Desempeño por marca · Año {r.anio}
            </h3>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-zinc-400">Marca</TableHead>
                  <TableHead className="text-right text-zinc-400">Ventas</TableHead>
                  <TableHead className="text-right text-zinc-400">Producción</TableHead>
                  <TableHead className="text-right text-zinc-400">Inventario</TableHead>
                  <TableHead className="text-right text-zinc-400">Ingresos</TableHead>
                  <TableHead className="text-right text-zinc-400">Costos</TableHead>
                  <TableHead className="text-right text-zinc-400">Contribución</TableHead>
                  <TableHead className="text-right text-zinc-400">% del equipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.marcas.map((m) => (
                  <TableRow key={m.marcaNombre} className="border-white/5">
                    <TableCell className="whitespace-nowrap text-xs font-bold text-zinc-100">{m.marcaNombre}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-300">{fmtU(m.ventas)}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-300">{fmtU(m.produccion)}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-300">{fmtU(m.inventario)}</TableCell>
                    <TableCell className="text-right text-xs text-amber-300">{fmtBs(m.ingresos)}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-400">{fmtBs(m.costos)}</TableCell>
                    <TableCell className={`text-right text-xs font-black ${colorContribucion(m.contribucion)}`}>
                      {fmtBs(m.contribucion)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-pink-300">{m.participacion.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mini-gráficos por marca */}
          <section aria-label="Ventas por marca" className="space-y-4">
            {r.marcas.map((m) => {
              const porCanal = CANALES_BOLIVIA.map((c) => ({
                nombre: c.nombre,
                ventas: m.porCanal.find((x) => x.canalId === c.id)?.ventas ?? 0,
              }))
              const porSegmento = SEGMENTOS_BOLIVIA.map((s) => ({
                nombre: s.nombre,
                ventas: m.porSegmento.find((x) => x.segmentoId === s.id)?.ventas ?? 0,
              }))
              return (
                <div key={m.marcaNombre} className="pacha-panel p-4">
                  <h4 className="mb-2 text-sm font-black text-zinc-100">
                    🍦 {m.marcaNombre}
                    <span className="ml-2 text-[11px] font-semibold text-zinc-500">
                      contribución acumulada del año: {fmtBs(m.contribucion)} · total equipo {fmtBs(contribucionTotal)}
                    </span>
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniGraficoBarras titulo="🏪 Ventas por canal" data={porCanal} color={ROSA} formato={fmtU} />
                    <MiniGraficoBarras titulo="🧒 Ventas por segmento" data={porSegmento} color={TEAL} formato={fmtU} />
                  </div>
                </div>
              )
            })}
          </section>

          {/* ============ BOLIVIA: mercado, mensual, regiones, finanzas, eventos e inflación ============ */}
          {r.detalle?.mercado && (
            <div className="pacha-panel p-4">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">
                🇧🇴 Mercado total de Bolivia · Año {r.anio}
              </h3>
              <p className="mb-3 text-xs text-zinc-500">
                Participación sobre el mercado total (con el «Resto del mercado»: heladerías artesanales, informal e
                importados) y sobre el mercado de las empresas jugables (doc §1.2).
              </p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Demanda total</p>
                  <p className="mt-1 text-lg font-black text-zinc-100">{(r.detalle.mercado.demandaTotal / 1000).toFixed(2)} M litros</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Vendido por las empresas</p>
                  <p className="mt-1 text-lg font-black text-pink-300">{(r.detalle.mercado.ventasEmpresas / 1000).toFixed(2)} M litros</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Resto del mercado</p>
                  <p className="mt-1 text-lg font-black text-teal-300">{(r.detalle.mercado.ventasResto / 1000).toFixed(2)} M litros</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Captura de las empresas</p>
                  <p className="mt-1 text-lg font-black text-amber-300">{r.detalle.mercado.capturaEmpresas.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}

          {r.detalle?.detalleMensual && r.detalle.detalleMensual.length > 0 && (
            <div className="pacha-panel p-4">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">
                📅 Detalle mensual del periodo (doc §13)
              </h3>
              <p className="mb-3 text-xs text-zinc-500">
                El motor calcula 12 pasos mensuales con estacionalidad por zona (altiplano, valles y llanos) y eventos.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={r.detalle.detalleMensual} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="mes" {...EJE} tickFormatter={(v: number) => `M${v}`} />
                  <YAxis {...EJE} />
                  <Tooltip content={<TooltipSimple formato={fmtU} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="demandaTotal" name="Demanda" stroke={ZINC} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ventasEmpresas" name="Empresas" stroke={ROSA} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ventasResto" name="Resto" stroke={TEAL} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-zinc-400">Mes</TableHead>
                      <TableHead className="text-right text-zinc-400">Demanda (k L)</TableHead>
                      <TableHead className="text-right text-zinc-400">Empresas (k L)</TableHead>
                      <TableHead className="text-right text-zinc-400">Resto (k L)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.detalle.detalleMensual.map((d) => (
                      <TableRow key={d.mes} className="border-white/5">
                        <TableCell className="text-xs font-bold text-zinc-200">Mes {d.mes}</TableCell>
                        <TableCell className="text-right text-xs text-zinc-300">{d.demandaTotal.toLocaleString('es-BO')}</TableCell>
                        <TableCell className="text-right text-xs text-pink-300">{d.ventasEmpresas.toLocaleString('es-BO')}</TableCell>
                        <TableCell className="text-right text-xs text-teal-300">{d.ventasResto.toLocaleString('es-BO')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {r.detalle?.porRegion && r.detalle.porRegion.length > 0 && (
            <div className="pacha-panel p-4">
              <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-zinc-300">
                🗺️ Ventas por departamento (doc §8)
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniGraficoBarras
                  titulo="Miles de litros por región"
                  data={r.detalle.porRegion
                    .map((x) => ({ nombre: REGIONES.find((rr) => rr.id === x.regionId)?.nombre ?? x.regionId, ventas: x.ventas }))
                    .sort((a, b) => b.ventas - a.ventas)}
                  color={ROSA}
                  formato={fmtU}
                />
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-zinc-400">Departamento</TableHead>
                      <TableHead className="text-right text-zinc-400">Ventas (k L)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...r.detalle.porRegion].sort((a, b) => b.ventas - a.ventas).map((x) => (
                      <TableRow key={x.regionId} className="border-white/5">
                        <TableCell className="text-xs text-zinc-200">{REGIONES.find((rr) => rr.id === x.regionId)?.nombre ?? x.regionId}</TableCell>
                        <TableCell className="text-right text-xs text-zinc-300">{x.ventas.toLocaleString('es-BO')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {r.detalle?.finanzas && (
            <div className="pacha-panel p-4">
              <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-zinc-300">
                💰 Resultados financieros (IVA · IT · IUE — doc §9)
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableBody>
                    {([
                      ['Ingresos brutos (con IVA)', r.detalle.finanzas.ingresosBrutos],
                      ['IVA (13%)', r.detalle.finanzas.iva],
                      ['Ingresos netos de IVA', r.detalle.finanzas.ingresosNetos],
                      ['Costo de productos', r.detalle.finanzas.costoProductos],
                      ['Logística (6% por región)', r.detalle.finanzas.logistica],
                      ['Pérdidas de cadena de frío (2%)', r.detalle.finanzas.perdidasCadenaFrio],
                      ['Promoción (3%)', r.detalle.finanzas.promocion],
                      ['Investigación de mercado (5%)', r.detalle.finanzas.investigacionMercado],
                      ['Comisión de vendedores (3%)', r.detalle.finanzas.comisionVendedores],
                      ['Publicidad', r.detalle.finanzas.publicidad],
                      ['Fuerza de ventas', r.detalle.finanzas.fuerzaVentas],
                      ['Inversión en capacidad', r.detalle.finanzas.costoCapacidad],
                      ['Utilidad operativa', r.detalle.finanzas.utilidadOperativa],
                      ['Intereses de la deuda', r.detalle.finanzas.intereses],
                      ['IT (3% de ingresos)', r.detalle.finanzas.it],
                      ['IUE (25% de la utilidad)', r.detalle.finanzas.iue],
                      ['Utilidad neta', r.detalle.finanzas.utilidadNeta],
                    ] as [string, number][]).map(([k, v]) => (
                      <TableRow key={k} className="border-white/5">
                        <TableCell className="text-xs text-zinc-400">{k}</TableCell>
                        <TableCell className={`text-right text-xs font-bold ${String(k).startsWith('Utilidad') ? colorContribucion(Number(v)) : 'text-zinc-200'}`}>
                          {fmtBs(Number(v))}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-white/10">
                      <TableCell className="text-xs text-zinc-400">Margen bruto / operativo · ROI</TableCell>
                      <TableCell className="text-right text-xs font-black text-amber-300">
                        {(((r.detalle.finanzas.margenBruto as number) ?? 0) * 100).toFixed(1)}% ·{' '}
                        {(((r.detalle.finanzas.margenOperativo as number) ?? 0) * 100).toFixed(1)}% · ROI{' '}
                        {String(r.detalle.finanzas.roi ?? 0)}%
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/10">
                      <TableCell className="text-xs text-zinc-400">Deuda al cierre (tope 60% de ventas)</TableCell>
                      <TableCell className={`text-right text-xs font-bold ${(r.detalle.finanzas.endeudamientoAviso as boolean) ? 'text-red-300' : 'text-zinc-200'}`}>
                        {fmtBs(Number(r.detalle.finanzas.deudaFinal ?? 0))}
                        {(r.detalle.finanzas.endeudamientoAviso as boolean) ? ' · ⚠️ tope alcanzado' : ''}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {r.detalle?.produccionAnio && (
            <div className="pacha-panel p-4">
              <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-zinc-300">
                🏭 Producción e inventarios (doc §5)
              </h3>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Capacidad instalada</p>
                  <p className="mt-1 text-base font-black text-zinc-100">{Number(r.detalle.produccionAnio.capacidadInstalada ?? 0).toLocaleString('es-BO')}k L</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Utilización</p>
                  <p className="mt-1 text-base font-black text-pink-300">{String(r.detalle.produccionAnio.utilizacionPct ?? 0)}%</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Merma de producción (2%)</p>
                  <p className="mt-1 text-base font-black text-zinc-100">{Number(r.detalle.produccionAnio.merma ?? 0).toLocaleString('es-BO')}k L</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Quiebres de stock</p>
                  <p className="mt-1 text-base font-black text-orange-300">{String(r.detalle.produccionAnio.quiebresStock ?? 0)}</p>
                </div>
              </div>
            </div>
          )}

          {r.detalle?.eventos && r.detalle.eventos.length > 0 && (
            <div className="pacha-panel p-4">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">
                🎉 Acontecimientos del periodo (doc §15)
              </h3>
              <p className="mb-3 text-xs text-zinc-500">
                Efectos agrupados por variable, región y mes (pesos 100/50/25; topes +25% / −20% demanda y +30% / −10% costos).
              </p>
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-zinc-400">Variable</TableHead>
                      <TableHead className="text-zinc-400">Región</TableHead>
                      <TableHead className="text-zinc-400">Mes</TableHead>
                      <TableHead className="text-zinc-400">Eventos</TableHead>
                      <TableHead className="text-right text-zinc-400">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.detalle.eventos.map((e, i) => (
                      <TableRow key={i} className="border-white/5">
                        <TableCell className="text-xs font-bold text-zinc-200 capitalize">{e.variable}</TableCell>
                        <TableCell className="text-xs text-zinc-400">{e.region === 'NACIONAL' ? 'Nacional' : e.region.replace('_', ' ')}</TableCell>
                        <TableCell className="text-xs text-zinc-400">M{e.mes}</TableCell>
                        <TableCell className="text-xs text-zinc-400">
                          {e.eventos.map((x) => `${x.nombre} (${(x.efecto * 100).toFixed(0)}% × ${x.peso * 100}%)`).join(' + ')}
                        </TableCell>
                        <TableCell className={`text-right text-xs font-black ${e.total >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          {(e.total * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {r.detalle?.inflacion && (
            <div className="pacha-panel p-4">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">
                📈 Inflación del periodo (doc §18)
              </h3>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-semibold text-zinc-300">
                  Escenario: <b className="text-zinc-100">{r.detalle.inflacion.escenario}</b>
                </span>
                <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-semibold text-zinc-300">
                  πₜ = <b className="text-amber-300">{(r.detalle.inflacion.pi * 100).toFixed(2)}%</b>
                </span>
                <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-semibold text-zinc-300">
                  Índice de precios: <b className="text-zinc-100">{r.detalle.inflacion.indicePreciosFin.toFixed(1)}</b>
                </span>
                <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-semibold text-zinc-300">
                  Tipo de cambio: <b className="text-zinc-100">Bs {r.detalle.inflacion.tipoCambioFinal.toFixed(2)}/US$</b>
                </span>
              </div>
              {r.detalle.inflacion.factores.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] text-zinc-400">
                  {r.detalle.inflacion.factores.map((f) => (
                    <li key={f.factor} className="flex justify-between">
                      <span className="capitalize">{f.factor.replace('_', ' ')}</span>
                      <span className={f.aporte >= 0 ? 'text-red-300' : 'text-emerald-300'}>{(f.aporte * 100).toFixed(2)} pp</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {r.macroHistoria && r.macroHistoria.length > 0 && (
            <div className="pacha-panel p-4">
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">
                🧾 Historial de inflación ejecutada (doc §18.10)
              </h3>
              <p className="mb-3 text-xs text-zinc-500">
                Año 0: dato oficial del INE (5,70% interanual, septiembre de 2026). Los alumnos no ven la inflación del
                periodo en curso: deciden con incertidumbre.
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-zinc-400">Año</TableHead>
                    <TableHead className="text-zinc-400">Escenario</TableHead>
                    <TableHead className="text-right text-zinc-400">Inflación anual</TableHead>
                    <TableHead className="text-right text-zinc-400">Índice de precios</TableHead>
                    <TableHead className="text-right text-zinc-400">Tipo de cambio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.macroHistoria.map((m) => (
                    <TableRow key={m.anio} className="border-white/5">
                      <TableCell className="text-xs font-black text-zinc-100">Año {m.anio}</TableCell>
                      <TableCell className="text-xs text-zinc-400">{m.escenario}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-amber-300">{(m.inflacionAnual * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-right text-xs text-zinc-300">{m.indicePreciosFin.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-xs text-zinc-300">Bs {m.tipoCambioFinal.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
