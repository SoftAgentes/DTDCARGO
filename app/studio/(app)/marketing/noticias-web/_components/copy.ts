/**
 * copyToClipboard · helper robusto con fallback execCommand.
 *
 * Primario: `navigator.clipboard.writeText` (HTTPS o localhost).
 * Fallback: textarea temporal off-screen + `document.execCommand("copy")`
 * para contextos sin Clipboard API (iframes, http://, browsers viejos).
 *
 * Devuelve boolean: `true` si copió, `false` si falló todo.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  // Primario · Clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through al fallback
    }
  }

  // Fallback · textarea temporal
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
