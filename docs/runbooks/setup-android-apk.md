# Runbook — APK Android del operario (TWA, sin Play Store)

Empaqueta la **PWA del operario** (`dtdcargo.com/m/*`) en un `.apk` instalable
por descarga directa, sin pasar por Google Play. Usa **TWA** (Trusted Web
Activity): un cascarón Android que abre la PWA a pantalla completa cargando la
URL en vivo. No reimplementa nada — es la misma web.

> **Prerrequisito ya resuelto en el repo:** los security headers de
> `next.config.ts` ya permiten cámara (scan QR), geolocalización (GPS camionero)
> y el websocket de Supabase Realtime en `/m/*`. Sin eso el APK abriría pero el
> scanner / GPS / bridge no funcionarían (el TWA hereda los headers del sitio).

---

## 0. Requisitos

- **Node 18+** (ya lo tenés).
- **JDK 17+** y **Android SDK** — `bubblewrap` los descarga solo la primera vez
  (te pregunta dónde instalarlos, default `~/.bubblewrap`). No hace falta Android
  Studio.
- La PWA tiene que estar **deployada y online** en HTTPS (lo está:
  `https://dtdcargo.com/m/`).

---

## 1. Buildear el APK con Bubblewrap

```bash
npm i -g @bubblewrap/cli

# Inicializa el proyecto TWA leyendo el manifest de la PWA.
# Te va a preguntar varias cosas — valores recomendados abajo.
bubblewrap init --manifest https://dtdcargo.com/m/manifest.json

bubblewrap build
```

Respuestas en `init` (las importantes):

| Pregunta | Valor |
|---|---|
| **Application ID / package** | `com.dtdcargo.twa` ⚠️ *exacto* (lo espera el assetlinks del repo) |
| Host | `dtdcargo.com` |
| Start URL | `/m/cn` (o `/m/ve/login` si querés un APK para VE — ver §5) |
| Launcher name | `DTD Operario` |
| Display mode | `standalone` |
| Status bar color | `#0F1E3D` |
| Signing key | dejá que genere uno nuevo (`android.keystore`) |

Salida: **`app-release-signed.apk`** (instalable) + `app-release-bundle.aab`
(solo lo necesitarías para Play Store — ignoralo).

### ⚠️ El keystore es sagrado

`bubblewrap` genera `android.keystore` + un `.json` con las passwords.
**Guardalos fuera del repo, con backup.** Sin ese MISMO keystore no podés firmar
actualizaciones del APK: Android rechaza una update firmada con otra llave y el
operario tendría que desinstalar/reinstalar. NO lo subas a git (ya está cubierto
por `.gitignore`, pero verificá).

---

## 2. Habilitar pantalla completa (Digital Asset Links)

El repo sirve `/.well-known/assetlinks.json` desde
[`app/api/well-known/assetlinks/route.ts`](../../app/api/well-known/assetlinks/route.ts)
con el **package name** (`com.dtdcargo.twa`) y el **fingerprint del APK actual
horneados por default**. O sea: tras deployar, el endpoint ya devuelve el JSON
correcto y el APK abre chromeless. **No hay que setear nada en Vercel.**

Verificá:
```bash
curl https://dtdcargo.com/.well-known/assetlinks.json
# Debe devolver package_name com.dtdcargo.twa + el fingerprint del APK.
```

Solo si **rotás el keystore** (APK nuevo con otra firma): actualizá el
fingerprint vía env `DTD_ANDROID_CERT_SHA256` en Vercel (coma-separado para
varias llaves), o editá `DEFAULT_SHA256` / `PACKAGE_NAME` en el route handler.

---

## 3. Distribuir el APK (sin store)

1. **Hospedá el `.apk`** en un link tuyo: Supabase Storage, una página de
   descarga, o un link directo. (No lo metas en `public/` del repo — pesa y no es
   código.)
2. El operario lo baja → toca → Android pide permiso **"instalar apps de fuentes
   desconocidas"** para el navegador → instala.
3. La primera vez **Play Protect** puede avisar "desarrollador no reconocido"
   (hay botón *instalar de todos modos*). Con firma consistente se calma.

---

## 4. Actualizar la app

El TWA carga la URL en vivo, así que **los cambios de la PWA llegan solos** sin
reinstalar — es web. Solo hace falta rebuildear/redistribuir el APK si cambiás:
el ícono, el nombre, el `start_url`, o subís `targetSdkVersion`. Bumpeá
`appVersion` en `twa-manifest.json`, `bubblewrap build`, y firmá **con el mismo
keystore**.

---

## 5. Nota — un APK por rol

El manifest (`public/m/manifest.json`) apunta a `/m/cn` (operario CN). Para el
operario VE (bodeguero / camionero) el login está en `/m/ve/login`. Opciones:

- **Un APK por rol** (simple): corré `bubblewrap init` dos veces con distinto
  `start_url` y distinto package (`com.dtdcargo.operario.cn` /
  `...operario.ve`) — agregá ambos fingerprints/packages al assetlinks.
- **Un solo APK** con `start_url` en una pantalla selector de rol.

Hoy lo más rápido es un APK CN. Decidir según cómo se reparte a los operarios.

---

## 6. Heads-up — verificación de desarrollador (Google, 2026+)

Google está implementando verificación de identidad de desarrollador **también
para apps sideloaded** (no solo Play Store), por regiones, arrancando en 2026.
Para Venezuela todavía no aplica, pero confirmá el estado actual antes de
planear distribución a gran escala — esto está cambiando.
