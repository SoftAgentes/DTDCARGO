import { beforeEach, describe, expect, it } from "vitest";
import {
  dataUrlToFile,
  enqueuePhoto,
  getPendingPhotos,
  makePhotoLocalId,
  pendingPhotoCount,
  removePhoto,
  type PendingPhoto,
} from "../photo-queue";

function makePhoto(over: Partial<PendingPhoto> = {}): PendingPhoto {
  return {
    localId: over.localId ?? makePhotoLocalId(over.receiptId ?? "rcp-1", over.position ?? 0),
    receiptId: "rcp-1",
    receiptCode: "RCP-2026-0001",
    position: 0,
    photoDataUrl: "data:image/jpeg;base64,AAAA",
    contentType: "image/jpeg",
    queuedAt: 1,
    ...over,
  };
}

describe("photo-queue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("encola y recupera una foto", () => {
    enqueuePhoto(makePhoto({ localId: "a" }));
    expect(pendingPhotoCount()).toBe(1);
    expect(getPendingPhotos()[0].localId).toBe("a");
  });

  it("dedup por receiptId+position: reemplaza la misma posición", () => {
    enqueuePhoto(makePhoto({ localId: "a", position: 0, photoDataUrl: "data:image/jpeg;base64,OLD" }));
    enqueuePhoto(makePhoto({ localId: "b", position: 0, photoDataUrl: "data:image/jpeg;base64,NEW" }));
    const pending = getPendingPhotos();
    expect(pending).toHaveLength(1);
    expect(pending[0].localId).toBe("b");
    expect(pending[0].photoDataUrl).toBe("data:image/jpeg;base64,NEW");
  });

  it("posiciones distintas de la misma recepción coexisten", () => {
    enqueuePhoto(makePhoto({ localId: "a", position: 0 }));
    enqueuePhoto(makePhoto({ localId: "b", position: 1 }));
    expect(pendingPhotoCount()).toBe(2);
  });

  it("recepciones distintas con misma posición coexisten", () => {
    enqueuePhoto(makePhoto({ localId: "a", receiptId: "rcp-1", position: 0 }));
    enqueuePhoto(makePhoto({ localId: "b", receiptId: "rcp-2", position: 0 }));
    expect(pendingPhotoCount()).toBe(2);
  });

  it("remueve por localId", () => {
    enqueuePhoto(makePhoto({ localId: "a", position: 0 }));
    enqueuePhoto(makePhoto({ localId: "b", position: 1 }));
    removePhoto("a");
    const pending = getPendingPhotos();
    expect(pending).toHaveLength(1);
    expect(pending[0].localId).toBe("b");
  });

  it("respeta el cap de 9 (dropea las más viejas)", () => {
    for (let i = 0; i < 12; i++) {
      enqueuePhoto(makePhoto({ localId: `id-${i}`, receiptId: `rcp-${i}`, position: 0 }));
    }
    expect(pendingPhotoCount()).toBe(9);
    const ids = getPendingPhotos().map((p) => p.localId);
    // Las 3 primeras (id-0..id-2) se dropearon; quedan id-3..id-11.
    expect(ids).toContain("id-11");
    expect(ids).not.toContain("id-0");
    expect(ids).not.toContain("id-2");
  });

  it("getPendingPhotos sobre localStorage corrupto devuelve []", () => {
    localStorage.setItem("dtd_photo_queue", "{no json");
    expect(getPendingPhotos()).toEqual([]);
  });

  it("makePhotoLocalId codifica receiptId y position", () => {
    const id = makePhotoLocalId("rcp-9", 2);
    expect(id.startsWith("rcp-9-2-")).toBe(true);
  });

  it("dataUrlToFile reconstruye un File con el mime correcto", () => {
    // "AAAA" en base64 = 3 bytes
    const file = dataUrlToFile("data:image/jpeg;base64,AAAA", "x.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBe(3);
  });
});
