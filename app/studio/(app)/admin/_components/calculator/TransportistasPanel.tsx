"use client";

/**
 * TransportistasPanel — sub-pestaña "Transportistas" de Calculadora pública
 * (Administración · grupo PRO). SDD-0236 · SDD-0537.
 *
 * Dos cosas en una pantalla:
 *   · Quiénes son los transportistas y CUÁL cotiza la web (el predeterminado).
 *   · El tarifario por ciudad del que esté seleccionado, editable: cambiar los
 *     números de una ciudad, agregar una ciudad del catálogo o quitar una ruta.
 *
 * El precio se edita acá y se refleja en la calculadora pública SIN deploy —
 * ese era el punto de todo el modelo.
 *
 * ⚠️ La columna "Margen" es una RESTA (venta − costo), no un porcentaje. La
 * venta NO se deriva del costo: son dos números negociados por separado. Ver
 * SDD-0236 antes de "arreglar" esto con un multiplicador.
 */

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CarrierTariff, FreightCarrier } from "@/lib/studio/freight-carriers/types";
import {
  cbmAFt3,
  ciudadesSinTarifa,
  margenPorCbm,
  margenTone,
  tardaMasDeLoNormal,
  usd,
  usdConSigno,
} from "@/lib/studio/freight-carriers/types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import { Icon } from "@/app/studio/_components/icons";
import {
  deleteTariffAction,
  setDefaultCarrierAction,
  type CarrierActionState,
} from "../../carrier-actions";
import { TariffDrawer, type CityOption } from "./TariffDrawer";
import { BulkPriceDrawer } from "./BulkPriceDrawer";

type DrawerState =
  | { mode: "create" }
  | { mode: "edit"; tariff: CarrierTariff }
  | { mode: "bulk" }
  | null;

/** Sin acentos ni mayúsculas, para que «merida» encuentre «Mérida». */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function TransportistasPanel({
  carriers,
  tariffs,
  cities,
  isAdmin,
}: {
  carriers: FreightCarrier[];
  tariffs: CarrierTariff[];
  /** Catálogo vivo de `calculator_cities`: nombres visibles y ciudades para agregar. */
  cities: CityOption[];
  isAdmin: boolean;
}) {
  const predeterminado = carriers.find((c) => c.isDefault && c.active) ?? null;
  const [seleccionado, setSeleccionado] = useState<string | null>(
    predeterminado?.id ?? carriers[0]?.id ?? null,
  );
  const [busqueda, setBusqueda] = useState("");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [quitar, setQuitar] = useState<CarrierTariff | null>(null);
  const [quitarError, setQuitarError] = useState<string | undefined>();
  const [quitando, startQuitar] = useTransition();
  /** Fase 2: ids de las tarifas marcadas para el cambio en lote. */
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set());
  const toast = useToast();
  const router = useRouter();
  const flashClassFor = useRowHighlight();

  const cityLabels = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.slug, c.label])) as Record<string, string>,
    [cities],
  );
  const nombre = (slug: string) => cityLabels[slug] ?? slug;
  const carrier = carriers.find((c) => c.id === seleccionado) ?? null;

  const delSeleccionado = useMemo(
    () =>
      tariffs
        .filter((t) => t.carrierId === seleccionado)
        .sort((a, b) =>
          (cityLabels[a.citySlug] ?? a.citySlug).localeCompare(
            cityLabels[b.citySlug] ?? b.citySlug,
            "es",
          ),
        ),
    [tariffs, seleccionado, cityLabels],
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return delSeleccionado;
    return delSeleccionado.filter((t) =>
      normalizar(cityLabels[t.citySlug] ?? t.citySlug).includes(q),
    );
  }, [delSeleccionado, busqueda, cityLabels]);

  const seleccion = delSeleccionado.filter((t) => marcadas.has(t.id));
  const todasVisiblesMarcadas = visibles.length > 0 && visibles.every((t) => marcadas.has(t.id));
  const algunaVisibleMarcada = visibles.some((t) => marcadas.has(t.id));

  function alternar(id: string) {
    setMarcadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternarVisibles() {
    setMarcadas((prev) => {
      const next = new Set(prev);
      if (todasVisiblesMarcadas) for (const t of visibles) next.delete(t.id);
      else for (const t of visibles) next.add(t.id);
      return next;
    });
  }

  const disponibles = useMemo(
    () => (seleccionado ? ciudadesSinTarifa(cities, tariffs, seleccionado) : []),
    [cities, tariffs, seleccionado],
  );

  function confirmarQuitar(t: CarrierTariff) {
    setQuitarError(undefined);
    startQuitar(async () => {
      const fd = new FormData();
      fd.set("id", t.id);
      fd.set("carrierId", t.carrierId);
      const res = await deleteTariffAction({}, fd);
      if (res.ok) {
        toast.success(`Ruta a ${nombre(t.citySlug)} quitada`);
        setQuitar(null);
        router.refresh();
      } else {
        setQuitarError(res.error ?? "No se pudo quitar la ruta. Intenta de nuevo.");
      }
    });
  }

  return (
    <div style={{ maxWidth: 1040 }}>
      {/* Qué está cotizando la web ahora mismo */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "var(--s-3) var(--s-4)",
          marginBottom: 18,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        <span style={{ color: "var(--wine)", flexShrink: 0, marginTop: 1 }}>{Icon.info(15)}</span>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--ink-soft)" }}>
          {predeterminado ? (
            <>
              La calculadora del sitio cotiza el tramo nacional con{" "}
              <strong style={{ color: "var(--ink)" }}>{predeterminado.name}</strong>. El
              cliente nunca ve quién es ni cuánto nos cuesta: solo el precio de venta.
            </>
          ) : (
            <>
              <strong style={{ color: "var(--ink)" }}>No hay transportista predeterminado.</strong>{" "}
              Mientras siga así, la calculadora no cotiza el tramo nacional y deriva al
              asesor — que es lo correcto: no inventa un precio.
            </>
          )}
        </p>
      </div>

      {carriers.length === 0 ? (
        <EmptyState
          title="Todavía no hay transportistas"
          description="Registra el primero para poder cargarle su tarifario por ciudad."
        />
      ) : (
        <>
          {/* ── Los transportistas ── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", marginBottom: 22 }}>
            {carriers.map((c) => (
              <TarjetaTransportista
                key={c.id}
                carrier={c}
                activo={c.id === seleccionado}
                cuantasTarifas={tariffs.filter((t) => t.carrierId === c.id).length}
                isAdmin={isAdmin}
                onSeleccionar={() => {
                  setSeleccionado(c.id);
                  setBusqueda("");
                  setMarcadas(new Set());
                }}
              />
            ))}
          </div>

          {carrier && (
            <section aria-labelledby="tarifario-titulo">
              {/* ── Encabezado del tarifario ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: "var(--s-3)",
                  flexWrap: "wrap",
                  marginBottom: "var(--s-3)",
                }}
              >
                <div>
                  <h3
                    id="tarifario-titulo"
                    style={{ margin: 0, font: "700 15px/1.3 var(--f-sans)", color: "var(--ink)" }}
                  >
                    Tarifario de {carrier.name}
                  </h3>
                  <p style={{ margin: "2px 0 0", font: "400 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                    {delSeleccionado.length} ciudad{delSeleccionado.length === 1 ? "" : "es"} con tarifa
                    {carrier.isDefault && carrier.active
                      ? " · lo que cambies acá lo cotiza la web al guardar"
                      : " · este transportista no cotiza la web"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
                  {delSeleccionado.length > 0 && (
                    <input
                      type="search"
                      className="studio-input"
                      aria-label="Buscar ciudad en el tarifario"
                      placeholder="Buscar ciudad…"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      style={{ width: 200 }}
                    />
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      className="studio-btn studio-btn-primary studio-btn-sm"
                      onClick={() => setDrawer({ mode: "create" })}
                      disabled={disponibles.length === 0}
                      title={
                        disponibles.length === 0
                          ? "Ya tiene todas las ciudades del catálogo"
                          : undefined
                      }
                    >
                      + Agregar ciudad
                    </button>
                  )}
                </div>
              </div>

              {/* ── Cambio en lote (fase 2) ── */}
              {isAdmin && seleccion.length > 0 && (
                <div
                  role="region"
                  aria-label="Selección para cambio en lote"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--s-3)",
                    flexWrap: "wrap",
                    padding: "var(--s-2) var(--s-3)",
                    marginBottom: "var(--s-2)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--r-md)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                    {seleccion.length === 1
                      ? "1 ciudad seleccionada"
                      : `${seleccion.length} ciudades seleccionadas`}
                  </span>
                  <span style={{ display: "inline-flex", gap: "var(--s-2)" }}>
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-sm"
                      onClick={() => setMarcadas(new Set())}
                    >
                      Quitar selección
                    </button>
                    <button
                      type="button"
                      className="studio-btn studio-btn-dark studio-btn-sm"
                      onClick={() => setDrawer({ mode: "bulk" })}
                    >
                      Cambiar precios
                    </button>
                  </span>
                </div>
              )}

              {/* ── El tarifario del seleccionado ── */}
              {delSeleccionado.length === 0 ? (
                <EmptyState
                  title="Este transportista no tiene tarifas cargadas"
                  description="Sin tarifas, no puede cotizar ninguna ciudad. Agrega la primera desde el catálogo de ciudades."
                />
              ) : visibles.length === 0 ? (
                <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "12px 0" }}>
                  Ninguna ciudad de este tarifario coincide con «{busqueda}».
                </p>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    background: "var(--bg-surface)",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {isAdmin && (
                          <Th>
                            <input
                              type="checkbox"
                              className="studio-checkbox"
                              aria-label="Seleccionar todas las ciudades visibles"
                              checked={todasVisiblesMarcadas}
                              ref={(el) => {
                                if (el) el.indeterminate = algunaVisibleMarcada && !todasVisiblesMarcadas;
                              }}
                              onChange={alternarVisibles}
                              style={{ width: 16, height: 16, accentColor: "var(--wine)", cursor: "pointer" }}
                            />
                          </Th>
                        )}
                        <Th>Ciudad</Th>
                        <Th align="right">Costo /m³</Th>
                        <Th align="right">Venta /m³</Th>
                        <Th align="right">Margen /m³</Th>
                        <Th align="right">En ft³</Th>
                        <Th>Cada cuánto sale</Th>
                        {isAdmin && (
                          <Th align="right">
                            <span className="sr-only">Acciones</span>
                          </Th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((t) => {
                        const margen = margenPorCbm(t);
                        const tono = margenTone(margen);
                        const ciudad = nombre(t.citySlug);
                        return (
                          <tr
                            key={t.id}
                            data-row-id={t.citySlug}
                            className={flashClassFor(t.citySlug)}
                            style={{
                              borderTop: "1px solid var(--border)",
                              background: marcadas.has(t.id) ? "var(--bg-elevated)" : undefined,
                            }}
                          >
                            {isAdmin && (
                              <Td>
                                <input
                                  type="checkbox"
                                  className="studio-checkbox"
                                  aria-label={`Seleccionar ${ciudad}`}
                                  checked={marcadas.has(t.id)}
                                  onChange={() => alternar(t.id)}
                                  style={{ width: 16, height: 16, accentColor: "var(--wine)", cursor: "pointer" }}
                                />
                              </Td>
                            )}
                            <Td>
                              <span style={{ fontWeight: 600 }}>{ciudad}</span>
                              {tardaMasDeLoNormal(t.dispatchFrequencyDays) && (
                                <span style={{ marginLeft: 8 }}>
                                  <Badge tone="warning" size="sm">
                                    cada {t.dispatchFrequencyDays} días
                                  </Badge>
                                </span>
                              )}
                            </Td>
                            <Td align="right" mono soft>
                              {usd(t.costUsdCbm)}
                            </Td>
                            <Td align="right" mono>
                              {t.priceUsdCbm === 0 ? (
                                <Badge tone="neutral" size="sm">
                                  sin costo
                                </Badge>
                              ) : (
                                usd(t.priceUsdCbm)
                              )}
                            </Td>
                            <Td align="right" mono>
                              <span
                                style={{
                                  color:
                                    tono === "negative"
                                      ? "var(--danger)"
                                      : tono === "positive"
                                        ? "var(--success)"
                                        : "var(--ink-soft)",
                                }}
                              >
                                {usdConSigno(margen)}
                              </span>
                            </Td>
                            <Td align="right" mono soft>
                              {usd(cbmAFt3(t.priceUsdCbm))}
                            </Td>
                            <Td soft>{t.departureFrequency ?? "—"}</Td>
                            {isAdmin && (
                              <Td align="right">
                                <span style={{ display: "inline-flex", gap: 4 }}>
                                  <IconButton
                                    label={`Editar ${ciudad}`}
                                    onClick={() => setDrawer({ mode: "edit", tariff: t })}
                                  >
                                    {Icon.edit(13)}
                                  </IconButton>
                                  <IconButton
                                    label={`Quitar ${ciudad}`}
                                    danger
                                    onClick={() => {
                                      setQuitarError(undefined);
                                      setQuitar(t);
                                    }}
                                  >
                                    {Icon.trash(13)}
                                  </IconButton>
                                </span>
                              </Td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p style={{ marginTop: 12, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                El <strong>margen es una resta</strong>, no un porcentaje: la venta se negoció
                aparte del costo y no se deriva de él. Un margen en rojo es una ciudad que DTD
                está absorbiendo a propósito.
              </p>
            </section>
          )}
        </>
      )}

      {drawer?.mode === "bulk" && carrier && seleccion.length > 0 && (
        <BulkPriceDrawer
          carrier={carrier}
          tariffs={seleccion}
          nombre={nombre}
          onDone={() => setMarcadas(new Set())}
          onClose={() => setDrawer(null)}
        />
      )}

      {drawer && drawer.mode !== "bulk" && carrier && (
        <TariffDrawer
          mode={drawer.mode}
          carrier={carrier}
          tariff={drawer.mode === "edit" ? drawer.tariff : undefined}
          cityLabel={drawer.mode === "edit" ? nombre(drawer.tariff.citySlug) : undefined}
          availableCities={drawer.mode === "create" ? disponibles : undefined}
          onClose={() => setDrawer(null)}
        />
      )}

      <ConfirmDialog
        open={quitar != null}
        danger
        title={quitar ? `Quitar la ruta a ${nombre(quitar.citySlug)}` : "Quitar la ruta"}
        message={
          quitar && carrier
            ? `${carrier.name} deja de cotizar ${nombre(quitar.citySlug)}.${
                carrier.isDefault && carrier.active
                  ? " La web no le dará precio a esa ciudad y derivará al asesor."
                  : ""
              } Puedes volver a agregarla cuando quieras.`
            : ""
        }
        confirmLabel={quitando ? "Quitando…" : "Quitar ruta"}
        pending={quitando}
        error={quitarError}
        onCancel={() => {
          if (quitando) return;
          setQuitar(null);
          setQuitarError(undefined);
        }}
        onConfirm={() => {
          if (quitar) confirmarQuitar(quitar);
        }}
      />
    </div>
  );
}

// ── Tarjeta de transportista ────────────────────────────────────

function TarjetaTransportista({
  carrier,
  activo,
  cuantasTarifas,
  isAdmin,
  onSeleccionar,
}: {
  carrier: FreightCarrier;
  activo: boolean;
  cuantasTarifas: number;
  isAdmin: boolean;
  onSeleccionar: () => void;
}) {
  const [state, action, pending] = useActionState<CarrierActionState, FormData>(
    setDefaultCarrierAction,
    {},
  );

  return (
    <div
      style={{
        border: `1px solid ${activo ? "var(--wine)" : "var(--border)"}`,
        borderRadius: "var(--r-md)",
        padding: "var(--s-3)",
        minWidth: 230,
        background: activo ? "var(--bg-elevated)" : "var(--bg-surface)",
      }}
    >
      <button
        type="button"
        onClick={onSeleccionar}
        aria-pressed={activo}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          width: "100%",
          color: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14, color: "var(--ink)" }}>{carrier.name}</strong>
          {carrier.isDefault && carrier.active && <Badge tone="success">cotiza la web</Badge>}
          {!carrier.active && <Badge tone="neutral">inactivo</Badge>}
        </div>
        {carrier.legalName && (
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 2 }}>
            {carrier.legalName}
            {carrier.taxId ? ` · ${carrier.taxId}` : ""}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 6 }}>
          {cuantasTarifas === 0
            ? "sin tarifas cargadas"
            : `${cuantasTarifas} ciudad${cuantasTarifas === 1 ? "" : "es"} con tarifa`}
        </div>
      </button>

      {isAdmin && !carrier.isDefault && carrier.active && (
        <form action={action} style={{ marginTop: 10 }}>
          <input type="hidden" name="id" value={carrier.id} />
          <button
            type="submit"
            disabled={pending}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--wine-text)",
              background: "none",
              border: 0,
              padding: 0,
              cursor: pending ? "wait" : "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            {pending ? "Cambiando…" : "Que este cotice la web"}
          </button>
        </form>
      )}

      {state.error && (
        <p role="alert" style={{ marginTop: 8, fontSize: 12, color: "var(--danger)" }}>
          {state.error}
        </p>
      )}
    </div>
  );
}

// ── Celdas ──────────────────────────────────────────────────────

function IconButton({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: 32,
        height: 32,
        display: "grid",
        placeItems: "center",
        border: 0,
        borderRadius: "var(--r-sm)",
        color: danger ? "var(--danger)" : "var(--ink-soft)",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      style={{
        textAlign: align,
        padding: "var(--s-2) var(--s-3)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        background: "var(--bg-elevated)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono = false,
  soft = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  soft?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "var(--s-2) var(--s-3)",
        color: soft ? "var(--ink-soft)" : "var(--ink)",
        whiteSpace: "nowrap",
        fontFamily: mono ? "var(--f-mono)" : undefined,
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
      }}
    >
      {children}
    </td>
  );
}
