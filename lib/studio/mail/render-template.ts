/**
 * Render de placeholders `{{var}}` para emails del Studio.
 *
 * Extraído de welcome-email.ts (SDD-0059) para romper el ciclo de imports
 * welcome-email ↔ send-email: ahora `send-email` importa el render desde acá y
 * `welcome-email` puede delegar en `send-email` sin dependencia circular.
 */

/**
 * Renderiza `{{var_name}}` reemplazando por el valor en `vars`.
 * Si una var no existe, deja el placeholder visible (debug-friendly).
 */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    vars[k] != null ? vars[k] : `{{${k}}}`,
  );
}
