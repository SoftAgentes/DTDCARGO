/** Inventario global y reservas SDD en ramas: nunca publica ni modifica main.
 * --no-fetch es advisory y no permite reservar. --reserve <slug> crea refs
 * locales durables; --push publica exclusivamente la reserva canónica.
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
  const result = { refs: refs.length, collisions: [] };
  for (const kind of ["specs", "migrations"]) {
    result[kind] = takenNumbers(kind, [...sources.keys()], (ref) => sources.get(ref));
    const identities = new Map();
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
  const noFetch = argv.includes("--no-fetch");
  const push = argv.includes("--push");
  const index = argv.indexOf("--reserve");
  const slug = index < 0 ? null : argv[index + 1];
  const allowed = argv.filter((_, i) => i !== index + 1 || index < 0);
  if (allowed.some((a) => !["--no-fetch", "--push", "--reserve"].includes(a)) ||
      (index >= 0 && (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))) || (push && !slug))
    throw new Error("Uso: next-number.mjs [--no-fetch | --reserve <slug> [--push]]");
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
  if (!slug) return;
  const reservation = prepareReservation(pad(nextFree(found.specs)), slug);
  console.log(`Reserva local durable: ${reservation.ref}\nCommit: ${reservation.commit}\nArchivo: ${reservation.rel}`);
  if (push) {
    publishReservation(reservation);
    console.log(`Reserva publicada: ${reservation.remoteRef}. Integración únicamente mediante PR.`);
  } else console.log(`Pendiente de publicación remota (otras máquinas aún no la ven):\ngit push --no-follow-tags --force-with-lease=${reservation.remoteRef}: origin ${reservation.commit}:${reservation.remoteRef}\nIntegración únicamente mediante PR; no reutilices números de reservas abandonadas.`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
