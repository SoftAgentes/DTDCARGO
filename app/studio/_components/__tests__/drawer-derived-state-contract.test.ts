import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("estado derivado en drawers", () => {
  it("absorbe una respuesta de conversación una sola vez", () => {
    const code = source("app/studio/(app)/conversaciones/_components/ConversationThread.tsx");
    expect(code).toContain("handledReplyState !== replyState");
    expect(code).not.toContain("eslint-disable");
  });

  it("sugiere almacén al seleccionar proveedor", () => {
    const code = source("app/studio/(app)/etiquetas/_components/LabelGeneratorClient.tsx");
    expect(code).toContain("warehouseCode");
    expect(code).not.toContain("Auto-sugerir warehouse según ciudad");
  });

  it("deriva origin y absorbe el estado del share link", () => {
    const code = source("app/studio/(app)/proveedores/_components/ProviderLinkDrawer.tsx");
    expect(code).toContain("useSyncExternalStore");
    expect(code).toContain("handledState !== state");
  });

  it("encadena sugerencias puerto y agente durante render", () => {
    const code = source("app/studio/(app)/seniat/_components/CreateFilingDrawer.tsx");
    expect(code).toContain("detectPortFromDestination");
    expect(code).toContain("agent.port_code === portCode");
  });
});
