import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "app/api/studio/bugs/[id]/take/route.ts",
  "app/api/studio/bugs/[id]/state/route.ts",
  "app/api/studio/bugs/[id]/replay/route.ts",
  "app/api/studio/bugs/[id]/messages/route.ts",
];

const actionFile = "app/studio/(app)/bugs/actions.ts";
const scopedFiles = [...routeFiles, actionFile];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad del flujo de bugs", () => {
  it.each(scopedFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each(routeFiles)("crea el logger desde la petición en %s", (path) => {
    expect(source(path)).toContain("createRequestLogger(");
  });

  it.each(routeFiles)("correlaciona todas las respuestas en %s", (path) => {
    const content = source(path);
    expect(content).toContain("logger.withResponse");
    expect(content).not.toMatch(/return\s+NextResponse\.json\s*\(/);
  });

  it("usa logger canónico en las Server Actions", () => {
    const content = source(actionFile);
    expect(content).toContain("createComponentLogger");
    expect(content).toContain("type StructuredLogger");
  });

  it("no expone mensajes crudos de proveedores en las respuestas", () => {
    expect(source(routeFiles[2])).not.toContain(
      "No se pudo subir el replay: ${uploadErr.message}",
    );
    expect(source(routeFiles[3])).not.toContain("detail: msgErr.message");
  });

  it("propaga el logger a las notificaciones del flujo", () => {
    expect(source(routeFiles[1])).toMatch(
      /notifyBugStateChangeToReporter\([\s\S]{0,520}?logger,?\s*\)/,
    );
    expect(source(routeFiles[3])).toMatch(
      /notifyBugMessageToReporter\([\s\S]{0,620}?logger,?\s*\)/,
    );
    expect(source(actionFile)).toMatch(
      /notifyBugStateChangeToReporter\([\s\S]{0,520}?logger,?\s*\)/,
    );
    expect(source(actionFile)).toMatch(
      /notifyBugMessageToReporter\([\s\S]{0,620}?logger,?\s*\)/,
    );
  });
});
