// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SDD-0540 §2.5 · contrato de .github/workflows/build-image-prueba.yml.
 *
 * Solo a mano y con un SHA; variables `PRUEBA_*` del entorno `prueba`, con un
 * guard antes de construir; etiqueta única `prueba-sha-<sha>`; comprobación del
 * bundle sin red ANTES de publicar; ningún secret en los build-args. Cada regla
 * tiene su control rojo: el workflow mutado tiene que fallar.
 */
const fromEslint = createRequire(createRequire(import.meta.url).resolve("eslint/package.json"));
const { load: loadYaml } = fromEslint("js-yaml");

const TEXTO = readFileSync(resolve(".github/workflows/build-image-prueba.yml"), "utf8");
const WF = loadYaml(TEXTO);
// js-yaml lee la clave `on` como `true` (YAML 1.1): se aceptan las dos.
const disparos = (wf) => wf.on ?? wf[true];
const pasos = (wf) => wf.jobs["build-image-prueba"].steps;
const indice = (wf, pred) => pasos(wf).findIndex(pred);

function assertContrato(wf) {
  const on = disparos(wf);
  if (!on || typeof on !== "object") throw new Error("sin disparos");
  const claves = Object.keys(on);
  if (claves.length !== 1 || claves[0] !== "workflow_dispatch") throw new Error(`disparos: ${claves.join(", ")}`);
  if (on.workflow_dispatch?.inputs?.sha?.required !== true) throw new Error("falta el input sha obligatorio");

  const job = wf.jobs["build-image-prueba"];
  if (job.environment !== "prueba") throw new Error("el job no usa el entorno prueba");
  if (Object.hasOwn(job, "if") || Object.hasOwn(job, "continue-on-error")) throw new Error("job condicionado o tolerante");
  const permisos = wf.permissions ?? {};
  const escritura = Object.entries(permisos).filter(([, v]) => v === "write").map(([k]) => k);
  if (escritura.join(",") !== "packages") throw new Error(`permisos de escritura: ${escritura.join(",")}`);

  const guard = indice(wf, (s) => /PRUEBA_SUPABASE_URL/.test(s.run ?? "") && /exit "\$\{mal\}"/.test(s.run ?? ""));
  if (guard < 0) throw new Error("falta el guard de las variables de prueba");
  const g = pasos(wf)[guard];
  if (Object.hasOwn(g, "if") || Object.hasOwn(g, "continue-on-error")) throw new Error("guard condicionado o tolerante");
  for (const v of ["PRUEBA_SITE_URL", "PRUEBA_SUPABASE_URL", "PRUEBA_SUPABASE_ANON_KEY", "PRUEBA_AUTH_COOKIE"]) {
    if (!new RegExp(`for v in [^;]*\\b${v}\\b`).test(g.run)) throw new Error(`el guard no exige ${v}`);
  }
  if (!g.run.includes('"https://${PRUEBA_HOST}"')) throw new Error("el guard no fija la URL de Supabase de prueba");
  if (wf.jobs["build-image-prueba"].env?.PRUEBA_HOST !== "supabase-prueba.dtdcargo.com") throw new Error("PRUEBA_HOST no es supabase-prueba.dtdcargo.com");
  if (!/\$\{PROD_HOST\}/.test(g.run) || !/\$\{CLOUD_REF\}/.test(g.run)) throw new Error("el guard no busca producción ni la ref de Cloud");

  const build = indice(wf, (s) => /docker\/build-push-action@/.test(s.uses ?? ""));
  const bundle = indice(wf, (s) => /--network none/.test(s.run ?? ""));
  const push = indice(wf, (s) => /docker push/.test(s.run ?? ""));
  if (!(guard < build && build < bundle && bundle < push)) throw new Error("orden: guard → build → bundle → push");
  const b = pasos(wf)[build].with;
  if (b.push !== false) throw new Error("el build publica antes de comprobar el bundle");
  const tagsDelBuild = String(b.tags).split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
  if (tagsDelBuild.length !== 1 || !/:prueba-sha-\$\{\{ inputs\.sha \}\}$/.test(tagsDelBuild[0])) throw new Error(`etiquetas: ${tagsDelBuild}`);
  if (!/"\$\{IMAGE\}:prueba-sha-\$\{SHA\}"$/.test(pasos(wf)[push].run.trim())) throw new Error("docker push sin el prefijo prueba-sha-");
  const args = String(b["build-args"] ?? "");
  if (/secrets\./.test(args)) throw new Error("un secret en build-args");
  if (/vars\.NEXT_PUBLIC_/.test(args)) throw new Error("build-args con variables de producción");
  const valores = args.split("\n").filter(Boolean).map((l) => l.slice(l.indexOf("=") + 1));
  for (const v of valores) {
    if (!/^\$\{\{ (vars\.PRUEBA_[A-Z_]+|inputs\.sha) \}\}$/.test(v)) throw new Error(`build-arg fuera de PRUEBA_* o el sha: ${v}`);
  }
  const chequeo = pasos(wf)[bundle].run;
  if (!/c_prueba.*-ge 1/.test(chequeo) || !/c_prod.*-eq 0 && .*c_ref.*-eq 0/.test(chequeo)) throw new Error("el chequeo del bundle no exige host de prueba ≥ 1 y producción/Cloud = 0");
  for (const s of pasos(wf)) {
    if (Object.hasOwn(s, "continue-on-error")) throw new Error(`paso tolerante: ${s.name}`);
  }
}

describe("SDD-0540 · workflow de la imagen de prueba", () => {
  it("cumple el contrato", () => {
    expect(() => assertContrato(WF)).not.toThrow();
  });

  it("no publica nunca etiquetas de producción", () => {
    // Sin los comentarios: la cabecera explica justo lo que no se hace.
    const codigo = TEXTO.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    expect(codigo).not.toMatch(/type=sha|prefix=sha-|:main\b|latest/);
    // Los disparos (solo workflow_dispatch) los revisa assertContrato sobre el YAML.
    expect(codigo).not.toMatch(/pull_request_target|workflow_run|schedule:/);
    // Los `uses:` van fijados por SHA, como en build-image.yml.
    for (const m of TEXTO.matchAll(/^\s+uses:\s+(\S+)/gm)) expect(m[1]).toMatch(/@[0-9a-f]{40}$/);
    expect(TEXTO).toMatch(/persist-credentials: false/);
  });

  it("el SHA del input no entra crudo a ningún script", () => {
    for (const s of pasos(WF)) expect(s.run ?? "").not.toMatch(/\$\{\{/);
  });

  it.each([
    ["se agrega push", (wf) => { disparos(wf).push = { branches: ["main"] }; }],
    ["se agrega pull_request", (wf) => { disparos(wf).pull_request = {}; }],
    ["el sha deja de ser obligatorio", (wf) => { disparos(wf).workflow_dispatch.inputs.sha.required = false; }],
    ["sin entorno prueba", (wf) => { delete wf.jobs["build-image-prueba"].environment; }],
    ["se quita el guard", (wf) => { wf.jobs["build-image-prueba"].steps.splice(0, 1); }],
    ["guard tolerante", (wf) => { wf.jobs["build-image-prueba"].steps[0]["continue-on-error"] = true; }],
    ["etiqueta sha- de producción", (wf) => {
      const b = pasos(wf).find((s) => /build-push-action/.test(s.uses ?? ""));
      b.with.tags = "${{ env.IMAGE }}:sha-${{ inputs.sha }}";
    }],
    ["etiqueta :main extra", (wf) => {
      const b = pasos(wf).find((s) => /build-push-action/.test(s.uses ?? ""));
      b.with.tags = `${b.with.tags}\n\${{ env.IMAGE }}:main`;
    }],
    ["el build publica directo", (wf) => {
      pasos(wf).find((s) => /build-push-action/.test(s.uses ?? "")).with.push = true;
    }],
    ["un secret en build-args", (wf) => {
      const b = pasos(wf).find((s) => /build-push-action/.test(s.uses ?? ""));
      b.with["build-args"] += "SUPABASE_SERVICE_ROLE_KEY=${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}\n";
    }],
    ["una variable de producción en build-args", (wf) => {
      const b = pasos(wf).find((s) => /build-push-action/.test(s.uses ?? ""));
      b.with["build-args"] = b.with["build-args"].replace("vars.PRUEBA_SUPABASE_URL", "vars.NEXT_PUBLIC_SUPABASE_URL");
    }],
    ["push antes del chequeo del bundle", (wf) => {
      const st = pasos(wf);
      const i = st.findIndex((s) => /docker push/.test(s.run ?? ""));
      const [p] = st.splice(i, 1);
      st.splice(st.findIndex((s) => /--network none/.test(s.run ?? "")), 0, p);
    }],
    ["sin chequeo del bundle", (wf) => {
      const st = pasos(wf);
      st.splice(st.findIndex((s) => /--network none/.test(s.run ?? "")), 1);
    }],
  ])("rechaza: %s", (_n, mutar) => {
    const wf = structuredClone(WF);
    mutar(wf);
    expect(() => assertContrato(wf)).toThrow();
  });
});
