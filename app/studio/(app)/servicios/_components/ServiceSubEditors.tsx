"use client";

/**
 * Sub-editores del módulo Configuración de servicios (SDD-0076 Fase 2 · editor diferido).
 *
 * FaqEditor / AddonEditor / PriceHistoryEditor — CRUD ligero sobre las tablas
 * hijas (service_faqs / service_addons / service_price_history). Cada uno: lista
 * + form de alta. Las acciones revalidan /studio/servicios → la lista se refresca
 * sola (el drawer se mantiene montado). El form de alta se limpia vía `key`.
 *
 * Patrón del Studio: studio-input/label/btn, ActionButton para acciones críticas,
 * useToast, tokens var(--*), tuteo VE, sentence case.
 */

import { useActionState, useEffect } from "react";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  upsertServiceFaqAction,
  toggleFaqPublishAction,
  softDeleteFaqAction,
  upsertServiceAddonAction,
  softDeleteAddonAction,
  addPriceHistoryAction,
} from "@/lib/studio/service-catalog/actions";
import type {
  ServiceFaq,
  ServiceAddon,
  ServicePriceEntry,
} from "@/lib/studio/service-catalog/types";

type ActState = { ok?: boolean; error?: string };
const initial: ActState = {};

const labelStyle = { display: "block", marginBottom: 6 } as const;
const emptyStyle = {
  font: "400 13px/1.5 var(--f-sans)",
  color: "var(--ink-soft)",
  margin: "0 0 12px",
};

// ───────────────────────── FAQ ─────────────────────────

export function FaqEditor({
  serviceKey,
  faqs,
}: {
  serviceKey: string;
  faqs: ServiceFaq[];
}) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    upsertServiceFaqAction,
    initial,
  );

  useEffect(() => {
    if (state.ok) toast.success("FAQ guardada.");
    if (state.error) toast.error(state.error);
  }, [state, toast]);

  return (
    <div>
      {faqs.length === 0 ? (
        <p style={emptyStyle}>Todavía no hay FAQ para este servicio.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {faqs.map((f) => (
            <li
              key={f.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: 12,
                background: "var(--bg-elevated)",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <p style={{ font: "600 13px/1.4 var(--f-sans)", color: "var(--ink)", margin: 0, flex: 1 }}>
                  {f.question}
                </p>
                <Badge tone={f.audience === "internal" ? "warning" : "info"} size="sm">
                  {f.audience === "internal" ? "Interna" : "Pública"}
                </Badge>
                {f.audience === "public" && (
                  <Badge tone={f.is_public ? "success" : "neutral"} size="sm">
                    {f.is_public ? "Publicada" : "Borrador"}
                  </Badge>
                )}
              </div>
              <p style={{ font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 10px" }}>
                {f.answer}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {f.audience === "public" && (
                  <ActionButton
                    variant={f.is_public ? "ghost" : "primary"}
                    size="sm"
                    idleLabel={f.is_public ? "Despublicar" : "Publicar"}
                    loadingLabel={f.is_public ? "Quitando…" : "Publicando…"}
                    successLabel={f.is_public ? "Despublicada" : "Publicada"}
                    onAction={() => toggleFaqPublishAction(f.id, !f.is_public)}
                    onError={(m) => toast.error(m)}
                  />
                )}
                <ActionButton
                  variant="danger"
                  size="sm"
                  idleLabel="Eliminar"
                  loadingLabel="Eliminando…"
                  successLabel={null}
                  onAction={() => softDeleteFaqAction(f.id)}
                  onSuccess={() => toast.success("FAQ eliminada.")}
                  onError={(m) => toast.error(m)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form key={faqs.length} action={formAction} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <input type="hidden" name="service_key" value={serviceKey} />
        <p className="studio-eyebrow" style={{ color: "var(--ink-soft)", margin: "0 0 12px" }}>
          Agregar FAQ
        </p>
        <label className="studio-label" style={labelStyle}>Pregunta</label>
        <input className="studio-input" name="question" required style={{ marginBottom: 10 }} />
        <label className="studio-label" style={labelStyle}>Respuesta</label>
        <textarea className="studio-input" name="answer" rows={2} required style={{ marginBottom: 10 }} />
        <label className="studio-label" style={labelStyle}>Audiencia</label>
        <select className="studio-input" name="audience" defaultValue="public" style={{ marginBottom: 12 }}>
          <option value="public">Pública (la ve el cliente si se publica)</option>
          <option value="internal">Interna (solo el equipo)</option>
        </select>
        <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm" disabled={isPending} aria-busy={isPending}>
          {isPending ? "Agregando…" : "Agregar FAQ"}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────── Adicionales ───────────────────────

export function AddonEditor({
  serviceKey,
  addons,
}: {
  serviceKey: string;
  addons: ServiceAddon[];
}) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    upsertServiceAddonAction,
    initial,
  );

  useEffect(() => {
    if (state.ok) toast.success("Adicional guardado.");
    if (state.error) toast.error(state.error);
  }, [state, toast]);

  return (
    <div>
      {addons.length === 0 ? (
        <p style={emptyStyle}>Todavía no hay adicionales para este servicio.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {addons.map((a) => (
            <li
              key={a.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: 12,
                background: "var(--bg-elevated)",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <p style={{ font: "600 13px/1.4 var(--f-sans)", color: "var(--ink)", margin: 0, flex: 1 }}>
                  {a.nombre}
                  {a.tarifa && (
                    <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}> · {a.tarifa}</span>
                  )}
                </p>
                <ActionButton
                  variant="danger"
                  size="sm"
                  idleLabel="Eliminar"
                  loadingLabel="Eliminando…"
                  successLabel={null}
                  onAction={() => softDeleteAddonAction(a.id)}
                  onSuccess={() => toast.success("Adicional eliminado.")}
                  onError={(m) => toast.error(m)}
                />
              </div>
              {a.condicion && (
                <p style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
                  Condición: {a.condicion}
                </p>
              )}
              {a.politica_texto && (
                <p style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "4px 0 0" }}>
                  Política: {a.politica_texto}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form key={addons.length} action={formAction} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <input type="hidden" name="service_key" value={serviceKey} />
        <p className="studio-eyebrow" style={{ color: "var(--ink-soft)", margin: "0 0 12px" }}>
          Agregar adicional
        </p>
        <label className="studio-label" style={labelStyle}>Nombre</label>
        <input className="studio-input" name="nombre" required placeholder="ej. Almacenaje en bodega" style={{ marginBottom: 10 }} />
        <label className="studio-label" style={labelStyle}>Condición</label>
        <input className="studio-input" name="condicion" placeholder="ej. tras 7 días gratis" style={{ marginBottom: 10 }} />
        <label className="studio-label" style={labelStyle}>Tarifa</label>
        <input className="studio-input" name="tarifa" placeholder="ej. $X/CBM/día" style={{ marginBottom: 10 }} />
        <label className="studio-label" style={labelStyle}>Política (se inyecta en condiciones)</label>
        <textarea className="studio-input" name="politica_texto" rows={2} style={{ marginBottom: 12 }} />
        <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm" disabled={isPending} aria-busy={isPending}>
          {isPending ? "Agregando…" : "Agregar adicional"}
        </button>
      </form>
    </div>
  );
}

// ──────────────────── Historial de precios ────────────────────

export function PriceHistoryEditor({
  serviceKey,
  entries,
}: {
  serviceKey: string;
  entries: ServicePriceEntry[];
}) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    addPriceHistoryAction,
    initial,
  );

  useEffect(() => {
    if (state.ok) toast.success("Precio registrado.");
    if (state.error) toast.error(state.error);
  }, [state, toast]);

  return (
    <div>
      {entries.length === 0 ? (
        <p style={emptyStyle}>Sin historial de precios todavía.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((e) => (
            <li
              key={e.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "baseline",
                borderBottom: "1px solid var(--border)",
                paddingBottom: 8,
              }}
            >
              <span style={{ font: "600 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                {e.monto_texto}
              </span>
              <span style={{ font: "400 11.5px/1.4 var(--f-mono)", color: "var(--ink-soft)" }}>
                {e.moneda} · desde {e.valid_from}
              </span>
              {e.nota && (
                <span style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                  — {e.nota}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <form key={entries.length} action={formAction} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <input type="hidden" name="service_key" value={serviceKey} />
        <p className="studio-eyebrow" style={{ color: "var(--ink-soft)", margin: "0 0 12px" }}>
          Registrar precio
        </p>
        <label className="studio-label" style={labelStyle}>Precio o condición</label>
        <input className="studio-input" name="monto_texto" required placeholder="ej. $50/orden · 8% comisión" style={{ marginBottom: 10 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
          <div>
            <label className="studio-label" style={labelStyle}>Moneda</label>
            <select className="studio-input" name="moneda" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="VES">VES</option>
              <option value="CNY">CNY</option>
            </select>
          </div>
          <div>
            <label className="studio-label" style={labelStyle}>Vigente desde</label>
            <input className="studio-input" type="date" name="valid_from" />
          </div>
        </div>
        <label className="studio-label" style={labelStyle}>Nota (opcional)</label>
        <input className="studio-input" name="nota" style={{ marginBottom: 12 }} />
        <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm" disabled={isPending} aria-busy={isPending}>
          {isPending ? "Registrando…" : "Registrar precio"}
        </button>
      </form>
    </div>
  );
}
