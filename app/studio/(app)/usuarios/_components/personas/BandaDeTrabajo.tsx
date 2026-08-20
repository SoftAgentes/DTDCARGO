"use client";

/**
 * La banda de trabajo pendiente (SDD-0274 · Slice 4).
 *
 * EL DATO QUE LA JUSTIFICA: de 9 miembros del equipo, **4 tienen cuenta y nunca
 * han entrado** — algunos desde hace más de un mes. El módulo tenía ese dato y
 * no hacía nada con él: lo pintaba como un «Nunca» en una celda de fecha.
 *
 * POR QUÉ ESTÁ ARRIBA DE LA TABLA Y NO DENTRO DE UNA FICHA. El founder pidió
 * que las acciones **de una persona** vivan en su perfil, y así quedaron. Esta
 * no es de una persona: es de las cuatro a la vez, y no tiene ficha dónde
 * vivir. Además cubre lo que BTN-01 §4 exige — «una acción crítica principal
 * del flujo no puede quedar descubrible únicamente al abrir un menú genérico»:
 * con la fila muda, «Enviar acceso» sólo existiría dentro del drawer.
 *
 * NO ES UN TABLERO DE VANIDAD: si no hay nadie pendiente, la banda no se
 * dibuja. Y cada elemento lleva a una acción real, nunca a un número solo.
 *
 * EL RESULTADO SE MUESTRA POR PERSONA. Un lote que dice «listo» esconde el caso
 * que de verdad ocurre: tres salen y uno rebota. ERR-01 pide el error cerca de
 * su causa; acá la causa son destinatarios distintos.
 */

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import {
  userDisplayName,
  type UserMembershipWithProfile,
} from "@/lib/studio/user-types";
import {
  ACCESS_LINK_BULK_MAX,
  type BulkAccessResult,
} from "@/lib/studio/access-link-bulk";
import { sendAccessLinkBulkAction } from "../../actions";

export function BandaDeTrabajo({
  pendientes,
  onVerPendientes,
}: {
  /** Miembros activos que nunca iniciaron sesión. */
  pendientes: UserMembershipWithProfile[];
  /** Filtra la tabla para dejar sólo a estas personas. */
  onVerPendientes: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [resultados, setResultados] = useState<BulkAccessResult[] | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (pendientes.length === 0 && !resultados) return null;

  const n = pendientes.length;
  const nombre = (id: string) => {
    const m = pendientes.find((p) => p.user_id === id);
    return m ? userDisplayName(m.profile, m.email) : id;
  };

  function enviar() {
    setError(undefined);
    startTransition(async () => {
      const res = await sendAccessLinkBulkAction(pendientes.map((p) => p.user_id));
      if (res.error) {
        setError(res.error);
        return;
      }
      setConfirmando(false);
      setResultados(res.resultados);
    });
  }

  const fallidos = resultados?.filter((r) => !r.ok) ?? [];
  const enviados = resultados?.filter((r) => r.ok) ?? [];

  return (
    <>
      <section
        aria-labelledby="banda-titulo"
        style={{
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--warning)",
          borderRadius: "var(--r-md)",
          background: "var(--bg-surface)",
          padding: "var(--s-4)",
          marginBottom: "var(--s-4)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--s-3)",
        }}
      >
        <div style={{ flex: "1 1 320px" }}>
          <p
            id="banda-titulo"
            style={{ font: "600 13.5px/1.4 var(--f-sans)", color: "var(--ink)", margin: 0 }}
          >
            {n === 1
              ? "1 persona tiene cuenta y nunca ha entrado"
              : `${n} personas tienen cuenta y nunca han entrado`}
          </p>
          <p
            style={{
              font: "400 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "var(--s-1) 0 0",
            }}
          >
            Mándales el enlace para que creen su contraseña. Los enlaces
            anteriores que sigan vigentes no se anulan.
          </p>
        </div>

        {n > 0 && (
          <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={onVerPendientes}
            >
              Ver quiénes son
            </button>
            {/* `-dark` (navy) y no `-primary` (vino): la acción dominante de la
                pantalla es «Invitar usuario», en la cabecera. BTN-01 §2 pide una
                sola primaria por contexto. */}
            <button
              type="button"
              className="studio-btn studio-btn-dark studio-btn-sm"
              disabled={pendiente}
              aria-busy={pendiente}
              onClick={() => {
                setError(undefined);
                setResultados(null);
                setConfirmando(true);
              }}
            >
              {pendiente ? "Enviando…" : `Enviar acceso a ${n === 1 ? "la persona" : `las ${n}`}`}
            </button>
          </div>
        )}

        {resultados && (
          <div style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            <p
              role="status"
              style={{
                font: "600 12.5px/1.4 var(--f-sans)",
                color: fallidos.length === 0 ? "var(--success)" : "var(--ink)",
                margin: 0,
              }}
            >
              {fallidos.length === 0
                ? `Enlace enviado a ${enviados.length} ${enviados.length === 1 ? "persona" : "personas"}.`
                : `Salieron ${enviados.length} de ${resultados.length}. Estas no:`}
            </p>
            {fallidos.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "var(--s-5)" }}>
                {fallidos.map((f) => (
                  <li
                    key={f.userId}
                    style={{ font: "400 12.5px/1.6 var(--f-sans)", color: "var(--ink-soft)" }}
                  >
                    <strong style={{ color: "var(--ink)" }}>{nombre(f.userId)}</strong> — {f.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmando}
        title={`Enviar acceso a ${n} ${n === 1 ? "persona" : "personas"}`}
        message={
          `Se le manda un correo con su enlace a: ${pendientes
            .map((p) => userDisplayName(p.profile, p.email))
            .join(", ")}. ` +
          `Cada enlace es de un solo uso y caduca. Máximo ${ACCESS_LINK_BULK_MAX} por tanda.`
        }
        confirmLabel={`Enviar los ${n}`}
        pending={pendiente}
        error={error}
        onCancel={() => {
          if (pendiente) return;
          setConfirmando(false);
          setError(undefined);
        }}
        onConfirm={enviar}
      />
    </>
  );
}
