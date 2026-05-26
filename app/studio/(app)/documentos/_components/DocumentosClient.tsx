"use client";

/**
 * DocumentosClient — botón "Generar BL" wireado a DTDWiring (SDD-0034).
 */

import { useDTDWiring } from "../../../_components/wiring/WiringProvider";

export function DocumentosClient() {
  const { openGenerateBLModal } = useDTDWiring();

  return (
    <button
      type="button"
      className="studio-btn studio-btn-primary"
      onClick={openGenerateBLModal}
    >
      Generar BL
    </button>
  );
}
