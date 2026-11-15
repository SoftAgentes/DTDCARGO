import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato del tramo 4d de SDD-0603 (Operación y marketing): los avisos de
 * estos 50 archivos van con `<Aviso>` (SDD-0628, BD-037), no con cajas a mano.
 *
 * Mira dos firmas de la caja hecha a mano:
 *   - un contorno de estado en línea (`1px solid var(--danger|warning|success|info)`),
 *     también con fallback, en plantilla o como `borderColor` (ver `CONTORNO`);
 *   - un `role="alert"` o `role="note"` en un elemento crudo (el de `<Aviso>`
 *     vive dentro del componente, no aquí).
 * Las excepciones que quedan están contadas por archivo y explicadas en
 * `docs/specs/0603-claridad-controles/tramo-4d.md`: errores de campo, un
 * error en línea junto a su botón y una sección de formulario.
 *
 * Piso: el tramo deja 78 `<Aviso` en estos archivos. Los mutantes del final
 * prueban que el contrato rompe si vuelve una caja o si se quita un Aviso.
 */

const BASE = "app/studio/(app)/";

const ARCHIVOS = [
  "bitacora/_components/BitacoraClient.tsx",
  "bitacora/_components/TaskCollabSection.tsx",
  "bitacora/_components/TaskDrawer.tsx",
  "bitacora/nueva/_components/ActaReview.tsx",
  "bitacora/nueva/_components/NuevaReunionClient.tsx",
  "clientes/[markbox]/estado-de-cuenta/page.tsx",
  "clientes/_components/ClientAccountHeader.tsx",
  "clientes/_components/ClientDrawer.tsx",
  "clientes/_components/TodosLosAdjuntos.tsx",
  "cola-qr/[id]/imprimir/page.tsx",
  "cola-qr/_components/BatchPrintDrawer.tsx",
  "despacho/_components/CancelOdDrawer.tsx",
  "despacho/_components/CreateOdDrawer.tsx",
  "despacho/dashboard/_components/DispatchDashboardClient.tsx",
  "despacho/reglas/_components/RulesClient.tsx",
  "etiquetas/_components/LabelGeneratorClient.tsx",
  "fidelizacion/_components/FidelizacionClient.tsx",
  "fidelizacion/_components/ReferralDrawer.tsx",
  "fidelizacion/_components/ReferralSettingsDrawer.tsx",
  "fidelizacion/_components/RegisterReferralDrawer.tsx",
  "inspecciones/_components/InspeccionDrawer.tsx",
  "inspecciones/_components/PhotoManager.tsx",
  "inspecciones/_components/ReportEditor.tsx",
  "mailing/_components/BlacklistView.tsx",
  "mailing/_components/ComposeView.tsx",
  "mailing/_components/ConfigView.tsx",
  "mailing/_components/MailingClient.tsx",
  "mailing/_components/RuleEditorDrawer.tsx",
  "mailing/_components/RulesView.tsx",
  "mailing/_components/ScheduledView.tsx",
  "mailing/_components/SignaturesView.tsx",
  "mailing/_components/TemplateEditorDrawer.tsx",
  "mailing/_components/TemplatesView.tsx",
  "marketing/newsletter/_components/CampaignActions.tsx",
  "marketing/newsletter/_components/CampaignComposer.tsx",
  "marketing/noticias-web/_components/MarkdownLite.tsx",
  "marketing/noticias-web/_components/RouteIdeaPanel.tsx",
  "marketing/noticias-web/_components/Step3Article.tsx",
  "marketing/noticias-web/publicadas/_components/EditarNoticiaForm.tsx",
  "marketing/noticias-web/publicadas/_components/PublicadasClient.tsx",
  "marketing/noticias-web/publicadas/_components/RetiroForm.tsx",
  "operarios/_components/EditOperarioDrawer.tsx",
  "operarios/_components/NewOperarioDrawer.tsx",
  "operarios/_components/PinViewDialog.tsx",
  "reclamos/_components/ClaimDrawer.tsx",
  "reclamos/_components/ReclamosClient.tsx",
  "servicios/_components/ServicioDrawer.tsx",
  "tms/_components/GpsLiveTab.tsx",
  "tms/_components/RouteDrawer.tsx",
  "tms/_components/TruckDrawer.tsx",
] as const;

/**
 * Contornos de estado que quedan, con cuenta exacta y motivo. Ninguno es un
 * aviso. Hasta los menores del Studio (SDD-0603) el contrato solo veía el
 * primero: su regex no leía plantillas, fallbacks, `dashed` ni `borderColor`.
 */
const CONTORNO_PERMITIDO: Partial<Record<string, { n: number; motivo: string }>> = {
  "despacho/reglas/_components/RulesClient.tsx": { n: 1, motivo: "sección «Hold temporal»: parte del formulario" },
  "bitacora/_components/BitacoraClient.tsx": { n: 1, motivo: "chip de filtro «esperando» activo: control, no aviso" },
  "bitacora/_components/TaskDrawer.tsx": { n: 1, motivo: "casilla de un ítem hecho en la lista de tareas" },
  "bitacora/nueva/_components/ActaReview.tsx": { n: 1, motivo: "campo «responsable» sin asignar: estado del campo" },
  "mailing/_components/ConfigView.tsx": { n: 1, motivo: "campo con error" },
  "mailing/_components/RuleEditorDrawer.tsx": { n: 2, motivo: "campos con error" },
  "mailing/_components/TemplateEditorDrawer.tsx": { n: 2, motivo: "campos con error" },
  "marketing/noticias-web/_components/MarkdownLite.tsx": { n: 1, motivo: "marca [VERIFICAR] dentro del texto del artículo" },
  "marketing/noticias-web/_components/Step3Article.tsx": { n: 1, motivo: "botón «Copiar» tras copiar: estado del control" },
  "tms/_components/GpsLiveTab.tsx": { n: 1, motivo: "tarjetas de alerta de flota: pendiente decidir su anuncio (tramo-4d.md)" },
};

/** `role` crudo permitido: errores de campo y el error en línea junto a «Guardar resolución». */
const ROL_PERMITIDO: Partial<Record<string, number>> = {
  "bitacora/_components/TaskDrawer.tsx": 1,
  "operarios/_components/EditOperarioDrawer.tsx": 1,
  "operarios/_components/NewOperarioDrawer.tsx": 1,
  "reclamos/_components/ReclamosClient.tsx": 1,
};

const PISO_AVISOS = 78;

/**
 * Contorno de estado en línea, en cualquiera de sus escrituras:
 *   1. literal, con o sin fallback y con sufijo: `solid var(--danger)`,
 *      `dashed var(--warning, #B8893A)`, `solid var(--danger-text)`;
 *   2. plantilla con el token dentro de la expresión:
 *      `1px solid ${error ? "var(--danger)" : "var(--border)"}`;
 *   3. plantilla que arma el nombre del token: `3px solid var(--${tono})`;
 *   4. propiedad de color: `borderColor`, `borderLeftColor`, `outlineColor`.
 * Vale también el alias `--color-status-*`.
 * Límite: no sigue una variable (`const c = "var(--danger)"` y luego
 * `solid ${c}`); eso lo cubre la revisión del diff.
 */
const ESTADO = "(?:color-status-)?(?:danger|warning|success|info)";
const TRAZO = "(?:solid|dashed|dotted|double)";
const CONTORNO = new RegExp(
  [
    `${TRAZO}\\s+var\\(--${ESTADO}[\\w-]*\\s*[,)]`,
    `${TRAZO}\\s+\\$\\{[^}\\n]*--${ESTADO}`,
    `${TRAZO}\\s+var\\(--\\$\\{`,
    `(?:border\\w*Color|outlineColor)\\s*:[^,\\n]*--${ESTADO}`,
  ].join("|"),
  "g",
);
const ROL_CRUDO = /role="(?:alert|note)"/g;
const AVISO = /<Aviso\b/g;
const IMPORT_AVISO = /from "@\/app\/studio\/_components\/ui\/Aviso"/;

function cuenta(texto: string, re: RegExp): number {
  return texto.match(re)?.length ?? 0;
}

/** Lo que el archivo viola; vacío si cumple. */
function violaciones(ruta: string, texto: string): string[] {
  const fallas: string[] = [];
  const contornos = cuenta(texto, CONTORNO);
  const permitidos = CONTORNO_PERMITIDO[ruta]?.n ?? 0;
  // Cuenta exacta: ni un contorno de más, ni una excepción que ya no existe.
  if (contornos !== permitidos) {
    fallas.push(`${ruta}: ${contornos} contorno(s) de estado en línea, se esperaban ${permitidos}`);
  }
  const roles = cuenta(texto, ROL_CRUDO);
  if (roles > (ROL_PERMITIDO[ruta] ?? 0)) {
    fallas.push(`${ruta}: ${roles} role alert/note en elemento crudo`);
  }
  if (cuenta(texto, AVISO) > 0 && !IMPORT_AVISO.test(texto)) {
    fallas.push(`${ruta}: usa <Aviso> sin importarlo del componente canónico`);
  }
  return fallas;
}

const fuentes = new Map<string, string>(
  ARCHIVOS.map((ruta) => [ruta, readFileSync(join(process.cwd(), BASE, ruta), "utf8")]),
);

function totalAvisos(mapa: Map<string, string>): number {
  let total = 0;
  for (const texto of mapa.values()) total += cuenta(texto, AVISO);
  return total;
}

describe("SDD-0603 · tramo 4d · avisos con <Aviso>", () => {
  it("mira los 50 archivos de la allowlist", () => {
    expect(fuentes.size).toBe(50);
  });

  it.each(ARCHIVOS)("%s no tiene cajas de aviso a mano", (ruta) => {
    expect(violaciones(ruta, fuentes.get(ruta)!)).toEqual([]);
  });

  it(`deja al menos ${PISO_AVISOS} <Aviso> en el grupo`, () => {
    expect(totalAvisos(fuentes)).toBeGreaterThanOrEqual(PISO_AVISOS);
  });

  describe("mutantes", () => {
    const ruta = "tms/_components/TruckDrawer.tsx";
    const original = fuentes.get(ruta)!;

    it("vuelve la caja con contorno de error → rompe", () => {
      const mutado = original.replace(
        '<Aviso tono="error" compacto>',
        '<p style={{ border: "1px solid var(--danger)" }}>',
      );
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado).length).toBeGreaterThan(0);
    });

    it("vuelve un role=\"alert\" crudo → rompe", () => {
      const mutado = original.replace('<Aviso tono="error" compacto>', '<p role="alert">');
      expect(violaciones(ruta, mutado).length).toBeGreaterThan(0);
    });

    it("se quita el import del componente canónico → rompe", () => {
      const mutado = original.replace(IMPORT_AVISO, 'from "./Aviso"');
      expect(violaciones(ruta, mutado).length).toBeGreaterThan(0);
    });

    it("se quita un <Aviso> del grupo → el piso rompe", () => {
      const mapa = new Map(fuentes);
      mapa.set(ruta, original.replace(/<Aviso\b/, "<p"));
      expect(totalAvisos(mapa)).toBeLessThan(PISO_AVISOS);
    });

    // Menores del Studio (SDD-0603): escrituras que el regex anterior no veía.
    it.each([
      ["fallback", 'border: "1px solid var(--danger, #A8323E)"'],
      ["sufijo -text", 'border: "1px solid var(--danger-text)"'],
      ["dashed", 'border: "1px dashed var(--warning)"'],
      ["ternario en plantilla", 'border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`'],
      ["token armado en plantilla", "borderLeft: `3px solid var(--${tono})`"],
      ["borderColor", 'borderColor: "var(--success)"'],
      ["borderLeftColor con alias", 'borderLeftColor: "var(--color-status-warning)"'],
      ["outlineColor", 'outlineColor: "var(--info)"'],
    ])("vuelve un contorno escrito como %s → rompe", (_nombre, estilo) => {
      const mutado = original.replace('<Aviso tono="error" compacto>', `<p style={{ ${estilo} }}>`);
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado)).toEqual([expect.stringContaining("contorno(s) de estado")]);
    });

    it.each([
      ["contorno neutro", 'border: "1px solid var(--border)"'],
      ["contorno de control", 'border: "1.5px solid var(--ctl-border)"'],
      ["ternario neutro", 'border: `1px solid ${activo ? "var(--ctl-border)" : "var(--border)"}`'],
      ["fondo de estado sin contorno", 'background: "var(--danger-bg)"'],
    ])("un %s no cuenta como contorno de estado", (_nombre, estilo) => {
      expect(cuenta(`<p style={{ ${estilo} }}>`, CONTORNO)).toBe(0);
    });

    it("una excepción que pierde su contorno también rompe (la cuenta es exacta)", () => {
      const ex = "mailing/_components/ConfigView.tsx";
      const texto = fuentes.get(ex)!;
      const mutado = texto.replace('${error ? "var(--danger)" : "var(--border)"}', "var(--border)");
      expect(mutado).not.toBe(texto);
      expect(violaciones(ex, mutado)).toEqual([expect.stringContaining("se esperaban 1")]);
    });

    it("toda excepción de contorno es de un archivo del grupo y trae motivo", () => {
      for (const [archivo, ex] of Object.entries(CONTORNO_PERMITIDO)) {
        expect(ARCHIVOS).toContain(archivo);
        expect(ex!.motivo.length).toBeGreaterThan(10);
      }
    });
  });
});
