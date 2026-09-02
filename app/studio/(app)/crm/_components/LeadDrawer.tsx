"use client";

import { RovingTabList } from "@/app/studio/_components/ui/RovingTabList";

/**
 * El drawer del lead — los verbos que no cabían en una fila (SDD-0256 · Fases 4 y 5).
 *
 * Reasignar asesor y etiquetar tenían la cadena de servidor COMPLETA —RBAC,
 * validación, payload probado, encolado, nudge— y **cero** consumidores desde
 * agosto. Notas y tareas eran imposibles hasta la 0377. Los cuatro viven acá.
 *
 * ── Un formulario a la vez, a propósito ─────────────────────────────────────
 * El patrón del Studio es `<form id="X">` en el cuerpo + `<button type="submit"
 * form="X">` en el footer (HTML5, sin `requestSubmit()` hacks), y ese contrato
 * es de UN form por footer. Por eso el drawer elige verbo arriba y el cuerpo
 * muestra sólo ese: cuatro formularios apilados obligarían a cuatro botones
 * sueltos y el footer dejaría de significar "confirmar".
 *
 * ── El token de idempotencia ────────────────────────────────────────────────
 * Las ops que CREAN (nota, tarea) llevan token. Se genera al abrir el drawer y
 * se renueva después de cada envío exitoso:
 *   · doble clic sobre el mismo texto → mismo token → UNA nota.
 *   · dos notas distintas seguidas    → dos tokens  → DOS notas.
 * Sin eso, la clave `<leadId>:<op>` colapsaría las dos notas en una fila y la
 * primera se perdería sin error (migración 0377).
 */

import { useState, useTransition } from "react";
import { DrawerFooter, DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Badge } from "@/app/studio/_components/ui/Badge";
import type { OwnerSlice } from "@/lib/studio/kommo-analytics";
import type { StaleOp } from "@/lib/studio/kommo-writeback";
import {
  addLeadNoteAction,
  addLeadTaskAction,
  reassignLeadOwnerAction,
  retryStaleWritebackAction,
  setLeadTagsAction,
} from "../actions";

const FORM_ID = "crm-lead-verbo";

type Verbo = "asesor" | "etiquetas" | "nota" | "tarea";

const VERBOS: { key: Verbo; label: string }[] = [
  { key: "asesor", label: "Asesor" },
  { key: "etiquetas", label: "Etiquetas" },
  { key: "nota", label: "Nota" },
  { key: "tarea", label: "Tarea" },
];

/** Nombre legible de cada op, para explicar qué quedó frenado. */
const OP_LABEL: Record<string, string> = {
  patch_stage: "el cambio de etapa",
  patch_owner: "la reasignación de asesor",
  patch_tags: "el cambio de etiquetas",
  add_note: "la nota",
  add_task: "la tarea",
};

export function LeadDrawer({
  lead,
  asesores,
  staleOps,
  onClose,
  onDone,
}: {
  lead: { id: number; name: string; ownerId: number | null };
  /** Asesores del espejo (SDD-0087). Ya viajaba al cliente para el filtro. */
  asesores: OwnerSlice[];
  /** Órdenes que el chequeo optimista frenó para este lead. */
  staleOps: StaleOp[];
  onClose: () => void;
  onDone: (msg: string, error?: boolean) => void;
}) {
  const [verbo, setVerbo] = useState<Verbo>("asesor");
  const [isPending, startTransition] = useTransition();

  // Token del envío. `crypto.randomUUID` existe en todo navegador que corre el
  // Studio; si faltara, la acción rechaza el token y lo dice — nunca encola sin.
  const [token, setToken] = useState(() => nuevoToken());

  const [asesorId, setAsesorId] = useState<string>(
    lead.ownerId != null ? String(lead.ownerId) : "",
  );
  const [agregar, setAgregar] = useState<string[]>([]);
  const [quitar, setQuitar] = useState<string[]>([]);
  const [nota, setNota] = useState("");
  const [tareaTexto, setTareaTexto] = useState("");
  const [tareaFecha, setTareaFecha] = useState(() => enDias(2));
  const [tareaAsesor, setTareaAsesor] = useState<string>("");

  const puedeEnviar =
    verbo === "asesor"
      ? asesorId !== "" && Number(asesorId) !== lead.ownerId
      : verbo === "etiquetas"
        ? agregar.length > 0 || quitar.length > 0
        : verbo === "nota"
          ? nota.trim().length > 0
          : tareaTexto.trim().length > 0 && Boolean(tareaFecha);

  const enviar = async () => {
    let res: { ok?: true; error?: string };
    let exito = "";

    if (verbo === "asesor") {
      res = await reassignLeadOwnerAction(lead.id, Number(asesorId));
      exito = "Asesor en camino al CRM";
    } else if (verbo === "etiquetas") {
      res = await setLeadTagsAction(lead.id, agregar, quitar);
      exito = "Etiquetas en camino al CRM";
    } else if (verbo === "nota") {
      res = await addLeadNoteAction(lead.id, nota, token);
      exito = "Nota en camino al CRM";
    } else {
      res = await addLeadTaskAction(
        lead.id,
        tareaTexto,
        tareaFecha,
        tareaAsesor ? Number(tareaAsesor) : null,
        token,
      );
      exito = "Tarea en camino al CRM";
    }

    if (res.error) {
      onDone(res.error, true);
      return;
    }
    // Envío bueno: el token se quema. El próximo texto es otra nota, no un
    // reintento del anterior.
    setToken(nuevoToken());
    if (verbo === "etiquetas") {
      setAgregar([]);
      setQuitar([]);
    }
    if (verbo === "nota") setNota("");
    if (verbo === "tarea") setTareaTexto("");
    onDone(exito);
    onClose();
  };

  return (
    <DrawerShell
      title={lead.name || "(sin nombre)"}
      subtitle={`Lead #${lead.id} · las órdenes viajan al CRM y vuelven por el webhook`}
      onClose={onClose}
      pending={isPending}
      width={560}
    >
      <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
        {staleOps.length > 0 && (
          <AvisoFrenado ops={staleOps} isPending={isPending} onDone={onDone} />
        )}

        {/* Selector de verbo */}
        <RovingTabList
          aria-label="Qué hacer con el lead"
          style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", marginBottom: 18 }}
        >
          {VERBOS.map((v) => {
            const activo = v.key === verbo;
            return (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={activo}
                disabled={isPending}
                onClick={() => setVerbo(v.key)}
                className="studio-btn studio-btn-sm"
                style={{
                  background: activo ? "var(--bg-elevated)" : "transparent",
                  border: `1px solid ${activo ? "var(--border)" : "transparent"}`,
                  color: activo ? "var(--ink)" : "var(--ink-soft)",
                  fontWeight: activo ? 700 : 500,
                }}
              >
                {v.label}
              </button>
            );
          })}
        </RovingTabList>

        <form
          id={FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            if (!puedeEnviar || isPending) return;
            startTransition(enviar);
          }}
        >
          {verbo === "asesor" && (
            <Campo
              label="Reasignar a"
              hint="El lead se mueve de cartera en el CRM. El asesor anterior deja de verlo en su embudo."
            >
              <select
                className="studio-input"
                value={asesorId}
                disabled={isPending}
                onChange={(e) => setAsesorId(e.target.value)}
              >
                <option value="">Elige un asesor…</option>
                {asesores
                  .filter((a) => a.id != null)
                  .map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.label} ({a.count} leads)
                    </option>
                  ))}
              </select>
            </Campo>
          )}

          {verbo === "etiquetas" && (
            <>
              <Campo
                label="Agregar etiquetas"
                hint="Se SUMAN a las que ya tiene. Nunca se reemplaza la lista: eso borraría las que el asesor puso a mano en el CRM."
              >
                <EntradaChips
                  valores={agregar}
                  onChange={setAgregar}
                  disabled={isPending}
                  placeholder="Escribe y pulsa Enter…"
                  tone="success"
                />
              </Campo>
              <Campo label="Quitar etiquetas">
                <EntradaChips
                  valores={quitar}
                  onChange={setQuitar}
                  disabled={isPending}
                  placeholder="Escribe y pulsa Enter…"
                  tone="danger"
                />
              </Campo>
            </>
          )}

          {verbo === "nota" && (
            <Campo
              label="Nota"
              hint="Queda en el historial del lead en el CRM, visible para todo el equipo."
            >
              <textarea
                className="studio-input"
                rows={5}
                value={nota}
                disabled={isPending}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Qué pasó en el contacto…"
                style={{ resize: "vertical", minHeight: 96 }}
              />
            </Campo>
          )}

          {verbo === "tarea" && (
            <>
              <Campo
                label="Tarea"
                hint="Al vencer, el CRM pone la tarjeta en rojo. Es el semáforo que mira el equipo."
              >
                <input
                  type="text"
                  className="studio-input"
                  value={tareaTexto}
                  disabled={isPending}
                  onChange={(e) => setTareaTexto(e.target.value)}
                  placeholder="Volver a llamar, mandar cotización…"
                />
              </Campo>
              <Campo label="Vence el" hint="Vence a las 9:00 de la mañana, hora de Venezuela.">
                <input
                  type="date"
                  className="studio-input"
                  value={tareaFecha}
                  disabled={isPending}
                  min={enDias(0)}
                  onChange={(e) => setTareaFecha(e.target.value)}
                />
              </Campo>
              <Campo label="Responsable" hint="Si no eliges, queda para quien tenga el lead.">
                <select
                  className="studio-input"
                  value={tareaAsesor}
                  disabled={isPending}
                  onChange={(e) => setTareaAsesor(e.target.value)}
                >
                  <option value="">El responsable del lead</option>
                  {asesores
                    .filter((a) => a.id != null)
                    .map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.label}
                      </option>
                    ))}
                </select>
              </Campo>
            </>
          )}
        </form>
      </div>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit={puedeEnviar}
        submitLabel="Mandar al CRM"
        pendingLabel="Encolando…"
      />
    </DrawerShell>
  );
}

/**
 * El aviso de que una orden NO se mandó porque el lead cambió en Kommo.
 *
 * Es la mitad visible del chequeo optimista: sin esto, el asesor ve desaparecer
 * el "En camino" y da por hecho que salió. Reintentar encola de nuevo con un
 * snapshot fresco — la decisión de pisar igual la toma una persona, no el
 * sistema.
 */
function AvisoFrenado({
  ops,
  isPending,
  onDone,
}: {
  ops: StaleOp[];
  isPending: boolean;
  onDone: (msg: string, error?: boolean) => void;
}) {
  const [reintentando, setReintentando] = useState<string | null>(null);

  return (
    <div
      role="status"
      style={{
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--warning)",
        borderRadius: "var(--r-sm)",
        background: "var(--bg-elevated)",
        padding: "12px 14px",
        marginBottom: 18,
      }}
    >
      <div style={{ font: "700 11px/1.3 var(--f-sans)", color: "var(--ink)", marginBottom: 6 }}>
        No se pisó el trabajo del CRM
      </div>
      {ops.map((o) => (
        <div
          key={o.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "4px 0",
          }}
        >
          <span style={{ font: "400 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            El lead cambió en el CRM después de que pediste{" "}
            <strong style={{ color: "var(--ink)" }}>{OP_LABEL[o.op] ?? o.op}</strong>, así que
            no se mandó.
          </span>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            disabled={isPending || reintentando === o.id}
            onClick={async () => {
              setReintentando(o.id);
              const res = await retryStaleWritebackAction(o.id);
              setReintentando(null);
              onDone(res.error ?? "Reintentado: va de nuevo al CRM", Boolean(res.error));
            }}
            style={{ flexShrink: 0 }}
          >
            {reintentando === o.id ? "…" : "Reintentar"}
          </button>
        </div>
      ))}
    </div>
  );
}

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="studio-label">{label}</label>
      {children}
      {hint && (
        <p
          style={{
            font: "400 11px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "6px 0 0",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/** Entrada de etiquetas con chips. Enter agrega, la × quita. */
function EntradaChips({
  valores,
  onChange,
  disabled,
  placeholder,
  tone,
}: {
  valores: string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
  placeholder: string;
  tone: "success" | "danger";
}) {
  const [texto, setTexto] = useState("");

  const agregar = () => {
    const t = texto.trim();
    if (!t) return;
    // Mismo criterio de dedup que `buildTagsPatchPayload`: sin distinguir
    // mayúsculas, para que "VIP" y "vip" no viajen como dos etiquetas.
    if (!valores.some((v) => v.toLowerCase() === t.toLowerCase())) {
      onChange([...valores, t]);
    }
    setTexto("");
  };

  return (
    <>
      <input
        type="text"
        className="studio-input"
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          // Sin esto, Enter en el input dispararía el submit del formulario y
          // mandaría la etiqueta a medio escribir.
          e.preventDefault();
          agregar();
        }}
        onBlur={agregar}
      />
      {valores.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {valores.map((v) => (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(valores.filter((x) => x !== v))}
              title={`Quitar "${v}" de la lista`}
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
            >
              <Badge tone={tone} size="sm">
                {v} ×
              </Badge>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function nuevoToken(): string {
  return crypto.randomUUID();
}

/** YYYY-MM-DD de hoy + n días, en la zona del navegador (la del asesor). */
function enDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
