/** SDD0578. P1 authored, NOT EXECUTED. Real local app→actions→Supabase only.
 * No page.route/RPC interception, injected component, fake cookie or PODv2 flag.
 * Requires an externally prepared OWN ephemeral Supabase+Next fixture after GO.
 * A SKIP without that resource is NO DISPONIBLE, never acceptance of A18.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { esperarHidratado } from "./_helpers/hidratacion";

type Fixture = {
  kind: "sdd0578-owned-ephemeral"; owner: string; project: string; migrationSha256: string;
  supabaseUrl: string; anonKey: string; serviceKey: string;
  studioEmail: string; studioPassword: string; operarioPin: string; operarioId: string;
  tenantId: string; containerId: string; containerRef: string; clientId: string; destinationId: string;
  code: string; prealertaCode: string; firstBox: string; lateBox: string;
};
function loopback(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password) {
    throw new Error("SDD0578 requires an owned HTTP loopback resource");
  }
  return url;
}
function fixture(): Fixture {
  const path = process.env.SDD0578_E2E_FIXTURE;
  if (!path) throw new Error("SDD0578 fixture unavailable");
  const data: Fixture = JSON.parse(readFileSync(path, "utf8"));
  if (data.kind !== "sdd0578-owned-ephemeral" || data.owner !== "worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468"
    || !data.studioEmail.endsWith("@synthetic.invalid") || !/^[0-9]{4}$/.test(data.operarioPin)) throw new Error("SDD0578 fixture ownership/identity invalid");
  loopback(data.supabaseUrl); loopback(process.env.BASE_URL ?? "");
  const source = readFileSync(resolve("supabase/migrations/0502_consolidacion_cliente_camino_normal.sql"), "utf8");
  if (source.includes("do $authoring_fuse$") || createHash("sha256").update(source).digest("hex") !== data.migrationSha256) {
    throw new Error("SDD0578 reviewed migration/fuse precondition not met");
  }
  return data;
}
async function login(page: Page, data: Fixture) {
  await page.goto("/studio/login?next=/studio/naviera");
  const email = page.getByLabel("Email"); await esperarHidratado(email, "login0578");
  await email.fill(data.studioEmail); await page.getByRole("textbox", { name: "Contraseña" }).fill(data.studioPassword);
  await page.getByRole("button", { name: /INGRESAR/ }).click(); await expect(page).toHaveURL(/\/studio\/naviera/);
}
async function openManifest(page: Page, data: Fixture) {
  await page.goto("/studio/naviera");
  await page.getByRole("button", { name: "Consolidación", exact: true }).click();
  await page.getByRole("button").filter({ hasText: data.containerRef }).first().click();
  const open = page.getByRole("button", { name: /Envíos por cliente|Abrir manifiesto y revisar carga/ });
  await open.first().click();
  const drawer = page.getByRole("dialog", { name: `Envíos por cliente · ${data.containerRef}`, exact: true });
  await expect(drawer.getByRole("button", { name: "Actualizar estado actual" })).toBeVisible();
  return drawer;
}
async function receive(admin: SupabaseClient, staff: SupabaseClient, data: Fixture, box: string) {
  const reply = await admin.rpc("receive_prealerta_boxes_as_operario", { p_operario_id: data.operarioId, p_code: box, p_box_codes: [box] });
  if (reply.error || typeof reply.data?.receipt_id !== "string") throw new Error("Synthetic actual receiving failed");
  const id: string = reply.data.receipt_id;
  // Only NEW, not-yet-confirmed source measures. Actual CN RLS/guard must allow
  // the existing edit; no private-context forgery, direct member seed or rewrite.
  const updated = await staff.from("warehouse_receipts_cn").update({ total_cbm: 1, total_weight_kg: 100 })
    .eq("id", id).eq("tenant_id", data.tenantId).is("shipment_id", null).select("id,receipt_code").single();
  if (updated.error || !updated.data) throw new Error("Synthetic unassigned-source edit failed");
  return { id, code: String(updated.data.receipt_code) };
}
async function snapshot(staff: SupabaseClient, data: Fixture) {
  const result = await staff.rpc("client_consolidation_manifest", { p_container_id: data.containerId });
  if (result.error || !result.data || result.data.containerId !== data.containerId || !Array.isArray(result.data.groups)) {
    throw new Error("Actual complete manifest unavailable");
  }
  return result.data;
}

test.describe("SDD0578 real prospective normal flow", () => {
  test.setTimeout(180_000);
  test.skip(!process.env.SDD0578_E2E_FIXTURE, "NO DISPONIBLE: needs owned ephemeral DB/auth/Storage/Next fixture and explicit local GO");
  test("form → late additive receipt → plan → actual PWA stow → seal → governed VE/manual delivery", async ({ page, browser }, info) => {
    const data = fixture();
    test.skip(info.project.name !== data.project, "Fixture is consumed once by its declared project; other projects are not acceptance");
    const admin = createClient(data.supabaseUrl, data.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const staff = createClient(data.supabaseUrl, data.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const auth = await staff.auth.signInWithPassword({ email: data.studioEmail, password: data.studioPassword });
    if (auth.error) throw new Error("Synthetic Studio login failed");
    const membership = await staff.from("user_tenants").select("tenant_id,role").eq("user_id", auth.data.user.id).single();
    if (membership.error || membership.data.tenant_id !== data.tenantId || membership.data.role !== "operations") throw new Error("Synthetic operations principal required");
    const invoiceCount = async () => {
      const result = await staff.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", data.tenantId);
      if (result.error || result.count === null) throw new Error("Synthetic invoice baseline unavailable"); return result.count;
    };
    const invoicesBefore = await invoiceCount();
    const errors: string[] = []; page.on("pageerror", () => errors.push("pageerror"));
    const first = await receive(admin, staff, data, data.firstBox);
    await login(page, data);
    let drawer = await openManifest(page, data);
    await drawer.getByRole("checkbox", { name: new RegExp(first.code) }).check();
    await drawer.getByLabel("Código manual del envío").fill(data.code.toLowerCase());
    await drawer.getByLabel("Servicio del grupo").selectOption("consolidado_lcl");
    await drawer.getByLabel("Destino del grupo").selectOption(data.destinationId);
    await drawer.getByLabel("Motivo de la incorporación o del cierre").fill("Primera carga sintética revisada");
    await drawer.getByRole("button", { name: "Revisar incorporación", exact: true }).click();
    await expect(drawer.getByRole("heading", { name: "Confirmar incorporación de recepciones" })).toBeFocused();
    await expect(drawer.getByText(/Referencia del intento:/)).toBeVisible();
    const referenceBefore = await drawer.getByText(/Referencia del intento:/).textContent();
    const override = await admin.from("studio_role_module_overrides").select("role").eq("tenant_id", data.tenantId).eq("role", "operations").eq("module_id", "naviera").maybeSingle();
    if (override.error || override.data !== null) throw new Error("Synthetic test requires absent Naviera override initially");
    const denied = await admin.from("studio_role_module_overrides").insert({ tenant_id: data.tenantId, role: "operations", module_id: "naviera", can_view: true, can_edit: false });
    if (denied.error) throw new Error("Synthetic permission-negative setup unavailable");
    try {
      await drawer.getByRole("button", { name: "Confirmar incorporación", exact: true }).click();
      await expect(drawer.getByRole("alert")).toContainText("No tienes permiso");
      await expect(drawer.getByText(/Referencia del intento:/)).toHaveText(referenceBefore ?? "");
      const source = await staff.from("warehouse_receipts_cn").select("shipment_id").eq("id", first.id).single();
      expect(source.error).toBeNull(); expect(source.data?.shipment_id).toBeNull();
    } finally {
      const restored = await admin.from("studio_role_module_overrides").delete().eq("tenant_id", data.tenantId).eq("role", "operations").eq("module_id", "naviera");
      if (restored.error) throw new Error("Synthetic permission restoration failed");
    }
    await drawer.getByRole("button", { name: "Confirmar incorporación", exact: true }).click();
    await expect.poll(async () => (await snapshot(staff, data)).revision).toBe(1);
    const formed = await snapshot(staff, data); const shipment = formed.groups[0].shipmentId; const groupId = formed.groups[0].groupId;
    expect(formed.groups).toHaveLength(1); expect(formed.groups[0].receiptIds).toEqual([first.id]);
    expect(formed.groups[0].rates.totalCents).toBeNull();

    // Arrival of the late batch occurs AFTER formation, through actual0449.
    const late = await receive(admin, staff, data, data.lateBox);
    drawer = await openManifest(page, data);
    await drawer.getByLabel("Destino de la incorporación").selectOption(groupId);
    await drawer.getByRole("checkbox", { name: new RegExp(late.code) }).check();
    await drawer.getByLabel("Motivo de la incorporación o del cierre").fill("Recepción tardía sintética compatible");
    await drawer.getByRole("button", { name: "Revisar incorporación", exact: true }).click();
    await expect(drawer.getByText("Antes:", { exact: false }).first()).toBeVisible();
    await drawer.getByRole("button", { name: "Confirmar incorporación", exact: true }).click();
    await expect.poll(async () => (await snapshot(staff, data)).revision).toBe(2);
    const extended = await snapshot(staff, data);
    expect(extended.groups).toHaveLength(1); expect(extended.groups[0].shipmentId).toBe(shipment);
    expect(extended.groups[0].receiptIds.sort()).toEqual([first.id, late.id].sort());
    expect(extended.groups[0].measures).toEqual({ cbm: "2.000", weightKg: "200.00", boxes: 2 });
    expect(extended.groups[0].rates.totalCents).toBeNull();
    drawer = await openManifest(page, data);
    await drawer.getByRole("button", { name: "Calcular plan con esta carga completa" }).click();
    await expect(drawer.getByRole("status").filter({ hasText: /Plan 1 guardado/ })).toBeVisible();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: process.env.BASE_URL });
    try {
      const scan = await mobile.newPage(); await scan.goto("/m/cn/login");
      for (const digit of data.operarioPin) await scan.getByRole("button", { name: digit, exact: true }).click();
      await expect(scan).not.toHaveURL(/\/login/);
      await scan.goto(`/m/cn/estibar/${data.containerId}`);
      await scan.getByRole("button", { name: "Escanear una caja del lote" }).click();
      await scan.getByRole("textbox", { name: "Escribir el código de la caja" }).fill(data.firstBox);
      await scan.getByRole("button", { name: "Confirmar", exact: true }).click();
      await scan.getByRole("button", { name: /Centro/ }).click();
      await scan.getByRole("button", { name: "Montar el lote", exact: true }).click();
      await expect.poll(async () => (await snapshot(staff, data)).stowedBoxIds.length).toBe(2);
      await info.attach("mobile-actual-css", { body: await scan.screenshot({ fullPage: true }), contentType: "image/png" });
    } finally { await mobile.close(); }

    drawer = await openManifest(page, data);
    await drawer.getByLabel("Motivo de la incorporación o del cierre").fill("Cobertura completa sintética revisada");
    await drawer.getByRole("button", { name: "Revisar cierre del manifiesto" }).click();
    await drawer.getByRole("button", { name: "Confirmar cierre del manifiesto", exact: true }).click();
    await expect.poll(async () => (await snapshot(staff, data)).sealed).toBe(true);
    const advance = async (status: string) => {
      const result = await staff.rpc("advance_consolidation_governed", { p_consolidation_id: data.containerId, p_to: status });
      if (result.error) throw new Error("Actual governed Naviera advance failed");
    };
    await advance("zarpado"); await advance("arribado");
    await page.goto("/studio/ve");
    await page.getByRole("button", { name: "Confirmar liberación de aduana" }).click();
    let dialog = page.getByRole("dialog", { name: "Confirmar liberación de aduana", exact: true });
    await dialog.getByLabel("Evidencia o motivo").fill("Liberación aduanal sintética acreditada");
    await dialog.getByRole("button", { name: "Confirmar liberación", exact: true }).click();
    await expect.poll(async () => (await snapshot(staff, data)).groups[0].status).toBe("arrived_destination");
    const manifest = await snapshot(staff, data);
    const dispatched = await staff.rpc("client_consolidation_transition", { p_shipment_id: shipment, p_operation: "dispatch_ve",
      p_expected_status: "arrived_destination", p_expected_group_revision: 2, p_expected_container_revision: manifest.revision,
      p_reference: crypto.randomUUID(), p_reason: "Reparto operativo sintético" });
    if (dispatched.error) throw new Error("Actual governed dispatch failed");
    // This assertion concerns the typed dispatch RPC, not a claimed TMS UI run.
    await page.reload(); await page.getByRole("button", { name: "Confirmar entrega manual del grupo", exact: true }).click();
    await page.getByLabel("Receptor", { exact: true }).fill("Receptor sintético");
    await page.getByRole("checkbox", { name: /Atesto la entrega de todas las recepciones/ }).check();
    await page.getByRole("button", { name: "Revisar confirmación", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Confirmar entrega manual del grupo completo", exact: true });
    await dialog.getByLabel("Evidencia o motivo").fill("Atestación del grupo completo sintético");
    await dialog.getByRole("button", { name: /Confirmar entrega completa/ }).focus();
    await page.keyboard.down("Space"); await expect.poll(async () => (await snapshot(staff, data)).groups[0].status).toBe("delivered"); await page.keyboard.up("Space");
    expect(errors).toEqual([]);
    expect(await invoiceCount()).toBe(invoicesBefore);
    await info.attach("desktop-actual-css", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await staff.auth.signOut();
    // Resource teardown belongs to the owned ephemeral fixture lifecycle; no
    // purge of business records or reversal of sealed history is attempted here.
  });
});
