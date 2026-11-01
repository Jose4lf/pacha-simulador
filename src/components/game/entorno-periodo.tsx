'use client'

// ============================================================
// PACHA Simulador · Entorno del periodo (docente)
// Vista previa de los eventos de Bolivia y de la inflación π_t antes
// de ejecutar la ronda (doc §15, §16, §18.10). El docente puede fijar
// el escenario económico, desactivar/ajustar eventos y ejecutar.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cabecerasSesion } from '@/lib/pacha/api-client'
import { Button } from '@/components/ui/button'

interface VistaEvento {
  id: string
  nombre: string
  categoria: string
  region: string
  meses: number[]
  efectoDemanda: number
  efectoCosto: number
  efectoLogistica: number
  canal: string | null
  origen: string
  activo: boolean
  traza: string
}

interface VistaPrevia {
  anio: number
  eventos: VistaEvento[]
  macro: {
    anio: number
    escenario: string
    escenarioOrigen: string
    deltaEscenario: number
    inflacionAnual: number
    factores: { factor: string; senal: number; aporte: number }[]
    aporteFactores: number
    tipoCambioInicio: number
    tipoCambioFinal: number
    tasaInteres: number
    indicePreciosInicio: number
    indicePreciosFin: number
    inflacionMensual: number[]
    ejecutado: boolean
  }
}

const CATEGORIA_EMOJI: Record<string, string> = {
  FESTIVO: '🎉', SOCIAL: '🥂', ECONOMICO: '📉', LOGISTICO: '🚧', CLIMATICO: '🌦️',
}

const ESCENARIOS: { id: string; nombre: string; emoji: string }[] = [
  { id: 'FAVORABLE', nombre: 'Favorable', emoji: '🌞' },
  { id: 'ESTABLE', nombre: 'Estable', emoji: '⚖️' },
  { id: 'DESFAVORABLE', nombre: 'Desfavorable', emoji: '🌧️' },
]

function pct(v: number): string {
  return `${(v * 100).toFixed(2).replace(/\.00$/, '')}%`
}

export function EntornoPeriodo({ industriaId }: { industriaId: string }) {
  const [vista, setVista] = useState<VistaPrevia | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [operando, setOperando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/profesor/preparar?industriaId=${industriaId}`, {
        cache: 'no-store',
        headers: cabecerasSesion(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar el entorno del periodo')
      setVista(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }, [industriaId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function fijarEscenario(escenario: string) {
    setOperando(true)
    try {
      const res = await fetch('/api/profesor/preparar', {
        method: 'POST',
        headers: cabecerasSesion(),
        body: JSON.stringify({ industriaId, escenario }),
      })
      const data = await res.json()
      if (res.ok) setVista(data)
    } finally {
      setOperando(false)
    }
  }

  async function alternarEvento(ev: VistaEvento) {
    setOperando(true)
    try {
      const res = await fetch('/api/profesor/eventos', {
        method: 'PATCH',
        headers: cabecerasSesion(),
        body: JSON.stringify({ eventoId: ev.id, activo: !ev.activo }),
      })
      if (res.ok) await cargar()
    } finally {
      setOperando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Preparando el entorno del periodo…
      </div>
    )
  }
  if (error || !vista) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error ?? 'Sin datos'}</div>
  }

  const m = vista.macro
  const eventosActivos = vista.eventos.filter((e) => e.activo)
  const positivos = eventosActivos.filter((e) => e.efectoDemanda > 0).length
  const negativos = eventosActivos.filter((e) => e.efectoDemanda < 0 || e.efectoCosto > 0.05).length

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4" aria-label={`Entorno del año ${vista.anio}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-sky-300">
          🇧🇴 Entorno nacional del Año {vista.anio} · Bolivia
        </h4>
        {m.ejecutado && (
          <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            periodo ejecutado (inmutable)
          </span>
        )}
      </div>

      {/* Escenario e inflación */}
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Escenario económico {m.escenarioOrigen === 'FIJADO_DOCENTE' ? '(fijado por ti)' : '(sorteado, semilla registrada)'}</p>
          <p className="mt-1 text-2xl font-black text-zinc-100">
            {ESCENARIOS.find((e) => e.id === m.escenario)?.emoji ?? '⚖️'} {ESCENARIOS.find((e) => e.id === m.escenario)?.nombre ?? m.escenario}
          </p>
          <dl className="mt-2 space-y-1 text-[11px] text-zinc-400">
            <div className="flex justify-between"><dt>Inflación del periodo πₜ</dt><dd className="font-bold text-amber-300">{pct(m.inflacionAnual)}</dd></div>
            <div className="flex justify-between"><dt>Aporte del escenario</dt><dd>{m.deltaEscenario >= 0 ? '+' : ''}{(m.deltaEscenario * 100).toFixed(2)} pp</dd></div>
            <div className="flex justify-between"><dt>Aporte de factores (traspaso 20%)</dt><dd>{m.aporteFactores >= 0 ? '+' : ''}{(m.aporteFactores * 100).toFixed(2)} pp</dd></div>
            <div className="flex justify-between"><dt>Índice de precios (base 100)</dt><dd>{m.indicePreciosFin.toFixed(1)}</dd></div>
            <div className="flex justify-between"><dt>Tipo de cambio Bs/US$</dt><dd>{m.tipoCambioInicio.toFixed(2)} → <b className="text-zinc-200">{m.tipoCambioFinal.toFixed(2)}</b></dd></div>
            <div className="flex justify-between"><dt>Tasa de interés anual</dt><dd>{pct(m.tasaInteres)}</dd></div>
          </dl>
          {!m.ejecutado && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ESCENARIOS.map((e) => (
                <Button
                  key={e.id}
                  type="button"
                  size="sm"
                  disabled={operando}
                  onClick={() => void fijarEscenario(e.id)}
                  className={`h-7 px-2 text-[10px] font-bold ${
                    m.escenario === e.id && m.escenarioOrigen === 'FIJADO_DOCENTE'
                      ? 'bg-sky-500 text-white hover:bg-sky-400'
                      : 'border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {e.emoji} {e.nombre}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Factores que modifican la inflación (doc §18.5)
          </p>
          {m.factores.length === 0 ? (
            <p className="mt-2 text-[11px] text-zinc-500">Ningún factor activo este periodo: πₜ se movió solo por el escenario.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {m.factores.map((f) => (
                <li key={f.factor} className="flex items-center justify-between text-[11px]">
                  <span className="capitalize text-zinc-300">{f.factor.replace('_', ' ')}</span>
                  <span className={`font-bold ${f.aporte >= 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                    señal {f.senal >= 0 ? '+' : ''}{f.senal.toFixed(2)} → {(f.aporte * 100).toFixed(2)} pp
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] leading-snug text-zinc-500">
            El efecto directo de los eventos sobre costos es temporal y regional; solo el 20% alimenta la inflación
            del <b>siguiente</b> periodo (sin doble conteo, doc §18.6).
          </p>
        </div>
      </div>

      {/* Eventos del periodo */}
      <div className="mt-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
          Eventos del periodo · {eventosActivos.length} activos ({positivos} de demanda ↑ · {negativos} adversos)
        </p>
        {vista.eventos.length === 0 ? (
          <p className="mt-2 text-[11px] text-zinc-500">Sin eventos activados para este periodo.</p>
        ) : (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-[#221a33] text-zinc-400">
                <tr>
                  <th className="px-2 py-1.5 font-bold">Evento</th>
                  <th className="px-2 py-1.5 font-bold">Región</th>
                  <th className="px-2 py-1.5 font-bold">Meses</th>
                  <th className="px-2 py-1.5 text-right font-bold">Demanda</th>
                  <th className="px-2 py-1.5 text-right font-bold">Costos</th>
                  <th className="px-2 py-1.5 text-right font-bold">Logística</th>
                  <th className="px-2 py-1.5 text-right font-bold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {vista.eventos.map((ev) => (
                  <tr key={ev.id} className={`border-t border-white/5 ${ev.activo ? '' : 'opacity-40'}`} title={ev.traza}>
                    <td className="px-2 py-1.5 font-semibold text-zinc-200">
                      {CATEGORIA_EMOJI[ev.categoria] ?? '•'} {ev.nombre}
                      {ev.canal === 'horeca' && <span className="ml-1 rounded bg-white/10 px-1 text-[9px] text-amber-300">HORECA</span>}
                      {ev.origen === 'PLAN_DOCENTE' && <span className="ml-1 rounded bg-white/10 px-1 text-[9px] text-sky-300">planificado</span>}
                      {ev.origen === 'PLAN_AUTO' && <span className="ml-1 rounded bg-white/10 px-1 text-[9px] text-sky-300">automático</span>}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-400">{ev.region === 'NACIONAL' ? 'Nacional' : ev.region.replace('_', ' ')}</td>
                    <td className="px-2 py-1.5 text-zinc-400">{ev.meses.join(', ')}</td>
                    <td className={`px-2 py-1.5 text-right font-bold ${ev.efectoDemanda >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {ev.efectoDemanda >= 0 ? '+' : ''}{(ev.efectoDemanda * 100).toFixed(0)}%
                    </td>
                    <td className={`px-2 py-1.5 text-right font-bold ${ev.efectoCosto >= 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                      {ev.efectoCosto >= 0 ? '+' : ''}{(ev.efectoCosto * 100).toFixed(0)}%
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-orange-300">
                      {ev.efectoLogistica > 0 ? `−${(ev.efectoLogistica * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {!m.ejecutado && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={operando}
                          onClick={() => void alternarEvento(ev)}
                          className="h-6 border-white/15 bg-white/5 px-2 text-[10px] font-bold text-zinc-200 hover:bg-white/10"
                        >
                          {ev.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
