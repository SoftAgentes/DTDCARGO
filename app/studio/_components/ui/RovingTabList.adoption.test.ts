import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const STUDIO = resolve(process.cwd(), "app/studio");
const CANONICAL = "app/studio/_components/ui/RovingTabList";

function tsxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...tsxFiles(absolute));
    else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      files.push(absolute);
    }
  }
  return files;
}

function repoPath(absolute: string): string {
  return relative(process.cwd(), absolute).replaceAll("\\", "/");
}

describe("SDD-0324 · adopción de tabs con teclado", () => {
  const files = tsxFiles(STUDIO);

  it("todo tablist histórico usa la primitiva o demuestra roving explícito", () => {
    const direct: string[] = [];
    for (const absolute of files) {
      const source = readFileSync(absolute, "utf8");
      if (!source.includes('role="tablist"')) continue;
      const path = repoPath(absolute);
      if (path.endsWith("/_components/ui/RovingTabList.tsx")) continue;

      expect(source, `${path}: falta un único tab stop`).toContain(
        "tabIndex={active ? 0 : -1}",
      );
      expect(source, `${path}: faltan flechas`).toContain("ArrowRight");
      expect(source, `${path}: falta Home`).toContain("Home");
      expect(source, `${path}: falta End`).toContain("End");
      direct.push(path);
    }

    expect(direct).toEqual([]);
  });

  it("los 29 tablists migrados importan la primitiva canónica", () => {
    let usages = 0;
    for (const absolute of files) {
      const source = readFileSync(absolute, "utf8");
      const matches = source.match(/<RovingTabList\b/g) ?? [];
      if (matches.length === 0) continue;

      expect(source, `${repoPath(absolute)}: import no canónico`).toContain(
        CANONICAL,
      );
      usages += matches.length;
    }

    expect(usages).toBe(29);
  });

  it("cada primitiva tiene nombre accesible", () => {
    const unnamed: string[] = [];
    for (const absolute of files) {
      const source = readFileSync(absolute, "utf8");
      for (const match of source.matchAll(/<RovingTabList\b[^>]*>/g)) {
        if (!/aria-label=|aria-labelledby=/.test(match[0])) {
          unnamed.push(repoPath(absolute));
        }
      }
    }

    expect(unnamed).toEqual([]);
  });

  it("los selectores SSR por enlace conservan semántica de navegación", () => {
    const agents = readFileSync(
      resolve(STUDIO, "(app)/admin/agentes/page.tsx"),
      "utf8",
    );
    const board = readFileSync(
      resolve(STUDIO, "(app)/crm/_components/KommoBoardView.tsx"),
      "utf8",
    );

    for (const source of [agents, board]) {
      expect(source).not.toContain('role="tablist"');
      expect(source).not.toContain('role="tab"');
      expect(source).toContain("aria-current={isActive ? \"page\" : undefined}");
    }
  });
});
