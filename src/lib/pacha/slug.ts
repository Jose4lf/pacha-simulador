/** Normaliza un nombre a nombre de usuario: minúsculas, sin espacios ni signos. */
export function slugUsuario(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
}
