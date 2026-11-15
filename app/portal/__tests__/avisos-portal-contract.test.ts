import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato de SDD-0603 · tramo 4e (avisos del portal del cliente, BD-037).
 * Extensión al portal de SDD-0628 (`Aviso` del Studio), sin importar del Studio.
 *
 * Mira dos cosas, cada una con una función pura para poder correrla también
 * contra mutantes:
 *   1. La hoja: `.portal-aviso` es una franja plana (sin contorno ni sombra) y
 *      el texto y el icono de cada tono pasan AA en claro y en oscuro, leídos de
 *      las reglas reales de `app/portal/claridad.css` y de los tokens de
 *      `app/globals.css`.
 *   2. Las pantallas: cuántas franjas tiene cada archivo (sin contar
 *      comentarios), que cada una lleve el icono de su tono, que ninguna vuelva
 *      a pintarse con contorno o sombra, y que no quede color de estado en línea
 *      fuera de los restos clasificados como «no aplica» (pastillas, filas,
 *      mapas de tonos).
 */

const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");
const globalsCss = leer("app/globals.css");
const claridadCss = leer("app/portal/claridad.css");

// ── Tokens y contraste (mismo método que claridad-portal-contract) ──────────

function bloque(css: string, cabecera: string): string {
  const i = css.indexOf(`\n${cabecera} {`);
  if (i < 0) throw new Error(`no hay bloque ${cabecera}`);
  return css.slice(i, css.indexOf("}", i));
}

/** Todos los bloques que abren exactamente con `cabecera {`, juntos; "" si no hay ninguno. */
function bloques(css: string, cabecera: string): string {
  const abre = `\n${cabecera} {`;
  const out: string[] = [];
  for (let i = css.indexOf(abre); i >= 0; i = css.indexOf(abre, i + 1)) out.push(css.slice(i, css.indexOf("}", i)));
  return out.join("\n");
}

/**
 * El portal tiene tres estados de tema, no dos:
 *   - `claro`: sin atributo (cuentas sin tema). Los `--color-*` salen de `@theme`.
 *   - `claro-explicito`: `data-portal-theme="light"`, lo que deja el botón de tema
 *     al pasar de oscuro a claro. Hoy no redefine ningún `--color-*`, pero le
 *     aplican los bloques `[data-portal-theme="light"]` y `[data-portal-theme]`
 *     (este último vale para los dos temas con atributo) de las dos hojas.
 *   - `oscuro`: `data-portal-theme="dark"`.
 */
type Tema = "claro" | "claro-explicito" | "oscuro";
type Temas = Record<Tema, string>;
const NOMBRES: Tema[] = ["claro", "claro-explicito", "oscuro"];

/** Selectores de atributo que le aplican a cada tema, del más propio al más general. */
const ATRIBUTOS: Record<Tema, string[]> = {
  claro: [],
  "claro-explicito": ['[data-portal-theme="light"]', "[data-portal-theme]"],
  oscuro: ['[data-portal-theme="dark"]', "[data-portal-theme]"],
};

function temasDe(globals: string): Temas {
  return {
    claro: bloque(globals, "@theme"),
    "claro-explicito": ATRIBUTOS["claro-explicito"].map((a) => bloques(globals, a)).join("\n"),
    oscuro: bloque(globals, '[data-portal-theme="dark"]'),
  };
}

function token(temas: Temas, tema: Tema, nombre: string): string {
  const re = new RegExp(`${nombre}\\s*:\\s*([^;]+);`);
  const m = temas[tema].match(re) ?? temas.claro.match(re); // sin override → hereda el claro
  if (!m) throw new Error(`no hay ${nombre}`);
  const v = m[1].trim();
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref ? token(temas, tema, ref[1]) : v;
}

function luz(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`no es hex de 6: ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const u = parseInt(hex.slice(i, i + 2), 16) / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Un color es un token (`--x`) o una mezcla sRGB de dos tokens, escrita
 * `mezcla(--a,14,--b)`, que es lo que hace `color-mix(in srgb, var(--a) 14%, var(--b))`.
 */
function hex(temas: Temas, tema: Tema, color: string): string {
  const m = color.match(/^mezcla\((--[\w-]+),(\d+(?:\.\d+)?),(--[\w-]+)\)$/);
  if (!m) return token(temas, tema, color);
  const [a, b, p] = [token(temas, tema, m[1]), token(temas, tema, m[3]), Number(m[2]) / 100];
  return `#${[1, 3, 5]
    .map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * p + parseInt(b.slice(i, i + 2), 16) * (1 - p)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function contraste(temas: Temas, tema: Tema, a: string, b: string): number {
  const [l1, l2] = [luz(hex(temas, tema, a)), luz(hex(temas, tema, b))];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Cuerpo de la regla con ese selector exacto, o `null` si no existe. */
function reglaO(css: string, selector: string): string | null {
  const i = css.indexOf(`\n${selector} {`);
  return i < 0 ? null : css.slice(i, css.indexOf("}", i));
}
function regla(css: string, selector: string): string {
  const r = reglaO(css, selector);
  if (r === null) throw new Error(`no hay regla ${selector}`);
  return r;
}

function tokenDe(cuerpo: string, propiedad: string): string {
  const m = cuerpo.match(new RegExp(`\\n\\s*${propiedad}\\s*:[^;]*var\\((--[\\w-]+)\\)[^;]*;`));
  if (!m) throw new Error(`la regla no declara ${propiedad} con un token`);
  return m[1];
}

const TONOS = ["info", "atencion", "exito", "error"] as const;
type Tono = (typeof TONOS)[number];
const FORMA: Record<Tono, string> = { info: "info", atencion: "warning", exito: "success", error: "danger" };

const SEL = {
  franja: ".portal-sys .portal-aviso",
  icono: ".portal-sys .portal-aviso-icono",
  tono: (t: Tono) => `.portal-sys .portal-aviso[data-tono="${t}"] .portal-aviso-icono`,
  // `atributo` es `[data-portal-theme="dark"]`, `[data-portal-theme="light"]` o `[data-portal-theme]`.
  iconoEnTema: (atributo: string, t: Tono) => `.portal-sys ${atributo} .portal-aviso[data-tono="${t}"] .portal-aviso-icono`,
  franjaEnTema: (atributo: string, t: Tono) => `.portal-sys ${atributo} .portal-aviso[data-tono="${t}"]`,
};

/** La primera regla que exista de las que le aplican a ese tema; `null` si ninguna. */
function reglaDeTema(css: string, tema: Tema, selector: (atributo: string) => string): string | null {
  for (const atributo of ATRIBUTOS[tema]) {
    const r = reglaO(css, selector(atributo));
    if (r !== null) return r;
  }
  return null;
}

/**
 * Token del icono de un tono en un tema, resuelto como lo haría la cascada: una
 * regla con atributo de tema le gana a la del tono, y esta a la común. Una regla
 * bajo `[data-portal-theme]` a secas le aplica también al claro explícito.
 */
function tokenIcono(css: string, tema: Tema, tono: Tono): string {
  const deTema = reglaDeTema(css, tema, (a) => SEL.iconoEnTema(a, tono));
  const propia = reglaO(css, SEL.tono(tono));
  return tokenDe(deTema ?? propia ?? regla(css, SEL.icono), "color");
}

/** Fondo de la franja de un tono en un tema: el del tema, el propio del tono (atención) o el común. */
function fondoDe(css: string, tema: Tema, tono: Tono): string {
  const deTema = reglaDeTema(css, tema, (a) => SEL.franjaEnTema(a, tono));
  const propia = reglaO(css, `.portal-sys .portal-aviso[data-tono="${tono}"]`);
  const cuerpo = deTema ?? propia ?? regla(css, SEL.franja);
  const mezcla = cuerpo.match(
    /\n\s*background\s*:\s*color-mix\(in srgb, var\((--[\w-]+)\) (\d+(?:\.\d+)?)%, var\((--[\w-]+)\)\);/,
  );
  return mezcla ? `mezcla(${mezcla[1]},${mezcla[2]},${mezcla[3]})` : tokenDe(cuerpo, "background");
}

type Medida = { tema: Tema; que: string; frente: string; fondo: string; minimo: number };

function medidas(css: string): Medida[] {
  const franja = regla(css, SEL.franja);
  const out: Medida[] = [];
  for (const tema of NOMBRES) {
    for (const tono of TONOS) {
      const fondo = fondoDe(css, tema, tono);
      out.push({ tema, que: `texto de la franja de ${tono}`, frente: tokenDe(franja, "color"), fondo, minimo: 4.5 });
      // Las pantallas ponen el cuerpo en `text-grey-700`: también tiene que leerse.
      out.push({ tema, que: `texto secundario (grey-700) en ${tono}`, frente: "--color-grey-700", fondo, minimo: 4.5 });
      out.push({ tema, que: `icono de ${tono}`, frente: tokenIcono(css, tema, tono), fondo, minimo: 3 });
    }
  }
  return out;
}

/** `globals` se puede cambiar para probar un mutante de los tokens. */
function fallasDeHoja(css: string, globals: string = globalsCss): string[] {
  const temas = temasDe(globals);
  const out: string[] = [];
  for (const m of medidas(css)) {
    const c = contraste(temas, m.tema, m.frente, m.fondo);
    if (c < m.minimo) out.push(`${m.tema} · ${m.que}: ${c.toFixed(2)}:1 < ${m.minimo}`);
  }
  const franja = regla(css, SEL.franja);
  if (!/\n\s*border: 0;/.test(franja)) out.push("la franja declara contorno");
  if (!/\n\s*box-shadow: none;/.test(franja)) out.push("la franja declara sombra");
  return out;
}

/**
 * La franja no depende de su borde (menores del portal, BD-037). El relleno
 * `--color-grey-100` mide 1,09:1 contra el papel claro: el canto casi no se ve,
 * y la regla prohíbe darle contorno. Lo que hace de aviso es el icono y el texto,
 * así que tienen que leerse igual si el relleno no se distingue: se miden contra
 * las dos superficies donde cae una franja (papel y tarjeta), en los tres temas.
 */
function fallasSinFranja(css: string, globals: string = globalsCss): string[] {
  const temas = temasDe(globals);
  const texto = tokenDe(regla(css, SEL.franja), "color");
  const out: string[] = [];
  for (const tema of NOMBRES) {
    for (const [superficie, nombre] of [["--color-paper", "el papel"], ["--color-white", "la tarjeta"]] as const) {
      const pares: [string, string, number][] = [
        ["texto de la franja", texto, 4.5],
        ["texto secundario (grey-700)", "--color-grey-700", 4.5],
        ...TONOS.map((t): [string, string, number] => [`icono de ${t}`, tokenIcono(css, tema, t), 3]),
      ];
      for (const [que, frente, minimo] of pares) {
        const c = contraste(temas, tema, frente, superficie);
        if (c < minimo) out.push(`${tema} · ${que} sobre ${nombre}: ${c.toFixed(2)}:1 < ${minimo}`);
      }
    }
  }
  return out;
}

// ── Pantallas ───────────────────────────────────────────────────────────────

const BASE = "app/portal/(app)/";

/** Franjas esperadas por archivo (los 11 de la allowlist; 0 = «no aplica»). */
const ESPERADO: Record<string, { franjas: Partial<Record<Tono, number>>; restos: number; bordeIzq?: number }> = {
  "_components/PendingAcceptanceCard.tsx": { franjas: { atencion: 1 }, restos: 0 },
  "_components/ProfileIncompleteCard.tsx": { franjas: { atencion: 1 }, restos: 0 },
  "facturas/[code]/_components/PendingInvoiceGate.tsx": { franjas: { atencion: 1 }, restos: 0 },
  // Resto: el color del punto de estado de la fila del documento. La fila
  // (borde izquierdo ámbar) es una fila resaltada, no un aviso: no se toca.
  "perfil/CedulaPhotoRow.tsx": { franjas: { atencion: 1 }, restos: 1 },
  "perfil/DataChangeEditor.tsx": { franjas: { atencion: 2 }, restos: 0 },
  "perfil/ProfilePendingBanner.tsx": { franjas: { info: 1 }, restos: 0 },
  // Restos: la pastilla «1 pendiente» (borde y punto) y la sección de contenido
  // «Tu Shipping Mark» (acento vino de una tarjeta, no aviso; su borde izquierdo
  // también se queda).
  "perfil/page.tsx": { franjas: { info: 1, exito: 1 }, restos: 3, bordeIzq: 1 },
  // Restos: el icono y la pastilla de etapa del seguimiento total y su barra de
  // progreso (acento vino). El mapa de tonos de etapa no es un `style={{ }}`.
  "envios/_components/PortalAlertasHub.tsx": { franjas: { info: 1 }, restos: 3 },
  "compras/nueva/NewPurchaseForm.tsx": { franjas: { exito: 1 }, restos: 0 },
  "facturas/[code]/reportar/PaymentReportForm.tsx": { franjas: { exito: 1 }, restos: 0 },
  // Restos: el número del proveedor y el icono de los argumentos (acento vino).
  "proveedores/SuppliersClient.tsx": { franjas: { info: 1 }, restos: 2 },
};

/** El código sin comentarios: un `className` citado en un comentario no cuenta. */
function sinComentarios(tsx: string): string {
  return tsx
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

type Franja = { tono: string; clases: string; etiqueta: string; icono: string | null; rol: string | null };

/** Cada elemento con la clase `portal-aviso`, su tono, su icono y su rol. */
function franjas(tsx: string): Franja[] {
  const codigo = sinComentarios(tsx);
  const out: Franja[] = [];
  const re = /<(\w+)\b([^>]*?)className="(portal-aviso(?:\s[^"]*)?)"([^>]*)>/g;
  for (const m of codigo.matchAll(re)) {
    const atributos = `${m[2]} ${m[4]}`;
    const resto = codigo.slice((m.index ?? 0) + m[0].length);
    const icono = resto.match(/^\s*<span className="portal-aviso-icono">\s*<StatusIcon tone="(\w+)"/);
    out.push({
      etiqueta: m[1],
      clases: m[3],
      tono: atributos.match(/data-tono="(\w+)"/)?.[1] ?? "(sin tono)",
      icono: icono?.[1] ?? null,
      rol: atributos.match(/role="(\w+)"/)?.[1] ?? null,
    });
  }
  return out;
}

/** Bloques `style={{ … }}` con color de estado o vino, o con borde izquierdo de color. */
function restosEnLinea(tsx: string): string[] {
  const codigo = sinComentarios(tsx);
  return [...codigo.matchAll(/style=\{\{([\s\S]*?)\}\}/g)]
    .map((m) => m[1])
    .filter((s) => /--color-(status-|wine\))|borderLeftColor/.test(s));
}

function fallasDePantalla(ruta: string, tsx: string): string[] {
  const esperado = ESPERADO[ruta];
  const out: string[] = [];
  const fs = franjas(tsx);
  for (const tono of TONOS) {
    const n = fs.filter((f) => f.tono === tono).length;
    if (n !== (esperado.franjas[tono] ?? 0)) out.push(`${ruta}: ${n} franjas de ${tono}, se esperaban ${esperado.franjas[tono] ?? 0}`);
  }
  for (const f of fs) {
    if (!(TONOS as readonly string[]).includes(f.tono)) out.push(`${ruta}: franja con tono desconocido ${f.tono}`);
    else if (f.icono !== FORMA[f.tono as Tono]) out.push(`${ruta}: franja ${f.tono} con icono ${f.icono ?? "(ninguno)"}`);
    if (/(^|\s)(border|card-shadow|shadow|bg-)/.test(f.clases)) out.push(`${ruta}: la franja ${f.tono} vuelve a tener cajón: ${f.clases}`);
    // BD-037 + A11Y-01 §5: un banner persistente no interrumpe; solo el error es alert.
    if (f.rol === "alert" && f.tono !== "error") out.push(`${ruta}: franja ${f.tono} con role="alert"`);
  }
  const restos = restosEnLinea(tsx).length;
  if (restos !== esperado.restos) out.push(`${ruta}: ${restos} estilos de color en línea, se esperaban ${esperado.restos}`);
  const bordes = (sinComentarios(tsx).match(/border-l-\[3px\]/g) ?? []).length;
  if (bordes !== (esperado.bordeIzq ?? 0)) out.push(`${ruta}: queda un borde izquierdo de estado (border-l-[3px])`);
  return out;
}

const PANTALLAS = Object.fromEntries(Object.keys(ESPERADO).map((r) => [r, leer(BASE + r)]));

function todasLasFallas(pantallas: Record<string, string>): string[] {
  return Object.entries(pantallas).flatMap(([r, tsx]) => fallasDePantalla(r, tsx));
}

// ── Pruebas ─────────────────────────────────────────────────────────────────

describe("avisos del portal · SDD-0603 tramo 4e (BD-037)", () => {
  it("mide al menos 36 pares (12 por tema, tres temas): la suite no puede vaciarse", () => {
    const ms = medidas(claridadCss);
    expect(ms.length).toBeGreaterThanOrEqual(36);
    for (const tema of NOMBRES) expect(ms.filter((m) => m.tema === tema).length).toBeGreaterThanOrEqual(12);
  });

  it("atención lleva el acento dorado en el fondo; los demás tonos, la franja neutra", () => {
    for (const tema of NOMBRES) {
      expect(fondoDe(claridadCss, tema, "atencion")).toBe("mezcla(--color-status-warning,14,--color-grey-100)");
      for (const t of ["info", "exito", "error"] as const) expect(fondoDe(claridadCss, tema, t)).toBe("--color-grey-100");
    }
  });

  it.each(medidas(claridadCss).map((m) => [`${m.tema} · ${m.que}`, m] as const))("%s", (_q, m) => {
    expect(contraste(temasDe(globalsCss), m.tema, m.frente, m.fondo)).toBeGreaterThanOrEqual(m.minimo);
  });

  it("la hoja real no tiene fallas: franja plana y contraste AA", () => {
    expect(fallasDeHoja(claridadCss)).toEqual([]);
  });

  it("atención en claro lleva el icono en tinta; en oscuro, el dorado", () => {
    expect(tokenIcono(claridadCss, "claro", "atencion")).toBe("--color-ink");
    expect(tokenIcono(claridadCss, "oscuro", "atencion")).toBe("--color-status-warning");
  });

  it('con data-portal-theme="light" explícito, atención también lleva el icono en tinta', () => {
    expect(tokenIcono(claridadCss, "claro-explicito", "atencion")).toBe("--color-ink");
  });

  it("el claro explícito resuelve hoy los mismos colores que el claro sin atributo", () => {
    const temas = temasDe(globalsCss);
    for (const m of medidas(claridadCss).filter((x) => x.tema === "claro")) {
      expect(hex(temas, "claro-explicito", m.frente), m.que).toBe(hex(temas, "claro", m.frente));
      expect(hex(temas, "claro-explicito", m.fondo), m.que).toBe(hex(temas, "claro", m.fondo));
    }
  });

  it("la franja no depende de su borde: icono y texto se leen también sobre el papel y la tarjeta", () => {
    expect(fallasSinFranja(claridadCss)).toEqual([]);
  });

  it("cuenta 13 franjas en los 11 archivos", () => {
    const total = Object.values(PANTALLAS).reduce((n, tsx) => n + franjas(tsx).length, 0);
    expect(total).toBe(13);
    expect(Object.keys(PANTALLAS)).toHaveLength(11);
  });

  it("cada pantalla tiene sus franjas, con su icono, planas y sin color de estado en línea", () => {
    expect(todasLasFallas(PANTALLAS)).toEqual([]);
  });

  it("el portal no importa nada del Studio para pintar avisos", () => {
    for (const tsx of Object.values(PANTALLAS)) {
      expect(tsx).not.toMatch(/from "@\/app\/studio\//);
      expect(tsx).not.toMatch(/studio-aviso/);
    }
  });

  it("el éxito guardado del perfil se anuncia como status, no como alert", () => {
    const perfil = franjas(PANTALLAS["perfil/page.tsx"]).find((f) => f.tono === "exito");
    expect(perfil?.rol).toBe("status");
  });

  describe("mutantes: el contrato detecta cuando un aviso vuelve atrás", () => {
    it("M1 · el dorado vuelve al icono de atención en claro", () => {
      const m = claridadCss.replace(
        '.portal-sys [data-portal-theme="dark"] .portal-aviso[data-tono="atencion"] .portal-aviso-icono {',
        '.portal-sys .portal-aviso[data-tono="atencion"] .portal-aviso-icono {',
      );
      expect(m).not.toBe(claridadCss);
      expect(fallasDeHoja(m).some((f) => f.startsWith("claro · icono de atencion"))).toBe(true);
    });

    it("M2 · la franja gana contorno y sombra", () => {
      const franja = regla(claridadCss, SEL.franja);
      const m = claridadCss.replace(
        franja,
        franja.replace("border: 0;", "border: 1px solid var(--color-grey-200);").replace("box-shadow: none;", "box-shadow: var(--portal-ctl-shadow-xs);"),
      );
      expect(m).not.toBe(claridadCss);
      expect(fallasDeHoja(m)).toEqual(expect.arrayContaining(["la franja declara contorno", "la franja declara sombra"]));
    });

    it("M3 · el texto de la franja pasa a gris de borde", () => {
      const franja = regla(claridadCss, SEL.franja);
      const m = claridadCss.replace(franja, franja.replace("color: var(--color-ink);", "color: var(--color-grey-300);"));
      expect(m).not.toBe(claridadCss);
      expect(fallasDeHoja(m).some((f) => f.includes("texto de la franja"))).toBe(true);
    });

    it("M4 · una pantalla vuelve al cajón con borde izquierdo dorado en línea", () => {
      const ruta = "_components/ProfileIncompleteCard.tsx";
      const original = PANTALLAS[ruta];
      const m = original.replace(
        'className="portal-aviso rounded-[16px] p-5 sm:p-6" data-tono="atencion"',
        'className="card-shadow bg-white border border-grey-200 rounded-[16px] border-l-[3px] p-5" style={{ borderLeftColor: "var(--color-status-warning)" }}',
      );
      expect(m).not.toBe(original);
      const f = todasLasFallas({ ...PANTALLAS, [ruta]: m });
      expect(f).toEqual(
        expect.arrayContaining([
          `${ruta}: 0 franjas de atencion, se esperaban 1`,
          `${ruta}: 1 estilos de color en línea, se esperaban 0`,
          `${ruta}: queda un borde izquierdo de estado (border-l-[3px])`,
        ]),
      );
    });

    it("M5 · una franja citada en un comentario no cuenta como franja", () => {
      const ruta = "envios/_components/PortalAlertasHub.tsx";
      const original = PANTALLAS[ruta];
      const m = original.replace(
        '<div className="portal-aviso mt-6 rounded-[14px] p-5" data-tono="info">',
        '{/* <div className="portal-aviso mt-6 rounded-[14px] p-5" data-tono="info"> */}<div className="mt-6 rounded-[14px] p-5">',
      );
      expect(m).not.toBe(original);
      expect(fallasDePantalla(ruta, m)).toContain(`${ruta}: 0 franjas de info, se esperaban 1`);
    });

    it("M6 · el tono y la forma del icono no coinciden", () => {
      const ruta = "compras/nueva/NewPurchaseForm.tsx";
      const original = PANTALLAS[ruta];
      const m = original.replace('<StatusIcon tone="success" size={18} />', '<StatusIcon tone="info" size={18} />');
      expect(m).not.toBe(original);
      expect(fallasDePantalla(ruta, m)).toContain(`${ruta}: franja exito con icono info`);
    });

    it("M7 · un banner persistente de atención pasa a role=alert", () => {
      const ruta = "perfil/DataChangeEditor.tsx";
      const original = PANTALLAS[ruta];
      const m = original.replace(
        '<div className="portal-aviso rounded-[12px] p-4" data-tono="atencion">',
        '<div role="alert" className="portal-aviso rounded-[12px] p-4" data-tono="atencion">',
      );
      expect(m).not.toBe(original);
      expect(fallasDePantalla(ruta, m)).toContain(`${ruta}: franja atencion con role="alert"`);
    });

    it("M8 · el dorado recolorea la franja entera (60 %) y el texto deja de leerse", () => {
      const m = claridadCss.replace("var(--color-status-warning) 14%,", "var(--color-status-warning) 60%,");
      expect(m).not.toBe(claridadCss);
      expect(fallasDeHoja(m).some((f) => f.includes("texto de la franja de atencion"))).toBe(true);
    });

    it("M9 · la excepción dorada se abre a todo tema con atributo y alcanza al claro explícito", () => {
      const m = claridadCss.replace(
        '.portal-sys [data-portal-theme="dark"] .portal-aviso[data-tono="atencion"] .portal-aviso-icono {',
        '.portal-sys [data-portal-theme] .portal-aviso[data-tono="atencion"] .portal-aviso-icono {',
      );
      expect(m).not.toBe(claridadCss);
      const f = fallasDeHoja(m);
      expect(f.some((x) => x.startsWith("claro-explicito · icono de atencion"))).toBe(true);
      // El claro sin atributo y el oscuro siguen bien: sin el tercer tema, este mutante pasaba.
      expect(f.filter((x) => !x.startsWith("claro-explicito · "))).toEqual([]);
    });

    it('M10 · una regla propia de [data-portal-theme="light"] pone el dorado en el icono', () => {
      const m = `${claridadCss}\n.portal-sys [data-portal-theme="light"] .portal-aviso[data-tono="atencion"] .portal-aviso-icono {\n  color: var(--color-status-warning);\n}\n`;
      const f = fallasDeHoja(m);
      expect(f.some((x) => x.startsWith("claro-explicito · icono de atencion"))).toBe(true);
      expect(f.filter((x) => !x.startsWith("claro-explicito · "))).toEqual([]);
    });

    it('M11 · globals.css redefine un token bajo [data-portal-theme="light"] y el texto deja de leerse', () => {
      const m = `${globalsCss}\n[data-portal-theme="light"] {\n  --color-grey-700: #8b93a8;\n}\n`;
      const f = fallasDeHoja(claridadCss, m);
      expect(f.some((x) => x.startsWith("claro-explicito · texto secundario (grey-700)"))).toBe(true);
      expect(f.filter((x) => !x.startsWith("claro-explicito · "))).toEqual([]);
    });

    it("M12 · la franja pasa a depender de su relleno: bloque de tinta con texto claro", () => {
      const franja = regla(claridadCss, SEL.franja);
      const m = claridadCss.replace(
        franja,
        franja.replace("background: var(--color-grey-100);", "background: var(--color-ink);").replace("color: var(--color-ink);", "color: var(--color-white);"),
      );
      expect(m).not.toBe(claridadCss);
      // Sobre su propio relleno el texto se lee (16,49:1 en claro)…
      expect(fallasDeHoja(m).some((x) => x.startsWith("claro · texto de la franja de info"))).toBe(false);
      // …pero ya no se sostiene sin él.
      expect(fallasSinFranja(m)).toContain("claro · texto de la franja sobre la tarjeta: 1.00:1 < 4.5");
    });
  });
});
