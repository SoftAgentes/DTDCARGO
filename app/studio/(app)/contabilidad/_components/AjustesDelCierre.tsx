"use client";

/**
 * SDD-0566 · El modo del cierre y la superclave, en el cajón del cierre
 * (admin-only). Cada parte es su propio formulario. Los campos de clave son de
 * contraseña sin autocompletar y se vacían después de cada intento: el valor
 * nunca vuelve del servidor ni se guarda en la página.
 */

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ETIQUETA_MODO, fechaHoraCaracas, type ModoCierre } from "@/lib/studio/accounting/cierre-excepciones";
import type { EstadoCierre } from "@/lib/studio/accounting/cierre-queries";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { fijarSuperclaveAction, restablecerSuperclaveAction, setClosingModeAction } from "../actions";

const seccion: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-3)",
  paddingTop: "var(--s-4)",
  borderTop: "1px solid var(--border)",
};

function MensajeError({ id, msg }: { id: string; msg: string | null }) {
  if (!msg) return null;
  return (
    <p
      id={id}
      role="alert"
      style={{
        font: "500 12px/1.4 var(--f-sans)",
        color: "var(--danger)",
        margin: 0,
        padding: "10px 12px",
        background: "var(--danger-bg)",
        border: "1px solid var(--danger)",
        borderRadius: "var(--r-sm)",
      }}
    >
      {msg}
    </p>
  );
}

function Clave({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span className="studio-label">{label}</span>
      <input
        id={id}
        type="password"
        autoComplete="off"
        spellCheck={false}
        className="studio-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
      />
    </label>
  );
}

export function AjustesDelCierre({ estado }: { estado: EstadoCierre }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [modo, setModo] = useState<ModoCierre>(estado.modo);
  const [pending, setPending] = useState(false);
  const [errorModo, setErrorModo] = useState<string | null>(null);
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const [restablecer, setRestablecer] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [motivo, setMotivo] = useState("");

  const vaciar = () => {
    setActual("");
    setNueva("");
    setConfirmacion("");
  };

  async function guardarModo(e: React.FormEvent) {
    e.preventDefault();
    if (pending || modo === estado.modo) return;
    setPending(true);
    setErrorModo(null);
    const r = await setClosingModeAction(modo);
    setPending(false);
    if (r.error) return setErrorModo(r.error);
    toast.success(`Modo del cierre: ${ETIQUETA_MODO[modo].toLowerCase()}`);
    router.refresh();
  }

  async function guardarClave(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setErrorClave(null);
    const [a, n, c] = [actual, nueva, confirmacion];
    vaciar();
    const r = restablecer
      ? await restablecerSuperclaveAction(n, c, motivo)
      : await fijarSuperclaveAction(a, n, c);
    setPending(false);
    if (r.error) return setErrorClave(r.error);
    toast.success(
      restablecer ? "Superclave restablecida" : estado.superclaveDefinida ? "Superclave cambiada" : "Superclave definida",
    );
    setRestablecer(false);
    setMotivo("");
    router.refresh();
  }

  const definida = estado.superclaveDefinida;
  const bloqueada = estado.bloqueadaHasta;

  return (
    <>
      <form onSubmit={guardarModo} style={seccion} aria-labelledby={`${id}-modo`}>
        <h3 id={`${id}-modo`} style={{ margin: 0, font: "700 13.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
          Cómo se cambia un período cerrado
        </h3>
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <legend className="studio-label" style={{ marginBottom: 4 }}>Modo del cierre</legend>
          {(["superclave", "advertencia"] as const).map((m) => (
            <label key={m} style={{ display: "flex", gap: 8, alignItems: "flex-start", font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink)" }}>
              <input
                type="radio"
                name={`${id}-modo-radio`}
                value={m}
                checked={modo === m}
                onChange={() => setModo(m)}
                disabled={pending}
                style={{ accentColor: "var(--wine)", marginTop: 2 }}
              />
              <span>
                <strong>{ETIQUETA_MODO[m]}</strong>
                <br />
                <span style={{ color: "var(--ink-soft)" }}>
                  {m === "superclave"
                    ? "Para cambiar algo de un período cerrado hacen falta la superclave y un motivo. Sin superclave definida, no se puede cambiar nada."
                    : "Basta con ver el aviso y dar un motivo. El cambio queda igual en el reporte de excepciones."}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <MensajeError id={`${id}-modo-error`} msg={errorModo} />
        <div>
          <button type="submit" className="studio-btn studio-btn-ghost" disabled={pending || modo === estado.modo}>
            Guardar modo
          </button>
        </div>
      </form>

      <form onSubmit={guardarClave} style={seccion} aria-labelledby={`${id}-clave`}>
        <h3 id={`${id}-clave`} style={{ margin: 0, font: "700 13.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
          Superclave del cierre
        </h3>
        <p style={{ margin: 0, font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          {definida
            ? "Está definida. Es distinta de tu clave de usuario y se guarda cifrada: nadie puede verla, solo cambiarla."
            : "Todavía no está definida. Mientras no la definas, en el modo con superclave nadie puede cambiar un período cerrado."}
          {bloqueada && ` Está bloqueada por intentos fallidos hasta las ${fechaHoraCaracas(bloqueada).slice(11)} (hora de Caracas).`}
        </p>
        {definida && !restablecer && (
          <Clave label="Superclave actual" value={actual} onChange={setActual} disabled={pending} />
        )}
        <Clave label={definida ? "Superclave nueva" : "Superclave"} value={nueva} onChange={setNueva} disabled={pending} />
        <Clave label="Repite la superclave" value={confirmacion} onChange={setConfirmacion} disabled={pending} />
        {restablecer && (
          <label htmlFor={`${id}-motivo`} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="studio-label">Motivo del restablecimiento</span>
            <textarea
              id={`${id}-motivo`}
              className="studio-input"
              rows={2}
              maxLength={1000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={pending}
              required
              style={{ resize: "vertical", minHeight: 52 }}
            />
          </label>
        )}
        <span style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
          Entre 8 y 64 caracteres. Cada 5 intentos fallidos se bloquea: 15 minutos, después el doble cada vez, hasta 24 horas.
        </span>
        <MensajeError id={`${id}-clave-error`} msg={errorClave} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="submit" className="studio-btn studio-btn-primary" disabled={pending}>
            {restablecer ? "Restablecer superclave" : definida ? "Cambiar superclave" : "Definir superclave"}
          </button>
          {definida && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={() => {
                vaciar();
                setErrorClave(null);
                setRestablecer((v) => !v);
              }}
              disabled={pending}
            >
              {restablecer ? "Tengo la actual" : "¿La olvidaste? Restablecer"}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
