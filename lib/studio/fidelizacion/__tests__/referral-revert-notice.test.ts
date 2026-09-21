// @vitest-environment node
/**
 * SDD-0495 · El copy del aviso de reversión fallida.
 *
 * Dos cosas que ninguna otra prueba cubre:
 *
 * 1. **Cuál de los dos textos sale**, según cuántos créditos SÍ se liberaron.
 *    `revertReferralCreditsForInvoice` recorre los créditos de a uno, así que
 *    `ok: false` con `reverted > 0` es alcanzable HOY con dos créditos en la
 *    misma factura. Decir «no se pudo liberar» ahí es falso.
 * 2. **Que el texto respete la casa**: tuteo venezolano, cero voseo, sin jerga
 *    técnica. Es copy de cara al operador y se revisa por aserción, no leyéndolo
 *    —que es justo como se cuelan los «revisá» y los «coordinálo».
 */

import { describe, it, expect } from "vitest";
import {
  VOID_REFERRAL_REVERT_PARTIAL_TITLE,
  VOID_REFERRAL_REVERT_PARTIAL_WARNING,
  VOID_REFERRAL_REVERT_TITLE,
  VOID_REFERRAL_REVERT_WARNING,
  voidReferralRevertTitle,
  voidReferralRevertWarning,
} from "../referral-revert-notice";

describe("voidReferralRevertWarning · cuál de los dos", () => {
  it("con 0 liberados: el aviso dice que el crédito no se pudo liberar", () => {
    expect(voidReferralRevertWarning(0)).toBe(VOID_REFERRAL_REVERT_WARNING);
  });

  it.each([1, 2, 7])(
    "con %i liberado(s) y algo fallando: el aviso es el PARCIAL",
    (reverted) => {
      expect(voidReferralRevertWarning(reverted)).toBe(
        VOID_REFERRAL_REVERT_PARTIAL_WARNING,
      );
    },
  );

  it("los dos textos son distintos: si convergen, la distinción no sirve de nada", () => {
    expect(VOID_REFERRAL_REVERT_WARNING).not.toBe(
      VOID_REFERRAL_REVERT_PARTIAL_WARNING,
    );
  });
});

describe("voidReferralRevertTitle · el título no contradice al cuerpo", () => {
  it("el cuerpo parcial lleva el título parcial", () => {
    expect(voidReferralRevertTitle(VOID_REFERRAL_REVERT_PARTIAL_WARNING)).toBe(
      VOID_REFERRAL_REVERT_PARTIAL_TITLE,
    );
  });

  it("el cuerpo total lleva el título total", () => {
    expect(voidReferralRevertTitle(VOID_REFERRAL_REVERT_WARNING)).toBe(
      VOID_REFERRAL_REVERT_TITLE,
    );
  });

  it("ante un texto desconocido cae al título total, no rompe la pantalla", () => {
    expect(voidReferralRevertTitle("cualquier cosa")).toBe(
      VOID_REFERRAL_REVERT_TITLE,
    );
  });
});

describe("el copy respeta la casa", () => {
  const TEXTOS = [
    ["aviso total", VOID_REFERRAL_REVERT_WARNING],
    ["aviso parcial", VOID_REFERRAL_REVERT_PARTIAL_WARNING],
    ["título total", VOID_REFERRAL_REVERT_TITLE],
    ["título parcial", VOID_REFERRAL_REVERT_PARTIAL_TITLE],
  ] as const;

  /**
   * Imperativos y presentes de VOSEO, en NFC (la «á» precompuesta, U+00E1),
   * contra el texto también normalizado a NFC. Dos trampas reales acá, las dos
   * silenciosas —el patrón no falla: deja de encontrar—:
   *
   *  - escribir la clase como `á` (NFD) contra texto NFC no matchea nunca;
   *  - un `\b` después de una vocal acentuada tampoco matchea, porque `\b` es
   *    frontera de palabra ASCII y `á` no es carácter de palabra para el motor.
   *    Es la misma trampa que `[aá]` en `git grep -E`, con otra cara.
   *
   * Por eso hay un mutante que mete un voseo que la aserción positiva de abajo
   * NO vería: si este patrón vuelve a quedar muerto, ese mutante sobrevive.
   */
  const VOSEO =
    /(coordinálo|reportálo|revisá|avisá|mandá|dejá|mirá|sumá|usá|probá|andá|sacrificá|adaptá|fijate|acordate|ten[eé]s|pod[eé]s|quer[eé]s|sab[eé]s|hac[eé]s|deb[eé]s)/i;

  it("el patrón de voseo está vivo: encuentra un voseo si se lo ponen", () => {
    // Sin esto, un patrón que dejó de matchear pasa por prueba en verde para
    // siempre. Se comprueba contra una frase de control, no contra el copy.
    expect("coordínalo y revisá con quien lleva el programa".normalize("NFC")).toMatch(
      VOSEO,
    );
    expect("coordínalo con quien lleva el programa".normalize("NFC")).not.toMatch(
      VOSEO,
    );
  });

  it.each(TEXTOS)("%s: sin voseo", (_nombre, texto) => {
    expect(texto.normalize("NFC")).not.toMatch(VOSEO);
  });

  it.each(TEXTOS)("%s: sin jerga técnica ni nombres de sistema", (_n, texto) => {
    expect(texto).not.toMatch(
      /postgrest|supabase|rpc|sql|null|undefined|timeout|deadlock|referrals|invoices|status|error:/i,
    );
  });

  it("los dos avisos usan el imperativo en tuteo", () => {
    // La forma de tú lleva el acento en la í ("coordínalo"); la de vos lo lleva
    // en la a ("coordinálo"). Es exactamente el error que se escapa leyendo.
    expect(VOID_REFERRAL_REVERT_WARNING.normalize("NFC")).toContain(
      "coordínalo",
    );
    expect(VOID_REFERRAL_REVERT_PARTIAL_WARNING.normalize("NFC")).toContain(
      "coordínalo",
    );
  });

  it("los dos avisos dicen que no se arregla desde la pantalla", () => {
    // Hoy no hay camino de reintento en la UI. Si algún día lo hay, esta
    // aserción cae y obliga a reescribir el copy en vez de dejarlo mintiendo.
    for (const [, texto] of TEXTOS.slice(0, 2)) {
      expect(texto).toMatch(/no se arregla desde aquí/i);
    }
  });

  it("los dos avisos remiten a Fidelización, que es donde está el otro lado", () => {
    for (const [, texto] of TEXTOS.slice(0, 2)) {
      expect(texto).toMatch(/fidelizaci[oó]n/i);
    }
  });
});
