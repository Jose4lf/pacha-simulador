'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { IceCream2, LogOut } from 'lucide-react'
import { BotonTema } from '@/components/game/selector-tema'

export interface HudTab {
  id: string
  nombre: string
  icono: ReactNode
  badge?: number
  deshabilitado?: boolean
}

export interface HudStat {
  label: string
  valor: string
  color?: string // clase tailwind del texto del valor
}

interface HudProps {
  titulo: string
  subtitulo?: string
  anioActual?: number
  anioMaximo?: number
  estadoIndustria?: string
  jugador: { nombre: string; color?: string; rol?: string }
  stats: HudStat[]
  tabs?: HudTab[]
  tabActiva?: string
  onTab?: (id: string) => void
  onLogout: () => void
  children?: ReactNode
}

/** HUD superior estilo videojuego: año, stats del jugador y pestañas. */
export function Hud({
  titulo,
  subtitulo,
  anioActual,
  anioMaximo,
  estadoIndustria,
  jugador,
  stats,
  tabs,
  tabActiva,
  onTab,
  onLogout,
  children,
}: HudProps) {
  const progreso = anioActual !== undefined && anioMaximo ? Math.min(100, (anioActual / anioMaximo) * 100) : 0
  const finalizada = estadoIndustria === 'FINALIZADA'
  const mostrarAnio = anioActual !== undefined && anioMaximo !== undefined

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#140f1c]/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Logo + partida */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/30 to-amber-500/30 ring-1 ring-white/15">
              <IceCream2 className="h-5 w-5 text-pink-300" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-pink-400">PACHA</p>
              <p className="max-w-[180px] truncate text-sm font-bold text-zinc-100 sm:max-w-none">{titulo}</p>
              {subtitulo && <p className="max-w-[180px] truncate text-[11px] text-zinc-500 sm:max-w-none">{subtitulo}</p>}
            </div>
          </div>

          {/* Año / nivel (solo si la vista maneja años, p. ej. no aplica al decano) */}
          {mostrarAnio && (
          <div className="min-w-[120px] flex-1 sm:flex-none">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                {finalizada ? '🏆 Simulación finalizada' : `Año ${anioActual} / ${anioMaximo}`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 sm:w-44" role="progressbar" aria-valuenow={anioActual} aria-valuemin={0} aria-valuemax={anioMaximo}>
              <motion.div
                className={`h-full rounded-full ${finalizada ? 'bg-gradient-to-r from-amber-400 to-yellow-200' : 'bg-gradient-to-r from-pink-500 to-amber-400'}`}
                initial={false}
                animate={{ width: `${progreso}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
              />
            </div>
          </div>
          )}

          {/* Stats del jugador */}
          <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-center"
                title={s.label}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{s.label}</p>
                <p className={`text-sm font-black ${s.color ?? 'text-zinc-100'}`}>{s.valor}</p>
              </div>
            ))}
          </div>

          {/* Jugador + salir */}
          <div className="ml-auto flex items-center gap-2">
            {jugador.color && (
              <span className="hidden h-3 w-3 rounded-full sm:inline-block" style={{ backgroundColor: jugador.color }} aria-hidden="true" />
            )}
            <span className="hidden text-sm font-bold text-zinc-200 md:inline">{jugador.nombre}</span>
            <BotonTema />
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="h-9 w-9 text-zinc-400 hover:bg-white/10 hover:text-red-300"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Pestañas */}
        {tabs && tabActiva && onTab && (
          <nav className="pacha-scroll -mx-1 mt-2.5 flex gap-1 overflow-x-auto pb-1" aria-label="Secciones del juego">
            {tabs.map((t) => {
              const activa = t.id === tabActiva
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTab(t.id)}
                  disabled={t.deshabilitado}
                  className={`relative flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold transition-colors disabled:opacity-40 ${
                    activa ? 'bg-white/12 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                  aria-current={activa ? 'page' : undefined}
                >
                  {activa && (
                    <motion.span
                      layoutId="pacha-tab-pill"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-pink-500/25 to-amber-500/25 ring-1 ring-pink-400/40"
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {t.icono}
                    {t.nombre}
                    {typeof t.badge === 'number' && t.badge > 0 && (
                      <span className="ml-0.5 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                        {t.badge}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </nav>
        )}
      </div>
      {children}
    </header>
  )
}
