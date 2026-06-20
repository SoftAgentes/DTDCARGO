"use client";

/**
 * Drawer de inscripción de un alumno a una cohorte (SDD-0093, Slice B). Nombre
 * obligatorio; cédula, correo y MARKBOX (para enlazar un cliente real del portal)
 * opcionales. El curso lo hereda la inscripción de la cohorte.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Field, FormError } from "@/app/studio/(app)/naviera/_components/SailingDrawer";
import type { EnrollmentInput } from "@/lib/studio/academia/types";
import { createEnrollmentAction } from "../actions";

export function EnrollmentDrawer({
  cohortId,
  cohortName,
  onClose,
}: {
  cohortId: string;
  cohortName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [studentName, setStudentName] = useState("");
  const [studentCi, setStudentCi] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [clientMarkbox, setClientMarkbox] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = studentName.trim().length > 0 && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    const payload: Partial<EnrollmentInput> = {
      cohortId,
      studentName: studentName.trim(),
      studentCi: studentCi.trim() || null,
      studentEmail: studentEmail.trim() || null,
      clientMarkbox: clientMarkbox.trim() || null,
    };
    const r = await createEnrollmentAction(payload);
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    if (r.fieldErrors) {
      setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");
      return;
    }
    toast.success(`${studentName.trim()} inscrito`);
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title="Inscribir alumno"
      subtitle={cohortName}
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="enrollment-form"
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

        <Field label="Nombre del alumno">
          <input
            className="studio-input"
            placeholder="María Fernanda Rodríguez"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            autoFocus
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Documento (cédula)" optional>
            <input
              className="studio-input studio-input-mono"
              placeholder="V-18.452.110"
              value={studentCi}
              onChange={(e) => setStudentCi(e.target.value)}
            />
          </Field>
          <Field label="Correo" optional>
            <input
              className="studio-input"
              type="email"
              placeholder="alumno@correo.com"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Shipping Mark del cliente" optional>
          <input
            className="studio-input studio-input-mono"
            placeholder="DTD-1234 · enlaza al cliente del portal"
            value={clientMarkbox}
            onChange={(e) => setClientMarkbox(e.target.value)}
          />
        </Field>
      </form>

      <DrawerFooter
        formId="enrollment-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Inscribir"
        pendingLabel="Inscribiendo…"
      />
    </DrawerShell>
  );
}
