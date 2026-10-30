"use client";

/**
 * Vista de la Ficha DTD (SDD-0585, paso 2.4, E2-D32 y E2-D33). Sin estado: la
 * maneja `FichaDtdClient`.
 *
 * Quién ve qué: la cuenta llega ya recortada por `getClientAccountState` (la
 * misma de la cabecera de la ficha, SDD-0558). Con `sin-permiso` no se pinta
 * dinero, ni la etiqueta del saldo. El nombre del cliente no va: el agente ya
 * lo ve en Chatwoot.
 *
 * Huecos preparados, sin implementar: `segmento` (lo llena E10) y `costoChat`
 * (el 2.8 opcional, que pasa su propio componente).
 */

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { formatInvoiceAmount } from "@/lib/portal/portal-types";
import { fechaCorta, type ClientAccountSummary } from "@/lib/studio/client-account";
import type { FichaDtd, FichaDtdError } from "@/app/studio/(app)/bandeja/actions";

export type EstadoFichaDtd =
  | { tipo: "esperando" }
  | { tipo: "cargando" }
  | { tipo: "sin_sesion"; loginUrl: string }
  | { tipo: "error"; error: FichaDtdError }
  | { tipo: "sin_ficha" }
  | { tipo: "ficha"; ficha: FichaDtd };

const PANEL = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-4)",
  padding: "var(--s-4)",
  minHeight: "100vh",
  background: "var(--bg-base)",
  color: "var(--ink)",
} as const;

const EYEBROW = {
  font: "700 10.5px/1 var(--f-sans)",
  color: "var(--wine-text)",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  margin: 0,
} as const;

const TITULO = { font: "800 16px/1.25 var(--f-display)", color: "var(--ink)", margin: 0 } as const;
const CUERPO = { font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 } as const;
/**
 * 260 px es el mínimo MEDIDO de SDD-0558 (`ClientAccountHeader`, GRILLA): la
 * cifra más larga de un saldo en Sora 900 30px cabe con los 40 px de relleno de
 * KpiCard, que corta con `overflow: hidden`. `min(…, 100%)`: en un panel más
 * angosto la tarjeta ocupa el ancho, sin scroll horizontal.
 */
const GRILLA = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: "var(--s-3)" } as const;

function Mensaje({ titulo, cuerpo, accion, rol }: { titulo: string; cuerpo?: string; accion?: ReactNode; rol?: "alert" | "status" }) {
  return (
    <section role={rol} style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      <h1 style={TITULO}>{titulo}</h1>
      {cuerpo ? <p style={CUERPO}>{cuerpo}</p> : null}
      {accion ? <div>{accion}</div> : null}
    </section>
  );
}

function Lineas({ lineas }: { lineas: string[] }) {
  return (
    <>
      {lineas.map((l) => (
        <span key={l} style={{ display: "block" }}>
          {l}
        </span>
      ))}
    </>
  );
}

function Dinero({ cuenta }: { cuenta: ClientAccountSummary }) {
  const t = useT();
  const abiertos = cuenta.saldos.filter((s) => s.abierto > 0);
  const vencidos = cuenta.saldos.filter((s) => s.vencido > 0);
  const alDia = t("bandeja.ficha.up_to_date");
  return (
    <>
      <KpiCard
        label={t("bandeja.ficha.balance")}
        value={abiertos.length ? formatInvoiceAmount(abiertos[0].abierto, abiertos[0].currency) : alDia}
        highlightWhenPositive={abiertos.length > 0}
        sub={
          <Lineas
            lineas={[
              ...abiertos.slice(1).map((s) => formatInvoiceAmount(s.abierto, s.currency)),
              t("bandeja.ficha.as_of", { fecha: fechaCorta(cuenta.asOf) }),
            ]}
          />
        }
      />
      <KpiCard
        label={t("bandeja.ficha.overdue")}
        value={vencidos.length ? formatInvoiceAmount(vencidos[0].vencido, vencidos[0].currency) : alDia}
        valueColor={vencidos.length ? "var(--danger-text)" : undefined}
        highlightWhenPositive={false}
        sub={vencidos.length > 1 ? <Lineas lineas={vencidos.slice(1).map((s) => formatInvoiceAmount(s.vencido, s.currency))} /> : undefined}
      />
    </>
  );
}

function Ficha({ ficha, costoChat }: { ficha: FichaDtd; costoChat?: ReactNode }) {
  const t = useT();
  const { cuenta } = ficha;
  const codigos = cuenta.tipo === "ok" ? cuenta.cuenta.markboxes : cuenta.markboxes;
  const anteriores = codigos.filter((c) => c !== ficha.markbox);
  const embarques = cuenta.tipo === "ok" ? cuenta.cuenta.embarquesEnCurso : cuenta.embarquesEnCurso;

  return (
    <>
      <section aria-label={t("bandeja.ficha.mark")} style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
        <span style={{ font: "700 11px/1.2 var(--f-sans)", color: "var(--ink-soft)" }}>{t("bandeja.ficha.mark")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
          <h1 style={{ font: "900 22px/1.15 var(--f-display)", color: "var(--wine-text)", letterSpacing: "-0.01em", margin: 0 }}>
            {ficha.markbox}
          </h1>
          {ficha.segmento ? <Badge tone="wine">{t(`bandeja.ficha.segment.${ficha.segmento}`)}</Badge> : null}
        </div>
        {anteriores.length ? <p style={CUERPO}>{t("bandeja.ficha.previous", { codigos: anteriores.join(" · ") })}</p> : null}
      </section>

      <div style={GRILLA}>
        <KpiCard
          label={t("bandeja.ficha.shipments")}
          value={embarques === null ? "—" : embarques}
          sub={embarques === null ? t("bandeja.ficha.shipments.unknown") : undefined}
        />
        {cuenta.tipo === "ok" ? <Dinero cuenta={cuenta.cuenta} /> : null}
      </div>

      {cuenta.tipo === "error" ? (
        <p role="status" style={CUERPO}>
          {t("bandeja.ficha.balance_error", { ref: cuenta.referencia })}
        </p>
      ) : null}
      {cuenta.tipo === "eliminado" ? (
        <p role="status" style={CUERPO}>
          {t("bandeja.ficha.deleted", { fecha: fechaCorta(cuenta.eliminadoEl) })}
        </p>
      ) : null}

      {costoChat ? <section data-hueco="costo-chat">{costoChat}</section> : null}

      <div>
        <a href={ficha.enlace} target="_blank" rel="noopener noreferrer" className="studio-btn studio-btn-primary studio-btn-sm">
          {t("bandeja.ficha.open")}
        </a>
      </div>
    </>
  );
}

export function FichaDtdView({
  estado,
  onRetry,
  costoChat,
}: {
  estado: EstadoFichaDtd;
  onRetry?: () => void;
  /** Hueco del 2.8 (costo de referencia por chat). Sin implementar: hoy nadie lo pasa. */
  costoChat?: ReactNode;
}) {
  const t = useT();
  let cuerpo: ReactNode;
  switch (estado.tipo) {
    case "esperando":
      cuerpo = <Mensaje titulo={t("bandeja.ficha.waiting.title")} cuerpo={t("bandeja.ficha.waiting.body")} />;
      break;
    case "cargando":
      cuerpo = (
        <p role="status" style={CUERPO}>
          {t("bandeja.ficha.loading")}
        </p>
      );
      break;
    case "sin_sesion":
      cuerpo = (
        <Mensaje
          titulo={t("bandeja.ficha.signed_out.title")}
          cuerpo={t("bandeja.ficha.signed_out.body")}
          accion={
            <a href={estado.loginUrl} target="_blank" rel="noopener noreferrer" className="studio-btn studio-btn-primary studio-btn-sm">
              {t("bandeja.ficha.signed_out.action")}
            </a>
          }
        />
      );
      break;
    case "error":
      cuerpo = (
        <Mensaje
          rol="alert"
          titulo={t(`bandeja.ficha.error.${estado.error}`)}
          accion={
            onRetry ? (
              <button type="button" onClick={onRetry} className="studio-btn studio-btn-ghost studio-btn-sm">
                {t("bandeja.ficha.retry")}
              </button>
            ) : null
          }
        />
      );
      break;
    case "sin_ficha":
      cuerpo = <Mensaje titulo={t("bandeja.ficha.none.title")} cuerpo={t("bandeja.ficha.none.body")} />;
      break;
    case "ficha":
      cuerpo = <Ficha ficha={estado.ficha} costoChat={costoChat} />;
      break;
  }
  return (
    <main style={PANEL}>
      <p style={EYEBROW}>{t("bandeja.ficha.eyebrow")}</p>
      {cuerpo}
    </main>
  );
}
