"use client";

/**
 * OfficeDrawer — crear/editar una oficina de la empresa (SDD-0120).
 * País (VE/CN) + nombre + dirección. Soft-delete desde el footer en modo edición.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { deleteOfficeAction, saveOfficeAction } from "../company-actions";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import {
  OFFICE_COUNTRIES,
  officeCountryLabel,
  type CompanyActionState,
  type CompanyOffice,
} from "@/lib/studio/company-types";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const FORM_ID = "office-drawer-form";
const INITIAL: CompanyActionState = {};

export function OfficeDrawer({
  mode,
  office,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  office: CompanyOffice | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [country, setCountry] = useState<string>(office?.country ?? "VE");
  const [name, setName] = useState(office?.name ?? "");
  const [address, setAddress] = useState(office?.address ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [state, formAction, isPending] = useActionState(saveOfficeAction, INITIAL);
  const [delState, delAction, delPending] = useActionState(deleteOfficeAction, INITIAL);

  const handledSave = useRef<CompanyActionState | null>(null);
  const handledDel = useRef<CompanyActionState | null>(null);

  useEffect(() => {
    if (state?.ok && handledSave.current !== state) {
      handledSave.current = state;
      onSaved(mode === "create" ? "Oficina agregada" : "Oficina actualizada");
      onClose();
    }
  }, [state, mode, onSaved, onClose]);

  useEffect(() => {
    if (delState?.ok && handledDel.current !== delState) {
      handledDel.current = delState;
      onSaved("Oficina eliminada");
      onClose();
    }
  }, [delState, onSaved, onClose]);

  const fe = state?.fieldErrors ?? {};
  const canSubmit = !!country && name.trim().length > 0 && address.trim().length > 0;
  const busy = isPending || delPending;

  return (
    <DrawerShell
      title={mode === "create" ? "Nueva oficina" : `Editar ${office?.name ?? "oficina"}`}
      subtitle="Aparece en el bloque de oficinas de la empresa"
      onClose={onClose}
      pending={busy}
      width={560}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        {mode === "edit" && office && <input type="hidden" name="id" value={office.id} />}

        <div>
          <label className="studio-label" htmlFor="of-country">País</label>
          <select
            id="of-country"
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="studio-input"
            style={{ marginTop: 6 }}
          >
            {OFFICE_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {officeCountryLabel(c)} ({c})
              </option>
            ))}
          </select>
          <FieldError msg={fe.country} />
        </div>

        <div>
          <label className="studio-label" htmlFor="of-name">Nombre de la oficina</label>
          <input
            id="of-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="studio-input"
            placeholder="Caracas · HQ"
            style={{ marginTop: 6 }}
          />
          <FieldError msg={fe.name} />
        </div>

        <div>
          <label className="studio-label" htmlFor="of-address">Dirección</label>
          <textarea
            id="of-address"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="studio-input"
            rows={3}
            placeholder="Av. Bolívar Norte, CC Sambil, Local 142"
            style={{ marginTop: 6, resize: "vertical" }}
          />
          <FieldError msg={fe.address} />
        </div>

        {state?.error && <FormError msg={state.error} />}
        {delState?.error && <FormError msg={delState.error} />}
      </form>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        {mode === "edit" && office ? (
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            disabled={busy}
            style={{ color: "var(--danger)" }}
            onClick={() => setConfirmDelete(true)}
          >
            Eliminar
          </button>
        ) : (
          <div />
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="studio-btn studio-btn-primary"
            disabled={busy || !canSubmit}
          >
            {isPending ? "Guardando…" : mode === "create" ? "Agregar oficina" : "Guardar"}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmDelete && !!office}
        danger
        title="¿Eliminar oficina?"
        message={`"${office?.name ?? "Esta oficina"}" dejará de aparecer en los datos de la empresa.`}
        confirmLabel="Eliminar"
        pending={delPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!office) return;
          setConfirmDelete(false);
          const fd = new FormData();
          fd.set("id", office.id);
          delAction(fd);
        }}
      />
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{ font: "600 11px/1.3 var(--f-sans)", color: "var(--danger)", margin: "6px 0 0" }}>{msg}</p>
  );
}

function FormError({ msg }: { msg: string }) {
  return (
    <Aviso tono="error">
      {msg}
    </Aviso>
  );
}
