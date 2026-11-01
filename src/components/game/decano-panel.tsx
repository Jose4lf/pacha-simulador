'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Factory, GraduationCap, KeyRound, Loader2, Plus, Shield, Trash2, UserCog, Users } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { api, type DecanoEstado, type UsuarioSesion } from '@/lib/pacha/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Hud } from '@/components/game/hud'
import { SplashCarga } from '@/components/game/login-screen'

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')

const FECHA_FMT = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

function BadgeRol({ rol }: { rol: string }) {
  if (rol === 'DECANO') {
    return (
      <Badge className="border border-amber-400/40 bg-amber-400/15 text-[10px] font-bold text-amber-300">
        <Shield className="mr-1 h-3 w-3" aria-hidden="true" /> Decano
      </Badge>
    )
  }
  if (rol === 'PROFESOR') {
    return (
      <Badge className="border border-purple-400/40 bg-purple-400/15 text-[10px] font-bold text-purple-300">
        <GraduationCap className="mr-1 h-3 w-3" aria-hidden="true" /> Profesor
      </Badge>
    )
  }
  return (
    <Badge className="border border-emerald-400/40 bg-emerald-400/15 text-[10px] font-bold text-emerald-300">
      <Users className="mr-1 h-3 w-3" aria-hidden="true" /> Alumno
    </Badge>
  )
}

function TarjetaStat({
  icono,
  label,
  valor,
  colorIcono,
  borde,
}: {
  icono: React.ReactNode
  label: string
  valor: number
  colorIcono: string
  borde: string
}) {
  return (
    <div className={`pacha-panel p-4 sm:p-5 ${borde}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/30 ring-1 ring-white/10 ${colorIcono}`}>
          {icono}
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
          <p className="text-2xl font-black text-zinc-50">{valor.toLocaleString('es-BO')}</p>
        </div>
      </div>
    </div>
  )
}

export function DecanoPanel({ usuario, onLogout }: { usuario: UsuarioSesion; onLogout: () => void }) {
  const [data, setData] = useState<DecanoEstado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [abrirCrear, setAbrirCrear] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [passwordNuevo, setPasswordNuevo] = useState('321')
  const [rolNuevo, setRolNuevo] = useState('ALUMNO')
  const [creando, setCreando] = useState(false)
  const [reseteando, setReseteando] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<{ id: string; nombre: string } | null>(null)
  const [borrando, setBorrando] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const d = await api.decanoEstado()
      setData(d)
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

  async function crearUsuario() {
    if (!nombreNuevo.trim() || !passwordNuevo.trim()) {
      toast({
        title: 'Faltan datos',
        description: 'Escribe el nombre y la contraseña del nuevo usuario.',
        variant: 'destructive',
      })
      return
    }
    setCreando(true)
    try {
      await api.crearUsuario(nombreNuevo.trim(), passwordNuevo.trim(), rolNuevo)
      toast({
        title: '✅ Usuario creado',
        description: `"${nombreNuevo.trim()}" ya puede iniciar sesión como ${rolNuevo.toLowerCase()}.`,
      })
      setAbrirCrear(false)
      setNombreNuevo('')
      setPasswordNuevo('321')
      setRolNuevo('ALUMNO')
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo crear el usuario', description: msg(e), variant: 'destructive' })
    } finally {
      setCreando(false)
    }
  }

  async function resetPassword(id: string, nombre: string) {
    setReseteando(id)
    try {
      const r = await api.resetPassword(id)
      toast({
        title: '🔑 Contraseña reseteada',
        description: `La contraseña de ${nombre} ahora es ${r.nueva}.`,
      })
    } catch (e) {
      toast({ title: 'No se pudo resetear', description: msg(e), variant: 'destructive' })
    } finally {
      setReseteando(null)
    }
  }

  /** Elimina un alumno o profesor del sistema (con confirmación). */
  async function eliminarUsuario() {
    if (!eliminando) return
    setBorrando(true)
    try {
      const r = await api.eliminarUsuario(eliminando.id)
      toast({
        title: '🗑️ Usuario eliminado',
        description: `«${r.nombre}» ya no puede iniciar sesión.`,
      })
      setEliminando(null)
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo eliminar', description: msg(e), variant: 'destructive' })
    } finally {
      setBorrando(false)
    }
  }

  if (cargando) return <SplashCarga />

  if (error || !data) {
    return (
      <div className="pacha-bg flex min-h-screen flex-col items-center justify-center px-4 text-zinc-100">
        <div className="pacha-panel w-full max-w-md p-8 text-center">
          <p className="mb-3 text-5xl" aria-hidden="true">🛡️</p>
          <h1 className="mb-2 text-xl font-black">No pudimos cargar el rectorado</h1>
          <p role="alert" className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error ?? 'Error desconocido'}
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
        titulo="Rectorado · Decanato"
        subtitulo={usuario.nombre}
        jugador={{ nombre: usuario.nombre, rol: 'DECANO' }}
        stats={[
          { label: 'Usuarios', valor: String(data.stats.totalUsuarios), color: 'text-pink-300' },
          { label: 'Profesores', valor: String(data.stats.profesores), color: 'text-purple-300' },
          { label: 'Alumnos', valor: String(data.stats.alumnos), color: 'text-emerald-300' },
          { label: 'Simulaciones', valor: String(data.stats.simulaciones), color: 'text-amber-300' },
        ]}
        onLogout={onLogout}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
          {/* Estadísticas */}
          <section aria-label="Estadísticas generales" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TarjetaStat
              icono={<Users className="h-5 w-5" aria-hidden="true" />}
              label="Usuarios totales"
              valor={data.stats.totalUsuarios}
              colorIcono="text-pink-300"
              borde=""
            />
            <TarjetaStat
              icono={<UserCog className="h-5 w-5" aria-hidden="true" />}
              label="Profesores"
              valor={data.stats.profesores}
              colorIcono="text-purple-300"
              borde=""
            />
            <TarjetaStat
              icono={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
              label="Alumnos"
              valor={data.stats.alumnos}
              colorIcono="text-emerald-300"
              borde=""
            />
            <TarjetaStat
              icono={<Factory className="h-5 w-5" aria-hidden="true" />}
              label="Simulaciones"
              valor={data.stats.simulaciones}
              colorIcono="text-amber-300"
              borde=""
            />
          </section>

          {/* Usuarios */}
          <section aria-label="Gestión de usuarios" className="pacha-panel p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-zinc-100">👥 Usuarios</h2>
                <p className="text-xs text-zinc-500">Crea cuentas y resetea contraseñas cuando un alumno las olvide.</p>
              </div>
              <Dialog open={abrirCrear} onOpenChange={setAbrirCrear}>
                <DialogTrigger asChild>
                  <Button className="pacha-btn-game h-10 bg-gradient-to-r from-pink-500 to-amber-500 font-black text-white hover:from-pink-400 hover:to-amber-400">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Crear usuario
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-white/10 bg-[#1c1528] text-zinc-100 sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-zinc-100">➕ Nuevo usuario</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                      La contraseña por defecto del sistema es <b className="text-zinc-200">321</b>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="nuevo-usuario-nombre" className="text-zinc-300">
                        Nombre de usuario
                      </Label>
                      <Input
                        id="nuevo-usuario-nombre"
                        value={nombreNuevo}
                        onChange={(e) => setNombreNuevo(e.target.value)}
                        placeholder="Ej: maria"
                        className="h-10 border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="nuevo-usuario-pass" className="text-zinc-300">
                        Contraseña
                      </Label>
                      <Input
                        id="nuevo-usuario-pass"
                        value={passwordNuevo}
                        onChange={(e) => setPasswordNuevo(e.target.value)}
                        className="h-10 border-white/10 bg-black/30 text-zinc-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="nuevo-usuario-rol" className="text-zinc-300">
                        Rol
                      </Label>
                      <Select value={rolNuevo} onValueChange={setRolNuevo}>
                        <SelectTrigger id="nuevo-usuario-rol" className="h-10 w-full border-white/10 bg-black/40 text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#1c1528] text-zinc-100">
                          <SelectItem value="ALUMNO">Alumno</SelectItem>
                          <SelectItem value="PROFESOR">Profesor</SelectItem>
                          <SelectItem value="DECANO">Decano</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => void crearUsuario()}
                      disabled={creando}
                      className="pacha-btn-game h-11 w-full bg-gradient-to-r from-pink-500 to-amber-500 font-black uppercase tracking-wide text-white hover:from-pink-400 hover:to-amber-400 sm:w-auto"
                    >
                      {creando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : '➕ Crear'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Nombre</TableHead>
                    <TableHead className="text-zinc-400">Rol</TableHead>
                    <TableHead className="text-zinc-400">Fecha de alta</TableHead>
                    <TableHead className="text-right text-zinc-400">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.usuarios.map((u) => (
                    <TableRow key={u.id} className="border-white/5">
                      <TableCell className="text-xs font-bold text-zinc-100">{u.nombre}</TableCell>
                      <TableCell>
                        <BadgeRol rol={u.rol} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-zinc-400">
                        {FECHA_FMT.format(new Date(u.createdAt))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void resetPassword(u.id, u.nombre)}
                            disabled={reseteando === u.id}
                            aria-label={`Resetear contraseña de ${u.nombre}`}
                            className="h-8 border-white/15 bg-white/5 text-xs font-bold text-zinc-200 hover:bg-white/10"
                          >
                            {reseteando === u.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            🔑 Reset 321
                          </Button>
                          {u.rol !== 'DECANO' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEliminando({ id: u.id, nombre: u.nombre })}
                              aria-label={`Eliminar a ${u.nombre}`}
                              className="h-8 border-red-400/30 bg-red-500/10 px-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">Eliminar</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Simulaciones */}
          <section aria-label="Simulaciones de la institución" className="pacha-panel p-4 sm:p-6">
            <h2 className="text-lg font-black text-zinc-100">🏭 Simulaciones</h2>
            <p className="mb-4 text-xs text-zinc-500">Todas las industrias activas en la institución.</p>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Industria</TableHead>
                    <TableHead className="text-zinc-400">Profesor</TableHead>
                    <TableHead className="text-zinc-400">Año</TableHead>
                    <TableHead className="text-zinc-400">Estado</TableHead>
                    <TableHead className="text-right text-zinc-400">Equipos</TableHead>
                    <TableHead className="text-zinc-400">Líder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.industrias.map((i) => (
                    <TableRow key={i.id} className="border-white/5">
                      <TableCell className="whitespace-nowrap text-xs font-bold text-zinc-100">🍦 {i.nombre}</TableCell>
                      <TableCell className="text-xs text-purple-300">{i.profesor}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-bold text-amber-300">
                        {i.anioActual}/{i.anioMaximo}
                      </TableCell>
                      <TableCell>
                        {i.estado === 'ACTIVA' ? (
                          <Badge className="animate-pulse border border-emerald-400/40 bg-emerald-400/15 text-[10px] font-black text-emerald-300">
                            ● Activa
                          </Badge>
                        ) : (
                          <Badge className="border border-zinc-400/30 bg-zinc-400/10 text-[10px] font-black text-zinc-300">
                            ■ Finalizada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-zinc-200">{i.numEquipos}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-zinc-200">
                        {i.lider ? (
                          <span className="font-bold text-amber-300">🥇 {i.lider}</span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.industrias.length === 0 && (
                    <TableRow className="border-white/5">
                      <TableCell colSpan={6} className="py-8 text-center text-xs text-zinc-500">
                        Aún no hay simulaciones creadas en la institución.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </motion.div>
      </main>

      <footer className="mt-auto border-t border-white/5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] text-zinc-500">
        PACHA Simulador · Markestrat · Industria de helados
      </footer>

      {/* Confirmación de eliminación de usuario */}
      <AlertDialog open={eliminando !== null} onOpenChange={(v) => !v && setEliminando(null)}>
        <AlertDialogContent className="border-white/10 bg-[#1c1528] text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              ¿Eliminar a «{eliminando?.nombre}»?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              El usuario dejará de poder iniciar sesión y perderá su cargo en la empresa. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-zinc-100">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void eliminarUsuario()}
              disabled={borrando}
              className="bg-red-600 font-black text-white hover:bg-red-500"
            >
              {borrando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : '🗑️ Sí, eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
