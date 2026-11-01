'use client'

// Selector de diseño de PACHA: alterna entre el tema nocturno original ("noche")
// y el tema pastel manuscrito ("tinta"). El estado se guarda en localStorage y se
// aplica como atributo data-theme en <html> (los estilos viven en globals.css).

import { useCallback, useSyncExternalStore } from 'react'
import { Moon, Palette } from 'lucide-react'

export type Tema = 'noche' | 'tinta'

const STORAGE_KEY = 'pacha_tema'

export function aplicarTema(tema: Tema): void {
  try {
    if (tema === 'tinta') {
      document.documentElement.dataset.theme = 'tinta'
    } else {
      delete document.documentElement.dataset.theme
    }
    localStorage.setItem(STORAGE_KEY, tema)
  } catch {
    // almacenamiento no disponible: aplicar solo en vivo
  }
}

/** Snapshot del tema actual leído del atributo en <html>. */
function obtenerTema(): Tema {
  return document.documentElement.dataset.theme === 'tinta' ? 'tinta' : 'noche'
}

const TEMA_SERVIDOR: Tema = 'noche'

/** Observa cambios del atributo data-theme en <html> y en otros pestañas. */
function suscribirseATema(notificar: () => void): () => void {
  const observador = new MutationObserver(notificar)
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  window.addEventListener('storage', notificar)
  return () => {
    observador.disconnect()
    window.removeEventListener('storage', notificar)
  }
}

/** Botón circular que alterna el diseño. Autocontenido, sin props. */
export function BotonTema({ className = '' }: { className?: string }) {
  const tema = useSyncExternalStore(suscribirseATema, obtenerTema, () => TEMA_SERVIDOR)

  const alternar = useCallback(() => {
    aplicarTema(obtenerTema() === 'tinta' ? 'noche' : 'tinta')
  }, [])

  const activo = tema === 'tinta'

  return (
    <button
      type="button"
      onClick={alternar}
      title={activo ? 'Cambiar a diseño nocturno' : 'Cambiar a diseño cuaderno pastel'}
      aria-label={activo ? 'Cambiar a diseño nocturno' : 'Cambiar a diseño cuaderno pastel'}
      className={`pacha-btn-tema ${className}`}
    >
      {activo ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Palette className="h-4 w-4" aria-hidden="true" />}
    </button>
  )
}
