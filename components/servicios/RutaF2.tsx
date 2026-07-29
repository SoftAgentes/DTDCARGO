import type { ReactNode } from "react";

/**
 * Diagrama de ruta de una ficha de servicio (f2route).
 * Handoff Cloud Design · Servicios · DTD-Cargo.html.
 *
 * Reutilizable en las ~17 fichas: se pasa la lista de paradas + qué tramos
 * cubre DTD (`you` = línea sólida wine) + el pie (caption).
 */
export type RutaStop = {
  /** Etiqueta principal de la parada (ej. "Bodega Yiwu"). */
  lb: string;
  /** Subetiqueta (ej. "tu proveedor entrega"). */
  sb: string;
  /** Parada intermedia (punto más chico, sin glow wine). */
  mid?: boolean;
};

export type RutaF2Props = {
  stops: RutaStop[];
  /**
   * Tramos entre paradas: `true` = cubierto por DTD (sólido wine),
   * `false` = por cuenta del cliente (punteado). Longitud = stops.length - 1.
   */
  segs: boolean[];
  /** Pie: [destacado, aclaración]. Cada uno acepta JSX (negrita propia). */
  cap: [ReactNode, ReactNode];
};

export function RutaF2({ stops, segs, cap }: RutaF2Props) {
  return (
    <div className="f2route">
      <div className="lane">
        {stops.map((s, i) => (
          <RutaSegment
            key={i}
            stop={s}
            segYou={i < stops.length - 1 ? segs[i] : undefined}
          />
        ))}
      </div>
      <div className="cap">
        <span>{cap[0]}</span>
        <span>{cap[1]}</span>
      </div>
    </div>
  );
}

function RutaSegment({
  stop,
  segYou,
}: {
  stop: RutaStop;
  segYou: boolean | undefined;
}) {
  return (
    <>
      <div className={stop.mid ? "stop mid" : "stop"}>
        <span className="pt" />
        <span className="lb">{stop.lb}</span>
        <span className="sb">{stop.sb}</span>
      </div>
      {segYou !== undefined && (
        <span className={segYou ? "seg you" : "seg"} aria-hidden />
      )}
    </>
  );
}
