/**
 * Contrato: las cuatro páginas del hub del portal montan sus tabs.
 *
 * `<EnviosHubTabs />` vivía **sólo dentro de `FallbackList`** — o sea, dentro
 * del código muerto que podó SDD-0179. Al podarlo, los tabs quedaron en tres
 * de las cuatro páginas y en `/portal/envios` no: el cliente entraba a "Mis
 * envíos" y perdía la navegación hacia Compras, Documentos y Proveedores.
 * Estuvo así desde el 20-jun sin que nada se pusiera rojo.
 *
 * Nadie lo vio porque no hay test que mire el hub COMO CONJUNTO: cada página
 * se prueba sola, y sola cada una está bien. Este contrato mira la propiedad
 * que sí importa — que las cuatro se comporten igual.
 *
 * La lista de rutas sale de `PortalHubTabs` (su fuente), no de una copia acá:
 * si mañana se agrega una quinta pestaña, este test la exige sin que nadie
 * tenga que acordarse de venir a tocarlo.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
const TABS = join(RAIZ, "app", "portal", "_components", "PortalHubTabs.tsx");
const PORTAL_APP = join(RAIZ, "app", "portal", "(app)");

/** Quita comentarios: un docblock que nombre el componente no lo monta. */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Hub del portal · las 4 páginas montan sus tabs (SDD-0179 §5)", () => {
  const fuente = readFileSync(TABS, "utf8");

  // Las rutas que cubre el hub. Son MÁS que los `href`: la pestaña "Compras"
  // apunta a `/portal/proveedores` pero su `match` also reconoce
  // `/portal/compras`, así que esa página también forma parte del hub y
  // también tiene que montar los tabs. Mirar sólo los `href` dejaría a
  // `/portal/compras` fuera de la auditoría.
  const rutas = [
    ...new Set([
      ...[...fuente.matchAll(/href:\s*"(\/portal\/[a-z-]+)"/g)].map((m) => m[1]),
      ...[...fuente.matchAll(/startsWith\("(\/portal\/[a-z-]+)"\)/g)].map((m) => m[1]),
    ]),
  ];

  it("el componente declara sus pestañas (sanity del parser)", () => {
    expect(rutas.length).toBeGreaterThanOrEqual(4);
    expect(rutas).toContain("/portal/envios");
    expect(rutas).toContain("/portal/compras");
  });

  for (const ruta of rutas) {
    const slug = ruta.replace("/portal/", "");
    it(`${ruta} monta <EnviosHubTabs />`, () => {
      const page = join(PORTAL_APP, slug, "page.tsx");
      if (!existsSync(page)) {
        throw new Error(
          `${ruta} es una pestaña del hub pero no existe ${page}. O sobra la ` +
            `pestaña, o falta la página.`,
        );
      }
      const src = sinComentarios(readFileSync(page, "utf8"));
      if (!/<EnviosHubTabs\s*\/>/.test(src)) {
        throw new Error(
          `${ruta} NO monta <EnviosHubTabs />. El cliente entra y pierde la ` +
            `navegación hacia las otras pestañas del hub. Agregalo arriba del ` +
            `contenido, como en compras/documentos/proveedores.`,
        );
      }
    });
  }
});
