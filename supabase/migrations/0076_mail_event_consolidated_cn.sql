-- ─────────────────────────────────────────────────────────────
-- SDD-0039 · Suma el evento de consolidado CN al enum de reglas de mail.
--
-- El evento `shipment_consolidated_cn` ya estaba en el tipo TS (mail-types.ts)
-- pero faltaba en el enum de la BD `mail_rule_event`, así que no se podía crear
-- una regla de mail para él (y fireMailEvent no encontraba nada).
--
-- ADD VALUE aislado: un valor de enum nuevo no se puede USAR en la misma
-- transacción que lo crea. Por eso va en su propia migración; el seed del
-- template + regla se hace en una operación posterior.
-- ─────────────────────────────────────────────────────────────

alter type public.mail_rule_event
  add value if not exists 'shipment_consolidated_cn';
