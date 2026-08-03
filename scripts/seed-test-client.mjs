/**
 * Cliente de PRUEBA del Portal — para testear la experiencia del cliente sin
 * registrar uno nuevo cada vez. Idempotente: re-correrlo RESETEA el estado
 * (vuelve a dejar el perfil incompleto → permite re-probar "Completa tu perfil").
 *
 * Correr:
 *   node --env-file=.env.local scripts/seed-test-client.mjs
 *
 * Login que crea (en /portal/login):
 *   Usuario (MARKBOX): DTD-9000
 *   Contraseña (cédula): V-1234567
 *   Email: test@tt.com
 *
 * ⚠️ DTD no tiene Supabase local: esto escribe en la base de PROD. El cliente
 *    queda marcado "CUENTA DE PRUEBA" en notes y se puede borrar cuando no se use.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — corre con --env-file=.env.local",
  );
  process.exit(1);
}
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST = {
  markbox: "DTD-9000",
  name: "SAM (PRUEBA)",
  email: "test@tt.com",
  document: "V-1234567", // = contraseña inicial del portal
  kind: "persona",
  phone: "+58 412 000 0000",
};

async function findUserByEmail(email) {
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("listUsers: " + error.message);
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  // 1. Tenant operativo (el primero, igual que el registro self-service).
  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (tErr || !tenant?.id) throw new Error("tenant: " + (tErr?.message ?? "no encontrado"));
  const tenantId = tenant.id;

  // 2. clients — upsert por markbox (reset de perfil al re-correr).
  const row = {
    tenant_id: tenantId,
    markbox: TEST.markbox,
    name: TEST.name,
    email: TEST.email,
    phone: TEST.phone,
    address: null, // diferida → permite re-probar "Completa tu perfil"
    rif: TEST.document,
    tier: "regular",
    cedula_photo_path: null,
    registration_channel: "portal",
    doc_kind: TEST.kind,
    portal_approved_at: new Date().toISOString(),
    deleted_at: null,
    notes: "CUENTA DE PRUEBA · seed-test-client.mjs (borrar cuando no se use)",
  };
  const { data: existing } = await admin
    .from("clients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("markbox", TEST.markbox)
    .maybeSingle();
  let clientId;
  if (existing?.id) {
    clientId = existing.id;
    const { error } = await admin.from("clients").update(row).eq("id", clientId);
    if (error) throw new Error("update clients: " + error.message);
    console.log("clients · reseteado:", clientId);
  } else {
    const { data, error } = await admin.from("clients").insert(row).select("id").single();
    if (error) throw new Error("insert clients: " + error.message);
    clientId = data.id;
    console.log("clients · creado:", clientId);
  }

  // 3. auth user — crear o resetear contraseña (idempotente).
  let authUserId;
  const meta = { portal_markbox: TEST.markbox, tenant: "dtd-cargo" };
  const created = await admin.auth.admin.createUser({
    email: TEST.email,
    password: TEST.document,
    email_confirm: true,
    user_metadata: meta,
  });
  if (created.error) {
    const msg = (created.error.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exist")) {
      const found = await findUserByEmail(TEST.email);
      if (!found) throw new Error("auth user existe pero no se halló por email");
      authUserId = found.id;
      const upd = await admin.auth.admin.updateUserById(authUserId, {
        password: TEST.document,
        email_confirm: true,
        user_metadata: meta,
      });
      if (upd.error) throw new Error("updateUser: " + upd.error.message);
      console.log("auth · contraseña reseteada:", authUserId);
    } else {
      throw new Error("createUser: " + created.error.message);
    }
  } else {
    authUserId = created.data.user.id;
    console.log("auth · creado:", authUserId);
  }

  // 4. client_users — vincular auth ↔ cliente (idempotente).
  const { data: link } = await admin
    .from("client_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (link?.id) {
    await admin
      .from("client_users")
      .update({ auth_user_id: authUserId, email: TEST.email, status: "active" })
      .eq("id", link.id);
    console.log("client_users · actualizado");
  } else {
    const { error } = await admin.from("client_users").insert({
      tenant_id: tenantId,
      client_id: clientId,
      email: TEST.email,
      auth_user_id: authUserId,
      status: "active",
      bound_at: new Date().toISOString(),
    });
    if (error) throw new Error("insert client_users: " + error.message);
    console.log("client_users · vinculado");
  }

  console.log("\n✅ Cliente de prueba listo. Entrá en /portal/login:");
  console.log("   Usuario (MARKBOX): " + TEST.markbox);
  console.log("   Contraseña (cédula): " + TEST.document);
  console.log("   Atajo: /portal/login?markbox=" + TEST.markbox + "  (usuario ya prellenado)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  });
