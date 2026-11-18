"use client";

/**
 * Mapa «Lo que puede hacer» de la ficha (SDD-0635 §3.1 y §3.2).
 *
 * Todos los módulos de cada área como chips, con su estado escrito (no solo en
 * color): por su rol, extra, sin acceso, todavía no se puede dar. Al tocar un
 * chip se abre su detalle debajo del área, con el ORIGEN en texto y las tres
 * opciones a la vista (Sin extra · Solo ver · Ver y editar).
 *
 * Elegir una opción NO guarda: avisa al panel (`onElegir`) y el cambio va a la
 * bandeja «Cambios para <persona>», que pide un motivo y guarda todo junto. Lo
 * que la base no acepta no ofrece opciones (0622 §5.3: no prometer lo que la
 * base niega). Un módulo sensible que algún día se pueda dar abre el doble
 * aviso (`onSensible`) en vez de ir a la bandeja.
 */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { MODULES } from "@/lib/studio/modules";
import type { RoleModuleOverrides } from "@/lib/studio/rbac";
import {
  AREA_LABEL,
  AREA_ORDER,
  COVERAGE_HINT,
  NIVEL_LARGO,
  estadoModulo,
  nivelCorto,
  type EstadoModulo,
  type ExtraActual,
  type NivelExtra,
} from "@/lib/studio/user-module-grants";
import type { UserModuleGrantView } from "@/lib/studio/user-module-grants-queries";
import { ROLE_LABELS, type UserMembershipWithProfile } from "@/lib/studio/user-types";
import "./permisos.css";

const fechaCorta = new Intl.DateTimeFormat("es-VE", { day: "numeric", month: "short", timeZone: "America/Caracas" });

/** Extras de la persona por módulo, en el formato del mapa. */
export function extrasPorModulo(grants: readonly UserModuleGrantView[]): Record<string, ExtraActual> {
  const out: Record<string, ExtraActual> = {};
  for (const g of grants) {
    out[g.moduleId] = { nivel: g.canEdit ? "edit" : "view", vigente: !g.expired, expiresAt: g.expiresAt };
  }
  return out;
}

/** El extra que quedaría si se guardara lo que está en la bandeja. */
function conPendiente(actual: ExtraActual | undefined, pendiente: NivelExtra | undefined): ExtraActual | null {
  if (pendiente === undefined) return actual ?? null;
  if (pendiente === "none") return null;
  return { nivel: pendiente, vigente: true, expiresAt: actual?.expiresAt ?? null };
}

/** Nivel actual del extra para el radio: un extra vencido cuenta como «sin extra». */
export function nivelActual(actual: ExtraActual | undefined): NivelExtra {
  return actual?.vigente ? actual.nivel : "none";
}

function txtEstado(e: EstadoModulo): string {
  const nivel = e.edit ? "ver y editar" : "solo ver";
  switch (e.src) {
    case "admin":
      return "administrador, ve y edita todo";
    case "role":
      return `por su rol, ${nivel}${e.sobra ? ", con un extra que sobra" : ""}`;
    case "grant":
      return `acceso extra, ${nivel}`;
    case "blocked":
      return "sin acceso, todavía no se puede dar como extra";
    default:
      return "sin acceso";
  }
}

export function MapaAcceso({
  member,
  grants,
  overrides,
  pendientes,
  nombres,
  personasDelRol,
  bloqueo,
  onElegir,
  onSensible,
  onTodoComercial,
  onIrARoles,
}: {
  member: UserMembershipWithProfile;
  grants: UserModuleGrantView[];
  overrides: RoleModuleOverrides;
  /** moduleId → nivel de extra que se quiere dejar (bandeja sin guardar). */
  pendientes: Record<string, NivelExtra>;
  nombres: Record<string, string>;
  personasDelRol?: number;
  /** Si hay bloqueo (admin, suspendida, uno mismo), las opciones no se ofrecen. */
  bloqueo: string | null;
  onElegir: (moduleId: string, nivel: NivelExtra) => void;
  onSensible: (moduleId: string) => void;
  /** Atajo «Todo Comercial»: llena la bandeja con los comerciales que se pueden dar. */
  onTodoComercial?: () => void;
  onIrARoles?: () => void;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verOcultos, setVerOcultos] = useState<Record<string, boolean>>({});
  const chips = useRef(new Map<string, HTMLButtonElement>());
  const extras = extrasPorModulo(grants);
  const porId = new Map(grants.map((g) => [g.moduleId, g]));
  const rol = ROLE_LABELS[member.role];
  const desactivado = member.disabled_at !== null;

  function cerrar(id: string) {
    setAbierto(null);
    queueMicrotask(() => chips.current.get(id)?.focus());
  }

  // Esc cierra el detalle y no la ficha: el cajón escucha Esc en `document`
  // (fase de captura), así que aquí se escucha antes, en `window`. Solo si el
  // detalle está en la capa modal de arriba (no con un diálogo encima).
  useEffect(() => {
    if (!abierto) return;
    const id = abierto;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const det = document.getElementById(`perm-det-${id}`);
      if (!det) return;
      const modales = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      const arriba = modales.item(modales.length - 1);
      if (arriba && !arriba.contains(det)) return;
      e.stopPropagation();
      cerrar(id);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [abierto]);

  const areas = AREA_ORDER.map((area) => {
    const mods = MODULES.filter((m) => m.group === area && !m.hidden).map((m) => ({
      m,
      e: estadoModulo(member.role, m.id, overrides, conPendiente(extras[m.id], pendientes[m.id])),
      hoy: estadoModulo(member.role, m.id, overrides, extras[m.id] ?? null),
    }));
    return { area, mods };
  });

  return (
    <section aria-labelledby="perm-efectivo">
      <h3 id="perm-efectivo" className="perm-label">
        Lo que puede hacer
        <span className="perm-legend" aria-hidden>
          <span>
            <i data-k="role" />
            Por su rol
          </span>
          <span>
            <i data-k="grant" />
            Extra
          </span>
          <span>
            <i data-k="sens" />
            Sensible
          </span>
          <span>
            <i data-k="none" />
            Sin acceso
          </span>
        </span>
      </h3>
      {desactivado && (
        <p className="perm-empty" style={{ paddingLeft: 0 }}>
          Suspendida: hoy no ve nada. Esto es lo que vería al reactivarla.
        </p>
      )}
      <div className="perm-areas perm-areas-mapa">
        {areas.map(({ area, mods }) => {
          const visibles = mods.filter((x) => x.e.src !== "blocked" || verOcultos[area] || abierto === x.m.id);
          const ocultos = mods.length - visibles.length;
          const conAcceso = mods.filter((x) => x.e.view).length;
          const detalle = mods.find((x) => x.m.id === abierto);
          return (
            <div key={area} className="perm-area">
              <h4>
                <span>{AREA_LABEL[area]}</span>
                <span style={{ display: "inline-flex", gap: "var(--s-2)", alignItems: "center" }}>
                  {area === "COMERCIAL" && onTodoComercial && !bloqueo && (
                    <button type="button" className="perm-link" onClick={onTodoComercial}>
                      Todo Comercial
                    </button>
                  )}
                  <small>
                    {conAcceso} de {mods.length}
                  </small>
                </span>
              </h4>
              {visibles.length === 0 ? (
                <p className="perm-hint">Nada que mostrar en esta área.</p>
              ) : (
                <div className="perm-mapa-chips">
                  {visibles.map(({ m, e }) => {
                    const corto = nivelCorto(e);
                    const pend = pendientes[m.id] !== undefined;
                    return (
                      <button
                        key={m.id}
                        ref={(el) => {
                          if (el) chips.current.set(m.id, el);
                          else chips.current.delete(m.id);
                        }}
                        type="button"
                        className="perm-mchip"
                        data-src={e.src}
                        data-sens={e.sensitive ? "true" : undefined}
                        data-pending={pend ? "true" : undefined}
                        aria-expanded={abierto === m.id}
                        aria-controls={abierto === m.id ? `perm-det-${m.id}` : undefined}
                        aria-label={`${m.label}: ${txtEstado(e)}${e.sensitive ? ", sensible" : ""}${pend ? ", cambio sin guardar" : ""}`}
                        onClick={() => setAbierto(abierto === m.id ? null : m.id)}
                      >
                        {e.src === "none" && <span aria-hidden>+</span>}
                        {e.src === "blocked" && <span aria-hidden>{Icon.lock(11)}</span>}
                        {m.label}
                        {corto && <span className="perm-mchip-lvl">{corto}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {(ocultos > 0 || verOcultos[area]) && (
                <button
                  type="button"
                  className="perm-link perm-more"
                  aria-expanded={!!verOcultos[area]}
                  onClick={() => setVerOcultos({ ...verOcultos, [area]: !verOcultos[area] })}
                >
                  {verOcultos[area]
                    ? "Ocultar los que todavía no se pueden dar"
                    : `${ocultos} todavía no se ${ocultos === 1 ? "puede" : "pueden"} dar como extra · ver`}
                </button>
              )}
              {detalle && (
                <Detalle
                  key={detalle.m.id}
                  id={`perm-det-${detalle.m.id}`}
                  label={detalle.m.label}
                  hoy={detalle.hoy}
                  grant={porId.get(detalle.m.id) ?? null}
                  seleccion={pendientes[detalle.m.id] ?? nivelActual(extras[detalle.m.id])}
                  rol={rol}
                  personasDelRol={personasDelRol}
                  nombres={nombres}
                  bloqueo={bloqueo}
                  onElegir={(n) => {
                    if (n !== "none" && detalle.hoy.sensitive) {
                      onSensible(detalle.m.id);
                      return;
                    }
                    onElegir(detalle.m.id, n);
                  }}
                  onCerrar={() => cerrar(detalle.m.id)}
                  onIrARoles={onIrARoles}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Detalle de un módulo ───────────────────────────────────────────────────

function Detalle({
  id,
  label,
  hoy,
  grant,
  seleccion,
  rol,
  personasDelRol,
  nombres,
  bloqueo,
  onElegir,
  onCerrar,
  onIrARoles,
}: {
  id: string;
  label: string;
  /** Estado guardado (sin la bandeja): de ahí sale el origen. */
  hoy: EstadoModulo;
  grant: UserModuleGrantView | null;
  seleccion: NivelExtra;
  rol: string;
  personasDelRol?: number;
  nombres: Record<string, string>;
  bloqueo: string | null;
  onElegir: (n: NivelExtra) => void;
  onCerrar: () => void;
  onIrARoles?: () => void;
}) {
  const grupo = useRef<HTMLDivElement>(null);
  const nivelRol = hoy.editByRole ? "ver y editar" : "solo ver";
  const loTienen =
    personasDelRol === undefined ? "" : personasDelRol === 1 ? " Lo tiene la única persona del rol." : ` Lo tienen las ${personasDelRol} personas del rol.`;
  const vigente = grant && !grant.expired ? grant : null;
  const dadoPor = grant?.grantedBy ? (nombres[grant.grantedBy] ?? "un admin") : "un admin";
  const origenExtra = grant
    ? `«${grant.reason}» · dado por ${dadoPor} · ${fechaCorta.format(new Date(grant.updatedAt))}${
        grant.expiresAt ? ` · ${grant.expired ? "venció" : "vence"} ${fechaCorta.format(new Date(grant.expiresAt))}` : ""
      }`
    : null;

  let origen: React.ReactNode;
  if (hoy.src === "admin") {
    origen = <>Un administrador ve y edita todos los módulos.</>;
  } else if (hoy.viewByRole) {
    origen = (
      <>
        <b>Por su rol {rol}</b>: {nivelRol}.{loTienen}
        {vigente && origenExtra && (
          <>
            {" "}
            Además tiene un <b>extra</b> ({vigente.canEdit ? "ver y editar" : "solo ver"}) · {origenExtra}
            {hoy.sobra ? ". Ese extra sobra: su rol ya lo da." : "."}
          </>
        )}
      </>
    );
  } else if (vigente && origenExtra) {
    origen = (
      <>
        <b>Extra</b> ({vigente.canEdit ? "ver y editar" : "solo ver"}) · {origenExtra}
      </>
    );
  } else {
    origen = (
      <>
        <b>Sin acceso</b>. Su rol {rol} no incluye {label}.
        {grant?.expired && origenExtra ? ` Tuvo un extra que venció · ${origenExtra}.` : ""}
      </>
    );
  }

  const tag =
    hoy.src === "grant" ? (
      <span className="perm-chip" data-kind="extra">
        Extra
      </span>
    ) : hoy.status.kind === "blocked" && !hoy.view ? (
      <span className="perm-chip" data-kind="off">
        No disponible
      </span>
    ) : null;

  // Qué opciones tiene sentido mostrar.
  const conExtra = !!vigente;
  const puedeOpciones = hoy.src !== "admin" && (hoy.status.kind === "grantable" || hoy.status.kind === "role_view");
  const soloQuitar = !puedeOpciones && conExtra && hoy.src !== "admin";

  type Opcion = { n: NivelExtra; titulo: string; sub: string; off: string | null };
  const opciones: Opcion[] = [
    {
      n: "none",
      titulo: conExtra ? "Quitar extra" : "Sin extra",
      sub: conExtra ? "Deja de tenerlo al guardar." : hoy.viewByRole ? "Queda como su rol: solo ver." : "Queda como su rol.",
      off: null,
    },
    {
      n: "view",
      titulo: "Solo ver",
      sub: `Abre ${label} sin poder cambiar nada.`,
      off: hoy.viewByRole ? "Ya lo ve por su rol." : null,
    },
    {
      n: "edit",
      titulo: "Ver y editar",
      sub: `Puede crear y modificar en ${label}.`,
      off: hoy.soloVer ? (hoy.moduleId === "users" || hoy.moduleId === "admin" ? "Este acceso solo puede ser de ver." : "Soporte nunca edita.") : null,
    },
  ];
  const habilitadas = opciones.filter((o) => !o.off && !bloqueo);

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    if (habilitadas.length === 0) return;
    const i = Math.max(0, habilitadas.findIndex((o) => o.n === seleccion));
    const paso = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const sig = habilitadas[(i + paso + habilitadas.length) % habilitadas.length];
    onElegir(sig.n);
    queueMicrotask(() => grupo.current?.querySelector<HTMLButtonElement>(`[data-n="${sig.n}"]`)?.focus());
  }

  return (
    <div
      id={id}
      className="perm-insp"
      role="region"
      aria-label={`Detalle de ${label}`}
    >
      <div className="perm-insp-top">
        <div>
          <strong>{label}</strong> {tag}
          {hoy.sensitive && (
            <span className="perm-chip" data-kind="sens" style={{ marginLeft: 4 }}>
              Sensible
            </span>
          )}
          <p className="perm-origin">{origen}</p>
        </div>
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onCerrar} aria-label={`Cerrar detalle de ${label}`}>
          Cerrar
        </button>
      </div>

      {bloqueo && hoy.src !== "admin" && <p className="perm-hint">{bloqueo}</p>}

      {puedeOpciones && (
        <div ref={grupo} className="perm-opts" role="radiogroup" aria-label={`Acceso extra a ${label}`} onKeyDown={onKey}>
          {opciones.map((o) => {
            const off = !!o.off || !!bloqueo;
            const marcada = seleccion === o.n;
            return (
              <button
                key={o.n}
                type="button"
                role="radio"
                data-n={o.n}
                className="perm-opt-big"
                aria-checked={marcada}
                tabIndex={marcada && !off ? 0 : habilitadas[0]?.n === o.n && !habilitadas.some((h) => h.n === seleccion) ? 0 : -1}
                disabled={off}
                aria-describedby={`${id}-${o.n}`}
                onClick={() => onElegir(o.n)}
              >
                <b>{o.titulo}</b>
                <span id={`${id}-${o.n}`}>{o.off ?? o.sub}</span>
              </button>
            );
          })}
        </div>
      )}

      {soloQuitar && !bloqueo && (
        <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            aria-pressed={seleccion === "none"}
            onClick={() => onElegir(seleccion === "none" ? (vigente?.canEdit ? "edit" : "view") : "none")}
          >
            {seleccion === "none" ? "Conservar el extra" : hoy.sobra ? "Quitar el extra que sobra" : "Quitar extra"}
          </button>
          {seleccion === "none" && <span className="perm-hint">Se quita al guardar.</span>}
        </div>
      )}

      {hoy.src === "role" && !hoy.sobra && hoy.status.kind === "role_full" && (
        <p className="perm-hint">
          Un extra no le suma nada aquí. Para cambiarlo a todo el rol, usa{" "}
          {onIrARoles ? (
            <button type="button" className="perm-link" onClick={onIrARoles}>
              Roles y permisos
            </button>
          ) : (
            "Roles y permisos"
          )}
          {hoy.sensitive ? " (dinero y administración no se cambian por rol)" : ""}. Los extras solo suman: no quitan lo que da el rol.
        </p>
      )}

      {hoy.status.kind === "blocked" && !hoy.viewByRole && (
        <div className="perm-blocked-why">
          <b>Todavía no se puede dar como extra.</b> {COVERAGE_HINT[hoy.status.coverage]}
        </div>
      )}

      {puedeOpciones && hoy.sensitive && <p className="perm-hint">Sensible: al elegirlo se abre el doble aviso.</p>}
      {puedeOpciones && seleccion !== nivelActualDe(grant) && (
        <p className="perm-hint">
          Va a la bandeja de abajo: {NIVEL_LARGO[seleccion]}. Se guarda con un motivo.
        </p>
      )}
    </div>
  );
}

function nivelActualDe(g: UserModuleGrantView | null): NivelExtra {
  if (!g || g.expired) return "none";
  return g.canEdit ? "edit" : "view";
}
