'use client'

import { useState } from 'react'
import { CalendarDays, FlaskConical, Info, Loader2, Sparkles } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { api, type AlumnoEstado, type ProyectoEstado } from '@/lib/pacha/api-client'
import { ATRIBUTOS, presupuestoNormal, probabilidadExito } from '@/lib/pacha/catalogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + ' mil'
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')

const SLIDER_CLS =
  'py-1 [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-purple-400 [&_[data-slot=slider-thumb]]:border-purple-300 [&_[data-slot=slider-thumb]]:bg-zinc-100'

const ESTILO_BADGE: Record<string, string> = {
  EN_DESARROLLO: 'border-amber-400/40 bg-amber-400/15 text-amber-300',
  APROBADO: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
  FALLIDO: 'border-red-400/40 bg-red-400/15 text-red-300',
  APLICADO: 'border-zinc-400/30 bg-zinc-400/10 text-zinc-300',
}

const NOMBRE_BADGE: Record<string, string> = {
  EN_DESARROLLO: '🧪 En desarrollo',
  APROBADO: '✅ Aprobado',
  FALLIDO: '❌ Fallido',
  APLICADO: '🚀 Aplicado',
}

function colorProb(p: number): string {
  if (p < 0.4) return 'text-red-300'
  if (p < 0.7) return 'text-amber-300'
  return 'text-emerald-300'
}

function barraProb(p: number): string {
  if (p < 0.4) return 'bg-red-400'
  if (p < 0.7) return 'bg-amber-400'
  return 'bg-emerald-400'
}

/* ============ Tarjeta de proyecto ============ */

function TarjetaProyecto({ p }: { p: ProyectoEstado }) {
  const prob = p.probabilidad
  return (
    <div className="pacha-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-black leading-tight text-zinc-100">{p.nombre}</h3>
        <Badge className={`shrink-0 border text-[10px] ${ESTILO_BADGE[p.estado] ?? 'border-white/15 text-zinc-300'}`}>
          {NOMBRE_BADGE[p.estado] ?? p.estado}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
        <span>
          💵 Presupuesto: <b className="text-zinc-200">{fmtBs(p.presupuesto)}</b>
        </span>
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" aria-hidden="true" /> Año inicio: <b className="text-zinc-200">{p.anioInicio}</b>
        </span>
      </div>

      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">🎲 Probabilidad de éxito</span>
          <span className={`font-black ${colorProb(prob)}`}>{Math.round(prob * 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${barraProb(prob)}`} style={{ width: `${Math.round(prob * 100)}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {ATRIBUTOS.map((a, i) => {
          const v = p.atributos[i] ?? 0
          return (
            <div key={a.id} className="flex items-center gap-1.5">
              <span className="w-4 shrink-0 text-center text-[11px]" aria-hidden="true">
                {a.emoji}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-purple-400" style={{ width: `${v * 10}%` }} />
              </div>
              <span className="w-4 shrink-0 text-right text-[10px] font-black text-purple-300">{v}</span>
            </div>
          )
        })}
      </div>

      {p.estado === 'FALLIDO' && (
        <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 text-[11px] text-red-200">
          💡 Puedes reenviarlo con los mismos atributos y MÁS presupuesto.
        </p>
      )}
    </div>
  )
}

/* ============ Componente principal ============ */

export function AlumnoProyectos({
  estado,
  refresh,
}: {
  estado: AlumnoEstado
  refresh: () => Promise<void> | void
}) {
  const cfg = estado.config.id
  // Nuevo modelo: solo el GERENTE de la empresa registra proyectos de I+D
  const esRepresentante = estado.membresia?.esRepresentante ?? false
  const [nombre, setNombre] = useState('')
  const [atributos, setAtributos] = useState<number[]>([5, 5, 5, 5, 5, 5])
  const [presupuesto, setPresupuesto] = useState(cfg.presupuestoMin + 200)
  const [guardando, setGuardando] = useState(false)

  const prob = probabilidadExito(atributos, presupuesto)
  const normal = presupuestoNormal(atributos)
  const nombresUsados = estado.proyectos.length
  const proyectosEsteAnio = estado.proyectos.filter(
    (p) => p.anioInicio === estado.industria.anioActual && p.estado === 'EN_DESARROLLO'
  ).length

  function fijarAtributo(i: number, v: number) {
    setAtributos((prev) => {
      const copia = [...prev]
      copia[i] = Math.min(10, Math.max(1, Math.round(v)))
      return copia
    })
  }

  async function registrar() {
    if (!nombre.trim()) {
      toast({
        title: 'Falta el nombre',
        description: 'Ponle un nombre a tu proyecto antes de registrarlo.',
        variant: 'destructive',
      })
      return
    }
    setGuardando(true)
    try {
      await api.registrarProyecto(nombre.trim(), atributos, presupuesto)
      toast({
        title: '🧪 ¡Proyecto registrado!',
        description: `"${nombre.trim()}" entró en desarrollo con ${Math.round(prob * 100)}% de probabilidad. ¡Suerte en el laboratorio!`,
      })
      setNombre('')
      setAtributos([5, 5, 5, 5, 5, 5])
      setPresupuesto(cfg.presupuestoMin + 200)
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo registrar el proyecto', description: msg(e), variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">🧪 Laboratorio de I+D</h2>
        <p className="mt-0.5 text-sm text-zinc-400">
          Diseña helados del futuro: define sus atributos, invierte en desarrollo y lánzalos al mercado.
        </p>
      </div>

      {estado.proyectos.length > 0 ? (
        <section aria-label="Proyectos" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {estado.proyectos.map((p) => (
            <TarjetaProyecto key={p.id} p={p} />
          ))}
        </section>
      ) : (
        <div className="pacha-panel flex min-h-[140px] flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-4xl" aria-hidden="true">⚗️</p>
          <p className="text-sm text-zinc-400">Todavía no registras proyectos. ¡Estrena el laboratorio abajo! 👇</p>
        </div>
      )}

      {/* Formulario de registro (solo el GERENTE) */}
      {esRepresentante ? (
      <section
        aria-label="Registrar proyecto"
        className="rounded-2xl border-2 border-purple-400/40 bg-purple-400/5 p-4 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-black text-purple-200">
            <FlaskConical className="h-4 w-4" aria-hidden="true" /> Registrar nuevo proyecto
          </h3>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-zinc-300">
              🏷️ Nombres usados: {nombresUsados}/{cfg.maxNombresPorSimulacion}
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-zinc-300">
              📅 Proyectos este año: {proyectosEsteAnio}/{cfg.maxProyectosPorAnio}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="proy-nombre" className="text-xs font-semibold text-zinc-300">
                🏷️ Nombre del proyecto
              </Label>
              <Input
                id="proy-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Helado Premium Andino"
                maxLength={24}
                className="h-11 border-white/10 bg-black/30 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {ATRIBUTOS.map((a, i) => (
                <div key={a.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`proy-attr-${a.id}`} className="text-xs font-semibold text-zinc-300">
                      {a.emoji} {a.nombre}
                    </Label>
                    <span className="text-xs font-black text-purple-300">{atributos[i] ?? 5}</span>
                  </div>
                  <Slider
                    id={`proy-attr-${a.id}`}
                    value={[atributos[i] ?? 5]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={(v) => fijarAtributo(i, v[0] ?? 5)}
                    aria-label={`${a.nombre} (1 a 10)`}
                    className={SLIDER_CLS}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="proy-presupuesto" className="text-xs font-semibold text-zinc-300">
                  💵 Presupuesto de I+D (miles Bs)
                </Label>
                <span className="text-xs font-black text-amber-300">{fmtBs(presupuesto)}</span>
              </div>
              <Slider
                id="proy-presupuesto"
                value={[presupuesto]}
                min={cfg.presupuestoMin}
                max={cfg.presupuestoMax}
                step={25}
                onValueChange={(v) => setPresupuesto(v[0] ?? cfg.presupuestoMin)}
                aria-label="Presupuesto del proyecto en miles de bolivianos"
                className="[&_[data-slot=slider-range]]:bg-amber-400 [&_[data-slot=slider-thumb]]:border-amber-300 [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-thumb]]:bg-zinc-100"
              />
            </div>
          </div>

          {/* Feedback en vivo */}
          <aside className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/30 p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" /> Predicción del laboratorio
            </h4>
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[11px] text-zinc-500">Probabilidad de éxito</span>
                <span className={`text-2xl font-black ${colorProb(prob)}`}>{Math.round(prob * 100)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${barraProb(prob)}`}
                  style={{ width: `${Math.round(prob * 100)}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">
              Presupuesto normal del proyecto: <b className="text-amber-300">{fmtBs(normal)}</b>
            </p>
            <p className="text-[11px] leading-snug text-zinc-500">
              {presupuesto >= normal
                ? '💸 Inversión sólida: el laboratorio trabaja con holgura.'
                : '🪙 Presupuesto ajustado: menos dinero, más riesgo de fracaso.'}
            </p>

            <Button
              type="button"
              onClick={() => void registrar()}
              disabled={guardando}
              className="pacha-btn-game mt-auto h-12 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-base font-black uppercase tracking-wide text-white hover:from-purple-400 hover:to-pink-400"
            >
              {guardando ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                '🧪 Registrar proyecto'
              )}
            </Button>
          </aside>
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          <li className="flex items-center gap-1">
            <Info className="h-3 w-3" aria-hidden="true" /> Máximo {cfg.maxProyectosPorAnio} proyectos por año
          </li>
          <li>· {cfg.maxNombresPorSimulacion} nombres por simulación</li>
          <li>
            · Presupuesto {cfg.presupuestoMin}-{cfg.presupuestoMax} miles de Bs
          </li>
          <li>· Los aprobados se aplican al año siguiente en Decisiones</li>
        </ul>
      </section>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center">
          <p className="text-2xl" aria-hidden="true">👁️</p>
          <p className="mt-1 text-xs font-bold text-amber-200">Modo consulta: solo el GERENTE de la empresa registra proyectos de I+D</p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Los proyectos del equipo se revisan en el <b>Grupo</b>; si uno se aprueba, el GERENTE puede lanzar la marca nueva desde Decisiones → Investigación y Desarrollo.
          </p>
        </div>
      )}
    </div>
  )
}
