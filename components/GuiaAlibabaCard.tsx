/**
 * Tarjeta que lleva a la guía interactiva de compra en Alibaba (SDD-0099,
 * `public/guias/comprar-en-alibaba.html`).
 *
 * Vive en `components/` (frontera OK: sólo design-tokens) para que la usen tanto
 * el sitio público como el portal.
 *
 * Por qué existe: la guía estaba viva en producción desde el 21-jun-2026 y
 * **ningún archivo del repo la enlazaba** — sólo llegaba quien se supiera la URL.
 *
 * En el portal se le pasa el `markbox` del cliente: la guía lo lee por `?mark=`,
 * precarga el campo, arma el destinatario (`林冠 DTD-1042`) y saluda por nombre,
 * así el cliente logueado no transcribe a mano un dato que ya tenemos.
 */

import { CONTACT } from "@/lib/design-tokens";

/** Sanitiza igual que la guía: sólo A-Z 0-9 y guion, con el prefijo DTD-. */
function normalizarMark(raw: string): string {
  const limpio = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!limpio) return "";
  return limpio.startsWith("DTD-") ? limpio : `DTD-${limpio}`;
}

export function guiaAlibabaHref(markbox?: string, name?: string): string {
  const qs = new URLSearchParams();
  const mark = markbox ? normalizarMark(markbox) : "";
  if (mark) qs.set("mark", mark);
  if (name?.trim()) qs.set("name", name.trim().slice(0, 40));
  const q = qs.toString();
  return `/guias/comprar-en-alibaba.html${q ? `?${q}` : ""}`;
}

export function GuiaAlibabaCard({
  markbox,
  name,
  /** `portal` = tono de "ya eres cliente"; `publico` = captación. */
  variante = "publico",
  className = "",
}: {
  markbox?: string;
  name?: string;
  variante?: "portal" | "publico";
  className?: string;
}) {
  const href = guiaAlibabaHref(markbox, name);
  const conMark = Boolean(markbox?.trim());

  return (
    <section
      className={`card-shadow bg-white border border-grey-200 rounded-[18px] p-6 ${className}`}
    >
      <span className="eyebrow eyebrow-wine">
        {variante === "portal" ? "Guía paso a paso" : "Gratis"}
      </span>
      <h3 className="mt-3 text-[17px] font-extrabold leading-[1.25] text-ink">
        ¿Es tu primera compra en Alibaba?
      </h3>
      <p className="mt-2 text-[13.5px] leading-[1.6] text-grey-700 max-w-[52ch]">
        Nueve etapas, de crear tu cuenta a tener la mercancía en nuestra bodega de{" "}
        {CONTACT.cn.city.split(" ")[0]}: buscar el producto, distinguir un proveedor serio de una
        estafa, escribirle con una plantilla lista, pedir muestras y pagar protegido. Trae
        calculadora de volumen (CBM) y de costo real puesto en Venezuela, y guarda tu avance.
      </p>
      {conMark ? (
        <p className="mt-2.5 text-[12.5px] leading-[1.55] text-grey-500">
          Tu Shipping Mark va cargado: la guía te arma sola el destinatario que pide Alibaba.
        </p>
      ) : null}
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="btn btn-primary mt-5 inline-flex"
      >
        Abrir la guía
      </a>
    </section>
  );
}
