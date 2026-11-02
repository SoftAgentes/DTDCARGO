// @vitest-environment node
/**
 * Pruebas de infra/ops/web/publicable.mjs (SDD-0541): qué commit de main puede
 * llegar a la web y cómo se mueve `:publicable`.
 *
 * Los dobles de GitHub y del registro filtran como los de verdad (por evento,
 * por etiqueta): un doble que no filtra no prueba el filtro. Los clientes HTTP
 * reales se prueban aparte con un `fetch` doble que devuelve respuestas
 * mezcladas.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  activado,
  crearGitHub,
  crearRegistro,
  decidir,
  ETIQUETA,
  etiquetas,
  evaluarCommit,
  formatoLista,
  IMAGEN,
  migracionesDelCommit,
  promover,
  resumen,
} from "../web/publicable.mjs";

const sha = (c) => c.repeat(40);
// main por el primer padre: A ← M1 ← M2 ← M3. Cada M es el merge de una PR (H1, H2, H3).
const A = sha("a");
const M1 = sha("1");
const M2 = sha("2");
const M3 = sha("3");
const H1 = sha("b");
const H2 = sha("c");
const H3 = sha("d");

function commitsBase() {
  return {
    [A]: { arbol: "tA", padres: [sha("0")] },
    [M1]: { arbol: "t1", padres: [A, H1] },
    [H1]: { arbol: "t1", padres: [A] },
    [M2]: { arbol: "t2", padres: [M1, H2] },
    [H2]: { arbol: "t2", padres: [M1] },
    [M3]: { arbol: "t3", padres: [M2, H3] },
    [H3]: { arbol: "t3", padres: [M2] },
  };
}

/**
 * corridas: { "<archivo>@<sha>": ["push", "pull_request", …] } — solo las verdes.
 * atrasos:  { "<base>...<cabeza>": n } — por defecto 0 (rama al día).
 */
function ghDoble({ cabeza = M2, commits = commitsBase(), corridas = {}, atrasos = {} } = {}) {
  return {
    cabezaDeMain: async () => cabeza,
    commit: async (s) => {
      const c = commits[s];
      if (!c) throw new Error(`commit desconocido ${s}`);
      return { sha: s, ...c };
    },
    atrasoDe: async (b, h) => atrasos[`${b}...${h}`] ?? 0,
    corridasExitosas: async (archivo, s, eventos) =>
      (corridas[`${archivo}@${s}`] ?? []).filter((e) => eventos.includes(e)).map((event) => ({ event })),
  };
}

/** etiquetas: { "<etiqueta>": "<digest>" }. Guarda lo que se sube. */
function registroDoble(etiquetasIniciales = {}) {
  const tags = { ...etiquetasIniciales };
  const subidas = [];
  return {
    tags,
    subidas,
    manifiesto: async (t) => (tags[t] ? { digest: tags[t], tipo: "application/vnd.oci.image.manifest.v1+json", cuerpo: Buffer.from(tags[t]) } : null),
    etiquetar: async (t, m) => {
      subidas.push([t, m.digest]);
      tags[t] = m.digest;
      return m.digest;
    },
  };
}

const imagenes = { [`sha-${A}`]: "sha256:aa", [`sha-${M1}`]: "sha256:11", [`sha-${M2}`]: "sha256:22", [`sha-${M3}`]: "sha256:33" };

describe("evaluarCommit", () => {
  it("con imagen y CI de main en verde, publica por el CI de main", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${M2}`]: ["push"] } });
    const e = await evaluarCommit(await gh.commit(M2), { gh });
    expect(e).toMatchObject({ ok: true, via: "ci-de-main" });
  });

  it("sin CI de main todavía, usa el atajo de la PR si la rama estaba al día y el árbol es el mismo", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${H2}`]: ["pull_request"] } });
    const e = await evaluarCommit(await gh.commit(M2), { gh });
    expect(e).toMatchObject({ ok: true, via: "ci-de-la-pr", cabeza: H2 });
  });

  it("sin imagen en verde no publica, aunque el CI esté verde", async () => {
    const gh = ghDoble({ corridas: { [`quality.yml@${M2}`]: ["push"] } });
    const e = await evaluarCommit(await gh.commit(M2), { gh });
    expect(e.ok).toBe(false);
    expect(e.motivo).toMatch(/Imagen Docker/);
  });

  it("una imagen reconstruida a mano (workflow_dispatch) también cuenta como imagen en verde", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["workflow_dispatch"], [`quality.yml@${M2}`]: ["push"] } });
    expect((await evaluarCommit(await gh.commit(M2), { gh })).ok).toBe(true);
  });

  it("en modo solo CI de main no usa el atajo", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${H2}`]: ["pull_request"] } });
    const e = await evaluarCommit(await gh.commit(M2), { gh, soloCiDeMain: true });
    expect(e.ok).toBe(false);
    expect(e.motivo).toMatch(/solo CI de main/);
  });

  it("una rama que estaba atrás de main no usa el atajo", async () => {
    const gh = ghDoble({
      corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${H2}`]: ["pull_request"] },
      atrasos: { [`${M1}...${H2}`]: 2 },
    });
    const e = await evaluarCommit(await gh.commit(M2), { gh });
    expect(e.ok).toBe(false);
    expect(e.motivo).toMatch(/2 commit\(s\) atrás/);
  });

  it("si el árbol del merge no es el de la cabeza, no usa el atajo", async () => {
    const commits = commitsBase();
    commits[H2] = { arbol: "otro", padres: [M1] };
    const gh = ghDoble({ commits, corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${H2}`]: ["pull_request"] } });
    const e = await evaluarCommit(await gh.commit(M2), { gh });
    expect(e.ok).toBe(false);
    expect(e.motivo).toMatch(/árbol/);
  });

  it("un commit directo (un solo padre) espera el CI de main", async () => {
    const commits = commitsBase();
    commits[M2] = { arbol: "t2", padres: [M1] };
    const gh = ghDoble({ commits, corridas: { [`build-image.yml@${M2}`]: ["push"] } });
    const e = await evaluarCommit(await gh.commit(M2), { gh });
    expect(e.ok).toBe(false);
    expect(e.motivo).toMatch(/no es un merge/);
  });

  it("en la cabeza de la PR solo vale una corrida de pull_request", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${H2}`]: ["push", "workflow_dispatch"] } });
    const e = await evaluarCommit(await gh.commit(M2), { gh });
    expect(e.ok).toBe(false);
    expect(e.motivo).toMatch(/de la PR sin verde/);
  });

  it("en main solo vale una corrida de push del CI", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${M2}`]: ["workflow_dispatch"] }, atrasos: { [`${M1}...${H2}`]: 1 } });
    expect((await evaluarCommit(await gh.commit(M2), { gh })).ok).toBe(false);
  });
});

describe("decidir y promover", () => {
  it("promueve el commit más nuevo que cumple y sube los mismos bytes de sha-<sha>", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${M2}`]: ["push"] } });
    const reg = registroDoble({ ...imagenes, [ETIQUETA]: imagenes[`sha-${M1}`] });
    const d = await promover({ gh, registro: reg });
    expect(d).toMatchObject({ accion: "promover", sha: M2, via: "ci-de-main", digest: "sha256:22" });
    expect(reg.subidas).toEqual([[ETIQUETA, "sha256:22"]]);
  });

  it("si el más nuevo no cumple, promueve el anterior que sí, si es más nuevo que :publicable", async () => {
    const gh = ghDoble({
      corridas: { [`build-image.yml@${M1}`]: ["push"], [`quality.yml@${M1}`]: ["push"] }, // M2: imagen todavía construyéndose
    });
    const reg = registroDoble({ ...imagenes, [ETIQUETA]: imagenes[`sha-${A}`] });
    const d = await promover({ gh, registro: reg });
    expect(d).toMatchObject({ accion: "promover", sha: M1 });
    expect(d.revisados.map((r) => r.sha)).toEqual([M2, M1]);
  });

  it("nunca retrocede: si llega al commit de :publicable antes de encontrar otro, no mueve nada", async () => {
    const gh = ghDoble({
      cabeza: M3,
      corridas: { [`build-image.yml@${M1}`]: ["push"], [`quality.yml@${M1}`]: ["push"] }, // M3 y M2 no cumplen; M1 sí, pero es viejo
    });
    const reg = registroDoble({ ...imagenes, [ETIQUETA]: imagenes[`sha-${M2}`] });
    const d = await promover({ gh, registro: reg });
    expect(d).toMatchObject({ accion: "al-dia", sha: M2 });
    expect(reg.subidas).toEqual([]);
  });

  it("si :publicable ya es el más nuevo que cumple, no sube nada", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${M2}`]: ["push"] } });
    const reg = registroDoble({ ...imagenes, [ETIQUETA]: imagenes[`sha-${M2}`] });
    const d = await promover({ gh, registro: reg });
    expect(d.accion).toBe("al-dia");
    expect(reg.subidas).toEqual([]);
  });

  it("una imagen reconstruida del mismo commit (otro digest) se vuelve a promover", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push", "workflow_dispatch"], [`quality.yml@${M2}`]: ["push"] } });
    const reg = registroDoble({ ...imagenes, [`sha-${M2}`]: "sha256:22bis", [ETIQUETA]: "sha256:22" });
    const d = await promover({ gh, registro: reg });
    expect(d).toMatchObject({ accion: "promover", sha: M2, digest: "sha256:22bis" });
  });

  it("dos merges seguidos: primero entra el que terminó antes y después el último", async () => {
    const corridas = { [`build-image.yml@${M1}`]: ["push"], [`quality.yml@${H1}`]: ["pull_request"], [`quality.yml@${H2}`]: ["pull_request"] };
    const reg = registroDoble({ ...imagenes, [ETIQUETA]: imagenes[`sha-${A}`] });
    const primero = await promover({ gh: ghDoble({ corridas }), registro: reg });
    expect(primero).toMatchObject({ accion: "promover", sha: M1, via: "ci-de-la-pr" });
    corridas[`build-image.yml@${M2}`] = ["push"]; // terminó la imagen del segundo
    const segundo = await promover({ gh: ghDoble({ corridas }), registro: reg });
    expect(segundo).toMatchObject({ accion: "promover", sha: M2, via: "ci-de-la-pr" });
    expect(reg.subidas.map(([, d]) => d)).toEqual(["sha256:11", "sha256:22"]);
  });

  it("sin :publicable todavía, promueve el más nuevo que cumple", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${M2}`]: ["push"] } });
    const reg = registroDoble(imagenes);
    expect((await promover({ gh, registro: reg })).sha).toBe(M2);
  });

  it("un commit sin etiqueta sha-<sha> en GHCR se salta sin preguntarle a GitHub", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${M2}`]: ["push"], [`build-image.yml@${M1}`]: ["push"], [`quality.yml@${M1}`]: ["push"] } });
    const { [`sha-${M2}`]: _sinM2, ...resto } = imagenes;
    const reg = registroDoble(resto);
    const d = await promover({ gh, registro: reg });
    expect(d.sha).toBe(M1);
    expect(d.revisados[0].motivo).toMatch(/sin imagen/);
  });

  it("la ventana acota el recorrido", async () => {
    const gh = ghDoble({ cabeza: M3, corridas: { [`build-image.yml@${A}`]: ["push"], [`quality.yml@${A}`]: ["push"] } });
    const d = await decidir({ gh, registro: registroDoble(imagenes), ventana: 3 });
    expect(d.accion).toBe("nada");
    expect(d.revisados).toHaveLength(3);
  });

  it("congelado no mira ni mueve nada", async () => {
    const reg = registroDoble({ ...imagenes });
    const d = await promover({ gh: ghDoble(), registro: reg, congelado: true });
    expect(d.accion).toBe("congelado");
    expect(reg.subidas).toEqual([]);
  });

  it("simular decide pero no sube", async () => {
    const gh = ghDoble({ corridas: { [`build-image.yml@${M2}`]: ["push"], [`quality.yml@${M2}`]: ["push"] } });
    const reg = registroDoble(imagenes);
    const d = await promover({ gh, registro: reg, simular: true });
    expect(d.accion).toBe("promover");
    expect(reg.subidas).toEqual([]);
    expect(resumen(d, { simular: true })).toMatch(/Simulación/);
  });
});

describe("clientes HTTP", () => {
  function respuesta(status, cuerpo, cabeceras = {}) {
    const bytes = Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo));
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k) => cabeceras[k.toLowerCase()] ?? null },
      json: async () => JSON.parse(bytes.toString("utf8")),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  }

  it("el registro copia los mismos bytes y el mismo tipo, y el digest sale de los bytes", async () => {
    const cuerpo = Buffer.from('{"schemaVersion":2,"config":{}}');
    const digest = `sha256:${crypto.createHash("sha256").update(cuerpo).digest("hex")}`;
    const pedidos = [];
    const fetchImpl = async (url, opts = {}) => {
      pedidos.push({ url, opts });
      if (url.includes("/token?")) return respuesta(200, { token: "portador" });
      if (opts.method === "PUT") return respuesta(201, "", { "docker-content-digest": digest });
      return respuesta(200, cuerpo, { "content-type": "application/vnd.oci.image.manifest.v1+json", "docker-content-digest": digest });
    };
    const reg = crearRegistro({ usuario: "actor", token: "tok", fetchImpl });
    const m = await reg.manifiesto(`sha-${M2}`);
    expect(m.digest).toBe(digest);
    expect(await reg.etiquetar(ETIQUETA, m)).toBe(digest);
    const put = pedidos.find((p) => p.opts.method === "PUT");
    expect(put.url).toBe(`https://ghcr.io/v2/softagentes/dtdcargo/manifests/${ETIQUETA}`);
    expect(put.opts.headers["content-type"]).toBe("application/vnd.oci.image.manifest.v1+json");
    expect(Buffer.compare(put.opts.body, cuerpo)).toBe(0);
    expect(pedidos[0].opts.headers.authorization).toBe(`Basic ${Buffer.from("actor:tok").toString("base64")}`);
    expect(pedidos[0].url).toContain("scope=repository:softagentes/dtdcargo:pull,push");
  });

  it("si el registro dice que la etiqueta quedó con otro digest, etiquetar falla", async () => {
    const fetchImpl = async (url, opts = {}) => {
      if (url.includes("/token?")) return respuesta(200, { token: "p" });
      if (opts.method === "PUT") return respuesta(201, "", { "docker-content-digest": "sha256:otro" });
      return respuesta(404, "{}");
    };
    const reg = crearRegistro({ usuario: "a", token: "t", fetchImpl });
    await expect(reg.etiquetar(ETIQUETA, { digest: "sha256:bueno", tipo: "x", cuerpo: Buffer.from("x") })).rejects.toThrow(/se esperaba/);
  });

  it("el registro devuelve null ante un 404 y falla si la cabecera no coincide con los bytes", async () => {
    let modo = "404";
    const fetchImpl = async (url) => {
      if (url.includes("/token?")) return respuesta(200, { token: "p" });
      if (modo === "404") return respuesta(404, "{}");
      return respuesta(200, "abc", { "content-type": "x", "docker-content-digest": "sha256:otro" });
    };
    const reg = crearRegistro({ usuario: "a", token: "t", fetchImpl });
    expect(await reg.manifiesto("sha-nada")).toBeNull();
    modo = "mentira";
    await expect(reg.manifiesto("sha-x")).rejects.toThrow(/digest/);
  });

  it("GitHub: solo cuentan corridas en verde del mismo SHA, del evento pedido y del archivo del workflow", async () => {
    const urls = [];
    const fetchImpl = async (url, opts) => {
      urls.push({ url, auth: opts.headers.authorization });
      return respuesta(200, {
        workflow_runs: [
          { head_sha: M2, conclusion: "success", event: "push", path: ".github/workflows/quality.yml" },
          { head_sha: M2, conclusion: "failure", event: "push", path: ".github/workflows/quality.yml" },
          { head_sha: M1, conclusion: "success", event: "push", path: ".github/workflows/quality.yml" },
          { head_sha: M2, conclusion: "success", event: "pull_request", path: ".github/workflows/quality.yml" },
          { head_sha: M2, conclusion: "success", event: "push", path: ".github/workflows/otro.yml" },
        ],
      });
    };
    const gh = crearGitHub({ token: "tok", repo: "o/r", fetchImpl });
    const r = await gh.corridasExitosas("quality.yml", M2, ["push"]);
    expect(r).toHaveLength(1);
    expect(urls[0].url).toBe(`https://api.github.com/repos/o/r/actions/workflows/quality.yml/runs?head_sha=${M2}&status=success&per_page=50`);
    expect(urls[0].auth).toBe("Bearer tok");
  });

  it("GitHub: commit y compare leen padres, árbol y atraso", async () => {
    const fetchImpl = async (url) => {
      if (url.endsWith(`/git/commits/${M2}`)) return respuesta(200, { sha: M2, tree: { sha: "t2" }, parents: [{ sha: M1 }, { sha: H2 }] });
      if (url.endsWith(`/compare/${M1}...${H2}`)) return respuesta(200, { behind_by: 0, ahead_by: 3 });
      if (url.endsWith("/git/ref/heads/main")) return respuesta(200, { object: { sha: M2 } });
      return respuesta(404, {});
    };
    const gh = crearGitHub({ token: "t", repo: "o/r", fetchImpl });
    expect(await gh.cabezaDeMain()).toBe(M2);
    expect(await gh.commit(M2)).toEqual({ sha: M2, arbol: "t2", padres: [M1, H2] });
    expect(await gh.atrasoDe(M1, H2)).toBe(0);
    await expect(gh.commit(M3)).rejects.toThrow(/HTTP 404/);
  });
});

describe("etiquetas de migraciones", () => {
  const temporales = [];
  afterAll(() => {
    for (const d of temporales) fs.rmSync(d, { recursive: true, force: true });
  });
  function repoFalso(archivos, baseline) {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "publicable-"));
    temporales.push(raiz);
    fs.mkdirSync(path.join(raiz, "supabase", "migrations"), { recursive: true });
    for (const a of archivos) fs.writeFileSync(path.join(raiz, "supabase", "migrations", `${a}.sql`), "-- x\n");
    fs.writeFileSync(path.join(raiz, "supabase", "migrations-baseline.json"), JSON.stringify(baseline));
    return raiz;
  }

  it("exige todas las del corte para arriba, también las declaradas como espera", () => {
    const raiz = repoFalso(["0100_viejo", "0238_corte", "0239_nueva", "0240b_parche", "0241_en_espera"], {
      cutoff: 238,
      pendingBelowCutoff: { "0241_en_espera": "motivo", "0017_vieja": "motivo" },
    });
    const { exigidas, enEspera } = migracionesDelCommit(raiz);
    expect(exigidas).toEqual(["0239_nueva", "0240b_parche", "0241_en_espera"]);
    expect(enEspera).toEqual(["0241_en_espera"]);
    expect(etiquetas(raiz)).toEqual([
      "org.dtdcargo.migraciones=v1:3:0239_nueva,0240b_parche,0241_en_espera",
      "org.dtdcargo.migraciones-en-espera=v1:1:0241_en_espera",
    ]);
  });

  it("rechaza un nombre que la etiqueta no podría llevar", () => {
    const raiz = repoFalso(["0300_Con,Coma"], { cutoff: 238 });
    expect(() => migracionesDelCommit(raiz)).toThrow(/inesperado/);
  });

  it("en el repo real incluye las esperas 0422 y 0423 y cuenta bien", () => {
    const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    const [linea] = etiquetas(raiz);
    const [, n, lista] = linea.split("=")[1].split(":");
    expect(lista.split(",")).toHaveLength(Number(n));
    expect(lista.split(",")).toEqual(expect.arrayContaining(["0422_payment_report_command_boundary", "0423_payment_report_historical_identity"]));
  });

  it("formatoLista y activado", () => {
    expect(formatoLista([])).toBe("v1:0:");
    expect(["si", "Sí", "1", "TRUE"].map(activado)).toEqual([true, true, true, true]);
    expect(["", "no", undefined, "0"].map(activado)).toEqual([false, false, false, false]);
  });
});

/**
 * El workflow construye en una dirección, el promotor mueve la etiqueta en otra y
 * el servidor baja de una tercera. Si una se queda atrás, nada falla en GitHub: el
 * servidor deja de ver imágenes nuevas (2026-10-25: «manifest unknown»).
 */
describe("la dirección de la imagen", () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const leer = (ruta) => fs.readFileSync(path.join(raiz, ruta), "utf8");
  const DIRECCION = "ghcr.io/softagentes/dtdcargo";

  it.each([
    [".github/workflows/build-image.yml", /^\s*IMAGE:\s*(\S+)\s*$/m],
    [".github/workflows/build-image-prueba.yml", /^\s*IMAGE:\s*(\S+)\s*$/m],
    ["infra/ops/web/publicar-web.sh", /^IMAGEN=(\S+)$/m],
    ["infra/ops/staging/lib-prueba.sh", /^PRUEBA_IMAGE_REPO="(\S+)"$/m],
    ["infra/ops/staging/verificar-aislamiento.sh", /^IMAGE_REPO="(\S+)"$/m],
    // Valores por defecto: producción no los usa, pero un servidor nuevo sí.
    ["infra/dtd-cargo/compose.yml", /^\s*image:\s*\$\{DTD_WEB_IMAGE:-([^:}\s]+):main\}\s*$/m],
    ["infra/dtd-cargo/.env.example", /^DTD_WEB_IMAGE=([^:\s]+):main$/m],
  ])("%s usa la misma dirección que el promotor", (ruta, patron) => {
    expect(`ghcr.io/${IMAGEN}`).toBe(DIRECCION);
    expect(leer(ruta).match(patron)?.[1]).toBe(DIRECCION);
  });

  it.each([".github/workflows", "infra/ops/web", "infra/ops/staging", "infra/dtd-cargo"])(
    "%s ya no nombra el registro de la dirección vieja",
    (carpeta) => {
      const con = fs
        .readdirSync(path.join(raiz, carpeta), { withFileTypes: true })
        .filter((e) => e.isFile() && leer(path.join(carpeta, e.name)).includes("ghcr.io/hailuwaycom-sketch"))
        .map((e) => e.name);
      expect(con).toEqual([]);
    },
  );
});
