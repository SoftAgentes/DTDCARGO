"use client";

/**
 * «Registros por link» (SDD-0646). Cada tarjeta es un link ya usado: qué tenía la
 * ficha y qué escribió el cliente, con lo que cambió resaltado. «Marcar
 * comprobado» lo saca de pendientes. Un posible duplicado se resuelve en
 * «Posibles duplicados»: esta pantalla no fusiona nada.
 */

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  campoTexto,
  REGISTRO_LINK_CAMPOS,
  type RegistroLinkReviewRow,
} from "@/lib/portal/registro-link-types";
import { markRegistrationReviewedAction, resendEmailCheckAction } from "../actions";

const POR = { documento: "la cédula/RIF", correo: "el correo", telefono: "el teléfono" } as const;

function fecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RegistrosLinkClient({
  rows,
  todos,
  canEdit,
  sinAcceso = false,
}: {
  rows: RegistroLinkReviewRow[] | null;
  todos: boolean;
  /** Sólo quien edita clientes ve «Marcar comprobado» y «Reenviar comprobación». */
  canEdit: boolean;
  /** Sin permiso de ver nombres de clientes (SDD-0531): no se muestra nada. */
  sinAcceso?: boolean;
}) {
  return (
    <div style={{ padding: "var(--s-6) var(--s-8)", maxWidth: 1100 }}>
      <Link
        href="/studio/clientes"
        style={{ font: "600 12.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}
      >
        ← Clientes
      </Link>
      <h1 className="studio-display" style={{ margin: "var(--s-3) 0 var(--s-2)", fontSize: 26 }}>
        Registros por link
      </h1>
      <p style={{ font: "500 13.5px/1.55 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "70ch" }}>
        Lo que escribió cada cliente al completar su ficha con el link de registro, al lado de
        lo que tenía antes. Revisa y marca comprobado. Si sale un posible duplicado, resuélvelo
        en{" "}
        <Link href="/studio/clientes/duplicados" style={{ color: "var(--accion-text)", fontWeight: 600 }}>
          Posibles duplicados
        </Link>
        .
      </p>

      <div style={{ display: "flex", gap: 8, margin: "var(--s-5) 0" }} role="group" aria-label="Filtro">
        <Link
          href="/studio/clientes/registros-link"
          className={`studio-btn studio-btn-sm ${todos ? "studio-btn-ghost" : "studio-btn-dark"}`}
          aria-current={todos ? undefined : "page"}
        >
          Pendientes
        </Link>
        <Link
          href="/studio/clientes/registros-link?ver=todos"
          className={`studio-btn studio-btn-sm ${todos ? "studio-btn-dark" : "studio-btn-ghost"}`}
          aria-current={todos ? "page" : undefined}
        >
          Todos
        </Link>
      </div>

      {sinAcceso ? (
        <Aviso tono="info" titulo="Sin acceso a esta lista">
          Esta lista muestra datos personales de los clientes y tu usuario no los puede ver.
          Si necesitas revisarla, pídeselo a un administrador.
        </Aviso>
      ) : rows === null ? (
        <Aviso tono="atencion" titulo="Todavía no está disponible">
          Falta aplicar la migración del registro por link. Cuando esté, aquí aparecen los
          registros.
        </Aviso>
      ) : rows.length === 0 ? (
        <EmptyState
          eyebrow="Registros por link"
          title={todos ? "Nadie se ha registrado por link todavía" : "Nada pendiente por revisar"}
          description="Genera el link desde la ficha del cliente, en «Acceso al portal»."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
          {rows.map((r) => (
            <RegistroCard key={r.id} row={r} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function RegistroCard({ row, canEdit }: { row: RegistroLinkReviewRow; canEdit: boolean }) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [comprobado, setComprobado] = useState(row.reviewedAt != null);
  const [enviadoAt, setEnviadoAt] = useState<string | null>(row.correoEnviadoAt);
  const correoPendiente =
    row.correoEstado === "sin_comprobar" ||
    row.correoEstado === "choque" ||
    row.correoEstado === "revisar";
  const esEmpresa = row.submitted.kind === "empresa";

  const campos = REGISTRO_LINK_CAMPOS.filter(([, sub]) => sub !== "company" || esEmpresa).map(
    ([prevKey, subKey, label]) => {
      // En empresa, el nombre de la ficha es la razón social y el contacto va aparte.
      const antes = campoTexto(
        esEmpresa && subKey === "name" ? row.prev.contact_name : row.prev[prevKey],
      );
      const ahora = campoTexto(row.submitted[subKey]);
      return { label, antes, ahora, cambio: (antes ?? "") !== (ahora ?? "") && ahora !== null };
    },
  );

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <Link
            href={`/studio/clientes/${encodeURIComponent(row.markbox)}`}
            style={{ font: "700 15px/1.2 var(--f-mono)", color: "var(--ink)" }}
          >
            {row.markbox}
          </Link>
          <span style={{ font: "500 13px/1.2 var(--f-sans)", color: "var(--ink-soft)", marginLeft: 10 }}>
            {row.clientName ?? "—"} · se registró el {fecha(row.usedAt)}
            {/* SDD-0672 · el link lo pidió el cliente desde «Entrar», no un asesor. */}
            {row.origen === "autoservicio" ? " · lo pidió desde «Entrar»" : ""}
          </span>
        </div>
        <span style={{ display: "inline-flex", gap: "var(--s-2)", alignItems: "center" }}>
          {row.correoEstado === "comprobado" && (
            <Badge tone="success" size="md">
              Correo comprobado
            </Badge>
          )}
          {correoPendiente && (
            <Badge tone="warning" size="md">
              Correo sin comprobar
            </Badge>
          )}
          {row.correoEstado === "nunca_comprobado" && (
            <Badge tone="warning" size="md">
              Correo nunca comprobado
            </Badge>
          )}
          <Badge tone={comprobado ? "success" : "warning"} size="md">
            {comprobado ? "Comprobado" : "Por revisar"}
          </Badge>
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)", marginTop: "var(--s-3)" }}>
        {row.duplicateClientId && (
          <Aviso tono="atencion" compacto titulo="Posible duplicado">
            Coincide por {POR[row.duplicateMatchedBy as keyof typeof POR] ?? "un dato"} con la
            ficha{" "}
            {row.duplicateMarkbox ? (
              <Link href={`/studio/clientes/${encodeURIComponent(row.duplicateMarkbox)}`}>
                {row.duplicateMarkbox}
              </Link>
            ) : (
              "otra ficha"
            )}
            . No se fusionó: resuélvelo en{" "}
            <Link href="/studio/clientes/duplicados">Posibles duplicados</Link>.
          </Aviso>
        )}
        {row.correoEstado === "sin_comprobar" && (
          <Aviso tono="info" compacto titulo="Correo sin comprobar">
            {enviadoAt
              ? `El cliente todavía no confirmó el enlace que le llegó a su correo (enviado el ${fecha(enviadoAt)}).`
              : "Todavía no se le ha enviado el enlace para comprobar su correo."}{" "}
            Hasta que lo confirme, ese correo no sirve para entrar ni para recuperar el acceso: si
            lo necesita, mándale un acceso por WhatsApp desde su ficha.
          </Aviso>
        )}
        {row.correoEstado === "choque" && (
          <Aviso tono="atencion" compacto titulo="Ese correo ya tiene otra cuenta">
            El cliente intentó comprobar su correo, pero esa dirección ya está en otra cuenta. No
            se fusionó nada. Revisa cuál es la correcta, corrige el correo en la ficha si hace
            falta y reenvía la comprobación.
          </Aviso>
        )}
        {row.correoEstado === "revisar" && (
          <Aviso tono="atencion" compacto titulo="La comprobación quedó a medias">
            El cliente intentó comprobar su correo y el paso no terminó. Su acceso al portal no
            cambió. Reenvía la comprobación para dejarlo en orden.
          </Aviso>
        )}
        {row.correoEstado === "nunca_comprobado" && (
          <Aviso tono="atencion" compacto titulo="Correo nunca comprobado">
            Este cliente se registró por link y nunca comprobó su correo. Después se le volvió a
            invitar por correo, así que hoy entra con el enlace que le llega a esa dirección.
            Confirma con el cliente, por WhatsApp, que el correo de su ficha es el suyo.
          </Aviso>
        )}
        {row.correoEstado === null && (
          <Aviso tono="info" compacto>
            Todavía no se puede saber si el correo está comprobado: falta aplicar una migración.
          </Aviso>
        )}
        {row.rifSkipped && (
          <Aviso tono="atencion" compacto>
            La cédula/RIF que escribió ya está en otra ficha, así que no se copió a esta.
          </Aviso>
        )}
        {row.accessError && (
          <Aviso tono="error" compacto titulo="Sin acceso al portal">
            La ficha quedó completa, pero no se pudo activar su acceso. Escríbele por WhatsApp y
            dale acceso desde su ficha.
          </Aviso>
        )}
      </div>

      <div style={{ overflowX: "auto", marginTop: "var(--s-4)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Dato", "Tenía la ficha", "Escribió el cliente"].map((h) => (
              <th
                key={h}
                scope="col"
                className="studio-eyebrow"
                style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campos.map((c) => (
            <tr key={c.label}>
              <th
                scope="row"
                style={{ textAlign: "left", padding: "6px 8px", font: "600 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}
              >
                {c.label}
              </th>
              <td style={{ padding: "6px 8px", font: "500 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                {c.antes ?? "—"}
              </td>
              <td
                style={{
                  padding: "6px 8px",
                  font: `${c.cambio ? 700 : 500} 13px/1.4 var(--f-sans)`,
                  color: "var(--ink)",
                }}
              >
                {c.ahora ?? "—"}
                {c.cambio && (
                  <span style={{ marginLeft: 8 }}>
                    <Badge tone="info" size="xs">
                      Cambió
                    </Badge>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {error && (
        <p role="alert" style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--danger)", margin: "10px 0 0" }}>
          {error}
        </p>
      )}
      {canEdit && (correoPendiente || !comprobado) && (
        <div
          style={{
            marginTop: "var(--s-4)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--s-2)",
            flexWrap: "wrap",
          }}
        >
          {correoPendiente && (
            <ActionButton
              variant="ghost"
              size="sm"
              idleLabel="Reenviar comprobación"
              loadingLabel="Enviando…"
              successLabel="Comprobación enviada"
              onAction={async () => {
                setError(null);
                return resendEmailCheckAction(row.id);
              }}
              onSuccess={() => {
                setEnviadoAt(new Date().toISOString());
                toast.success(`Comprobación enviada al correo de ${row.markbox}`);
              }}
              onError={setError}
            />
          )}
          {!comprobado && (
            <ActionButton
              variant="primary"
              size="sm"
              idleLabel="Marcar comprobado"
              loadingLabel="Marcando…"
              successLabel="Comprobado"
              onAction={async () => {
                setError(null);
                return markRegistrationReviewedAction(row.id);
              }}
              onSuccess={() => {
                setComprobado(true);
                toast.success(`Registro de ${row.markbox} comprobado`, {
                  link: { href: "/studio/clientes/registros-link?ver=todos", label: "Ver todos" },
                });
              }}
              onError={setError}
            />
          )}
        </div>
      )}
    </section>
  );
}
