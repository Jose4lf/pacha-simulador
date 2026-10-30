'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, type UsuarioSesion } from '@/lib/pacha/api-client'
import { LoginScreen, SplashCarga } from '@/components/game/login-screen'
import { AlumnoApp } from '@/components/game/alumno-app'
import { ProfesorPanel } from '@/components/game/profesor-panel'
import { DecanoPanel } from '@/components/game/decano-panel'

export default function PachaPage() {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargarSesion = useCallback(async () => {
    try {
      const data = await api.session()
      setUsuario(data.usuario)
    } catch {
      setUsuario(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarSesion()
  }, [cargarSesion])

  async function salir() {
    try {
      await api.logout()
    } finally {
      setUsuario(null)
    }
  }

  if (cargando) return <SplashCarga />
  if (!usuario) return <LoginScreen onLogin={setUsuario} />

  if (usuario.rol === 'ALUMNO') {
    return <AlumnoApp usuario={usuario} onLogout={salir} />
  }
  if (usuario.rol === 'PROFESOR') {
    return <ProfesorPanel usuario={usuario} onLogout={salir} />
  }
  return <DecanoPanel usuario={usuario} onLogout={salir} />
}
