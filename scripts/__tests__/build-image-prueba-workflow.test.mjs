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
 *
 * SDD-0544 (Fase 2): dos build-args fijos, `APP_ENV=staging` y
 * `NEXT_PUBLIC_GA_ID=off`, y el chequeo del bundle exige 0 archivos de
 * `.next/static` con Google Analytics o Ads. El Dockerfile recibe `APP_ENV` como
 * ARG de la etapa build y producción (`build-image.yml`) no manda ninguno de los
 * dos.
 */
const fromEslint = createRequire(createRequire(import.meta.url).resolve("eslint/package.json"));
const { load: loadYaml } = fromEslint("js-yaml");

const TEXTO = readFileSync(resolve(".github/workflows/build-image-prueba.yml"), "utf8");
const WF = loadYaml(TEXTO);
const DOCKERFILE = readFileSync(resolve("Dockerfile"), "utf8");
const PRODUCCION = readFileSync(resolve(".github/workflows/build-image.yml"), "utf8");
/** Build-args fijos de la SDD-0544: no salen de variables y tienen que estar. */
const FIJOS = ["APP_ENV=staging", "NEXT_PUBLIC_GA_ID=off"];
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
  const lineas = args.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const fijo of FIJOS) {
    if (!lineas.includes(fijo)) throw new Error(`falta el build-arg fijo ${fijo}`);
  }
  for (const l of lineas.filter((x) => !FIJOS.includes(x))) {
    const v = l.slice(l.indexOf("=") + 1);
    if (!/^\$\{\{ (vars\.PRUEBA_[A-Z_]+|inputs\.sha) \}\}$/.test(v)) throw new Error(`build-arg fuera de PRUEBA_*, el sha o los fijos: ${l}`);
  }
  const nombres = lineas.map((l) => l.slice(0, l.indexOf("=")));
  if (new Set(nombres).size !== nombres.length) throw new Error("un build-arg repetido: el último pisaría al fijo");
  const chequeo = pasos(wf)[bundle].run;
  if (!/c_prueba.*-ge 1/.test(chequeo) || !/c_prod.*-eq 0 && .*c_ref.*-eq 0/.test(chequeo)) throw new Error("el chequeo del bundle no exige host de prueba ≥ 1 y producción/Cloud = 0");
  // GA y Ads: se cuentan en .next/static (lo que baja el navegador), con JS ahí.
  if (!/s\(\) \{ grep -rlF -- "\$1" \/app\/\.next\/static /.test(chequeo)) throw new Error("GA y Ads no se cuentan en /app/.next/static");
  if (!/\$\(s G-25CD7BZH98\) \$\(s AW-561290482\)/.test(chequeo)) throw new Error("no se cuentan los dos IDs en .next/static");
  if (!/n_js.*-ge 1/.test(chequeo)) throw new Error("el chequeo no exige JS en .next/static");
  if (!/s_ga.*-eq 0 && .*s_ads.*-eq 0/.test(chequeo)) throw new Error("el chequeo no exige 0 archivos con GA y Ads en .next/static");
  for (const s of pasos(wf)) {
    if (Object.hasOwn(s, "continue-on-error")) throw new Error(`paso tolerante: ${s.name}`);
  }
}

/** Etapas del Dockerfile por nombre (`FROM … AS <nombre>`). */
function etapas(texto) {
  const out = {};
  for (const bloque of texto.split(/^FROM /m).slice(1)) {
    const nombre = bloque.split("\n")[0].match(/\bAS (\S+)/)?.[1];
    if (nombre) out[nombre] = bloque;
  }
  return out;
}

/**
 * `APP_ENV` entra como ARG de la etapa build, antes de `next build`, y nunca
 * como ENV: un ENV quedaría en la imagen y el runner tiene que tomar el entorno
 * del `.env` del servidor.
 */
function assertDockerfile(texto) {
  const { build, runner } = etapas(texto);
  if (!build || !runner) throw new Error("no encuentro las etapas build y runner");
  const arg = build.search(/^ARG APP_ENV\s*$/m);
  const compila = build.search(/^RUN pnpm exec next build\s*$/m);
  if (arg < 0) throw new Error("falta ARG APP_ENV en la etapa build");
  if (compila < 0) throw new Error("no encuentro RUN pnpm exec next build");
  if (arg > compila) throw new Error("ARG APP_ENV después de next build: el build no lo ve");
  const sinComentarios = texto.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
  if (/^ENV\s[^\n]*\bAPP_ENV\b|^\s+APP_ENV=/m.test(sinComentarios)) throw new Error("APP_ENV como ENV: quedaría en la imagen");
  if (/APP_ENV/.test(runner)) throw new Error("APP_ENV en la etapa runner");
}

/** Producción no cambia: ni APP_ENV ni el apagado de GA en build-image.yml. */
function assertProduccion(texto) {
  const codigo = texto.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
  if (/\bAPP_ENV\s*=/.test(codigo)) throw new Error("build-image.yml manda APP_ENV");
  if (/NEXT_PUBLIC_GA_ID\s*=\s*off\b/.test(codigo)) throw new Error("build-image.yml apaga GA");
  if (!/^\s*NEXT_PUBLIC_GA_ID=\$\{\{ vars\.NEXT_PUBLIC_GA_ID \}\}\s*$/m.test(codigo)) {
    throw new Error("el GA de producción ya no sale de la variable del repositorio");
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
    // SDD-0544 · los dos build-args fijos y el chequeo de GA y Ads.
    ["sin NEXT_PUBLIC_GA_ID=off", (wf) => {
      const b = pasos(wf).find((s) => /build-push-action/.test(s.uses ?? ""));
      b.with["build-args"] = b.with["build-args"].replace("NEXT_PUBLIC_GA_ID=off\n", "");
    }],
    ["GA con el valor vacío, que cae al ID real", (wf) => {
      const b = pasos(wf).find((s) => /build-push-action/.test(s.uses ?? ""));
      b.with["build-args"] = b.with["build-args"].replace("NEXT_PUBLIC_GA_ID=off", "NEXT_PUBLIC_GA_ID=");
    }],
    ["un segundo NEXT_PUBLIC_GA_ID pisa el apagado", (wf) => {
      const b = pasos(wf).find((s) => /build-push-action/.test(s.uses ?? ""));
      b.with["build-args"] += "NEXT_PUBLIC_GA_ID=${{ vars.PRUEBA_GA_ID }}\n";
    }],
    ["sin APP_ENV=staging", (wf) => {
      const b = pasos(wf).find((s) => /build-push-action/.test(s.uses ?? ""));
      b.with["build-args"] = b.with["build-args"].replace("APP_ENV=staging\n", "");
    }],
    ["APP_ENV de producción", (wf) => {
      const b = pasos(wf).find((s) => /build-push-action/.test(s.uses ?? ""));
      b.with["build-args"] = b.with["build-args"].replace("APP_ENV=staging", "APP_ENV=production");
    }],
    ["GA y Ads contados en todo .next y no en .next/static", (wf) => {
      const s = pasos(wf).find((x) => /--network none/.test(x.run ?? ""));
      s.run = s.run.replace('/app/.next/static 2>/dev/null | wc -l; }', '/app/.next 2>/dev/null | wc -l; }');
    }],
    ["GA en el bundle no hace fallar", (wf) => {
      const s = pasos(wf).find((x) => /--network none/.test(x.run ?? ""));
      s.run = s.run.split("\n").filter((l) => !/s_ga.*-eq 0/.test(l)).join("\n");
    }],
    ["sin exigir JS en .next/static", (wf) => {
      const s = pasos(wf).find((x) => /--network none/.test(x.run ?? ""));
      s.run = s.run.split("\n").filter((l) => !/n_js.*-ge 1/.test(l)).join("\n");
    }],
  ])("rechaza: %s", (_n, mutar) => {
    const wf = structuredClone(WF);
    mutar(wf);
    expect(() => assertContrato(wf)).toThrow();
  });
});

describe("SDD-0544 · Dockerfile y workflow de producción", () => {
  it("el Dockerfile recibe APP_ENV como ARG de la etapa build", () => {
    expect(() => assertDockerfile(DOCKERFILE)).not.toThrow();
  });

  it("build-image.yml (producción) no manda APP_ENV ni apaga GA", () => {
    expect(() => assertProduccion(PRODUCCION)).not.toThrow();
  });

  it.each([
    ["sin ARG APP_ENV", (t) => t.replace(/^ARG APP_ENV\n/m, "")],
    ["ARG APP_ENV después de next build", (t) =>
      t.replace(/^ARG APP_ENV\n/m, "").replace(/^RUN pnpm exec next build\n/m, "RUN pnpm exec next build\nARG APP_ENV\n")],
    ["APP_ENV como ENV en la etapa build", (t) => t.replace(/^ARG APP_ENV\n/m, "ARG APP_ENV\nENV APP_ENV=${APP_ENV}\n")],
    ["APP_ENV en el runner", (t) => t.replace(/^USER node\n/m, "ENV APP_ENV=staging\nUSER node\n")],
  ])("Dockerfile rechaza: %s", (_n, mutar) => {
    const mutado = mutar(DOCKERFILE);
    expect(mutado).not.toBe(DOCKERFILE);
    expect(() => assertDockerfile(mutado)).toThrow();
  });

  it.each([
    ["APP_ENV en los build-args", (t) =>
      t.replace(/^(\s*)NEXT_PUBLIC_GA_ID=\$\{\{ vars\.NEXT_PUBLIC_GA_ID \}\}$/m, "$1APP_ENV=staging\n$&")],
    ["GA apagado en producción", (t) =>
      t.replace(/NEXT_PUBLIC_GA_ID=\$\{\{ vars\.NEXT_PUBLIC_GA_ID \}\}/, "NEXT_PUBLIC_GA_ID=off")],
  ])("build-image.yml rechaza: %s", (_n, mutar) => {
    const mutado = mutar(PRODUCCION);
    expect(mutado).not.toBe(PRODUCCION);
    expect(() => assertProduccion(mutado)).toThrow();
  });
});
