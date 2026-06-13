# Runbook — Deploy + validación E2E de `kommo-push-client` (SDD-0074)

> Cómo poner en producción el push del alta a Kommo **sin ensuciar tu Kommo real**: se valida
> primero en **dry-run** (lee y arma lo que crearía, pero NO escribe), y recién después se prende.
> Lo ejecuta la **ventana de coordinación / el founder** (toca prod). La ventana de desarrollo NO
> deploya ni escribe en prod.

## Qué es esto

Cuando un cliente se da de alta en `/registro`, el alta invoca la Edge Function `kommo-push-client`
(best-effort) para crear el cliente en Kommo como **lead + contacto**. La función:
1. abre el token de Kommo en Vault (solo ella puede),
2. busca si ya existe un contacto con ese teléfono/email (dedup),
3. crea (o reusa) el contacto y crea el lead, etiquetado con MARKBOX/RIF/nivel,
4. enlaza `clients.kommo_lead_id` y espeja el lead en `kommo_leads`.

**Gate de seguridad:** la función **nace en dry-run** (no escribe). Solo escribe de verdad cuando se
setea el secreto `KOMMO_PUSH_DRY_RUN="false"`.

## Prerrequisitos

- `kommo_connections` del tenant DTD en estado `active` con el token vivo en Vault.
  - ✅ **Ya debería estar:** es la MISMA conexión + token que usa `kommo-sync` (el pull nocturno).
    Si el sync nocturno funciona, esto está OK. Verificar en `/studio/kommo` o `sync_logs`.
- Rama `feat/onboarding-erp` mergeada (o su preview) desplegada en Vercel — para que `/registro`
  invoque la función. *(El push/merge lo hace coordención con OK del founder.)*

## Paso 1 — Deploy de la función (NACE EN DRY-RUN, no escribe)

Desde la cuenta con acceso a Supabase (MCP `deploy_edge_function` o `supabase functions deploy`):

- Función: `kommo-push-client` · carpeta `supabase/functions/kommo-push-client/`.
- `verify_jwt = OFF` (igual que `kommo-sync` y `kommo-webhook`; la auth la hace la propia función
  exigiendo el service key del proyecto).
- **No** setees `KOMMO_PUSH_DRY_RUN` todavía → queda en dry-run (seguro).

URL resultante: `https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-push-client`

## Paso 2 — Validar en DRY-RUN (cero escritura en Kommo)

Objetivo: confirmar que la función entra a Kommo, **dedupea bien** y **arma el payload correcto**,
sin crear nada. Dos formas:

- **A (recomendada) — alta de prueba real:** registrá un cliente de prueba en `/registro`. El alta
  invoca la función en dry-run. Revisá:
  - **Logs de la función** en Supabase → línea `[kommo-push-client][dry-run] would create {...}` con
    el contacto y el lead que crearía.
  - `sync_logs` con `entity = 'push_client_dryrun'`, `status = 'ok'`.
- **B — invocación directa** (con un `client_id` existente):
  ```bash
  curl -X POST https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-push-client \
    -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"tenant_id":"<TENANT_ID>","client_id":"<CLIENT_ID>","dry_run":true}'
  ```
  La respuesta trae `{ dry_run:true, mode, would:{ contact, lead } }`.

**Qué chequear en el `would`:**
- Si el teléfono/email del cliente ya estaba en Kommo → `mode: "would-link-existing-contact"`
  (no duplica). Si no → `would-create-contact`.
- El `lead.custom_fields_values` trae markbox/RIF/nivel **solo si esos custom fields existen** en la
  cuenta de Kommo. Si falta alguno (p.ej. no hay campo "Shipping Mark"/"RIF"/"Nivel"), o lo creás en
  Kommo, o se queda sin esa etiqueta (el MARKBOX igual va en el **nombre del lead**: `Nombre · DTD-NNNN`).
- Confirmá el `enum_code` de teléfono/email (`WORK`): si tu cuenta usa otro código por defecto, avisá
  para ajustarlo (es 1 línea en `_shared/kommo-outbound.ts`).

## Paso 3 — Prender la escritura real

Setear el secreto de la función:
```
KOMMO_PUSH_DRY_RUN = false
```
(MCP / dashboard / `supabase secrets set`). Re-deploy si la plataforma lo pide.

## Paso 4 — E2E real con contacto de PRUEBA (+ cleanup)

- Registrá **un** cliente de prueba claramente marcado (ej. nombre `PRUEBA DTD-0074`, con un teléfono/
  email que controles).
- Confirmá:
  - aparece el **lead en Kommo** (`Nombre · DTD-NNNN`) con su contacto, **sin duplicar**;
  - `clients.kommo_lead_id` quedó seteado + hay fila en `kommo_leads`;
  - `sync_logs` `entity='push_client'`, `status='ok'`.
- **Cleanup:** archivá/borrá el lead + contacto de prueba en Kommo; soft-delete del cliente de prueba
  en el ERP (`deleted_at`). *(Es un dato real en tu CRM — no lo dejes.)*

## Rollback

Volvé a dry-run en cualquier momento: `KOMMO_PUSH_DRY_RUN = true` (la función deja de escribir; el
alta sigue funcionando, solo no empuja). El push es best-effort: un fallo NUNCA rompe el registro.

## Notas

- **Observabilidad:** `sync_logs` (`push_client` real · `push_client_dryrun` ensayo) + logs de la
  función. Visible desde `/studio` si se quiere un panel.
- **Idempotencia:** si el cliente ya tiene `kommo_lead_id`, la función hace PATCH (no recrea).
- **No hay migración** en SDD-0074. El token nunca sale de la Edge Function (modelo SDD-0043).
- **Futuro (SDD-0062 Slice A):** cuando se construya el write-back con outbox + retry, este push
  puede migrar a encolar en el outbox; el helper `kommoWrite` ya queda compartido.
