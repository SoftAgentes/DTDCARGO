// @vitest-environment node
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Resolver desde los consumidores reales: no añadir qs como dependencia directa
// ni probar una copia distinta de la que carga el SDK del MCP de desarrollo.
const projectRequire = createRequire(new URL("../../package.json", import.meta.url));
const agentRequire = createRequire(projectRequire.resolve("agentation-mcp"));
const sdkRequire = createRequire(agentRequire.resolve("@modelcontextprotocol/sdk/server/index.js"));
const expressRequire = createRequire(sdkRequire.resolve("express"));
const bodyRequire = createRequire(expressRequire.resolve("body-parser"));
const consumers = [
  ["express", expressRequire("qs")],
  ["body-parser", bodyRequire("qs")],
];

describe.each(consumers)("qs del tooling vía %s", (_name, qs) => {
  const limits = { comma: true, arrayLimit: 3, throwOnLimitExceeded: true };

  it("GHSA-x5fp-wj9c-mxmx: el sufijo [] no evade el límite de listas", () => {
    expect(() => qs.parse("colors[]=red,blue,green,white", limits)).toThrow(RangeError);
  });

  it("conserva el rechazo del límite con una clave plana", () => {
    expect(() => qs.parse("colors=red,blue,green,white", limits)).toThrow(RangeError);
  });

  it("conserva las listas válidas sin cambiar su estructura", () => {
    expect(qs.parse("colors[]=red,blue", limits)).toEqual({ colors: [["red", "blue"]] });
  });

  it.each([{ plainObjects: true }, { allowPrototypes: true }])(
    "GHSA-4mjr-xmp4-gh2g: parse/stringify no invoca isBuffer ajeno (%j)",
    (options) => {
      const parsed = qs.parse("item[constructor][isBuffer]=not-a-function", options);
      expect(parsed.item.constructor.isBuffer).toBe("not-a-function");
      expect(() => qs.stringify(parsed)).not.toThrow();
      expect(qs.stringify(parsed)).toContain("not-a-function");
    },
  );

  it("conserva el round-trip de filtros, listas y caracteres codificados", () => {
    const input = { filter: { color: "azul claro" }, tags: ["a&b", "c+d"] };
    expect(qs.parse(qs.stringify(input))).toEqual(input);
  });

  it("sigue serializando buffers legítimos", () => {
    expect(qs.stringify({ value: Buffer.from("sample") })).toBe("value=sample");
  });
});

it("el Express real del SDK conserva query y formularios extendidos", async () => {
  const express = sdkRequire("express");
  const app = express();
  app.set("query parser", "extended");
  app.use(express.urlencoded({ extended: true }));
  app.post("/echo", (req, res) => res.json({ query: req.query, body: req.body }));

  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/echo?filter[color]=blue`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "tags[]=first&tags[]=second&note=a%2Bb",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      query: { filter: { color: "blue" } },
      body: { tags: ["first", "second"], note: "a+b" },
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
