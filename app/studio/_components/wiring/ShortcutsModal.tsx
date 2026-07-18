"use client";

/**
 * ShortcutsModal — atajos de teclado del Studio (SDD-0034).
 * Grid 2 cols con 5 grupos de combos en <kbd>.
 */

import { ModalShell } from "./ProfileModal";
import {
  useIsMac,
  platformKeyLabel,
} from "@/app/studio/_components/ui/usePlatformMod";

const GROUPS: Array<{
  title: string;
  shortcuts: Array<{ combo: string[]; label: string }>;
}> = [
  {
    title: "Navegación",
    shortcuts: [
      { combo: ["⌘", "K"], label: "Búsqueda global" },
      { combo: ["G", "D"], label: "Ir a Dashboard" },
      { combo: ["G", "E"], label: "Ir a Embarques" },
      { combo: ["G", "C"], label: "Ir a Clientes" },
    ],
  },
  {
    title: "Acciones",
    shortcuts: [
      { combo: ["N"], label: "Nuevo registro" },
      { combo: ["E"], label: "Editar registro activo" },
      { combo: ["/"], label: "Foco al buscador local" },
      { combo: ["?"], label: "Abrir este panel" },
    ],
  },
  {
    title: "Embarques",
    shortcuts: [
      { combo: ["T"], label: "Toggle tabla/kanban" },
      { combo: ["F"], label: "Abrir filtros" },
      { combo: ["↑", "↓"], label: "Navegar filas" },
      { combo: ["Enter"], label: "Abrir detalle" },
    ],
  },
  {
    title: "Email · Compose",
    shortcuts: [
      { combo: ["⌘", "Enter"], label: "Enviar email" },
      { combo: ["⌘", "S"], label: "Guardar borrador" },
      { combo: ["⌘", "⇧", "S"], label: "Programar envío" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { combo: ["⌘", "."], label: "Toggle theme" },
      { combo: ["⌘", ","], label: "Mi perfil" },
      { combo: ["⌘", "⇧", "L"], label: "Cerrar sesión" },
    ],
  },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const isMac = useIsMac();
  return (
    <ModalShell title="Atajos de teclado" onClose={onClose} width={720}>
      <div
        style={{
          padding: 22,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
        }}
      >
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div
              className="studio-eyebrow"
              style={{ color: "var(--wine-text)", marginBottom: 10 }}
            >
              {g.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.shortcuts.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--r-sm)",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      font: "500 12.5px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      flex: 1,
                    }}
                  >
                    {s.label}
                  </span>
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    {s.combo.map((k, i) => (
                      <kbd
                        key={i}
                        style={{
                          padding: "3px 8px",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border)",
                          borderBottom: "2px solid var(--border-strong)",
                          borderRadius: "var(--r-sm)",
                          font: "700 11px/1 var(--f-mono)",
                          color: "var(--ink)",
                          minWidth: 22,
                          textAlign: "center",
                        }}
                      >
                        {platformKeyLabel(k, isMac)}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
