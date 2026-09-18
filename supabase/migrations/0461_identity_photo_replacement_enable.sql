-- ─────────────────────────────────────────────────────────────────────────────
-- 0461 · SDD-0481 — el cliente vuelve a poder reemplazar su foto de identidad.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff.
--    Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md).
--
-- ── Problema ────────────────────────────────────────────────
-- 0447 detuvo todo reemplazo de la foto de cédula/RIF porque 0445 conservaba
-- la imagen sustituida sin purga, legal hold ni control regional. Resultado:
-- el cliente que subió por error una foto que no era no puede corregirla.
--
-- Criterio de Sam (2026-09-18): «el usuario tiene que poder editar la foto que
-- subió de su cédula o de su RIF […] hasta tres cambios».
--
-- ── Qué cambia ──────────────────────────────────────────────
-- Se retiran el trigger y la función de 0447. Nada más.
--
-- `portal_set_identity_photo` (versión 0446) queda idéntica: resuelve el
-- cliente por sesión, valida bucket y prefijo, bloquea la fila del cliente,
-- impone el cupo COMPARTIDO de 3 cambios (datos aprobados/reservados + fotos
-- reemplazadas), deja gratis la primera foto, invalida la verificación de
-- identidad anterior y audita sin PII. El preflight exige esa versión: sin la
-- invalidación de 0446, un reemplazo heredaría un «verificado» que ya no
-- corresponde a la foto.
--
-- ── Qué pasa con la foto sustituida ─────────────────────────
-- Se CONSERVA como versión, igual que diseñó 0445: el objeto sigue en el bucket
-- privado y su ruta sólo vive en el ledger, sin grants para anon, authenticated
-- ni service_role. Ni el Portal ni el Studio la muestran. Es el default de
-- MP-01 §9 («no purgar; conservar» hasta la purga gobernada) y de MP-D6
-- («reemplazar evidencia crea una versión»). El cupo acota el inventario a tres
-- versiones por cliente. La purga a 30 días con hold que propone
-- docs/legal/privacidad/fotos-identidad-cliente-v1.md sigue pendiente (SDD
-- propio): esta migración NO la implementa ni la presenta como activa.
--
-- ── Locks ───────────────────────────────────────────────────
-- DROP TRIGGER toma ACCESS EXCLUSIVE sobre client_profile_edits hasta el COMMIT.
-- La tabla sólo la escriben las RPC del perfil del Portal. lock_timeout 5 s:
-- si corta, se reintenta entero.
-- ─────────────────────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_body text;
begin
  if pg_catalog.to_regclass('public.client_profile_edits') is null
     or pg_catalog.to_regprocedure('public.portal_set_identity_photo(text)') is null then
    raise exception '0461 requiere el contrato de cupo de 0445';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.client_profile_edits'::pg_catalog.regclass
      and trigger_row.tgname = 'client_profile_edits_identity_photo_privacy_gate'
      and not trigger_row.tgisinternal
      and trigger_row.tgfoid = pg_catalog.to_regprocedure(
        'public.block_identity_photo_replacement_without_privacy_controls()'
      )::oid
  ) then
    raise exception '0461 abortado: no está el gate de 0447 que esta migración retira';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.portal_set_identity_photo(text)'::pg_catalog.regprocedure
  ) into v_body;

  if pg_catalog.strpos(v_body, 'doc_verify_status = null') = 0
     or pg_catalog.strpos(v_body, 'profile_edit_limit_reached') = 0 then
    raise exception '0461 abortado: portal_set_identity_photo no es la versión 0446 (cupo + invalidación de verificación)';
  end if;
end;
$preflight$;

drop trigger client_profile_edits_identity_photo_privacy_gate
  on public.client_profile_edits;

drop function public.block_identity_photo_replacement_without_privacy_controls();

comment on column public.client_profile_edits.previous_storage_path is
  'SDD-0481: ruta de la foto de identidad sustituida, conservada como versión (MP-01 §9) hasta que exista la purga gobernada. No se expone por Data API, Portal ni Studio.';
