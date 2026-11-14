/**
 * SDD-0586 (10.5, 1c-1) · la pantalla de un hilo del portal con la traba puesta.
 *
 * Con la traba «activa» (o «no_se_sabe», fail-closed), un hilo del portal no muestra la caja de
 * respuesta ni las respuestas rápidas: muestra el aviso interno y, si ya hay conversación en
 * Chatwoot, «Responder en la Bandeja →». El selector de estado queda deshabilitado y explicado en
 * `aria-describedby`; asignar y «Caso» siguen como hoy. Con la traba apagada, o en otro canal,
 * todo igual que antes. Las acciones se reemplazan por dobles que registran sus llamadas.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationRow } from "@/lib/studio/conversaciones/conversations-types";

const a = vi.hoisted(() => ({
  status: [] as FormData[],
  assign: [] as FormData[],
  caso: [] as FormData[],
}));
// La page de punta a punta (page → ConversacionesClient → hilo): bordes del servidor reemplazados.
const p = vi.hoisted(() => ({
  tenant: "10000000-0000-4000-8000-000000000001",
  conversaciones: [] as unknown[],
  traba: "apagada" as "activa" | "apagada" | "no_se_sabe",
  consultas: [] as (string | null)[],
  denialBandeja: null as string | null,
  chatwootInbox: true,
  modulos: [] as string[],
}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    from: () => {
      const q = { select: () => q, maybeSingle: async () => ({ data: { tenant_id: p.tenant }, error: null }) };
      return q;
    },
  }),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  requireModuleView: async () => "commercial",
  moduleViewDenial: async (_: unknown, modulo: string) => {
    p.modulos.push(modulo);
    return modulo === "bandeja" ? p.denialBandeja : null;
  },
}));
vi.mock("@/lib/studio/feature-flags-queries", () => ({
  listFeatureFlags: async () => ({ chatwoot_inbox: p.chatwootInbox }),
}));
vi.mock("@/lib/studio/conversaciones/conversations-queries", () => ({
  listConversations: async () => p.conversaciones,
  computeConversationKpis: async () => ({ open: 1, unread: 0, unassigned: 1, openCases: 0, resolvedToday: 0 }),
  listAssignableAgents: async () => [],
}));
vi.mock("@/lib/studio/chatwoot/portal-solo-lectura", () => ({
  trabaPortal: async (_: unknown, tenantId: string | null) => {
    p.consultas.push(tenantId);
    return p.traba;
  },
}));
vi.mock("@/lib/studio/hooks/use-realtime-refresh", () => ({ useRealtimeRefresh: () => ({ status: "idle" }) }));

vi.mock("../actions", () => ({
  generateDigestsAction: async () => ({}),
  sendReplyAction: async () => ({}),
  setStatusAction: async (_: unknown, fd: FormData) => {
    a.status.push(fd);
    return {};
  },
  assignAction: async (_: unknown, fd: FormData) => {
    a.assign.push(fd);
    return {};
  },
  markCaseAction: async (_: unknown, fd: FormData) => {
    a.caso.push(fd);
    return {};
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

import { ConversationThread } from "../_components/ConversationThread";
import ConversacionesPage from "../page";

const AVISO = "Este hilo del portal se responde desde la Bandeja de Chatwoot. El estado también se cambia allá.";

function hilo(channel: ConversationRow["channel"]): ConversationRow {
  return {
    id: "conv-1",
    tenant_id: "10000000-0000-4000-8000-000000000001",
    client_id: "cli-1",
    ref: null,
    channel,
    status: "abierto",
    is_case: false,
    assigned_to: null,
    subject: null,
    last_message_at: null,
    unread_count: 0,
    external_ref: null,
    created_at: "2026-11-08T00:00:00Z",
    updated_at: "2026-11-08T00:00:00Z",
    deleted_at: null,
    markbox: "DTD-0001",
    client_name: "Cliente sintético",
    email: null,
    phone: null,
    agent: null,
    last_message_preview: null,
    last_message_direction: null,
  };
}

let bandeja: number | null = 9001;
beforeEach(() => {
  bandeja = 9001;
  p.conversaciones = [];
  p.traba = "apagada";
  p.consultas.length = 0;
  p.denialBandeja = null;
  p.chatwootInbox = true;
  p.modulos.length = 0;
  a.status.length = 0;
  a.assign.length = 0;
  a.caso.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ messages: [], context: null, digests: [], bandeja }) })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const cargado = () => screen.findByText("Sin mensajes todavía.");
const estado = () => screen.getByRole("combobox", { name: "Estado de la conversación" }) as HTMLSelectElement;
const asignar = () => screen.getByRole("combobox", { name: "Asignar agente" }) as HTMLSelectElement;

describe("ConversationThread · SDD-0586 1c-1", () => {
  it("portal con la traba activa: aviso y enlace a la Bandeja en lugar de la caja", async () => {
    render(<ConversationThread conv={hilo("portal")} agents={[]} trabaPortal="activa" puedeVerBandeja />);
    await cargado();

    const aviso = screen.getByText(AVISO);
    // SDD-0603 tramo 5d: el aviso es la franja `Aviso` (status), no una caja `note`.
    const franja = aviso.closest(".studio-aviso")!;
    expect(franja.getAttribute("role")).toBe("status");
    expect(franja.getAttribute("data-tono")).toBe("info");
    // El enlace queda fuera de la región viva.
    expect(franja.querySelector("a")).toBeNull();
    const enlace = await screen.findByRole("link", { name: "Responder en la Bandeja →" });
    expect(enlace.getAttribute("href")).toBe("/studio/bandeja?c=9001");

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Enviar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Respuestas rápidas" })).toBeNull();
  });

  it("el selector de estado queda deshabilitado y explicado; no cambia el estado", async () => {
    render(<ConversationThread conv={hilo("portal")} agents={[]} trabaPortal="activa" puedeVerBandeja />);
    await cargado();

    const sel = estado();
    expect(sel.disabled).toBe(true);
    const idAviso = sel.getAttribute("aria-describedby");
    expect(idAviso).toBeTruthy();
    expect(document.getElementById(idAviso!)?.textContent).toBe(AVISO);

    await act(async () => {
      fireEvent.change(sel, { target: { value: "resuelto" } });
    });
    expect(a.status).toEqual([]);
  });

  it("asignar y «Caso» siguen como hoy", async () => {
    render(<ConversationThread conv={hilo("portal")} agents={[{ id: "ag-1", name: "Agente" }]} trabaPortal="activa" puedeVerBandeja />);
    await cargado();

    expect(asignar().disabled).toBe(false);
    const caso = screen.getByRole("button", { name: "Marcar como caso" }) as HTMLButtonElement;
    expect(caso.disabled).toBe(false);
    await act(async () => {
      fireEvent.change(asignar(), { target: { value: "ag-1" } });
      fireEvent.click(caso);
    });
    await waitFor(() => expect(a.assign).toHaveLength(1));
    await waitFor(() => expect(a.caso).toHaveLength(1));
  });

  it("SDD-0586 1c-1b · sin acceso a la Bandeja: el aviso va sin enlace, aunque haya número", async () => {
    render(<ConversationThread conv={hilo("portal")} agents={[]} trabaPortal="activa" />);
    await cargado();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => {});

    expect(screen.getByText(AVISO)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Responder en la Bandeja →" })).toBeNull();
  });

  it("sin conversación en Chatwoot todavía: el aviso va sin enlace", async () => {
    bandeja = null;
    render(<ConversationThread conv={hilo("portal")} agents={[]} trabaPortal="activa" puedeVerBandeja />);
    await cargado();

    expect(screen.getByText(AVISO)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Responder en la Bandeja →" })).toBeNull();
  });

  it("si no se pudo comprobar la traba: también sin caja, con su aviso", async () => {
    render(<ConversationThread conv={hilo("portal")} agents={[]} trabaPortal="no_se_sabe" puedeVerBandeja />);
    await cargado();

    const duda = screen.getByText(/No se pudo comprobar si este hilo del portal/).closest(".studio-aviso")!;
    expect(duda.getAttribute("role")).toBe("status");
    expect(duda.getAttribute("data-tono")).toBe("atencion");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(estado().disabled).toBe(true);
  });

  it("portal con la traba apagada: la caja y el estado como antes", async () => {
    render(<ConversationThread conv={hilo("portal")} agents={[]} trabaPortal="apagada" />);
    await cargado();

    expect(document.querySelector(".studio-aviso")).toBeNull();
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Respuestas rápidas" })).toBeTruthy();
    const sel = estado();
    expect(sel.disabled).toBe(false);
    expect(sel.getAttribute("aria-describedby")).toBeNull();
    await act(async () => {
      fireEvent.change(sel, { target: { value: "resuelto" } });
    });
    await waitFor(() => expect(a.status).toHaveLength(1));
    expect(a.status[0].get("status")).toBe("resuelto");
  });

  it("sin la prop, la traba se toma por apagada", async () => {
    render(<ConversationThread conv={hilo("portal")} agents={[]} />);
    await cargado();

    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(document.querySelector(".studio-aviso")).toBeNull();
  });

  it("otro canal con la traba activa: como antes", async () => {
    for (const canal of ["email", "whatsapp"] as const) {
      render(<ConversationThread conv={hilo(canal)} agents={[]} trabaPortal="activa" puedeVerBandeja />);
      await cargado();
      expect(document.querySelector(".studio-aviso"), canal).toBeNull();
      expect(screen.getByRole("textbox"), canal).toBeTruthy();
      expect(estado().disabled, canal).toBe(false);
      cleanup();
    }
  });
});

describe("ConversacionesPage · la traba llega al hilo", () => {
  const caja = () => screen.queryByPlaceholderText(/^Responder por/);

  it("la page calcula la traba del tenant y el hilo del portal la muestra", async () => {
    p.conversaciones = [hilo("portal")];
    p.traba = "activa";
    render(await ConversacionesPage({ searchParams: Promise.resolve({ c: "conv-1" }) }));
    await cargado();

    expect(p.consultas).toEqual([p.tenant]);
    expect(screen.getByText(AVISO)).toBeTruthy();
    expect(caja()).toBeNull();
    expect(estado().disabled).toBe(true);
  });

  it("SDD-0586 1c-1b · con el rol y `chatwoot_inbox`, el aviso trae el enlace a la Bandeja", async () => {
    p.conversaciones = [hilo("portal")];
    p.traba = "activa";
    render(await ConversacionesPage({ searchParams: Promise.resolve({ c: "conv-1" }) }));
    await cargado();

    expect(p.modulos).toContain("bandeja");
    const enlace = await screen.findByRole("link", { name: "Responder en la Bandeja →" });
    expect(enlace.getAttribute("href")).toBe("/studio/bandeja?c=9001");
  });

  it("SDD-0586 1c-1b · sin el rol de la Bandeja, o con `chatwoot_inbox` apagado, el aviso va sin enlace", async () => {
    for (const [denial, inbox] of [["No tienes permiso para ver esto.", true], [null, false]] as const) {
      p.conversaciones = [hilo("portal")];
      p.traba = "activa";
      p.denialBandeja = denial;
      p.chatwootInbox = inbox;
      render(await ConversacionesPage({ searchParams: Promise.resolve({ c: "conv-1" }) }));
      await cargado();
      await act(async () => {});

      expect(screen.getByText(AVISO), String(denial ?? inbox)).toBeTruthy();
      expect(screen.queryByRole("link", { name: "Responder en la Bandeja →" }), String(denial ?? inbox)).toBeNull();
      cleanup();
    }
  });

  it("con la traba apagada, la caja y el estado como antes", async () => {
    p.conversaciones = [hilo("portal")];
    p.traba = "apagada";
    render(await ConversacionesPage({ searchParams: Promise.resolve({ c: "conv-1" }) }));
    await cargado();

    expect(document.querySelector(".studio-aviso")).toBeNull();
    expect(caja()).toBeTruthy();
    expect(estado().disabled).toBe(false);
  });
});
