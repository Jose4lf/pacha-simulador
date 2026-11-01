'use client'

// ============================================================
// PACHA Simulador · Panel «Mi área» del gerente
// Sub-pestañas: editor de decisiones de SU área, reportes contables
// del área (números, tablas y gráficos) y el permiso para abrir el
// acceso al resto del comité.
// ============================================================

import { useState } from 'react'
import { BarChart3, Loader2, Lock, LockOpen, SlidersHorizontal, Users } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { api, type AlumnoEstado } from '@/lib/pacha/api-client'
import { Button } from '@/components/ui/button'
import { AlumnoDecisiones } from '@/components/game/alumno/decisiones'
import { ReportesArea } from '@/components/game/alumno/area-reportes'

type Sub = 'editor' | 'reportes'

export function PanelMiArea({ estado, refresh }: { estado: AlumnoEstado; refresh: () => Promise<void> | void }) {
  const [sub, setSub] = useState<Sub>('editor')
  const [cambiando, setCambiando] = useState(false)

  const miCargo = estado.membresia?.cargo ?? null
  const cargo = estado.cargos.find((c) => c.id === miCargo)
  const permisoAbierto = estado.permisos.find((p) => p.cargo === miCargo)?.abierto ?? false

  async function alternarPermiso() {
    if (!miCargo) return
    setCambiando(true)
    try {
      const r = await api.cambiarPermisoArea(miCargo, !permisoAbierto)
      toast({
        title: r.abierto ? '🔓 Área abierta al equipo' : '🔒 Área cerrada',
        description: r.abierto
          ? 'Tus compañeros del comité ya pueden trabajar en esta área contigo.'
          : 'Solo tú puedes volver a trabajar en esta área.',
      })
      await refresh()
    } catch (e) {
      toast({ title: 'No se pudo cambiar el permiso', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setCambiando(false)
    }
  }

  if (!miCargo || !cargo) {
    return (
      <div className="pacha-panel p-6 text-center text-sm text-zinc-400">
        No tienes un cargo asignado en el comité todavía. Pide al profesor que te asigne un área.
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">
            <span className="mr-1" aria-hidden="true">{cargo.emoji}</span> Mi área ·{' '}
            <span className="pacha-title-shine">{cargo.nombre}</span>
          </h2>
          <p className="mt-0.5 text-sm text-zinc-400">{cargo.descripcion}</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void alternarPermiso()}
          disabled={cambiando}
          title={permisoAbierto ? 'Cerrar el acceso del equipo a tu área' : 'Permitir que tu equipo trabaje en tu área'}
          className={`h-9 border px-3 text-[11px] font-bold ${
            permisoAbierto
              ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25'
              : 'border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10'
          }`}
        >
          {cambiando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : permisoAbierto ? (
            <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {permisoAbierto ? 'Equipo con acceso · cerrar' : 'Abrir mi área al equipo'}
        </Button>
      </div>

      {/* Sub-pestañas del área */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones de mi área">
        <button
          type="button"
          role="tab"
          aria-selected={sub === 'editor'}
          onClick={() => setSub('editor')}
          className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
            sub === 'editor'
              ? 'border-pink-400/40 bg-pink-400/15 text-zinc-100'
              : 'border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> ✏️ Decisiones de mi área
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sub === 'reportes'}
          onClick={() => setSub('reportes')}
          className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
            sub === 'reportes'
              ? 'border-pink-400/40 bg-pink-400/15 text-zinc-100'
              : 'border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> 📊 Reportes contables del área
        </button>
        <span className="ml-auto hidden items-center gap-1 text-[10px] text-zinc-500 sm:flex">
          <Users className="h-3 w-3" aria-hidden="true" />
          {permisoAbierto ? 'Tu equipo puede colaborar en esta área' : 'Área privada: solo tú la trabajas'}
        </span>
      </div>

      {sub === 'editor' ? (
        <AlumnoDecisiones estado={estado} refresh={refresh} soloMiArea />
      ) : (
        <ReportesArea estado={estado} cargo={miCargo} />
      )}
    </div>
  )
}
