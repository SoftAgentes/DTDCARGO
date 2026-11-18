/**
 * SDD-0655 · La Bandeja es una pestaña del CRM: permisos de cada pestaña, a
 * dónde lleva el ítem «CRM» del menú, cuándo queda activo y que los enlaces que
 * ya existen (fichas, avisos push, guía) siguen cayendo en la pestaña Bandeja
 * sin redirección.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FEATURE_FLAG_DEFAULTS, type FeatureFlags } from "../feature-flags-types";
import { MODULES } from "../modules";
import { accesoCrm, destinoCrm, esRutaCrm, RUTA_AGENTES_VINCULADOS, RUTA_BANDEJA, RUTA_CRM } from "../crm-acceso";
import { pestanasCrm } from "@/app/studio/(app)/crm/_components/kommo-tabs.shared";
import type { RoleModuleOverrides, UserModuleGrants } from "../rbac";

const ENCENDIDA: FeatureFlags = { ...FEATURE_FLAG_DEFAULTS, chatwoot_inbox: true };
const APAGADA: FeatureFlags = { ...FEATURE_FLAG_DEFAULTS, chatwoot_inbox: false };

describe("accesoCrm: cada pestaña con su permiso (SDD-0655)", () => {
  it.each([
    ["admin", { embudos: true, bandeja: true }],
    ["commercial", { embudos: true, bandeja: true }],
    // support ve la Bandeja y no CRM (rbac.ts: kommo solo commercial).
    ["support", { embudos: false, bandeja: true }],
    ["accounting", { embudos: false, bandeja: false }],
    ["operations", { embudos: false, bandeja: false }],
  ] as const)("%s con la Bandeja encendida → %j", (rol, esperado) => {
    expect(accesoCrm(rol, ENCENDIDA)).toEqual(esperado);
  });

  it("con el flag `chatwoot_inbox` apagado nadie ve la pestaña Bandeja, ni el admin", () => {
    for (const rol of ["admin", "commercial", "support"] as const) {
      expect(accesoCrm(rol, APAGADA).bandeja, rol).toBe(false);
    }
    expect(accesoCrm("commercial", APAGADA).embudos).toBe(true);
  });

  it("sin rol, nada (fail-closed)", () => {
    expect(accesoCrm(null, ENCENDIDA)).toEqual({ embudos: false, bandeja: false });
    expect(accesoCrm(undefined, ENCENDIDA)).toEqual({ embudos: false, bandeja: false });
  });

  it("respeta los desvíos de la matriz por rol (SDD-0252)", () => {
    const quitada: RoleModuleOverrides = { "commercial:bandeja": { view: false, edit: false } };
    expect(accesoCrm("commercial", ENCENDIDA, quitada)).toEqual({ embudos: true, bandeja: false });
  });

  it("respeta los accesos extra de la persona (SDD-0622)", () => {
    const extra: UserModuleGrants = { bandeja: { view: true, edit: false, expiresAt: null } };
    expect(accesoCrm("accounting", ENCENDIDA, undefined, extra).bandeja).toBe(true);
  });
});

describe("pestanasCrm: la barra", () => {
  it("quien ve las dos: Embudos y después Bandeja", () => {
    expect(pestanasCrm({ embudos: true, bandeja: true })).toEqual([
      { key: "embudos", label: "Embudos", href: RUTA_CRM },
      { key: "bandeja", label: "Bandeja", href: RUTA_BANDEJA },
    ]);
  });

  it("quien ve CRM y no la Bandeja no ve la pestaña", () => {
    expect(pestanasCrm({ embudos: true, bandeja: false }).map((p) => p.key)).toEqual(["embudos"]);
  });

  it("quien solo ve la Bandeja no ve Embudos", () => {
    expect(pestanasCrm({ embudos: false, bandeja: true }).map((p) => p.key)).toEqual(["bandeja"]);
  });
});

describe("el ítem «CRM» del menú", () => {
  it("lleva a Embudos; si solo se ve la Bandeja, a la Bandeja; si nada, no hay ítem", () => {
    expect(destinoCrm({ embudos: true, bandeja: true })).toBe(RUTA_CRM);
    expect(destinoCrm({ embudos: true, bandeja: false })).toBe(RUTA_CRM);
    expect(destinoCrm({ embudos: false, bandeja: true })).toBe(RUTA_BANDEJA);
    expect(destinoCrm({ embudos: false, bandeja: false })).toBeNull();
  });

  it.each([
    "/studio/crm",
    "/studio/crm?tab=embudos",
    "/studio/bandeja",
    "/studio/bandeja?c=12",
    "/studio/bandeja/conversacion/12",
  ])("queda activo en %s", (ruta) => {
    expect(esRutaCrm(ruta)).toBe(true);
  });

  it.each(["/studio/bandejas", "/studio/crmx", "/studio/conversaciones", "/studio/clientes", "/studio/usuarios"])(
    "no queda activo en %s",
    (ruta) => {
      expect(esRutaCrm(ruta)).toBe(false);
    },
  );

  it("la Bandeja salió del menú pero sigue siendo módulo (RBAC, flag, guard y mapa de accesos); CRM sigue siendo `kommo`", () => {
    const bandeja = MODULES.find((m) => m.id === "bandeja");
    expect(bandeja).toMatchObject({ slug: RUTA_BANDEJA, dentroDe: "kommo", group: "COMERCIAL" });
    // `hidden` la sacaría también del mapa de accesos de Usuarios (MapaAcceso): no se usa.
    expect(bandeja?.hidden).toBeFalsy();
    expect(MODULES.find((m) => m.id === "kommo")).toMatchObject({ slug: RUTA_CRM, label: "CRM" });
    expect(MODULES.find((m) => m.id === "kommo")?.hidden).toBeFalsy();
  });
});

describe("los enlaces que ya existen siguen abriendo la pestaña Bandeja (sin redirección)", () => {
  const leer = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  // Productores de enlaces a la Bandeja, buscados por valor (`/studio/bandeja`).
  const PRODUCTORES = [
    "app/studio/(app)/clientes/_components/ChatwootConversacionesCard.tsx",
    "app/studio/(app)/conversaciones/_components/ConversationThread.tsx",
    "lib/studio/chatwoot/webhook-procesar.ts",
    "lib/studio/chatwoot/portal.ts",
    "lib/studio/chatwoot/agentes-ciclo.ts",
    "lib/studio/guia/recorridos.ts",
    // SDD-0650 (ficha del cliente en tres columnas): «Abrir en la Bandeja».
    "lib/studio/ficha-cliente.ts",
  ];

  it.each(PRODUCTORES)("%s apunta a /studio/bandeja, que es la pestaña Bandeja del CRM", (archivo) => {
    const enlaces = leer(archivo).match(/["`]\/studio\/bandeja[^"`]*["`]/g) ?? [];
    expect(enlaces.length, archivo).toBeGreaterThan(0);
    for (const e of enlaces) {
      const url = e.slice(1, -1).replace(/\$\{[^}]+\}/g, "1");
      expect(esRutaCrm(url), url).toBe(true);
      expect(new URL(url, "https://studio.test").pathname).toBe(RUTA_BANDEJA);
    }
  });

  it("los vínculos viven en Usuarios, en su pestaña Bandeja", () => {
    expect(RUTA_AGENTES_VINCULADOS).toBe("/studio/usuarios?tab=bandeja");
  });
});
