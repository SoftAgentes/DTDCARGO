// @vitest-environment node
// SDD-0642 · Prueba focal del parseo y las reglas de scripts/auditoria-geo-aeo.mjs. Sin red.
import { describe, expect, it } from "vitest";
import {
  analizarPagina,
  analizarSitio,
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
