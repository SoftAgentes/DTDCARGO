"use client";

/**
 * Administración › Actualizaciones de Chatwoot (SDD-0588, paso 3.3). El título lo
 * pone la page; acá viven el estado, las versiones pendientes y los pedidos.
 *
 * Responde tres preguntas de un vistazo:
 *   1. ¿Qué versión hay instalada y cuál está publicada?
 *   2. ¿Qué trae cada versión pendiente? (notas de Chatwoot, en texto plano)
 *   3. ¿Ya alguien pidió subir? «Pedir actualización» deja el registro y lo dice:
 *      no instala nada.
 *   4. ¿Qué implica el salto para DTD? «Analizar con IA» (paso 3.4) muestra el
 *      riesgo por pieza propia y una recomendación. Es un informe: tampoco instala.
 */

import { useState } from "react";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import type { ErrorVersiones, EstadoVersiones, ReleaseChatwoot } from "@/lib/studio/chatwoot/versiones";
import type { PiezaInforme, Recomendacion, Riesgo } from "@/lib/studio/chatwoot/analisis";
import {
  analizarConIa,
  pedirActualizacion,
  revisarVersionesAhora,
  type ActualizacionesErrorCode,
  type ActualizacionesState,
} from "../actions";

export interface RevisionVista {
  estado: EstadoVersiones;
  instalada: string | null;
  disponible: string | null;
  revisadaTexto: string;
  pendientes: (ReleaseChatwoot & { publicadaTexto: string })[];
  recortado: boolean;
  error: ErrorVersiones | null;
}

export interface PedidoVista {
  id: number;
  desde: string;
  hasta: string;
  pedidoTexto: string;
  propio: boolean;
}

export interface AnalisisVista {
  motor: "glm" | "sin_ia";
  modelo: string | null;
  recomendacion: Recomendacion;
  resumen: string;
  piezas: PiezaInforme[];
  archivos: number;
  recortado: boolean;
  creadoTexto: string;
}

interface Props {
  revision: RevisionVista | null;
  pedidos: PedidoVista[];
  /** El análisis más reciente del salto pendiente, si hay. */
  analisis?: AnalisisVista | null;
}

const ERROR_ACCION: Record<ActualizacionesErrorCode, string> = {
  denied: "Solo un administrador puede hacer esto.",
  invalid: "La versión pedida no es válida.",
  stale: "La versión disponible cambió. Recarga la página y revisa de nuevo.",
  duplicate: "Esa versión ya está pedida.",
  tope: "Ya se hicieron los análisis permitidos por hoy. Inténtalo otra vez mañana.",
  en_curso: "Ya hay un análisis en curso. Espera a que termine y recarga la página.",
  service: "No se pudo completar. Inténtalo de nuevo en unos minutos.",
};

const ERROR_REVISION: Record<ErrorVersiones, string> = {
  instalada_no_responde: "chat.dtdcargo.com no respondió. Si sigue caído, Uptime Kuma lo avisa por su lado.",
  instalada_formato: "chat.dtdcargo.com respondió sin la versión.",
  releases_no_responde: "GitHub no respondió; puede ser su límite de consultas. La próxima revisión lo intenta otra vez.",
  releases_formato: "GitHub respondió en un formato inesperado.",
};

const ESTADO: Record<EstadoVersiones, { tono: "success" | "info" | "danger"; texto: string }> = {
  al_dia: { tono: "success", texto: "Al día" },
  hay_nueva: { tono: "info", texto: "Versión nueva" },
  error: { tono: "danger", texto: "No se pudo revisar" },
};

const RECOMENDACION: Record<Recomendacion, { tono: "success" | "warning" | "danger"; texto: string }> = {
  seguro: { tono: "success", texto: "Seguro" },
  revisar: { tono: "warning", texto: "Revisar" },
  no_actualizar: { tono: "danger", texto: "No actualizar" },
};

const RIESGO: Record<Riesgo, { tono: "success" | "warning" | "danger"; texto: string }> = {
  bajo: { tono: "success", texto: "Riesgo bajo" },
  medio: { tono: "warning", texto: "Riesgo medio" },
  alto: { tono: "danger", texto: "Riesgo alto" },
};

const INICIAL: ActualizacionesState = { ok: false, error: null };

function aResultado(r: ActualizacionesState): { error?: string } | void {
  if (!r.ok) return { error: ERROR_ACCION[r.error ?? "service"] };
}

const caja = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5) var(--s-6)",
} as const;

const etiqueta = {
  font: "700 10.5px/1 var(--f-sans)",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  margin: "0 0 var(--s-2)",
} as const;

const cuerpo = { font: "400 13.5px/1.6 var(--f-sans)", color: "var(--ink-soft)", margin: 0 } as const;

function BotonRevisar({ onError, variante }: { onError: (m: string) => void; variante: "ghost" | "primary" }) {
  return (
    <ActionButton
      variant={variante}
      size="sm"
      idleLabel="Revisar ahora"
      loadingLabel="Revisando…"
      successLabel="Revisado"
      idleIcon={Icon.refresh(14)}
      successIcon={Icon.check(14)}
      onAction={async () => aResultado(await revisarVersionesAhora())}
      onError={onError}
    />
  );
}

function InformeAnalisis({ analisis }: { analisis: AnalisisVista }) {
  const rec = RECOMENDACION[analisis.recomendacion];
  return (
    <div style={{ display: "grid", gap: "var(--s-3)", borderTop: "1px solid var(--border)", paddingTop: "var(--s-4)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", alignItems: "center" }}>
        <span style={{ font: "700 14px/1.3 var(--f-sans)", color: "var(--ink)" }}>Análisis del salto</span>
        <Badge tone={rec.tono}>{rec.texto}</Badge>
        <span style={{ font: "400 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {analisis.motor === "glm" ? `Con IA (${analisis.modelo ?? "GLM"})` : "Sin IA"} · {analisis.creadoTexto}
        </span>
      </div>
      <p style={{ ...cuerpo, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{analisis.resumen}</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--s-2)" }}>
        {analisis.piezas.map((p) => (
          <li key={p.id} style={{ background: "var(--bg-base)", borderRadius: "var(--r-md)", padding: "var(--s-3) var(--s-4)", display: "grid", gap: "var(--s-1)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", alignItems: "center" }}>
              <span style={{ font: "600 13.5px/1.4 var(--f-sans)", color: "var(--ink)" }}>{p.nombre}</span>
              <Badge tone={RIESGO[p.riesgo].tono} size="sm">{RIESGO[p.riesgo].texto}</Badge>
            </div>
            <p style={{ ...cuerpo, whiteSpace: "pre-wrap" }}>{p.motivo}</p>
            {p.archivos.length > 0 && (
              <p style={{ ...cuerpo, font: "400 12px/1.5 var(--f-mono)", wordBreak: "break-all" }}>{p.archivos.join(" · ")}</p>
            )}
          </li>
        ))}
      </ul>
      <p style={{ ...cuerpo, font: "400 12.5px/1.5 var(--f-sans)" }}>
        Es un informe: no instala nada. Al motor solo le llega código ({analisis.archivos} archivo{analisis.archivos === 1 ? "" : "s"}
        {analisis.recortado ? ", recortado por tamaño" : ""}), nunca datos de clientes ni claves. La decisión de subir sigue siendo de Sam.
      </p>
    </div>
  );
}

export function ActualizacionesPanel({ revision, pedidos, analisis = null }: Props) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const banner = error && (
    <div
      role="alert"
      style={{
        display: "flex",
        gap: "var(--s-2)",
        alignItems: "center",
        background: "var(--bg-surface)",
        border: "1px solid var(--danger-border)",
        borderRadius: "var(--r-md)",
        padding: "var(--s-3) var(--s-4)",
        marginBottom: "var(--s-4)",
        font: "400 13px/1.5 var(--f-sans)",
        color: "var(--ink)",
      }}
    >
      <span style={{ color: "var(--danger-text)", display: "inline-flex" }}>{Icon.warn(14)}</span>
      {error}
    </div>
  );

  if (!revision) {
    return (
      <section>
        {banner}
        <EmptyState
          eyebrow="Chatwoot"
          title="Todavía no hay revisiones"
          description="La primera sale con la revisión diaria. Si no quieres esperar, revisa ahora: Studio consulta la versión instalada y las publicadas, sin tocar nada."
          action={<BotonRevisar variante="primary" onError={setError} />}
        />
      </section>
    );
  }

  const estado = ESTADO[revision.estado];
  const seguridad = revision.pendientes.some((p) => p.seguridad);
  const yaPedida = revision.disponible ? pedidos.find((p) => p.hasta === revision.disponible) : undefined;

  return (
    <section style={{ display: "grid", gap: "var(--s-6)" }}>
      <div>
        {banner}
        <div style={{ ...caja, display: "grid", gap: "var(--s-5)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", alignItems: "center" }}>
              <Badge tone={estado.tono}>{estado.texto}</Badge>
              {seguridad && <Badge tone="warning">Trae arreglos de seguridad</Badge>}
            </div>
            <BotonRevisar variante="ghost" onError={setError} />
          </div>

          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--s-4)", margin: 0 }}>
            <div>
              <dt style={etiqueta}>Instalada</dt>
              <dd style={{ margin: 0, font: "600 20px/1.2 var(--f-mono)", color: "var(--ink)" }}>{revision.instalada ?? "—"}</dd>
            </div>
            <div>
              <dt style={etiqueta}>Publicada</dt>
              <dd style={{ margin: 0, font: "600 20px/1.2 var(--f-mono)", color: "var(--ink)" }}>{revision.disponible ?? "—"}</dd>
            </div>
            <div>
              <dt style={etiqueta}>Última revisión</dt>
              <dd style={{ margin: 0, font: "400 14px/1.4 var(--f-sans)", color: "var(--ink)" }}>{revision.revisadaTexto}</dd>
            </div>
          </dl>

          {revision.error && (
            <p style={{ ...cuerpo, display: "flex", gap: "var(--s-2)", alignItems: "center", color: "var(--ink)" }}>
              <span style={{ color: "var(--danger-text)", display: "inline-flex" }}>{Icon.warn(14)}</span>
              {ERROR_REVISION[revision.error]}
            </p>
          )}
          {revision.estado === "al_dia" && <p style={cuerpo}>Tienes la versión más nueva que publica Chatwoot.</p>}
        </div>
      </div>

      {revision.estado === "hay_nueva" && revision.disponible && revision.instalada && (
        <div style={{ ...caja, display: "grid", gap: "var(--s-3)" }}>
          <h2 style={{ font: "700 16px/1.3 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
            Subir de {revision.instalada} a {revision.disponible}
          </h2>
          <p style={cuerpo}>
            Pedirla deja el pedido registrado; <b style={{ color: "var(--ink)" }}>no instala nada</b>. La subida la hacen
            Sam y la dirección técnica en una ventana nocturna, con respaldo antes, prueba en copia y verificación
            después de la protección del número de WhatsApp y del borrado de datos en los registros.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", alignItems: "center", justifyContent: "flex-end" }}>
            {(!analisis || analisis.motor === "sin_ia") && (
              <ActionButton
                variant="ghost"
                size="sm"
                idleLabel={analisis ? "Intentar con IA otra vez" : "Analizar con IA"}
                loadingLabel="Analizando…"
                successLabel="Analizado"
                successIcon={Icon.check(14)}
                onAction={async () => {
                  setError(null);
                  const fd = new FormData();
                  fd.set("from_version", revision.instalada ?? "");
                  fd.set("to_version", revision.disponible ?? "");
                  return aResultado(await analizarConIa(INICIAL, fd));
                }}
                onSuccess={() => toast.success("Análisis listo. Es un informe: no se instaló nada.")}
                onError={setError}
              />
            )}
            {yaPedida ? (
              <p style={{ ...cuerpo, display: "flex", gap: "var(--s-2)", alignItems: "center", color: "var(--ink)" }}>
                <span style={{ color: "var(--success)", display: "inline-flex" }}>{Icon.check(14)}</span>
                Pedida el {yaPedida.pedidoTexto} {yaPedida.propio ? "por ti" : "por otro administrador"}.
              </p>
            ) : (
              <ActionButton
                variant="primary"
                size="sm"
                idleLabel={`Pedir actualización a ${revision.disponible}`}
                loadingLabel="Pidiendo…"
                successLabel="Pedida"
                successIcon={Icon.check(14)}
                onAction={async () => {
                  setError(null);
                  const fd = new FormData();
                  fd.set("to_version", revision.disponible ?? "");
                  return aResultado(await pedirActualizacion(INICIAL, fd));
                }}
                onSuccess={() => toast.success(`Actualización a ${revision.disponible} pedida. Queda registrada; no se instaló nada.`)}
                onError={setError}
              />
            )}
          </div>
          {analisis && <InformeAnalisis analisis={analisis} />}
        </div>
      )}

      {revision.pendientes.length > 0 && (
        <div style={{ display: "grid", gap: "var(--s-3)" }}>
          <h2 style={{ font: "700 16px/1.3 var(--f-sans)", color: "var(--ink)", margin: 0 }}>Qué trae cada versión</h2>
          {revision.pendientes.map((p) => (
            <article key={p.version} style={{ ...caja, padding: "var(--s-4) var(--s-5)", display: "grid", gap: "var(--s-2)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", alignItems: "baseline" }}>
                  <span style={{ font: "600 15px/1.2 var(--f-mono)", color: "var(--ink)" }}>{p.version}</span>
                  <span style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                    {p.nombre !== `v${p.version}` ? `${p.nombre} · ` : ""}
                    {p.publicadaTexto}
                  </span>
                  {p.seguridad && <Badge tone="warning" size="sm">Seguridad</Badge>}
                </div>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="studio-btn studio-btn-ghost studio-btn-xs"
                    aria-label={`Ver las notas de ${p.version} en GitHub (se abre en otra pestaña)`}
                  >
                    Ver en GitHub {Icon.external(12)}
                  </a>
                )}
              </div>
              {p.notas ? (
                <details>
                  <summary style={{ cursor: "pointer", font: "600 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                    Notas de la versión
                  </summary>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      font: "400 13px/1.6 var(--f-sans)",
                      color: "var(--ink-soft)",
                      background: "var(--bg-base)",
                      borderRadius: "var(--r-md)",
                      padding: "var(--s-3) var(--s-4)",
                      margin: "var(--s-2) 0 0",
                      maxHeight: 360,
                      overflow: "auto",
                    }}
                  >
                    {p.notas}
                  </pre>
                </details>
              ) : (
                <p style={cuerpo}>Chatwoot no publicó notas para esta versión.</p>
              )}
            </article>
          ))}
          {revision.recortado && (
            <p style={cuerpo}>Hay más versiones pendientes; se muestran las 10 más nuevas.</p>
          )}
        </div>
      )}

      <div style={{ display: "grid", gap: "var(--s-3)" }}>
        <h2 style={{ font: "700 16px/1.3 var(--f-sans)", color: "var(--ink)", margin: 0 }}>Pedidos</h2>
        {pedidos.length === 0 ? (
          <p style={cuerpo}>Todavía no hay pedidos de actualización.</p>
        ) : (
          <div style={{ ...caja, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", font: "400 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Fecha", "Versión", "Pidió"].map((h) => (
                    <th key={h} scope="col" style={{ ...etiqueta, margin: 0, padding: "var(--s-3) var(--s-5)", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: "var(--s-3) var(--s-5)", borderBottom: "1px solid var(--border)" }}>{p.pedidoTexto}</td>
                    <td style={{ padding: "var(--s-3) var(--s-5)", borderBottom: "1px solid var(--border)", fontFamily: "var(--f-mono)" }}>
                      {p.desde} → {p.hasta}
                    </td>
                    <td style={{ padding: "var(--s-3) var(--s-5)", borderBottom: "1px solid var(--border)" }}>
                      {p.propio ? "Tú" : "Otro administrador"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
