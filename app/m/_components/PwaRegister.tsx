"use client";

/**
 * Registra el service worker de la PWA del operario en el mount inicial.
 * Pequeño + idempotente (browser dedupea registraciones del mismo SW).
 *
 * En dev (NODE_ENV=development) lo saltea para no entorpecer hot reload.
 */

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    const url = "/m/sw.js";
    navigator.serviceWorker.register(url, { scope: "/m/" }).catch((err) => {
      console.warn("[PWA] SW registration failed:", err);
    });
  }, []);

  return null;
}
