// @vitest-environment node
/**
 * El semáforo de conversación tiene que estar en LAS DOS vistas.
 *
 * Mismo contrato —y misma cicatriz— que `stage-control.test.ts`: el verbo de
 * mover etapa nació sólo en la tabla del Asesor, el Tablero quedó de sólo
 * lectura, y el diagnóstico del founder fue "el ERP no escribe al CRM". Un
 * indicador a medias es peor que ninguno, porque entrena a no mirar la pantalla.
 *
 * Acá se agrega una segunda cosa que fijar: **que la antigüedad no vuelva a
 * competir por el rojo.** Antes de SDD-0288, ≥180 días pintaba `--danger`. Si
 * alguien lo restaura, el Tablero tendría dos rojos con significados distintos
 * y el asesor no podría saber cuál está mirando.
 *
 * Es un test de fuente (no de render) por lo mismo que sus hermanos: lo que se
 * afirma es el CABLEADO, y montar el árbol exigiría el runtime de Server Actions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const DIR = "app/studio/(app)/crm/_components";
const VISTAS = [`${DIR}/KommoClient.tsx`, `${DIR}/KommoBoardView.tsx`] as const;

describe("el punto de conversación está en las dos vistas", () => {
  it.each(VISTAS)("%s monta <PuntoConversacion>", (path) => {
    const code = read(path);
    expect(code).toContain("<PuntoConversacion");
    expect(code).toContain('from "./PuntoConversacion"');
  });

  it.each(VISTAS)("%s le pasa un reloj explícito, no lo deja leerlo adentro", (path) => {
    // La derivada es pura y recibe `ahoraMs`. Si una vista dejara que el
    // componente llamara a Date.now() por su cuenta, dos tarjetas del mismo
    // render podrían caer en minutos distintos.
    expect(read(path)).toMatch(/<PuntoConversacion[\s\S]{0,120}ahoraMs=/);
  });
});

describe("🔴 la antigüedad NO puede recuperar el rojo", () => {
  it.each(VISTAS)("%s pinta la antigüedad en ámbar, nunca en --danger", (path) => {
    const code = read(path);
    const ageTone = code.slice(
      code.indexOf("function ageTone"),
      code.indexOf("function ageTone") + 400,
    );
    expect(ageTone).toContain("var(--warning)");
    expect(ageTone).not.toContain("var(--danger)");
  });
});

describe("el punto sale de la derivada compartida, no de un cálculo suelto", () => {
  it("PuntoConversacion deriva con conversacionDe y colorConversacion", () => {
    const code = read(`${DIR}/PuntoConversacion.tsx`);
    expect(code).toContain("conversacionDe(");
    expect(code).toContain("colorConversacion(");
    // El color NO se escribe a mano en el componente: sale de la derivada, que
    // es donde está probado que sólo "te escribió" es rojo.
    expect(code).not.toContain('background: "var(--danger)"');
  });

  it("las dos fechas viajan en la MISMA constante de columnas", () => {
    // Si el Tablero y la tabla pidieran selects distintos, el punto saldría en
    // una vista y en la otra no — sin que ningún test se enterara.
    const q = read("lib/studio/kommo-queries.ts");
    const cols = q.slice(q.indexOf("const LEAD_COLUMNS"), q.indexOf("const LEAD_COLUMNS") + 500);
    expect(cols).toContain("last_inbound_at");
    expect(cols).toContain("last_outbound_at");
  });
});

describe("🔴 el estampado va DESPUES del espejado, no antes", () => {
  it("kommo-webhook espeja las entidades y recien despues estampa el mensaje", () => {
    // Nacio al reves, y lo delataron los logs de produccion del 2026-08-25: dos
    // mensajes salieron `sinEspejar` porque la RPC es UPDATE (no upsert) y la
    // fila del lead todavia no existia. Cuando un mismo POST trae `leads[add]`
    // y su primer `message[add]`, hay que espejar primero — si no, el primer
    // mensaje de un lead nuevo (el que mas urge ver) se pierde.
    const code = readFileSync(
      join(process.cwd(), "supabase/functions/kommo-webhook/index.ts"),
      "utf8",
    );
    const espeja = code.indexOf("const res = await applyEntityEvents(");
    const estampa = code.indexOf('supabase.rpc("kommo_touch_lead_message"');

    expect(espeja).toBeGreaterThan(-1);
    expect(estampa).toBeGreaterThan(-1);
    expect(espeja).toBeLessThan(estampa);
  });
});

describe("🔴 el espejo de tareas NO puede apagar la integracion", () => {
  it("kommo-sync espeja `tasks` con loggedJanitorial, no con logged", () => {
    // `index.ts` hace results.every(r => r.status === "ok") y con un solo fallo
    // pone kommo_connections.status = 'error'. Con la conexion fuera de active
    // se rechazan con 409 el sync, el drenaje del write-back Y el push de
    // altas — o sea que el Shipping Mark deja de llegar a Kommo.
    //
    // El espejo de tareas es un DIAGNOSTICO. No puede tener el poder de apagar
    // el canal que mueve dinero. Y tiene un modo de fallo realista: si Kommo
    // ignora el filter[is_completed]=0 (no verificado), traeria el historico
    // entero y tiraria por truncamiento.
    const code = readFileSync(
      join(process.cwd(), "supabase/functions/kommo-sync/sync.ts"),
      "utf8",
    );
    expect(code).toContain('loggedJanitorial(supabase, conn, "tasks"');
    expect(code).not.toContain('logged(supabase, conn, "tasks"');
  });
});

describe("🔴 la medicion de valores NO puede vivir dentro de una rama", () => {
  it("valoresEnumerados se llama antes del early-return de forma desconocida", () => {
    // Nacio dentro de la rama `events.length === 0`, y eso se volvio una
    // ceguera autoinfligida: al desplegar el parser de mensajes dejaron de caer
    // ahi y se apago la unica ventana que habia sobre ellos.
    //
    // Lo destapo el 2026-08-25: 47 leads con conversacion, los 47 en rojo y
    // CERO con saliente. Sin este log no hay forma de saber si Kommo emite
    // webhook para los mensajes salientes, y el estado "esperando" queda
    // inalcanzable.
    const code = readFileSync(
      join(process.cwd(), "supabase/functions/kommo-webhook/index.ts"),
      "utf8",
    );
    const mide  = code.indexOf("const valores = valoresEnumerados(crudo);");
    // SDD-0535 sumó las entradas de la bandeja a la condición de la salida temprana.
    const rama  = code.indexOf(
      "if (parsed.events.length === 0 && mensajes.length === 0 && entradas.length === 0)",
    );

    expect(mide).toBeGreaterThan(-1);
    expect(rama).toBeGreaterThan(-1);
    expect(mide).toBeLessThan(rama);
  });
});
