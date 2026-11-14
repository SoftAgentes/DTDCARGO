// SDD-0473: experimental QA consumer, never a production QR resolver.
// Closed identities are the accepted Recovery03 readiness, not inferred from c/n.
const ORIGIN = "http://127.0.0.1:4324";
const CONTEXTS = Object.freeze({
  xlsx: Object.freeze({ id: "7015967d-5c7d-4a58-8dad-7ade1e7784e0", code: "DTD-DEMO-1-2", cartons: 10 }),
  pdf: Object.freeze({ id: "f26ee17c-59d4-43ef-9f9b-bcb5f7c2cd29", code: "DTD-DEMO-1-1", cartons: 10 }),
});
// labelVerifyUrl uses the canonical fallback; Vite's two closed QA launchers
// define NEXT_PUBLIC_SITE_URL by port. These are data origins, never fetch targets.
const QR_ORIGINS = new Set(["https://dtdcargo.com", "http://127.0.0.1:4323", ORIGIN]);
const TIMEOUT_MS = 15000; // Local read deadline, unrelated to GLM's pipeline budget.
const MAX_QR_LENGTH = 2048; // QA input guard; not a business box-code length limit.
const MAX_GROUPS = 500; // parseDocumentDraft(groups).
const byId = (id) => document.getElementById(id);
const fields = ["case", "qr", "revision", "folio", "version"].map(byId);
const form = byId("lookup"), submit = byId("submit"), cancel = byId("cancel");
const status = byId("status"), result = byId("result"), details = byId("details");
const observation = byId("observation"), link = byId("document-link");
const touched = new Set();
let generation = 0;
let active = null;

class LookupError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const reject = (code) => { throw new LookupError(code); };
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
function unsigned(value, min) {
  if (!/^(0|[1-9]\d*)$/.test(value)) return null;
  const number = Number(value);
  return integer(number, min) ? number : null;
}
function qrValue(raw, context) {
  if (!raw || raw.length > MAX_QR_LENGTH || raw !== raw.trim() || /[\s\\]/.test(raw)) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (!QR_ORIGINS.has(url.origin) || url.username || url.password || url.hash || raw.includes("#") ||
      url.pathname !== "/verificar" || !/^(https:\/\/dtdcargo\.com|http:\/\/127\.0\.0\.1:432[34])\/verificar\?/.test(raw)) return null;
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 3 || new Set(keys).size !== 3 || keys.some((key) => !["c", "n", "b"].includes(key))) return null;
  const c = url.searchParams.get("c"), n = url.searchParams.get("n"), b = url.searchParams.get("b");
  if (c !== "DTD-DEMO" || !/^[1-9]\d*\/[1-9]\d*$/.test(n ?? "") || !/^DTD-B-\d{4,}$/.test(b ?? "")) return null;
  const [boxN, totalBoxes] = n.split("/").map(Number);
  // Both admitted datasets contain ten cartons; do not use a universal invented cap.
  if (!integer(boxN, 1) || !integer(totalBoxes, 1) || totalBoxes !== context.cartons || boxN > totalBoxes) return null;
  return { raw, c, boxN, totalBoxes, b };
}
function fieldError(field) {
  const value = field.value;
  if (field.id === "case") return Object.hasOwn(CONTEXTS, value) ? "" : "Elige una de las dos compras de prueba.";
  if (field.id === "qr") return qrValue(value, CONTEXTS[byId("case").value] ?? CONTEXTS.xlsx) ? "" : "Pega un QR completo de esta prueba: dirección /verificar, Shipping Mark DTD-DEMO, número/10 y código físico b. Sin parámetros adicionales.";
  if (field.id === "revision") return unsigned(value, 0) !== null ? "" : "Escribe la revisión impresa como un entero desde 0, sin espacios ni operaciones.";
  if (field.id === "version") return unsigned(value, 1) !== null ? "" : "Escribe la versión impresa como un entero desde 1, sin espacios ni operaciones.";
  return value && value === value.trim() && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value) ? "" : "Escribe el folio impreso completo, sin espacios al principio o al final.";
}
function validate(field) {
  const message = fieldError(field), error = byId(`${field.id}-error`);
  error.textContent = message;
  error.hidden = !message;
  field.setAttribute("aria-invalid", String(Boolean(message)));
  return !message;
}
function state(message, kind = "pending", focus = false) {
  status.textContent = message;
  status.dataset.state = kind;
  if (focus) status.focus();
}
function busy(value) {
  submit.disabled = value;
  submit.textContent = value ? "Comprobando caja…" : "Comprobar caja";
  cancel.disabled = !value;
  observation.setAttribute("aria-busy", String(value));
}
function invalidate(message = "Pendiente: cambió la entrada. Comprueba de nuevo la caja.") {
  generation += 1;
  active?.abort();
  active = null;
  result.hidden = true;
  details.replaceChildren();
  link.removeAttribute("href");
  busy(false);
  state(message);
}
for (const field of fields) {
  field.addEventListener("input", () => {
    invalidate();
    if (touched.has(field.id)) validate(field);
    if (field.id === "case" && touched.has("qr")) validate(byId("qr"));
  });
  field.addEventListener("change", () => invalidate());
  field.addEventListener("blur", () => { touched.add(field.id); validate(field); });
}
cancel.addEventListener("click", () => {
  invalidate("Consulta cancelada. Tus entradas siguen en pantalla; puedes comprobarlas de nuevo.");
  submit.focus();
});
byId("theme").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  byId("theme").setAttribute("aria-pressed", String(dark));
  byId("theme").textContent = dark ? "Usar tema claro" : "Usar tema oscuro";
});
async function read(action, context, revision, signal) {
  if (!["workspace", "labels"].includes(action)) reject("invalid_response");
  const endpoint = new URL("/api/document-import", ORIGIN);
  endpoint.search = new URLSearchParams({ action, workspaceId: context.id,
    ...(action === "labels" ? { expectedRevision: String(revision) } : {}) }).toString();
  const response = await fetch(endpoint.href, {
    method: "GET", credentials: "omit", mode: "same-origin", cache: "no-store",
    redirect: "error", referrerPolicy: "no-referrer", signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) reject(response.status === 409 ? "stale" : response.status === 401 || response.status === 403 || response.status === 404 ? "unavailable" : "network");
  if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") reject("invalid_response");
  const payload = await response.json();
  if (!object(payload)) reject("invalid_response");
  return payload;
}
function workspace(payload, context, revision) {
  const w = payload.workspace;
  if (!object(w) || w.id !== context.id || !integer(w.revision) || w.revision !== revision || w.confirmedRevision !== revision) reject("stale");
  const draft = w.draft;
  if (!object(draft) || draft.schemaVersion !== 1 || !Array.isArray(draft.groups) || !draft.groups.length ||
      draft.groups.length > MAX_GROUPS || !Array.isArray(draft.issues) || draft.issues.length > 2000) reject("invalid_response");
  // confirmationIssues retains history but excludes explicitly resolved issues.
  if (draft.issues.some((issue) => !object(issue) || typeof issue.blocking !== "boolean" ||
      (issue.resolved !== undefined && typeof issue.resolved !== "boolean") ||
      (issue.blocking && issue.resolved !== true))) reject("incomplete");
  let total = 0;
  for (const group of draft.groups) {
    if (!object(group) || !integer(group.cartons, 1) || !Number.isFinite(group.grossWeightKg) || group.grossWeightKg <= 0 ||
        !Number.isFinite(group.cbm) || group.cbm <= 0) reject("incomplete");
    total += group.cartons;
    if (!integer(total, 1) || total > context.cartons) reject("mismatch");
  }
  if (total !== context.cartons) reject("mismatch");
  return w;
}
function labels(payload, context, revision, folio, versionNo, qr) {
  if (payload.revision !== revision || payload.folio !== folio || payload.versionNo !== versionNo ||
      !integer(payload.versionNo, 1) || !Array.isArray(payload.labels) || payload.labels.length !== context.cartons) reject("mismatch");
  const codes = new Set();
  for (const [index, label] of payload.labels.entries()) {
    if (!object(label) || label.code !== context.code || label.boxN !== index + 1 || label.totalBoxes !== context.cartons ||
        typeof label.boxCode !== "string" || !/^DTD-B-\d{4,}$/.test(label.boxCode) || codes.has(label.boxCode)) reject("mismatch");
    codes.add(label.boxCode);
  }
  const label = payload.labels[qr.boxN - 1];
  if (label.boxCode !== qr.b || label.boxN !== qr.boxN || label.totalBoxes !== qr.totalBoxes) reject("mismatch");
  return label;
}
function detail(name, value) {
  const term = document.createElement("dt"), description = document.createElement("dd");
  term.textContent = name;
  description.textContent = String(value);
  details.append(term, description);
}
const errors = Object.freeze({
  stale: "La revisión no está confirmada o cambió durante la consulta. Conservamos tus entradas. Reabre el documento local y comprueba su revisión vigente.",
  incomplete: "El documento aún tiene información pendiente. Completa y confirma su revisión antes de comprobar las cajas.",
  mismatch: "La etiqueta o sus datos impresos no coinciden con esta compra confirmada. Revisa compra, caja, total, folio y versión; no se muestra una caja de otro caso.",
  unavailable: "No se pudo consultar esta compra. Conservamos tus entradas. Revisa el caso local y sus permisos.",
  invalid_response: "La respuesta local no pudo verificarse. Conservamos tus entradas. Solicita revisar el servicio de prueba antes de intentar otra consulta.",
  network: "La consulta local falló. Conservamos tus entradas. Comprueba que el servicio esté disponible y vuelve a comprobar la caja.",
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (active) return;
  invalidate();
  let firstInvalid = null;
  for (const field of fields) { touched.add(field.id); if (!validate(field)) firstInvalid ??= field; }
  if (firstInvalid) {
    state("No se realizó la consulta. Corrige los campos indicados y vuelve a comprobar la caja.", "error");
    firstInvalid.focus();
    return;
  }
  if (location.origin !== ORIGIN) {
    state("Esta comprobación sólo está disponible en http://127.0.0.1:4324. Conservamos tus entradas; abre el visor local autorizado.", "error", true);
    return;
  }
  const context = CONTEXTS[byId("case").value], revision = Number(byId("revision").value);
  const folio = byId("folio").value, versionNo = Number(byId("version").value);
  const qr = qrValue(byId("qr").value, context), mine = generation;
  const controller = new AbortController();
  active = controller;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
  busy(true);
  state("Comprobando documento, cajas físicas y revisión compartida…");
  const startedAt = new Date().toISOString();
  try {
    const before = workspace(await read("workspace", context, revision, controller.signal), context, revision);
    if (mine !== generation) return;
    if (controller.signal.aborted) reject("network");
    const gate = await read("labels", context, revision, controller.signal);
    const label = labels(gate, context, revision, folio, versionNo, qr);
    if (mine !== generation) return;
    if (controller.signal.aborted) reject("network");
    const after = workspace(await read("workspace", context, revision, controller.signal), context, revision);
    if (mine !== generation) return;
    if (controller.signal.aborted) reject("network");
    // projectWorkspace exposes no folio/version/purchase fields. Those come
    // from getDocumentLabels (it rechecks confirmed_submission_id server-side).
    if (JSON.stringify(before) !== JSON.stringify(after)) reject("stale");
    detail("Compra", label.code);
    detail("Documento local", context.id);
    detail("Revisión confirmada consultada", revision);
    detail("Folio / versión comprobados", `${gate.folio} / V${gate.versionNo}`);
    detail("Shipping Mark", qr.c);
    detail("Caja física", label.boxCode);
    detail("Número / total de cajas", `${label.boxN} / ${label.totalBoxes}`);
    detail("Inicio de lectura (UTC)", startedAt);
    detail("Fin de lectura (UTC)", new Date().toISOString());
    detail("Contenido original del QR (texto)", qr.raw);
    link.href = `${ORIGIN}/portal/compras/${context.code}/documento`;
    result.hidden = false;
    state("Caja válida en la revisión consultada. Coincidieron documento confirmado, compra, caja física, número/total, folio y versión en las lecturas locales.", "success");
  } catch (error) {
    if (mine !== generation) return;
    result.hidden = true;
    details.replaceChildren();
    link.removeAttribute("href");
    state(timedOut ? "La consulta superó 15 segundos. Tus entradas siguen en pantalla; comprueba el servicio local antes de volver a consultar." : errors[error instanceof LookupError ? error.code : "network"] ?? errors.invalid_response, "error", true);
  } finally {
    clearTimeout(timeout);
    if (mine === generation) { active = null; busy(false); }
  }
});
// A restored history page never retains an old green observation.
addEventListener("pageshow", () => invalidate("Pendiente: comprueba la caja con los datos actuales del documento."));
addEventListener("pagehide", () => invalidate());
