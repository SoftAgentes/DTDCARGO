import { describe, expect, it } from "vitest";
import { attachmentIdentity, buildAttachmentObjectKey, isCanonicalAttachmentObjectKey } from "../storage-path";

const tenant = "11111111-1111-4111-8111-111111111111";
const entity = "22222222-2222-4222-8222-222222222222";
const document = "33333333-3333-4333-8333-333333333333";

describe("paths canónicos", () => {
  it("genera identidad tenant/entidad/documento", () => {
    const key = buildAttachmentObjectKey({ tenantId: tenant, entityId: entity, documentId: document, mime: "image/jpeg" });
    expect(key).toBe(`${tenant}/expense/${entity}/${document}.jpg`);
    expect(attachmentIdentity("erp-attachments", key)).toContain(key);
  });
  it("rechaza traversal y nombres elegidos", () => expect(isCanonicalAttachmentObjectKey(`${tenant}/expense/${entity}/../x.pdf`)).toBe(false));
});

