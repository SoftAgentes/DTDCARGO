/**
 * SDD-0300 · Las dos decisiones del paso `e2e` del gate.
 *
 * El 2026-08-25 fallaron juntas y la segunda tapó a la primera: al worktree le
 * tocó el puerto 3365, que Windows reserva (bloque 3308–3807), el `webServer`
 * de Playwright murió con `EACCES`, la suite corrió CERO tests y el gate salió
 * `[OK] e2e (con aviso)`. Estas pruebas cubren las dos mitades.
 */
import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  absuelveCorrida,
  candidatosDePuerto,
  primerPuertoLibre,
  PUERTO_BASE,
  PUERTO_RANGO,
} from "../verify-e2e.mjs";

const abiertos = [];

/**
 * ⚠️ Los puertos de estas pruebas los asigna el SISTEMA OPERATIVO (`listen(0)`),
 * no `candidatosDePuerto`. Al escribirlas con candidatos del rango del gate
 * fallaron con `EACCES` en 3376 y 3554: cayeron dentro del mismo bloque
 * reservado que causó el bug. Una prueba que depende de qué puertos reserva la
 * máquina no prueba el sondeo, prueba la máquina.
 */
function ocuparCualquiera() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once("error", rej);
    s.listen(0, "0.0.0.0", () => {
      abiertos.push(s);
      res(s.address().port);
    });
  });
}

/** Un puerto que el SO considera usable, ya liberado. */
async function puertoLibre() {
  const p = await ocuparCualquiera();
  const s = abiertos.pop();
  await new Promise((r) => s.close(r));
  return p;
}
afterEach(async () => {
  await Promise.all(abiertos.splice(0).map((s) => new Promise((r) => s.close(r))));
});

describe("candidatosDePuerto", () => {
  it("es determinístico: el mismo worktree siempre pide el mismo puerto primero", () => {
    expect(candidatosDePuerto("C:/x/worktree-a")[0]).toBe(
      candidatosDePuerto("C:/x/worktree-a")[0],
    );
  });

  it("dos worktrees distintos no arrancan por el mismo puerto", () => {
    // Es la propiedad que el cálculo por hash vino a dar: dos ventanas nunca
    // se pelean el puerto ni reusan el `next dev` de la otra.
    expect(candidatosDePuerto("C:/x/worktree-a")[0]).not.toBe(
      candidatosDePuerto("C:/x/worktree-b")[0],
    );
  });

  it("todos los candidatos caen dentro del rango declarado", () => {
    for (const p of candidatosDePuerto("C:/x/worktree-a")) {
      expect(p).toBeGreaterThanOrEqual(PUERTO_BASE);
      expect(p).toBeLessThan(PUERTO_BASE + PUERTO_RANGO);
    }
  });

  it("no repite ninguno — 40 candidatos son 40 puertos distintos", () => {
    const c = candidatosDePuerto("C:/x/worktree-a", 40);
    expect(new Set(c).size).toBe(40);
  });

  it("🔴 se ALEJA del primero: si no, los 40 caerían en el mismo bloque reservado", () => {
    // El bloque que Windows reserva mide CIENTOS de puertos (3308–3807 en la
    // máquina del founder). Con saltos de 1, tener 40 candidatos no serviría
    // de nada. Se exige que el segundo esté a más de 50 del primero.
    const [a, b] = candidatosDePuerto("C:/x/worktree-a", 2);
    expect(Math.abs(a - b)).toBeGreaterThan(50);
  });
});

describe("primerPuertoLibre", () => {
  it("devuelve el primero cuando está libre", async () => {
    const libre = await puertoLibre();
    expect(primerPuertoLibre([libre])).toBe(libre);
  });

  it("saltea el que está OCUPADO y devuelve el siguiente", async () => {
    const ocupado = await ocuparCualquiera();
    const libre = await puertoLibre();
    expect(primerPuertoLibre([ocupado, libre])).toBe(libre);
  });

  it("devuelve null si ninguno ata — el gate omite en vez de correr contra un puerto muerto", async () => {
    const ocupado = await ocuparCualquiera();
    expect(primerPuertoLibre([ocupado])).toBeNull();
  });
});

describe("absuelveCorrida", () => {
  it("absuelve la corrida que pasó entera y salió ≠0 (worker de WebKit)", () => {
    expect(absuelveCorrida({ expected: 150, unexpected: 0 })).toBe(true);
  });

  it("🔴 NO absuelve una corrida de CERO tests — es el bug que tapó el del puerto", () => {
    // Sin webServer, Playwright sale 1 con expected:0 y unexpected:0. Antes eso
    // caía en la misma rama que "pasaron todos" y salía verde.
    expect(absuelveCorrida({ expected: 0, unexpected: 0 })).toBe(false);
  });

  it("no absuelve si falló un test de verdad", () => {
    expect(absuelveCorrida({ expected: 149, unexpected: 1 })).toBe(false);
  });

  it("no absuelve sin stats", () => {
    expect(absuelveCorrida(undefined)).toBe(false);
  });
});
