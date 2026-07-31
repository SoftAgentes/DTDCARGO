# Diseño técnico D4 — logística R3

## Alcance

D4 normaliza exactamente cinco RPC ya atómicas:

1. `operario_action`;
2. `stuff_box_as_operario`;
3. `unstuff_box_as_operario`;
4. `stuff_lot_as_operario`;
5. `unstuff_lot_as_operario`.

No reabre comentarios ni SDD-0168.

## Decisión

Las funciones legacy ya escriben negocio y evento en una transacción. Un
trigger puente, limitado a actor `operario`, entidades logísticas y eventos
allowlisted, intercepta el INSERT legacy y lo reemplaza por
`append_audit_event`. El INSERT original retorna cero filas y no se duplica.

Las cinco funciones conservan compatibilidad con referencias no cualificadas,
pero su `search_path` queda fijado a `pg_catalog, public`; no heredan el path de
la sesión. Esta decisión es una mejora de seguridad, pero permanece como no
conformidad frente al contrato estricto de `search_path` vacío.

El bridge elimina PII, nombres, códigos escaneados, notas y montos. Sólo retiene
UUIDs de relación, posiciones, contadores y flags operativos.

## Allowlist

- `supabase/migrations/0292_audit_d4_logistics_r3.sql`;
- `supabase/tests/0292_audit_d4_logistics_r3.test.sql`;
- este diseño, la spec, revisión, registro y línea base D4.

## Aceptación

Cinco `SECURITY DEFINER` con path fijo, un solo evento normalizado, cero
duplicado, payload vacío, campos permitidos y rollback contractual ante fallo
del writer. La equivalencia con los cinco cuerpos productivos completos debe
revalidarse en un slice separado antes de declarar conformidad total.
