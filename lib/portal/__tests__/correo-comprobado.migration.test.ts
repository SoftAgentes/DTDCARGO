// @vitest-environment node
/**
 * SDD-0646 (D-1, opción C) · La migración 0559 corrida de verdad sobre
 * PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0559_registro_link_correo_comprobado.test.sql`
 * corre en `verify` con Docker; el CI de calidad no tiene Docker. PGlite corre
 * ese MISMO contrato con los `.sql` reales inlineados: se prueba el texto que el
 * runbook aplicará, no un doble.
 *
 * CONTROL ROJO: sin la 0559 el contrato falla.
 * MUTANTES: cada uno cambia la 0559 y tiene que morir con el mensaje que lo
 * caza; si muriera por otro, la prueba falla. PGlite tiene una sola conexión:
 * los FOR UPDATE no se prueban acá.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0559_registro_link_correo_comprobado.test.sql");
const M0559 = "0559_registro_link_correo_comprobado.sql";
const FILE_0559 = readFileSync(resolve(ROOT, "supabase/migrations", M0559), "utf8");
const SLOW = 120_000;

/** psql → SQL plano: quita `\set` e inlinea `\ir` (relativo al archivo). */
function inline(file: string, replace: Record<string, string> = {}): string {
  const out: string[] = [];
  const text = (() => {
    const key = Object.keys(replace).find((name) => file.endsWith(name));
    return key !== undefined ? replace[key] : readFileSync(file, "utf8");
  })();
  for (const line of text.split(/\r?\n/)) {
    const ir = /^\\ir\s+(\S+)\s*$/.exec(line);
    if (ir) {
      out.push(inline(resolve(dirname(file), ir[1]), replace));
    } else if (/^\\set\b/.test(line)) {
      continue;
    } else if (/^\\/.test(line)) {
      throw new Error(`meta-comando no soportado: ${line}`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

async function correr(migracion: string = FILE_0559): Promise<string> {
  const db = await pgliteLimpio();
  try {
    const res = await db.exec(inline(CONTRACT, { [M0559]: migracion }));
    const ultima = res.filter((r) => r.rows.length > 0).at(-1);
    return String((ultima?.rows[0] as { resultado?: string } | undefined)?.resultado ?? "");
  } finally {
    await db.close();
  }
}

function mutar(desde: string, hacia: string): string {
  expect(FILE_0559.includes(desde), `el mutante no encontró: ${desde.slice(0, 60)}`).toBe(true);
  return FILE_0559.replace(desde, hacia);
}

describe("SDD-0646 · migración 0559 (correo comprobado del registro por link)", () => {
  it("el contrato pasa con la migración real", async () => {
    await expect(correr()).resolves.toBe("TEST 0559 GREEN");
  }, SLOW);

  it("control rojo: sin la 0559 el contrato falla", async () => {
    await expect(correr("select 1;")).rejects.toThrow();
  }, SLOW);

  it("el desarme quita la 0559 y devuelve el cuerpo de la 0552", async () => {
    const marca = "-- Como en Supabase: service_role tiene grants sobre las tablas nuevas.";
    const completo = inline(CONTRACT);
    const hastaAplicar = completo.slice(0, completo.indexOf(marca));
    expect(hastaAplicar.length).toBeGreaterThan(0);
    const desarme = readFileSync(resolve(ROOT, "supabase/desarmes/0559_desarme.sql"), "utf8");
    const db = await pgliteLimpio();
    try {
      const res = await db.exec(`${hastaAplicar}
${desarme}
select
  (select md5(prosrc) from pg_proc where oid = 'public.portal_registration_link_bind(uuid,uuid)'::regprocedure) as bind,
  to_regclass('public.client_email_checks') is null as sin_tabla,
  to_regprocedure('public.portal_email_check_claim(text,uuid)') is null as sin_claim,
  to_regprocedure('public.portal_email_check_estado(uuid[])') is null as sin_estado,
  to_regprocedure('public.portal_email_sin_comprobar(text)') is null as sin_pregunta,
  to_regprocedure('public.portal_registration_link_email_status(uuid[])') is not null as con_heuristica,
  not exists (select 1 from pg_trigger where tgname = 'clients_email_vuelve_sin_comprobar_t') as sin_trigger;
rollback;`);
      const fila = res.filter((r) => r.rows.length > 0).at(-1)?.rows[0];
      expect(fila).toEqual({
        bind: "9dc4862d3d6d1a9fe43726203322b2cd",
        sin_tabla: true,
        sin_claim: true,
        sin_estado: true,
        sin_pregunta: true,
        con_heuristica: true,
        sin_trigger: true,
      });
    } finally {
      await db.close();
    }
  }, SLOW);

  it("mutante: el preflight no deja pisar un cuerpo distinto de bind", async () => {
    const m = mutar("9dc4862d3d6d1a9fe43726203322b2cd", "00000000000000000000000000000000");
    await expect(correr(m)).rejects.toThrow(/0559 abortado: portal_registration_link_bind/);
  }, SLOW);

  it("⭐ mutante: mirar le muestra el correo a quien no es el titular", async () => {
    const m = mutar(
      "         case when p_session_user_id is not null and p_session_user_id = ch.auth_user_id\n              then ch.pending_email end",
      "         ch.pending_email",
    );
    await expect(correr(m)).rejects.toThrow(/mirar le mostró el correo a quien no tiene sesión/);
  }, SLOW);

  it("⭐ mutante: mirar le muestra el correo a la sesión de otra cuenta", async () => {
    const m = mutar(
      "case when p_session_user_id is not null and p_session_user_id = ch.auth_user_id",
      "case when p_session_user_id is not null",
    );
    await expect(correr(m)).rejects.toThrow(/mirar le mostró el correo a la sesión de otra cuenta/);
  }, SLOW);

  it("mutante: bind enlaza una cuenta con otro correo", async () => {
    const m = mutar(
      "if v_email is null or (not v_interno and v_email is distinct from v_real) then",
      "if v_email is null then",
    );
    await expect(correr(m)).rejects.toThrow(/enlazó una cuenta con otro correo/);
  }, SLOW);

  it("⭐ mutante: un correo sin comprobar deja de bloquear el enlace de entrada", async () => {
    const m = mutar(
      "       where ch.verified_at is null\n         and lower(cu.email) = q.e\n",
      "       where false\n",
    );
    await expect(correr(m)).rejects.toThrow(/un correo sin comprobar puede recibir un enlace de entrada/);
  }, SLOW);

  it("mutante: la regla alcanza a un cliente que el equipo volvió a invitar por correo", async () => {
    const m = mutar(
      `          on cu.tenant_id = ch.tenant_id and cu.client_id = ch.client_id
         and cu.auth_user_id = ch.auth_user_id and cu.status = 'active'
       where ch.verified_at is null
         and lower(cu.email) = q.e`,
      `          on cu.tenant_id = ch.tenant_id and cu.client_id = ch.client_id
       where ch.verified_at is null
         and lower(cu.email) = q.e`,
    );
    await expect(correr(m)).rejects.toThrow(/bloqueó a un cliente que el equipo volvió a invitar por correo/);
  }, SLOW);

  it("mutante: se emite el enlace sin que la cuenta lleve su dirección interna", async () => {
    const m = mutar(
      `  if not ch.auth_interno then
    raise exception 'La cuenta todavía no lleva la dirección interna' using errcode = '22023';
  end if;
  if ch.pending_email is null`,
      "  if ch.pending_email is null",
    );
    await expect(correr(m)).rejects.toThrow(/emitió el enlace sin que la cuenta lleve su dirección interna/);
  }, SLOW);

  it("mutante: la base anota la dirección interna sin mirar la cuenta", async () => {
    const m = mutar(
      `  if not exists (
    select 1 from auth.users au
     where au.id = ch.auth_user_id and lower(au.email) = ch.internal_email
  ) then
    raise exception 'La cuenta todavía no lleva la dirección interna' using errcode = '22023';
  end if;`,
      "",
    );
    await expect(correr(m)).rejects.toThrow(/anotó la dirección interna sin que la cuenta la lleve/);
  }, SLOW);

  it("⭐ mutante: el enlace de comprobación se puede usar dos veces", async () => {
    const m = mutar(
      "  if ch.id is null or ch.token_used_at is not null or ch.token_expires_at <= now()\n     or ch.verified_at is not null or ch.conflict_at is not null",
      "  if ch.id is null or ch.token_expires_at <= now()\n     or ch.verified_at is not null or ch.conflict_at is not null",
    );
    await expect(correr(m)).rejects.toThrow(/el enlace se reclamó dos veces/);
  }, SLOW);

  it("⭐ mutante: un enlace vencido se puede reclamar", async () => {
    const m = mutar(
      "  if ch.id is null or ch.token_used_at is not null or ch.token_expires_at <= now()\n",
      "  if ch.id is null or ch.token_used_at is not null\n",
    );
    await expect(correr(m)).rejects.toThrow(/un enlace vencido se pudo reclamar/);
  }, SLOW);

  it("mutante: un enlace vencido sigue abriendo la página", async () => {
    const m = mutar("     and ch.token_expires_at > now()\n", "");
    await expect(correr(m)).rejects.toThrow(/un enlace vencido todavía abre/);
  }, SLOW);

  it("⭐ mutante: se marca comprobado sin que el correo esté en la cuenta", async () => {
    const m = mutar(
      `  if not exists (
    select 1 from auth.users au
     where au.id = ch.auth_user_id and lower(au.email) = ch.pending_email
  ) then
    raise exception 'La cuenta todavía no lleva el correo comprobado' using errcode = '22023';
  end if;`,
      "",
    );
    await expect(correr(m)).rejects.toThrow(/marcó comprobado sin que la cuenta lleve el correo/);
  }, SLOW);

  it("mutante: el choque con otra cuenta pasa como si nada", async () => {
    const m = mutar(
      `  v_choque := exists (
    select 1 from auth.users au
     where lower(au.email) = ch.pending_email and au.id <> ch.auth_user_id
  );`,
      "  v_choque := false;",
    );
    await expect(correr(m)).rejects.toThrow(/no avisó que el correo ya tiene otra cuenta/);
  }, SLOW);

  it("⭐ mutante: corregir el correo no lo devuelve a «sin comprobar»", async () => {
    const m = mutar(
      `create trigger clients_email_vuelve_sin_comprobar_t
  after update of email on public.clients
  for each row execute function public.clients_email_vuelve_sin_comprobar();`,
      "",
    );
    await expect(correr(m)).rejects.toThrow(/el correo corregido nació comprobado/);
  }, SLOW);

  it("mutante: cualquier usuario con sesión prepara el reenvío", async () => {
    const m = mutar(
      `  perform public.assert_studio_role(array['admin', 'commercial', 'operations']);

  select * into ch from public.client_email_checks x where x.link_id = p_link_id for update;`,
      "  select * into ch from public.client_email_checks x where x.link_id = p_link_id for update;",
    );
    await expect(correr(m)).rejects.toThrow(/un rol sin permiso preparó el reenvío/);
  }, SLOW);

  it("⭐ mutante: el enlace solo, sin la sesión del titular, comprueba", async () => {
    const m = mutar(
      `  if p_session_user_id is null or p_session_user_id is distinct from ch.auth_user_id then
    return query select null::uuid, null::uuid, null::text, 'sin_sesion_del_titular'::text;
    return;
  end if;`,
      "",
    );
    await expect(correr(m)).rejects.toThrow(/reclamó sin sesión/);
  }, SLOW);

  it("⭐ mutante: la sesión de OTRA cuenta alcanza para reclamar", async () => {
    const m = mutar(
      "  if p_session_user_id is null or p_session_user_id is distinct from ch.auth_user_id then\n    return query",
      "  if p_session_user_id is null then\n    return query",
    );
    await expect(correr(m)).rejects.toThrow(/reclamó con la sesión de otra cuenta/);
  }, SLOW);

  it("⭐ mutante: un intento sin la sesión del titular gasta el enlace", async () => {
    const m = mutar(
      "    return query select null::uuid, null::uuid, null::text, 'sin_sesion_del_titular'::text;\n    return;",
      "    update public.client_email_checks x set token_used_at = now() where x.id = ch.id;\n    return query select null::uuid, null::uuid, null::text, 'sin_sesion_del_titular'::text;\n    return;",
    );
    await expect(correr(m)).rejects.toThrow(/un intento sin la sesión del titular gastó el enlace/);
  }, SLOW);

  it("⭐ mutante: confirmar no mira la sesión", async () => {
    const m = mutar(
      `  if p_session_user_id is null or p_session_user_id is distinct from ch.auth_user_id then
    raise exception 'sin_sesion_del_titular' using errcode = '42501';
  end if;`,
      "",
    );
    await expect(correr(m)).rejects.toThrow(/confirmó sin sesión/);
  }, SLOW);

  it("mutante: el equipo puede leer la tabla (hash del token y correo por comprobar)", async () => {
    const m = mutar(
      "revoke all on public.client_email_checks from public, anon, authenticated;\n",
      "revoke all on public.client_email_checks from public, anon, authenticated;\ngrant select on public.client_email_checks to authenticated;\n",
    );
    await expect(correr(m)).rejects.toThrow(/un usuario con sesión puede leer la tabla/);
  }, SLOW);

  it("mutante: el estado para el equipo devuelve también el correo", async () => {
    const m = mutar(
      "returns table (client_id uuid, link_id uuid, estado text, sent_at timestamptz)",
      "returns table (client_id uuid, link_id uuid, estado text, sent_at timestamptz, correo text)",
    ).replace("         ch.sent_at\n    from public.client_email_checks ch", "         ch.sent_at, ch.pending_email\n    from public.client_email_checks ch");
    await expect(correr(m)).rejects.toThrow(/el estado para el equipo devuelve algo más que el estado/);
  }, SLOW);

  it("mutante: un cliente del portal ve el estado del correo", async () => {
    const m = mutar(
      `  if public.get_user_tenant_id() is null then
    raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
  end if;`,
      "",
    );
    await expect(correr(m)).rejects.toThrow(/un cliente del portal vio el estado del correo/);
  }, SLOW);

  it("mutante: una confirmación a medias suelta el enlace", async () => {
    const m = mutar(
      `     set review_needed_at = now(),
         auth_interno = false,
         updated_at = now()`,
      `     set review_needed_at = now(),
         auth_interno = false,
         token_used_at = null,
         updated_at = now()`,
    );
    await expect(correr(m)).rejects.toThrow(/dejar para revisión soltó el enlace/);
  }, SLOW);

  it("mutante: revocar y volver a invitar borra la señal de «nunca comprobado»", async () => {
    const m = mutar("           ) then 'nunca_comprobado'", "           ) then 'sin_comprobar'");
    await expect(correr(m)).rejects.toThrow(/el equipo dejó de ver que el correo nunca se comprobó/);
  }, SLOW);

  it("mutante: las cuentas por link que ya existían nacen comprobadas", async () => {
    const m = mutar(
      `       coalesce(nullif(lower(btrim(coalesce(c.email, ''))), ''), lower(cu.email)),
       false
  from public.client_registration_links l`,
      `       coalesce(nullif(lower(btrim(coalesce(c.email, ''))), ''), lower(cu.email)),
       false
  from public.client_registration_links l
  join (select 1 where false) nadie on true`,
    );
    await expect(correr(m)).rejects.toThrow(/la cuenta por link que ya existía no quedó anotada/);
  }, SLOW);
});
