"use client";

import {
  useActionState,
  useEffect,
  useId,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowIcon,
  CheckIcon,
  ShieldIcon,
  TruckIcon,
} from "@/components/Icon";
import { AlibabaAddressGuide } from "@/components/AlibabaAddressGuide";
import { GuiaAlibabaCard } from "@/components/GuiaAlibabaCard";
import { ChinaSupplierClip } from "@/components/ChinaSupplierClip";
import { NewPurchaseButton } from "../../_components/NewPurchaseButton";
import { FieldLabel } from "../../_components/PortalFormField";
import type { SupplierView } from "@/lib/studio/prealertas/types";
import {
  createSupplierAction,
  updateSupplierAction,
  deleteSupplierAction,
} from "./actions";
import type {
  SupplierActionState,
  DeleteSupplierActionState,
} from "@/lib/studio/prealertas/types";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import { PrealertaServiceGallery } from "../../_components/PrealertaAddons";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

const supplierInitial: SupplierActionState = {};
const deleteSupplierInitial: DeleteSupplierActionState = {};

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
            <strong className="text-wine-text">prealerta</strong>: nos avisas que viene
            mercancía de China para esperarla y procesarla más rápido. Genera el
            código y las etiquetas para tus proveedores, o vuelve a comprarle a uno
            que ya tengas.
          </p>
        </div>
        <NewPurchaseButton href="/portal/compras/nueva" />
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

      {/* ── Dirección de nuestra bodega CN, en el formato que piden
          Alibaba/1688/Taobao: campo por campo, con copia individual y el
          Shipping Mark ya puesto. Reemplaza a la card local que armaba el mismo
          texto con menos campos y una sola copia a granel. ── */}
      {/* El par del momento "estoy comprando en China": qué pongo en el
          formulario de la web de compra, y qué le mando al proveedor por
          WeChat. Van juntos a propósito — separados, el cliente encontraba uno
          sin enterarse del otro (founder 2026-07-28). */}
      <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <AlibabaAddressGuide markbox={markbox} />
        <ChinaSupplierClip markbox={markbox} />
      </div>

      {/* Tercer elemento del mismo momento: el cliente que nunca compró en Alibaba
          necesita el paso a paso completo, no sólo la dirección. Va con su
          Shipping Mark en el querystring (SDD-0099). */}
      <GuiaAlibabaCard markbox={markbox} variante="portal" className="mt-5" />

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
            <SupplierCard key={s.id} supplier={s} />
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
          className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-wine-text hover:underline"
        >
          Ver todas mis compras <ArrowIcon size={14} />
        </Link>
      </div>
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

function SupplierCard({ supplier }: { supplier: SupplierView }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSupplierAction,
    deleteSupplierInitial,
  );

  if (editing) {
    return (
      <EditSupplierForm
        supplier={supplier}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const canDelete = supplier.orderCount === 0;
  const subline = [supplier.city, supplier.contact].filter(Boolean).join(" · ");

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
        {subline && (
          <div className="mt-0.5 text-[12px] text-grey-700 truncate">{subline}</div>
        )}
        {supplier.notes && (
          <div className="mt-0.5 text-[12px] text-grey-500 truncate">
            {supplier.notes}
          </div>
        )}
        <div
          className="mt-1 text-[12px] text-grey-700"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          {supplier.orderCount} compra{supplier.orderCount === 1 ? "" : "s"} ·
          próxima:{" "}
          <span className="text-wine-text font-bold">{supplier.nextCode}</span>
        </div>
        {deleteState.error && (
          <PortalFieldError>{deleteState.error}</PortalFieldError>
        )}
      </div>

      {confirmingDelete ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[12px] text-grey-700">¿Borrar proveedor?</span>
          <form action={deleteAction}>
            <input type="hidden" name="supplierId" value={supplier.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="btn btn-ghost text-wine-text disabled:opacity-60"
            >
              {deletePending ? "Borrando…" : "Sí, borrar"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            disabled={deletePending}
            className="btn btn-ghost disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-ghost"
          >
            Editar
          </button>
          {canDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="btn btn-ghost"
            >
              Borrar
            </button>
          ) : (
            <span
              className="text-[11px] text-grey-500 px-1"
              title="No puedes borrar un proveedor con compras registradas."
            >
              Con compras
            </span>
          )}
          <Link
            href={`/portal/compras/nueva?proveedor=${encodeURIComponent(supplier.id)}`}
            className="btn btn-ghost inline-flex items-center gap-1.5"
          >
            Re-comprar <ArrowIcon size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Edición de un proveedor existente ───────────────────────────
function EditSupplierForm({
  supplier,
  onDone,
  onCancel,
}: {
  supplier: SupplierView;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    updateSupplierAction,
    supplierInitial,
  );
  const uid = useId();

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={action}
      className="card-shadow bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col gap-3"
    >
      <input type="hidden" name="supplierId" value={supplier.id} />

      <FieldLabel htmlFor={`${uid}-name`}>Nombre del proveedor</FieldLabel>
      <input
        id={`${uid}-name`}
        type="text"
        name="name"
        required
        autoFocus
        defaultValue={supplier.name}
        disabled={pending}
        className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      />
      {state.fieldErrors?.name && (
        <PortalFieldError>{state.fieldErrors.name}</PortalFieldError>
      )}

      <FieldLabel htmlFor={`${uid}-wechat`}>WeChat (opcional)</FieldLabel>
      <input
        id={`${uid}-wechat`}
        type="text"
        name="wechat"
        defaultValue={supplier.wechat ?? ""}
        placeholder="WeChat ID o número"
        disabled={pending}
        className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      />

      <FieldLabel htmlFor={`${uid}-contact`}>Contacto</FieldLabel>
      <input
        id={`${uid}-contact`}
        type="text"
        name="contact"
        defaultValue={supplier.contact ?? ""}
        placeholder="Nombre de la persona de contacto"
        disabled={pending}
        className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      />

      <FieldLabel htmlFor={`${uid}-notes`}>Notas</FieldLabel>
      <textarea
        id={`${uid}-notes`}
        name="notes"
        rows={2}
        defaultValue={supplier.notes ?? ""}
        disabled={pending}
        className="px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      />

      {state.error && (
        <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>
      )}

      <div className="flex gap-2.5">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
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
  const uid = useId();

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={action}
      className="card-shadow bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col gap-3"
    >
      <FieldLabel htmlFor={`${uid}-name`}>Nombre del proveedor</FieldLabel>
      <input
        id={`${uid}-name`}
        type="text"
        name="name"
        required
        autoFocus
        placeholder="Ej. Guangzhou Textile Co"
        disabled={pending}
        className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      />
      {state.fieldErrors?.name && (
        <PortalFieldError>{state.fieldErrors.name}</PortalFieldError>
      )}

      <FieldLabel htmlFor={`${uid}-wechat`}>WeChat del proveedor (opcional)</FieldLabel>
      <input
        id={`${uid}-wechat`}
        type="text"
        name="wechat"
        placeholder="WeChat ID o número"
        disabled={pending}
        className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      />

      <FieldLabel htmlFor={`${uid}-contact`}>Contacto</FieldLabel>
      <input
        id={`${uid}-contact`}
        type="text"
        name="contact"
        placeholder="Nombre de la persona de contacto"
        disabled={pending}
        className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      />

      <FieldLabel htmlFor={`${uid}-notes`}>Notas</FieldLabel>
      <textarea
        id={`${uid}-notes`}
        name="notes"
        rows={2}
        disabled={pending}
        className="px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      />

      {state.error && (
        <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>
      )}
      <div className="flex gap-2.5">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
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
