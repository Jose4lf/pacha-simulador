'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Lock, Plus, Rocket, Send, ShieldCheck, X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  api,
  type AlumnoEstado,
  type DecisionContenidoPayload,
  type DecisionMarcaPayload,
  type DecisionNuevaPayload,
  type MarcaEstado,
  type ProyectoEstado,
} from '@/lib/pacha/api-client'
import { CANALES } from '@/lib/pacha/catalogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/** Cifras completas en la decisión: "Bs 2.525 mil" (sin abreviar a 2.5k). */
const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + ' mil'
const fmtU = (v: number) => v.toLocaleString('es-BO', { maximumFractionDigits: 1 }) + ' mil u'
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')

const SLIDER_CLS =
  'py-1 [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-pink-500 [&_[data-slot=slider-thumb]]:border-pink-400 [&_[data-slot=slider-thumb]]:bg-zinc-100'

const RANGO_PRECIO = { min: 1, max: 60, step: 0.5 } as const
const RANGO_PUBLICIDAD = { min: 0, max: 2000, step: 25 } as const
const RANGO_PRODUCCION = { min: 0, max: 5000, step: 25 } as const
const MAX_VENDEDORES = [60, 40, 24] // Tiendas · Supermercados · Kioscos

const AYUDA_PRECIO = 'Ideal de segmentos: Niños 5 · Familias 6.5 · Adolescentes 7 · Jóvenes 9 · Adultos 14'
const AYUDA_PUBLICIDAD = 'Más publicidad = más conocimiento de marca (awareness), con retornos decrecientes'
const AYUDA_PRODUCCION = 'Si te quedas corto, pierdes ventas por quiebre de stock'

function normalizarVendedores(v: number[] | undefined): number[] {
  return CANALES.map((_, i) => Math.max(0, Math.round(v?.[i] ?? 0)))
}

function fuerzaVentas(v: number[]): number {
  return CANALES.reduce((s, c, i) => s + (v[i] ?? 0) * c.salario, 0)
}

function cobertura(v: number, i: number): number {
  return Math.min(100, (v / CANALES[i].vendedoresNecesarios) * 100)
}

/** Estado local de edición: valores vigentes de las marcas + lo que el gerente
 *  ya envió (si la decisión está ENVIADA puede corregir y reenviar). */
function construirDecision(estado: AlumnoEstado): DecisionContenidoPayload {
  const marcas = estado.marcas.map((m) => ({
    marcaId: m.id,
    precio: m.precio,
    publicidad: m.publicidad,
    produccion: m.produccion,
    vendedores: normalizarVendedores(m.vendedores),
  }))

  const c = estado.decision?.contenido
  if (c) {
    if (Array.isArray(c.marcas)) {
      for (const p of c.marcas) {
        const m = marcas.find((x) => x.marcaId === p.marcaId)
        if (!m) continue
        m.precio = p.precio
        m.publicidad = p.publicidad
        m.produccion = p.produccion
        if (Array.isArray(p.vendedores)) m.vendedores = normalizarVendedores(p.vendedores)
      }
    }
    const nuevas = (Array.isArray(c.nuevas) ? c.nuevas : []).map((n) => ({ ...n, vendedores: normalizarVendedores(n.vendedores) }))
    return { marcas, nuevas, estudios: [...(Array.isArray(c.estudios) ? c.estudios : [])], inversionCapacidad: c.inversionCapacidad }
  }

  return { marcas, nuevas: [], estudios: [] }
}

/* ============ Control slider + input numérico ============ */

interface SliderControlProps {
  id: string
  label: string
  ayuda?: string
  min: number
  max: number
  step: number
  value: number
  onCambio: (v: number) => void
  disabled?: boolean
  acento?: string
}

function SliderControl({ id, label, ayuda, min, max, step, value, onCambio, disabled, acento }: SliderControlProps) {
  const [texto, setTexto] = useState<string | null>(null)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-semibold text-zinc-300">
          {label}
        </Label>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={texto ?? String(value)}
          disabled={disabled}
          onFocus={() => setTexto(String(value))}
          onBlur={() => setTexto(null)}
          onChange={(e) => {
            setTexto(e.target.value)
            const n = Number(e.target.value)
            if (e.target.value.trim() !== '' && !Number.isNaN(n)) {
              onCambio(Math.min(max, Math.max(min, n)))
            }
          }}
          aria-label={label}
          className="h-8 w-20 border-white/10 bg-black/30 text-right text-xs font-bold text-zinc-100"
        />
      </div>
      <Slider
        value={[Math.min(max, Math.max(min, value))]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onCambio(v[0] ?? min)}
        aria-label={label}
        className={`${SLIDER_CLS} ${acento ?? ''}`}
      />
      {ayuda && <p className="text-[10px] leading-tight text-zinc-500">{ayuda}</p>}
    </div>
  )
}

/* ============ Fuerza de ventas por canal ============ */

function VendedoresControl({
  idBase,
  vendedores,
  onCambio,
  disabled,
  acento,
}: {
  idBase: string
  vendedores: number[]
  onCambio: (v: number[]) => void
  disabled?: boolean
  acento?: string
}) {
  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
      {CANALES.map((c, i) => (
        <div key={c.id}>
          <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px]">
            <Label htmlFor={`${idBase}-${c.id}`} className="font-semibold text-zinc-300">
              {c.emoji} {c.nombre}
            </Label>
            <span className="shrink-0 text-zinc-500">
              cobertura ~<b className="text-zinc-300">{Math.round(cobertura(vendedores[i] ?? 0, i))}%</b>
            </span>
          </div>
          <Slider
            value={[Math.min(MAX_VENDEDORES[i], vendedores[i] ?? 0)]}
            min={0}
            max={MAX_VENDEDORES[i]}
            step={1}
            disabled={disabled}
            onValueChange={(val) => {
              const copia = [...vendedores]
              copia[i] = val[0] ?? 0
              onCambio(copia)
            }}
            aria-label={`Vendedores en ${c.nombre}`}
            className={`${SLIDER_CLS} ${acento ?? ''}`}
          />
        </div>
      ))}
      <p className="text-[11px] font-bold text-amber-300">💰 Fuerza de ventas: {fmtBs(fuerzaVentas(vendedores))}/año</p>
    </div>
  )
}

/* ============ Tarjeta de área de la decisión ============ */

function AreaCard({
  cargo,
  children,
}: {
  cargo: { id: string; nombre: string; emoji: string; descripcion: string }
  children: React.ReactNode
}) {
  return (
    <section aria-label={`Área ${cargo.nombre}`} className="pacha-panel p-4 sm:p-5">
      <div className="mb-3 border-b border-white/10 pb-3">
        <h3 className="flex items-center gap-2 text-base font-black text-zinc-100">
          <span className="text-xl" aria-hidden="true">{cargo.emoji}</span>
          {cargo.nombre}
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">{cargo.descripcion}</p>
      </div>
      {children}
    </section>
  )
}

/* ============ Vista principal ============ */

export function AlumnoDecisiones({
  estado,
  refresh,
}: {
  estado: AlumnoEstado
  refresh: () => Promise<void> | void
}) {
  const anio = estado.industria.anioActual
  const decisionEstado = estado.decision?.estado ?? null
  /** Solo se congela con el visto bueno; si está ENVIADA el gerente puede corregir y reenviar. */
  const bloqueada = decisionEstado === 'APROBADA'
  const yaEnviada = decisionEstado === 'ENVIADA'

  // Nuevo modelo: la empresa juega con UN solo jugador (el GERENTE). Si existiera
  // otro integrante, vería todo en modo consulta; el GERENTE edita y envía.
  const esRepresentante = estado.membresia?.esRepresentante ?? false
  const modoConsulta = !esRepresentante && !bloqueada

  // Decisión local; se reconstruye si cambia el año o el estado de la decisión.
  const claveDecision = `${anio}:${decisionEstado ?? 'sin-decision'}`
  const [claveMontada, setClaveMontada] = useState(claveDecision)
  const [contenido, setContenido] = useState<DecisionContenidoPayload>(() => construirDecision(estado))
  if (claveDecision !== claveMontada) {
    setClaveMontada(claveDecision)
    setContenido(construirDecision(estado))
  }

  const [enviandoFinal, setEnviandoFinal] = useState(false)

  const cargos = estado.cargos

  const aprobados = useMemo(
    () => estado.proyectos.filter((p) => p.estado === 'APROBADO'),
    [estado.proyectos]
  )
  const comprasEsteAnio = useMemo(
    () => estado.estudiosComprados.filter((c) => c.anio === anio),
    [estado.estudiosComprados, anio]
  )

  const inversion = useMemo(() => {
    const publicidad =
      contenido.marcas.reduce((s, m) => s + m.publicidad, 0) + contenido.nuevas.reduce((s, n) => s + n.publicidad, 0)
    const fuerza = [...contenido.marcas, ...contenido.nuevas].reduce((s, m) => s + fuerzaVentas(m.vendedores), 0)
    const estudios = contenido.estudios.reduce(
      (s, id) => s + (estado.config.catalogoEstudios.find((e) => e.id === id)?.costo ?? 0),
      0
    )
    return publicidad + fuerza + estudios
  }, [contenido, estado.config.catalogoEstudios])

  const totalEstudiosSel = contenido.estudios.reduce(
    (s, id) => s + (estado.config.catalogoEstudios.find((e) => e.id === id)?.costo ?? 0),
    0
  )

  function actualizarMarca(marcaId: string, cambios: Partial<DecisionMarcaPayload>) {
    setContenido((c) => ({
      ...c,
      marcas: c.marcas.map((m) => (m.marcaId === marcaId ? { ...m, ...cambios } : m)),
    }))
  }

  function actualizarNueva(idx: number, cambios: Partial<DecisionNuevaPayload>) {
    setContenido((c) => ({
      ...c,
      nuevas: c.nuevas.map((n, i) => (i === idx ? { ...n, ...cambios } : n)),
    }))
  }

  function anadirNueva() {
    setContenido((c) => ({
      ...c,
      nuevas: [
        ...c.nuevas,
        { nombre: '', proyectoId: '', precio: 8, publicidad: 200, produccion: 300, vendedores: [10, 5, 3] },
      ],
    }))
  }

  function quitarNueva(idx: number) {
    setContenido((c) => ({ ...c, nuevas: c.nuevas.filter((_, i) => i !== idx) }))
  }

  function toggleEstudio(id: number) {
    setContenido((c) => ({
      ...c,
      estudios: c.estudios.includes(id) ? c.estudios.filter((e) => e !== id) : [...c.estudios, id],
    }))
  }

  const [inversionCapacidad, setInversionCapacidad] = useState(estado.decision?.contenido?.inversionCapacidad ?? 0)
  /** Texto visible del input de inversión: SOLO dígitos (nunca letras ni símbolos). */
  const [textoInversion, setTextoInversion] = useState(String(estado.decision?.contenido?.inversionCapacidad ?? 0))

  /** ENVÍO DIRECTO: toda la decisión del año viaja completa en un solo envío. */
  async function enviarFinal() {
    setEnviandoFinal(true)
    try {
      await api.enviarDecision({
        marcas: contenido.marcas.map((m) => ({
          marcaId: m.marcaId,
          precio: m.precio,
          publicidad: m.publicidad,
          produccion: m.produccion,
          vendedores: m.vendedores,
        })),
        nuevas: contenido.nuevas,
        estudios: contenido.estudios,
        inversionCapacidad: inversionCapacidad > 0 ? inversionCapacidad : undefined,
      })
      toast({
        title: '🚀 ¡Decisión del año enviada!',
        description: `Año ${anio} enviado al docente con TODAS las áreas. Esperando el visto bueno; puedes corregir y reenviar hasta que lo apruebe.`,
      })
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo enviar', description: msg(e), variant: 'destructive' })
    } finally {
      setEnviandoFinal(false)
    }
  }

  /* ---------- Vista SOLO LECTURA (decisión con visto bueno) ---------- */
  if (bloqueada) {
    const c = estado.decision?.contenido
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200"
        >
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          {`✅ Visto bueno del docente para el Año ${anio} — cuando corra la simulación verán los reportes`}
        </div>

        <p className="text-xs text-zinc-500">
          Estos son los valores congelados para esta ronda. Podrás decidir de nuevo cuando avance el año.
        </p>

        <div className="grid gap-4 xl:grid-cols-2">
          {estado.marcas.map((m) => {
            const v = c?.marcas.find((x) => x.marcaId === m.id)
            return (
              <div key={m.id} className="pacha-panel p-4 opacity-90">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black text-zinc-100">🍨 {m.nombre}</h3>
                  <Badge variant="outline" className="border-white/15 text-zinc-400">
                    Año lanz. {m.anioLanzamiento}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Precio</dt>
                    <dd className="font-bold text-zinc-100">Bs {(v?.precio ?? m.precio).toLocaleString('es-BO')}</dd>
                  </div>
                  <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Publicidad</dt>
                    <dd className="font-bold text-zinc-100">{fmtBs(v?.publicidad ?? m.publicidad)}</dd>
                  </div>
                  <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Producción</dt>
                    <dd className="font-bold text-zinc-100">{fmtU(v?.produccion ?? m.produccion)}</dd>
                  </div>
                  <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Vendedores (Tiendas · Supermercados · Kioscos)</dt>
                    <dd className="font-bold text-zinc-100">
                      {normalizarVendedores(v?.vendedores ?? m.vendedores).join(' · ')}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Fuerza de ventas</dt>
                    <dd className="font-bold text-amber-300">{fmtBs(fuerzaVentas(v?.vendedores ?? m.vendedores))}</dd>
                  </div>
                  <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Conocimiento de marca (awareness)</dt>
                    <dd className="font-bold text-pink-300">{Math.round(m.awareness * 100)}%</dd>
                  </div>
                </dl>
              </div>
            )
          })}

          {(c?.nuevas ?? []).map((n, i) => (
            <div key={`${n.proyectoId}-${i}`} className="rounded-2xl border-2 border-dashed border-purple-400/40 bg-purple-400/5 p-4 opacity-90">
              <h3 className="text-base font-black text-purple-200">🌟 {n.nombre || 'Marca nueva'}</h3>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Precio</dt>
                  <dd className="font-bold text-zinc-100">Bs {n.precio.toLocaleString('es-BO')}</dd>
                </div>
                <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Publicidad</dt>
                  <dd className="font-bold text-zinc-100">{fmtBs(n.publicidad)}</dd>
                </div>
                <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Producción</dt>
                  <dd className="font-bold text-zinc-100">{fmtU(n.produccion)}</dd>
                </div>
                <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Vendedores (Tiendas · Supermercados · Kioscos)</dt>
                  <dd className="font-bold text-zinc-100">{normalizarVendedores(n.vendedores).join(' · ')}</dd>
                </div>
                <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Fuerza de ventas</dt>
                  <dd className="font-bold text-amber-300">{fmtBs(fuerzaVentas(n.vendedores))}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <div className="pacha-panel p-4">
          <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-zinc-300">
            🛒 Estudios comprados este año
          </h3>
          {(c?.estudios ?? []).length === 0 ? (
            <p className="text-xs text-zinc-500">Sin estudios este año.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(c?.estudios ?? []).map((id) => {
                const est = estado.config.catalogoEstudios.find((e) => e.id === id)
                if (!est) return null
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200"
                  >
                    <span aria-hidden="true">{est.icono}</span> {est.nombre}
                    <span className="text-[10px] text-emerald-400/80">· {fmtBs(est.costo)}</span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ---------- Vista editable (por áreas de la decisión) ---------- */
  const tarjetas = (
    <>
      {/* 💰 ÁREA PRECIOS */}
      <AreaCard
        cargo={cargos.find((c) => c.id === 'precios')!}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {estado.marcas.map((m) => {
            const v = contenido.marcas.find((x) => x.marcaId === m.id)
            if (!v) return null
            return (
              <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-black text-zinc-100">🍨 {m.nombre}</h4>
                  <span className="ml-auto text-[11px] text-zinc-500">
                    ⚙️ Costo unitario: <b className="text-zinc-300">Bs {m.costoUnitario.toFixed(2)}</b>
                  </span>
                </div>
                <SliderControl
                  id={`precio-${m.id}`}
                  label="💰 Precio (Bs/unidad)"
                  ayuda={AYUDA_PRECIO}
                  min={RANGO_PRECIO.min}
                  max={RANGO_PRECIO.max}
                  step={RANGO_PRECIO.step}
                  value={v.precio}
                  onCambio={(nv) => actualizarMarca(m.id, { precio: nv })}
                />
              </div>
            )
          })}
        </div>
      </AreaCard>

      {/* 📺 ÁREA PUBLICIDAD */}
      <AreaCard
        cargo={cargos.find((c) => c.id === 'publicidad')!}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {estado.marcas.map((m) => {
            const v = contenido.marcas.find((x) => x.marcaId === m.id)
            if (!v) return null
            const awareness = Math.round(m.awareness * 100)
            return (
              <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-zinc-100">🍨 {m.nombre}</h4>
                  <span className="text-[11px] text-zinc-500">
                    📣 Conocimiento de marca (awareness) actual: <b className="text-pink-300">{awareness}%</b>
                  </span>
                </div>
                <SliderControl
                  id={`publicidad-${m.id}`}
                  label="📺 Publicidad (miles Bs)"
                  ayuda={AYUDA_PUBLICIDAD}
                  min={RANGO_PUBLICIDAD.min}
                  max={RANGO_PUBLICIDAD.max}
                  step={RANGO_PUBLICIDAD.step}
                  value={v.publicidad}
                  onCambio={(nv) => actualizarMarca(m.id, { publicidad: nv })}
                />
              </div>
            )
          })}
        </div>
      </AreaCard>

      {/* 🏭 ÁREA PRODUCCIÓN */}
      <AreaCard
        cargo={cargos.find((c) => c.id === 'produccion')!}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {estado.marcas.map((m) => {
            const v = contenido.marcas.find((x) => x.marcaId === m.id)
            if (!v) return null
            return (
              <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-zinc-100">🍨 {m.nombre}</h4>
                  <span className="text-[11px] text-zinc-500">
                    📦 Inventario: <b className="text-zinc-300">{fmtU(m.inventario)}</b>
                  </span>
                </div>
                <SliderControl
                  id={`produccion-${m.id}`}
                  label="🏭 Producción (miles unidades)"
                  ayuda={AYUDA_PRODUCCION}
                  min={RANGO_PRODUCCION.min}
                  max={RANGO_PRODUCCION.max}
                  step={RANGO_PRODUCCION.step}
                  value={v.produccion}
                  onCambio={(nv) => actualizarMarca(m.id, { produccion: nv })}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3">
          <label htmlFor="inversion-capacidad" className="text-xs font-bold text-sky-200">
            🏗️ Inversión en capacidad (miles de litros nuevos)
          </label>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Amplía la planta (máximo 3.000k L). El costo se indexa por inflación y tipo de cambio:
            Bs 5 por litro en el Año 0, equipo mayormente importado (doc §5).
          </p>
          <input
            id="inversion-capacidad"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={textoInversion}
            onFocus={() => {
              if (textoInversion === '0') setTextoInversion('')
            }}
            onBlur={() => setTextoInversion(String(inversionCapacidad))}
            onChange={(e) => {
              // Filtra TODO lo que no sea dígito: la letra «d» de la captura ya no puede entrar
              const soloDigitos = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
              setTextoInversion(soloDigitos)
              setInversionCapacidad(Math.max(0, Math.min(2000, Number(soloDigitos || '0'))))
            }}
            className="mt-2 h-9 w-40 rounded-lg border border-white/15 bg-black/30 px-3 text-sm font-bold text-zinc-100"
          />
        </div>
      </AreaCard>

      {/* 🚚 ÁREA DISTRIBUCIÓN Y VENTAS */}
      <AreaCard
        cargo={cargos.find((c) => c.id === 'ventas')!}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {estado.marcas.map((m) => {
            const v = contenido.marcas.find((x) => x.marcaId === m.id)
            if (!v) return null
            return (
              <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <h4 className="mb-2 text-sm font-black text-zinc-100">🍨 {m.nombre}</h4>
                <VendedoresControl
                  idBase={`vend-${m.id}`}
                  vendedores={v.vendedores}
                  onCambio={(nv) => actualizarMarca(m.id, { vendedores: nv })}
                />
              </div>
            )
          })}
        </div>
      </AreaCard>

      {/* 🔬 ÁREA INVESTIGACIÓN Y DESARROLLO */}
      <AreaCard
        cargo={cargos.find((c) => c.id === 'investigacion')!}
      >
        <div className="space-y-4">
          {/* Estudios de mercado */}
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-black uppercase tracking-wider text-zinc-300">🛒 Estudios de mercado</h4>
              <p className="text-xs text-zinc-500">
                {contenido.estudios.length} seleccionado(s) · Total:{' '}
                <b className="text-amber-300">{fmtBs(totalEstudiosSel)}</b>
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {estado.config.catalogoEstudios.map((est) => {
                const comprado = comprasEsteAnio.some((c) => c.estudioId === est.id)
                const seleccionado = contenido.estudios.includes(est.id)
                return (
                  <div
                    key={est.id}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 transition-colors ${
                      comprado
                        ? 'border-emerald-400/30 bg-emerald-400/5'
                        : seleccionado
                          ? 'border-pink-400/40 bg-pink-400/10'
                          : 'border-white/10 bg-black/20'
                    }`}
                  >
                    <Checkbox
                      id={`est-${est.id}`}
                      checked={comprado || seleccionado}
                      disabled={comprado}
                      onCheckedChange={() => toggleEstudio(est.id)}
                      aria-label={`Comprar estudio ${est.nombre}`}
                      className="mt-0.5 data-[state=checked]:border-pink-500 data-[state=checked]:bg-pink-500 data-[state=checked]:text-white"
                    />
                    <span className="text-2xl leading-none" aria-hidden="true">
                      {est.icono}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <label
                          htmlFor={`est-${est.id}`}
                          className="cursor-pointer text-[13px] font-bold leading-snug text-zinc-100"
                        >
                          {est.nombre}
                        </label>
                        <span className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                          Bs {est.costo}k
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">{est.descripcion}</p>
                      {comprado && (
                        <Badge className="mt-1.5 bg-emerald-500/20 text-[10px] text-emerald-300 hover:bg-emerald-500/20">
                          Comprado ✓
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lanzamiento de marcas nuevas (I+D) */}
          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-purple-300">
              <Plus className="h-4 w-4" aria-hidden="true" /> Lanzar marca nueva (requiere I+D aprobado)
            </h4>
            <div className="space-y-3">
              {contenido.nuevas.map((n, idx) => (
                <TarjetaNueva
                  key={idx}
                  idx={idx}
                  valor={n}
                  aprobados={aprobados}
                  onChange={(cambios) => actualizarNueva(idx, cambios)}
                  onQuitar={() => quitarNueva(idx)}
                />
              ))}

              {aprobados.length > 0 ? (
                <Button
                  type="button"
                  onClick={anadirNueva}
                  className="h-11 w-full rounded-xl border-2 border-dashed border-purple-400/50 bg-purple-400/5 text-sm font-bold text-purple-200 hover:bg-purple-400/10 hover:text-purple-100 sm:w-auto sm:px-6"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Añadir marca nueva (I+D)
                </Button>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-zinc-400">
                  🔬 Necesitan un proyecto de I+D APROBADO para lanzar una marca nueva (pestaña I+D)
                </div>
              )}
            </div>
          </div>
        </div>
      </AreaCard>
    </>
  )

  /* ---------- Vista editable (el GERENTE decide y envía directo) ---------- */
  return (
    <div className="space-y-5 pb-4">
      <div>
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">
          🎯 Decisiones del Año <span className="pacha-title-shine">{anio}</span>
        </h2>
        {esRepresentante ? (
          <p className="mt-0.5 text-sm text-zinc-400">
            👑 Eres el <b className="text-amber-300">GERENTE</b> de la empresa (el único jugador): decide las 5 áreas
            y envía todo con el botón <b className="text-emerald-300">Enviar decisión del año</b> — sin borradores,
            en un solo envío directo al docente.
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-zinc-400">
            👁️ Modo consulta: solo el
            <b className="text-amber-300"> GERENTE</b>{' '}
            {estado.comite.find((g) => g.representante)?.nombre ?? 'de la empresa'} puede editarlas y enviarlas.
          </p>
        )}
      </div>

      {yaEnviada && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200"
        >
          <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
          {`Ya enviaste la decisión del Año ${anio} — el docente la está revisando. Puedes corregir cualquier valor y REENVIAR hasta que dé el visto bueno.`}
        </div>
      )}

      {tarjetas}

      {/* Barra sticky de inversión + envío directo (solo representante) */}
      <div className="sticky bottom-0 z-20 -mx-3 mt-2 border-t border-white/10 bg-[#140f1c]/90 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Inversión total estimada
            </p>
            <p className="text-xl font-black text-amber-300">{fmtBs(inversion)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!esRepresentante ? (
              <span className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-[11px] font-bold text-sky-300">
                👁️ Modo consulta: el GERENTE envía la decisión del año
              </span>
            ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  disabled={enviandoFinal}
                  className="pacha-btn-game h-11 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 font-black uppercase tracking-wide text-white hover:from-emerald-400 hover:to-teal-400"
                >
                  {enviandoFinal ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Rocket className="h-4 w-4" aria-hidden="true" />
                  )}
                  {yaEnviada ? '🔁 Reenviar decisión del año' : '🚀 Enviar decisión del año'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/10 bg-[#1c1528] text-zinc-100">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-zinc-100">
                    {yaEnviada ? `¿Reenviar la decisión del Año ${anio}?` : `¿Enviar la decisión del Año ${anio} al docente?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-zinc-400">
                      <p>
                        Se envía <b className="text-zinc-100">TODO</b> de una vez (sin borradores): precios,
                        publicidad, producción, fuerza de ventas, marcas nuevas, estudios e inversión en capacidad.
                        El docente verá el contenido completo y dará (o quitará) el visto bueno.
                      </p>
                      <ul className="space-y-1 text-xs">
                        <li>💰 {contenido.marcas.length} marca(s) con precio · 📺 publicidad total {fmtBs(contenido.marcas.reduce((s, m) => s + m.publicidad, 0))}</li>
                        <li>🏭 producción total {fmtU(contenido.marcas.reduce((s, m) => s + m.produccion, 0))}{inversionCapacidad > 0 ? ` · 🏗️ +${inversionCapacidad.toLocaleString('es-BO')} mil L de capacidad` : ''}</li>
                        <li>🚚 fuerza de ventas {fmtBs([...contenido.marcas, ...contenido.nuevas].reduce((s, m) => s + fuerzaVentas(m.vendedores), 0))}</li>
                        <li>🔬 {contenido.estudios.length} estudio(s) · 🌟 {contenido.nuevas.length} marca(s) nueva(s)</li>
                      </ul>
                      <p>
                        Inversión estimada: <b className="text-amber-300">{fmtBs(inversion)}</b>.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-zinc-100">
                    Seguir editando
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void enviarFinal()}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 font-black text-white hover:from-emerald-400 hover:to-teal-400"
                  >
                    🚀 Enviar al docente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============ Tarjeta de marca nueva (I+D) ============ */

function TarjetaNueva({
  idx,
  valor,
  aprobados,
  onChange,
  onQuitar,
}: {
  idx: number
  valor: DecisionNuevaPayload
  aprobados: ProyectoEstado[]
  onChange: (cambios: Partial<DecisionNuevaPayload>) => void
  onQuitar: () => void
}) {
  const acento = '[&_[data-slot=slider-range]]:bg-purple-400 [&_[data-slot=slider-thumb]]:border-purple-300'
  return (
    <div className="rounded-2xl border-2 border-dashed border-purple-400/50 bg-purple-400/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h5 className="text-sm font-black uppercase tracking-wide text-purple-300">🌟 Marca nueva (I+D)</h5>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onQuitar}
          aria-label="Quitar marca nueva"
          title="Quitar marca nueva"
          className="h-8 w-8 text-zinc-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`nueva-nombre-${idx}`} className="text-xs font-semibold text-zinc-300">
            🏷️ Nombre de la marca
          </Label>
          <Input
            id={`nueva-nombre-${idx}`}
            value={valor.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder="Ej: Andino Crunch"
            maxLength={24}
            className="h-9 border-white/10 bg-black/30 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`nueva-proy-${idx}`} className="text-xs font-semibold text-zinc-300">
            🧪 Proyecto aprobado
          </Label>
          <Select value={valor.proyectoId || undefined} onValueChange={(v) => onChange({ proyectoId: v })}>
            <SelectTrigger id={`nueva-proy-${idx}`} className="h-9 w-full border-white/10 bg-black/40 text-zinc-100">
              <SelectValue placeholder="Elige un proyecto" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#1c1528] text-zinc-100">
              {aprobados.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <SliderControl
          id={`nueva-precio-${idx}`}
          label="💰 Precio (Bs/unidad)"
          ayuda={AYUDA_PRECIO}
          min={RANGO_PRECIO.min}
          max={RANGO_PRECIO.max}
          step={RANGO_PRECIO.step}
          value={valor.precio}
          onCambio={(v) => onChange({ precio: v })}
          acento={acento}
        />
        <SliderControl
          id={`nueva-publicidad-${idx}`}
          label="📺 Publicidad (miles Bs)"
          ayuda={AYUDA_PUBLICIDAD}
          min={RANGO_PUBLICIDAD.min}
          max={RANGO_PUBLICIDAD.max}
          step={RANGO_PUBLICIDAD.step}
          value={valor.publicidad}
          onCambio={(v) => onChange({ publicidad: v })}
          acento={acento}
        />
        <SliderControl
          id={`nueva-produccion-${idx}`}
          label="🏭 Producción (miles unidades)"
          ayuda={AYUDA_PRODUCCION}
          min={RANGO_PRODUCCION.min}
          max={RANGO_PRODUCCION.max}
          step={RANGO_PRODUCCION.step}
          value={valor.produccion}
          onCambio={(v) => onChange({ produccion: v })}
          acento={acento}
        />
        <VendedoresControl
          idBase={`nueva-vend-${idx}`}
          vendedores={valor.vendedores}
          onCambio={(v) => onChange({ vendedores: v })}
          acento={acento}
        />
      </div>
    </div>
  )
}
