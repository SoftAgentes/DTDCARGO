"use client";

/**
 * «No se pudo cargar» con «Reintentar» (SDD-0652 §5.3). Vuelve a pedir la
 * página al servidor (`router.refresh()`): el error se dice y se puede
 * reintentar sin perder el lugar.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

export function ReintentarCarga({ titulo, children, compacto }: { titulo?: string; children: string; compacto?: boolean }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  return (
    <Aviso
      tono="error"
      titulo={titulo}
      compacto={compacto}
      accion={{
        etiqueta: pendiente ? "Reintentando…" : "Reintentar",
        disabled: pendiente,
        onClick: () => startTransition(() => router.refresh()),
      }}
    >
      {children}
    </Aviso>
  );
}
