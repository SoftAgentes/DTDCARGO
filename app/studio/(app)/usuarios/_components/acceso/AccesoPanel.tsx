"use client";

/**
 * Pestaña «Acceso» de la ficha (SDD-0622 §5.4).
 *
 *   1. Rol base (selector segmentado; el cambio pide motivo, como siempre).
 *   2. Accesos extra: buscador «Agregar módulo o área…», Ver/Editar, motivo,
 *      vencimiento y quitar. Los módulos que la base todavía no acepta se ven
 *      con el motivo y no se pueden elegir (§5.3: no prometer lo que la base niega).
 *   3. «Lo que puede ver»: el acceso efectivo por área con la fuente de cada
 *      permiso (rol · extra · sensible). Nadie tiene que preguntarse por qué
 *      alguien tiene algo: la pantalla lo dice (objeción de la SDD-0139).
 *
 * Toda escritura va por `grantUserModuleAction` / `revokeUserModuleGrantAction`
 * (admin + RPC de la 0529). La ficha no se cierra: `revalidatePath` la redibuja.
 */

import { useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { MODULES, type ModuleDef } from "@/lib/studio/modules";
import {
  MONEY_MODULES,
  effectiveModuleAccess,
  type RoleModuleOverrides,
  type UserModuleGrants,
} from "@/lib/studio/rbac";
import {
  AREA_LABEL,
  AREA_ORDER,
  COMMERCIAL_COVERED,
  COVERAGE_HINT,
  COVERAGE_LABEL,
  grantViewOnly,
  grantableStatus,
  isSensitiveModule,
  reasonError,
  type GrantableStatus,
} from "@/lib/studio/user-module-grants";
import type { UserModuleGrantView } from "@/lib/studio/user-module-grants-queries";
import type { UserMembershipWithProfile } from "@/lib/studio/user-types";
import { grantUserModuleAction, revokeUserModuleGrantAction } from "../../actions";
import { RolYAlcanceCard } from "../ficha/RolYAlcanceCard";
import { DobleAvisoDialog, type DobleAvisoResultado } from "./DobleAvisoDialog";
import "./permisos.css";

const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));
const fechaCorta = new Intl.DateTimeFormat("es-VE", { day: "numeric", month: "short", timeZone: "America/Caracas" });

export function moduleLabel(id: string): string {
  return MODULE_BY_ID.get(id)?.label ?? id;
}

function areaDe(id: string): string {
  const g = MODULE_BY_ID.get(id)?.group;
  return g ? AREA_LABEL[g] : "Otro";
}

/** Extras vigentes en el formato que entienden `canAccessModule` y compañía. */
export function grantsMap(grants: readonly UserModuleGrantView[]): UserModuleGrants {
  const out: Record<string, { view: boolean; edit: boolean; expiresAt: string | null }> = {};
  for (const g of grants) {
    if (g.expired) continue;
    out[g.moduleId] = { view: g.canView, edit: g.canEdit, expiresAt: g.expiresAt };
  }
  return out;
}

export function AccesoPanel({
  member,
  grants,
  overrides,
  nombres,
  esYo,
}: {
  member: UserMembershipWithProfile;
  /** Extras de ESTA persona (vigentes y vencidos). */
  grants: UserModuleGrantView[];
  overrides: RoleModuleOverrides;
  /** userId → nombre, para «dado por». */
  nombres: Record<string, string>;
  esYo?: boolean;
}) {
  const persona = nombreCorto(member);
  const esAdmin = member.role === "admin";
  const desactivado = member.disabled_at !== null;
  const bloqueo = esYo
    ? "No puedes darte accesos a ti mismo."
    : esAdmin
      ? "Un administrador ya ve y edita todos los módulos."
      : desactivado
        ? "La persona está suspendida: reactívala para darle accesos."
        : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      <section aria-labelledby="perm-rol-base">
        <h3 id="perm-rol-base" className="perm-label">
          Rol base
        </h3>
        <RolYAlcanceCard member={member} esYo={esYo} />
      </section>

      <AccesosExtra member={member} persona={persona} grants={grants} overrides={overrides} nombres={nombres} bloqueo={bloqueo} />

      <LoQuePuedeVer member={member} grants={grants} overrides={overrides} />
    </div>
  );
}

// ─── Accesos extra ──────────────────────────────────────────────────────────

type Borrador = { moduleId: string; canEdit: boolean; reason: string; expiresOn: string };

function AccesosExtra({
  member,
  persona,
  grants,
  overrides,
  nombres,
  bloqueo,
}: {
  member: UserMembershipWithProfile;
  persona: string;
  grants: UserModuleGrantView[];
  overrides: RoleModuleOverrides;
  nombres: Record<string, string>;
  bloqueo: string | null;
}) {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [sensible, setSensible] = useState<string | null>(null);
  const [quitar, setQuitar] = useState<UserModuleGrantView | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [errorDialogo, setErrorDialogo] = useState<string | undefined>();
  const [pendiente, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const yaTiene = new Set(grants.map((g) => g.moduleId));
  const vigentes = grants.filter((g) => !g.expired).length;

  const q = normalizar(busqueda.trim());
  const opciones = MODULES.filter((m) => !m.hidden && !yaTiene.has(m.id))
      .filter((m) => !q || normalizar(`${m.label} ${AREA_LABEL[m.group]}`).includes(q))
      .map((m) => ({ m, estado: grantableStatus(member.role, m.id, overrides) }))
    .sort((a, b) => AREA_ORDER.indexOf(a.m.group) - AREA_ORDER.indexOf(b.m.group) || orden(a.estado) - orden(b.estado));
  const elegibles = opciones.filter((o) => o.estado.kind === "grantable" || o.estado.kind === "role_view");

  function elegir(m: ModuleDef) {
    setError(undefined);
    setAbierto(false);
    setBusqueda("");
    const est = grantableStatus(member.role, m.id, overrides);
    if (isSensitiveModule(m.id)) {
      setErrorDialogo(undefined);
      setSensible(m.id);
      return;
    }
    setBorrador({
      moduleId: m.id,
      // Si el rol ya deja ver, lo único que suma un extra es editar.
      canEdit: est.kind === "role_view" && !grantViewOnly(m.id, member.role),
      reason: "",
      expiresOn: "",
    });
  }

  function guardar(input: { moduleId: string; canEdit: boolean; reason: string; expiresOn: string | null; confirm: boolean }, alTerminar?: () => void) {
    startTransition(async () => {
      const res = await grantUserModuleAction({
        targetUserId: member.user_id,
        moduleId: input.moduleId,
        canEdit: input.canEdit,
        reason: input.reason,
        expiresOn: input.expiresOn,
        confirmSensitive: input.confirm,
      });
      if (res.error) {
        setError(res.error);
        setErrorDialogo(res.error);
        return;
      }
      setError(undefined);
      alTerminar?.();
      toast.success(`${moduleLabel(input.moduleId)} ${input.canEdit ? "(ver y editar)" : "(solo ver)"} para ${persona}`);
    });
  }

  function cambiarModo(g: UserModuleGrantView, canEdit: boolean) {
    if (g.canEdit === canEdit) return;
    guardar({
      moduleId: g.moduleId,
      canEdit,
      reason: g.reason,
      expiresOn: g.expiresAt ? g.expiresAt.slice(0, 10) : null,
      confirm: g.sensitive,
    });
  }

  function onKeyBuscador(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActivo((i) => Math.min(i + 1, Math.max(elegibles.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = elegibles[activo];
      if (o) elegir(o.m);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  const sensibleDef = sensible ? MODULE_BY_ID.get(sensible) : null;

  return (
    <section aria-labelledby="perm-extras">
      <h3 id="perm-extras" className="perm-label">
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          Accesos extra <span className="perm-chip" data-kind="extra">{vigentes}</span>
        </span>
        {!bloqueo && COMMERCIAL_COVERED.some((id) => !yaTiene.has(id)) && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-xs"
            style={{ textTransform: "none", letterSpacing: 0 }}
            onClick={() => {
              const faltan = COMMERCIAL_COVERED.filter((id) => grantableStatus(member.role, id, overrides).kind === "grantable" && !yaTiene.has(id));
              if (faltan.length === 0) {
                setError("Su rol ya ve todo lo comercial que se puede conceder.");
                return;
              }
              setBorrador({ moduleId: faltan.join(","), canEdit: true, reason: "", expiresOn: "" });
            }}
          >
            Agregar todo Comercial
          </button>
        )}
      </h3>

      <div className="perm-card">
        {bloqueo ? (
          <p className="perm-empty">{bloqueo}</p>
        ) : (
          <div className="perm-add">
            <span className="perm-add-icon" aria-hidden>
              {Icon.plus(14)}
            </span>
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded={abierto}
              aria-controls="perm-opciones"
              aria-autocomplete="list"
              aria-label="Agregar módulo o área"
              placeholder="Agregar módulo o área…"
              value={busqueda}
              disabled={pendiente}
              onFocus={() => setAbierto(true)}
              onBlur={() => setTimeout(() => setAbierto(false), 150)}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setAbierto(true);
                setActivo(0);
              }}
              onKeyDown={onKeyBuscador}
            />
            <span className="perm-add-kbd" aria-hidden>
              ↓
            </span>
          </div>
        )}

        {abierto && !bloqueo && (
          <div id="perm-opciones" role="listbox" aria-label="Módulos" className="perm-options">
            {opciones.length === 0 && <p className="perm-empty">Ningún módulo coincide.</p>}
            {AREA_ORDER.map((area) => {
              const delArea = opciones.filter((o) => o.m.group === area);
              if (delArea.length === 0) return null;
              return (
                <div key={area} role="group" aria-label={AREA_LABEL[area]}>
                  <div className="perm-opt-group">{AREA_LABEL[area]}</div>
                  {delArea.map(({ m, estado }) => {
                    const ok = estado.kind === "grantable" || estado.kind === "role_view";
                    const idx = elegibles.findIndex((o) => o.m.id === m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={idx === activo}
                        data-active={idx === activo ? "true" : undefined}
                        className="perm-opt"
                        disabled={!ok}
                        title={notaTitle(estado)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => ok && elegir(m)}
                      >
                        {m.label}
                        {isSensitiveModule(m.id) && (
                          <span className="perm-chip" data-kind="sens">
                            Sensible
                          </span>
                        )}
                        <span className="perm-opt-note">{nota(estado)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {borrador && (
          <FormAlta
            borrador={borrador}
            onCambio={setBorrador}
            soloVer={grantViewOnly(borrador.moduleId, member.role)}
            pending={pendiente}
            onCancel={() => {
              setBorrador(null);
              setError(undefined);
            }}
            onGuardar={() => {
              const err = reasonError(borrador.reason);
              if (err) {
                setError(err);
                return;
              }
              const ids = borrador.moduleId.split(",");
              startTransition(async () => {
                for (const id of ids) {
                  const res = await grantUserModuleAction({
                    targetUserId: member.user_id,
                    moduleId: id,
                    canEdit: borrador.canEdit && !grantViewOnly(id, member.role),
                    reason: borrador.reason,
                    expiresOn: borrador.expiresOn || null,
                    confirmSensitive: false,
                  });
                  if (res.error) {
                    setError(`${moduleLabel(id)}: ${res.error}`);
                    return;
                  }
                }
                toast.success(
                  ids.length > 1
                    ? `${ids.length} módulos comerciales concedidos a ${persona}`
                    : `${moduleLabel(ids[0])} concedido a ${persona}`,
                );
                setBorrador(null);
                setError(undefined);
              });
            }}
          />
        )}

        {grants.length === 0 && !borrador && !bloqueo && (
          <p className="perm-empty">Sin accesos extra: ve exactamente lo que da su rol.</p>
        )}

        {grants.map((g) => {
          const soloVer = grantViewOnly(g.moduleId, member.role);
          const dadoPor = g.grantedBy ? (nombres[g.grantedBy] ?? "un admin") : "un admin";
          const vence = g.expiresAt ? `${g.expired ? "venció" : "vence"} ${fechaCorta.format(new Date(g.expiresAt))}` : null;
          // Un extra que el rol ya cubre no suma nada hoy (p. ej. tras un cambio de rol): se dice.
          const porRol = effectiveModuleAccess(member.role, g.moduleId, overrides);
          const redundante = porRol.viewByRole && (porRol.editByRole || !g.canEdit);
          return (
            <div key={g.moduleId} className="perm-grant" data-expired={g.expired ? "true" : undefined}>
              <div>
                <div className="perm-grant-title">
                  {moduleLabel(g.moduleId)}
                  {g.sensitive && (
                    <span className="perm-chip" data-kind="sens">
                      Sensible
                    </span>
                  )}
                  {g.expired && (
                    <span className="perm-chip" data-kind="expired">
                      Vencido
                    </span>
                  )}
                  {!g.expired && redundante && (
                    <span className="perm-chip" data-kind="off" title="Su rol ya da este permiso; puedes quitar el extra.">
                      Su rol ya lo da
                    </span>
                  )}
                </div>
                <div className="perm-grant-sub">
                  {areaDe(g.moduleId)} · «{g.reason}» · dado por {dadoPor} · {fechaCorta.format(new Date(g.updatedAt))}
                  {vence ? ` · ${vence}` : ""}
                </div>
              </div>
              <div className="perm-mini" role="radiogroup" aria-label={`Permiso sobre ${moduleLabel(g.moduleId)}`}>
                <button type="button" role="radio" aria-checked={!g.canEdit} disabled={pendiente || !!bloqueo} onClick={() => cambiarModo(g, false)}>
                  Ver
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={g.canEdit}
                  disabled={pendiente || !!bloqueo || soloVer}
                  title={soloVer ? "Este acceso es solo para ver" : undefined}
                  onClick={() => cambiarModo(g, true)}
                >
                  Editar
                </button>
              </div>
              <button
                type="button"
                className="perm-icon-btn"
                aria-label={`Quitar ${moduleLabel(g.moduleId)}`}
                disabled={pendiente}
                onClick={() => {
                  setError(undefined);
                  setQuitar(g);
                }}
              >
                {Icon.close(14)}
              </button>
            </div>
          );
        })}
      </div>

      {error && !quitar && !sensible && (
        <p role="alert" style={{ margin: "var(--s-2) 0 0", font: "600 12px/1.45 var(--f-sans)", color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <p style={{ margin: "var(--s-2) 0 0", font: "400 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
        Los accesos extra solo suman al rol. No dan acciones de anular, borrar ni aprobar: esas siguen atadas al rol.
      </p>

      {sensibleDef && (
        <DobleAvisoDialog
          open
          persona={persona}
          moduleId={sensibleDef.id}
          moduleLabel={sensibleDef.label}
          dinero={MONEY_MODULES.has(sensibleDef.id)}
          soloVer={grantViewOnly(sensibleDef.id, member.role)}
          pending={pendiente}
          error={errorDialogo}
          onCancel={() => setSensible(null)}
          onConfirm={(r: DobleAvisoResultado) =>
            guardar({ moduleId: sensibleDef.id, canEdit: r.canEdit, reason: r.reason, expiresOn: r.expiresOn, confirm: true }, () =>
              setSensible(null),
            )
          }
        />
      )}

      <ConfirmDialog
        open={quitar !== null}
        danger
        reason
        reasonRequired
        reasonLabel="Motivo · mínimo 5 caracteres"
        reasonPlaceholder="Ej: volvió María y ya no atiende el CRM"
        initialFocus="reason"
        title={quitar ? `Quitar ${moduleLabel(quitar.moduleId)} a ${persona}` : "Quitar acceso"}
        message="Deja de verlo al instante. Queda en Actividad con tu nombre y el motivo."
        confirmLabel="Quitar acceso"
        pending={pendiente}
        error={quitar ? error : undefined}
        onCancel={() => {
          if (pendiente) return;
          setQuitar(null);
          setError(undefined);
        }}
        onConfirm={(motivo) => {
          const err = reasonError(motivo);
          if (err || !quitar) {
            setError(err ?? undefined);
            return;
          }
          const g = quitar;
          startTransition(async () => {
            const res = await revokeUserModuleGrantAction({
              targetUserId: member.user_id,
              moduleId: g.moduleId,
              reason: motivo.trim(),
            });
            if (res.error) {
              setError(res.error);
              return;
            }
            setQuitar(null);
            setError(undefined);
            toast.success(`${moduleLabel(g.moduleId)} quitado a ${persona}`);
          });
        }}
      />
    </section>
  );
}

function FormAlta({
  borrador,
  onCambio,
  soloVer,
  pending,
  onCancel,
  onGuardar,
}: {
  borrador: Borrador;
  onCambio: (b: Borrador) => void;
  soloVer: boolean;
  pending: boolean;
  onCancel: () => void;
  onGuardar: () => void;
}) {
  const ids = borrador.moduleId.split(",");
  const titulo = ids.length > 1 ? `Todo Comercial (${ids.map(moduleLabel).join(", ")})` : moduleLabel(ids[0]);
  return (
    <div className="perm-form" role="group" aria-label={`Agregar ${titulo}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>{titulo}</strong>
        <div className="perm-mini" role="radiogroup" aria-label="Permiso">
          <button type="button" role="radio" aria-checked={!borrador.canEdit} disabled={pending} onClick={() => onCambio({ ...borrador, canEdit: false })}>
            Ver
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={borrador.canEdit}
            disabled={pending || soloVer}
            onClick={() => onCambio({ ...borrador, canEdit: true })}
          >
            Editar
          </button>
        </div>
      </div>
      <div className="perm-form-row">
        <div>
          <label className="studio-label" htmlFor="perm-motivo">
            Motivo (obligatorio)
          </label>
          <input
            id="perm-motivo"
            className="studio-input"
            autoFocus
            maxLength={500}
            placeholder="Ej: atiende leads mientras María está de viaje"
            value={borrador.reason}
            disabled={pending}
            onChange={(e) => onCambio({ ...borrador, reason: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onGuardar();
              }
            }}
          />
        </div>
        <div>
          <label className="studio-label" htmlFor="perm-vence">
            Vence (opcional)
          </label>
          <input
            id="perm-vence"
            type="date"
            className="studio-input"
            value={borrador.expiresOn}
            disabled={pending}
            onChange={(e) => onCambio({ ...borrador, expiresOn: e.target.value })}
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" disabled={pending} onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" disabled={pending} aria-busy={pending} onClick={onGuardar}>
          {pending ? "Guardando…" : "Agregar acceso"}
        </button>
      </div>
    </div>
  );
}

// ─── Lo que puede ver ───────────────────────────────────────────────────────

function LoQuePuedeVer({
  member,
  grants,
  overrides,
}: {
  member: UserMembershipWithProfile;
  grants: UserModuleGrantView[];
  overrides: RoleModuleOverrides;
}) {
  const extras = grantsMap(grants);
  const areas = AREA_ORDER.map((area) => {
    const mods = MODULES.filter((m) => m.group === area && !m.hidden);
    const acc = mods.map((m) => ({ m, a: effectiveModuleAccess(member.role, m.id, overrides, extras) }));
    return { area, total: mods.length, visibles: acc.filter((x) => x.a.view) };
  });
  const desactivado = member.disabled_at !== null;

  return (
    <section aria-labelledby="perm-efectivo">
      <h3 id="perm-efectivo" className="perm-label">
        Lo que puede ver
        <span className="perm-legend">
          <span>
            <i style={{ background: "var(--neutral-bg)" }} />
            Rol
          </span>
          <span>
            <i style={{ background: "var(--cat-2-bg)", boxShadow: "inset 0 0 0 1px var(--cat-2)" }} />
            Extra
          </span>
          <span>
            <i style={{ boxShadow: "inset 0 0 0 1px var(--warning)" }} />
            Sensible
          </span>
        </span>
      </h3>
      {desactivado && (
        <p className="perm-empty" style={{ paddingLeft: 0 }}>
          Suspendida: hoy no ve nada. Esto es lo que vería al reactivarla.
        </p>
      )}
      <div className="perm-areas">
        {areas.map(({ area, total, visibles }) => (
          <div key={area} className="perm-area">
            <h4>
              {AREA_LABEL[area]} <small>{visibles.length} de {total}</small>
            </h4>
            {visibles.length === 0 ? (
              <span style={{ font: "400 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>Nada en esta área.</span>
            ) : (
              <ul className="perm-mods" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {visibles.map(({ m, a }) => (
                  <li
                    key={m.id}
                    className="perm-m"
                    data-src={a.source === "grant" ? "grant" : undefined}
                    data-sens={isSensitiveModule(m.id) ? "true" : undefined}
                    data-edit={a.edit ? undefined : "false"}
                    title={
                      a.source === "grant"
                        ? `Acceso extra · ${a.edit ? "ver y editar" : "solo ver"}`
                        : `Por su rol · ${a.edit ? "ver y editar" : "solo ver"}`
                    }
                  >
                    {m.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function nota(e: GrantableStatus): string {
  if (e.kind === "role_full") return "Ya lo da su rol";
  if (e.kind === "role_view") return "Su rol ya lo ve · suma editar";
  if (e.kind === "blocked") return COVERAGE_LABEL[e.coverage];
  return "";
}

function notaTitle(e: GrantableStatus): string | undefined {
  return e.kind === "blocked" ? COVERAGE_HINT[e.coverage] : undefined;
}

function orden(e: GrantableStatus): number {
  return e.kind === "grantable" ? 0 : e.kind === "role_view" ? 1 : e.kind === "blocked" ? 2 : 3;
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function nombreCorto(m: UserMembershipWithProfile): string {
  const n = `${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`.trim();
  return n || m.email;
}
