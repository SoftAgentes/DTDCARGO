/**
 * Un borrador del agente para la revisión de Sam (SDD-0626 Paso 3b, D4). El texto y el motivo van SIEMPRE como
 * texto plano dentro de un <pre>: React los escapa; aquí no hay HTML ni Markdown renderizado.
 */
import { CASILLAS, type BorradorPendiente } from "@/lib/studio/oficina/revisiones";

export const estiloTextoPlano: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  font: "400 14px/1.5 var(--f-sans)",
  color: "var(--ink)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "var(--s-3, 12px)",
  margin: 0,
};

export function TarjetaBorrador({ b, accion }: { b: BorradorPendiente; accion: (formData: FormData) => void | Promise<void> }) {
  return (
    <article
      style={{ background: "var(--bg-surface)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 12, padding: "var(--s-4, 16px)", marginBottom: "var(--s-4, 16px)" }}
    >
      <p style={{ margin: "0 0 8px", font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
        {b.tipo === "respuesta" ? `Respuesta · guion ${b.guion ?? "?"}` : `Escalado · prioridad ${b.prioridad ?? "?"}`}
        {b.conversacion !== null ? ` · conversación ${b.conversacion}` : ""} · {b.creadoEn.slice(0, 16).replace("T", " ")} UTC
      </p>
      {/* Texto plano: React escapa todo; ni HTML ni Markdown. */}
      <pre style={estiloTextoPlano} data-testid="borrador-texto">
        {b.tipo === "respuesta" ? b.texto : b.motivo}
      </pre>
      <form action={accion} style={{ marginTop: "var(--s-3, 12px)" }}>
        <input type="hidden" name="borrador" value={b.borradorId} />
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 8px" }}>
          <legend style={{ font: "600 13px/1.3 var(--f-sans)", marginBottom: 6 }}>eval.md (las 5 casillas)</legend>
          {CASILLAS.map((c) => (
            <label key={c.clave} style={{ display: "block", font: "400 13px/1.6 var(--f-sans)" }}>
              <input type="checkbox" name={c.clave} /> {c.texto}
            </label>
          ))}
        </fieldset>
        <label style={{ display: "block", font: "400 13px/1.4 var(--f-sans)" }}>
          Motivo (obligatorio, sin datos personales)
          <textarea name="motivo" required maxLength={500} rows={2} style={{ display: "block", width: "100%", marginTop: 4 }} />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="submit" name="veredicto" value="aprobado" className="studio-btn studio-btn-primary">
            Aprobar
          </button>
          <button type="submit" name="veredicto" value="rechazado" className="studio-btn">
            Rechazar
          </button>
        </div>
      </form>
    </article>
  );
}
