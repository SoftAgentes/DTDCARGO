/**
 * El cierre de una conversación revisada (SDD-0626 · 0558, H3): «Cierre o escalado en 3 intercambios o menos» se
 * registra UNA vez por conversación, al cerrarla o escalarla. Sin texto del cliente: solo el número de conversación.
 *
 * SDD-0678: mientras se guarda, el formulario entero queda deshabilitado (no se cambia «Cumple»/«Falló» a mitad) y
 * el botón dice «Guardando…».
 */
import { BotonEnvio, FormularioAccion } from "@/app/studio/_components/ui/FormularioAccion";
import { CRITERIO_CIERRE, type ConversacionPorCerrar } from "@/lib/studio/oficina/revisiones";

export function TarjetaCierre({
  c,
  accion,
}: {
  c: ConversacionPorCerrar;
  accion: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <article
      style={{ background: "var(--bg-surface)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 12, padding: "var(--s-4, 16px)", marginBottom: "var(--s-4, 16px)" }}
    >
      <p style={{ margin: "0 0 8px", font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
        Conversación {c.conversacion} · {c.revisiones} {c.revisiones === 1 ? "revisión" : "revisiones"} · última{" "}
        {c.ultimaRevision.slice(0, 16).replace("T", " ")} UTC
      </p>
      <FormularioAccion action={accion} aria-label={`Cierre de la conversación ${c.conversacion}`}>
        <input type="hidden" name="conversacion" value={c.conversacion} />
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 8px", font: "400 13px/1.6 var(--f-sans)" }}>
          <legend style={{ font: "600 13px/1.3 var(--f-sans)", marginBottom: 6 }}>{CRITERIO_CIERRE}</legend>
          <label style={{ marginRight: 16 }}>
            <input type="radio" name="cumple" value="si" required /> Cumple
          </label>
          <label>
            <input type="radio" name="cumple" value="no" /> Falló
          </label>
        </fieldset>
        <label style={{ display: "block", font: "400 13px/1.4 var(--f-sans)" }}>
          Motivo (obligatorio, sin datos personales)
          <textarea name="motivo" required maxLength={500} rows={2} style={{ display: "block", width: "100%", marginTop: 4 }} />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <BotonEnvio>Registrar el cierre</BotonEnvio>
        </div>
      </FormularioAccion>
    </article>
  );
}
