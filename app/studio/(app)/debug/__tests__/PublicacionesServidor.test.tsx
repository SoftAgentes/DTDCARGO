/**
 * SDD-0547 · card «Publicaciones del servidor» de la Torre de control.
 *
 * Cubre:
 *  - Sin datos (cada motivo), en local y en el servidor: «Sin datos» + motivo,
 *    sin caerse.
 *  - Con datos: vigilante, qué corre, qué es publicable, vuelta atrás,
 *    historial con su resultado, motivo, migraciones faltantes y enlace.
 *  - Avisos: vigilante sin vueltas recientes, instancia distinta de lo que
 *    registra el servidor, congelado a mano o automático, entradas descartadas.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PublicacionesServidor } from "../_components/PublicacionesServidor";
import type {
  EstadoPublicaciones,
  LecturaPublicaciones,
  MotivoSinDatos,
} from "@/lib/studio/publicaciones-types";

const A = "c2fabdcc17e3ca28c62238764a82aa46ca515cca";
const B = "03e0e078ef18b0c2c1a217a07c8d4e0eeb14d1c7";
const AHORA = Date.parse("2026-10-17T17:45:00Z");

function estado(extra: Partial<EstadoPublicaciones> = {}): EstadoPublicaciones {
  return {
    actualizado: AHORA - 60_000,
    corre: B,
    anterior: null,
    publicable: B,
    vigilante: { estado: "al-dia", motivo: null, faltan: [] },
    congelado: null,
    historial: [],
    descartados: 0,
    ...extra,
  };
}

function conDatos(extra: Partial<EstadoPublicaciones> = {}): LecturaPublicaciones {
  return { ok: true, estado: estado(extra), leidoEn: AHORA };
}

describe("PublicacionesServidor · sin datos", () => {
  it.each<[MotivoSinDatos, RegExp]>([
    ["sin-archivo", /no ha dejado el estado/],
    ["ilegible", /no se pudo leer/],
    ["demasiado-grande", /más grande de lo esperado/],
    ["formato", /no tiene el formato esperado/],
    ["version", /otra versión del formato/],
  ])("%s: «Sin datos» y su motivo", (motivo, texto) => {
    render(
      <PublicacionesServidor
        lectura={{ ok: false, motivo, leidoEn: AHORA }}
        env="production"
        shaInstancia={B}
      />,
    );
    const zona = screen.getByRole("status");
    expect(within(zona).getByText("Sin datos")).toBeInTheDocument();
    expect(within(zona).getByText(texto)).toBeInTheDocument();
    expect(within(zona).getByText(/vigilante de publicación del servidor \(publicar-web\.sh\)/)).toBeInTheDocument();
  });

  it("en local explica que es lo normal", () => {
    render(
      <PublicacionesServidor
        lectura={{ ok: false, motivo: "sin-archivo", leidoEn: AHORA }}
        env="local"
        shaInstancia={null}
      />,
    );
    expect(screen.getByText(/En local es lo normal/)).toBeInTheDocument();
    expect(screen.queryByText(/avísale al Director/)).not.toBeInTheDocument();
  });

  it("no nombra la ruta interna del archivo (ERR-01)", () => {
    const { container } = render(
      <PublicacionesServidor
        lectura={{ ok: false, motivo: "sin-archivo", leidoEn: AHORA }}
        env="production"
        shaInstancia={B}
      />,
    );
    expect(container.textContent).not.toMatch(/\/var\/lib|\/srv\//);
  });
});

describe("PublicacionesServidor · con datos", () => {
  it("al día: vigilante, commit que corre con su enlace, y sin avisos", () => {
    render(<PublicacionesServidor lectura={conDatos()} env="production" shaInstancia={B} />);
    expect(screen.getByText("Al día")).toBeInTheDocument();
    expect(screen.getByText("hace 1 min")).toBeInTheDocument();
    expect(screen.getAllByText("03e0e078").length).toBeGreaterThan(0);
    const enlaces = screen.getAllByRole("link", { name: /Ver commit/ });
    expect(enlaces[0]).toHaveAttribute("href", `https://github.com/hailuwaycom-sketch/DTDCARGO/commit/${B}`);
    expect(screen.queryByText("Sin vueltas recientes")).not.toBeInTheDocument();
    expect(screen.queryByText(/no coincide con lo que registra el servidor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Todavía no corre en el servidor/)).not.toBeInTheDocument();
    expect(screen.getByText("Sin publicaciones registradas todavía.")).toBeInTheDocument();
  });

  it("retenida por migraciones: motivo, nombres faltantes y publicable pendiente", () => {
    render(
      <PublicacionesServidor
        lectura={conDatos({
          publicable: A,
          vigilante: { estado: "retenida", motivo: "migraciones", faltan: ["0492_ejemplo", "0493_otra"] },
        })}
        env="production"
        shaInstancia={B}
      />,
    );
    expect(screen.getByText("Retenida")).toBeInTheDocument();
    expect(screen.getByText(/Faltan migraciones en la base/)).toBeInTheDocument();
    expect(screen.getByText("0492_ejemplo")).toBeInTheDocument();
    expect(screen.getByText("0493_otra")).toBeInTheDocument();
    expect(screen.getByText("Todavía no corre en el servidor.")).toBeInTheDocument();
  });

  it("historial: cada evento con su resultado, origen, motivo y enlace; marca el que corre", () => {
    render(
      <PublicacionesServidor
        lectura={conDatos({
          historial: [
            {
              hora: AHORA - 3 * 60_000,
              sha: A,
              origen: "vigilante",
              resultado: "vuelta-atras",
              motivo: "prueba-rapida",
              faltan: [],
            },
            {
              hora: AHORA - 2 * 3_600_000,
              sha: B,
              origen: "a-mano",
              resultado: "publicada",
              motivo: null,
              faltan: [],
            },
          ],
        })}
        env="production"
        shaInstancia={B}
      />,
    );
    const filas = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(filas).toHaveLength(2);

    expect(within(filas[0]).getByText("Falló y volvió")).toBeInTheDocument();
    expect(within(filas[0]).getByText("automática")).toBeInTheDocument();
    expect(within(filas[0]).getByText("La prueba rápida falló dos veces.")).toBeInTheDocument();
    expect(within(filas[0]).getByText("hace 3 min")).toBeInTheDocument();
    expect(within(filas[0]).queryByText("corre ahora")).not.toBeInTheDocument();
    // Cada enlace se distingue por su commit, no solo por «Ver commit».
    expect(
      within(filas[0]).getByRole("link", { name: "Ver commit c2fabdcc en GitHub (abre otra pestaña)" }),
    ).toHaveAttribute("href", `https://github.com/hailuwaycom-sketch/DTDCARGO/commit/${A}`);

    expect(within(filas[1]).getByText("Publicada")).toBeInTheDocument();
    expect(within(filas[1]).getByText("a mano")).toBeInTheDocument();
    expect(within(filas[1]).getByText("hace 2 h")).toBeInTheDocument();
    expect(within(filas[1]).getByText("corre ahora")).toBeInTheDocument();
  });

  it("sin vueltas recientes: avisa que el vigilante puede estar detenido", () => {
    render(
      <PublicacionesServidor
        lectura={conDatos({ actualizado: AHORA - 40 * 60_000 })}
        env="production"
        shaInstancia={B}
      />,
    );
    expect(screen.getByText("Sin vueltas recientes")).toBeInTheDocument();
    expect(screen.getByText(/Puede estar detenido/)).toBeInTheDocument();
  });

  it("instancia distinta de lo que registra el servidor: lo dice", () => {
    render(<PublicacionesServidor lectura={conDatos()} env="staging" shaInstancia={A} />);
    expect(screen.getByText(/no coincide con lo que registra el servidor/)).toBeInTheDocument();
    expect(screen.getByText("c2fabdcc")).toBeInTheDocument();
  });

  it("congelado a mano y congelado automático se distinguen", () => {
    const { unmount } = render(
      <PublicacionesServidor
        lectura={conDatos({
          vigilante: { estado: "congelado", motivo: null, faltan: [] },
          congelado: { desde: AHORA - 5 * 60_000, automatico: false },
        })}
        env="production"
        shaInstancia={B}
      />,
    );
    expect(screen.getByText("Congelado")).toBeInTheDocument();
    expect(screen.getByText(/Congelado a mano/)).toBeInTheDocument();
    expect(screen.getByText(/Desde hace 5 min/)).toBeInTheDocument();
    unmount();

    render(
      <PublicacionesServidor
        lectura={conDatos({
          vigilante: { estado: "congelado", motivo: null, faltan: [] },
          congelado: { desde: null, automatico: true },
        })}
        env="production"
        shaInstancia={B}
      />,
    );
    expect(screen.getByText(/Se congeló solo porque falló una vuelta atrás/)).toBeInTheDocument();
  });

  it("campos sin datos y entradas descartadas no rompen la card", () => {
    render(
      <PublicacionesServidor
        lectura={conDatos({ corre: null, publicable: null, anterior: null, vigilante: null, descartados: 2 })}
        env="production"
        shaInstancia={B}
      />,
    );
    expect(screen.getAllByText("Sin datos").length).toBe(4);
    expect(screen.getByText(/2 entradas del historial no tenían el formato esperado/)).toBeInTheDocument();
  });
});
