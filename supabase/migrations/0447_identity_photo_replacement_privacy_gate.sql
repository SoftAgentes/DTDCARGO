-- ─────────────────────────────────────────────────────────────────────────────
-- 0447 · SDD-0439 — contención de privacidad para reemplazos de identidad.
--
-- 0445 conserva el objeto anterior y su ruta en `client_profile_edits`. Mientras
-- no estén aplicados la purga gobernada, legal hold y el control regional de
-- acceso, cada reemplazo ampliaría indefinidamente la colección de PII.
--
-- La primera carga sigue permitida: `portal_set_identity_photo` no crea una fila
-- `identity_photo` cuando `clients.cedula_photo_path` está vacío. Todo reemplazo
-- sí intenta crearla y este trigger lo detiene dentro de la misma transacción,
-- antes de mover el puntero. Una migración posterior deberá retirar el trigger
-- únicamente cuando esos controles tengan evidencia operativa.
-- ─────────────────────────────────────────────────────────────────────────────

do $preflight$
begin
  if to_regclass('public.client_profile_edits') is null
     or to_regprocedure('public.portal_set_identity_photo(text)') is null then
    raise exception '0447 requiere el contrato aplicado por 0445';
  end if;

  if to_regprocedure(
       'public.block_identity_photo_replacement_without_privacy_controls()'
     ) is not null then
    raise exception '0447 abortado: el gate de privacidad ya existe';
  end if;
end;
$preflight$;

create function public.block_identity_photo_replacement_without_privacy_controls()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.edit_kind = 'identity_photo' then
    raise exception 'identity_photo_replacement_temporarily_disabled'
      using errcode = 'P0001',
        detail = 'Faltan purga gobernada, legal hold y control regional de acceso.';
  end if;
  return new;
end;
$function$;

alter function public.block_identity_photo_replacement_without_privacy_controls()
  owner to postgres;
revoke all on function
  public.block_identity_photo_replacement_without_privacy_controls()
  from public, anon, authenticated, service_role;

create trigger client_profile_edits_identity_photo_privacy_gate
  before insert on public.client_profile_edits
  for each row
  execute function
    public.block_identity_photo_replacement_without_privacy_controls();

comment on function
  public.block_identity_photo_replacement_without_privacy_controls() is
  'SDD-0439: bloquea reemplazos de foto de identidad hasta demostrar retención, legal hold y acceso regional; la primera carga no crea ledger y sigue disponible.';

comment on trigger client_profile_edits_identity_photo_privacy_gate
  on public.client_profile_edits is
  'SDD-0439: contención fail-closed de nuevas versiones históricas de PII.';
