"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowIcon, CheckIcon } from "@/components/Icon";
import { ShareProviderButton } from "../../../_components/ShareProviderButton";
import {
  PrealertaAddonPicker,
  ShippingModeNotice,
} from "../../../_components/PrealertaAddons";
import { FieldLabel, FileField } from "../../../_components/PortalFormField";
import type { SupplierView } from "@/lib/studio/prealertas/types";
import type {
  SupplierActionState,
  PrealertaActionState,
} from "@/lib/studio/prealertas/types";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import { createSupplierAction, createPrealertaAction } from "../../proveedores/actions";

const supplierInitial: SupplierActionState = {};
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
  const [state, action, pending] = useActionState(
    createPrealertaAction,
    prealertaInitial,
  );
  const uid = useId();
  // Combobox de proveedor (Norte: un solo campo — escribís, filtra por nombre;
  // si no hay match exacto aparece "Crear «X»" dentro del propio dropdown, sin
  // toggles aparte de "existente"/"nuevo").
  const [supplierId, setSupplierId] = useState<string>(preselected?.id ?? "");
  const [newSupplierName, setNewSupplierName] = useState<string | null>(null);
  const [supplierQuery, setSupplierQuery] = useState(preselected?.name ?? "");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [newSupplierState, newSupplierAction, newSupplierPending] =
    useActionState(createSupplierAction, supplierInitial);
  const newFormRef = useRef<HTMLFormElement>(null);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierQuery]);

  // Sin match exacto por nombre → el dropdown ofrece "Crear «X»".
  const hasExactMatch = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return true;
    return suppliers.some((s) => s.name.toLowerCase() === q);
  }, [suppliers, supplierQuery]);

  // Si el alta inline del proveedor nuevo (dentro del combobox) termina OK, lo
  // dejamos elegido — la página revalidó, pero el id nuevo lo conocemos por el state.
  useEffect(() => {
    if (newSupplierState.ok && newSupplierState.supplierId) {
      setSupplierId(newSupplierState.supplierId);
      setNewSupplierName(null);
    }
  }, [newSupplierState.ok, newSupplierState.supplierId]);

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
      {/* Selector de proveedor — combobox único (Norte): escribís,
          filtra; si no hay match exacto, "Crear «X»" vive DENTRO del
          dropdown (no hay toggle aparte de "existente"/"nuevo"). */}
      <FieldLabel>Proveedor</FieldLabel>
      <div className="relative mt-1.5">
        <input
          type="text"
          value={supplierQuery}
          onChange={(e) => {
            setSupplierQuery(e.target.value);
            setSupplierId("");
            setNewSupplierName(null);
            setSupplierOpen(true);
          }}
          onFocus={() => setSupplierOpen(true)}
          onBlur={() => setTimeout(() => setSupplierOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (filteredSuppliers.length === 1 && supplierQuery.trim()) {
              const s = filteredSuppliers[0];
              setSupplierId(s.id);
              setNewSupplierName(null);
              setSupplierQuery(s.name);
              setSupplierOpen(false);
            } else if (!hasExactMatch && supplierQuery.trim()) {
              setNewSupplierName(supplierQuery.trim());
              setSupplierId("");
              setSupplierOpen(false);
            }
          }}
          placeholder="Escribe para buscar tu proveedor…"
          aria-label="Buscar o crear proveedor"
          className="w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        />
        {supplierOpen && (supplierQuery.trim() !== "" || filteredSuppliers.length > 0) && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-[240px] overflow-y-auto rounded-[10px] border border-grey-200 bg-white card-shadow">
            {filteredSuppliers.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSupplierId(s.id);
                  setNewSupplierName(null);
                  setSupplierQuery(s.name);
                  setSupplierOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 text-[14px] text-ink border-b border-grey-100 last:border-b-0 hover:bg-grey-100"
              >
                <span className="font-bold">#{s.supplierSeq}</span> {s.name}
              </button>
            ))}
            {supplierQuery.trim() !== "" && !hasExactMatch && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setNewSupplierName(supplierQuery.trim());
                  setSupplierId("");
                  setSupplierOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13.5px] font-bold text-wine"
                style={{ background: "var(--color-paper)" }}
              >
                + Crear &ldquo;{supplierQuery.trim()}&rdquo;
              </button>
            )}
            {filteredSuppliers.length === 0 && supplierQuery.trim() === "" && (
              <p className="px-3.5 py-2.5 text-[13px] text-grey-700">
                Escribe el nombre de tu proveedor.
              </p>
            )}
          </div>
        )}
      </div>

      {newSupplierName === null && supplierId && (
        <p
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold"
          style={{ color: "var(--color-status-success)" }}
        >
          <CheckIcon size={13} /> Proveedor listo para esta compra.
        </p>
      )}

      {newSupplierName !== null && (
        <form
          ref={newFormRef}
          action={newSupplierAction}
          className="mt-3 rounded-[12px] p-4 border"
          style={{ background: "var(--color-paper)", borderColor: "var(--color-wine)" }}
        >
          <input type="hidden" name="name" value={newSupplierName} />
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-wine">
            Datos del proveedor nuevo
          </p>
          <p className="mt-1.5 text-[13px] font-semibold text-ink">
            + Se creará &ldquo;{newSupplierName}&rdquo;
          </p>
          {newSupplierState.fieldErrors?.name && (
            <p className="mt-1 text-[12px] text-wine">
              {newSupplierState.fieldErrors.name}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={newSupplierPending}
              className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {newSupplierPending ? "Guardando…" : "Guardar proveedor"}
              {!newSupplierPending && <CheckIcon size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewSupplierName(null);
                setSupplierOpen(true);
              }}
              disabled={newSupplierPending}
              className="btn btn-ghost disabled:opacity-60"
            >
              Cambiar
            </button>
          </div>
        </form>
      )}

      {/* Form de la compra */}
      <form action={action} className="mt-5 flex flex-col gap-4">
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
            <p className="mt-1 text-[12px] text-wine">
              {state.fieldErrors.description}
            </p>
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
              <p className="mt-1 text-[12px] text-wine">{state.fieldErrors.boxes}</p>
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
              <p className="mt-1 text-[12px] text-wine">
                {state.fieldErrors.estValueUsd}
              </p>
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
          <p className="text-[12.5px] text-wine">{state.fieldErrors.supplierId}</p>
        )}
        {state.error && <p className="text-[12.5px] text-wine">{state.error}</p>}

        <button
          type="submit"
          disabled={pending || !supplierId}
          className="btn btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Registrando compra…" : "Registrar compra"}
          {!pending && <ArrowIcon size={15} />}
        </button>
      </form>
    </div>
  );
}

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
          Compártele el link a tu proveedor: trae la dirección de la bodega y las
          etiquetas, las baja él directo. No tienes que descargar ni reenviar nada.
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
          <div className="text-[12px] font-bold text-ink mb-2">
            Compartir con tu proveedor
          </div>
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
