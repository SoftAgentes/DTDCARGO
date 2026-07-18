---
sdd: "0025"
title: "DoorTuDoor — No-Olvidar interno DTD-CARGO · envelope encryption + admin recovery"
status: in-progress
author: "founder"
created: 2026-05-24
updated: 2026-07-17
supersedes: null
superseded_by: null
related: ["0007"]
confidencialidad: interno
---

# DTD-0025 — No-Olvidar interno DTD-CARGO · envelope encryption + admin recovery

> **Caja fuerte interna para DTD-CARGO.** Gestor de contraseñas y secretos
> empresariales (redes sociales, accesos a plataformas de proveedores, API keys
> internas) para uso EXCLUSIVO de los empleados de DTD-CARGO. No es feature para
> tenants externos — el scope cerrado permite arquitectura custodial con
> emergency recovery administrativa en lugar de zero-knowledge puro.
> Reemplaza el placeholder `EmptyState` actual de `/studio/no-olvidar`.

---

## 1. Resumen en una línea

`/studio/no-olvidar` permite a los empleados de DTD-CARGO guardar contraseñas y
secretos cifrados con **envelope encryption** (KEK maestra en Supabase Vault +
DEK por item con `libsodium` XChaCha20-Poly1305), gateaway por 2FA TOTP
obligatorio, con audit log append-only y **emergency recovery M-of-N** cuando
un user pierde el acceso.

---

## 2. Scope

### Incluye

#### Schema (migración 0013)

- 6 enums:
  - `no_olvidar_category`: `login` / `note` / `card` / `totp`
  - `no_olvidar_audit_action`: `view` / `copy` / `edit` / `create` / `delete` / `unlock` / `recovery_requested` / `recovery_approved` / `recovery_executed` / `kek_rotated`
  - `no_olvidar_recovery_status`: `pending` / `approved` / `rejected` / `expired` / `completed`
  - `no_olvidar_user_role`: `member` / `admin` (admin = puede aprobar recoveries y rotar KEK)
  - `no_olvidar_kek_status`: `active` / `legacy` / `revoked`
  - `no_olvidar_alert_severity`: `info` / `warning` / `critical`

- 6 tablas:
  - **`no_olvidar_items`** (RLS por user_id, owner puede SELECT/UPDATE/DELETE soft):
    id uuid PK, user_id uuid FK auth.users (owner), name text NOT NULL,
    category no_olvidar_category NOT NULL, url text nullable,
    username text nullable (NO encriptado para enable search),
    ciphertext bytea NOT NULL (payload sensible cifrado),
    nonce bytea NOT NULL (24 bytes XChaCha20),
    dek_encrypted bytea NOT NULL (DEK envuelto con KEK),
    dek_nonce bytea NOT NULL,
    key_version int NOT NULL (versión de KEK usada),
    notes_preview text nullable (primeros 60 chars en plaintext para preview),
    favorite bool default false, created_at, updated_at, deleted_at

  - **`no_olvidar_user_keys`** (1 row por user, RLS estricta):
    user_id uuid PK FK auth.users,
    has_master_password bool default false,
    master_password_verifier bytea nullable (Argon2id hash, validar al unlock),
    master_password_salt bytea nullable (32 bytes random),
    public_key bytea nullable (Curve25519, reservado para sharing futuro),
    private_key_ciphertext bytea nullable (private key cifrada con master_password o KEK),
    private_key_nonce bytea nullable,
    recovery_kit_hash bytea nullable (Argon2id hash del recovery kit impreso),
    recovery_kit_salt bytea nullable,
    totp_secret_ciphertext bytea NOT NULL (TOTP secret cifrado con KEK),
    totp_secret_nonce bytea NOT NULL,
    totp_enabled bool default false,
    setup_completed bool default false,
    role no_olvidar_user_role default 'member',
    last_unlock_at timestamptz,
    failed_unlock_attempts int default 0,
    locked_until timestamptz nullable (rate limit anti brute-force),
    created_at, updated_at

  - **`no_olvidar_access_log`** (APPEND-ONLY, RLS bloquea UPDATE+DELETE para todos
    incluyendo service_role):
    id uuid PK, user_id uuid FK NOT NULL, item_id uuid FK nullable
    (nullable porque algunas actions como unlock no apuntan a item),
    action no_olvidar_audit_action NOT NULL,
    ip_address inet, user_agent text,
    metadata jsonb default '{}' (contexto extra: recovery_id, key_version, etc.),
    created_at timestamptz default now() NOT NULL

  - **`no_olvidar_recovery_requests`**:
    id uuid PK, requester_user_id uuid FK,
    reason text NOT NULL (motivo escrito por el user),
    status no_olvidar_recovery_status default 'pending',
    approvals jsonb default '[]' (array de `{approver_id, approved_at, ip}`),
    approvals_required int default 2 (M de M-of-N, leído de no_olvidar_config al crear),
    new_master_password_verifier bytea nullable (set al execute),
    new_master_password_salt bytea nullable,
    expires_at timestamptz NOT NULL (24h desde creación),
    completed_at timestamptz nullable, created_at, updated_at

  - **`no_olvidar_kek_versions`** (registro auditado de rotaciones de KEK):
    version int PK, kek_secret_name text NOT NULL (referencia a Supabase Vault),
    status no_olvidar_kek_status default 'active',
    activated_at timestamptz default now(),
    deprecated_at timestamptz nullable, created_by uuid,
    notes text

  - **`no_olvidar_config`** (1 row global, RLS solo lectura para members,
    update para admins):
    id int PK default 1 CHECK (id = 1),
    recovery_approvals_required int default 2,
    session_timeout_minutes int default 30,
    failed_attempts_lockout int default 5,
    lockout_minutes int default 15,
    require_2fa bool default true,
    clipboard_clear_seconds int default 30,
    reveal_auto_hide_seconds int default 3,
    hold_to_reveal bool default true,
    blur_on_window_blur bool default true,
    forensic_watermark bool default true,
    block_copy_event bool default true,
    char_by_char_reveal bool default false,
    updated_at, updated_by uuid

- RPCs (3):
  - `no_olvidar_get_active_kek_version()` → int (caché de 5 min)
  - `no_olvidar_rotate_kek(p_new_secret_name text, p_actor uuid)` → bool (transaction
    que marca versión actual como legacy y crea nueva activa)
  - `no_olvidar_check_admin(p_user_id uuid)` → bool (helper para RLS de recovery)

- RLS policies (críticas, listadas explícitas):
  - `no_olvidar_items`: `SELECT/UPDATE/DELETE` solo si `user_id = auth.uid()`. `INSERT` si `user_id = auth.uid()` y user_keys.setup_completed = true.
  - `no_olvidar_user_keys`: `SELECT/UPDATE` solo si `user_id = auth.uid()` (no INSERT/DELETE desde cliente, solo desde trigger de signup)
  - `no_olvidar_access_log`: `SELECT` solo si `user_id = auth.uid()` (members) OR `no_olvidar_check_admin(auth.uid())` (admins ven todo). `INSERT` permitido a service_role solamente. **`UPDATE` y `DELETE` bloqueados para todos** (incluido service_role) via policy `FOR UPDATE USING (false)` + `FOR DELETE USING (false)`.
  - `no_olvidar_recovery_requests`: `SELECT` para requester o cualquier admin. `INSERT` para cualquier user autenticado. `UPDATE` solo admins via RPC (no directo). `DELETE` bloqueado.
  - `no_olvidar_kek_versions`: `SELECT` para admins. `INSERT/UPDATE` solo via RPC `no_olvidar_rotate_kek`.
  - `no_olvidar_config`: `SELECT` todos los users autenticados. `UPDATE` solo admins.

- Trigger:
  - `no_olvidar_user_keys` auto-creación: cuando se inserta nuevo row en `auth.users` con metadata `tenant = 'dtd-cargo'`, crear row en `no_olvidar_user_keys` con `setup_completed = false`.

- Seed inicial: NO seed de items (cada user los crea). SÍ seed de `no_olvidar_config` con defaults. KEK NO se siembra en migración — se crea manualmente post-deploy (ver sección 7).

#### Lib crypto (`lib/studio/no-olvidar/`)

- `crypto.ts` — wrappers `libsodium-wrappers` (NO `crypto-js`, NO bcrypt, NO Web Crypto V1):
  - `encryptPayload(plaintext: string, key: Uint8Array): { ciphertext, nonce }` — XChaCha20-Poly1305 secret box
  - `decryptPayload(ciphertext, nonce, key): string`
  - `generateDek(): Uint8Array` — 32 bytes random
  - `wrapDek(dek: Uint8Array, kek: Uint8Array): { wrapped, nonce }`
  - `unwrapDek(wrapped, nonce, kek): Uint8Array`
  - `deriveKeyFromMasterPassword(password: string, salt: Uint8Array): Promise<Uint8Array>` — Argon2id m=64MB, t=3, p=4 (OWASP)
  - `generateRecoveryKit(): string` — 24 palabras BIP39 (entropía 256 bits)
  - `hashForVerifier(password, salt): Promise<Uint8Array>` — Argon2id, params idénticos a derivación pero output como "verifier" (no usado como key)
  - `constantTimeEqual(a, b): boolean`

- `key-manager.ts`:
  - `getActiveKek(supabase): Promise<{ version, key }>` — fetch KEK desde Supabase Vault via RPC `vault.decrypted_secrets`, cache in-memory 5 min con TTL
  - `getKekByVersion(supabase, version): Promise<Uint8Array>` — para descifrar items legacy post-rotación
  - `rotateKek(supabase, actor): Promise<{ oldVersion, newVersion }>` — crea nuevo secret en Supabase Vault + llama RPC `no_olvidar_rotate_kek`
  - `reEncryptAllItems(supabase, fromVersion, toVersion, actor): Promise<count>` — batch que toma todos los items con `key_version=fromVersion`, desencripta DEK, re-envuelve con nueva KEK, update. Idempotente.

- `audit.ts`:
  - `logAccess(supabase, params: { userId, itemId?, action, ip?, ua?, metadata? })` — INSERT en no_olvidar_access_log (con service_role para garantizar siempre se loggea)
  - `getAccessLog(supabase, filters)` — query con paginación
  - `getAnomalies(supabase, window): Promise<Anomaly[]>` — heurísticas: ≥5 views en 1 min, accesos fuera de 06:00-23:00 VET, IP nueva (no vista en últimos 30d)

- `recovery.ts`:
  - `requestRecovery(supabase, userId, reason): Promise<RecoveryRequest>`
  - `approveRecovery(supabase, recoveryId, approverId): Promise<RecoveryRequest>` (idempotent, valida approver es admin y NO es el requester)
  - `executeRecovery(supabase, recoveryId, newPassword): Promise<void>` — solo si `approvals.length >= approvals_required`. Re-envuelve la private_key del user con la nueva password.
  - `rejectRecovery(supabase, recoveryId, adminId, reason)`

- `session.ts`:
  - `validateUnlockSession(supabase, userId): Promise<{ unlocked: boolean, expiresAt }>` — chequea `last_unlock_at` vs `no_olvidar_config.session_timeout_minutes`
  - `markUnlocked(supabase, userId): Promise<void>` — actualiza `last_unlock_at`
  - `incrementFailedAttempt(supabase, userId): Promise<{ locked: boolean, until }>` — si llega al threshold, setea `locked_until = now() + lockout_minutes`

#### Lib types + queries

- `lib/studio/no-olvidar-types.ts`:
  - Types de las 6 entidades + DecryptedItem (= Item + plaintext)
  - Enums + LABELS + TONES (`categoryLabel`, `categoryIcon`, `categoryBadgeTone`, `actionLabel`, `roleLabel`)
  - Validators sin Zod: `validateCreateItemInput`, `validateUpdateItemInput`, `validateMasterPasswordInput` (mínimo 12 chars, complejidad razonable), `validateRecoveryRequestInput`
  - Helpers: `formatLastAccess`, `isSessionExpired`, `categoryDefaultFields`

- `lib/studio/no-olvidar-queries.ts`:
  - `listItems(supabase, filters?)` — RLS aplica user_id automáticamente; filtros por category, search en name/url/username (NO en ciphertext)
  - `getItem(supabase, id)`
  - `getUserKeys(supabase, userId)`
  - `getRecoveryRequests(supabase, filters?)` — admin ve todas, user ve las propias
  - `getKekVersions(supabase)` — solo admin
  - `computeNoOlvidarKpis(supabase)` — total_items, items_30d, recovery_pending, alerts_24h

#### Pages (`app/studio/(app)/no-olvidar/`)

- `page.tsx` — **REFACTOR del placeholder**: si `setup_completed = false` → redirect a `/no-olvidar/setup`. Si sesión no unlocked → redirect a `/no-olvidar/2fa`. Si todo OK → renderiza NoOlvidarClient con lista de items + KPIs + tab "Audit" + tab "Recovery" (admin only).
- `no-olvidar/setup/page.tsx` — wizard primer uso: paso 1 (intro + términos), paso 2 (set master password opcional + recovery kit auto-generado para imprimir), paso 3 (setup TOTP con QR), paso 4 (confirm done → `setup_completed = true`).
- `no-olvidar/2fa/page.tsx` — gate de TOTP. Input código 6 dígitos + (opcional) master password si configurado. Submit → si OK → marca `last_unlock_at = now()` y redirect a `?next=` o `/no-olvidar`.
- `no-olvidar/recovery/page.tsx` — flow recovery: user que perdió acceso pide reset (form con reason + email confirmation). Admin ve queue de pending requests.
- `no-olvidar/admin/page.tsx` — admin only: lista KEK versions, botón rotar KEK, queue recoveries, config (M-of-N number, session timeout, etc.), audit log global.

#### Components (`app/studio/(app)/no-olvidar/_components/`)

- `NoOlvidarClient.tsx` — orquestador con session timeout watchdog (cada 60s chequea `validateUnlockSession`; si expira → redirect 2FA)
- `NoOlvidarKpis.tsx` (server) — 4 KPI cards (Total items / Items últimos 30d / Recovery pending / Alertas 24h)
- `ItemList.tsx` — grid de cards con search + filter por category + favoritos arriba
- `ItemCard.tsx` — preview con icon categoría + name + url + username (NO password)
- `ItemDrawer.tsx` — drawer detalle: click-to-reveal con auto-hide 10s, copy con auto-clear clipboard 30s, edit, share (V2 disabled), audit local del item
- `AddItemDrawer.tsx` — form crear (form dinámico según categoría — login pide username/password/url, totp pide secret + label, card pide número/cvc/expiry)
- `RevealField.tsx` (client) — el campo más sensible. Mantiene plaintext SOLO en `useState` local, nunca en URL/storage. Implementa **mitigaciones anti-screenshot best-effort** (ver §4.16): hold-to-reveal (`onMouseDown`/`onMouseUp`), auto-hide 3s, blur on window blur (`window.addEventListener('blur')`), overlay forense con email+IP+timestamp via `<ForensicWatermark />`, bloqueo `onCopy`/`onContextMenu` cuando está revealed, opcional char-by-char hover. Copy via `navigator.clipboard.writeText` + `setTimeout` para auto-clear.
- `ForensicWatermark.tsx` (client) — overlay semi-transparente diagonal con `email + IP + timestamp` superpuesto al password revealed. Renderiza sobre el contenido sensible con `position: absolute, pointer-events: none, opacity: 0.12, transform: rotate(-30deg), font-size: 11px`, repetido en grid para cubrir toda el área. Si el password queda en un screenshot, la marca permite forensics (rastrear quién capturó).
- `AuditTab.tsx` — tabla del access log del user (admin ve global con filtro)
- `RecoveryRequestForm.tsx` — para users que perdieron acceso
- `RecoveryQueue.tsx` (admin) — lista pending + botón aprobar/rechazar
- `SetupWizard.tsx` — multi-step del primer uso
- `MasterPasswordPrompt.tsx` — modal del 2FA gate
- `CategoryBadge.tsx`, `ActionBadge.tsx`
- `AlertsBanner.tsx` — banner top si hay anomalías recientes (visible a admins)

#### Server actions (`no-olvidar/actions.ts`)

- `setupNoOlvidarAction(prev, formData)` — completa wizard, genera recovery kit, configura TOTP
- `unlockNoOlvidarAction(prev, formData)` — verifica TOTP + master password (si aplica), marca unlocked, devuelve session expiry
- `createItemAction(prev, formData)` — encripta + insert + audit log
- `updateItemAction(prev, formData)` — re-encripta + update + audit
- `softDeleteItemAction(itemId)`
- `revealItemAction(itemId)` — desencripta + audit log con action='view' + devuelve plaintext (SIN cachear nada server-side)
- `copyItemFieldAction(itemId, field)` — audit log action='copy' (el copy real lo hace cliente con `navigator.clipboard`)
- `requestRecoveryAction(prev, formData)` — solo si No-Olvidar locked o user no logueado vía endpoint público con captcha (V1 sin captcha)
- `approveRecoveryAction(recoveryId)` — admin only
- `executeRecoveryAction(prev, formData)` — el user setea nueva master password después de M aprobaciones
- `rotateKekAction()` — admin only, dispara `rotateKek` + `reEncryptAllItems`
- `updateNoOlvidarConfigAction(prev, formData)` — admin only

#### Endpoint público (sin auth, rate-limited)

- `app/api/studio/no-olvidar/recovery/route.ts` — POST recovery request. Validación: email del user + razón + rate limit por IP. Crea request pending + notifica admins por Slack/email.

#### Sidebar
- **Sin cambios**. "No-Olvidar" ya existe en `StudioSidebar.tsx:56`. Active state automático.

#### Env y deps
- `package.json` agregar:
  - `libsodium-wrappers` (^0.7.x)
  - `otplib` (^12.x) para TOTP
  - `qrcode` (^1.5.x) para generar QR del TOTP secret
- `.env.example` agregar `NO_OLVIDAR_KEK_SECRET_NAME=no_olvidar_kek_v1` (referencia al secret en Supabase Vault, no la KEK en sí)
- NO agregar la KEK al .env. La KEK vive SOLO en Supabase Vault.

### NO incluye (diferidos)

- **Sharing de items entre users** del Studio DTD-CARGO → V2 (requiere sharing con Curve25519 + tabla `no_olvidar_shared_items`). V1 cada user tiene sus items propios; si necesita compartir, lo hace por afuera o usa recovery admin.
- **Browser extension** para autofill → backlog largo
- **Mobile app** → backlog largo
- **File attachments** (PDFs, certificados, llaves SSH binarias) → V1.5
- **Categorías adicionales** (ssh_key, api_key, identity, server) → V1.5
- **Import desde 1Password / Bitwarden / CSV** → V1.5 cuando se valide el caso de uso
- **Export del No-Olvidar** (backup user) → V1.5 con caveats de seguridad (export en JSON cifrado con master password)
- **Sync con manager externo** → no roadmap
- **Apertura a tenants externos** → cambia toda la arquitectura, vuelve a Opción A zero-knowledge del análisis previo. Si llega esa decisión, SDD nuevo con refactor grande.
- **Hardware security key** (FIDO2 / WebAuthn) en lugar de TOTP → V2
- **Captcha en endpoint público de recovery** → V1.5 cuando aparezca abuso
- **Notificación email/Slack a admins de recovery requests** → V1 solo notifica via UI (admin debe entrar a `/no-olvidar/admin`). V2 integrar con Slack webhook.
- **Multi-tenant del No-Olvidar** (otros tenants distintos a DTD-CARGO) → fuera de scope por decisión explícita del founder
- **Backup automático de la KEK** en S3 cifrado → V1 backup manual offline (USB físicos founder + socio). V2 considerar S3 con KMS distinto.
- **2FA via SMS / email** → NO. TOTP only (más seguro).
- **Botón "Master password" obligatorio** → V1 master password es OPCIONAL pero recomendado para admins. Si no se configura, items se desencriptan solo con KEK y el admin recovery es trivial (no necesita resetear password). Si se configura, hay capa extra y recovery resetea password.
- **Anti-phishing** con verificación de URL del Studio → backlog

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0025-no-olvidar/spec.md
supabase/migrations/0017_no_olvidar.sql
lib/studio/no-olvidar-types.ts
lib/studio/no-olvidar-queries.ts
lib/studio/no-olvidar/
├── crypto.ts
├── key-manager.ts
├── audit.ts
├── recovery.ts
└── session.ts
app/api/studio/no-olvidar/recovery/route.ts
app/studio/(app)/no-olvidar/
├── actions.ts
├── setup/page.tsx
├── 2fa/page.tsx
├── recovery/page.tsx
├── admin/page.tsx
└── _components/
    ├── NoOlvidarClient.tsx
    ├── NoOlvidarKpis.tsx
    ├── ItemList.tsx
    ├── ItemCard.tsx
    ├── ItemDrawer.tsx
    ├── AddItemDrawer.tsx
    ├── RevealField.tsx
    ├── ForensicWatermark.tsx
    ├── AuditTab.tsx
    ├── RecoveryRequestForm.tsx
    ├── RecoveryQueue.tsx
    ├── SetupWizard.tsx
    ├── MasterPasswordPrompt.tsx
    ├── CategoryBadge.tsx
    ├── ActionBadge.tsx
    └── AlertsBanner.tsx
tests/no-olvidar/crypto.test.ts
tests/no-olvidar/recovery.test.ts
tests/no-olvidar/session.test.ts
tests/e2e/no-olvidar.spec.ts
docs/no-olvidar/threat-model.md
docs/no-olvidar/runbook.md
docs/no-olvidar/recovery-procedure.md
docs/no-olvidar/admin-handbook.md
```

### Editados

```
app/studio/(app)/no-olvidar/page.tsx                # EmptyState → NoOlvidarClient real
.env.example                                    # NO_OLVIDAR_KEK_SECRET_NAME
package.json                                    # add libsodium-wrappers, otplib, qrcode
```

---

## 4. Decisiones de diseño

### 4.1 Custodial (no zero-knowledge) — admin recovery posible

**Por qué:** decisión explícita del founder (sesión 2026-05-24). No-Olvidar es para
uso interno de empleados DTD-CARGO, no para tenants externos. Zero-knowledge
puro implica que pérdida de master password = pérdida total, lo cual no
encaja con responsabilidad operativa de una empresa que paga el sueldo.

Trade-off aceptado: si TODOS los admins se confabulan, pueden ver todo. Para
DTD chica (~5 admins potenciales, todos conocidos), es riesgo controlable
operacionalmente. Si en el futuro el No-Olvidar se abre a tenants externos,
**SDD nuevo con refactor a zero-knowledge** (no se reusa este).

### 4.2 Envelope Encryption (KEK + DEK)

**Por qué:** una sola key encriptando millones de items implica re-encriptar
millones para rotar. Con envelope:
- KEK rota = solo se re-encriptan N DEKs (1 por item, cantidad chica)
- Cada item tiene DEK distinto → compromiso de 1 DEK no compromete los otros
- Estándar industria (AWS KMS, GCP KMS, 1Password, Bitwarden, todos usan envelope)

KEK guardada en **Supabase Vault** (extensión `vault`), accedida via
`vault.decrypted_secrets` solo con `service_role`. NUNCA en código, .env o repo.

### 4.3 `libsodium-wrappers` — no Web Crypto V1, no `crypto-js`

**Por qué:**
- **`libsodium`** (NaCl) es el lib criptográfico de referencia, auditado,
  battle-tested. XChaCha20-Poly1305 vs AES-256-GCM: ambos seguros, libsodium
  XChaCha20 tiene nonce de 192 bits (sin riesgo de colisión nunca) vs AES-GCM
  96 bits (debés cuidar de no reusar nonces).
- **Web Crypto API** está en browsers pero requiere navegar `crypto.subtle`
  con `async/await` denso y manejo manual de import/export de keys.
  V1 server-side con libsodium es más simple. V2 si vamos a client-side
  encryption (zero-knowledge), migrar a Web Crypto.
- **`crypto-js`** está deprecado, NO usar.
- **`bcrypt`** sirve para password hashing (auth), no para encripción simétrica.

### 4.4 Argon2id para master password (no PBKDF2, no bcrypt)

**Por qué:** OWASP recomienda Argon2id desde 2023. Resistente a GPU y ASIC.
Params V1: m=64MB, t=3, p=4 (recomendación Bitwarden 2026).

Implementación: `argon2-browser` si queremos cliente futuro, `node-argon2`
server-side V1. Decisión: V1 server-side, migrar a client-side cuando se
abra opción zero-knowledge.

### 4.5 2FA TOTP obligatorio (no SMS, no email)

**Por qué:** SMS es interceptable (SIM swap). Email es phisheable. TOTP local
(Google Authenticator, Authy, 1Password) es estándar.

Setup: durante el wizard primer uso, generar secret de 160 bits, mostrar QR
con `qrcode` library, user lo escanea, verifica 1 código antes de marcar
`totp_enabled = true`. Secret guardado cifrado con KEK (no plaintext).

Anti rate-limit: `failed_unlock_attempts` cuenta intentos; ≥5 en 15 min →
`locked_until = now() + 15m` y bloqueo total (incluso TOTP correcto rechaza).

### 4.6 M-of-N admin recovery — default 2-of-N

**Por qué:** un solo admin malicioso no debe poder hacer recovery a otro user
(violación de privacidad + opportunity for abuse). Requerir 2 firmas baja
significativamente la probabilidad de mal uso.

Implementación: `no_olvidar_recovery_requests.approvals_required = no_olvidar_config.recovery_approvals_required`
(configurable, default 2). Un admin NO puede aprobar su propio request (validación
en RPC). Cada approval queda en `approvals jsonb` array con `{approver_id,
approved_at, ip}`.

Cuando `approvals.length >= approvals_required`, el user solicitante puede
ejecutar el flow `executeRecovery` con su nueva master password — el server
re-envuelve la private_key del user con la nueva derivación.

Si user NO había configurado master password (modo simple), recovery es
trivial: solo "permitir al user volver a entrar" — el admin no necesita
hacer nada con keys.

### 4.7 Audit log immutable (RLS bloquea UPDATE/DELETE incluso a service_role)

**Por qué:** un atacante (o admin malicioso) que pueda borrar el audit log
puede ocultar su rastro. Audit log que NO es inmutable es seguridad teatral.

Implementación: policies explícitas
```sql
CREATE POLICY no_olvidar_audit_no_update ON no_olvidar_access_log
  FOR UPDATE TO public USING (false);
CREATE POLICY no_olvidar_audit_no_delete ON no_olvidar_access_log
  FOR DELETE TO public USING (false);
```

Estas policies aplican incluso a service_role. Si en el futuro hay necesidad
operativa de purgar histórico muy viejo, hacer via SQL administrativo con
trail en otro log (ej. anotación en `no_olvidar_kek_versions.notes` o tabla nueva).

### 4.8 RLS estricta por user (no solo tenant)

**Por qué:** dentro de DTD-CARGO (un solo tenant), un user no debe ver items
de OTRO user salvo recovery aprobado. RLS por `user_id = auth.uid()` directo,
NO por `tenant_id`.

Trade-off: admin haciendo "ver como user" durante recovery requiere policy
adicional condicional. V1: no implementamos "ver como" — el recovery genera
una nueva master password y el user vuelve a entrar. El admin nunca ve los
items, solo facilita el reset.

### 4.9 Click-to-reveal + auto-hide + clipboard auto-clear

**Por qué:** patrón industria. Si el password queda visible en pantalla,
shoulder-surfing es trivial. Si queda en clipboard indefinidamente, otra
app puede leerlo.

Implementación:
- Click "Mostrar" → desencripta (action='view' loggeado) → muestra 10s →
  re-oculta con efecto. Configurable en `no_olvidar_config.reveal_auto_hide_seconds`.
- Click "Copiar" → `navigator.clipboard.writeText(plaintext)` + setTimeout
  `navigator.clipboard.writeText('')` a los 30s. Configurable.
- Botón "Copiar password" loggea `action='copy'` en audit (no el contenido).

### 4.10 KEK rotation flow

**Por qué:** crypto hygiene. Rotar KEK cada 12 meses o ante sospecha de
compromiso es buena práctica.

Flow:
1. Admin va a `/no-olvidar/admin` → botón "Rotar KEK"
2. UI confirma (operación cara, requiere lock del No-Olvidar para todos durante
   re-encrypt)
3. `rotateKekAction()` server:
   a. Genera nueva KEK (32 bytes random)
   b. `vault.create_secret('no_olvidar_kek_v2', new_kek)` en Supabase Vault
   c. RPC `no_olvidar_rotate_kek('no_olvidar_kek_v2', actor)` marca v1 como legacy + v2 como activa
   d. Background job (server action que devuelve progreso): `reEncryptAllItems(v1, v2)` — itera todos los items con `key_version=1`, desencripta DEK con v1, re-envuelve con v2, update `key_version=2`
   e. Cuando count=0 en v1, marcar v1 como `revoked` (no se elimina, solo se marca)
4. Audit `action='kek_rotated'` con metadata `{from_version: 1, to_version: 2, items_count}`

V1 items count chico, re-encrypt es rápido (segundos). Si crece, considerar
job en background no bloqueante.

### 4.11 Session timeout 30 min — no 5 min

**Por qué:** uso interno cómodo. 5 min es para password manager público que
asume entornos adversariales (cibercafé, máquina ajena). DTD interno usa
máquinas conocidas, 30 min balancea seguridad/UX.

Configurable en `no_olvidar_config.session_timeout_minutes`. Si en el futuro hay
mayor exposición, bajar.

Implementación: cuando user "abre" el No-Olvidar (`unlock`), se guarda
`last_unlock_at = now()`. Cada action que requiere desencripción valida
`now() - last_unlock_at < session_timeout`. Si excede, redirect a 2FA.

### 4.12 Setup wizard obligatorio primer uso

**Por qué:** sin setup, el No-Olvidar es inutilizable + inseguro. Forzar wizard
en primer login asegura: TOTP configurado, master password definido (o
declinado explícitamente), recovery kit generado e impreso, términos
aceptados.

Implementación: `no-olvidar/page.tsx` chequea `setup_completed`. Si false →
redirect `/no-olvidar/setup`. No hay forma de evitar el wizard.

### 4.13 Recovery kit como 24 palabras BIP39

**Por qué:** estándar Bitcoin/crypto, fácil de imprimir, escribir a mano,
guardar en caja fuerte física. 256 bits de entropía (2048^24 posibilidades)
es astronomically seguro.

Implementación: generar entropía 32 bytes random, mapear a 24 palabras BIP39,
mostrar para imprimir con instrucciones claras ("guardá esto en lugar
físico seguro, NO en la nube"). Hash con Argon2id + guardar `recovery_kit_hash`
en `no_olvidar_user_keys`. NUNCA guardar las palabras en plaintext server.

Si user pierde master password Y recovery kit → necesita admin recovery
(M-of-N). Esa es la tercera capa.

### 4.14 Anomaly detection básico V1

**Por qué:** sin detección, un compromiso puede pasar desapercibido por meses.

Heurísticas V1 (function `getAnomalies`):
- ≥5 views en 1 min → posible scraping
- Accesos fuera de 06:00-23:00 VET → posible compromiso (asumiendo equipo trabaja horario laboral)
- IP nueva (no vista en últimos 30d) → posible compromiso
- ≥3 failed unlock attempts en 5 min → posible brute force

Banner top en `/no-olvidar` visible a admins si hay anomalías últimas 24h.
V2: enviar a Slack/email.

### 4.15 Sin sharing entre users V1

**Por qué:** sharing requiere asymmetric crypto (Curve25519), re-wrap de DEK
con clave pública del receptor, UI para invitar/revocar, queries de
"items compartidos conmigo", todo gateaway por audit. Es 3-4 días extra
y no es bloqueador.

Workaround V1: si dos users necesitan compartir un secreto, lo crean los
dos (duplicado) o usan canal seguro externo. Cuando aparezca caso de uso
real, SDD-0025.1 agrega sharing.

### 4.16 Mitigaciones anti-screenshot (best-effort, NO bloqueo real)

**Por qué:** founder pidió evaluar bloqueo de screenshots tipo apps bancarias.
**Verdad técnica**: en web/browser NO existe API para bloquear screenshots —
es una capacidad del SO (Android `FLAG_SECURE`, iOS `userDidTakeScreenshotNotification`)
disponible solo en apps móviles nativas. Cualquier sitio que prometa "bloqueo
de screenshot en web" miente: el SO captura a nivel kernel y el browser no
tiene poder. Una cámara externa apuntando al monitor rompe TODA mitigación
digital de cualquier forma.

**Qué SÍ podemos hacer**: defensas en profundidad que suben la barrera contra
capturas casuales y permiten forensics post-leak. Etiquetadas explícitamente
como "best-effort" — el equipo debe asumir que el password puede ser
capturado igualmente.

**6 mitigaciones implementadas en `<RevealField />` (V1)**:

1. **Hold-to-reveal**: el password solo se ve mientras el botón del ojo está
   presionado (`onMouseDown` muestra, `onMouseUp` y `onMouseLeave` ocultan).
   Configurable via `no_olvidar_config.hold_to_reveal` (default `true`).
   *Reduce ~60-70% de capturas casuales — requiere coordinación o software
   automatizado*.

2. **Auto-hide agresivo 3 segundos** (en lugar de 10): suficiente para leer
   y copiar mentalmente, no para preparar herramienta de captura externa.
   `no_olvidar_config.reveal_auto_hide_seconds = 3` (default).

3. **Blur on window blur**: `window.addEventListener('blur', hide)`. Si el
   user pierde foco (alt-tab, click otra app, abre DevTools), password se
   oculta instantáneamente. También en `document.visibilityState === 'hidden'`.
   `no_olvidar_config.blur_on_window_blur` (default `true`).

4. **Watermark forense** (componente `<ForensicWatermark />`): overlay
   diagonal semi-transparente con `email + IP + timestamp` repetido en grid
   sobre el password. Si el password termina en un screenshot circulando
   online, la marca permite identificar quién lo capturó. NO previene la
   captura, habilita forensics. `no_olvidar_config.forensic_watermark` (default `true`).

5. **Bloqueo `onCopy` / `onContextMenu`** mientras está revealed: previene
   copy accidental con `Ctrl+C` o right-click → "Copiar". El usuario debe
   usar el botón "Copiar" del No-Olvidar (que loggea `action='copy'`). Filtra
   usuarios casuales, NO atacantes (bypassable con DevTools). `no_olvidar_config.block_copy_event`
   (default `true`).

6. **Char-by-char reveal** (opt-in): muestra solo 1 carácter del password
   según la posición del mouse sobre la cadena. User entiende el password
   pero captura completa requiere N screenshots distintos coordinados.
   Funciona bien para passwords 12-30 chars, mal para passphrases largas.
   `no_olvidar_config.char_by_char_reveal` (default `false`, opt-in por user via
   toggle en settings personal del No-Olvidar).

**Lo que NO implementamos (explícitamente descartado)**:

- ❌ Detección de DevTools — heurísticas poco confiables (medir `window.outerHeight`,
  `debugger` statement timing), bypassables por devtools modernos, falsos positivos
  altos. Vale como deterrente trivial, NO como seguridad. No suma al SDD.
- ❌ Canvas fingerprinting para detectar screenshots — no funciona en web.
- ❌ CSS `user-select: none` solo — no impide captura visual, solo selección.
  Lo incluimos solo dentro del componente `<RevealField />` como complemento
  de los items 1+5, no como mitigación standalone.
- ❌ Encrypted Media Extensions (DRM Widevine) — solo para media, no texto.
- ❌ Comunicar al user del No-Olvidar "los screenshots están bloqueados" — eso
  sería falso y genera complacencia peligrosa. El copy del No-Olvidar debe decir
  honestamente: "estas son defensas adicionales, asumí siempre que tu pantalla
  puede ser fotografiada por una cámara externa".

**Roadmap móvil nativo** (backlog, no V1):

Cuando se construya **App móvil DTD nativa** (React Native / Swift / Kotlin),
ahí sí implementar:
- Android: `WindowManager.LayoutParams.FLAG_SECURE` en la activity del No-Olvidar
  → screenshots y grabaciones aparecen negros a nivel SO.
- iOS: detectar screenshots con `UIApplication.userDidTakeScreenshotNotification`
  (no se previene, pero podés cerrar sesión + alertar al admin via audit).
  iOS 15+: `UIScreen.capturedDidChangeNotification` para grabaciones de pantalla.

Eso da bloqueo REAL en móvil. En web, lo de §4.16 es lo máximo posible.

**Lo que el equipo de DTD debe saber siempre**:

El No-Olvidar NO sustituye higiene operacional. Asumir que TODO password ahí
adentro podría leakearse por:
- Captura con cámara externa de monitor
- Compromiso del SO del user (malware, keylogger)
- Admin malicioso con M-of-N recovery (mitigado pero posible)
- Bug residual en crypto que no atrapamos en code review

Por eso V1 incluye sí o sí: audit log immutable + alertas anomalía +
clipboard auto-clear + watermark forense. La estrategia es "detección y
contención rápida del leak", no "prevención del leak".

---

## 5. Criterios de aceptación

### Funcional

- [ ] Primer login: `/studio/no-olvidar` → redirect a `/no-olvidar/setup` (wizard 4 pasos)
- [ ] Wizard paso 1: intro + checkbox "acepto términos" → next
- [ ] Wizard paso 2: opción "configurar master password" toggle. Si activado, input password (min 12 chars) + confirm. Si declined, warning "tu admin podrá ver tus items en caso necesario"
- [ ] Wizard paso 3: setup TOTP — muestra QR + input código 6 dígitos → verifica → marca `totp_enabled = true`
- [ ] Wizard paso 4: muestra recovery kit (24 palabras BIP39) en card grande, botón "Imprimir", checkbox "lo guardé en lugar seguro" → done → `setup_completed = true`
- [ ] Segundo login: `/studio/no-olvidar` → redirect a `/no-olvidar/2fa`
- [ ] 2FA: input TOTP (+ master password si configurado) → submit → si OK marca unlocked + redirect a `/no-olvidar`
- [ ] 5 intentos fallidos en 15 min → `locked_until = now() + 15min` → UI bloqueada con countdown
- [ ] No-Olvidar unlocked: muestra lista de items (vacío inicial) + KPIs + botón "+ Nuevo item"
- [ ] Crear item login: name, url, username, password (oculto al typing) → submit → encripta + insert + audit log → aparece en lista
- [ ] Detalle item: drawer con campos. Password oculto por default.
- [ ] **Hold-to-reveal**: mantener presionado botón ojo → password visible mientras esté presionado. Soltar → se oculta. Audit log `action=view` al primer mousedown.
- [ ] **Auto-hide 3s**: si el user no suelta el botón en 3s, password se oculta automáticamente (anti olvido).
- [ ] **Blur on window blur**: revelar password → alt-tab a otra app → password se oculta antes de regresar al No-Olvidar.
- [ ] **Watermark forense**: al revelar, overlay diagonal muestra email + IP + timestamp del user actual encima del password. Visible en screenshot (verificar tomando uno manualmente en QA).
- [ ] **Bloqueo copy/contextmenu**: con password revealed, `Ctrl+C` y right-click NO copian el plaintext. Solo botón "Copiar" del No-Olvidar funciona (con audit).
- [ ] **Char-by-char opcional**: settings del user permite activar `char_by_char_reveal`. Activado → al revelar muestra solo 1 char según posición mouse. Desactivado por default.
- [ ] Click botón "Copiar password" del No-Olvidar → clipboard tiene plaintext + audit log `action=copy` + clipboard se borra a los 30s
- [ ] Edit item → re-encripta + audit `action=edit`
- [ ] Soft delete item → `deleted_at = now()` + audit `action=delete`
- [ ] Session timeout: pasados 30 min sin actividad → click reveal redirect a `/no-olvidar/2fa`
- [ ] Anomaly detection: forzar 5 views en 1 min de un item → banner top visible a admin
- [ ] Recovery request: user en `/no-olvidar/recovery` → form con reason → submit → crea pending request → notifica admins (UI)
- [ ] Admin en `/no-olvidar/admin/recoveries`: ve queue → click "Aprobar" en 1 request → approval count = 1
- [ ] Segundo admin aprueba → approval count = 2 → request `status=approved`
- [ ] User original ve "tu recovery está aprobado" → input nueva master password → submit → `executeRecovery` re-envuelve private_key → user vuelve a entrar con nueva password
- [ ] Admin rota KEK: `/no-olvidar/admin` botón "Rotar KEK" → confirm → genera v2 + re-encrypt todos los items + audit `action=kek_rotated`
- [ ] Después de rotación, items siguen accesibles (re-wrap fue transparente)
- [ ] Admin único NO puede aprobar su propia recovery request (validation)
- [ ] User member NO ve queue de recoveries (RLS bloquea)
- [ ] User member NO ve items de otro user (RLS bloquea)
- [ ] Audit log: query directa `UPDATE no_olvidar_access_log SET ...` desde service_role falla (RLS)
- [ ] Audit log: query directa `DELETE FROM no_olvidar_access_log WHERE id=...` desde service_role falla (RLS)

### Sistema

- [ ] `pnpm typecheck` pasa
- [ ] `pnpm build` pasa
- [ ] `pnpm lint` pasa
- [ ] Migration 0013 corre limpia + verificar 6 tablas + RLS via `\d+` en cada una
- [ ] RPC `vault.create_secret('no_olvidar_kek_v1', random_bytes(32))` se ejecuta UNA VEZ manualmente post-deploy (NO en migración)
- [ ] Backup OFFLINE de la KEK v1: founder + 1 socio cada uno tiene copia en USB físico en cajas separadas (responsabilidad operacional, no parte del code)
- [ ] Tests unitarios crypto:
  - encrypt/decrypt roundtrip funciona
  - decrypt con key incorrecta retorna error (no plaintext basura)
  - generateDek produce 32 bytes
  - wrapDek/unwrapDek roundtrip funciona
  - deriveKeyFromMasterPassword con misma password+salt produce misma key, con distinta salt produce distinta
  - constantTimeEqual no es vulnerable a timing attack (test estadístico)
- [ ] Tests recovery: request → 1 approval (no executa) → 2 approvals (executa OK) → flujo idempotente
- [ ] Tests session: unlock → válido 30 min → expirado después → re-unlock funciona
- [ ] Tests E2E: full flow setup → crear item → ver → editar → eliminar → ver audit
- [ ] Tests RLS: simular user A intentando ver items de user B → 0 results
- [ ] Sidebar marca "No-Olvidar" como active en `/no-olvidar/...` (prefix match funciona)
- [ ] Componentes pasan revisión por agente `ui-ux-designer`
- [ ] BRAND-CHECK: castellano-VE, sin emojis decorativos, sentence case en CTAs, tokens CSS
- [ ] Documentación interna creada: threat-model.md + runbook.md + recovery-procedure.md + admin-handbook.md
- [ ] **Code review crypto externo**: `lib/studio/no-olvidar/crypto.ts` + `key-manager.ts` + `recovery.ts` revisados por dev senior con experiencia crypto (freelance $300-800, cotizar Upwork/Toptal). Sin esto no se mergea.

---

## 6. Out of scope / open questions

### Out V1 (cubierto en sección 2)

Sharing entre users, browser extension, mobile, file attachments, categorías
extra, import/export, sync externo, apertura a tenants, hardware keys,
captcha en endpoint recovery, notificaciones Slack/email, backup auto KEK,
2FA SMS/email, anti-phishing URL verification.

### Open questions resueltas (sesión 2026-05-24)

- ✅ **Custodial vs zero-knowledge** → custodial con admin recovery, scope DTD interno
- ✅ **Provider crypto** → `libsodium-wrappers` (XChaCha20-Poly1305), no Web Crypto V1
- ✅ **KEK storage** → Supabase Vault extension, NO en .env, NO en código
- ✅ **Recovery model** → M-of-N admin approvals (default 2-of-N)
- ✅ **2FA** → TOTP obligatorio, no SMS/email
- ✅ **Master password user** → opcional pero recomendado para admins
- ✅ **Audit log** → immutable via RLS estricta
- ✅ **Sharing V1** → NO, diferido
- ✅ **Session timeout** → 30 min default, configurable
- ✅ **Compliance** → diferida (decisión founder), riesgo aceptado al ser interno
- ✅ **Pentesting externo** → NO V1 (scope interno), SÍ code review crypto externo

### Open questions diferidas

- **¿KEK rotation cada cuánto?** V1 sin schedule. Sugerencia operacional: anual o ante sospecha. Documentar en `runbook.md`.
- **¿Backup de la KEK rotada (legacy)?** V1 mantener registro en `no_olvidar_kek_versions` con status=legacy. Si todos los items se re-encriptan a v2, ¿se puede eliminar v1 de Supabase Vault? Decisión: NO. Mantener legacy KEKs indefinidamente por si aparece item huérfano. Espacio es negligible (32 bytes por versión).
- **¿Qué pasa si un admin deja DTD?** Política operacional: rotar KEK + rotar passwords de todos los items que el admin pudo haber visto (asumiendo que pudo). Documentar en `admin-handbook.md`.
- **¿Recovery kit puede regenerarse?** V1 NO (es one-time al setup). Si user lo pierde → debe pedir admin recovery. V2 considerar "regenerar recovery kit" tras autenticarse con master password actual.
- **¿Notificar al user cuando alguien hace recovery sobre su cuenta?** V1 sí, vía email al user (uso de tabla `no_olvidar_access_log` con `metadata.notify_email = true`). Implementar simple con Resend o similar; si no hay servicio email configurado, dejar como `// TODO: enviar email` con comentario explícito.
- **¿Login a Studio con SSO en lugar de password?** Fuera de scope, depende de SDD futuro de auth.
- **¿Versionar items?** (ej. password antigua de Twitter cuando se cambia). V1 NO. V2 considerar tabla `no_olvidar_item_versions` append-only.
- **¿Reportes ejecutivos de uso del No-Olvidar?** (ej. "este mes se accedió 47 veces a credenciales de Instagram"). V2.

---

## 7. Operación post-deploy — checklist obligatorio

Estos pasos NO son código, son operacionales. **Sin esto el No-Olvidar no está
seguro independientemente de qué tan bien implementemos crypto.**

### 7.1 Setup KEK (una sola vez, post-migration)

1. Aplicar migración `0017_no_olvidar.sql`
2. En SQL Editor de Supabase, ejecutar:
   ```sql
   SELECT vault.create_secret(
     gen_random_bytes(32),
     'no_olvidar_kek_v1',
     'KEK maestra del módulo No-Olvidar DTD-CARGO — NO ELIMINAR'
   );
   INSERT INTO no_olvidar_kek_versions (version, kek_secret_name, status, created_by, notes)
   VALUES (1, 'no_olvidar_kek_v1', 'active', auth.uid(), 'Initial KEK created at deploy');
   ```
3. Verificar: `SELECT * FROM vault.decrypted_secrets WHERE name = 'no_olvidar_kek_v1'` devuelve 1 row.

### 7.2 Backup OFFLINE de la KEK

1. Founder genera USB físico cifrado (VeraCrypt o equivalente). Mete la KEK + recovery kit master.
2. Socio 1 hace lo mismo en USB separado.
3. USBs guardados en cajas físicas separadas (caja fuerte, caja bancaria, etc.).
4. **Sin este paso, si Supabase pierde la DB en un evento catastrófico, perdemos todo el No-Olvidar sin posibilidad de recovery.**

### 7.3 Asignar admins iniciales

```sql
UPDATE no_olvidar_user_keys SET role = 'admin' WHERE user_id IN ('<founder_uuid>', '<socio_uuid>', '<it_uuid>');
```

Mínimo 3 admins para que M-of-N (default 2) funcione robustamente (si solo
hay 2 admins y uno necesita recovery, el otro queda solo con 1 voto, no
alcanza M=2).

### 7.4 Configurar `no_olvidar_config`

```sql
UPDATE no_olvidar_config SET
  recovery_approvals_required = 2,
  session_timeout_minutes = 30,
  failed_attempts_lockout = 5,
  lockout_minutes = 15,
  require_2fa = true,
  clipboard_clear_seconds = 30,
  reveal_auto_hide_seconds = 3,
  hold_to_reveal = true,
  blur_on_window_blur = true,
  forensic_watermark = true,
  block_copy_event = true,
  char_by_char_reveal = false,
  updated_by = '<founder_uuid>'
WHERE id = 1;
```

### 7.5 Documentar política operacional

Crear `docs/no-olvidar/admin-handbook.md` con:
- Lista de admins actuales con contacto
- Procedimiento si un admin deja DTD (rotar KEK + revocar role + audit revisión)
- Procedimiento si se sospecha breach (rotar KEK inmediato + revisar audit_log + notificar founder)
- Procedimiento M-of-N recovery paso a paso con screenshots
- Quién tiene los USBs de backup KEK + cuándo se rotan físicamente

### 7.6 Code review crypto externo

ANTES de mergear a main:
1. Cotizar dev senior crypto en Upwork/Toptal/freelance local ($300-800).
2. Enviar: `lib/studio/no-olvidar/crypto.ts` + `key-manager.ts` + `recovery.ts` + `session.ts` + `audit.ts` + migración 0013.
3. Pedir: review enfocada en (a) uso correcto de libsodium, (b) ausencia de timing attacks, (c) RLS policies efectivas, (d) flow recovery sin race conditions, (e) nonce reuse / IV reuse.
4. Fix issues encontradas. Re-review.
5. Recién entonces merge.

---

## 8. Threat Model resumido (detalle completo en `docs/no-olvidar/threat-model.md`)

| # | Amenaza | Vector | Mitigación V1 | Riesgo residual |
|---|---|---|---|---|
| 1 | Breach DB Supabase | Compromiso credenciales Supabase / SQL injection | Ciphertext + KEK separada en Supabase Vault + DEK envuelta | Bajo |
| 2 | Compromiso server Vercel/Next | RCE en app / supply chain attack | KEK rotable + audit log + alertas anomalía + RLS estricta | Medio (aceptable para uso interno) |
| 3 | Admin malicioso (single) | Insider con role=admin abusa | M-of-N para recovery (no puede solo) + audit immutable + alertas | Bajo |
| 4 | Admins coludidos (todos) | Colusión total | NO mitigable en custodial system | Alto pero improbable (asumido) |
| 5 | MITM red | Atacante en LAN o ISP | HTTPS + HSTS + (V2) client-side encryption | Bajo |
| 6 | Phishing master password | Sitio falso captura password | 2FA TOTP (necesita ambos) + (V2) WebAuthn | Bajo |
| 7 | Malware en máquina user | Keylogger / clipboard hijack | Auto-clear clipboard 30s + reveal timeout 10s + session timeout | NO mitigable totalmente |
| 8 | Brute force master password | Atacante intenta combinaciones | Argon2id (m=64MB) + rate limit 5 intentos/15min + lockout | Bajo |
| 9 | Pérdida master password | User olvida | Recovery kit BIP39 + admin recovery M-of-N | Mitigado |
| 10 | Pérdida recovery kit Y master password | Doble pérdida | Admin recovery M-of-N | Mitigado |
| 11 | Pérdida total admins (todos a la vez) | Catástrofe | Backup OFFLINE KEK (founder + socio) | Mitigado |
| 12 | Supabase pierde DB | Outage / data loss en proveedor | Backup OFFLINE KEK + (no V1) backup ciphertext periódico | Medio (mitigar V1.5) |
| 13 | Bug en mi implementación crypto | Code error | `libsodium-wrappers` battle-tested + code review externo | Bajo si se hace review |
| 14 | Nonce reuse | Bug que reusa nonce → key recovery posible | XChaCha20 nonce 192 bits + random fresco por encrypt + revisión externa | Muy bajo |
| 15 | Side-channel timing | Comparación naive de hashes | `constantTimeEqual` en todas las comparaciones de secrets | Bajo |
