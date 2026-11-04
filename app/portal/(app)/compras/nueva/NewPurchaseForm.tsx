"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowIcon, CheckIcon } from "@/components/Icon";
import { ShareProviderButton } from "../../../_components/ShareProviderButton";
import {
  PrealertaAddonPicker,
  ShippingModeNotice,
} from "../../../_components/PrealertaAddons";
import { FieldLabel, FileField } from "../../../_components/PortalFormField";
import { SupplierPicker } from "./SupplierPicker";
import type { SupplierView } from "@/lib/studio/prealertas/types";
import type { PrealertaActionState } from "@/lib/studio/prealertas/types";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import { createPrealertaAction } from "../../proveedores/actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";
import { useActionKeepingDraft } from "@/lib/shared/use-action-keeping-draft";

const prealertaInitial: PrealertaActionState = {};

/**
 * Form de "Nueva compra" (SDD-0057), pantalla completa (Norte
 * `PortalNuevaCompra`). Antes vivía como modal (`NewPurchaseModal`, borrado):
 * mismas server actions y misma lógica, sólo cambió el shell — card embebida
 * en la página en vez de overlay centrado, coherente con el resto del portal
 * que ya migró a rutas dedicadas (`/portal/cotizaciones/nueva`).
 */
export function NewPurchaseForm({
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

  const done = !!state.ok && !!state.prealertaCode;
  const selectedWechat =
    suppliers.find((s) => s.id === supplierId)?.wechat ?? "";

  if (done) {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
        <PurchaseDone code={state.prealertaCode!} shareToken={state.shareToken} />
      </div>
    );
  }

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
      {/* Selector de proveedor — combobox único (Norte). Vive en
          `SupplierPicker` porque el asistente de 3 pasos usa el mismo. */}
      <SupplierPicker
        suppliers={suppliers}
        preselected={preselected}
        supplierId={supplierId}
        onSelect={setSupplierId}
      />

      {/* Form de la compra */}
      <form {...formProps} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="supplierId" value={supplierId} />

        {/* WeChat del proveedor: ID/número O captura del contacto */}
        <div>
          <FieldLabel htmlFor={`${uid}-supplier-wechat`}>WeChat del proveedor</FieldLabel>
          <input
            id={`${uid}-supplier-wechat`}
            type="text"
            name="supplierWechat"
            key={supplierId}
            defaultValue={selectedWechat}
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

        <div>
          <FieldLabel htmlFor={`${uid}-description`}>Descripción de la compra</FieldLabel>
          <textarea
            id={`${uid}-description`}
            name="description"
            required
            rows={2}
            placeholder="Ej. 3 cajas de zapatos deportivos"
            disabled={pending}
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
          />
          {state.fieldErrors?.description && (
            <PortalFieldError>{state.fieldErrors.description}</PortalFieldError>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor={`${uid}-boxes`}>Cajas</FieldLabel>
            <input
              id={`${uid}-boxes`}
              type="number"
              name="boxes"
              min={1}
              step={1}
              defaultValue={1}
              required
              disabled={pending}
              className="mt-1.5 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            />
            {state.fieldErrors?.boxes && (
              <PortalFieldError>{state.fieldErrors.boxes}</PortalFieldError>
            )}
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-est-value`}>Valor estimado USD (opcional)</FieldLabel>
            <input
              id={`${uid}-est-value`}
              type="number"
              name="estValueUsd"
              min={0}
              step="0.01"
              placeholder="—"
              disabled={pending}
              className="mt-1.5 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            />
            {state.fieldErrors?.estValueUsd && (
              <PortalFieldError>{state.fieldErrors.estValueUsd}</PortalFieldError>
            )}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor={`${uid}-tracking`}>Tracking China (opcional)</FieldLabel>
          <input
            id={`${uid}-tracking`}
            type="text"
            name="trackingCn"
            placeholder="Ej. SF1234567890"
            disabled={pending}
            className="mt-1.5 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          />
        </div>

        {/* Adjuntos opcionales de la compra */}
        <div className="rounded-[12px] border border-grey-200 p-4">
          <FieldLabel>Adjuntos (opcional)</FieldLabel>
          <p className="mt-1.5 text-[11.5px] text-grey-700 leading-[1.45]">
            No son obligatorios, pero si los subes nos ayudas a saber qué
            traes y cuánto vale, procesamos tu compra más rápido y te quedan
            de recordatorio en tu portal.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <FileField
              name="doc_packing"
              label="Packing list"
              accept="image/*,application/pdf"
              disabled={pending}
            />
            <FileField
              name="doc_factura"
              label="Factura del proveedor"
              accept="image/*,application/pdf"
              disabled={pending}
            />
            <FileField
              name="doc_fotos"
              label="Fotos del producto"
              accept="image/*"
              multiple
              disabled={pending}
            />
          </div>
        </div>

        {/* Modalidad de envío (marítimo activo · aéreo próximamente) */}
        <ShippingModeNotice />

        {/* Servicios sobre la compra (add-ons · SDD-0098) */}
        <PrealertaAddonPicker addons={addons} />

        {state.fieldErrors?.supplierId && (
          <PortalFieldError nivel="formulario">{state.fieldErrors.supplierId}</PortalFieldError>
        )}
        {state.error && <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>}

        <button
          type="submit"
          disabled={pending || !supplierId}
          aria-busy={pending}
          className="btn btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Registrando compra…" : "Registrar compra"}
          {!pending && <ArrowIcon size={15} />}
        </button>
      </form>
    </div>
  );
}

/**
 * Pantalla de éxito del formulario largo: código, link para el proveedor y
 * etiquetas. El asistente de 3 pasos (SDD-0173) no la usa — allá el cierre son
 * los pasos 2 y 3, que hacen lo mismo con más contexto.
 */
function PurchaseDone({
  code,
  shareToken,
}: {
  code: string;
  shareToken?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div
        className="w-14 h-14 rounded-full grid place-items-center"
        style={{ background: "var(--color-status-success)", color: "var(--color-on-accent)" }}
      >
        <CheckIcon size={28} />
      </div>
      <div>
        <div className="text-[16px] font-bold text-ink">
          Tu compra quedó registrada.
        </div>
        <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.5] max-w-[42ch]">
          Conserva el código de tu compra para consultar su estado y sus etiquetas.
        </p>
      </div>

      <div className="w-full rounded-[14px] px-6 py-5 bg-white border border-grey-200">
        <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-grey-500">
          Código de la compra · prealerta
        </div>
        <div
          className="mt-2 text-[28px] leading-none text-ink"
          style={{
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            letterSpacing: "-0.01em",
          }}
        >
          {code}
        </div>
      </div>

      {shareToken ? (
        <div className="w-full text-left">
          <ShareProviderButton token={shareToken} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
        <Link
          href={`/portal/compras/${encodeURIComponent(code)}/etiquetas`}
          className="btn btn-ghost inline-flex items-center justify-center gap-2"
        >
          Ver mis etiquetas <ArrowIcon size={15} />
        </Link>
        <Link href="/portal/compras" className="btn btn-ghost inline-flex items-center justify-center">
          Ver mis compras
        </Link>
      </div>
    </div>
  );
}
