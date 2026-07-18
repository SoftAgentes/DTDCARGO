# No-Olvidar — Crypto review brief (SDD-0025)

**For:** external reviewer with hands-on cryptography / secrets-management experience.
**Estimated effort:** ~4–8 h. **Language:** the code comments are in Spanish; this brief is in
English for the reviewer.

You are reviewing the cryptographic core of an **internal company password/secret manager**
("No-Olvidar") for a logistics company (DTD Cargo, ~5 admins). It is **custodial** (not
zero-knowledge) by explicit product decision: admins can help recover a user's access via an
M-of-N approval flow. It is used **only by internal employees**, single-tenant. If it is ever
opened to external tenants, a full redesign to zero-knowledge is planned (out of scope here).

**This review is a hard merge gate.** The code does not ship to production until you sign off.

---

## 1. What to review (the bundle)

Primary (the crypto that matters):

| File | ~LOC | What it does |
|---|---|---|
| `crypto.ts` | 354 | AEAD (XChaCha20-Poly1305), envelope encryption (KEK→DEK), Argon2id KDF for the master password, BIP39 recovery kit, constant-time compare |
| `key-manager.ts` | 236 | Reads the KEK from Supabase Vault (5-min cache), rotates it, re-wraps all item DEKs |
| `recovery.ts` | 328 | M-of-N admin recovery: request / approve / execute / reject |

Supporting context:

| File | ~LOC | What it does |
|---|---|---|
| `session.ts` | 164 | Unlock-session validity (30 min) + failed-attempt lockout |
| `audit.ts` | 268 | Append-only audit log (insert) + anomaly heuristics |
| `totp.ts` | 55 | 2FA TOTP (otplib) |

**SQL / RLS / GRANT is a PRIMARY review surface — not secondary.** An internal adversarial
review (2026-07-17) found the crypto core solid but surfaced four serious authz/RLS defects at
the DB boundary (privilege escalation, a mutable audit log, a confused-deputy RPC, a forged
recovery approval). They are fixed in `0252` below; we want you to confirm those fixes hold and
hunt for siblings.

| File | What it does |
|---|---|
| `migrations/0250_no_olvidar.sql` | Schema, per-user RLS, audit-log table, KEK-version RPCs |
| `migrations/0251_no_olvidar_hardening.sql` | 2 SECURITY DEFINER RPCs (atomic lockout counter; `vault.create_secret` wrapper) — additive over 0250 |
| `migrations/0252_no_olvidar_authz_hardening.sql` | **Authz hardening** — trigger-based immutable audit log, REVOKEs that close privilege escalation, RPC/insert lock-downs |

Run `scripts/no-olvidar-review-bundle.mjs` to collect these into one folder for offline reading.

---

## 2. Architecture in one screen

- **Symmetric AEAD:** XChaCha20-Poly1305 IETF (libsodium). 24-byte random nonce per message.
- **Envelope encryption:**
  - A **KEK** (Key Encryption Key, 32 bytes) lives in **Supabase Vault**, reachable only by the
    Postgres `service_role`. Never in env/repo/code.
  - Each item gets its own random **DEK** (32 bytes). The DEK encrypts the item payload. The DEK
    is then wrapped (encrypted) by the KEK and stored alongside the item (`dek_encrypted`,
    `dek_nonce`, `key_version`).
  - **KEK rotation** re-wraps the N DEKs (cheap), it does not re-encrypt the N payloads.
- **Master password (optional per user):** Argon2id derives a master key; from it we derive
  (via BLAKE2b / `crypto_kdf`) two independent subkeys — an **encryption key** and a **verifier**.
  Only the verifier is stored, so a DB leak of the verifier does not reveal the encryption key.
- **V1 encryption is server-side.** The KEK is server-only, so encryption/decryption happen on the
  server; plaintext travels browser→server over TLS. (A `types.ts` comment says "the client
  encrypts" — that describes the future zero-knowledge V2 and does **not** apply here.)
- **Recovery (custodial):** since item DEKs are wrapped by the KEK (server-held), NOT by the user's
  master password, resetting the master password fully restores access. `executeRecovery` only
  resets the master-password verifier/salt in V1.

---

## 3. Threat model (accepted risks — do NOT flag these as findings)

- **Colluding admins (all at once)** can, together, recover any user — inherent to custodial. Accepted.
- **Server (Vercel/Next) compromise** exposes the KEK while in memory. Accepted for internal use.
- **Malware on a user's machine** (keylogger) — not fully mitigable. Accepted.
- **Web screenshot blocking is impossible** — mitigations are best-effort + forensic watermark only.

We DO want the audit log to be tamper-evident (immutable) and the recovery flow to resist a
**single** malicious admin.

---

## 4. What we specifically want you to check

Correctness & misuse-resistance:

1. **AEAD usage** in `crypto.ts` — nonce generation (random 24-byte, never reused), that
   authentication is enforced (a wrong key / tampered ciphertext must throw, never return
   garbage), no plaintext leaks on error paths.
2. **Envelope integrity** — `wrapDek`/`unwrapDek` and `reEncryptAllItems` (`key-manager.ts`):
   does rotation preserve the DEK exactly? Any path where a DEK could be wrapped under the wrong
   KEK version, or an item left half-migrated?
3. **KDF & domain separation** — Argon2id params (`m=64MB, t=3`, libsodium fixes `p=1`) and the
   BLAKE2b subkey derivation: is the verifier truly independent from the encryption key? Are the
   params adequate for an offline-attack threat model on the verifier?
4. **Recovery flow** (`recovery.ts`) — can a **single** admin ever complete a recovery? Can an
   admin approve their own request? Is the approval count spoofable (duplicate approver, replay)?
   Is `executeRecovery` safe against double-execution / expired / not-yet-quorum states?
5. **Master-password verifier** — comparison is constant-time (`sodium.memcmp`); confirm no
   timing side channel and no early return on secret-dependent length.
6. **BIP39 recovery kit** — 256-bit entropy from libsodium's CSPRNG, hashed (not stored plaintext).
   Any weakness in `hashRecoveryKit`/`verifyRecoveryKit`?
7. **KEK handling** (`key-manager.ts`) — in-memory cache TTL, base64 decode of the Vault secret,
   the `vault.create_secret` path in `rotateKek`. Anything that could log/persist the KEK.
8. **Audit immutability** — `no_olvidar_access_log`. NOTE: RLS `USING(false)` alone does **not**
   bind `service_role` (it has `BYPASSRLS`, and it's the very role that writes the log). `0252`
   therefore adds a `BEFORE UPDATE/DELETE/TRUNCATE` trigger that raises, plus `REVOKE`s. Confirm
   the trigger genuinely blocks a `service_role` mutation and cannot be bypassed (e.g. `session_replication_role`, direct SQL, disabling the trigger).
9. **Privilege escalation on `no_olvidar_user_keys` (C2 fix)** — `0252` REVOKEs `UPDATE` from
   `authenticated` and drops the owner-update policy, rerouting legitimate writes to `service_role`
   in `actions.ts`. Confirm no residual column-level grant lets a user set `role='admin'`, reset
   `locked_until`, or forge `last_unlock_at` (2FA bypass) directly via PostgREST.
10. **Recovery insert / RPC lock-down (A1/A2 fixes)** — `0252` REVOKEs `EXECUTE` on
    `no_olvidar_rotate_kek` and `INSERT` on `no_olvidar_recovery_requests` from `authenticated`.
    Confirm a user cannot forge a `status='approved'` request or drive KEK rotation.

Please also flag any **dependency** concern (`libsodium-wrappers-sumo`, `bip39`, `otplib`).

---

## 5. Known deviations from the spec (already decided — validate, don't re-open)

1. **Argon2id via libsodium `crypto_pwhash`** instead of `node-argon2`. Single audited library,
   no native build. libsodium fixes **`p=1`** (spec asked `p=4`); with `m=64MB, t=3` we consider
   the strength equivalent. → *We want your opinion on the parameters, not on the library choice.*
2. **SUMO build required** — the standard libsodium-wrappers omits `crypto_pwhash`/`crypto_kdf`.
3. **`reject` audits as `action='recovery_approved'` with `metadata.rejected=true`** — the enum
   has no `recovery_rejected`; the request row's `status='rejected'` is the canonical record.
4. **Two SECURITY DEFINER RPCs in `migrations/0251_no_olvidar_hardening.sql`** (additive over 0250):
   - `no_olvidar_increment_failed_attempt` — atomic failed-attempt counter + lockout (replaces a
     read-then-write in TS). Please review the authz guard (`auth.uid()` owner-or-service_role)
     and the atomicity of the `UPDATE ... RETURNING`.
   - `no_olvidar_create_kek_secret` — wraps `vault.create_secret`, EXECUTE restricted to
     `service_role`. Please review that no user role can reach it and the input validation.

---

## 6. How to verify locally

```bash
pnpm install
node node_modules/vitest/vitest.mjs run tests/no-olvidar   # 41 tests, real libsodium
node scripts/verify.mjs                                     # full repo gate (lint+types+tests)
```

The crypto/TOTP tests use real libsodium (no mocks). Recovery/session tests use an in-memory
Supabase fake (`tests/no-olvidar/_fake-supabase.ts`) to exercise state transitions.

---

## 7. Deliverable we need back

A short report: (a) blocking findings that must be fixed before merge, (b) non-blocking
hardening suggestions, (c) explicit sign-off on the parameters in §4.3 and the recovery flow in
§4.4. Reference `file:line`. Thank you.
