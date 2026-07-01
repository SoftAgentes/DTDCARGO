/**
 * API keys & webhooks (SDD-0128) — types, catálogo de eventos, validators.
 *
 * Modela la GESTIÓN de credenciales de integración. El consumo (auth de
 * requests entrantes; dispatcher de webhooks) es follow-up.
 */

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

export interface ApiIntegrationData {
  apiKeys: ApiKey[];
  webhooks: Webhook[];
}

/** Estado de las actions. `token` viene SOLO al crear una key (se muestra 1 vez). */
export interface ApiIntegrationActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  token?: string;
}

/** Eventos suscribibles (ilustrativos; el dispatcher que los emite es follow-up). */
export const WEBHOOK_EVENTS: { key: string; label: string }[] = [
  { key: "shipment.created", label: "Embarque creado" },
  { key: "shipment.status_changed", label: "Embarque cambió de estado" },
  { key: "invoice.emitted", label: "Factura emitida" },
  { key: "invoice.paid", label: "Factura pagada" },
  { key: "order.created", label: "Orden creada" },
];

const WEBHOOK_EVENT_KEYS = new Set(WEBHOOK_EVENTS.map((e) => e.key));
const URL_RE = /^https:\/\/.+/i;

export function validateApiKeyInput(fd: FormData): {
  input?: { name: string };
  fieldErrors?: Record<string, string>;
} {
  const name = typeof fd.get("name") === "string" ? (fd.get("name") as string).trim() : "";
  if (!name) return { fieldErrors: { name: "Ponle un nombre a la key." } };
  if (name.length > 80) return { fieldErrors: { name: "Máximo 80 caracteres." } };
  return { input: { name } };
}

export function validateWebhookInput(fd: FormData): {
  input?: { name: string; url: string; events: string[] };
  fieldErrors?: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  const name = typeof fd.get("name") === "string" ? (fd.get("name") as string).trim() : "";
  const url = typeof fd.get("url") === "string" ? (fd.get("url") as string).trim() : "";
  const events = fd.getAll("events").filter((e): e is string => typeof e === "string" && WEBHOOK_EVENT_KEYS.has(e));

  if (!name) fieldErrors.name = "El nombre es obligatorio.";
  if (!URL_RE.test(url)) fieldErrors.url = "La URL debe empezar con https://";
  if (events.length === 0) fieldErrors.events = "Elige al menos un evento.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: { name, url, events } };
}
