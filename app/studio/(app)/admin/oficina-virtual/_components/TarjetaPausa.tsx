/**
 * El botón de pausa de la oficina (SDD-0626 §3.1 · SGE-AG-01 §7): dice si la oficina está pausada y deja pausarla o
 * despausarla con un motivo. El cambio lo hace la base (`office_cambiar_pausa`), a nombre de quien pulsa.
 *
 * - Un solo botón a la vez, el contrario del estado: pausada → «Despausar»; despausada → «Pausar».
 * - Despausar pide una casilla de confirmación: es lo que pone a trabajar al agente.
 * - Si el estado no se pudo leer, solo se ofrece PAUSAR (el lado seguro).
 * - El motivo de la última pausa va como texto plano: React lo escapa.
 */
import type { LecturaPausa } from "@/lib/studio/oficina/pausa";

const caja: React.CSSProperties = {
  background: "var(--bg-surface)",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "var(--s-4, 16px)",
  marginBottom: "var(--s-4, 16px)",
};
const nota: React.CSSProperties = { margin: "8px 0 0", font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", maxWidth: "76ch" };

/** `2026-11-18T10:42:08.123456+00:00` → `2026-11-18 10:42` (UTC). */
const hora = (iso: string): string => iso.slice(0, 16).replace("T", " ");

export function TarjetaPausa({ pausa, accion }: { pausa: LecturaPausa; accion: (formData: FormData) => void | Promise<void> }) {
  // Sin permiso no hay tarjeta: el layout ya corta con un 404 a quien no es superadministrador.
  if (!pausa.ok && pausa.motivo === "sin_permiso") return null;
  if (!pausa.ok && pausa.motivo === "sin_migracion") {
    return (
      <section style={caja} aria-label="Pausa de la oficina">
        <p style={{ margin: 0, font: "400 13px/1.4 var(--f-sans)" }}>
          Faltan las tablas del cable en esta base (migración 0541): todavía no hay pausa que cambiar.
        </p>
      </section>
    );
  }

  /** `null` = no se pudo leer. */
  const pausada = pausa.ok ? pausa.pausada : null;
  const conocida = pausada !== null;
  // Estado desconocido: se ofrece solo pausar.
  const pausar = pausada !== true;
  const vigente = pausa.ok ? pausa.vigente : null;
  const porTope = vigente !== null && vigente.pausada && vigente.motivo.startsWith("Auto-pausa");

  return (
    <section style={caja} aria-label="Pausa de la oficina">
      <p style={{ margin: 0, font: "600 16px/1.3 var(--f-sans)" }} data-testid="pausa-estado">
        {pausada === null
          ? "No se pudo leer si la oficina está pausada."
          : pausada
            ? "La oficina está PAUSADA."
            : "La oficina está DESPAUSADA."}
      </p>
      {vigente !== null ? (
        <p style={nota} data-testid="pausa-ultimo-cambio">
          Último cambio: {hora(vigente.cambiadoEn)} UTC · {vigente.quien} · motivo: {vigente.motivo}
        </p>
      ) : conocida ? (
        <p style={nota}>No hay ningún cambio registrado: la oficina se trata como pausada.</p>
      ) : null}
      <p style={nota}>
        {pausar
          ? "Pausar detiene al agente y al envío en el próximo minuto. No borra nada: las tareas y los borradores quedan como están."
          : "Despausar pone al agente a redactar otra vez. Nada se envía sin tu aprobación."}
        {!conocida ? " Como no se pudo leer el estado, aquí solo se puede pausar." : null}
        {porTope ? " La pausó el tope de gasto: mientras el gasto del mes siga sobre el 80 % del tope, se volverá a pausar sola." : null}
      </p>
      <form action={accion} style={{ marginTop: "var(--s-3, 12px)" }}>
        <input type="hidden" name="pausar" value={pausar ? "si" : "no"} />
        <label style={{ display: "block", font: "400 13px/1.4 var(--f-sans)" }}>
          Motivo (obligatorio, sin datos personales)
          <textarea name="motivo" required maxLength={500} rows={2} style={{ display: "block", width: "100%", marginTop: 4 }} />
        </label>
        {pausar ? null : (
          <label style={{ display: "block", font: "400 13px/1.4 var(--f-sans)", marginTop: 8 }}>
            <input type="checkbox" name="confirmo" required /> Confirmo que quiero despausar la oficina.
          </label>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="submit" className="studio-btn-primary">
            {pausar ? "Pausar la oficina" : "Despausar la oficina"}
          </button>
        </div>
      </form>
    </section>
  );
}
