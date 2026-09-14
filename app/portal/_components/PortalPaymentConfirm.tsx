"use client";

import type { ComponentProps } from "react";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import styles from "./PortalPaymentConfirm.module.css";

/** Adaptador local de tokens; comportamiento del ConfirmDialog canonical intacto. */
export function PortalPaymentConfirm(props: ComponentProps<typeof ConfirmDialog>) {
  return <div className={styles.scope}><ConfirmDialog {...props} /></div>;
}
