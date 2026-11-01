'use client'

// ============================================================
// PACHA Simulador · Reportes contables del ÁREA del gerente
// Cada gerente ve en su pestaña los números de SU área: tablas,
// cifras y gráficos. El detalle completo sigue en «Reportes generales».
// ============================================================

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AlumnoEstado } from '@/lib/pacha/api-client'
import { CANALES } from '@/lib/pacha/catalogo'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + 'k'
const fmtU = (v: number) => v.toLocaleString('es-BO', { maximumFractionDigits: 1 }) + 'k u'
const fmtPct = (v: number) => v.toFixed(1) + '%'

const ROSA = '#f472b6'
const TEAL = '#2dd4bf'
const AMBAR = '#fbbf24'
const VIOLETA = '#a78bfa'
const ZINC = '#a1a1aa'
const EJE = { stroke: 'rgba(255,255,255,0.2)', tick: { fill: ZINC, fontSize: 10 } }

function TooltipSimple({ active, payload, label }: { active?: boolean; payload?: { value?: number | string; name?: string }[]; label?: string | number }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-white/10 bg-[#1c1528] px-3 py-1.5 text-xs shadow-xl">
      <p className="font-bold text-zinc-100">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-zinc-400">
          {p.name}: {Number(p.value ?? 0).toLocaleString('es-BO', { maximumFractionDigits: 1 })}
        </p>
      ))}
    </div>
  )
}

function Grafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <h5 className="mb-1 text-[11px] font-black uppercase tracking-wide text-zinc-400">{titulo}</h5>
      {children}
    </div>
  )
}

function Kpis({ items }: { items: { etiqueta: string; valor: string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((k) => (
        <div key={k.etiqueta} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{k.etiqueta}</p>
          <p className={`text-lg font-black leading-tight ${k.color ?? 'text-zinc-100'}`}>{k.valor}</p>
        </div>
      ))}
    </div>
  )
}

export function ReportesArea({ estado, cargo }: { estado: AlumnoEstado; cargo: string }) {
  const anio = estado.industria.anioActual

  const { anios, ultima } = useMemo(() => {
    const aniosValidos = estado.reportes.filter((r) => r.anio >= 0).map((r) => r.anio).sort((a, b) => a - b)
    const conDatos = aniosValidos.filter((a) => a < anio) // años ya ejecutados
    const ultima = conDatos.length > 0 ? conDatos[conDatos.length - 1] : null
    return { anios: conDatos, ultima }
  }, [estado.reportes, anio])

  const filasAnio = useMemo(
    () => (ultima !== null ? estado.marcasHistoria.filter((m) => m.anio === ultima) : []),
    [estado.marcasHistoria, ultima]
  )

  const serieAnual = useMemo(
    () =>
      estado.reportes
        .filter((r) => r.anio >= 0)
        .sort((a, b) => a.anio - b.anio)
        .map((r) => ({
          anio: r.anio === 0 ? 'Año 0' : `Año ${r.anio}`,
          ventas: Math.round(r.ventas * 10) / 10,
          contribucion: Math.round(r.contribucion),
          ingresos: Math.round(r.ingresos),
          costos: Math.round(r.costos),
          publicidad: Math.round(r.publicidad),
          fuerzaVentas: Math.round(r.fuerzaVentas),
          investigacion: Math.round(r.investigacionMercado),
          participacion: Math.round(r.participacion * 10) / 10,
        })),
    [estado.reportes]
  )

  const nombreMarca = useMemo(() => new Map(estado.marcas.map((m) => [m.id, m.nombre])), [estado.marcas])
  void nombreMarca

  const porCanalUltima = useMemo(() => {
    const acumulado = new Map<string, number>()
    for (const f of filasAnio) {
      for (const c of f.porCanal) {
        acumulado.set(c.canalId, (acumulado.get(c.canalId) ?? 0) + c.ventas)
      }
    }
    return [...acumulado.entries()].map(([canalId, ventas]) => ({
      canal: CANALES.find((c) => c.id === canalId)?.nombre ?? canalId,
      ventas: Math.round(ventas * 10) / 10,
    }))
  }, [filasAnio])

  if (ultima === null) {
    return (
      <div className="pacha-panel p-6 text-center">
        <p className="text-4xl" aria-hidden="true">📊</p>
        <p className="mt-2 text-sm text-zinc-400">
          Todavía no hay números de tu área: aparecen cuando el docente ejecute la primera ronda.
        </p>
        <p className="mt-1 text-xs text-zinc-500">Los reportes completos están en la pestaña «Reportes generales».</p>
      </div>
    )
  }

  /* ============ 💰 PRECIOS ============ */
  if (cargo === 'precios') {
    return (
      <div className="space-y-4">
        <Kpis
          items={[
            { etiqueta: `Contribución Año ${ultima}`, valor: fmtBs(serieAnual.find((s) => s.anio === `Año ${ultima}`)?.contribucion ?? 0), color: (serieAnual.find((s) => s.anio === `Año ${ultima}`)?.contribucion ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300' },
            { etiqueta: 'Ingresos netos', valor: fmtBs(serieAnual.find((s) => s.anio === `Año ${ultima}`)?.ingresos ?? 0) },
            { etiqueta: 'Cuota de mercado', valor: fmtPct(serieAnual.find((s) => s.anio === `Año ${ultima}`)?.participacion ?? 0), color: 'text-amber-300' },
            { etiqueta: 'Marcas activas', valor: String(filasAnio.length) },
          ]}
        />
        <div className="pacha-panel overflow-x-auto p-4">
          <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-300">💰 Precio, costo y margen por marca · Año {ultima}</h5>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-zinc-400">Marca</TableHead>
                <TableHead className="text-right text-zinc-400">Precio Bs/u</TableHead>
                <TableHead className="text-right text-zinc-400">Costo unitario</TableHead>
                <TableHead className="text-right text-zinc-400">Margen unitario</TableHead>
                <TableHead className="text-right text-zinc-400">Contribución</TableHead>
                <TableHead className="text-right text-zinc-400">Cuota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasAnio.map((f) => {
                const marca = estado.marcas.find((m) => m.nombre === f.marcaNombre)
                const precio = marca?.precio ?? 0
                const margen = precio - (marca?.costoUnitario ?? 0)
                return (
                  <TableRow key={f.marcaNombre} className="border-white/5">
                    <TableCell className="text-xs font-bold text-zinc-100">🍨 {f.marcaNombre}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-amber-300">Bs {precio.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-300">Bs {(marca?.costoUnitario ?? 0).toFixed(2)}</TableCell>
                    <TableCell className={`text-right text-xs font-bold ${margen >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      Bs {margen.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right text-xs font-bold ${f.contribucion >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {fmtBs(f.contribucion)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-zinc-300">{fmtPct(f.participacion)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <Grafico titulo="Contribución por año (miles Bs)">
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={serieAnual} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="anio" {...EJE} />
              <YAxis {...EJE} />
              <Tooltip content={<TooltipSimple />} />
              <Line type="monotone" dataKey="contribucion" name="Contribución" stroke={TEAL} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Grafico>
        <p className="text-[11px] text-zinc-500">🔎 Todo el detalle financiero está en «Reportes generales».</p>
      </div>
    )
  }

  /* ============ 📺 PUBLICIDAD ============ */
  if (cargo === 'publicidad') {
    return (
      <div className="space-y-4">
        <Kpis
          items={[
            { etiqueta: `Publicidad Año ${ultima}`, valor: fmtBs(serieAnual.find((s) => s.anio === `Año ${ultima}`)?.publicidad ?? 0) },
            { etiqueta: 'Awareness promedio', valor: Math.round((estado.marcas.reduce((s, m) => s + m.awareness, 0) / Math.max(1, estado.marcas.length)) * 100) + '%', color: 'text-pink-300' },
            { etiqueta: 'Marcas activas', valor: String(estado.marcas.length) },
            { etiqueta: 'Presupuesto año en curso', valor: fmtBs(estado.marcas.reduce((s, m) => s + m.publicidad, 0)), color: 'text-amber-300' },
          ]}
        />
        <div className="pacha-panel overflow-x-auto p-4">
          <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-300">📺 Publicidad y reconocimiento por marca</h5>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-zinc-400">Marca</TableHead>
                <TableHead className="text-right text-zinc-400">Publicidad año en curso</TableHead>
                <TableHead className="text-right text-zinc-400">Awareness</TableHead>
                <TableHead className="text-right text-zinc-400">Ingresos Año {ultima}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estado.marcas.map((m) => {
                const h = estado.marcasHistoria.find((x) => x.anio === ultima && x.marcaNombre === m.nombre)
                return (
                  <TableRow key={m.id} className="border-white/5">
                    <TableCell className="text-xs font-bold text-zinc-100">🍨 {m.nombre}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-amber-300">{fmtBs(m.publicidad)}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-pink-300">{Math.round(m.awareness * 100)}%</TableCell>
                    <TableCell className="text-right text-xs text-zinc-300">{fmtBs(h?.ingresos ?? 0)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <Grafico titulo="Inversión publicitaria por año (miles Bs)">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={serieAnual} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="anio" {...EJE} />
              <YAxis {...EJE} />
              <Tooltip content={<TooltipSimple />} />
              <Bar dataKey="publicidad" name="Publicidad" fill={ROSA} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>
    )
  }

  /* ============ 🏭 PRODUCCIÓN ============ */
  if (cargo === 'produccion') {
    return (
      <div className="space-y-4">
        <Kpis
          items={[
            { etiqueta: `Ventas Año ${ultima} (unid.)`, valor: fmtU(filasAnio.reduce((s, f) => s + f.ventas, 0)) },
            { etiqueta: 'Producción Año ' + ultima, valor: fmtU(filasAnio.reduce((s, f) => s + f.produccion, 0)) },
            { etiqueta: 'Inventario final', valor: fmtU(filasAnio.reduce((s, f) => s + f.inventario, 0)), color: 'text-sky-300' },
            { etiqueta: 'Producción planificada (año en curso)', valor: fmtU(estado.marcas.reduce((s, m) => s + m.produccion, 0)), color: 'text-amber-300' },
          ]}
        />
        <div className="pacha-panel overflow-x-auto p-4">
          <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-300">🏭 Producción e inventario por marca · Año {ultima}</h5>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-zinc-400">Marca</TableHead>
                <TableHead className="text-right text-zinc-400">Producción</TableHead>
                <TableHead className="text-right text-zinc-400">Ventas</TableHead>
                <TableHead className="text-right text-zinc-400">Inventario final</TableHead>
                <TableHead className="text-right text-zinc-400">Costos totales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasAnio.map((f) => (
                <TableRow key={f.marcaNombre} className="border-white/5">
                  <TableCell className="text-xs font-bold text-zinc-100">🍨 {f.marcaNombre}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-zinc-100">{fmtU(f.produccion)}</TableCell>
                  <TableCell className="text-right text-xs text-teal-300">{fmtU(f.ventas)}</TableCell>
                  <TableCell className="text-right text-xs text-sky-300">{fmtU(f.inventario)}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-300">{fmtBs(f.costos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Grafico titulo="Producción por marca y año (miles de unidades)">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart
              data={serieAnual.map((s) => {
                const num = Number(s.anio.replace('Año ', ''))
                const fila: Record<string, number | string> = { anio: s.anio }
                for (const f of estado.marcasHistoria.filter((x) => x.anio === num)) {
                  fila[f.marcaNombre] = Math.round(f.produccion * 10) / 10
                }
                return fila
              })}
              margin={{ top: 4, right: 8, bottom: 0, left: -14 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="anio" {...EJE} />
              <YAxis {...EJE} />
              <Tooltip content={<TooltipSimple />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {estado.marcas.map((m, i) => (
                <Bar key={m.id} dataKey={m.nombre} fill={i === 0 ? TEAL : VIOLETA} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>
    )
  }

  /* ============ 🚚 DISTRIBUCIÓN Y VENTAS ============ */
  if (cargo === 'ventas') {
    return (
      <div className="space-y-4">
        <Kpis
          items={[
            { etiqueta: `Ventas Año ${ultima}`, valor: fmtU(filasAnio.reduce((s, f) => s + f.ventas, 0)), color: 'text-teal-300' },
            { etiqueta: 'Fuerza de ventas', valor: fmtBs(serieAnual.find((s) => s.anio === `Año ${ultima}`)?.fuerzaVentas ?? 0) },
            { etiqueta: 'Cuota de mercado', valor: fmtPct(serieAnual.find((s) => s.anio === `Año ${ultima}`)?.participacion ?? 0), color: 'text-amber-300' },
            { etiqueta: 'Vendedores planificados', valor: String(estado.marcas.reduce((s, m) => s + m.vendedores.reduce((a, b) => a + b, 0), 0)), color: 'text-amber-300' },
          ]}
        />
        <div className="pacha-panel overflow-x-auto p-4">
          <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-300">🚚 Ventas por marca · Año {ultima}</h5>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-zinc-400">Marca</TableHead>
                <TableHead className="text-right text-zinc-400">Ventas (k u)</TableHead>
                <TableHead className="text-right text-zinc-400">Ingresos</TableHead>
                <TableHead className="text-right text-zinc-400">Cuota de la marca</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasAnio.map((f) => (
                <TableRow key={f.marcaNombre} className="border-white/5">
                  <TableCell className="text-xs font-bold text-zinc-100">🍨 {f.marcaNombre}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-teal-300">{fmtU(f.ventas)}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-300">{fmtBs(f.ingresos)}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-300">{fmtPct(f.participacion)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Grafico titulo={`Ventas por canal · Año ${ultima} (miles de unidades)`}>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={porCanalUltima} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="canal" {...EJE} interval={0} />
              <YAxis {...EJE} />
              <Tooltip content={<TooltipSimple />} />
              <Bar dataKey="ventas" name="Ventas" fill={TEAL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Ventas totales por año (miles de unidades)">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={serieAnual} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="anio" {...EJE} />
              <YAxis {...EJE} />
              <Tooltip content={<TooltipSimple />} />
              <Line type="monotone" dataKey="ventas" name="Ventas" stroke={AMBAR} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Grafico>
      </div>
    )
  }

  /* ============ 🔬 INVESTIGACIÓN Y DESARROLLO ============ */
  return (
    <div className="space-y-4">
      <Kpis
        items={[
          { etiqueta: `Gasto en I+D Año ${ultima}`, valor: fmtBs(serieAnual.find((s) => s.anio === `Año ${ultima}`)?.investigacion ?? 0) },
          { etiqueta: 'Proyectos registrados', valor: String(estado.proyectos.length), color: 'text-purple-300' },
          { etiqueta: 'En desarrollo', valor: String(estado.proyectos.filter((p) => p.estado === 'EN_DESARROLLO').length), color: 'text-amber-300' },
          { etiqueta: 'Aprobados', valor: String(estado.proyectos.filter((p) => p.estado === 'APROBADO').length), color: 'text-emerald-300' },
        ]}
      />
      <div className="pacha-panel overflow-x-auto p-4">
        <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-300">🧪 Proyectos de I+D del equipo</h5>
        {estado.proyectos.length === 0 ? (
          <p className="text-xs text-zinc-500">Sin proyectos todavía. Regístralos en la pestaña I+D.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-zinc-400">Proyecto</TableHead>
                <TableHead className="text-right text-zinc-400">Presupuesto</TableHead>
                <TableHead className="text-right text-zinc-400">Probabilidad</TableHead>
                <TableHead className="text-right text-zinc-400">Estado</TableHead>
                <TableHead className="text-right text-zinc-400">Año inicio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estado.proyectos.map((p) => (
                <TableRow key={p.id} className="border-white/5">
                  <TableCell className="text-xs font-bold text-zinc-100">⚗️ {p.nombre}</TableCell>
                  <TableCell className="text-right text-xs text-amber-300">{fmtBs(p.presupuesto)}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-300">{Math.round(p.probabilidad * 100)}%</TableCell>
                  <TableCell className="text-right text-xs font-bold text-purple-300">{p.estado.replace('_', ' ')}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-400">{p.anioInicio}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="pacha-panel p-4">
        <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-300">🛒 Estudios de mercado comprados</h5>
        {estado.estudiosComprados.length === 0 ? (
          <p className="text-xs text-zinc-500">Sin estudios comprados aún.</p>
        ) : (
          <ul className="space-y-1.5">
            {estado.estudiosComprados.map((c, i) => {
              const est = estado.config.catalogoEstudios.find((e) => e.id === c.estudioId)
              return (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs">
                  <span>{est?.icono ?? '📄'}</span>
                  <b className="text-zinc-100">{est?.nombre ?? `Estudio #${c.estudioId}`}</b>
                  <span className="text-zinc-500">Año {c.anio}</span>
                  <span className="ml-auto font-bold text-amber-300">{fmtBs(c.costo)}</span>
                  {c.tieneDatos && <span className="text-[10px] font-bold text-emerald-300">datos listos ✓</span>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <Grafico titulo="Gasto en investigación de mercado por año (miles Bs)">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={serieAnual} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="anio" {...EJE} />
            <YAxis {...EJE} />
            <Tooltip content={<TooltipSimple />} />
            <Bar dataKey="investigacion" name="I+D" fill={VIOLETA} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Grafico>
    </div>
  )
}
