import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { RegistroForm } from "@/components/RegistroForm";

export const metadata: Metadata = {
  title: "Registro de cliente",
  description:
    "Date de alta como cliente de DTD Cargo y obtené tu MARKBOX — el código que identifica tus cajas en nuestra bodega de Yiwu. Un asesor te asigna tu código y te contacta por WhatsApp.",
  keywords: [
    "registro cliente DTD Cargo",
    "darse de alta importador China Venezuela",
    "MARKBOX DTD",
    "abrir cuenta DTD Cargo",
  ],
  alternates: { canonical: "/registro" },
  openGraph: {
    title: "Registro de cliente · DTD Cargo",
    description:
      "Date de alta y obtené tu MARKBOX para empezar a importar de China con DTD Cargo.",
    url: "/registro",
  },
};

const STEPS = [
  {
    n: "01",
    title: "Te registrás",
    copy: "Dejás tus datos en el formulario — un minuto, sin costo de alta.",
  },
  {
    n: "02",
    title: "Te asignamos tu MARKBOX",
    copy: "Un asesor te da de alta y te pasa tu código de cliente DTD-XXXX por WhatsApp.",
  },
  {
    n: "03",
    title: "Se lo pasás a tu proveedor",
    copy: "Tu proveedor en China lo escribe en cada caja como Shipping Mark (唛头). Así tu mercancía llega identificada a nuestra bodega en Yiwu.",
  },
];

export default function RegistroPage() {
  return (
    <>
      <Nav />
      <main className="bg-paper">
        {/* Hero */}
        <section className="py-16 lg:py-24">
          <div className="wrap">
            <span className="eyebrow">Registro de cliente · DTD Cargo</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(40px, 6vw, 80px)" }}
            >
              Date de alta
              <br />
              <span style={{ color: "var(--color-wine)" }}>y obtené tu MARKBOX.</span>
            </h1>
            <p className="lead mt-6">
              El MARKBOX es tu código de cliente: identifica tus cajas en nuestra
              bodega de Yiwu para que nada se mezcle ni se pierda. Registrate y un
              asesor te lo asigna.
            </p>
          </div>
        </section>

        {/* 2-col: cómo funciona + formulario */}
        <section className="pb-16 lg:pb-24">
          <div className="wrap grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16">
            {/* Cómo funciona */}
            <div className="flex flex-col">
              <h2
                className="text-[24px] lg:text-[28px] leading-[1.1] tracking-[-0.02em] text-ink"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                Cómo funciona tu alta
              </h2>

              <ol className="mt-7 flex flex-col gap-6 list-none p-0">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span
                      className="flex-shrink-0 text-[20px] leading-none text-wine"
                      style={{ fontFamily: "var(--font-archivo-black)" }}
                    >
                      {s.n}
                    </span>
                    <div>
                      <div className="text-[16px] font-bold text-ink">{s.title}</div>
                      <p className="mt-1 text-[14.5px] text-grey-700 leading-[1.55] max-w-[46ch]">
                        {s.copy}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Callout MARKBOX */}
              <div
                className="mt-9 p-5 lg:p-6 rounded-[12px] bg-white border border-grey-200 border-l-[3px]"
                style={{ borderLeftColor: "var(--color-wine)" }}
              >
                <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine mb-1.5">
                  ¿Ya sos cliente?
                </div>
                <p className="text-[14px] leading-[1.55] text-grey-700">
                  Si ya tenés tu MARKBOX no hace falta que te registres de nuevo —
                  seguí operando por WhatsApp con tu asesor de siempre. Este alta es
                  para clientes nuevos.
                </p>
              </div>
            </div>

            {/* Formulario */}
            <RegistroForm />
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
