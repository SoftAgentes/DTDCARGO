// @vitest-environment node
/**
 * Tests del enlace corto de acceso (SDD-0253).
 *
 * Lo que se prueba acá es la lógica PURA: generación del código y clasificación
 * de estado. Lo que NO se puede probar en unit —y es el corazón del SDD— es que
 * el `GET` de la página no consuma el código; eso vive en la separación
 * page.tsx (lee) / actions.ts (POST consume), y se verifica mirando `used_at`
 * después de abrir la URL.
 */

import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  accessLinkUrl,
  classifyAccessLink,
  firstName,
  generateAccessCode,
} from "../access-link";

const HORA = 3_600_000;
const AHORA = Date.parse("2026-08-09T12:00:00.000Z");

describe("generateAccessCode", () => {
  it("devuelve el largo pedido y sólo símbolos del alfabeto", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateAccessCode();
      expect(code).toHaveLength(ACCESS_CODE_LENGTH);
      for (const ch of code) expect(ACCESS_CODE_ALPHABET).toContain(ch);
    }
  });

  it("nunca emite los caracteres que se confunden al dictarlo o copiarlo", () => {
    // 0/O, 1/I/L y U quedaron fuera a propósito: este código se lee por teléfono.
    const prohibidos = ["0", "O", "1", "I", "L", "U"];
    const muestra = Array.from({ length: 300 }, () => generateAccessCode()).join("");
    for (const ch of prohibidos) expect(muestra).not.toContain(ch);
  });

  it("no repite (la entropía es lo único que protege la URL)", () => {
    const vistos = new Set(Array.from({ length: 500 }, () => generateAccessCode()));
    expect(vistos.size).toBe(500);
  });

  it("respeta un largo explícito", () => {
    expect(generateAccessCode(16)).toHaveLength(16);
  });
});

describe("classifyAccessLink", () => {
  const vivo = {
    expires_at: new Date(AHORA + 24 * HORA).toISOString(),
    used_at: null,
    revoked_at: null,
  };

  it("abre la puerta sólo cuando está fresco, sin usar y sin revocar", () => {
    expect(classifyAccessLink(vivo, AHORA)).toBe("ok");
  });

  it("revocado gana sobre todo lo demás", () => {
    expect(
      classifyAccessLink(
        { ...vivo, revoked_at: new Date(AHORA).toISOString(), used_at: null },
        AHORA,
      ),
    ).toBe("revoked");
  });

  it("usado no vuelve a abrir", () => {
    expect(
      classifyAccessLink({ ...vivo, used_at: new Date(AHORA).toISOString() }, AHORA),
    ).toBe("used");
  });

  it("vencido cuando el instante es posterior a expires_at", () => {
    expect(classifyAccessLink(vivo, AHORA + 25 * HORA)).toBe("expired");
  });

  it("el borde exacto de vencimiento NO abre", () => {
    const borde = { ...vivo, expires_at: new Date(AHORA).toISOString() };
    expect(classifyAccessLink(borde, AHORA)).toBe("expired");
  });

  it("una fecha ilegible se trata como vencida, no como válida", () => {
    // Ante la duda no se abre la puerta: un parseo fallido nunca debe dar acceso.
    expect(classifyAccessLink({ ...vivo, expires_at: "no-es-fecha" }, AHORA)).toBe(
      "expired",
    );
  });
});

describe("accessLinkUrl", () => {
  it("arma la URL sobre el sitio propio, no sobre supabase.co", () => {
    const url = accessLinkUrl("K7M2QX4P9B");
    expect(url).toMatch(/\/entrar\/K7M2QX4P9B$/);
    expect(url).not.toContain("supabase");
  });
});

describe("firstName", () => {
  it("toma sólo el primer nombre", () => {
    expect(firstName("Alain de Cardenas")).toBe("Alain");
  });

  it("desgrita los nombres importados en mayúscula sostenida", () => {
    expect(firstName("ADRIAN GABRIEL FIGUEROA")).toBe("Adrian");
  });

  it("deja en paz lo que ya viene bien escrito", () => {
    expect(firstName("Jessilen Centeno")).toBe("Jessilen");
  });

  it("devuelve null sin nombre, para que la página salude genérico", () => {
    expect(firstName(null)).toBeNull();
    expect(firstName("   ")).toBeNull();
  });
});
