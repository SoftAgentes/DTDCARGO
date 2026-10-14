/**
 * SDD-0519 · Ficha «Pre-alerta de compra» del hub /servicios: no promete el
 * aviso de llegada a bodega mientras el seguimiento está en construcción.
 *
 * La bodega de China todavía registra en Excel, así que el aviso «tu mercancía
 * llegó a bodega» no sale (SDD-0516). Con `TRACKING_EN_CONSTRUCCION` prendido,
 * la ruta, el actor 3 y el paso 5 de la ficha dicen lo que sí pasa hoy; apagado,
 * vuelve el texto de siempre, palabra por palabra.
 *
 * Se mide sobre la ficha renderizada (`HUB_FICHAS`), no sobre el fuente: lo que
 * importa es lo que lee el visitante.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { HUB_FICHAS } from "./hub-fichas";

const h = vi.hoisted(() => ({ prendido: true }));

vi.mock("@/lib/portal/tracking-en-construccion", () => ({
  get TRACKING_EN_CONSTRUCCION() {
    return h.prendido;
  },
}));

afterEach(cleanup);

const ficha = (slug: string) => {
  const f = HUB_FICHAS.find((x) => x.slug === slug);
  if (!f) throw new Error(`no existe la ficha «${slug}» en HUB_FICHAS`);
  return f.node;
};

const limpio = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Los tres lugares de la ficha de pre-alerta que hablan de la recepción en Yiwu. */
function preAlerta() {
  const { container } = render(<>{ficha("pre-alerta")}</>);
  const paradas = [...container.querySelectorAll(".f2route .stop")];
  const actores = [...container.querySelectorAll(".f2actors .actor")];
  const pasos = [...container.querySelectorAll(".f2steps li")];
  // Si cambia la forma de la ficha, que falle aquí y no en una aserción vaga.
  expect(paradas).toHaveLength(3);
  expect(actores).toHaveLength(3);
  expect(pasos).toHaveLength(5);
  return {
    todo: limpio(container.textContent),
    parada: limpio(paradas[2].querySelector(".sb")?.textContent),
    actor: limpio(actores[2].querySelector(".does")?.textContent),
    paso: limpio(pasos[4].textContent),
  };
}

const NEUTRO = {
  parada: "recibe tu carga",
  actor: "Recibe tu mercancía cuando llega y la identifica por la etiqueta.",
  paso: "Cuando tu mercancía llega a Yiwu, el operario la recibe y la identifica por la etiqueta.",
};

const DE_SIEMPRE = {
  parada: "escanea y te avisa",
  actor: "Recibe escaneando la etiqueta cuando llega tu mercancía y te avisamos al instante.",
  paso: "Cuando tu mercancía llega a Yiwu, el operario la recibe escaneando la etiqueta y te avisamos.",
};

describe("SDD-0519 · ficha de pre-alerta con el seguimiento en construcción", () => {
  beforeEach(() => {
    h.prendido = true;
  });

  it("prendido: la ruta, el actor 3 y el paso 5 dicen el texto neutro", () => {
    const f = preAlerta();
    expect(f.parada).toBe(NEUTRO.parada);
    expect(f.actor).toBe(NEUTRO.actor);
    expect(f.paso).toBe(NEUTRO.paso);
  });

  it("prendido: en ninguna parte de la ficha se promete el aviso", () => {
    const { todo } = preAlerta();
    expect(todo).not.toMatch(/te avis/i);
    expect(todo).not.toMatch(/escane/i);
    expect(todo).not.toMatch(/al instante/i);
  });

  it("apagado: vuelven los tres textos de siempre y ningún texto neutro", () => {
    h.prendido = false;
    const f = preAlerta();
    expect(f.parada).toBe(DE_SIEMPRE.parada);
    expect(f.actor).toBe(DE_SIEMPRE.actor);
    expect(f.paso).toBe(DE_SIEMPRE.paso);
    expect(f.todo).not.toContain(NEUTRO.parada);
    expect(f.todo).not.toContain(NEUTRO.actor);
    expect(f.todo).not.toContain(NEUTRO.paso);
  });

  it("el resto de la ficha no cambia con el interruptor", () => {
    const sinLosTres = () => {
      const f = preAlerta();
      return [f.parada, f.actor, f.paso].reduce((t, x) => t.replace(x, "·"), f.todo);
    };
    const prendida = sinLosTres();
    cleanup();
    h.prendido = false;
    expect(sinLosTres()).toBe(prendida);
  });

  it("las demás fichas del hub no cambian con el interruptor", () => {
    const html = (prendido: boolean) => {
      h.prendido = prendido;
      return HUB_FICHAS.filter((f) => f.slug !== "pre-alerta").map(({ slug, node }) => {
        cleanup();
        const { container } = render(<>{node}</>);
        return `${slug}\n${container.innerHTML}`;
      });
    };
    const prendidas = html(true);
    expect(prendidas).toHaveLength(HUB_FICHAS.length - 1);
    expect(html(false)).toEqual(prendidas);
  });
});

/**
 * La ficha vive en `components/`, dentro de la frontera pública de ESLint, y es
 * el primer archivo de ese lado que importa algo de `lib/portal`. ESLint sólo
 * mira imports directos: si este módulo importara la base o el Portal, la página
 * pública se lo llevaría sin que el lint lo vea. Por eso no puede importar nada.
 */
describe("SDD-0519 · el interruptor no arrastra código a la página pública", () => {
  it("lib/portal/tracking-en-construccion.ts no tiene imports ni reexportaciones", () => {
    const ruta = join(process.cwd(), "lib/portal/tracking-en-construccion.ts");
    const src = ts.createSourceFile(ruta, readFileSync(ruta, "utf8"), ts.ScriptTarget.Latest, true);
    const dependencias: string[] = [];
    const visitar = (n: ts.Node) => {
      if (ts.isImportDeclaration(n) || ts.isImportEqualsDeclaration(n)) {
        dependencias.push(n.getText(src));
      } else if (ts.isExportDeclaration(n) && n.moduleSpecifier) {
        dependencias.push(n.getText(src));
      } else if (
        ts.isCallExpression(n) &&
        (n.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(n.expression) && n.expression.text === "require"))
      ) {
        dependencias.push(n.getText(src));
      }
      ts.forEachChild(n, visitar);
    };
    visitar(src);
    expect(dependencias).toEqual([]);
    // Y que de verdad haya leído el módulo de la constante.
    expect(src.text).toContain("export const TRACKING_EN_CONSTRUCCION");
  });
});
