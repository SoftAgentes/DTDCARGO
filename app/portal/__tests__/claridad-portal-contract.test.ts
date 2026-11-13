import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato de SDD-0603 · tramo 3 (portal del cliente, BD-037).
 *
 * Lee las reglas reales de `app/portal/claridad.css`, saca el token de color que
 * usa cada una y lo mide contra la superficie donde cae, en claro (`:root`) y en
 * oscuro (`[data-portal-theme="dark"]`) de `app/globals.css`. Si alguien cambia el
 * token de una regla o el valor de un token y el control vuelve a quedar pálido,
 * rompe aquí. Cada comprobación es una función pura sobre el texto del CSS, para
 * poder correrla también contra mutantes y probar que de verdad mira algo.
 */

const raiz = process.cwd();
const globalsCss = readFileSync(join(raiz, "app/globals.css"), "utf8");
const claridadCss = readFileSync(join(raiz, "app/portal/claridad.css"), "utf8");
const layoutTsx = readFileSync(join(raiz, "app/portal/layout.tsx"), "utf8");
const hubTabsTsx = readFileSync(join(raiz, "app/portal/_components/PortalHubTabs.tsx"), "utf8");
const formFieldTsx = readFileSync(join(raiz, "app/portal/_components/PortalFormField.tsx"), "utf8");

/** Cuerpo del primer bloque que abre exactamente con `cabecera {`. */
function bloque(css: string, cabecera: string): string {
  const i = css.indexOf(`\n${cabecera} {`);
  if (i < 0) throw new Error(`no hay bloque ${cabecera}`);
  return css.slice(i, css.indexOf("}", i));
}

const claro = bloque(globalsCss, ":root");
const oscuro = bloque(globalsCss, '[data-portal-theme="dark"]');
const TEMAS = { claro, oscuro } as const;
type Tema = keyof typeof TEMAS;

function token(tema: Tema, nombre: string): string {
  const re = new RegExp(`${nombre}\\s*:\\s*([^;]+);`);
  const m = TEMAS[tema].match(re) ?? claro.match(re); // sin override oscuro → hereda el claro
  if (!m) throw new Error(`no hay ${nombre}`);
  const v = m[1].trim();
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref ? token(tema, ref[1]) : v;
}

function aRgb(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`no es hex de 6: ${hex}`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luz(hex: string): number {
  const [r, g, b] = aRgb(hex).map((v) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(tema: Tema, a: string, b: string): number {
  const [l1, l2] = [luz(token(tema, a)), luz(token(tema, b))];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Cuerpo de la regla con ese selector exacto (primera aparición). */
function regla(css: string, selector: string): string {
  const i = css.indexOf(`\n${selector} {`);
  if (i < 0) throw new Error(`no hay regla ${selector}`);
  return css.slice(i, css.indexOf("}", i));
}

/** Cuerpo de la regla que empieza en la primera aparición de `inicio` (selectores agrupados). */
function desde(css: string, inicio: string): string {
  const i = css.indexOf(inicio);
  if (i < 0) throw new Error(`no hay regla que empiece por ${inicio}`);
  return css.slice(i, css.indexOf("}", i));
}

/** Token de color de una propiedad: `border: 1.5px solid var(--x)` → `--x`. */
function tokenDe(cuerpo: string, propiedad: string): string {
  const m = cuerpo.match(new RegExp(`\\n\\s*${propiedad}\\s*:[^;]*var\\((--[\\w-]+)\\)[^;]*;`));
  if (!m) throw new Error(`la regla no declara ${propiedad} con un token`);
  return m[1];
}

type Medida = { que: string; frente: string; fondo: string; minimo: number };

/** Lo que mide el contrato, leído de las reglas reales. */
function medidas(css: string): Medida[] {
  const ghost = regla(css, ".portal-sys .btn-ghost");
  const campo = desde(css, ".portal-sys main :is(");
  const subtabReposo = regla(css, ".portal-sys .portal-subtab");
  const subtabActiva = desde(css, '.portal-sys .portal-subtab[aria-current="page"],');
  const filtroOff = regla(css, ".portal-sys main button[aria-pressed]:not(.btn)");
  const filtroOn = desde(css, '.portal-sys main button[aria-pressed="true"]:not(.btn),');
  const estado = desde(css, ".portal-sys .badge-status,");
  return [
    { que: "contorno del secundario contra la tarjeta", frente: tokenDe(ghost, "border"), fondo: "--color-white", minimo: 3 },
    { que: "contorno del secundario contra el papel", frente: tokenDe(ghost, "border"), fondo: "--color-paper", minimo: 3 },
    { que: "texto del secundario sobre su superficie", frente: tokenDe(ghost, "color"), fondo: tokenDe(ghost, "background"), minimo: 4.5 },
    { que: "contorno de campo contra la tarjeta", frente: tokenDe(campo, "border"), fondo: "--color-white", minimo: 3 },
    { que: "contorno de campo contra el papel", frente: tokenDe(campo, "border"), fondo: "--color-paper", minimo: 3 },
    { que: "contorno de campo contra su relleno gris", frente: tokenDe(campo, "border"), fondo: "--color-grey-100", minimo: 3 },
    { que: "texto de la sub-pestaña activa", frente: tokenDe(subtabActiva, "color"), fondo: tokenDe(subtabActiva, "background"), minimo: 4.5 },
    { que: "relleno de la sub-pestaña activa contra su carril", frente: tokenDe(subtabActiva, "background"), fondo: "--color-paper", minimo: 3 },
    { que: "texto de la sub-pestaña en reposo", frente: tokenDe(subtabReposo, "color"), fondo: "--color-paper", minimo: 4.5 },
    { que: "texto del filtro elegido", frente: tokenDe(filtroOn, "color"), fondo: tokenDe(filtroOn, "background"), minimo: 4.5 },
    { que: "relleno del filtro elegido contra su carril", frente: tokenDe(filtroOn, "background"), fondo: "--color-paper", minimo: 3 },
    { que: "texto del filtro en reposo", frente: tokenDe(filtroOff, "color"), fondo: "--color-paper", minimo: 4.5 },
    { que: "estado como texto sobre la tarjeta", frente: "--color-ink", fondo: "--color-white", minimo: 4.5 },
    // El estado no trae fondo propio: se lee sobre lo que tenga debajo.
    ...(estado.includes("background: transparent") ? [] : [{ que: "estado sin fondo", frente: "--color-ink", fondo: "--color-ink", minimo: 99 }]),
  ];
}

function fallas(css: string): string[] {
  const out: string[] = [];
  for (const tema of Object.keys(TEMAS) as Tema[]) {
    for (const m of medidas(css)) {
      const c = contraste(tema, m.frente, m.fondo);
      if (c < m.minimo) out.push(`${tema} · ${m.que}: ${c.toFixed(2)}:1 < ${m.minimo}`);
    }
  }
  return out;
}

/** Todos los selectores de la hoja empiezan por `.portal-sys`: la web pública no cambia. */
function selectoresFueraDelPortal(css: string): string[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const cabeceras = [...sinComentarios.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim());
  return cabeceras
    .flatMap((c) => c.split(/,(?![^(]*\))/).map((s) => s.trim()))
    .filter((s) => s && !s.startsWith(".portal-sys"));
}

function coloresLiterales(css: string): string[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return sinComentarios.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? [];
}

describe("claridad de controles en el portal · SDD-0603 tramo 3", () => {
  it("mide al menos 14 pares en cada tema (piso: la suite no puede vaciarse)", () => {
    expect(medidas(claridadCss).length).toBeGreaterThanOrEqual(14);
  });

  describe.each(Object.keys(TEMAS) as Tema[])("tema %s", (tema) => {
    it.each(medidas(claridadCss).map((m) => [m.que, m] as const))("%s", (_que, m) => {
      expect(contraste(tema, m.frente, m.fondo)).toBeGreaterThanOrEqual(m.minimo);
    });

    it("el contorno del campo de archivo mide al menos 3:1 contra la tarjeta", () => {
      const m = formFieldTsx.match(/:\s*(?:\/\/[^\n]*\n\s*)?"var\((--color-grey-\d+)\)",\s*\n\s*background/);
      expect(m, "FileField declara su contorno en reposo con un token").not.toBeNull();
      expect(contraste(tema, m![1], "--color-white")).toBeGreaterThanOrEqual(3);
      expect(contraste(tema, "--color-status-success", "--color-paper")).toBeGreaterThanOrEqual(3);
    });
  });

  it("no hay fallas de contraste en la hoja real", () => {
    expect(fallas(claridadCss)).toEqual([]);
  });

  it("todo selector vive bajo .portal-sys", () => {
    expect(selectoresFueraDelPortal(claridadCss)).toEqual([]);
  });

  it("sin colores literales ni !important: solo tokens que ya existen", () => {
    expect(coloresLiterales(claridadCss)).toEqual([]);
    expect(claridadCss).not.toMatch(/!important/);
    expect(claridadCss).not.toMatch(/\[style/);
    const usados = new Set([...claridadCss.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
    const propios = new Set([...claridadCss.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
    for (const t of usados) {
      if (propios.has(t)) continue;
      expect(globalsCss, `${t} existe en globals.css`).toMatch(new RegExp(`${t}\\s*:`));
    }
  });

  it("el secundario reposa en sombra de nivel 1, sube al pasar y baja al oprimir", () => {
    expect(regla(claridadCss, ".portal-sys .btn-ghost")).toContain("box-shadow: var(--portal-ctl-shadow-xs)");
    expect(regla(claridadCss, ".portal-sys .btn-ghost:hover")).toContain("box-shadow: var(--portal-ctl-shadow-md)");
    expect(regla(claridadCss, ".portal-sys .btn-ghost:active")).toContain("box-shadow: var(--portal-ctl-shadow-xs)");
    expect(regla(claridadCss, ".portal-sys .btn-ghost")).toMatch(/font-weight: [7-9]00/);
  });

  it("el estado es texto con icono: sin fondo, borde, relleno ni píldora", () => {
    const r = desde(claridadCss, ".portal-sys .badge-status,");
    expect(r).toContain("background: transparent");
    expect(r).toContain("border: 0");
    expect(r).toContain("padding: 0");
    expect(r).toContain("border-radius: 0");
  });

  it("el aviso con cajón queda como franja plana: sin contorno ni sombra", () => {
    const r = regla(claridadCss, '.portal-sys main :is([role="alert"], [role="status"])[class*="border"]');
    expect(r).toContain("border: 0");
    expect(r).toContain("box-shadow: none");
  });

  it("los enlaces de texto van subrayados", () => {
    expect(claridadCss).toMatch(/\.portal-sys main a\[href\][^{]*\{[^}]*text-decoration-line: underline/);
  });

  it("nada que se oprime baja de 32 px y el foco de la sub-pestaña se ve", () => {
    const alto = regla(claridadCss, ".portal-sys .portal-subtab").match(/min-height: (\d+)px/);
    expect(Number(alto?.[1])).toBeGreaterThanOrEqual(32);
    expect(regla(claridadCss, ".portal-sys .portal-subtab:focus-visible")).toMatch(/outline: 2px solid var\(--color-ink\)/);
  });

  it("las sub-pestañas usan la forma compartida y anuncian la activa sin depender del color", () => {
    expect(hubTabsTsx).toContain('className="portal-subtabs');
    expect(hubTabsTsx).toContain('className="portal-subtab"');
    expect(hubTabsTsx).toContain('aria-current={active ? "page" : undefined}');
    expect(hubTabsTsx).not.toMatch(/border-wine|text-grey-500/);
  });

  it("el foco del campo de archivo se ve: el input va antes de su label (peer)", () => {
    const input = formFieldTsx.indexOf('className="peer sr-only"');
    const label = formFieldTsx.indexOf("peer-focus-visible:outline", input);
    expect(input).toBeGreaterThan(-1);
    expect(label).toBeGreaterThan(input);
  });

  it("el layout del portal importa la hoja", () => {
    expect(layoutTsx).toMatch(/import "\.\/claridad\.css";/);
  });

  describe("mutantes: el contrato detecta cuando un control vuelve a quedar pálido", () => {
    it("M1 · contorno del secundario en --color-grey-300", () => {
      const m = claridadCss.replace("border: 1.5px solid var(--color-ink);", "border: 1.5px solid var(--color-grey-300);");
      expect(m).not.toBe(claridadCss);
      expect(fallas(m).some((f) => f.includes("contorno del secundario"))).toBe(true);
    });

    it("M2 · contorno de campo en --color-grey-200", () => {
      const m = claridadCss.replace("border: 1px solid var(--color-grey-500);", "border: 1px solid var(--color-grey-200);");
      expect(m).not.toBe(claridadCss);
      expect(fallas(m).some((f) => f.includes("contorno de campo"))).toBe(true);
    });

    it("M3 · filtro elegido con texto vino sobre tinta", () => {
      const i = claridadCss.indexOf('.portal-sys main button[aria-pressed="true"]:not(.btn),');
      const m = claridadCss.slice(0, i) + claridadCss.slice(i).replace("color: var(--color-white);", "color: var(--color-wine);");
      expect(fallas(m).some((f) => f.includes("texto del filtro elegido"))).toBe(true);
    });

    it("M4 · el estado recupera su píldora", () => {
      const m = claridadCss.replace(/(\.portal-sys \.badge-status,[\s\S]*?)background: transparent;/, "$1background: var(--color-grey-100);");
      expect(m).not.toBe(claridadCss);
      expect(fallas(m).some((f) => f.includes("estado sin fondo"))).toBe(true);
    });

    it("M5 · un selector fuera de .portal-sys o un color literal", () => {
      expect(selectoresFueraDelPortal(`${claridadCss}\n.btn-ghost { color: red; }`)).toEqual([".btn-ghost"]);
      expect(coloresLiterales(`${claridadCss}\n.portal-sys .x { color: #ff0000; }`)).toEqual(["#ff0000"]);
    });
  });
});
