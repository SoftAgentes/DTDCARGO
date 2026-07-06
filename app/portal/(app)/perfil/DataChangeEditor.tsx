"use client";

import { useActionState, useState } from "react";
import { ChatIcon } from "@/components/Icon";
import Link from "next/link";
import {
  submitDataChangeRequestAction,
  cancelDataChangeRequestAction,
  type ChangeRequestActionState,
} from "./actions";
import {
  buildChangeRequestDiff,
  type ClientChangeRequest,
} from "@/lib/portal/change-request-types";

const initial: ChangeRequestActionState = {};

/**
 * "Actualizar mis datos" (SDD-0151). Antes era un link al chat; ahora el cliente
 * PROPONE cambios a su identidad (nombre, cédula/RIF, teléfono) y el asesor los
 * aprueba en el Studio. Código (Shipping Mark) y email NO se editan acá.
 *
 * Estados:
 *  - `openRequest` != null → "En revisión": muestra el diff propuesto, sin form.
 *  - Sin solicitud abierta  → botón que despliega el form (campos prellenados).
 *    Tras enviar, la revalidación del server re-renderiza en estado "En revisión".
 */
export function DataChangeEditor({
  isEmpresa,
  current,
  openRequest,
  lastRejected,
}: {
  isEmpresa: boolean;
  current: { name: string; doc: string; phone: string };
  openRequest: ClientChangeRequest | null;
  lastRejected: ClientChangeRequest | null;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [state, action, pending] = useActionState(
    submitDataChangeRequestAction,
    initial,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelDataChangeRequestAction,
    initial,
  );

  // Estado "En revisión" — el server ya tiene una solicitud pendiente.
  if (openRequest) {
    const diff = buildChangeRequestDiff(openRequest, isEmpresa);
    return (
      <div className="mt-6 pt-5 border-t border-grey-200">
        <div
          className="rounded-[12px] bg-paper border border-grey-200 border-l-[3px] p-5"
          style={{ borderLeftColor: "var(--color-status-warning)" }}
        >
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-700">
            Cambio en revisión
          </div>
          <p className="mt-1.5 text-[13px] text-grey-700 leading-[1.55]">
            Tu asesor está revisando estos cambios. Te avisamos cuando queden
            aprobados.
          </p>
          <dl className="mt-4 flex flex-col gap-2.5">
            {diff.map((d) => (
              <div key={d.field} className="text-[13px]">
                <dt className="text-[11px] font-semibold tracking-[0.08em] uppercase text-grey-500">
                  {d.label}
                </dt>
                <dd className="mt-0.5 text-ink">
                  <span className="text-grey-500 line-through">
                    {d.from ?? "—"}
                  </span>{" "}
                  <span aria-hidden>→</span>{" "}
                  <span className="font-semibold">{d.to}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Cancelar la solicitud (¿se equivocó?) — confirm de 2 pasos. Borra la
            pendiente y lo deja proponer de nuevo. */}
        <div className="mt-3">
          {!confirmingCancel ? (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="inline-flex items-center min-h-[24px] rounded-[4px] text-[12.5px] font-semibold text-grey-700 hover:text-wine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Cancelar esta solicitud
            </button>
          ) : (
            <form
              action={cancelAction}
              className="flex flex-wrap items-center gap-3"
            >
              <span className="text-[12.5px] text-grey-700">
                ¿Cancelar y volver a empezar?
              </span>
              <button
                type="submit"
                disabled={cancelPending}
                className="btn btn-ghost inline-flex items-center gap-2 disabled:opacity-60"
              >
                {cancelPending ? "Cancelando…" : "Sí, cancelar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={cancelPending}
                className="inline-flex items-center min-h-[24px] rounded-[4px] text-[12.5px] font-semibold text-grey-700 hover:text-ink disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                No, seguir esperando
              </button>
            </form>
          )}
          {cancelState.error ? (
            <p role="alert" className="mt-2 text-[12px] text-wine">
              {cancelState.error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const nameLabel = isEmpresa ? "Razón social" : "Nombre completo";
  const docLabel = isEmpresa ? "RIF" : "Cédula / RIF";

  return (
    <div className="mt-6 pt-5 border-t border-grey-200">
      {!open ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex-1">
            <p className="text-[13px] text-grey-700 leading-[1.55]">
              ¿Algún dato cambió o está mal? Puedes proponer la corrección y tu
              asesor la aprueba. Tu código y tu email no se editan aquí.
            </p>
            {lastRejected && lastRejected.reviewNote ? (
              <p className="mt-2 text-[12.5px] text-wine leading-[1.5]">
                Tu última solicitud no se aprobó: {lastRejected.reviewNote}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn btn-ghost inline-flex items-center gap-2 flex-shrink-0"
          >
            Actualizar mis datos
          </button>
        </div>
      ) : state.ok ? (
        <div
          className="rounded-[12px] bg-paper border border-grey-200 border-l-[3px] p-5"
          style={{ borderLeftColor: "var(--color-status-success)" }}
        >
          {/* Eyebrow neutro (AA): el verde 11px sobre paper no llega a 4.5:1;
              el estado lo lleva el borde izquierdo success. */}
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-700">
            Solicitud enviada
          </div>
          <p className="mt-1.5 text-[13px] text-grey-700 leading-[1.55]">
            Tu asesor revisa los cambios y los aprueba. Te avisamos cuando queden
            listos.
          </p>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <p className="text-[12.5px] text-grey-500 leading-[1.5]">
            Cambia solo lo que necesites corregir. Tu código (Shipping Mark) y tu
            email no se editan aquí.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditField
              name="name"
              label={nameLabel}
              defaultValue={current.name}
              error={state.fieldErrors?.name}
            />
            <EditField
              name="doc"
              label={docLabel}
              defaultValue={current.doc}
              error={state.fieldErrors?.doc}
              placeholder={isEmpresa ? "J-12345678-9" : "V-12345678"}
            />
            <EditField
              name="phone"
              label="Teléfono"
              defaultValue={current.phone}
              error={state.fieldErrors?.phone}
              placeholder="+58 412 1234567"
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-[12.5px] text-wine">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {pending ? "Enviando…" : "Enviar solicitud"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="btn btn-ghost inline-flex items-center justify-center disabled:opacity-60"
            >
              Cancelar
            </button>
            <Link
              href="/portal/soporte?tema=datos"
              className="text-[12.5px] font-semibold text-wine hover:text-wine-deep inline-flex items-center gap-1.5 sm:ml-auto"
            >
              <ChatIcon size={14} /> Mejor lo hablo por el chat
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

function EditField({
  name,
  label,
  defaultValue,
  placeholder,
  error,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-err` : undefined}
        className="h-11 px-3 rounded-[10px] bg-white border-[1.5px] border-grey-200 outline-none text-[14px] text-ink transition-colors focus:border-wine"
      />
      {error ? (
        <span id={`${name}-err`} className="text-[12px] text-wine">
          {error}
        </span>
      ) : null}
    </label>
  );
}
