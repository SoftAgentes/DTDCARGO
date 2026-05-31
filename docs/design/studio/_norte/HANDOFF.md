# DTD-Cargo · Handoff a Claude Code

> **Para Claude Code:** este archivo se lee al inicio de cada sesión junto con `CLAUDE.md`. Define qué está diseñado, qué falta y la regla de oro: **NO inventes pantallas sin diseño**.

> **⚠ NOMENCLATURA / CODIFICACIÓN OPERATIVA:** El registro de cliente (`portal/registro.jsx` + `Registro Cliente.html`) muestra una **guía visual de codificación** (formato de etiqueta, numeración Box X/Y, instrucciones a proveedor chino). Esto es un resumen amigable — **las reglas oficiales completas de nomenclatura** (formato MARKBOX, secuencial, validación, plantillas de etiquetas, packing list, identificadores DTD-XXXX / DTDU-XXXXXX / CN-XXXX-XXXX, etc.) están especificadas en `CLAUDE.md` y docs internos de este proyecto. Antes de implementar lógica real (generación de código, emails de bienvenida con guía adjunta, generación de etiquetas PDF para suppliers), **leer primero la nomenclatura oficial** y alinear `portal/registro.jsx` si difiere.

---

## 🟢 ESTADO ACTUAL · v1.9 (2026-05-31) — LEÉ ESTO PRIMERO

> Las secciones de "lo que falta" más abajo en este archivo son **históricas (v1.1)** y quedaron desactualizadas. **La fuente de verdad del estado real es `nuevo/CHANGELOG.md` + `PROMPT-proxima-sesion.md`.** Leé esos dos antes de tocar nada para no rehacer trabajo ya hecho.

**Releases entregados desde v1.1:**

| Versión | Qué se construyó |
|---|---|
| **v1.2** | Módulo **Contabilidad** (QuickBooks-like: plan de cuentas, libro diario/mayor, P&L, balance, lock de período) |
| **v1.3** | **Mobile ERP** (vista móvil del usuario admin) + fix dark mode |
| **v1.4 / v1.4.1** | **Generador de etiquetas PDF** bilingüe ES/中文 para suppliers CN (×1–×4 copias por caja) |
| **v1.5** | Validación MARKBOX server-side + email bienvenida real + cross-links cliente + **Cola de QR** con storage listener |
| **v1.6** | **9 conexiones wireadas** (`nuevo/modules/wiring.jsx`): Adjuntar · Programar · Mi perfil · Cambiar contraseña · Atajos · **Generar BL** · OAuth · sync HS/AES · Actividad reciente clickeable · Mailing Logs |
| **v1.8** | **Gestor de columnas reutilizable** (6 tablas) + **ROLE_MODULES** completo (permisos por rol) + fix crítico de render (`.erp-route`) + Logo Oficial 2 grupos |
| **v1.9** | **5 pantallas nuevas** (perfil de usuario, Tu día, Modo cliente, hilo de comentario, AI Copilot) + **wiring** al ERP (topbar, menú usuario, tabla Usuarios, comentarios) |

**Además se construyó (ver CHANGELOG para detalle):** concepto **Plataforma + Super Admin** (separado de Administrador de Tenant), **modo despacho** de contenedor + parciales, alertas de **cierre de contenedor / BL** a 50 CBM, **escaneo por grupo**, etiquetado de mercancía peligrosa/frágil/marca/licencia, **traducción 中文** de plataforma, módulo **Operarios PWA**, **Conciliación bancaria**, **Vault**, perfiles individuales (chofer/camión/agente).

**⚠️ Bug resuelto en v1.8 — NO reintroducir:** la animación `.erp-route` NO debe hacer fade de opacity (0→1); usa solo `translateY` con `fill-mode: both`. El fade se congelaba en `opacity:0` y dejaba TODO el contenido invisible.

---

## 📌 v1.1 · CONTINUIDAD DEL PROYECTO

**Este chat es una continuación.** El proyecto DTD-Cargo ya tiene una primera versión completa (v1.0) entregada en sesiones previas. **No se rehace, no se migra, no se reescribe nada de lo existente.** Solo se trabaja sobre lo **nuevo** o sobre cambios pedidos explícitamente.

### Qué significa en la práctica

- ✅ **SÍ:** agregar pantallas nuevas que faltan (ver sección "Lo que falta diseñar"), wirear funcionalidad que existe visual pero no funciona, pulir detalles puntuales.
- ❌ **NO:** rehacer módulos que ya están listos, reescribir `erp/components.jsx` o `erp/tokens.css`, cambiar la estructura de carpetas, "modernizar" pantallas sin pedido explícito.
- ❌ **NO:** crear archivos paralelos tipo `ERP v2.html` o `components-new.jsx`.

### 📦 Dónde van los archivos nuevos · carpeta `nuevo/`

Todo lo que se cree de aquí en adelante va a **`nuevo/`**, no a la raíz. Esto evita que dos entornos (Claude Design + Claude Code) editen los mismos archivos en paralelo y se pisen.

```
nuevo/
├── README.md          ← reglas detalladas
├── CHANGELOG.md       ← bitácora: qué se hizo + qué archivos viejos se tocaron
├── modules/           ← módulos nuevos del ERP
├── pantallas/         ← HTMLs nuevos standalone (perfiles, vistas aisladas)
├── operario/          ← screens nuevos para apps móviles
└── portal/            ← screens nuevos para el portal
```

**Reglas:**

1. Cada archivo nuevo va a `nuevo/<subcarpeta>/`. Aunque por convención "debería" ir a `erp/modules/foo.jsx`, primero pasa por `nuevo/modules/foo.jsx`. El usuario decide cuándo consolidar a v1.0.
2. **Si tenés que tocar un archivo viejo** (ej. agregar un `<script src="nuevo/modules/qr-queue.jsx">` a `DTD Studio · ERP.html`, sumar un ítem al sidebar en `shell.jsx`), hacelo con el mínimo cambio posible **y anotalo en `nuevo/CHANGELOG.md`** indicando archivo + línea + razón.
3. Los tokens, componentes, iconos y data siguen viniendo de `erp/tokens.css`, `erp/components.jsx`, `erp/icons.jsx`, `erp/data.jsx`. **No duplicar esos archivos en `nuevo/`.**
4. Antes de modificar cualquier archivo de la raíz, leé `nuevo/README.md`.

### Estructura de carpetas (ya consolidada · no mover)

```
DTD-Cargo/
├── CLAUDE.md                       · Reglas de marca (no negociables)
├── HANDOFF.md                      · Este archivo
├── Reporte DTD-Cargo.html          · Contexto de operación del negocio
├── Brand Book DTD v3.0.html        · Manual de marca
├── DTD Studio · ERP.html           · ERP principal (admin)
├── Portal del Cliente.html         · Portal externo (cliente)
├── Operario CN.html                · Mobile recepción China
├── Operario VE.html                · Mobile chofer Venezuela
├── Bodeguero VE.html               · Mobile bodega Venezuela
├── Operario Multi.html             · Mobile multi-rol
├── erp/
│   ├── tokens.css                  · Design tokens (light + dark) · NO TOCAR
│   ├── data.jsx                    · Mock data (window.ERPData)
│   ├── icons.jsx                   · Set de iconos SVG (window.Icon)
│   ├── components.jsx              · UI primitives (window.ERPUI)
│   ├── shell.jsx                   · Sidebar + topbar
│   ├── tweaks-panel.jsx            · Panel de tweaks
│   └── modules/                    · 21 módulos del ERP (un .jsx c/u)
├── operario/
│   ├── app.jsx                     · Operario CN
│   ├── ve.jsx                      · Operario VE
│   └── bodeguero.jsx               · Bodeguero VE
└── portal/
    └── app.jsx                     · Portal del Cliente
```

### Cómo agregar cosas nuevas

- **Pantalla nueva en el ERP:** crear `nuevo/modules/<nombre>.jsx` siguiendo la convención de los existentes en `erp/modules/`. Para que aparezca en el ERP, agregar el `<script src="nuevo/modules/<nombre>.jsx">` a `DTD Studio · ERP.html` y el ítem de sidebar en `shell.jsx` — anotando los dos cambios en `nuevo/CHANGELOG.md`.
- **HTML standalone nuevo** (perfiles, vistas aisladas): va a `nuevo/pantallas/<nombre>.html`.
- **Componente nuevo reusable:** si es chico y muy específico, queda local al módulo. Si realmente se va a reusar, se agrega a `erp/components.jsx` exponiéndolo en `window.ERPUI` (eso es modificar archivo viejo → anotar en CHANGELOG).
- **Mock data nueva:** sumar al `erp/data.jsx` exponiéndolo en `window.ERPData` (anotar en CHANGELOG). Nombres y valores realistas de DTD-Cargo (MARKBOX `DTD-XXXX`, embarques `DTDU-XXXXXX`, clientes VE).
- **Iconos:** sumar al `erp/icons.jsx` (anotar en CHANGELOG). No usar emojis ni librerías externas.

---

## 🚦 REGLA DE ORO

**Si te piden modificar/crear algo que NO tiene diseño aprobado en este handoff**, antes de codear mostrá este aviso:

```
🎨 DESIGN-CHECK

Lo que pediste:    <descripción>
Estado actual:     ❌ No hay diseño aprobado para esto
Recomendación:     Diseñar primero en Design para mantener
                   consistencia visual (paleta, tipografía,
                   componentes del sistema).

¿Querés:
A) Diseñar primero en Design y volver acá con el mockup
B) Que yo lo construya intentando seguir el sistema, con
   riesgo de inconsistencia (queda como deuda de diseño)
```

Esperá confirmación antes de aplicar B.

---

## ✅ LO QUE ESTÁ DISEÑADO Y ENTREGADO

### Archivos principales (16 totales)
- `DTD Studio · ERP.html` — ERP completo (admin)
- `Portal del Cliente.html` — portal externo
- `Brand Book DTD v3.0.html` — manual de marca
- `Operario CN.html` — app móvil recepción China
- `Operario VE.html` — app móvil chofer Venezuela
- `Bodeguero VE.html` — app móvil bodega Venezuela
- `Operario Multi.html` — app móvil multi-rol

### Módulos del ERP (con diseño completo)
1. **Dashboard** (con ojo ocultar valores 👁)
2. **Embarques** (Tabla + Kanban + drawer detalle)
3. **Tracking** (mapa + timeline)
4. **Calendario** operativo (mes/semana/agenda + feriados CN/VE)
5. **Almacén CN** (con scope, traductor, parciales)
6. **Almacén VE** (con scope)
7. **TMS · Transporte** (flota + choferes + rutas + GPS + incidencias)
8. **Cotizador** (calculadora en vivo)
9. **Clientes & MARKBOX** (con estados color)
10. **CRM · Leads** (Kanban + Tabla + Timeline + drawer)
11. **Proveedores CN** (con contactos WeChat, ratings)
12. **Tarifas**
13. **Facturación** (con links)
14. **Documentos**
15. **Reportes** (7 tabs por área)
16. **Costing & Margen** (con editor, templates por ruta, USD/VES, forecast)
17. **Aduana SENIAT · Workflow**
18. **Mailing** (Templates · Firmas · Compose · Reglas · Config · Logs)
19. **Vault** (caja fuerte con master password)
20. **Usuarios** (con scope por almacén)
21. **Administración** (Casos de uso ON/OFF + 11 secciones)

### Apps móviles (con flow completo)
- Operario CN: recepción + fotos + HS detector + traductor + QR print
- Operario VE: carga + GPS + docs + firma + POD + parciales
- Bodeguero VE: recibir contenedor + armar camión + WhatsApp a externos
- Operario Multi: picker + previews de modos

### Cross-módulo
- Quick Email modal (window.openQuickEmail)
- Comments con @menciones
- Scope por rol/almacén con "Ver como…"
- Theme light/dark + densidades

---

## ❌ LO QUE FALTA DISEÑAR (pendiente para próxima sesión en Design)

> **⚠️ HISTÓRICO v1.1 — DESACTUALIZADO.** Varios de los ítems de abajo **YA se construyeron** en v1.2–v1.9 (Cola de QR, Conciliación bancaria, Editor de Dashboard, perfiles individuales, feature flags reales, Generar BL, Adjuntar/Programar/OAuth, etc.). **No uses esta lista como pendientes reales** — consultá `nuevo/CHANGELOG.md` y la sección "PENDIENTES" de `PROMPT-proxima-sesion.md`. Se conserva solo como registro del estado en v1.1.

### 🔴 Visuales que NO existen todavía

1. **Perfil individual de Chofer** — al click en card de chofer en TMS
2. **Perfil individual de Camión** — al click en patente AC542XK
3. **Perfil individual de Agente Aduanal** — al click en card en SENIAT
4. **Perfil individual de Usuario** — al click en @mención en comments o en owners de Vault
5. **Cola de impresión QR · vista oficina** — donde la oficina ve las órdenes de impresión que Operario CN mandó
6. **Editor de Dashboard** — drawer para configurar qué KPIs mostrar (eligibles por usuario)
7. **Bandeja unificada de tareas** — "Tu día" cross-módulo
8. **Estado de cuenta detallado del cliente** — vista profunda en detalle Cliente
9. **Conciliación bancaria** — subir extracto bancario + match con facturas
10. **Vista "modo cliente real"** — preview de cómo se ve el ERP filtrado por cliente externo
11. **Detalle de comentario individual / hilo expandido**
12. **Modal "Adjuntar archivo" rico** — hoy solo tiene botón placeholder
13. **AI Copilot conversacional** — modal de chat dentro del ERP
14. **Vista de auditoría profunda** — drill-down en un registro afectado del audit log

### 🟡 Funcionalidad que existe visual pero NO funciona

- Toggles del panel "Casos de uso ON/OFF" **no esconden** módulos del ERP (solo visual)
- Cola de impresión QR no existe en el ERP (la app móvil manda la orden pero nadie la recibe)
- "Atajos de teclado" en menú de usuario — no abre nada
- "Programar" en Compose de Mailing — no abre date picker
- "Adjuntar" en varios composes — no abre file picker
- "Cambiar contraseña" / "Mi perfil" — botones sin destino
- "Conectar con Google/Microsoft" en SMTP setup — no hace OAuth real
- Botones de "Sincronizar" en HS/AES — animación visual nomás
- "Generar BL" en Documentos — sin flow de generación

### 🟢 Mejoras de pulido pendientes

- Dashboard → "Actividad reciente" clickeable (3 items ya wirearon en intento previo, revisar)
- Topbar → bell notifications clickeables
- Aplicar `hideValues` también a tablas y gráficos (hoy solo KPI hero)
- Persistencia del ojo en localStorage
- TMS → editor de incidencias
- Costing → comparativa mes vs mes anterior además de YTD
- Suppliers → sección "Embarques históricos" de este supplier
- Calendar → drag de eventos para reprogramar
- Vault → exportar credenciales cifradas a archivo

---

## 📋 ORDEN SUGERIDO PARA PRÓXIMAS SESIONES

### Sprint A · Visuales que faltan
1. Editor de Dashboard + persistencia
2. Cola de impresión QR (vista oficina)
3. Perfiles individuales (chofer + camión + agente)

### Sprint B · Conexiones funcionales
4. Wirear feature flags (Casos de uso ON/OFF) realmente
5. Conectar app móvil → ERP en tiempo real (push de recepciones, POD, etc.)
6. Cola de impresión QR conectada a Operario CN

### Sprint C · Profundidad
7. Estado de cuenta detallado del cliente
8. Conciliación bancaria
9. Audit log con drill-down
10. AI Copilot

---

## 🎨 REGLAS QUE NO SE ROMPEN (recordatorio)

Ver `CLAUDE.md` para detalle. Resumen:
1. Solo tokens CSS (`var(--*)`) — cero hex inventados
2. Solo fuentes Archivo + JetBrains Mono + Noto Sans SC
3. Cero AI slop (gradientes coloridos, emojis decorativos, glassmorphism)
4. Componentes del sistema primero (`<Btn>`, `<Input>`, etc.)
5. **Avisar antes de inventar** con formato `BRAND-CHECK` o `DESIGN-CHECK`

---

## 🚀 STACK

Ver bloque **"v1.1 · CONTINUIDAD DEL PROYECTO"** arriba para la estructura de carpetas completa y la convención para agregar cosas nuevas.
