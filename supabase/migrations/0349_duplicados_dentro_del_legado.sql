-- ─────────────────────────────────────────────────────────────
-- 0349 · client_duplicate_candidates ve también los duplicados DENTRO del legado
--
-- POR QUÉ EXISTE
-- El detector (migr 0341, SDD-0246) sólo comparaba ficha del legado ↔ registro
-- nuevo, por la condición `v.es_legado and not n.es_legado` del join. Nació así
-- porque el problema que resolvía era ese: el cliente viejo que se registraba
-- por la web y salía con un Shipping Mark nuevo.
--
-- Pero el legado se importó de una planilla, y ahí adentro también hay repetidos
-- que nunca se comparan contra nada. Medido el 2026-08-05: **6 pares invisibles**
--   DTD-A119·DTD-Y040 · DTD-J066·DTD-Y017 · DTD-A079·DTD-A135
--   DTD-A032·DTD-J004 · DTD-J044·DTD-Y041 · DTD-A080·DTD-D032
--
-- QUÉ CAMBIA
-- El join deja de exigir que uno sea legado y el otro no. Al abrirlo aparecen
-- dos problemas que antes no existían, y cada uno se resuelve explícito:
--
-- 1. EL PAR ESPEJO. Sin orientación, A↔B y B↔A salen los dos y la lista se
--    duplica. Se fija con un `case`:
--      · si uno es legado y el otro no → el legado va de `v` (misma orientación
--        de siempre: se conserva la ficha con historia y se absorbe el registro
--        nuevo);
--      · si los dos son de la misma clase → gana el de `(created_at, markbox)`
--        menor. Estricto, así que sale UNA sola fila por par.
--
-- 2. QUIÉN SOBREVIVE CUANDO LOS DOS SON LEGADO. Antes sobrevivía el legado por
--    definición y ahí ya no aplica.
--    ⚠️ **La orientación de esta lista NO es una recomendación.** Los 371
--    clientes del legado se importaron el mismo día y tienen el MISMO
--    `created_at` (verificado: 1 sola fecha distinta), así que entre dos legados
--    el orden lo termina decidiendo el markbox — que no dice nada sobre cuál
--    tiene más historia. Es sólo un orden ESTABLE para no repetir el par.
--    Quién sobrevive lo decide la persona al fusionar: `merge_clients` recibe
--    `p_survivor_id` y `p_merged_id` por separado, y la fusión NUNCA es
--    automática (de los 3 duplicados reales, uno coincide sólo por nombre, y el
--    nombre es "Jose Mendez").
--
-- De yapa entran los pares nuevo↔nuevo, que tampoco se miraban. Hoy el alta ya
-- deduplica por documento/correo/teléfono, pero los que se crearon ANTES de esa
-- regla siguen ahí y ahora se ven.
--
-- SOBRE LOS NOMBRES DE LAS COLUMNAS
-- Se conservan `legacy_*` / `new_*` para no romper a quien la consume. Leelos
-- como **superviviente propuesto** / **absorbido propuesto**: con dos legados,
-- "legacy" ya no significa "el del legado", significa "el primero del par".
-- Cambiar la firma obligaría a DROP + CREATE y a tocar la UI, sin ganar nada.
--
-- Aditiva e idempotente: sólo reemplaza el cuerpo de la función. Misma firma,
-- mismos GRANTs (CREATE OR REPLACE los conserva).
-- ─────────────────────────────────────────────────────────────

create or replace function public.client_duplicate_candidates()
returns table(
  legacy_id uuid, legacy_markbox text, legacy_name text,
  new_id uuid, new_markbox text, new_name text,
  match_email boolean, match_phone boolean, match_name boolean,
  match_document boolean, score integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with vivos as (
    select
      c.id, c.markbox, c.name, c.created_at,
      lower(btrim(c.email))                                               as em,
      public.phone_match_key(c.phone)                                     as tel7,
      nullif(upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')), '') as doc,
      lower(btrim(c.name))                                                as nom,
      (c.markbox !~ '^DTD-\d+$')                                          as es_legado
    from public.clients c
    where c.tenant_id = public.get_user_tenant_id()
      and c.deleted_at is null
      and c.merged_into_client_id is null
  )
  select
    v.id, v.markbox, v.name,
    n.id, n.markbox, n.name,
    (n.em = v.em and coalesce(n.em, '') <> '')       as match_email,
    (n.tel7 is not null and n.tel7 = v.tel7)          as match_phone,
    (n.nom = v.nom and coalesce(n.nom, '') <> '')    as match_name,
    (n.doc is not null and n.doc = v.doc)             as match_document,
    (case when n.em = v.em and coalesce(n.em, '') <> '' then 2 else 0 end)
      + (case when n.tel7 is not null and n.tel7 = v.tel7 then 2 else 0 end)
      + (case when n.doc is not null and n.doc = v.doc then 3 else 0 end)
      + (case when n.nom = v.nom and coalesce(n.nom, '') <> '' then 1 else 0 end) as score
  from vivos v
  join vivos n
    -- Orientación: UNA fila por par. Ver el encabezado.
    on (case
          when v.es_legado <> n.es_legado then v.es_legado
          else (v.created_at, v.markbox) < (n.created_at, n.markbox)
        end)
   and (
        (n.em = v.em and coalesce(n.em, '') <> '')
     or (n.tel7 is not null and n.tel7 = v.tel7)
     or (n.doc is not null and n.doc = v.doc)
     or (n.nom = v.nom and coalesce(n.nom, '') <> '')
   )
  order by score desc, v.markbox;
$function$;

comment on function public.client_duplicate_candidates() is
  'SDD-0246 + migr 0349: pares de clientes posiblemente duplicados, UNA fila por par. '
  'Compara legado↔nuevo, legado↔legado y nuevo↔nuevo. legacy_*/new_* son '
  'superviviente/absorbido PROPUESTOS: entre dos de la misma clase el orden es '
  'estable pero arbitrario. Quién sobrevive lo decide la persona al fusionar.';
