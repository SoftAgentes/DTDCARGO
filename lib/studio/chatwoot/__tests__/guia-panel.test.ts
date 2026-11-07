// @vitest-environment jsdom
/**
 * SDD-0589 · paso 9.4 · el script de la guía en el panel de Chatwoot
 * (`infra/chatwoot/panel/guia-panel.html`, va en `DASHBOARD_SCRIPTS`).
 *
 * Se corre el texto REAL del archivo sobre un DOM sintético con la forma del
 * panel de Chatwoot 4.19.1 (leída de su código fuente), con una ventana falsa
 * que hace de marco. Lo que se prueba es lo que se pegará en el Super Admin.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatear, resolverAnclas, resumir } from "../../../../infra/chatwoot/pruebas/smoke-guia-nucleo.mjs";
import { pedidoMirar, SELECTORES_CHATWOOT } from "@/lib/studio/guia/puente-chatwoot";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const HTML = readFileSync(resolve(ROOT, "infra/chatwoot/panel/guia-panel.html"), "utf8");
const SCRIPT = HTML.slice(HTML.indexOf("<script>") + "<script>".length, HTML.indexOf("</script>"));

const STUDIO = "https://dtdcargo.com";

type Caja = { top: number; left: number; width: number; height: number };

/** Le da rectángulo a un elemento (jsdom no maqueta). */
function conCaja(el: Element, caja: Caja) {
  el.getBoundingClientRect = () =>
    ({ ...caja, x: caja.left, y: caja.top, right: caja.left + caja.width, bottom: caja.top + caja.height, toJSON() {} }) as DOMRect;
  el.getClientRects = () => ({ length: 1, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
}

/** Panel sintético con la forma de Chatwoot 4.19.1 (ReplyBox, ChatListHeader, Sidebar…). */
function panelSintetico() {
  document.body.innerHTML = `
    <aside><a href="/app/accounts/1/search"><span class="i-lucide-search"></span></a></aside>
    <section><button id="toggleConversationFilterButton"><span class="i-lucide-list-filter"></span></button></section>
    <div class="conversation-details-wrap">
      <div class="h-10"><ul class="list-none"><li><a>Conversación</a></li><li><a id="pestana-ficha">Ficha DTD</a></li></ul></div>
      <div class="reply-box">
        <div class="flex justify-between"><button id="modo">Responder Nota privada</button><button>otro</button></div>
        <div class="reply-box__top"></div>
        <div class="flex justify-between p-3"><div class="left-wrap">
          <button><span class="i-ph-smiley-sticker"></span></button>
          <button id="plantillas"><span class="i-ph-whatsapp-logo"></span></button>
        </div></div>
      </div>
    </div>
    <div class="bg-n-surface-2 md:w-[320px] md:min-w-[320px]">
      <div><div><div class="relative w-full mb-2"><button id="asignar">Agente</button></div></div></div>
    </div>`;
  const cajas: Record<string, Caja> = {
    'a[href="/app/accounts/1/search"]': { top: 10, left: 10, width: 200, height: 28 },
    "#toggleConversationFilterButton": { top: 60, left: 300, width: 24, height: 24 },
    ".reply-box": { top: 600, left: 400, width: 700, height: 160 },
    "#modo": { top: 610, left: 410, width: 180, height: 32 },
    "#plantillas": { top: 720, left: 500, width: 28, height: 28 },
    "#asignar": { top: 200, left: 1120, width: 280, height: 36 },
    "#pestana-ficha": { top: 50, left: 520, width: 90, height: 36 },
  };
  for (const [css, caja] of Object.entries(cajas)) conCaja(document.querySelector(css)!, caja);
}

function montar(opciones: { enmarcada?: boolean } = {}) {
  const oyentes = new Map<string, Set<(e: unknown) => void>>();
  const padre = { postMessage: vi.fn() };
  const ventana: Record<string, unknown> = {
    addEventListener: (tipo: string, fn: (e: unknown) => void) => {
      if (!oyentes.has(tipo)) oyentes.set(tipo, new Set());
      oyentes.get(tipo)!.add(fn);
    },
    removeEventListener: (tipo: string, fn: (e: unknown) => void) => oyentes.get(tipo)?.delete(fn),
    requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    MutationObserver: window.MutationObserver,
  };
  ventana.parent = opciones.enmarcada === false ? ventana : padre;
  new Function("window", "document", SCRIPT)(ventana, document);
  const enviar = (origin: string, data: unknown, source: unknown = ventana.parent) => {
    for (const fn of oyentes.get("message") ?? []) fn({ origin, source, data });
  };
  const disparar = (tipo: string) => {
    for (const fn of oyentes.get(tipo) ?? []) fn({});
  };
  const esperar = () => new Promise((r) => setTimeout(r, 5));
  /** Mensajes de cajas que recibió Studio, ya parseados. */
  const cajasRecibidas = () =>
    padre.postMessage.mock.calls
      .map(([m, o]) => ({ datos: JSON.parse(m as string), origen: o }))
      .filter((x) => x.datos.evento === "dtd:guia:cajas");
  return { padre, oyentes, enviar, disparar, esperar, cajasRecibidas };
}

const MIRAR = JSON.stringify(pedidoMirar(SELECTORES_CHATWOOT));

beforeEach(() => panelSintetico());
afterEach(() => {
  document.body.innerHTML = "";
});

describe("DASHBOARD_SCRIPTS · guía de Studio dentro del panel (9.4)", () => {
  it("al cargar avisa «listo» a cada origen de Studio y no observa nada", () => {
    const p = montar();
    expect(p.padre.postMessage.mock.calls).toEqual([
      [JSON.stringify({ evento: "dtd:guia:listo" }), "https://dtdcargo.com"],
      [JSON.stringify({ evento: "dtd:guia:listo" }), "https://www.dtdcargo.com"],
    ]);
    expect(p.oyentes.get("scroll")?.size ?? 0).toBe(0);
    expect(p.oyentes.get("resize")?.size ?? 0).toBe(0);
  });

  it("sin marco (el panel abierto directo) no hace nada", () => {
    const p = montar({ enmarcada: false });
    expect(p.padre.postMessage).not.toHaveBeenCalled();
    expect(p.oyentes.get("message")?.size ?? 0).toBe(0);
  });

  it("con «mirar» mide las siete anclas de 4.19.1 y contesta solo a ese origen", async () => {
    const p = montar();
    p.enviar("https://www.dtdcargo.com", MIRAR);
    const [r] = p.cajasRecibidas();
    expect(r.origen).toBe("https://www.dtdcargo.com");
    expect(r.datos.cajas).toEqual({
      "bandeja.composer": { top: 600, left: 400, width: 700, height: 160 },
      "bandeja.nota-privada": { top: 610, left: 410, width: 180, height: 32 },
      // `cerca: button`: del icono sube al botón.
      "bandeja.plantillas": { top: 720, left: 500, width: 28, height: 28 },
      "bandeja.buscar": { top: 10, left: 10, width: 200, height: 28 },
      "bandeja.filtro-canal": { top: 60, left: 300, width: 24, height: 24 },
      "bandeja.asignar": { top: 200, left: 1120, width: 280, height: 36 },
      "ficha.panel": { top: 50, left: 520, width: 90, height: 36 },
    });
  });

  it("el núcleo del smoke de E3 encuentra lo mismo que el script", () => {
    const p = montar();
    p.enviar(STUDIO, MIRAR);
    const delScript = Object.entries(p.cajasRecibidas()[0].datos.cajas)
      .filter(([, c]) => c !== null)
      .map(([a]) => a)
      .sort();
    const delSmoke = resolverAnclas(SELECTORES_CHATWOOT, document)
      .filter((r: { encontrada: boolean }) => r.encontrada)
      .map((r: { ancla: string }) => r.ancla)
      .sort();
    expect(delSmoke).toEqual(delScript);
    expect(delSmoke).toHaveLength(Object.keys(SELECTORES_CHATWOOT.anclas).length);
  });

  it("smoke de E3: falla si falta una obligatoria; las condicionales solo avisan", () => {
    document.querySelector("#plantillas")!.remove();
    const sinPlantillas = resolverAnclas(SELECTORES_CHATWOOT, document);
    expect(resumir(sinPlantillas)).toEqual({ ok: true, faltanObligatorias: [], faltanCondicionales: ["bandeja.plantillas"] });
    expect(formatear(sinPlantillas, "v4.19.1-ce")).toMatch(/FALTA \(condicional\)\s+bandeja\.plantillas/);
    document.querySelector(".reply-box")!.remove();
    const sinComposer = resumir(resolverAnclas(SELECTORES_CHATWOOT, document));
    expect(sinComposer.ok).toBe(false);
    expect(sinComposer.faltanObligatorias).toEqual(["bandeja.composer", "bandeja.nota-privada"]);
  });

  it("un ancla que no está, o sin rectángulo (display: none), va como null", () => {
    document.querySelector("#plantillas")!.remove();
    const modo = document.querySelector("#modo")!;
    modo.getClientRects = () => ({ length: 0 }) as unknown as DOMRectList;
    const p = montar();
    p.enviar(STUDIO, MIRAR);
    const { cajas } = p.cajasRecibidas()[0].datos;
    expect(cajas["bandeja.plantillas"]).toBeNull();
    expect(cajas["bandeja.nota-privada"]).toBeNull();
    expect(cajas["bandeja.composer"]).not.toBeNull();
  });

  it("vuelve a contestar solo cuando algo cambió", async () => {
    const p = montar();
    p.enviar(STUDIO, MIRAR);
    expect(p.cajasRecibidas()).toHaveLength(1);
    // Scroll sin cambios: no manda nada.
    p.disparar("scroll");
    await p.esperar();
    expect(p.cajasRecibidas()).toHaveLength(1);
    // El composer se movió y el DOM cambió: manda la caja nueva.
    conCaja(document.querySelector(".reply-box")!, { top: 500, left: 400, width: 700, height: 160 });
    document.body.appendChild(document.createElement("div"));
    await p.esperar();
    const recibidas = p.cajasRecibidas();
    expect(recibidas).toHaveLength(2);
    expect(recibidas[1].datos.cajas["bandeja.composer"].top).toBe(500);
  });

  it("«mostrar» lleva el ancla a la vista; sin movimiento, sin animación", () => {
    const composer = document.querySelector(".reply-box") as HTMLElement;
    composer.scrollIntoView = vi.fn();
    const p = montar();
    p.enviar(STUDIO, MIRAR);
    p.enviar(STUDIO, JSON.stringify({ evento: "dtd:guia:mostrar", ancla: "bandeja.composer", suave: true }));
    expect(composer.scrollIntoView).toHaveBeenLastCalledWith({ block: "center", inline: "nearest", behavior: "smooth" });
    p.enviar(STUDIO, JSON.stringify({ evento: "dtd:guia:mostrar", ancla: "bandeja.composer", suave: false }));
    expect(composer.scrollIntoView).toHaveBeenLastCalledWith({ block: "center", inline: "nearest", behavior: "auto" });
    // Un ancla que no se pidió no se mueve.
    p.enviar(STUDIO, JSON.stringify({ evento: "dtd:guia:mostrar", ancla: "otra.cosa", suave: false }));
    expect(composer.scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("«parar» deja de observar y de contestar", async () => {
    const p = montar();
    p.enviar(STUDIO, MIRAR);
    p.enviar(STUDIO, JSON.stringify({ evento: "dtd:guia:parar" }));
    expect(p.oyentes.get("scroll")?.size ?? 0).toBe(0);
    expect(p.oyentes.get("resize")?.size ?? 0).toBe(0);
    conCaja(document.querySelector(".reply-box")!, { top: 1, left: 1, width: 1, height: 1 });
    document.body.appendChild(document.createElement("div"));
    p.disparar("scroll");
    await p.esperar();
    expect(p.cajasRecibidas()).toHaveLength(1);
  });

  it.each([
    ["otro origen", "https://malo.example.test", MIRAR, undefined],
    ["un subdominio parecido", "https://dtdcargo.com.malo.test", MIRAR, undefined],
    ["el propio chat", "https://chat.dtdcargo.com", MIRAR, undefined],
    ["otra ventana de Studio", STUDIO, MIRAR, { otra: true }],
    ["otro evento", STUDIO, JSON.stringify({ evento: "otra-cosa" }), undefined],
    ["JSON roto", STUDIO, "{no", undefined],
    ["nada", STUDIO, null, undefined],
  ])("ignora %s", (_n, origen, datos, fuente) => {
    const p = montar();
    p.padre.postMessage.mockClear();
    if (fuente) p.enviar(origen as string, datos, fuente);
    else p.enviar(origen as string, datos);
    expect(p.padre.postMessage).not.toHaveBeenCalled();
  });

  it("topes: selector inválido, demasiado largo, ancla mal escrita y más de 20 anclas no rompen", () => {
    const anclas: Record<string, { css: string[]; cerca?: string }> = {
      "bandeja.composer": { css: ["((no es css", ".reply-box"] },
      "bandeja.buscar": { css: ["a".repeat(201), 'a[href$="/search"]'] },
      "MAL.ancla": { css: [".reply-box"] },
      "x.sin-css": { css: [] },
      "bandeja.plantillas": { css: [".i-ph-whatsapp-logo"], cerca: "button)" },
    };
    for (let i = 0; i < 30; i += 1) anclas[`extra.a${i}`] = { css: [".no-existe"] };
    const p = montar();
    expect(() => p.enviar(STUDIO, JSON.stringify({ evento: "dtd:guia:mirar", anclas }))).not.toThrow();
    const { cajas } = p.cajasRecibidas()[0].datos;
    expect(cajas["bandeja.composer"]).toEqual({ top: 600, left: 400, width: 700, height: 160 });
    expect(cajas["bandeja.buscar"]).toEqual({ top: 10, left: 10, width: 200, height: 28 });
    expect(cajas).not.toHaveProperty("MAL.ancla");
    expect(cajas).not.toHaveProperty("x.sin-css");
    // `cerca` inválido se descarta: queda el icono, que aquí no tiene rectángulo propio.
    expect(cajas["bandeja.plantillas"]).toBeNull();
    expect(Object.keys(cajas).length).toBeLessThanOrEqual(20);
  });

  it("el script no lee texto, cookies ni almacenamiento, ni escribe en el panel", () => {
    expect(SCRIPT).not.toMatch(
      /textContent|innerText|innerHTML|outerHTML|\.value\b|cookie|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|eval\(|console\.|appendChild|insertAdjacent|\.style\b/,
    );
  });
});
