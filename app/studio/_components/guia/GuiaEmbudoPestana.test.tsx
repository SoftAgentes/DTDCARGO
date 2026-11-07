/**
 * SDD-0589 · paso P-13 · el recorrido Embudo abre en `/studio/crm` sin `?tab=`.
 *
 * `/studio/crm` monta el tablero de Embudos solo con `tab === "embudos"`
 * (`app/studio/(app)/crm/page.tsx`), y la pestaña por defecto la decide la 6.6:
 * Dirección hoy, Embudos en S0 y Resumen en S3 (SDD-0614 §2.1). Sin el tablero
 * no hay anclas `embudo.*`, y el motor no abre. Esta prueba simula la página con
 * cada pestaña por defecto y exige que `?guia=embudo` y el botón lleguen a
 * Embudos y abran en E1.
 *
 * La navegación es un doble reactivo de `next/navigation`: `router.replace` cambia
 * la URL un rato después, como una transición de Next, y la página y el motor la
 * vuelven a leer.
 */

import { act, render, screen, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveKommoTab } from "@/app/studio/(app)/crm/_components/kommo-tabs.shared";
import { crearAlmacenMemoria } from "@/lib/studio/guia/almacen";
import { RECORRIDO_EMBUDO, RECORRIDOS } from "@/lib/studio/guia/recorridos";
import type { GuiaRecorrido } from "@/lib/studio/guia/tipos";
import { GuiaMotor, iniciarGuia } from "./GuiaMotor";

const nav = vi.hoisted(() => {
  const oyentes = new Set<() => void>();
  const estado = { pathname: "/studio/crm", query: "", demoraMs: 0 };
  const fijar = (query: string) => {
    estado.query = query;
    for (const avisar of oyentes) avisar();
  };
  const replace = vi.fn((href: string) => {
    const query = new URL(href, "http://studio.test").search.replace(/^\?/, "");
    setTimeout(() => fijar(query), estado.demoraMs);
  });
  return { oyentes, estado, fijar, replace };
});

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const suscribir = (avisar: () => void) => {
    nav.oyentes.add(avisar);
    return () => {
      nav.oyentes.delete(avisar);
    };
  };
  return {
    usePathname: () => useSyncExternalStore(suscribir, () => nav.estado.pathname),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(suscribir, () => nav.estado.query)),
    useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  };
});

type Resolver = (raw: string | null) => string;

/** Pestañas de `/studio/crm`; `resumen` llega en S3 (SDD-0614 §2.1). */
const PESTANAS = ["resumen", "direccion", "tablero", "asesor", "recuperacion", "embudos", "sin-atender"];
const conDefecto =
  (defecto: string): Resolver =>
  (raw) =>
    raw !== null && PESTANAS.includes(raw) ? raw : defecto;

/** Las pestañas por defecto que puede tener `/studio/crm` mientras dura la 6.6. */
const CASOS: Array<{ nombre: string; resolver: Resolver }> = [
  { nombre: "Dirección (main hoy)", resolver: conDefecto("direccion") },
  { nombre: "Resumen (S3 de la SDD-0614)", resolver: conDefecto("resumen") },
  { nombre: "Embudos (S0 de la SDD-0614)", resolver: conDefecto("embudos") },
  { nombre: "la de resolveKommoTab en esta rama", resolver: (raw) => resolveKommoTab(raw) },
];

/** El tablero de Embudos con sus cuatro anclas; con `tardaMs`, como el Suspense de la página. */
function TableroEmbudos({ tardaMs }: { tardaMs: number }) {
  const [listo, setListo] = useState(tardaMs === 0);
  useEffect(() => {
    if (tardaMs === 0) return;
    const t = setTimeout(() => setListo(true), tardaMs);
    return () => clearTimeout(t);
  }, [tardaMs]);
  if (!listo) return <p>Cargando embudos…</p>;
  return (
    <div data-guia="embudo.tablero">
      <section data-guia="embudo.columna-entrada">
        <article data-guia="embudo.tarjeta">
          Tarjeta
          <button type="button" data-guia="embudo.tareas">
            Tareas
          </button>
        </article>
      </section>
    </div>
  );
}

/** Lo que hace `crm/page.tsx` con la pestaña: el tablero solo se monta en Embudos. */
function PaginaCrm({ resolver, tardaMs }: { resolver: Resolver; tardaMs: number }) {
  const tab = resolver(new URLSearchParams(nav.estado.query).get("tab"));
  // Se suscribe a la URL igual que el motor, para volver a pintar al cambiarla.
  const [, refrescar] = useState(0);
  useEffect(() => {
    const avisar = () => refrescar((n) => n + 1);
    nav.oyentes.add(avisar);
    return () => {
      nav.oyentes.delete(avisar);
    };
  }, []);
  return (
    <main>
      <p data-testid="pestana">{tab}</p>
      {tab === "embudos" ? <TableroEmbudos tardaMs={tardaMs} /> : <p>Pestaña {tab}</p>}
    </main>
  );
}

function montar({
  resolver = conDefecto("direccion"),
  tardaMs = 0,
  catalogo = RECORRIDOS,
  autoArranque = false,
}: { resolver?: Resolver; tardaMs?: number; catalogo?: readonly GuiaRecorrido[]; autoArranque?: boolean } = {}) {
  return render(
    <>
      <PaginaCrm resolver={resolver} tardaMs={tardaMs} />
      <GuiaMotor catalogo={catalogo} almacen={crearAlmacenMemoria()} autoArranque={autoArranque} />
    </>,
  );
}

const tarjeta = () => screen.queryByRole("dialog");
/**
 * Avanza el reloj de a 50 ms, cada paso en su `act`: React pinta entre un paso y otro,
 * como en el navegador. Un solo `act` largo dejaría todo el trabajo para el final.
 */
const esperar = (ms: number) => {
  for (let hecho = 0; hecho < ms; hecho += 50) act(() => vi.advanceTimersByTime(Math.min(50, ms - hecho)));
};
const pestana = () => screen.getByTestId("pestana").textContent;
/** Parámetros de la última URL que pidió el motor. */
const ultimaUrl = () => {
  const href = nav.replace.mock.lastCall?.[0] as string | undefined;
  return href ? new URL(href, "http://studio.test") : null;
};

beforeEach(() => {
  vi.useFakeTimers();
  nav.estado.pathname = "/studio/crm";
  nav.estado.query = "";
  nav.estado.demoraMs = 0;
  nav.replace.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("P-13 · el recorrido Embudo abre en /studio/crm sin ?tab=", () => {
  it.each(CASOS)("con la pestaña por defecto en $nombre, ?guia=embudo lleva a Embudos y abre en E1", ({ resolver }) => {
    nav.estado.query = "guia=embudo";
    montar({ resolver });
    esperar(5_000);

    const d = tarjeta();
    expect(d, "la guía no abrió").not.toBeNull();
    expect(within(d!).getByText(/1 de 4/)).toBeInTheDocument();
    expect(screen.getByTestId("guia-contorno")).toBeInTheDocument();
    expect(pestana()).toBe("embudos");
  });

  it("cambia la pestaña con replace, sin scroll, y conserva ?guia= y los demás parámetros", () => {
    nav.estado.query = "guia=embudo&embudo=clientes";
    montar({ resolver: conDefecto("resumen") });
    esperar(5_000);

    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenLastCalledWith(expect.stringMatching(/^\/studio\/crm\?/), { scroll: false });
    const url = ultimaUrl();
    expect(url?.pathname).toBe("/studio/crm");
    expect(url?.searchParams.get("tab")).toBe("embudos");
    expect(url?.searchParams.get("guia")).toBe("embudo");
    expect(url?.searchParams.get("embudo")).toBe("clientes");
    expect(tarjeta()).not.toBeNull();
  });

  it("espera al tablero después de cambiar de pestaña, aunque la URL y el tablero tarden más de 2 s en total", () => {
    nav.estado.query = "guia=embudo";
    nav.estado.demoraMs = 1_200;
    montar({ resolver: conDefecto("direccion"), tardaMs: 1_500 });

    esperar(1_000);
    expect(pestana()).toBe("direccion");
    expect(tarjeta()).toBeNull();
    esperar(5_000);
    expect(pestana()).toBe("embudos");
    expect(tarjeta()).not.toBeNull();
  });

  it("tras cambiar de pestaña espera hasta 10 s al tablero, no los 2 s de siempre", () => {
    nav.estado.query = "guia=embudo";
    montar({ resolver: conDefecto("resumen"), tardaMs: 6_000 });
    esperar(4_000);
    expect(pestana()).toBe("embudos");
    expect(tarjeta()).toBeNull();
    esperar(3_000);
    expect(tarjeta()).not.toBeNull();
  });

  it("si la persona se va a otra pestaña mientras espera al tablero, no la trae de vuelta", () => {
    nav.estado.query = "guia=embudo";
    montar({ resolver: conDefecto("direccion"), tardaMs: 3_000 });
    esperar(500);
    expect(pestana()).toBe("embudos");

    act(() => nav.fijar("tab=asesor"));
    esperar(12_000);
    expect(pestana()).toBe("asesor");
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(tarjeta()).toBeNull();
  });

  it("un reintento no cambia la pestaña: solo el primer intento del pedido navega", () => {
    nav.estado.query = "tab=embudos&guia=embudo";
    montar({ resolver: conDefecto("direccion"), tardaMs: 1_000 });
    // Antes de que el tablero pinte, la persona pasa a Dirección y ?guia= se queda.
    act(() => nav.fijar("tab=direccion&guia=embudo"));
    esperar(5_000);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(pestana()).toBe("direccion");
    expect(tarjeta()).toBeNull();
  });

  it("el botón (iniciarGuia con origen «boton») también lleva a Embudos desde otra pestaña", () => {
    montar({ resolver: conDefecto("resumen") });
    esperar(1_000);
    expect(tarjeta()).toBeNull();

    act(() => iniciarGuia("embudo", { origen: "boton" }));
    esperar(5_000);

    expect(ultimaUrl()?.searchParams.get("tab")).toBe("embudos");
    expect(ultimaUrl()?.searchParams.has("guia")).toBe(false);
    expect(tarjeta()).not.toBeNull();
  });

  it("con ?tab=embudos ya en la URL no navega y abre", () => {
    nav.estado.query = "tab=embudos&guia=embudo";
    montar({ resolver: conDefecto("resumen") });
    esperar(5_000);

    expect(nav.replace).not.toHaveBeenCalled();
    expect(tarjeta()).not.toBeNull();
  });

  it("cambiar de pestaña con la guía abierta la cierra, como cambiar de ruta", () => {
    nav.estado.query = "tab=embudos&guia=embudo";
    montar({ resolver: conDefecto("direccion") });
    esperar(1_000);
    expect(tarjeta()).not.toBeNull();

    act(() => nav.fijar(""));
    esperar(1_000);
    expect(pestana()).toBe("direccion");
    expect(tarjeta()).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("el arranque automático no cambia la pestaña de nadie: abre solo si ya está en Embudos", () => {
    const conAuto: GuiaRecorrido = { ...RECORRIDO_EMBUDO, arranqueAutomatico: true };
    montar({ resolver: conDefecto("direccion"), catalogo: [conAuto], autoArranque: true });
    esperar(5_000);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(tarjeta()).toBeNull();

    act(() => nav.fijar("tab=embudos"));
    esperar(1_000);
    expect(tarjeta()).not.toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("fuera de /studio/crm, ?guia=embudo no navega ni abre", () => {
    nav.estado.pathname = "/studio/dashboard";
    nav.estado.query = "guia=embudo";
    montar();
    esperar(5_000);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(tarjeta()).toBeNull();
  });

  it("la pestaña que pide el recorrido existe en el CRM y es la que monta el tablero", () => {
    const tab = RECORRIDO_EMBUDO.consulta?.tab;
    expect(tab).toBe("embudos");
    expect(resolveKommoTab(tab)).toBe(tab);
  });
});
