"use client";

/**
 * SDD-0173 · "Nueva compra" como asistente de 3 pasos (Norte
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

import { useCallback, useId, useState } from "react";
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
import { PurchaseStepDetalle } from "./PurchaseStepDetalle";
import { PurchaseStepConfirm } from "./PurchaseStepConfirm";
import type { ChecklistItem } from "./PurchaseSummaryPanel";
import type {
  SupplierView,
  PrealertaActionState,
} from "@/lib/studio/prealertas/types";
import { PREALERTA_CLIENT_NOTE_MAX } from "@/lib/studio/prealertas/types";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import { createPrealertaAction } from "../../proveedores/actions";
import {
  HOLD_MIN,
  HOLD_MAX,
  clampHoldCount,
  buildPurchaseOrderLines,
} from "@/lib/portal/purchase-order-lines";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";
import { useActionKeepingDraft } from "@/lib/shared/use-action-keeping-draft";

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
  const [state, formProps, pending] = useActionKeepingDraft(
    createPrealertaAction,
    prealertaInitial,
    "No pudimos confirmar si tu compra se registró. Lo que escribiste sigue aquí. Antes de registrarla de nuevo, revisa Mis compras en otra pestaña.",
  );
  const uid = useId();
  const [supplierId, setSupplierId] = useState<string>(preselected?.id ?? "");
  /**
   * Nombre del proveedor cuya ficha de alta está abierta (`isNew` del Norte,
   * `_norte/portal/app.jsx:3372`). Sin este dato el pie del botón no puede
   * distinguir "te falta elegir" de "te falta guardar", y le decía al cliente
   * que escribiera un nombre que ya había escrito.
   */
  const [draftSupplier, setDraftSupplier] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [holdCount, setHoldCount] = useState(HOLD_MIN);
  const [holdTie, setHoldTie] = useState(false);
  // Post-registro: paso 2 (detalle) → paso 3 (handoff al proveedor).
  const [phase, setPhase] = useState<"detalle" | "confirm">("detalle");
  const [detalleChecklist, setDetalleChecklist] = useState<ChecklistItem[]>([]);
  const goToConfirm = useCallback(() => setPhase("confirm"), []);

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

  // Registrada → el asistente pasa a sus dos pasos post-registro. La orden que
  // el cliente acaba de armar viaja con él: sin esto desaparecía de la pantalla
  // justo después de pedirla, y en el paso 3 ya no había cómo recordarla.
  if (done) {
    const code = state.prealertaCode!;
    const order = {
      supplierName: supplier?.name ?? null,
      lines: buildPurchaseOrderLines({
        addons,
        selected: [...selected] as Parameters<
          typeof buildPurchaseOrderLines
        >[0]["selected"],
        holdCount,
        holdTie,
      }),
    };
    if (phase === "detalle") {
      return (
        <PurchaseStepDetalle
          code={code}
          order={order}
          onDone={goToConfirm}
          onProgress={setDetalleChecklist}
        />
      );
    }
    return (
      <PurchaseStepConfirm
        code={code}
        shareToken={state.shareToken}
        checklist={detalleChecklist}
        order={order}
        onBack={() => setPhase("detalle")}
      />
    );
  }

  return (
    <div>
      <PurchaseWizardSteps step={1} />

      <div className="eyebrow eyebrow-wine mb-4" style={{ fontSize: 13 }}>
        Nueva compra · prealerta
      </div>

      <form
        {...formProps}
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
              onDraftSupplierChange={setDraftSupplier}
              showProfile
            />
          </div>

          {/* Nota del cliente sobre ESTA compra (Norte, paso 1). Sale sólo
              cuando ya hay proveedor: antes de eso no hay compra de la que
              hablar. */}
          {supplierId && (
            <div className="mt-4">
              <FieldLabel htmlFor={`${uid}-client-note`}>
                Nota{" "}
                <span className="font-normal text-grey-700">· opcional</span>
              </FieldLabel>
              <textarea
                id={`${uid}-client-note`}
                name="clientNote"
                rows={2}
                maxLength={PREALERTA_CLIENT_NOTE_MAX}
                disabled={pending}
                placeholder="Ej.: me dio mejor precio esta vez, pedido urgente, incluye una muestra…"
                className="mt-1.5 w-full px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-y disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
              />
            </div>
          )}

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
              teaser="invite"
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
            <PortalFieldError nivel="formulario">{state.fieldErrors.supplierId}</PortalFieldError>
          )}
          {state.error && (
            <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>
          )}
        </div>

        <div className="lg:sticky lg:top-[88px] flex flex-col gap-3">
          {/* El Norte lo condiciona a `provOk` (app.jsx:3925) y acá se pintaba
              SIEMPRE: sin proveedor mostraba una orden completa y coherente
              —"viene mercancía de mi proveedor mi proveedor"— junto a un botón
              apagado. Es el estado falso que prohíbe SGE-00.07: la pantalla
              afirmaba una orden que no existía. */}
          {supplier && (
            <PurchaseOrderLive
              supplierName={supplier.name}
              addons={addons}
              selected={selected}
              holdCount={holdCount}
              holdTie={holdTie}
            />
          )}

          <button
            type="submit"
            disabled={pending || !supplierId}
            aria-busy={pending}
            aria-describedby={!supplierId ? `${uid}-falta` : undefined}
            className={`btn btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-60 ${
              // `cursor-wait` sólo cuando de verdad se está esperando algo. Con
              // el botón apagado por falta de proveedor decía "el sistema está
              // trabajando" — de ahí salió, textual, el reclamo "puede ser que
              // no esté activo en este momento" (BTN-01 §5).
              pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
            }`}
          >
            {pending ? "Registrando compra…" : "Registrar compra"}
            {!pending && <ArrowIcon size={15} />}
          </button>

          {/* BTN-01 §6: un botón deshabilitado tiene que explicar el motivo, y
              la explicación no puede depender de enfocarlo. El Norte distingue
              DOS estados (`app.jsx:3943`) y acá se había copiado sólo la rama
              `else`; el tercero es propio, porque acá crear un proveedor pide
              un clic extra en "+ Crear «X»" que el Norte no tiene.

              `aria-live` porque el texto cambia sin que se mueva el foco. */}
          {!supplierId && (
            <p
              id={`${uid}-falta`}
              aria-live="polite"
              className="text-[11.5px] text-grey-700 leading-[1.5] text-center m-0"
            >
              {draftSupplier !== null ? (
                <>
                  Te falta un paso: pulsa{" "}
                  <strong className="text-ink">Guardar proveedor</strong> para
                  registrar a{" "}
                  <strong className="text-ink">{draftSupplier}</strong>.
                </>
              ) : (
                "Elige tu proveedor de la lista, o créalo si es nuevo."
              )}
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
