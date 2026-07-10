# No-Olvidar — Threat model (SDD-0025)

Modelo de amenazas de la caja fuerte interna de DTD Cargo. **Custodial**, single-tenant, solo
empleados (~5 admins). El detalle resumido está en la spec §8; acá está el análisis completo y los
riesgos residuales **aceptados explícitamente por el founder**.

## Postura de seguridad en una línea

No apuntamos a prevención absoluta (imposible en web + custodial). Apuntamos a **detección y
contención rápida**: cifrado por sobres, KEK aislada en Vault, audit log inmutable, alertas de
anomalía, rotación de KEK, y un recovery que resiste a un admin malicioso solo.

## Arquitectura relevante para el modelo

- **Cifrado simétrico** XChaCha20-Poly1305 (libsodium), nonce aleatorio de 192 bits por mensaje.
- **Envelope**: KEK (en Supabase Vault, solo `service_role`) envuelve un DEK por item; el DEK
  cifra el payload. Rotar KEK re-envuelve DEKs, no re-cifra payloads.
- **Master password** (opcional por user): Argon2id (libsodium `crypto_pwhash`, m=64MB, t=3) →
  del masterKey se derivan por `crypto_kdf` (BLAKE2b) dos subclaves independientes (clave de
  cifrado y verifier). El verifier almacenado no revela la clave.
- **V1 = cifrado server-side**: la KEK solo la alcanza el server; el plaintext viaja por TLS.
  Zero-knowledge (cifrado en el cliente) es V2 y cambiaría este modelo.
- **Audit log inmutable**: RLS `UPDATE`/`DELETE USING(false)` para todos, incl. `service_role`.
- **Endurecimiento (migr 0224)**: increment de intentos fallidos atómico + creación de KEK
  restringida a `service_role`.

---

## Matriz de amenazas

| # | Amenaza | Vector | Mitigación V1 | Riesgo residual |
|---|---|---|---|---|
| 1 | Breach de la DB Supabase | Credenciales Supabase / SQL injection | Ciphertext + KEK separada en Vault + DEK envuelta por KEK | **Bajo** — sin la KEK, el ciphertext es inútil |
| 2 | Compromiso del server (Vercel/Next) | RCE / supply-chain | KEK rotable + audit inmutable + alertas + RLS estricta por user | **Medio** (aceptado, uso interno) — con el server caído la KEK está en memoria |
| 3 | Admin malicioso (uno solo) | Insider con `role=admin` | M-of-N recovery (no puede solo) + audit inmutable + no auto-aprobación | **Bajo** |
| 4 | Admins coludidos (todos) | Colusión total | NO mitigable en sistema custodial | **Alto pero improbable** — aceptado |
| 5 | MITM de red | Atacante en LAN/ISP | HTTPS + HSTS; (V2) cifrado client-side | **Bajo** |
| 6 | Phishing de la master password | Sitio falso captura el password | 2FA TOTP (hace falta ambos factores); (V2) WebAuthn | **Bajo** |
| 7 | Malware en la máquina del user | Keylogger / clipboard hijack | Auto-clear de clipboard (30s) + reveal timeout (3s) + session timeout (30min) | **NO mitigable del todo** — aceptado |
| 8 | Fuerza bruta de la master password | Prueba de combinaciones | Argon2id (m=64MB, t=3) + rate limit (5/15min) + lockout atómico (migr 0224) | **Bajo** |
| 9 | Pérdida de la master password | El user olvida | Recovery kit BIP39 (24 palabras) + admin recovery M-of-N | **Mitigado** |
| 10 | Pérdida de master password Y recovery kit | Doble pérdida | Admin recovery M-of-N | **Mitigado** |
| 11 | Pérdida de todos los admins a la vez | Catástrofe organizacional | Backup OFFLINE de la KEK (founder + socio, USB separados) | **Mitigado** |
| 12 | Supabase pierde la DB | Outage / data loss del proveedor | Backup OFFLINE de la KEK; (V1.5) backup periódico del ciphertext | **Medio** — mitigar en V1.5 |
| 13 | Bug en la implementación crypto | Error de código | libsodium battle-tested + **code review externo (gate de merge)** | **Bajo si se hace el review** |
| 14 | Reuso de nonce | Bug que repite nonce → recuperación de clave | XChaCha20 nonce de 192 bits + nonce fresco por cifrado + review externo | **Muy bajo** |
| 15 | Side-channel de timing | Comparación naive de hashes | `constantTimeEqual` (`sodium.memcmp`) en toda comparación de secretos | **Bajo** |

---

## Anti-screenshot: la verdad técnica

En web **no existe** API para bloquear screenshots — es capacidad del SO (Android `FLAG_SECURE`,
iOS `userDidTakeScreenshotNotification`), disponible solo en apps móviles nativas. Cualquier sitio
que prometa "bloqueo de screenshot en web" miente. Una cámara externa apuntando al monitor rompe
toda mitigación digital.

Lo que SÍ hacemos (best-effort, en `<RevealField />`): hold-to-reveal, auto-hide 3s, blur al
perder foco, **watermark forense** (email+IP+timestamp sobre el password → forensics post-leak),
bloqueo de `copy`/`contextmenu`, char-by-char opcional. Descartado explícitamente: detección de
DevTools, canvas fingerprinting, DRM. **Nunca** comunicar "screenshots bloqueados" (sería falso y
genera complacencia peligrosa).

Bloqueo REAL solo llegaría con app móvil nativa (backlog).

---

## Riesgos residuales aceptados (decisión del founder)

- **#4 Colusión total de admins** — inherente al modelo custodial. Aceptado por ser equipo chico y
  conocido. Si el No-Olvidar se abriera a tenants externos → SDD nuevo con refactor a
  zero-knowledge (no se reusa este).
- **#2 Compromiso del server** — parcial. Aceptable para uso interno.
- **#7 Malware en la máquina del user** — no mitigable totalmente; el auto-clear ayuda.
- **Pentesting externo** — no en V1; el scope interno lo justifica. Obligatorio si crece o se abre
  a tenants.

## Qué NO es un hallazgo (para el revisor)

Los riesgos #2, #4, #7 y "no se bloquean screenshots en web" son decisiones de producto ya
tomadas, no defectos. El review debe enfocarse en la corrección del crypto (#13, #14, #15, #8),
las RLS y el flujo de recovery (#3). Ver [review-bundle/README.md](review-bundle/README.md).
