"use client";

import { useActionState, useState } from "react";
import { useActionKeepingDraft } from "@/lib/shared/use-action-keeping-draft";
import { ChatIcon } from "@/components/Icon";
import Link from "next/link";
import {
  updateMyProfileAction,
  cancelDataChangeRequestAction,
  type ChangeRequestActionState,
} from "./actions";
import {
  buildChangeRequestDiff,
  type ClientChangeRequest,
} from "@/lib/portal/change-request-types";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";
import {
  profileEditQuotaLabel,
  type ProfileEditQuota,
} from "@/lib/portal/profile-edit-quota";

const initial: ChangeRequestActionState = {};

type Values = { name: string; doc: string; phone: string };

/**
 * "Actualizar mis datos" (SDD-0482). El cliente EDITA nombre, cédula/RIF y
 * teléfono y el cambio se aplica al instante (decisión de Sam), dentro del
 * cupo compartido de 3 cambios. Código (Shipping Mark) y email NO se editan acá.
 *
 * Estados:
 *  - Sin cupo o cupo ilegible → no se ofrece editar; conduce a soporte.
 *  - Cerrado → botón «Editar mis datos» (y aviso «Datos actualizados» tras guardar).
 *  - Abierto → formulario prellenado; «Guardar cambios» pide confirmación antes
 *    de gastar un cambio.
 *  - `openRequest` (solicitud del flujo SDD-0151 que quedó en revisión) → se
 *    muestra; «Editar ahora» la reemplaza al guardar, o se puede cancelar.
 */
export function DataChangeEditor({
  isEmpresa,
  current,
  openRequest,
  lastRejected,
  quota,
}: {
  isEmpresa: boolean;
  current: Values;
  openRequest: ClientChangeRequest | null;
  lastRejected: ClientChangeRequest | null;
  quota: ProfileEditQuota;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(current);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [state, formProps, pending] = useActionKeepingDraft(
    updateMyProfileAction,
    initial,
    "No pudimos confirmar si tus datos se guardaron. Lo que escribiste sigue aquí. Intenta de nuevo.",
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelDataChangeRequestAction,
    initial,
  );
  // El resultado de la action cambia de identidad en cada envío: así la
  // confirmación y el aviso de éxito se derivan sin efectos.
  const [confirmedFor, setConfirmedFor] = useState<ChangeRequestActionState | null>(null);
  const [seenOk, setSeenOk] = useState<ChangeRequestActionState | null>(null);

  const canEdit = quota.available && quota.remaining > 0;
  const justSaved = state.ok === true && seenOk !== state;
  const editing = open && !justSaved;
  const confirming = confirmedFor === state;

  const startEditing = () => {
    setValues(current);
    setSeenOk(state);
    setConfirmedFor(null);
    setOpen(true);
  };

  const nameLabel = isEmpresa ? "Razón social" : "Nombre completo";
  const docLabel = isEmpresa ? "RIF" : "Cédula / RIF";

  return (
    <div className="mt-6 pt-5 border-t border-grey-200">
      <QuotaLine quota={quota} />

      {openRequest && !editing ? (
        <PendingRequest
          request={openRequest}
          isEmpresa={isEmpresa}
          canEdit={canEdit}
          onEdit={startEditing}
          confirmingCancel={confirmingCancel}
          setConfirmingCancel={setConfirmingCancel}
          cancelAction={cancelAction}
          cancelPending={cancelPending}
          cancelError={cancelState.error}
        />
      ) : null}

      {!canEdit ? (
        <div className="mt-3 rounded-[12px] border border-grey-200 bg-paper p-4">
          <p className="text-[13px] text-grey-700 leading-[1.55]">
            {quota.available
              ? "Ya usaste tus 3 cambios de perfil."
              : "No pudimos consultar tu cupo de cambios en este momento."}{" "}
            Si necesitas corregir un dato importante, nuestro equipo puede
            ayudarte.
          </p>
          <Link
            href="/portal/soporte?tema=datos"
            className="mt-3 min-h-11 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wine-text hover:text-wine-deep"
          >
            <ChatIcon size={14} /> Hablar con soporte
          </Link>
        </div>
      ) : !editing ? (
        openRequest ? null : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="flex-1">
              {justSaved ? (
                <p
                  role="status"
                  className="text-[13px] font-semibold text-grey-700 leading-[1.55]"
                >
                  Datos actualizados.
                </p>
              ) : null}
              <p className="text-[13px] text-grey-700 leading-[1.55]">
                ¿Algún dato cambió o está mal? Corrígelo aquí: se aplica al
                instante. Tu código y tu email no se editan aquí.
              </p>
              {lastRejected && lastRejected.reviewNote ? (
                <p className="mt-2 text-[12.5px] text-wine-text leading-[1.5]">
                  Tu última solicitud no se aprobó: {lastRejected.reviewNote}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={startEditing}
              className="btn btn-ghost inline-flex items-center gap-2 flex-shrink-0"
            >
              Editar mis datos
            </button>
          </div>
        )
      ) : (
        <form {...formProps} className="mt-3 flex flex-col gap-4">
          <p className="text-[12.5px] text-grey-500 leading-[1.5]">
            Cambia solo lo que necesites corregir. Tu código (Shipping Mark) y tu
            email no se editan aquí.
            {openRequest
              ? " Al guardar, tu solicitud en revisión se reemplaza."
              : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditField
              name="name"
              label={nameLabel}
              value={values.name}
              onChange={(name) => setValues((v) => ({ ...v, name }))}
              error={state.fieldErrors?.name}
            />
            <EditField
              name="doc"
              label={docLabel}
              value={values.doc}
              onChange={(doc) => setValues((v) => ({ ...v, doc }))}
              error={state.fieldErrors?.doc}
              placeholder={isEmpresa ? "J-12345678-9" : "V-12345678"}
            />
            <EditField
              name="phone"
              label="Teléfono"
              value={values.phone}
              onChange={(phone) => setValues((v) => ({ ...v, phone }))}
              error={state.fieldErrors?.phone}
              placeholder="+58 412 1234567"
            />
          </div>

          {state.error && !pending ? (
            <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>
          ) : null}

          {confirming || pending ? (
            <div
              className="rounded-[12px] bg-paper border border-grey-200 border-l-[3px] p-4"
              style={{ borderLeftColor: "var(--color-status-warning)" }}
            >
              <p className="text-[13px] text-grey-700 leading-[1.55]">
                Guardar usa 1 de tus {quota.remaining}{" "}
                {quota.remaining === 1 ? "cambio disponible" : "cambios disponibles"}{" "}
                y se aplica al instante.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="submit"
                  disabled={pending}
                  aria-busy={pending}
                  className="btn btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {pending ? "Guardando…" : "Sí, guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedFor(null)}
                  disabled={pending}
                  className="btn btn-ghost inline-flex items-center justify-center disabled:opacity-60"
                >
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmedFor(state)}
                className="btn btn-primary inline-flex items-center justify-center gap-2"
              >
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost inline-flex items-center justify-center"
              >
                Cancelar
              </button>
              <Link
                href="/portal/soporte?tema=datos"
                className="text-[12.5px] font-semibold text-wine-text hover:text-wine-deep inline-flex items-center gap-1.5 sm:ml-auto"
              >
                <ChatIcon size={14} /> Mejor lo hablo por el chat
              </Link>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

/** Solicitud del flujo anterior (SDD-0151) que quedó en revisión. */
function PendingRequest({
  request,
  isEmpresa,
  canEdit,
  onEdit,
  confirmingCancel,
  setConfirmingCancel,
  cancelAction,
  cancelPending,
  cancelError,
}: {
  request: ClientChangeRequest;
  isEmpresa: boolean;
  canEdit: boolean;
  onEdit: () => void;
  confirmingCancel: boolean;
  setConfirmingCancel: (value: boolean) => void;
  cancelAction: (formData: FormData) => void;
  cancelPending: boolean;
  cancelError: string | undefined;
}) {
  const diff = buildChangeRequestDiff(request, isEmpresa);
  return (
    <div className="mt-3">
      <div
        className="rounded-[12px] bg-paper border border-grey-200 border-l-[3px] p-5"
        style={{ borderLeftColor: "var(--color-status-warning)" }}
      >
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-700">
          Cambio en revisión
        </div>
        <p className="mt-1.5 text-[13px] text-grey-700 leading-[1.55]">
          Tu asesor está revisando estos cambios.
          {canEdit
            ? " Ahora también puedes editar tus datos al instante: si lo haces, esta solicitud se reemplaza."
            : ""}
        </p>
        <dl className="mt-4 flex flex-col gap-2.5">
          {diff.map((d) => (
            <div key={d.field} className="text-[13px]">
              <dt className="text-[11px] font-semibold tracking-[0.08em] uppercase text-grey-500">
                {d.label}
              </dt>
              <dd className="mt-0.5 text-ink">
                <span className="text-grey-500 line-through">{d.from ?? "—"}</span>{" "}
                <span aria-hidden>→</span>{" "}
                <span className="font-semibold">{d.to}</span>
              </dd>
            </div>
          ))}
        </dl>
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="btn btn-ghost mt-4 inline-flex items-center gap-2"
          >
            Editar ahora
          </button>
        ) : null}
      </div>

      {/* Cancelar la solicitud (¿se equivocó?) — confirm de 2 pasos. */}
      <div className="mt-3">
        {!confirmingCancel ? (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            className="inline-flex items-center min-h-[24px] rounded-[4px] text-[12.5px] font-semibold text-grey-700 hover:text-wine-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cancelar esta solicitud
          </button>
        ) : (
          <form action={cancelAction} className="flex flex-wrap items-center gap-3">
            <span className="text-[12.5px] text-grey-700">¿Cancelar la solicitud?</span>
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
        {cancelError ? <PortalFieldError>{cancelError}</PortalFieldError> : null}
      </div>
    </div>
  );
}

function QuotaLine({ quota }: { quota: ProfileEditQuota }) {
  return (
    <p className="text-[11.5px] font-semibold text-grey-500" aria-live="polite">
      {profileEditQuotaLabel(quota)}. Las direcciones no usan este cupo.
    </p>
  );
}

function EditField({
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
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
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-err` : undefined}
        className="h-11 px-3 rounded-[10px] bg-white border-[1.5px] border-grey-200 outline-none text-[14px] text-ink transition-colors focus:border-wine"
      />
      {error ? <PortalFieldError id={`${name}-err`}>{error}</PortalFieldError> : null}
    </label>
  );
}
