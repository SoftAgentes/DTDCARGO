import { expect, type Locator } from "@playwright/test";

/**
 * Espera a que React sea DUEÑO de un nodo antes de tocarlo.
 *
 * ⚠️ POR QUÉ EXISTE.
 *
 * Playwright espera a que un elemento sea "accionable" —visible, estable,
 * habilitado, que reciba eventos—. Eso lo cumple de sobra un nodo que todavía
 * es HTML del servidor: se ve, no se mueve y acepta teclas y clics. Pero si
 * React aún no hidrató, esas teclas caen en el DOM y **no corre ningún
 * `onChange`**; ese clic no dispara ningún `onClick`. El campo se llena en
 * pantalla, el estado se queda en 0, y la calculadora muestra "Ingresa tu CBM
 * para ver el estimado" con el 12 escrito al lado.
 *
 * Con el caché de `.next` caliente la hidratación llega antes que la primera
 * tecla y no se nota. En frío llega tarde. Medido por el founder el 2026-08-20
 * sobre `calculadora-sin-peso.spec.ts` + `calc-event.spec.ts`, misma máquina:
 *
 * | caché    | resultado                    |
 * |----------|------------------------------|
 * | frío     | 9 flaky, 6 passed (2,8 min)  |
 * | caliente | 15 passed (47-53 s)          |
 *
 * Los "flaky" pasaban al reintentar —el segundo intento ya encontraba el caché
 * caliente—, así que el gate salía VERDE y el problema quedaba invisible. Eso
 * es lo peligroso: hoy el gate depende del reintento para pasar, y un fallo
 * REAL de la calculadora se vería idéntico a este ruido.
 *
 * ⚠️ EL CACHÉ FRÍO NO ALCANZA PARA REPRODUCIRLO. Ese mismo 2026-08-20, los dos
 * specs en frío (`.next` borrado) en la misma máquina pero OCIOSA —16 núcleos,
 * 8 workers— dieron 15/15 sin un solo flaky. El caché frío no causa la carrera:
 * la ensancha. Lo que la destapa es la máquina cargada (las ~38 ventanas del
 * modelo multi-worktree). O sea: intentar reproducir esto "corriendo en frío"
 * lleva a concluir que no existe. Por eso `../calculadora-hidratacion.spec.ts`
 * la fuerza en vez de esperarla.
 *
 * ⚠️ NO se arregla con `waitForTimeout`: un número fijo esconde el problema en
 * la máquina rápida y lo deja intacto en la lenta.
 *
 * Es la forma general de lo que `cbm-ayuda.spec.ts` resuelve a mano en su
 * `abrirPanel()` (reintentar el clic hasta que pegue). Acá no se puede
 * reintentar a ciegas —tecleo repetido no es idempotente contra un campo que sí
 * recibió la mitad—, así que en vez de repetir se ESPERA la condición real.
 */

/**
 * Marcador de hidratación. React no publica ninguno, así que se lee el interno
 * de react-dom: al hidratar un nodo, React le cuelga `__reactProps$<hash>` con
 * las props de ESE elemento (`internalPropsKey` en el código de react-dom).
 * Cuando la propiedad existe, React ya montó el nodo, y el delegador de eventos
 * de la raíz —que se instala ANTES de recorrer el árbol— ya está escuchando: a
 * partir de ahí una tecla sí dispara el `onChange` sintético.
 *
 * Sí, es un detalle interno; es también el único que responde exactamente la
 * pregunta que importa. Estable desde React 17, verificado acá contra 19.2.4.
 * Si algún día react-dom lo renombra, `esperarHidratado()` NO se queda colgado
 * en silencio: falla diciendo cuántos nodos de la página traen el marcador
 * (0 = cambió el nombre → hay que actualizar este archivo; >0 = React vive pero
 * no llegó a este nodo).
 */
const CLAVE_PROPS = "__reactProps$";

/** Timeout de la espera. Holgado porque en frío el bundle de dev tarda. */
const TIMEOUT_HIDRATACION = 20_000;

export type SondaReact = {
  /** React ya hidrató ESTE nodo (le colgó sus props). */
  hidratado: boolean;
  /** Lo que React cree que vale el input. `null` si todavía no lo hidrató. */
  react: string | null;
  /** Lo que se ve en pantalla. */
  dom: string;
};

/**
 * Lee, del mismo nodo, las dos versiones de la verdad: la de React y la del
 * DOM. Que difieran es exactamente el síntoma del bug — campo lleno, estado
 * vacío.
 */
export async function sondearReact(el: Locator): Promise<SondaReact> {
  return el.evaluate((nodo, prefijo) => {
    const clave = Object.keys(nodo).find((k) => k.startsWith(prefijo));
    const props = clave
      ? (nodo as unknown as Record<string, { value?: unknown } | undefined>)[
          clave
        ]
      : undefined;
    const valor = props?.value;
    return {
      hidratado: props !== undefined,
      react:
        props === undefined ? null : valor === undefined || valor === null ? "" : String(valor),
      dom: (nodo as unknown as HTMLInputElement).value ?? "",
    };
  }, CLAVE_PROPS);
}

/** Cuántos nodos de la página tienen el marcador. Solo para diagnosticar. */
async function contarHidratados(el: Locator): Promise<number> {
  return el.page().evaluate((prefijo) => {
    let n = 0;
    document.querySelectorAll("*").forEach((nodo) => {
      if (Object.keys(nodo).some((k) => k.startsWith(prefijo))) n += 1;
    });
    return n;
  }, CLAVE_PROPS);
}

/**
 * Bloquea hasta que React haya hidratado `el`. Úsalo antes del PRIMER clic o
 * tecla sobre cualquier control de React — si el clic se pierde, no hay
 * reintento que valga: el `toBeVisible()` siguiente espera para siempre algo
 * que ya nadie va a disparar.
 */
export async function esperarHidratado(
  el: Locator,
  quien = "el elemento",
): Promise<void> {
  await el.waitFor({ state: "attached", timeout: TIMEOUT_HIDRATACION });
  try {
    await expect
      .poll(async () => (await sondearReact(el)).hidratado, {
        timeout: TIMEOUT_HIDRATACION,
        intervals: [50, 100, 200, 400],
      })
      .toBe(true);
  } catch (causa) {
    const causaOriginal =
      causa instanceof Error ? causa.message : String(causa);
    let diagnostico: string;

    try {
      const conMarcador = await contarHidratados(el);
      diagnostico =
        `Nodos con marcador en la página: ${conMarcador}. ` +
        (conMarcador === 0
          ? `Cero: o la página no hidrató, o react-dom renombró "${CLAVE_PROPS}" ` +
            `y hay que actualizar e2e/_helpers/hidratacion.ts.`
          : `Hay ${conMarcador}, así que React vive: el nodo que se espera no es parte de su árbol.`);
    } catch (errorConteo) {
      const detalleConteo =
        errorConteo instanceof Error ? errorConteo.message : String(errorConteo);
      diagnostico =
        `No se pudo contar los nodos con marcador porque el contexto de la página ` +
        `dejó de estar disponible durante el diagnóstico. Error del conteo: ${detalleConteo}.`;
    }

    throw new Error(
      `React nunca tomó ${quien} en ${TIMEOUT_HIDRATACION / 1000} s. ` +
        `Causa original: ${causaOriginal}. ${diagnostico}`,
      { cause: causa },
    );
  }
}
