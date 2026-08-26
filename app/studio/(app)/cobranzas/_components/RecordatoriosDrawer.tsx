"use client";

/**
 * Drawer «Recordatorio masivo» (SDD-0306).
 *
 * 🔴 **Nunca manda sin que una persona haya visto la lista.** Al abrirse pide
 * la vista previa —que NO envía nada— y muestra dos bloques: a quién se le
 * escribiría y a quién no, **con el motivo de cada omisión**.
 *
 * Ese segundo bloque es el que hace la herramienta confiable. Un filtro
 * silencioso deja al operador viendo 2 destinatarios donde esperaba 5, sin
 * saber si el sistema descartó bien o se los comió.
 *
 * El envío manda la lista explícita de códigos, y el servidor **vuelve a
 * calcular la selección y la intersecta**: lo que viaja desde acá sólo puede
 * acotar, nunca ampliar.
 */

import { useEffect, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { fmtAmount } from "@/lib/money";
import {
  enviarRecordatorios,
  previewRecordatorios,
  type PreviewRecordatorios,
} from "../actions";

export function RecordatoriosDrawer({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [cargando, setCargando] = useState(true);
  const [preview, setPreview] = useState<PreviewRecordatorios | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    previewRecordatorios()
      .then((p) => {
        if (vivo) setPreview(p);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const aEnviar = preview?.aEnviar ?? [];
  const omitidos = preview?.omitidos ?? [];

  return (
    <DrawerShell
      title="Recordatorio de cobranza"
      subtitle="Se revisa la lista antes de enviar"
      onClose={onClose}
      pending={false}
      width={640}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {cargando && (
          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Calculando a quién corresponde escribirle…
          </p>
        )}

        {(preview?.error || errorEnvio) && (
          <p
            role="alert"
            style={{
              font: "500 13px/1.5 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
            }}
          >
            {errorEnvio ?? preview?.error}
          </p>
        )}

        {!cargando && !preview?.error && (
          <>
            <p style={{ font: "600 13.5px/1.5 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
              {preview?.resumen}
            </p>

            {aEnviar.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  className="studio-eyebrow"
                  style={{ font: "700 10.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}
                >
                  Reciben el recordatorio
                </span>
                {aEnviar.map((r) => (
                  <div
                    key={r.code}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 12px",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--r-md)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                        {r.clientName}
                      </div>
                      <code style={{ font: "600 11.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                        {r.code} · {r.markbox}
                      </code>
                    </div>
                    <Badge tone="danger" size="sm">
                      {r.daysOverdue} d
                    </Badge>
                    <span style={{ font: "700 13px/1 var(--f-mono)", color: "var(--ink)" }}>
                      {fmtAmount(r.balance)} {r.currency}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {omitidos.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className="studio-eyebrow"
                  style={{ font: "700 10.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}
                >
                  Quedan fuera, y por qué
                </span>
                {omitidos.map((o) => (
                  <div
                    key={o.code}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "7px 12px",
                      font: "500 12px/1.4 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    <code style={{ font: "600 11.5px/1 var(--f-mono)" }}>{o.code}</code>
                    <span>{o.motivo}</span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onClose}>
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel={
            aEnviar.length === 1 ? "Enviar 1 recordatorio" : `Enviar ${aEnviar.length} recordatorios`
          }
          loadingLabel="Enviando…"
          successLabel="Recordatorios enviados"
          idleIcon={Icon.check(13)}
          disabled={cargando || aEnviar.length === 0}
          onError={setErrorEnvio}
          onAction={async () => {
            // Convención de ActionButton: LANZA en error, no devuelve objeto.
            const r = await enviarRecordatorios(aEnviar.map((x) => x.code));
            if (r.error) throw new Error(r.error);
            onDone(
              r.enviados === 1
                ? "Se envió 1 recordatorio"
                : `Se enviaron ${r.enviados ?? 0} recordatorios`,
            );
            onClose();
          }}
        />
      </div>
    </DrawerShell>
  );
}
