-- ─────────────────────────────────────────────────────────────
-- SDD-0191 · Slice A — sellar el CONTENIDO de legal_docs
--
-- Hallazgo H-1 de docs/legal/privacidad/AUDITORIA-2026-07.md:
--
--   El hash de una aceptación sella `docs: [{key, version}]` — la REFERENCIA al
--   documento, no su texto. Y `legal_docs` no tiene hash del cuerpo ni trigger
--   de inmutabilidad, mientras sí tiene policies de update y delete para admin.
--   Resultado: un administrador puede editar el `body` de un documento vigente
--   sin cambiar la versión, y TODAS las aceptaciones previas seguirían validando
--   su hash contra un texto distinto del que el cliente aceptó.
--
--   La regla "un documento publicado es INMUTABLE; cambios = nueva versión"
--   (HANDOFF_CAPA_LEGAL.md §SDD-A) existía como norma escrita, no como
--   restricción de la base. Y la cláusula 13.1 del Acuerdo le promete al cliente
--   "huella de integridad (hash)", que un juez leería como sello del contenido.
--
-- Marco: Ley sobre Mensajes de Datos y Firmas Electrónicas, art. 16.3 — la firma
-- no debe "alterar la integridad del Mensaje de Datos". Un cuerpo mutable
-- debilita incluso la valoración por sana crítica del art. 17. Esta migración no
-- convierte la aceptación en firma autógrafa (eso exige un PSC acreditado por
-- SUSCERTE, ver SDD-0193) — hace verdadero lo que el Acuerdo ya promete.
--
-- Aditiva. Verificado 2026-07-30: `legal_acceptances` tiene 0 filas en prod (el
-- sistema no se ha lanzado a clientes), así que no hay evidencia previa que
-- preservar y el payload sube a v3 con corte limpio — mismo criterio con el que
-- SDD-0067 subió de v1 a v2.
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder · runbook
--    docs/runbooks/aplicar-migraciones-prod.md).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Columna del sello                                      ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.legal_docs
  add column if not exists body_sha256 text;

comment on column public.legal_docs.body_sha256 is
  'SDD-0191 Slice A: SHA-256 hex del cuerpo publicado (body::text). Lo sella el SERVER en public.legal_docs_guard() — nunca el cliente. Entra al payload canónico de legal_acceptances (evidencia v3), así que si el texto cambia, toda aceptación que lo referencie deja de validar.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Guard: sella el cuerpo + protege lo publicado          ║
-- ╚═══════════════════════════════════════════════════════════╝
--
-- Una sola función para las tres operaciones, a propósito: si el sellado y la
-- inmutabilidad vivieran en dos triggers, el orden entre ellos sería alfabético
-- y el invariante quedaría atado al nombre que alguien les ponga.
--
-- Qué NO se puede cambiar de una fila existente: tenant_id, key, name, audience,
-- version, effective_date, sections y body. Eso es el documento.
-- Qué SÍ: `status` (solo vigente → archivada, para poder publicar la versión
-- siguiente) y `change_note` (la nota del histórico, migr 0212).
--
-- DELETE se rechaza siempre: un documento legal publicado es un registro, y la
-- salida es archivarlo, no borrarlo. Mismo criterio que
-- legal_acceptances_immutable() (0102).
--
-- search_path = '' + nombres calificados (endurecimiento SDD-0189).

create or replace function public.legal_docs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'legal_docs no admite DELETE (registro legal): archivá la versión en vez de borrarla (key=%, version=%)',
      old.key, old.version
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' then
    if new.tenant_id      is distinct from old.tenant_id
       or new.key            is distinct from old.key
       or new.name           is distinct from old.name
       or new.audience       is distinct from old.audience
       or new.version        is distinct from old.version
       or new.effective_date is distinct from old.effective_date
       or new.sections       is distinct from old.sections
       or new.body::text     is distinct from old.body::text
    then
      raise exception
        'legal_docs es inmutable una vez publicado: un cambio de contenido exige una versión nueva (key=%, version=%)',
        old.key, old.version
        using errcode = 'check_violation';
    end if;

    if new.status is distinct from old.status
       and not (old.status = 'vigente' and new.status = 'archivada')
    then
      raise exception
        'legal_docs: transición de estado no permitida (% → %). Solo vigente → archivada',
        old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  -- INSERT, o UPDATE ya validado: el sello lo pone el server, siempre. Lo que
  -- venga en new.body_sha256 desde el cliente se descarta.
  new.body_sha256 :=
    pg_catalog.encode(extensions.digest(new.body::text, 'sha256'), 'hex');

  return new;
end;
$$;

comment on function public.legal_docs_guard() is
  'SDD-0191 Slice A: sella body_sha256 server-side y hace inmutable el documento publicado (solo cambian status vigente→archivada y change_note). DELETE prohibido.';

drop trigger if exists legal_docs_guard_trg on public.legal_docs;
create trigger legal_docs_guard_trg
  before insert or update or delete on public.legal_docs
  for each row execute function public.legal_docs_guard();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Backfill de las filas existentes                       ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Las archivadas de 0212 tienen body '[]' (el articulado histórico no se
-- conservó): su hash es el de '[]', que es correcto y honesto — sella lo que
-- realmente hay.
--
-- El UPDATE no toca ninguna columna protegida, así que pasa el guard; y el
-- propio guard recalcula el sello, de modo que el `set` es solo el disparador.

update public.legal_docs
   set change_note = change_note
 where body_sha256 is null;

alter table public.legal_docs
  alter column body_sha256 set not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RLS: retirar el DELETE que ya no existe                ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El trigger lo bloquea para todos, incluido service_role. Dejar una policy que
-- promete un permiso inexistente confunde a quien lea el esquema.
-- La policy de UPDATE se conserva: es la que permite archivar.

drop policy if exists "legal_docs delete by admin" on public.legal_docs;
