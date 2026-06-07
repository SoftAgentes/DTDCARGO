import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  isValidSlug,
  worktreePathFor,
  branchFor,
  parseArgs,
} from "../harness-worktree.mjs";

describe("harness-worktree · helpers puros", () => {
  describe("isValidSlug", () => {
    it("acepta kebab-case", () => {
      expect(isValidSlug("seo")).toBe(true);
      expect(isValidSlug("sdd-0061-fase-b")).toBe(true);
      expect(isValidSlug("a1")).toBe(true);
      expect(isValidSlug("crm-kommo")).toBe(true);
    });

    it("rechaza inválidos", () => {
      expect(isValidSlug("")).toBe(false);
      expect(isValidSlug("SEO")).toBe(false); // mayúsculas
      expect(isValidSlug("con espacio")).toBe(false);
      expect(isValidSlug("-leading")).toBe(false);
      expect(isValidSlug("trailing-")).toBe(false);
      expect(isValidSlug("doble--guion")).toBe(false);
      expect(isValidSlug("under_score")).toBe(false);
      expect(isValidSlug("a".repeat(61))).toBe(false); // muy largo
      expect(isValidSlug(123)).toBe(false); // no string
      expect(isValidSlug(undefined)).toBe(false);
    });

    it("rechaza path-traversal (contrato de seguridad: `wt` se ancla al slug literal)", () => {
      expect(isValidSlug("..")).toBe(false);
      expect(isValidSlug("../x")).toBe(false);
      expect(isValidSlug("a/b")).toBe(false);
      expect(isValidSlug("a\\b")).toBe(false);
      expect(isValidSlug(".")).toBe(false);
      expect(isValidSlug("x/../y")).toBe(false);
    });
  });

  it("branchFor → feat/<slug>", () => {
    expect(branchFor("seo")).toBe("feat/seo");
    expect(branchFor("sdd-0061-fase-b")).toBe("feat/sdd-0061-fase-b");
  });

  it("worktreePathFor → <parent>/DTD-worktrees/<slug>, hermano del repo principal", () => {
    const main = path.join("C:", "Users", "x", "Desktop", "DTDCargo");
    const got = worktreePathFor(main, "calc");
    const want = path.join("C:", "Users", "x", "Desktop", "DTD-worktrees", "calc");
    expect(got).toBe(want);
  });

  describe("parseArgs", () => {
    it("start con slug, defaults sanos", () => {
      const a = parseArgs(["start", "mi-lane"]);
      expect(a.cmd).toBe("start");
      expect(a.slug).toBe("mi-lane");
      expect(a.from).toBe("main"); // off main por default
      expect(a.dryRun).toBe(false);
      expect(a.deleteBranch).toBe(false);
    });

    it("flags en cualquier orden, sin pisar el slug", () => {
      const a = parseArgs(["finish", "--dry-run", "x", "--delete-branch"]);
      expect(a.cmd).toBe("finish");
      expect(a.slug).toBe("x");
      expect(a.dryRun).toBe(true);
      expect(a.deleteBranch).toBe(true);
    });

    it("--from <ref> toma el siguiente token", () => {
      const a = parseArgs(["start", "x", "--from", "origin/main"]);
      expect(a.from).toBe("origin/main");
      expect(a.slug).toBe("x");
    });

    it("sin args → cmd undefined (cae a usage)", () => {
      const a = parseArgs([]);
      expect(a.cmd).toBeUndefined();
      expect(a.slug).toBeUndefined();
    });
  });
});
