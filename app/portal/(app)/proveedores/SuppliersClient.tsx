"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowIcon,
  CheckIcon,
  DocIcon,
  ShieldIcon,
  TruckIcon,
} from "@/components/Icon";
import { CONTACT } from "@/lib/design-tokens";
import { NewPurchaseButton } from "../../_components/NewPurchaseButton";
import { ShareProviderButton } from "../../_components/ShareProviderButton";
import type { SupplierView } from "@/lib/studio/prealertas/types";
import {
  createSupplierAction,
  createPrealertaAction,
} from "./actions";
import type {
  SupplierActionState,
  PrealertaActionState,
} from "@/lib/studio/prealertas/types";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import {
  PrealertaAddonPicker,
  PrealertaServiceGallery,
} from "../../_components/PrealertaAddons";

const supplierInitial: SupplierActionState = {};
const prealertaInitial: PrealertaActionState = {};

/**
 * "Tus proveedores" (SDD-0057 · Slice B). Piel real del portal (paper/wine +
 * clases del sitio público), sólo tokens `var(--*)`, es-VE / voseo. El Norte
 * (PortalSuppliers) es referencia de LAYOUT/flujo, no de tipografía.
 *
 * Estado local: alta inline de proveedor + modal "Nueva compra" (proveedor
 * existente o nuevo → descripción → tracking → cajas → valor). Las mutaciones van
 * por server actions con `useActionState` (anti doble-submit con `pending`).
 */
export function SuppliersClient({
  suppliers,
  markbox,
  addons,
}: {
  suppliers: SupplierView[];
  markbox: string;
  addons: PrealertaAddon[];
}) {
  // Modal "Nueva compra" — null cerrado; objeto = proveedor preseleccionado (o vacío).
  const [purchaseFor, setPurchaseFor] = useState<SupplierView | null | "new">(
    null,
  );
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {/* ── Header + Nueva compra ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="eyebrow">Tu cuenta</span>
          <h1
            className="h-display mt-3"
            style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}
          >
            Tus proveedores.
          </h1>
          <p className="lead mt-3 max-w-[64ch]">
            Cada <strong className="text-ink">compra</strong> es una{" "}
            <strong className="text-wine">prealerta</strong>: nos avisas que viene
            mercancía de China para esperarla y procesarla más rápido. Genera el
            código y las etiquetas para tus proveedores, o vuelve a comprarle a uno
            que ya tengas.
          </p>
        </div>
        <NewPurchaseButton onClick={() => setPurchaseFor("new")} />
      </div>

      {/* ── Por qué registrar importa ── */}
      <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-7">
        <div className="text-[15px] font-bold text-ink">
          Por qué registrar a tu proveedor importa
        </div>
        <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55] max-w-[70ch]">
          En comercio internacional, cómo gestionas tu información define qué tan
          rápido y seguro llega tu mercancía.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <WhyItem
            icon={<TruckIcon size={18} />}
            title="Rapidez"
            copy="Tus productos llegan a tiempo: la caja entra identificada y no espera en cajas huérfanas."
          />
          <WhyItem
            icon={<ShieldIcon size={18} />}
            title="Control total"
            copy="Al llegar el envío sabemos automáticamente quién es el proveedor y todos los detalles, vía el código."
          />
        </div>
      </div>

      {/* ── Mensaje clave ── */}
      <div
        className="mt-5 rounded-[12px] border-l-[3px] px-4 py-3.5 flex items-start gap-3"
        style={{
          background: "var(--color-paper)",
          borderColor: "var(--color-status-success)",
        }}
      >
        <span
          className="w-5 h-5 rounded-full grid place-items-center flex-shrink-0 mt-0.5"
          style={{ background: "var(--color-status-success)", color: "#fff" }}
        >
          <CheckIcon size={13} />
        </span>
        <p className="text-[13px] text-grey-700 leading-[1.5]">
          Copia el código y envíaselo SOLO al proveedor — a nosotros nos llega
          automático al registrarlo.
        </p>
      </div>

      {/* ── Dirección de nuestra bodega CN para tus proveedores (copy-paste) ── */}
      <WarehouseAddressCard markbox={markbox} />

      {/* ── Lista de proveedores ── */}
      {suppliers.length === 0 ? (
        <div className="mt-6 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no registraste proveedores.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
            Agrega tu primer proveedor chino para generar su código y las
            etiquetas que va a pegar en cada caja.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {suppliers.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onRebuy={() => setPurchaseFor(s)}
            />
          ))}
        </div>
      )}

      {/* ── Agregar proveedor nuevo ── */}
      <div className="mt-5">
        {adding ? (
          <AddSupplierForm
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn btn-ghost inline-flex items-center gap-2"
          >
            + Agregar proveedor nuevo
          </button>
        )}
      </div>

      {/* ── Galería de servicios + video-ayuda (Capa 2 · SDD-0098) ── */}
      <PrealertaServiceGallery addons={addons} />

      {/* ── Link a Mis compras ── */}
      <div className="mt-8">
        <Link
          href="/portal/compras"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-wine hover:underline"
        >
          Ver todas mis compras <ArrowIcon size={14} />
        </Link>
      </div>

      {/* ── Modal "Nueva compra" ── */}
      {purchaseFor !== null && (
        <NewPurchaseModal
          suppliers={suppliers}
          addons={addons}
          preselected={purchaseFor === "new" ? null : purchaseFor}
          onClose={() => setPurchaseFor(null)}
        />
      )}
    </div>
  );
}

// ── Dirección de la bodega en China (copy-paste, con el MARKBOX del cliente) ──
function WarehouseAddressCard({ markbox }: { markbox: string }) {
  const [copied, setCopied] = useState(false);
  const cn = CONTACT.cn;
  // El MARKBOX va en el nombre → así la bodega identifica de quién es la caja.
  const text = [
    `收货人 / Nombre: DTD Cargo - ${markbox}`,
    `电话 / Teléfono: ${cn.phone}`,
    `地址 / Dirección: 浙江省${cn.addressCjk}`,
    `邮编 / Código postal: ${cn.postalCode}`,
    `仓库联系人: ${cn.contactPersonCjk}`,
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard no disponible (contexto no seguro): el texto igual está visible
      // para copiar a mano.
    }
  }

  return (
    <div className="mt-5 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-7">
      <div className="text-[15px] font-bold text-ink">
        Dirección de nuestra bodega en China
      </div>
      <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55] max-w-[70ch]">
        Dásela a tu proveedor — o cárgala en Alibaba como dirección de recepción —
        para que tu mercancía llegue a nuestra bodega en Yiwu. Tu Shipping Mark ya va en
        el nombre: es lo que nos deja saber que la caja es tuya.
      </p>
      <pre
        className="mt-4 rounded-[12px] bg-grey-100 px-4 py-3.5 text-[12.5px] text-ink leading-[1.7] whitespace-pre-wrap break-words"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {text}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="btn btn-primary mt-3 inline-flex items-center gap-2"
      >
        {copied ? "¡Copiado!" : "Copiar dirección"}
        {copied && <CheckIcon size={15} />}
      </button>
    </div>
  );
}

function WhyItem({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        className="w-9 h-9 rounded-[10px] grid place-items-center flex-shrink-0"
        style={{ background: "var(--color-paper)", color: "var(--color-wine)" }}
      >
        {icon}
      </span>
      <div>
        <div className="text-[13.5px] font-bold text-ink">{title}</div>
        <p className="mt-0.5 text-[12.5px] text-grey-700 leading-[1.5]">{copy}</p>
      </div>
    </div>
  );
}

function SupplierCard({
  supplier,
  onRebuy,
}: {
  supplier: SupplierView;
  onRebuy: () => void;
}) {
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <span
        className="w-10 h-10 rounded-[10px] grid place-items-center flex-shrink-0 text-[14px] font-bold"
        style={{
          background: "color-mix(in srgb, var(--color-wine) 14%, var(--color-white))",
          color: "var(--color-wine)",
          fontFamily: "var(--font-archivo-black)",
        }}
      >
        #{supplier.supplierSeq}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-bold text-ink truncate">
          {supplier.name}
        </div>
        <div
          className="mt-1 text-[12px] text-grey-700"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          {supplier.orderCount} compra{supplier.orderCount === 1 ? "" : "s"} ·
          próxima:{" "}
          <span className="text-wine font-bold">{supplier.nextCode}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRebuy}
        className="btn btn-ghost inline-flex items-center gap-1.5 flex-shrink-0"
      >
        Re-comprar <ArrowIcon size={14} />
      </button>
    </div>
  );
}

// ── Alta inline de proveedor ────────────────────────────────────
function AddSupplierForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    createSupplierAction,
    supplierInitial,
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={action}
      className="card-shadow bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col gap-3"
    >
      <FieldLabel>Nombre del proveedor</FieldLabel>
      <input
        type="text"
        name="name"
        required
        autoFocus
        placeholder="Ej. Guangzhou Textile Co"
        disabled={pending}
        className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      />
      {state.fieldErrors?.name && (
        <p className="text-[12px] text-wine leading-[1.4]">
          {state.fieldErrors.name}
        </p>
      )}
      {state.error && (
        <p className="text-[12.5px] text-wine leading-[1.4]">{state.error}</p>
      )}
      <div className="flex gap-2.5">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Creando…" : "Crear y generar código"}
          {!pending && <CheckIcon size={15} />}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="btn btn-ghost disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Modal "Nueva compra" ────────────────────────────────────────
function NewPurchaseModal({
  suppliers,
  addons,
  preselected,
  onClose,
}: {
  suppliers: SupplierView[];
  addons: PrealertaAddon[];
  preselected: SupplierView | null;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(
    createPrealertaAction,
    prealertaInitial,
  );
  // "new" = proveedor a crear inline; o un id de proveedor existente.
  const [mode, setMode] = useState<"existing" | "new">(
    suppliers.length === 0 ? "new" : "existing",
  );
  const [supplierId, setSupplierId] = useState<string>(
    preselected?.id ?? suppliers[0]?.id ?? "",
  );
  const [newSupplierState, newSupplierAction, newSupplierPending] =
    useActionState(createSupplierAction, supplierInitial);
  const newFormRef = useRef<HTMLFormElement>(null);

  // Si el alta inline del proveedor (dentro del modal) termina OK, conmutamos a
  // "existing" — la página revalidó, pero el id nuevo lo conocemos por el state.
  useEffect(() => {
    if (newSupplierState.ok && newSupplierState.supplierId) {
      setSupplierId(newSupplierState.supplierId);
      setMode("existing");
    }
  }, [newSupplierState.ok, newSupplierState.supplierId]);

  const done = !!state.ok && !!state.prealertaCode;
  const selectedWechat =
    suppliers.find((s) => s.id === supplierId)?.wechat ?? "";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(11, 20, 40, 0.55)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] max-h-[88vh] overflow-auto bg-white rounded-[18px] card-shadow"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-grey-200">
          <div>
            <div className="eyebrow">
              Nueva compra
              <span
                className="normal-case tracking-normal text-grey-500"
                style={{
                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                  fontSize: 10,
                }}
              >
                · prealerta
              </span>
            </div>
            <div className="mt-1 text-[18px] font-bold text-ink">
              {done ? "Compra registrada" : "Registra tu compra"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-grey-500 hover:text-ink text-[22px] leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <PurchaseDone
              code={state.prealertaCode!}
              shareToken={state.shareToken}
              onClose={onClose}
            />
          ) : (
            <>
              {/* Selector de proveedor */}
              <FieldLabel>Proveedor</FieldLabel>
              {suppliers.length > 0 && (
                <div className="mt-1.5 flex gap-2 flex-wrap">
                  <ModeChip
                    active={mode === "existing"}
                    onClick={() => setMode("existing")}
                    label="Uno existente"
                  />
                  <ModeChip
                    active={mode === "new"}
                    onClick={() => setMode("new")}
                    label="Agregar nuevo"
                  />
                </div>
              )}

              {mode === "existing" && suppliers.length > 0 ? (
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="mt-2 w-full h-12 px-3 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.supplierSeq} · {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                // Alta inline del proveedor (form propio, action propia).
                <form
                  ref={newFormRef}
                  action={newSupplierAction}
                  className="mt-2 flex flex-col gap-2"
                >
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Nombre del proveedor nuevo"
                    disabled={newSupplierPending}
                    className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
                  />
                  {newSupplierState.fieldErrors?.name && (
                    <p className="text-[12px] text-wine">
                      {newSupplierState.fieldErrors.name}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={newSupplierPending}
                    className="btn btn-ghost self-start inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {newSupplierPending ? "Creando…" : "Crear proveedor"}
                    {!newSupplierPending && <CheckIcon size={14} />}
                  </button>
                </form>
              )}

              {/* Form de la compra */}
              <form action={action} className="mt-5 flex flex-col gap-4">
                <input type="hidden" name="supplierId" value={supplierId} />

                {/* WeChat del proveedor: ID/número O captura del contacto */}
                <div>
                  <FieldLabel>WeChat del proveedor</FieldLabel>
                  <input
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
                  <FieldLabel>Descripción de la compra</FieldLabel>
                  <textarea
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
                    <FieldLabel>Cajas</FieldLabel>
                    <input
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
                      <p className="mt-1 text-[12px] text-wine">
                        {state.fieldErrors.boxes}
                      </p>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Valor estimado USD (opcional)</FieldLabel>
                    <input
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
                  <FieldLabel>Tracking China (opcional)</FieldLabel>
                  <input
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

                {/* Servicios sobre la compra (add-ons · SDD-0098) */}
                <PrealertaAddonPicker addons={addons} />

                {state.fieldErrors?.supplierId && (
                  <p className="text-[12.5px] text-wine">
                    {state.fieldErrors.supplierId}
                  </p>
                )}
                {state.error && (
                  <p className="text-[12.5px] text-wine">{state.error}</p>
                )}

                <button
                  type="submit"
                  disabled={pending || !supplierId}
                  className="btn btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                >
                  {pending ? "Registrando compra…" : "Registrar compra"}
                  {!pending && <ArrowIcon size={15} />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PurchaseDone({
  code,
  shareToken,
  onClose,
}: {
  code: string;
  shareToken?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div
        className="w-14 h-14 rounded-full grid place-items-center"
        style={{ background: "var(--color-status-success)", color: "#fff" }}
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
        <button type="button" onClick={onClose} className="btn btn-ghost">
          Listo
        </button>
      </div>
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="text-[12.5px] font-semibold rounded-full px-3 py-1.5 border transition-colors"
      style={{
        borderColor: active ? "var(--color-wine)" : "var(--color-grey-200)",
        background: active ? "var(--color-paper)" : "var(--color-white)",
        color: active ? "var(--color-wine)" : "var(--color-grey-700)",
      }}
    >
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
      {children}
    </span>
  );
}

/**
 * Campo de archivo sobrio (label estilizado + input oculto). Muestra el/los
 * nombre(s) elegido(s) y vira a verde cuando hay selección. El `<input>` va con
 * su `name` dentro del `<form action={...}>` → el archivo viaja en el FormData al
 * server action (subida server-side). `multiple` para las fotos.
 */
function FileField({
  name,
  label,
  accept,
  multiple,
  disabled,
}: {
  name: string;
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [names, setNames] = useState<string[]>([]);
  const has = names.length > 0;
  return (
    <div>
      <label
        htmlFor={id}
        className={`flex items-center gap-2.5 px-3.5 py-3 min-h-[44px] rounded-[10px] border text-[13px] transition-colors peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-ink)] ${
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        }`}
        style={{
          borderColor: has
            ? "var(--color-status-success)"
            : "var(--color-grey-200)",
          background: has ? "var(--color-paper)" : "var(--color-white)",
        }}
      >
        <span
          className="flex-shrink-0"
          style={{
            color: has ? "var(--color-status-success)" : "var(--color-grey-500)",
          }}
        >
          {has ? <CheckIcon size={15} /> : <DocIcon size={15} />}
        </span>
        <span className="min-w-0 truncate font-medium text-ink">
          {has
            ? names.length > 2
              ? `${names.length} archivos`
              : names.join(", ")
            : label}
        </span>
        <span className="ml-auto flex-shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-grey-500">
          {has ? "Cambiar" : "Subir"}
        </span>
      </label>
      <input
        id={id}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="peer sr-only"
        onChange={(e) => {
          const fs = e.target.files;
          setNames(fs ? Array.from(fs).map((f) => f.name) : []);
        }}
      />
    </div>
  );
}
