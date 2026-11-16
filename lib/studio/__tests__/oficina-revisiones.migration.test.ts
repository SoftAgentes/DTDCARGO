// @vitest-environment node
/**
 * SDD-0626 Paso 3b · La migración 0549 (la revisión de Sam y el envío desde el ERP) corrida de verdad sobre
 * PostgreSQL embebido, con el contrato `supabase/tests/0549_…test.sql` y los `.sql` reales inlineados (la 0541,
 * la 0544 y la 0548 de las que depende, la 0549 y su desarme).
 *
 * CONTROL ROJO: sin la 0549 el contrato falla. MUTANTES: cada uno quita una barrera de la 0549 y el contrato
 * tiene que caer. El mismo contrato corre en Postgres 17 con Docker en «Contratos SQL».
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

import { huellaBorrador } from "../oficina/revisiones";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0549_oficina_revisiones_envio.test.sql");
const PERMITIDAS = new Set([
  "0541_oficina_cable_tablas.sql",
  "0544_oficina_filtro_bandeja.sql",
  "0548_oficina_despachador.sql",
  "0549_oficina_revisiones_envio.sql",
]);
const M0549 = "0549_oficina_revisiones_envio.sql";
const leer = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

type Transform = (sql: string) => string;

function inline(opts: { sin0549?: boolean; migracion?: Transform } = {}): string {
  return readFileSync(CONTRACT, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        const nombre = include[1].replace("../migrations/", "");
        if (!PERMITIDAS.has(nombre)) throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        if (nombre === M0549 && opts.sin0549) return "";
        const leida = leer(`supabase/migrations/${nombre}`);
        return nombre === M0549 && opts.migracion ? opts.migracion(leida) : leida;
      }
      return /^\\(set|echo)\s/.test(line) ? "" : line;
    })
    .join("\n");
}

async function run(sql: string): Promise<string | null> {
  const db = await pgliteLimpio();
  try {
    await db.exec(sql);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await db.close();
  }
}

function mutar(buscar: string, poner: string): Transform {
  return (sql: string) => {
    const mutado = sql.replace(buscar, poner);
    if (mutado === sql) throw new Error(`el mutante no encontró: ${buscar}`);
    return mutado;
  };
}

describe("0549 · revisión de Sam y envío desde el ERP (PGlite)", () => {
  it("el contrato completo pasa con las migraciones reales (como en Postgres 17)", async () => {
    expect(await run(inline())).toBeNull();
  }, 90_000);

  it("CONTROL ROJO: sin la 0549 el contrato falla", async () => {
    expect(await run(inline({ sin0549: true }))).not.toBeNull();
  }, 90_000);

  const mutantes: Array<[string, Transform, string]> = [
    [
      "revisa cualquiera (sin is_platform_admin)",
      mutar("if v_uid is null or not coalesce(public.is_platform_admin(), false) then", "if v_uid is null then"),
      "CONTRATO 2",
    ],
    [
      "aprueba un envío con un dato inventado",
      (sql) =>
        mutar(
          "  if p_veredicto = 'aprobado' and v_b.tipo = 'respuesta' and not (p_cero_inventados and p_pii_no_repetida) then",
          "  if false then",
        )(mutar("    check (not (veredicto = 'aprobado' and tipo_borrador = 'respuesta')", "    check (true or not (veredicto = 'aprobado' and tipo_borrador = 'respuesta')")(sql)),
      "CONTRATO 2",
    ],
    [
      "dos revisiones por borrador",
      (sql) =>
        mutar("  on conflict (borrador_id) do nothing\n  returning id into v_id;", "  returning id into v_id;")(
          mutar(",\n  -- Una revisión por borrador: la decisión de Sam no se pisa.\n  constraint office_revisiones_borrador_unico unique (borrador_id)", "")(sql),
        ),
      "",
    ],
    [
      "las revisiones se pueden cambiar (sin el disparador)",
      mutar(
        "create or replace trigger office_revisiones_solo_insertar\n  before update or delete on public.office_revisiones",
        "create or replace trigger office_revisiones_solo_insertar\n  before truncate on public.office_revisiones",
      ),
      "",
    ],
    [
      "reserva con la oficina pausada",
      mutar("  if public.office_esta_pausada() then\n    return 'pausada';\n  end if;\n", ""),
      "CONTRATO 5",
    ],
    [
      "envía un borrador que cambió (sin mirar la huella)",
      mutar("  if v_huella <> v_r.huella_borrador or p_huella is distinct from v_r.huella_borrador then", "  if false then"),
      "CONTRATO 5",
    ],
    [
      "reserva dos veces",
      (sql) =>
        mutar("  if exists (select 1 from public.office_envios e where e.revision_id = p_revision) then\n    return 'ya_reservado';", "  if false then\n    return 'ya_reservado';")(
          mutar(",\n  constraint office_envios_un_estado_por_revision unique (revision_id, estado)", "")(sql),
        ),
      "CONTRATO 5",
    ],
    [
      "envía lo rechazado",
      mutar("  if not found or v_r.veredicto <> 'aprobado' or v_r.tipo_borrador <> 'respuesta' then", "  if not found then"),
      "CONTRATO 5",
    ],
    [
      "el conteo no mira los datos inventados",
      mutar("n >= v_min and ok >= pg_catalog.ceil(n * 0.9) and inv = 0", "n >= v_min"),
      "CONTRATO 4",
    ],
    [
      "envía a otra conversación (sin B3)",
      mutar(
        "  if v_r.entidad_ref is null or v_ref_tarea is distinct from v_r.entidad_ref\n     or pg_catalog.substring(v_r.entidad_ref, '^chatwoot:conversations/([0-9]+)/') is distinct from p_conversacion::text then",
        "  if false then",
      ),
      "CONTRATO 8",
    ],
    [
      "la aprobación no vence (sin B1)",
      mutar("  if v_r.revisado_en < pg_catalog.now() - interval '24 hours' then", "  if false then"),
      "CONTRATO 8",
    ],
    [
      "el bloqueo se repite",
      mutar(
        "  if not found or exists (select 1 from public.office_envios e where e.revision_id = p_revision) then\n    return false;\n  end if;\n  perform public.office_bloquear(",
        "  if not found then\n    return false;\n  end if;\n  perform public.office_bloquear(",
      ),
      "" // también lo corta la clave única de office_envios,
    ],
    [
      "authenticated reserva envíos",
      mutar(
        "    execute pg_catalog.format('grant execute on function %s to service_role', v_firma);",
        "    execute pg_catalog.format('grant execute on function %s to service_role, authenticated', v_firma);",
      ),
      "",
    ],
  ];

  for (const [nombre, migracion, esperado] of mutantes) {
    it(`MUTANTE: ${nombre} → el contrato cae`, async () => {
      const error = await run(inline({ migracion }));
      expect(error).not.toBeNull();
      if (esperado) expect(error).toContain(esperado);
    }, 90_000);
  }

  it("la huella del ERP (revisiones.ts) es la misma que la de la base", async () => {
    const db = await pgliteLimpio();
    try {
      await db.exec(
        leer("supabase/migrations/0549_oficina_revisiones_envio.sql")
          .split("-- ─── 1. office_revisiones (D2)")[0]
          .replace(/^do \$preflight\$[\s\S]*?\$preflight\$;/m, ""),
      );
      const casos: Array<[string, string | null, string | null, string | null, number | null]> = [
        ["respuesta", "Entiendo tu consulta. ¿Me compartes tu guía? ñ á", "pedir-guia", null, null],
        ["escalado", null, null, "agente:dinero", 3],
      ];
      for (const [tipo, texto, guion, motivo, prioridad] of casos) {
        const { rows } = await db.query<{ h: string }>(
          "select public.office_huella_borrador($1, $2, $3, $4, $5::smallint) as h",
          [tipo, texto, guion, motivo, prioridad],
        );
        expect(rows[0].h).toBe(huellaBorrador({ tipo, texto, guion, motivo, prioridad }));
        expect(rows[0].h).toMatch(/^[0-9a-f]{64}$/);
      }
      expect(huellaBorrador({ tipo: "respuesta", texto: "a", guion: "b", motivo: null, prioridad: null })).toBe(
        createHash("sha256").update("respuesta\na\nb\n\n").digest("hex"),
      );
    } finally {
      await db.close();
    }
  }, 60_000);

  it("desarme: quita lo de la 0549, deja tareas, bitácora y borradores, y repetirlo no falla", async () => {
    const base = `
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      do $r$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
      end $r$;
      create table public.platform_admins (user_id uuid primary key);
      create function public.is_platform_admin() returns boolean language sql security definer stable
        set search_path = public as $$ select false $$;
    `;
    const nombres =
      "'office_huella_borrador', 'office_exigir_admin', 'office_borradores_pendientes', 'office_revisar_borrador', " +
      "'office_conteo_revisiones', 'office_pendientes_conteo', 'office_envios_por_hacer', 'office_reservar_envio', " +
      "'office_cerrar_envio', 'office_anotar_sesion_por_borrar', 'office_sesiones_por_borrar', 'office_quitar_sesion_por_borrar', " +
      "'office_bloquear', 'office_bloquear_envio', 'office_marcar_envio_incierto'";
    const contar = `(select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname in (${nombres}))`;
    const sql = [
      base,
      leer("supabase/migrations/0541_oficina_cable_tablas.sql"),
      leer("supabase/migrations/0544_oficina_filtro_bandeja.sql"),
      leer("supabase/migrations/0548_oficina_despachador.sql"),
      leer("supabase/migrations/0549_oficina_revisiones_envio.sql"),
      "insert into public.office_tasks (titulo) values ('una');",
      `do $antes$ begin if ${contar} <> 15 then raise exception 'antes del desarme debían existir las 15 funciones'; end if; end $antes$;`,
      leer("supabase/desarmes/0549_desarme.sql"),
      leer("supabase/desarmes/0549_desarme.sql"),
      `do $c$ begin
        if to_regclass('public.office_revisiones') is not null or to_regclass('public.office_envios') is not null
           or to_regclass('public.office_sesiones_por_borrar') is not null then
          raise exception 'el desarme dejó tablas de la 0549';
        end if;
        if ${contar} <> 0 then raise exception 'el desarme dejó funciones de la 0549'; end if;
        if (select count(*) from public.office_tasks) <> 1 or to_regclass('public.office_borradores') is null
           or to_regprocedure('public.office_tomar_tarea(text, integer, integer)') is null then
          raise exception 'el desarme tocó lo que no es de la 0549';
        end if;
      end $c$;`,
      leer("supabase/migrations/0549_oficina_revisiones_envio.sql"),
    ].join("\n");
    expect(await run(sql)).toBeNull();
  }, 60_000);
});
