'use client'

// ============================================================
// PACHA Simulador · Plan de eventos por año (docente)
// Los eventos ocurren DENTRO de la simulación de los estudiantes y
// OCURREN POR AÑOS: el docente puede fijar un evento para un año
// determinado. Reglas: de 1 a 3 eventos por año y sin repetir
// categoría dentro del mismo año. Los años sin plan se autocompletan.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Loader2, Plus, Wand2, X } from 'lucide-react'
import { cabecerasSesion } from '@/lib/pacha/api-client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PlanEvento {
  planId: string
  catalogoId: string
  nombre: string
  categoria: string
  region: string
  meses: number[]
  intensidad: number
  efectoDemanda: number
  efectoCosto: number
  efectoLogistica: number
  signo: string
  origen: string // DOCENTE | AUTO
}

interface PlanAnio {
  anio: number
  ejecutado: boolean
  eventos: PlanEvento[]
}

interface PlanVista {
  industriaId: string
  anioActual: number
  anioMaximo: number
  reglas: { eventosPorAnio: string; categoriasUnicasPorAnio: boolean; maximo: number; minimo: number }
  anios: PlanAnio[]
  catalogo: { id: string; nombre: string; categoria: string; region: string; signo: string; activo: boolean }[]
}

const CATEGORIA_EMOJI: Record<string, string> = {
  FESTIVO: '🎉', SOCIAL: '🥂', ECONOMICO: '📉', LOGISTICO: '🚧', CLIMATICO: '🌦️',
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function etiquetaMeses(meses: number[]): string {
  if (!meses.length) return '—'
  return meses.map((m) => MESES_CORTOS[m - 1] ?? m).join('·')
}

export function PlanEventos({ industriaId }: { industriaId: string }) {
  const [plan, setPlan] = useState<PlanVista | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [operando, setOperando] = useState(false)
  const [anioSel, setAnioSel] = useState<string>('')
  const [eventoSel, setEventoSel] = useState<string>('')
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/profesor/eventos?industriaId=${industriaId}`, {
        cache: 'no-store',
        headers: cabecerasSesion(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar el plan de eventos')
      setPlan(data)
      setError(null)
      setAnioSel((prev) => prev || String(data.anioActual ?? 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }, [industriaId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function accion(payload: Record<string, unknown>, exito?: string) {
    setOperando(true)
    setAviso(null)
    try {
      const res = await fetch('/api/profesor/eventos', {
        method: 'POST',
        headers: cabecerasSesion(),
        body: JSON.stringify({ industriaId, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo actualizar el plan')
      setPlan(data.plan)
      setEventoSel('')
      if (exito) setAviso(exito)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Error')
    } finally {
      setOperando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando el plan de eventos por año…
      </div>
    )
  }
  if (error || !plan) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error ?? 'Sin datos'}</div>
  }

  const anioNumero = Number(anioSel) || plan.anioActual
  const anioActivo = plan.anios.find((a) => a.anio === anioNumero)
  const eventosDelAnio = anioActivo?.eventos ?? []
  const categoriasOcupadas = new Set(eventosDelAnio.map((e) => e.categoria))
  const catalogoDisponible = plan.catalogo.filter(
    (c) => c.activo && !categoriasOcupadas.has(c.categoria) && !eventosDelAnio.some((e) => e.catalogoId === c.id)
  )
  const anioEditable = anioActivo ? !anioActivo.ejecutado && eventosDelAnio.length < plan.reglas.maximo : false
  const aniosVacios = plan.anios.filter((a) => !a.ejecutado && a.eventos.length === 0).length

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4" aria-label="Plan de eventos por año">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-violet-300">
          <CalendarClock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Plan de eventos por año
        </h4>
        <div className="flex items-center gap-2">
          {aniosVacios > 0 && (
            <Button
              type="button"
              size="sm"
              disabled={operando}
              onClick={() => void accion({ accion: 'autocompletar' }, `Autocompletados ${aniosVacios} año(s) vacíos`)}
              className="h-7 border-violet-400/30 bg-violet-400/10 px-2 text-[10px] font-bold text-violet-200 hover:bg-violet-400/20"
            >
              <Wand2 className="mr-1 h-3 w-3" aria-hidden="true" /> Autocompletar {aniosVacios} año(s) sin eventos
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-zinc-500">
        Los eventos ocurren dentro de esta simulación, en los años que tú fijes. Reglas: {plan.reglas.eventosPorAnio}.
        Años sin planificación → el sistema completa 1–3 eventos automáticamente (semilla registrada, editables).
      </p>

      {/*Selector: fijar un evento para un año determinado */}
      {!anioActivo?.ejecutado && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={anioSel} onValueChange={(v) => { setAnioSel(v); setEventoSel('') }}>
            <SelectTrigger size="sm" className="h-8 w-[110px] border-white/15 bg-white/5 text-[11px] text-zinc-200" aria-label="Año del plan">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#221a33] text-zinc-100">
              {plan.anios.map((a) => (
                <SelectItem key={a.anio} value={String(a.anio)} disabled={a.ejecutado}>
                  Año {a.anio}{a.ejecutado ? ' (ejecutado)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={eventoSel} onValueChange={setEventoSel}>
            <SelectTrigger size="sm" className="h-8 w-[250px] border-white/15 bg-white/5 text-[11px] text-zinc-200" aria-label="Evento del catálogo">
              <SelectValue placeholder="Evento del catálogo…" />
            </SelectTrigger>
            <SelectContent className="max-h-72 border-white/10 bg-[#221a33] text-zinc-100">
              {plan.catalogo.filter((c) => c.activo).map((c) => {
                const bloqueado = eventosDelAnio.some((e) => e.categoria === c.categoria || e.catalogoId === c.id)
                return (
                  <SelectItem key={c.id} value={c.id} disabled={bloqueado}>
                    {CATEGORIA_EMOJI[c.categoria] ?? '•'} {c.nombre}{bloqueado ? ' · ya usado este año' : ''}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            disabled={operando || !eventoSel || !anioEditable}
            onClick={() => void accion({ accion: 'asignar', anio: anioNumero, catalogoId: eventoSel }, `Evento fijado para el Año ${anioNumero}`)}
            className="h-8 bg-violet-500 px-3 text-[11px] font-black text-white hover:bg-violet-400"
          >
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Fijar en el Año {anioNumero}
          </Button>
          {eventosDelAnio.length >= plan.reglas.maximo && (
            <span className="text-[10px] font-bold text-amber-300">El Año {anioNumero} ya tiene 3 eventos (máximo).</span>
          )}
        </div>
      )}

      {aviso && (
        <p className={`mt-2 rounded-md border px-2 py-1 text-[11px] ${aviso.startsWith('Evento fijado') || aviso.startsWith('Autocompletados') || aviso.startsWith('Evento quitado') ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`} role="status">
          {aviso}
        </p>
      )}

      {/* Años del plan */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {plan.anios.map((a) => (
          <div
            key={a.anio}
            className={`rounded-lg border p-2 ${a.anio === plan.anioActual ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10 bg-black/30'} ${a.ejecutado ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-zinc-200">
                Año {a.anio}
                {a.anio === plan.anioActual && <span className="ml-1 rounded bg-amber-400/20 px-1 text-[9px] font-bold text-amber-300">en curso</span>}
                {a.ejecutado && <span className="ml-1 rounded bg-white/10 px-1 text-[9px] text-zinc-400">ejecutado</span>}
              </p>
              <span className="text-[9px] text-zinc-500">{a.eventos.length}/3 evento(s)</span>
            </div>
            {a.eventos.length === 0 ? (
              <p className="mt-1 text-[10px] italic text-zinc-500">
                {a.ejecutado ? 'Sin eventos planificados' : 'Sin plan → se autocompletará (1–3 eventos)'}
              </p>
            ) : (
              <ul className="mt-1 space-y-1">
                {a.eventos.map((ev) => (
                  <li key={ev.planId} className="flex items-start justify-between gap-1">
                    <span className="text-[10px] leading-snug text-zinc-300" title={`${ev.categoria} · región ${ev.region === 'NACIONAL' ? 'nacional' : ev.region.replace('_', ' ')} · ${etiquetaMeses(ev.meses)} · demanda ${ev.efectoDemanda >= 0 ? '+' : ''}${(ev.efectoDemanda * 100).toFixed(0)}% · costos +${(ev.efectoCosto * 100).toFixed(0)}%`}>
                      {CATEGORIA_EMOJI[ev.categoria] ?? '•'} <b className="text-zinc-200">{ev.nombre}</b>{' '}
                      <span className="text-zinc-500">({etiquetaMeses(ev.meses)})</span>
                      {ev.origen === 'AUTO' && <span className="ml-1 rounded bg-white/10 px-1 text-[8px] text-sky-300">auto</span>}
                    </span>
                    {!a.ejecutado && (
                      <button
                        type="button"
                        aria-label={`Quitar ${ev.nombre} del Año ${a.anio}`}
                        disabled={operando}
                        onClick={() => void accion({ accion: 'quitar', planId: ev.planId }, 'Evento quitado del plan')}
                        className="mt-0.5 shrink-0 text-zinc-500 hover:text-red-300"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
