"use client";

/**
 * Pestaña «Acceso» de la ficha (SDD-0622 §5.4, rediseñada por la SDD-0635).
 *
 *   1. Franja «solo para <persona>»: lo que se cambia aquí no toca a las otras
 *      personas del rol; la vía para todo el rol es «Roles y permisos» (§3.4).
 *   2. Rol base (selector segmentado; el cambio pide motivo, como siempre).
 *   3. «Lo que puede hacer» (`MapaAcceso`): todos los módulos por área con su
 *      estado y su origen escritos; al tocar uno, tres opciones a la vista.
 *   4. Bandeja (`CambiosPendientes`): elegir no guarda; un motivo y un
 *      «Guardar» para todo, una llamada por módulo con el mismo motivo.
 *
 * Toda escritura va por `grantUserModuleAction` / `revokeUserModuleGrantAction`
 * (admin + RPC de la 0538): mismas firmas, misma regla «solo suma». La ficha no
 * se cierra: `revalidatePath` la redibuja con los extras nuevos.
 *
 * Fallo a medias (§3.3): si un módulo falla, los anteriores ya quedaron
 * guardados; la bandeja conserva solo los que faltan y dice cuál falló.
 */

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { MODULES } from "@/lib/studio/modules";
import { MONEY_MODULES, type RoleModuleOverrides, type UserModuleGrants } from "@/lib/studio/rbac";
import {
  COMMERCIAL_COVERED,
  fechaCaracas,
  grantViewOnly,
  grantableStatus,
  type NivelExtra,
} from "@/lib/studio/user-module-grants";
import type { UserModuleGrantView } from "@/lib/studio/user-module-grants-queries";
import { ROLE_LABELS, type UserMembershipWithProfile } from "@/lib/studio/user-types";
import { grantUserModuleAction, revokeUserModuleGrantAction } from "../../actions";
import { RolYAlcanceCard } from "../ficha/RolYAlcanceCard";
import { CambiosPendientes, type CambioPendiente } from "./CambiosPendientes";
import { DobleAvisoDialog, type DobleAvisoResultado } from "./DobleAvisoDialog";
import { MapaAcceso, extrasPorModulo, nivelActual } from "./MapaAcceso";
import "./permisos.css";

const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function moduleLabel(id: string): string {
  return MODULE_BY_ID.get(id)?.label ?? id;
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
  personasDelRol,
  onIrARoles,
  onPendientes,
}: {
  member: UserMembershipWithProfile;
  /** Extras de ESTA persona (vigentes y vencidos). */
  grants: UserModuleGrantView[];
  overrides: RoleModuleOverrides;
  /** userId → nombre, para «dado por». */
  nombres: Record<string, string>;
  esYo?: boolean;
  /** Cuántas personas activas tienen su rol (para «el rol es el piso»). */
  personasDelRol?: number;
  /** Lleva a la pestaña «Roles y permisos» (cambios para todo el rol). */
  onIrARoles?: () => void;
  /** Avisa cuántos cambios quedan sin guardar (para pedir confirmar al cerrar). */
  onPendientes?: (n: number) => void;
}) {
  const toast = useToast();
  const persona = nombreCorto(member);
  const rol = ROLE_LABELS[member.role];
  const esAdmin = member.role === "admin";
  const desactivado = member.disabled_at !== null;
  const bloqueo = esYo
    ? "No puedes darte accesos a ti mismo."
    : esAdmin
      ? "Un administrador ya ve y edita todos los módulos."
      : desactivado
        ? "La persona está suspendida: reactívala para darle accesos."
        : null;

  const [pendientes, setPendientes] = useState<Record<string, NivelExtra>>({});
  const [error, setError] = useState<string | undefined>();
  const [resultado, setResultado] = useState<string | null>(null);
  const [sensible, setSensible] = useState<string | null>(null);
  const [errorDialogo, setErrorDialogo] = useState<string | undefined>();
  const [pendiente, startTransition] = useTransition();

  const extras = extrasPorModulo(grants);
  const porId = new Map(grants.map((g) => [g.moduleId, g]));
  const n = Object.keys(pendientes).length;

  useEffect(() => {
    onPendientes?.(n);
  }, [n, onPendientes]);

  function elegir(moduleId: string, nivel: NivelExtra) {
    setResultado(null);
    setError(undefined);
    setPendientes((prev) => {
      const next = { ...prev };
      if (nivel === nivelActual(extras[moduleId])) delete next[moduleId];
      else next[moduleId] = nivel;
      return next;
    });
  }

  function todoComercial() {
    setResultado(null);
    const faltan = COMMERCIAL_COVERED.filter(
      (id) => grantableStatus(member.role, id, overrides).kind === "grantable" && nivelActual(extras[id]) === "none",
    );
    if (faltan.length === 0) {
      setError("Su rol ya da todo lo comercial que se puede dar, o ya lo tiene como extra.");
      return;
    }
    setError(undefined);
    setPendientes((prev) => {
      const next = { ...prev };
      for (const id of faltan) next[id] = grantViewOnly(id, member.role) ? "view" : "edit";
      return next;
    });
  }

  const cambios: CambioPendiente[] = Object.entries(pendientes)
    .map(([moduleId, nivel]) => ({
      moduleId,
      label: moduleLabel(moduleId),
      nivel,
      teniaExtra: nivelActual(extras[moduleId]) !== "none",
    }))
    .sort((a, b) => MODULES.findIndex((m) => m.id === a.moduleId) - MODULES.findIndex((m) => m.id === b.moduleId));

  function guardarTodo(input: { reason: string; expiresOn: string | null }) {
    setError(undefined);
    setResultado(null);
    const lista = [...cambios];
    startTransition(async () => {
      let guardados = 0;
      // SDD-0675: guardado pero Chatwoot pendiente (Bandeja). Se avisa una vez.
      let aviso: string | null = null;
      for (const c of lista) {
        const g = porId.get(c.moduleId);
        const res =
          c.nivel === "none"
            ? await llamar(() => revokeUserModuleGrantAction({ targetUserId: member.user_id, moduleId: c.moduleId, reason: input.reason }))
            : await llamar(() =>
                grantUserModuleAction({
                  targetUserId: member.user_id,
                  moduleId: c.moduleId,
                  canEdit: c.nivel === "edit" && !grantViewOnly(c.moduleId, member.role),
                  reason: input.reason,
                  // Vacío: un extra que ya tenía vencimiento lo conserva.
                  expiresOn: input.expiresOn ?? (g && !g.expired ? fechaCaracas(g.expiresAt) : null),
                  confirmSensitive: false,
                }),
              );
        if (res.error) {
          const quedan = lista.slice(guardados);
          setPendientes(Object.fromEntries(quedan.map((q) => [q.moduleId, q.nivel])));
          setError(
            `${c.label}: ${res.error}${guardados > 0 ? ` Los ${guardados === 1 ? "cambio anterior quedó guardado" : `${guardados} cambios anteriores quedaron guardados`}.` : ""}`,
          );
          if (guardados > 0) setResultado(`${guardados} ${guardados === 1 ? "cambio guardado" : "cambios guardados"} para ${persona}.`);
          if (aviso) toast.warning(aviso);
          return;
        }
        if (res.aviso) aviso = res.aviso;
        guardados += 1;
      }
      setPendientes({});
      const msg = `${guardados} ${guardados === 1 ? "cambio guardado" : "cambios guardados"} para ${persona}.`;
      setResultado(aviso ? `${msg} ${aviso}` : msg);
      toast.success(msg);
      if (aviso) toast.warning(aviso);
    });
  }

  const sensibleDef = sensible ? MODULE_BY_ID.get(sensible) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      {!esAdmin && (
        <div className="perm-scope-band" role="note">
          <span className="perm-scope-ic" aria-hidden>
            i
          </span>
          <p>
            Lo que cambies aquí es <b>solo para {persona}</b>. No toca a las otras personas de {rol}. Para cambiar a todo el
            rol usa{" "}
            {onIrARoles ? (
              <button type="button" className="perm-link" onClick={onIrARoles}>
                Roles y permisos
              </button>
            ) : (
              "Roles y permisos"
            )}
            .
          </p>
        </div>
      )}

      {bloqueo && <p className="perm-hint">{bloqueo}</p>}

      <section aria-labelledby="perm-rol-base">
        <h3 id="perm-rol-base" className="perm-label">
          Rol base
        </h3>
        <RolYAlcanceCard
          member={member}
          esYo={esYo}
          personasDelRol={personasDelRol}
          extrasVigentes={grants.filter((g) => !g.expired).map((g) => moduleLabel(g.moduleId))}
        />
      </section>

      <MapaAcceso
        member={member}
        grants={grants}
        overrides={overrides}
        pendientes={pendientes}
        nombres={nombres}
        personasDelRol={personasDelRol}
        bloqueo={bloqueo}
        onElegir={elegir}
        onSensible={(id) => {
          setErrorDialogo(undefined);
          setSensible(id);
        }}
        onTodoComercial={todoComercial}
        onIrARoles={onIrARoles}
      />

      {resultado && (
        <p role="status" className="perm-ok">
          {resultado}
        </p>
      )}
      {error && n === 0 && (
        <p role="alert" className="perm-error">
          {error}
        </p>
      )}

      <p className="perm-hint">
        Los accesos extra solo suman al rol. No dan acciones de anular, borrar ni aprobar: esas siguen atadas al rol.
      </p>

      {cambios.length > 0 && (
      <CambiosPendientes
        persona={persona}
        rol={rol}
        cambios={cambios}
        pending={pendiente}
        error={n > 0 ? error : undefined}
        onDeshacer={(id) =>
          setPendientes((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          })
        }
        onDescartar={() => {
          setPendientes({});
          setError(undefined);
        }}
        onGuardar={guardarTodo}
      />
      )}

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
            startTransition(async () => {
              const res = await llamar(() =>
                grantUserModuleAction({
                  targetUserId: member.user_id,
                  moduleId: sensibleDef.id,
                  canEdit: r.canEdit,
                  reason: r.reason,
                  expiresOn: r.expiresOn,
                  confirmSensitive: true,
                }),
              );
              if (res.error) {
                setErrorDialogo(res.error);
                return;
              }
              setSensible(null);
              const msg = `${sensibleDef.label} (${r.canEdit ? "ver y editar" : "solo ver"}) guardado para ${persona}.`;
              setResultado(msg);
              toast.success(msg);
            })
          }
        />
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SIN_CONEXION = "No se pudo guardar: se cortó la conexión. Revisa tu red e intenta de nuevo.";

/**
 * Una acción de servidor que LANZA (corte de red, servidor caído) no devuelve
 * `{ error }`: sin esto el usuario no vería nada. Se traduce al mismo formato
 * de error del panel.
 */
type ResultadoAccion = { ok?: true; error?: string; aviso?: string };

async function llamar(fn: () => Promise<ResultadoAccion>): Promise<ResultadoAccion> {
  try {
    return await fn();
  } catch {
    return { error: SIN_CONEXION };
  }
}

function nombreCorto(m: UserMembershipWithProfile): string {
  const n = `${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`.trim();
  return n || m.email;
}
