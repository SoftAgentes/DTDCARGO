# Mobile-first PWA → avanzar la app Android · Reporte y roadmap

> **Tipo:** doc de arquitectura (advisory) · **Estado:** vigente 2026-06-16 · **Autor:** founder + agente
> **Relacionado:** [`mobile-audit.md`](./mobile-audit.md) (portal cliente, PASO 1.1) · [`stack-tecnico.md`](./stack-tecnico.md) · [`module-sdd-map.md`](./module-sdd-map.md) · runbooks [`setup-web-push.md`](../runbooks/setup-web-push.md) y [`setup-android-apk.md`](../runbooks/setup-android-apk.md) · diseño [`_norte/HANDOFF-MOBILE.md`](../design/studio/_norte/HANDOFF-MOBILE.md)
>
> No es una spec SDD ni compromete construir. Es el mapa de "qué tenemos / qué actualizar / qué hacer y en qué orden" para avanzar la app de celular.

---

## TL;DR (para leer en 30 segundos)

1. **La PWA operario ya está madura.** `/m/cn`, `/m/ve/bodeguero`, `/m/ve/camionero`, `/m/erp` están en producción con service worker + push, escáner QR nativo, GPS, Realtime, upload de fotos y un **APK Android (TWA) ya compilado**.
2. **El stack está al día.** Next 16.2.6, React 19.2.4, Tailwind v4, TS 5, Supabase, web-push 3.6.7. No hay nada "viejo" que migrar de versión.
3. **Los huecos son nivel-PWA, no de arquitectura:** falta setear las VAPID keys en prod, el service worker no cachea (no abre sin red), no hay install prompt, no hay cola offline.
4. **Android ≠ iPhone.** El APK es **solo Android**. iPhone usa la PWA desde Safari (con limitaciones) o requiere Capacitor + Xcode. La PWA **abre directo en el navegador** — el APK es opcional.
5. **Subir fotos/archivos NO es una limitante de PWA.** Ya funciona. Lo real a mejorar: el techo de 12 MB del Server Action, la falta de compresión en 4 de 6 fuentes, y la cola offline.
6. **Storage:** el "caro" de Supabase no es Supabase — es que no comprimimos y hardcodeamos el bucket en 11 sitios. Recomendación: comprimir + crear capa `lib/storage/` ahora; mudar blobs a **Cloudflare R2** (egress $0) cuando crezca el volumen.

**Recomendación de fondo:** seguir con **TWA + completar la PWA** (Android primario). Capacitor/nativo solo si iPhone se vuelve objetivo serio, o si biometría/secure-storage nativo es requisito duro.

---

## 1. Estado actual — qué tenemos

| Capacidad | Implementación | Ruta | Estado |
|---|---|---|---|
| Superficies móviles | Operario CN, bodeguero VE, camionero VE, ERP staff | `app/m/{cn,ve/bodeguero,ve/camionero,erp}` | ✅ prod (SDD-0016/0017/0030) |
| Portal cliente | 5ª superficie, magic-link | `app/portal/` | ✅ prod (SDD-0042) |
| Manifest PWA (operario) | scope `/m`, "DTD Operario", `standalone`, `portrait`, theme navy `#0F1E3D`, íconos 192/512/maskable (reverse sobre navy) | `public/m/manifest.json` | ✅ |
| Manifest PWA (cliente) | scope `/portal`, "DTD Cargo", `standalone`, `portrait`, theme navy `#0F1E3D`, íconos 192/512/maskable (primary sobre paper) + `appleWebApp` | `public/portal/manifest.json`, enganchado en `app/portal/layout.tsx` | ✅ |
| Service worker (operario) | `dtd-operario-v2-push`; `install/activate` + `push` + `notificationclick`; **`fetch` = passthrough (sin caché)** | `public/m/sw.js` | ⚠️ sin offline |
| Service worker (bug reporter + portal) | push del Studio; el portal lo registra vía `PortalPushRegister`. **No tiene handler `fetch`** → en Android Chrome no dispara el prompt de instalación (iOS no lo necesita) | `public/sw.js` | ⚠️ sin `fetch` |
| Registro del SW | client-side, off en dev | `app/m/_components/PwaRegister.tsx` | ✅ |
| Escáner QR | **`BarcodeDetector` nativo** + fallback manual; qr/code_128/code_39/ean_13 | `app/m/_components/QrScanner.tsx` | ✅ |
| GPS / geolocalización | `watchPosition` throttled 30s + haversine | `lib/studio/hooks/use-geolocation.ts`, `app/m/ve/camionero/_components/GpsBlock.tsx`, `app/api/m/tms/ping/route.ts` | ✅ |
| Realtime sync | `dispatch_orders`, `warehouse_receipts_cn` | hook `useRealtimeRefresh` | ✅ |
| Upload de fotos | 8 MB máx, Supabase Storage, signed URLs TTL 1h | `app/m/cn/nueva/photo-actions.ts` | ✅ |
| Web push | `web-push` 3.6.7, VAPID + outbox + cron drain + auto-cleanup 410/404 | `lib/studio/notify/{vapid,operario-push-outbox,send-operario-push}.ts`, `app/api/m/push/{subscribe,unsubscribe}`, `app/api/cron/push-drain` | ⚠️ falta VAPID en prod |
| APK Android | TWA Bubblewrap `com.dtdcargo.twa`, pantalla completa | `public/m/DTDCARGO.apk` + `app/api/well-known/assetlinks/route.ts` | ✅ |
| Headers `/m/*` | CSP + Permissions-Policy relajados (`camera=(self)`, `geolocation=(self)`) | `next.config.ts` | ✅ (no regresionar) |
| Viewport / safe-area | `viewportFit: cover`, `env(safe-area-inset-*)`, no zoom, theme navy | `app/m/layout.tsx`, `app/m/m.css` | ✅ |

**Auth:** el operario usa **PIN propio** (cookie HTTP-only `dtd_op` + RPC `verify_operario_pin` + service_role), no Supabase Auth. El staff y el cliente sí usan Supabase Auth.

---

## 2. Inventario de tecnologías y librerías

Del `package.json` (raíz). **Todo al día — no hay deuda de versiones.**

| Librería | Versión | Nota |
|---|---|---|
| next | 16.2.6 | App Router, latest |
| react / react-dom | 19.2.4 | latest |
| tailwindcss / @tailwindcss/postcss | 4.x | Tailwind v4 |
| typescript | 5.9.3 | strict |
| @supabase/ssr · @supabase/supabase-js | 0.5.2 · 2.106.1 | backend |
| web-push | 3.6.7 | push server-side ✅ |
| sharp | 0.34.5 | optimización de imágenes (build) |
| @playwright/test · vitest | 1.60 · 4.1.7 | e2e + unit |

**Deliberadamente ausentes (y por qué está bien):**

| Lib | Para qué sería | Por qué no la tenemos |
|---|---|---|
| `next-pwa` | build del SW | **deprecada**; si sumamos build de SW, ir con **Serwist** (su sucesor) o seguir con SW custom |
| `serwist` / `workbox` | precache + runtime cache offline | no instalada — es la pieza que falta para offline (ver roadmap #3) |
| `idb` / `dexie` | cola offline en IndexedDB | no instalada — necesaria para offline-first (roadmap #4) |
| `html5-qrcode` / `zxing-js` | QR en navegadores sin `BarcodeDetector` (Safari/iOS) | hoy usamos la API nativa + fallback manual; solo haría falta si iOS pesa |
| `@capacitor/*` | empaquetado nativo iOS/Android | no la usamos — vamos por TWA (ver §5) |

**Faltan en `package.json` (higiene):** `engines.node` y `packageManager` no están declarados → la versión de Node/pnpm queda implícita (riesgo de divergencia local↔Vercel). `@types/node` en `^20` mientras el runtime real puede ser mayor.

---

## 3. Qué ACTUALIZAR (config / tech-debt)

1. **VAPID keys en prod** — el push está 100% cableado pero corre en no-op sin las 3 env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Runbook listo: [`setup-web-push.md`](../runbooks/setup-web-push.md). **Gate del founder.**
2. **Service worker sin caché** — `public/m/sw.js` hace `fetch` passthrough; la app **no abre sin red**. Falta app-shell (ver roadmap #3).
3. **Manifest incompleto** — sin `shortcuts` (CN/VE/camionero), `screenshots` ni `id`. Esto degrada la UX de instalación en Android (no hay accesos directos al hacer long-press del ícono).
4. **`package.json`** — declarar `engines.node` + `packageManager` para reproducibilidad de build.
5. **No regresionar headers** — CSP y Permissions-Policy ya están relajados para `/m/*` en `next.config.ts` (lección: rompían QR/GPS/Realtime solo en prod). Cualquier cambio de headers debe preservar `camera=(self)` y `geolocation=(self)` para `/m`.

---

## 4. ¿La PWA limita las fotos y archivos? — NO

Subir fotos y archivos es de lo **mejor soportado** en PWA (Android e iPhone). Ya funciona en prod para el operario China ([`photo-actions.ts`](../../app/m/cn/nueva/photo-actions.ts)). Lo habilita:

- `<input type="file" accept="image/*" capture="environment">` → abre la cámara nativa directo.
- `<input type="file" multiple>` → elegir archivos/PDF del teléfono.
- `getUserMedia()` → cámara en vivo (lo que usa el QR).

**Las limitantes reales NO son "PWA vs nativo"** — son mejoras que aplican igual:

| Limitante | Causa | Fix (todo PWA) |
|---|---|---|
| Techo de 12 MB por subida | `bodySizeLimit: "12mb"` en Server Actions (`next.config.ts`) | subir **directo a Storage con signed upload URL** (salta el límite) |
| Fotos pesadas | sin compresión en 4 de 6 fuentes | comprimir en el cliente (el compresor ya existe, ver §6) |
| Subir sin red → se pierde | no hay cola offline (deuda de SDD-0030) | **IndexedDB + Background Sync** |

**Únicas limitantes verdaderas de PWA (honestas):**
- **Background upload con la app cerrada en iPhone:** iOS Safari **no** soporta Background Sync (Android sí). Solo importa si el upload debe seguir tras cerrar la app.
- **iPhone dispara HEIC** por defecto: ya lo aceptamos, pero conviene convertir para visores que no lo renderizan.

### Caso operario China 🇨🇳 — la limitante es la RED, no la PWA

El operario en Yiwu sufre **Gran Firewall**: latencia/cortes hacia servicios externos. Eso afecta **igual** a PWA y a nativo (ambos pegan a Supabase por internet). Dos consecuencias:
- Realtime (`wss://*.supabase.co`) y los pings pueden ir lentos → la **cola offline (roadmap #4)** es la mejor inversión para China.
- El CSP carga Google Analytics/Ads (`googletagmanager`, `doubleclick`), **bloqueados en China** — no rompen la app (son analítica), el core (Supabase, fotos) no depende de Google.

**Veredicto China:** PWA sirve; lo que falta es **resiliencia offline**, no irse a nativo.

### Caso cliente — tampoco es limitante de PWA

El cliente sube por [`/portal`](../../app/portal) (facturas/fotos de cédula/docs de compra). Mismo patrón: cámara/archivo + Storage. Lo que falta es **backend/permisos** (esquema de bucket por cliente, RLS, validación, direct-to-Storage para archivos grandes), no "PWA no puede". Decisiones abiertas en [`mobile-audit.md`](./mobile-audit.md) PASO 1.2.

---

## 5. Android vs iPhone — ¿es el mismo trabajo?

**No.** El código de la PWA se comparte (~80-90 %), pero la entrega difiere:

| Pieza | Android (Chrome) | iPhone (Safari/iOS) |
|---|---|---|
| PWA base (rutas `/m`, manifest, diseño) | ✅ igual | ✅ igual (mismo código) |
| **APK / wrapper** | ✅ TWA vía Bubblewrap (lo que ya hay) | ❌ **no existe APK en iOS**; apps iOS son `.ipa` → Xcode + cuenta Apple Developer ($99/año) + Capacitor |
| Instalar a inicio | ✅ prompt automático (A2HS) | ⚠️ manual: Compartir → "Agregar a inicio" (sin prompt) |
| Web push | ✅ completo | ⚠️ solo iOS 16.4+ **y** con la PWA instalada en inicio |
| Escáner QR | ✅ `BarcodeDetector` nativo | ❌ Safari no lo soporta → hoy cae a ingreso manual; cámara real necesitaría `html5-qrcode`/`zxing` |
| GPS / fotos / Realtime | ✅ | ✅ (funcionan en ambos) |
| Background Sync (offline) | ✅ | ❌ no soportado |

**En corto:** el APK que tenemos es **solo Android** (TWA es tecnología Android). Para iPhone no se hace APK — o la PWA desde Safari (gratis, ya funciona con sus límites), o app "de verdad" en App Store vía **Capacitor + Xcode** (más trabajo y costo). La PWA **abre directo en el navegador**; el APK es solo un envoltorio opcional.

### Recomendación de estrategia

| Camino | Cuándo | Costo |
|---|---|---|
| ⭐ **Seguir TWA + completar PWA** (Android primario) | hoy, parque mayoritariamente Android | cero código nativo; el APK hereda mejoras automáticamente |
| **Capacitor / nativo** | si iPhone se vuelve objetivo serio, biometría/secure-storage nativo es requisito duro (lo pide [`HANDOFF-MOBILE.md`](../design/studio/_norte/HANDOFF-MOBILE.md)), o se publica en tiendas | pipeline nativo + bridge + (iOS) Mac/Xcode/cuenta Apple |
| **Puente intermedio** | desbloqueo biométrico sin saltar a nativo | **WebAuthn/passkeys** en PWA |

Si hoy el parque de operarios es Android, la inversión correcta es **completar la PWA**; iPhone se cubre "best-effort" con la PWA de Safari hasta que justifique Capacitor.

---

## 6. Storage — dónde viven los documentos

El cuello real cuando se acumulan attachments de **3 fuentes**: contabilidad, operario China, cliente.

### Estado actual

7 buckets **privados** en Supabase Storage, metadata en tablas, RLS por primer segmento (= `tenant_id`):

| Bucket | Fuente | Máx | Compresión |
|---|---|---|---|
| `receipt-photos` | fotos recepción CN + POD camionero | 8 MB | solo en POD |
| `expense-receipts` | recibos de gastos (web + `/m/erp`) | 5 MB | ❌ |
| `client-facades` | fachadas de cliente (camionero) | 5 MB | ❌ |
| `shipment-docs` | docs de envío (BL/POD) | 10 MB | ❌ |
| `client-docs` | cédula/identidad del cliente (portal) | 8 MB | ❌ |
| `documents` | hub polimórfico DMS (SDD-0049, versionado SDD-0060) | 10 MB | ❌ |
| `prealerta-docs` | docs de compra del cliente (portal) | 10 MB | ❌ |

Path scheme uniforme: `{tenant}/{entidad}/{id}/{uuid}.{ext}`.

### Diagnóstico — el "caro" no es Supabase, son 2 cosas nuestras

1. **Sin compresión en 4 de 6 fuentes.** El compresor [`image-compress.ts`](../../app/m/_lib/image-compress.ts) (máx 1600px, JPEG q0.7 → ~200-500 KB) **solo** se usa en el POD del camionero. Gastos, documentos, fachadas y fotos CN suben sin comprimir (5-10× de más) → eso infla storage **y** egress.
2. **11 call-sites hardcodean el bucket** y llaman `supabase.storage` directo. No hay capa `lib/storage/`. Mudarse hoy duele; pero los `storage_path` ya se guardan en DB y son **agnósticos del proveedor** → la migración es media-baja **si** primero existe el adapter.

**A escala real** (norte 2 contenedores/mes + fotos comprimibles) cabes en el Supabase Pro ($25 flat) por años. El sobrecosto aparece solo si crece el volumen o el egress.

### Comparativa (100 GB almacenados + 200 GB egress/mes)

| Proveedor | Storage | Egress | Total extra/mes |
|---|---|---|---|
| Supabase Pro | $2.10 | $9 ($0.09/GB) | **~$11** |
| **Cloudflare R2** | $1.50 | **$0** | **~$1.60** |
| Backblaze B2 | $0.60 | $0 (hasta 3×, riesgo misconfig) | ~$0.65 |
| AWS S3 | $2.30 | $18 | ~$20 |

El driver es el **egress**, y nuestros buckets privados + signed URLs de TTL corto **no cachean bien** en el CDN de Supabase → pagamos egress full.

### Recomendación — 4 movimientos en orden

1. ⭐ **No migrar todavía.** Comprimir en las 6 fuentes + signed URLs cacheables de TTL más largo → −60-80 % egress, sin cambiar de proveedor, gratis.
2. **Crear capa `lib/storage/` (adapter)** sobre los 11 call-sites: desacopla el nombre del proveedor, consolida validación MIME/tamaño/rollback. Barato hoy.
3. **Al crecer → offload de blobs a Cloudflare R2** (S3-compatible, egress $0, ~7× más barato). Postgres + RLS de Supabase quedan como capa de metadata y permisos. R2 es el default seguro (B2 es más barato pero la misconfig de Cloudflare proxy da facturas sorpresa de miles).
4. **Contabilidad = archivo frío de retención legal** (SENIAT/ISO: guardar años, leer casi nunca) → candidato a tier frío (B2/Glacier) a largo plazo; no pagar egress premium por papeles que nadie descarga.

---

## 7. Roadmap — cómo avanzar (orden recomendado)

| # | Acción | Impacto | Riesgo | Tipo |
|---|---|---|---|---|
| 1 ⭐ | **VAPID keys en Vercel** — desbloquea push (ya cableado) | alto | nulo | config/founder |
| 2 | **Upload directo a Storage (signed URL) + compresión en las 6 fuentes** — mata el techo de 12 MB y baja egress 60-80 % | alto | bajo | PWA + backend |
| 3 | **Offline app-shell en el SW** — que la app abra sin red (Serwist o custom) | alto | medio | PWA |
| 4 | **Cola offline (IndexedDB + Background Sync)** — recepción/POD/fotos no se pierden sin señal. **Clave para China.** | alto | medio | PWA |
| 5 | **Install prompt A2HS + manifest enriquecido** (`shortcuts`, `screenshots`, `id`) | medio | bajo | PWA |
| 6 | **Portal cliente: upload de facturas/fotos** — cerrar las 7 decisiones de [`mobile-audit.md`](./mobile-audit.md) (bucket + RLS + auth) | medio | medio | backend |
| 7 | **Crear capa `lib/storage/`** (adapter, desacopla proveedor) | medio | bajo | refactor |
| 8 | (Diferido) **R2 para blobs** cuando crezca el egress + tier frío para contabilidad | alto (a escala) | medio | infra |
| 9 | (Diferido) **Login usuario+contraseña + PIN/biometría** (6 estados de `HANDOFF-MOBILE.md`) + multi-rol picker | medio | medio | PWA/WebAuthn |
| 10 | (Diferido) **Capacitor/nativo** — solo si iPhone serio / biometría nativa / tiendas | — | alto | nativo |
| 11 | (Higiene) **`engines.node` + `packageManager`** en `package.json` | bajo | nulo | config |

Los pasos **1-9 son todos PWA** (sin código nativo). El **10 es la única bifurcación a nativo**, y solo por iPhone/biometría/tiendas — nunca por fotos o archivos.

---

## 8. Qué queda a coordinación / founder (decisiones)

- **VAPID keys** en Vercel (desbloquea push) — runbook [`setup-web-push.md`](../runbooks/setup-web-push.md).
- **Estrategia Android:** confirmar "TWA + completar PWA" como camino primario (recomendado) vs abrir frente Capacitor.
- **Storage:** decidir cuándo crear `lib/storage/` y a partir de qué volumen evaluar R2.
- **iPhone:** ¿es objetivo a corto plazo? Define si entra `html5-qrcode` (QR en Safari) y/o Capacitor.

Ninguna de estas decisiones se ejecuta en esta ventana — este doc es solo el mapa.
