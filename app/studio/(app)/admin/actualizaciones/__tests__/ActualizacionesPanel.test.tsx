/**
 * SDD-0588 · pasos 3.3 y 3.4 · ActualizacionesPanel: estados de la revisión, pedido,
 * notas en texto plano y el informe de «Analizar con IA». Todo estado se lee por
 * texto, no solo por color.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ pedir: vi.fn(), revisar: vi.fn(), analizar: vi.fn(), toast: vi.fn() }));
vi.mock("../actions", () => ({ pedirActualizacion: m.pedir, revisarVersionesAhora: m.revisar, analizarConIa: m.analizar }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => ({ success: m.toast }) }));

const { ActualizacionesPanel } = await import("../_components/ActualizacionesPanel");

type Revision = Parameters<typeof ActualizacionesPanel>[0]["revision"];

const release = (version: string, extra: Partial<NonNullable<Revision>["pendientes"][number]> = {}) => ({
  version,
  nombre: `v${version}`,
  publicada: "2026-10-20T10:00:00Z",
  publicadaTexto: "20 oct 2026",
  url: `https://github.com/chatwoot/chatwoot/releases/tag/v${version}`,
  notas: "* fix: algo",
  seguridad: false,
  ...extra,
});

const HAY_NUEVA: Revision = {
  estado: "hay_nueva",
  instalada: "4.19.1",
  disponible: "4.20.0",
  revisadaTexto: "30 oct 2026, 8:00 a. m.",
  pendientes: [release("4.20.0")],
  recortado: false,
  error: null,
};

beforeEach(() => {
  m.pedir.mockReset().mockResolvedValue({ ok: true, error: null });
  m.revisar.mockReset().mockResolvedValue({ ok: true, error: null });
  m.analizar.mockReset().mockResolvedValue({ ok: true, error: null });
  m.toast.mockReset();
});
afterEach(cleanup);

describe("ActualizacionesPanel · 3.3", () => {
  it("sin revisiones: estado vacío con «Revisar ahora»", () => {
    render(<ActualizacionesPanel revision={null} pedidos={[]} />);
    expect(screen.getByText("Todavía no hay revisiones")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Revisar ahora/ })).toBeTruthy();
  });

  it("al día: lo dice con texto y no ofrece pedir", () => {
    render(<ActualizacionesPanel revision={{ ...HAY_NUEVA, estado: "al_dia", instalada: "4.20.0", pendientes: [] }} pedidos={[]} />);
    expect(screen.getByText("Al día")).toBeTruthy();
    expect(screen.getByText(/Tienes la versión más nueva/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Pedir actualización/ })).toBeNull();
  });

  it("versión nueva: muestra instalada y publicada, aclara que no instala nada y pide la disponible", async () => {
    render(<ActualizacionesPanel revision={HAY_NUEVA} pedidos={[]} />);
    expect(screen.getByText("Versión nueva")).toBeTruthy();
    expect(screen.getByText("Subir de 4.19.1 a 4.20.0")).toBeTruthy();
    expect(screen.getByText("no instala nada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pedir actualización a 4.20.0" }));
    await waitFor(() => expect(m.pedir).toHaveBeenCalledTimes(1));
    const fd = m.pedir.mock.calls[0][1] as FormData;
    expect(fd.get("to_version")).toBe("4.20.0");
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.stringMatching(/no se instaló nada/)));
  });

  it("un error del pedido sale traducido en el banner", async () => {
    m.pedir.mockResolvedValueOnce({ ok: false, error: "stale" });
    render(<ActualizacionesPanel revision={HAY_NUEVA} pedidos={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pedir actualización a 4.20.0" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/La versión disponible cambió/);
  });

  it("ya pedida: dice cuándo y por quién, sin botón", () => {
    render(
      <ActualizacionesPanel
        revision={HAY_NUEVA}
        pedidos={[{ id: 1, desde: "4.19.1", hasta: "4.20.0", pedidoTexto: "30 oct 2026", propio: false }]}
      />,
    );
    expect(screen.getByText(/Pedida el 30 oct 2026 por otro administrador/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Pedir actualización/ })).toBeNull();
    const tabla = screen.getByRole("table");
    expect(within(tabla).getByText("4.19.1 → 4.20.0")).toBeTruthy();
    expect(within(tabla).getByText("Otro administrador")).toBeTruthy();
  });

  it("seguridad: badge con texto en la cabecera y en la versión", () => {
    render(<ActualizacionesPanel revision={{ ...HAY_NUEVA, pendientes: [release("4.20.0", { seguridad: true })] }} pedidos={[]} />);
    expect(screen.getByText("Trae arreglos de seguridad")).toBeTruthy();
    expect(screen.getByText("Seguridad")).toBeTruthy();
  });

  it("error de lectura: explica qué fuente falló", () => {
    render(<ActualizacionesPanel revision={{ ...HAY_NUEVA, estado: "error", error: "releases_no_responde", pendientes: [] }} pedidos={[]} />);
    expect(screen.getByText("No se pudo revisar")).toBeTruthy();
    expect(screen.getByText(/GitHub no respondió/)).toBeTruthy();
  });

  it("las notas se muestran como texto, nunca como HTML", () => {
    const { container } = render(
      <ActualizacionesPanel revision={{ ...HAY_NUEVA, pendientes: [release("4.20.0", { notas: "<img src=x onerror=alert(1)> **negrita**" })] }} pedidos={[]} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)> **negrita**")).toBeTruthy();
  });

  it("sin enlace válido no pinta «Ver en GitHub»", () => {
    render(<ActualizacionesPanel revision={{ ...HAY_NUEVA, pendientes: [release("4.20.0", { url: null })] }} pedidos={[]} />);
    expect(screen.queryByRole("link", { name: /GitHub/ })).toBeNull();
  });
});

type Analisis = NonNullable<Parameters<typeof ActualizacionesPanel>[0]["analisis"]>;

const ANALISIS: Analisis = {
  motor: "glm",
  modelo: "glm-4.6",
  recomendacion: "revisar",
  resumen: "RoomChannel cambia la firma de subscribed.",
  piezas: [
    { id: "revocar_sesiones", nombre: "Revocación de sesiones desde Studio (paso 2.7)", riesgo: "alto", motivo: "subscribed recibe un argumento.", archivos: ["app/channels/room_channel.rb"] },
    { id: "marca", nombre: "Marca de DTD", riesgo: "bajo", motivo: "Sin cambios.", archivos: [] },
  ],
  archivos: 6,
  recortado: false,
  creadoTexto: "30 oct 2026, 4:00 p. m.",
};

describe("ActualizacionesPanel · 3.4 «Analizar con IA»", () => {
  it("sin análisis: el botón manda el salto pendiente y avisa que no instala nada", async () => {
    render(<ActualizacionesPanel revision={HAY_NUEVA} pedidos={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Analizar con IA" }));
    await waitFor(() => expect(m.analizar).toHaveBeenCalledTimes(1));
    const fd = m.analizar.mock.calls[0][1] as FormData;
    expect([fd.get("from_version"), fd.get("to_version")]).toEqual(["4.19.1", "4.20.0"]);
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.stringMatching(/no se instaló nada/)));
  });

  it("el tope diario sale traducido en el banner", async () => {
    m.analizar.mockResolvedValueOnce({ ok: false, error: "tope" });
    render(<ActualizacionesPanel revision={HAY_NUEVA} pedidos={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Analizar con IA" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/análisis permitidos por hoy/);
  });

  it("con informe de IA: recomendación y riesgo por pieza con texto, archivos citados y sin botón", () => {
    render(<ActualizacionesPanel revision={HAY_NUEVA} pedidos={[]} analisis={ANALISIS} />);
    expect(screen.getByText("Revisar")).toBeTruthy();
    expect(screen.getByText(/Con IA \(glm-4\.6\)/)).toBeTruthy();
    expect(screen.getByText("Riesgo alto")).toBeTruthy();
    expect(screen.getByText("Riesgo bajo")).toBeTruthy();
    expect(screen.getByText("app/channels/room_channel.rb")).toBeTruthy();
    expect(screen.getByText(/Es un informe: no instala nada/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Analizar|Intentar/ })).toBeNull();
  });

  it("con informe sin IA: lo dice y deja intentar con IA otra vez", () => {
    render(<ActualizacionesPanel revision={HAY_NUEVA} pedidos={[]} analisis={{ ...ANALISIS, motor: "sin_ia", modelo: null, recomendacion: "seguro" }} />);
    expect(screen.getByText(/Sin IA ·/)).toBeTruthy();
    expect(screen.getByText("Seguro")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Intentar con IA otra vez" })).toBeTruthy();
  });

  it("no actualizar: badge con texto", () => {
    render(<ActualizacionesPanel revision={HAY_NUEVA} pedidos={[]} analisis={{ ...ANALISIS, recomendacion: "no_actualizar" }} />);
    expect(screen.getByText("No actualizar")).toBeTruthy();
  });

  it("el informe es texto, nunca HTML", () => {
    const { container } = render(
      <ActualizacionesPanel revision={HAY_NUEVA} pedidos={[]} analisis={{ ...ANALISIS, resumen: "<img src=x onerror=alert(1)> ojo" }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)> ojo")).toBeTruthy();
  });
});
