/**
 * SDD-0686 · cierre del color del Studio (2026-11-21).
 *
 * - Ningún texto del Studio usa `--ink-mute`, que no llega a 4,5:1 (2,44 a 2,78:1
 *   en claro). Decisión de Sam: «a recomendada» (opción A): el texto pasa a
 *   `--ink-soft` y `--ink-mute` queda para bordes, fondos, puntos, íconos y
 *   deshabilitados.
 * - Lista cerrada (revisión de la #759): todo `var(--ink-mute` de `app/studio`
 *   (estilo en línea, CSS, `fill=`, el respaldo `var(--ink-mute, …)`, un `return`
 *   de una función de tono o una clase `text-[var(--ink-mute)]`) tiene que estar
 *   en `PERMITIDO`, con su cuenta exacta y su motivo. La lista solo puede bajar.
 * - El brillo del foco de los campos oscuros es azul de acción, no vino suave.
 *
 * Noticias web queda fuera: pinta en un bloque `data-theme="light"` fijo, donde los
 * tokens del Studio tomarían su valor oscuro sobre fondo claro. Su color va en la
 * fase 3, igual que su acción (`color-accion-fase2-g3-contract.test.ts`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const DESHABILITADO = "texto deshabilitado: WCAG lo exceptúa del contraste y debe verse apagado";
const NO_ES_TEXTO = "no es texto: borde, fondo, punto, ícono o raya decorativa";

const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "app/studio/_components/ui/DateField.tsx": { cuenta: 1, motivo: DESHABILITADO },
  "app/studio/(app)/fiscal/_components/FiscalConfig.tsx": { cuenta: 1, motivo: DESHABILITADO },
  "app/studio/(app)/reportes/_components/ReportesClient.tsx": { cuenta: 1, motivo: DESHABILITADO },
  "app/studio/(app)/usuarios/_components/acceso/permisos.css": { cuenta: 2, motivo: `${DESHABILITADO} (.perm-opt:disabled) y punto de actividad revocada` },
  "app/studio/studio.css": { cuenta: 3, motivo: `${DESHABILITADO} (.studio-cal-today-btn:disabled) y dos bordes del botón de bugs` },
  "app/studio/(app)/debug/_components/debug-tabs.shared.ts": { cuenta: 1, motivo: `${NO_ES_TEXTO}: punto del modo local` },
  "app/studio/(app)/mailing/_components/BlacklistView.tsx": { cuenta: 1, motivo: `${NO_ES_TEXTO}: color de la raya del subrayado` },
  "app/studio/(app)/mailing/_components/MailingClient.tsx": { cuenta: 1, motivo: `${NO_ES_TEXTO}: color de la raya del subrayado` },
  "app/studio/(app)/mailing/_components/SignaturesView.tsx": { cuenta: 1, motivo: `${NO_ES_TEXTO}: barras de la miniatura de firma` },
  "app/studio/(app)/nomina/_components/NominaClient.tsx": { cuenta: 1, motivo: `${NO_ES_TEXTO}: fondo del interruptor apagado` },
  "app/studio/(app)/operarios/_components/OperariosClient.tsx": { cuenta: 1, motivo: `${NO_ES_TEXTO}: fondo del interruptor apagado` },
  "app/studio/(app)/seniat/_components/FilingDetailDrawer.tsx": { cuenta: 1, motivo: `${NO_ES_TEXTO}: ícono de un documento opcional pendiente` },
  "app/studio/_components/bug-reporter/BugFABButton.tsx": { cuenta: 1, motivo: `${NO_ES_TEXTO}: borde` },
  "app/studio/_components/ui/SplitActionButton.tsx": { cuenta: 1, motivo: `${NO_ES_TEXTO}: borde de la opción inactiva` },
};

/** Los cinco deshabilitados, con el texto que los ubica. */
const DESHABILITADOS: [string, RegExp][] = [
  ["app/studio/_components/ui/DateField.tsx", /disabled \? "var\(--ink-mute\)"/],
  ["app/studio/(app)/fiscal/_components/FiscalConfig.tsx", /color: disabled \? "var\(--ink-mute\)"/],
  ["app/studio/(app)/reportes/_components/ReportesClient.tsx", /: disabled\s*\?\s*"var\(--ink-mute\)"/],
  ["app/studio/(app)/usuarios/_components/acceso/permisos.css", /\.perm-opt:disabled \{[^}]*color: var\(--ink-mute\);/],
  ["app/studio/studio.css", /\.studio-cal-today-btn:disabled \{[^}]*color: var\(--ink-mute\);/],
];

/** Cuenta de `var(--ink-mute` por archivo de `app/studio`, fuera de pruebas, tokens y Noticias web. */
function cuentasMute(fuente: (ruta: string) => string): Record<string, number> {
  const cuentas: Record<string, number> = {};
  for (const ruta of fuentesDe(join(RAIZ, "app/studio"), /\.(tsx|ts|css)$/)) {
    const r = rel(ruta);
    if (/\.test\.tsx?$/.test(r) || r.endsWith("tokens.css") || r.includes("/marketing/noticias-web/")) continue;
    const n = fuente(ruta).split("var(--ink-mute").length - 1;
    if (n) cuentas[r] = n;
  }
  return cuentas;
}

const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));

describe("SDD-0686 · cierre del color del Studio", () => {
  it("cada --ink-mute que queda está en la lista cerrada, con su cuenta exacta", () => {
    expect(cuentasMute((ruta) => readFileSync(ruta, "utf8"))).toEqual(esperado);
  });

  it("los deshabilitados en --ink-mute son exactamente cinco", () => {
    expect(DESHABILITADOS).toHaveLength(5);
    for (const [ruta, re] of DESHABILITADOS) expect(leer(ruta)).toMatch(re);
    const conDeshabilitado = Object.values(PERMITIDO).filter((v) => v.motivo.startsWith(DESHABILITADO));
    expect(conDeshabilitado).toHaveLength(5);
  });

  it.each([
    ["el respaldo var(--ink-mute, …)", "app/studio/(app)/admin/notificaciones/_components/NotificationsClient.tsx", 'color: "var(--ink-soft)"', 'color: "var(--ink-mute, var(--ink-soft))"'],
    ["el return de una función de tono", "app/studio/(app)/crm/_components/KommoClient.tsx", 'if (days == null) return "var(--ink-soft)";', 'if (days == null) return "var(--ink-mute)";'],
    ["un fill= de SVG", "app/studio/(app)/dashboard/_components/DashboardWidgets.tsx", 'fill="var(--ink-soft)"', 'fill="var(--ink-mute)"'],
    ["una clase text-[var(--ink-mute)]", "app/studio/_components/ui/NumericInput.tsx", '"use client";', '"use client";\nconst _clase = "text-[var(--ink-mute)]";'],
  ])("mutante: %s se detecta", (_, objetivo, de, a) => {
    const original = leer(objetivo);
    expect(original).toContain(de);
    const mutado = original.replace(de, a);
    const cuentas = cuentasMute((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(cuentas).not.toEqual(esperado);
    expect(cuentas[objetivo]).toBe((esperado[objetivo] ?? 0) + 1);
  });

  it("el foco de los campos oscuros es azul de acción, no vino suave", () => {
    const regla = /\.studio-input-dark:focus-visible \{[^}]*\}/.exec(leer("app/studio/studio.css"))?.[0] ?? "";
    expect(regla).toContain("rgba(127, 170, 240, 0.22)");
    expect(regla).not.toMatch(/194,\s*116,\s*127/);
  });
});
