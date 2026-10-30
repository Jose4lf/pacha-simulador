'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, type UsuarioSesion } from '@/lib/pacha/api-client'
import { Loader2, Play, IceCream2, Shield, UserCog } from 'lucide-react'

const DEMO = [
  { rol: 'Decano', usuario: 'Admin', icono: '🛡️' },
  { rol: 'Profesor', usuario: 'profe', icono: '🎓' },
  { rol: 'Alumno', usuario: 'colibri', icono: '🐦' },
  { rol: 'Alumno', usuario: 'kallpa', icono: '⚡' },
  { rol: 'Alumno', usuario: 'inti', icono: '☀️' },
  { rol: 'Alumno', usuario: 'pachamama', icono: '🌍' },
]

export function LoginScreen({ onLogin }: { onLogin: (u: UsuarioSesion) => void }) {
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function entrar(u: string, p: string) {
    setCargando(true)
    setError(null)
    try {
      const usuario = await api.login(u, p)
      onLogin(usuario)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="pacha-bg relative flex min-h-screen flex-col overflow-hidden text-white">
      {/* Emojis flotantes de fondo */}
      <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
        {['🍦', '🍨', '🧁', '🍧', '🍭'].map((e, i) => (
          <span
            key={i}
            className="pacha-float absolute text-6xl opacity-15 md:text-8xl"
            style={{
              left: `${8 + i * 21}%`,
              top: `${i % 2 === 0 ? 12 : 66}%`,
              animationDelay: `${i * 0.8}s`,
            }}
          >
            {e}
          </span>
        ))}
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <IceCream2 className="h-10 w-10 text-pink-400" aria-hidden="true" />
              <h1 className="pacha-title-shine text-5xl font-black tracking-tight md:text-6xl">PACHA</h1>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
              Simulador de Marketing · Helados · Bolivia
            </p>
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">5 segmentos</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">3 canales</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Año 0 → 10</span>
            </div>
          </div>

          {/* Tarjeta de login */}
          <form
            className="pacha-panel pacha-pop p-6 shadow-2xl backdrop-blur"
            onSubmit={(e) => {
              e.preventDefault()
              void entrar(nombre, password)
            }}
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-100">
              <Play className="h-4 w-4 text-emerald-400" aria-hidden="true" /> Iniciar partida
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="usuario" className="text-zinc-300">Usuario</Label>
                <Input
                  id="usuario"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: colibri"
                  autoComplete="username"
                  className="h-11 border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••"
                  autoComplete="current-password"
                  className="h-11 border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={cargando}
                className="pacha-btn-game h-12 w-full bg-gradient-to-r from-pink-500 to-amber-500 text-base font-black uppercase tracking-wide text-white hover:from-pink-400 hover:to-amber-400"
              >
                {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : '▶ Jugar'}
              </Button>
            </div>
          </form>

          {/* Accesos demo */}
          <div className="mt-6">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Cuentas de demostración (contraseña: 321)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEMO.map((d) => (
                <button
                  key={d.usuario}
                  type="button"
                  onClick={() => void entrar(d.usuario, '321')}
                  disabled={cargando}
                  className="pacha-btn-game flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold text-zinc-300 hover:border-pink-400/40 hover:bg-white/10 disabled:opacity-50"
                >
                  <span aria-hidden="true">{d.icono}</span>
                  {d.usuario}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 mt-auto border-t border-white/5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] text-zinc-500">
        PACHA Simulador · industrias de helados · toma decisiones, compra estudios, innova en I+D y conquista el mercado
      </footer>
    </div>
  )
}

export function IconoRol({ rol }: { rol: string }) {
  if (rol === 'DECANO') return <Shield className="h-4 w-4 text-amber-400" aria-hidden="true" />
  if (rol === 'PROFESOR') return <UserCog className="h-4 w-4 text-purple-400" aria-hidden="true" />
  return <UserCog className="h-4 w-4 text-emerald-400" aria-hidden="true" />
}

export function SplashCarga() {
  return (
    <div className="pacha-bg flex min-h-screen flex-col items-center justify-center gap-4 text-white">
      <Loader2 className="h-10 w-10 animate-spin text-pink-400" aria-label="Cargando" />
      <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Cargando PACHA…</p>
    </div>
  )
}
