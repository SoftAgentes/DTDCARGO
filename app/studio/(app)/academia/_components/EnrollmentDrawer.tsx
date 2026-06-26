"use client";

/**
 * Drawer de inscripción de un alumno a una cohorte (SDD-0093, Slice B · SDD-0107).
 * Nombre obligatorio; cédula, correo y MARKBOX (para enlazar un cliente real del
 * portal) opcionales. El curso lo hereda la inscripción de la cohorte.
 *
 * SDD-0107: la cédula ancla la inscripción a una persona (identidad única del
 * tenant). On-blur del campo cédula, un lookup en vivo le dice al operador si ese
 * humano ya está en el sistema ("ya es cliente DTD-NNNN" / "ya es alumno") o si
 * será un alta nueva — antes de confirmar. La cédula se normaliza visiblemente.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Field, FormError } from "./Field";
import {
  formatStudentCi,
  isValidStudentCi,
  type EnrollmentInput,
} from "@/lib/studio/academia/types";
import { createEnrollmentAction, lookupStudentCiAction } from "../actions";

type CiHint =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "invalid" }
  | { kind: "new"; normalized: string }
  | { kind: "existing"; name: string; cargoMarkbox: string | null; normalized: string };

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
  const [ciHint, setCiHint] = useState<CiHint>({ kind: "idle" });

  const canSubmit = studentName.trim().length > 0 && !pending;

  // Lookup en vivo de la cédula (on-blur): avisa si el alumno ya está en el
  // sistema o si será un alta nueva, y normaliza el formato visible del campo.
  const handleCiBlur = async () => {
    const raw = studentCi.trim();
    if (!raw) {
      setCiHint({ kind: "idle" });
      return;
    }
    if (!isValidStudentCi(raw)) {
      setCiHint({ kind: "invalid" });
      return;
    }
    // Normalización visible: V-18452110 → V-18.452.110, j123456789 → J-12345678-9.
    setStudentCi(formatStudentCi(raw));
    setCiHint({ kind: "checking" });
    const r = await lookupStudentCiAction(raw);
    if (r.status === "existing" && r.match) {
      setCiHint({
        kind: "existing",
        name: r.match.name,
        cargoMarkbox: r.match.cargoMarkbox,
        normalized: r.match.normalized,
      });
      // Sugerimos el nombre conocido si el operador aún no escribió uno.
      if (!studentName.trim()) setStudentName(r.match.name);
    } else if (r.status === "new") {
      setCiHint({ kind: "new", normalized: r.normalized ?? "" });
    } else if (r.status === "invalid") {
      setCiHint({ kind: "invalid" });
    } else {
      setCiHint({ kind: "idle" });
    }
  };

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
    // Feedback que confirma cómo quedó anclada la identidad del alumno.
    const name = studentName.trim();
    if (r.person?.cargoMarkbox) {
      toast.success(`${name} inscrito · ya es cliente ${r.person.cargoMarkbox}`);
    } else if (r.person?.created) {
      toast.success(`${name} inscrito · alumno nuevo registrado`);
    } else {
      toast.success(`${name} inscrito`);
    }
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
              onChange={(e) => {
                setStudentCi(e.target.value);
                if (ciHint.kind !== "idle") setCiHint({ kind: "idle" });
              }}
              onBlur={handleCiBlur}
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

        <CiHintNote hint={ciHint} />

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

/** Nota inline bajo el par cédula/correo: estado del lookup de identidad. */
function CiHintNote({ hint }: { hint: CiHint }) {
  if (hint.kind === "idle") return null;

  let tone: "info" | "success" | "danger" | "mute" = "mute";
  let text = "";
  if (hint.kind === "checking") {
    tone = "mute";
    text = "Buscando al alumno por cédula…";
  } else if (hint.kind === "invalid") {
    tone = "danger";
    text = "Cédula con formato inválido. Ej: V-18.452.110 o J-12345678-9.";
  } else if (hint.kind === "new") {
    tone = "info";
    text = `Alumno nuevo · se registrará la persona ${hint.normalized}.`;
  } else {
    tone = "success";
    text = hint.cargoMarkbox
      ? `Este alumno ya es cliente DTD: ${hint.cargoMarkbox} (${hint.name}).`
      : `Persona ya registrada: ${hint.name}. Se reusa su identidad.`;
  }

  const color =
    tone === "danger"
      ? "var(--danger)"
      : tone === "success"
        ? "var(--success)"
        : tone === "info"
          ? "var(--info)"
          : "var(--ink-mute)";

  return (
    <p
      role="status"
      style={{
        font: "500 12px/1.4 var(--f-sans)",
        color,
        margin: "-4px 0 0",
      }}
    >
      {text}
    </p>
  );
}
