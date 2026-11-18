"use client";

/**
 * «Pasar a otro cliente» (SDD-0645) en el detalle del embarque.
 *
 * Panel «Cliente» con el Shipping Mark actual y un botón secundario. El modal:
 *   1. busca el cliente nuevo con `ClientCombobox` (cédula, nombre o Shipping Mark);
 *   2. al elegirlo, pide la vista previa a la RPC de la 0551 (qué se mueve o qué
 *      lo bloquea), sin escribir;
 *   3. pide el motivo (4 a 1000) y confirma con el Shipping Mark nuevo en el botón.
 * Sólo lo monta quien tiene la acción `reassign_shipment_owner`; la base repite
 * el candado. Sin la migración, dice que la acción todavía no está disponible.
 *
 * SDD-0662 · con `sinCliente` (embarque en el Shipping Mark comodín) el panel lo
 * dice y el botón pasa a ser la acción principal, «Asignar cliente». El modal es
 * el mismo.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClientCombobox } from "@/app/studio/_components/ui/ClientCombobox";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { ClientSearchHit } from "@/lib/studio/client-search-action";
import {
  textosAvisos,
  textosBloqueos,
  textosMovidos,
  textosPortal,
  type ReasignarResultado,
} from "@/lib/studio/reasignar-embarque";
import { previewReassignShipmentClient, reassignShipmentClient } from "../actions";

const MAX_MOTIVO = 1000;

export function ReassignClientPanel({
  shipmentId,
  shipmentCode,
  currentMarkbox,
  sinCliente = false,
}: {
  shipmentId: string;
  shipmentCode: string;
  currentMarkbox: string | null;
  /** El embarque todavía no tiene dueño: se pide asignarlo. */
  sinCliente?: boolean;
}) {
  const verbo = sinCliente ? "Asignar cliente" : "Pasar a otro cliente";
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cliente, setCliente] = useState<ClientSearchHit | null>(null);
  const [previa, setPrevia] = useState<ReasignarResultado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noDisponible, setNoDisponible] = useState(false);
  const [cargando, startPreview] = useTransition();

  const panelRef = useRef<HTMLDivElement>(null);
  const cerrar = () => {
    setOpen(false);
    setQuery("");
    setCliente(null);
    setPrevia(null);
    setMotivo("");
    setError(null);
    setNoDisponible(false);
  };
  useDialogA11y(panelRef, { onClose: cerrar, pending: cargando, enabled: open });

  const elegir = (hit: ClientSearchHit) => {
    setCliente(hit);
    setQuery(`${hit.markbox} · ${hit.name}`);
    setPrevia(null);
    setError(null);
    startPreview(async () => {
      const res = await previewReassignShipmentClient(shipmentId, hit.id);
      if (res.ok) {
        setPrevia(res.resultado);
      } else {
        setError(res.error);
        setNoDisponible(res.noDisponible === true);
      }
    });
  };

  const bloqueos = previa ? textosBloqueos(previa.blockers) : [];
  const movidos = previa ? textosMovidos(previa.moved) : [];
  const avisos = previa ? textosAvisos(previa.warnings) : [];
  const portal = previa ? textosPortal(previa.portal) : [];
  const motivoOk = motivo.trim().length >= 4 && motivo.trim().length <= MAX_MOTIVO;
  const listo = !!cliente && !!previa && previa.outcome === "preview" && motivoOk && !cargando;

  return (
    <>
      <div className="studio-ficha-embarque-cliente">
        <div>
          <div className="studio-eyebrow">Cliente</div>
          <strong className="studio-ficha-embarque-cliente-marca">
            {currentMarkbox ?? "Sin Shipping Mark"}
          </strong>
        </div>
        {sinCliente && (
          <Aviso tono="atencion" compacto>
            Este embarque no tiene cliente asignado.
          </Aviso>
        )}
        <button
          type="button"
          className={`studio-btn ${sinCliente ? "studio-btn-primary" : "studio-btn-ghost"} studio-btn-sm`}
          onClick={() => setOpen(true)}
        >
          {verbo}
        </button>
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--scrim)",
            backdropFilter: "var(--scrim-blur)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !cargando) cerrar();
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reasignar-titulo"
            style={{
              background: "var(--bg-surface)",
              borderRadius: 10,
              border: "1px solid var(--border)",
              padding: 24,
              width: "100%",
              maxWidth: 520,
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
              boxShadow: "var(--shadow-lg)",
              display: "grid",
              gap: "var(--s-4)",
            }}
          >
            <div>
              <h2 id="reasignar-titulo" className="studio-display" style={{ fontSize: 18, margin: 0 }}>
                {verbo}
              </h2>
              <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
                El embarque <strong style={{ fontFamily: "var(--f-mono)" }}>{shipmentCode}</strong> conserva su
                código. Se mueven con él sus recepciones del Almacén CN, su factura en borrador, su
                consolidación, sus documentos y sus avisos pendientes.
              </p>
            </div>

            <div>
              <label className="studio-label" htmlFor="reasignar-cliente">
                Cliente nuevo
              </label>
              <ClientCombobox
                id="reasignar-cliente"
                value={query}
                onManualChange={(text) => {
                  setQuery(text);
                  setCliente(null);
                  setPrevia(null);
                  setError(null);
                }}
                onSelect={elegir}
                disabled={noDisponible}
              />
            </div>

            {cargando && (
              <p role="status" style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
                Revisando qué se mueve…
              </p>
            )}

            {error && (
              <Aviso tono={noDisponible ? "info" : "error"} compacto>
                {error}
              </Aviso>
            )}

            {previa && bloqueos.length > 0 && (
              <Aviso tono="atencion" titulo="No se puede pasar todavía">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {bloqueos.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </Aviso>
            )}

            {previa && previa.outcome === "preview" && (
              <Aviso tono="info" titulo={`Se pasa de ${previa.oldMarkbox ?? "sin Shipping Mark"} a ${previa.newMarkbox}`}>
                {movidos.length > 0 ? (
                  <>
                    También se mueven: {movidos.join(", ")}.
                  </>
                ) : (
                  <>Solo se mueve el embarque.</>
                )}{" "}
                {previa.oldMarkbox ?? "El cliente actual"} dejará de verlo en el Portal y {previa.newMarkbox} lo verá.
              </Aviso>
            )}

            {previa && previa.outcome === "preview" && portal.length > 0 && (
              <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
                {previa.newMarkbox} va a ver en el Portal: {portal.join(", ")}. Revisa que nada sea solo del cliente
                actual.
              </p>
            )}

            {previa && previa.outcome === "preview" && avisos.length > 0 && (
              <Aviso tono="atencion" titulo="Antes de facturar" compacto>
                {avisos.join(" ")}
              </Aviso>
            )}

            {previa && previa.outcome === "preview" && (
              <div>
                <label className="studio-label" htmlFor="reasignar-motivo">
                  Motivo
                </label>
                <textarea
                  id="reasignar-motivo"
                  className="studio-input"
                  rows={3}
                  maxLength={MAX_MOTIVO}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej.: el dueño real confirmó por WhatsApp que estas cajas son suyas."
                  aria-describedby="reasignar-motivo-ayuda"
                  style={{ width: "100%", resize: "vertical" }}
                />
                <p
                  id="reasignar-motivo-ayuda"
                  style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "4px 0 0" }}
                >
                  De 4 a {MAX_MOTIVO} caracteres · {motivo.trim().length}/{MAX_MOTIVO}. Queda en la bitácora: no
                  escribas datos personales (nombres, cédula, teléfono ni dirección).
                </p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--s-3)", flexWrap: "wrap" }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={cerrar}
              >
                Cancelar
              </button>
              <ActionButton
                variant="primary"
                size="sm"
                idleLabel={previa ? `Pasar a ${previa.newMarkbox}` : "Pasar"}
                loadingLabel="Pasando…"
                successLabel={null}
                disabled={!listo}
                onAction={async () => {
                  if (!cliente) return { error: "Elige un cliente de la lista." };
                  const res = await reassignShipmentClient(shipmentId, cliente.id, motivo);
                  if (!res.ok) return { error: res.error };
                  if (res.resultado.outcome !== "reassigned") {
                    setPrevia(res.resultado);
                    return { error: "Algo cambió y ahora no se puede. Revisa los motivos." };
                  }
                  toast.success(`Embarque ${shipmentCode} pasado a ${res.resultado.newMarkbox}`);
                  cerrar();
                  router.refresh();
                }}
                onError={setError}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
