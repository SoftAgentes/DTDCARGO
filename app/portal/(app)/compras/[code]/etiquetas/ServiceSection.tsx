"use client";

/**
 * SDD-0098 · Bloque "Servicios de esta compra" en el detalle (página de etiquetas).
 * Muestra las solicitudes ya pedidas (con estado) y permite pedir uno nuevo. El
 * gate de "tardía" lo aplica el trigger en DB (si la compra ya fue recibida); acá
 * solo avisamos. Reusa el video-ayuda + el aviso "antes de almacén" compartidos.
 */

import { useActionState, useEffect, useState } from "react";
import { CheckIcon } from "@/components/Icon";
import {
  defaultAddon,
  type PrealertaAddon,
  type PrealertaServiceRequest,
  type ServiceRequestActionState,
} from "@/lib/studio/prealertas/addons";
import { requestPrealertaServiceAction } from "../../../proveedores/actions";
import { PrealertaServiceBadge } from "../../../../_components/PrealertaServiceBadge";
import {
  BeforeWarehouseNotice,
  PrealertaServiceVideo,
} from "../../../../_components/PrealertaAddons";

const initial: ServiceRequestActionState = {};

function labelOf(code: string, byCode: Map<string, PrealertaAddon>): string {
  return byCode.get(code)?.label ?? defaultAddon(code)?.label ?? code;
}

export function PrealertaServiceSection({
  prealertaCode,
  prealertaReceived,
  requests,
  addons,
}: {
  prealertaCode: string;
  prealertaReceived: boolean;
  requests: PrealertaServiceRequest[];
  addons: PrealertaAddon[];
}) {
  const byCode = new Map(addons.map((a) => [a.code as string, a]));
  const requestedCodes = new Set(requests.map((r) => r.addon_code as string));
  const available = addons.filter((a) => !requestedCodes.has(a.code));
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-10 print:hidden">
      <div className="text-[15px] font-bold text-ink">
        Servicios de esta compra
      </div>
      <p className="mt-1.5 text-[13px] text-grey-700 leading-[1.5] max-w-[62ch]">
        Pídenos que hagamos algo con tu compra cuando llegue a la bodega. Cada uno
        lo coordina y cotiza tu asesor.
      </p>

      {requests.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="bg-white border border-grey-200 rounded-[12px] px-4 py-3"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13.5px] font-bold text-ink">
                  {labelOf(r.addon_code, byCode)}
                </span>
                <PrealertaServiceBadge status={r.status} />
                {r.timing === "tardia" && (
                  <span
                    className="inline-flex items-center text-[11px] font-semibold rounded-full px-2 py-0.5"
                    style={{
                      // Texto en ink, no en ámbar: sobre su propio tinte medía
                      // 2.91:1 en claro. El dorado queda en el fondo. SDD-0176.
                      color: "var(--color-ink)",
                      background:
                        "color-mix(in srgb, var(--color-status-warning) 10%, transparent)",
                    }}
                  >
                    Pedida tarde
                  </span>
                )}
              </div>
              {r.notes && (
                <p className="mt-1.5 text-[12.5px] text-grey-700 leading-[1.45]">
                  {r.notes}
                </p>
              )}
              {r.trackings && r.trackings.length > 0 && (
                <p
                  className="mt-1 text-[12px] text-grey-500"
                  style={{
                    fontFamily:
                      "var(--font-jetbrains-mono), ui-monospace, monospace",
                  }}
                >
                  {r.trackings.join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {available.length === 0 ? (
          requests.length > 0 ? (
            <p className="text-[12.5px] text-grey-500">
              Ya pediste todos los servicios disponibles para esta compra.
            </p>
          ) : (
            <p className="text-[12.5px] text-grey-500">
              No hay servicios disponibles por ahora.
            </p>
          )
        ) : adding ? (
          <AddServiceForm
            prealertaCode={prealertaCode}
            prealertaReceived={prealertaReceived}
            available={available}
            onDone={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn btn-ghost inline-flex items-center gap-2"
          >
            + Pedir un servicio
          </button>
        )}
      </div>
    </div>
  );
}

function AddServiceForm({
  prealertaCode,
  prealertaReceived,
  available,
  onDone,
}: {
  prealertaCode: string;
  prealertaReceived: boolean;
  available: PrealertaAddon[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    requestPrealertaServiceAction,
    initial,
  );
  const [code, setCode] = useState<string>(available[0]?.code ?? "");
  const selected = available.find((a) => a.code === code) ?? null;

  // Tras pedir OK, la página revalida (nuevos props) — cerramos el form.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={action}
      className="card-shadow bg-white border border-grey-200 rounded-[14px] p-4 flex flex-col gap-3"
    >
      <input type="hidden" name="prealertaCode" value={prealertaCode} />

      <div>
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
          Servicio
        </span>
        <select
          name="addonCode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={pending}
          className="mt-1.5 w-full h-12 px-3 rounded-[10px] bg-grey-100 border-0 outline-none text-[14px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        >
          {available.map((a) => (
            <option key={a.code} value={a.code}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          <p className="text-[12.5px] text-grey-700 leading-[1.45]">
            {selected.description}
          </p>
          <PrealertaServiceVideo url={selected.videoUrl} label={selected.label} />
          <textarea
            name="notes"
            rows={2}
            placeholder={
              selected.notasPlaceholder ?? "Notas para el equipo (opcional)"
            }
            disabled={pending}
            className="w-full px-3 py-2 rounded-[8px] bg-grey-100 border-0 outline-none text-[13px] text-ink resize-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
          />
          {selected.multiTracking && (
            <textarea
              name="trackings"
              rows={2}
              placeholder="Trackings a unificar — uno por línea o separados por coma"
              disabled={pending}
              className="w-full px-3 py-2 rounded-[8px] bg-grey-100 border-0 outline-none text-[13px] text-ink resize-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
              style={{
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
              }}
            />
          )}
        </>
      )}

      {prealertaReceived && (
        <p
          className="text-[12px] leading-[1.45] rounded-[8px] px-3 py-2"
          style={{
            // Texto en ink, no en ámbar: sobre su propio tinte medía 2.91:1 en
            // claro y esto es un AVISO — tiene que leerse. SDD-0176.
            color: "var(--color-ink)",
            background:
              "color-mix(in srgb, var(--color-status-warning) 8%, transparent)",
          }}
        >
          Tu compra ya llegó a la bodega: esta solicitud puede quedar marcada como
          tardía y no podemos garantizarla.
        </p>
      )}

      <BeforeWarehouseNotice />

      <label className="flex items-start gap-2.5 cursor-pointer text-[12px] text-grey-700 leading-[1.45]">
        <input
          type="checkbox"
          name="consent"
          required
          disabled={pending}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-wine)]"
        />
        <span>
          Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo
          pedirlo antes de que mi compra llegue a la bodega.
        </span>
      </label>

      {state.error && (
        <p className="text-[12.5px] text-wine">{state.error}</p>
      )}

      <div className="flex gap-2.5">
        <button
          type="submit"
          disabled={pending || !code}
          className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Pidiendo…" : "Pedir este servicio"}
          {!pending && <CheckIcon size={15} />}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="btn btn-ghost disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
