import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { PHOTO_BUCKET } from "@/lib/portal/client-photo";
import { buildPortalSupplierMark } from "@/lib/portal/portal-types";
import { docKindLabel } from "@/lib/studio/client-types";
import { listClientDeliveryAddresses } from "@/lib/studio/client-address-queries";
import type { ClientDeliveryAddress } from "@/lib/studio/client-address-types";
import {
  getPublicCalculatorCities,
  getPublicCalculatorConfig,
} from "@/lib/public/rates-queries";
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { WhatsAppIcon, ChatIcon } from "@/components/Icon";
import { AvatarEditor } from "./AvatarEditor";
import { PortalAddresses } from "./PortalAddresses";
import { CopyCodeButton } from "./CopyCodeButton";
import { CedulaPhotoRow } from "./CedulaPhotoRow";

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
  const client = await getPortalClient(supabase);
  if (!client) return null;

  // Direcciones (SDD-0138 Slice B). Best-effort: sin migración 0198 → lista vacía.
  let addresses: ClientDeliveryAddress[] = [];
  try {
    addresses = await listClientDeliveryAddresses(supabase, client.id);
  } catch {
    addresses = [];
  }

  // Catálogo de ciudades + config del calculador (Slice C · estimado last-mile).
  const [calcCities, calcConfig] = await Promise.all([
    getPublicCalculatorCities(),
    getPublicCalculatorConfig(),
  ]);
  const lastMileParams = calcConfig
    ? {
        thresholdCascoKm: calcConfig.thresholdCascoKm,
        tarifaKmFueraCasco: calcConfig.tarifaKmFueraCasco,
      }
    : null;

  // Fotos del bucket privado (avatar cosmético + cédula de verificación):
  // signed URLs server-side con el ADMIN client, scopeado al cliente resuelto
  // por sesión. Best-effort: sin columna/archivo → null, sin romper.
  let avatarUrl: string | null = null;
  let cedulaUrl: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("clients")
      .select("avatar_path, cedula_photo_path")
      .eq("id", client.id)
      .maybeSingle<{
        avatar_path: string | null;
        cedula_photo_path: string | null;
      }>();
    const avatarPath = String(row?.avatar_path ?? "").trim();
    const cedulaPath = String(row?.cedula_photo_path ?? "").trim();
    if (avatarPath) {
      const { data: signed } = await admin.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(avatarPath, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }
    if (cedulaPath) {
      const { data: signed } = await admin.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(cedulaPath, 3600);
      cedulaUrl = signed?.signedUrl ?? null;
    }
  } catch {
    avatarUrl = null;
    cedulaUrl = null;
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

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 lg:gap-8 items-start">
        {/* ── Columna izquierda · identidad + TU CÓDIGO ── */}
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
          <AvatarEditor name={client.name} avatarUrl={avatarUrl} />

          <span
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-paper border border-grey-200 px-3 py-1.5 text-[11px] font-bold tracking-[0.04em] text-wine"
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
          </div>

          <CopyCodeButton markbox={client.markbox} />
        </div>

        {/* ── Columna derecha ── */}
        <div className="flex flex-col gap-6">
          {/* Datos de cuenta (read-only · mediados por el asesor) */}
          <section className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
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
              <Field
                label="Ciudad"
                value={defaultAddress?.city ?? null}
                empty="Según tu dirección predeterminada"
              />
            </dl>
            <div className="mt-6 pt-5 border-t border-grey-200 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <p className="text-[13px] text-grey-700 leading-[1.55] flex-1">
                Estos datos los administra tu asesor. ¿Algo cambió? Escríbenos
                por el chat y lo actualizamos por ti.
              </p>
              <Link
                href="/portal/mensajes?tema=datos"
                className="btn btn-ghost inline-flex items-center gap-2 flex-shrink-0"
              >
                <ChatIcon size={16} /> Actualizar mis datos
              </Link>
            </div>
          </section>

          {/* Identidad y documentos */}
          <section className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
              Identidad y documentos
            </h2>

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
                viewUrl={cedulaUrl}
              />
              <p className="mt-2 text-[12px] text-grey-500 leading-[1.5]">
                La foto queda privada — solo la ve el equipo de DTD para
                verificar tu identidad antes de tu primera carga.
              </p>
            </div>

            {/* Registrar empresa (solo persona) — mediado por el asesor. */}
            {!esEmpresa && (
              <div
                className="mt-6 rounded-[12px] bg-paper border border-grey-200 border-l-[3px] p-5"
                style={{ borderLeftColor: "var(--color-wine)" }}
              >
                <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine">
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
          <section className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
            <PortalAddresses
              addresses={addresses}
              cities={calcCities.map((c) => ({
                id: c.id,
                label: c.label,
                km: c.km,
                casco: c.casco,
              }))}
              lastMileParams={lastMileParams}
              framed={false}
            />
          </section>

          {/* Tu Shipping Mark para tus proveedores (delta prod — se conserva) */}
          <section
            className="card-shadow bg-white border border-grey-200 rounded-[18px] border-l-[3px] p-6 sm:p-8"
            style={{ borderLeftColor: "var(--color-wine)" }}
          >
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
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
        className="flex-shrink-0 text-[18px] leading-none text-wine"
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
