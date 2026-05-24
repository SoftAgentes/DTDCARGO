"use client";

/**
 * SeniatHeaderActions — botón "+ Nuevo trámite" en el header de page.tsx.
 *
 * Vive en el header (no en SeniatClient) para estar visible cross-tab
 * (cola, liberados, agentes, tax). Setea ?view=create — SeniatClient
 * escucha ese flag y abre el CreateFilingDrawer.
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function SeniatHeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const openCreate = () => {
    const sp = new URLSearchParams(params.toString());
    sp.set("view", "create");
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  };

  return (
    <button
      type="button"
      className="studio-btn studio-btn-primary"
      onClick={openCreate}
    >
      + Nuevo trámite
    </button>
  );
}
