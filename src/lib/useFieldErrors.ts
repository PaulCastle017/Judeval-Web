import { useCallback, useState } from 'react'
import type { FieldErrors } from './validation'

/**
 * Errores de un formulario que se borran en cuanto se corrige el campo.
 * Antes solo se recalculaban al pulsar Guardar/Siguiente y el aviso seguía visible con el campo ya relleno.
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({})

  /** Quita el error de esos campos (no hace nada si no tenían). */
  const clearError = useCallback((...keys: string[]) => {
    setErrors((prev) => (keys.some((k) => k in prev) ? omit(prev, (k) => keys.includes(k)) : prev))
  }, [])

  /** Quita los errores cuyo nombre empieza por el prefijo (p. ej. «exercises.» al reordenar la lista). */
  const clearErrorsWithPrefix = useCallback((prefix: string) => {
    setErrors((prev) => (Object.keys(prev).some((k) => k.startsWith(prefix)) ? omit(prev, (k) => k.startsWith(prefix)) : prev))
  }, [])

  return { errors, setErrors, clearError, clearErrorsWithPrefix }
}

function omit(errors: FieldErrors, drop: (key: string) => boolean): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([k]) => !drop(k)))
}
