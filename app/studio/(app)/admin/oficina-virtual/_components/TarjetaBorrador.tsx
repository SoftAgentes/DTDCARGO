/**
 * Un borrador del agente para la revisión de Sam (SDD-0626 Paso 3b, D4). El texto y el motivo van SIEMPRE como
 * texto plano dentro de un <pre>: React los escapa; aquí no hay HTML ni Markdown renderizado.
 *
 * SDD-0678: mientras se guarda, el formulario queda deshabilitado y el botón tocado dice «Guardando…».
 */
import { BotonEnvio, FormularioAccion } from "@/app/studio/_components/ui/FormularioAccion";
import { CASILLAS, CRITERIO_CIERRE, type BorradorPendiente } from "@/lib/studio/oficina/revisiones";

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

/**
 * En un escalado no hay respuesta al cliente: «Acuse» nace en «No evaluado» y, con la 0560, no cuenta en contra (la
 * base lo decide por el tipo del borrador, no por esta marca).
 */
const ACUSE_NO_EVALUADO_EN_ESCALADO =
  "En un escalado no hay respuesta al cliente: deja «Acuse» en «No evaluado»; no cuenta en contra.";

export function TarjetaBorrador({ b, accion }: { b: BorradorPendiente; accion: (formData: FormData) => void | Promise<void> }) {
  const escalado = b.tipo === "escalado";
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
      <FormularioAccion action={accion} style={{ marginTop: "var(--s-3, 12px)" }}>
        <input type="hidden" name="borrador" value={b.borradorId} />
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 8px" }}>
          <legend style={{ font: "600 13px/1.3 var(--f-sans)", marginBottom: 6 }}>
            eval.md · marca lo que falló (sin marca = cumple)
          </legend>
          {CASILLAS.map((c) => (
            <div key={c.clave} style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", font: "400 13px/1.6 var(--f-sans)" }}>
              <span style={{ minWidth: "34ch" }}>{c.texto}</span>
              <label>
                <input type="checkbox" name={`falla_${c.clave}`} /> Falló
              </label>
              <label style={{ color: "var(--ink-soft)" }}>
                <input type="checkbox" name={`sin_${c.clave}`} defaultChecked={escalado && c.clave === "acuse"} /> No evaluado
              </label>
              {escalado && c.clave === "acuse" ? (
                <span style={{ flexBasis: "100%", font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }} data-testid="acuse-escalado">
                  {ACUSE_NO_EVALUADO_EN_ESCALADO}
                </span>
              ) : null}
            </div>
          ))}
          <p style={{ margin: "6px 0 0", font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            {CRITERIO_CIERRE}: no se juzga aquí; se registra una vez por conversación, al cerrarla o escalarla.
          </p>
        </fieldset>
        <label style={{ display: "block", font: "400 13px/1.4 var(--f-sans)" }}>
          Motivo (obligatorio, sin datos personales)
          <textarea name="motivo" required maxLength={500} rows={2} style={{ display: "block", width: "100%", marginTop: 4 }} />
        </label>
        <p style={{ margin: "8px 0 0", font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }} data-testid="aviso-sin-marcas">
          Guardar sin marcas significa «revisé y cumple». Con algo en «No evaluado», la conversación no cuenta como
          correcta, salvo «Acuse» en un escalado. Rechazar exige marcar al menos un «Falló».
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <BotonEnvio name="veredicto" value="aprobado" className="studio-btn-primary">
            Aprobar
          </BotonEnvio>
          <BotonEnvio name="veredicto" value="rechazado">
            Rechazar
          </BotonEnvio>
        </div>
      </FormularioAccion>
    </article>
  );
}
