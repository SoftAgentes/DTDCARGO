-- ─────────────────────────────────────────────────────────────
-- 0243 · SDD-0131 · backfill de clients.doc_kind SOLO donde es deducible
--
-- SDD-0131 enseñó al alta interna a guardar `doc_kind` (persona/empresa), pero
-- arregló únicamente hacia adelante. Medición en prod (2026-07-17):
--
--   403 clientes activos · 372 sin doc_kind (92%) · 31 con doc_kind
--
-- Los 31 que sí lo tienen son los que se registraron por el portal, el único
-- camino que llenaba el campo. Sin `doc_kind` la verificación de identidad no
-- puede rutear (CNE para cédula vs SENIAT para RIF) y la card "qué falta" de la
-- ficha marca a casi toda la base como incompleta.
--
-- Desglose real de los 372 sin tipo, contra las regex de lib/studio/client-types.ts:
--
--   26  J/G + 9 dígitos   → 'empresa'         ✅ deducible (solo pasa RIF_REGEX)
--   22  V/E + 6-8 dígitos → 'persona'         ✅ deducible (solo pasa CEDULA_REGEX)
--    1  P… (pasaporte)    → 'persona'         ✅ deducible (solo pasa CEDULA_REGEX)
--   13  V/E + 9 dígitos   → AMBIGUO           ❌ ver abajo
--  151  empieza con dígito, sin letra         ❌ no pasa NINGUNA regex
--   13  texto tecleado a mano                 ❌ no pasa NINGUNA regex
--  146  sin documento                         — nada que deducir
--
-- Esta migración toca los 49 deducibles. NADA MÁS.
--
-- Por qué V/E + 9 dígitos NO se toca: las dos regex se solapan ahí.
--   RIF_REGEX    = /^[VEJGPvejgp]-?\d{8}-?\d$/   → letra + 9 dígitos
--   CEDULA_REGEX = /^(?:[VEve]-?\d{6,9}|…)$/     → V/E + 6..9 dígitos
-- "V123456789" pasa ambas. No es ruido: en Venezuela la persona natural tiene
-- cédula V-12345678 y RIF V-12345678-9, y por forma son indistinguibles. Elegir
-- uno sería inventar el dato. Esos 13 se resuelven preguntando, no con SQL.
--
-- Los 164 que no pasan ninguna regex (151 + 13) son un problema distinto y mayor:
-- tienen un "documento" que el propio formulario del Studio rechazaría hoy. No les
-- falta la etiqueta, les falta el dato. Requieren decisión del founder (limpieza
-- asistida / pedirle el documento al cliente) → fuera del alcance de esta migración.
--
-- ⚠️ Los valores de doc_kind son 'persona' | 'empresa' (type ClientDocKind en
-- lib/studio/client-types.ts:11), NO 'cedula' | 'rif'. La columna es TEXT SIN
-- check constraint: escribir un valor fuera del type NO falla en la DB, se cuela
-- y la app no lo sabe parsear. Verificado contra prod: los 31 clientes que ya
-- tienen tipo son 27 'persona' + 4 'empresa'.
--
-- Idempotente: filtra `doc_kind is null`, así que re-correrla no pisa nada.
-- Aditiva: no borra, no toca el documento en sí, solo etiqueta.
-- No relaja el dedup: `clients_tenant_doc_unique` (0095) sigue siendo el backstop
-- y esta migración no escribe en la columna del documento.
-- ─────────────────────────────────────────────────────────────

-- Empresa: J/G + 9 dígitos = RIF jurídico. Solo pasa RIF_REGEX → sin ambigüedad.
update public.clients
set doc_kind = 'empresa'
where deleted_at is null
  and doc_kind is null
  and upper(regexp_replace(coalesce(rif, ''), '[^A-Za-z0-9]', '', 'g')) ~ '^[JG][0-9]{9}$';

-- Persona: V/E + 6 a 8 dígitos = cédula. Con 9 dígitos sería ambiguo con el RIF
-- de persona natural, por eso el rango se corta en 8 a propósito.
update public.clients
set doc_kind = 'persona'
where deleted_at is null
  and doc_kind is null
  and upper(regexp_replace(coalesce(rif, ''), '[^A-Za-z0-9]', '', 'g')) ~ '^[VE][0-9]{6,8}$';

-- Persona: pasaporte P + 5-12 alfanuméricos. Solo pasa CEDULA_REGEX.
update public.clients
set doc_kind = 'persona'
where deleted_at is null
  and doc_kind is null
  and upper(regexp_replace(coalesce(rif, ''), '[^A-Za-z0-9]', '', 'g')) ~ '^P[A-Z0-9]{5,12}$';
