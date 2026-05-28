"use client";

/**
 * HeaderActions — LangToggle + botón "+ Nueva recepción".
 *
 * El botón setea ?view=create preservando otros params. AlmacenCnClient
 * escucha ese flag y abre el drawer.
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useT } from "@/lib/i18n";
import { LangToggle } from "./LangToggle";

export function HeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const t = useT();

  const openCreate = () => {
    const sp = new URLSearchParams(params.toString());
    sp.set("view", "create");
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      <LangToggle />
      <button
        type="button"
        className="studio-btn studio-btn-primary"
        onClick={openCreate}
      >
        {t("warehouse_cn.header.new_receipt")}
      </button>
    </div>
  );
}
