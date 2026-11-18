"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { formatObservedCents, normalizeManualShipmentCode, observedRatesTotal, sumFixedMeasures,
  validateCloseManifestInput, validateMembershipInput } from "@/lib/studio/client-consolidation/normal-flow";
import type { CloseManifestInput, ConfirmMembershipInput, FixedMeasures, NormalContext,
  NormalReceipt, NormalService, ObservedRates } from "@/lib/studio/client-consolidation/types";
import { closeClientManifestAction, confirmClientShipmentsAction, loadClientManifestAction } from "../actions";
import { calcularPlanCargaAction } from "../plan-actions";

type Options = { service: NormalService | ""; destinationId: string; code: string };
type Prepared = { kind: "membership"; input: ConfirmMembershipInput } | { kind: "close"; input: CloseManifestInput };
const ZERO: FixedMeasures = { cbm: "0.000", weightKg: "0.00", boxes: 0 };
const PANEL = { padding: "var(--s-4)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" } as const;

function deltaRates(receipts: NormalReceipt[], observedAt: string): ObservedRates {
  const known = receipts.reduce((sum, receipt) => sum + BigInt(receipt.rate?.amountCents ?? "0"), BigInt(0)).toString();
  const missing = receipts.filter((receipt) => !receipt.rate).map((receipt) => receipt.receiptId);
  return { membershipRevision: 0, observedAt, snapshotIds: receipts.flatMap((receipt) => receipt.rate ? [receipt.rate.snapshotId] : []),
    missingReceiptIds: missing, receiptCount: receipts.length, knownSubtotalCents: known, totalCents: missing.length ? null : known, complete: true };
}

function Measures({ value }: { value: FixedMeasures }) {
  return <span>{value.boxes} cajas · {value.cbm} CBM · {value.weightKg} kg</span>;
}

function Price({ parts }: { parts: ObservedRates[] }) {
  const total = observedRatesTotal(parts);
  return <p style={{ margin: "var(--s-2) 0", color: "var(--ink-soft)" }}>
    Subtotal conocido: {formatObservedCents(total.knownSubtotalCents)}. {total.totalCents === null
      ? `Total pendiente · ${total.missing} recepción(es) sin tarifa o lectura incompleta.`
      : `Total observado: ${formatObservedCents(total.totalCents)}.`} Observación: {parts[0]?.observedAt ?? "sin hora disponible"}. No genera una factura ni un saldo.
  </p>;
}

/** Preparation is editable; only a frozen reviewed intention gets a reference. */
export function ConfirmarEnviosClienteDrawer({ containerId, containerRef, onClose }: {
  containerId: string; containerRef: string; onClose: () => void;
}) {
  const router = useRouter();
  const formId = useId();
  const reviewRef = useRef<HTMLHeadingElement>(null);
  const readEpoch = useRef(0);
  const alive = useRef(true);
  const busy = useRef(false);
  const planReference = useRef<string | null>(null);
  const [context, setContext] = useState<NormalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [target, setTarget] = useState("new");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [options, setOptions] = useState<Record<string, Options>>({});
  const [reason, setReason] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);

  const load = useCallback(async () => {
    const epoch = ++readEpoch.current;
    setLoading(true); setError(null);
    try {
      const response = await loadClientManifestAction(containerId);
      if (!alive.current || readEpoch.current !== epoch) return;
      if (!response.context) { setContext(null); setError(response.error ?? "No se pudo leer el manifiesto completo."); }
      else { setContext(response.context); setSelected(new Set()); setOptions({}); setPrepared(null);
        setTarget((current) => response.context!.manifest?.groups.some((group) => group.groupId === current) ? current : "new"); }
    } catch { if (alive.current && readEpoch.current === epoch) { setContext(null); setError("No se pudo leer el manifiesto completo. Actualiza antes de continuar."); } }
    finally { if (alive.current && readEpoch.current === epoch) setLoading(false); }
  }, [containerId]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; readEpoch.current += 1; }; }, [load]);
  useEffect(() => { if (prepared) reviewRef.current?.focus(); }, [prepared]);

  const manifest = context?.manifest;
  const existingClients = useMemo(() => new Set(manifest?.groups.map((group) => group.clientId) ?? []), [manifest]);
  const group = manifest?.groups.find((entry) => entry.groupId === target) ?? null;
  const chosen = useMemo(() => context?.receipts.filter((receipt) => selected.has(receipt.receiptId)) ?? [], [context, selected]);
  const byClient = useMemo(() => {
    const groups = new Map<string, NormalReceipt[]>();
    for (const receipt of chosen) if (receipt.clientId) groups.set(receipt.clientId, [...(groups.get(receipt.clientId) ?? []), receipt]);
    return [...groups.entries()];
  }, [chosen]);
  const chooseOptions = (clientId: string, receipts: NormalReceipt[]): Options => {
    if (group) return { service: group.service, destinationId: group.destinationId, code: group.code };
    if (options[clientId]) return options[clientId];
    const first = receipts[0];
    const matches = context?.destinations.filter((destination) => destination.destination === first?.destination) ?? [];
    return { service: first?.service ?? "", destinationId: matches.length === 1 ? matches[0].id : "", code: "" };
  };
  const blocked = (receipt: NormalReceipt): string | null => {
    if (!receipt.eligible || !receipt.measures || !receipt.clientId) return receipt.blockedReason ?? "Recepción incompleta o no disponible para incorporar.";
    if (group) {
      if (receipt.clientId !== group.clientId) return "Pertenece a otro cliente.";
      if ((receipt.service && receipt.service !== group.service) || (receipt.destination && receipt.destination !== group.destination)) return "Servicio o destino distinto al envío.";
    } else if (existingClients.has(receipt.clientId)) return "Este cliente ya tiene un envío aquí. Elígelo para agregar recepciones.";
    return null;
  };
  const canEdit = !!context && context.availability === "ready" && !!manifest?.canConfirm && manifest.status === "consolidando" && !manifest.sealed;
  const canClose = !!manifest && manifest.canClose && manifest.status === "consolidando" && !manifest.sealed && manifest.groups.length > 0
    && manifest.groups.every((entry) => entry.status === "consolidating") && manifest.expectedBoxIds.length > 0
    && manifest.missingBoxIds.length === 0 && manifest.unexpectedBoxIds.length === 0;

  function prepareMembership(event: React.FormEvent) {
    event.preventDefault(); if (!context || !manifest || pending || loading) return;
    for (const [clientId, receipts] of byClient) {
      const choice = chooseOptions(clientId, receipts);
      const destination = context.destinations.find((entry) => entry.id === choice.destinationId);
      const incompatible = receipts.find((receipt) => (receipt.service && receipt.service !== choice.service)
        || (receipt.destination && destination && receipt.destination !== destination.destination));
      if (incompatible) { setError(`${incompatible.receiptCode}: servicio o destino registrado distinto al del grupo. Revisa la selección.`); return; }
      if (!destination) { setError("Selecciona un destino activo compatible antes de confirmar."); return; }
    }
    const result = validateMembershipInput({ operation: group ? "extend" : "form", containerId,
      expectedContainerRevision: manifest.revision, reference: crypto.randomUUID(), reason,
      groups: byClient.map(([clientId, receipts]) => { const choice = chooseOptions(clientId, receipts); return {
        clientId, service: choice.service, destinationId: choice.destinationId, code: group ? null : choice.code,
        groupId: group?.groupId ?? null, expectedGroupRevision: group?.revision ?? null,
        receipts: receipts.map((receipt) => ({ receiptId: receipt.receiptId, sourceVersion: receipt.sourceVersion })),
      }; }),
    });
    if (!result.input) { setError(Object.values(result.fieldErrors ?? {}).join(" ")); return; }
    setError(null); setPrepared({ kind: "membership", input: result.input });
  }
  function prepareClose() {
    if (!manifest || !canClose) return;
    const result = validateCloseManifestInput({ containerId, expectedContainerRevision: manifest.revision, reference: crypto.randomUUID(), reason });
    if (!result.input) { setError(Object.values(result.fieldErrors ?? {}).join(" ")); return; }
    setError(null); setPrepared({ kind: "close", input: result.input });
  }
  async function commit(event: React.FormEvent) {
    event.preventDefault(); if (!prepared || busy.current) return;
    const epoch = readEpoch.current;
    busy.current = true; setPending(true); setError(null);
    try {
      const response = prepared.kind === "membership" ? await confirmClientShipmentsAction(prepared.input) : await closeClientManifestAction(prepared.input);
      if (!alive.current || readEpoch.current !== epoch) return;
      if (!response.ok || !response.result) { setError(response.error ?? "No se pudo confirmar. Conserva la referencia y consulta el estado actual."); return; }
      setNotice(`${response.result.outcome === "replay" ? "Resultado del intento anterior, sin repetir efectos" : "Operación registrada"}. Referencia ${response.result.reference}. ${response.warning ?? ""}`);
      await load(); router.refresh();
    } catch { if (alive.current) setError("No se pudo comprobar el resultado. Conserva esta referencia y reintenta el mismo intento o consulta el estado actual."); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }
  async function calculatePlan() {
    if (busy.current || !manifest?.canClose) return;
    const epoch = readEpoch.current;
    busy.current = true; setPending(true); setError(null);
    planReference.current ??= crypto.randomUUID();
    try {
      const result = await calcularPlanCargaAction(containerId, planReference.current);
      if (!alive.current || readEpoch.current !== epoch) return;
      if (!result.ok) { setError(result.error ?? "No se pudo comprobar el plan."); return; }
      setNotice(`Plan ${result.versionNo} guardado. El plan es una guía; no mueve cajas ni acredita cobertura física.`);
      planReference.current = null; await load(); router.refresh();
    } catch { if (alive.current) setError("No se pudo comprobar el plan. Reintenta con la misma referencia."); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }

  return <DrawerShell title={`Envíos por cliente · ${containerRef}`} subtitle={manifest ? `Revisión ${manifest.revision} · ${manifest.sealed ? "Manifiesto sellado" : "Manifiesto abierto"}` : "Lectura completa del manifiesto"}
    onClose={onClose} pending={pending} width={850}>
    <form id={formId} onSubmit={prepared ? commit : prepareMembership} aria-busy={pending || loading}
      style={{ flex: 1, overflow: "auto", padding: "var(--s-5)", display: "grid", alignContent: "start", gap: "var(--s-4)" }}>
      {error && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
      {notice && <p role="status" style={PANEL}>{notice}</p>}
      {loading && <p role="status">Leyendo el manifiesto completo…</p>}
      {!loading && !prepared && <button type="button" className="studio-btn studio-btn-ghost" disabled={pending} onClick={() => void load()}>Actualizar estado actual</button>}
      {!loading && context?.availability === "off" && <p>Los envíos por cliente no están habilitados para este ámbito.</p>}
      {!loading && manifest && <section aria-label="Cobertura del manifiesto" style={PANEL}>
        <strong>{manifest.groups.length} envío(s) · revisión {manifest.revision}</strong>
        <p>{manifest.stowedBoxIds.length} de {manifest.expectedBoxIds.length} cajas declaradas estibadas · {manifest.missingBoxIds.length} faltantes · {manifest.unexpectedBoxIds.length} ajenas.</p>
        <p>Esta cobertura compara el registro declarado y escaneado. No certifica por sí sola un hecho físico externo.</p>
        {manifest.currentPlan && <p>Plan {manifest.currentPlan.version} · revisión de carga {manifest.currentPlan.manifestRevision}.</p>}
        {manifest.groups.map((entry) => <article key={entry.groupId} style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--s-2)" }}>
          <strong>{entry.code} · {entry.clientMarkbox}</strong>{entry.clientName && <span> · {entry.clientName}</span>}
          <p>{entry.service === "consolidado_lcl" ? "Consolidado LCL" : "Puerta a puerta DDP"} · {entry.destination} · revisión {entry.revision} · {entry.receiptIds.length} recepción(es).</p>
          <Measures value={entry.measures} /><Price parts={[entry.rates]} />
        </article>)}
      </section>}
      {prepared ? <section aria-label="Confirmación de la intención revisada" style={PANEL}>
        <h3 ref={reviewRef} tabIndex={-1}>{prepared.kind === "close" ? "Confirmar cierre del manifiesto" : "Confirmar incorporación de recepciones"}</h3>
        <p>{prepared.kind === "close" ? "Se sellan la pertenencia y la cobertura completas de este contenedor. Este camino no permite reabrirlo ni agregar carga después."
          : "Las recepciones seleccionadas quedarán vinculadas a un envío de este cliente en este contenedor. Este camino no permite retirarlas, reasignarlas ni cambiar las medidas o cajas incorporadas."}</p>
        <p>Contenedor: {containerRef} · revisión revisada {prepared.input.expectedContainerRevision}.</p>
        {prepared.kind === "membership" && prepared.input.groups.map((entry) => {
          const receipts = context!.receipts.filter((receipt) => entry.receipts.some((selected) => selected.receiptId === receipt.receiptId));
          const before = manifest?.groups.find((candidate) => candidate.groupId === entry.groupId) ?? null;
          const delta = sumFixedMeasures(receipts.flatMap((receipt) => receipt.measures ? [receipt.measures] : []));
          return <article key={entry.clientId}>
            <strong>{before?.clientMarkbox ?? receipts[0]?.clientMarkbox} · {entry.code ?? before?.code}</strong>
            <p>{entry.service === "consolidado_lcl" ? "Consolidado LCL" : "Puerta a puerta DDP"} · {context!.destinations.find((destination) => destination.id === entry.destinationId)?.label} · {entry.receipts.length} recepción(es) nuevas.</p>
            <p>Antes: <Measures value={before?.measures ?? ZERO} /></p><p>Añadido: <Measures value={delta} /></p><p>Después: <Measures value={sumFixedMeasures([before?.measures ?? ZERO, delta])} /></p>
            <Price parts={[...(before ? [before.rates] : []), deltaRates(receipts, context!.observedAt)]} />
            <details><summary>Ver las recepciones de este intento</summary><ul>{receipts.map((receipt) => <li key={receipt.receiptId}>{receipt.receiptCode}</li>)}</ul></details>
          </article>;
        })}
        <p>Motivo: {prepared.input.reason}</p><p>Referencia del intento: <code>{prepared.input.reference}</code>.</p>
        <button type="button" className="studio-btn studio-btn-ghost" disabled={pending || !!error} onClick={() => { setPrepared(null); setError(null); }}>Volver a la selección</button>
        {error && <button type="button" className="studio-btn studio-btn-ghost" disabled={pending} onClick={() => void load()}>Consultar estado actual antes de cambiar el intento</button>}
      </section> : !loading && context && <>
        {canEdit && <fieldset disabled={pending} style={{ border: 0, padding: 0, display: "grid", gap: "var(--s-3)" }}>
          <legend>Preparar recepciones nuevas</legend>
          <label htmlFor={`${formId}-target`}>Destino de la incorporación</label>
          <select id={`${formId}-target`} className="studio-input" value={target} onChange={(event) => { setTarget(event.target.value); setSelected(new Set()); setOptions({}); setError(null); }}>
            <option value="new">Crear envíos de clientes que aún no tienen uno aquí</option>
            {manifest?.groups.filter((entry) => entry.status === "consolidating").map((entry) => <option key={entry.groupId} value={entry.groupId}>Agregar al mismo envío {entry.code} · {entry.clientMarkbox}</option>)}
          </select>
          {group && <p>Se conserva {group.code}, su cliente, servicio, destino, miembros y snapshots anteriores. Se agregan únicamente recepciones nuevas compatibles.</p>}
          <p>Lectura completa: {context.receipts.length} recepción(es) enroladas. Seleccionadas: {chosen.length}.</p>
          <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
            <button type="button" className="studio-btn studio-btn-ghost" onClick={() => setSelected(new Set(context.receipts.filter((receipt) => !blocked(receipt)).map((receipt) => receipt.receiptId)))}>Seleccionar todas las compatibles</button>
            <button type="button" className="studio-btn studio-btn-ghost" onClick={() => setSelected(new Set())}>Quitar selección</button>
          </div>
          {context.receipts.filter((receipt) => !receipt.groupId).map((receipt) => { const denial = blocked(receipt); return <div key={receipt.receiptId} style={PANEL}>
            <label><input type="checkbox" checked={selected.has(receipt.receiptId)} disabled={!!denial} aria-describedby={`${formId}-${receipt.receiptId}`}
              onChange={(event) => setSelected((previous) => { const next = new Set(previous); if (event.target.checked) next.add(receipt.receiptId); else next.delete(receipt.receiptId); return next; })} /> {receipt.receiptCode} · {receipt.clientMarkbox ?? "Cliente pendiente"}</label>
            <div id={`${formId}-${receipt.receiptId}`}>{receipt.measures ? <Measures value={receipt.measures} /> : "Medidas pendientes"} · {receipt.rate ? formatObservedCents(receipt.rate.amountCents) : "Sin tarifa congelada"}
              {receipt.service && <p>Servicio registrado: {receipt.service === "consolidado_lcl" ? "Consolidado LCL" : "Puerta a puerta DDP"}.</p>}
              {receipt.destination && <p>Destino registrado: {receipt.destination}.</p>}{denial && <p>{denial}</p>}</div>
          </div>; })}
          {byClient.map(([clientId, receipts]) => {
            const choice = chooseOptions(clientId, receipts); const before = group?.measures ?? ZERO;
            const delta = sumFixedMeasures(receipts.flatMap((receipt) => receipt.measures ? [receipt.measures] : []));
            const update = (patch: Partial<Options>) => setOptions((previous) => ({ ...previous, [clientId]: { ...choice, ...patch } }));
            return <section key={clientId} style={PANEL} aria-label={`Resumen ${receipts[0].clientMarkbox}`}>
              <h3>{receipts[0].clientMarkbox}{receipts[0].clientName ? ` · ${receipts[0].clientName}` : ""}</h3>
              <p>Antes: <Measures value={before} /></p><p>Añadido: <Measures value={delta} /></p><p>Después: <Measures value={sumFixedMeasures([before, delta])} /></p>
              <Price parts={[...(group ? [group.rates] : []), deltaRates(receipts, context.observedAt)]} />
              {!group && <div style={{ display: "grid", gap: "var(--s-2)" }}>
                <label htmlFor={`${formId}-${clientId}-code`}>Código manual del envío</label>
                <input id={`${formId}-${clientId}-code`} className="studio-input" value={choice.code} placeholder="S-2026-0001" onChange={(event) => update({ code: event.target.value })} onBlur={() => update({ code: normalizeManualShipmentCode(choice.code) })} />
                <small>Formato S-, cuatro dígitos de año y de cuatro a diez dígitos de correlativo. El código debe estar disponible.</small>
                <label htmlFor={`${formId}-${clientId}-service`}>Servicio del grupo</label>
                <select id={`${formId}-${clientId}-service`} className="studio-input" value={choice.service} onChange={(event) => update({ service: event.target.value as Options["service"] })}>
                  <option value="">Selecciona el servicio</option><option value="consolidado_lcl">Consolidado LCL</option><option value="puerta_a_puerta_DDP">Puerta a puerta DDP</option>
                </select>
                <label htmlFor={`${formId}-${clientId}-destination`}>Destino del grupo</label>
                <select id={`${formId}-${clientId}-destination`} className="studio-input" value={choice.destinationId} onChange={(event) => update({ destinationId: event.target.value })}>
                  <option value="">Selecciona un destino activo</option>{context.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.label}</option>)}
                </select>
                <small>La elección no reemplaza un servicio o destino incompatible ya registrado.</small>
              </div>}
            </section>;
          })}
        </fieldset>}
        {!manifest?.sealed && (canEdit || manifest?.canClose) && <label htmlFor={`${formId}-reason`}>Motivo de la incorporación o del cierre
          <textarea id={`${formId}-reason`} className="studio-input" value={reason} minLength={4} maxLength={1000} disabled={pending} onChange={(event) => setReason(event.target.value)} />
        </label>}
        {!manifest?.sealed && manifest?.groups.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
          <button type="button" className="studio-btn studio-btn-ghost" disabled={pending || !manifest.canClose} onClick={() => void calculatePlan()}>{planReference.current ? "Reintentar el mismo cálculo" : "Calcular plan con esta carga completa"}</button>
          <button type="button" className="studio-btn studio-btn-dark" disabled={pending || !canClose} onClick={prepareClose}>Revisar cierre del manifiesto</button>
          {!canClose && <p>El cierre requiere la revisión completa, todas las cajas esperadas estibadas, ningún ajeno y permiso vigente de Naviera.</p>}
        </div> : null}
        {!canEdit && context.availability === "ready" && !manifest?.sealed && <p>No se puede incorporar con los permisos, estado o historia actuales de este contenedor. La operación vigente permanece disponible según su ámbito.</p>}
      </>}
    </form>
    <DrawerFooter formId={formId} onClose={onClose} isPending={pending || loading} canSubmit={!!prepared || canEdit && chosen.length > 0}
      submitLabel={prepared ? prepared.kind === "close" ? "Confirmar cierre del manifiesto" : "Confirmar incorporación" : "Revisar incorporación"}
      pendingLabel={loading ? "Leyendo…" : "Confirmando…"} />
  </DrawerShell>;
}
