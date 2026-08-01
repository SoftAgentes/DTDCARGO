-- ─────────────────────────────────────────────────────────────
-- SDD-0192 · Slice A — sellar la prueba de entrega (POD)
--
-- Hallazgo H-2 de docs/legal/privacidad/AUDITORIA-2026-07.md:
--
--   `dispatch_pods` guarda la foto, la firma, el nombre y el documento de quien
--   recibe, y el GPS — sin hash, sin trigger append-only y sin `deleted_at`.
--   `legal_acceptances` sí tiene inmutabilidad por trigger (0102). El POD no.
--
-- Por qué importa: la firma dibujada en pantalla NO equivale a firma autógrafa.
-- Falla dos de los tres requisitos del art. 16 de la Ley sobre Mensajes de Datos
-- y Firmas Electrónicas —un trazo se puede producir más de una vez y se puede
-- copiar—, así que cae en el **art. 17**: "elemento de convicción valorable
-- conforme a las reglas de la sana crítica".
--
-- Pero el art. 4 manda promover los mensajes de datos como PRUEBAS LIBRES, y
-- bajo sana crítica el juez pesa el CONJUNTO. Lo que sostiene un POD no es la
-- firma sola: es el haz convergente (foto + documento + firma + GPS + hora +
-- identidad del operario). Y lo primero que ataca la contraparte es "¿cómo sé
-- que no lo montaron después?". Sellar el POD responde eso. Certificar la firma
-- del receptor con un PSC no es viable —un certificado por persona en la puerta
-- no existe como producto—, así que ESTE es el movimiento que rinde.
--
-- ⭐ SE SELLA EL CONTENIDO DE LOS ARCHIVOS, NO SU RUTA.
--    Hashear `photo_path` sería repetir el error que 0297 acaba de corregir en
--    `legal_docs`: si alguien reemplaza el archivo en la misma ruta, un hash de
--    la ruta no cambia. Storage guarda en `storage.objects.metadata` el `eTag`
--    (MD5 del contenido en uploads simples) y el `size`; el sello los incorpora,
--    así que sustituir la foto rompe el hash.
--
--    Límite honesto: MD5 no resiste un ataque de colisión deliberado. Quien
--    tuviera escritura en el bucket podría, en teoría, fabricar otra imagen con
--    el mismo eTag Y el mismo tamaño. Es muchísimo más de lo que exige detectar
--    una sustitución casual o un "arreglemos esta foto después", que es el
--    escenario real. Cuando Storage exponga un SHA-256, se sube la versión de
--    evidencia y listo.
--
-- Momento: `dispatch_pods` tiene 0 filas en prod (verificado 2026-07-31) — el
-- POD está construido pero no se usa todavía. Riesgo de migración: ninguno.
-- Y esto empeora en cuanto entre la primera entrega.
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder · runbook
--    docs/runbooks/aplicar-migraciones-prod.md).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Columnas del sello                                     ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.dispatch_pods
  add column if not exists evidence_version int,
  add column if not exists hash            text;

comment on column public.dispatch_pods.hash is
  'SDD-0192 Slice A: SHA-256 hex del payload canónico del POD (incluye el eTag+size de la foto y de la firma, no solo sus rutas). Lo sella el SERVER en public.dispatch_pods_guard(). Verificable con public.dispatch_pod_hash_valid().';

comment on column public.dispatch_pods.evidence_version is
  'Versión del formato de evidencia del POD. v1 = SDD-0192 Slice A.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Sello del CONTENIDO de un objeto de Storage            ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Devuelve una huella del archivo (eTag + tamaño), no su ruta.
--
-- SECURITY DEFINER a propósito, y es la única de esta migración: el sellado y la
-- verificación DEBEN leer `storage.objects` con los mismos privilegios, o un
-- recompute hecho por otro rol daría "adulterado" cuando el archivo está intacto.
-- No expone nada sensible —eTag y tamaño de una ruta que el caller ya conoce— y
-- se revoca de public/anon/authenticated abajo.

create or replace function public.dispatch_pod_object_seal(p_path text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_path is null or pg_catalog.btrim(p_path) = '' then 'sin-archivo'
    -- `coalesce` es una construcción del lenguaje SQL, no una función: no admite
    -- calificación de esquema y por eso queda sin prefijo aun con search_path=''.
    else coalesce(
      (select pg_catalog.concat(o.metadata->>'eTag', ':', o.metadata->>'size')
         from storage.objects o
        where o.bucket_id = 'receipt-photos'
          and o.name = p_path
        limit 1),
      'objeto-ausente')
  end;
$$;

comment on function public.dispatch_pod_object_seal(text) is
  'SDD-0192 Slice A: huella del CONTENIDO de un archivo del POD (eTag + size de storage.objects), para que el hash detecte una sustitución del archivo y no solo un cambio de ruta.';

revoke all on function public.dispatch_pod_object_seal(text) from public;
revoke all on function public.dispatch_pod_object_seal(text) from anon;
revoke all on function public.dispatch_pod_object_seal(text) from authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Payload canónico                                       ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Una sola fuente de verdad para el sello Y para la verificación: si el sello y
-- el recompute divergieran, el gate descartaría como forjada una prueba válida.
-- Misma lección que `hashEvidence` en lib/studio/legal/seal.ts.
--
-- jsonb normaliza el orden de claves, así que ::text es determinista.

create or replace function public.dispatch_pod_payload(
  p_od_id        uuid,
  p_package_id   uuid,
  p_received_by  text,
  p_received_doc text,
  p_photo_path   text,
  p_signature_path text,
  p_lat          numeric,
  p_lng          numeric,
  p_accuracy_m   numeric,
  p_gps_status   text,
  p_operario_id  uuid,
  p_created_at   timestamptz
)
returns text
language sql
stable
set search_path = ''
as $$
  select (pg_catalog.jsonb_build_object(
    'v',            1,
    'od_id',        p_od_id,
    'package_id',   p_package_id,
    'received_by',  p_received_by,
    'received_doc', p_received_doc,
    'photo',        public.dispatch_pod_object_seal(p_photo_path),
    'signature',    public.dispatch_pod_object_seal(p_signature_path),
    'lat',          p_lat,
    'lng',          p_lng,
    'accuracy_m',   p_accuracy_m,
    'gps_status',   p_gps_status,
    'operario_id',  p_operario_id,
    'created_at',   p_created_at
  ))::text;
$$;

revoke all on function public.dispatch_pod_payload(uuid, uuid, text, text, text, text, numeric, numeric, numeric, text, uuid, timestamptz) from public;
revoke all on function public.dispatch_pod_payload(uuid, uuid, text, text, text, text, numeric, numeric, numeric, text, uuid, timestamptz) from anon;
revoke all on function public.dispatch_pod_payload(uuid, uuid, text, text, text, text, numeric, numeric, numeric, text, uuid, timestamptz) from authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Guard: sella al insertar, append-only para siempre     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Un solo trigger para las tres operaciones, igual que legal_docs_guard (0297):
-- con dos triggers el orden sería alfabético y el invariante quedaría atado al
-- nombre que alguien les ponga.
--
-- Append-only ESTRICTO, sin la excepción de estado que sí tiene legal_docs: un
-- POD no tiene ciclo de vida. Si la entrega se corrigió, se registra otro POD;
-- el primero queda como lo que fue.

create or replace function public.dispatch_pods_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception
      'dispatch_pods es append-only (prueba de entrega): % no permitido. Si la entrega se corrigió, registrá un POD nuevo',
      tg_op
      using errcode = 'check_violation';
  end if;

  new.evidence_version := 1;
  new.hash := pg_catalog.encode(
    extensions.digest(
      public.dispatch_pod_payload(
        new.od_id, new.package_id, new.received_by, new.received_doc,
        new.photo_path, new.signature_path,
        new.pod_lat, new.pod_lng, new.pod_accuracy_m, new.pod_gps_status,
        new.created_by_operario_id, new.created_at
      ), 'sha256'),
    'hex');

  return new;
end;
$$;

comment on function public.dispatch_pods_guard() is
  'SDD-0192 Slice A: sella hash + evidence_version server-side al insertar y rechaza UPDATE/DELETE. Un POD corregido se registra como POD nuevo.';

revoke all on function public.dispatch_pods_guard() from public;
revoke all on function public.dispatch_pods_guard() from anon;
revoke all on function public.dispatch_pods_guard() from authenticated;

drop trigger if exists dispatch_pods_guard_trg on public.dispatch_pods;
create trigger dispatch_pods_guard_trg
  before insert or update or delete on public.dispatch_pods
  for each row execute function public.dispatch_pods_guard();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Verificador — lo que mira un abogado                   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Recomputa el hash desde la fila Y desde el estado ACTUAL de los archivos. Si
-- alguien reemplazó la foto o la firma después de la entrega, el eTag cambió y
-- esto devuelve false. Es la diferencia entre "el sello existe" y "el sello
-- sigue siendo cierto".

create or replace function public.dispatch_pod_hash_valid(p_pod_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p.hash = pg_catalog.encode(
    extensions.digest(
      public.dispatch_pod_payload(
        p.od_id, p.package_id, p.received_by, p.received_doc,
        p.photo_path, p.signature_path,
        p.pod_lat, p.pod_lng, p.pod_accuracy_m, p.pod_gps_status,
        p.created_by_operario_id, p.created_at
      ), 'sha256'),
    'hex')
  from public.dispatch_pods p
  where p.id = p_pod_id;
$$;

comment on function public.dispatch_pod_hash_valid(uuid) is
  'SDD-0192 Slice A: ¿el POD sigue siendo el que se selló? Recomputa contra el estado ACTUAL de los archivos en Storage — si la foto se sustituyó, devuelve false.';

revoke all on function public.dispatch_pod_hash_valid(uuid) from public;
revoke all on function public.dispatch_pod_hash_valid(uuid) from anon;
revoke all on function public.dispatch_pod_hash_valid(uuid) from authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. Sellar lo que ya existiera                             ║
-- ╚═══════════════════════════════════════════════════════════╝
-- 0 filas en prod al escribir esto, pero la migración no lo asume: si un branch
-- o un entorno tuviera POD previos, se sellan antes del NOT NULL. El UPDATE lo
-- rechazaría el guard, así que el backfill va con el trigger desactivado — la
-- única ventana en que esta tabla admite un UPDATE, y dura una migración.

alter table public.dispatch_pods disable trigger dispatch_pods_guard_trg;

update public.dispatch_pods p
   set evidence_version = 1,
       hash = pg_catalog.encode(
         extensions.digest(
           public.dispatch_pod_payload(
             p.od_id, p.package_id, p.received_by, p.received_doc,
             p.photo_path, p.signature_path,
             p.pod_lat, p.pod_lng, p.pod_accuracy_m, p.pod_gps_status,
             p.created_by_operario_id, p.created_at
           ), 'sha256'),
         'hex')
 where p.hash is null;

alter table public.dispatch_pods enable trigger dispatch_pods_guard_trg;

alter table public.dispatch_pods
  alter column hash set not null,
  alter column evidence_version set not null;
