/**
 * infra/ops/web/publicable.mjs — el lado GitHub de la publicación automática (SDD-0541).
 *
 *   node infra/ops/web/publicable.mjs etiquetas            # build-image.yml: migraciones del commit
 *   node infra/ops/web/publicable.mjs promover [--simular] # publicable.yml: mueve :publicable
 *
 * QUÉ RESUELVE. `:main` se mueve en cuanto termina la imagen (3-4 min), sin
 * esperar a «Calidad continua» (15-30 min). El 2026-10-16 la imagen de
 * `6da8aebc` quedó en `:main` con el CI de main en rojo. El servidor no puede
 * preguntarle a GitHub (el repo es privado y no queremos un token allí), así que
 * la decisión se toma acá y el servidor solo sigue una etiqueta: `:publicable`.
 *
 * CUÁNDO UN COMMIT DE MAIN ES PUBLICABLE (evaluarCommit):
 *   1. «Imagen Docker» terminó en verde para ese SHA, y
 *   2. «Calidad continua» terminó en verde para ese SHA en main (vía ci-de-main), o
 *   3. atajo de la PR (vía ci-de-la-pr), salvo PUBLICABLE_SOLO_CI_DE_MAIN=si: el
 *      commit es un merge, la cabeza de la PR ya contenía el main anterior (0
 *      commits atrás), el árbol del merge es idéntico al de la cabeza, y
 *      «Calidad continua» terminó en verde en esa cabeza (evento pull_request).
 *      Con la rama al día, lo que probó el CI de la PR es exactamente el árbol
 *      que se publica. Medido el 2026-10-16: los últimos 30 merges cumplían las
 *      tres condiciones. El atajo baja la espera de ~30 a ~6 minutos; importa por
 *      el orden migrate-first (la base nueva convive con la web vieja hasta que
 *      la web entra).
 *
 * QUÉ SE PROMUEVE (decidir): se recorre main por su primer padre, del más nuevo
 * al más viejo (hasta VENTANA commits). El primero que cumple se promueve. Si
 * antes se llega al commit que ya está en `:publicable`, no se hace nada: la
 * etiqueta nunca retrocede y nunca se salta hacia un commit más viejo. Así dos
 * merges seguidos terminan en el último que pasa, sin depender de qué evento
 * llegó primero.
 *
 * PROMOVER = copiar el manifiesto de `sha-<sha>` a `publicable` con los mismos
 * bytes, por la API del registro (OCI distribution): el digest es el mismo por
 * construcción y no hace falta docker ni buildx en el runner.
 *
 * Interruptor: PUBLICABLE_CONGELADO=si (variable del repo) no mueve nada. El
 * servidor tiene el suyo (/srv/ops/web/CONGELADO).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findMissing } from "../../../scripts/check-migrations-applied.mjs";

export const IMAGEN = "hailuwaycom-sketch/dtdcargo";
export const ETIQUETA = "publicable";
export const VENTANA = 20;

const ACEPTA_MANIFIESTOS = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

/** `si`, `sí`, `1` o `true` (sin distinguir mayúsculas) encienden un interruptor. */
export function activado(valor) {
  return ["si", "sí", "1", "true"].includes(String(valor ?? "").trim().toLowerCase());
}

// ─── Etiquetas de la imagen ──────────────────────────────────────────────────

/** `v1:<n>:a,b,c`. El conteo deja ver en el servidor una etiqueta truncada. */
export function formatoLista(nombres) {
  return `v1:${nombres.length}:${nombres.join(",")}`;
}

/**
 * Las migraciones que el servidor exige en su ledger antes de publicar este
 * commit: TODAS las de número mayor al corte, también las declaradas como
 * espera en `pendingBelowCutoff`. Las esperas no se eximen porque las PR
 * migrate-first se han fusionado con la espera todavía declarada (0475 con la
 * #212, 0490 con la #241): eximirlas dejaría pasar justo el caso que el gate
 * existe para frenar. Las que van después de la web se aceptan en el servidor,
 * una por una (`publicar-web.sh aceptar-pendiente`).
 *
 * Reusa `findMissing` del gate `migrations-applied` con un ledger vacío y sin
 * esperas: mismo prefijo numérico y mismo corte, una sola definición.
 *
 * @param {string} raiz raíz del repo
 * @returns {{ exigidas: string[], enEspera: string[] }}
 */
export function migracionesDelCommit(raiz) {
  const dir = path.join(raiz, "supabase", "migrations");
  const baseline = JSON.parse(fs.readFileSync(path.join(raiz, "supabase", "migrations-baseline.json"), "utf8"));
  if (typeof baseline.cutoff !== "number") throw new Error("migrations-baseline.json sin `cutoff` numérico");
  const archivos = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();
  const exigidas = findMissing(archivos, new Set(), baseline.cutoff, {});
  const espera = baseline.pendingBelowCutoff ?? {};
  const enEspera = exigidas.filter((n) => Object.hasOwn(espera, n));
  for (const n of exigidas) {
    if (!/^[0-9]{4}[a-z]?_[a-z0-9_]+$/.test(n)) throw new Error(`nombre de migración inesperado: ${n}`);
  }
  return { exigidas, enEspera };
}

/** Las dos líneas `clave=valor` que build-image.yml suma a las etiquetas. */
export function etiquetas(raiz) {
  const { exigidas, enEspera } = migracionesDelCommit(raiz);
  return [
    `org.dtdcargo.migraciones=${formatoLista(exigidas)}`,
    `org.dtdcargo.migraciones-en-espera=${formatoLista(enEspera)}`,
  ];
}

// ─── Clientes (inyectables en las pruebas) ───────────────────────────────────

/**
 * Lo mínimo de la API de GitHub, con el GITHUB_TOKEN del workflow (contents y
 * actions de solo lectura).
 */
export function crearGitHub({ token, repo, fetchImpl = globalThis.fetch, base = "https://api.github.com" }) {
  async function get(ruta) {
    const r = await fetchImpl(base + ruta, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    });
    if (!r.ok) throw new Error(`GitHub ${ruta} → HTTP ${r.status}`);
    return r.json();
  }
  return {
    cabezaDeMain: async () => (await get(`/repos/${repo}/git/ref/heads/main`)).object.sha,
    commit: async (sha) => {
      const c = await get(`/repos/${repo}/git/commits/${sha}`);
      return { sha: c.sha, arbol: c.tree.sha, padres: c.parents.map((p) => p.sha) };
    },
    /** Commits de `base` que `cabeza` no tiene (0 = la cabeza ya contiene la base). */
    atrasoDe: async (baseSha, cabeza) => (await get(`/repos/${repo}/compare/${baseSha}...${cabeza}`)).behind_by,
    /**
     * Corridas en verde de un workflow para un SHA. Se filtra por el ARCHIVO del
     * workflow (no por el nombre del check): un check se puede crear por API con
     * cualquier nombre; una corrida de `quality.yml`, no.
     */
    corridasExitosas: async (archivo, sha, eventos) => {
      const q = `head_sha=${sha}&status=success&per_page=50`;
      const r = await get(`/repos/${repo}/actions/workflows/${archivo}/runs?${q}`);
      return (r.workflow_runs ?? []).filter(
        (w) =>
          w.head_sha === sha &&
          w.conclusion === "success" &&
          eventos.includes(w.event) &&
          String(w.path ?? "").startsWith(`.github/workflows/${archivo}`),
      );
    },
  };
}

/** Registro de GHCR por HTTP: token, leer un manifiesto y etiquetarlo. */
export function crearRegistro({ usuario, token, imagen = IMAGEN, fetchImpl = globalThis.fetch, base = "https://ghcr.io" }) {
  let bearer = null;
  async function autorizar() {
    const basic = Buffer.from(`${usuario}:${token}`).toString("base64");
    const r = await fetchImpl(`${base}/token?service=ghcr.io&scope=repository:${imagen}:pull,push`, {
      headers: { authorization: `Basic ${basic}` },
    });
    if (!r.ok) throw new Error(`GHCR no dio token (HTTP ${r.status})`);
    bearer = (await r.json()).token;
    if (!bearer) throw new Error("GHCR respondió sin token");
  }
  return {
    /** @returns {Promise<null | {digest: string, tipo: string, cuerpo: Buffer}>} */
    async manifiesto(etiqueta) {
      if (!bearer) await autorizar();
      const r = await fetchImpl(`${base}/v2/${imagen}/manifests/${etiqueta}`, {
        headers: { authorization: `Bearer ${bearer}`, accept: ACEPTA_MANIFIESTOS },
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`GHCR ${etiqueta} → HTTP ${r.status}`);
      const cuerpo = Buffer.from(await r.arrayBuffer());
      const digest = `sha256:${crypto.createHash("sha256").update(cuerpo).digest("hex")}`;
      const cabecera = r.headers.get("docker-content-digest");
      if (cabecera && cabecera !== digest) throw new Error(`GHCR ${etiqueta}: digest ${cabecera} ≠ bytes ${digest}`);
      const tipo = r.headers.get("content-type");
      if (!tipo) throw new Error(`GHCR ${etiqueta}: sin content-type`);
      return { digest, tipo, cuerpo };
    },
    /** Sube los MISMOS bytes con otra etiqueta: mismo digest. */
    async etiquetar(etiqueta, m) {
      if (!bearer) await autorizar();
      const r = await fetchImpl(`${base}/v2/${imagen}/manifests/${etiqueta}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${bearer}`, "content-type": m.tipo },
        body: m.cuerpo,
      });
      if (r.status !== 201 && r.status !== 200) throw new Error(`GHCR PUT ${etiqueta} → HTTP ${r.status}`);
      const digest = r.headers.get("docker-content-digest") ?? m.digest;
      if (digest !== m.digest) throw new Error(`GHCR PUT ${etiqueta}: quedó ${digest}, se esperaba ${m.digest}`);
      return digest;
    },
  };
}

// ─── Decisión ────────────────────────────────────────────────────────────────

/**
 * ¿Este commit de main se puede publicar? Ver la cabecera.
 *
 * @param {{sha: string, arbol: string, padres: string[]}} c
 * @returns {Promise<{ok: boolean, via?: string, motivo: string, cabeza?: string}>}
 */
export async function evaluarCommit(c, { gh, soloCiDeMain = false }) {
  const imagen = await gh.corridasExitosas("build-image.yml", c.sha, ["push", "workflow_dispatch"]);
  if (imagen.length === 0) return { ok: false, motivo: "«Imagen Docker» sin terminar en verde" };

  const ciMain = await gh.corridasExitosas("quality.yml", c.sha, ["push"]);
  if (ciMain.length > 0) return { ok: true, via: "ci-de-main", motivo: "«Calidad continua» verde en main" };
  if (soloCiDeMain) return { ok: false, motivo: "«Calidad continua» de main sin verde (modo solo CI de main)" };

  if (c.padres.length !== 2) return { ok: false, motivo: "no es un merge de PR: espera el CI de main" };
  const [anterior, cabeza] = c.padres;
  const atraso = await gh.atrasoDe(anterior, cabeza);
  if (atraso !== 0) return { ok: false, motivo: `la rama de la PR estaba ${atraso} commit(s) atrás de main: espera el CI de main` };
  const h = await gh.commit(cabeza);
  if (h.arbol !== c.arbol) return { ok: false, motivo: "el árbol del merge no es el de la cabeza de la PR: espera el CI de main" };
  const ciPr = await gh.corridasExitosas("quality.yml", cabeza, ["pull_request"]);
  if (ciPr.length === 0) return { ok: false, motivo: `«Calidad continua» de la PR sin verde en ${cabeza.slice(0, 8)}` };
  return { ok: true, via: "ci-de-la-pr", cabeza, motivo: `mismo árbol que ${cabeza.slice(0, 8)}, verde en la PR` };
}

/**
 * Recorre main y decide. No escribe nada.
 *
 * @returns {Promise<{accion: "promover" | "al-dia" | "nada", sha?: string, via?: string,
 *   manifiesto?: {digest: string, tipo: string, cuerpo: Buffer}, revisados: object[]}>}
 */
export async function decidir({ gh, registro, soloCiDeMain = false, ventana = VENTANA }) {
  const actual = await registro.manifiesto(ETIQUETA);
  const revisados = [];
  let sha = await gh.cabezaDeMain();
  for (let i = 0; i < ventana && sha; i++) {
    const c = await gh.commit(sha);
    const m = await registro.manifiesto(`sha-${sha}`);
    if (m && actual && m.digest === actual.digest) {
      revisados.push({ sha, ok: true, motivo: "ya es :publicable" });
      return { accion: "al-dia", sha, revisados };
    }
    const e = m ? await evaluarCommit(c, { gh, soloCiDeMain }) : { ok: false, motivo: `sin imagen sha-${sha.slice(0, 8)} en GHCR` };
    revisados.push({ sha, ...e });
    if (e.ok) return { accion: "promover", sha, via: e.via, manifiesto: m, revisados };
    sha = c.padres[0];
  }
  return { accion: "nada", revisados };
}

/** Decide y, salvo simulación o congelado, mueve `:publicable`. */
export async function promover({ gh, registro, soloCiDeMain = false, simular = false, congelado = false, ventana = VENTANA }) {
  if (congelado) return { accion: "congelado", revisados: [] };
  const d = await decidir({ gh, registro, soloCiDeMain, ventana });
  if (d.accion === "promover" && !simular) {
    d.digest = await registro.etiquetar(ETIQUETA, d.manifiesto);
  }
  return d;
}

/** Resumen en markdown para $GITHUB_STEP_SUMMARY. */
export function resumen(d, { simular = false } = {}) {
  const titulo = {
    promover: simular ? `Simulación: se promovería \`${d.sha}\` (${d.via})` : `\`:publicable\` → \`${d.sha}\` (${d.via})`,
    "al-dia": `\`:publicable\` ya apunta a \`${d.sha}\`: nada que mover`,
    nada: "Ningún commit reciente de main cumple: `:publicable` no se mueve",
    congelado: "Congelado por la variable PUBLICABLE_CONGELADO: `:publicable` no se mueve",
  }[d.accion];
  const filas = d.revisados.map((r) => `| \`${r.sha.slice(0, 8)}\` | ${r.ok ? "sí" : "no"} | ${r.motivo} |`);
  return [`## Imagen publicable`, "", titulo, "", "| commit | publicable | motivo |", "|---|---|---|", ...filas, ""].join("\n");
}

// ─── Línea de comandos ───────────────────────────────────────────────────────

async function main(argv, env) {
  const [cmd, ...resto] = argv;
  if (cmd === "etiquetas") {
    for (const l of etiquetas(process.cwd())) console.log(l);
    return 0;
  }
  if (cmd === "promover") {
    const simular = resto.includes("--simular") || activado(env.PUBLICABLE_SIMULAR);
    const token = env.GH_TOKEN ?? env.GITHUB_TOKEN;
    if (!token || !env.GITHUB_REPOSITORY) throw new Error("faltan GH_TOKEN y GITHUB_REPOSITORY");
    const gh = crearGitHub({ token, repo: env.GITHUB_REPOSITORY });
    const registro = crearRegistro({ usuario: env.GITHUB_ACTOR ?? "github-actions", token });
    const d = await promover({
      gh,
      registro,
      simular,
      soloCiDeMain: activado(env.PUBLICABLE_SOLO_CI_DE_MAIN),
      congelado: activado(env.PUBLICABLE_CONGELADO),
    });
    const md = resumen(d, { simular });
    console.log(md);
    if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, md + "\n");
    return 0;
  }
  console.error("uso: publicable.mjs etiquetas | promover [--simular]");
  return 2;
}

const esEntrada = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (esEntrada) {
  main(process.argv.slice(2), process.env).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`publicable: ${e?.message ?? e}`);
      process.exitCode = 1;
    },
  );
}
