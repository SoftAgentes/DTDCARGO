"use client";

/**
 * InstallSkillButton · SDD-0020 Fase 2C
 *
 * Wrapper client que renderiza el botón "Instalar skill" en el detalle
 * de skill (server page) y mantiene el state open/close del drawer.
 *
 * Mantener este wrapper aislado evita que la página `[skillSlug]` se
 * convierta toda en client component.
 */

import { useState } from "react";
import type { Skill } from "@/lib/studio/agent-types";
import { InstallSkillDrawer } from "./InstallSkillDrawer";

export function InstallSkillButton({ skill }: { skill: Skill }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="studio-btn studio-btn-primary studio-btn-sm"
        onClick={() => setOpen(true)}
      >
        Instalar skill
      </button>
      {open && (
        <InstallSkillDrawer skill={skill} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
