# 🔨 Auditoría de Seguridad Full-Project — DTD Cargo — 2026-07-31

**Security Score compuesto: 70/100** — 🟡 Bueno con dos áreas 🟠 que requieren plan
**✅ NO BLOQUEA DEPLOY** — 0 hallazgos `critical` en las 6 capas

> Método: skill `project-auditor` del repo (threat-db ~77 amenazas, security-scan.sh) ejecutada con 4 agentes paralelos + advisors MCP de Supabase (proyecto real, read-only) + `pnpm audit` + revisión de headers/config. Todo read-only: no se editó código ni se tocó la base de datos. Reporte parcial de la capa de datos en [`2026-07-31-capa-datos-rls-storage.md`](2026-07-31-capa-datos-rls-storage.md); puntajes por capa en [`2026-07-31-scorecard.json`](2026-07-31-scorecard.json).

---

## 📋 Resumen ejecutivo

Tu ERP está **bien construido donde la mayoría de los proyectos falla**: acceso, autorización y capa de datos son sólidos (cero hallazgos críticos, RLS en 99.6% de tablas, secrets limpios, headers de seguridad de grado A). El riesgo real está en **tres sitios concretos**: (1) el PIN de 4 dígitos de operarios sin lockout — fuerza bruta práctica hoy; (2) funciones SECURITY DEFINER ejecutables por anónimos vía PostgREST, incluidas dos de sincronización de almacén; y (3) **privacidad**: capturas datos biométricos de personas que no son usuarias (POD con foto/firma/cédula/GPS, audio de reuniones, session replay rrweb) sin aviso ni retención — eso en Venezuela roza lo penal (Ley Especial contra los Delitos Informáticos arts. 20-22) y en China es PIPL art. 28. Bonus: los backups de Supabase Cloud **no incluyen los archivos de Storage** — tus POD, comprobantes y evidencias no tienen copia hoy.

**Fix de mayor ROI:** lockout del PIN de operarios (reusa infra que ya tienes, ~1 hora de trabajo).

---

## Score por capa

| Capa | Peso | Sub-score | Hallazgos (C/H/M/L) | Estado |
|---|---|---|---|---|
| 1 · 🔑 Acceso y autorización | 20% | **70**/100 | 0/1/4/4 | 🟡 |
| 2 · 🗄️ Datos (RLS/GRANTs/Storage) | 20% | **79**/100 | 0/1/2/3 | 🟡 |
| 3 · 💻 Código (amenazas) | 20% | **77**/100 | 0/1/2/5 | 🟡 |
| 4 · 🧱 Plataforma (headers/deps/config) | 10% | **84**/100 | 0/0/2/4 | 🟢 |
| 5 · 🕵️ Privacidad (PII, VE+PIPL) | 15% | **30**/100 | 0/4/6/6 | 🔴 |
| 6 · 🛟 Continuidad (backups/DR) | 15% | **79**/100 | 0/1/1/1 | 🟡 |

**Composite = 0.20·70 + 0.20·79 + 0.20·77 + 0.10·84 + 0.15·30 + 0.15·79 = 70.0**

Reglas de score: 100 desde el inicio; critical −20, high −10, medium −4, low −1 (capa 5: alta −10, media −4, baja −1; capa 4: dependencias agrupadas como un hallazgo por severidad). Hallazgos duplicados entre agentes se contaron una sola vez.

---

## 🔴 No hay críticos. Estos son los HIGH (7 en total)

### H1 · PIN de operarios: 4 dígitos, match cross-tenant, sin lockout — Capas 1+3
`lib/auth/operario-session.ts:136-144` · `app/m/cn/login/actions.ts:12-30` · `app/m/ve/login/actions.ts:15-27` · `supabase/migrations/0020_operario_pins.sql:85-117` (la propia 0037 admite "sin lockout actual")
- **Impacto:** 10.000 combinaciones ÷ N operarios activos, verificación cross-tenant, sin throttle ni intentos fallidos. bcrypt frena (~100 ms/intento) pero no impide: el espacio se barre en horas con requests paralelos. Acceso resultante: recepción/estiba en Yiwu y despachos/POD en Venezuela (fraude de entrega).
- **Fix:** (1) throttle por IP en `signInWithPin` reusando `portal_registro_throttle` (patrón ya existente en 6 endpoints); (2) `failed_attempts`/`locked_until` en `operario_pins` (precedente en migración 0017); (3) match filtrado por tenant/warehouse; (4) PIN ≥6 dígitos al salir del piloto; (5) HMAC + rotación de la cookie `dtd_op` (ya anunciado como "V2" en el código).

### H2 · Funciones SECURITY DEFINER ejecutables por ANÓNIMOS vía PostgREST — Capa 2 (advisor MCP del proyecto real)
Advisor `anon_security_definer_function_executable` (WARN, verificado contra producción): 12 funciones ejecutables por `anon`, entre ellas **`warehouse_receipts_cn_sync_boxes()` y `warehouse_receipts_cn_sync_box_identity()`** (sincronización de almacén China) y `consolidation_box_positions_same_tenant()`. Las `public_*` de la calculadora son deliberadas; las de almacén **no deberían ser invocables sin sesión**.
- **Impacto:** cualquier anónimo con la anon key (pública en el bundle) puede disparar funciones de sincronización del almacén. El impacto real depende de los guards internos de cada función — hay que verificarlas una por una.
- **Fix:** migración con `revoke execute on function ... from anon, authenticated;` para toda función que no sea deliberadamente pública (`public_*` calculadora, `public_track_shipment`, `academy_verify_diploma`). Relacionado: el advisor también lista decenas de funciones admin (`admin_create_operario`, `admin_reset_operario_pin`, `audit_*`, `fiscal_post_book`, `confirm_payment_report`) ejecutables por **cualquier usuario autenticado** (incluye clientes del portal): verificar que cada una re-valide rol internamente y revocar EXECUTE donde no se invoque desde el browser.

### H3 · `public_track_shipment` expone PII a anónimos — Capa 2
`supabase/migrations/0059_public_track_rpc.sql:48,64,127,155`
- **Impacto:** con solo el código de envío (secuencial/enumerable — el propio repo lo admite en 0169:12) un anónimo obtiene nombre de quien recibió (`pod_signed_by`), notas y ruta. La firma actual de la función incluye `p_ip` (hay señal de throttle), pero la RPC es invocable directo vía PostgREST saltándose cualquier control de la capa Next.
- **Fix:** throttle en-función (patrón de 0169) + reducir payload (sin nombre del receptor ni notas internas) + `revoke insert on public_track_log from anon` (el INSERT anon `CHECK(true)` es redundante: la función ya loggea como SECURITY DEFINER — lo confirma el advisor `rls_policy_always_true`).

### H4 · rrweb graba la pantalla del Studio con PII visible, sin aviso ni retención — Capa 5
`app/studio/_components/bug-reporter/BugTechCaptureProvider.tsx:10-11,29-44` · `lib/studio/bug-rrweb-capture.ts:59` · bucket `bug-replays`
- **Impacto:** `maskAllInputs` solo enmascara `<input>`; el texto renderizado (nombres, cédulas, montos en tablas) se graba íntegro. Las clases `rr-mask`/`rr-block` tienen **cero uso real** en el repo. Sin aviso al equipo, sin purga del bucket. PII de clientes fuera del perímetro de RLS, descargable por cualquier admin.
- **Fix:** `maskTextSelector`/`blockSelector` en componentes con PII de cliente, aviso visible al equipo, lifecycle de 30 días en el bucket.

### H5 · POD: foto + firma + nombre + cédula + GPS de un NO-usuario, sin aviso — Capa 5
`app/m/ve/camionero/_components/PodModal.tsx:395-571` · `dispatch_pods` + bucket `receipt-photos`
- **Impacto:** quien recibe (empleado, familiar, conserje) entrega rostro (biométrico), firma, cédula y geolocalización sin ver jamás un aviso. CRBV arts. 28 y 60; Ley Especial contra los Delitos Informáticos art. 20 (**penal**); PIPL art. 28 si aplica en CN. Sin retención definida.
- **Fix:** aviso corto en pantalla antes de la firma (con registro de que se mostró), política de retención con borrado, evaluar si la cédula es necesaria habiendo firma+foto+GPS sellados (SHA-256, 0300 — eso está muy bien).

### H6 · Audio de reuniones a Cloudflare Workers AI (voz = biométrico) + espejo Kommo que nunca borra — Capa 5
`app/api/studio/bitacora/transcribe/route.ts:28-30` · `supabase/functions/kommo-sync/sync.ts:42`
- **Impacto:** audio retenido para siempre, sin aviso a los grabados, enviado a un tercero no declarado en `/privacidad`. Y el sync de Kommo solo hace `upsert`: un borrado ejecutado en el CRM no llega a tu base (2.942 contactos espejo, 79% con más de un año) — la promesa de supresión de tu política §8 no se puede cumplir.
- **Fix:** aviso/consentimiento de grabación + retención del audio; reconciliación de borrados en el sync (diff o tombstones); declarar IA/Telegram/Nominatim en `/privacidad` §1 y §4 (regenerar desde `docs/legal/privacidad/inventario-terceros.md`, que ya existe).

### H7 · Los backups de Supabase Cloud NO incluyen los archivos de Storage — Capa 6
- **Impacto:** los backups del plan Pro (7 días) cubren la base de datos, **no los objetos de Storage**. Tus ~12 buckets privados (POD, comprobantes de pago, evidencias, packing, cédulas) no tienen copia de respaldo hoy — solo la durabilidad del proveedor. Si un bucket se corrompe o un cron de purga se equivoca, no hay vuelta atrás.
- **Fix:** sync nocturno de buckets a object storage externo (rclone → B2/R2, ~$6-15/TB/mes) + **runbook de DR** (hoy no existe en `docs/runbooks/`) + una prueba de restore documentada. Esto es además **precondición de la migración a VPS**: en self-hosted ni la DB tiene backups automáticos.

---

## 🟠 Media prioridad (selección; inventario completo por capa en las secciones de cada agente)

| # | Hallazgo | Archivo:línea | Fix |
|---|---|---|---|
| M1 | `deployActions` (git add/commit/push) sin auth ni rol — inerte en Vercel, **RCE-equivalente si migran a VPS** | `app/studio/(app)/_actions/deployActions.ts:32-52` | `getUser()` + rol admin al tope. **Bloqueante antes de la migración VPS** |
| M2 | `ve/actions.ts` (4 transiciones de embarques) verifica membership pero no rol | `app/studio/(app)/ve/actions.ts:24-77` | `moduleEditDenial(supabase, "ve")` |
| M3 | RPC `camionero_advance_od` no verifica que la OD esté asignada a ese camionero | `supabase/migrations/0025:391-404` (también 0271) | Exigir `driver_operario_id = p_operario_id` o supervisor |
| M4 | API Studio sin verificación app-level (dependen 100% de RLS): PATCH/DELETE shipments, GET kpis (200 anónimo), GET conversaciones | `app/api/studio/shipments/[id]/route.ts:70-130` · `kpis/route.ts:33-41` · `conversaciones/[id]/route.ts:26-45` | `getUser()` + 401 explícito |
| M5 | `user_profiles_all_select` lee perfiles de TODOS los tenants | `supabase/migrations/0200:415` | Join caller↔perfil por tenant_id |
| M6 | JSON-LD con datos de DB sin escapar `<` (XSS almacenado si el CMS se compromete) | `app/noticias/[slug]/_components/NewsArticleJsonLd.tsx:127` · `FaqPageJsonLd.tsx:113` | `.replace(/</g, "\\u003c")` |
| M7 | User enumeration en login del portal (mensaje diferenciado + sin throttle) | `app/portal/(auth)/login/actions.ts:43-48` | Respuesta uniforme + throttle (contradice tu propio diseño anti-enumeración de `/registro/check`) |
| M8 | **14 vulnerabilidades de dependencias** (7 high, 6 moderate): `next@16.2.6` vulnerable (GHSA-955p-x3mx-jcvp, parche ≥16.2.11) + `sharp` y otras transitivas | `package.json` | Actualizar Next a ≥16.2.11 y correr `pnpm audit` en CI |
| M9 | Privacidad media: Anthropic/OpenRouter reciben conversaciones de clientes sin figurar en política (H-5) · dirección del cliente a Nominatim sin contrato (H-6) · ficha completa del cliente nuevo a Telegram (H-7) · GPS camionero: retención 7 días declarada pero sin cron que la ejecute (H-8) · política `/privacidad` omite tratamientos reales (H-9) · borrado = SET NULL + identidad denormalizada, Storage intocable (H-10) | `lib/studio/conversaciones/digest-extract.ts:17-21` · `lib/studio/geocoding.ts:10` · `lib/studio/new-client-notify.ts:25-41` · `0066_foundation_v3.sql:218-219` · `app/privacidad/page.tsx:35-64` · `docs/legal/privacidad/mapa-de-borrado.md` | Ver H6 arriba + cron de purga GPS + ejecutar Slices C/D de SDD-0191 |

## 🟡 Baja prioridad (13 ítems, resumen)

CORS `*` en 3 Edge Functions Kommo (contexto server-to-server, riesgo residual) · token Bearer de Obsidian en `.mcp.json` (verificado NO trackeado en git, pero viola la política del repo) · `@playwright/mcp@latest` sin pinear · uploads validan MIME declarado sin magic bytes · `console.warn` loguea email del remitente (`app/api/conversaciones/email/route.ts:142`) · `share_token` de proveedor sin expiración (solo revocación manual, 0119:20) · cookie `dtd_op` sin firmar (riesgo residual documentado V1) · proxy no cubre `/portal` ni `/m/erp` (refresh del JWT no corre ahí — logout abrupto ~1 h) · `pg_net` en schema public (advisor WARN) · IPs de `public_track_log` sin purga · foto de fachada no inventariada en la política · GPS de facto obligatorio para camioneros sin aviso laboral · `audit-exports` sin policies de Storage (consistente hoy, frágil mañana).

---

## 🎯 Top 7 fixes priorizados por ROI

1. **Lockout + throttle del PIN de operarios** (H1) — reusa `portal_registro_throttle`; ~1 h. Cierra el vector de fuerza bruta más real del sistema.
2. **Revocar EXECUTE de anon en `warehouse_receipts_cn_sync_*` y auditar las RPC admin** (H2) — una migración de GRANTs + revisión una-por-una.
3. **Backup de Storage + runbook DR + prueba de restore** (H7) — rclone nocturno a B2/R2; precondición de la migración a VPS.
4. **rrweb: enmascaramiento de texto + aviso + retención 30 días** (H4) — `maskTextSelector` es una línea de config.
5. **Aviso en pantalla del POD + retención** (H5) — copy corto + flag de "aviso mostrado" + cron de borrado.
6. **Actualizar `next` a ≥16.2.11 + `pnpm audit` en CI** (M8) — una tarde con `pnpm verify`.
7. **Auth en `deployActions`** (M1) — bloqueante antes de cualquier deploy fuera de Vercel.

---

## ✅ Lo que está bien (evidencia verificada, no cortesía)

- **0 secrets en el código** (patrones security-scan sobre todo el repo; el token de `.mcp.json` no está trackeado). `service_role` jamás en client components (~140 imports verificados). Solo `NEXT_PUBLIC_*` en el bundle.
- **Identidad siempre del servidor:** cero `body.userId` confiado; `getUser()` en todo el server code, cero `getSession()` para decisiones de auth; tenant_id siempre derivado de sesión (0 ocurrencias desde formData).
- **RLS: 230/231 tablas (99.6%)** — la única excepción es un catálogo público deliberado; event trigger `rls_auto_enable` (0277) auto-protege tablas futuras; 43 tests SQL contractuales + assert de aislamiento de tenant; las 15 tablas sin políticas son deny-by-default deliberado (acceso solo vía RPC).
- **371/371 funciones SECURITY DEFINER con `search_path` fijado**; revoke-from-public consistente; tokens Kommo en Vault; PINs en bcrypt.
- **12/12 buckets privados** con RLS por tenant, MIME allowlist y límites de tamaño. Uploads con paths server-side `{tenant}/{entidad}/{uuid}` (sin path traversal).
- **51/51 API routes + 2 en `/p` con verificación antes de tocar datos**; 14/14 crons con `CRON_SECRET` fail-closed; webhooks con firma HMAC.
- **Headers de grado A:** CSP completa documentada decisión por decisión, HSTS 2 años + preload, `frame-ancestors 'none'`, Permissions-Policy granular por superficie.
- **Anti-abuso real:** honeypot + throttle por IP con namespaces en todos los endpoints anónimos (registro, estimación, contacto, upload, packlist) + anti-enumeración en `/registro/check`.
- **GA4/Ads fuera de rutas privadas verificado en código** (`Analytics.tsx` con `isPrivatePath()` + Consent Mode v2 denied por default); política legal dice "se acepta electrónicamente" y nunca "firmado" (correcto art. 17); POD sellado SHA-256; equipo de China opera solo con Shipping Mark (sin PII de clientes) — implementado, no solo escrito.
- **Gobernanza de privacidad documental madura:** registro de tratamiento, mapa de borrado, inventario de terceros, runbook de brecha, calendario de retención de auditoría aprobado hoy (2026-07-31). La mayoría de los hallazgos altos de privacidad ya estaban autodiagnosticados en `docs/legal/privacidad/`.

---

## 📊 Cobertura

- threat-db: **16/16 checks automatizables corridos** (~46/77 amenazas con evidencia de código; el resto no es verificable estáticamente)
- RLS: **230/231 tablas** (estático) + advisors del proyecto real vía MCP (17 INFO rls-sin-policy — todos deliberados; 1 WARN policy always-true; 1 WARN pg_net en public; 12 WARN funciones ejecutables por anon; N WARN por authenticated)
- Dependencias: `pnpm audit --prod` → 14 vulnerabilidades (7 high / 6 moderate / 1 low)
- Privacidad: 16 hallazgos clasificados ENCONTRADO/CORRECTO/NO VERIFICABLE con marco legal citado desde `references/` de la skill
- Capa profunda adversarial: no corrida (codex no disponible) — opcional
- **No verificable desde aquí:** configuración del dashboard de Supabase Auth (MFA, rate limits de OTP), DPAs con terceros, región del proyecto, prueba de borrado real end-to-end (requiere autorización nombrada del founder), retención real en Resend/Anthropic/Cloudflare/Vercel logs.

## ⚠️ Nota para la migración a VPS (conexión con `RECOMENDACION-vps-migracion-2026.md`)

Antes de migrar: (1) M1 (`deployActions` sin auth) se vuelve RCE-equivalente fuera de Vercel — **bloqueante**; (2) H7 (backups) se duplica de importancia: en self-hosted pierdes también los backups de DB — pg_dump + snapshots + sync de Storage desde el día 1; (3) los advisors del MCP dejarán de existir — el lint de RLS habrá que correrlo local (está `run-sql-tests.mjs`).

---

*Auditoría técnica read-only. La capa 5 no es asesoría legal: es inventario con evidencia; la revisión jurídica corresponde a un abogado. Los fixes no se aplicaron — requieren tu aprobación explícita.*
