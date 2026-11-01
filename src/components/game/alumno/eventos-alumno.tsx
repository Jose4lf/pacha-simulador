'use client'

// ============================================================
// PACHA Simulador · Eventos del alumno (doc §15)
// Los eventos que ocurren DENTRO de la simulación del estudiante,
// por año, con sus propiedades: categoría, región, meses y efectos
// sobre demanda, costos y logística.
// ============================================================

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react'
import type { AlumnoEstado, EventoAlumno } from '@/lib/pacha/api-client'

const CATEGORIA: Record<string, { emoji: string; nombre: string }> = {
  FESTIVO: { emoji: '🎉', nombre: 'Festivo' },
  SOCIAL: { emoji: '🥂', nombre: 'Social' },
  ECONOMICO: { emoji: '📉', nombre: 'Económico' },
  LOGISTICO: { emoji: '🚧', nombre: 'Logístico' },
  CLIMATICO: { emoji: '🌦️', nombre: 'Climático' },
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const ETIQUETA_ORIGEN: Record<string, string> = {
  PLAN_DOCENTE: 'planificado por el docente',
  PLAN_AUTO: 'automático (año sin plan)',
  EXTRAORDINARIO: 'extraordinario sorteado',
}

function etiquetaMeses(meses: number[]): string {
  if (!meses.length) return '—'
  return meses.map((m) => MESES[m - 1] ?? m).join(' · ')
}

function efecto(v: number, sufijo = ''): string {
  if (v === 0) return '0%'
  return `${v > 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%${sufijo}`
}

function TarjetaEvento({ ev, enCurso }: { ev: EventoAlumno; enCurso: boolean }) {
  const cat = CATEGORIA[ev.categoria] ?? { emoji: '•', nombre: ev.categoria }
  return (
    <div
      className={`rounded-xl border p-3 ${
        enCurso ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10 bg-black/20'
      } ${ev.activo ? '' : 'opacity-50'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xl" aria-hidden="true">{cat.emoji}</span>
        <h4 className="text-sm font-black text-zinc-100">{ev.nombre}</h4>
        {enCurso && (
          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">año en curso</span>
        )}
        {!ev.activo && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400">desactivado por el docente</span>}
        <span className="ml-auto rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-zinc-300">
          {cat.emoji} {cat.nombre}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-5">
        <div className="rounded-lg bg-black/30 px-2 py-1">
          <dt className="text-[9px] uppercase tracking-wide text-zinc-500">Región</dt>
          <dd className="font-bold text-zinc-100">{ev.region === 'NACIONAL' ? 'Nacional' : ev.region.replace('_', ' ')}</dd>
        </div>
        <div className="rounded-lg bg-black/30 px-2 py-1">
          <dt className="text-[9px] uppercase tracking-wide text-zinc-500">Meses</dt>
          <dd className="font-bold text-zinc-100">{etiquetaMeses(ev.meses)}</dd>
        </div>
        <div className="rounded-lg bg-black/30 px-2 py-1">
          <dt className="text-[9px] uppercase tracking-wide text-zinc-500">Demanda</dt>
          <dd className={`font-bold ${ev.efectoDemanda > 0 ? 'text-emerald-300' : ev.efectoDemanda < 0 ? 'text-red-300' : 'text-zinc-300'}`}>
            {efecto(ev.efectoDemanda)}
          </dd>
        </div>
        <div className="rounded-lg bg-black/30 px-2 py-1">
          <dt className="text-[9px] uppercase tracking-wide text-zinc-500">Costos</dt>
          <dd className={`font-bold ${ev.efectoCosto > 0 ? 'text-red-300' : ev.efectoCosto < 0 ? 'text-emerald-300' : 'text-zinc-300'}`}>
            {efecto(ev.efectoCosto)}
          </dd>
        </div>
        <div className="rounded-lg bg-black/30 px-2 py-1">
          <dt className="text-[9px] uppercase tracking-wide text-zinc-500">Logística</dt>
          <dd className="font-bold text-orange-300">{ev.efectoLogistica > 0 ? `−${Math.round(ev.efectoLogistica * 100)}%` : '—'}</dd>
        </div>
      </dl>
      <p className="mt-1.5 text-[10px] text-zinc-500">
        {ev.canal === 'horeca' && '🍺 Afecta al canal HORECA · '}
        {ETIQUETA_ORIGEN[ev.origen] ?? ev.origen}
      </p>
    </div>
  )
}

export function AlumnoEventos({ estado }: { estado: AlumnoEstado }) {
  const anio = estado.industria.anioActual
  const [abiertos, setAbiertos] = useState<Record<number, boolean>>({})

  const porAnio = useMemo(() => {
    const mapa = new Map<number, EventoAlumno[]>()
    for (const ev of estado.eventos) {
      const lista = mapa.get(ev.anio) ?? []
      lista.push(ev)
      mapa.set(ev.anio, lista)
    }
    return [...mapa.entries()].sort((a, b) => b[0] - a[0])
  }, [estado.eventos])

  const delAnioActual = porAnio.find(([a]) => a === anio)?.[1] ?? []
  const historicos = porAnio.filter(([a]) => a !== anio)

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">
          <CalendarDays className="mr-1 inline h-5 w-5 text-amber-300" aria-hidden="true" /> Eventos de tu simulación
        </h2>
        <p className="mt-0.5 text-sm text-zinc-400">
          Estos eventos ocurren <b>dentro de tu simulación</b> y mueven la demanda, los costos y la logística de tu
          empresa en los meses indicados. El docente los fija por año (de 1 a 3 por año, sin repetir categoría).
        </p>
      </div>

      {/* Año en curso */}
      <section aria-label={`Eventos del Año ${anio}`} className="pacha-panel p-4">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-amber-200">
          📅 Año {anio} (en curso) · {delAnioActual.filter((e) => e.activo).length} evento(s) activo(s)
        </h3>
        {delAnioActual.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-400">
            El docente todavía no preparó el entorno del Año {anio}. Cuando lo prepare, sus eventos aparecerán aquí
            con todos sus efectos.
          </p>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {delAnioActual.map((ev) => (
              <TarjetaEvento key={ev.nombre + ev.anio} ev={ev} enCurso />
            ))}
          </div>
        )}
      </section>

      {/* Años anteriores */}
      {historicos.length > 0 && (
        <section aria-label="Eventos de años anteriores" className="pacha-panel p-4">
          <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-zinc-300">🕘 Años anteriores</h3>
          <div className="space-y-2">
            {historicos.map(([anioGrupo, evs]) => {
              const abierto = abiertos[anioGrupo] ?? false
              return (
                <div key={anioGrupo} className="rounded-xl border border-white/10 bg-black/20">
                  <button
                    type="button"
                    onClick={() => setAbiertos((p) => ({ ...p, [anioGrupo]: !abierto }))}
                    aria-expanded={abierto}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  >
                    {abierto ? (
                      <ChevronDown className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                    )}
                    <span className="text-xs font-black text-zinc-200">Año {anioGrupo}</span>
                    <span className="text-[10px] text-zinc-500">
                      {evs.filter((e) => e.activo).length} evento(s): {evs.map((e) => e.nombre).join(', ')}
                    </span>
                  </button>
                  {abierto && (
                    <div className="grid gap-2 px-3 pb-3 lg:grid-cols-2">
                      {evs.map((ev) => (
                        <TarjetaEvento key={ev.nombre} ev={ev} enCurso={false} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
