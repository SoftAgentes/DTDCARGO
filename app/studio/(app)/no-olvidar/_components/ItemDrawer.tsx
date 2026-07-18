"use client";

/**
 * <ItemDrawer> — ver / editar / eliminar un item del No-Olvidar (SDD-0025 Fase 3).
 *
 * VER: el plaintext se busca LAZY una sola vez (revealItemAction, memoizado) y
 * cada campo se muestra con <RevealField> (mitigaciones anti-screenshot §4.16).
 * El plaintext vive solo en estado local; nunca en props del server ni storage.
 *
 * EDITAR: metadata siempre; el contenido cifrado se re-cifra solo si marcas
 * «re-cifrar» (updateItemAction re-encripta con un DEK nuevo).
 *
 * Solo tokens var(--*).
 */

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import { RevealField } from "./RevealField";
import {
  copyItemFieldAction,
  revealItemAction,
  softDeleteItemAction,
  updateItemAction,
} from "../actions";
import {
  categoryBadgeTone,
  categoryDefaultFields,
  categoryLabel,
  CATEGORY_PLAINTEXT_FIELDS,
  formatLastAccess,
  type NoOlvidarActionState,
  type NoOlvidarItemMeta,
  type NoOlvidarItemPlaintext,
} from "@/lib/studio/no-olvidar-types";

export interface RevealConfig {
  holdToReveal: boolean;
  autoHideSeconds: number;
  blurOnWindowBlur: boolean;
  forensicWatermark: boolean;
  blockCopyEvent: boolean;
  charByChar: boolean;
  clipboardClearSeconds: number;
}

const FORM_ID = "no-olvidar-edit";

export function ItemDrawer({
  item,
  revealConfig,
  watermarkLabel,
  onClose,
}: {
  item: NoOlvidarItemMeta;
  revealConfig: RevealConfig;
  watermarkLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [deleting, setDeleting] = useState(false);

  // Fetch memoizado del plaintext: una sola llamada al server aunque haya N campos.
  const plaintextPromise = useRef<Promise<NoOlvidarItemPlaintext | null> | null>(null);
  const getPlaintext = useCallback((): Promise<NoOlvidarItemPlaintext | null> => {
    if (!plaintextPromise.current) {
      plaintextPromise.current = revealItemAction(item.id).then((r) =>
        r.ok && r.plaintext ? r.plaintext : null,
      );
    }
    return plaintextPromise.current;
  }, [item.id]);

  const fieldValue = useCallback(
    async (key: string): Promise<string | null> => {
      const p = await getPlaintext();
      if (!p) return null;
      const v = (p as Record<string, unknown>)[key];
      return typeof v === "string" ? v : "";
    },
    [getPlaintext],
  );

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar «${item.name}»? Se manda a la papelera (soft delete).`)) return;
    setDeleting(true);
    const res = await softDeleteItemAction(item.id);
    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      setDeleting(false);
      window.alert(res.error ?? "No se pudo eliminar.");
    }
  }

  const plaintextFields = CATEGORY_PLAINTEXT_FIELDS[item.category];

  return (
    <DrawerShell
      title={item.name}
      subtitle={`${categoryLabel(item.category)} · editado ${formatLastAccess(item.updated_at)}`}
      onClose={onClose}
      pending={deleting}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        {mode === "view" ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Badge tone={categoryBadgeTone(item.category)}>{categoryLabel(item.category)}</Badge>
              {item.favorite && <Badge tone="warning">★ Favorito</Badge>}
            </div>

            {/* Metadata en claro (columnas, no cifradas) */}
            {item.url && <MetaRow label="URL" value={item.url} />}
            {item.username && <MetaRow label="Usuario" value={item.username} />}

            {/* Contenido cifrado — reveal lazy */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ font: "700 11px/1 var(--f-sans)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
                Contenido protegido
              </span>
              {plaintextFields.map((f) => (
                <RevealField
                  key={f.key}
                  label={f.label}
                  onReveal={() => fieldValue(f.key)}
                  onCopyAudit={() => void copyItemFieldAction(item.id, f.key)}
                  watermarkLabel={watermarkLabel}
                  holdToReveal={f.secret ? revealConfig.holdToReveal : false}
                  autoHideSeconds={revealConfig.autoHideSeconds}
                  blurOnWindowBlur={revealConfig.blurOnWindowBlur}
                  forensicWatermark={f.secret ? revealConfig.forensicWatermark : false}
                  blockCopyEvent={f.secret ? revealConfig.blockCopyEvent : false}
                  charByChar={f.secret ? revealConfig.charByChar : false}
                  clipboardClearSeconds={revealConfig.clipboardClearSeconds}
                />
              ))}
            </div>
          </>
        ) : (
          <EditForm item={item} onDone={() => { router.refresh(); onClose(); }} />
        )}
      </div>

      {mode === "view" ? (
        <footer style={footerStyle}>
          <button type="button" onClick={handleDelete} disabled={deleting} style={dangerBtn}>
            <span style={{ display: "inline-flex" }}>{Icon.trash(15)}</span>
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
          <button type="button" onClick={() => setMode("edit")} className="studio-btn studio-btn-primary">
            <span style={{ display: "inline-flex", marginRight: 6 }}>{Icon.edit(15)}</span>
            Editar
          </button>
        </footer>
      ) : (
        <DrawerFooter
          formId={FORM_ID}
          onClose={() => setMode("view")}
          isPending={false}
          canSubmit
          submitLabel="Guardar cambios"
          cancelLabel="Cancelar"
        />
      )}
    </DrawerShell>
  );
}

function EditForm({ item, onDone }: { item: NoOlvidarItemMeta; onDone: () => void }) {
  const [reEncrypt, setReEncrypt] = useState(false);
  const [favorite, setFavorite] = useState(item.favorite);
  const [state, formAction] = useActionState<NoOlvidarActionState, FormData>(updateItemAction, {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const fields = categoryDefaultFields(item.category).filter(
    (f) => f.key !== "url" && f.key !== "username",
  );

  return (
    <form id={FORM_ID} action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="category" value={item.category} />
      <input type="hidden" name="re_encrypt" value={reEncrypt ? "on" : ""} />

      <EditField label="Nombre" name="name" defaultValue={item.name} required />
      <EditField label="URL" name="url" defaultValue={item.url ?? ""} />
      <EditField label="Usuario" name="username" defaultValue={item.username ?? ""} />
      <EditField label="Vista previa de nota" name="notes_preview" defaultValue={item.notes_preview ?? ""} />

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* Controlado + hidden on/off: permite QUITAR el favorito (checkbox
            desmarcado no viaja en FormData → la action lo leería como sin cambio). */}
        <input type="hidden" name="favorite" value={favorite ? "on" : "off"} />
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        <span style={{ font: "500 13px/1 var(--f-sans)", color: "var(--ink)" }}>Favorito</span>
      </label>

      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", paddingTop: 6, borderTop: "1px solid var(--border)" }}>
        <input type="checkbox" checked={reEncrypt} onChange={(e) => setReEncrypt(e.target.checked)} style={{ marginTop: 3 }} />
        <span style={{ font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>
          Re-cifrar el contenido (vuelve a ingresar los campos secretos)
        </span>
      </label>

      {reEncrypt &&
        fields.map((f) => (
          <EditField
            key={f.key}
            label={f.label}
            name={f.key}
            defaultValue=""
            required={f.required}
            type={f.type === "password" ? "password" : "text"}
            textarea={f.type === "textarea"}
            mono={f.type === "password" || f.type === "totp"}
          />
        ))}

      <ErrorAlert state={state} compact />
    </form>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ font: "600 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}>{label}</span>
      <span style={{ font: "400 14px/1.4 var(--f-sans)", color: "var(--ink)", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

function EditField({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  textarea,
  mono,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  mono?: boolean;
}) {
  const shared: React.CSSProperties = {
    padding: "9px 11px",
    borderRadius: "var(--r-md)",
    border: "1px solid var(--border)",
    background: "var(--surface-sel)",
    color: "var(--ink)",
    font: `400 14px/1.4 ${mono ? "var(--font-mono)" : "var(--f-sans)"}`,
  };
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ font: "600 12px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
        {label}
        {required && <span style={{ color: "var(--wine)" }}> *</span>}
      </span>
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} required={required} rows={3} style={{ ...shared, resize: "vertical" }} />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} required={required} autoComplete="off" style={shared} />
      )}
    </label>
  );
}

const footerStyle: React.CSSProperties = {
  padding: "14px 22px",
  borderTop: "1px solid var(--border)",
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  background: "var(--bg-surface)",
  flexShrink: 0,
};

const dangerBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--danger)",
  background: "transparent",
  color: "var(--danger)",
  font: "700 13px/1 var(--f-sans)",
  cursor: "pointer",
};
