// @vitest-environment node
// SDD-0642 · Prueba focal del parseo y las reglas de scripts/auditoria-geo-aeo.mjs. Sin red.
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analizarPagina,
  USER_AGENT,
  main,
  pedir,
  nombreJsonSeguro,
  analizarSitio,
  candidatosLocales,
  leerArgumentos,
  contarPalabras,
  extraerJsonLd,
  parsearSitemap,
  resumir,
} from "../auditoria-geo-aeo.mjs";

const palabras = (n) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");

/** HTML de ejemplo que cumple todo; cada prueba rompe una sola pieza. */
function html({
  title = "Importar de China a Venezuela | DTD Cargo",
  desc = '<meta name="description" content="Cómo importar de China.">',
  canonical = '<link rel="canonical" href="https://dtdcargo.com/tarifas"/>',
  h1 = "<h1>Tarifas</h1>",
  ld = '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"DTD Cargo"},{"@type":"WebPage"}]}</script>',
  robots = "",
  respuesta = '<section id="respuesta-rapida"><p>Respuesta.</p></section>',
  cuerpo = palabras(150),
  enlaces = "",
} = {}) {
  return `<!doctype html><html><head><title>${title}</title>${desc}${canonical}${robots}${ld}</head><body>${h1}${respuesta}<p>${cuerpo}</p>${enlaces}</body></html>`;
}

const pagina = (h, url = "https://dtdcargo.com/tarifas", extra = {}) => analizarPagina({ url, status: 200, html: h, ...extra });
const estado = (p, id) => p.checks[id].estado;
const canon = (ruta) => `<link rel="canonical" href="https://dtdcargo.com${ruta}">`;

describe("parseo de sitemap", () => {
  it("lee loc y lastmod, y reescribe el origen con una base", () => {
    const xml = `<urlset><url><loc>https://dtdcargo.com/</loc></url><url><loc>https://dtdcargo.com/noticias/a?x=1</loc><lastmod>2026-11-01</lastmod></url></urlset>`;
    expect(parsearSitemap(xml).map((u) => u.url)).toEqual(["https://dtdcargo.com/", "https://dtdcargo.com/noticias/a?x=1"]);
    expect(parsearSitemap(xml)[1].lastmod).toBe("2026-11-01");
    expect(parsearSitemap(xml, "https://staging.test").map((u) => u.url)).toEqual([
      "https://staging.test/",
      "https://staging.test/noticias/a?x=1",
    ]);
  });
});

describe("reglas por página", () => {
  it("una página sana pasa todo lo medible y deja lo humano como MANUAL", () => {
    const p = pagina(html());
    for (const id of ["http", "titulo", "description", "canonical", "h1", "jsonld", "respuesta-rapida", "palabras", "noindex"]) {
      expect(estado(p, id), id).toBe("PASA");
    }
    expect(estado(p, "respuesta-calidad")).toBe("MANUAL");
    expect(estado(p, "fuentes")).toBe("MANUAL");
  });

  it("título: 60 caracteres pasa, 61 falla; cuenta entidades ya decodificadas", () => {
    expect(estado(pagina(html({ title: "a".repeat(60) })), "titulo")).toBe("PASA");
    const largo = pagina(html({ title: "a".repeat(61) }));
    expect(estado(largo, "titulo")).toBe("FALLA");
    expect(largo.checks.titulo.detalle).toContain("61");
    // "Tarifas & costos " = 17 caracteres reales + 43 = 60
    expect(estado(pagina(html({ title: "Tarifas &amp; costos " + "a".repeat(43) })), "titulo")).toBe("PASA");
  });

  it("description, canonical y H1", () => {
    expect(estado(pagina(html({ desc: "" })), "description")).toBe("FALLA");
    expect(estado(pagina(html({ desc: '<meta name="description" content="  ">' })), "description")).toBe("FALLA");
    expect(estado(pagina(html({ canonical: "" })), "canonical")).toBe("FALLA");
    expect(estado(pagina(html({ canonical: canon("/otra") })), "canonical")).toBe("FALLA");
    expect(estado(pagina(html({ h1: "" })), "h1")).toBe("FALLA");
    expect(estado(pagina(html({ h1: "<h1>A</h1><h1>B</h1>" })), "h1")).toBe("FALLA");
  });

  it("JSON-LD: ausente, inválido y tipos esperados", () => {
    expect(estado(pagina(html({ ld: "" })), "jsonld")).toBe("FALLA");
    expect(estado(pagina(html({ ld: '<script type="application/ld+json">{no es json</script>' })), "jsonld")).toBe("FALLA");
    const faqUrl = "https://dtdcargo.com/faq";
    expect(estado(pagina(html({ canonical: canon("/faq") }), faqUrl), "jsonld-tipos")).toBe("FALLA");
    const con = pagina(
      html({ canonical: canon("/faq"), ld: '<script type="application/ld+json">{"@graph":[{"@type":"FAQPage"}]}</script>' }),
      faqUrl,
    );
    expect(estado(con, "jsonld-tipos")).toBe("PASA");
  });

  it("dateModified solo se exige en artículos", () => {
    const url = "https://dtdcargo.com/noticias/x";
    const conFecha = pagina(
      html({ canonical: canon("/noticias/x"), ld: '<script type="application/ld+json">{"@type":"BlogPosting","dateModified":"2026-11-10T10:00:00Z"}</script>' }),
      url,
    );
    const sinFecha = pagina(
      html({ canonical: canon("/noticias/x"), ld: '<script type="application/ld+json">{"@type":"BlogPosting","datePublished":"2026-11-10"}</script>' }),
      url,
    );
    expect(estado(conFecha, "fecha-modificacion")).toBe("PASA");
    expect(estado(sinFecha, "fecha-modificacion")).toBe("FALLA");
    expect(estado(pagina(html()), "fecha-modificacion")).toBe("N/A");
  });

  it("#respuesta-rapida: falla donde se espera y es N/A donde no", () => {
    expect(estado(pagina(html({ respuesta: "" })), "respuesta-rapida")).toBe("FALLA");
    const contacto = pagina(html({ respuesta: "", canonical: canon("/contacto") }), "https://dtdcargo.com/contacto");
    expect(estado(contacto, "respuesta-rapida")).toBe("N/A");
    expect(estado(contacto, "respuesta-calidad")).toBe("N/A");
  });

  it("palabras: cuenta solo texto, no scripts ni estilos", () => {
    expect(contarPalabras("<p>uno dos</p><script>tres cuatro cinco</script><style>x y z</style>")).toBe(2);
    expect(estado(pagina(html({ cuerpo: palabras(20) })), "palabras")).toBe("FALLA");
  });

  it("noindex: meta o cabecera en una URL del sitemap es falla", () => {
    expect(estado(pagina(html({ robots: '<meta name="robots" content="noindex,follow">' })), "noindex")).toBe("FALLA");
    expect(estado(pagina(html(), undefined, { headers: { "x-robots-tag": "noindex" } }), "noindex")).toBe("FALLA");
    expect(estado(pagina(html({ robots: '<meta name="robots" content="index,follow">' })), "noindex")).toBe("PASA");
  });

  it("http distinto de 200 falla", () => {
    expect(estado(analizarPagina({ url: "https://dtdcargo.com/x", status: 404, html: "" }), "http")).toBe("FALLA");
  });

  it("las excepciones explícitas salen como N/A con su motivo", () => {
    const p = analizarPagina({ url: "https://dtdcargo.com/enlaces", status: 200, html: html({ cuerpo: "poco", ld: "" }) });
    expect(estado(p, "palabras")).toBe("N/A");
    expect(p.checks.palabras.detalle).toContain("excepción");
  });

  it("reproduce los hallazgos conocidos: títulos de 76 y 63 caracteres", () => {
    const fcl = pagina(html({ title: "x".repeat(76), canonical: canon("/fcl") }), "https://dtdcargo.com/fcl");
    const ppp = pagina(html({ title: "y".repeat(63), canonical: canon("/servicios/puerta-a-puerta") }), "https://dtdcargo.com/servicios/puerta-a-puerta");
    expect(estado(fcl, "titulo")).toBe("FALLA");
    expect(fcl.checks.titulo.detalle).toContain("76");
    expect(estado(ppp, "titulo")).toBe("FALLA");
    expect(ppp.checks.titulo.detalle).toContain("63");
  });
});

describe("análisis de sitio", () => {
  const mk = (ruta, enlaces, titulo = `Título ${ruta}`) =>
    pagina(html({ title: titulo, h1: `<h1>H1 de ${ruta}</h1>`, canonical: canon(ruta), enlaces }), `https://dtdcargo.com${ruta}`);

  it("detecta huérfanas, cuenta entrantes y no cuenta autoenlaces", () => {
    const home = mk("/", '<a href="/a">a</a><a href="https://dtdcargo.com/b/">b</a><a href="https://otro.com/c">c</a>');
    const a = mk("/a", '<a href="/a">yo</a><a href="/#x">home</a>');
    const b = mk("/b", "");
    const c = mk("/c", '<a href="/c">yo</a>');
    analizarSitio([home, a, b, c]);
    expect(estado(a, "entrantes")).toBe("PASA");
    expect(estado(b, "entrantes")).toBe("PASA"); // barra final normalizada
    expect(estado(c, "entrantes")).toBe("FALLA"); // solo se enlaza a sí misma
    expect(c.entrantes).toBe(0);
  });

  it("marca títulos y H1 repetidos entre páginas (canibalización)", () => {
    const x = mk("/x", "", "Mismo título");
    const y = mk("/y", "", "mismo   TÍTULO");
    const z = mk("/z", "", "Otro");
    analizarSitio([x, y, z]);
    expect(estado(x, "titulo-repetido")).toBe("FALLA");
    expect(x.checks["titulo-repetido"].detalle).toContain("/y");
    expect(estado(z, "titulo-repetido")).toBe("PASA");
    const h = mk("/h", "", "T1");
    const i = mk("/i", "", "T2");
    i.h1 = h.h1;
    analizarSitio([h, i]);
    expect(estado(i, "h1-repetido")).toBe("FALLA");
  });

  it("resumir cuenta comprobaciones reales y no devuelve ningún puntaje", () => {
    const p = pagina(html({ title: "a".repeat(80) }));
    analizarSitio([p]);
    const r = resumir([p]);
    expect(r.comprobaciones.FALLA).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(r)).not.toMatch(/puntaje|score/i);
    expect(r.paginasPorEstado.FALLA).toBe(1);
  });
});

describe("JSON-LD en @graph", () => {
  it("junta tipos de nodos anidados y arreglos", () => {
    const r = extraerJsonLd(
      '<script type="application/ld+json">{"@graph":[{"@type":["Organization","LocalBusiness"]},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem"}]}]}</script>',
    );
    expect(r.tipos).toEqual(["Organization", "LocalBusiness", "BreadcrumbList", "ListItem"]);
  });
});

describe("modo prudente con el sitio en vivo", () => {
  it("user-agent genérico, sin datos de Sam ni del repositorio", () => {
    expect(USER_AGENT).toBe("auditoria-geo-aeo/1");
  });

  it("pausa por defecto y --html-dir se leen de los argumentos", () => {
    expect(leerArgumentos([]).pausa).toBeGreaterThan(0);
    expect(leerArgumentos(["--pausa", "250", "--html-dir", "./html"])).toMatchObject({ pausa: 250, htmlDir: "./html" });
    expect(() => leerArgumentos(["--pausa", "-1"])).toThrow();
  });

  it("mapea rutas a archivos de una carpeta local", () => {
    expect(candidatosLocales("/")).toEqual(["index.html"]);
    expect(candidatosLocales("/fcl")).toEqual(["fcl.html", "fcl/index.html"]);
    expect(candidatosLocales("/importar-de-china/valencia/")).toEqual(["importar-de-china/valencia.html", "importar-de-china/valencia/index.html"]);
  });
});

/* ---- Red simulada: salida, dominio propio, tiempo, orden y carpetas (sin red real) ---- */

const resp = (status, cuerpo = "", headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  text: async () => cuerpo,
});
const sitemapDe = (...urls) => `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;
const tmp = () => mkdtempSync(join(tmpdir(), "geo-aeo-"));
const correr = (argv, fetchFn) => {
  const log = [];
  return main(argv, { fetchFn, log: (l) => log.push(l), timeoutMs: 50 }).then((codigo) => ({ codigo, log: log.join("\n") }));
};
const borrar = (nombre) => {
  try {
    if (existsSync(nombre)) rmSync(nombre);
  } catch {
    /* limpieza best-effort */
  }
};
const sitemapEn = (...urls) => {
  const sm = join(tmp(), "sitemap.xml");
  writeFileSync(sm, sitemapDe(...urls));
  return sm;
};

describe("código de salida", () => {
  it("sale 1 por defecto si hay una FALLA y 0 solo con --no-estricto", async () => {
    const sm = sitemapEn("https://dtdcargo.com/falla");
    const falla = async () => resp(404, "");
    expect((await correr(["--sitemap", sm, "--pausa", "0"], falla)).codigo).toBe(1);
    expect((await correr(["--sitemap", sm, "--pausa", "0", "--estricto"], falla)).codigo).toBe(1);
    expect((await correr(["--sitemap", sm, "--pausa", "0", "--no-estricto"], falla)).codigo).toBe(0);
  });

  it("la ayuda sale 0", async () => {
    expect((await correr(["--help"], async () => resp(200))).codigo).toBe(0);
  });
});

describe("solo el dominio propio", () => {
  it("una URL del sitemap de otro origen es FALLA y no se pide", async () => {
    const sm = sitemapEn("https://dtdcargo.com/a", "https://otro.example/b");
    const pedidos = [];
    const f = async (u) => (pedidos.push(u), resp(200, html({ canonical: canon("/a") })));
    const r = await correr(["--sitemap", sm, "--pausa", "0"], f);
    expect(pedidos).toEqual(["https://dtdcargo.com/a"]);
    expect(r.log).toContain("otro origen");
    expect(r.codigo).toBe(1);
  });

  it("una redirección a otro host no se sigue y cuenta como falla", async () => {
    const pedidos = [];
    const f = async (u) => (pedidos.push(u), resp(301, "", { location: "https://malo.example/x" }));
    await expect(pedir("https://dtdcargo.com/a", { origen: "https://dtdcargo.com", fetchFn: f })).rejects.toThrow(/otro origen/);
    expect(pedidos).toEqual(["https://dtdcargo.com/a"]);
    const sm = sitemapEn("https://dtdcargo.com/a");
    const salida = "auditoria-geo-aeo-prueba-redir.json";
    const r = await correr(["--sitemap", sm, "--pausa", "0", "--json", salida], f);
    const info = JSON.parse(readFileSync(salida, "utf8"));
    borrar(salida);
    expect(pedidos).toHaveLength(2); // 1 de la prueba directa + 1 de main; nunca el host malo
    expect(pedidos.every((u) => u.startsWith("https://dtdcargo.com"))).toBe(true);
    expect(info.paginas[0].error).toContain("otro origen");
    expect(info.paginas[0].checks.http.detalle).toContain("otro origen");
    expect(r.codigo).toBe(1);
  });

  it("sigue redirecciones del mismo origen", async () => {
    const f = async (u) => (u.endsWith("/a") ? resp(301, "", { location: "/b" }) : resp(200, "ok"));
    const res = await pedir("https://dtdcargo.com/a", { origen: "https://dtdcargo.com", fetchFn: f });
    expect(res.status).toBe(200);
  });

  it("--sitemap como URL sin --base toma el origen del sitemap", async () => {
    const pedidos = [];
    const f = async (u) => {
      pedidos.push(u);
      return u.endsWith("sitemap.xml") ? resp(200, sitemapDe("https://staging.example/a")) : resp(200, html({ canonical: "https://staging.example/a" }));
    };
    await correr(["--sitemap", "https://staging.example/sitemap.xml", "--pausa", "0"], f);
    expect(pedidos).toEqual(["https://staging.example/sitemap.xml", "https://staging.example/a"]);
  });

  it("parsearSitemap solo reescribe el origen propio", () => {
    const xml = sitemapDe("https://dtdcargo.com/a", "https://otro.example/b");
    expect(parsearSitemap(xml, "https://staging.test").map((u) => u.url)).toEqual(["https://staging.test/a", "https://otro.example/b"]);
  });
});

describe("tiempo, red caída y orden", () => {
  it("el motivo del error de red queda en el informe", async () => {
    const sm = sitemapEn("https://dtdcargo.com/a", "https://dtdcargo.com/b");
    const f = async (u) => {
      if (u.endsWith("/a")) throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
      throw Object.assign(new Error("agotado"), { name: "TimeoutError" });
    };
    const salida = "auditoria-geo-aeo-prueba-red.json";
    const r = await correr(["--sitemap", sm, "--pausa", "0", "--json", salida], f);
    const info = JSON.parse(readFileSync(salida, "utf8"));
    borrar(salida);
    expect(info.paginas[0].error).toBe("ECONNREFUSED");
    expect(info.paginas[1].error).toContain("tiempo agotado");
    expect(r.codigo).toBe(1);
  });

  it("el pedido lleva tope de tiempo, user-agent genérico y no sigue redirecciones por su cuenta", async () => {
    let opciones;
    await pedir("https://dtdcargo.com/a", { origen: "https://dtdcargo.com", fetchFn: async (u, o) => ((opciones = o), resp(200)) });
    expect(opciones.redirect).toBe("manual");
    expect(opciones.signal).toBeInstanceOf(AbortSignal);
    expect(opciones.headers["user-agent"]).toBe("auditoria-geo-aeo/1");
  });

  it("el sitemap también se pide con tope de tiempo", async () => {
    let opciones;
    const f = async (u, o) => ((opciones ??= o), resp(200, sitemapDe("https://dtdcargo.com/a")));
    await correr(["--sitemap", "https://dtdcargo.com/sitemap.xml", "--pausa", "0", "--no-estricto"], f);
    expect(opciones.signal).toBeInstanceOf(AbortSignal);
    expect(opciones.redirect).toBe("manual");
  });

  it("los pedidos van en serie: nunca dos a la vez y en el orden del sitemap", async () => {
    const sm = sitemapEn("https://dtdcargo.com/1", "https://dtdcargo.com/2", "https://dtdcargo.com/3");
    let activos = 0;
    let maximo = 0;
    const orden = [];
    const f = async (u) => {
      activos++;
      maximo = Math.max(maximo, activos);
      orden.push(u);
      await new Promise((r) => setTimeout(r, 5));
      activos--;
      return resp(200, "");
    };
    await correr(["--sitemap", sm, "--pausa", "0", "--no-estricto"], f);
    expect(maximo).toBe(1);
    expect(orden).toEqual(["https://dtdcargo.com/1", "https://dtdcargo.com/2", "https://dtdcargo.com/3"]);
  });
});

describe("tope --max", () => {
  it("corta y avisa", async () => {
    const sm = sitemapEn(...Array.from({ length: 5 }, (_, i) => `https://dtdcargo.com/p${i}`));
    const pedidos = [];
    const r = await correr(["--sitemap", sm, "--pausa", "0", "--max", "2", "--no-estricto"], async (u) => (pedidos.push(u), resp(200, "")));
    expect(pedidos).toHaveLength(2);
    expect(r.log).toContain("AVISO");
    expect(leerArgumentos([]).max).toBe(200);
    expect(() => leerArgumentos(["--max", "0"])).toThrow();
  });
});

describe("carpetas acotadas", () => {
  it("--json acepta solo un nombre simple .json", () => {
    expect(nombreJsonSeguro("auditoria-geo-aeo-2026-11-16.json")).toBe("auditoria-geo-aeo-2026-11-16.json");
    for (const malo of ["../x.json", "a/b.json", "C:\\x.json", "x.txt", "..json", "/etc/x.json"]) expect(() => nombreJsonSeguro(malo), malo).toThrow();
  });

  it("--html-dir no sale de la carpeta", async () => {
    const d = tmp();
    const dentro = join(d, "sitio");
    mkdirSync(dentro);
    writeFileSync(join(dentro, "a.html"), html({ canonical: canon("/a") }));
    writeFileSync(join(d, "secreto.html"), "<title>secreto</title>");
    const sm = join(d, "sitemap.xml");
    writeFileSync(sm, sitemapDe("https://dtdcargo.com/a", "https://dtdcargo.com/%2e%2e%2fsecreto", "https://dtdcargo.com/%E0%A4%A"));
    const salida = "auditoria-geo-aeo-prueba-dir.json";
    const r = await correr(["--sitemap", sm, "--html-dir", dentro, "--no-estricto", "--json", salida], async () => {
      throw new Error("no debe tocar la red");
    });
    const info = JSON.parse(readFileSync(salida, "utf8"));
    borrar(salida);
    expect(info.paginas[0].status).toBe(200);
    expect(info.paginas[1].titulo).toBeNull();
    expect(info.paginas[1].error).toContain("fuera de la carpeta");
    expect(info.paginas[2].error).toBeTruthy(); // %-inválido atrapado dentro del try
    expect(r.codigo).toBe(0);
  });
});

describe("longitud del título", () => {
  it("con « · DTD Cargo» y acentos en NFD cuenta como NFC", () => {
    const nfc = "Importación marítima desde China · DTD Cargo";
    const nfd = nfc.normalize("NFD");
    expect(nfd.length).toBeGreaterThan(nfc.length);
    expect(pagina(html({ title: nfd })).checks.titulo.detalle).toContain(`${[...nfc].length} caracteres`);
    expect(estado(pagina(html({ title: "á".repeat(60).normalize("NFD") })), "titulo")).toBe("PASA");
    expect(estado(pagina(html({ title: "á".repeat(61).normalize("NFD") })), "titulo")).toBe("FALLA");
  });
});
