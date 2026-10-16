// Renderiza el estado de una carga: spinner, error o mensaje vacío.
export default function Estado({ cargando, error, vacio, children }) {
  if (cargando) {
    return (
      <p className="flex items-center gap-2 text-cream-200/70">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
        Cargando…
      </p>
    )
  }
  if (error) return <p className="text-red-400">{error}</p>
  if (vacio) return <p className="text-cream-200/60">{vacio}</p>
  return children ?? null
}
