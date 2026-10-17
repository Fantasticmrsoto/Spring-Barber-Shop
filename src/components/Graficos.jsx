// Histogramas sin dependencias: barras con ejes y líneas de guía hechas con
// Tailwind. Se usan en el dashboard del administrador.

// Histograma vertical. `datos` es [{ etiqueta, valor, titulo }].
// - `colores` permite pintar cada barra distinto (si no, todas usan `color`).
// - `formatearEje` formatea las marcas del eje Y; `formatearValor` el valor que
//   aparece al pasar el mouse sobre una barra.
export function Histograma({
  datos = [],
  color = 'from-gold-700 to-gold-400',
  colores,
  alturaClase = 'h-44',
  formatearEje = (v) => v,
  formatearValor,
  pasos = 4,
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor))
  const ticks = Array.from({ length: pasos + 1 }, (_, i) => ({
    top: i / pasos,
    valor: max * ((pasos - i) / pasos),
  }))

  return (
    <div className="mt-5">
      <div className="flex gap-3">
        <div
          className={`flex w-11 shrink-0 flex-col justify-between ${alturaClase} text-right`}
        >
          {ticks.map((t, i) => (
            <span key={i} className="text-[0.55rem] leading-none text-cream-200/40">
              {formatearEje(t.valor)}
            </span>
          ))}
        </div>

        <div className={`relative flex-1 ${alturaClase}`}>
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute inset-x-0 border-t border-white/5"
              style={{ top: `${t.top * 100}%` }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-1.5 px-1">
            {datos.map((d, i) => {
              const porcentaje = Math.max(2, (d.valor / max) * 100)
              return (
                <div
                  key={i}
                  className="group relative flex h-full flex-1 items-end"
                  title={d.titulo}
                >
                  {formatearValor && (
                    <span
                      className="pointer-events-none absolute inset-x-0 text-center text-[0.6rem] font-medium text-cream-100 opacity-0 transition group-hover:opacity-100"
                      style={{ bottom: `calc(${porcentaje}% + 3px)` }}
                    >
                      {formatearValor(d.valor)}
                    </span>
                  )}
                  <div
                    className={`w-full rounded-t bg-gradient-to-t ${
                      colores ? colores[i % colores.length] : color
                    } transition group-hover:brightness-125`}
                    style={{ height: `${porcentaje}%` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex gap-3">
        <div className="w-11 shrink-0" />
        <div className="flex flex-1 gap-1.5 px-1">
          {datos.map((d, i) => (
            <span
              key={i}
              className="flex-1 truncate text-center text-[0.55rem] text-cream-200/45"
            >
              {d.etiqueta}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Histograma horizontal (barras por fila). Mejor cuando las etiquetas son largas.
export function HistogramaHorizontal({
  datos = [],
  color = 'from-gold-600 to-gold-400',
  formatearValor,
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <div className="space-y-3">
      {datos.map((d, i) => (
        <div key={i}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-cream-50">{d.etiqueta}</span>
            <span className="shrink-0 text-cream-200/60">
              {formatearValor ? formatearValor(d.valor) : d.valor}
              {d.extra ? ` · ${d.extra}` : ''}
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${color}`}
              style={{ width: `${Math.max(2, (d.valor / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
