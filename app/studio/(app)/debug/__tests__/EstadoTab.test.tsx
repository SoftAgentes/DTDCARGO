/**
 * SDD-0547 · pestaña Estado de la Torre de control sin Vercel.
 *
 * - La pestaña entera se pinta sin datos de publicaciones (sin archivo, con
 *   error de lectura o de formato): «Sin datos», nunca una excepción.
 * - Con datos, la card «Publicaciones del servidor» aparece con el estado.
 * - Nada de la pestaña nombra a Vercel (estaba en pausa desde el 2026-10-16) ni
 *   pide sus variables.
 * - «Esta instancia» en el servidor no dice «(local)» cuando falta un dato.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { EnvStatus, IntegrationKey } from "@/lib/studio/env-status";
import type { IntegrationHealth } from "@/lib/studio/integration-health";
import type { LecturaPublicaciones, MotivoSinDatos } from "@/lib/studio/publicaciones-types";

// El bot de deploy y el botón de re-chequeo traen server actions y el router:
// acá solo importa que la pestaña los coloque.
vi.mock("../../../_components/deploy/DeployWebBot", () => ({
  DeployButton: () => <button type="button">Push</button>,
}));
vi.mock("../_components/RecheckButton", () => ({
  RecheckButton: () => <button type="button">Re-checkear ahora</button>,
}));

import { EstadoTab } from "../_components/EstadoTab";

const B = "03e0e078ef18b0c2c1a217a07c8d4e0eeb14d1c7";
const AHORA = Date.parse("2026-10-17T17:45:00Z");
const KEYS: IntegrationKey[] = [
  "supabase",
  "resend",
  "resendWebhook",
  "telegram",
  "telegramWebhook",
  "anthropic",
  "openrouter",
  "hailuway",
  "searates",
];

function status(extra: Partial<EnvStatus> = {}): EnvStatus {
  return {
    env: "production",
    vercelUrl: "dtdcargo.com",
    branch: null,
    commitSha: B,
    commitShaShort: B.slice(0, 7),
    integrations: Object.fromEntries(KEYS.map((k) => [k, "active"])) as EnvStatus["integrations"],
    envVarsPresent: ["APP_ENV", "APP_URL", "NEXT_PUBLIC_BUILD_SHA"],
    ...extra,
  };
}

const HEALTH = Object.fromEntries(
  KEYS.map((k) => [k, { status: "skipped", latencyMs: null, error: null } satisfies IntegrationHealth]),
) as Record<IntegrationKey, IntegrationHealth>;

function renderTab(publicaciones: LecturaPublicaciones, s: EnvStatus = status()) {
  return render(
    <EstadoTab
      status={s}
      publicaciones={publicaciones}
      healthByKey={HEALTH}
      remoteHealth={{ ok: false, error: "skip_in_prod" }}
      siteUrl="https://dtdcargo.com"
    />,
  );
}

function card(titulo: string): HTMLElement {
  const h = screen.getByRole("heading", { name: titulo });
  const section = h.closest("section");
  if (!section) throw new Error(`sin <section> para ${titulo}`);
  return section;
}

describe("EstadoTab · publicaciones sin datos o con error", () => {
  it.each<MotivoSinDatos>(["sin-archivo", "ilegible", "demasiado-grande", "formato", "version"])(
    "%s: la pestaña se pinta y la card dice «Sin datos»",
    (motivo) => {
      renderTab({ ok: false, motivo, leidoEn: AHORA });
      const c = card("Publicaciones del servidor");
      expect(within(c).getByText("Sin datos")).toBeInTheDocument();
      // El resto de la pestaña sigue ahí.
      expect(card("Integraciones")).toBeInTheDocument();
      expect(card("Esta instancia")).toBeInTheDocument();
    },
  );
});

describe("EstadoTab · con datos", () => {
  it("la card muestra el estado del vigilante", () => {
    renderTab({
      ok: true,
      leidoEn: AHORA,
      estado: {
        actualizado: AHORA - 60_000,
        corre: B,
        anterior: null,
        publicable: B,
        vigilante: { estado: "al-dia", motivo: null, faltan: [] },
        congelado: null,
        historial: [],
        descartados: 0,
      },
    });
    const c = card("Publicaciones del servidor");
    expect(within(c).getByText("Al día")).toBeInTheDocument();
    expect(within(c).getAllByText("03e0e078").length).toBeGreaterThan(0);
  });
});

describe("EstadoTab · sin Vercel", () => {
  it("ningún texto ni enlace de la pestaña nombra a Vercel", () => {
    const { container } = renderTab(
      { ok: false, motivo: "sin-archivo", leidoEn: AHORA },
      // Local con integraciones en mock: muestra también la ayuda de mocks.
      status({ env: "local", vercelUrl: null, commitSha: null, commitShaShort: null, integrations: Object.fromEntries(KEYS.map((k) => [k, "mock"])) as EnvStatus["integrations"] }),
    );
    expect(screen.getByRole("heading", { name: "¿Por qué hay integraciones en mock?" })).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(/vercel/i);
    for (const a of container.querySelectorAll("a")) {
      expect(a.getAttribute("href") ?? "").not.toMatch(/vercel/i);
    }
    expect(screen.queryByRole("heading", { name: "Deploys recientes" })).not.toBeInTheDocument();
  });

  it("la lista de variables ya no incluye ninguna de Vercel", async () => {
    const { TRACKED_ENV_VARS_LIST } = await import("@/lib/studio/env-status");
    expect(TRACKED_ENV_VARS_LIST.filter((v) => v.startsWith("VERCEL_"))).toEqual([]);
    // Control: la lista sigue mostrando las del runtime propio.
    expect(TRACKED_ENV_VARS_LIST).toEqual(expect.arrayContaining(["APP_ENV", "APP_URL", "NEXT_PUBLIC_BUILD_SHA"]));
  });
});

describe("EstadoTab · Esta instancia", () => {
  it("en el servidor sin datos no dice «(local)»", () => {
    renderTab(
      { ok: false, motivo: "sin-archivo", leidoEn: AHORA },
      status({ vercelUrl: null, commitSha: null, commitShaShort: null }),
    );
    const c = card("Esta instancia");
    expect(c.textContent).not.toMatch(/\(local\)/);
    expect(within(c).getByText(/falta APP_URL en el servidor/)).toBeInTheDocument();
    expect(within(c).getByText(/la imagen no trae NEXT_PUBLIC_BUILD_SHA/)).toBeInTheDocument();
    // Sin rama conocida en el servidor, la fila no aparece.
    expect(within(c).queryByText("Rama")).not.toBeInTheDocument();
    // El bot de deploy solo existe en local.
    expect(within(c).queryByRole("button", { name: "Push" })).not.toBeInTheDocument();
  });

  it("en local conserva el bot de deploy y las marcas «(local)»", () => {
    renderTab(
      { ok: false, motivo: "sin-archivo", leidoEn: AHORA },
      status({ env: "local", vercelUrl: null, commitSha: null, commitShaShort: null }),
    );
    const c = card("Esta instancia");
    expect(within(c).getByRole("button", { name: "Push" })).toBeInTheDocument();
    expect(within(c).getByText("Rama")).toBeInTheDocument();
    expect(within(c).getAllByText(/\(local\)/).length).toBeGreaterThan(0);
  });

  it("con datos muestra la URL y el commit completos", () => {
    renderTab({ ok: false, motivo: "sin-archivo", leidoEn: AHORA });
    const c = card("Esta instancia");
    expect(within(c).getByText("https://dtdcargo.com")).toBeInTheDocument();
    expect(within(c).getByText(new RegExp(B))).toBeInTheDocument();
  });
});
