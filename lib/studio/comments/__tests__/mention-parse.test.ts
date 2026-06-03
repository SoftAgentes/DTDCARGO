/**
 * Tests del parser de @menciones (SDD-0045) — la capa pura del módulo.
 *
 * Cubre criterios de aceptación §6 (Lib):
 *  - parseMentions resuelve "@Martina A." → user id correcto
 *  - ignora @desconocidos
 *  - dedup
 *  - renderMentionHtml resalta + escapa (no XSS)
 *  - validateCommentInput (manual, sin zod)
 */

import { describe, it, expect } from "vitest";
import { parseMentions, renderMentionHtml } from "../mention-parse";
import { validateCommentInput, COMMENT_MAX_LENGTH } from "../types";
import type { CommentTenantUser } from "../types";

const USERS: CommentTenantUser[] = [
  { id: "u-002", name: "Martina Acosta", avatar: "MA", role: "Comercial" },
  { id: "u-005", name: "Yusneidy Ramírez", avatar: "YR", role: "Operaciones" },
  { id: "u-003", name: "Diego Núñez", avatar: "DN", role: "Almacenista" },
  { id: "u-001", name: "Carlos Vargas", avatar: "CV", role: "Admin" },
];

describe("parseMentions", () => {
  it("resuelve '@Martina A.' al user correcto (formato del composer)", () => {
    const ids = parseMentions("@Martina A. ok recibido", USERS);
    expect(ids).toEqual(["u-002"]);
  });

  it("resuelve solo primer nombre '@Diego'", () => {
    const ids = parseMentions("avisá a @Diego que coordine", USERS);
    expect(ids).toEqual(["u-003"]);
  });

  it("resuelve nombre completo '@Yusneidy Ramírez'", () => {
    const ids = parseMentions("gracias @Yusneidy Ramírez", USERS);
    expect(ids).toEqual(["u-005"]);
  });

  it("es insensible a acentos y mayúsculas", () => {
    const ids = parseMentions("@yusneidy r. monitoreá esto", USERS);
    expect(ids).toEqual(["u-005"]);
  });

  it("ignora @desconocidos (no rompe)", () => {
    const ids = parseMentions("@Fulano de Tal revisá @Martina A.", USERS);
    expect(ids).toEqual(["u-002"]);
  });

  it("dedup cuando se menciona dos veces al mismo user", () => {
    const ids = parseMentions("@Martina A. y de nuevo @Martina", USERS);
    expect(ids).toEqual(["u-002"]);
  });

  it("resuelve varias menciones en orden de aparición", () => {
    const ids = parseMentions(
      "@Diego N. asegurate y @Martina A. confirma",
      USERS,
    );
    expect(ids).toEqual(["u-003", "u-002"]);
  });

  it("devuelve [] si no hay tokens", () => {
    expect(parseMentions("sin menciones acá", USERS)).toEqual([]);
  });

  it("devuelve [] si la lista de usuarios está vacía", () => {
    expect(parseMentions("@Martina A.", [])).toEqual([]);
  });

  it("matchea por prefijo del nombre completo", () => {
    const ids = parseMentions("@Carlos Var necesito el booking", USERS);
    expect(ids).toEqual(["u-001"]);
  });
});

describe("renderMentionHtml", () => {
  it("envuelve menciones resueltas en .mention-chip", () => {
    const html = renderMentionHtml("hola @Martina A. ¿viste?", USERS);
    expect(html).toContain('<span class="mention-chip">@Martina A.</span>');
  });

  it("deja @desconocidos como texto plano (sin chip)", () => {
    const html = renderMentionHtml("@NoExiste revisá", USERS);
    expect(html).not.toContain("mention-chip");
  });

  it("escapa HTML para evitar XSS", () => {
    const html = renderMentionHtml("<script>alert(1)</script>", USERS);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("validateCommentInput", () => {
  it("acepta un body válido y lo trimea", () => {
    const r = validateCommentInput({ body: "  comentario válido  " });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.body).toBe("comentario válido");
  });

  it("rechaza body vacío", () => {
    const r = validateCommentInput({ body: "" });
    expect(r.fieldErrors?.body).toBeTruthy();
    expect(r.input).toBeUndefined();
  });

  it("rechaza body solo-espacios", () => {
    const r = validateCommentInput({ body: "    \n\t  " });
    expect(r.fieldErrors?.body).toBeTruthy();
  });

  it("rechaza body > 4000 chars", () => {
    const r = validateCommentInput({ body: "x".repeat(COMMENT_MAX_LENGTH + 1) });
    expect(r.fieldErrors?.body).toBeTruthy();
  });

  it("acepta body exactamente en el límite", () => {
    const r = validateCommentInput({ body: "x".repeat(COMMENT_MAX_LENGTH) });
    expect(r.fieldErrors).toBeUndefined();
  });

  it("rechaza body undefined", () => {
    const r = validateCommentInput({});
    expect(r.fieldErrors?.body).toBeTruthy();
  });
});
