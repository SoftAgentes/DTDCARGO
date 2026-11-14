import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato del tramo 5d de SDD-0603 (CRM y Conversaciones), el último del
 * rebrand. BD-037:
 *   - las pestañas usan la clase única (`.studio-tabs` / `.studio-tab`), sin
 *     estilo en línea: la activa va con relleno de tinta;
 *   - lo que abre un registro es un botón real «Abrir <nombre>» y la tarjeta o
 *     la fila sale del orden de Tab;
 *   - lo que avisa es `<Aviso>` (SDD-0628), no una caja hecha a mano;
 *   - el vino queda para la acción principal y la identidad.
 *
 * Cuenta exacta por archivo, sin comentarios: un comentario que diga `<Aviso`
 * o `role="alert"` no cuenta, y quitar un aviso de verdad rompe aunque el
 * comentario siga ahí. Las excepciones están explicadas en
 * `docs/specs/0603-claridad-controles/tramo-5d.md`.
 */

const BASE = "app/studio/(app)/";

type Cuenta = {
  /** `<Aviso` en el código. */
  aviso: number;
  /** `role="alert|status|note"` en un elemento crudo (el de `<Aviso>` vive en el componente). */
  rol: number;
  /** `aria-live=` crudo. */
  vivo: number;
  /** Contorno de estado en línea (`solid|dashed var(--danger|warning|success|info)`). */
  contorno: number;
  /** Botones «Abrir <nombre>»: `aria-label={`Abrir …`}`. */
  abrir: number;
  /** `tabIndex={-1}`: el nombre o la fila fuera del orden de Tab. */
  fueraDeTab: number;
  /** `role="tablist"`. */
  tablist: number;
  /** `role="tab"`. */
  tab: number;
  /** `var(--wine…)` en línea. */
  vino: number;
};

const ESPERADO: Record<string, Cuenta> = {
  // Filas de la lista de leads: no abren un registro del Studio (el nombre es un enlace externo).
  "crm/_components/KommoClient.tsx": { aviso: 0, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0, tablist: 1, tab: 1, vino: 0 },
  // Tarjetas del tablero espejado: tampoco abren; el nombre ya es un enlace.
  "crm/_components/KommoBoardView.tsx": { aviso: 0, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0, tablist: 1, tab: 1, vino: 0 },
  "crm/_components/LeadDrawer.tsx": { aviso: 1, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0, tablist: 1, tab: 1, vino: 0 },
  // Excepciones: el canal de anuncio del arrastre (status + aria-live, DND-01) y «Moviendo…» (status, texto).
  // El vino es la señal de la columna mientras se arrastra encima, igual que en Bitácora.
  "crm/_components/CrmTableroKanban.tsx": { aviso: 0, rol: 2, vivo: 1, contorno: 0, abrir: 1, fueraDeTab: 1, tablist: 0, tab: 0, vino: 2 },
  // El vino es color de dato: un KPI y la primera barra de la cartera.
  "crm/_components/DireccionTab.tsx": { aviso: 1, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0, tablist: 0, tab: 0, vino: 2 },
  // Excepción: «Cargando la ficha…» es texto en status, sin caja.
  "crm/_components/TarjetaFichaDrawer.tsx": { aviso: 1, rol: 1, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0, tablist: 0, tab: 0, vino: 0 },
  // El vino es el contador de mensajes sin leer (pastilla de estado, no se toca).
  "conversaciones/_components/ConversationList.tsx": { aviso: 0, rol: 0, vivo: 0, contorno: 0, abrir: 1, fueraDeTab: 1, tablist: 0, tab: 0, vino: 1 },
  // El vino es la burbuja del mensaje saliente (identidad, no se oprime). El hilo no es región viva.
  "conversaciones/_components/ConversationThread.tsx": { aviso: 1, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0, tablist: 0, tab: 0, vino: 1 },
};

const ARCHIVOS = Object.keys(ESPERADO);

const PATRONES: Record<keyof Cuenta, RegExp> = {
  aviso: /<Aviso\b/g,
  rol: /role="(?:alert|status|note)"/g,
  vivo: /aria-live=/g,
  contorno: /(?:solid|dashed) var\(--(?:danger|warning|success|info)\)/g,
  abrir: /aria-label=\{`Abrir /g,
  fueraDeTab: /tabIndex=\{-1\}/g,
  tablist: /role="tablist"/g,
  tab: /role="tab"/g,
  vino: /var\(--wine[a-z-]*\)/g,
};

const IMPORT_AVISO = /from "@\/app\/studio\/_components\/ui\/Aviso"/;

/** Quita comentarios de bloque (también `{/* … *\/}` de JSX) y de línea completa. */
function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function contar(texto: string): Cuenta {
  const codigo = sinComentarios(texto);
  const out = {} as Cuenta;
  for (const k of Object.keys(PATRONES) as (keyof Cuenta)[]) {
    out[k] = codigo.match(PATRONES[k])?.length ?? 0;
  }
  return out;
}

/** La etiqueta JSX de apertura que contiene la posición `i`, respetando llaves y comillas. */
function etiquetaEn(s: string, i: number): string {
  const inicio = s.lastIndexOf("<", i);
  let llaves = 0;
  let comilla: string | null = null;
  for (let k = inicio + 1; k < s.length; k++) {
    const c = s[k];
    if (comilla) {
      if (c === comilla) comilla = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") comilla = c;
    else if (c === "{") llaves++;
    else if (c === "}") llaves--;
    else if (c === ">" && llaves === 0) return s.slice(inicio, k + 1);
  }
  return s.slice(inicio);
}

function etiquetasCon(s: string, marca: string): string[] {
  const out: string[] = [];
  for (let i = s.indexOf(marca); i !== -1; i = s.indexOf(marca, i + 1)) out.push(etiquetaEn(s, i));
  return out;
}

/**
 * Diferencias contra lo esperado, el import canónico si hay `<Aviso>`, y la
 * forma de cada pestaña: clase única, sin estilo en línea, con `data-activa`.
 */
function violaciones(ruta: string, texto: string): string[] {
  const fallas: string[] = [];
  const codigo = sinComentarios(texto);
  const real = contar(texto);
  for (const k of Object.keys(PATRONES) as (keyof Cuenta)[]) {
    if (real[k] !== ESPERADO[ruta][k]) fallas.push(`${ruta}: ${k} = ${real[k]}, se esperaba ${ESPERADO[ruta][k]}`);
  }
  if (real.aviso > 0 && !IMPORT_AVISO.test(codigo)) {
    fallas.push(`${ruta}: usa <Aviso> sin importarlo del componente canónico`);
  }
  for (const t of etiquetasCon(codigo, 'role="tablist"')) {
    if (!t.includes('className="studio-tabs"')) fallas.push(`${ruta}: tablist sin la clase única`);
    if (/\bstyle=/.test(t)) fallas.push(`${ruta}: tablist con estilo en línea`);
    if (!/aria-label(ledby)?=/.test(t)) fallas.push(`${ruta}: tablist sin nombre`);
  }
  for (const t of etiquetasCon(codigo, 'role="tab"')) {
    if (!t.includes('className="studio-tab"')) fallas.push(`${ruta}: pestaña sin la clase única`);
    if (/\bstyle=/.test(t)) fallas.push(`${ruta}: pestaña con estilo en línea`);
    if (!t.includes("aria-selected=")) fallas.push(`${ruta}: pestaña sin aria-selected`);
    if (!t.includes("data-activa=")) fallas.push(`${ruta}: pestaña sin data-activa (el relleno de tinta)`);
  }
  return fallas;
}

const fuentes = new Map<string, string>(
  ARCHIVOS.map((ruta) => [ruta, readFileSync(join(process.cwd(), BASE, ruta), "utf8")]),
);

const TOTAL_AVISOS = 4;
const TOTAL_PESTANAS = 3;

describe("SDD-0603 · tramo 5d · pestañas, tarjetas y avisos de CRM y Conversaciones (BD-037)", () => {
  it("mira los 8 archivos de la allowlist", () => {
    expect(fuentes.size).toBe(8);
  });

  it.each(ARCHIVOS)("%s cumple su cuenta exacta", (ruta) => {
    expect(violaciones(ruta, fuentes.get(ruta)!)).toEqual([]);
  });

  it(`el grupo deja exactamente ${TOTAL_AVISOS} <Aviso> y ${TOTAL_PESTANAS} grupos de pestañas`, () => {
    let avisos = 0;
    let grupos = 0;
    for (const texto of fuentes.values()) {
      avisos += contar(texto).aviso;
      grupos += contar(texto).tablist;
    }
    expect(avisos).toBe(TOTAL_AVISOS);
    expect(grupos).toBe(TOTAL_PESTANAS);
  });

  it("«Abrir» de tarjetas y filas es un secundario de tabla con verbo visible", () => {
    for (const ruta of ["crm/_components/CrmTableroKanban.tsx", "conversaciones/_components/ConversationList.tsx"]) {
      const codigo = sinComentarios(fuentes.get(ruta)!);
      const i = codigo.search(PATRONES.abrir);
      const boton = codigo.slice(codigo.lastIndexOf("<button", i), codigo.indexOf("</button>", i));
      expect(boton, ruta).toMatch(/studio-btn /);
      expect(boton, ruta).toMatch(/studio-btn-sm/);
      expect(boton, ruta).not.toMatch(/tabIndex/);
      expect(boton, ruta).toMatch(/>\s*Abrir\s*\{Icon\.chevR\(14\)\}/);
    }
  });

  it("lo que se oprime en Conversaciones usa clases de control, sin contorno pálido en línea", () => {
    const hilo = sinComentarios(fuentes.get("conversaciones/_components/ConversationThread.tsx")!);
    const lista = sinComentarios(fuentes.get("conversaciones/_components/ConversationList.tsx")!);
    // Cada <button> lleva una clase del sistema, salvo el de datos de la fila (fuera del Tab).
    for (const [ruta, codigo, piso] of [["hilo", hilo, 4], ["lista", lista, 4]] as const) {
      const botones = etiquetasCon(codigo, "<button");
      expect(botones.length, ruta).toBeGreaterThanOrEqual(piso);
      const sueltos = botones.filter((b) => !/className=/.test(b) && !b.includes("tabIndex={-1}"));
      expect(sueltos, ruta).toEqual([]);
    }
    // Los dos selectores del hilo comparten un estilo con contorno de campo (≥ 3:1).
    expect(hilo).toMatch(/const selectStyle[\s\S]*?border: "1px solid var\(--ink-soft\)"/);
    expect(hilo).toMatch(/className="studio-btn studio-btn-primary"/);
  });

  describe("mutantes", () => {
    const muta = (ruta: string, de: string | RegExp, a: string) => {
      const original = fuentes.get(ruta)!;
      const mutado = original.replace(de, a);
      expect(mutado, `el mutante no cambió ${ruta}`).not.toBe(original);
      return violaciones(ruta, mutado);
    };
    const direccion = "crm/_components/DireccionTab.tsx";
    const AVISO_DIRECCION = '<Aviso tono="atencion" titulo="Estos números son parciales.">';

    it("<Aviso> vuelve a <p> → rompe", () => {
      expect(muta(direccion, AVISO_DIRECCION, '<p role="alert">').length).toBeGreaterThan(0);
    });

    it("vuelve la caja con contorno dorado → rompe", () => {
      expect(muta(direccion, AVISO_DIRECCION, '<div style={{ border: "1px solid var(--warning)" }}>')).toEqual(
        expect.arrayContaining([expect.stringContaining("aviso = 0"), expect.stringContaining("contorno = 1")]),
      );
    });

    it("un comentario no cuenta: quitar el Aviso y dejarlo citado en un comentario igual rompe", () => {
      expect(muta(direccion, AVISO_DIRECCION, '<p> {/* antes: <Aviso tono="atencion"> role="alert" */}')).toEqual([
        expect.stringContaining("aviso = 0"),
      ]);
    });

    it("un comentario no suma: citar roles, <Aviso o vino en comentarios no cambia la cuenta", () => {
      const original = fuentes.get(direccion)!;
      const mutado = `// role="alert" <Aviso aria-live= tabIndex={-1} role="tab" var(--wine)\n/* solid var(--danger) role="tablist" */\n${original}`;
      expect(violaciones(direccion, mutado)).toEqual([]);
    });

    it("se quita el import canónico → rompe", () => {
      expect(muta(direccion, IMPORT_AVISO, 'from "./Aviso"').length).toBeGreaterThan(0);
    });

    it("una pestaña vuelve al estilo en línea → rompe", () => {
      expect(
        muta("crm/_components/LeadDrawer.tsx", 'className="studio-tab"', 'className="studio-tab" style={{ color: "var(--ink-soft)" }}'),
      ).toEqual([expect.stringContaining("pestaña con estilo en línea")]);
    });

    it("una pestaña pierde la clase única → rompe", () => {
      expect(muta("crm/_components/KommoBoardView.tsx", 'className="studio-tab"', 'className="studio-btn studio-btn-sm"')).toEqual([
        expect.stringContaining("pestaña sin la clase única"),
      ]);
    });

    it("una pestaña pierde el relleno de la activa → rompe", () => {
      expect(muta("crm/_components/KommoClient.tsx", /\s*data-activa=\{isActive \? "true" : undefined\}/, "")).toEqual([
        expect.stringContaining("pestaña sin data-activa"),
      ]);
    });

    it("el tablist pierde la clase única → rompe", () => {
      expect(muta("crm/_components/KommoClient.tsx", 'className="studio-tabs"', 'className="fila"')).toEqual([
        expect.stringContaining("tablist sin la clase única"),
      ]);
    });

    it("el nombre de la tarjeta vuelve a ser parada de Tab → rompe", () => {
      expect(muta("crm/_components/CrmTableroKanban.tsx", "tabIndex={-1}", "tabIndex={0}")).toEqual([
        expect.stringContaining("fueraDeTab = 0"),
      ]);
    });

    it("la fila elegida de Conversaciones vuelve al vino → rompe", () => {
      expect(muta("conversaciones/_components/ConversationList.tsx", '"var(--ctl-border)"', '"var(--wine)"')).toEqual([
        expect.stringContaining("vino = 2"),
      ]);
    });

    it("el aviso del hilo vuelve a ser una caja con role=note → rompe", () => {
      expect(
        muta("conversaciones/_components/ConversationThread.tsx", /<Aviso id=\{avisoId\}[^>]*>/, '<p id={avisoId} role="note">'),
      ).toEqual(expect.arrayContaining([expect.stringContaining("aviso = 0"), expect.stringContaining("rol = 1")]));
    });

    it("el hilo de mensajes se vuelve región viva → rompe", () => {
      expect(muta("conversaciones/_components/ConversationThread.tsx", "ref={scrollRef}", 'ref={scrollRef} aria-live="polite"')).toEqual([
        expect.stringContaining("vivo = 1"),
      ]);
    });
  });
});
