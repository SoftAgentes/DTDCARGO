"use client";

/**
 * Rol y alcance dentro de la ficha de la persona (SDD-0273 · Slice 1).
 *
 * QUÉ ARREGLA. Hasta acá el rol y el almacén sólo se cambiaban desde dos
 * `<select>` metidos en la fila de la tabla que hacían `requestSubmit()` en el
 * `onChange`: elegir una opción por accidente —o con el teclado, recorriendo la
 * lista— aplicaba el cambio y lo escribía en la auditoría sin preguntar nada.
 * Cambiar de rol es la operación más fuerte del módulo después de suspender.
 *
 * CÓMO QUEDA. Los selectores no aplican nada solos: hay un botón **Aplicar**
 * explícito que abre un `ConfirmDialog` nombrando a la persona, el cambio
 * concreto y su consecuencia, con **motivo obligatorio**. Eso es lo que pide
 * MP-01 para una acción de esta fuerza, y es lo que hace que AUD-01 §3 deje de
 * cumplirse de mentira: hasta hoy `changeUserRoleAction` ni siquiera le pasaba
 * un `reason` al RPC, así que `user_role_audit` guardaba el qué sin el porqué.
 *
 * POR QUÉ SE INVOCA LA ACCIÓN A MANO Y NO CON `useActionState`.
 * `ConfirmDialog` entrega el motivo por `onConfirm(reason)` —un callback, no un
 * campo de formulario—, así que un `<form action={…}>` no puede verlo. Se sigue
 * el precedente de `gastos/ExpenseRowActions`: armar el `FormData` en JS e
 * invocar la acción dentro de `startTransition`, con el error viviendo DENTRO
 * del diálogo. Las firmas de `actions.ts` no cambian.
 *
 * BTN-01 §6 — prevenir antes que informar: cambiarte el rol a ti mismo queda
 * deshabilitado con el motivo a la vista, en vez de dejarte confirmar para que
 * el anti-lockout del RPC te lo rebote después.
 */

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  SCOPED_ROLES,
  STUDIO_USER_ROLES,
  WAREHOUSE_SCOPES,
  WAREHOUSE_SCOPE_LABELS,
  type StudioUserRole,
  type UserMembershipWithProfile,
  type WarehouseScope,
} from "@/lib/studio/user-types";
import {
  changeUserRoleAction,
  changeWarehouseScopeAction,
} from "../../actions";

/** Mínimo que exige `d1Reason` para no caer al texto enlatado del servidor. */
const MOTIVO_MIN = 8;

export function RolYAlcanceCard({
  member,
  esYo,
  onCambio,
}: {
  member: UserMembershipWithProfile;
  /** El admin se está mirando a sí mismo. */
  esYo?: boolean;
  /** Avisa al contenedor que hubo un cambio confirmado (para refrescar). */
  onCambio?: () => void;
}) {
  const scopeActual: WarehouseScope = member.warehouse_scope ?? "all";
  const [rol, setRol] = useState<StudioUserRole>(member.role);
  const [scope, setScope] = useState<WarehouseScope>(scopeActual);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pendiente, startTransition] = useTransition();

  const cambioRol = rol !== member.role;
  const cambioScope = scope !== scopeActual;
  const hayCambio = cambioRol || cambioScope;

  // El alcance sólo aplica a los roles cuyos módulos tienen lado geográfico.
  const scopeAplica = SCOPED_ROLES.has(rol);

  const bloqueo = esYo
    ? "No puedes cambiar tu propio rol ni tu alcance. Pídeselo a otro admin."
    : null;

  const resumen = [
    cambioRol
      ? `su rol pasa de ${ROLE_LABELS[member.role]} a ${ROLE_LABELS[rol]}`
      : null,
    cambioScope && scopeAplica
      ? `su almacén pasa de ${WAREHOUSE_SCOPE_LABELS[scopeActual]} a ${WAREHOUSE_SCOPE_LABELS[scope]}`
      : null,
  ]
    .filter(Boolean)
    .join(" y ");

  function aplicar(motivo: string) {
    setError(undefined);
    startTransition(async () => {
      // El rol va PRIMERO: si cambia el rol, puede cambiar si el alcance
      // aplica siquiera. Al revés se escribiría un alcance para un rol que ya
      // no lo usa.
      if (cambioRol) {
        const fd = new FormData();
        fd.set("target_user_id", member.user_id);
        fd.set("new_role", rol);
        fd.set("reason", motivo);
        const res = await changeUserRoleAction({}, fd);
        if (res.error || res.errorCode) {
          setError(res.error ?? "No se pudo cambiar el rol.");
          return;
        }
      }

      if (cambioScope && scopeAplica) {
        const fd = new FormData();
        fd.set("target_user_id", member.user_id);
        fd.set("new_scope", scope);
        fd.set("reason", motivo);
        const res = await changeWarehouseScopeAction({}, fd);
        if (res.error || res.errorCode) {
          setError(res.error ?? "No se pudo cambiar el alcance.");
          return;
        }
      }

      setConfirmando(false);
      onCambio?.();
    });
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
          <Campo etiqueta="Rol" htmlFor="ficha-rol">
            <select
              id="ficha-rol"
              className="studio-input"
              value={rol}
              disabled={pendiente || !!bloqueo}
              onChange={(e) => setRol(e.target.value as StudioUserRole)}
            >
              {STUDIO_USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Almacén" htmlFor="ficha-scope">
            <select
              id="ficha-scope"
              className="studio-input"
              value={scope}
              disabled={pendiente || !!bloqueo || !scopeAplica}
              onChange={(e) => setScope(e.target.value as WarehouseScope)}
            >
              {WAREHOUSE_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {WAREHOUSE_SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <p
          style={{
            font: "400 11.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {ROLE_DESCRIPTIONS[rol]}
        </p>

        {!scopeAplica && !bloqueo && (
          <p
            style={{
              font: "400 11.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            El almacén no aplica a {ROLE_LABELS[rol]}: sus módulos no tienen lado
            geográfico.
          </p>
        )}

        {/* BTN-01 §6: el motivo del bloqueo se ve, no depende de enfocar un
            control deshabilitado. */}
        {bloqueo && (
          <p
            style={{
              font: "500 11.5px/1.5 var(--f-sans)",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            {bloqueo}
          </p>
        )}

        <div>
          <button
            type="button"
            className="studio-btn studio-btn-sm"
            disabled={!hayCambio || pendiente || !!bloqueo}
            aria-busy={pendiente}
            onClick={() => {
              setError(undefined);
              setConfirmando(true);
            }}
          >
            {pendiente ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmando}
        reason
        reasonRequired
        reasonLabel="Motivo del cambio"
        reasonPlaceholder="Ej: pasa a llevar la conciliación con China"
        initialFocus="reason"
        title="Confirmar cambio de acceso"
        message={`${nombreCorto(member)}: ${resumen}. Queda registrado en la auditoría con tu nombre y el motivo que escribas.`}
        confirmLabel="Aplicar cambio"
        pending={pendiente}
        error={error}
        onCancel={() => {
          if (pendiente) return;
          setConfirmando(false);
          setError(undefined);
        }}
        onConfirm={(motivo) => {
          if (motivo.trim().length < MOTIVO_MIN) {
            setError(`El motivo necesita al menos ${MOTIVO_MIN} caracteres.`);
            return;
          }
          aplicar(motivo.trim());
        }}
      />
    </>
  );
}

function nombreCorto(m: UserMembershipWithProfile): string {
  const n = `${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`.trim();
  return n || m.email;
}

function Campo({
  etiqueta,
  htmlFor,
  children,
}: {
  etiqueta: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        // Base de 150px, no máximo: el select CRECE. La etiqueta más
        // larga es "Contabilidad" (~80px en Archivo 13px) más el chrome
        // del control, así que no recorta ni en el peor caso.
        flex: "1 1 150px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-1)",
      }}
    >
      <label htmlFor={htmlFor} className="studio-label">
        {etiqueta}
      </label>
      {children}
    </div>
  );
}
