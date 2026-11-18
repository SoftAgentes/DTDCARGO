"use client";

/**
 * Pestaña «Actividad» de la ficha (SDD-0622, unificada por la SDD-0635 §3.7).
 *
 * Una sola línea de tiempo de la persona: extras (dados, cambiados, quitados),
 * cambios de rol y de almacén, suspensiones y reactivaciones. Sale de las
 * bitácoras append-only (`entity_audit_log` y `user_role_audit`), no de las
 * tablas vivas: lo quitado sigue apareciendo aquí.
 *
 * Los cambios de la matriz «Roles y permisos» (a todo el rol) todavía no tienen
 * historial propio (etapa 3 de la 0635): la pestaña lo dice, no lo inventa.
 */

import { useEffect, useState } from "react";
import { ROLE_LABELS, WAREHOUSE_SCOPE_LABELS, type StudioUserRole, type WarehouseScope } from "@/lib/studio/user-types";
import { listUserAccessActivityAction, type AccessActivityEvent } from "../../actions";
import { moduleLabel } from "./AccesoPanel";
import "./permisos.css";

const fecha = new Intl.DateTimeFormat("es-VE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Caracas",
});

type Filtro = "todo" | "rol" | "extra";
const FILTROS: { k: Filtro; label: string }[] = [
  { k: "todo", label: "Todo" },
  { k: "rol", label: "Rol y estado" },
  { k: "extra", label: "Accesos extra" },
];

const KIND_LABEL: Record<AccessActivityEvent["kind"], string> = {
  extra: "Extra",
  rol: "Rol",
  almacen: "Almacén",
  estado: "Estado",
};

function rolLabel(r: string | null): string {
  return r && r in ROLE_LABELS ? ROLE_LABELS[r as StudioUserRole] : (r ?? "—");
}

function almacenLabel(s: string | null): string {
  return s && s in WAREHOUSE_SCOPE_LABELS ? WAREHOUSE_SCOPE_LABELS[s as WarehouseScope] : (s ?? "—");
}

/** Qué pasó, en palabras. */
export function tituloEvento(e: AccessActivityEvent): string {
  switch (e.event) {
    case "created":
    case "updated":
    case "revoked": {
      const verbo = e.event === "created" ? "Se concedió" : e.event === "updated" ? "Se cambió" : "Se quitó";
      const nivel = e.event !== "revoked" && e.canEdit !== null ? (e.canEdit ? " · ver y editar" : " · solo ver") : "";
      return `${verbo} ${moduleLabel(e.moduleId ?? "—")}${nivel}`;
    }
    case "role_changed":
      return `Rol: ${rolLabel(e.before)} → ${rolLabel(e.after)}`;
    case "scope_changed":
      return `Almacén: ${almacenLabel(e.before)} → ${almacenLabel(e.after)}`;
    case "disabled":
      return "Suspendida";
    case "enabled":
      return "Reactivada";
  }
}

export function ActividadAcceso({
  userId,
  nombres,
  /** Cambia cuando cambian los extras: vuelve a leer. */
  version,
}: {
  userId: string;
  nombres: Record<string, string>;
  version: string;
}) {
  const [estado, setEstado] = useState<
    { kind: "cargando" } | { kind: "error"; msg: string } | { kind: "ok"; events: AccessActivityEvent[] }
  >({ kind: "cargando" });
  const [filtro, setFiltro] = useState<Filtro>("todo");

  useEffect(() => {
    let cancelled = false;
    void listUserAccessActivityAction(userId)
      .then((res) => {
        if (cancelled) return;
        setEstado("error" in res ? { kind: "error", msg: res.error } : { kind: "ok", events: res.events });
      })
      .catch(() => {
        if (cancelled) return;
        setEstado({ kind: "error", msg: "No se pudo cargar la actividad: se cortó la conexión. Intenta de nuevo." });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  if (estado.kind === "cargando") {
    return (
      <p role="status" className="perm-empty" style={{ paddingLeft: 0 }}>
        Cargando actividad…
      </p>
    );
  }
  if (estado.kind === "error") {
    return (
      <p role="alert" style={{ margin: 0, font: "600 12.5px/1.45 var(--f-sans)", color: "var(--danger)" }}>
        {estado.msg}
      </p>
    );
  }

  const visibles = estado.events.filter((e) => filtro === "todo" || (filtro === "extra" ? e.kind === "extra" : e.kind !== "extra"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <div className="perm-filters" role="group" aria-label="Filtrar actividad">
        {FILTROS.map((f) => (
          <button key={f.k} type="button" className="perm-filter" aria-pressed={filtro === f.k} onClick={() => setFiltro(f.k)}>
            {f.label}
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <p className="perm-empty" style={{ paddingLeft: 0 }}>
          {filtro === "todo" ? "Todavía no hay cambios de acceso para esta persona." : "No hay cambios de este tipo."}
        </p>
      ) : (
        <ul className="perm-activity" aria-label="Cambios de acceso">
          {visibles.map((e) => (
            <li key={`${e.kind}:${e.id}`}>
              <span className="perm-activity-dot" data-kind={e.event} aria-hidden />
              <div>
                <div className="perm-activity-title">
                  <span className="perm-kind" data-k={e.kind === "almacen" ? "rol" : e.kind}>
                    {KIND_LABEL[e.kind]}
                  </span>
                  {tituloEvento(e)}
                </div>
                <div className="perm-activity-meta">
                  {e.actorId ? (nombres[e.actorId] ?? "Un admin") : "Sistema"} · {fecha.format(new Date(e.occurredAt))}
                  {e.reason ? ` · «${e.reason}»` : e.kind === "estado" ? " · sin motivo guardado" : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="perm-hint">
        Los cambios a todo el rol desde «Roles y permisos» todavía no guardan historial; se verán aquí cuando lo tengan.
      </p>
    </div>
  );
}
