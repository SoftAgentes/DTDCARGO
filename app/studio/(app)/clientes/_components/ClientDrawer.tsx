"use client";

/**
 * ClientDrawer — crear/editar cliente (SDD-0010).
 *
 * Drawer lateral derecho 560px. Mode "create" o "edit" según props.
 * useActionState con createClientAction / updateClientAction.
 * Soft delete button en footer (solo mode edit) con ConfirmDialog R2 (SDD-0469).
 * En mode create: MARKBOX se autogenera al submit (no input).
 * En mode edit: MARKBOX visible read-only.
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CLIENT_TIER_OPTIONS,
  DOC_KIND_OPTIONS,
  clientCompleteness,
  type Client,
  type ClientActionState,
  type ClientDocKind,
  type ClientTier,
} from "@/lib/studio/client-types";
import {
  createClientAction,
  geocodeClientAddressAction,
  softDeleteClientAction,
  updateClientAction,
} from "../actions";
import { Icon } from "@/app/studio/_components/icons";
import { SplitActionButton } from "@/app/studio/_components/ui/SplitActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { prefixChain, type AliadoOption } from "@/lib/studio/aliados/aliado-types";

interface Props {
  mode: "create" | "edit";
  client?: Client;
  onClose: () => void;
  /** SDD-0255: aliados del tenant, para el selector "Pertenece a" del alta. */
  aliados?: AliadoOption[];
}

const initialState: ClientActionState = {};

/**
 * Confirmación R2 del borrado (MP-01 · SDD-0469): nombra al cliente y su
 * consecuencia. Borrar revoca en el mismo acto su acceso al Portal y sus códigos
 * cortos (migr 0454) y deja el evento de auditoría (migr 0455). No existe un
 * camino de restauración en el Studio, así que el texto no la promete.
 */
export const DELETE_CLIENT_TITLE = "Eliminar cliente";
export const DELETE_CLIENT_CONFIRM_LABEL = "Eliminar cliente";
export const DELETE_CLIENT_REASON_LABEL = "Motivo (opcional, sin datos personales)";
/** Excepción de red: la acción pudo haber confirmado antes de fallar. */
export const DELETE_CLIENT_UNCONFIRMED =
  "No se pudo confirmar el borrado. Recarga la lista: si el cliente sigue ahí, puedes intentarlo de nuevo.";

export function deleteClientConfirmMessage(client: Pick<Client, "name" | "markbox">): string {
  return `Vas a eliminar a ${client.name} (Shipping Mark ${client.markbox}). Sale de las listas del Studio y pierde su acceso al Portal: se revocan su vínculo y sus códigos de acceso. Desde el Studio no se puede restaurar.`;
}

export function ClientDrawer({ mode, client, onClose, aliados = [] }: Props) {
  // SDD-0255: sólo se ofrecen aliados ACTIVOS — `next_markbox_aliado` rechaza a
  // los suspendidos y cerrados, así que ofrecerlos sería prometer algo que la
  // base va a negar después.
  const aliadosActivos = aliados.filter((a) => a.status === "activo");
  const [aliadoId, setAliadoId] = useState("");
  const cadenaElegida = aliadoId ? prefixChain(aliados, aliadoId) : "";

  const action =
    mode === "edit" && client
      ? updateClientAction.bind(null, client.markbox)
      : createClientAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [tier, setTier] = useState<ClientTier>(client?.tier ?? "regular");
  // SDD-0131: tipo de documento del alta (persona/empresa). Cambia las etiquetas
  // del nombre y del documento, y muestra el contacto operativo si es empresa.
  const [docKind, setDocKind] = useState<ClientDocKind>(
    client?.doc_kind ?? "persona",
  );
  const isCompany = docKind === "empresa";

  const [lat, setLat] = useState<string>(
    client?.lat != null ? String(client.lat) : "",
  );
  const [lng, setLng] = useState<string>(
    client?.lng != null ? String(client.lng) : "",
  );
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "loading" | "ok" | "denied" | "unavailable" | "error"
  >("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  const [geocodeMatched, setGeocodeMatched] = useState<string | null>(null);
  const [isGeocoding, startGeocoding] = useTransition();

  const captureGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unavailable");
      setGeoError("Browser sin soporte de geolocation.");
      return;
    }
    setGeoStatus("loading");
    setGeoError(null);
    setGeocodeMatched(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGeoStatus("ok");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("denied");
          setGeoError("Permiso de ubicación denegado por el navegador.");
        } else {
          setGeoStatus("error");
          setGeoError(err.message || "No se pudo obtener la ubicación.");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const geocodeFromAddress = () => {
    const addressInput = document.getElementById("cl-address") as HTMLInputElement | null;
    const addr = addressInput?.value.trim();
    if (!addr) {
      setGeoStatus("error");
      setGeoError("Carga una dirección primero.");
      return;
    }
    setGeoStatus("loading");
    setGeoError(null);
    setGeocodeMatched(null);
    startGeocoding(async () => {
      const result = await geocodeClientAddressAction(addr);
      if (result.ok) {
        setLat(result.result.lat.toFixed(6));
        setLng(result.result.lng.toFixed(6));
        setGeocodeMatched(result.result.displayName);
        setGeoStatus("ok");
      } else {
        setGeoStatus("error");
        setGeoError(result.error);
      }
    });
  };

  const clearGps = () => {
    setLat("");
    setLng("");
    setGeoStatus("idle");
    setGeoError(null);
    setGeocodeMatched(null);
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);
  const router = useRouter();
  const toast = useToast();
  // Error local del SplitActionButton (modo create) · el useActionState
  // legacy seguía manejando errores via state.error.
  const [createError, setCreateError] = useState<string | null>(null);

  /** Reset de campos para "Crear y empezar otra". */
  const resetFormFields = () => {
    const formEl = document.getElementById(
      "client-drawer-form",
    ) as HTMLFormElement | null;
    formEl?.reset();
    setTier("regular");
    setDocKind("persona");
    // SDD-0255: el aliado NO se limpia a propósito. "Crear y empezar otra" se usa
    // para cargar una tanda, y una tanda es casi siempre del mismo aliado. El
    // `formEl.reset()` de arriba tampoco lo mueve: el select es controlado, así
    // que React lo repinta con `aliadoId`. Si algún día se quiere limpiar, hay
    // que hacerlo acá explícito — el reset del DOM no alcanza.
    setLat("");
    setLng("");
    setGeoStatus("idle");
    setGeoError(null);
    setGeocodeMatched(null);
  };

  /**
   * Crea cliente llamando createClientAction directo + ejecuta el
   * comportamiento `postAction` según opción del SplitActionButton.
   */
  const createWithPostAction = async (
    postAction: "close" | "open" | "reset",
  ): Promise<void | { error?: string }> => {
    setCreateError(null);
    const formEl = document.getElementById(
      "client-drawer-form",
    ) as HTMLFormElement | null;
    if (!formEl) return { error: "No se encontró el formulario." };
    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      return { error: "Hay campos requeridos sin completar." };
    }
    const formData = new FormData(formEl);
    const result = await createClientAction({} as ClientActionState, formData);
    if (result.error) {
      setCreateError(result.error);
      return { error: result.error };
    }
    if (result.fieldErrors) {
      const firstErr =
        Object.values(result.fieldErrors).find((v) => !!v) ??
        "Revisa los campos.";
      setCreateError(firstErr);
      return { error: firstErr };
    }
    if (!result.ok || !result.createdMarkbox) {
      const m = "No se pudo crear el cliente.";
      setCreateError(m);
      return { error: m };
    }
    const markbox = result.createdMarkbox;

    // SDD-0131: "qué falta para completar" al crear. Se calcula del propio form
    // (foto y verificación siempre faltan al alta → se completan luego en la
    // ficha). Aviso informativo, no bloquea. En "abrir perfil" no lo mostramos:
    // la card de la ficha ya lo dice.
    const missing = clientCompleteness({
      doc_kind: docKind,
      rif: (formData.get("rif") as string | null) || null,
      contact_name: (formData.get("contact_name") as string | null) || null,
      email: (formData.get("email") as string | null) || null,
      phone: (formData.get("phone") as string | null) || null,
      address: (formData.get("address") as string | null) || null,
      cedula_photo_path: null,
      doc_verify_status: null,
    }).missingLabels;
    if (postAction !== "open" && missing.length > 0) {
      toast.info(`Para completar ${markbox} falta: ${missing.join(", ")}.`, {
        link: {
          href: `/studio/clientes/${markbox}`,
          label: "Completar perfil",
        },
      });
    }

    if (postAction === "close") {
      toast.success(`Cliente ${markbox} creado`, {
        link: {
          href: `/studio/clientes/${markbox}`,
          label: "Abrir perfil",
        },
      });
      router.push(
        `/studio/clientes?highlight=${encodeURIComponent(markbox)}&hl-tone=warm`,
      );
      onClose();
    } else if (postAction === "open") {
      toast.success(`Cliente ${markbox} creado · abriendo perfil`);
      router.push(`/studio/clientes/${markbox}`);
      onClose();
    } else if (postAction === "reset") {
      toast.success(`Cliente ${markbox} creado · empieza el siguiente`, {
        link: {
          href: `/studio/clientes?highlight=${encodeURIComponent(markbox)}&hl-tone=warm`,
          label: "Ver en listado",
        },
      });
      resetFormFields();
    }
    return undefined;
  };
  const [isDeleting, startDelete] = useTransition();

  // Cerrar drawer en success — SDD-0032: si hay warning, NO cerrar
  // automáticamente para que el founder vea el aviso (email no encolado).
  useEffect(() => {
    if (state.ok && !state.warning) onClose();
  }, [state.ok, state.warning, onClose]);

  const title = mode === "create" ? "Nuevo cliente" : "Editar cliente";

  return (
    /* SDD-0267 · Antes esto armaba el diálogo a mano, y le faltaba lo que no se
       ve: NI foco inicial, NI trampa de foco, NI Escape para cerrar (medido: 0
       ocurrencias de `useDialogA11y|Escape|focus()`). Con teclado se podía tabular
       FUERA del drawer hacia la página de atrás y no había forma de cerrarlo sin
       ratón. Además `role="dialog"` estaba sobre el SCRIM, no sobre el panel, y
       el velo era un hex a mano (`rgba(15,30,61,.55)`) en vez de `var(--scrim)`.

       `DrawerShell` es el patrón de la casa por goleada —105 archivos lo usan,
       20 no— y trae `useDialogA11y`: foco inicial, restauración al cerrar,
       trampa y Escape. Esto no es consistencia cosmética: es un defecto
       funcional de accesibilidad que se cierra reusando lo que ya existe. */
    <DrawerShell
      title={title}
      subtitle={mode === "edit" && client ? client.markbox : undefined}
      onClose={onClose}
      pending={isPending || isDeleting}
      width={560}
      closeLabel="Cerrar"
    >
        <form
          id="client-drawer-form"
          action={mode === "edit" ? formAction : undefined}
          onSubmit={
            mode === "create" ? (e) => e.preventDefault() : undefined
          }
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {mode === "create" && (
            <>
              {/* SDD-0255 · a quién pertenece el cliente. Si cuelga de un aliado,
                  el código sale de `next_markbox_aliado` (la insignia del aliado)
                  y no de `next_markbox` (DTD-). Son dos correlativos
                  independientes: uno no mueve al otro. */}
              {aliados.length > 0 && (
                <div>
                  <label htmlFor="cliente-aliado" className="studio-label">
                    Pertenece a
                  </label>
                  <select
                    id="cliente-aliado"
                    name="aliadoId"
                    className="studio-input"
                    value={aliadoId}
                    onChange={(e) => setAliadoId(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">DTD Cargo — cliente directo</option>
                    {aliadosActivos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {prefixChain(aliados, a.id)} · {a.tradeName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--r-sm)",
                  font: "500 11.5px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                {cadenaElegida ? (
                  <>
                    El Shipping Mark se asigna automáticamente y va a empezar por{" "}
                    <b style={{ color: "var(--ink)", font: "600 12px/1.4 var(--f-mono)" }}>
                      {cadenaElegida}-
                    </b>
                    . Este cliente es del aliado, no de DTD.
                  </>
                ) : (
                  <>El Shipping Mark se asigna automáticamente al crear el cliente.</>
                )}
              </div>
            </>
          )}

          {/* Tipo de documento · persona (cédula) / empresa (RIF) — SDD-0131 */}
          <div>
            <label className="studio-label">
              Tipo de cliente <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            {/* Hidden input: el value entra al FormData tanto en create
                (new FormData(formEl)) como en edit (form action). */}
            <input type="hidden" name="doc_kind" value={docKind} />
            {/* Toggle de 2 opciones: `role="group"` + `aria-pressed` (no radiogroup
                ARIA, que exigiría roving tabindex + flechas). Contrato honesto:
                dos toggles reales, ambos en el tab order, selección con Enter/Espacio. */}
            <div
              role="group"
              aria-label="Tipo de cliente"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 4,
              }}
            >
              {DOC_KIND_OPTIONS.map((opt) => {
                const active = docKind === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDocKind(opt.value)}
                    className="studio-btn"
                    style={{
                      justifyContent: "center",
                      border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                      background: active ? "var(--wine-tint)" : "var(--bg-surface)",
                      color: active ? "var(--wine)" : "var(--ink-soft)",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nombre / Razón social */}
          <div>
            <label className="studio-label" htmlFor="cl-name">
              {isCompany ? "Razón social" : "Nombre"}{" "}
              <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <input
              id="cl-name"
              name="name"
              type="text"
              className="studio-input"
              defaultValue={client?.name ?? ""}
              placeholder={isCompany ? "Inversiones Demo, C.A." : "Juan Pérez"}
              required
              autoFocus
            />
            {state.fieldErrors?.name && <FieldError msg={state.fieldErrors.name} />}
          </div>

          {/* Nombre de contacto · solo empresa (SDD-0131) */}
          {isCompany && (
            <div>
              <label className="studio-label" htmlFor="cl-contact-name">
                Nombre de contacto{" "}
                <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
                  (opcional)
                </span>
              </label>
              <input
                id="cl-contact-name"
                name="contact_name"
                type="text"
                className="studio-input"
                defaultValue={client?.contact_name ?? ""}
                placeholder="Persona con quien se coordina"
                autoComplete="off"
              />
              {state.fieldErrors?.contact_name && (
                <FieldError msg={state.fieldErrors.contact_name} />
              )}
            </div>
          )}

          {/* Tier */}
          <div>
            <label className="studio-label" htmlFor="cl-tier">
              Tier <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <select
              id="cl-tier"
              name="tier"
              className="studio-input"
              value={tier}
              onChange={(e) => setTier(e.target.value as ClientTier)}
              required
            >
              {CLIENT_TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.tier && <FieldError msg={state.fieldErrors.tier} />}
          </div>

          {/* Email + Teléfono */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="cl-email">
                Email
              </label>
              <input
                id="cl-email"
                name="email"
                type="email"
                className="studio-input"
                defaultValue={client?.email ?? ""}
                placeholder="compras@empresa.com"
                autoComplete="off"
              />
              {state.fieldErrors?.email && <FieldError msg={state.fieldErrors.email} />}
            </div>
            <div>
              <label className="studio-label" htmlFor="cl-phone">
                Teléfono
              </label>
              <input
                id="cl-phone"
                name="phone"
                type="text"
                className="studio-input"
                defaultValue={client?.phone ?? ""}
                placeholder="+58 414 1234567"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="studio-label" htmlFor="cl-address">
              Dirección
            </label>
            <input
              id="cl-address"
              name="address"
              type="text"
              className="studio-input"
              defaultValue={client?.address ?? ""}
              placeholder="Av. Bolívar, Edif Centro, Piso 4, Valencia"
              autoComplete="off"
            />
          </div>

          {/* GPS · habilita "Cerca de ti" del Mobile ERP */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  className="studio-eyebrow"
                  style={{ font: "700 10.5px/1 var(--f-sans)", color: "var(--ink-soft)", letterSpacing: "0.06em" }}
                >
                  Ubicación GPS
                </div>
                <div
                  style={{
                    font: "500 11.5px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginTop: 4,
                  }}
                >
                  Captúrala visitando al cliente · habilita &quot;Cerca de ti&quot; del Mobile ERP.
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={geocodeFromAddress}
                  disabled={isGeocoding || geoStatus === "loading"}
                  // Ocupado sólo cuando ESTE botón trabaja: `disabled` también
                  // se activa mientras corre el GPS del botón de al lado.
                  aria-busy={isGeocoding}
                  style={{ whiteSpace: "nowrap" }}
                  title="Geocoding via OpenStreetMap a partir de la dirección"
                >
                  {isGeocoding ? "Buscando…" : "Buscar desde dirección"}
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={captureGps}
                  disabled={isGeocoding || geoStatus === "loading"}
                  // Misma lógica que su etiqueta de carga de abajo.
                  aria-busy={geoStatus === "loading" && !isGeocoding}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {geoStatus === "loading" && !isGeocoding ? "Capturando…" : "Capturar GPS aquí"}
                </button>
                {(lat || lng) && (
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    onClick={clearGps}
                    style={{ color: "var(--ink-soft)" }}
                    aria-label="Limpiar GPS"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
            >
              <div>
                <label className="studio-label" htmlFor="cl-lat">
                  Latitud
                </label>
                <input
                  id="cl-lat"
                  name="lat"
                  type="text"
                  inputMode="decimal"
                  className="studio-input studio-input-mono"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="10.182650"
                  autoComplete="off"
                />
                {state.fieldErrors?.lat && <FieldError msg={state.fieldErrors.lat} />}
              </div>
              <div>
                <label className="studio-label" htmlFor="cl-lng">
                  Longitud
                </label>
                <input
                  id="cl-lng"
                  name="lng"
                  type="text"
                  inputMode="decimal"
                  className="studio-input studio-input-mono"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="-68.005250"
                  autoComplete="off"
                />
                {state.fieldErrors?.lng && <FieldError msg={state.fieldErrors.lng} />}
              </div>
            </div>

            {geoStatus === "ok" && (
              <div
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--success)",
                  margin: 0,
                }}
              >
                Coordenadas capturadas.
                {geocodeMatched && (
                  <div
                    style={{
                      font: "500 10.5px/1.4 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginTop: 3,
                    }}
                  >
                    Match: {geocodeMatched}
                  </div>
                )}
              </div>
            )}
            {geoError && (
              <p
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--danger)",
                  margin: 0,
                }}
              >
                {geoError}
              </p>
            )}
          </div>

          {/* Documento · cédula (persona) o RIF (empresa) — SDD-0131 */}
          <div>
            <label className="studio-label" htmlFor="cl-rif">
              {isCompany ? "RIF" : "Cédula"}{" "}
              <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
                (opcional)
              </span>
            </label>
            <input
              id="cl-rif"
              name="rif"
              type="text"
              className="studio-input studio-input-mono"
              defaultValue={client?.rif ?? ""}
              placeholder={isCompany ? "J-12345678-9" : "V-12345678"}
              autoComplete="off"
            />
            {state.fieldErrors?.rif && <FieldError msg={state.fieldErrors.rif} />}
            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "var(--s-1) 0 0",
              }}
            >
              {isCompany
                ? "Formato: J-12345678-9 (RIF jurídico o gubernamental)."
                : "Formato: V-12345678 (cédula V o E) o P-A1234567 (pasaporte)."}
            </p>
          </div>

          {/* Notas */}
          <div>
            <label className="studio-label" htmlFor="cl-notes">
              Notas
            </label>
            <textarea
              id="cl-notes"
              name="notes"
              rows={3}
              className="studio-input"
              defaultValue={client?.notes ?? ""}
              placeholder="Volumen mensual, observaciones del contrato, agentes asignados…"
              style={{ resize: "vertical" }}
            />
          </div>

          {state.ok && state.warning && (
            <div
              role="status"
              style={{
                marginTop: 12,
                padding: 12,
                background: "var(--warning-bg)",
                color: "var(--ink)",
                border: "1px solid var(--warning)",
                borderRadius: "var(--r-sm)",
                font: "500 12.5px/1.4 var(--f-sans)",
              }}
            >
              <div style={{ font: "700 12.5px/1 var(--f-sans)", color: "var(--warning)", marginBottom: 6 }}>
                Cliente creado{state.createdMarkbox ? ` (${state.createdMarkbox})` : ""}
              </div>
              {state.warning}
              <div style={{ marginTop: 8, textAlign: "right" }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                  onClick={onClose}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
          {(state.error || createError) && (
            <p
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
              {state.error ?? createError}
            </p>
          )}

          <div style={{ flex: 1, minHeight: 12 }} />
        </form>

        {/* Footer */}
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <div>
            {mode === "edit" && client && (
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                style={{ color: "var(--danger)" }}
                disabled={isDeleting}
                onClick={() => {
                  setDeleteError(undefined);
                  setConfirmDelete(true);
                }}
              >
                Eliminar
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            {mode === "create" ? (
              <SplitActionButton
                memoryKey="client-drawer-create"
                variant="primary"
                size="default"
                disabled={isPending}
                onError={setCreateError}
                actions={[
                  {
                    key: "create-and-close",
                    idleLabel: "Crear y cerrar",
                    loadingLabel: "Creando…",
                    successLabel: "Cliente creado",
                    successIcon: Icon.check(14),
                    description:
                      "Crea el cliente y vuelve al listado con el nuevo resaltado.",
                    onAction: () => createWithPostAction("close"),
                  },
                  {
                    key: "create-and-open",
                    idleLabel: "Crear y abrir perfil",
                    loadingLabel: "Creando…",
                    successLabel: "Abriendo perfil",
                    successIcon: Icon.check(14),
                    description:
                      "Crea el cliente y abre su perfil para completar datos extra.",
                    onAction: () => createWithPostAction("open"),
                  },
                  {
                    key: "create-and-new",
                    idleLabel: "Crear y empezar otro",
                    loadingLabel: "Creando…",
                    successLabel: "Listo el siguiente",
                    successIcon: Icon.check(14),
                    description:
                      "Crea el cliente, limpia los campos y deja este drawer abierto para batch de onboarding.",
                    onAction: () => createWithPostAction("reset"),
                  },
                ]}
              />
            ) : (
              <button
                type="submit"
                form="client-drawer-form"
                className="studio-btn studio-btn-primary"
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
          </div>
        </footer>
        {mode === "edit" && client && (
          <ConfirmDialog
            open={confirmDelete}
            danger
            reason
            reasonLabel={DELETE_CLIENT_REASON_LABEL}
            reasonPlaceholder="Ej.: ficha duplicada o de prueba"
            pending={isDeleting}
            title={DELETE_CLIENT_TITLE}
            message={deleteClientConfirmMessage(client)}
            confirmLabel={DELETE_CLIENT_CONFIRM_LABEL}
            error={deleteError}
            onCancel={() => {
              setConfirmDelete(false);
              setDeleteError(undefined);
            }}
            onConfirm={(motivo) => {
              // Limpiar antes de reintentar: el diálogo reabre su candado cuando
              // cambia `error`, también si la acción repite el mismo mensaje.
              setDeleteError(undefined);
              startDelete(async () => {
                try {
                  const result = await softDeleteClientAction(client.id, motivo);
                  if (result.ok) {
                    setConfirmDelete(false);
                    toast.show({
                      eventKey: "client:deleted",
                      tone: "success",
                      message: `Cliente ${client.markbox} eliminado. Ya no aparece en las listas.`,
                      priority: "normal",
                      scope: "module",
                      dedupeKey: `client:deleted:${client.id}`,
                    });
                    onClose();
                  } else {
                    setDeleteError(result.error ?? DELETE_CLIENT_UNCONFIRMED);
                  }
                } catch {
                  setDeleteError(DELETE_CLIENT_UNCONFIRMED);
                }
              });
            }}
          />
        )}
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}
