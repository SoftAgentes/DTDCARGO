"use client";

/**
 * Panel de fusión (SDD-0712): se abre a la DERECHA, sin salir de la pestaña.
 *
 * Muestra la ficha que se queda, la que se anula y una vista previa de cómo
 * quedaría (conteos, sin montos), con los avisos de riesgo. Para fusionar hay
 * que dejar el motivo (queda en auditoría) y escribir el Shipping Mark que se
 * anula: es lo que obliga a leer cuál código se pierde.
 *
 * Sirve igual para los pares detectados y para los elegidos a mano.
 */

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { DrawerFooter, DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  avisosDeFusion,
  confirmacionCoincide,
  errorDeMotivo,
  MOTIVO_MAX,
  type MergePreview,
  type MergeSide,
} from "@/lib/studio/client-merge-manual";
import {
  mergeClientsManualAction,
  previewMergeAction,
  type MergeResult,
} from "../merge-actions";

export type ParFusion = {
  survivor: { id: string; markbox: string; name: string };
  merged: { id: string; markbox: string; name: string };
};

export function FusionPanel({
  par,
  onClose,
  onInvertir,
  onFusionado,
}: {
  par: ParFusion;
  onClose: () => void;
  /** Intercambia cuál se queda y cuál se anula (el padre cambia `par`). */
  onInvertir: () => void;
  onFusionado: (res: MergeResult, par: ParFusion) => void;
}) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [cargando, setCargando] = useState(true);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [errorVista, setErrorVista] = useState<string | undefined>();
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | undefined>();

  // La vista previa se pide otra vez cada vez que cambia el par (⇄ incluido).
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setPreview(null);
    setErrorVista(undefined);
    setConfirmar("");
    setError(undefined);
    previewMergeAction(par.survivor.id, par.merged.id).then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.preview) setPreview(r.preview);
      else setErrorVista(r.error ?? "No se pudo armar la vista previa.");
    });
    return () => {
      vigente = false;
    };
  }, [par.survivor.id, par.merged.id]);

  const errorMotivo = errorDeMotivo(motivo);
  const confirmaOk = confirmacionCoincide(confirmar, par.merged.markbox);
  const puedeFusionar = !!preview?.ok && !errorMotivo && confirmaOk;

  function fusionar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeFusionar) return;
    setError(undefined);
    startTransition(async () => {
      const res = await mergeClientsManualAction({
        survivorId: par.survivor.id,
        mergedId: par.merged.id,
        reason: motivo,
        confirmMarkbox: confirmar,
        retiredMarkbox: par.merged.markbox,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onFusionado(res, par);
    });
  }

  const avisos = preview ? avisosDeFusion(preview.warnings) : [];

  return (
    <DrawerShell
      title="Vista previa de la fusión"
      subtitle="Revisa las dos fichas antes de unirlas. No se deshace."
      onClose={onClose}
      pending={pending}
      width={640}
      closeOnBackdrop={false}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "stretch" }}>
          <Lado rotulo="Se queda" ficha={par.survivor} lado={preview?.survivor} destacado />
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onInvertir}
            disabled={pending}
            aria-label="Intercambiar: que se quede la otra ficha"
            title="Intercambiar cuál se queda"
            style={{ alignSelf: "center" }}
          >
            ⇄
          </button>
          <Lado rotulo="Se anula" ficha={par.merged} lado={preview?.merged} destacado={false} />
        </div>

        {cargando && (
          <p style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Armando la vista previa…
          </p>
        )}
        {errorVista && <Aviso tono="error">{errorVista}</Aviso>}

        {preview && !preview.ok && (
          <Aviso tono="error" titulo="No se puede fusionar">
            {preview.blockers.join(" ")}
          </Aviso>
        )}

        {preview && (
          <section aria-label="Así quedaría" style={{ display: "grid", gap: 6 }}>
            <span className="studio-eyebrow">Así quedaría</span>
            <ul style={{ margin: 0, paddingLeft: 18, font: "400 13px/1.55 var(--f-sans)", color: "var(--ink)" }}>
              <li>
                Shipping Mark: <strong style={{ fontFamily: "var(--f-mono)" }}>{preview.survivor.markbox}</strong>.{" "}
                <span style={{ fontFamily: "var(--f-mono)" }}>{preview.merged.markbox}</span> queda anulado, pero
                sigue resolviendo y aparece en «Códigos anteriores».
              </li>
              <li>
                Embarques: {preview.survivor.counts.shipments + preview.merged.counts.shipments} · Facturas:{" "}
                {preview.survivor.counts.invoices + preview.merged.counts.invoices}. Los de la ficha anulada se
                ven en la que se queda, y su saldo se suma en una sola cuenta.
              </li>
              <li>
                Direcciones y conversaciones pasan a la ficha que se queda
                {" "}({preview.merged.counts.addresses} direcciones, {preview.merged.counts.conversations}{" "}
                conversaciones). Los datos de contacto que falten se completan; los que ya tiene no se pisan.
              </li>
            </ul>
          </section>
        )}

        {avisos.map((a) => (
          <Aviso key={a.texto} tono={a.tono}>
            {a.texto}
          </Aviso>
        ))}

        <form id={formId} onSubmit={fusionar} style={{ display: "grid", gap: 12 }}>
          <div>
            <label htmlFor={`${formId}-motivo`} className="studio-label" style={{ display: "block", marginBottom: 6 }}>
              Motivo (queda en auditoría)
            </label>
            <textarea
              id={`${formId}-motivo`}
              className="studio-input"
              rows={2}
              maxLength={MOTIVO_MAX}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Son esposos y quieren un solo código"
              disabled={pending}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-confirmar`} className="studio-label" style={{ display: "block", marginBottom: 6 }}>
              Escribe el Shipping Mark que se anula para confirmar
            </label>
            <input
              id={`${formId}-confirmar`}
              className="studio-input"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder={par.merged.markbox}
              autoComplete="off"
              disabled={pending}
              style={{ width: "100%", fontFamily: "var(--f-mono)" }}
            />
          </div>
          {error && <Aviso tono="error">{error}</Aviso>}
        </form>

        <p style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Para comparar a fondo, abre las fichas en otra pestaña:{" "}
          <Link href={`/studio/clientes/${par.survivor.markbox}`} target="_blank" rel="noopener">
            {par.survivor.markbox}
          </Link>{" "}
          ·{" "}
          <Link href={`/studio/clientes/${par.merged.markbox}`} target="_blank" rel="noopener">
            {par.merged.markbox}
          </Link>
          .
        </p>
      </div>
      <DrawerFooter
        formId={formId}
        onClose={onClose}
        isPending={pending}
        canSubmit={puedeFusionar}
        submitLabel="Fusionar"
        pendingLabel="Fusionando…"
      />
    </DrawerShell>
  );
}

function Lado({
  rotulo,
  ficha,
  lado,
  destacado,
}: {
  rotulo: string;
  ficha: { markbox: string; name: string };
  lado: MergeSide | undefined;
  destacado: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${destacado ? "var(--border-strong)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "var(--s-3)",
        background: destacado ? "var(--bg-elevated)" : "transparent",
      }}
    >
      <span
        style={{
          font: "700 10px/1.2 var(--f-sans)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        {rotulo}
      </span>
      <div
        style={{
          font: "700 15px/1.3 var(--f-mono)",
          color: "var(--ink)",
          margin: "var(--s-1) 0",
          textDecoration: destacado ? "none" : "line-through",
        }}
      >
        {ficha.markbox}
      </div>
      <div style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>{ficha.name}</div>
      {lado && (
        <div style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", marginTop: 6 }}>
          {lado.counts.shipments} embarques · {lado.counts.invoices} facturas
          <br />
          {lado.hasPortal ? "Con acceso al portal" : "Sin acceso al portal"}
          <br />
          {[
            lado.hasDocument ? "documento" : null,
            lado.hasEmail ? "correo" : null,
            lado.hasPhone ? "teléfono" : null,
          ]
            .filter(Boolean)
            .join(", ") || "Sin datos de contacto"}
        </div>
      )}
    </div>
  );
}
