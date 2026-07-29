"use client";

/**
 * SDD-0172 · "Nueva compra" como asistente de 3 pasos (Norte
 * `PortalNuevaCompra`). Brecha 3 de la Fase 7 del Revestido.
 *
 * El paso 1 REGISTRA la compra: el Norte la crea apenas hay proveedor, y deja
 * el detalle (descripción, cajas, valor, adjuntos) para el paso 2. Por eso el
 * form manda `wizard=1` — la marca con la que `createPrealertaAction` sabe que
 * puede aceptar una compra sin detalle todavía.
 *
 * Mientras los pasos 2 y 3 no existan, el registro aterriza en la pantalla de
 * éxito de siempre: el cliente igual sale con su código, el link para el
 * proveedor y sus etiquetas. Nunca queda a mitad de camino.
 *
 * Sólo tokens `var(--*)` + clases del portal. Ojo: el tema oscuro es el DEFAULT
 * y los tokens con nombre de color voltean — sobre relleno wine va
 * `--color-on-accent`, jamás `text-white`.
 */

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { ArrowIcon } from "@/components/Icon";
import {
  PrealertaAddonPicker,
  ShippingModeNotice,
} from "../../../_components/PrealertaAddons";
import { FieldLabel, FileField } from "../../../_components/PortalFormField";
import { SupplierPicker } from "./SupplierPicker";
import { PurchaseWizardSteps } from "./PurchaseWizardSteps";
import { PurchaseOrderLive } from "./PurchaseOrderLive";
import { PurchaseDone } from "./NewPurchaseForm";
import type {
  SupplierView,
  PrealertaActionState,
} from "@/lib/studio/prealertas/types";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import { createPrealertaAction } from "../../proveedores/actions";
import { HOLD_MIN, HOLD_MAX, clampHoldCount } from "@/lib/portal/purchase-order-lines";

const prealertaInitial: PrealertaActionState = {};

export function NewPurchaseWizard({
  suppliers,
  addons,
  preselected,
}: {
  suppliers: SupplierView[];
  addons: PrealertaAddon[];
  preselected: SupplierView | null;
}) {
  const [state, action, pending] = useActionState(
    createPrealertaAction,
    prealertaInitial,
  );
  const uid = useId();
  const [supplierId, setSupplierId] = useState<string>(preselected?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [holdCount, setHoldCount] = useState(HOLD_MIN);
  const [holdTie, setHoldTie] = useState(false);

  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const done = !!state.ok && !!state.prealertaCode;

  // Con el acople puesto, el re-empaque lo manda el HOLD: destildarlo dejaría
  // la casilla en "no" mientras el panel lo sigue pidiendo (el helper lo repone).
  // Se bloquea acá y la propia tarjeta explica por qué.
  const reempaqueLocked = holdTie && selected.has("hold_consolidar");

  function toggle(code: string) {
    if (code === "reempaque_unificar" && reempaqueLocked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        // Al soltar el HOLD se suelta también el acople: el re-empaque atado
        // no puede sobrevivir a la consolidación que lo justificaba.
        if (code === "hold_consolidar" && holdTie) {
          next.delete("reempaque_unificar");
          setHoldTie(false);
        }
      } else {
        next.add(code);
      }
      return next;
    });
  }

  function toggleHoldTie(on: boolean) {
    setHoldTie(on);
    // La tarjeta del HOLD promete que el re-empaque entra: se marca de verdad,
    // así viaja en el form y el cliente lo ve tildado abajo.
    if (on) {
      setSelected((prev) => new Set(prev).add("reempaque_unificar"));
    }
  }

  if (done) {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
        <PurchaseDone
          code={state.prealertaCode!}
          shareToken={state.shareToken}
        />
      </div>
    );
  }

  return (
    <div>
      <PurchaseWizardSteps step={1} />

      <form
        action={action}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
      >
        {/* Marca del asistente: habilita registrar la compra sin detalle. */}
        <input type="hidden" name="wizard" value="1" />
        <input type="hidden" name="supplierId" value={supplierId} />
        <input type="hidden" name="hold_count" value={holdCount} />
        <input type="hidden" name="hold_tie" value={holdTie ? "1" : "0"} />

        <div className="min-w-0 card-shadow bg-white border border-grey-200 rounded-[18px] p-5 sm:p-6">
          <h2 className="text-[15px] font-bold text-ink m-0">
            ¿A quién le compras?
          </h2>

          <div className="mt-3.5">
            <SupplierPicker
              suppliers={suppliers}
              preselected={preselected}
              supplierId={supplierId}
              onSelect={setSupplierId}
            />
          </div>

          <div className="mt-4">
            <FieldLabel htmlFor={`${uid}-supplier-wechat`}>
              WeChat del proveedor
            </FieldLabel>
            <input
              id={`${uid}-supplier-wechat`}
              type="text"
              name="supplierWechat"
              key={supplierId}
              defaultValue={supplier?.wechat ?? ""}
              placeholder="WeChat ID o número — opcional"
              disabled={pending}
              className="mt-1.5 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
            />
            <p className="mt-1.5 text-[11.5px] text-grey-700 leading-[1.45]">
              ¿Prefieres no escribir el ID? Sube una captura (screenshot) del
              contacto de WeChat del proveedor — su ID o código QR.
            </p>
            <div className="mt-2">
              <FileField
                name="doc_whatsapp"
                label="Captura de WeChat (screenshot)"
                accept="image/*"
                disabled={pending}
              />
            </div>
          </div>

          <div className="mt-5">
            <ShippingModeNotice />
          </div>

          <div className="mt-4">
            <PrealertaAddonPicker
              addons={addons}
              selected={selected}
              onToggle={toggle}
              renderExtra={(a) => {
                if (a.code === "hold_consolidar") {
                  return (
                    <HoldControls
                      holdCount={holdCount}
                      onHoldCount={setHoldCount}
                      holdTie={holdTie}
                      onHoldTie={toggleHoldTie}
                    />
                  );
                }
                if (a.code === "reempaque_unificar" && reempaqueLocked) {
                  return (
                    <p className="text-[11.5px] font-semibold text-ink leading-[1.5] m-0">
                      Incluido junto con tu HOLD ↑ — se quita desde ahí.
                    </p>
                  );
                }
                return null;
              }}
            />
          </div>

          {state.fieldErrors?.supplierId && (
            <p className="mt-3 text-[12.5px] text-wine">
              {state.fieldErrors.supplierId}
            </p>
          )}
          {state.error && (
            <p className="mt-3 text-[12.5px] text-wine">{state.error}</p>
          )}
        </div>

        <div className="lg:sticky lg:top-[88px] flex flex-col gap-3">
          <PurchaseOrderLive
            supplierName={supplier?.name ?? null}
            addons={addons}
            selected={selected}
            holdCount={holdCount}
            holdTie={holdTie}
          />

          <button
            type="submit"
            disabled={pending || !supplierId}
            className="btn btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
          >
            {pending ? "Registrando compra…" : "Registrar compra"}
            {!pending && <ArrowIcon size={15} />}
          </button>

          {!supplierId && (
            <p className="text-[11.5px] text-grey-700 leading-[1.5] text-center m-0">
              Escribe o elige un proveedor para continuar.
            </p>
          )}

          <Link
            href="/portal/compras"
            className="text-[12px] font-semibold text-grey-500 hover:text-ink transition-colors text-center"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

// ── Controles del HOLD: cuántas compras retiene y si arrastra re-empaque ──
function HoldControls({
  holdCount,
  onHoldCount,
  holdTie,
  onHoldTie,
}: {
  holdCount: number;
  /**
   * Updater, NO un valor: dos clics seguidos en "+" leerían el mismo
   * `holdCount` del closure y sumarían uno solo (medido en el navegador).
   */
  onHoldCount: (next: (prev: number) => number) => void;
  holdTie: boolean;
  onHoldTie: (on: boolean) => void;
}) {
  const uid = useId();
  const step = (delta: number) =>
    onHoldCount((prev) => clampHoldCount(prev + delta));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <FieldLabel htmlFor={`${uid}-hold`}>
          ¿Cuántas compras vas a unificar en total?
        </FieldLabel>
        <div className="mt-1.5 inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={holdCount <= HOLD_MIN}
            aria-label="Una compra menos"
            className="w-8 h-8 rounded-[8px] border border-grey-200 bg-white text-ink text-[16px] font-bold grid place-items-center disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-wine"
          >
            −
          </button>
          <output
            id={`${uid}-hold`}
            className="min-w-[24px] text-center text-[15px] font-bold text-ink"
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            }}
          >
            {holdCount}
          </output>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={holdCount >= HOLD_MAX}
            aria-label="Una compra más"
            className="w-8 h-8 rounded-[8px] border border-grey-200 bg-white text-ink text-[16px] font-bold grid place-items-center disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-wine"
          >
            +
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] text-grey-700 leading-[1.5]">
          {holdCount <= HOLD_MIN
            ? "Sin especificar, unificamos con la próxima compra que llegue — 2 en total."
            : `El despacho queda en espera hasta que las ${holdCount} compras estén en bodega.`}
        </p>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={holdTie}
          onChange={(e) => onHoldTie(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-wine)]"
        />
        <span className="text-[11.5px] text-grey-700 leading-[1.5]">
          Este HOLD implica reempaque
          {holdTie && (
            <span className="block mt-0.5 font-semibold text-ink">
              Re-Empaque quedó pedido junto con este HOLD.
            </span>
          )}
        </span>
      </label>
    </div>
  );
}
