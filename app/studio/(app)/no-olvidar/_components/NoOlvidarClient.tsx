"use client";

/**
 * <NoOlvidarClient> — vista principal del No-Olvidar desbloqueado (SDD-0025 Fase 3).
 *
 * Orquesta: toolbar (búsqueda + filtro de categoría + favoritos), la grilla de
 * items, y los drawers de agregar / ver-editar. Un watchdog cada 60 s revisa si
 * la sesión de unlock expiró y, si sí, manda al gate 2FA (§4.5).
 *
 * NO recibe ni maneja plaintext: solo metadata. El secreto se revela lazy dentro
 * del ItemDrawer. Solo tokens var(--*).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { ItemList } from "./ItemList";
import { AddItemDrawer } from "./AddItemDrawer";
import { ItemDrawer, type RevealConfig } from "./ItemDrawer";
import {
  categoryLabel,
  isSessionExpired,
  NO_OLVIDAR_CATEGORIES,
  type NoOlvidarCategory,
  type NoOlvidarItemMeta,
} from "@/lib/studio/no-olvidar-types";

export function NoOlvidarClient({
  items,
  isAdmin,
  sessionTimeoutMinutes,
  lastUnlockAt,
  revealConfig,
  watermarkLabel,
}: {
  items: NoOlvidarItemMeta[];
  isAdmin: boolean;
  sessionTimeoutMinutes: number;
  lastUnlockAt: string | null;
  revealConfig: RevealConfig;
  watermarkLabel: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<NoOlvidarCategory | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [openItem, setOpenItem] = useState<NoOlvidarItemMeta | null>(null);

  // Watchdog de sesión: si expiró el unlock, al gate 2FA (§4.5).
  useEffect(() => {
    const tick = () => {
      if (isSessionExpired(lastUnlockAt, sessionTimeoutMinutes)) {
        router.replace("/studio/no-olvidar/2fa?next=/studio/no-olvidar");
      }
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [lastUnlockAt, sessionTimeoutMinutes, router]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== "all" && it.category !== category) return false;
      if (favoritesOnly && !it.favorite) return false;
      if (term) {
        const hay = `${it.name} ${it.url ?? ""} ${it.username ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [items, search, category, favoritesOnly]);

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-mute)", display: "inline-flex" }}>
            {Icon.search(16)}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, sitio o usuario…"
            aria-label="Buscar"
            style={{
              width: "100%",
              padding: "9px 11px 9px 34px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--ink)",
              font: "400 14px/1 var(--f-sans)",
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          aria-pressed={favoritesOnly}
          style={chip(favoritesOnly)}
        >
          <span style={{ display: "inline-flex", color: favoritesOnly ? "var(--warning)" : "var(--ink-soft)" }}>
            {Icon.star(14)}
          </span>
          Favoritos
        </button>

        {isAdmin && (
          <a href="/studio/no-olvidar/admin" style={{ ...chip(false), textDecoration: "none" }}>
            <span style={{ display: "inline-flex" }}>{Icon.cog(14)}</span>
            Administración
          </a>
        )}

        <button type="button" onClick={() => setAddOpen(true)} className="studio-btn studio-btn-primary">
          <span style={{ display: "inline-flex", marginRight: 6 }}>{Icon.plus(15)}</span>
          Agregar
        </button>
      </div>

      {/* Filtro de categoría */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
          Todos
        </FilterChip>
        {NO_OLVIDAR_CATEGORIES.map((c) => (
          <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {categoryLabel(c)}
          </FilterChip>
        ))}
      </div>

      <ItemList
        items={filtered}
        onOpen={setOpenItem}
        emptyHint={
          items.length === 0
            ? "Tu No-Olvidar está vacío. Agrega tu primer secreto con «Agregar»."
            : "Ningún item coincide con el filtro."
        }
      />

      {addOpen && <AddItemDrawer onClose={() => setAddOpen(false)} />}
      {openItem && (
        <ItemDrawer
          item={openItem}
          revealConfig={revealConfig}
          watermarkLabel={watermarkLabel}
          onClose={() => setOpenItem(null)}
        />
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: "var(--r-pill, 999px)",
        border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
        background: active ? "var(--wine-tint)" : "var(--bg-surface)",
        color: active ? "var(--wine)" : "var(--ink-soft)",
        font: "600 12.5px/1 var(--f-sans)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 13px",
    borderRadius: "var(--r-md)",
    border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
    background: active ? "var(--wine-tint)" : "var(--bg-surface)",
    color: active ? "var(--wine)" : "var(--ink-soft)",
    font: "600 13px/1 var(--f-sans)",
    cursor: "pointer",
  };
}
