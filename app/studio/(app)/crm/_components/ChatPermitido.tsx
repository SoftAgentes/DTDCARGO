"use client";

/**
 * ¿Se ofrece «Abrir chat» y «Conversaciones» en el CRM (SDD-0648 §4)? Lo
 * decide `CrmEmbudosSlot` en el servidor con `puedeAbrirBandeja` (rol de
 * Bandeja + flag `chatwoot_inbox`). Sin proveedor vale `false`: nunca se
 * ofrece un enlace que va a rebotar.
 */

import { createContext, useContext, type ReactNode } from "react";

const Contexto = createContext(false);

export function ChatPermitido({ valor, children }: { valor: boolean; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useChatPermitido(): boolean {
  return useContext(Contexto);
}
