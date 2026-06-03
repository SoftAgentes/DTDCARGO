-- ─────────────────────────────────────────────────────────────
-- Dedup/unique de clients.rif a nivel DB — "clientes reales, no basura".
--
-- `clients.rif` guarda el DOCUMENTO del cliente (cédula de persona o RIF de
-- empresa). Regla del founder: un cliente por documento por tenant. Hoy el
-- enforcement vivía SOLO en la app y con huecos:
--   · registerClientAction (portal) dedupea con ilike("rif", doc) → exact, pero
--     NO atrapa variantes de formato (V-12.345.678 vs V12345678) ni races.
--   · createClientAction (Studio) NO dedupea — inserta directo (hueco).
--   · updateClientAction (Studio) puede cambiar el rif a uno duplicado.
-- Este índice cierra los tres casos a nivel motor (atrapa también el race).
--
-- ÍNDICE UNIQUE PARCIAL + FUNCIONAL (NORMALIZADO):
--   · NORMALIZADO: upper(regexp_replace(rif,'[^A-Za-z0-9]','','g')) saca puntos,
--     guiones y espacios + pasa a mayúsculas, así V-12.345.678 y V12345678 (y
--     v12345678) COLISIONAN. Es la única forma de evitar duplicados "de formato"
--     que el dedup ilike exact deja pasar.
--   · PARCIAL: solo aplica a clientes ACTIVOS con documento no-vacío
--     (rif IS NOT NULL AND btrim(rif) <> '' AND deleted_at IS NULL). Así:
--       - los soft-deleted NO bloquean re-registrar el mismo documento,
--       - los clientes sin documento (rif null o vacío) no chocan entre sí.
--   · POR TENANT: la unicidad es (tenant_id, documento-normalizado) → multi-tenant,
--     dos tenants distintos pueden tener el mismo documento.
--
-- Pre-verificado en prod: CERO duplicados (ni exact ni normalizado) → el índice
-- entra limpio, sin necesidad de limpieza previa.
--
-- El guard del error 23505 (unique_violation) vive en las 3 server actions
-- (registro/actions.ts + clientes/actions.ts): traducen el error crudo de
-- Postgres a un mensaje amable. Este índice es el backstop de DB.
--
-- Aditiva, sin DDL destructivo. NO aplicar a prod (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

create unique index if not exists clients_tenant_doc_unique
  on public.clients (tenant_id, upper(regexp_replace(rif, '[^A-Za-z0-9]', '', 'g')))
  where rif is not null and btrim(rif) <> '' and deleted_at is null;

comment on index public.clients_tenant_doc_unique is
  'Un cliente por documento por tenant (regla founder "clientes reales"). Unicidad sobre el documento NORMALIZADO (sin puntos/guiones/espacios + uppercase) para que V-12.345.678 y V12345678 colisionen. PARCIAL: solo clientes activos con rif no-vacío (soft-deleted NO bloquean re-registro; rif null/vacío permitidos). El guard del error 23505 vive en las server actions de clientes (registro + studio).';
