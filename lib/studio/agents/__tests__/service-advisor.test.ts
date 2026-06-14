import { describe, it, expect } from "vitest";
import { serviceAdvisor } from "../skills/service-advisor";
import { getSkillDefBySlug, SKILLS_BY_SLUG } from "../skills/tracking-concierge";
import { resolveTools, getTool } from "../runtime/registry";
import { SERVICE_TOOLS } from "../tools/service-tools";

describe("service-advisor skill (SDD-0076 Fase 4)", () => {
  it("está registrada en SKILLS_BY_SLUG", () => {
    expect(getSkillDefBySlug("service-advisor")).toBe(serviceAdvisor);
    expect(SKILLS_BY_SLUG["service-advisor"]).toBeDefined();
  });

  it("no rompe el registro existente (tracking-concierge sigue)", () => {
    expect(getSkillDefBySlug("tracking-concierge")).toBeDefined();
  });

  it("todas sus tools_required están en el registry del runtime", () => {
    const resolved = resolveTools(serviceAdvisor.tools_required);
    expect(resolved.length).toBe(serviceAdvisor.tools_required.length);
    for (const k of serviceAdvisor.tools_required) {
      expect(getTool(k)).toBeDefined();
    }
  });

  it("output_schema exige message + citations", () => {
    const req = (serviceAdvisor.output_schema as { required?: string[] }).required;
    expect(req).toContain("message");
    expect(req).toContain("citations");
  });

  it("tiene los campos clave de SkillDef", () => {
    expect(serviceAdvisor.slug).toBe("service-advisor");
    expect(serviceAdvisor.default_model).toBeTruthy();
    expect(serviceAdvisor.system_prompt.length).toBeGreaterThan(100);
  });
});

describe("service-tools (SDD-0076 Fase 4)", () => {
  it("expone 3 tools read-only con las keys esperadas", () => {
    const keys = SERVICE_TOOLS.map((t) => t.key);
    expect(keys).toEqual(["list_services", "get_service", "list_service_faqs"]);
    expect(new Set(keys).size).toBe(3);
  });

  it("cada tool requerida por la skill existe en SERVICE_TOOLS", () => {
    const toolKeys = new Set(SERVICE_TOOLS.map((t) => t.key));
    for (const k of serviceAdvisor.tools_required) {
      expect(toolKeys.has(k)).toBe(true);
    }
  });

  it("cada tool tiene input_schema y handler", () => {
    for (const t of SERVICE_TOOLS) {
      expect(t.input_schema).toBeDefined();
      expect(typeof t.handler).toBe("function");
    }
  });
});
