# Prompt para Claude Code · DTD-Cargo v1.3

> Pegale esto a Claude Code al iniciar la sesión. Le explica qué trabajo hay hecho, dónde vive cada cosa, y qué reglas seguir.

---

## Contexto del proyecto

Sos parte del proyecto **DTD-Cargo**, un ERP completo para una empresa freight forwarder venezolana que opera entre China y Venezuela (rutas DDP, agentes aduanales SENIAT, flota propia VE, almacenes en Yiwu/Guangzhou, recepción de pagos USD/VES/USDT/CNY).

El proyecto tiene **2 generaciones de archivos** que conviven en este momento:

### 1. v1.0 — archivos viejos (NO TOCAR · solo referencia)

Es el ERP original entregado en sesiones previas con Claude Design. Está congelado.

```
DTD-Cargo/
├── DTD Studio · ERP.html              ← ERP principal (admin web)
├── Portal del Cliente.html
├── Brand Book DTD v3.0.html
├── Operario CN.html
├── Operario VE.html
├── Almacenista VE.html
├── Operario Multi.html
├── Mobile ERP.html                    ← ⚠ Nuevo (v1.3) · vive en raíz por convención
├── erp/
│   ├── tokens.css                     ← tokens de diseño (light + dark) · NO CAMBIAR
│   ├── data.jsx                       ← mock data global (window.ERPData)
│   ├── icons.jsx                      ← set de iconos SVG (window.Icon)
│   ├── components.jsx                 ← UI primitives (window.ERPUI)
│   ├── shell.jsx                      ← sidebar + topbar + router
│   ├── tweaks-panel.jsx
│   └── modules/                       ← 21 módulos del ERP original
├── operario/                          ← apps móviles para operarios
│   ├── app.jsx                        ← Operario CN
│   ├── ve.jsx                         ← Operario VE
│   └── almacenista.jsx
└── portal/
    └── app.jsx                        ← Portal del Cliente
```

**Regla #1:** estos archivos **NO los toques**. Asumí que cualquier cambio que necesites hacer ya fue absorbido o re-implementado en `nuevo/` durante v1.1+. Si pensás que necesitás modificar uno, **avisame primero** explicando por qué.

### 2. v1.1 → v1.3 — archivos nuevos (acá trabajás)

Todo lo construido después del handoff inicial vive en `nuevo/`. Es la versión actual y es lo que vas a modificar.

```
nuevo/
├── README.md                          ← reglas detalladas de la carpeta
├── CHANGELOG.md                       ← bitácora de TODOS los cambios v1.1+
├── PROMPT-CLAUDE-CODE.md              ← este archivo
├── rates.jsx                          ← helper global de tasas USD/VES/CNY (window.ERPRates)
├── feature-flags.jsx                  ← estado global de feature flags (window.DTDFlags)
├── modules/
│   ├── dashboard.jsx                  ← override del Dashboard del ERP · con editor de KPIs/widgets
│   ├── qr-queue.jsx                   ← módulo nuevo · Cola de QR (oficina)
│   ├── conciliacion.jsx               ← módulo nuevo · Conciliación bancaria
│   ├── audit-log.jsx                  ← módulo nuevo · Audit log con drill-down
│   ├── contabilidad-data.jsx          ← plan de cuentas + asientos seed + helpers
│   └── contabilidad.jsx               ← módulo nuevo · Contabilidad QuickBooks-like
├── pantallas/                         ← HTML standalone (perfiles, estados de cuenta)
│   ├── chofer-perfil.html + .jsx
│   ├── camion-perfil.html + .jsx
│   ├── agente-perfil.html + .jsx
│   └── estado-cuenta.html + .jsx      ← estado de cuenta detallado del cliente
└── mobile/
    └── app.jsx                        ← Mobile ERP (cargado por `Mobile ERP.html` en raíz)
```

**Regla #2:** **todo lo nuevo va a `nuevo/`.** Si por convención "debería" ir a `erp/modules/`, primero pasa por `nuevo/modules/`. La consolidación a v1.0 es una acción explícita que decide el dueño del proyecto, no automática.

---

## ¿Qué ya está hecho?

**Lee `nuevo/CHANGELOG.md` de cabo a rabo antes de empezar.** Cada entrada describe qué se construyó, qué archivos viejos se tocaron (con número de línea), y qué quedó como TODO.

Resumen rápido por sprint:

### Sprint A · Visuales nuevas ✅
- **A1** Editor de Dashboard · drawer con catálogo de 14 KPIs y 7 widgets + drag-to-reorder + persistencia
- **A2** Cola de impresión QR (vista oficina) · módulo nuevo bajo OPERACIÓN
- **A3** Perfil de Chofer · HTML standalone con 7 perfiles
- **A4** Perfil de Camión · HTML standalone con 7 perfiles
- **A5** Perfil de Agente Aduanal · HTML standalone con 4 perfiles

### Sprint B · Conexiones funcionales ✅
- **B1** Feature flags realmente ocultan módulos del sidebar (SENIAT, Vault, Cola de QR, Audit log)
- **B2** Cola QR conectada Operario CN ↔ ERP via localStorage compartido
- **B3** Click en cards de TMS/SENIAT abre los perfiles standalone

### Sprint C · Profundidad ✅
- **C1** Estado de cuenta detallado del cliente · standalone con cuenta corriente, aging, mensual, métodos de pago, condiciones de crédito
- **C2** Conciliación bancaria · módulo nuevo con auto-matching + confidence
- **C3** Audit log con drill-down · módulo nuevo con drawer de 5 tabs (Resumen, Diff campos, Actor, Relacionados, JSON)

### Extras v1.1.1 → v1.3 ✅
- **VES en estado de cuenta** · banner de tasas, equivalentes Bs. en KPIs y movimientos, nueva sección "Transacciones en Bolívares" con tasa registrada por movimiento
- **Regla de moneda extendida** en Brand Book (USD + VES + Conversión + Tasa)
- **Módulo Contabilidad** estilo QuickBooks Online · plan de cuentas freight-forwarder VE (52 cuentas en 4 niveles), libro diario, libro mayor, P&L, Balance General, Flujo de caja, Margen por embarque, lock con contraseña + sesión 30 min
- **Mobile ERP** · 5 pantallas (Inicio, Tracking, Clientes cerca, Gastos rápidos, Más), travel banner, modal de nuevo gasto USD/VES/CNY con foto/categoría/embarque/cobrable

---

## Cómo se integran las cosas

### Carga de scripts en `DTD Studio · ERP.html`

El orden importa:
```html
<!-- Foundation viejo -->
<script src="erp/icons.jsx"></script>
<script src="erp/data.jsx"></script>
<script src="erp/components.jsx"></script>
<script src="nuevo/feature-flags.jsx"></script>    ← v1.1 · expone window.DTDFlags
<script src="nuevo/rates.jsx"></script>             ← v1.1.1 · expone window.ERPRates
<script src="erp/shell.jsx"></script>
<script src="erp/tweaks-panel.jsx"></script>

<!-- Módulos viejos -->
<script src="erp/modules/dashboard.jsx"></script>
... etc

<!-- Overrides v1.1+ (cargados último para ganarle a los viejos) -->
<script src="nuevo/modules/dashboard.jsx"></script>     ← reemplaza window.ModuleDashboard
<script src="nuevo/modules/qr-queue.jsx"></script>
<script src="nuevo/modules/conciliacion.jsx"></script>
<script src="nuevo/modules/audit-log.jsx"></script>
<script src="nuevo/modules/contabilidad-data.jsx"></script>
<script src="nuevo/modules/contabilidad.jsx"></script>
```

Cada módulo nuevo expone `window.ModuleXyz` y se conecta en el `moduleMap` del bootstrap del ERP.

### Tokens, componentes e iconos

**Siempre vienen de v1.0.** No los dupliques en `nuevo/`. Si necesitás un componente nuevo y reusable, podés:
1. Definirlo dentro del módulo nuevo (más simple)
2. O agregarlo a `erp/components.jsx` exponiéndolo en `window.ERPUI` (modificación a viejo → anotar en CHANGELOG)

### Mock data nueva

Por defecto va inline en el módulo nuevo que la usa (ver `JOURNAL_ENTRIES` en `nuevo/modules/contabilidad-data.jsx`). Al consolidar a v1.0, se mueve a `erp/data.jsx` y se expone en `window.ERPData`. Hay varios TODO de "mover a data.jsx al consolidar" anotados.

### localStorage keys ya en uso

- `dtd_dashboard_config_v1` · config del editor de Dashboard
- `dtd_dashboard_hide` · ojo de ocultar valores
- `dtd_qrqueue_v1` · cola de QR (compartida con Operario CN)
- `dtd_feature_flags_v1` · estado de feature flags
- `dtd_rates_v1` · tasas BCV/Paralelo/CNY
- `dtd_reconcile_v1` · decisiones de conciliación
- `dtd_contab_v1` · lock de contabilidad
- `dtd_mobile_v1_expenses` · gastos cargados desde mobile
- `dtd_mobile_v1_user` · persona activa en mobile

---

## Reglas de marca · NO romper

Antes de cualquier cambio visual, leé `CLAUDE.md` en la raíz. Resumen de las 5 reglas que no se rompen:

1. **Solo tokens CSS** (`var(--*)`). Cero hex inventados. Los tokens viven en `erp/tokens.css` (no tocar).
2. **Solo fuentes Archivo + JetBrains Mono + Noto Sans SC**. Nada más.
3. **Cero AI slop:** sin gradientes coloridos, sin emojis decorativos (excepto los de categoría de gastos del Mobile que son contextualmente correctos), sin glassmorphism, sin shadcn defaults.
4. **Componentes del sistema primero** (`window.ERPUI.Btn`, `Input`, `Select`, `Badge`, `Card`, `Table`, `KPI`, `Drawer`, `Modal`, `Tabs`, `Avatar`, `Progress`, `EmptyState`, `Field`). Si inventás uno nuevo, dejá comentario `/* TODO: brand-review */`.
5. **Avisar antes de violar** una regla de marca con formato `🛑 BRAND-CHECK` (ver CLAUDE.md).

Si te piden algo sin diseño aprobado, mostrá el formato `🎨 DESIGN-CHECK` (también en CLAUDE.md).

---

## Cómo trabajar

### Workflow estándar

1. **Leer 4 archivos al iniciar cada sesión:** `CLAUDE.md`, `HANDOFF.md`, `nuevo/README.md`, `nuevo/CHANGELOG.md`. No los resumas, leelos enteros.
2. **Antes de modificar nada, decir qué vas a tocar y por qué.**
3. Cada archivo **nuevo** va a `nuevo/<subcarpeta>/`.
4. Si tocás un archivo **viejo** (poco recomendable hoy), hacé el cambio mínimo y anotalo en `nuevo/CHANGELOG.md` con archivo + línea + razón.
5. Después de un cambio, andá a `nuevo/CHANGELOG.md` y agregá una entrada arriba de todo (formato consistente con las existentes).

### Si te piden modificar lo viejo

Casi siempre la respuesta correcta es **portar a `nuevo/`**, no editar `erp/` o las apps viejas. Antes de tocar v1.0, **preguntá** y proponé la alternativa de override en `nuevo/`.

### Convenciones de código

- React + JSX inline (no JSX module mode). Componentes con PascalCase.
- Estilos: **inline styles con tokens CSS** o classes del sistema. **No** Tailwind, **no** CSS-in-JS libs.
- Archivos `.jsx` cargados via `<script type="text/babel" src=...>`.
- Cada componente reutilizable global se expone en `window.*`.
- Mock data realista de DTD-Cargo: rutas CN→VE, MARKBOX `DTD-XXXX`, containers `DTDU-XXXXXX`, RIF venezolano (`J-NNNNNNN-N`), nombres verosímiles.
- Moneda según Brand Book (Brand Book DTD v3.0.html):
  - `USD 4.820` (sin decimales · . miles)
  - `Bs. 175.640` (sin decimales · . miles · prefijo Bs.)
  - Tasa con coma decimal: `BCV 36,45 · Paralelo 37,20`

---

## TODOs abiertos (lo que puede pedirse a continuación)

De `nuevo/CHANGELOG.md`, lo que quedó pendiente:

### Contabilidad
- Conectar "Nueva factura"/"Registrar pago"/"Registrar gasto" del dashboard con flujos del ERP
- Cada cambio (crear/editar/eliminar asiento) debería pushear al audit log
- Form de nuevo asiento manual (drawer con líneas dinámicas + verificación de cuadre)
- Diferencia cambiaria automática al cierre mensual
- Vincular pagos del módulo Conciliación bancaria a asientos automáticos
- Mover JOURNAL_ENTRIES y CHART_OF_ACCOUNTS a `erp/data.jsx`

### Tasas de cambio
- Wirear `Admin → Tasas de cambio` (`SectionRates` en `erp/modules/admin.jsx`) para que escriba a `window.ERPRates.write()` cuando se hace override manual o termina el scrape BCV. Hoy solo lee defaults.

### Mobile ERP
- Cámara real (`getUserMedia`) para foto del recibo
- Geolocation API real en Clientes cerca
- Aprobaciones en línea
- Push notifications
- **Sync de gastos mobile → asiento contable automático** (gasto rápido → Db cuenta del catálogo según categoría / Cr Banco)

### Perfiles standalone
- Wirear onClick en `tms.jsx` (DriversTab + FleetTab) y `seniat.jsx` (AgentsTab) para abrir los perfiles. **YA HECHO en B3**, ignorar si lo encontrás otra vez.
- Wirear botón "Estado de cuenta" en el detalle de cliente del módulo `erp/modules/clients.jsx`.

### Cola QR
- Storage listener (`window.addEventListener('storage', ...)`) en `nuevo/modules/qr-queue.jsx` para refresh en tiempo real cuando Operario CN agrega una orden.

### Backlog general (del HANDOFF original)
- Perfil individual de Usuario (al click en @mención)
- Bandeja "Tu día" cross-módulo
- Vista "modo cliente real" (preview ERP filtrado por cliente externo)
- Modal "Adjuntar archivo" rico
- AI Copilot conversacional
- Bell notifications clickeable
- Persistencia del `hideValues` aplicado a tablas y gráficos (hoy solo KPI hero)
- Drag de eventos en Calendar
- Editor de incidencias en TMS

---

## Empezá por

Cuando arranques, contame:

1. Qué archivos del paso anterior pudiste leer (CLAUDE.md, HANDOFF.md, nuevo/README.md, nuevo/CHANGELOG.md).
2. En qué TODO querés enfocarte primero, o si tenés un pedido distinto.
3. Si tenés alguna duda sobre la separación v1.0 / nuevo/ antes de empezar.

**No generes nada hasta confirmar.**
