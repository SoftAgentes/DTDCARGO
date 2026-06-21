"use client";

/**
 * Drawer de alta/edición de un MÓDULO de un curso (SDD-0093, Feature A). Título
 * + orden (sort). El curso se pasa por prop (el módulo siempre vive dentro de un
 * curso). Patrón del Studio: <form id> + submit en el footer.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Field, FormError } from "./Field";
import type { AcademyModule, ModuleInput } from "@/lib/studio/academia/types";
import { createModuleAction, updateModuleAction } from "../actions";

export function ModuleDrawer({
  courseId,
  courseTitle,
  module,
  defaultSort,
  onClose,
}: {
  courseId: string;
  courseTitle: string;
  module?: AcademyModule;
  /** Orden sugerido para un módulo nuevo (último + 1). */
  defaultSort?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!module;

  const [title, setTitle] = useState(module?.title ?? "");
  const [sort, setSort] = useState(
    module?.sort != null ? String(module.sort) : String(defaultSort ?? 0),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = title.trim().length > 0 && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    const payload: Partial<ModuleInput> = {
      courseId,
      title: title.trim(),
      sort: sort.trim() === "" ? 0 : Number(sort),
    };
    const r = editing
      ? await updateModuleAction(module!.id, payload)
      : await createModuleAction(payload);
    setPending(false);
    if (r.fieldErrors) {
      setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");
      return;
    }
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(editing ? "Módulo actualizado" : "Módulo creado");
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={editing ? module!.title : "Nuevo módulo"}
      subtitle={courseTitle}
      onClose={onClose}
      pending={pending}
      width={520}
    >
      <form
        id="module-form"
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
        {error && <FormError message={error} />}

        <Field label="Título del módulo">
          <input
            className="studio-input"
            placeholder="Módulo 1 · Encuentra tu producto"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Orden" optional>
          <input
            className="studio-input studio-input-mono"
            type="number"
            min={0}
            step={1}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ maxWidth: 140 }}
          />
        </Field>
      </form>

      <DrawerFooter
        formId="module-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Crear módulo"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}
