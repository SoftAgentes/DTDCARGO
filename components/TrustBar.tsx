/**
 * Barra de confianza — strip bajo el hero (SDD-0064).
 *
 * Reemplaza la barra promocional de volumen ("+10 CBM", "inspección +20 CBM")
 * por los 5 pilares estratégicos. Los beneficios de volumen se mueven a una
 * sección comercial posterior. Strip claro (bg-paper) que separa el hero de la
 * banda navy de <Stats>.
 */
const PILARES = [
  "Puerta a puerta",
  "Aduana e impuestos gestionados",
  "Carga identificada con MARKBOX",
  "Tracking en vivo",
  "Equipo en Yiwu y Valencia",
];

export function TrustBar() {
  return (
    <section
      aria-label="Por qué importar con DTD Cargo"
      className="bg-paper border-y border-grey-200"
    >
      <div className="wrap py-4">
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 list-none p-0 m-0">
          {PILARES.map((p) => (
            <li
              key={p}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-grey-700"
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-wine flex-shrink-0"
                aria-hidden
              />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
