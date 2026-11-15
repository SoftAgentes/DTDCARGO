"use client";

/**
 * InstallSkillDrawer · SDD-0020 Fase 2C
 *
 * Drawer client que abre el form de instalación de una skill.
 * Patrón estándar del Studio: <form id="install-skill-form"> +
 * <button form="install-skill-form"> en el DrawerFooter (HTML5).
 *
 * Defaults precargados desde la skill seleccionada.
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { installSkillAction } from "../actions";
import {
  AGENT_MODELS,
  modelLabel,
  type AgentActionState,
  type AgentModel,
  type Skill,
} from "@/lib/studio/agent-types";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const initialState: AgentActionState = {};

export function InstallSkillDrawer({
  skill,
  onClose,
}: {
  skill: Skill;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    installSkillAction,
    initialState,
  );

  const [name, setName] = useState(skill.name);
  const [model, setModel] = useState<AgentModel>(skill.default_model);
  const [budget, setBudget] = useState("50");

  useEffect(() => {
    if (state.ok && !state.error) onClose();
  }, [state.ok, state.error, onClose]);

  const canSubmit = useMemo(
    () => name.trim().length >= 2 && Number(budget) > 0,
    [name, budget],
  );

  const toolsCount = skill.tools_required.length;

  return (
    <DrawerShell
      title="Instalar skill"
      subtitle={`${skill.name} · ${toolsCount} ${toolsCount === 1 ? "tool" : "tools"} read-only`}
      onClose={onClose}
      pending={isPending}
      width={560}
    >
      <form
        id="install-skill-form"
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Skill ID hidden — el server action lo toma del FormData */}
        <input type="hidden" name="skill_id" value={skill.id} />

        <Field
          label="Nombre del agente *"
          name="name"
          value={name}
          onChange={setName}
          placeholder="Tracking Concierge"
          help="Cómo lo verán los operadores en la lista de instalados."
          error={state.fieldErrors?.name}
        />

        <Field
          label="Modelo *"
          name="model"
          as="select"
          value={model}
          onChange={(v) => setModel(v as AgentModel)}
          options={AGENT_MODELS.map((m) => ({ value: m, label: modelLabel(m) }))}
          help={`Default sugerido: ${modelLabel(skill.default_model)}.`}
          error={state.fieldErrors?.model}
        />

        <Field
          label="Presupuesto mensual (USD) *"
          name="budget_usd_monthly"
          value={budget}
          onChange={setBudget}
          type="number"
          placeholder="50"
          mono
          help="Al superar el budget, el agente se pausa solo. Reset el día 1."
          error={state.fieldErrors?.budget_usd_monthly}
        />

        {/* Auto-grants info box */}
        <div
          style={{
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-md)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Tools que se otorgan automáticamente
          </div>
          <div
            style={{
              font: "500 12px/1.4 var(--f-mono)",
              color: "var(--ink-soft)",
            }}
          >
            {skill.tools_required.join(" · ")}
          </div>
          <div
            style={{
              font: "400 11.5px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Todas read-only. La edición granular de grants llega en Fase 2C+.
          </div>
        </div>

        {state.error && <FormError msg={state.error} />}

        <div style={{ flex: 1, minHeight: 8 }} />
      </form>
      <DrawerFooter
        formId="install-skill-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel="Instalar skill"
      />
    </DrawerShell>
  );
}

// ─── Field helpers (prefijo install- en IDs) ────────────────

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  help?: string;
  error?: string;
  as?: "input" | "select";
  options?: { value: string; label: string }[];
};

function Field(props: FieldProps) {
  const { label, name, value, onChange, type = "text", mono, placeholder, help, error, as = "input", options } = props;
  const id = `install-${name}`;
  const cls = mono ? "studio-input studio-input-mono" : "studio-input";

  return (
    <div>
      <label className="studio-label" htmlFor={id}>
        {label}
      </label>
      {as === "select" ? (
        <select
          id={id}
          name={name}
          className="studio-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {(options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {help && !error && (
        <p
          style={{
            font: "400 11px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "4px 0 0",
          }}
        >
          {help}
        </p>
      )}
      {error && (
        <p
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--danger)",
            margin: "4px 0 0",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function FormError({ msg }: { msg: string }) {
  return (
    <Aviso tono="error" compacto>
      {msg}
    </Aviso>
  );
}
