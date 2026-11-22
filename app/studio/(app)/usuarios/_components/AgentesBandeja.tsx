"use client";

/**
 * Vínculos usuario de Studio ↔ agente de Chatwoot (SDD-0585, E2-D10). Desde
 * SDD-0655 viven en Usuarios › Bandeja (antes, debajo del marco de la Bandeja).
 * Solo lo monta Usuarios, que es solo admin; las acciones (las mismas de
 * `bandeja/actions.ts`) vuelven a exigir admin y el servidor comprueba la cuenta
 * y el correo del agente por la Platform API.
 *
 * Desvincular borra la fila: pasa por el ConfirmDialog canónico (BTN-01/AVS-01).
 *
 * Paso 2.5: crear el agente en Chatwoot y vincularlo; «Salud» muestra lo que
 * calculó la página (admins humanos, vínculos fuera de la cuenta).
 *
 * SDD-0680 (variante 1, elegida por Sam el 2026-11-19):
 * - Los vínculos van en una tabla: persona de Studio ↔ agente de Chatwoot (nombre,
 *   correo y número), rol y la acción alineada en su columna.
 * - Dos tarjetas separadas: «Ya tiene agente: vincularlo» y «No tiene agente:
 *   crearlo». El agente se elige por nombre y correo (los de la cuenta sin
 *   vínculo, el del mismo correo primero). Solo si Chatwoot no respondió
 *   (`agentes === null`) se pide el número a mano, con su ayuda.
 * - Botones de ancho estable (BTN-01 §5): reposo y espera en la misma celda.
 */
import { startTransition, useActionState, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { altaAgente, desvincularAgente, vincularAgente, type VinculoState } from "../../bandeja/actions";
import type { SaludBandeja } from "@/lib/studio/chatwoot/agentes-salud";
import type { AgenteCuenta, MiembroOpcion, VinculoFila } from "@/lib/studio/chatwoot/agentes-bandeja-admin";

export type { AgenteCuenta, MiembroOpcion, VinculoFila };

const INICIAL: VinculoState = { ok: false, error: null };

const tarjeta: CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-3)",
  minWidth: 0,
};
const ayuda: CSSProperties = { margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" };
const campo: CSSProperties = { display: "flex", flexDirection: "column", gap: "var(--s-1)" };
const celdaTabla: CSSProperties = { padding: "var(--s-3)", borderBottom: "1px solid var(--border)", verticalAlign: "middle" };
const cabeceraTabla: CSSProperties = {
  padding: "var(--s-2) var(--s-3)",
  borderBottom: "1px solid var(--border-strong)",
  textAlign: "left",
  font: "700 12px/1.3 var(--f-sans)",
  color: "var(--ink-soft)",
};
const secundaria: CSSProperties = { font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" };

function useMensajeError(estado: VinculoState) {
  const t = useT();
  return estado.error ? { error: t(`bandeja.error.${estado.error}` as I18nKey) } : null;
}

/**
 * Botón de ancho estable (BTN-01 §5, el mismo recurso que `BotonEnvio` de
 * SDD-0678): las dos etiquetas en la misma celda y la que no toca, oculta.
 */
function BotonFijo({
  pendiente,
  reposo,
  espera,
  clase,
  type = "button",
  onClick,
}: {
  pendiente: boolean;
  reposo: ReactNode;
  espera: ReactNode;
  clase: string;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  const celda: CSSProperties = { gridArea: "1 / 1", display: "inline-flex", alignItems: "center", justifyContent: "center" };
  return (
    <button
      type={type}
      className={clase}
      disabled={pendiente}
      aria-busy={pendiente}
      onClick={onClick}
      style={{ display: "inline-grid" }}
    >
      <span style={{ ...celda, visibility: pendiente ? "hidden" : "visible" }}>{reposo}</span>
      <span aria-hidden={!pendiente} style={{ ...celda, visibility: pendiente ? "visible" : "hidden" }}>
        {espera}
      </span>
    </button>
  );
}

function Desvincular({ fila }: { fila: VinculoFila }) {
  const t = useT();
  const [estado, accion, pendiente] = useActionState(desvincularAgente, INICIAL);
  const [abierto, setAbierto] = useState(false);
  const error = useMensajeError(estado);
  const confirmar = () => {
    const fd = new FormData();
    fd.set("user_id", fila.userId);
    startTransition(() => accion(fd));
    setAbierto(false);
  };
  return (
    <>
      <BotonFijo
        pendiente={pendiente}
        clase="studio-btn studio-btn-ghost studio-btn-sm"
        reposo={t("bandeja.links.unlink")}
        espera={t("bandeja.links.unlinking")}
        onClick={() => setAbierto(true)}
      />
      <ErrorAlert state={error} compact />
      <ConfirmDialog
        open={abierto}
        danger
        title={t("bandeja.links.unlink_confirm_title")}
        message={t("bandeja.links.unlink_confirm_body", { nombre: fila.nombre })}
        confirmLabel={t("bandeja.links.unlink")}
        cancelLabel={t("bandeja.links.cancel")}
        pending={pendiente}
        onCancel={() => setAbierto(false)}
        onConfirm={confirmar}
      />
    </>
  );
}

function Salud({ salud }: { salud: SaludBandeja }) {
  const t = useT();
  return (
    <div role="status" aria-labelledby="bandeja-salud" style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
      <h3 id="bandeja-salud" style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
        {t("bandeja.salud.title")}
      </h3>
      {salud.alertas.length === 0 ? (
        <p style={ayuda}>{t("bandeja.salud.ok", { n: salud.adminsHumanos ?? 0 })}</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "var(--s-5)", display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
          {salud.alertas.map((a) => (
            <li key={a} style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--danger-text)" }}>
              {t(`bandeja.salud.alerta.${a}` as I18nKey, { ids: salud.vinculosFueraDeCuenta.map((id) => `#${id}`).join(", ") })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TablaVinculos({ vinculos }: { vinculos: VinculoFila[] }) {
  const t = useT();
  if (vinculos.length === 0) return <p style={ayuda}>{t("bandeja.links.empty")}</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", font: "400 14px/1.4 var(--f-sans)", color: "var(--ink)" }}>
        <thead>
          <tr>
            <th scope="col" style={cabeceraTabla}>
              {t("bandeja.links.col_person")}
            </th>
            <th scope="col" style={{ ...cabeceraTabla, width: 32 }}>
              <span className="studio-sr-only">{t("bandeja.links.linked_to")}</span>
            </th>
            <th scope="col" style={cabeceraTabla}>
              {t("bandeja.links.col_agent")}
            </th>
            <th scope="col" style={cabeceraTabla}>
              {t("bandeja.links.col_role")}
            </th>
            <th scope="col" style={{ ...cabeceraTabla, textAlign: "right" }}>
              {t("bandeja.links.col_action")}
            </th>
          </tr>
        </thead>
        <tbody>
          {vinculos.map((v) => (
            <tr key={v.userId}>
              <td style={{ ...celdaTabla, fontWeight: 700 }}>{v.nombre}</td>
              <td style={{ ...celdaTabla, color: "var(--ink-soft)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-label={t("bandeja.links.linked_to")}>
                  <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                  <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                </svg>
              </td>
              <td style={celdaTabla}>
                <div style={{ fontWeight: 700 }}>
                  {v.agente?.nombre || t("bandeja.links.agent_unknown", { id: v.chatwootUserId })}{" "}
                  <span style={{ font: "500 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>#{v.chatwootUserId}</span>
                </div>
                {v.agente?.correo ? <div style={secundaria}>{v.agente.correo}</div> : null}
              </td>
              <td style={{ ...celdaTabla, color: "var(--ink-soft)" }}>
                {v.agente ? t(`bandeja.links.role.${v.agente.rol}` as I18nKey) : "—"}
              </td>
              <td style={{ ...celdaTabla, textAlign: "right", whiteSpace: "nowrap" }}>
                <Desvincular fila={v} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Agentes de la cuenta sin vínculo; el del mismo correo que la persona, primero. */
export function agentesParaElegir(
  agentes: readonly AgenteCuenta[],
  vinculos: readonly VinculoFila[],
  correoPersona: string | undefined,
): AgenteCuenta[] {
  const tomados = new Set(vinculos.map((v) => v.chatwootUserId));
  const correo = correoPersona?.trim().toLowerCase();
  const libres = agentes.filter((a) => !tomados.has(a.id));
  const coincide = (a: AgenteCuenta) => !!correo && a.correo.trim().toLowerCase() === correo;
  return [...libres].sort((a, b) => Number(coincide(b)) - Number(coincide(a)) || a.nombre.localeCompare(b.nombre, "es"));
}

/** Valor del select que pide escribir el número a mano. */
const OTRO_AGENTE = "otro";

function CampoNumero({ ayudaKey }: { ayudaKey: I18nKey }) {
  const t = useT();
  return (
    <label className="studio-label" style={campo}>
      {t("bandeja.links.agent_id")}
      <input
        name="chatwoot_user_id"
        required
        inputMode="numeric"
        pattern="[1-9][0-9]*"
        aria-describedby="bandeja-agent-id-help"
        className="studio-input studio-input-mono"
      />
      <span id="bandeja-agent-id-help" style={{ ...ayuda, fontWeight: 400 }}>
        {t(ayudaKey)}
      </span>
    </label>
  );
}

/**
 * El agente por nombre y correo. Con la lista incompleta (algún agente no se pudo
 * leer) suma «Otro agente», que pide el número a mano. Se monta de nuevo al
 * cambiar de persona (`key`), así arranca con el sugerido.
 */
function CampoAgente({ opciones, sugerido, completa }: { opciones: AgenteCuenta[]; sugerido: string; completa: boolean }) {
  const t = useT();
  const [elegido, setElegido] = useState(sugerido);
  const manual = elegido === OTRO_AGENTE;
  return (
    <>
      <label className="studio-label" style={campo}>
        {t("bandeja.links.agent")}
        <select
          name={manual ? undefined : "chatwoot_user_id"}
          required
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          aria-describedby="bandeja-agent-help"
          className="studio-input"
        >
          <option value="" disabled>
            {t("bandeja.links.agent_placeholder")}
          </option>
          {opciones.map((a) => (
            <option key={a.id} value={a.id}>
              {`${a.nombre || t("bandeja.links.agent_unknown", { id: a.id })} · ${a.correo} (#${a.id})`}
            </option>
          ))}
          {!completa ? <option value={OTRO_AGENTE}>{t("bandeja.links.agent_other")}</option> : null}
        </select>
        <span id="bandeja-agent-help" style={{ ...ayuda, fontWeight: 400 }}>
          {t(completa ? "bandeja.links.agent_help" : "bandeja.links.agents_incomplete")}
        </span>
      </label>
      {manual ? <CampoNumero ayudaKey="bandeja.links.agent_id_help_other" /> : null}
    </>
  );
}

function Vincular({
  miembros,
  vinculos,
  agentes,
  completa,
}: {
  miembros: MiembroOpcion[];
  vinculos: VinculoFila[];
  agentes: AgenteCuenta[] | null;
  completa: boolean;
}) {
  const t = useT();
  const [estado, accion, pendiente] = useActionState(vincularAgente, INICIAL);
  const error = useMensajeError(estado);
  const [persona, setPersona] = useState("");
  const correoPersona = miembros.find((m) => m.userId === persona)?.correo;
  const opciones = useMemo(
    () => (agentes ? agentesParaElegir(agentes, vinculos, correoPersona) : []),
    [agentes, vinculos, correoPersona],
  );
  const sugerido =
    correoPersona && opciones[0] && opciones[0].correo.trim().toLowerCase() === correoPersona.trim().toLowerCase()
      ? String(opciones[0].id)
      : "";

  return (
    <section aria-labelledby="bandeja-vincular" style={tarjeta}>
      <h3 id="bandeja-vincular" style={{ font: "800 16px/1.2 var(--f-display)", color: "var(--ink)", margin: 0 }}>
        {t("bandeja.links.link_title")}
      </h3>
      <p style={ayuda}>{t("bandeja.links.link_help")}</p>
      {/* «Todos tienen vínculo» solo si la lista está completa: si faltó leer alguno, puede ser ese. */}
      {agentes !== null && completa && agentesParaElegir(agentes, vinculos, undefined).length === 0 ? (
        <p style={ayuda}>{t("bandeja.links.no_agents")}</p>
      ) : (
        <form action={accion} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
          <label className="studio-label" style={campo}>
            {t("bandeja.links.user")}
            <select
              name="user_id"
              required
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="studio-input"
            >
              <option value="" disabled>
                {t("bandeja.links.user_placeholder")}
              </option>
              {miembros.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          {agentes === null ? (
            <CampoNumero ayudaKey="bandeja.links.agent_id_help" />
          ) : opciones.length === 0 ? (
            // Lista incompleta y sin nadie libre entre los leídos: solo queda el número.
            <CampoNumero ayudaKey="bandeja.links.agents_incomplete" />
          ) : (
            <CampoAgente key={persona} opciones={opciones} sugerido={sugerido} completa={completa} />
          )}
          <div>
            <BotonFijo
              type="submit"
              pendiente={pendiente}
              clase="studio-btn studio-btn-primary"
              reposo={t("bandeja.links.submit")}
              espera={t("bandeja.links.submitting")}
            />
          </div>
        </form>
      )}
      <ErrorAlert state={error} />
      {estado.ok ? (
        <p role="status" style={{ margin: 0, font: "500 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {t("bandeja.links.created")}
        </p>
      ) : null}
    </section>
  );
}

function AltaAgente({ miembros: todos }: { miembros: MiembroOpcion[] }) {
  const t = useT();
  const miembros = todos.filter((m) => m.puedeBandeja !== false);
  const [estado, accion, pendiente] = useActionState(altaAgente, INICIAL);
  const error = useMensajeError(estado);
  return (
    <section aria-labelledby="bandeja-alta" style={tarjeta}>
      <h3 id="bandeja-alta" style={{ font: "800 16px/1.2 var(--f-display)", color: "var(--ink)", margin: 0 }}>
        {t("bandeja.alta.title")}
      </h3>
      <p style={ayuda}>{t("bandeja.alta.help")}</p>
      {miembros.length === 0 ? (
        <p style={ayuda}>{t("bandeja.alta.empty")}</p>
      ) : (
        <form action={accion} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
          <label className="studio-label" style={campo}>
            {t("bandeja.alta.user")}
            <select name="user_id" required defaultValue="" className="studio-input">
              <option value="" disabled>
                {t("bandeja.links.user_placeholder")}
              </option>
              {miembros.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <div>
            <BotonFijo
              type="submit"
              pendiente={pendiente}
              clase="studio-btn studio-btn-ghost"
              reposo={t("bandeja.alta.submit")}
              espera={t("bandeja.alta.submitting")}
            />
          </div>
        </form>
      )}
      <ErrorAlert state={error} />
      {estado.ok ? (
        <p role="status" style={{ margin: 0, font: "500 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {t("bandeja.alta.created")}
        </p>
      ) : null}
    </section>
  );
}

export function AgentesBandeja({
  vinculos,
  miembros,
  salud,
  agentes = null,
  agentesCompletos = true,
}: {
  vinculos: VinculoFila[];
  miembros: MiembroOpcion[];
  /** Paso 2.5: la calcula la página con la Platform API; null si no se pudo. */
  salud?: SaludBandeja | null;
  /** SDD-0680: agentes de la cuenta para elegir por nombre; null si Chatwoot no respondió. */
  agentes?: AgenteCuenta[] | null;
  /** SDD-0680: `false` si algún agente no se pudo leer. */
  agentesCompletos?: boolean;
}) {
  const t = useT();
  return (
    <div data-guia="usuarios.acceso-bandeja" style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      <section aria-labelledby="bandeja-vinculos" style={{ ...tarjeta, gap: "var(--s-4)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--s-4)", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px" }}>
            <h2 id="bandeja-vinculos" style={{ font: "800 18px/1.2 var(--f-display)", color: "var(--ink)", margin: "0 0 var(--s-1)" }}>
              {t("bandeja.links.title")}
            </h2>
            <p style={{ margin: "0 0 var(--s-1)", font: "500 13px/1.5 var(--f-sans)", color: "var(--ink)" }}>{t("bandeja.links.what")}</p>
            <p style={ayuda}>{t("bandeja.links.help")}</p>
          </div>
          {salud ? <Salud salud={salud} /> : null}
        </div>
        <TablaVinculos vinculos={vinculos} />
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "var(--s-5)" }}>
        <Vincular miembros={miembros} vinculos={vinculos} agentes={agentes} completa={agentesCompletos} />
        <AltaAgente miembros={miembros} />
      </div>
    </div>
  );
}
