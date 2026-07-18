# SDD-0025 · No-Olvidar — Fase 2 (núcleo criptográfico)

> Rama `feat/no-olvidar`. **NO mergear a `main` sin el code review crypto externo**
> (spec §7.6). Este archivo es el handoff de esa Fase 2.

## Qué se construyó

Núcleo criptográfico server-side + tests. Nada de UI/actions/pages (Fase 3).

| Archivo | Rol |
|---|---|
| `lib/studio/no-olvidar/crypto.ts` | AEAD XChaCha20-Poly1305, envelope DEK, Argon2id (master pw), BIP39 recovery kit, comparación constante-en-tiempo |
| `lib/studio/no-olvidar/key-manager.ts` | KEK desde Supabase Vault (cache 5 min), rotación, `reEncryptAllItems` |
| `lib/studio/no-olvidar/audit.ts` | audit log append-only (insert service_role) + detección de anomalías §4.14 |
| `lib/studio/no-olvidar/recovery.ts` | recovery M-of-N (request/approve/execute/reject) |
| `lib/studio/no-olvidar/session.ts` | vigencia de unlock (30 min) + rate-limit de intentos |
| `lib/studio/no-olvidar/totp.ts` | 2FA TOTP (otplib v13). **Adición** al listado de 5 archivos de la spec |
| `app/studio/(app)/no-olvidar/actions.ts` | **Fase 3 backbone**: server actions que cablean crypto→DB (setup/unlock/create/reveal/edit/delete/recovery/rotateKek/config) |
| `tests/no-olvidar/*.test.ts` | 41 tests (crypto/totp con libsodium real; recovery/session con fake Supabase) |

Deps nuevas: `libsodium-wrappers-sumo`, `bip39`, `otplib`. `.env.example` → `NO_OLVIDAR_KEK_SECRET_NAME`.

## Bundle para el review externo (spec §7.6)

Enviar al revisor crypto: **`crypto.ts` + `key-manager.ts` + `recovery.ts`** (+ `session.ts`,
`audit.ts`, `totp.ts` como contexto) + migraciones `0251_no_olvidar.sql` · `0252_no_olvidar_hardening.sql` · `0253_no_olvidar_authz_hardening.sql`. Sin este review NO se mergea.

## Desviaciones vs spec (para que el revisor las valide)

1. **Argon2id vía libsodium `crypto_pwhash`**, no `node-argon2`. Motivo: una sola librería
   auditada (abarata review) + evita build nativo que rompe en Windows. **libsodium fija `p=1`**
   (la spec §4.4 pedía `p=4`); con `m=64MB, t=3` la fortaleza es equivalente y supera el mínimo OWASP.
2. **Build SUMO obligatorio** (`libsodium-wrappers-sumo`): el build estándar NO incluye
   `crypto_pwhash` ni `crypto_kdf`. No revertir a la variante estándar.
3. **Dominio-separación**: del masterKey Argon2id se derivan por `crypto_kdf` (BLAKE2b) dos
   subclaves independientes → el `verifier` almacenado NO revela la clave de cifrado.
4. **V1 es server-side encryption** (spec §4.3): el KEK vive en Vault (solo service_role), el
   plaintext viaja por TLS y se cifra en el server. El comentario "el cliente cifra" en
   `no-olvidar-types.ts` describe el modelo zero-knowledge **V2** — no aplica a V1.
5. **`executeRecovery` V1** solo resetea la master password (los DEK van envueltos por el KEK,
   no por la master pw → resetear restaura el acceso). El re-wrap de `private_key` (sharing V2)
   tiene guard explícito: lanza si algún día existe una private_key.
6. **`reject` audita con `action='recovery_approved'` + `metadata.rejected=true`** porque el enum
   no tiene `recovery_rejected`. El estado `rejected` del request es el registro canónico.

## Endurecimiento aplicado (migración 0224, Fase 2.1)

Aditiva sobre 0017. Resuelve las dos notas frágiles del código TS con RPCs SECURITY DEFINER
(search_path fijo, schema calificado, authz interna, EXECUTE al mínimo rol):

- **`no_olvidar_increment_failed_attempt`** — incremento ATÓMICO del contador de intentos +
  lockout. `session.incrementFailedAttempt` ahora llama al RPC (ya no read-then-write).
- **`no_olvidar_create_kek_secret`** — wrapper de `vault.create_secret` restringido a
  `service_role`; evita exponer el schema `vault` a PostgREST. Lo usa `key-manager.rotateKek`.

> `0224` NO está aplicada a prod (regla dura). La aplica el founder con su OK. Su corrección SQL
> se valida en el review + al aplicarla (dry-run en tx sobre prod, no branch efímero).

## Decisión de storage (Fase 3)

Los campos de material cifrado (`ciphertext`/`nonce`/`dek_*` de items, verifiers/salts/totp de
user_keys, verifiers de recovery) se guardan como **TEXT base64**, no `bytea`. Motivo: round-trip
limpio por PostgREST (bytea vuelve como hex `\x`, ambiguo y no testeable sin prod). Se editó `0017`
(sin aplicar) para cambiar esas columnas a `text`. `actions.ts` usa `toBase64`/`fromBase64` sin
lógica de encoding extra.

## Pendiente / notas para el revisor

- **actions.ts es wiring untested-until-deploy**: no corre hasta aplicar 0017+0224 y crear el KEK
  (runbook §1-2). La corrección del crypto la cubren los tests de lib + este review. Revisar el
  uso correcto de los dos clientes (SSR con RLS vs admin service_role solo para KEK/audit/recovery).
- **Sin migración aplicada a prod**: `0017`/`0224` sin aplicar (decisión founder). El crypto no
  corre en runtime hasta el schema + el KEK del setup post-deploy (§7.1).
- **Fase 3 UI pendiente**: pages (setup/2fa/recovery/admin) + components (RevealField, drawers).

## Verificación

`node scripts/verify.mjs` → TODO VERDE (lint 0 errores, typecheck, 3488 tests, rsc-boundary, docs).
Suite propia: `node node_modules/vitest/vitest.mjs run tests/no-olvidar` → 41/41.
