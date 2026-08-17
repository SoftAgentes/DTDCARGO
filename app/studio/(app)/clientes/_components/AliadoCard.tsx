"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  ALIADO_STATUSES,
  aliadoStatusLabel,
  aliadoStatusTone,
  billingModelLabel,
  parentOptions,
  prefixChain,
  type Aliado,
  type AliadoActionState,
  type AliadoOption,
} from "@/lib/studio/aliados/aliado-types";
import { printMarkbox } from "@/lib/shared/markbox-chain";
import { actualizarAliadoAction, convertirEnAliadoAction } from "../actions";

/**
 * Marca a un cliente como **aliado white-label** y edita su acuerdo (SDD-0255).
 *
 * El aliado es otra empresa de puerta a puerta que revende el servicio de DTD
 * bajo su marca y atiende ella a sus propios clientes. No hay detección
 * automática: esto se marca a mano.
 *
 * La tarjeta muestra en vivo cómo va a quedar el Shipping Mark de sus clientes en
 * sus DOS formas, porque son distintas y esa es justo la parte que se olvida:
 * la guardada lleva la cadena completa (`DC-FA-0001`) y la impresa omite la raíz
 * (`FA-0001`), para que el cliente del sub-aliado no vea de quién cuelga.
 */
export function AliadoCard({
  clientId,
  clientName,
  markbox,
  aliado,
  aliados,
  canEdit,
}: {
  clientId: string;
  clientName: string;
  markbox: string;
  /** El aliado que ya cuelga de este cliente, o null si todavía no lo es. */
  aliado: Aliado | null;
  /** Todos los aliados del tenant, para elegir padre y componer la cadena. */
  aliados: AliadoOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const esAliado = aliado != null;

  const [abierto, setAbierto] = useState(false);
  const [prefix, setPrefix] = useState(aliado?.prefix ?? "");
  const [parentId, setParentId] = useState(aliado?.parent_aliado_id ?? "");

  const accion = esAliado
    ? actualizarAliadoAction.bind(null, aliado.id, markbox)
    : convertirEnAliadoAction.bind(null, markbox);

  const [state, formAction, pending] = useActionState<AliadoActionState, FormData>(
    async (prev, fd) => {
      const res = await accion(prev, fd);
      if (res?.ok) {
        setAbierto(false);
        router.refresh();
      }
      return res;
    },
    null,
  );

  // Sub-insignias: los aliados que cuelgan de ÉSTE. Es el caso del founder —
  // Dynasty Cargo con su insignia DC, y las otras puerta a puerta que ella captó,
  // cada una con la suya. Sus clientes salen `DC-FA-1232` guardado y `FA-1232`
  // impreso, así que el cliente de FA no ve de quién cuelga.
  const subInsignias = aliado ? aliados.filter((a) => a.parentAliadoId === aliado.id) : [];

  // Cadena previsualizada: los prefijos del padre elegido + el que se escribe.
  const padres = parentOptions(aliados, aliado?.id ?? null);
  const cadenaPadre = parentId ? prefixChain(aliados, parentId) : "";
  const prefijoLimpio = prefix.trim().toUpperCase();
  const cadena = [cadenaPadre, prefijoLimpio].filter(Boolean).join("-");
  const ejemploGuardado = cadena ? `${cadena}-0001` : null;
  const ejemploImpreso = ejemploGuardado ? printMarkbox(ejemploGuardado) : null;
  const ocultaRaiz = ejemploGuardado != null && ejemploImpreso !== ejemploGuardado;

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span className="studio-eyebrow">Aliado white-label</span>
        <Badge tone={esAliado ? aliadoStatusTone(aliado.status) : "neutral"} size="md">
          {esAliado ? aliadoStatusLabel(aliado.status) : "No es aliado"}
        </Badge>
      </div>

      {esAliado ? (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ font: "700 22px/1.2 var(--f-mono)", color: "var(--ink)" }}>
              {prefixChain(aliados, aliado.id)}
            </div>
            <div style={{ font: "500 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
              {aliado.trade_name}
              {aliado.parent_aliado_id ? " · sub-aliado" : " · aliado raíz"}
            </div>
          </div>

          <dl style={{ margin: "0 0 14px", display: "grid", gap: 8 }}>
            <Fila
              termino="Cobro"
              valor={billingModelLabel(aliado.billing_model)}
              nota={
                aliado.parent_aliado_id
                  ? "Hereda del aliado raíz — un sub-aliado no factura con DTD."
                  : "El monto se define aparte."
              }
            />
            {aliado.agreement_notes && (
              <Fila termino="Acuerdo" valor={aliado.agreement_notes} />
            )}
          </dl>

          <div
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: 12,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                font: "600 11px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Sub-insignias
            </div>

            {subInsignias.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {subInsignias.map((s) => (
                  <li key={s.id} style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ font: "600 14px/1.3 var(--f-mono)", color: "var(--ink)", letterSpacing: "0.04em" }}>
                      {prefixChain(aliados, s.id)}
                    </span>
                    <span style={{ font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                      {s.tradeName}
                    </span>
                    {s.markbox && (
                      <Link
                        href={`/studio/clientes/${encodeURIComponent(s.markbox)}`}
                        style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)", textDecoration: "underline" }}
                      >
                        ver ficha
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ font: "500 12.5px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
                Todavía ninguna. Si {aliado.trade_name} hizo alianza con otra
                puerta a puerta y quiere darle su propia insignia, ábrele ficha de
                cliente a esa empresa y en su ficha usa{" "}
                <b style={{ color: "var(--ink)" }}>Convertir en aliado</b> eligiendo{" "}
                <b style={{ color: "var(--ink)" }}>Cuelga de: {prefixChain(aliados, aliado.id)}</b>.
              </p>
            )}

            {subInsignias.length > 0 && (
              <p style={{ font: "500 12px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: "10px 0 0" }}>
                Sus clientes llevan la cadena completa en el Studio y sólo su
                propia insignia en los documentos, así que no ven de quién cuelgan.
              </p>
            )}
          </div>
        </>
      ) : (
        <p
          style={{
            font: "500 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 12px",
          }}
        >
          <b style={{ color: "var(--ink)" }}>{clientName}</b> es hoy un cliente
          directo de DTD. Márcalo como aliado si revende el servicio bajo su marca
          y atiende él a sus propios clientes — sus clientes van a llevar la
          insignia que le pongas, no <span style={{ font: "inherit" }}>DTD-</span>.
        </p>
      )}

      {!canEdit ? (
        <p style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          No tienes permiso para editar clientes.
        </p>
      ) : !abierto ? (
        <button
          type="button"
          className="studio-btn studio-btn-dark studio-btn-sm"
          onClick={() => setAbierto(true)}
        >
          {esAliado ? "Editar acuerdo" : "Convertir en aliado"}
        </button>
      ) : (
        <form action={formAction} style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="clientId" value={clientId} />

          <div>
            <label htmlFor="aliado-prefix" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
              Insignia
            </label>
            <input
              id="aliado-prefix"
              name="prefix"
              className="studio-input"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="HR"
              maxLength={4}
              autoComplete="off"
              style={{ width: "100%", font: "600 15px/1.3 var(--f-mono)", letterSpacing: "0.06em" }}
            />
            <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
              2 a 4 letras, única en todo el sistema. No puede ser DTD, ITS, AD ni LEG.
            </p>
          </div>

          <div>
            <label htmlFor="aliado-trade" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
              Nombre comercial
            </label>
            <input
              id="aliado-trade"
              name="tradeName"
              className="studio-input"
              defaultValue={aliado?.trade_name ?? clientName}
              placeholder="Herneka"
              maxLength={120}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label htmlFor="aliado-parent" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
              Cuelga de
            </label>
            <select
              id="aliado-parent"
              name="parentAliadoId"
              className="studio-input"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">DTD Cargo — es aliado raíz</option>
              {padres.map((p) => (
                <option key={p.id} value={p.id}>
                  {prefixChain(aliados, p.id)} · {p.tradeName}
                </option>
              ))}
            </select>
            <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
              Un aliado raíz factura con DTD. Un sub-aliado le factura a su padre y
              hereda su tarifa.
            </p>
          </div>

          {ejemploGuardado && (
            <div
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: 12,
              }}
            >
              <div style={{ font: "600 11px/1.3 var(--f-sans)", color: "var(--ink-soft)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                Así va a quedar el Shipping Mark de sus clientes
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <Ejemplo etiqueta="En el Studio" valor={ejemploGuardado} />
                <Ejemplo etiqueta="En documentos" valor={ejemploImpreso!} />
              </div>
              {ocultaRaiz && (
                <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "8px 0 0" }}>
                  El cliente final ve <b style={{ color: "var(--ink)" }}>{ejemploImpreso}</b> — sin{" "}
                  <b style={{ color: "var(--ink)" }}>{cadenaPadre}</b>, así no sabe de quién cuelga.
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="aliado-notes" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
              Acuerdo
            </label>
            <textarea
              id="aliado-notes"
              name="agreementNotes"
              className="studio-input"
              defaultValue={aliado?.agreement_notes ?? ""}
              rows={3}
              placeholder="Qué se pactó: tarifa, exclusividad por zona, volumen mínimo…"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          {esAliado && (
            <div>
              <label htmlFor="aliado-status" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
                Estado
              </label>
              <select
                id="aliado-status"
                name="status"
                className="studio-input"
                defaultValue={aliado.status}
                style={{ width: "100%" }}
              >
                {ALIADO_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {aliadoStatusLabel(s)}
                  </option>
                ))}
              </select>
              <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
                Suspendido o cerrado deja de emitir códigos nuevos. Los clientes que
                ya tiene no se tocan.
              </p>
            </div>
          )}

          {state?.error && (
            <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--danger)", margin: 0 }}>
              {state.error}
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="studio-btn studio-btn-dark studio-btn-sm" disabled={pending} aria-busy={pending}>
              {pending ? "Guardando…" : esAliado ? "Guardar acuerdo" : "Convertir en aliado"}
            </button>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => setAbierto(false)}
              disabled={pending}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Fila({ termino, valor, nota }: { termino: string; valor: string; nota?: string }) {
  return (
    <div>
      <dt style={{ font: "600 11px/1.3 var(--f-sans)", color: "var(--ink-soft)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {termino}
      </dt>
      <dd style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink)", margin: "2px 0 0" }}>
        {valor}
        {nota && (
          <span style={{ display: "block", color: "var(--ink-soft)", font: "500 12px/1.4 var(--f-sans)" }}>
            {nota}
          </span>
        )}
      </dd>
    </div>
  );
}

function Ejemplo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)", minWidth: 96 }}>
        {etiqueta}
      </span>
      <span style={{ font: "600 15px/1.3 var(--f-mono)", color: "var(--ink)", letterSpacing: "0.04em" }}>
        {valor}
      </span>
    </div>
  );
}
