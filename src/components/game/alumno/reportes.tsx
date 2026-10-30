'use client'

import { useEffect, useState } from 'react'
import { Coins, Loader2, Package, PieChart, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchReporte, type AlumnoEstado, type ReporteDetalle } from '@/lib/pacha/api-client'
import { CANALES, SEGMENTOS } from '@/lib/pacha/catalogo'
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

  const r = reporte
  const contribucionTotal = estado.reportes.reduce((s, x) => s + x.contribucion, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">📊 Reportes</h2>
          <p className="mt-0.5 text-sm text-zinc-400">Los números de tu imperio de helados, año por año.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Elegir año">
          {anios.map((a) => (
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
              Año {a}
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
              const porCanal = CANALES.map((c) => ({
                nombre: c.nombre,
                ventas: m.porCanal.find((x) => x.canalId === c.id)?.ventas ?? 0,
              }))
              const porSegmento = SEGMENTOS.map((s) => ({
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
        </>
      )}
    </div>
  )
}
