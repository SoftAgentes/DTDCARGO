import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { getPortalClientPrincipal, getProfileCompleteness } from "@/lib/portal/portal-queries";
import { getPortalPrivateProfileContext } from "@/lib/portal/profile-private-context";
import { buildPortalSupplierMark, ciudadDeCuenta } from "@/lib/portal/portal-types";
import { docKindLabel } from "@/lib/studio/client-types";
import { listClientDeliveryAddresses } from "@/lib/studio/client-address-queries";
import type { ClientDeliveryAddress } from "@/lib/studio/client-address-types";
import {
  getPublicCalculatorCities,
  getPublicCarrierTariffs,
  combinarDestinos,
} from "@/lib/public/rates-queries";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { WhatsAppIcon } from "@/components/Icon";
import { getPortalChangeRequestSnapshot } from "@/lib/portal/change-request-queries";
import type { ClientChangeRequest } from "@/lib/portal/change-request-types";
import {
  getPortalProfileEditQuota,
  UNAVAILABLE_PROFILE_EDIT_QUOTA,
} from "@/lib/portal/profile-edit-quota";
import { AvatarEditor } from "./AvatarEditor";
import { PortalAddresses } from "./PortalAddresses";
import { CopyCodeButton } from "./CopyCodeButton";
import { CedulaPhotoRow } from "./CedulaPhotoRow";
import { ProfilePendingBanner } from "./ProfilePendingBanner";
import { DataChangeEditor } from "./DataChangeEditor";

export const metadata: Metadata = { title: "Mi perfil" };

/**
 * "Mi perfil" unificado (SDD-0145 · espeja el PortalProfile del Norte,
 * docs/design/studio/_norte/portal/app.jsx). Une lo que antes vivía en
 * /portal/cuenta (Mi cuenta, SDD-0042) y /portal/perfil (Completa tu perfil):
 *
 *  - Izquierda: avatar editable (SDD-0138 Slice D) + badge tipo de cuenta +
 *    card "TU CÓDIGO" (Shipping Mark) + Copiar código.
 *  - Derecha: Datos de cuenta (read-only, mediados por el asesor · CTA
 *    WhatsApp) · Identidad y documentos (cédula/RIF + foto con subida inline
 *    si falta) · Direcciones de entrega (SDD-0138 B+C) · card proveedores
 *    (delta prod: onboarding del Shipping Mark).
 *
 * /portal/cuenta redirige acá (permanentRedirect). El layout `(app)` ya
 * garantizó la sesión; `client` null es defensa extra.
 */
export default async function PortalProfilePage() {
  const supabase = await createClient();
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  const { client } = principal;

  // Direcciones (SDD-0138 Slice B). Best-effort: sin migración 0198 → lista vacía.
  let addresses: ClientDeliveryAddress[] = [];
  try {
    addresses = await listClientDeliveryAddresses(supabase, client.id);
  } catch {
    addresses = [];
  }

  // Catálogo de ciudades + config del calculador (Slice C · estimado last-mile).
  // Señal de pendientes (SDD-0151): misma fuente que el card del dashboard.
  // El catálogo se cruza con el tarifario (`combinarDestinos`, el mismo de la
  // calculadora pública): `calculator_cities` no trae precio, así que sin este
  // cruce cada dirección del cliente decía "la cotiza tu asesor" aunque su
  // ciudad tuviera tarifa confirmada. Cliente y asesor ven el mismo número.
  const [calcCities, calcTariffs, completeness] = await Promise.all([
    getPublicCalculatorCities(),
    getPublicCarrierTariffs(),
    getProfileCompleteness(supabase),
  ]);
  const calcDestinos = combinarDestinos(calcCities, calcTariffs);

  // Códigos que este cliente TUVO (SDD-0258) y fotos del bucket privado (avatar
  // cosmético + cédula de verificación) · SDD-0341: la RPC 0405 deriva cliente y
  // tenant de la sesión; el firmador server-only no recibe ids ni paths y la
  // página sólo ve códigos y URLs firmadas. Sin principal o ante fallo → vacío.
  //
  // Los códigos se le muestran porque le sirven de verdad: su proveedor en China
  // puede tener el código viejo rotulado, y necesita saber que esa caja llega igual.
  const { previousMarkboxes: codigosAnteriores, avatarUrl, cedulaUrl } =
    await getPortalPrivateProfileContext(supabase);
  // Existencia persistida de la foto de identidad (SDD-0439): no depende de la
  // firma temporal ni de la RPC 0405; es la misma lectura de sesión que el aviso
  // "1 pendiente", así un fallo de firma nunca ofrece reemplazar el documento.
  const hasCedulaPhoto = completeness.hasPhoto;

  // Solicitud de cambio de datos (SDD-0151). Best-effort: sin migración 0220
  // (tabla ausente) → null, sin romper. El snapshot fija tenant, cliente y
  // origen Portal a partir del mismo principal verificado al entrar.
  let openRequest: ClientChangeRequest | null = null;
  let lastResolvedRequest: ClientChangeRequest | null = null;
  let profileEditQuota = UNAVAILABLE_PROFILE_EDIT_QUOTA;
  try {
    const snapshot = await getPortalChangeRequestSnapshot(supabase, principal);
    openRequest = snapshot.open;
    lastResolvedRequest = snapshot.lastResolved;
  } catch {
    openRequest = null;
    lastResolvedRequest = null;
  }
  try {
    profileEditQuota = await getPortalProfileEditQuota(supabase);
  } catch {
    profileEditQuota = UNAVAILABLE_PROFILE_EDIT_QUOTA;
  }

  const esEmpresa = client.docKind === "empresa";
  const supplierMark = buildPortalSupplierMark(client.markbox);
  const defaultAddress =
    addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const waCompany = buildWhatsAppLink(
    `Hola DTD Cargo, soy ${client.name} (${client.markbox}) y quiero registrar mi empresa para importar a nombre de ella.`,
  );

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Mi perfil.
      </h1>
      <p className="lead mt-3 max-w-[60ch]">
        Tus datos, tus direcciones de entrega y tu código Shipping Mark — todo
        en un solo lugar.
      </p>

      <ProfilePendingBanner
        hasPhoto={completeness.hasPhoto}
        hasAddress={completeness.hasAddress}
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 lg:gap-8 items-start">
        {/* ── Columna izquierda · identidad + TU CÓDIGO ── */}
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
          <AvatarEditor name={client.name} avatarUrl={avatarUrl} />

          <span
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-paper border border-grey-200 px-3 py-1.5 text-[11px] font-bold tracking-[0.04em] text-wine-text"
          >
            {esEmpresa ? "Cuenta de empresa" : "Cuenta personal"}
          </span>

          {/* TU CÓDIGO — gradiente hero con tokens temáticos (--hero-*): en
              dark `white`/`ink` viran a navy; estos tokens son fijos. Fallbacks:
              los --hero-* viven bajo [data-portal-theme] (gate Norte) — si el
              gate se apaga, la card degrada a navy/paper y no queda ilegible. */}
          <div
            className="mt-5 rounded-[12px] p-5 text-center"
            style={{
              background:
                "linear-gradient(135deg, var(--hero-from, var(--color-ink)) 0%, var(--hero-to, var(--color-ink)) 100%)",
            }}
          >
            <div
              className="text-[10.5px] font-bold tracking-[0.16em] uppercase"
              style={{ color: "var(--hero-accent, var(--color-paper))" }}
            >
              Tu código
            </div>
            <div
              className="mt-2.5 text-[28px] leading-none"
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                color: "var(--hero-ink, var(--color-paper))",
                letterSpacing: "0.02em",
              }}
            >
              {client.markbox}
            </div>
            <p
              className="mt-2 text-[11.5px] leading-[1.45]"
              style={{ color: "var(--hero-soft, var(--color-grey-200))" }}
            >
              Tu Shipping Mark. Identifica tus cajas en nuestra bodega de Yiwu.
            </p>

            {/* SDD-0258: si su código cambió, lo primero que necesita saber es
                que el viejo NO dejó de servir — su proveedor en China pudo
                haber rotulado con él. Sin historial esto no ocupa nada. */}
            {codigosAnteriores.length > 0 && (
              <div
                className="mt-3.5 border-t pt-3"
                style={{ borderColor: "var(--hero-soft, var(--color-grey-200))", opacity: 0.9 }}
              >
                <div
                  className="text-[10px] font-bold tracking-[0.14em] uppercase"
                  style={{ color: "var(--hero-accent, var(--color-paper))" }}
                >
                  {codigosAnteriores.length === 1 ? "Tu código anterior" : "Tus códigos anteriores"}
                </div>
                <div
                  className="mt-1.5 text-[15px] leading-tight"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    color: "var(--hero-ink, var(--color-paper))",
                    letterSpacing: "0.02em",
                  }}
                >
                  {codigosAnteriores.join(" · ")}
                </div>
                <p
                  className="mt-1.5 text-[11.5px] leading-[1.45]"
                  style={{ color: "var(--hero-soft, var(--color-grey-200))" }}
                >
                  Siguen funcionando. Si tu proveedor rotuló una caja con
                  {codigosAnteriores.length === 1 ? " él" : " alguno"}, llega igual.
                </p>
              </div>
            )}
          </div>

          <CopyCodeButton markbox={client.markbox} />
        </div>

        {/* ── Columna derecha ── */}
        <div className="flex flex-col gap-6">
          {/* Datos de cuenta (read-only · mediados por el asesor) */}
          <section className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine-text">
              Datos de cuenta
            </h2>
            <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre / empresa" value={client.name} />
              <Field label="Email" value={client.email} mono empty="Sin email cargado" />
              <Field
                label="Teléfono"
                value={client.phone}
                mono
                empty="Sin teléfono cargado"
              />
              {/* La dirección predeterminada manda —es la que de verdad recibe la
                  carga—, pero si todavía no cargó ninguna caemos a la ciudad que
                  declaró AL REGISTRARSE (migr 0348). Antes este campo se veía
                  vacío en ese hueco, aunque el dato ya estuviera guardado desde
                  el alta. */}
              <Field
                label="Ciudad"
                value={ciudadDeCuenta(defaultAddress?.city, client)}
                empty="Según tu dirección predeterminada"
              />
            </dl>
            <DataChangeEditor
              isEmpresa={esEmpresa}
              current={{
                name: client.name ?? "",
                doc: client.rif ?? "",
                phone: client.phone ?? "",
              }}
              openRequest={openRequest}
              lastRejected={
                lastResolvedRequest?.status === "rejected"
                  ? lastResolvedRequest
                  : null
              }
              quota={profileEditQuota}
            />
          </section>

          {/* Identidad y documentos */}
          <section
            id="doc-identidad"
            className="scroll-mt-24 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8"
          >
            <div className="flex items-center gap-2.5">
              <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine-text">
                Identidad y documentos
              </h2>
              {!completeness.hasPhoto && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] uppercase text-grey-700"
                  style={{ border: "1px solid var(--color-status-warning)" }}
                >
                  <span
                    className="block h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--color-status-warning)" }}
                    aria-hidden
                  />
                  1 pendiente
                </span>
              )}
            </div>

            <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label={esEmpresa ? "Razón social" : "Nombre completo"}
                value={client.name}
              />
              <Field
                label={esEmpresa ? "RIF" : "Cédula / RIF"}
                value={client.rif}
                mono
                empty="Sin documento cargado"
              />
              <Field
                label="Tipo de cliente"
                value={client.docKind ? docKindLabel(client.docKind) : null}
                empty="Sin especificar"
              />
            </dl>

            <div className="mt-5">
              <CedulaPhotoRow
                label={esEmpresa ? "Documento RIF" : "Cédula de identidad / RIF"}
                hasExistingPhoto={hasCedulaPhoto}
                viewUrl={cedulaUrl}
              />
            </div>

            {/* Registrar empresa (solo persona) — mediado por el asesor. */}
            {!esEmpresa && (
              <div
                className="mt-6 rounded-[12px] bg-paper border border-grey-200 border-l-[3px] p-5"
                style={{ borderLeftColor: "var(--color-wine)" }}
              >
                <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine-text">
                  ¿Importas para tu negocio?
                </div>
                <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55]">
                  Registra tu empresa (RIF) para facturar a nombre de ella. Tu
                  asesor crea el perfil de empresa vinculado a tu cuenta —
                  escríbele y lo deja listo.
                </p>
                <a
                  href={waCompany}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost mt-4 inline-flex items-center gap-2"
                >
                  <WhatsAppIcon size={16} /> Registrar mi empresa
                </a>
              </div>
            )}
          </section>

          {/* Direcciones de entrega (SDD-0138 B+C · REUSO completo) */}
          <section
            id="direcciones"
            className="scroll-mt-24 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8"
          >
            <PortalAddresses
              addresses={addresses}
              cities={calcDestinos.map((c) => ({
                id: c.id,
                label: c.label,
                km: c.km,
                casco: c.casco,
                ventaCbm: c.ventaCbm,
              }))}
              framed={false}
            />
          </section>

          {/* Tu Shipping Mark para tus proveedores (delta prod — se conserva) */}
          <section
            className="card-shadow bg-white border border-grey-200 rounded-[18px] border-l-[3px] p-6 sm:p-8"
            style={{ borderLeftColor: "var(--color-wine)" }}
          >
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine-text">
              Tu Shipping Mark para tus proveedores
            </div>
            <h2
              className="mt-2 text-[20px] sm:text-[23px] leading-[1.15] tracking-[-0.02em] text-ink"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              Que tu proveedor lo escriba en cada caja.
            </h2>

            <p className="mt-4 text-[14.5px] text-grey-700 leading-[1.6]">
              Cuando le pidas mercancía a tu proveedor en China, pásale tu{" "}
              <span style={{ fontFamily: "var(--font-noto-sc), var(--font-archivo)" }}>
                Shipping Mark (唛头)
              </span>
              . Él lo escribe en <strong className="text-ink">cada caja</strong>.
              Así, cuando tu mercancía llega a nuestra bodega de Yiwu, sabemos al
              instante que es tuya y no se mezcla ni se pierde.
            </p>

            <div className="mt-5 rounded-[12px] bg-paper border border-grey-200 p-5">
              <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500">
                Marca que va en cada caja
              </div>
              <div
                className="mt-2 text-[24px] sm:text-[28px] leading-none text-ink"
                style={{
                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                  letterSpacing: "-0.01em",
                }}
              >
                {supplierMark}
              </div>
            </div>

            <ol className="mt-6 flex flex-col gap-4 list-none p-0">
              <Step
                n="01"
                title="Le pasas tu Shipping Mark al proveedor"
                copy="Cuando hagas el pedido, mándale tu código por WeChat o donde te comuniques con él."
              />
              <Step
                n="02"
                title="Lo escribe en cada caja"
                copy="El proveedor rotula cada bulto con tu Shipping Mark antes de despacharlo a nuestra bodega de Yiwu."
              />
              <Step
                n="03"
                title="Llega identificada a la bodega"
                copy="Al recibirla, la asociamos a tu cuenta por el Shipping Mark y empieza a verse en Mis envíos."
              />
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Fila read-only del perfil. Valor vacío → placeholder atenuado (no un dato
 * falso): el alta es mediada por el admin y puede faltar un campo.
 */
function Field({
  label,
  value,
  mono = false,
  empty,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  empty?: string;
}) {
  const has = value != null && value.trim() !== "";
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </dt>
      <dd
        className={`text-[15px] ${has ? "font-semibold text-ink" : "text-grey-500"}`}
        style={
          mono && has
            ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }
            : undefined
        }
      >
        {has ? value : (empty ?? "—")}
      </dd>
    </div>
  );
}

function Step({ n, title, copy }: { n: string; title: string; copy: string }) {
  return (
    <li className="flex gap-4">
      <span
        className="flex-shrink-0 text-[18px] leading-none text-wine-text"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        {n}
      </span>
      <div>
        <div className="text-[14.5px] font-bold text-ink">{title}</div>
        <p className="mt-0.5 text-[13.5px] text-grey-700 leading-[1.55] max-w-[44ch]">
          {copy}
        </p>
      </div>
    </li>
  );
}
