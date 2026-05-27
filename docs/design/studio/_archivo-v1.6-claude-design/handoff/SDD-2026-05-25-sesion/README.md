# SDD · Sesión 2026-05-25 · Bundle de handoff a Claude Code

> **Sandbox version:** v1.6 al cierre · **Fecha:** 2026-05-25
> Bundle empaquetado para portar a producción **TODO lo que la sesión de hoy tocó o creó** + el módulo **Despacho** completo (estable desde v1.0/v1.1, primer empaque para Claude Code).

---

## 🗓 Releases incluidos

| Release | Qué hace | Tocó |
|---|---|---|
| **Despacho legacy** (v1.0+v1.1) | Módulo completo de coordinación bodega VE → entrega final puerta-a-puerta · Vista 1 Admin + Vista 2 Reglas + Vista 3 Bodeguero + Transportista + Dashboard + Rutas | 9 archivos nuevos + 5 modificados |
| **v1.4 · Etiquetas suppliers CN** (hoy) | Plancha PDF bilingüe ES/中文 con MARKBOX + Box X/Y + QR mock + 4 formatos | 1 archivo nuevo · 2 wired |
| **v1.4.1 · Copias por caja** (hoy) | Control ×1–×4 copias idénticas por caja para trazabilidad redundante | 1 archivo extendido |
| **v1.5 · Críticos + quick wins** (hoy) | MARKBOX validation server-side + email bienvenida real (m-05) + cross-links cliente + QR queue storage listener | 1 archivo extendido (data-bridge) · 3 modificados (registro, clients, qr-queue) |
| **v1.6 · Wiring 9 conexiones rotas** (hoy) | Modal global Adjuntar/Programar/Profile/Atajos/BL/OAuth + Sync persistente HS/AES + Actividad reciente clickeable + Mailing Logs lee bridge | 1 archivo nuevo (wiring) · 8 modificados |

---

## 📋 Documentos

| Archivo | Qué contiene |
|---|---|
| `INVENTORY.md` | Lista exhaustiva por release · qué archivo nuevo · qué archivo viejo modificado con línea + razón |
| `BRIEFS/` | 7 briefs funcionales (uno por feature) · problema · flujo · reglas · permisos · casos borde · dependencias |
| `DATA-MODEL.md` | Shapes TypeScript de todas las entidades nuevas o extendidas + stores localStorage + API de bridges + helpers MARKBOX/email |
| `CONNECTIONS.md` | Diagrama exhaustivo cross-module · writer→reader · todas las dependencias de la sesión + las del módulo Despacho |
| `CHANGELOG.md` | Resumen del día + 4 entries (v1.4/v1.4.1/v1.5/v1.6) formato sandbox listas para pegar en `nuevo/CHANGELOG.md` |

---

## 📁 `source/` · archivos a portar (completos · NO diffs)

### Estructura

```
source/
├── DTD Studio · ERP.html              ← shell principal (script tags + moduleMap + mount host)
├── PROMPT-proxima-sesion.md           ← prompt de continuidad actualizado v1.7
├── erp/
│   ├── data-bridge.jsx                ← v1.5: helpers MARKBOX + emailsSent + sendWelcomeEmail
│   ├── od-bridge.jsx                  ← (Despacho) pipeline ODs
│   ├── shell.jsx                      ← v1.6: user menu wired + sidebar entries Despacho/Etiquetas
│   ├── data.jsx                       ← (Despacho) WAREHOUSE_CN con description
│   └── modules/
│       ├── admin.jsx                  ← v1.6: CodesSyncHeader con lastSync persistente
│       ├── admin-routes.jsx           ← (Despacho) CRUD rutas + ciudades
│       ├── clients.jsx                ← v1.5: cross-links Estado de cuenta + Etiquetas
│       ├── cn.jsx                     ← (Despacho) descripción mercancía + liberarADespacho
│       ├── dashboard.jsx              ← v1.6: RecentActivity clickeable (v1.0 file)
│       ├── despacho.jsx               ← (Despacho) Vista 1 Admin
│       ├── despacho-dashboard.jsx     ← (Despacho) KPIs
│       ├── despacho-rules.jsx         ← (Despacho) Vista 2 Reglas
│       ├── documents.jsx              ← v1.6: Generar BL wired
│       ├── mailing-compose.jsx        ← v1.6: Programar + Adjuntar wired
│       ├── mailing-config.jsx        ← v1.6: OAuth Google/Microsoft wired
│       ├── mailing-logs.jsx           ← v1.6: lee emailsSent del bridge
│       └── venezuela-catalog.jsx      ← (Despacho) 24 estados + IPOSTEL
├── nuevo/
│   ├── CHANGELOG.md                   ← bitácora completa hasta v1.6
│   └── modules/
│       ├── label-generator.jsx        ← v1.4 + v1.4.1: etiquetas suppliers CN
│       ├── wiring.jsx                 ← v1.6: modals globales (DTDWiring singleton)
│       ├── qr-queue.jsx               ← v1.5: storage listener
│       └── dashboard.jsx              ← v1.6: RecentActivityWidget clickeable (override)
├── portal/
│   └── registro.jsx                   ← v1.5: nextMarkbox + sendWelcomeEmail + UI feedback
├── operario/
│   ├── bodeguero-despacho.jsx         ← (Despacho) Vista 3 mobile
│   └── camionero.jsx                  ← (Despacho) transportista mobile
└── _standalones/                      ← shells del sandbox · NO van al repo Next.js
    ├── Despacho · Vista 1.html
    ├── Despacho · Vista 2.html
    ├── Despacho · Vista 3.html
    ├── Admin · Rutas.html
    └── Camionero.html
```

---

## ⚠ Notas para Claude Code

1. **Leé los 6 docs en orden:** README → INVENTORY → CHANGELOG → BRIEFS → DATA-MODEL → CONNECTIONS.
2. **No incluyo scripts compartidos NO modificados** (`tokens.css`, `icons.jsx`, `components.jsx`) — el repo Next.js ya los tiene.
3. **Sí incluyo `erp/data.jsx` completo** — fue tocado durante Despacho legacy (campo `description` en `WAREHOUSE_CN`).
4. **No incluyo módulos v1.0 que NO se tocaron hoy ni en Despacho legacy** (shipments, quotes, tracking, calendar, ve, seniat, tms, suppliers, invoices, leads, reports, costing, tarifas, vault, users, comments, quick-email, mailing-templates/signatures/rules, conciliacion, contabilidad, audit-log, qr-queue, etc.) — el repo Next.js los tiene a su versión correspondiente.
5. **Stubs no-op sugeridos** para dependencias no portadas — ver `CHANGELOG.md` y `CONNECTIONS.md`.

---

## 🚀 Para empezar

```bash
# 1. Leer docs en orden
cat handoff/SDD-2026-05-25-sesion/README.md
cat handoff/SDD-2026-05-25-sesion/INVENTORY.md
cat handoff/SDD-2026-05-25-sesion/CHANGELOG.md

# 2. Por cada feature, leer su brief
ls handoff/SDD-2026-05-25-sesion/BRIEFS/
cat handoff/SDD-2026-05-25-sesion/BRIEFS/01-despacho.md
# ... etc

# 3. Para entender shapes y stores:
cat handoff/SDD-2026-05-25-sesion/DATA-MODEL.md

# 4. Para entender dependencias cross-module:
cat handoff/SDD-2026-05-25-sesion/CONNECTIONS.md

# 5. Portar archivos uno por uno · orden sugerido:
#    a. erp/data-bridge.jsx        (base · todos los demás dependen)
#    b. erp/od-bridge.jsx          (pipeline ODs)
#    c. erp/data.jsx               (description en WAREHOUSE_CN)
#    d. erp/shell.jsx              (sidebar entries + user menu wires)
#    e. nuevo/modules/wiring.jsx   (modals globales · cargado antes de los wires)
#    f. erp/modules/* (en orden alfabético, o por feature según convenga)
#    g. nuevo/modules/* (label-generator, qr-queue, dashboard)
#    h. portal/registro.jsx
#    i. operario/bodeguero-despacho.jsx + camionero.jsx
#    j. DTD Studio · ERP.html (script tags + moduleMap + mount host)

# 6. Validar:
#    - Sidebar OPERACIÓN: Despacho · Reglas · Dashboard despacho · Etiquetas CN
#    - Crear OD en Vista 1 → propaga al bridge → aparece en Vista 3 + Transportista
#    - Click "Mi perfil" en user menu → modal con 3 tabs
#    - Click "Generar BL" en Documentos → flow embarque → tipo → preview
#    - Eval `window.DTDData.nextMarkbox()` → string DTD-XXXX válido
#    - Eval `window.DTDData.sendWelcomeEmail({markbox:'DTD-9999',name:'T',email:'t@t.com'})`
#      → entry persistido en emailsSent · aparece en Mailing → Logs
```
