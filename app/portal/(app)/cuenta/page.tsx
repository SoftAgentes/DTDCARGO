import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { buildPortalSupplierMark } from "@/lib/portal/portal-types";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { WhatsAppIcon } from "@/components/Icon";

export const metadata: Metadata = { title: "Mi cuenta" };

/**
 * Perfil read-only del cliente logueado (SDD-0042 · Fase 2, slice "Mi cuenta").
 *
 * El modelo de cliente es **mediado por el admin**: el cliente NO edita sus
 * datos acá (los cambia su asesor). Por eso todo es read-only + un CTA de
 * WhatsApp para pedir correcciones.
 *
 * El VALOR de la página es la sección "Tu MARKBOX para tus proveedores": le
 * recuerda al cliente que su MARKBOX es lo que el proveedor en China escribe en
 * cada caja como Shipping Mark (唛头), para que la mercancía llegue identificada
 * a la bodega de Yiwu. (De cara al cliente el término es MARKBOX; "Shipping Mark"
 * sólo aparece al nombrar lo que hace el proveedor.)
 */
export default async function PortalAccountPage() {
  const supabase = await createClient();
  // El layout `(app)` ya garantizó la sesión del portal (redirect al login si
  // null), así que acá `client` no debería ser null; el guard es defensa extra.
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const supplierMark = buildPortalSupplierMark(client.markbox);
  const waUpdate = buildWhatsAppLink(
    `Hola DTD Cargo, soy ${client.name} (${client.markbox}) y necesito actualizar un dato de mi cuenta.`,
  );

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Mi cuenta.
      </h1>
      <p className="lead mt-3">
        Estos son los datos con los que te tenemos registrado. Los administra tu
        asesor — si algo cambió, avisale y lo actualizamos.
      </p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-6 lg:gap-8 items-start">
        {/* ── Datos del cliente (read-only) ── */}
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
          {/* MARKBOX prominente — es SU identificador */}
          <div className="pb-6 border-b border-grey-200">
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
              Tu MARKBOX
            </div>
            <div
              className="mt-2 text-[30px] sm:text-[36px] leading-none text-wine"
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                letterSpacing: "-0.01em",
              }}
            >
              {client.markbox}
            </div>
            <p className="mt-2 text-[12.5px] text-grey-500 leading-[1.5]">
              Tu código de cliente. Identifica tus cajas en nuestra bodega de Yiwu.
            </p>
          </div>

          <dl className="pt-6 flex flex-col gap-4">
            <Field label="Nombre / empresa" value={client.name} />
            <Field label="Email" value={client.email} mono empty="Sin email cargado" />
            <Field
              label="Teléfono"
              value={client.phone}
              mono
              empty="Sin teléfono cargado"
            />
            <Field
              label="Dirección de entrega"
              value={client.address}
              empty="Sin dirección de entrega cargada"
            />
          </dl>

          {/* Nota read-only + CTA de corrección */}
          <div className="mt-8 pt-6 border-t border-grey-200">
            <p className="text-[13.5px] text-grey-700 leading-[1.55]">
              ¿Algún dato desactualizado? Escribile a tu asesor y lo corregimos
              por vos.
            </p>
            <a
              href={waUpdate}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost mt-4 inline-flex items-center gap-2"
            >
              <WhatsAppIcon size={18} /> Actualizar mis datos
            </a>
          </div>
        </div>

        {/* ── Tu MARKBOX para tus proveedores (el VALOR) ── */}
        <div
          className="card-shadow bg-white border border-grey-200 rounded-[18px] border-l-[3px] p-6 sm:p-8"
          style={{ borderLeftColor: "var(--color-wine)" }}
        >
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
            Tu MARKBOX para tus proveedores
          </div>
          <h2
            className="mt-2 text-[20px] sm:text-[23px] leading-[1.15] tracking-[-0.02em] text-ink"
            style={{ fontFamily: "var(--font-archivo-black)" }}
          >
            Que tu proveedor lo escriba en cada caja.
          </h2>

          <p className="mt-4 text-[14.5px] text-grey-700 leading-[1.6]">
            Cuando le pidas mercancía a tu proveedor en China, pasale tu MARKBOX.
            Él lo escribe en <strong className="text-ink">cada caja</strong> como{" "}
            <span style={{ fontFamily: "var(--font-noto-sc), var(--font-archivo)" }}>
              Shipping Mark (唛头)
            </span>
            . Así, cuando tu mercancía llega a nuestra bodega de Yiwu, sabemos al
            instante que es tuya y no se mezcla ni se pierde.
          </p>

          {/* La marca que va en la caja */}
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
              title="Le pasás tu MARKBOX al proveedor"
              copy="Cuando hagas el pedido, mandale tu código por WeChat o donde te comuniques con él."
            />
            <Step
              n="02"
              title="Lo escribe en cada caja"
              copy="El proveedor rotula cada bulto con tu MARKBOX antes de despacharlo a nuestra bodega de Yiwu."
            />
            <Step
              n="03"
              title="Llega identificada a la bodega"
              copy="Al recibirla, la asociamos a tu cuenta por el MARKBOX y empieza a verse en Mis envíos."
            />
          </ol>
        </div>
      </div>
    </div>
  );
}

/**
 * Una fila read-only del perfil. Si el valor es null/vacío muestra un placeholder
 * atenuado (no un dato falso), porque el alta del cliente es mediada por el admin
 * y algunos campos pueden no estar cargados todavía.
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
        className={`text-[15.5px] ${
          has ? "font-semibold text-ink" : "text-grey-500"
        }`}
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
