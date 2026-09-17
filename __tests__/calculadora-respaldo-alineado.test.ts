/**
 * SDD-0475 · el respaldo del calculador no se mueve solo.
 *
 * `CONFIG.tarifaBaseCBM` y `CONFIG.pesoIncluidoKg` son **espejos** de lo que vive
 * en el ERP (`rates.per_cbm` de la fila pública y
 * `calculator_settings.peso_incluido_kg`). Cuando la RPC no responde —Supabase
 * caído, o la vigencia de la tarifa vencida, que es lo normal cada mes— el sitio
 * cotiza con estas constantes. Si no coinciden con el ERP, el precio cambia **en
 * silencio**: sin error, sin log, sin que nadie se entere.
 *
 * NO ES HIPOTÉTICO. Pasó dos veces:
 *   · `pesoIncluidoKg`: el ERP tenía 1.000 kg desde el 2026-07-06 y el código
 *     seguía en 500. Ante una caída, se habría cobrado excedente al doble de
 *     clientes. Corregido el 2026-08-05.
 *   · `tarifaBaseCBM`: la migr 0336 subió la tarifa pública a $850 el 2026-09-04
 *     y avisaba en su cabecera que ese día había que subir la constante. No se
 *     hizo. Trece días cotizando 5,88% por debajo ante cualquier caída — lo que
 *     arregla SDD-0475.
 *
 * QUÉ HACE ESTE TEST: **decir cuál es el valor del ERP y por qué**. No puede
 * comparar contra la DB (el CI corre sin credenciales, y por eso el paso
 * `migrations-applied` de verify sale SKIP), así que ancla los números con su
 * procedencia al lado.
 *
 * QUÉ **NO** ES: la única red. Mover `CONFIG.tarifaBaseCBM` ya rompía 20
 * aserciones de `calculadora.test.ts` y `calculadora-minimo-en-cajas.test.ts`,
 * que están escritas con literales y su aritmética a la vista (`// 0.3 × 850`).
 * Esa red existía y funcionaba.
 *
 * Entonces, ¿cómo se coló la desalineación? **No por falta de tests, sino
 * porque nadie tocó el código.** Los tests protegen contra un cambio accidental
 * de la constante; no contra que el ERP cambie y el código se quede quieto. Ese
 * es el modo de fallo real, y ningún test que viva en el repo lo ve: haría falta
 * comparar contra la DB. Lo que este archivo aporta es dejar escrito cuál es el
 * valor correcto y de dónde salió, para que la próxima revisión tenga contra qué
 * contrastar.
 *
 * SI ESTE TEST TE SALIÓ ROJO: no lo "arregles" cambiando el número esperado sin
 * más. Comprobá primero qué dice el ERP (`/studio/tarifas`, o la RPC
 * `public_cbm_rate`) y alineá el código con eso.
 */
import { describe, it, expect } from "vitest";
import { CONFIG, CONSOLIDADO_CBM_RATE } from "@/lib/calculadora";

describe("respaldo del calculador · espejo del ERP (SDD-0475)", () => {
  it("la tarifa base por CBM está en $850, como la fila pública del ERP", () => {
    // Verificado contra producción el 2026-09-17: la RPC public_cbm_rate
    // devuelve { per_cbm: 850, min_charge: 50, valid_until: "2026-10-04" }.
    expect(CONFIG.tarifaBaseCBM).toBe(850);
  });

  it("la gracia de peso está en 1.000 kg/m³, como calculator_settings", () => {
    // Ojo: 1.000 es el valor VIGENTE del ERP, y es lo que este respaldo tiene
    // que espejar para no cambiar el precio ante una caída. No confundir con la
    // regla que se le PROMETE al cliente en el material público, que son 500
    // kg/m³ porque los 1.000 son una excepción temporal (founder 2026-09-17,
    // SDD-0474). Son dos cosas distintas a propósito: acá manda lo que se
    // factura.
    expect(CONFIG.pesoIncluidoKg).toBe(1000);
  });

  it("el piso mínimo está en $50, como min_charge del ERP", () => {
    expect(CONFIG.minimoFacturable).toBe(50);
  });

  it("los tres son números positivos y finitos", () => {
    // Un undefined colado acá no da error: da NaN en el precio y el cliente ve
    // «$NaN» o un total en cero.
    for (const v of [CONFIG.tarifaBaseCBM, CONFIG.pesoIncluidoKg, CONFIG.minimoFacturable]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it("la tarifa del consolidado está en $580, como su fila del ERP", () => {
    // El cuarto espejo, que se había quedado fuera. Verificado contra
    // producción el 2026-09-17: la fila `public_calc_modo=consolidado` tiene
    // `per_cbm=580`, igual que esta constante.
    //
    // Dos diferencias con la tarifa DDP, y conviene no confundirlas:
    //   · Su fila tiene `valid_from`/`valid_until` en NULL, y la RPC filtra con
    //     `valid_until is null or valid_until >= current_date` — o sea que NO
    //     vence. Acá no hay bomba de vencimiento, sólo el espejo.
    //   · Hoy ningún código lee esa fila: `lib/public/rates-queries.ts` nunca
    //     pasa `p_modo`, así que la RPC siempre devuelve la DDP y esta constante
    //     es la única fuente. El día que se cablee (el propio comentario de
    //     `CONSOLIDADO_CBM_RATE` describe los dos pasos), pasa a ser un respaldo
    //     como los otros y este anclaje empieza a protegerlo de verdad.
    expect(CONSOLIDADO_CBM_RATE).toBe(580);
  });

  it("el piso mínimo es menor que la tarifa de un CBM (si no, nadie pagaría la tarifa)", () => {
    // Relación de sentido: el mínimo cobrable existe para envíos chicos. Si
    // superara el precio de 1 m³, todo envío de menos de 1 m³ pagaría el piso y
    // la tarifa por CBM dejaría de aplicar en el tramo que más se usa.
    expect(CONFIG.minimoFacturable).toBeLessThan(CONFIG.tarifaBaseCBM);
  });
});

/**
 * Vigencia de la tarifa pública — el recordatorio que no depende de que nadie se
 * acuerde (founder 2026-09-17: «850 última tarifa vigente, siempre revisar
 * vigencia»).
 *
 * POR QUÉ HACE FALTA, aunque la alerta del ERP ya exista: el cron de
 * `app/api/cron/rate-expiry-alert/route.ts` (SDD-0164, migr 0257) avisa por
 * Telegram y email cuando una tarifa pública está por vencer o venció. Eso cubre
 * **la tarifa**. No cubre **el respaldo**: el 2026-09-04 la tarifa subió a $850
 * y esta constante se quedó en $800 trece días sin que nada lo dijera, porque no
 * hubo vencimiento — hubo un cambio. Son dos avisos distintos.
 *
 * Y hay un efecto nuevo que conviene nombrar: ahora que el respaldo coincide con
 * la tarifa, **el vencimiento deja de tener síntoma**. Antes, al vencer la
 * vigencia el sitio caía de $850 a $800 y el precio se movía a la vista. Con los
 * dos en 850 no se moverá nada: el día que venza, el sitio seguirá cotizando
 * igual y nadie lo notará. Alinear el respaldo arregla el precio y esconde el
 * vencimiento — por eso este test.
 *
 * EL COSTO, dicho de frente: a partir del 2026-10-05 este test pone el CI en
 * rojo y bloquea PRs ajenas hasta que alguien renueve la tarifa o mueva la
 * fecha. Es deliberado y lo autorizó el founder. Si algún día estorba más de lo
 * que sirve, la conversación es si el respaldo hardcodeado debe existir, no si
 * este test debe callarse.
 */
describe("vigencia de la tarifa pública (SDD-0475)", () => {
  /**
   * Hasta cuándo vale la fila pública de `rates` que este respaldo espeja.
   *
   * 🔴 PENDIENTE DE CONFIRMAR — POR ESO EL TEST ESTÁ EN `skip`.
   *
   * Hay dos fechas y no coinciden:
   *   · **Producción dice `2026-10-04`** — leído de `rates` el 2026-09-17:
   *     `public_calc_modo=ddp per_cbm=850 valid_from=2026-09-04
   *     valid_until=2026-10-04`. Es lo que sembró la migr 0336.
   *   · **El founder dice `2026-09-29`** — «TARIFA HASTA EL 29 SEPT 2026 ES DE
   *     850» (2026-09-17).
   *
   * Cinco días en los que producción seguiría cobrando $850 con una tarifa que,
   * según el founder, ya no rige. Y no está dicho qué precio rige desde el 30.
   *
   * Anclar una fecha mientras la otra la contradice sería fijar en el CI un dato
   * que no sabemos si es el bueno. Cuando se resuelva: poner la fecha, quitar el
   * `.skip` y listo — el resto del test ya está escrito.
   */
  const VIGENCIA_HASTA = "2026-10-04";

  it.skip("la tarifa pública que este respaldo espeja sigue vigente", () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const vencida = hoy > VIGENCIA_HASTA;

    if (vencida) {
      throw new Error(
        [
          `La tarifa pública venció el ${VIGENCIA_HASTA} (hoy es ${hoy}).`,
          "",
          "Esto NO se arregla cambiando la fecha de este test. Hacé esto:",
          "",
          `  1. Entrá a /studio/tarifas y mirá la fila pública (is_public, modo 'ddp').`,
          "  2. Si sigue vigente con otra fecha → actualizá VIGENCIA_HASTA acá.",
          "  3. Si venció → renovala. Mientras no lo hagas, la RPC public_cbm_rate",
          `     devuelve null y el sitio cotiza con CONFIG.tarifaBaseCBM ($${CONFIG.tarifaBaseCBM}),`,
          "     sin avisarle a nadie.",
          `  4. Si la tarifa cambió de precio → movés CONFIG.tarifaBaseCBM y los`,
          "     valores derivados de __tests__/calculadora.test.ts, que están escritos",
          "     con la aritmética a la vista.",
          "",
          "El respaldo desalineado ya costó 13 días cotizando por debajo (SDD-0475).",
        ].join("\n"),
      );
    }

    expect(vencida).toBe(false);
  });

  it("la fecha de vigencia tiene forma de fecha ISO", () => {
    // Un typo acá deja el test verde para siempre: "2026-13-45" > cualquier
    // fecha real es una comparación de strings que nunca dispara.
    expect(VIGENCIA_HASTA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(VIGENCIA_HASTA))).toBe(false);
  });
});
