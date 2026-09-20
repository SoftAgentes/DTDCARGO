/**
 * La calculadora de costo real de la guía de Alibaba, ejecutada de verdad
 * (SDD-0474).
 *
 * POR QUÉ ASÍ: la fórmula vive como JS inline dentro de
 * `public/guias/comprar-en-alibaba.html`, que no pasa por build ni por tsc. Un
 * test que solo mirase el texto del archivo no probaría que **calcula bien** —y
 * el número que sale de acá es con el que un cliente decide si un negocio le da
 * o no. Así que se carga el HTML en jsdom, se ejecuta su script con `fetch`
 * simulado y se leen los resultados del DOM.
 *
 * Cubre los dos caminos que importan:
 *   · con tarifa del ERP  → el flete sale del CBM y el campo manual desaparece;
 *   · sin tarifa (Supabase caído / sin credenciales) → reaparece el campo
 *     manual y NO se inventa ningún número.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML = readFileSync("public/guias/comprar-en-alibaba.html", "utf8");

type Tarifa = { per_cbm: number | null; min_charge: number | null; valid_until: string | null };

/**
 * Monta la guía en jsdom con la tarifa que se le diga y avanza hasta el Paso 4.
 *
 * `runScripts: "outside-only"` deja el script del documento SIN ejecutar: así se
 * prepara el entorno (`matchMedia`, que jsdom no trae, y el `fetch` simulado) y
 * después se corre el script UNA vez con `window.eval`. Reinyectarlo en un DOM
 * ya arrancado duplicaría cada `const` del archivo.
 */
async function montar(tarifa: Tarifa | "error", hastaPaso = 4) {
  const dom = new JSDOM(HTML, {
    url: "https://dtdcargo.com/guias/comprar-en-alibaba.html?mark=DTD-1042",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const win = dom.window as unknown as Window & typeof globalThis;
  const doc = win.document;

  // jsdom no implementa matchMedia y la guía lo lee al arrancar. Se responde
  // `matches: true` a propósito: es un visitante con «reducir movimiento»
  // activado —un modo real— y así la guía salta el confeti y los scrolls
  // suaves, que en jsdom no existen (`Element.animate` no está implementado).
  Object.defineProperty(win, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: /prefers-reduced-motion/.test(query),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
  // Red por si algún día se anima algo fuera del guard de `reduce`.
  (win.Element.prototype as unknown as { animate: unknown }).animate = () => ({
    finished: Promise.resolve(),
    cancel() {},
  });

  // La guía sólo pide /api/public/cbm-rate.
  (win as unknown as { fetch: unknown }).fetch = vi.fn(async () => {
    if (tarifa === "error") throw new Error("red caída");
    return { ok: true, json: async () => tarifa };
  });

  const codigo = [...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join("\n");
  win.eval(codigo);

  // Deja resolver el fetch de la tarifa y los timeouts del render.
  await new Promise((r) => setTimeout(r, 60));

  const $ = (sel: string) => doc.querySelector(sel) as HTMLElement | null;

  // Avanza hasta el Paso 4 (Negociar), donde vive la calculadora.
  //
  // `completarEtapa` espera 650 ms antes de saltar (la animación del sello), y
  // ese retardo NO depende de prefers-reduced-motion. Avanzar con esperas fijas
  // solapaba los clicks con los timeouts pendientes y la guía rebotaba entre
  // etapas, así que se espera a que el DOM confirme el cambio.
  const marca = () => new RegExp("Paso " + hastaPaso + "\\b").test($(".eyebrow")?.textContent ?? "");
  (doc.querySelector('.perfil-card[data-perfil="pro"]') as HTMLElement | null)?.click();
  for (let intento = 0; intento < 20 && !marca(); intento++) {
    const antes = $(".eyebrow")?.textContent;
    doc.querySelectorAll<HTMLElement>(".check:not(.on)").forEach((c) => c.click());
    ($("#btnNext") as HTMLElement | null)?.click();
    for (let espera = 0; espera < 30; espera++) {
      await new Promise((r) => setTimeout(r, 40));
      if ($(".eyebrow")?.textContent !== antes) break;
    }
  }
  if (!marca()) {
    throw new Error(
      `no se llegó al Paso ${hastaPaso}; quedó en: ` + ($(".eyebrow")?.textContent ?? "(?)"),
    );
  }

  return { doc, $, win, dom };
}

/** Rellena la calculadora y devuelve lo que pinta. */
function calcular(
  doc: Document,
  vals: { fob: string; unidades: string; cbm?: string; flete?: string },
) {
  const set = (id: string, v?: string) => {
    if (v === undefined) return;
    const el = doc.querySelector(id) as HTMLInputElement | null;
    if (el) el.value = v;
  };
  set("#lcP", vals.fob);
  set("#lcQ", vals.unidades);
  set("#lcCbm", vals.cbm);
  set("#lcF", vals.flete);
  (doc.querySelector('[data-calc="landed"]') as HTMLElement | null)?.click();
  const out = doc.querySelector("#lcOut") as HTMLElement | null;
  return {
    visible: !!out?.classList.contains("show"),
    texto: (out?.textContent ?? "").replace(/\s+/g, " "),
    unidad: (out?.querySelector(".big-res .n") as HTMLElement | null)?.textContent ?? "",
  };
}

describe("guía de Alibaba · calculadora de costo real (SDD-0474)", () => {
  describe("con la tarifa del ERP", () => {
    let ctx: Awaited<ReturnType<typeof montar>>;

    beforeAll(async () => {
      ctx = await montar({ per_cbm: 850, min_charge: 50, valid_until: "2026-10-04" });
    });
    afterAll(() => ctx?.dom.window.close());

    it("anuncia la tarifa vigente, sin cablearla", () => {
      expect(ctx.$("#lcTarifa")?.textContent).toContain("850");
      expect(ctx.$("#lcTarifa")?.textContent).toContain("por m³");
    });

    it("no pide el flete a mano: lo saca del CBM", () => {
      expect(ctx.doc.querySelector("#lcF")).toBeNull();
      expect(ctx.doc.querySelector("#lcCbm")).not.toBeNull();
    });

    it("⭐ FOB $3 × 500 unidades × 2 m³ → $6,40 la unidad puesta en Venezuela", () => {
      // mercancía 1.500 + flete (2 × 850 = 1.700) = 3.200 / 500 = 6,40
      const r = calcular(ctx.doc, { fob: "3", unidades: "500", cbm: "2" });
      expect(r.visible).toBe(true);
      expect(r.unidad).toBe("$6,40");
      expect(r.texto).toContain("1.700,00"); // el flete estimado
      expect(r.texto).toContain("3.200,00"); // el total
      expect(r.texto).toContain("2 m³ × $850,00/m³"); // de dónde sale
    });

    it("aplica el mínimo cobrable cuando el volumen es diminuto", () => {
      // 0,03 m³ × 850 = 25,50 → por debajo del piso de 50.
      const r = calcular(ctx.doc, { fob: "10", unidades: "10", cbm: "0.03" });
      expect(r.texto).toContain("50,00");
      expect(r.unidad).toBe("$15,00"); // (100 + 50) / 10
    });

    it("NO suma arancel, IVA ni last mile — en el puerta a puerta ya van dentro", () => {
      const r = calcular(ctx.doc, { fob: "3", unidades: "500", cbm: "2" });
      expect(r.texto).not.toMatch(/arancel/i);
      expect(r.texto).not.toMatch(/IVA/);
      expect(r.texto).not.toMatch(/last mile/i);
    });

    it("le dice qué mueve el número en vez de dar un precio como firme", () => {
      const r = calcular(ctx.doc, { fob: "3", unidades: "500", cbm: "2" });
      expect(r.texto).toMatch(/aproximado/i);
      // 500 kg/m³ es la regla de la casa. El motor cobra hoy con 1.000
      // (pesoIncluidoKg), pero eso es una excepción temporal: la guía promete
      // la regla, no la excepción, para no quedar debiendo si se retira.
      expect(r.texto).toContain("500 kg");
      expect(r.texto).not.toContain("1.000 kg");
    });

    it("sin CBM avisa que falta, en lugar de cobrar cero de flete", () => {
      const r = calcular(ctx.doc, { fob: "3", unidades: "500", cbm: "" });
      expect(r.texto).toContain("falta tu CBM");
    });
  });

  describe("sin tarifa (Supabase caído o worktree sin credenciales)", () => {
    let ctx: Awaited<ReturnType<typeof montar>>;

    beforeAll(async () => {
      ctx = await montar({ per_cbm: null, min_charge: null, valid_until: null });
    });
    afterAll(() => ctx?.dom.window.close());

    it("reaparece el campo de flete manual", () => {
      expect(ctx.doc.querySelector("#lcF")).not.toBeNull();
    });

    it("lo dice claro y calcula igual con lo que el cliente ponga", () => {
      expect(ctx.$("#lcTarifa")?.textContent).toMatch(/no pudimos traer la tarifa/i);
      const r = calcular(ctx.doc, { fob: "3", unidades: "500", cbm: "2", flete: "1700" });
      expect(r.unidad).toBe("$6,40");
      expect(r.texto).toContain("el que pusiste");
    });

    it("⭐ no se inventa ninguna tarifa", () => {
      const r = calcular(ctx.doc, { fob: "3", unidades: "500", cbm: "2", flete: "" });
      // Sin flete declarado el total es sólo la mercancía: cero flete inventado.
      expect(r.unidad).toBe("$3,00");
    });
  });

  describe("Paso 7 · la dirección que se le pasa al proveedor", () => {
    let ctx: Awaited<ReturnType<typeof montar>>;

    beforeAll(async () => {
      ctx = await montar({ per_cbm: 850, min_charge: 50, valid_until: null }, 7);
    });
    afterAll(() => ctx?.dom.window.close());

    it("es una sola pieza con un solo botón, no diez campos", () => {
      expect(ctx.doc.querySelector(".dir-full")).not.toBeNull();
      expect(ctx.doc.querySelectorAll(".dir-full .dir-row")).toHaveLength(0);
      expect(ctx.doc.querySelectorAll(".dir-full .dir-copy")).toHaveLength(1);
    });

    it("⭐ «Copiar todo» CON mark lleva las tres líneas, no sólo el destinatario", async () => {
      // El handler reconstruía "林冠 "+mark para todo botón con
      // data-field="destinatario". En el Paso 1 eso es correcto —copia sólo ese
      // campo del formulario— pero acá dejaba al proveedor sin dirección ni
      // teléfono. No se vio a mano porque se probó el caso SIN mark, donde el
      // guardarraíl corta antes de copiar.
      const copiado: string[] = [];
      Object.defineProperty(ctx.win.navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (t: string) => {
            copiado.push(t);
            return Promise.resolve();
          },
        },
      });

      (ctx.doc.querySelector(".dir-copy-all") as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 20));

      expect(copiado).toHaveLength(1);
      const texto = copiado[0];
      expect(texto).toContain("林冠 DTD-1042"); // el mark vivo, no el placeholder
      expect(texto).not.toContain("DTD-XXXX");
      expect(texto).toContain("浙江省金华市义乌市义乌港二期直通仓2栋2号"); // con Jinhua
      expect(texto).toContain("322000");
      expect(texto).toContain("+86 18606891419");
      expect(texto.split("\n")).toHaveLength(3);
    });
  });

  describe("si el fetch de la tarifa TIRA", () => {
    it("la guía sigue viva y usable", async () => {
      const ctx = await montar("error");
      expect(ctx.doc.querySelector("#lcF")).not.toBeNull();
      const r = calcular(ctx.doc, { fob: "2", unidades: "100", cbm: "1", flete: "800" });
      expect(r.unidad).toBe("$10,00"); // (200 + 800) / 100
      ctx.dom.window.close();
    });
  });
});
