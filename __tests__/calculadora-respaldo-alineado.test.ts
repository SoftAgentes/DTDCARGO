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
 * Hubo además un susto que conviene dejar contado, porque explica por qué esto
 * importa: la fila pública tenía cargado `valid_until = 2026-10-04` cuando la
 * tarifa valía hasta el **2026-11-29**. Como la RPC filtra por vigencia, el 5 de
 * octubre habría dejado de responder con la tarifa plenamente vigente, y el
 * sitio habría cotizado con estas constantes durante casi dos meses. Se corrigió
 * en producción el 2026-09-17 (autorizado por el founder), así que **esa grieta
 * concreta ya no existe**: verificado contra `dtdcargo.com/api/public/cbm-rate`,
 * que devuelve `valid_until: "2026-11-29"`.
 *
 * Lo que sigue en pie es el caso general: si Supabase se cae, el sitio cotiza
 * con estos números. Que el precio salga bien depende de que este archivo esté
 * al día.
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
    // devuelve { per_cbm: 850, min_charge: 50, valid_until: "2026-11-29" }.
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
 * NO HAY TEST DE VIGENCIA, y es una decisión (founder 2026-09-17).
 *
 * Se llegó a escribir uno que ponía el CI en rojo cuando la fecha de la tarifa
 * pasaba. El founder cerró el tema con otro criterio, que cambia el diseño:
 *
 *   «Aunque la tarifa se venza o esté vencida, se mantiene el precio anterior.
 *    Lo que vamos a leer aquí es la base de datos. Ya el tema de si se actualiza
 *    o no se actualiza es un tema del back-end, no tuyo.»
 *
 * O sea: el vencimiento no debe ser un evento que rompa nada. El precio se
 * muestra desde la DB y se mantiene. Un test que bloquea el CI por una fecha iba
 * en contra de eso, así que no está.
 *
 * 🔴 PERO HOY EL SISTEMA NO HACE ESO, y conviene no confundir una cosa con la
 * otra. La RPC `public_cbm_rate()` filtra por
 * `valid_until is null or valid_until >= current_date` (migr 0101, y la 0255
 * igual): al vencer **devuelve null**, y entonces el sitio no cae «al precio
 * anterior de la base» sino a `CONFIG.tarifaBaseCBM`, una constante del código.
 *
 * Que hoy el resultado sea el correcto es consecuencia de SDD-0475: como el
 * respaldo vale lo mismo que la tarifa, el precio no se mueve al vencer. Es la
 * coincidencia la que salva el caso, no el diseño — y la próxima vez que cambie
 * la tarifa vuelve a abrirse, salvo que alguien se acuerde de mover la constante.
 *
 * Para que «se mantiene el precio anterior» sea cierto por diseño hace falta que
 * la lectura NO dependa de la vigencia: que la RPC devuelva la última tarifa
 * pública aunque esté vencida, o que haya una segunda que lo haga. Eso es
 * backend y tiene dueño propio — queda escrito en el spec de SDD-0475.
 */
