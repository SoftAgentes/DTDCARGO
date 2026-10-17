/** Inventario global y reservas SDD en ramas: nunca publica ni modifica main.
 * --no-fetch es advisory y no permite reservar. --reserve <slug> crea refs
 * locales durables; --push publica exclusivamente la reserva canónica.
 * --expect NNNN (SDD-0545) cancela la reserva, sin crear refs, si el número
 * que tocaría no es el esperado. --reserve sigue tomando el máximo + 1, no el
 * primer hueco: un hueco puede ser una reserva abandonada. Los huecos por
 * encima de lo integrado en origin/main se avisan, no se usan solos.
 * --number NNNN reserva el número que asignó el Director si está libre en
 * todo el inventario y no pasa del siguiente; si no, no crea nada.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim();
}
const lines = (s) => s.split(/\r?\n/).filter(Boolean);
const directory = (kind) => kind === "specs" ? "docs/specs" : "supabase/migrations";
const pattern = (kind) => kind === "specs" ? /^docs\/specs\/(\d{4})(?!\d)/ : /^supabase\/migrations\/(\d{4})(?!\d)/;
export function takenNumbers(kind, refs, lsTree) {
  const taken = new Set();
  for (const ref of refs) for (const name of lsTree(ref, directory(kind))) {
    const match = name.match(pattern(kind));
    if (match) taken.add(Number(match[1]));
  }
  return taken;
}
export function nextFree(taken) { return (taken.size ? Math.max(...taken) : 0) + 1; }
const pad = (n) => String(n).padStart(4, "0");
const INTEGRATED_REF = "refs/remotes/origin/main";

/**
 * Números libres por encima de lo integrado y por debajo del siguiente. Es el
 * hueco que deja una reserva que salta (SDD-0545: la 0540 se reservó con la
 * 0539 libre y la reserva siguiente sacó la 0541). Los huecos por debajo de lo
 * integrado son historia y no se repiten en cada corrida.
 */
export function recentGaps(taken, integrated) {
  if (!integrated) return [];
  const gaps = [];
  for (let n = nextFree(integrated); n < nextFree(taken); n++) if (!taken.has(n)) gaps.push(n);
  return gaps;
}

/** Quién tiene cada número: `identidad (fuente)`, la primera fuente por identidad. */
function holdersOf(found, n) {
  return [...(found.holders?.specs?.get(pad(n)) ?? [])].map(([identity, source]) => `${identity} (${source})`).join("; ");
}

/**
 * `null` si el número que tocaría es el esperado. Si no, por qué no: el
 * esperado ya está ocupado (y por quién), es un hueco que --reserve no usa o
 * es mayor que el siguiente, más quién tiene los números intermedios.
 */
export function expectedMismatch(expected, found) {
  const next = nextFree(found.specs);
  const want = Number(expected);
  if (want === next) return null;
  const detail = [];
  if (found.specs.has(want)) detail.push(`${expected} ya está ocupada: ${holdersOf(found, want)}`);
  else if (want < next) detail.push(`${expected} está libre, pero --reserve toma el máximo + 1, no el primer hueco`);
  else detail.push(`${expected} es mayor que el siguiente libre`);
  for (let n = want + 1; n < next; n++) if (found.specs.has(n)) detail.push(`${pad(n)}: ${holdersOf(found, n)}`);
  return `Reserva cancelada: esperabas ${expected}, pero tocaría la ${pad(next)}. ${detail.join(". ")}. No se creó ninguna ref: confirma el número con el Director.`;
}

/**
 * `null` si se puede reservar `number`, el que asignó el Director: tiene que
 * estar libre en TODO el inventario (refs, ramas, reservas, PR abiertas, main
 * y archivos sin commit de los worktrees) y no pasar del siguiente, porque un
 * número por encima dejaría un hueco nuevo. Si no, por qué no.
 */
export function numberUnavailable(number, found) {
  const want = Number(number);
  const next = nextFree(found.specs);
  if (found.specs.has(want))
    return `Reserva cancelada: la ${number} ya está ocupada: ${holdersOf(found, want)}. No se creó ninguna ref.`;
  if (want > next)
    return `Reserva cancelada: la ${number} es mayor que la siguiente (${pad(next)}) y dejaría un hueco nuevo. No se creó ninguna ref.`;
  return null;
}

const USAGE = "Uso: next-number.mjs [--no-fetch | --reserve <slug> [--expect NNNN | --number NNNN] [--push]]";

export function parseArgs(argv) {
  const out = { noFetch: false, push: false, slug: null, expect: null, number: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--no-fetch" && !out.noFetch) out.noFetch = true;
    else if (arg === "--push" && !out.push) out.push = true;
    else if (arg === "--reserve" && out.slug === null) out.slug = argv[++i] ?? "";
    else if (arg === "--expect" && out.expect === null) out.expect = argv[++i] ?? "";
    else if (arg === "--number" && out.number === null) out.number = argv[++i] ?? "";
    else throw new Error(USAGE);
  }
  const numero = (v) => /^\d{4}$/.test(v) && Number(v) > 0;
  if ((out.slug !== null && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(out.slug)) ||
      (out.expect !== null && !numero(out.expect)) ||
      (out.number !== null && !numero(out.number)) ||
      (out.expect !== null && out.number !== null) ||
      ((out.push || out.expect !== null || out.number !== null) && out.slug === null))
    throw new Error(USAGE);
  return out;
}

function refresh() {
  git(["fetch", "--quiet", "origin", "+refs/heads/*:refs/remotes/origin/*"]);
  const remote = git(["remote", "get-url", "origin"]);
  const github = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!github) return;
  // REST pagination includes fork PRs; no silent gh pr list default limit.
  const numbers = lines(execFileSync("gh", ["api", "--paginate",
    `repos/${github[1]}/${github[2]}/pulls?state=open&per_page=100`, "--jq", ".[].number"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  for (const number of numbers) {
    if (!/^\d+$/.test(number)) throw new Error("Inventario PR inválido");
    git(["fetch", "--quiet", "origin", `+refs/pull/${number}/head:refs/dtd/pr/${number}`]);
  }
}

export function inventory() {
  const refs = lines(git(["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes", "refs/dtd"]));
  const sources = new Map();
  for (const ref of refs) sources.set(ref, lines(git(["ls-tree", "-r", "--name-only", ref, "--", "docs/specs", "supabase/migrations"])));
  const records = git(["worktree", "list", "--porcelain", "-z"]).split("\0\0").filter(Boolean);
  for (const record of records) {
    const fields = record.split("\0");
    if (fields.includes("bare")) continue;
    const root = fields.find((f) => f.startsWith("worktree "))?.slice(9);
    if (!root || !fs.statSync(root).isDirectory()) throw new Error(`Worktree no accesible: ${root}`);
    const names = [];
    for (const kind of ["specs", "migrations"]) {
      const dir = directory(kind);
      try {
        for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
          if (entry.isSymbolicLink()) throw new Error(`Inventario ambiguo: symlink ${root}/${dir}/${entry.name}`);
          names.push(`${dir}/${entry.name}`);
        }
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    sources.set(`worktree:${root}`, names);
  }
  const result = { refs: refs.length, collisions: [], holders: {}, integrated: {} };
  for (const kind of ["specs", "migrations"]) {
    result[kind] = takenNumbers(kind, [...sources.keys()], (ref) => sources.get(ref));
    // Lo integrado: sólo origin/main. Sin esa ref no hay base para hablar de huecos recientes.
    result.integrated[kind] = sources.has(INTEGRATED_REF)
      ? takenNumbers(kind, [INTEGRATED_REF], (ref) => sources.get(ref))
      : null;
    const identities = new Map();
    result.holders[kind] = identities;
    for (const [source, names] of sources) for (const name of names) {
      const match = name.match(pattern(kind));
      if (!match) continue;
      const identity = kind === "specs" ? name.split("/").slice(0, 3).join("/") : name;
      if (!identities.has(match[1])) identities.set(match[1], new Map());
      const variants = identities.get(match[1]);
      if (!variants.has(identity)) variants.set(identity, source);
    }
    for (const [number, variants] of identities) if (variants.size > 1)
      result.collisions.push(`${kind} ${number}: ${[...variants].map(([name, source]) => `${name} (${source})`).join("; ")}`);
  }
  return result;
}

export function prepareReservation(num, slug, today = new Date().toISOString().slice(0, 10)) {
  if (!/^\d{4}$/.test(num) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error("Número/slug inválido");
  const ref = `refs/heads/codex/sdd-reserve-${num}-${slug}`;
  const lock = `refs/dtd/reservations/${num}`;
  const rel = `docs/specs/${num}-${slug}/spec.md`;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "dtd-reserva-"));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: path.join(temp, "index") };
    const parent = git(["rev-parse", "refs/remotes/origin/main^{commit}"]);
    const stub = `---\nsdd: "${num}"\ntitle: "RESERVADO — ${slug}"\nstatus: draft\nauthor: "Codex"\ncreated: ${today}\nupdated: ${today}\nsupersedes: null\nsuperseded_by: null\nrelated: []\nconfidencialidad: interno\n---\n\n# SDD-${num} — RESERVADO\n\nReserva del ${today}. Completar en la rama de trabajo e integrar mediante PR.\n`;
    const blob = git(["hash-object", "-w", "--stdin"], { input: stub });
    git(["read-tree", parent], { env });
    git(["update-index", "--add", "--cacheinfo", `100644,${blob},${rel}`], { env });
    const tree = git(["write-tree"], { env });
    const commit = git(["commit-tree", tree, "-p", parent, "-m", `chore(sdd): reserva SDD-${num} — ${slug}`]);
    // Atomic create-only CAS for both a numeric lock and the descriptive branch.
    git(["update-ref", "--stdin"], { input: `start\ncreate ${lock} ${commit}\ncreate ${ref} ${commit}\nprepare\ncommit\n` });
    return { commit, ref, rel, remoteRef: `refs/heads/codex/sdd-reserve-${num}` };
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

export function publishReservation({ commit, remoteRef }) {
  if (!/^refs\/heads\/codex\/sdd-reserve-\d{4}$/.test(remoteRef) || !/^[a-f0-9]{40,64}$/.test(commit)) throw new Error("Destino de reserva inválido");
  // Empty expected value: creation only, even if another machine won after fetch.
  git(["push", "--no-follow-tags", `--force-with-lease=${remoteRef}:`, "origin", `${commit}:${remoteRef}`]);
}

function main(argv) {
  const { noFetch, push, slug, expect, number } = parseArgs(argv);
  if (noFetch && slug) throw new Error("--no-fetch es advisory: no permite reservar");
  if (!noFetch) {
    try { refresh(); } catch (error) {
      if (slug) throw new Error(`Reserva cancelada: fetch/inventario PR incompleto. ${error.message}`);
      console.warn(`ADVISORY: fetch/inventario PR incompleto. ${error.message}`);
    }
  } else console.warn("ADVISORY: sin fetch ni actualización de PR; no garantiza disponibilidad remota.");
  const found = inventory();
  for (const collision of found.collisions) console.warn(`ADVISORY colisión entre fuentes (puede ser histórica): ${collision}`);
  console.log(`${found.refs} refs + worktrees; spec siguiente: ${pad(nextFree(found.specs))}; migración siguiente: ${pad(nextFree(found.migrations))}`);
  const gaps = recentGaps(found.specs, found.integrated.specs);
  if (gaps.length > 0) {
    console.warn(`ADVISORY hueco reciente: ${gaps.map(pad).join(", ")} ${gaps.length === 1 ? "está libre" : "están libres"} ` +
      `entre lo integrado en origin/main (${pad(nextFree(found.integrated.specs) - 1)}) y la siguiente (${pad(nextFree(found.specs))}). ` +
      "--reserve no los usa: toma el máximo + 1. Si el Director te asignó uno de esos, resérvalo con --number NNNN; " +
      "si te asignó el siguiente, usa --expect NNNN.");
  }
  if (!slug) return;
  if (expect !== null) {
    const mismatch = expectedMismatch(expect, found);
    if (mismatch) throw new Error(mismatch);
  }
  if (number !== null) {
    const blocked = numberUnavailable(number, found);
    if (blocked) throw new Error(blocked);
  }
  // El lock numérico de prepareReservation es create-only: si otra sesión
  // tomó el mismo número después del inventario, esta reserva falla entera.
  const reservation = prepareReservation(number ?? pad(nextFree(found.specs)), slug);
  console.log(`Reserva local durable: ${reservation.ref}\nCommit: ${reservation.commit}\nArchivo: ${reservation.rel}`);
  if (push) {
    publishReservation(reservation);
    console.log(`Reserva publicada: ${reservation.remoteRef}. Integración únicamente mediante PR.`);
  } else console.log(`Pendiente de publicación remota (otras máquinas aún no la ven):\ngit push --no-follow-tags --force-with-lease=${reservation.remoteRef}: origin ${reservation.commit}:${reservation.remoteRef}\nIntegración únicamente mediante PR; no reutilices números de reservas abandonadas.`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
