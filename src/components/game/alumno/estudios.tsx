'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchEstudios, type AlumnoEstado, type DatosEstudios } from '@/lib/pacha/api-client'
import { ATRIBUTOS, ESTUDIOS, type EstudioDef } from '@/lib/pacha/catalogo'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + 'k'
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')

const ROSA = '#f472b6'
const AMBAR = '#fbbf24'
const ESMERALDA = '#34d399'
const MORADO = '#c084fc'
const NARANJA = '#fb923c'
const TEAL = '#2dd4bf'
const ZINC = '#a1a1aa'
const CANALES_FALLBACK = ['Tiendas', 'Supermercados', 'Kioscos']

/* Formas de los datos (según el generador de estudios del motor) */
type DatosEstudio =
  | { tipo: 'awareness'; marcas: { marca: string; firma: string; esPropia: boolean; awareness: number }[] }
  | {
      tipo: 'panel-consumidores'
      segmentos: { segmento: string; preferencias: { marca: string; firma: string; esPropia: boolean; preferencia: number }[] }[]
    }
  | { tipo: 'panel-distribuidores'; canales: { canal: string; firmas: { firma: string; esPropia: boolean; cobertura: number }[] }[] }
  | {
      tipo: 'escala-semantica'
      segmento: string
      atributos: { atributo: string; emoji: string; marcas: { marca: string; calificacion: number }[] }[]
      nota: string
    }
  | {
      tipo: 'mapa-perceptual'
      marcas: { marca: string; firma: string; esPropia: boolean; x: number; y: number }[]
      ejeX: string
      ejeY: string
    }
  | { tipo: 'pronostico'; anioPronostico: number; segmentos: { segmento: string; emoji: string; demanda: number; unidad: string }[] }
  | { tipo: 'publicidad-competencia'; unidad: string; marcas: { marca: string; firma: string; publicidad: number }[] }
  | { tipo: 'fuerza-ventas-competencia'; marcas: { marca: string; firma: string; vendedores: number[]; canales: string[] }[] }
  | { tipo: 'experimento-precio'; segmentos: { segmento: string; sensibilidad: number; precioIdeal: number; lectura: string }[] }
  | {
      tipo: 'experimento-atributos'
      segmentos: { segmento: string; pesos: { atributo: string; emoji: string; importancia: number }[] }[]
    }
  | {
      tipo: 'segmentacion-emergente'
      segmentos: { segmento: string; emoji: string; descripcion: string; precioIdeal: number; ideal: number[]; atributos: string[] }[]
    }
  | { tipo: 'desconocido' }

interface EstudioConDatos {
  anio: number
  estudioId: number
  def: EstudioDef
  datos: DatosEstudio
}

function esDatosEstudio(x: unknown): x is DatosEstudio {
  return typeof x === 'object' && x !== null && typeof (x as { tipo?: unknown }).tipo === 'string'
}

/* ============ Piezas visuales reutilizables ============ */

function Barra({ valor, color = ROSA }: { valor: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, valor))}%`, backgroundColor: color }}
      />
    </div>
  )
}

function FilaDato({
  titulo,
  subtitulo,
  valor,
  max = 100,
  color,
  propia,
  colorEquipo,
  sufijo = '%',
}: {
  titulo: string
  subtitulo?: string
  valor: number
  max?: number
  color?: string
  propia?: boolean
  colorEquipo?: string
  sufijo?: string
}) {
  const cuerpo = (
    <>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-bold ${propia ? 'text-zinc-50' : 'text-zinc-300'}`}>
          {titulo}
          {subtitulo && <span className="ml-1 font-normal text-zinc-500">· {subtitulo}</span>}
        </p>
        <div className="mt-1">
          <Barra valor={(valor / max) * 100} color={color} />
        </div>
      </div>
      <span className={`w-12 shrink-0 text-right text-xs font-black ${propia ? 'text-pink-300' : 'text-zinc-400'}`}>
        {valor.toLocaleString('es-BO', { maximumFractionDigits: 1 })}
        {sufijo}
      </span>
    </>
  )
  if (propia) {
    return (
      <div className="flex items-center gap-3 rounded-lg border px-2 py-1.5" style={{ borderColor: colorEquipo ?? ROSA }}>
        {cuerpo}
      </div>
    )
  }
  return <div className="flex items-center gap-3 px-2 py-1">{cuerpo}</div>
}

function TooltipMapa({ active, payload }: { active?: boolean; payload?: { payload?: Record<string, unknown> }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div className="rounded-lg border border-white/10 bg-[#1c1528] px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-zinc-100">{String(p.marca)}</p>
      <p className="text-zinc-400">
        {String(p.firma)} · precio {Math.round(Number(p.x))} · calidad {Math.round(Number(p.y))}
      </p>
    </div>
  )
}

/* ============ Cuerpo por tipo de estudio ============ */

function CuerpoEstudio({ datos, colorEquipo }: { datos: DatosEstudio; colorEquipo: string }) {
  switch (datos.tipo) {
    case 'awareness':
      return (
        <div className="space-y-1.5">
          {datos.marcas.map((m) => (
            <FilaDato
              key={`${m.firma}-${m.marca}`}
              titulo={m.marca}
              subtitulo={m.firma}
              valor={m.awareness}
              propia={m.esPropia}
              colorEquipo={colorEquipo}
              color={ROSA}
            />
          ))}
        </div>
      )

    case 'panel-consumidores':
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datos.segmentos.map((seg) => (
            <div key={seg.segmento} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-amber-300">🛍️ {seg.segmento}</h5>
              <div className="space-y-1.5">
                {seg.preferencias.map((p) => (
                  <FilaDato
                    key={`${p.firma}-${p.marca}`}
                    titulo={p.marca}
                    subtitulo={p.firma}
                    valor={p.preferencia}
                    propia={p.esPropia}
                    colorEquipo={colorEquipo}
                    color={AMBAR}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )

    case 'panel-distribuidores':
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datos.canales.map((c) => (
            <div key={c.canal} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-teal-300">🚚 {c.canal}</h5>
              <div className="space-y-1.5">
                {c.firmas.map((f) => (
                  <FilaDato
                    key={f.firma}
                    titulo={f.firma}
                    valor={f.cobertura}
                    propia={f.esPropia}
                    colorEquipo={colorEquipo}
                    color={TEAL}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )

    case 'escala-semantica': {
      const columnas = datos.atributos[0]?.marcas ?? []
      return (
        <div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-zinc-400">Atributo</TableHead>
                  {columnas.map((m) => (
                    <TableHead key={m.marca} className="text-zinc-300">
                      {m.marca}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.atributos.map((a) => (
                  <TableRow key={a.atributo} className="border-white/5">
                    <TableCell className="whitespace-nowrap text-xs font-semibold text-zinc-200">
                      <span aria-hidden="true">{a.emoji}</span> {a.atributo}
                    </TableCell>
                    {a.marcas.map((m) => (
                      <TableCell key={m.marca}>
                        <div className="flex w-24 flex-col gap-1">
                          <span
                            className={`text-xs font-black ${
                              m.calificacion >= 7 ? 'text-emerald-300' : m.calificacion >= 4 ? 'text-amber-300' : 'text-red-300'
                            }`}
                          >
                            {m.calificacion.toFixed(1)}
                          </span>
                          <Barra valor={m.calificacion * 10} color={m.calificacion >= 7 ? ESMERALDA : m.calificacion >= 4 ? AMBAR : '#f87171'} />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {datos.nota && <p className="mt-2 text-[11px] italic text-zinc-500">📝 {datos.nota}</p>}
        </div>
      )
    }

    case 'mapa-perceptual': {
      const puntos = datos.marcas.map((m) => ({ ...m }))
      return (
        <div>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 28, left: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0, 100]}
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: ZINC, fontSize: 11 }}
                label={{ value: datos.ejeX, position: 'insideBottom', offset: -16, fill: ZINC, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 100]}
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: ZINC, fontSize: 11 }}
                width={40}
                label={{ value: datos.ejeY, angle: -90, position: 'insideLeft', fill: ZINC, fontSize: 11 }}
              />
              <Tooltip content={<TooltipMapa />} cursor={{ strokeDasharray: '4 4', stroke: 'rgba(255,255,255,0.25)' }} />
              <Scatter data={puntos}>
                {puntos.map((p, i) => (
                  <Cell key={i} fill={p.esPropia ? ROSA : ZINC} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-1 flex items-center justify-center gap-4 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ROSA }} /> Tus marcas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ZINC }} /> Competencia
            </span>
          </div>
        </div>
      )
    }

    case 'pronostico':
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datos.segmentos.map((s) => (
            <div key={s.segmento} className="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
              <p className="text-2xl" aria-hidden="true">
                {s.emoji}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-400">{s.segmento}</p>
              <p className="mt-1 text-2xl font-black text-pink-300">{s.demanda.toLocaleString('es-BO')}</p>
              <p className="text-[11px] text-zinc-500">{s.unidad}</p>
            </div>
          ))}
          <p className="col-span-full text-right text-[11px] text-zinc-500">🔮 Pronóstico para el Año {datos.anioPronostico}</p>
        </div>
      )

    case 'publicidad-competencia':
      return (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-zinc-400">Marca</TableHead>
                <TableHead className="text-zinc-400">Firma</TableHead>
                <TableHead className="text-right text-zinc-400">Publicidad ({datos.unidad})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.marcas.map((m) => (
                <TableRow key={`${m.firma}-${m.marca}`} className="border-white/5">
                  <TableCell className="text-xs font-bold text-zinc-200">📺 {m.marca}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{m.firma}</TableCell>
                  <TableCell className="text-right text-xs font-black text-amber-300">{fmtBs(m.publicidad)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )

    case 'fuerza-ventas-competencia': {
      const nombres = datos.marcas[0]?.canales ?? CANALES_FALLBACK
      return (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-zinc-400">Marca</TableHead>
                <TableHead className="text-zinc-400">Firma</TableHead>
                {nombres.map((c) => (
                  <TableHead key={c} className="text-right text-zinc-400">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.marcas.map((m) => (
                <TableRow key={`${m.firma}-${m.marca}`} className="border-white/5">
                  <TableCell className="whitespace-nowrap text-xs font-bold text-zinc-200">🤝 {m.marca}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{m.firma}</TableCell>
                  {nombres.map((_, i) => (
                    <TableCell key={i} className="text-right text-xs font-black text-teal-300">
                      {m.vendedores[i] ?? 0}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )
    }

    case 'experimento-precio':
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datos.segmentos.map((s) => (
            <div key={s.segmento} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-300">🧪 {s.segmento}</p>
              <p className="mt-2 text-2xl font-black text-orange-300">{s.sensibilidad.toFixed(2)}</p>
              <p className="text-[11px] text-zinc-500">sensibilidad al precio</p>
              <p className="mt-2 text-sm font-bold text-amber-300">💰 Precio ideal: Bs {s.precioIdeal.toFixed(1)}</p>
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">{s.lectura}</p>
            </div>
          ))}
        </div>
      )

    case 'experimento-atributos':
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datos.segmentos.map((s) => (
            <div key={s.segmento} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-purple-300">
                ⚖️ {s.segmento}
              </h5>
              <div className="space-y-1.5">
                {s.pesos.map((p) => (
                  <FilaDato
                    key={p.atributo}
                    titulo={`${p.emoji} ${p.atributo}`}
                    valor={p.importancia}
                    propia={false}
                    color={MORADO}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )

    case 'segmentacion-emergente':
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          {datos.segmentos.map((s) => (
            <div key={s.segmento} className="rounded-xl border border-amber-400/30 bg-black/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl" aria-hidden="true">
                  {s.emoji}
                </span>
                <h5 className="text-sm font-black text-amber-200">{s.segmento}</h5>
                <span className="ml-auto rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-black text-amber-300">
                  💰 Precio ideal: Bs {s.precioIdeal.toLocaleString('es-BO')}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-zinc-400">{s.descripcion}</p>
              <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                {s.ideal.map((v, i) => {
                  const nombre = s.atributos[i] ?? ATRIBUTOS[i]?.nombre ?? `Atributo ${i + 1}`
                  const emoji = ATRIBUTOS[i]?.emoji ?? '•'
                  return (
                    <div key={nombre} className="flex items-center gap-2">
                      <span className="w-36 shrink-0 truncate text-[11px] font-semibold text-zinc-300">
                        {emoji} {nombre}
                      </span>
                      <Barra valor={v * 10} color={AMBAR} />
                      <span className="w-5 shrink-0 text-right text-[11px] font-black text-amber-300">{v}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )

    default:
      return <p className="text-xs text-zinc-500">Este estudio no tiene visualización disponible.</p>
  }
}

/* ============ Componente principal ============ */

export function AlumnoEstudios({ estado }: { estado: AlumnoEstado }) {
  const [data, setData] = useState<DatosEstudios | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetchEstudios()
      .then((d) => {
        if (vivo) setData(d)
      })
      .catch((e) => {
        if (vivo) setError(msg(e))
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  const conDatos = useMemo<EstudioConDatos[]>(() => {
    if (!data) return []
    return data.estudios
      .filter((e) => e.datos !== null && e.datos !== undefined && esDatosEstudio(e.datos))
      .map((e) => {
        const def = ESTUDIOS.find((d) => d.id === e.estudioId)
        return def ? { anio: e.anio, estudioId: e.estudioId, def, datos: e.datos as DatosEstudio } : null
      })
      .filter((e): e is EstudioConDatos => e !== null)
      .sort((a, b) => b.anio - a.anio || a.def.id - b.def.id)
  }, [data])

  const anios = useMemo(() => [...new Set(conDatos.map((e) => e.anio))].sort((a, b) => a - b), [conDatos])
  const ultimoAnio = anios.length > 0 ? anios[anios.length - 1] : null

  const pendientes = useMemo(() => {
    const conInfo = new Set(conDatos.map((e) => `${e.anio}:${e.estudioId}`))
    const grupos = new Map<number, EstudioDef[]>()
    for (const c of estado.estudiosComprados) {
      if (conInfo.has(`${c.anio}:${c.estudioId}`)) continue
      const def = ESTUDIOS.find((d) => d.id === c.estudioId)
      if (!def) continue
      const lista = grupos.get(c.anio) ?? []
      lista.push(def)
      grupos.set(c.anio, lista)
    }
    return [...grupos.entries()].sort((a, b) => b[0] - a[0])
  }, [estado.estudiosComprados, conDatos])

  if (cargando) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin text-pink-400" aria-label="Cargando estudios" />
        <p className="text-xs uppercase tracking-[0.3em]">Cargando estudios…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">🔬 Estudios de mercado</h2>
        <p className="mt-0.5 text-sm text-zinc-400">Espía al mercado: awareness, preferencias, distribución y secretos de la competencia.</p>
      </div>

      {conDatos.length === 0 && pendientes.length === 0 && (
        <div className="pacha-panel flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-5xl" aria-hidden="true">🔬</p>
          <p className="max-w-sm text-sm text-zinc-400">
            Aún no tienes datos. Compra estudios en <b className="text-zinc-200">Decisiones</b> y espera a que el
            profesor procese la ronda.
          </p>
        </div>
      )}

      {conDatos.length > 0 && (
        <Accordion
          type="single"
          collapsible
          defaultValue={ultimoAnio !== null ? String(ultimoAnio) : undefined}
          className="space-y-3"
        >
          {[...anios].reverse().map((anio) => (
            <AccordionItem
              key={anio}
              value={String(anio)}
              className="rounded-xl border border-white/10 bg-black/20 px-4"
            >
              <AccordionTrigger className="py-3 text-sm font-black text-zinc-100 hover:no-underline">
                📅 Resultados del Año {anio}
                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                  {conDatos.filter((e) => e.anio === anio).length} estudio(s)
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                {conDatos
                  .filter((e) => e.anio === anio)
                  .map((e) => (
                    <article key={`${e.anio}-${e.estudioId}`} className="pacha-panel p-4">
                      <header className="mb-3 flex flex-wrap items-start gap-2.5">
                        <span className="text-2xl leading-none" aria-hidden="true">
                          {e.def.icono}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-zinc-100">{e.def.nombre}</h4>
                          <p className="text-[11px] leading-snug text-zinc-500">{e.def.descripcion}</p>
                        </div>
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                          {fmtBs(e.def.costo)}
                        </span>
                      </header>
                      <CuerpoEstudio datos={e.datos} colorEquipo={estado.equipo.color} />
                    </article>
                  ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {pendientes.map(([anio, defs]) => (
        <div key={anio} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm font-bold text-zinc-300">⏳ Esperando que el profesor procese el Año {anio}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {defs.map((d) => (
              <span
                key={d.id}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-zinc-400"
              >
                <span aria-hidden="true">{d.icono}</span> {d.nombre}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
