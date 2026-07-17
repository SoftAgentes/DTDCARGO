/**
 * Sección "MARKBOX" — sistema de marcaje logístico (SDD-0064 Fase 3).
 *
 * Explica el MARKBOX (tu Shipping Mark · 唛头) como el sistema que identifica la carga del
 * cliente desde China hasta su puerta, con el flujo real de la operación
 * (registro → proveedor marca cada caja → bodega Yiwu identifica → consolida →
 * tracking → entrega). Grounded en el packing list oficial (入仓单) — sin
 * métricas inventadas. Server component, contenido en DOM (crawleable).
 *
 * El nombre de cara al cliente es MARKBOX (= Shipping Mark, el término
 * internacional · 唛头); el código interno sigue siendo DTD-NNNN.
 */
import Link from "next/link";
import { buildWhatsAppLink, FONT_MONO } from "@/lib/design-tokens";
import { CheckIcon, ArrowIcon } from "@/components/Icon";

const PASOS: { n: string; title: string; copy: string }[] = [
  {
    n: "01",
    title: "Te registras gratis",
    copy: "Al darte de alta recibes tu Shipping Mark al instante: tu código único DTD-NNNN.",
  },
  {
    n: "02",
    title: "Se lo pasas a tu proveedor",
    copy: "Le compartes tu Shipping Mark a tu proveedor en China cuando le haces el pedido.",
  },
  {
    n: "03",
    title: "Lo marca en cada bulto",
    copy: "Tu proveedor escribe tu Shipping Mark en cada caja, cartón o embalaje antes de despachar.",
  },
  {
    n: "04",
    title: "Llega a nuestra bodega",
    copy: "La mercancía llega a nuestra bodega propia en Yiwu, ya identificada con tu marca.",
  },
  {
    n: "05",
    title: "La identificamos y revisamos",
    copy: "Por tu Shipping Mark sabemos que la caja es tuya, la asociamos a tu cuenta y la inspeccionamos.",
  },
  {
    n: "06",
    title: "Consolidamos y rastreas",
    copy: "Se consolida con el resto de tu carga y empieza a verse en tu tracking, etapa por etapa.",
  },
  {
    n: "07",
    title: "Pasa la aduana en Venezuela",
    copy: "Tu Shipping Mark identifica cuál carga es la tuya durante la gestión aduanal y el pago de aranceles e impuestos, ya incluidos en tu cotización.",
  },
  {
    n: "08",
    title: "La recibes en tu puerta",
    copy: "Llega puerta a puerta a tu dirección en Venezuela — identificada de principio a fin.",
  },
];

const BENEFICIOS = [
  "Evita que tu carga se mezcle con la de otros importadores",
  "Acelera la recepción en bodega",
  "Trazabilidad de cada caja, de origen a destino",
  "Menos errores y menos pérdidas",
];

export function ShippingMark() {
  const ctaHref = buildWhatsAppLink(
    "Hola DTD Cargo, quiero registrarme y obtener mi Shipping Mark.",
  );

  return (
    <section className="py-16 lg:py-20 bg-white" id="shipping-mark">
      <div className="wrap">
        <span className="eyebrow">Shipping Mark · 唛头</span>
        <h2 className="h-section mt-4" style={{ fontSize: "clamp(28px, 4vw, 46px)" }}>
          Tu carga, identificada{" "}
          <span style={{ color: "var(--color-wine)" }}>de China a tu puerta.</span>
        </h2>
        <p className="lead mt-5 max-w-[60ch]">
          El Shipping Mark es el sistema de marcaje de DTD Cargo — así se conoce
          este marcado a nivel internacional (唛头 en China). Es el código que
          identifica tus cajas desde la fábrica hasta Venezuela, para que tu
          mercancía nunca se confunda con la de otro.
        </p>

        {/* Flujo paso a paso */}
        <ol className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
          {PASOS.map((p) => (
            <li
              key={p.n}
              className="card-shadow bg-paper border border-grey-200 rounded-[14px] p-6"
            >
              <span
                className="inline-flex w-10 h-10 rounded-full bg-wine text-white items-center justify-center text-[15px] font-bold"
                style={{ fontFamily: FONT_MONO }}
                aria-hidden
              >
                {p.n}
              </span>
              <h3 className="mt-4 text-[17px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink">
                {p.title}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.55] text-grey-700">{p.copy}</p>
            </li>
          ))}
        </ol>

        {/* Beneficios + cierre */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 lg:items-center">
          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center flex-shrink-0 bg-wine/10 text-wine">
                  <CheckIcon size={12} />
                </span>
                <span className="text-[14px] leading-[1.5] text-grey-700">{b}</span>
              </li>
            ))}
          </ul>

          <div className="bg-ink text-white rounded-[18px] p-7 lg:p-8">
            <p
              className="text-[18px] lg:text-[20px] leading-[1.3] tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              Tu Shipping Mark le da identidad a tu mercancía antes de que
              empiece el viaje.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <Link href="/registro" className="btn btn-primary">
                Regístrate y obtén tu Shipping Mark
              </Link>
              <a
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] font-semibold text-white/85 hover:text-white inline-flex items-center gap-1.5"
              >
                Pregúntanos por WhatsApp <ArrowIcon size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
