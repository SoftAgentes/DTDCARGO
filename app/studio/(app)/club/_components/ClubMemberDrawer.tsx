"use client";

/**
 * Drawer de alta/edición de un miembro del Club DTD (SDD-0116, Slice A).
 *
 * ALTA: ancla a una persona por cédula (requerida). On-blur del campo cédula, un
 * lookup en vivo avisa si ese humano ya está en el sistema (ya es cliente
 * DTD-NNNN / ya es alumno de Academia) o si será un alta nueva, y si cumple el
 * gate D1 (ser miembro de la Academia). El gate NO bloquea el alta — es un aviso.
 *
 * EDICIÓN: la persona no cambia (se muestra read-only); se editan plan, estado,
 * Shipping Mark, origen y notas.
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
  CLUB_PLANS,
  CLUB_MEMBER_STATUSES,
  CLUB_MEMBER_SOURCES,
  planLabel,
  memberStatusLabel,
  sourceLabel,
  type ClubMemberInput,
  type ClubMemberEditInput,
  type ClubMemberRow,
  type ClubPlan,
  type ClubMemberStatus,
  type ClubMemberSource,
} from "@/lib/studio/club/club-member-types";
import {
  createClubMemberAction,
  updateClubMemberAction,
  lookupMemberCiAction,
} from "../actions";

type CiHint =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "invalid" }
  | { kind: "new"; normalized: string }
  | {
      kind: "existing";
      name: string;
      cargoMarkbox: string | null;
      isAcademyMember: boolean;
      normalized: string;
    };

export function ClubMemberDrawer({
  member,
  onClose,
}: {
  member?: ClubMemberRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!member;

  const [name, setName] = useState(member?.person_name ?? "");
  const [ci, setCi] = useState(member?.person_national_id ?? "");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<ClubPlan>(member?.plan ?? "comunidad");
  const [status, setStatus] = useState<ClubMemberStatus>(member?.status ?? "activa");
  const [clientMarkbox, setClientMarkbox] = useState(member?.client_markbox ?? "");
  const [source, setSource] = useState<ClubMemberSource | "">(
    (member?.source as ClubMemberSource | undefined) ?? "",
  );
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ciHint, setCiHint] = useState<CiHint>({ kind: "idle" });

  const canSubmit = isEdit
    ? !pending
    : name.trim().length > 0 && ci.trim().length > 0 && !pending;

  // Lookup en vivo de la cédula (solo en alta).
  const handleCiBlur = async () => {
    const raw = ci.trim();
    if (!raw) {
      setCiHint({ kind: "idle" });
      return;
    }
    if (!isValidStudentCi(raw)) {
      setCiHint({ kind: "invalid" });
      return;
    }
    setCi(formatStudentCi(raw));
    setCiHint({ kind: "checking" });
    const r = await lookupMemberCiAction(raw);
    if (r.status === "existing" && r.match) {
      setCiHint({
        kind: "existing",
        name: r.match.name,
        cargoMarkbox: r.match.cargoMarkbox,
        isAcademyMember: r.match.isAcademyMember,
        normalized: r.match.normalized,
      });
      if (!name.trim()) setName(r.match.name);
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

    if (isEdit && member) {
      const payload: Partial<ClubMemberEditInput> = {
        plan,
        status,
        clientMarkbox: clientMarkbox.trim() || null,
        source: source || null,
        notes: notes.trim() || null,
      };
      const r = await updateClubMemberAction(member.id, payload);
      setPending(false);
      if (r.error) return setError(r.error);
      if (r.fieldErrors) {
        return setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");
      }
      toast.success(`Membresía de ${member.person_name} actualizada`);
      onClose();
      router.refresh();
      return;
    }

    const payload: Partial<ClubMemberInput> = {
      ci: ci.trim(),
      name: name.trim(),
      email: email.trim() || null,
      plan,
      status,
      clientMarkbox: clientMarkbox.trim() || null,
      source: source || null,
      notes: notes.trim() || null,
    };
    const r = await createClubMemberAction(payload);
    setPending(false);
    if (r.error) return setError(r.error);
    if (r.fieldErrors) {
      return setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");
    }
    const who = name.trim();
    if (r.person?.cargoMarkbox) {
      toast.success(`${who} es miembro del Club · ya es cliente ${r.person.cargoMarkbox}`);
    } else if (r.person?.created) {
      toast.success(`${who} es miembro del Club · persona nueva registrada`);
    } else {
      toast.success(`${who} es miembro del Club`);
    }
    if (r.person && !r.person.isAcademyMember) {
      toast.info(`${who} aún no es alumno de la Academia (gate de elegibilidad D1).`);
    }
    onClose();
    if (r.createdId) {
      router.push(`/studio/club?highlight=${r.createdId}&hl-tone=warm`);
    } else {
      router.refresh();
    }
  };

  return (
    <DrawerShell
      title={isEdit ? "Editar membresía" : "Nuevo miembro"}
      subtitle={isEdit ? member?.person_name : "Club DTD"}
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="club-member-form"
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

        {isEdit ? (
          <div
            style={{
              padding: "10px 12px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {member?.person_name}
            </div>
            <div
              className="studio-input-mono"
              style={{
                font: "500 12px/1.4 var(--f-mono)",
                color: "var(--ink-soft)",
                background: "transparent",
                border: "none",
                padding: 0,
              }}
            >
              {member?.person_national_id ?? "Sin cédula"}
              {member?.cargo_markbox ? ` · ${member.cargo_markbox}` : ""}
            </div>
          </div>
        ) : (
          <>
            <Field label="Nombre del miembro">
              <input
                className="studio-input"
                placeholder="María Fernanda Rodríguez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Documento (cédula)">
                <input
                  className="studio-input studio-input-mono"
                  placeholder="V-18.452.110"
                  value={ci}
                  onChange={(e) => {
                    setCi(e.target.value);
                    if (ciHint.kind !== "idle") setCiHint({ kind: "idle" });
                  }}
                  onBlur={handleCiBlur}
                />
              </Field>
              <Field label="Correo" optional>
                <input
                  className="studio-input"
                  type="email"
                  placeholder="miembro@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </div>

            <CiHintNote hint={ciHint} />
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Plan">
            <select
              className="studio-input"
              value={plan}
              onChange={(e) => setPlan(e.target.value as ClubPlan)}
            >
              {CLUB_PLANS.map((p) => (
                <option key={p} value={p}>
                  {planLabel(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="studio-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ClubMemberStatus)}
            >
              {CLUB_MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {memberStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Shipping Mark del cliente" optional>
          <input
            className="studio-input studio-input-mono"
            placeholder="DTD-1234 · enlaza al cliente de carga"
            value={clientMarkbox}
            onChange={(e) => setClientMarkbox(e.target.value)}
          />
        </Field>

        <Field label="Origen" optional>
          <select
            className="studio-input"
            value={source}
            onChange={(e) => setSource(e.target.value as ClubMemberSource | "")}
          >
            <option value="">—</option>
            {CLUB_MEMBER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceLabel(s)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notas" optional>
          <textarea
            className="studio-input"
            rows={3}
            placeholder="Notas internas sobre el miembro…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </Field>
      </form>

      <DrawerFooter
        formId="club-member-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={isEdit ? "Guardar cambios" : "Crear miembro"}
        pendingLabel={isEdit ? "Guardando…" : "Creando…"}
      />
    </DrawerShell>
  );
}

/** Nota inline bajo el par cédula/correo: estado del lookup de identidad. */
function CiHintNote({ hint }: { hint: CiHint }) {
  if (hint.kind === "idle") return null;

  let color = "var(--ink-soft)";
  let text = "";
  if (hint.kind === "checking") {
    text = "Buscando a la persona por cédula…";
  } else if (hint.kind === "invalid") {
    color = "var(--danger)";
    text = "Cédula con formato inválido. Ej: V-18.452.110 o J-12345678-9.";
  } else if (hint.kind === "new") {
    color = "var(--info)";
    text = `Persona nueva · se registrará ${hint.normalized}.`;
  } else {
    color = "var(--success)";
    const base = hint.cargoMarkbox
      ? `Ya es cliente DTD: ${hint.cargoMarkbox} (${hint.name}).`
      : `Persona ya registrada: ${hint.name}. Se reusa su identidad.`;
    text = hint.isAcademyMember
      ? `${base} Es alumno de la Academia.`
      : `${base} Aún no es alumno de la Academia.`;
  }

  return (
    <p role="status" style={{ font: "500 12px/1.4 var(--f-sans)", color, margin: "-4px 0 0" }}>
      {text}
    </p>
  );
}
