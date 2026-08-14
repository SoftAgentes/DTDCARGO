/**
 * SDD-0259 · dispara el evento anónimo de la calculadora, desde el navegador.
 *
 * Se llama al tocar el CTA, **no mientras el cliente tipea**. Un evento por
 * cada tecla (aunque fuera con debounce) guardaría estados a medias —`cbm=1`,
 * `cbm=12`— que después hay que limpiar a mano para calcular cualquier cosa.
 * El clic es el momento en que el cliente ya se decidió: da el valor final,
 * comprometido, y en un volumen mucho menor.
 *
 * ⚠️ NO puede bloquear ni romper el CTA. El visitante está yendo a WhatsApp;
 * la telemetría es un pasajero del viaje, no el conductor. Por eso:
 *  · `keepalive: true` → el navegador termina el envío aunque la pestaña ya
 *    esté navegando a wa.me (sin esto, el `fetch` se cancela y el evento se
 *    pierde justo en el caso que más interesa medir: el que sí convirtió).
 *  · todo dentro de try/catch y sin `await` del lado del llamador.
 */

/** Lo que viaja al endpoint. Sin datos personales — ver `calc-event.ts`. */
export type CalcEventReport = {
  modo: "ddp" | "consolidado";
  cbm: number;
  weightKg: number | null;
  ciudadId: string | null;
  embalaje: "estandar" | "especial";
  bateria: boolean;
  cargaEspecial: boolean;
  totalUsd: number | null;
  alerta: string | null;
};

export function reportCalcEvent(ev: CalcEventReport): void {
  // Sin volumen no hubo cálculo que registrar.
  if (!Number.isFinite(ev.cbm) || ev.cbm <= 0) return;
  try {
    void fetch("/api/public/calc-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ev),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Un navegador sin fetch, una CSP rara, lo que sea: se pierde la medición
    // y no pasa nada más. Nunca burbujea al CTA.
  }
}
