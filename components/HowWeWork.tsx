import { STEPS, buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon } from "./Icon";

/**
 * Sección "Cómo trabajamos" — 4 pasos en grid.
 * Portada del Brand Book DTD § HowWeWork.
 */
export function HowWeWork() {
  return (
    <section className="py-20 lg:py-25 bg-paper" id="how">
      <div className="wrap">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-10 mb-14">
          <div>
            <span className="eyebrow">Cómo trabajamos</span>
            <h2 className="h-section mt-4">
              De la cotización
              <br />
              a la entrega firmada.
            </h2>
          </div>
          <p className="lead max-w-[36ch]">
            Un equipo asignado por cuenta, sin call centers ni handoffs.
            Cuatro pasos, una persona responsable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-8 flex flex-col"
            >
              <div
                className="text-[14px] tracking-[0.1em] mb-3"
                style={{
                  color: "var(--color-wine)",
                  fontFamily: "var(--font-archivo-black)",
                }}
              >
                {s.n} / 04
              </div>
              <h3 className="h-card text-ink mb-2">{s.title}</h3>
              <p className="text-[14px] leading-[1.55] text-grey-500">
                {s.copy}
              </p>
            </div>
          ))}
        </div>

        {/* CTA al final del proceso — momento de máxima intención del scroll */}
        <div className="mt-14 text-center">
          <a
            href={buildWhatsAppLink(
              "Hola DTD-CARGO, quiero cotizar mi primer envío desde China a Venezuela. ¿Pueden ayudarme con el proceso completo?"
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Cotiza tu primer envío <ArrowIcon />
          </a>
          <p className="mt-3 text-[13px] text-grey-500">
            Respuesta humana por WhatsApp. Sin compromiso.
          </p>
        </div>
      </div>
    </section>
  );
}
