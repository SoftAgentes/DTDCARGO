/**
 * SDD-0530 · Qué pasó con los envíos al zarpar o arribar el contenedor.
 *
 * Se queda a la vista en el detalle del contenedor después de la acción: el
 * operador que vuelve de una interrupción ve cuántos envíos avanzaron, cuántos
 * avisos se programaron y cuáles no cambiaron, con su motivo. Muestra códigos y
 * Shipping Mark, no nombres. Los números son los que devolvió el servidor: no
 * se infieren de los ítems del contenedor.
 */
import { Icon } from "@/app/studio/_components/icons";
import type { ResumenAvanceContenedor } from "@/lib/studio/naviera/avance-por-contenedor";

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? `1 ${uno}` : `${n} ${varios}`;
}

export function AvanceContenedorResumen({ resumen }: { resumen: ResumenAvanceContenedor }) {
  const esZarpe = resumen.to === "zarpado";
  const nombre = esZarpe ? "zarpe" : "arribo";
  const ref = resumen.consolidationRef ?? "el contenedor";

  const titulo =
    resumen.outcome === "already"
      ? `${ref} ya estaba ${esZarpe ? "zarpado" : "arribado"}`
      : `${esZarpe ? "Zarpe" : "Arribo"} de ${ref} registrado`;

  const n = resumen.avanzados.length;
  const avance =
    n === 0
      ? `Ningún envío pasó a ${resumen.destinoTexto}.`
      : `${plural(n, "envío pasó", "envíos pasaron")} a ${resumen.destinoTexto}.`;
  const avisos =
    resumen.avisosProgramados === 0
      ? `No se programó ningún aviso de «${resumen.destinoTexto}».`
      : `${plural(resumen.avisosProgramados, "aviso", "avisos")} de «${resumen.destinoTexto}» en la agenda.`;

  return (
    <section
      aria-label={`Resumen del ${nombre}`}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-4) var(--s-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
      }}
    >
      <h3
        style={{
          margin: 0,
          display: "flex",
          alignItems: "center",
          gap: "var(--s-2)",
          font: "700 13px/1.3 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {/* Éxito = icono verde y texto neutro (BRAND · Estados y mensajes). */}
        {resumen.outcome === "transitioned" && (
          <span aria-hidden="true" style={{ display: "inline-flex", color: "var(--success)" }}>
            {Icon.check(14)}
          </span>
        )}
        {titulo}
      </h3>

      {resumen.outcome === "already" ? (
        <p style={{ margin: 0, font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          No se tocó ningún envío ni se programó ningún aviso.
        </p>
      ) : (
        <>
          <p style={{ margin: 0, font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink)" }}>
            {avance} {avisos}
            {resumen.avisosLlegada !== undefined && (
              <>
                {" "}
                {resumen.avisosLlegada === 0
                  ? "No se programó ningún aviso de «Tu carga llegó a Venezuela»."
                  : `${plural(resumen.avisosLlegada, "aviso", "avisos")} de «Tu carga llegó a Venezuela» en la agenda.`}
              </>
            )}
          </p>

          {resumen.saltados.length > 0 && (
            <div>
              <p style={{ margin: "0 0 var(--s-1)", font: "600 12px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                {resumen.saltados.length === 1
                  ? "1 envío no cambió:"
                  : `${resumen.saltados.length} envíos no cambiaron:`}
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "var(--s-5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-1)",
                }}
              >
                {resumen.saltados.map((s) => (
                  <li key={s.code} style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
                    <code style={{ font: "600 12px/1.5 var(--f-mono)", color: "var(--ink)" }}>{s.code}</code>
                    {s.clientMarkbox ? ` · ${s.clientMarkbox}` : ""} — {s.motivoTexto}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resumen.piezasSinEnvio > 0 && (
            <p style={{ margin: 0, font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
              {resumen.piezasSinEnvio === 1
                ? "1 pieza del contenedor no tiene envío asociado: por ella no se avanzó ni se avisó a nadie."
                : `${resumen.piezasSinEnvio} piezas del contenedor no tienen envío asociado: por ellas no se avanzó ni se avisó a nadie.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
