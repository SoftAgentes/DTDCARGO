import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { armarColumnas, type CrmEtapa, type CrmTarjetaTablero } from "@/lib/studio/crm-tablero";
import { ChatPermitido } from "./ChatPermitido";
import { CLAVE_VISTA, CrmVistaEmbudo } from "./CrmVistaEmbudo";

const ETAPAS: CrmEtapa[] = [
  { tablero: "leads", clave: "nuevo", nombre: "Nuevo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "contactado", nombre: "Contactado", orden: 20, terminal: false, sistema: true, activa: true },
];

const base: CrmTarjetaTablero = {
  id: "t-1",
  nombre: "Lead uno",
  shippingMark: null,
  segmento: "lead_nuevo",
  tablero: "leads",
  etapa: "nuevo",
  origen: null,
  diasEnEtapa: 2,
  asesorNombre: null,
  tareasAbiertas: 0,
  tareasVencidas: 0,
  fuente: "whatsapp_leads",
  utmSource: null,
};

const TARJETAS: CrmTarjetaTablero[] = [
  base,
  { ...base, id: "t-2", nombre: "Lead dos", etapa: "contactado" },
  { ...base, id: "t-3", nombre: "Lead tres", diasEnEtapa: 9 },
];

function pintar({ chat = false }: { chat?: boolean } = {}) {
  render(
    <ChatPermitido valor={chat}>
      <CrmVistaEmbudo
        tablero="leads"
        columnas={armarColumnas(ETAPAS, TARJETAS, "leads")}
        etapas={ETAPAS}
        canEdit
        moviendo={new Set()}
        onMove={vi.fn()}
        onOpen={vi.fn()}
      />
    </ChatPermitido>,
  );
}

const idsEnPantalla = () =>
  [...document.querySelectorAll("[data-tarjeta-id]")].map((e) => e.getAttribute("data-tarjeta-id")).sort();

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/studio/crm?tab=embudos");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CrmVistaEmbudo · Tablero | Lista (SDD-0648 §3, D6)", () => {
  it("abre en Tablero y cambia a Lista con el selector", async () => {
    const user = userEvent.setup();
    pintar();
    const grupo = screen.getByRole("radiogroup", { name: "Vista del embudo" });
    expect(within(grupo).getByRole("radio", { name: "Tablero" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByRole("region").length).toBe(2);

    await user.click(within(grupo).getByRole("radio", { name: "Lista" }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryAllByRole("region")).toHaveLength(0);
  });

  it("criterio 6: la Lista muestra el mismo conjunto de tarjetas que el tablero", async () => {
    const user = userEvent.setup();
    pintar();
    const enTablero = idsEnPantalla();
    await user.click(screen.getByRole("radio", { name: "Lista" }));
    expect(idsEnPantalla()).toEqual(enTablero);
    expect(enTablero).toEqual(["t-1", "t-2", "t-3"]);
  });

  it("recuerda la vista elegida en este navegador", async () => {
    const user = userEvent.setup();
    pintar();
    await user.click(screen.getByRole("radio", { name: "Lista" }));
    expect(window.localStorage.getItem(CLAVE_VISTA)).toBe("lista");
    cleanup();
    pintar();
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("si el almacenamiento falla, abre en Tablero y el selector sigue funcionando", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const user = userEvent.setup();
    pintar();
    expect(screen.getAllByRole("region").length).toBe(2);
    await user.click(screen.getByRole("radio", { name: "Lista" }));
    expect(screen.getByRole("table")).toBeTruthy();
  });
});

describe("CrmVistaEmbudo · chat (SDD-0648 §4)", () => {
  it.each([
    ["sin", "Esa tarjeta todavía no tiene conversación en Chatwoot."],
    ["error", "No se pudo abrir el chat: Chatwoot no respondió. Vuelve a intentarlo desde la tarjeta."],
    ["sin_bandeja", "Tu usuario no tiene la Bandeja de Chatwoot. Pídesela a un administrador para chatear desde el CRM."],
  ])("con ?chat=%s avisa lo que pasó", (valor, texto) => {
    window.history.replaceState(null, "", `/studio/crm?tab=embudos&chat=${valor}`);
    pintar();
    expect(screen.getByText(texto)).toBeTruthy();
  });

  it("sin ?chat, o con un valor desconocido, no avisa nada", () => {
    window.history.replaceState(null, "", "/studio/crm?tab=embudos&chat=otro");
    pintar();
    expect(document.querySelector(".studio-aviso")).toBeNull();
  });
});
