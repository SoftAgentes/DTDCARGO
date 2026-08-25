-- ─────────────────────────────────────────────────────────────
-- 0392 · SDD-0298 · la factura CONGELA el documento fiscal del cliente
--
-- POR QUÉ NO SE LEE EN VIVO DE `clients`.
--
-- `invoices` ya denormaliza `client_name` y `client_markbox` al crear la
-- factura, y no por descuido: una factura emitida es un COMPROBANTE, y un
-- comprobante que se reescribe solo deja de serlo. Si el RIF se leyera en vivo,
-- corregir el documento de un cliente cambiaría en retroactivo el papel de
-- todas sus facturas viejas — incluidas las que ya se entregaron.
--
-- Por eso el documento se guarda acá, junto al nombre, y se sella en el mismo
-- momento: al EMITIR.
--
-- QUÉ COSTÓ LA DECISIÓN — medido en prod el 2026-08-25.
--
-- La alternativa (leer en vivo) tenía a favor que cubría las facturas
-- históricas. Resultó ser una ventaja teórica: hay **5 facturas en total** en el
-- sistema, las 5 emitidas. Congelar hacia adelante deja fuera 5 documentos, y
-- eso se puede resolver a mano o con un backfill nombrado aparte — nunca dentro
-- de esta migración, que sólo abre la puerta.
--
-- POR QUÉ DOS COLUMNAS Y NO UNA.
--
-- `clients.doc_kind` distingue `empresa` (RIF) de `persona` (cédula). Sin él, el
-- PDF no sabe qué etiqueta poner delante del número, y poner "RIF" sobre una
-- cédula es un error fiscal, no de estilo. Se congelan los dos o ninguno.
--
-- NULABLES A PROPÓSITO.
--
-- 344 de 490 clientes vivos tienen documento cargado; 146 no. Una factura a un
-- cliente sin documento tiene que poder existir — el PDF simplemente no imprime
-- la línea. `not null` acá bloquearía facturar a un tercio de la cartera.
-- ─────────────────────────────────────────────────────────────

alter table public.invoices
  add column if not exists client_rif      text,
  add column if not exists client_doc_kind text;

comment on column public.invoices.client_rif is
  'Documento fiscal del cliente CONGELADO al emitir (SDD-0298). No se lee en '
  'vivo de clients: una factura emitida es un comprobante y no puede cambiar '
  'si el cliente corrige su RIF después. NULL = no se capturó.';

comment on column public.invoices.client_doc_kind is
  'Tipo del documento congelado: `empresa` (RIF) o `persona` (cédula). Decide '
  'la etiqueta que imprime el PDF — poner "RIF" sobre una cédula es un error '
  'fiscal. NULL = no se capturó.';

-- El tipo sólo puede ser uno de los dos que usa `clients.doc_kind`, o nada.
-- Se valida acá y no sólo en TypeScript: la columna la puede escribir cualquier
-- cliente de Postgres, y una etiqueta inventada saldría impresa en un documento
-- fiscal sin que nadie la revise.
alter table public.invoices
  drop constraint if exists invoices_client_doc_kind_valido;

alter table public.invoices
  add constraint invoices_client_doc_kind_valido
  check (client_doc_kind is null or client_doc_kind in ('empresa', 'persona'));
