---
sdd: "0286"
title: "Los GET del Studio respetan el alcance por módulo: RLS filtra por tenant, es ciega al rol"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0085", "0139", "0252"]
confidencialidad: interno
---

# DTD-0286 — El alcance por módulo llega a la API del Studio

## 1. El hueco

`app/api/studio/**` exige sesión y queda filtrado por RLS, pero **RLS filtra por
TENANT y es ciega al ROL**. Un usuario del tenant sin un módulo en su alcance
igual podía leer el endpoint por API, aunque el módulo no le apareciera en el
sidebar del Studio.

El lado de MUTACIÓN ya estaba cubierto: SDD-0085 puso `moduleEditDenial` en las
server actions y un contrato anti-drift que lo vigila. El lado de LECTURA nunca
se cerró.

**Medido el 2026-08-18** (no estimado): de **14 route handlers con `GET`** bajo
`app/api/studio`, sólo **2** tenían gate de módulo — `bitacora/export` y
`comercial/export`, ambos con `canAccessModule` a mano.

**Decisión del founder (2026-08-18):** los GET deben respetar el alcance por
módulo.

## 2. Por qué no alcanzaba lo que había

`requireModuleView()` **no sirve en un route handler**: hace `redirect()`, que
dentro de un handler rompe el contrato JSON en vez de devolver un 403. Hacía
falta el simétrico de `moduleEditDenial` para lectura.

## 3. Qué cambia

### 3.1 Helper nuevo — `moduleViewDenial(supabase, moduleId)`

En `lib/studio/rbac-guard.ts`, calcado de `moduleEditDenial` pero con
`canAccessModule`. Devuelve el mensaje de denegación o `null`. Incluye las tres
capas del guard de edición: matriz + overrides (SDD-0085), scope de almacén
(SDD-0139) y el segundo candado de superadmin (SDD-0252).

### 3.2 Los seis endpoints gateados

| endpoint | módulo | nota |
|---|---|---|
| `shipments/route.ts` | `tracking` | ⚠️ **no** `shipments` |
| `shipments/[id]/route.ts` (GET) | `tracking` | idem; el PATCH/DELETE ya tenían `moduleEditDenial("tracking")` |
| `conversaciones/[id]/route.ts` | `conversaciones` | |
| `kpis/route.ts` | `dashboard` | las 4 cards son de envíos, pero gatear con `tracking` rompería el dashboard para roles sin ese módulo |
| `legal/evidence/[code]/route.ts` | `legal` | ver §5, es más estricto que antes |
| `bitacora/export/route.ts` | `bitacora` | migrado de `canAccessModule` |

🔴 **El path NO dice el módulo.** `app/api/studio/shipments/` pertenece al
módulo `tracking` — su propio PATCH ya llamaba `moduleEditDenial(supabase,
"tracking")`. Derivar el módulo del nombre de carpeta mete el equivocado.

### 3.3 Contrato anti-drift — `lib/studio/rbac-api-guard.test.ts`

Gemelo de `rbac-actions-guard.test.ts`. Escanea `app/api/studio/**/route.ts`,
filtra los que exportan `GET`, y falla si a uno le falta `moduleViewDenial` sin
estar en la ALLOWLIST. Falla también al revés (entrada de allowlist sobre un
archivo que ya tiene guard, y entradas muertas), y trae un sanity check sobre el
NÚMERO de archivos escaneados: si el escaneo se rompe, 0 tests saldrían verdes
sin haber medido nada.

**Validado con mutación:** quitando el guard de `kpis/route.ts` el contrato
falla con el mensaje accionable; restaurándolo, 16/16 en verde.

### 3.4 Las siete excepciones, con su razón

- **Los 5 de `bugs/`** — Bug Reporter, abierto por diseño. La misma razón ya
  estaba escrita en la ALLOWLIST de `rbac-actions-guard.test.ts` para
  `bugs/actions.ts`; ponerles gate de módulo lo rompería.
- **`attachments/[id]/download`** — `authorizeAttachmentDownload` autoriza por
  documento con el cliente CON RLS (exige `scan_status` limpio, bucket e
  identidad canónica del `object_key`), más `requireAttachmentsPilot()`. Un gate
  fijo sería además incorrecto: el adjunto es polimórfico y su módulo depende de
  la entidad dueña, no del endpoint.
- **`audit/export`** — la RPC `audit_authorize_export_download` decide con el
  cliente CON RLS y devuelve 403; más fina que un gate de módulo. El admin
  client sólo firma la URL ya autorizada.
- **`comercial/export`** — gatea por **tipo** de export (`quotes` para
  estimados, `invoices` para facturas) con los overrides del SDD-0085. Un
  `moduleViewDenial` fijo elegiría el módulo equivocado en una de las dos ramas.

## 4. Lo que este cambio NO hace

- No toca los `POST/PATCH/DELETE`: ese lado ya lo cubre SDD-0085.
- No toca RLS ni ninguna migración. Es guard de aplicación.
- No cambia el sidebar ni la UI: el alcance por módulo ya se respetaba ahí.

## 5. Consecuencia que hay que mirar

**`legal/evidence` queda más estricto que antes.** `legal` está en
`SUPERADMIN_ONLY_MODULES`, así que `moduleViewDenial` exige además
`is_platform_admin()` (segundo candado, SDD-0252). Hoy el endpoint se
conformaba con `role === 'admin'` del tenant. Es coherente con la UI —
`modules.ts:50` ya norma que `/studio/legal/expediente|evidencia` conserven
`requireModuleView("legal")`— pero **un admin de tenant que no sea platform
admin deja de poder descargar evidencia legal por API**. Si eso no es lo
querido, la corrección es sacar `legal` de esa lista, no aflojar el guard.

## 6. Verificación

- `pnpm test lib/studio/rbac-api-guard.test.ts` → 16/16, y falla al mutar.
- Gate canónico `node scripts/verify.mjs`.
