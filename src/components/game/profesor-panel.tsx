'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Eye, Factory, FileSpreadsheet, Loader2, Plus, Undo2, Users, Wand2, XCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { api, type ProfesorIndustria, type UsuarioSesion, type EmpresaCrearPayload } from '@/lib/pacha/api-client'
import { slugUsuario } from '@/lib/pacha/slug'
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
import { PlanEventos } from '@/components/game/plan-eventos'
import { SplashCarga } from '@/components/game/login-screen'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + 'k'
const fmtU = (v: number) => v.toLocaleString('es-BO', { maximumFractionDigits: 1 }) + 'k u'
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')

/** Nombres cortos de los cargos (igual que el catálogo del backend). */
const CARGO_CORTO: Record<string, string> = {
  precios: '💰 Precios',
  publicidad: '📺 Publicidad',
  produccion: '🏭 Producción',
  ventas: '🚚 Distribución',
  investigacion: '🔬 I+D',
}

import { EntornoPeriodo } from './entorno-periodo'

function BadgeDecision({ estado }: { estado: string }) {
  if (estado === 'APROBADA') {
    return <Badge className="border border-emerald-400/40 bg-emerald-400/15 text-[10px] text-emerald-300">✓ Visto bueno</Badge>
  }
  if (estado === 'ENVIADA') {
    return <Badge className="border border-sky-400/40 bg-sky-400/15 text-[10px] text-sky-300">📨 Enviada · sin revisar</Badge>
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

function colorPuntos(p: number): string {
  if (p <= -20) return 'text-red-300'
  if (p < 0) return 'text-amber-300'
  return 'text-zinc-300'
}

/* ============ Diálogo de decisión del equipo (vista del docente) ============ */

function DialogoDecision({
  eq,
  anio,
  onAprobar,
  aprobando,
}: {
  eq: ProfesorIndustria['equipos'][number]
  anio: number
  onAprobar: (decisionId: string, aprobada: boolean) => Promise<void>
  aprobando: boolean
}) {
  const c = eq.contenido
  const sin = eq.areasSinBorrador
  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#1c1528] text-zinc-100 sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-zinc-100">
          📋 Decisión del Año {anio} · {eq.nombre}
        </DialogTitle>
        <DialogDescription className="text-zinc-400">
          Consolidado de los borradores de las 5 áreas del comité. Las áreas sin borrador usaron valores
          predeterminados y quedaron «sin trabajar».
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        {/* Estado de áreas */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CARGO_CORTO) as string[]).map((id) =>
            sin.includes(id) ? (
              <Badge key={id} className="border border-red-400/40 bg-red-400/10 text-[10px] text-red-300">
                <XCircle className="mr-1 h-3 w-3" aria-hidden="true" /> {CARGO_CORTO[id]}: sin trabajar
              </Badge>
            ) : (
              <Badge key={id} className="border border-emerald-400/40 bg-emerald-400/10 text-[10px] text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> {CARGO_CORTO[id]}: trabajada
              </Badge>
            )
          )}
        </div>

        {/* Marcas */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Marca</TableHead>
                <TableHead className="text-right text-zinc-400">Precio</TableHead>
                <TableHead className="text-right text-zinc-400">Publicidad</TableHead>
                <TableHead className="text-right text-zinc-400">Producción</TableHead>
                <TableHead className="text-right text-zinc-400">Vendedores T·S·K</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(c?.marcas ?? []).map((m) => {
                const nombreMarca = eq.marcas.find((x) => x.id === m.marcaId)?.nombre ?? 'Marca'
                return (
                  <TableRow key={m.marcaId} className="border-white/5">
                    <TableCell className="whitespace-nowrap text-xs font-bold text-zinc-100">🍨 {nombreMarca}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-zinc-100">Bs {m.precio.toLocaleString('es-BO')}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-300">{fmtBs(m.publicidad)}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-300">{fmtU(m.produccion)}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-300">{m.vendedores.join(' · ')}</TableCell>
                  </TableRow>
                )
              })}
              {(c?.nuevas ?? []).map((n, i) => (
                <TableRow key={`nueva-${i}`} className="border-white/5">
                  <TableCell className="whitespace-nowrap text-xs font-bold text-purple-300">🌟 {n.nombre}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-purple-300">Bs {n.precio.toLocaleString('es-BO')}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-300">{fmtBs(n.publicidad)}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-300">{fmtU(n.produccion)}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-300">{n.vendedores.join(' · ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Estudios */}
        <div>
          <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-zinc-400">🛒 Estudios comprados</p>
          {(c?.estudios ?? []).length === 0 ? (
            <p className="text-xs text-zinc-500">Ninguno este año.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(c?.estudios ?? []).map((id) => (
                <Badge key={id} variant="outline" className="border-white/15 text-[10px] text-zinc-300">
                  Estudio #{id}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="gap-2">
        {eq.decisionId && eq.decisionEstado === 'APROBADA' && (
          <Button
            variant="outline"
            disabled={aprobando}
            onClick={() => void onAprobar(eq.decisionId!, false)}
            className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/10"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" /> Quitar visto bueno
          </Button>
        )}
        {eq.decisionId && eq.decisionEstado === 'ENVIADA' && (
          <Button
            disabled={aprobando}
            onClick={() => void onAprobar(eq.decisionId!, true)}
            className="bg-emerald-600 font-black text-white hover:bg-emerald-500"
          >
            {aprobando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            ✓ Dar visto bueno
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}

/* ============ Tarjeta de industria ============ */

function TarjetaIndustria({
  ind,
  procesando,
  aprobandoId,
  onProcesar,
  onAprobar,
}: {
  ind: ProfesorIndustria
  procesando: boolean
  aprobandoId: string | null
  onProcesar: (ind: ProfesorIndustria) => Promise<void>
  onAprobar: (decisionId: string, aprobada: boolean) => Promise<void>
}) {
  const [verDecision, setVerDecision] = useState<string | null>(null)
  const sinVistoBueno = ind.equipos.filter((e) => e.decisionEstado !== 'APROBADA')
  const activa = ind.estado === 'ACTIVA'
  const progreso = ind.anioMaximo > 0 ? Math.min(100, (ind.anioActual / ind.anioMaximo) * 100) : 0
  const eqVer = ind.equipos.find((e) => e.id === verDecision) ?? null

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
            {ind.equipos.length} empresa(s) compitiendo · comités de 5 gerentes
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

      {/* Entorno nacional del periodo: eventos de Bolivia e inflación (doc §15, §18.10) */}
      {activa && <EntornoPeriodo industriaId={ind.id} />}

      {/* Plan de eventos por año: 1-3 eventos por año, sin repetir categoría (corrección) */}
      {activa && <PlanEventos industriaId={ind.id} />}

      {/* Correr simulación */}
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
                `⚙️ Correr simulación (Año ${ind.anioActual})`
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-[#1c1528] text-zinc-100">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-zinc-100">
                ¿Correr la simulación del Año {ind.anioActual} de «{ind.nombre}»?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                El motor simulará el mercado con las decisiones aprobadas y generará los reportes del año.
                {sinVistoBueno.length > 0 && (
                  <>
                    {' '}
                    <b className="text-amber-300">
                      ⚠️ {sinVistoBueno.length} empresa(s) sin visto bueno ({sinVistoBueno.map((e) => e.nombre).join(', ')}
                      ): jugarán con sus valores predeterminados y sus áreas quedarán «sin trabajar» (−10 puntos a sus
                      gerentes).
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
                ⚙️ Correr
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_240px]">
        {/* Tabla de empresas */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Empresa</TableHead>
                <TableHead className="text-zinc-400">Comité (cargo · desempeño)</TableHead>
                <TableHead className="text-right text-zinc-400">Marcas</TableHead>
                <TableHead className="text-zinc-400">Decisión del año</TableHead>
                <TableHead className="text-right text-zinc-400">Cuota</TableHead>
                <TableHead className="text-right text-zinc-400">Contribución</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ind.equipos.map((eq) => {
                const fila = ind.ranking.find((r) => r.equipoId === eq.id)
                return (
                  <TableRow key={eq.id} className="border-white/5">
                    <TableCell className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: eq.color }} aria-hidden="true" />
                        <span className="text-xs font-bold text-zinc-100">{eq.nombre}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {eq.integrantes.length === 0 && <span className="text-[11px] text-zinc-500">— sin gerentes —</span>}
                        {eq.integrantes.map((g) => (
                          <span
                            key={g.usuarioId}
                            title={`${CARGO_CORTO[g.cargo] ?? g.cargo} · ${g.puntos} pts`}
                            className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200"
                          >
                            {g.nombre}
                            <span className={`ml-1 font-bold ${colorPuntos(g.puntos)}`}>
                              {g.puntos > 0 ? '+' : ''}
                              {Math.round(g.puntos)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-zinc-200">{eq.numMarcas}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <BadgeDecision estado={eq.decisionEstado} />
                        {eq.decisionId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setVerDecision(eq.id)}
                            className="h-7 border-white/15 bg-white/5 px-2 text-[10px] font-bold text-zinc-200 hover:bg-white/10"
                          >
                            <Eye className="h-3 w-3" aria-hidden="true" /> Ver
                          </Button>
                        )}
                      </div>
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

      {/* Vista de la decisión */}
      <Dialog open={eqVer !== null} onOpenChange={(v) => !v && setVerDecision(null)}>
        {eqVer && (
          <DialogoDecision
            eq={eqVer}
            anio={ind.anioActual}
            onAprobar={async (decisionId, aprobada) => {
              await onAprobar(decisionId, aprobada)
              setVerDecision(null)
            }}
            aprobando={aprobandoId !== null}
          />
        )}
      </Dialog>
    </motion.article>
  )
}

/* ============ Creación de simulación: alumnos ============ */

interface AlumnoRow {
  usuario: string
  nombre: string
  empresa: string // índice como string '' = sin asignar
}

/** Parseo de CSV con soporte básico de comillas. */
function parseCsv(texto: string): string[][] {
  const filas: string[][] = []
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim()) continue
    const campos: string[] = []
    let actual = ''
    let enComillas = false
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i]
      if (ch === '"') {
        if (enComillas && linea[i + 1] === '"') {
          actual += '"'
          i++
        } else {
          enComillas = !enComillas
        }
      } else if ((ch === ',' || ch === ';') && !enComillas) {
        campos.push(actual.trim())
        actual = ''
      } else {
        actual += ch
      }
    }
    campos.push(actual.trim())
    filas.push(campos)
  }
  return filas
}

function indiceColumnas(headers: string[]) {
  const busca = (pat: RegExp) => headers.findIndex((h) => pat.test(h.trim()))
  return {
    nombre: busca(/^(nombre|alumno|estudiante|participante|apellidos|nombres)/i),
    usuario: busca(/(usuario|username|user|cuenta|login|codigo|carnet|sis)/i),
    empresa: busca(/(empresa|equipo|grupo|company|team)/i),
    correo: busca(/(correo|email|e.?mail)/i),
  }
}

function DialogoNuevaSimulacion({
  abierta,
  onOpenChange,
  onCreada,
}: {
  abierta: boolean
  onOpenChange: (v: boolean) => void
  onCreada: () => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [periodos, setPeriodos] = useState('8')
  const [numEmpresas, setNumEmpresas] = useState('2')
  const [nombresEmpresas, setNombresEmpresas] = useState('Empresa 1, Empresa 2')
  const [modo, setModo] = useState<'manual' | 'csv'>('manual')
  const [manualTexto, setManualTexto] = useState('')
  const [csvTexto, setCsvTexto] = useState('')
  const [alumnos, setAlumnos] = useState<AlumnoRow[] | null>(null)
  const [creando, setCreando] = useState(false)
  const inputCsv = useRef<HTMLInputElement>(null)

  const empresasLista = useMemo(
    () =>
      nombresEmpresas
        .split(',')
        .map((n, i) => n.trim() || `Empresa ${i + 1}`)
        .slice(0, Math.max(2, Math.min(10, Number(numEmpresas) || 2))),
    [nombresEmpresas, numEmpresas]
  )

  function procesarAlumnos() {
    const filas: AlumnoRow[] = []
    if (modo === 'manual') {
      for (const linea of manualTexto.split(/\r?\n/)) {
        const t = linea.trim()
        if (!t) continue
        const [a, b] = t.split(',')
        if (b && b.trim()) {
          filas.push({ usuario: slugUsuario(a), nombre: b.trim(), empresa: '' })
        } else {
          const n = (a || '').trim()
          filas.push({ usuario: slugUsuario(n), nombre: n, empresa: '' })
        }
      }
    } else {
      const tabla = parseCsv(csvTexto)
      if (tabla.length < 2) {
        toast({ title: 'CSV vacío', description: 'Pega el CSV con encabezados y al menos un alumno.', variant: 'destructive' })
        return
      }
      const headers = tabla[0]
      const idx = indiceColumnas(headers)
      if (idx.nombre < 0) {
        toast({
          title: 'Falta la columna de nombres',
          description: 'El CSV debe tener una columna «nombre» (también acepta alumno/estudiante).',
          variant: 'destructive',
        })
        return
      }
      for (const fila of tabla.slice(1)) {
        const nombreA = (fila[idx.nombre] || '').trim()
        if (!nombreA) continue
        const usuarioCrudo = idx.usuario >= 0 ? (fila[idx.usuario] || '').trim() : ''
        const empresaCruda = idx.empresa >= 0 ? (fila[idx.empresa] || '').trim() : ''
        filas.push({
          usuario: slugUsuario(usuarioCrudo || nombreA),
          nombre: nombreA,
          empresa: empresaCruda,
        })
      }
    }
    if (filas.length === 0) {
      toast({ title: 'Sin alumnos', description: 'Agrega al menos un estudiante.', variant: 'destructive' })
      return
    }
    // Auto-reparto inicial: columna empresa del CSV si existe; el resto parejo (5 por empresa)
    const conteo = new Map<string, number>()
    const resultado = filas.map((f) => {
      if (f.empresa && empresasLista.some((e) => e.toLowerCase() === f.empresa.toLowerCase())) {
        const match = empresasLista.find((e) => e.toLowerCase() === f.empresa.toLowerCase())!
        conteo.set(match, (conteo.get(match) ?? 0) + 1)
        return { ...f, empresa: match }
      }
      return { ...f, empresa: '' }
    })
    // Repartir los sin empresa hacia la empresa con menos integrantes
    const sinAsignar = resultado.filter((f) => !f.empresa)
    for (const f of sinAsignar) {
      const objetivo = [...empresasLista].sort((a, b) => (conteo.get(a) ?? 0) - (conteo.get(b) ?? 0))[0]
      f.empresa = objetivo
      conteo.set(objetivo, (conteo.get(objetivo) ?? 0) + 1)
    }
    setAlumnos(resultado)
  }

  function repartirTodo() {
    if (!alumnos) return
    const conteo = new Map<string, number>(empresasLista.map((e) => [e, 0]))
    const copia = alumnos.map((f) => ({ ...f, empresa: '' }))
    for (const f of copia) {
      const objetivo = [...empresasLista].sort((a, b) => (conteo.get(a) ?? 0) - (conteo.get(b) ?? 0))[0]
      f.empresa = objetivo
      conteo.set(objetivo, (conteo.get(objetivo) ?? 0) + 1)
    }
    setAlumnos(copia)
    toast({ title: '🔀 Alumnos repartidos', description: `Balanceado entre ${empresasLista.length} empresa(s).` })
  }

  async function crear() {
    if (!nombre.trim()) {
      toast({ title: 'Falta el nombre', description: 'Escribe el nombre de la industria.', variant: 'destructive' })
      return
    }
    if (!alumnos || alumnos.length === 0) {
      toast({ title: 'Faltan alumnos', description: 'Procesa la lista de estudiantes primero.', variant: 'destructive' })
      return
    }
    const payload: EmpresaCrearPayload[] = empresasLista.map((e) => ({
      nombre: e,
      integrantes: alumnos.filter((a) => a.empresa === e).map((a) => ({ usuario: a.usuario, nombre: a.nombre })),
    }))
    const vacia = payload.find((p) => p.integrantes.length === 0)
    if (vacia) {
      toast({
        title: 'Hay una empresa sin gerentes',
        description: `«${vacia.nombre}» no tiene integrantes. Reparte los alumnos o reduce el nº de empresas.`,
        variant: 'destructive',
      })
      return
    }
    setCreando(true)
    try {
      const r = await api.crearIndustria(nombre.trim(), Math.max(1, Math.min(20, Number(periodos) || 8)), payload)
      toast({
        title: '🏭 ¡Simulación creada!',
        description: `"${r.nombre}" lista: ${payload.length} empresa(s), ${alumnos.length} gerente(s), ${r.anioMaximo} periodo(s).`,
      })
      onOpenChange(false)
      setNombre('')
      setAlumnos(null)
      setManualTexto('')
      setCsvTexto('')
      await onCreada()
    } catch (e) {
      toast({ title: 'No se pudo crear', description: msg(e), variant: 'destructive' })
    } finally {
      setCreando(false)
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#1c1528] text-zinc-100 sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-zinc-100">
          <Factory className="h-4 w-4 text-pink-300" aria-hidden="true" /> Nueva simulación
        </DialogTitle>
        <DialogDescription className="text-zinc-400">
          2 a 10 empresas compiten. Cada empresa la juega un comité de hasta 5 gerentes (alumnos) y arranca con 2
          marcas.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nueva-ind-nombre" className="text-zinc-300">
              Nombre de la industria
            </Label>
            <Input
              id="nueva-ind-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Helados Bolivia · Gestión 2025"
              className="h-10 border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nueva-ind-periodos" className="text-zinc-300">
              Periodos (años) de la simulación
            </Label>
            <Input
              id="nueva-ind-periodos"
              type="number"
              min={1}
              max={20}
              value={periodos}
              onChange={(e) => setPeriodos(e.target.value)}
              className="h-10 border-white/10 bg-black/30 text-zinc-100"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="nueva-ind-nemp" className="text-zinc-300">
              Nº empresas
            </Label>
            <Input
              id="nueva-ind-nemp"
              type="number"
              min={2}
              max={10}
              value={numEmpresas}
              onChange={(e) => {
                const n = String(Math.max(2, Math.min(10, Number(e.target.value) || 2)))
                setNumEmpresas(n)
                const actuales = nombresEmpresas.split(',').map((x) => x.trim()).filter(Boolean)
                const lista: string[] = []
                for (let i = 0; i < Number(n); i++) lista.push(actuales[i] || `Empresa ${i + 1}`)
                setNombresEmpresas(lista.join(', '))
              }}
              className="h-10 border-white/10 bg-black/30 text-zinc-100"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nueva-ind-empresas" className="text-zinc-300">
              Nombres de las empresas (separados por coma)
            </Label>
            <Input
              id="nueva-ind-empresas"
              value={nombresEmpresas}
              onChange={(e) => setNombresEmpresas(e.target.value)}
              className="h-10 border-white/10 bg-black/30 text-sm text-zinc-100"
            />
          </div>
        </div>

        {/* Alumnos */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wide text-zinc-300">
              <Users className="h-4 w-4" aria-hidden="true" /> Gerentes (alumnos)
            </p>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={modo === 'manual' ? 'default' : 'outline'}
                onClick={() => setModo('manual')}
                className={`h-8 px-3 text-[11px] ${modo === 'manual' ? 'bg-pink-600 font-bold text-white hover:bg-pink-500' : 'border-white/15 bg-transparent text-zinc-300 hover:bg-white/10'}`}
              >
                ✍️ Manual
              </Button>
              <Button
                type="button"
                size="sm"
                variant={modo === 'csv' ? 'default' : 'outline'}
                onClick={() => setModo('csv')}
                className={`h-8 px-3 text-[11px] ${modo === 'csv' ? 'bg-pink-600 font-bold text-white hover:bg-pink-500' : 'border-white/15 bg-transparent text-zinc-300 hover:bg-white/10'}`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" /> Importar CSV
              </Button>
            </div>
          </div>

          {modo === 'manual' ? (
            <>
              <Textarea
                id="nueva-ind-manual"
                value={manualTexto}
                onChange={(e) => setManualTexto(e.target.value)}
                rows={5}
                placeholder={'Un alumno por línea:\nMaría Quispe\nJuan Pérez\n(junto al nombre, opcional: usuario,Nombre)'}
                className="border-white/10 bg-black/30 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
              <p className="mt-1 text-[10px] text-zinc-500">
                El usuario de acceso se genera del nombre (sin espacios ni tildes) y la clave inicial es <b>321</b>.
              </p>
            </>
          ) : (
            <>
              <input
                ref={inputCsv}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) setCsvTexto(await file.text())
                }}
              />
              <div className="mb-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inputCsv.current?.click()}
                  className="h-9 border-white/15 bg-white/5 text-xs font-bold text-zinc-200 hover:bg-white/10"
                >
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Elegir archivo .csv
                </Button>
                <span className="self-center text-[10px] text-zinc-500">
                  Columnas detectadas: <b>nombre</b> (obligatoria) · usuario · empresa/grupo/equipo · correo
                </span>
              </div>
              <Textarea
                id="nueva-ind-csv"
                value={csvTexto}
                onChange={(e) => setCsvTexto(e.target.value)}
                rows={5}
                placeholder={'O pega el CSV aquí:\nnombre,usuario,empresa\nMaría Quispe,maria,Empresa 1\nJuan Pérez,juan,Empresa 2'}
                className="border-white/10 bg-black/30 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
              />
            </>
          )}

          <Button
            type="button"
            onClick={procesarAlumnos}
            className="mt-2 h-9 w-full border border-pink-400/40 bg-pink-500/20 text-xs font-black text-pink-100 hover:bg-pink-500/30"
          >
            <Wand2 className="h-4 w-4" aria-hidden="true" /> Procesar alumnos y repartir
          </Button>

          {alumnos && alumnos.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-zinc-300">
                  {alumnos.length} alumno(s) → {empresasLista.length} empresa(s)
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={repartirTodo}
                  className="h-7 border border-white/15 bg-white/5 px-2 text-[10px] font-bold text-zinc-200 hover:bg-white/10"
                >
                  🔀 Repartir parejo
                </Button>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 pacha-scroll">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Usuario</TableHead>
                      <TableHead className="text-zinc-400">Nombre</TableHead>
                      <TableHead className="text-zinc-400">Empresa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alumnos.map((a, i) => (
                      <TableRow key={`${a.usuario}-${i}`} className="border-white/5">
                        <TableCell className="text-xs font-bold text-zinc-100">{a.usuario}</TableCell>
                        <TableCell className="text-xs text-zinc-300">{a.nombre}</TableCell>
                        <TableCell>
                          <Select
                            value={a.empresa || undefined}
                            onValueChange={(v) => {
                              setAlumnos((prev) => (prev ?? []).map((f, j) => (j === i ? { ...f, empresa: v } : f)))
                            }}
                          >
                            <SelectTrigger size="sm" aria-label={`Empresa de ${a.nombre}`} className="h-7 w-[150px] border-white/10 bg-black/40 text-[11px] text-zinc-100">
                              <SelectValue placeholder="— elegir —" />
                            </SelectTrigger>
                            <SelectContent className="border-white/10 bg-[#1c1528] text-zinc-100">
                              {empresasLista.map((e) => (
                                <SelectItem key={e} value={e}>
                                  {e}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
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
  )
}

/* ============ Panel principal ============ */

export function ProfesorPanel({ usuario, onLogout }: { usuario: UsuarioSesion; onLogout: () => void }) {
  const [industrias, setIndustrias] = useState<ProfesorIndustria[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [abrirNueva, setAbrirNueva] = useState(false)
  const [creando, setCreando] = useState(false)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [aprobandoId, setAprobandoId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.profesorEstado()
      setIndustrias(data.industrias)
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

  const enviosPendientes = industrias
    .filter((i) => i.estado === 'ACTIVA')
    .reduce((s, i) => s + i.equipos.filter((e) => e.decisionEstado === 'ENVIADA').length, 0)

  async function procesar(ind: ProfesorIndustria) {
    setProcesandoId(ind.id)
    try {
      const r = await api.procesarRonda(ind.id)
      toast({
        title: r.finalizada ? '🏆 ¡Simulación finalizada!' : `✅ Año ${r.anioProcesado} simulado`,
        description: r.finalizada
          ? `Ventas del mercado: ${Math.round(r.ventasTotales).toLocaleString('es-BO')}k unidades · ¡Revisen el podio final!`
          : `Ventas del mercado: ${Math.round(r.ventasTotales).toLocaleString('es-BO')}k unidades · La industria avanza al Año ${r.anioNuevo}. Los reportes ya están disponibles.`,
      })
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo correr la simulación', description: msg(e), variant: 'destructive' })
    } finally {
      setProcesandoId(null)
    }
  }

  async function aprobar(decisionId: string, aprobada: boolean) {
    setAprobandoId(decisionId)
    try {
      await api.aprobarDecision(decisionId, aprobada)
      toast({
        title: aprobada ? '✅ Visto bueno dado' : '↩️ Visto bueno retirado',
        description: aprobada
          ? 'La empresa ya está lista para correr la simulación.'
          : 'El equipo podrá corregir y reenviar su decisión.',
      })
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo actualizar', description: msg(e), variant: 'destructive' })
    } finally {
      setAprobandoId(null)
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

  const primera = industrias[0]

  return (
    <div className="pacha-bg flex min-h-screen flex-col text-zinc-100">
      <Hud
        titulo="Panel del Profesor"
        subtitulo={primera ? primera.nombre : 'Simulaciones'}
        anioActual={primera?.anioActual ?? 0}
        anioMaximo={primera?.anioMaximo ?? 10}
        estadoIndustria={primera?.estado}
        jugador={{ nombre: usuario.nombre, rol: 'PROFESOR' }}
        stats={[
          { label: 'Simulaciones', valor: String(industrias.length), color: 'text-pink-300' },
          { label: 'Empresas', valor: String(industrias.reduce((s, i) => s + i.equipos.length, 0)), color: 'text-emerald-300' },
          { label: 'Por revisar', valor: String(enviosPendientes), color: enviosPendientes > 0 ? 'text-amber-300' : 'text-zinc-200' },
        ]}
        onLogout={onLogout}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6">
        <motion.div key="profesor" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">🎮 Tus simulaciones</h2>
              <p className="mt-0.5 text-sm text-zinc-400">
                Crea industrias con comités de gerentes, revisa las decisiones, da el visto bueno y corre cada año.
              </p>
            </div>
            <Dialog open={abrirNueva} onOpenChange={setAbrirNueva}>
              <DialogTrigger asChild>
                <Button className="pacha-btn-game h-11 bg-gradient-to-r from-pink-500 to-amber-500 font-black uppercase tracking-wide text-white hover:from-pink-400 hover:to-amber-400">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Nueva simulación
                </Button>
              </DialogTrigger>
              <DialogoNuevaSimulacion abierta={abrirNueva} onOpenChange={setAbrirNueva} onCreada={refresh} />
            </Dialog>
          </div>

          {industrias.length === 0 ? (
            <div className="pacha-panel flex min-h-[240px] flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-5xl" aria-hidden="true">🍦</p>
              <p className="max-w-sm text-sm text-zinc-400">
                Aún no tienes simulaciones. Crea la primera industria, importa tus alumnos por CSV y forma los comités.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {industrias.map((ind) => (
                <TarjetaIndustria
                  key={ind.id}
                  ind={ind}
                  procesando={procesandoId === ind.id}
                  aprobandoId={aprobandoId}
                  onProcesar={procesar}
                  onAprobar={aprobar}
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
