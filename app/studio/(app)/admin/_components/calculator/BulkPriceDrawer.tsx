"use client";

/**
 * BulkPriceDrawer — cambio en lote del tarifario (SDD-0537, fase 2).
 *
 * Pone un costo y/o una venta NUEVOS, en valor absoluto, en varias ciudades
 * del mismo transportista, y muestra el antes y el después de cada una —con
 * su margen— antes de guardar. Todo o nada (ver
 * `bulkUpdateTariffPricesAction`).
 *
 * ⚠️ No hay «subir un %» ni «venta = costo × factor»: la venta no se deriva
 * del costo (SDD-0236). Dejar un campo vacío es «no cambia».
 */

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  margenTone,
  usd,
  usdConSigno,
  type CarrierTariff,
  type FreightCarrier,
} from "@/lib/studio/freight-carriers/types";
import {
  bulkUpdateTariffPricesAction,
  type BulkPriceActionState,
} from "../../carrier-actions";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";

const initialState: BulkPriceActionState = {};
const FORM_ID = "bulk-price-form";

const redondear = (n: number) => Math.round(n * 100) / 100;

export function BulkPriceDrawer({
  carrier,
  tariffs,
  nombre,
  onDone,
  onClose,
}: {
  carrier: FreightCarrier;
  /** Las tarifas seleccionadas, ya en el orden de la tabla. */
  tariffs: CarrierTariff[];
  nombre: (slug: string) => string;
  /** Después de guardar: limpiar la selección. */
  onDone: () => void;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(bulkUpdateTariffPricesAction, initialState);
  const toast = useToast();
  const router = useRouter();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [costo, setCosto] = useState<number | null>(null);
  const [venta, setVenta] = useState<number | null>(null);

  useEffect(() => {
    if (!state.ok) return;
    const n = state.updated ?? tariffs.length;
    // Un solo toast resumen para el lote (regla de trazabilidad del Studio).
    if (n < tariffs.length) {
      // Carrera: alguna ruta dejó de estar viva entre la comprobación y el
      // UPDATE. Lo que cambió, cambió; se dice cuántas, no se calla.
      toast.warning(
        `Precios actualizados en ${n} de ${tariffs.length} ciudades de ${carrier.name}. Las demás ya no estaban activas.`,
      );
    } else {
      toast.success(`Precios actualizados en ${n} ciudad${n === 1 ? "" : "es"} de ${carrier.name}`);
    }
    router.refresh();
    onDone();
    onClose();
    // Sólo debe correr cuando la acción responde ok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Depende de `isPending` y no de `state.error`: un segundo error con el mismo
  // texto no lo cambia, y el botón deshabilitado ya soltó el foco fuera del panel.
  useEffect(() => {
    if (!isPending && state.error) errorRef.current?.focus();
  }, [state, isPending]);

  const filas = tariffs.map((t) => {
    const costoNuevo = costo ?? t.costUsdCbm;
    const ventaNueva = venta ?? t.priceUsdCbm;
    return {
      t,
      costoNuevo,
      ventaNueva,
      margenAntes: redondear(t.priceUsdCbm - t.costUsdCbm),
      margenDespues: redondear(ventaNueva - costoNuevo),
    };
  });
  const negativos = filas.filter((f) => f.margenDespues < 0).length;
  const hayCambio = costo != null || venta != null;
  const n = tariffs.length;

  return (
    <DrawerShell
      title="Cambiar precios en lote"
      subtitle={`${n} ciudad${n === 1 ? "" : "es"} de ${carrier.name}`}
      onClose={onClose}
      pending={isPending}
      width={640}
    >
      <form
        id={FORM_ID}
        aria-busy={isPending}
        onSubmit={(event) => {
          event.preventDefault();
          if (isPending || !hayCambio) return;
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <input type="hidden" name="carrierId" value={carrier.id} />
        {tariffs.map((t) => (
          <input key={t.id} type="hidden" name="ids" value={t.id} />
        ))}

        <p style={{ margin: 0, font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          Escribe el valor nuevo por m³. El campo que dejes vacío no cambia. La venta no se
          calcula sola a partir del costo: si cambian los dos, escribe los dos.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
          <div>
            <label className="studio-label" htmlFor="bulk-cost">
              Costo nuevo /m³
            </label>
            <NumericInput
              id="bulk-cost"
              name="costUsdCbm"
              type="currency"
              min={0}
              placeholder="No cambia"
              onChange={setCosto}
              aria-invalid={state.fieldErrors?.costUsdCbm ? true : undefined}
            />
            {state.fieldErrors?.costUsdCbm && <FieldError msg={state.fieldErrors.costUsdCbm} />}
          </div>
          <div>
            <label className="studio-label" htmlFor="bulk-price">
              Venta nueva /m³
            </label>
            <NumericInput
              id="bulk-price"
              name="priceUsdCbm"
              type="currency"
              min={0}
              placeholder="No cambia"
              onChange={setVenta}
              aria-invalid={state.fieldErrors?.priceUsdCbm ? true : undefined}
            />
            {state.fieldErrors?.priceUsdCbm && <FieldError msg={state.fieldErrors.priceUsdCbm} />}
          </div>
        </div>

        <div>
          <h3
            id="bulk-preview-title"
            className="studio-eyebrow"
            style={{ color: "var(--ink-soft)", margin: "0 0 8px" }}
          >
            Antes y después
          </h3>
          {negativos > 0 && (
            <p
              role="status"
              style={{
                margin: "0 0 8px",
                padding: "8px 10px",
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink)",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {negativos} ciudad{negativos === 1 ? "" : "es"} quedaría{negativos === 1 ? "" : "n"} con
              la venta por debajo del costo.
            </p>
          )}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              overflow: "auto",
              maxHeight: 360,
            }}
          >
            <table
              aria-labelledby="bulk-preview-title"
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}
            >
              <thead>
                <tr>
                  <Th>Ciudad</Th>
                  <Th align="right">Costo /m³</Th>
                  <Th align="right">Venta /m³</Th>
                  <Th align="right">Margen /m³</Th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.t.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <Td>{nombre(f.t.citySlug)}</Td>
                    <Td align="right" mono>
                      <AntesDespues antes={usd(f.t.costUsdCbm)} despues={usd(f.costoNuevo)} />
                    </Td>
                    <Td align="right" mono>
                      <AntesDespues antes={usd(f.t.priceUsdCbm)} despues={usd(f.ventaNueva)} />
                    </Td>
                    <Td align="right" mono>
                      <AntesDespues
                        antes={usdConSigno(f.margenAntes)}
                        despues={usdConSigno(f.margenDespues)}
                        negativo={margenTone(f.margenDespues) === "negative"}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {state.error && (
          <p
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink)",
              margin: 0,
              padding: "10px 12px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
            }}
          >
            {state.error}
          </p>
        )}
      </form>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-ghost"
          onClick={onClose}
          disabled={isPending}
        >
          Cancelar
        </button>
        <button
          type="submit"
          form={FORM_ID}
          className="studio-btn studio-btn-primary"
          disabled={isPending || !hayCambio}
        >
          {isPending ? "Aplicando…" : `Aplicar a ${n} ciudad${n === 1 ? "" : "es"}`}
        </button>
      </footer>
    </DrawerShell>
  );
}

/** «$80,00 → $85,00»; si no cambia, sólo el valor. */
function AntesDespues({
  antes,
  despues,
  negativo = false,
}: {
  antes: string;
  despues: string;
  negativo?: boolean;
}) {
  const color = negativo ? "var(--danger)" : "var(--ink)";
  if (antes === despues) return <span style={{ color }}>{despues}</span>;
  return (
    <span>
      <span style={{ color: "var(--ink-soft)", textDecoration: "line-through" }}>{antes}</span>
      <span aria-hidden="true" style={{ color: "var(--ink-soft)" }}>
        {" → "}
      </span>
      <span className="sr-only"> pasa a </span>
      <strong style={{ color }}>{despues}</strong>
    </span>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      style={{
        textAlign: align,
        padding: "8px 10px",
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        background: "var(--bg-elevated)",
        whiteSpace: "nowrap",
        position: "sticky",
        top: 0,
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
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "8px 10px",
        color: "var(--ink)",
        whiteSpace: "nowrap",
        fontFamily: mono ? "var(--f-mono)" : undefined,
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--danger)", margin: "4px 0 0" }}>
      {msg}
    </p>
  );
}
