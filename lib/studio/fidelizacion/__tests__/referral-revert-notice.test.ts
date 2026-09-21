// @vitest-environment node
/**
 * SDD-0495 · El copy del aviso de reversión fallida.
 *
 * Dos cosas que ninguna otra prueba cubre:
 *
 * 1. **Cuál de los dos textos sale**, según QUÉ falló (`failure`).
 *    SDD-0496: antes se elegía por cuántos créditos se habían liberado, porque
 *    la reversión los recorría de a uno. Ahora es una sola transacción
 *    (`revert_referral_credits`, migr 0471) y el caso parcial no existe; el
 *    segundo texto pasó a ser el del asiento que quedó sin anular. Elegir por
 *    el conteo hoy diría que hay créditos varados justo cuando no queda
 *    ninguno: la plata volvió entera.
 * 2. **Que el texto respete la casa**: tuteo venezolano, cero voseo, sin jerga
 *    técnica. Es copy de cara al operador y se revisa por aserción, no leyéndolo
 *    —que es justo como se cuelan los «revisá» y los «coordinálo».
 */

import { describe, it, expect } from "vitest";
import {
  VOID_REFERRAL_REVERT_ENTRY_TITLE,
  VOID_REFERRAL_REVERT_ENTRY_WARNING,
  VOID_REFERRAL_REVERT_TITLE,
  VOID_REFERRAL_REVERT_WARNING,
  voidReferralRevertTitle,
  voidReferralRevertWarning,
} from "../referral-revert-notice";

describe("voidReferralRevertWarning · cuál de los dos", () => {
  it("failure 'revert': el aviso dice que el crédito no se pudo liberar", () => {
    expect(voidReferralRevertWarning("revert")).toBe(VOID_REFERRAL_REVERT_WARNING);
  });

  it("failure 'entries': el aviso es el del ASIENTO, no el del crédito varado", () => {
    expect(voidReferralRevertWarning("entries")).toBe(
      VOID_REFERRAL_REVERT_ENTRY_WARNING,
    );
  });

  it("sin failure cae al aviso total: fail-closed, nunca al del asiento", () => {
    // Un `ok: false` sin `failure` es una forma que no debería llegar; si llega,
    // el aviso conservador es el que manda a revisar el crédito.
    expect(voidReferralRevertWarning(undefined)).toBe(VOID_REFERRAL_REVERT_WARNING);
  });

  it("los dos textos son distintos: si convergen, la distinción no sirve de nada", () => {
    expect(VOID_REFERRAL_REVERT_WARNING).not.toBe(
      VOID_REFERRAL_REVERT_ENTRY_WARNING,
    );
  });

  it("el aviso del asiento NO dice que el crédito quedó sin liberar", () => {
    // Es la mentira concreta que la SDD-0496 vino a evitar: con failure
    // 'entries' el referidor tiene su crédito de vuelta.
    expect(VOID_REFERRAL_REVERT_ENTRY_WARNING).toMatch(/volvió a estar disponible/);
    expect(VOID_REFERRAL_REVERT_ENTRY_WARNING).not.toMatch(/sigue marcado como usado/);
    expect(VOID_REFERRAL_REVERT_ENTRY_WARNING).toMatch(/asiento/);
  });
});

describe("voidReferralRevertTitle · el título no contradice al cuerpo", () => {
  it("el cuerpo del asiento lleva el título del asiento", () => {
    expect(voidReferralRevertTitle(VOID_REFERRAL_REVERT_ENTRY_WARNING)).toBe(
      VOID_REFERRAL_REVERT_ENTRY_TITLE,
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
    ["aviso del asiento", VOID_REFERRAL_REVERT_ENTRY_WARNING],
    ["título total", VOID_REFERRAL_REVERT_TITLE],
    ["título del asiento", VOID_REFERRAL_REVERT_ENTRY_TITLE],
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
    // SDD-0496: el aviso del asiento manda a contabilidad, no a coordinar con
    // Fidelización, así que su imperativo es otro. La comprobación es la misma:
    // "pásaselo" es tú, "pasáselo" sería vos.
    expect(VOID_REFERRAL_REVERT_ENTRY_WARNING.normalize("NFC")).toContain(
      "pásaselo",
    );
    expect(VOID_REFERRAL_REVERT_ENTRY_WARNING.normalize("NFC")).not.toContain(
      "pasáselo",
    );
  });

  it("los dos avisos dicen que no se arregla desde la pantalla", () => {
    // Hoy no hay camino de reintento en la UI. Si algún día lo hay, esta
    // aserción cae y obliga a reescribir el copy en vez de dejarlo mintiendo.
    for (const [, texto] of TEXTOS.slice(0, 2)) {
      expect(texto).toMatch(/no se arregla desde aquí/i);
    }
  });

  it("cada aviso remite a donde de verdad está el otro lado", () => {
    // SDD-0496: antes los dos mandaban a Fidelización, porque los dos hablaban
    // de créditos varados. El del asiento NO: ahí el crédito volvió y
    // Fidelización —con razón— no lo va a listar, así que mandar para allá sería
    // mandar a alguien a mirar una pantalla vacía. Va a contabilidad, que es
    // quien tiene el asiento colgado.
    expect(VOID_REFERRAL_REVERT_WARNING).toMatch(/fidelizaci[oó]n/i);
    expect(VOID_REFERRAL_REVERT_ENTRY_WARNING).toMatch(/contabilidad/i);
    expect(VOID_REFERRAL_REVERT_ENTRY_WARNING).not.toMatch(/fidelizaci[oó]n/i);
  });
});
