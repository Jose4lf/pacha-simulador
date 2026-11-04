'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, Gavel, Loader2, ShieldAlert, UserMinus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  api,
  type AlumnoEstado,
  type BorradorAreaFront,
  type CargoFront,
  type GerenteComite,
  type PenalizacionFront,
} from '@/lib/pacha/api-client'
import { CANALES } from '@/lib/pacha/catalogo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + ' mil'
const fmtU = (v: number) => v.toLocaleString('es-BO', { maximumFractionDigits: 1 }) + ' mil u'
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')

/* ============ Líneas contables de cada área (contenido del borrador) ============ */

function LineasArea({ estado, borrador }: { estado: AlumnoEstado; borrador: BorradorAreaFront }) {
  const nombreMarca = useMemo(() => new Map(estado.marcas.map((m) => [m.id, m.nombre])), [estado.marcas])
  const c = borrador.contenido as Record<string, unknown>
  const filas: { etiqueta: string; valor: string }[] = []

  if (borrador.cargo === 'precios' && Array.isArray(c.precios)) {
    for (const p of c.precios as { marcaId: string; precio: number }[]) {
      filas.push({ etiqueta: `🍨 ${nombreMarca.get(p.marcaId) ?? 'Marca'}`, valor: `Bs ${Number(p.precio).toFixed(2)} / unidad` })
    }
  } else if (borrador.cargo === 'publicidad' && Array.isArray(c.publicidades)) {
    let total = 0
    for (const p of c.publicidades as { marcaId: string; publicidad: number }[]) {
      total += Number(p.publicidad)
      filas.push({ etiqueta: `🍨 ${nombreMarca.get(p.marcaId) ?? 'Marca'}`, valor: fmtBs(Number(p.publicidad)) })
    }
    filas.push({ etiqueta: 'Σ Total publicidad', valor: fmtBs(total) })
  } else if (borrador.cargo === 'produccion' && Array.isArray(c.producciones)) {
    let total = 0
    for (const p of c.producciones as { marcaId: string; produccion: number }[]) {
      total += Number(p.produccion)
      filas.push({ etiqueta: `🍨 ${nombreMarca.get(p.marcaId) ?? 'Marca'}`, valor: fmtU(Number(p.produccion)) })
    }
    filas.push({ etiqueta: 'Σ Producción total', valor: fmtU(total) })
    if (Number(c.inversionCapacidad) > 0) {
      filas.push({ etiqueta: '🏗️ Inversión en capacidad', valor: `${Number(c.inversionCapacidad).toLocaleString('es-BO')} mil L` })
    }
  } else if (borrador.cargo === 'ventas' && Array.isArray(c.ventas)) {
    let fuerza = 0
    for (const v of c.ventas as { marcaId: string; vendedores: number[] }[]) {
      const vs = v.vendedores ?? [0, 0, 0]
      const sueldos = CANALES.reduce((s, cn, i) => s + (vs[i] ?? 0) * cn.salario, 0)
      fuerza += sueldos
      filas.push({
        etiqueta: `🍨 ${nombreMarca.get(v.marcaId) ?? 'Marca'}`,
        valor: `${vs[0] ?? 0} T · ${vs[1] ?? 0} S · ${vs[2] ?? 0} K (vendedores)`,
      })
    }
    filas.push({ etiqueta: 'Σ Nómina de ventas', valor: fmtBs(fuerza) })
  } else if (borrador.cargo === 'investigacion') {
    const estudios = Array.isArray(c.estudios) ? (c.estudios as number[]) : []
    let costoEstudios = 0
    for (const id of estudios) {
      const est = estado.config.catalogoEstudios.find((e) => e.id === id)
      costoEstudios += est?.costo ?? 0
      filas.push({ etiqueta: `${est?.icono ?? '📄'} ${est?.nombre ?? `Estudio #${id}`}`, valor: fmtBs(est?.costo ?? 0) })
    }
    if (estudios.length === 0) filas.push({ etiqueta: '📄 Estudios de mercado', valor: 'ninguno seleccionado' })
    if (estudios.length > 0) filas.push({ etiqueta: 'Σ Costo de estudios', valor: fmtBs(costoEstudios) })
    const nuevas = Array.isArray(c.nuevas) ? (c.nuevas as { nombre: string; precio: number; publicidad: number; produccion: number; vendedores: number[] }[]) : []
    for (const n of nuevas) {
      filas.push({
        etiqueta: `🌟 Lanzar «${n.nombre || 'marca nueva'}»`,
        valor: `Bs ${Number(n.precio).toFixed(2)}/u · ${fmtBs(Number(n.publicidad))} · ${fmtU(Number(n.produccion))} · ${n.vendedores?.[0] ?? 0}T/${n.vendedores?.[1] ?? 0}S/${n.vendedores?.[2] ?? 0}K`,
      })
    }
  }

  return (
    <ul className="mt-2 space-y-1">
      {filas.map((f, i) => (
        <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-1 text-[11px]">
          <span className="text-zinc-300">{f.etiqueta}</span>
          <span className="font-bold text-zinc-100">{f.valor}</span>
        </li>
      ))}
    </ul>
  )
}

function colorPuntos(p: number): string {
  if (p <= -20) return 'text-red-300'
  if (p < 0) return 'text-amber-300'
  return 'text-emerald-300'
}

function etiquetaTipo(tipo: string): string {
  if (tipo === 'AMONESTACION') return '📝 Amonestación'
  if (tipo === 'PUNTOS') return '📉 Resta de puntos'
  if (tipo === 'EXPULSION') return '🚪 Expulsión'
  return tipo
}

export function AlumnoComite({ estado, refresh }: { estado: AlumnoEstado; refresh: () => Promise<void> | void }) {
  const anio = estado.industria.anioActual
  const activa = estado.industria.estado === 'ACTIVA'
  const decisionEstado = estado.decision?.estado ?? null
  const bloqueada = decisionEstado === 'ENVIADA' || decisionEstado === 'APROBADA'
  const esRepresentante = estado.membresia?.esRepresentante ?? false

  const cargos: CargoFront[] = estado.cargos
  const borradorDe = new Map(estado.borradores.map((b) => [b.cargo, b]))

  const [penalizando, setPenalizando] = useState<GerenteComite | null>(null)
  const [tipo, setTipo] = useState<'AMONESTACION' | 'PUNTOS' | 'EXPULSION'>('AMONESTACION')
  const [puntos, setPuntos] = useState('10')
  const [motivo, setMotivo] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  async function aplicarPenalizacion() {
    if (!penalizando) return
    setAplicando(true)
    try {
      const res = await api.penalizarGerente(
        penalizando.usuarioId,
        tipo,
        tipo === 'PUNTOS' ? Number(puntos) || 0 : 0,
        motivo
      )
      toast({
        title: res.expulsado ? '🚪 Integrante expulsado' : '⚖️ Penalización aplicada',
        description: res.expulsado
          ? `${penalizando.nombre} ya no pertenece a la empresa.`
          : `${penalizando.nombre}: ${res.puntosRestados > 0 ? `−${res.puntosRestados} puntos` : 'amonestación registrada'}.`,
      })
      setConfirmar(false)
      setPenalizando(null)
      setMotivo('')
      setTipo('AMONESTACION')
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo penalizar', description: msg(e), variant: 'destructive' })
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">
          👥 Grupo <span className="pacha-title-shine">de Dirección</span>
        </h2>
        <p className="mt-0.5 text-sm text-zinc-400">
          Los integrantes de la empresa (máximo 8). Todos pueden consultar los reportes, los datos financieros y lo
          decidido en cada área; solo el <b className="text-amber-300">👑 REPRESENTANTE</b> toma y envía las
          decisiones del año, y registra las sanciones que el grupo acuerde.
        </p>
      </div>

      {/* Estado de la decisión del año */}
      {decisionEstado === 'ENVIADA' && (
        <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">
          🔒 El comité ya envió la decisión del Año {anio} — esperando el visto bueno del docente.
        </div>
      )}
      {decisionEstado === 'APROBADA' && (
        <div role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
          ✅ El docente dio el visto bueno al Año {anio} — cuando corra la simulación llegarán los reportes.
        </div>
      )}

      {/* Integrantes del grupo */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {estado.comite.map((g, i) => {
          const penalizable = activa && !bloqueada && esRepresentante && !g.representante && g.puntos <= (estado.desempeno?.umbralPenalizable ?? -20)
          const esYo = g.usuarioId === estado.usuario.id
          return (
            <motion.article
              key={g.usuarioId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className={`pacha-panel p-4 ${esYo ? 'ring-1 ring-pink-400/40' : ''} ${g.representante ? 'ring-1 ring-amber-400/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-zinc-100">
                    {g.representante ? '👑' : '👤'} {g.nombre}
                    {esYo && <span className="ml-1.5 text-[10px] font-bold uppercase text-pink-300">(tú)</span>}
                  </h3>
                  <p className="text-[11px] font-semibold text-zinc-400">
                    {g.representante ? (
                      <span className="font-bold text-amber-300">Representante del grupo · toma las decisiones</span>
                    ) : (
                      'Integrante · consulta todos los reportes y datos'
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Desempeño</p>
                  <p className={`text-2xl font-black leading-none ${colorPuntos(g.puntos)}`}>
                    {g.puntos > 0 ? '+' : ''}
                    {Math.round(g.puntos)}
                  </p>
                </div>
              </div>

              {g.representante && (
                <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-200">
                  Responsable de guardar los borradores de las 5 áreas y de enviar la decisión del año al docente.
                </p>
              )}

              {penalizable && (
                <div className="mt-3 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-300">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    Desempeño muy negativo: el representante puede aplicar la sanción que decida el grupo
                  </p>
                  {esRepresentante && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setPenalizando(g)
                      setTipo('AMONESTACION')
                      setPuntos('10')
                      setMotivo('')
                    }}
                    className="mt-2 h-8 w-full border border-red-400/40 bg-red-500/20 text-[11px] font-black text-red-200 hover:bg-red-500/30"
                  >
                    <Gavel className="h-3.5 w-3.5" aria-hidden="true" /> ⚖️ Penalizar
                  </Button>
                  )}
                </div>
              )}
            </motion.article>
          )
        })}
      </div>

      {/* Estado de los borradores por área */}
      <div className="pacha-panel p-4">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-zinc-300">
          📋 Borradores del Año {anio} por área de decisión
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {cargos.map((c) => {
            const b = borradorDe.get(c.id)
            return (
              <div
                key={c.id}
                className={`rounded-xl border p-3 ${
                  b ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-red-400/30 bg-red-400/5'
                }`}
              >
                <p className="text-sm font-black text-zinc-100">
                  <span aria-hidden="true">{c.emoji}</span> {c.corto}
                </p>
                {b ? (
                  <>
                    <p className="mt-1 text-[11px] font-bold text-emerald-300">✓ Borrador enviado</p>
                    <p className="text-[10px] text-zinc-500">por {b.enviadoPor}</p>
                  </>
                ) : (
                  <p className="mt-1 text-[11px] font-bold text-red-300">
                    {bloqueada ? 'Sin trabajar (predeterminado)' : '⚠️ Sin trabajar'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lo que decidió cada área, en números (comité) */}
      <div className="pacha-panel p-4">
        <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">
          🧾 Lo que decidió cada área · Año {anio} (en números)
        </h3>
        <p className="mb-3 text-[11px] text-zinc-500">
          Resumen contable de los borradores guardados en cada área de la decisión. Todos los integrantes pueden
          consultarlos; solo el representante los edita y envía.
        </p>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {cargos.map((c) => {
            const b = borradorDe.get(c.id)
            return (
              <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-zinc-100">
                    <span aria-hidden="true">{c.emoji}</span> {c.nombre}
                  </p>
                  {b && <span className="text-[10px] font-bold text-zinc-400">por {b.enviadoPor}</span>}
                </div>
                {b ? (
                  <LineasArea estado={estado} borrador={b} />
                ) : (
                  <p className="mt-2 text-[11px] italic text-zinc-500">
                    {bloqueada ? 'Sin borrador: se usaron valores predeterminados.' : 'Área sin trabajar todavía.'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Proyectos I+D del equipo: los revisa todo el comité */}
      <div className="pacha-panel p-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-300">
          <FlaskConical className="h-4 w-4 text-purple-300" aria-hidden="true" /> Proyectos de I+D del equipo
        </h3>
        <p className="mb-3 text-[11px] text-zinc-500">
          Registrados por el REPRESENTANTE del grupo. Cuando uno se aprueba, el grupo puede lanzar la marca nueva
          desde el área de Investigación y Desarrollo.
        </p>
        {estado.proyectos.length === 0 ? (
          <p className="text-xs text-zinc-500">Todavía no hay proyectos registrados.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {estado.proyectos.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-black text-zinc-100">⚗️ {p.nombre}</p>
                  <Badge
                    className={`shrink-0 border text-[9px] ${
                      p.estado === 'APROBADO'
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                        : p.estado === 'FALLIDO'
                          ? 'border-red-400/40 bg-red-400/10 text-red-300'
                          : p.estado === 'APLICADO'
                            ? 'border-zinc-400/30 bg-zinc-400/10 text-zinc-300'
                            : 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                    }`}
                  >
                    {p.estado.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-400">
                  💵 {fmtBs(p.presupuesto)} · 🎲 {Math.round(p.probabilidad * 100)}% · 📅 Año {p.anioInicio}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial de penalizaciones */}
      <div className="pacha-panel p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-300">
          <Gavel className="h-4 w-4" aria-hidden="true" /> Historial de penalizaciones
        </h3>
        {(estado.penalizaciones ?? []).length === 0 ? (
          <p className="text-xs text-zinc-500">Sin penalizaciones registradas. ¡Sigan trabajando en equipo! 💪</p>
        ) : (
          <ul className="space-y-2">
            {(estado.penalizaciones as PenalizacionFront[]).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <Badge
                  className={`text-[10px] ${
                    p.tipo === 'EXPULSION'
                      ? 'border border-red-400/40 bg-red-500/20 text-red-200'
                      : p.tipo === 'PUNTOS'
                        ? 'border border-amber-400/40 bg-amber-400/10 text-amber-200'
                        : 'border border-white/15 bg-white/5 text-zinc-300'
                  }`}
                >
                  {etiquetaTipo(p.tipo)}
                </Badge>
                <span className="font-black text-zinc-100">
                  <UserMinus className="mr-1 inline h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                  {p.gerente}
                </span>
                {p.puntos > 0 && <span className="font-bold text-red-300">−{p.puntos} pts</span>}
                <span className="text-zinc-400">Año {p.anio}</span>
                {p.motivo && <span className="min-w-0 flex-1 truncate text-zinc-500">«{p.motivo}»</span>}
                <span className="ml-auto shrink-0 text-[10px] text-zinc-600">registró: {p.registradaPor}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Diálogo de penalización */}
      <Dialog open={penalizando !== null} onOpenChange={(v) => !v && setPenalizando(null)}>
        <DialogContent className="border-white/10 bg-[#1c1528] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <Gavel className="h-4 w-4 text-red-300" aria-hidden="true" /> Penalizar a {penalizando?.nombre}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              El comité decide la sanción. Elige el tipo y, si corresponde, el monto. Quedará registrada en el
              historial y visible para el docente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-2">
              {(
                [
                  { id: 'AMONESTACION', titulo: '📝 Amonestación escrita', detalle: 'Solo queda registrada la advertencia (0 puntos)' },
                  { id: 'PUNTOS', titulo: '📉 Restar puntos', detalle: 'El grupo define cuántos puntos se le restan' },
                  { id: 'EXPULSION', titulo: '🚪 Expulsar de la empresa', detalle: 'Deja de ser integrante del grupo' },
                ] as const
              ).map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setTipo(op.id)}
                  aria-pressed={tipo === op.id}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    tipo === op.id
                      ? 'border-red-400/50 bg-red-400/10'
                      : 'border-white/10 bg-black/20 hover:bg-white/5'
                  }`}
                >
                  <p className="text-sm font-black text-zinc-100">{op.titulo}</p>
                  <p className="text-[11px] text-zinc-400">{op.detalle}</p>
                </button>
              ))}
            </div>

            {tipo === 'PUNTOS' && (
              <div className="space-y-1.5">
                <Label htmlFor="pen-puntos" className="text-zinc-300">
                  Puntos a restar (1–{estado.desempeno?.restaMaximaPenalizacion ?? 100})
                </Label>
                <Input
                  id="pen-puntos"
                  type="number"
                  min={1}
                  max={estado.desempeno?.restaMaximaPenalizacion ?? 100}
                  value={puntos}
                  onChange={(e) => setPuntos(e.target.value)}
                  className="h-10 border-white/10 bg-black/30 text-zinc-100"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pen-motivo" className="text-zinc-300">
                Motivo (lo verá el docente)
              </Label>
              <Textarea
                id="pen-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Ej: no envió su borrador dos años seguidos"
                className="border-white/10 bg-black/30 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPenalizando(null)} className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/10">
              Cancelar
            </Button>
            <Button
              onClick={() => setConfirmar(true)}
              disabled={aplicando}
              className="bg-red-600 font-black text-white hover:bg-red-500"
            >
              {aplicando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : '⚖️ Aplicar sanción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación final */}
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent className="border-white/10 bg-[#1c1528] text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">¿Confirmar la sanción?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {tipo === 'EXPULSION'
                ? `${penalizando?.nombre} será expulsado de la empresa y perderá su cargo. Esta acción no se puede deshacer.`
                : tipo === 'PUNTOS'
                  ? `Se restarán ${puntos} punto(s) a ${penalizando?.nombre}.`
                  : `Se registrará una amonestación para ${penalizando?.nombre}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-zinc-100">
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void aplicarPenalizacion()}
              className="bg-red-600 font-black text-white hover:bg-red-500"
            >
              ⚖️ Sí, aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
