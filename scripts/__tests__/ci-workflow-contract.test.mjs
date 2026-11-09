// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(resolve(".github/workflows/quality.yml"), "utf8");

describe("SDD-0349 · CI de calidad sin secretos", () => {
  it("se ejecuta en main y manualmente sin eventos privilegiados", () => {
    expect(workflow).toMatch(/^on:\s*$/m);
    expect(workflow).toMatch(/^  pull_request:\s*$/m);
    expect(workflow).toMatch(/^  push:\s*$/m);
    expect(workflow).toMatch(/^  workflow_dispatch:\s*$/m);
    expect(workflow.match(/^\s*-\s*main\s*$/gm)).toHaveLength(2);
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("workflow_run");
  });

  it("opera con permisos minimos y checkout sin credenciales persistentes", () => {
    expect(workflow).toMatch(/^permissions:\s*\n  contents: read\s*$/m);
    expect(workflow).toMatch(/^\s+persist-credentials: false\s*$/m);
    expect(workflow).not.toMatch(/:\s*write\s*$/m);
    expect(workflow).not.toMatch(/\bsecrets\./);
  });

  it("fija las acciones por SHA y el runtime soportado por el repo", () => {
    const usesLines = [...workflow.matchAll(/^\s+uses:\s+([^\s#]+)\s+#\s+(\S+)\s*$/gm)];

    expect(usesLines.map((match) => match[1])).toEqual([
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/setup@703c52620218391530e48b9e8870d5c0082e1b9b",
      "denoland/setup-deno@22d081ff2d3a40755e97629de92e3bcbfa7cf2ed",
    ]);
    expect(usesLines.map((match) => match[2])).toEqual(["v7.0.1", "v2.1.0", "v2.0.5"]);
    expect(workflow).toMatch(/^\s+version: 11\.19\.0\s*$/m);
    expect(workflow).toMatch(/^\s+runtime: node@24\.22\.1\s*$/m);
    expect(workflow).toMatch(/^\s+deno-version: v2\.x\s*$/m);
  });

  it("ejecuta todos los gates locales elegibles en orden", () => {
    const commands = [...workflow.matchAll(/^\s+run:\s+(.+)$/gm)].map((match) => match[1]);

    expect(commands).toEqual([
      "pnpm install --frozen-lockfile",
      "pnpm lint",
      "node scripts/check-rsc-boundary.mjs",
      "pnpm typecheck",
      "pnpm edge:check",
      "pnpm test --maxWorkers=100%",
      "pnpm harness:test",
      "bash infra/ops/tests/pruebas-linux.sh",
      "pnpm docs:check",
      "pnpm sdd:check",
      "node scripts/check-pending-migration-symbols.mjs",
      "node scripts/check-feature-constants.mjs",
      "pnpm components:check",
      "pnpm governance:check",
      "node scripts/check-build.mjs",
      "git diff --exit-code",
    ]);
  });

  it("deja fuera los gates que requieren Docker, navegador o estado alojado", () => {
    expect(workflow).not.toMatch(/run-sql-tests|check-schema-rebuild|test:e2e/i);
    expect(workflow).not.toMatch(/migrations-applied|supabase|vercel|deploy/i);
    expect(workflow).toMatch(/^\s+runs-on: ubuntu-24\.04\s*$/m);
    expect(workflow).toMatch(/^\s+timeout-minutes: 60\s*$/m);
    expect(workflow).toMatch(/^\s+cancel-in-progress: true\s*$/m);
  });

  it("fija heap explicito para TypeScript y build sin omitir sus fallos", () => {
    const steps = workflow.split(/^      - name: /m).slice(1);
    const configured = steps.filter((step) => /NODE_OPTIONS:/.test(step));

    expect(workflow.split(/^    steps:/m)[0]).not.toContain("NODE_OPTIONS");
    expect(configured.map((step) => step.split(/\r?\n/)[0])).toEqual([
      "TypeScript",
      "Build de produccion sin secretos",
    ]);
    for (const step of configured) {
      expect(step).toMatch(/^        env:\r?\n          NODE_OPTIONS: "--max-old-space-size=4096"\s*$/m);
    }
    expect(workflow).not.toMatch(/continue-on-error|ignoreBuildErrors/);
  });
});

// Parsear YAML distingue un paso ejecutable de texto que solo menciona el comando.
// ESLint ya declara js-yaml: resolver desde él evita añadir un manifest/lockfile.
const fromEslint = createRequire(createRequire(import.meta.url).resolve("eslint/package.json"));
const { load: loadYaml } = fromEslint("js-yaml");

/**
 * SDD-0621: la única condición que puede llevar un job de PR es la que lo salta en borrador. Cualquier otra
 * (`false`, solo en push, invertida) apaga el portón; por eso se compara el texto exacto y no «tiene un if».
 */
const SOLO_FUERA_DE_BORRADOR = "github.event_name != 'pull_request' || !github.event.pull_request.draft";

function condicionDelJobPermitida(job) {
  return !Object.hasOwn(job, "if") || job.if === SOLO_FUERA_DE_BORRADOR;
}

function assertRequiredHarness(job) {
  if (!job || !condicionDelJobPermitida(job) || Object.hasOwn(job, "continue-on-error")) {
    throw new Error("El job de calidad debe ser obligatorio y propagar fallos");
  }
  const steps = job.steps?.filter((step) => step.run?.trim() === "pnpm harness:test") ?? [];
  if (steps.length !== 1) {
    throw new Error("Falta un único paso ejecutable pnpm harness:test");
  }
  const step = steps[0];
  if (Object.hasOwn(step, "if") || Object.hasOwn(step, "continue-on-error")) {
    throw new Error("El harness debe ejecutarse sin condición ni tolerancia de errores");
  }
}

describe("SDD-0444 · el harness es obligatorio en CI", () => {
  const qualityJob = loadYaml(workflow).jobs.quality;

  it("ejecuta el runner Node como paso obligatorio y propaga su resultado", () => {
    expect(() => assertRequiredHarness(qualityJob)).not.toThrow();
  });

  it.each([
    ["paso eliminado", (job) => {
      job.steps = job.steps.filter((step) => step.run !== "pnpm harness:test");
    }],
    ["comando solo impreso", (job) => {
      job.steps.find((step) => step.run === "pnpm harness:test").run = "echo pnpm harness:test";
    }],
    ["fallo oculto por el shell", (job) => {
      job.steps.find((step) => step.run === "pnpm harness:test").run += " || true";
    }],
    ["paso desactivado", (job) => {
      job.steps.find((step) => step.run === "pnpm harness:test").if = false;
    }],
    ["paso condicionado", (job) => {
      job.steps.find((step) => step.run === "pnpm harness:test").if = "github.event_name == 'workflow_dispatch'";
    }],
    ["error del paso ignorado", (job) => {
      job.steps.find((step) => step.run === "pnpm harness:test")["continue-on-error"] = true;
    }],
    ["job desactivado", (job) => { job.if = false; }],
    ["error del job ignorado", (job) => { job["continue-on-error"] = true; }],
  ])("rechaza %s", (_name, mutate) => {
    const job = structuredClone(qualityJob);
    mutate(job);
    expect(() => assertRequiredHarness(job)).toThrow();
  });

  it("una mención del comando en un comentario no sustituye el paso", () => {
    const commented = workflow.replace("run: pnpm harness:test", "# run: pnpm harness:test");
    expect(() => assertRequiredHarness(loadYaml(commented).jobs.quality)).toThrow();
  });
});

function assertRequiredPendingMigrationSymbols(job) {
  if (!job || !condicionDelJobPermitida(job) || Object.hasOwn(job, "continue-on-error")) {
    throw new Error("El job de calidad debe ser obligatorio y propagar fallos");
  }
  const command = "node scripts/check-pending-migration-symbols.mjs";
  const steps = job.steps?.filter((step) => step.run?.trim() === command) ?? [];
  if (steps.length !== 1) {
    throw new Error("Falta un único paso ejecutable para símbolos de migraciones pendientes");
  }
  if (Object.hasOwn(steps[0], "if") || Object.hasOwn(steps[0], "continue-on-error")) {
    throw new Error("El check de símbolos pendientes debe correr sin condición ni tolerancia de errores");
  }
}

describe("SDD-0450 · el check repo contra repo es obligatorio en CI", () => {
  const qualityJob = loadYaml(workflow).jobs.quality;
  const command = "node scripts/check-pending-migration-symbols.mjs";

  it("ejecuta el check como paso propio y propaga su resultado", () => {
    expect(() => assertRequiredPendingMigrationSymbols(qualityJob)).not.toThrow();
  });

  it.each([
    ["paso eliminado", (job) => {
      job.steps = job.steps.filter((step) => step.run !== command);
    }],
    ["comando solo impreso", (job) => {
      job.steps.find((step) => step.run === command).run = `echo ${command}`;
    }],
    ["fallo oculto por el shell", (job) => {
      job.steps.find((step) => step.run === command).run += " || true";
    }],
    ["paso condicionado", (job) => {
      job.steps.find((step) => step.run === command).if = "github.event_name == 'workflow_dispatch'";
    }],
    ["error ignorado", (job) => {
      job.steps.find((step) => step.run === command)["continue-on-error"] = true;
    }],
  ])("rechaza %s", (_name, mutate) => {
    const job = structuredClone(qualityJob);
    mutate(job);
    expect(() => assertRequiredPendingMigrationSymbols(job)).toThrow();
  });
});

const UNITARIOS = "pnpm test --maxWorkers=100%";

/**
 * Paralelizar acelera; no puede recortar. El paso corre la suite entera, con un
 * worker por vCPU (en serie excedió el tope el 2026-10-20) y sin tolerar fallos.
 */
function assertFullUnitSuite(job) {
  if (!job || !condicionDelJobPermitida(job) || Object.hasOwn(job, "continue-on-error")) {
    throw new Error("El job de calidad debe ser obligatorio y propagar fallos");
  }
  const steps = job.steps?.filter((step) => /^pnpm test\b/.test(step.run?.trim() ?? "")) ?? [];
  if (steps.length !== 1 || steps[0].run.trim() !== UNITARIOS) {
    throw new Error(`Falta un único paso ejecutable ${UNITARIOS}, sin filtros ni shard`);
  }
  const step = steps[0];
  if (Object.hasOwn(step, "if") || Object.hasOwn(step, "continue-on-error")) {
    throw new Error("Los unitarios deben correr sin condición ni tolerancia de errores");
  }
  if (/VITEST_/.test(JSON.stringify([job.env ?? {}, step.env ?? {}]))) {
    throw new Error("El CI no puede reconfigurar Vitest por variables de entorno");
  }
}

describe("CI · los unitarios corren completos y en paralelo", () => {
  const qualityJob = loadYaml(workflow).jobs.quality;
  const unitarios = (job) => job.steps.find((step) => step.run === UNITARIOS);

  it("corre la suite entera con un worker por vCPU y propaga su resultado", () => {
    expect(() => assertFullUnitSuite(qualityJob)).not.toThrow();
  });

  it.each([
    ["paso eliminado", (job) => { job.steps = job.steps.filter((step) => step.run !== UNITARIOS); }],
    ["vuelta a un solo worker", (job) => { unitarios(job).run = "pnpm test --maxWorkers=1"; }],
    ["paralelismo quitado", (job) => { unitarios(job).run = "pnpm test"; }],
    ["suite partida en shards", (job) => { unitarios(job).run += " --shard=1/2"; }],
    ["filtro de archivos", (job) => { unitarios(job).run += " scripts/"; }],
    ["fallo oculto por el shell", (job) => { unitarios(job).run += " || true"; }],
    ["paso condicionado", (job) => { unitarios(job).if = "github.event_name == 'push'"; }],
    ["error ignorado", (job) => { unitarios(job)["continue-on-error"] = true; }],
    ["workers por variable en el paso", (job) => { unitarios(job).env = { VITEST_MAX_WORKERS: "1" }; }],
    ["workers por variable en el job", (job) => { job.env = { ...job.env, VITEST_MAX_WORKERS: "1" }; }],
  ])("rechaza %s", (_name, mutate) => {
    const job = structuredClone(qualityJob);
    mutate(job);
    expect(() => assertFullUnitSuite(job)).toThrow();
  });
});

const OPS_BASH = "bash infra/ops/tests/pruebas-linux.sh";

function assertRequiredOpsBash(job) {
  if (!job || !condicionDelJobPermitida(job) || Object.hasOwn(job, "continue-on-error")) {
    throw new Error("El job de calidad debe ser obligatorio y propagar fallos");
  }
  const steps = job.steps?.filter((step) => step.run?.trim() === OPS_BASH) ?? [];
  if (steps.length !== 1) {
    throw new Error("Falta un único paso ejecutable para las pruebas bash de operaciones");
  }
  const step = steps[0];
  if (Object.hasOwn(step, "if") || Object.hasOwn(step, "continue-on-error")) {
    throw new Error("Las pruebas bash deben correr sin condición ni tolerancia de errores");
  }
  // PRUEBAS_LINUX_LISTA y PRUEBAS_LINUX_TOPE_S cambian la lista y el tope del
  // runner: sólo los usa su propia prueba.
  if (/PRUEBAS_LINUX_/.test(JSON.stringify([job.env ?? {}, step.env ?? {}]))) {
    throw new Error("El CI no puede reemplazar la lista ni el tope de las pruebas bash");
  }
}

describe("SDD-0550 · las pruebas bash de operaciones son obligatorias en CI", () => {
  const parsed = loadYaml(workflow);
  const qualityJob = parsed.jobs.quality;

  it("corre el runner como paso propio, en ubuntu, y propaga su resultado", () => {
    expect(() => assertRequiredOpsBash(qualityJob)).not.toThrow();
    expect(qualityJob["runs-on"]).toBe("ubuntu-24.04");
    expect(workflow).not.toContain("PRUEBAS_LINUX_");
  });

  it.each([
    ["paso eliminado", (job) => {
      job.steps = job.steps.filter((step) => step.run !== OPS_BASH);
    }],
    ["comando solo impreso", (job) => {
      job.steps.find((step) => step.run === OPS_BASH).run = `echo ${OPS_BASH}`;
    }],
    ["fallo oculto por el shell", (job) => {
      job.steps.find((step) => step.run === OPS_BASH).run += " || true";
    }],
    ["paso condicionado", (job) => {
      job.steps.find((step) => step.run === OPS_BASH).if = "github.event_name == 'workflow_dispatch'";
    }],
    ["error ignorado", (job) => {
      job.steps.find((step) => step.run === OPS_BASH)["continue-on-error"] = true;
    }],
    ["lista reemplazada en el paso", (job) => {
      job.steps.find((step) => step.run === OPS_BASH).env = { PRUEBAS_LINUX_LISTA: "infra/ops/tests/prueba-prompt-trim.sh" };
    }],
    ["lista reemplazada en el job", (job) => {
      job.env = { ...job.env, PRUEBAS_LINUX_LISTA: "infra/ops/tests/prueba-prompt-trim.sh" };
    }],
    ["tope cambiado en el paso", (job) => {
      job.steps.find((step) => step.run === OPS_BASH).env = { PRUEBAS_LINUX_TOPE_S: "1" };
    }],
  ])("rechaza %s", (_name, mutate) => {
    const job = structuredClone(qualityJob);
    mutate(job);
    expect(() => assertRequiredOpsBash(job)).toThrow();
  });
});

/**
 * Toda prueba bash de infra/ops/tests corre en algún lado o dice por qué no.
 * Las de la 0541 y la 0543 quedaron fuera de Vitest y del CI sin que nada
 * avisara: una prueba nueva sin clasificar rompe aquí.
 */
const EN_VITEST = {
  "prueba-scripts-entorno-prueba.sh": "scripts/__tests__/entorno-prueba-scripts.test.mjs",
  "prueba-aplicar-migracion.sh": "scripts/__tests__/entorno-prueba-scripts.test.mjs",
  "prueba-smoke-web-credenciales.sh": "scripts/__tests__/entorno-prueba-scripts.test.mjs",
  "prueba-migraciones-produccion.sh": "infra/ops/tests/migraciones.test.mjs",
};
const FUERA_DEL_CI = {
  "prueba-aplicar-migracion-efimera.sh": "corrida pesada: Postgres efímero en Docker",
  "prueba-resetear-base-efimera.sh": "corrida pesada: Postgres, GoTrue y storage efímeros en Docker",
  "prueba-compose-prueba.sh": "pide Docker con compose v2",
  "prueba-backup-dtd.sh": "en el VPS como root, con un contenedor de Docker",
  "prueba-env-set.sh": "en el VPS: python3 y docker compose",
  "prueba-jwks-sesiones.sh": "en el VPS, contra un stack de Supabase levantado",
  "prueba-new-age-key.sh": "en el VPS, con un servidor tmux propio",
  "prueba-respaldo-b2.sh": "contra el bucket real de respaldos",
  "prueba-set-remote.sh": "en el VPS: S3 falso en Docker",
  "prueba-storage-from-cloud.sh": "en el staging del VPS",
  "prueba-traslado-y-respaldos.sh": "integración con contenedores de Docker",
};

function listaDelRunner(texto) {
  const bloque = texto.match(/^PRUEBAS=\(\r?\n([\s\S]*?)^\)\r?$/m)?.[1];
  if (!bloque) throw new Error("no encuentro la lista PRUEBAS=( … ) de pruebas-linux.sh");
  return bloque
    .split(/\r?\n/)
    .map((linea) => linea.replace(/#.*/, "").trim())
    .filter(Boolean);
}

/** Problemas de clasificación: sin destino, en dos destinos o destino inexistente. */
function clasificar(todas, { vitest, linux, fuera }) {
  const problemas = [];
  const destinos = new Map();
  for (const [lista, nombre] of [[Object.keys(vitest), "Vitest"], [linux, "CI Linux"], [Object.keys(fuera), "fuera del CI"]]) {
    for (const script of lista) {
      if (!todas.includes(script)) problemas.push(`${script}: figura en ${nombre} pero no existe`);
      if (destinos.has(script)) problemas.push(`${script}: está en ${destinos.get(script)} y en ${nombre}`);
      destinos.set(script, nombre);
    }
  }
  for (const script of todas) if (!destinos.has(script)) problemas.push(`${script}: no corre en Vitest ni en el CI y no dice por qué`);
  return problemas;
}

describe("SDD-0550 · toda prueba bash de infra/ops/tests tiene dónde correr", () => {
  const todas = readdirSync(resolve("infra/ops/tests")).filter((f) => /^prueba-.+\.sh$/.test(f)).sort();
  const linux = listaDelRunner(readFileSync(resolve("infra/ops/tests/pruebas-linux.sh"), "utf8"));
  const linuxNombres = linux.map((ruta) => ruta.replace(/^infra\/ops\/tests\//, ""));

  it("el CI Linux corre las de la 0541 y la 0543 por su ruta", () => {
    expect(linux).toEqual(expect.arrayContaining([
      "infra/ops/tests/prueba-publicar-web.sh",
      "infra/ops/tests/prueba-aplicar-lote.sh",
    ]));
    for (const ruta of linux) expect(ruta).toMatch(/^infra\/ops\/tests\/prueba-[\w-]+\.sh$/);
  });

  it("cada una está en un solo destino y ninguna queda sin clasificar", () => {
    // 19 el 2026-10-17: el piso impide que una lectura vacía pase por «todo clasificado».
    expect(todas.length).toBeGreaterThanOrEqual(19);
    expect(clasificar(todas, { vitest: EN_VITEST, linux: linuxNombres, fuera: FUERA_DEL_CI })).toEqual([]);
  });

  it("las de Vitest se ejecutan de verdad en el archivo que se nombra", () => {
    for (const [script, archivo] of Object.entries(EN_VITEST)) {
      const src = readFileSync(resolve(archivo), "utf8");
      const corre = new RegExp(`(correr\\(|spawn\\(BASH, \\[)"infra/ops/tests/${script.replace(/\./g, "\\.")}"`);
      expect(src, `${archivo} no ejecuta ${script}`).toMatch(corre);
    }
  });

  it.each([
    ["una prueba nueva sin clasificar", (c) => c.todas.push("prueba-nueva.sh"), /prueba-nueva\.sh: no corre en Vitest ni en el CI/],
    ["una prueba en dos destinos", (c) => c.linux.push("prueba-aplicar-migracion.sh"), /prueba-aplicar-migracion\.sh: está en Vitest y en CI Linux/],
    ["una entrada que ya no existe", (c) => { c.fuera["prueba-borrada.sh"] = "x"; }, /prueba-borrada\.sh: figura en fuera del CI pero no existe/],
  ])("control: %s se detecta", (_caso, mutar, problema) => {
    const c = { todas: [...todas], vitest: { ...EN_VITEST }, linux: [...linuxNombres], fuera: { ...FUERA_DEL_CI } };
    mutar(c);
    expect(clasificar(c.todas, c).join("\n")).toMatch(problema);
  });
});

const runbookCrudo = () => readFileSync(resolve("docs/runbooks/codex-engineering.md"), "utf8");

/** El único bloque `bash` del runbook que lee las corridas de quality.yml para fusionar. */
function comandoDelPorton(texto) {
  const bloques = [...texto.matchAll(/```bash\r?\n([\s\S]*?)```/g)]
    .map((m) => m[1].trim())
    .filter((c) => /quality\.yml\/runs|check-runs/.test(c));
  if (bloques.length !== 1) throw new Error(`esperaba un bloque bash del portón; hay ${bloques.length}`);
  return bloques[0];
}

/** Manda la corrida más reciente de `pull_request` de quality.yml sobre la cabeza exacta. */
function assertComandoDelPorton(c) {
  if (!c.includes('gh api "repos/SoftAgentes/DTDCARGO/actions/workflows/quality.yml/runs?')) {
    throw new Error("el portón lee las corridas de quality.yml, no check-runs ni otro workflow");
  }
  const query = c.match(/runs\?([^"]+)"/)?.[1] ?? "";
  const params = new URLSearchParams(query);
  if (params.get("head_sha") !== "<sha>") throw new Error("falta head_sha=<sha>");
  if (params.get("event") !== "pull_request") throw new Error("falta event=pull_request");
  if (!/--jq '\.workflow_runs \| max_by\(\.id\) \|/.test(c)) throw new Error("falta max_by(.id) sobre workflow_runs");
  const campos = c.match(/max_by\(\.id\) \| \[([^\]]*)\]/)?.[1].split(",").map((x) => x.trim()) ?? [];
  if (campos[0] !== ".status" || campos[1] !== ".conclusion") {
    throw new Error("el --jq imprime .status y .conclusion de esa corrida, en ese orden");
  }
  if (/check-runs/.test(c)) throw new Error("check-runs trae una fila por corrida");
}

/**
 * SDD-0621: el CI de PR no corre en borrador y corre al marcar la PR lista (`gh pr ready`). `ready_for_review`
 * es lo que sostiene el portón: sin él, una PR que pasa de borrador a lista no tiene corrida sobre su cabeza hasta el
 * próximo push. Los tipos por defecto de `pull_request` no lo incluyen, así que quitar `types:` también lo rompe.
 */
const TIPOS_DE_PR = ["opened", "ready_for_review", "reopened", "synchronize"];

function assertNoCorreEnBorrador(parsed, jobId) {
  const pr = parsed?.on?.pull_request;
  if (!pr || typeof pr !== "object") throw new Error("Falta el disparador pull_request");
  const tipos = Array.isArray(pr.types) ? [...pr.types].sort() : null;
  if (JSON.stringify(tipos) !== JSON.stringify(TIPOS_DE_PR)) {
    throw new Error(`pull_request.types debe ser exactamente ${TIPOS_DE_PR.join(", ")}; es ${JSON.stringify(pr.types)}`);
  }
  if (!Object.hasOwn(parsed.on, "workflow_dispatch")) throw new Error("Falta workflow_dispatch");
  const job = parsed.jobs?.[jobId];
  if (!job) throw new Error(`Falta el job ${jobId}`);
  if (job.if !== SOLO_FUERA_DE_BORRADOR) {
    throw new Error(`El job ${jobId} debe llevar exactamente if: ${SOLO_FUERA_DE_BORRADOR}`);
  }
  if (Object.hasOwn(job, "continue-on-error")) throw new Error(`El job ${jobId} no puede tolerar errores`);
}

describe("SDD-0621 · el CI de PR no corre en borrador y sí al marcarla lista", () => {
  const casos = [
    ["quality.yml", "quality"],
    ["kommo-historial-cargador.yml", "cargador"],
    ["portal-historial-cargador.yml", "cargador"],
    // SDD-0586, la 2b: el job del ensayo en copias, en el mismo workflow, tampoco corre en borradores.
    ["portal-historial-cargador.yml", "ensayo"],
  ];
  const leer = (archivo) => loadYaml(readFileSync(resolve(".github/workflows", archivo), "utf8"));

  it.each(casos)("%s salta en borrador, corre al pasar a lista y en manual", (archivo, jobId) => {
    expect(() => assertNoCorreEnBorrador(leer(archivo), jobId)).not.toThrow();
  });

  it("quality.yml sigue corriendo en push a main y solo contra main en la PR", () => {
    const parsed = leer("quality.yml");
    expect(parsed.on.push.branches).toEqual(["main"]);
    expect(parsed.on.pull_request.branches).toEqual(["main"]);
  });

  it("el runbook de integración conserva la regla para fusionar tras el skipped del borrador", () => {
    // El ruleset de main cuenta el `skipped` como aprobado: sin esta regla, la PR recién marcada lista se ve
    // fusionable antes de que exista la corrida que la prueba.
    const runbook = readFileSync(resolve("docs/runbooks/codex-engineering.md"), "utf8").replace(/\s+/g, " ");
    const regla = "`success`, no `skipped`, del check requerido, en una corrida `pull_request` sobre la cabeza exacta";
    expect(runbook).toContain(regla);
    expect(workflow.replace(/\s*#\s*/g, " ")).toContain(regla);
    expect(runbook).toContain("Tampoco basta `gh pr checks`");
    // Ya estaban en main (SDD-0621, #481): el remedio y cómo volver a borrador no se pueden borrar.
    expect(runbook).toContain("gh pr ready <numero> --undo");
    expect(runbook).toContain("gh pr ready <numero>");
    // Un SHA corto devuelve dos tabuladores vacíos con exit 0; y cómo se sabe que apareció la corrida del push.
    expect(runbook).toContain("`<sha>` va completo, de 40 caracteres");
    expect(runbook).toContain("La corrida del push apareció cuando el comando de arriba, sobre la cabeza nueva");
    // Re-ejecutar no rescata el `skipped`, y la carrera de concurrencia ya pasó en la #482: el párrafo nuevo, no el
    // `gh pr ready --undo` que ya estaba en main.
    expect(runbook).toContain("re-ejecución usa el evento original, con `draft: true`, y vuelve a saltar");
    expect(runbook).toContain(
      "Marca la PR lista después de que aparezca la corrida del push, o espera a que el `skipped` termine.",
    );
    // La frase falsa sobre `latest` no vuelve: `check-runs` trae una fila por corrida.
    expect(runbook).not.toMatch(/`latest`, trae la corrida más reciente/);
  });

  it("el comando del portón elige la corrida más reciente de pull_request", () => {
    expect(() => assertComandoDelPorton(comandoDelPorton(runbookCrudo()))).not.toThrow();
  });

  it.each([
    ["sin event=pull_request (pasaría un gh workflow run)", (c) => c.replace("&event=pull_request", "")],
    ["con otro evento", (c) => c.replace("event=pull_request", "event=workflow_dispatch")],
    ["sin max_by(.id) (primera fila)", (c) => c.replace("max_by(.id)", ".[0]")],
    ["la más vieja", (c) => c.replace("max_by(.id)", "min_by(.id)")],
    ["por check-runs (una fila por corrida)", (c) =>
      c.replace("actions/workflows/quality.yml/runs?head_sha=<sha>&event=pull_request", "commits/<sha>/check-runs")],
    ["otro workflow", (c) => c.replace("workflows/quality.yml/", "workflows/sql-tests.yml/")],
    ["sin la cabeza", (c) => c.replace("head_sha=<sha>&", "")],
    ["sin .conclusion", (c) => c.replace("[.status, .conclusion, .check_suite_id]", "[.status, .check_suite_id]")],
    [".conclusion cambiado por otro campo", (c) => c.replace(".conclusion", ".event")],
  ])("el comando del portón rechaza %s", (_nombre, mutar) => {
    expect(() => assertComandoDelPorton(mutar(comandoDelPorton(runbookCrudo())))).toThrow();
  });

  it("los cargadores conservan su filtro de rutas, ruta por ruta", () => {
    // Exactas y no «al menos N»: quitar una ruta deja de probar lo que cambia en ella sin que nada lo note.
    const comunes = [
      "infra/chatwoot/compose.yml",
      "infra/chatwoot/pruebas/compose.local.yml",
      "infra/chatwoot/rails/**",
    ];
    expect(leer("kommo-historial-cargador.yml").on.pull_request.paths).toEqual([
      "infra/ops/kommo-historial/**",
      ...comunes,
      ".github/workflows/kommo-historial-cargador.yml",
    ]);
    expect(leer("portal-historial-cargador.yml").on.pull_request.paths).toEqual([
      "infra/ops/portal-historial/**",
      "supabase/migrations/0006_clients.sql",
      "supabase/migrations/0106_conversaciones.sql",
      "supabase/migrations/0337_feature_flags_seed_and_trigger.sql",
      "supabase/migrations/0503_chatwoot_bandeja.sql",
      "supabase/migrations/0504_chatwoot_eventos.sql",
      "supabase/migrations/0519_chatwoot_portal.sql",
      "supabase/migrations/0520_chatwoot_portal_vuelta.sql",
      "supabase/migrations/0523_chatwoot_portal_carga.sql",
      "supabase/migrations/0508_chatwoot_bajas_purga.sql",
      "supabase/migrations/0524_chatwoot_portal_puerta4.sql",
      ...comunes,
      // SDD-0586, la 2b (N7 de la revisión del DG de la #473): el ensayo monta infra/chatwoot/correo/views en la copia
      // de Rails, así que un cambio ahí tiene que disparar la prueba. Solo en el portal: el cargador kommo no lo monta.
      "infra/chatwoot/correo/**",
      ".github/workflows/portal-historial-cargador.yml",
    ]);
  });

  it.each([
    ["sin ready_for_review", (p) => { p.on.pull_request.types = ["opened", "synchronize", "reopened"]; }],
    ["sin synchronize", (p) => { p.on.pull_request.types = ["opened", "reopened", "ready_for_review"]; }],
    ["types quitado (los de defecto no traen ready_for_review)", (p) => { delete p.on.pull_request.types; }],
    ["un tipo de más", (p) => { p.on.pull_request.types.push("labeled"); }],
    ["sin workflow_dispatch", (p) => { delete p.on.workflow_dispatch; }],
    ["condición quitada (vuelve a correr en borrador)", (p) => { delete p.jobs.quality.if; }],
    ["condición invertida", (p) => { p.jobs.quality.if = "github.event.pull_request.draft"; }],
    ["job desactivado", (p) => { p.jobs.quality.if = false; }],
    ["solo en PR (se salta el push a main)", (p) => {
      p.jobs.quality.if = "github.event_name == 'pull_request' && !github.event.pull_request.draft";
    }],
    ["error del job ignorado", (p) => { p.jobs.quality["continue-on-error"] = true; }],
  ])("rechaza %s", (_nombre, mutar) => {
    const parsed = structuredClone(leer("quality.yml"));
    mutar(parsed);
    expect(() => assertNoCorreEnBorrador(parsed, "quality")).toThrow();
  });

  it.each([
    ["condición quitada", (j) => { delete j.if; }],
    ["condición invertida", (j) => { j.if = "github.event.pull_request.draft"; }],
    ["error del job ignorado", (j) => { j["continue-on-error"] = true; }],
  ])("rechaza en el job ensayo del portal: %s", (_nombre, mutar) => {
    // El mutante del DG (SDD-0586, la 2b): sin el if: de borrador en el job ensayo, el contrato tiene que dar rojo.
    const parsed = structuredClone(leer("portal-historial-cargador.yml"));
    mutar(parsed.jobs.ensayo);
    expect(() => assertNoCorreEnBorrador(parsed, "ensayo")).toThrow();
  });

  it.each([
    ["condición solo en push", "github.event_name == 'push'"],
    ["condición invertida", "github.event.pull_request.draft"],
    ["condición siempre falsa", false],
  ])("los asertos de obligatoriedad rechazan %s en el job de calidad", (_nombre, condicion) => {
    const job = structuredClone(loadYaml(workflow).jobs.quality);
    job.if = condicion;
    expect(() => assertRequiredHarness(job)).toThrow();
    expect(() => assertRequiredPendingMigrationSymbols(job)).toThrow();
    expect(() => assertFullUnitSuite(job)).toThrow();
    expect(() => assertRequiredOpsBash(job)).toThrow();
  });
});
