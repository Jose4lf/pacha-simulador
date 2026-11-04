'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, CalendarDays, FlaskConical, Microscope, SlidersHorizontal, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Hud } from '@/components/game/hud'
import { SplashCarga } from '@/components/game/login-screen'
import { AlumnoDecisiones } from '@/components/game/alumno/decisiones'
import { AlumnoComite } from '@/components/game/alumno/comite'
import { AlumnoEstudios } from '@/components/game/alumno/estudios'
import { AlumnoProyectos } from '@/components/game/alumno/proyectos'
import { AlumnoReportes } from '@/components/game/alumno/reportes'
import { AlumnoEventos } from '@/components/game/alumno/eventos-alumno'
import { AlumnoRanking } from '@/components/game/alumno/ranking'
import { api, type AlumnoEstado, type UsuarioSesion } from '@/lib/pacha/api-client'

/** Formato compacto para el HUD: 12345 → "12.3k". */
const fmtCompacto = (v: number): string => {
  const abs = Math.abs(v)
  if (abs >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return Math.round(v).toLocaleString('es-BO')
}

/** Pantalla del estudiante SIN DESIGNAR: la simulación fue eliminada (o aún
 * no fue asignado). Su cuenta sigue activa y verá esta vista hasta que el
 * docente lo asigne a una empresa. */
function PantallaSinDesignar({ usuario, onLogout, onReintentar }: { usuario: UsuarioSesion; onLogout: () => void; onReintentar: () => void }) {
  return (
    <div className="pacha-bg flex min-h-screen flex-col items-center justify-center px-4 text-zinc-100">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="pacha-panel pacha-pop w-full max-w-md p-8 text-center"
      >
        <p className="mb-3 text-5xl" aria-hidden="true">🪑</p>
        <h1 className="mb-1 text-xl font-black">Estado: Sin designar</h1>
        <p className="mb-4 text-sm text-zinc-400">
          Hola <b className="text-zinc-200">{usuario.nombre}</b>: tu cuenta está activa, pero de momento
          <b className="text-amber-300"> no perteneces a ninguna empresa</b>.
        </p>
        <p
          role="status"
          className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200"
        >
          Si tu profesor eliminó la simulación, el grupo quedó sin designación. Espera a que el docente te
          asigne a una nueva empresa para volver a jugar.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={onReintentar}
            variant="outline"
            className="h-11 flex-1 border-white/15 bg-white/5 font-bold text-zinc-200 hover:bg-white/10"
          >
            🔄 Revisar de nuevo
          </Button>
          <Button
            onClick={onLogout}
            className="pacha-btn-game h-11 flex-1 bg-gradient-to-r from-pink-500 to-amber-500 text-base font-black uppercase tracking-wide text-white hover:from-pink-400 hover:to-amber-400"
          >
            Cerrar sesión
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

export function AlumnoApp({ usuario, onLogout }: { usuario: UsuarioSesion; onLogout: () => void }) {
  const [estado, setEstado] = useState<AlumnoEstado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('decisiones')

  const refresh = useCallback(async () => {
    try {
      const data = await api.alumnoEstado()
      setEstado(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar tu partida')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (cargando) return <SplashCarga />

  if (error || !estado) {
    return (
      <div className="pacha-bg flex min-h-screen flex-col items-center justify-center px-4 text-zinc-100">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="pacha-panel pacha-pop w-full max-w-md p-8 text-center"
        >
          <p className="mb-3 text-5xl" aria-hidden="true">🍦</p>
          <h1 className="mb-2 text-xl font-black">Ups… no puedes entrar a la partida</h1>
          <p
            role="alert"
            className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {error ?? 'No se pudo cargar el estado del juego.'}
          </p>
          <Button
            onClick={onLogout}
            className="pacha-btn-game h-11 w-full bg-gradient-to-r from-pink-500 to-amber-500 text-base font-black uppercase tracking-wide text-white hover:from-pink-400 hover:to-amber-400"
          >
            Cerrar sesión
          </Button>
        </motion.div>
      </div>
    )
  }

  // SIN DESIGNAR: sin membresía (simulación eliminada o aún sin asignación)
  if (estado.designado === false || !estado.membresia) {
    return <PantallaSinDesignar usuario={usuario} onLogout={onLogout} onReintentar={() => void refresh()} />
  }

  const { equipo, industria } = estado
  const contribucionTotal = estado.reportes.reduce((s, r) => s + r.contribucion, 0)
  const ultimoReporte = estado.reportes.length > 0 ? estado.reportes[estado.reportes.length - 1] : null
  const filaPropia = estado.ranking.find((r) => r.equipoId === equipo.id)
  const medalla =
    filaPropia?.posicion === 1 ? '🥇' : filaPropia?.posicion === 2 ? '🥈' : filaPropia?.posicion === 3 ? '🥉' : ''
  const proyectosActivos = estado.proyectos.filter((p) => p.estado === 'EN_DESARROLLO').length
  const finalizada = industria.estado === 'FINALIZADA'
  const esRepresentante = estado.membresia.esRepresentante
  const decisionEstado = estado.decision?.estado ?? null
  const eventosAnioActual = estado.eventos.filter((e) => e.anio === industria.anioActual)

  const tabs = [
    {
      id: 'decisiones',
      nombre: 'Decisiones',
      icono: <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />,
      badge: esRepresentante && decisionEstado === null ? 1 : undefined,
    },
    {
      id: 'comite',
      nombre: 'Grupo',
      icono: <Users className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'eventos',
      nombre: 'Eventos',
      icono: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
      badge: eventosAnioActual.length > 0 ? eventosAnioActual.length : undefined,
    },
    { id: 'estudios', nombre: 'Estudios', icono: <Microscope className="h-4 w-4" aria-hidden="true" /> },
    {
      id: 'proyectos',
      nombre: 'I+D',
      icono: <FlaskConical className="h-4 w-4" aria-hidden="true" />,
      badge: proyectosActivos,
    },
    { id: 'reportes', nombre: 'Reportes', icono: <BarChart3 className="h-4 w-4" aria-hidden="true" /> },
    { id: 'ranking', nombre: 'Ranking', icono: <Trophy className="h-4 w-4" aria-hidden="true" /> },
  ]

  return (
    <div className="pacha-bg flex min-h-screen flex-col text-zinc-100">
      <Hud
        titulo={equipo.nombre}
        subtitulo={`${industria.nombre} · ${esRepresentante ? '👑 GERENTE de la empresa' : 'Integrante'}`}
        anioActual={industria.anioActual}
        anioMaximo={industria.anioMaximo}
        estadoIndustria={industria.estado}
        jugador={{ nombre: usuario.nombre, color: equipo.color }}
        stats={[
          {
            label: 'Contribución',
            valor: `Bs ${fmtCompacto(contribucionTotal)}`,
            color: contribucionTotal >= 0 ? 'text-emerald-300' : 'text-red-300',
          },
          {
            label: 'Cuota',
            valor: `${(ultimoReporte?.participacion ?? 0).toFixed(1)}%`,
            color: 'text-amber-300',
          },
          {
            label: 'Puesto',
            valor: `${medalla}#${filaPropia?.posicion ?? '—'}`,
          },
          { label: 'I+D', valor: String(proyectosActivos), color: 'text-purple-300' },
        ]}
        tabs={tabs}
        tabActiva={tab}
        onTab={setTab}
        onLogout={onLogout}
      />

      {finalizada && (
        <div className="mx-auto w-full max-w-7xl px-3 pt-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-center text-sm font-bold text-amber-200"
          >
            🏆 Simulación finalizada — ve al Ranking a ver el podio final
          </motion.div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {tab === 'decisiones' && <AlumnoDecisiones estado={estado} refresh={refresh} />}
          {tab === 'comite' && <AlumnoComite estado={estado} refresh={refresh} />}
          {tab === 'eventos' && <AlumnoEventos estado={estado} />}
          {tab === 'estudios' && <AlumnoEstudios estado={estado} />}
          {tab === 'proyectos' && <AlumnoProyectos estado={estado} refresh={refresh} />}
          {tab === 'reportes' && <AlumnoReportes estado={estado} />}
          {tab === 'ranking' && <AlumnoRanking estado={estado} />}
        </motion.div>
      </main>

      <footer className="mt-auto border-t border-white/5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] text-zinc-500">
        PACHA Simulador · Markestrat · Industria de helados
      </footer>
    </div>
  )
}
