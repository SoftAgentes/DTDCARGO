# Contratar al revisor criptográfico (SDD-0025)

Este es el **único bloqueo real** del No-Olvidar. El código está construido, el gate lo espera a él.
Ver [runbook.md §0](runbook.md) — "no se despliega nada hasta pasar el review externo".

**Qué se le manda:** el ZIP que genera `node scripts/no-olvidar-review-bundle.mjs` (17 archivos,
~56 KB) + el brief `review-bundle/README.md` que va adentro.

---

## 1. Aviso listo para publicar

> Copiar tal cual. Está en inglés porque el brief técnico también lo está y amplía mucho el pool
> de candidatos.

**Title:** `Cryptography code review — internal password manager (Node/TypeScript + Postgres RLS)`

**Description:**

```
We built an internal secrets manager for our logistics company (~5 admin users, single tenant)
and we want an experienced cryptography reviewer to audit it before it ships. This is a hard
merge gate: the code does not go to production until someone qualified signs off.

Scope: ~1,800 lines of TypeScript plus 3 SQL migrations. Self-contained bundle, no access to our
systems required — you read code, you write a report.

What it uses:
- libsodium (XChaCha20-Poly1305 AEAD with context-binding AAD, Argon2id KDF, BLAKE2b subkey
  derivation, constant-time compare)
- Envelope encryption: a KEK in Supabase Vault wraps a per-item DEK
- M-of-N admin recovery flow (custodial by design, not zero-knowledge)
- TOTP 2FA with replay protection
- Postgres RLS / GRANT / SECURITY DEFINER functions — WE TREAT THIS AS A PRIMARY REVIEW
  SURFACE, not an afterthought. Our own internal audit found the crypto core solid and the
  serious defects all at the DB boundary.

We include a detailed brief that tells you exactly what to check, which risks we have already
accepted (so you don't waste time reporting them), and a list of defects a prior adversarial
review already closed — we want you to VERIFY those fixes hold, not re-discover the original
bugs. Two of those fixes were themselves regressions introduced by earlier fixes, which is the
failure mode we most want a human eye on.

Estimated effort: 6-10 hours. Code comments are in Spanish; the brief is in English. Reading
Spanish comments is helpful but not required — the brief covers the architecture.

Deliverable: a short written report with (a) blocking findings, (b) non-blocking hardening
suggestions, (c) explicit sign-off on our Argon2id parameters and the recovery flow, (d) a
verdict on whether the already-applied fixes hold. Reference file:line.

Please tell us in your proposal:
1. A cryptographic implementation flaw you have found in real code, and how you found it.
2. Your view on Argon2id m=128 MiB / t=3 / p=1 for a stored password verifier, given an
   offline-attack threat model.
3. Whether you are comfortable reviewing Postgres RLS policies, GRANTs and SECURITY DEFINER
   functions — say no if you are not, it is half the job.
```

**Presupuesto:** el rango que veníamos manejando es **$300–800**. Es coherente con 6–10 h a
tarifa de freelance senior. Una firma especializada en auditoría cripto cobra bastante más —
si el presupuesto lo permite, es la opción más sólida, pero para un módulo interno de 5 usuarios
un buen freelance alcanza.

**Dónde:** Upwork o Toptal (los dos que ya habíamos considerado). Alternativa: contacto directo
por LinkedIn con alguien que tenga experiencia real en secrets management.

---

## 2. Cómo filtrar candidatos

**Buena señal:**
- Responde la pregunta 2 con criterio propio (habla de costo por intento, de que `p=1` en
  libsodium es un trade-off conocido, de qué protege realmente el verifier) — no repite OWASP.
- Dice que sí a Postgres **y** pregunta si `service_role` tiene `BYPASSRLS`. Esa pregunta sola
  vale el contrato: es exactamente donde estaban nuestros bugs graves.
- Pide ver cómo se llaman las funciones, no solo cómo están escritas (le mandamos `actions.ts`
  si lo pide — no va en el bundle por tamaño).

**Mala señal — descartar:**
- Propone cambiar de librería ("usá bcrypt", "usá Web Crypto") sin haber leído nada. La elección
  de libsodium ya está decidida y justificada en el brief §6.
- Solo habla de la capa TypeScript e ignora el SQL. Media auditoría no sirve acá.
- Ofrece "correr un scanner" o entregar salida de una herramienta automática.
- Promete un plazo de horas. Son 6–10 h de lectura densa; quien dice "mañana lo tienes" no lo va
  a leer.

---

## 3. Qué se comparte y qué NO

**Se manda:** el ZIP del bundle. Es código fuente, migraciones SQL y tests — **sin datos, sin
credenciales, sin PII**. Verificado: 17 archivos, ninguno con secretos.

**NUNCA se manda:**
- `.env` / `.env.local` ni ninguna key (`SUPABASE_*`, `DTD_API_KEY`, PAT de Supabase).
- Acceso a la base de producción, ni de lectura. El review es offline por diseño.
- Datos de clientes. El módulo ni siquiera existe en prod todavía.

**NDA:** razonable pedirlo antes de mandar el ZIP. Es código propietario de un sistema de
custodia de secretos; que un tercero lo lea es aceptable, que lo pueda redistribuir no.

---

## 4. Cuando llegue el reporte

1. Triaje: separar **blocking** de **hardening**. Solo lo blocking frena el merge.
2. Arreglar lo blocking en la rama `feat/no-olvidar`, con `verify.mjs` verde en cada commit.
3. ⚠️ **Los fixes de seguridad necesitan su propio review.** Ya nos pasó: la segunda vuelta
   adversarial encontró que dos fixes de la primera habían introducido regresiones — una de
   ellas capaz de **borrar una KEK en vuelo** (pérdida de datos). No des por buena una
   corrección propia sin volver a mirarla.
4. Recién ahí: aplicar `0251` → `0252` → `0253` a prod, **de a una, nombrándolas**
   ([runbook de migraciones](../runbooks/aplicar-migraciones-prod.md)), seguido del paso manual
   de la KEK y el **backup offline** ([runbook.md §2 y §3](runbook.md)).
5. Sacar las tres de `pendingBelowCutoff` en `supabase/migrations-baseline.json` y subir el
   `cutoff`.
6. Mergear a `main` y voltear el `status` de la spec 0025 a `done`.

---

*Última actualización: 2026-07-29. Bundle regenerable con `node scripts/no-olvidar-review-bundle.mjs`.*
