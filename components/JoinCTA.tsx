import Link from "next/link";
import { ArrowIcon } from "./Icon";

/**
 * Banda de cierre del home (antes del footer): conversión a alta de cliente.
 * CTA contextual de "Regístrate" — la decisión de IA fue NO saturar el nav con
 * registro y empujarlo fuerte acá + en el Hero. El "Acceder al portal" se suma
 * a esta banda cuando exista la pantalla de login (SDD-0042 Fase 1b).
 */
export function JoinCTA() {
  return (
    <section className="py-16 lg:py-20">
      <div className="wrap">
        <div className="card-shadow-dark bg-ink rounded-[18px] p-9 lg:p-14 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 lg:items-center">
          <div>
            <span className="eyebrow" style={{ color: "rgba(255,255,255,0.5)" }}>
              Empieza a importar
            </span>
            <h2
              className="mt-4 text-white text-[30px] lg:text-[40px] leading-[1.05]"
              style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
            >
              Regístrate y obtén{" "}
              <br className="hidden lg:inline" />
              tu MARKBOX.
            </h2>
            <p className="mt-4 text-[15px] text-white/70 leading-[1.55] max-w-[52ch]">
              Tu código de cliente identifica tus cajas en nuestra bodega de Yiwu
              para que nada se mezcle. Te damos de alta sin costo y un asesor te
              acompaña desde el primer envío.
            </p>
          </div>
          <div className="lg:justify-self-end">
            <Link href="/registro" className="btn btn-primary w-full lg:w-auto">
              Regístrate como cliente <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
