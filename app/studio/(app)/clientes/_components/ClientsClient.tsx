"use client";

/**
 * Orquestador client del módulo Clientes (SDD-0010).
 *
 * - Header con CTA "+ Nuevo cliente"
 * - Toolbar con filtros (tier + search), URL state
 * - Tabla con clientes — click en fila → /clientes/[markbox]
 * - Drawer crear/editar
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import {
  CLIENTS_MAX,
  CLIENTS_PAGE,
  CLIENT_TIER_OPTIONS,
  docVerifyBadge,
  tierBadgeTone,
  tierLabel,
  type Client,
} from "@/lib/studio/client-types";
import type { ClientFilters } from "@/lib/studio/client-queries";
import { prefixChain, type AliadoOption } from "@/lib/studio/aliados/aliado-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ActionMenu } from "@/app/studio/_components/ui/ActionMenu";
import { ClientDrawer } from "./ClientDrawer";

type DrawerState = null | { mode: "create" } | { mode: "edit"; client: Client };

export function ClientsClient({
  aliados,
  clients,
  filters,
  total,
  limite,
  topeAlcanzado,
}: {
  clients: Client[];
  filters: ClientFilters;
  aliados: AliadoOption[];
  /** SDD-0265: cuántos matchean los filtros en total, no cuántos se muestran. */
  total: number;
  /** Cuántas filas se pidieron en esta carga. */
  limite: number;
  /** El techo de PostgREST impide seguir trayendo más. */
  topeAlcanzado: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [tier, setTier] = useState(params.get("tier") ?? "");
  const paramsKey = params.toString();
  const [filtersKey, setFiltersKey] = useState(paramsKey);
  if (filtersKey !== paramsKey) {
    setFiltersKey(paramsKey);
    setQ(params.get("q") ?? "");
    setTier(params.get("tier") ?? "");
  }
  const pending = params.get("pending") === "1";
  const hasActiveFilter =
    !!filters.q || filters.tier !== "all" || !!filters.pendingReview;

  // Ojo: arma los params DESDE CERO, así que un cambio de filtro borra el
  // `limite` y el listado vuelve al primer bloque. Es lo que corresponde: otra
  // búsqueda es otro conjunto, y arrastrar el tope viejo mostraría de más.
  const pushFilters = (next: {
    q?: string;
    tier?: string;
    pending?: boolean;
  }) => {
    const s = new URLSearchParams();
    if (next.q && next.q.trim()) s.set("q", next.q.trim());
    if (next.tier) s.set("tier", next.tier);
    if (next.pending) s.set("pending", "1");
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/clientes?${qs}` : "/studio/clientes");
    });
  };

  // SDD-0265 · "Ver más" conserva los filtros vigentes y sube el tope un bloque.
  const verMas = () => {
    const s = new URLSearchParams(params.toString());
    s.set("limite", String(Math.min(limite + CLIENTS_PAGE, CLIENTS_MAX)));
    startTransition(() => {
      router.push(`/studio/clientes?${s.toString()}`);
    });
  };

  const mostrados = clients.length;
  const hayMas = mostrados < total;
  const pushFiltersEvent = useEffectEvent(pushFilters);
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => pushFiltersEvent({ q, tier, pending }), 350);
    return () => clearTimeout(t);
  }, [params, pending, q, tier]);

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Comercial</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
          >
            Clientes.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            Catálogo del tenant. La cédula/RIF es el ancla de identidad; el
            Shipping Mark rastrea las cajas. El detalle muestra el historial de
            envíos.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* SDD-0266 · BTN-01 §4: "acciones raras pasan al menú". Fusionar
              duplicados (SDD-0246) y migrar códigos del legado (SDD-0258) son
              mantenimiento episódico; antes ocupaban permanentemente el mismo
              renglón que la única acción de uso diario. Van con `href` y no con
              `onSelect`: son rutas, y el menú las renderiza como <a>. */}
          <ActionMenu
            label="Mantenimiento"
            ariaLabel="Tareas de mantenimiento de clientes"
            items={[
              {
                key: "duplicados",
                label: "Posibles duplicados",
                href: "/studio/clientes/duplicados",
              },
              {
                key: "legado",
                label: "Códigos del legado",
                href: "/studio/clientes/migrar-legado",
              },
            ]}
          />
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setDrawer({ mode: "create" })}
          >
            + Nuevo cliente
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity var(--dur-fast) var(--ease)",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label className="studio-label" htmlFor="client-q">
            Buscar
          </label>
          <input
            id="client-q"
            type="search"
            className="studio-input"
            placeholder="Cédula/RIF, nombre, Shipping Mark, email, teléfono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 200px" }}>
          <label className="studio-label" htmlFor="client-tier">
            Tier
          </label>
          <select
            id="client-tier"
            className="studio-input"
            value={tier}
            onChange={(e) => {
              setTier(e.target.value);
              pushFilters({ q, tier: e.target.value });
            }}
          >
            <option value="">Todos</option>
            {CLIENT_TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={`studio-btn studio-btn-sm ${
            pending ? "studio-btn-dark" : "studio-btn-ghost"
          }`}
          style={{ height: 38 }}
          aria-pressed={pending}
          onClick={() => pushFilters({ q, tier, pending: !pending })}
          title="Clientes que se registraron solos y todavía no verificaste"
        >
          Pendientes de revisar
        </button>
        {(q || tier || pending) && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38 }}
            onClick={() => {
              setQ("");
              setTier("");
              pushFilters({});
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla o empty */}
      {clients.length === 0 ? (
        hasActiveFilter ? (
          <EmptyState
            eyebrow="Sin resultados"
            title={
              filters.pendingReview
                ? "No hay clientes pendientes de revisar."
                : "Ningún cliente coincide con estos filtros."
            }
            description={
              filters.pendingReview
                ? "Los clientes self-registrados ya verificados no aparecen acá."
                : "Prueba ajustar los filtros o limpia la búsqueda."
            }
          />
        ) : (
          <EmptyState
            eyebrow="Catálogo vacío"
            title="Aún no cargaste clientes."
            description="Crea el primer cliente. El Shipping Mark se asigna automáticamente."
            action={
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={() => setDrawer({ mode: "create" })}
              >
                + Nuevo cliente
              </button>
            }
          />
        )
      ) : (
        <>
          <ClientsTable clients={clients} aliados={aliados} />

          {/* SDD-0265 · SGE-00.07: el estado tiene que ser visible Y verdadero.
              Antes se mostraban 200 de 451 sin decirlo en ninguna parte. */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
            <p
              role="status"
              aria-live="polite"
              style={{
                margin: 0,
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {hayMas
                ? `Mostrando ${mostrados} de ${total} clientes`
                : total === 1
                  ? "1 cliente"
                  : `${total} clientes`}
              {hasActiveFilter ? " que coinciden con los filtros" : ""}
            </p>

            {hayMas &&
              (topeAlcanzado ? (
                // Honestidad antes que un botón que no cumpliría: por encima del
                // tope de PostgREST no se pueden traer más filas, así que se dice
                // y se manda al buscador en vez de prometer otro bloque.
                <span
                  style={{
                    font: "500 12.5px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    maxWidth: "48ch",
                  }}
                >
                  Es el máximo que se puede listar de una vez. Usa el buscador
                  para llegar a un cliente puntual.
                </span>
              ) : (
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={verMas}
                  disabled={isPending}
                  aria-busy={isPending}
                >
                  {isPending
                    ? "Cargando…"
                    : `Ver ${Math.min(CLIENTS_PAGE, total - mostrados)} más`}
                </button>
              ))}
          </div>
        </>
      )}

      {drawer && (
        <ClientDrawer
          mode={drawer.mode}
          client={drawer.mode === "edit" ? drawer.client : undefined}
          aliados={aliados}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

function ClientsTable({
  clients,
  aliados,
}: {
  clients: Client[];
  aliados: AliadoOption[];
}) {
  // SDD-0255 · índices por cliente-padre y por id. El aliado ES un cliente, así
  // que en el listado hay que poder distinguirlo de un vistazo: hoy se ven los
  // tier (VIP, Premium) pero nada decía que una ficha es un aliado.
  const aliadoPorClienteId = new Map(aliados.map((a) => [a.clientId, a]));
  const aliadoPorId = new Map(aliados.map((a) => [a.id, a]));

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "120px 120px 1.5fr 100px 1.2fr 140px",
          gap: 12,
          padding: "var(--s-3) var(--s-5)",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        <span>Shipping Mark</span>
        <span>Cédula/RIF</span>
        <span>Nombre</span>
        <span>Tier</span>
        <span>Contacto</span>
        <span>Creado</span>
      </div>

      {clients.map((c, i) => (
        <Link
          key={c.id}
          href={`/studio/clientes/${c.markbox}`}
          className="studio-tracking-row"
          style={{
            display: "grid",
            gridTemplateColumns: "120px 120px 1.5fr 100px 1.2fr 140px",
            gap: 12,
            padding: "14px 20px",
            borderTop: i > 0 ? "1px solid var(--border)" : 0,
            alignItems: "center",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span
            style={{
              font: "700 12.5px/1 var(--f-mono)",
              color: "var(--ink)",
              letterSpacing: "0.02em",
            }}
          >
            {c.markbox}
          </span>
          <span
            style={{
              font: "600 12px/1 var(--f-mono)",
              color: c.rif ? "var(--ink)" : "var(--ink-mute)",
              letterSpacing: "0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.rif ?? "—"}
          </span>
          <div
            style={{
              font: "600 13px/1.3 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {c.name}
              {/* SDD-0255 · esta ficha ES un aliado. Tono `success` a propósito:
                  `info` y `wine` ya los usan VIP y Premium, así que el aliado
                  tiene que leerse distinto de un vistazo. Muestra CUÁL aliado,
                  que es más útil que decir sólo que lo es. */}
              {aliadoPorClienteId.has(c.id) && (
                <Badge tone="success" size="sm">
                  Aliado · {prefixChain(aliados, aliadoPorClienteId.get(c.id)!.id)}
                </Badge>
              )}
              {/* Y si el cliente PERTENECE a un aliado, de quién es. */}
              {c.aliado_id && aliadoPorId.has(c.aliado_id) && (
                <span
                  title={`Cliente de ${aliadoPorId.get(c.aliado_id)!.tradeName}`}
                  style={{
                    font: "600 10px/1 var(--f-mono)",
                    color: "var(--ink-mute)",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  de {prefixChain(aliados, c.aliado_id)}
                </span>
              )}
              {/* SDD-0046: badge advisory de verificación · solo para self-registrados. */}
              {c.registration_channel === "portal" && (
                <Badge tone={docVerifyBadge(c.doc_verify_status).tone} size="sm">
                  {docVerifyBadge(c.doc_verify_status).label}
                </Badge>
              )}
            </span>
            {c.notes && (
              <div
                style={{
                  font: "500 11px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.notes}
              </div>
            )}
          </div>
          <span>
            <Badge tone={tierBadgeTone(c.tier)} size="sm">
              {tierLabel(c.tier)}
            </Badge>
          </span>
          <div
            style={{
              font: "500 12px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
              overflow: "hidden",
            }}
          >
            {c.email && (
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.email}
              </div>
            )}
            {c.phone && (
              <div
                style={{
                  font: "500 11.5px/1.3 var(--f-mono)",
                  color: "var(--ink-soft)",
                  marginTop: 2,
                }}
              >
                {c.phone}
              </div>
            )}
            {!c.email && !c.phone && <span style={{ color: "var(--ink-mute)" }}>—</span>}
          </div>
          <span
            style={{
              font: "500 11.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            {new Date(c.created_at).toLocaleDateString("es-VE", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </Link>
      ))}
    </div>
  );
}
