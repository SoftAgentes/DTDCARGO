// @vitest-environment node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * SDD-0550 · el runner de las pruebas bash que corre el CI en ubuntu.
 *
 * `infra/ops/tests/pruebas-linux.sh` es lo único entre esas pruebas y el check
 * obligatorio: si diera verde con una prueba roja, vacía o ausente, el CI
 * mentiría. Aquí corre contra pruebas de mentira (PRUEBAS_LINUX_LISTA), así
 * que no pide Linux ni flock. Las pruebas reales las corre el CI.
 */

// En Windows, el `bash` del PATH puede ser el de WSL: se prefiere el de Git.
const BASH = (() => {
  if (process.platform !== "win32") return "bash";
  for (const p of ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\usr\\bin\\bash.exe"]) {
    if (existsSync(p)) return p;
  }
  return "bash";
})();
const RUNNER = "infra/ops/tests/pruebas-linux.sh";

const dir = mkdtempSync(path.join(tmpdir(), "dtd-pruebas-linux-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function prueba(nombre, cuerpo) {
  const ruta = path.join(dir, nombre);
  writeFileSync(ruta, `#!/usr/bin/env bash\n${cuerpo}\n`);
  return ruta.replace(/\\/g, "/");
}
const PASA = prueba("pasa.sh", 'echo "PASÓ  · uno"; echo "PASÓ  · dos"; echo "RESULTADO: 2 PASÓ · 0 FALLÓ"');
const SALE_1 = prueba("sale-1.sh", 'echo "PASÓ  · uno"; echo "RESULTADO: 1 PASÓ · 0 FALLÓ"; exit 1');
const FALLO_CON_0 = prueba("fallo-con-0.sh", 'echo "PASÓ  · uno"; echo "FALLÓ · dos"; exit 0');
const VACIA = prueba("vacia.sh", "exit 0");
const SIN_FLOCK = prueba("sin-flock.sh", 'echo "NO DISPONIBLE: falta flock (util-linux); corre esta prueba en Linux"; exit 1');
const CUELGA = prueba("cuelga.sh", 'echo "PASÓ  · antes de colgarse"; sleep 60');

function correr(lista, extra = {}) {
  return new Promise((done) => {
    const env = { ...process.env, LC_ALL: "C.UTF-8", PRUEBAS_LINUX_LISTA: lista.join("\n"), ...extra };
    const hijo = spawn(BASH, [RUNNER], { cwd: path.resolve("."), env });
    let salida = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (salida += d));
    hijo.on("close", (codigo) => done({ codigo, salida }));
  });
}
const linea = (salida, ruta) => salida.split("\n").find((l) => l.includes(ruta) && /^(PASÓ|FALLÓ)/.test(l)) ?? "";

describe("SDD-0550 · pruebas-linux.sh", () => {
  it("pasa bash -n", () => {
    const r = spawnSync(BASH, ["-n", RUNNER], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
  });

  it("todas verdes: sale 0 y nombra cada prueba con su conteo", async () => {
    const r = await correr([PASA, PASA]);
    expect(r.codigo, r.salida).toBe(0);
    expect(linea(r.salida, PASA)).toMatch(/^PASÓ {2}· .*pasa\.sh · 2 PASÓ · \d+ s$/);
    expect(r.salida).toMatch(/^RESULTADO: 2 PASÓ · 0 FALLÓ · 2 pruebas en \d+ s$/m);
  }, 60_000);

  it.each([
    ["sale ≠ 0 aunque diga 0 FALLÓ", SALE_1, /exit 1 · 1 PASÓ · 0 FALLÓ/],
    ["escribe un FALLÓ aunque salga 0", FALLO_CON_0, /exit 0 · 1 PASÓ · 1 FALLÓ/],
    ["sale 0 sin un solo PASÓ (prueba vacía)", VACIA, /exit 0 · 0 PASÓ · 0 FALLÓ/],
    ["no encuentra flock (NO DISPONIBLE no es PASÓ)", SIN_FLOCK, /exit 1 · 0 PASÓ · 0 FALLÓ/],
    ["no existe", `${dir.replace(/\\/g, "/")}/no-existe.sh`, /exit 127/],
  ])("FALLÓ si la prueba %s, y no corta a las demás", async (_caso, ruta, detalle) => {
    const r = await correr([ruta, PASA]);
    expect(r.codigo, r.salida).toBe(1);
    expect(linea(r.salida, ruta)).toMatch(/^FALLÓ · /);
    expect(linea(r.salida, ruta)).toMatch(detalle);
    // La que viene después corre igual y queda en verde.
    expect(linea(r.salida, PASA)).toMatch(/^PASÓ {2}· /);
    expect(r.salida).toMatch(/^RESULTADO: 1 PASÓ · 1 FALLÓ · 2 pruebas en \d+ s$/m);
  }, 60_000);

  it("una prueba colgada vence su tope, sale como FALLÓ con su nombre y no corta a las demás", async () => {
    const r = await correr([CUELGA, PASA], { PRUEBAS_LINUX_TOPE_S: "2" });
    expect(r.codigo, r.salida).toBe(1);
    expect(linea(r.salida, CUELGA)).toMatch(/^FALLÓ · .*cuelga\.sh · exit 124 · 1 PASÓ · 0 FALLÓ/);
    expect(linea(r.salida, PASA)).toMatch(/^PASÓ {2}· /);
  }, 60_000);

  it("al fallar muestra las líneas FALLÓ y el final de la salida", async () => {
    const r = await correr([FALLO_CON_0]);
    expect(r.salida).toContain("    FALLÓ · dos");
    expect(r.salida).toContain("    --- últimas líneas ---");
  }, 60_000);

  it("una lista sin pruebas no es verde", async () => {
    // Dos líneas vacías: la variable está definida, pero no nombra ninguna prueba.
    const r = await correr(["", ""]);
    expect(r.codigo, r.salida).toBe(1);
    expect(r.salida).toMatch(/^RESULTADO: 0 PASÓ · 0 FALLÓ · 0 pruebas en \d+ s$/m);
  }, 60_000);
});
