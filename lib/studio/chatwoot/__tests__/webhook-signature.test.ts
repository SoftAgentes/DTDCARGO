// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { VENTANA_FIRMA_S, verificarFirmaChatwoot } from "../webhook-signature";

const SECRETO = "secreto-sintetico-e2";
const AHORA = 1_761_760_000_000;
const TS = String(AHORA / 1000);
const CUERPO = '{"event":"message_created","id":101}';
const firmar = (ts: string, cuerpo: string, secreto = SECRETO) =>
  `sha256=${createHmac("sha256", secreto).update(`${ts}.${cuerpo}`).digest("hex")}`;

describe("verificarFirmaChatwoot (SDD-0585)", () => {
  it("firma de Chatwoot sobre «timestamp.cuerpo» → ok", () => {
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: TS, firma: firmar(TS, CUERPO), secreto: SECRETO, ahoraMs: AHORA })).toBe("ok");
  });

  it("sin cabeceras → sin_firma", () => {
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: null, firma: firmar(TS, CUERPO), secreto: SECRETO, ahoraMs: AHORA })).toBe("sin_firma");
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: TS, firma: null, secreto: SECRETO, ahoraMs: AHORA })).toBe("sin_firma");
  });

  it("cuerpo alterado, otro secreto, firma sin prefijo o timestamp cambiado → invalida", () => {
    expect(verificarFirmaChatwoot({ cuerpo: `${CUERPO} `, timestamp: TS, firma: firmar(TS, CUERPO), secreto: SECRETO, ahoraMs: AHORA })).toBe("invalida");
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: TS, firma: firmar(TS, CUERPO, "otro"), secreto: SECRETO, ahoraMs: AHORA })).toBe("invalida");
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: TS, firma: firmar(TS, CUERPO).slice(7), secreto: SECRETO, ahoraMs: AHORA })).toBe("invalida");
    const otroTs = String(AHORA / 1000 - 1);
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: otroTs, firma: firmar(TS, CUERPO), secreto: SECRETO, ahoraMs: AHORA })).toBe("invalida");
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: "1e9", firma: firmar("1e9", CUERPO), secreto: SECRETO, ahoraMs: AHORA })).toBe("invalida");
  });

  it("anti-replay: fuera de la ventana, hacia atrás o hacia adelante → vencida; en el borde, ok", () => {
    const viejo = String(AHORA / 1000 - VENTANA_FIRMA_S - 1);
    const futuro = String(AHORA / 1000 + VENTANA_FIRMA_S + 1);
    const borde = String(AHORA / 1000 - VENTANA_FIRMA_S);
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: viejo, firma: firmar(viejo, CUERPO), secreto: SECRETO, ahoraMs: AHORA })).toBe("vencida");
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: futuro, firma: firmar(futuro, CUERPO), secreto: SECRETO, ahoraMs: AHORA })).toBe("vencida");
    expect(verificarFirmaChatwoot({ cuerpo: CUERPO, timestamp: borde, firma: firmar(borde, CUERPO), secreto: SECRETO, ahoraMs: AHORA })).toBe("ok");
  });
});
