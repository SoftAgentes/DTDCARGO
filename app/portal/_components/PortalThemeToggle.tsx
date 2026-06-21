"use client";

import { useState } from "react";

/**
 * Toggle de tema del portal (oscuro/claro). Founder 2026-06-20: el portal del demo
 * nace en OSCURO; el cliente puede pasarlo a claro. Persiste por cookie
 * (`portal-theme`, que lee el layout server-side → sin flash en SSR) y aplica el
 * atributo `data-portal-theme` en el shell (#portal-shell) al instante — el CSS
 * reacciona, sin recargar. `initialTheme` lo provee el layout (= cookie o "dark").
 */
export function PortalThemeToggle({
  initialTheme,
}: {
  initialTheme: "dark" | "light";
}) {
  const [theme, setTheme] = useState<"dark" | "light">(initialTheme);
  const isDark = theme === "dark";

  function toggle() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    const shell = document.getElementById("portal-shell");
    if (shell) shell.dataset.portalTheme = next;
    // Cookie 1 año → el layout la lee en el próximo SSR (sin flash).
    document.cookie = `portal-theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className="grid place-items-center h-9 w-9 rounded-md border border-grey-200 text-grey-700 hover:border-ink hover:text-ink transition-colors"
    >
      {isDark ? (
        // Estás en oscuro → ícono de sol (cambiar a claro)
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Estás en claro → ícono de luna (cambiar a oscuro)
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
