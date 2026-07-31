import { ATTACHMENT_BUCKET, type AttachmentMime } from "./types";
import { extensionForMime } from "./policy";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PATH_PATTERN = new RegExp(`^(${UUID})/(expense)/(${UUID})/(${UUID})\\.(jpg|png|webp|pdf)$`, "i");

export function buildAttachmentObjectKey(input: {
  tenantId: string;
  entityId: string;
  documentId: string;
  mime: AttachmentMime;
}): string {
  return `${input.tenantId}/expense/${input.entityId}/${input.documentId}.${extensionForMime(input.mime)}`;
}

export function isCanonicalAttachmentObjectKey(path: string): boolean {
  return PATH_PATTERN.test(path) && !path.includes("..") && !path.includes("//");
}

export function attachmentIdentity(bucketId: string, objectKey: string): string {
  if (bucketId !== ATTACHMENT_BUCKET || !isCanonicalAttachmentObjectKey(objectKey)) {
    throw new Error("Identidad de Storage no canónica.");
  }
  return `${bucketId}/${objectKey}`;
}

