/**
 * SDD-0311 · Un aviso al cliente necesita un disparador que ALGUIEN llame.
 *
 * 🔴 **De dónde sale este contrato.** El 2026-07-19 el arribo a Venezuela dejó
 * de avisarse por la transición de status del envío —se quitó el mail
 * `shipment_arrived`— y pasó a ser canónico por `received_ve`. La migración
 * 0331 sembró la regla, el motor quedó listo, la cápsula de gobernanza lo dio
 * por cerrado.
 *
 * Pero `received_ve` sólo se programaba desde `scheduleReceiptVeReceived`, que
 * sólo se llamaba desde `createReceiptVe` — y `createReceiptVe` **no tenía un
 * solo llamador en todo el repo**. El recibo de contenedor VE no se podía crear
 * desde ninguna pantalla. Resultado: el cliente se quedó sin el aviso que más
 * espera, por las dos vías a la vez, y nada salió rojo: el código estaba
 * escrito, testeado y desplegado. Sólo que nadie lo llamaba.
 *
 * Un evento con regla sembrada y sin disparador alcanzable se ve EXACTAMENTE
 * igual que uno que funciona. Este contrato es lo que los distingue.
 *
 * ── QUÉ MIRA ──────────────────────────────────────────────────────────────
 *
 * Toda función exportada de `lib/` que programe un aviso al cliente tiene que
 * nombrarse en algún archivo de `app/` — o sea, tener por dónde entrar desde
 * una ruta, una server action o un cron.
 *
 * ── QUÉ **NO** PRUEBA ─────────────────────────────────────────────────────
 *
 * Que el camino esté vivo de punta a punta. Un archivo de `app/` puede a su vez
 * no montarse, o el botón puede estar detrás de una bandera apagada. Esto
 * detecta la clase concreta que nos mordió —el disparador sin ningún
 * llamador— y no más que eso. Es una alarma de humo, no una inspección.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..", "..");

/** Las funciones que efectivamente ponen un aviso en la agenda del cliente. */
const DISPATCHERS = [
  "scheduleClientNotifications",
  "scheduleConsolidationEvent",
  "scheduleSailingEvent",
  "scheduleReceiptVeReceived",
  "scheduleReceiptInWarehouse",
];

/**
 * Los módulos que DEFINEN los dispatchers. Su alcance se juzga por quién los
 * llama, no por ellos mismos.
 */
const MODULOS_DISPATCHER = [
  "schedule-fanout.ts",
  "schedule-client-notifications.ts",
];

/**
 * Disparadores que hoy no tienen puerta, a sabiendas. Cada entrada explica por
 * qué se deja pasar; una allowlist sin motivo es una excepción escondida.
 */
const SIN_PUERTA_CONOCIDOS: Record<string, string> = {
  createReceiptVe:
    "SDD-0311 · el recibo de contenedor VE no se puede crear desde ninguna " +
    "pantalla: la función existe completa pero nunca se le construyó la puerta. " +
    "Mientras tanto el arribo se avisa desde changeConsolidationStatus " +
    "(→ arribado) en app/studio/(app)/naviera/actions.ts. Al construir la " +
    "pantalla de recepción de contenedor, borrar esta entrada.",
};

/**
 * Quita comentarios de línea y de bloque. Sirve para no confundir una MENCIÓN
 * con una llamada: un comentario que explica el cableado no es el cableado.
 *
 * Aproximado a propósito — puede recortar un `//` dentro de una URL en un
 * string. Acá sólo se buscan tokens, así que ese recorte no cambia la respuesta.
 */
function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

function archivos(dir: string, exts: string[]): string[] {
  const salida: string[] = [];
  const pendientes = [dir];
  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    let entradas: string[];
    try {
      entradas = readdirSync(actual);
    } catch {
      continue;
    }
    for (const e of entradas) {
      if (e === "node_modules" || e === ".next" || e === "__tests__") continue;
      const p = join(actual, e);
      if (statSync(p).isDirectory()) {
        pendientes.push(p);
      } else if (exts.some((x) => e.endsWith(x)) && !e.includes(".test.")) {
        salida.push(p);
      }
    }
  }
  return salida;
}

/**
 * Funciones exportadas de `lib/` que programan un aviso. El cuerpo se delimita
 * hasta el próximo `export` de nivel superior: alcanza para saber si adentro se
 * llama a un dispatcher, que es todo lo que hace falta acá.
 */
function disparadoresEnLib(): Array<{ nombre: string; archivo: string }> {
  const encontrados: Array<{ nombre: string; archivo: string }> = [];
  for (const archivo of archivos(join(RAIZ, "lib"), [".ts"])) {
    if (MODULOS_DISPATCHER.some((m) => archivo.endsWith(m))) continue;
    const texto = readFileSync(archivo, "utf8");
    if (!DISPATCHERS.some((d) => texto.includes(`${d}(`))) continue;

    const trozos = texto.split(/^export /m);
    for (const trozo of trozos) {
      const m = /^(?:async\s+)?function\s+(\w+)/.exec(trozo);
      if (!m) continue;
      if (!DISPATCHERS.some((d) => trozo.includes(`${d}(`))) continue;
      encontrados.push({ nombre: m[1], archivo: archivo.slice(RAIZ.length + 1) });
    }
  }
  return encontrados;
}

describe("todo disparador de avisos tiene por dónde entrar", () => {
  const enLib = disparadoresEnLib();
  // 🔴 SIN COMENTARIOS, y no es un detalle: la primera versión leía los
  // archivos crudos y salía verde con la allowlist vacía, porque el comentario
  // que escribí en `naviera/actions.ts` para explicar este mismo bug nombra
  // `createReceiptVe` tres veces. La documentación de un cable no es el cable.
  //
  // ⚡ Y se lee UNA sola vez. La primera versión recorría `app/` entero tres
  // veces —una por afirmación— y bajo la carga del gate se pasaba de los 20 s
  // de timeout: rojo intermitente, en el paso `test`, por un contrato que no
  // había cambiado. Un contrato lento se vuelve ruido y termina ignorado.
  const codigoApp: Array<{ ruta: string; codigo: string }> = archivos(
    join(RAIZ, "app"),
    [".ts", ".tsx"],
  ).map((f) => ({
    ruta: f.slice(RAIZ.length + 1),
    codigo: sinComentarios(readFileSync(f, "utf8")),
  }));
  const textoApp = codigoApp.map((a) => a.codigo).join("\n");

  it("el escaneo encuentra algo (si no, todo lo demás de este archivo miente)", () => {
    // Sin esta afirmación, un cambio de layout dejaría la lista vacía y el
    // contrato pasaría en verde sin haber mirado nada. Es el modo de fallo que
    // más veces nos engañó: cobertura cero leída como cobertura limpia.
    //
    // El ancla es `createReceiptVe` porque es un hecho MEDIDO, no un número
    // supuesto: hoy es la única función de `lib/` que programa avisos —el resto
    // del ruteo vive directo en `app/`— y por eso mismo es la que confirma que
    // el escaneo sigue mirando donde debe.
    expect(enLib.map((d) => d.nombre)).toContain("createReceiptVe");
  });

  it("🔴 ninguno se quedó sin llamador en app/", () => {
    const huerfanos = enLib
      .filter((d) => !new RegExp(`\\b${d.nombre}\\b`).test(textoApp))
      .filter((d) => !(d.nombre in SIN_PUERTA_CONOCIDOS));

    expect(
      huerfanos.map((d) => `${d.nombre} (${d.archivo})`),
      "programan un aviso al cliente pero nadie en app/ los llama: el aviso " +
        "nunca sale y nada se pone rojo",
    ).toEqual([]);
  });

  it("la allowlist sigue describiendo algo real, y con motivo", () => {
    // Una excepción que ya no aplica es peor que ninguna: tapa el próximo caso.
    for (const [nombre, motivo] of Object.entries(SIN_PUERTA_CONOCIDOS)) {
      expect(
        enLib.some((d) => d.nombre === nombre),
        `${nombre} está en la allowlist pero ya no programa avisos — borrar la entrada`,
      ).toBe(true);
      expect(motivo.length).toBeGreaterThan(40);
    }
  });

  it("🔴 received_ve se PROGRAMA desde app/, no sólo se menciona", () => {
    // El caso concreto que originó todo esto: si mañana alguien saca el aviso
    // de `changeConsolidationStatus` sin poner otro en su lugar, esto tiene que
    // ponerse rojo en vez de dejar al cliente esperando en silencio.
    //
    // ⚠️ La primera versión de esta afirmación era `expect(textoApp).toContain
    // ("received_ve")` y pasaba en VERDE con el cableado quitado: matcheaba el
    // comentario que explica el cableado. Un contrato que se cumple con su
    // propia documentación no verifica nada. Por eso acá se buscan las dos
    // cosas juntas y sobre el código sin comentarios: el nombre del evento y
    // una llamada real a un dispatcher, en el MISMO archivo.
    const programan = codigoApp.filter(
      ({ codigo }) =>
        codigo.includes('"received_ve"') &&
        DISPATCHERS.some((d) => codigo.includes(`${d}(`)),
    );

    expect(
      programan.map((a) => a.ruta),
      "ningún archivo de app/ programa received_ve: «tu carga llegó a " +
        "Venezuela» no le sale a nadie",
    ).not.toEqual([]);
  });

  it("🔴 y el estado que lo dispara se puede poner desde una pantalla", () => {
    // ⚠️ Este contrato existe porque la afirmación de arriba NO alcanzó.
    //
    // Con `received_ve` ya cableado a `changeConsolidationStatus(→ arribado)`,
    // el contrato anterior salía verde… y el aviso seguía sin poder salir: la
    // UI de Naviera ofrecía «Cerrar contenedor» y «Marcar zarpado», y ahí se
    // cortaba. `arribado` era un estado que el producto sabía nombrar y nadie
    // podía poner. O sea: exactamente el mismo bug que esta spec vino a
    // arreglar, un piso más arriba, y cometido mientras lo arreglaba.
    //
    // La lección, ya en tercera repetición: que el disparador esté en `app/` no
    // prueba que se pueda apretar. Hay que llegar hasta el componente.
    const enPantalla = codigoApp.filter(
      ({ ruta, codigo }) =>
        ruta.endsWith(".tsx") &&
        /changeConsolidationStatus\(\s*[^,)]+,\s*"arribado"\s*\)/.test(codigo),
    );

    expect(
      enPantalla.map((a) => a.ruta),
      "ningún componente pone el contenedor en «arribado»: el estado existe, el " +
        "aviso está cableado, y nadie puede dispararlo",
    ).not.toEqual([]);
  });
});
