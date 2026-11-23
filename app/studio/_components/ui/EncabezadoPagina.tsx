import type { ReactNode } from "react";

/**
 * EncabezadoPagina · SDD-0688 fase 2 (CMP-01: proposed).
 *
 * Eyebrow, título (el único `<h1>` de la pantalla), subtítulo y acciones, con un
 * solo tamaño y un solo margen. Los tamaños salen de los estilos de texto con
 * nombre (`.t-pantalla`, `--t-eyebrow`, `.t-cuerpo-compacto`), que siguen a la
 * vista elegida. Las acciones van a la derecha y bajan de línea si no caben.
 *
 * `tono="navy"` es para el encabezado que vive dentro de una banda navy fija
 * (el saludo del dashboard): solo cambia los colores del texto.
 */
export function EncabezadoPagina({
  eyebrow,
  titulo,
  subtitulo,
  acciones,
  tono = "claro",
}: {
  eyebrow?: ReactNode;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  tono?: "claro" | "navy";
}) {
  const navy = tono === "navy";
  return (
    <header className="studio-encabezado" data-tono={tono}>
      <div className="studio-encabezado__texto">
        {eyebrow ? (
          <span className="studio-eyebrow" style={navy ? { color: "var(--ink-side)" } : undefined}>
            {eyebrow}
          </span>
        ) : null}
        <h1
          className="studio-encabezado__titulo t-pantalla"
          style={navy ? { color: "var(--ink-side-strong)" } : undefined}
        >
          {titulo}
        </h1>
        {subtitulo ? (
          <p
            className="studio-encabezado__sub t-cuerpo-compacto"
            style={navy ? { color: "var(--ink-side)" } : undefined}
          >
            {subtitulo}
          </p>
        ) : null}
      </div>
      {acciones ? <div className="studio-encabezado__acciones">{acciones}</div> : null}
    </header>
  );
}
