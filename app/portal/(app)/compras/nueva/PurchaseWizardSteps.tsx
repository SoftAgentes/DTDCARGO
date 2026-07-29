/**
 * SDD-0172 · La barra de 3 pasos de "Nueva compra".
 *
 * Los títulos son los del Norte (`portal/app.jsx`, `stepBar`) y están escritos
 * en beneficio, no en trámite: el cliente no lee "Proveedor / Detalle /
 * Confirmación" sino para qué le sirve cada paso.
 *
 * DESIGN-CHECK (SDD-0172): el Norte apaga los pasos inactivos con
 * `opacity: .4`, que deja su texto por debajo del contraste AA. Acá la
 * jerarquía se hace con tokens legibles (número en `--color-grey-500`, título
 * en `--color-grey-700`) + la barra inferior, que es la señal fuerte. Se ve
 * igual de apagado y se lee.
 */

const STEPS = [
  {
    n: 1,
    title: "Controla tus proveedores",
    detail: "De dónde salió cada proveedor.",
  },
  {
    n: 2,
    title: "Sigue tus compras",
    detail: "Llena el detalle de tu compra.",
  },
  {
    n: 3,
    title: "Trazabilidad a tu logística",
    detail: "Sigue tu envío de punta a punta.",
  },
] as const;

export function PurchaseWizardSteps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol
      aria-label="Pasos para registrar tu compra"
      className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 list-none p-0 m-0"
    >
      {STEPS.map((s) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <li key={s.n} aria-current={active ? "step" : undefined}>
            <div
              className="text-[30px] sm:text-[40px] leading-none font-black"
              style={{
                fontFamily: "var(--font-archivo-black)",
                letterSpacing: "-0.02em",
                color: active
                  ? "var(--color-wine-text)"
                  : "var(--color-grey-500)",
              }}
            >
              {s.n}
            </div>
            <div
              className="mt-1.5 text-[13px] sm:text-[14.5px] font-bold leading-[1.25]"
              style={{
                color: active ? "var(--color-ink)" : "var(--color-grey-700)",
              }}
            >
              {s.title}
            </div>
            <div className="mt-1 text-[11.5px] sm:text-[12px] text-grey-700 leading-[1.4]">
              {s.detail}
            </div>
            <div
              className="mt-2.5 h-[3px] rounded-[2px]"
              style={{
                background:
                  active || done
                    ? "var(--color-wine)"
                    : "var(--color-grey-200)",
              }}
            />
            <span className="sr-only">
              {active
                ? " · paso actual"
                : done
                  ? " · completado"
                  : " · pendiente"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
