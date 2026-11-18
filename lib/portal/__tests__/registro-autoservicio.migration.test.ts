// @vitest-environment node
/**
 * SDD-0672 (entrega 2) · La migración 0562 corrida de verdad sobre PostgreSQL
 * embebido.
 *
 * El contrato `supabase/tests/0562_registro_link_autoservicio.test.sql` corre en
 * `verify` con Docker; el CI de calidad no tiene Docker. PGlite corre ese MISMO
 * contrato con los `.sql` reales inlineados: se prueba el texto que el runbook
 * aplicará, no un doble.
 *
 * CONTROL ROJO: sin la 0562 el contrato falla.
 * DESARME: devuelve los cuerpos de la 0552 y no se aplica mientras haya un
 * enlace de autoservicio vivo o un registro de autoservicio sin revisar.
 * MUTANTES: cada uno cambia la 0562 y tiene que morir con el mensaje que lo
 * caza; si muriera por otro, la prueba falla. PGlite tiene una sola conexión:
 * los FOR UPDATE no se prueban acá.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0562_registro_link_autoservicio.test.sql");
const M0562 = "0562_registro_link_autoservicio.sql";
const FILE_0562 = readFileSync(resolve(ROOT, "supabase/migrations", M0562), "utf8");
const DESARME = readFileSync(resolve(ROOT, "supabase/desarmes/0562_desarme.sql"), "utf8");
/** El contrato marca el punto justo después de aplicar la 0562. */
const MARCA = "-- ── Fin de la 0562 (el ensayo del desarme corta aquí)";
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

async function correr(migracion: string = FILE_0562): Promise<string> {
  const db = await pgliteLimpio();
  try {
    const res = await db.exec(inline(CONTRACT, { [M0562]: migracion }));
    const ultima = res.filter((r) => r.rows.length > 0).at(-1);
    return String((ultima?.rows[0] as { resultado?: string } | undefined)?.resultado ?? "");
  } finally {
    await db.close();
  }
}

/** El contrato hasta la 0562 recién aplicada: los links del equipo de antes, sin autoservicio. */
function hastaAplicar(): string {
  const completo = inline(CONTRACT);
  const corte = completo.indexOf(MARCA);
  expect(corte, "el contrato perdió la marca del desarme").toBeGreaterThan(0);
  return completo.slice(0, corte);
}

/** Aplica `antes` y el desarme sobre la 0562 recién aplicada; devuelve lo que quedó. */
async function desarmar(antes = ""): Promise<Record<string, unknown> | undefined> {
  const db = await pgliteLimpio();
  try {
    const res = await db.exec(`${hastaAplicar()}
${antes}
${DESARME}
select
  (select md5(prosrc) from pg_proc where oid = 'public.portal_registration_link_peek(text)'::regprocedure) as peek,
  (select md5(prosrc) from pg_proc
    where oid = 'public.portal_registration_link_complete(text,text,text,text,text,text,text,text,text,text,text,boolean)'::regprocedure) as complete,
  to_regprocedure('public.portal_registration_link_create_self(uuid,text,text)') is null
    and to_regprocedure('public.portal_registration_link_peek_self(text)') is null
    and to_regprocedure('public.portal_registration_link_complete_self(text,text,text,text,text,text,text,text,text,text,text,boolean)') is null
    and to_regprocedure('public.portal_registration_link_bind_self(uuid,uuid)') is null
    and to_regprocedure('public.portal_registration_doc_key(text)') is null as sin_rpc,
  not exists (
    select 1 from pg_attribute
     where attrelid = 'public.client_registration_links'::regclass
       and attname in ('link_origin', 'issued_to_email', 'guard_failures') and not attisdropped
  ) as sin_columnas,
  not exists (
    select 1 from pg_constraint
     where conrelid = 'public.client_registration_links'::regclass
       and conname in ('client_registration_links_link_origin_check',
                       'client_registration_links_guard_failures_check',
                       'client_registration_links_autoservicio_email')
  ) as sin_check,
  has_function_privilege('service_role', 'public.portal_registration_link_peek(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.portal_registration_link_peek(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.portal_registration_link_peek(text)', 'EXECUTE') as acl,
  (select count(*)::int from public.client_registration_links) as links;
rollback;`);
    return res.filter((r) => r.rows.length > 0).at(-1)?.rows[0] as Record<string, unknown> | undefined;
  } finally {
    await db.close();
  }
}

const RESTAURADO = {
  peek: "b90378a1238d754744ef6f5e117490b8",
  complete: "690860ca10ed794163b9ddef480cb279",
  sin_rpc: true,
  sin_columnas: true,
  sin_check: true,
  acl: true,
};

/** El cliente c101 del contrato pide su enlace y completa con su cédula. */
const EMITIR_C101 =
  "select public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c101', 'cliente.uno@example.test', repeat('b', 64));";
const COMPLETAR_C101 = `select * from public.portal_registration_link_complete_self(repeat('b', 64), 'persona', 'Ana Uno', null,
  '12345678', 'cliente.uno@example.test', '0412-555-9999', null, 'Valencia', 'Carabobo', null, false);`;

type Mutante = {
  nombre: string;
  /** Pares [desde, hacia] sobre el texto de la 0562; `desde` tiene que estar. */
  cambios: [string, string][];
  muere: RegExp;
};

const MUTANTES: Mutante[] = [
  {
    nombre: "el preflight no deja pisar un cuerpo de peek distinto del de la 0552",
    cambios: [["b90378a1238d754744ef6f5e117490b8", "00000000000000000000000000000000"]],
    muere: /0562 abortado: portal_registration_link_peek no es el cuerpo de la 0552/,
  },
  {
    nombre: "⭐ la ruta del equipo muestra el Shipping Mark de un enlace de autoservicio",
    cambios: [["     and l.link_origin = 'equipo'\n     and l.used_at is null\n", "     and l.used_at is null\n"]],
    muere: /la ruta del equipo muestra el Shipping Mark de un enlace de autoservicio/,
  },
  {
    nombre: "⭐ la ruta del equipo completa con un enlace de autoservicio (salta la guarda)",
    cambios: [[
      "if l.id is null or l.link_origin <> 'equipo' or l.used_at is not null",
      "if l.id is null or l.used_at is not null",
    ]],
    muere: /la ruta del equipo completó con un enlace de autoservicio/,
  },
  {
    nombre: "⭐ sin guarda: datos que no coinciden activan el portal",
    cambios: [["  if not v_coincide then", "  if false then"]],
    muere: /la guarda dejó pasar datos que no coinciden/,
  },
  {
    nombre: "⭐ sin el coalesce, un documento que no se normaliza salta la guarda",
    cambios: [[
      `  v_coincide := coalesce(
       (v_ficha_doc is not null and v_ficha_doc = public.portal_registration_doc_key(v_doc))
    or (v_ficha_tel is not null and v_ficha_tel = public.phone_match_key(v_phone)),
    false);`,
      `  v_coincide :=
       (v_ficha_doc is not null and v_ficha_doc = public.portal_registration_doc_key(v_doc))
    or (v_ficha_tel is not null and v_ficha_tel = public.phone_match_key(v_phone));`,
    ]],
    muere: /un documento que no se normaliza salta la guarda/,
  },
  {
    nombre: "⭐ un intento fallido no suma",
    cambios: [["       set guard_failures = x.guard_failures + 1,", "       set guard_failures = x.guard_failures,"]],
    muere: /un intento fallido no sumó/,
  },
  {
    nombre: "⭐ tres intentos fallidos no revocan el enlace",
    cambios: [[
      "           revoked_at = case when x.guard_failures + 1 >= 3 then now() else x.revoked_at end",
      "           revoked_at = x.revoked_at",
    ]],
    muere: /tres intentos fallidos no revocaron el enlace/,
  },
  {
    nombre: "completar no mira los 3 intentos anotados",
    cambios: [[
      "     or l.revoked_at is not null or l.expires_at <= now() or l.guard_failures >= 3 then",
      "     or l.revoked_at is not null or l.expires_at <= now() then",
    ]],
    muere: /un enlace con 3 intentos fallidos todavía completa/,
  },
  {
    nombre: "⭐ mirar el enlace de autoservicio devuelve también el Shipping Mark",
    cambios: [
      ["returns table (issued_to_email text)\nlanguage sql", "returns table (issued_to_email text, markbox text)\nlanguage sql"],
      ["  select l.issued_to_email\n", "  select l.issued_to_email, c.markbox\n"],
    ],
    muere: /mirar el enlace de autoservicio devuelve algo más que el correo al que salió/,
  },
  {
    nombre: "mirar no mira los 3 intentos",
    cambios: [["     and l.guard_failures < 3\n", ""]],
    muere: /un enlace con 3 intentos fallidos todavía abre/,
  },
  {
    nombre: "mirar el enlace de autoservicio abre un link del equipo",
    cambios: [["     and l.link_origin = 'autoservicio'\n", ""]],
    muere: /mirar el enlace de autoservicio abre un enlace del equipo/,
  },
  {
    nombre: "mirar abre el enlace de un cliente que ya tiene una fila de acceso",
    cambios: [[
      `     and not exists (
       select 1 from public.client_users u
        where u.tenant_id = c.tenant_id and u.client_id = c.id
     );`,
      "     ;",
    ]],
    muere: /el enlace abre para un cliente que ya tiene una fila de acceso/,
  },
  {
    nombre: "⭐ completar con la guarda acepta un link del equipo",
    cambios: [[
      "if l.id is null or l.link_origin <> 'autoservicio' or l.used_at is not null",
      "if l.id is null or l.used_at is not null",
    ]],
    muere: /completar con la guarda aceptó un enlace del equipo/,
  },
  {
    nombre: "completar no mira las filas de acceso invitadas o revocadas",
    cambios: [[
      "        where u.tenant_id = c.tenant_id and u.client_id = c.id\n     ) then\n    raise exception 'link_invalido'",
      "        where u.tenant_id = c.tenant_id and u.client_id = c.id and u.status = 'active'\n     ) then\n    raise exception 'link_invalido'",
    ]],
    muere: /completó la ficha de un cliente que ya tiene una fila de acceso/,
  },
  {
    nombre: "⭐ emitir solo mira el acceso activo (alcanza a invitados y revocados)",
    cambios: [[
      "     where u.tenant_id = c.tenant_id and u.client_id = c.id\n  ) then\n    raise exception 'no_aplica'",
      "     where u.tenant_id = c.tenant_id and u.client_id = c.id and u.status = 'active'\n  ) then\n    raise exception 'no_aplica'",
    ]],
    muere: /emitió el enlace a un cliente con acceso invitado/,
  },
  {
    nombre: "⭐ emitir no compara con el correo de la ficha",
    cambios: [[
      "     or v_email = '' or lower(btrim(coalesce(c.email, ''))) <> v_email then",
      "     or v_email = '' then",
    ]],
    muere: /emitió el enlace a un correo que no es el de la ficha/,
  },
  {
    nombre: "emitir sin dato con qué comprobar",
    cambios: [[
      `  if public.portal_registration_doc_key(c.rif) is null
     and public.phone_match_key(c.phone) is null then
    raise exception 'sin_dato' using errcode = '22023';
  end if;
`,
      "",
    ]],
    muere: /emitió un enlace sin dato con qué comprobar/,
  },
  {
    nombre: "emitir pisa un link vivo del equipo",
    cambios: [["    raise exception 'link_equipo' using errcode = '55000';", "    null;"]],
    muere: /pisó un enlace vivo del equipo/,
  },
  {
    nombre: "⭐ correo_probado aunque el cliente cambió el correo",
    cambios: [["(v_email = l.issued_to_email)", "true"]],
    muere: /dijo que el correo quedó probado cuando el cliente lo cambió/,
  },
  {
    nombre: "⭐ vincular sin probar el correo al que salió el enlace",
    cambios: [["\n     or v_email is distinct from l.issued_to_email then", " then"]],
    muere: /vinculó sin comprobar un correo que no es al que salió el enlace/,
  },
  {
    nombre: "vincular un enlace usado hace más de 10 minutos",
    cambios: [[
      "  if l.id is null or l.link_origin <> 'autoservicio' or l.used_at is null\n     or l.used_at < now() - interval '10 minutes' then",
      "  if l.id is null or l.link_origin <> 'autoservicio' or l.used_at is null then",
    ]],
    muere: /vinculó un enlace usado hace más de 10 minutos/,
  },
  {
    nombre: "⭐ vincular pisa una fila de acceso que ya existe",
    cambios: [[
      "  on conflict (tenant_id, client_id) do nothing;",
      `  on conflict (tenant_id, client_id) do update
     set email = excluded.email, auth_user_id = excluded.auth_user_id, status = 'active',
         bound_at = excluded.bound_at, revoked_at = null;`,
    ]],
    muere: /vinculó sobre una fila de acceso que ya existía/,
  },
  {
    nombre: "anon puede emitir (no se revoca el EXECUTE que Supabase da por defecto)",
    cambios: [[
      "revoke all on function public.portal_registration_link_create_self(uuid, text, text) from public, anon, authenticated;",
      "revoke all on function public.portal_registration_link_create_self(uuid, text, text) from public, authenticated;",
    ]],
    muere: /anon puede ejecutar public\.portal_registration_link_create_self/,
  },
  {
    nombre: "la comparación de la guarda queda para service_role",
    cambios: [[
      "revoke all on function public.portal_registration_doc_key(text) from public, anon, authenticated, service_role;",
      "revoke all on function public.portal_registration_doc_key(text) from public, anon, authenticated;",
    ]],
    muere: /la ruta del servidor puede ejecutar portal_registration_doc_key/,
  },
  {
    nombre: "el documento conserva los ceros a la izquierda",
    cambios: [[
      "      then ltrim(regexp_replace(coalesce(p_doc, ''), '[^0-9]', '', 'g'), '0')\n",
      "      then regexp_replace(coalesce(p_doc, ''), '[^0-9]', '', 'g')\n",
    ]],
    muere: /un cero a la izquierda cambia el documento/,
  },
  {
    nombre: "un documento corto sirve para comparar",
    cambios: [["'0')) >= 6\n", "'0')) >= 1\n"]],
    muere: /un documento de menos de 6 dígitos sirve para comparar/,
  },
  {
    nombre: "⭐ emitir otro no revoca el anterior",
    cambios: [[
      `  update public.client_registration_links l
     set revoked_at = now()
   where l.client_id = c.id and l.used_at is null and l.revoked_at is null;
`,
      "",
    ]],
    muere: /pedir otro enlace no revocó el anterior/,
  },
  {
    nombre: "mirar abre el enlace de una ficha borrada",
    cambios: [["     and l.guard_failures < 3\n     and c.deleted_at is null\n", "     and l.guard_failures < 3\n"]],
    muere: /mirar abre el enlace de una ficha borrada/,
  },
  {
    nombre: "mirar abre el enlace de una ficha fusionada",
    cambios: [[
      "     and c.merged_into_client_id is null\n     and lower(btrim(coalesce(c.email, ''))) = l.issued_to_email\n",
      "     and lower(btrim(coalesce(c.email, ''))) = l.issued_to_email\n",
    ]],
    muere: /mirar abre el enlace de una ficha fusionada/,
  },
  {
    nombre: "⭐ mirar abre un enlace mandado a un correo que la ficha ya corrigió",
    cambios: [["     and lower(btrim(coalesce(c.email, ''))) = l.issued_to_email\n", ""]],
    muere: /un enlace mandado a un correo que la ficha ya corrigió todavía abre/,
  },
  {
    nombre: "completar con la guarda acepta una ficha borrada",
    cambios: [[
      "     or c.deleted_at is not null or c.merged_into_client_id is not null\n",
      "     or c.merged_into_client_id is not null\n",
    ]],
    muere: /completar con la guarda aceptó una ficha borrada/,
  },
  {
    nombre: "completar con la guarda acepta una ficha fusionada",
    cambios: [[
      "     or c.deleted_at is not null or c.merged_into_client_id is not null\n",
      "     or c.deleted_at is not null\n",
    ]],
    muere: /completar con la guarda aceptó una ficha fusionada/,
  },
  {
    nombre: "⭐ completar con un enlace mandado a un correo que la ficha ya corrigió",
    cambios: [["     or lower(btrim(coalesce(c.email, ''))) is distinct from l.issued_to_email\n", ""]],
    muere: /un enlace mandado a un correo que la ficha ya corrigió todavía completa/,
  },
];

function mutar(cambios: [string, string][]): string {
  let texto = FILE_0562;
  for (const [desde, hacia] of cambios) {
    expect(texto.includes(desde), `el mutante no encontró: ${desde.slice(0, 60)}`).toBe(true);
    // Función de reemplazo: un `$` en `hacia` no se interpreta.
    texto = texto.replace(desde, () => hacia);
  }
  return texto;
}

describe("SDD-0672 · migración 0562 (enlace de autoservicio del portal con guarda)", () => {
  it("el contrato pasa con la migración real", async () => {
    await expect(correr()).resolves.toBe("TEST 0562 GREEN");
  }, SLOW);

  it("control rojo: sin la 0562 el contrato falla", async () => {
    await expect(correr("select 1;")).rejects.toThrow();
  }, SLOW);

  it("el desarme quita la 0562, devuelve los cuerpos de la 0552 y conserva los links", async () => {
    await expect(desarmar()).resolves.toEqual({ ...RESTAURADO, links: 2 });
  }, SLOW);

  it("⭐ el desarme no se aplica con un enlace de autoservicio vivo", async () => {
    await expect(desarmar(EMITIR_C101)).rejects.toThrow(/Desarme abortado: hay enlaces de autoservicio vivos/);
  }, SLOW);

  it("el desarme no se aplica con un registro de autoservicio sin revisar", async () => {
    await expect(desarmar(`${EMITIR_C101}\n${COMPLETAR_C101}`)).rejects.toThrow(
      /Desarme abortado: hay registros de autoservicio sin revisar/,
    );
  }, SLOW);

  it("revisado el registro, y con un enlace vencido, el desarme pasa y no borra filas", async () => {
    const antes = `${EMITIR_C101}
${COMPLETAR_C101}
update public.client_registration_links set reviewed_at = now() where link_origin = 'autoservicio';
select public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c114', 'catorce@example.test', repeat('6', 64));
update public.client_registration_links set expires_at = now() - interval '1 minute' where token_hash = repeat('6', 64);`;
    await expect(desarmar(antes)).resolves.toEqual({ ...RESTAURADO, links: 4 });
  }, SLOW);

  it("el desarme no pisa un peek que ya no es el de la 0562", async () => {
    const antes = `create or replace function public.portal_registration_link_peek(p_token_hash text)
returns table (markbox text) language sql stable security definer set search_path = ''
as $$ select null::text where false $$;`;
    await expect(desarmar(antes)).rejects.toThrow(
      /Desarme abortado: portal_registration_link_peek no es el cuerpo de la 0562/,
    );
  }, SLOW);

  for (const mutante of MUTANTES) {
    it(`mutante: ${mutante.nombre}`, async () => {
      await expect(correr(mutar(mutante.cambios))).rejects.toThrow(mutante.muere);
    }, SLOW);
  }
});
