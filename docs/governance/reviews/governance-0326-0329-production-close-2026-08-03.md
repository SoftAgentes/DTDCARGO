# REV-SGE-054 — Cierre productivo nominal de 0326–0329

| Control | Valor |
|---|---|
| Fecha | 2026-08-03 |
| Proyecto | Supabase Producción `xpfuzqombmjmxvprjgmi` |
| Alcance | privacidad de tracking, ACL internas, asignación de camionero y perfiles por tenant |
| Rama de integración | `codex/governance-9-final-integration-20260803` |
| Resultado | cuatro gates nominales aplicados y verificados individualmente |

## Gates nominales

| Migración | SHA-256 del archivo | Ledger productivo | Resultado |
|---|---|---|---|
| `0326_public_tracking_privacy_throttle` | `5E420E8D99F2D0B63405BF31E7A27DCDC1A8B97AA54CFE6B318D75EC55968C26` | `20260803091250` | aplicada |
| `0327_internal_function_grants` | `51F1DB939E8B6A5BD81508D86AE8B293B78D3E45767AE7F37CE8C3BC8CAD8FDF` | `20260803091325` | aplicada |
| `0328_camionero_dispatch_assignment` | `45E20F1EF002AAAB114B3C162B7588F7B9F6BFB4CD31B549CDC6F07805396354` | `20260803091348` | aplicada |
| `0329_user_profiles_tenant_scope` | `3F5ECBEB3D2C912F8868D58349DAB066A4B71742F91CCBF234536B4FE0F8119D` | `20260803091410` | aplicada |

Cada migración se ejecutó con su basename exacto y en una operación separada.
No se aplicó un bundle ni se reutilizó la autorización nominal de una migración
para otra.

## Postflight

- 0326 eliminó el grant directo de inserción sobre `public_track_log`, conservó
  el RPC público necesario y dejó el origen hasheado, el throttle de 30 intentos
  y la respuesta minimizada sin notas ni identidad de firma.
- 0327 revocó `EXECUTE` de `anon` y `authenticated` sobre las tres funciones
  internas de triggers de recepción CN y consolidación; sus triggers permanecen
  operativos.
- 0328 dejó `camionero_advance_od` restringida al conductor asignado, tenant y
  región, sin ejecución directa para `anon` o `authenticated`; `service_role`
  conserva el contrato server-only.
- 0329 dejó una sola policy SELECT de `user_profiles`, exclusiva de
  `authenticated`, con perfil propio o membresía activa en tenant compartido.
- El gate del ledger terminó verde con 327 archivos y 344 entradas productivas;
  sólo conserva las excepciones históricas explícitas `0017_no_olvidar` y
  `0257_rates_expiry_alert`.

## Advisors

No aparecieron hallazgos nuevos sobre las funciones internas, el despacho de
camionero o `user_profiles`. Permanecen dos avisos intencionales en tracking:
`public_track_log` tiene RLS sin policy porque la escritura directa está
revocada, y el RPC público `SECURITY DEFINER` conserva ejecución pública porque
es el endpoint de tracking, ahora con validación, minimización y throttle.

Los avisos de rendimiento sobre tres índices sin uso son informativos y no
autorizan su retiro dentro de este slice.

## Fronteras

Este recibo acredita esquema y metadatos productivos. No acredita por sí solo
el despliegue de la aplicación, el E2E Tier-3 de Nómina ni la integración a
`main`; esos gates se cierran y registran por separado.
