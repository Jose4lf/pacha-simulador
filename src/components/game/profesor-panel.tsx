'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Factory, Loader2, Plus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { api, type ProfesorIndustria, type UsuarioSesion } from '@/lib/pacha/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Hud } from '@/components/game/hud'
import { SplashCarga } from '@/components/game/login-screen'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + 'k'
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')

function alumnosDe(industria: ProfesorIndustria): { id: string; nombre: string }[] {
  return (industria.alumnosDisponibles ?? []).map((a) => ({
    id: String(a.id),
    nombre: typeof a.nombre === 'string' ? a.nombre : `Alumno ${String(a.id).slice(0, 6)}`,
  }))
}

function BadgeDecision({ estado }: { estado: string }) {
  if (estado === 'ENVIADA') {
    return <Badge className="border border-emerald-400/40 bg-emerald-400/15 text-[10px] text-emerald-300">✓ Enviada</Badge>
  }
  if (estado === 'BORRADOR') {
    return <Badge className="border border-amber-400/40 bg-amber-400/15 text-[10px] text-amber-300">Borrador</Badge>
  }
  return <Badge className="border border-red-400/40 bg-red-400/15 text-[10px] text-red-300">Pendiente</Badge>
}

function BadgeEstadoIndustria({ estado }: { estado: string }) {
  const activa = estado === 'ACTIVA'
  return (
    <Badge
      className={`border text-[10px] font-black uppercase tracking-wider ${
        activa
          ? 'animate-pulse border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
          : 'border-zinc-400/30 bg-zinc-400/10 text-zinc-300'
      }`}
    >
      {activa ? '● Activa' : '■ Finalizada'}
    </Badge>
  )
}

/* ============ Tarjeta de industria ============ */

function TarjetaIndustria({
  ind,
  procesando,
  onProcesar,
  onAsignar,
}: {
  ind: ProfesorIndustria
  procesando: boolean
  onProcesar: (ind: ProfesorIndustria) => Promise<void>
  onAsignar: (equipoId: string, alumnoId: string | null) => Promise<void>
}) {
  const alumnos = useMemo(() => alumnosDe(ind), [ind])
  const sinDecision = ind.equipos.filter((e) => !e.enviada)
  const activa = ind.estado === 'ACTIVA'
  const progreso = ind.anioMaximo > 0 ? Math.min(100, (ind.anioActual / ind.anioMaximo) * 100) : 0

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="pacha-panel p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-zinc-100">🏭 {ind.nombre}</h3>
            <BadgeEstadoIndustria estado={ind.estado} />
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {ind.equipos.length} equipo(s) compitiendo por el mercado de helados
          </p>
        </div>
        <div className="w-full max-w-[220px]">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-black uppercase tracking-wider text-amber-300">
              Año {ind.anioActual}/{ind.anioMaximo}
            </span>
            <span className="text-zinc-500">{Math.round(progreso)}%</span>
          </div>
          <Progress
            value={progreso}
            aria-label={`Progreso de la simulación: año ${ind.anioActual} de ${ind.anioMaximo}`}
            className="h-2 bg-white/10 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-pink-500 [&_[data-slot=progress-indicator]]:to-amber-400"
          />
        </div>
      </div>

      {/* Procesar ronda */}
      <div className="mt-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              disabled={!activa || procesando}
              className={`pacha-btn-game h-12 w-full bg-gradient-to-r from-amber-500 to-pink-500 text-base font-black uppercase tracking-wide text-white hover:from-amber-400 hover:to-pink-400 sm:w-auto sm:px-8 ${
                activa && !procesando ? 'pacha-glow' : ''
              }`}
            >
              {procesando ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                `⚙️ Procesar ronda (Año ${ind.anioActual})`
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-[#1c1528] text-zinc-100">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-zinc-100">
                ¿Procesar el Año {ind.anioActual} de «{ind.nombre}»?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                El motor simulará el mercado con las decisiones enviadas.
                {sinDecision.length > 0 && (
                  <>
                    {' '}
                    <b className="text-amber-300">
                      ⚠️ {sinDecision.length} equipo(s) no enviaron decisión ({sinDecision.map((e) => e.nombre).join(', ')}
                      ); el motor usará sus valores vigentes.
                    </b>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-zinc-100">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void onProcesar(ind)}
                className="bg-gradient-to-r from-amber-500 to-pink-500 font-black text-white hover:from-amber-400 hover:to-pink-400"
              >
                ⚙️ Procesar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_240px]">
        {/* Tabla de equipos */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Equipo</TableHead>
                <TableHead className="text-zinc-400">Alumno</TableHead>
                <TableHead className="text-right text-zinc-400">Marcas</TableHead>
                <TableHead className="text-zinc-400">Decisión</TableHead>
                <TableHead className="text-right text-zinc-400">Cuota</TableHead>
                <TableHead className="text-right text-zinc-400">Contribución</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ind.equipos.map((eq) => {
                const fila = ind.ranking.find((r) => r.equipoId === eq.id)
                const alumnoIdActual = alumnos.find((a) => a.nombre === eq.alumno)?.id ?? ''
                return (
                  <TableRow key={eq.id} className="border-white/5">
                    <TableCell className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: eq.color }} aria-hidden="true" />
                        <span className="text-xs font-bold text-zinc-100">{eq.nombre}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={alumnoIdActual || '0x-sin-asignar'}
                        onValueChange={(v) => void onAsignar(eq.id, v === '0x-sin-asignar' ? null : v)}
                        disabled={!activa}
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label={`Alumno del equipo ${eq.nombre}`}
                          className="h-8 w-[150px] border-white/10 bg-black/40 text-xs text-zinc-100"
                        >
                          <SelectValue placeholder="— sin asignar —" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#1c1528] text-zinc-100">
                          <SelectItem value="0x-sin-asignar">— sin asignar —</SelectItem>
                          {alumnos.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-zinc-200">{eq.numMarcas}</TableCell>
                    <TableCell>
                      <BadgeDecision estado={eq.decisionEstado} />
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-pink-300">
                      {fila ? `${fila.participacionUltima.toFixed(1)}%` : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right text-xs font-black ${
                        (fila?.contribucionAcumulada ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {fila ? fmtBs(fila.contribucionAcumulada) : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mini-ranking */}
        <aside className="rounded-xl border border-white/10 bg-black/20 p-3" aria-label={`Ranking de ${ind.nombre}`}>
          <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-amber-300">🏅 Ranking</h4>
          <ol className="space-y-1.5">
            {ind.ranking.map((r) => (
              <li key={r.equipoId} className="flex items-center gap-2 text-xs">
                <span className="w-6 shrink-0 font-black text-zinc-500">
                  {r.posicion === 1 ? '🥇' : r.posicion === 2 ? '🥈' : r.posicion === 3 ? '🥉' : `#${r.posicion}`}
                </span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold text-zinc-200">{r.nombre}</span>
                <span
                  className={`shrink-0 font-bold ${
                    r.contribucionAcumulada >= 0 ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {fmtBs(r.contribucionAcumulada)}
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </motion.article>
  )
}

/* ============ Panel principal ============ */

export function ProfesorPanel({ usuario, onLogout }: { usuario: UsuarioSesion; onLogout: () => void }) {
  const [industrias, setIndustrias] = useState<ProfesorIndustria[]>([])
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [abrirNueva, setAbrirNueva] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [equiposNueva, setEquiposNueva] = useState('Colibrí, Kallpa, Inti, Pachamama')
  const [creando, setCreando] = useState(false)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.profesorEstado()
      setIndustrias(data.industrias)
      setSeleccionadaId((prev) =>
        prev && data.industrias.some((i) => i.id === prev) ? prev : (data.industrias[0]?.id ?? null)
      )
      setError(null)
    } catch (e) {
      setError(msg(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const seleccionada = industrias.find((i) => i.id === seleccionadaId) ?? industrias[0] ?? null
  const enviosPendientes = industrias
    .filter((i) => i.estado === 'ACTIVA')
    .reduce((s, i) => s + i.equipos.filter((e) => !e.enviada).length, 0)

  async function crear() {
    const equipos = equiposNueva
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (!nombreNueva.trim() || equipos.length === 0) {
      toast({
        title: 'Faltan datos',
        description: 'Escribe el nombre de la industria y al menos un equipo.',
        variant: 'destructive',
      })
      return
    }
    setCreando(true)
    try {
      const r = await api.crearIndustria(nombreNueva.trim(), equipos)
      toast({
        title: '🏭 ¡Simulación creada!',
        description: `"${r.nombre}" lista con ${equipos.length} equipo(s). Asigna alumnos y a jugar.`,
      })
      setAbrirNueva(false)
      setNombreNueva('')
      setEquiposNueva('Colibrí, Kallpa, Inti, Pachamama')
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo crear', description: msg(e), variant: 'destructive' })
    } finally {
      setCreando(false)
    }
  }

  async function procesar(ind: ProfesorIndustria) {
    setProcesandoId(ind.id)
    try {
      const r = await api.procesarRonda(ind.id)
      toast({
        title: r.finalizada ? '🏆 ¡Simulación finalizada!' : `✅ Año ${r.anioProcesado} procesado`,
        description: r.finalizada
          ? `Ventas del mercado: ${Math.round(r.ventasTotales).toLocaleString('es-BO')}k unidades · ¡Revisen el podio final!`
          : `Ventas del mercado: ${Math.round(r.ventasTotales).toLocaleString('es-BO')}k unidades · La industria avanza al Año ${r.anioNuevo}.`,
      })
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo procesar la ronda', description: msg(e), variant: 'destructive' })
    } finally {
      setProcesandoId(null)
    }
  }

  async function asignar(equipoId: string, alumnoId: string | null) {
    try {
      await api.asignarAlumno(equipoId, alumnoId)
      toast({
        title: alumnoId ? '✅ Alumno asignado' : 'Alumno desasignado',
        description: alumnoId ? 'El alumno ya puede entrar a su equipo.' : 'El equipo quedó sin alumno.',
      })
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo asignar', description: msg(e), variant: 'destructive' })
    }
  }

  if (cargando) return <SplashCarga />

  if (error) {
    return (
      <div className="pacha-bg flex min-h-screen flex-col items-center justify-center px-4 text-zinc-100">
        <div className="pacha-panel w-full max-w-md p-8 text-center">
          <p className="mb-3 text-5xl" aria-hidden="true">🎓</p>
          <h1 className="mb-2 text-xl font-black">No pudimos cargar tu panel</h1>
          <p role="alert" className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
          <Button
            onClick={onLogout}
            className="pacha-btn-game h-11 w-full bg-gradient-to-r from-pink-500 to-amber-500 font-bold text-white hover:from-pink-400 hover:to-amber-400"
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="pacha-bg flex min-h-screen flex-col text-zinc-100">
      <Hud
        titulo="Panel del Profesor"
        subtitulo={seleccionada ? seleccionada.nombre : 'Simulaciones'}
        anioActual={seleccionada?.anioActual ?? 0}
        anioMaximo={seleccionada?.anioMaximo ?? 10}
        estadoIndustria={seleccionada?.estado}
        jugador={{ nombre: usuario.nombre, rol: 'PROFESOR' }}
        stats={[
          { label: 'Simulaciones', valor: String(industrias.length), color: 'text-pink-300' },
          { label: 'Equipos', valor: String(industrias.reduce((s, i) => s + i.equipos.length, 0)), color: 'text-emerald-300' },
          { label: 'Envíos pendientes', valor: String(enviosPendientes), color: enviosPendientes > 0 ? 'text-amber-300' : 'text-zinc-200' },
        ]}
        onLogout={onLogout}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6">
        <motion.div key="profesor" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">🎮 Tus simulaciones</h2>
              <p className="mt-0.5 text-sm text-zinc-400">
                Crea industrias, asigna alumnos y procesa las rondas. El motor hace la magia.
              </p>
            </div>
            <Dialog open={abrirNueva} onOpenChange={setAbrirNueva}>
              <DialogTrigger asChild>
                <Button className="pacha-btn-game h-11 bg-gradient-to-r from-pink-500 to-amber-500 font-black uppercase tracking-wide text-white hover:from-pink-400 hover:to-amber-400">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Nueva simulación
                </Button>
              </DialogTrigger>
              <DialogContent className="border-white/10 bg-[#1c1528] text-zinc-100 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-zinc-100">
                    <Factory className="h-4 w-4 text-pink-300" aria-hidden="true" /> Nueva simulación
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Crea una industria de helados con sus equipos. Cada equipo lo jugará un alumno.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="nueva-ind-nombre" className="text-zinc-300">
                      Nombre de la industria
                    </Label>
                    <Input
                      id="nueva-ind-nombre"
                      value={nombreNueva}
                      onChange={(e) => setNombreNueva(e.target.value)}
                      placeholder="Ej: Helados Bolivia · Gestión 2025"
                      className="h-10 border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nueva-ind-equipos" className="text-zinc-300">
                      Equipos (separados por coma)
                    </Label>
                    <Textarea
                      id="nueva-ind-equipos"
                      value={equiposNueva}
                      onChange={(e) => setEquiposNueva(e.target.value)}
                      rows={3}
                      className="border-white/10 bg-black/30 text-sm text-zinc-100 placeholder:text-zinc-600"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Se creará un equipo con color propio por cada nombre. Máximo recomendado: 6 equipos.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => void crear()}
                    disabled={creando}
                    className="pacha-btn-game h-11 w-full bg-gradient-to-r from-pink-500 to-amber-500 font-black uppercase tracking-wide text-white hover:from-pink-400 hover:to-amber-400 sm:w-auto"
                  >
                    {creando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : '🏭 Crear simulación'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {industrias.length === 0 ? (
            <div className="pacha-panel flex min-h-[240px] flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-5xl" aria-hidden="true">🍦</p>
              <p className="max-w-sm text-sm text-zinc-400">
                Aún no tienes simulaciones. Crea la primera industria y reparte equipos entre tus alumnos.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {industrias.map((ind) => (
                <TarjetaIndustria
                  key={ind.id}
                  ind={ind}
                  procesando={procesandoId === ind.id}
                  onProcesar={procesar}
                  onAsignar={asignar}
                />
              ))}
            </div>
          )}
        </motion.div>
      </main>

      <footer className="mt-auto border-t border-white/5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] text-zinc-500">
        PACHA Simulador · Markestrat · Industria de helados
      </footer>
    </div>
  )
}
