"use client";

/**
 * Drawer de alta/edición de proveedor CN (suppliers_cn) desde el Studio
 * (2026-07-12 — revierte el "cero writes" de SDD-0057 Slice C, pedido
 * explícito del founder).
 *
 * Alta: el operador ELIGE el cliente dueño (ClientCombobox) y, a medida que
 * escribe el nombre, ve los proveedores QUE YA TIENE ESE CLIENTE (barra de
 * búsqueda anti-duplicado) — puede usar uno existente en vez de crear otro.
 * Edición: el cliente queda fijo (no se reasigna un proveedor de dueño).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ClientCombobox } from "@/app/studio/_components/ui/ClientCombobox";
import type { ClientSearchHit } from "@/lib/studio/client-search-action";
import {
  createStudioSupplierAction,
  updateStudioSupplierAction,
} from "../actions";
import type { SupplierRow } from "./ProveedoresClient";

export function SupplierDrawer({
  supplier,
  allSuppliers,
  onClose,
}: {
  /** Presente = editar; ausente = alta nueva. */
  supplier?: SupplierRow;
  /** Todos los proveedores del tenant ya cargados (para la búsqueda anti-duplicado). */
  allSuppliers: SupplierRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!supplier;

  const [clientMarkbox, setClientMarkbox] = useState(
    supplier?.client_markbox ?? "",
  );
  const [clientLabel, setClientLabel] = useState(
    supplier?.client_markbox ?? "",
  );
  const [name, setName] = useState(supplier?.name ?? "");
  const [city, setCity] = useState(supplier?.city ?? "");
  const [wechat, setWechat] = useState(supplier?.wechat ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Proveedores que YA tiene este cliente (dedup mientras se escribe el nombre).
  const similar = useMemo(() => {
    if (editing || !clientMarkbox || name.trim().length < 2) return [];
    const q = name.trim().toLowerCase();
    return allSuppliers
      .filter(
        (s) =>
          s.client_markbox === clientMarkbox &&
          s.name.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [allSuppliers, clientMarkbox, name, editing]);

  const canSubmit = name.trim().length > 0 && (editing || clientMarkbox !== "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);
    setPending(true);

    const payload = {
      name: name.trim(),
      city: city.trim() || null,
      wechat: wechat.trim() || null,
      contact: contact.trim() || null,
      notes: notes.trim() || null,
    };

    const r = editing
      ? await updateStudioSupplierAction(supplier!.id, payload)
      : await createStudioSupplierAction({ clientMarkbox, ...payload });

    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(editing ? "Proveedor actualizado" : "Proveedor creado");
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={editing ? `#${supplier!.supplier_seq} · ${supplier!.name}` : "Nuevo proveedor"}
      subtitle={
        editing
          ? `Cliente ${supplier!.client_markbox}`
          : "A nombre de un cliente — igual que si lo registrara desde su portal"
      }
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="studio-supplier-form"
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {error && (
          <Aviso tono="error" compacto>
            {error}
          </Aviso>
        )}

        {!editing && (
          <div>
            <label className="studio-label" htmlFor="ssd-client">
              Cliente dueño del proveedor
            </label>
            <ClientCombobox
              id="ssd-client"
              value={clientLabel}
              onManualChange={(text) => {
                setClientLabel(text);
                setClientMarkbox("");
              }}
              onSelect={(hit: ClientSearchHit) => {
                setClientLabel(`${hit.markbox} · ${hit.name}`);
                setClientMarkbox(hit.markbox);
              }}
              placeholder="Cédula, nombre o Shipping Mark del cliente…"
              required
            />
            {clientLabel && !clientMarkbox && (
              <p
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--danger)",
                  margin: "5px 0 0",
                }}
              >
                Elige un cliente de la lista — el proveedor necesita un dueño real.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="studio-label" htmlFor="ssd-name">
            Nombre del proveedor
          </label>
          <input
            id="ssd-name"
            type="text"
            className="studio-input"
            placeholder="Ej. Guangzhou Textile Co"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {similar.length > 0 && <ProveedoresParecidos similar={similar} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="ssd-city">
              Ciudad <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
            </label>
            <input
              id="ssd-city"
              type="text"
              className="studio-input"
              placeholder="Ej. Yiwu"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="ssd-wechat">
              WeChat <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
            </label>
            <input
              id="ssd-wechat"
              type="text"
              className="studio-input"
              placeholder="WeChat ID o número"
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="ssd-contact">
            Otro contacto{" "}
            <span style={{ color: "var(--ink-soft)" }}>
              (teléfono, Alibaba, email — opcional)
            </span>
          </label>
          <input
            id="ssd-contact"
            type="text"
            className="studio-input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="ssd-notes">
            Notas internas{" "}
            <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <textarea
            id="ssd-notes"
            className="studio-input"
            rows={2}
            style={{ resize: "vertical", height: "auto", paddingTop: 8 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>

      <DrawerFooter
        formId="studio-supplier-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Crear proveedor"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

/**
 * Proveedores que ya tiene el cliente, mientras se escribe el nombre.
 * La franja lleva solo el título fijo: es región viva (`role="status"`) y la
 * lista cambia con cada tecla. La lista va fuera, como texto, para que el
 * lector no la relea entera en cada pulsación (revisión de la #547).
 */
export function ProveedoresParecidos({
  similar,
}: {
  similar: Pick<SupplierRow, "id" | "supplier_seq" | "name" | "wechat">[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      <Aviso tono="atencion" compacto>
        Este cliente ya tiene proveedores parecidos — revisa antes de crear
        otro:
      </Aviso>
      <ul
        style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}
      >
        {similar.map((s) => (
          <li
            key={s.id}
            style={{
              font: "500 12px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            #{s.supplier_seq} · {s.name}
            {s.wechat ? ` · WeChat ${s.wechat}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
