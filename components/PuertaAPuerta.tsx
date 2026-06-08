/**
 * "¿Qué significa puerta a puerta?" + tabla de transparencia (SDD-0064).
 *
 * Explica primero el concepto (puerta a puerta) y después la metodología
 * técnica (DDP). La tabla incluye / puede variar / no aplica fija expectativas
 * sin promesas absolutas. Server component, contenido en DOM (crawleable por la
 * IA de Kommo). Mismo molde reutilizable luego en las fichas de /servicios.
 */
import { CheckIcon, CloseIcon } from "@/components/Icon";

const INCLUYE = [
  "Recepción de tu carga en China",
  "Consolidación",
  "Flete internacional",
  "Gestión aduanal",
  "Aranceles e impuestos según cotización",
  "Tracking del envío",
  "Entrega final en tu dirección en Venezuela",
];

const PUEDE_VARIAR = [
  "Peso y volumen reales",
  "Tipo de producto",
  "Embalaje especial",
  "Productos regulados",
  "Ciudad de entrega",
  "Inspecciones especiales",
  "Cambios no declarados a tiempo",
];

const NO_APLICA = [
  "Mercancía prohibida",
  "Productos no declarados",
  "Carga sin documentación",
  "Productos restringidos sin permisos",
];

type Tone = "wine" | "ink" | "grey";
type Marker = "check" | "dot" | "close";

export function PuertaAPuerta() {
  return (
    <section className="py-16 lg:py-20" id="puerta-a-puerta">
      <div className="wrap">
        <span className="eyebrow">Puerta a puerta</span>
        <h2
          className="h-section mt-4"
          style={{ fontSize: "clamp(28px, 4vw, 46px)" }}
        >
          ¿Qué significa{" "}
          <span style={{ color: "var(--color-wine)" }}>puerta a puerta?</span>
        </h2>

        <div className="mt-6 flex flex-col gap-4 max-w-[64ch]">
          <p className="text-[16px] leading-[1.6] text-grey-700">
            Nuestro servicio puerta a puerta lleva tu mercancía desde China hasta
            tu dirección en Venezuela. Coordinamos recepción, consolidación,
            transporte internacional, gestión aduanal, impuestos y entrega final.
          </p>
          <p className="text-[16px] leading-[1.6] text-grey-700">
            Esta modalidad se conoce internacionalmente como{" "}
            <strong className="text-ink">DDP</strong>, por sus siglas en inglés{" "}
            <em>Delivered Duty Paid</em>.
          </p>
          <p className="text-[16px] leading-[1.6] text-grey-700">
            En palabras simples: no tienes que coordinar puerto, nacionalización,
            pagos aduanales ni transporte interno por separado.{" "}
            <strong className="text-ink">
              DTD Cargo centraliza la operación con un solo equipo responsable.
            </strong>
          </p>
        </div>

        {/* Tabla de transparencia */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          <TransparencyCol title="Qué incluye" tone="wine" marker="check" items={INCLUYE} />
          <TransparencyCol title="Qué puede variar" tone="ink" marker="dot" items={PUEDE_VARIAR} />
          <TransparencyCol title="Qué no aplica" tone="grey" marker="close" items={NO_APLICA} />
        </div>

        <p className="mt-5 text-[13px] leading-[1.5] text-grey-500">
          Cotización clara y aviso previo ante cualquier ajuste operativo.
        </p>
      </div>
    </section>
  );
}

function TransparencyCol({
  title,
  tone,
  marker,
  items,
}: {
  title: string;
  tone: Tone;
  marker: Marker;
  items: string[];
}) {
  const headerColor =
    tone === "wine" ? "text-wine" : tone === "grey" ? "text-grey-500" : "text-ink";
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[14px] p-6">
      <div className={`text-[11px] font-bold tracking-[0.14em] uppercase ${headerColor}`}>
        {title}
      </div>
      <ul className="mt-4 flex flex-col gap-2.5 list-none p-0 m-0">
        {items.map((it) => (
          <li
            key={it}
            className="flex items-start gap-2.5 text-[14px] leading-[1.45] text-grey-700"
          >
            <MarkerIcon marker={marker} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MarkerIcon({ marker }: { marker: Marker }) {
  if (marker === "check") {
    return (
      <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center flex-shrink-0 bg-wine/10 text-wine">
        <CheckIcon size={12} />
      </span>
    );
  }
  if (marker === "close") {
    return (
      <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center flex-shrink-0 bg-grey-100 text-grey-500">
        <CloseIcon size={12} />
      </span>
    );
  }
  // dot — "puede variar" (heads-up neutro). Misma caja w-5 h-5 que los otros
  // marcadores para compartir baseline y sangría (escala 4px, sin valores mágicos).
  return (
    <span className="mt-0.5 w-5 h-5 grid place-items-center flex-shrink-0" aria-hidden>
      <span className="w-1.5 h-1.5 rounded-full bg-grey-300" />
    </span>
  );
}
