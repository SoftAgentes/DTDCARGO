# Changelog · v1.1+

Cada entrada describe qué se hizo en esta sesión y qué archivos viejos (si alguno) se tocaron.

Formato:

```
## YYYY-MM-DD · <título corto>

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/foo.jsx
- nuevo/pantallas/bar.html

**Archivos viejos modificados (línea + razón):**
- erp/shell.jsx · línea ~140 · agregado ítem de sidebar para "QR Print Queue"
- DTD Studio · ERP.html · línea ~85 · agregado <script src="nuevo/modules/qr-queue.jsx">

**Notas:** ...
```

---

<!-- Las entradas nuevas se agregan acá arriba -->

## 2026-05-24 · v1.3 · Mobile ERP · vista móvil para usuario ERP

**Archivos nuevos:**
- `Mobile ERP.html` (en raíz, igual que Operario CN/VE) — Shell mobile-first. Carga `erp/icons.jsx`, `erp/data.jsx`, `nuevo/rates.jsx` y el app JSX.
- `nuevo/mobile/app.jsx` — App completa con 5 pantallas + bottom nav:
  - **Top bar** sticky con logo, contexto del usuario, ícono mail con badge, avatar
  - **Bottom nav** de 5 ítems: Inicio · Tracking · Clientes · Gastos · Más
  - **HomeScreen**:
    - Saludo personalizado + status del día
    - **Travel banner** si el usuario está en viaje (CN): "Yiwu · 4to día" + botón directo "Cargar gasto del viaje"
    - 4 KPIs en grid 2×2 (embarques activos, facturas vencidas, leads, gastos hoy)
    - 4 quick actions (Cargar gasto, Clientes cerca, Tracking, Aprobar)
    - Feed de actividad reciente
  - **TrackingScreen**:
    - Search bar + lista de embarques activos como cards
    - Cada card: ID + cliente + ruta (CN → VE) + progreso + ETA + status badge + alert tone si aplica
    - Tap → sheet con **mapa mock SVG** (origen→destino con punto del barco en curva animable), 6 fields, botones "Compartir status" (deeplink WhatsApp) y "Ver completo"
  - **ClientsScreen** ("Cerca tuyo"):
    - Toggle `📍 Cerca tuyo · Todos · 187`
    - Banner de geo-permission mock con ubicación del user
    - Search bar
    - Lista de clientes con avatar + MARKBOX + ciudad + **distancia mock** (m/km, tone "cerca/lejos") + chip de embarques/facturado + 3 botones de acción: Llamar (tel:), WhatsApp (deeplink con texto pre-armado), Visitar
  - **ExpensesScreen** + **NewExpenseModal**:
    - Botón flotante `+` en el header
    - 2 summary cards: Total (USD + Bs. ref) · Cobrable al cliente
    - Toggle "Míos · Equipo"
    - Lista de gastos con icono emoji por categoría (taxi, comida, hotel, vuelo, peaje, combustible, aduana, visita, otro), monto en moneda original + equiv USD si no es USD, chip COBRABLE
    - **NewExpenseModal** (full-screen sheet desde abajo):
      - Placeholder de foto de recibo
      - Input grande de monto + selector USD/VES/CNY
      - Chips de 9 categorías (con tone por tipo)
      - Selector de método (Efectivo/Tarjeta/Transfer/USDT)
      - Selector de embarque asociado (opcional, lista de activos)
      - Textarea de nota
      - Toggle "Cobrable al cliente" con feedback visual
      - Guarda a localStorage (`dtd_mobile_v1_expenses`) con auto-numeración EXP-2026-NNNN, asocia ubicación del usuario
  - **MoreScreen**:
    - Card de usuario con avatar grande, rol, ubicación
    - **Demo · cambiar usuario** (Carlos Admin · Martina Comercial en viaje CN · Yusneidy Ops)
    - Menú herramientas (Notificaciones [12], Aprobaciones [3], Documentos, Audit log, Cotizador rápido, Reportes)
    - Menú ajustes (Mi perfil, Preferencias, Cambiar contraseña, Cerrar sesión)
    - Footer build

**Personas mock** (switchables desde Más):
- `u-001` Carlos Vargas · Admin · Dueño · Valencia VE
- `u-002` Martina Acuña · Comercial · En viaje · Yiwu CN (dispara el Travel banner)
- `u-003` Yusneidy Pérez · Operaciones · Maracaibo VE

**6 gastos seed** incluyendo USD, VES y CNY · cubren peaje VE, comida CN, hotel CN, vuelo internacional, taxi CN, aduana VE — todos con location asociada.

**Diseño:**
- max-width 480px centrado, con shadow + radius en viewports anchos para preview tipo phone
- viewport-fit cover + safe-area-inset-* para iPhone notch
- Theme color navy DTD para PWA-ready
- Toda la paleta y typo del Brand Book (Archivo / Archivo Black / JetBrains Mono)
- Sin emoji decorativo en UI · solo en categorías de gasto (que es contextualmente correcto)

**Asset registrado:** "Mobile ERP".

**TODOs pendientes:**
- Wirear cámara real (getUserMedia) para foto del recibo
- Geolocation API real en Clientes cerca
- Aprobaciones en línea desde Más → Aprobaciones
- Push notifications (mock por ahora)
- Sync de gastos cargados con el módulo Contabilidad (auto-asiento como `5.1.20 Combustible` o `6.1.10 Gastos de viaje CN` según categoría)

---

## 2026-05-24 · v1.2 · Módulo Contabilidad QuickBooks-like

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/contabilidad-data.jsx` — Plan de cuentas + asientos + helpers:
  - **CHART_OF_ACCOUNTS** · 52 cuentas en 4 niveles, freight-forwarder VE editable:
    - Activo Corriente/No Corriente (bancos USD/VES/USDT, caja chica, CxC, IVA crédito, inventario en tránsito CN, flota propia)
    - Pasivo Corriente/No Corriente (CxP, anticipos, IVA débito, retenciones IVA/ISLR, sueldos, préstamos)
    - Patrimonio (capital, utilidades retenidas, resultado del ejercicio, ajuste cambiario)
    - Ingresos (flete marítimo/aéreo/DDP/seguro/almacenaje/otros)
    - Costos Directos (CGS · flete naviero/aéreo, agente aduanal, aranceles, transporte VE, almacenaje, combustible, salarios choferes)
    - Gastos Operativos (sueldos admin, alquiler, servicios, marketing, viaje a China, viáticos, comisiones bancarias, software, depreciación)
    - Otros Resultados (diferencia cambiaria ganancia/pérdida, intereses)
  - **JOURNAL_ENTRIES** · 16 asientos seed cubriendo 30 días: 3 facturas emitidas (con IVA débito separado), 2 pagos USD recibidos, 1 pago VES (con conversión + tasa registrada), 4 gastos directos (naviera, agente, salarios choferes, combustible), 4 gastos operativos, 1 asiento flagged (por clasificar)
  - **Helpers**: `getAccount`, `accountBalance` (recursivo para agregadas), `calculatePL`, `calculateBS`, `accountMovements` (libro mayor)
  - **Lock state**: `readLock`/`writeLock`/`isUnlocked` con persistencia en `localStorage` (`dtd_contab_v1`) y custom event `dtd-contab-lock`

- `nuevo/modules/contabilidad.jsx` — Módulo principal con 6 tabs estilo QuickBooks Online:
  - **Dashboard**: 4 KPIs (Ingresos / Costos / Gastos / Utilidad), grid de 6 acciones rápidas, columnas de saldos bancarios + CxC/CxP, feed de últimos 5 asientos
  - **Libro diario**: tabla filtrable por tipo (factura/pago USD/pago VES/gasto/por clasificar), drawer detalle con líneas, totales débito/crédito, banner de conversión VES→USD si aplica, badge "modo seguro" si está locked
  - **Plan de cuentas**: árbol jerárquico (level 1 en wine bold uppercase, level 2 bold, level 3 con indent), tone badge por tipo, balance actual por cuenta hoja
  - **Libro mayor**: selector de cuenta, header con tipo/movimientos/saldo, tabla con balance corrido por movimiento
  - **Reportes**: 4 sub-tabs:
    - **Estado de Resultados** (P&L) con header dark, líneas indentadas, totales por sección, equivalente VES en el footer
    - **Balance General** (BS) con check de cuadre Activo = Pasivo + Patrimonio, resultado del ejercicio inyectado automáticamente
    - **Flujo de caja** por cuenta bancaria · entradas/salidas/neto
    - **Margen por embarque** cruzado con datos de Costing (5 embarques mock con % margen tone-coded)
  - **Configuración**: panel seguridad con estado del lock (locked/unlocked-by-X-hasta-Y), ejercicio fiscal, numeración automática
  - **LockButton**: en el header del módulo, abre prompt de contraseña (mock · acepta cualquier 4+ chars), desbloquea por 30 min, persistencia + evento global

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~24 (`MODULES`) · agregado `{ id: 'contab', group: 'FINANZAS', label: 'Contabilidad', icon: 'invoice' }` entre Facturación y Conciliación
- `DTD Studio · ERP.html` · líneas ~94-95 · agregados `<script src="nuevo/modules/contabilidad-data.jsx">` y `<script src="nuevo/modules/contabilidad.jsx">` en overrides
- `DTD Studio · ERP.html` · línea ~194 · agregado `contab: window.ModuleContabilidad` al moduleMap

**Lógica contable implementada (siguiendo QuickBooks):**
- **Factura emitida** → Db CxC / Cr Ingreso por flete + Cr IVA Débito Fiscal (16%)
- **Pago recibido USD** → Db Banco USD / Cr CxC
- **Pago recibido VES** → Db Banco VES (en USD equivalente @ tasa del día) / Cr CxC · con `forex { originalAmount, originalCurrency, rate, rateSource }` adjuntado al asiento
- **Gasto operativo** → Db cuenta de gasto / Cr Banco
- **Costos directos** → Db cuenta CGS / Cr Banco (alimentan margen por embarque)

**Seguridad / Doble filtro de edición:**
- **Modo seguro** (default ON): asientos contabilizados son read-only · botones Editar/Eliminar disabled
- **Edición abierta** (30 min): requiere contraseña en un prompt · sesión auto-expira · cada cambio queda en audit (TODO wirear)
- **Eliminación total**: visible solo en sesión abierta, con confirmación + log (mock por ahora)

**TODOs pendientes para v1.3:**
- Conectar "Nueva factura"/"Registrar pago"/"Registrar gasto" del dashboard con sus respectivos flujos del ERP
- Wirear cada acción (crear/editar/eliminar asiento) al `window.ModuleAuditLog` (push a `dtd_audit_log_v1`)
- Form de nuevo asiento manual (drawer con líneas dinámicas y verificación de cuadre)
- Diferencia cambiaria automática al cierre mensual (job manual hoy)
- Vincular pagos del módulo Conciliación bancaria a asientos automáticos (hoy se hace en localStorage por separado)
- Mover JOURNAL_ENTRIES y CHART_OF_ACCOUNTS a `erp/data.jsx` al consolidar

---

## 2026-05-24 · v1.1.1 · Bolívares en estado de cuenta + brand rule

**Cambios en Brand Book (regla de moneda extendida):**
- `Brand Book DTD v2.4.html` · línea ~5286 (panel "Formato de datos · Cómo se escriben") · expandida la regla de Moneda. Ahora son **4 entradas**:
  - **Moneda USD** — `USD 4.820` (sin decimales · . miles)
  - **Moneda VES** — `Bs. 175.640` (sin decimales · . miles · prefijo Bs.)
  - **Conversión** — `USD 4.820 · Bs. 175.640 @ BCV 36,45`
  - **Tasa** — `BCV 36,45 · Paralelo 37,20` (1 USD = X Bs.)

**Archivos nuevos en `nuevo/`:**
- `nuevo/rates.jsx` — Helper global `window.ERPRates` con:
  - `read()` / `write()` — persistencia en `localStorage` (`dtd_rates_v1`)
  - `rateOf(source)` — devuelve la tasa según fuente (`bcv` | `parallel` | `avg`)
  - `usdToVes(amount, source?)` / `vesToUsd(amount, source?)` — conversores
  - `fmtUsd(n)` / `fmtBs(n)` — formatters siguiendo Brand Book v2.4 (sin decimales · prefijo · separador miles)
  - `useRates()` — hook con event listener para re-render al cambiar
  - Defaults: BCV 36.45 · Paralelo 37.20 · CNY 7.18 (igual que Admin → Tasas de cambio)

**Cambios en Estado de Cuenta (`nuevo/pantallas/estado-cuenta.jsx`):**
- Carga `../rates.jsx` antes del JSX
- **RatesBanner** nuevo (card dark debajo del hero) — muestra BCV, Paralelo, spread % y badge "Asientos contables · @ BCV"
- **KPIs hero** — Saldo actual y Deuda vencida muestran su equivalente en Bs. en el delta usando `R.fmtBs(R.usdToVes(...))`
- **Cuenta corriente** — cada balance corrido ahora muestra una segunda línea con el equivalente Bs. en mono pequeña gris
- **VESMovementsCard** nuevo (debajo de Cuenta Corriente) — tabla dedicada de pagos recibidos en Bs. con: fecha, ref, descripción, monto Bs., **tasa usada al momento + fuente** (BCV/paralelo), equivalente USD, factura linkeada. Header con totales Bs. + USD + tasa promedio. Footer con nota fiscal: cada pago se asienta con la tasa vigente al día y queda en libros.
- ACCOUNT_PROFILES extendido para 3 clientes con movimientos VES realistas:
  - **DTD-5452 Acindar** · 3 transfers en Bs. (BCV + paralelo) por F-2026-0382, ND, F-2026-0312
  - **DTD-5340 Distribuidora Andina** · 3 transfers en Bs. histórico de pagos a F-388, F-367, F-298
  - **DTD-5321 Salazar Trading** · 2 anticipos en Bs.

**Archivos viejos modificados:**
- `DTD Studio · ERP.html` · línea ~55 · agregado `<script src="nuevo/rates.jsx">` entre feature-flags y shell para exponer `window.ERPRates` a todo el ERP
- `nuevo/pantallas/estado-cuenta.html` · agregado `<script src="../rates.jsx">` antes del estado-cuenta.jsx

**Notas:**
- Las tasas son por ahora estáticas (defaults). **TODO consolidación:** wirear `Admin → Tasas de cambio` (`SectionRates`) para que escriba a `window.ERPRates.write()` cuando se haga override manual o cuando termine el scrape BCV. Hoy el panel solo muestra valores; el utility provee el storage para cuando se conecte.
- Los rate inputs en Admin tienen un placeholder visual (`value="36.45"`); cambio futuro: hacerlos controlados via `useRates()`.
- Brand-check: la regla de Moneda en Brand Book quedó alineada con lo que usa la implementación · sin decimales, separador de miles `.`, prefijo `Bs.` antes del número en VES (no después).

---

## 2026-05-24 · C3 · Audit log con drill-down · SPRINT C COMPLETO ✅

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/audit-log.jsx — Nuevo módulo `window.ModuleAuditLog`. Incluye:
  - 4 KPIs: Eventos hoy, Actores únicos, Acciones sensibles (DELETE/CONFIG), Retención (180d)
  - Toolbar con search + filter por acción (create/edit/delete/config/login/auto) y por usuario
  - Tabla con 12 entradas mock enriquecidas (no solo el `time/user/target/detail` del SectionAudit, sino payload completo)
  - Cada fila muestra: cuando, acción badge, actor con avatar+rol, target con badge "SENSIBLE" si aplica, IP+ciudad, chevron de drill-down
  - **AuditDrillDown** — Drawer 720px con 5 tabs:
    - **Resumen** — headline color-coded por acción, fields rápidos, chip de campos modificados
    - **Diff de campos** — tabla campo-por-campo con valor antes (tachado, fondo rojo) → después (fondo verde), formateo por tipo (money/pct/number/date/text), filas "unchanged" en gris
    - **Actor & origen** — card con avatar + rol + email, datos de IP/ciudad/navegador, mini card dark con ubicación
    - **Relacionados** — historial de otros eventos sobre el mismo target, navegable (click reabre el drawer con el otro evento)
    - **JSON** — payload crudo en monoespaciada sobre fondo dark
  - 12 entradas seed cubren todos los tipos: CREATE cliente, EDIT cotización/embarque/factura, DELETE borrador, CONFIG sistema, LOGIN, AUTO (cron). 2 entradas marcadas como `sensitive: true`.

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~31 · agregado `{ id: 'auditlog', group: 'SISTEMA', label: 'Audit log', icon: 'eye' }` después de Vault
- `DTD Studio · ERP.html` · línea ~93 · agregado `<script src="nuevo/modules/audit-log.jsx">` en overrides
- `DTD Studio · ERP.html` · línea ~192 · agregado `auditlog: window.ModuleAuditLog` al moduleMap
- `nuevo/feature-flags.jsx` · línea ~73 (`MODULE_FLAG_MAP`) · agregado `auditlog: 'audit_log'` para que el flag `audit_log` realmente esconda el módulo

**Notas:**
- El `SectionAudit` viejo dentro de Admin queda intacto (tiene una vista resumida sin drill-down). El módulo nuevo es la "vista profunda" como dice el HANDOFF.
- Feature flag `audit_log` está ON por default, así que el módulo aparece de entrada. Toggleándolo OFF en Admin → Casos de uso lo esconde del sidebar (y auto-vuelve a dashboard si estás parado en él).
- `AUDIT_ENTRIES` inlined — al consolidar mover a `erp/data.jsx`.

---

## 📍 Estado de sprints

- **Sprint A · Visuales nuevas** ✅ COMPLETO (A1–A5)
- **Sprint B · Conexiones funcionales** ✅ COMPLETO (B1, B2, B3)
- **Sprint C · Profundidad** ✅ COMPLETO (C1, C2, C3)

🎉 **v1.1 completo.** Todos los pendientes priorizados del HANDOFF (Sprint A/B/C) están entregados.

---

## 2026-05-24 · C2 · Conciliación bancaria (módulo ERP)

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/conciliacion.jsx — Nuevo módulo `window.ModuleConciliacion`. Incluye:
  - 4 KPIs: Movs importados, Conciliados, Pendientes revisión, Total reconciliado
  - 5 tabs: A revisar / Conciliados / Sin sugerencia / Rechazados / Todo
  - **Balance strip** (card dark) — Saldo inicial · Créditos · Débitos · Saldo final · Diferencia
  - **MovementRow** — cada movimiento muestra: fecha + ref bancaria, descripción + tag crédito/débito, sugerencia automática con confidence (high/medium/high), monto, acciones inline (Confirmar / Buscar match)
  - **MovementDetail** lateral — descripción bancaria, sugerencia con score de confianza, búsqueda manual entre facturas (`D.INVOICES`), botones Confirmar / Marcar manual / Rechazar
  - Mock seed: extracto Banesco USD del 8–22 mayo con 14 movimientos (7 créditos de clientes, 7 débitos operativos: naviera, aduanal, combustible, nómina, etc.)
  - Match confidence levels: `high` (monto + cliente identificado en descripción + fecha 7d), `medium` (parcial), `low` (sugerencia débil)
  - Persistencia de decisiones en `localStorage` (`dtd_reconcile_v1`)
  - "Movimientos flagged" (cargo sospechoso · TRX-INET) marcados en rojo

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~24 · agregado `{ id: 'reconcile', group: 'FINANZAS', label: 'Conciliación bancaria', icon: 'check' }` después de Facturación
- `DTD Studio · ERP.html` · línea ~92 · agregado `<script src="nuevo/modules/conciliacion.jsx">` en sección de overrides
- `DTD Studio · ERP.html` · línea ~191 · agregado `reconcile: window.ModuleConciliacion` al moduleMap

**Notas:**
- Aparece como ítem nuevo del sidebar bajo FINANZAS (debajo de Facturación). No requiere feature flag.
- El "subir extracto" del header es placeholder visual — implementar flujo real (drag-drop CSV/PDF + parser) en una iteración futura.
- BANK_STATEMENTS debería moverse a `erp/data.jsx` al consolidar; hoy está inlined como SEED_STATEMENT.

---

## 2026-05-24 · C1 · Estado de cuenta detallado del cliente (standalone)

**Archivos nuevos en `nuevo/`:**
- nuevo/pantallas/estado-cuenta.html — Shell HTML.
- nuevo/pantallas/estado-cuenta.jsx — Vista profunda de la cuenta corriente del cliente. Incluye:
  - Top bar sticky con breadcrumb ERP / Clientes / Estado de cuenta + selector (6 clientes con data detallada)
  - Hero card con avatar, badges (status, segmento, alerta de mora), MARKBOX, RIF, embarques, facturado total. CTAs: Generar PDF · Registrar pago · Enviar recordatorio
  - 4 KPIs: Saldo actual, Deuda vencida, Crédito disponible, DPP (días promedio de pago vs meta SLA)
  - **Aging chart** — distribución por bucket (0-30, 31-60, 61-90, 90+) con stacked bar + 4 boxes de detalle
  - Columna izquierda (2/3):
    - **Resumen mensual 6m** — bars dobles (facturado vs cobrado) + footer con totales y % efectividad de cobro
    - **Cuenta corriente** — tabla de movimientos con filtros tab-style (Todos / Facturas / Pagos / NC-ND / Recordatorios) y balance corrido
    - **Métodos de pago históricos** — stacked bar + breakdown por tipo (Transfer USD, Zelle, USDT TRC20, Efectivo USD)
  - Columna derecha (1/3):
    - **Contacto de facturación** — nombre, rol, email, teléfono, dirección fiscal
    - **Condiciones de crédito** — banner con límite, plazo, descuento pronto pago, términos
    - **Seguimiento** — último recordatorio + próximo vencimiento con badge de días restantes/vencidos
    - **Acciones admin** — cambiar límite, editar términos, marcar moroso, suspender línea
  - ACCOUNT_PROFILES inlined para 6 clientes con perfiles muy distintos:
    - DTD-5392 Industrias Polar · cliente A, pagos limpios, efectividad 92%
    - DTD-5452 Acindar Comercial · tiene F-2026-0418 vencida hace 10d
    - DTD-5354 Castro Hermanos · sólido, pagos en término
    - DTD-5371 Tech Solutions · chico, Zelle, sin mora
    - DTD-5340 Distribuidora Andina · slow payer, 2do recordatorio enviado
    - DTD-5321 Salazar Trading · status pending, solo pago anticipado

**Archivos viejos modificados:**
- Ninguno. **TODO:** wirear botón "Estado de cuenta" en el detalle de cliente del módulo `erp/modules/clients.jsx` que abra `nuevo/pantallas/estado-cuenta.html?id={markbox}` en nueva pestaña.

**Notas:**
- Asset registrado: "Estado de Cuenta del Cliente".
- Solo 6 clientes tienen ACCOUNT_PROFILE rico — el selector filtra automáticamente. Al consolidar, completar los 12 clientes restantes o usar un generador.
- Aging buckets se calculan en runtime a partir de `creditDays` del cliente + fecha de la factura abierta.
- Balance corrido calculado forward-in-time desde el movimiento más antiguo.

---

## 2026-05-24 · B2 · Cola QR conectada móvil ↔ ERP · SPRINT B COMPLETO ✅

**Archivos viejos modificados (línea + razón):**
- `operario/app.jsx` · línea ~793 (`PrintQRSheet`, botón "Enviar a oficina") · agregada lógica en el `onClick`: si `target === 'office'`, hace `unshift` de un nuevo objeto orden al `localStorage` key `dtd_qrqueue_v1` antes de mostrar la pantalla de éxito.

**Cómo funciona el push:**
- Lee el array existente de `localStorage` (`dtd_qrqueue_v1` — el mismo key que usa el módulo Cola de QR del ERP)
- Genera un ID secuencial `QR-2026-NNNN` (continúa desde donde está)
- Resuelve el nombre del cliente vía `window.ERPData.byMarkbox(client)`
- Setea `warehouse: 'cn-yiwu'`, `priority: 'normal'`, `status: 'pendiente'`, `sentBy: 'Liu Wei'` por default
- Setea `sentAt` con el timestamp real del navegador (formato `YYYY-MM-DD HH:MM`)
- `supplier` queda como "Pendiente · taggear en oficina" (la app móvil no captura supplier en este sheet)

**Verificación end-to-end:**
1. Abrir `Operario CN.html` → menú "Imprimir códigos QR" → seleccionar cliente → elegir "Enviar a oficina" → Confirmar
2. Abrir `DTD Studio · ERP.html` → asegurar que feature flag `mobile_operator` está ON (Admin → Casos de uso) → sidebar "Cola de QR" → la nueva orden aparece arriba de todo, status "pendiente"

**Notas:**
- Como simulamos el push con localStorage compartido entre tabs (mismo origen), el ERP necesita un refresh para ver la nueva orden (el módulo Cola de QR carga el state en `useState` lazy). Para tiempo real verdadero habría que sumar un listener `window.addEventListener('storage', ...)` en el módulo de Cola de QR.
- `sentBy` y `sentByPhone` están hardcodeados a "Liu Wei" porque la PrintQRSheet no recibe `user` como prop. Cuando se consolide, pasar `user` desde `OperarioApp` y popular esos campos dinámicamente.

---

## 📍 Estado de sprints

- **Sprint A · Visuales nuevas** ✅ COMPLETO (A1–A5)
- **Sprint B · Conexiones funcionales** ✅ COMPLETO (B1, B2, B3)
- **Sprint C · Profundidad** — pendiente:
  - C1: Estado de cuenta detallado del cliente
  - C2: Conciliación bancaria
  - C3: Audit log con drill-down

---

## 2026-05-24 · B1 · Feature flags realmente ocultan módulos

**Archivos nuevos en `nuevo/`:**
- nuevo/feature-flags.jsx — Estado global de feature flags:
  - `window.FEATURE_FLAG_DEFAULTS` — defaults (mismos 20 flags que tenía SectionFeatures)
  - `window.DTDFlags.getFlags()` / `setFlags()` / `toggleFlag(k)` — read/write con persistencia en `localStorage` (`dtd_feature_flags_v1`)
  - `window.DTDFlags.useFeatureFlags()` — hook React que re-renderiza cuando cambian (vía `CustomEvent 'dtd-flags-changed'` + listener `storage`)
  - `window.MODULE_FLAG_MAP` — diccionario `{ moduleId: flagKey }` para mapear sidebar items a flags:
    - `seniat` ← `customs_seniat`
    - `vault` ← `vault`
    - `qrqueue` ← `mobile_operator`
  - `window.DTDFlags.isModuleEnabled(id, flags?)` — helper para chequear

**Archivos viejos modificados (línea + razón):**
- `DTD Studio · ERP.html` · línea ~54 · agregado `<script src="nuevo/feature-flags.jsx">` entre `components.jsx` y `shell.jsx` (carga antes que cualquier consumidor)
- `DTD Studio · ERP.html` · línea ~131 · agregado `useEffect` que escucha el evento `dtd-flags-changed` y auto-navega a `dashboard` si el módulo activo queda escondido
- `erp/modules/admin.jsx` · línea ~975 (`SectionFeatures`) · reemplazado el `useState` local + `setFlags` por `window.DTDFlags.useFeatureFlags()` para que los toggles realmente persistan y propaguen
- `erp/shell.jsx` · línea ~63 (`Sidebar`) · agregado `useFeatureFlags()` + extendido `isAllowed()` para filtrar también por flag (además de role). `useMemo` ahora depende de `[currentUser, flags]`

**Notas:**
- Solo 3 módulos están atados a flags hoy. El resto siempre se muestra (son core).
- Para esconder otros módulos basta con extender `window.MODULE_FLAG_MAP` (no requiere tocar shell.jsx).
- Otros flags (`hs_autodetect`, `cn_translation`, `ai_copilot`, `audit_log`, `consolidation_partial`, `portal_cliente`, `comments`, etc.) controlan **features internas** dentro de módulos — eso queda como follow-up cuando se quiera atar feature-por-feature.
- `vault` está ON por default, `customs_seniat` y `mobile_operator` están OFF. Por eso al abrir el ERP de cero, **SENIAT y Cola de QR no aparecen en el sidebar hasta activarlos en Admin → Casos de uso**.

---

## 2026-05-24 · B3 · Wiring de cards → perfiles standalone

**Archivos viejos modificados (línea + razón):**
- `erp/modules/tms.jsx` · línea ~262 (`FleetTab`) · agregado `onRowClick` a la tabla que abre `nuevo/pantallas/camion-perfil.html?id={truck.id}` en nueva pestaña.
- `erp/modules/tms.jsx` · línea ~268 (`DriversTab`) · agregado `hoverable + onClick` a cada `<U.Card>` de chofer → abre `nuevo/pantallas/chofer-perfil.html?id={d.id}` en nueva pestaña.
- `erp/modules/seniat.jsx` · línea ~285 (`AgentsTab`) · agregado `hoverable + onClick` a cada `<U.Card>` de agente → abre `nuevo/pantallas/agente-perfil.html?id={a.id}` en nueva pestaña.

**Notas:**
- Cambios mínimos. Uso `window.open(..., '_blank')` para no perder el contexto del ERP.
- Cuando se consolide v1.1: evaluar si los perfiles deberían vivir adentro del ERP como un drawer/full-page en vez de standalone.

---

## 2026-05-24 · A5 · Perfil de Agente Aduanal (standalone) · SPRINT A COMPLETO ✅

**Archivos nuevos en `nuevo/`:**
- nuevo/pantallas/agente-perfil.html — Shell HTML.
- nuevo/pantallas/agente-perfil.jsx — Perfil completo del agente. Incluye:
  - Top bar sticky con breadcrumb ERP / Aduana SENIAT / Agentes + selector (4 agentes)
  - Hero card con avatar, badge "Habilitado", rating, nombre empresa, puerto, contacto persona + rol, RIF y SENIAT en mono. CTAs Email / Llamar / WhatsApp
  - 4 KPIs: Embarques YTD, Tiempo liberación (vs SLA), On-time clearance, Honorarios YTD
  - Columna izquierda (2/3):
    - **En trámite ahora** — tabla con embarques activos (DUA, días en trámite, status, fee)
    - **Tiempo de liberación · 6 meses** — bars con línea de referencia del SLA del agente (barras amarillas si superan SLA)
    - **Honorarios · 6 meses** — bars verdes con total semestre y promedio mensual
    - **Historial** — tabla con shipments + DUA + status + días para liberar + puerto + fee
  - Columna derecha (1/3):
    - **Contacto principal** — nombre, rol, email, WhatsApp, sitio web
    - **Empresa** — razón social, RIF, fundación, empleados, dirección, email corporativo, inicio contrato DTD, clientes exclusivos (chips)
    - **Habilitación SENIAT** — card dark con número grande + puertos habilitados con vencimientos color-coded
    - **Certificaciones & pólizas** — OEA, ISO, seguros con vencimientos
    - **Comunicaciones recientes** — timeline con iconos por tipo (WhatsApp/Email/Llamada)
    - **Notas internas** + **Acciones admin** (editar, reporte performance, suspender, baja)
  - AGENT_PROFILES inlined con 4 agentes (a-001 Aduanas Carabobo, a-002 Logística Aduanal VE, a-003 Zulia Aduanas, a-004 Falcón Customs).

**Archivos viejos modificados:**
- Ninguno. **TODO:** wirear onClick en `erp/modules/seniat.jsx` `AgentsTab` para abrir `nuevo/pantallas/agente-perfil.html?id={a.id}` en nueva pestaña.

**Notas:**
- Asset registrado: "Perfil de Agente Aduanal".
- AGENTS_BASE espejado del `_seniatData.agents` (variable interna del módulo SENIAT, no expuesta a `window.ERPData`). Al consolidar, exponerla globalmente.
- AGENT_SHIPMENTS también espejado — al consolidar usar la fuente única.

---

## 📍 Estado de sprints

- **Sprint A · Visuales nuevas** ✅ COMPLETO (A1 a A5)
- **Sprint B · Conexiones funcionales** — pendiente:
  - B1: Feature flags realmente ocultan módulos
  - B2: Cola QR conectada Operario CN ↔ ERP en tiempo real
  - B3: Wirear los onClick de las cards (TMS chofer + TMS camión + SENIAT agente) para abrir los perfiles nuevos
- **Sprint C · Profundidad** — pendiente (estado de cuenta cliente, conciliación bancaria, audit log drill-down)

---

## 2026-05-24 · A4 · Perfil de Camión (standalone)

**Archivos nuevos en `nuevo/`:**
- nuevo/pantallas/camion-perfil.html — Shell HTML (copia de chofer-perfil.html).
- nuevo/pantallas/camion-perfil.jsx — Perfil completo del vehículo. Incluye:
  - Top bar sticky con breadcrumb ERP / TMS / Flota + selector con plate (7 camiones)
  - Hero card con placeholder de foto (160×110), patente en mono 36px, brand + type, status, ownership (Propio/Contratado), hub, capacidad, año
  - CTAs: Asignar a ruta · Reportar incidencia · Editar
  - 4 KPIs: Km totales, Viajes 30d, Costo por km, Próximo service (con tone warning si <3000 km)
  - Columna izquierda (2/3):
    - **En ruta ahora** (sólo si tiene ruta activa)
    - **Especificaciones técnicas** — 12 fields: año, tipo, ejes, motor, combustible, rendimiento, capacidad, volumen, tara, dimensiones, VIN, compra
    - **Costos · últimos 30 días** — stacked bar + breakdown por categoría (combustible / mantenimiento / salario chofer / peajes / otros) con % y monto
    - **Historial de servicios** — tabla con fecha, tipo (preventivo/correctivo), descripción, km, costo + total YTD
    - **Viajes recientes** — tabla con fecha, ruta, chofer, km, on-time
  - Columna derecha (1/3):
    - **Chofer asignado** — card con cross-link a `chofer-perfil.html?id={driver.id}`
    - **Documentación** — Circulación, SOAT, RTV, Seguro flota, RIF vehicular con vencimientos color-coded
    - **Próximo service** — banner con km restantes + checklist de tareas (aceite, filtros, frenos, neumáticos, niveles)
    - **Incidencias** — empty state OK / lista con severity color y costo
    - **Notas internas** + **Acciones admin** (reasignar, taller, fuera de servicio, baja)
  - TRUCK_PROFILES inlined con 7 camiones completos (T-001 hasta T-007).

**Archivos viejos modificados:**
- Ninguno. **TODO:** wirear onClick en `erp/modules/tms.jsx` `FleetTab` para abrir `nuevo/pantallas/camion-perfil.html?id={truck.id}` en nueva pestaña.

**Notas:**
- Asset registrado: "Perfil de Camión".
- Cross-link bidireccional con perfil de chofer (cada lado tiene un botón "Ver perfil" al otro).
- TRUCK_PROFILES debería moverse a `erp/data.jsx` al consolidar.

---

## 2026-05-24 · A3 · Perfil de Chofer (standalone)

**Archivos nuevos en `nuevo/`:**
- nuevo/pantallas/chofer-perfil.html — Shell HTML que carga tokens.css, fuentes, React/Babel y los scripts del ERP (icons, data, components) + el JSX del perfil.
- nuevo/pantallas/chofer-perfil.jsx — Componente completo del perfil. Incluye:
  - Top bar sticky con breadcrumb ERP / TMS / Choferes y selector de chofer (cambia URL `?id=`)
  - Hero card con avatar, status, rating, licencia, hub, y CTAs Email · Llamar · WhatsApp
  - 4 KPIs: Viajes 30d, On-time %, Km totales, Antigüedad
  - Columna izquierda (2/3):
    - **En ruta ahora** (sólo si tiene ruta activa) — embarque, camión, distancia, ETA, paradas con timeline + barra de progreso
    - **Performance 6 meses** — barras de viajes/mes con total y promedio
    - **Camión asignado** — link cruzado al perfil del camión (`camion-perfil.html?id=`)
    - **Viajes recientes** — tabla con fecha, ruta, embarque, km, on-time, rating
    - **Incidencias** — empty state OK / lista con severity color
  - Columna derecha (1/3):
    - **Licencia & salud** — categorías A/B/C/D/E como pills + vencimientos con tone (verde/amarillo/rojo según días restantes)
    - **Datos de contacto** — teléfono, email, RIF, DOB, ingreso, dirección, contacto emergencia
    - **Capacitaciones** — IMDG, manejo defensivo, primeros auxilios con vencimientos
    - **Notas internas** — textarea libre con "autoguardado hace 2 min · solo Admin"
    - **Acciones admin** — editar, reasignar camión, marcar de licencia, dar de baja
  - DRIVER_PROFILES inlined con 7 choferes completos (matchea con `D.DRIVERS`).

**Archivos viejos modificados:**
- Ninguno por ahora. **TODO:** wirear el onClick de las cards en `erp/modules/tms.jsx` (línea ~268, `DriversTab`) para abrir `nuevo/pantallas/chofer-perfil.html?id={d.id}` en nueva pestaña.

**Notas:**
- Asset registrado en review pane: "Perfil de Chofer".
- DRIVER_PROFILES debería moverse a `erp/data.jsx` cuando se consolide.
- Cross-link al perfil de camión (A4) ya está hardcodeado: `camion-perfil.html?id={truck.id}`.
- Helper `daysUntil()` calcula días restantes contra fecha fija 2026-05-24 (sin "hoy real").

---

## 2026-05-24 · A2 · Cola de impresión QR (vista oficina)

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/qr-queue.jsx — Nuevo módulo `window.ModuleQrQueue`. Incluye:
  - Vista doble: "Cola activa" (pendientes + imprimiendo) y "Historial" (impreso/entregado/cancelado)
  - 4 KPIs: Pendientes, Imprimiendo, Bultos en cola, Impresos hoy
  - Toolbar con filtros por almacén CN (Yiwu/Guangzhou) y prioridad
  - Cards de orden con checkbox de selección, badge de prioridad y status, contador de etiquetas
  - Sticky bulk-action bar al seleccionar múltiples órdenes
  - Modal de impresión por lote con selector de impresora (3 opciones, una offline) + toggle WhatsApp
  - Panel detalle lateral con QR preview SVG, timeline de 4 pasos, link al cliente
  - Estados ciclo de vida: pendiente → imprimiendo → impreso → entregado (más cancelado)
  - Persistencia en `localStorage` (`dtd_qrqueue_v1`) para simular el push del móvil al ERP

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~13 · agregado `{ id: 'qrqueue', group: 'OPERACIÓN', label: 'Cola de QR', icon: 'tag' }` al array `MODULES` (debajo de Almacén CN)
- `DTD Studio · ERP.html` · línea ~91 · agregado `<script src="nuevo/modules/qr-queue.jsx">` después del dashboard override
- `DTD Studio · ERP.html` · línea ~188 · agregado `qrqueue: window.ModuleQrQueue` al `moduleMap`

**Notas:**
- 10 órdenes mock seed (DTD-7842 Polar, DTD-9104 Acindar, DTD-5621 Tech Solutions, etc.) con mix de estados.
- QR preview es SVG procedural — placeholder visual, no es un QR escaneable real.
- Pendiente conexión con Operario CN (B2 del backlog): hoy el móvil hace `console.log` cuando se manda; falta postear al mismo localStorage key.

---

## 2026-05-24 · A1 · Editor de Dashboard

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/dashboard.jsx — Reemplaza `window.ModuleDashboard` del v1.0. Agrega:
  - Botón "Configurar" en el header que abre un drawer
  - Catálogo de 14 KPIs (Operación · Finanzas · Comercial)
  - Drag-to-reorder de KPIs activos
  - Toggle de 7 widgets (chart, embarques, alerts, actividad, acciones rápidas, TMS, próximos ETA)
  - Período del gráfico configurable (1M/3M/1A/YTD)
  - Persistencia en `localStorage` (`dtd_dashboard_config_v1`) + reset
  - Persistencia del ojo "ocultar valores" en `localStorage` (`dtd_dashboard_hide`)

**Archivos viejos modificados (línea + razón):**
- `DTD Studio · ERP.html` · línea ~85 · agregado `<script src="nuevo/modules/dashboard.jsx">` al final de los modules para overridear `window.ModuleDashboard`

**Notas:**
- El módulo viejo `erp/modules/dashboard.jsx` sigue intacto (queda como referencia v1.0). Se carga primero y luego el nuevo override gana.
- Los valores extra de KPIs (avgTransit, marginYTD, etc.) están inlined en el módulo nuevo como `EXTRA_KPI_VALUES`. **TODO al consolidar:** moverlos a `erp/data.jsx` → KPIS.
- Dos nuevos widgets que no existían: "Estado de flota TMS" (usa `D.TRUCKS`) y "Próximos ETA" (calendar-style).

---

## 2026-05-24 · Setup de continuidad

**Archivos nuevos en `nuevo/`:**
- nuevo/README.md
- nuevo/CHANGELOG.md

**Archivos viejos modificados:**
- HANDOFF.md · agregado bloque "v1.1 · CONTINUIDAD DEL PROYECTO" y "Workflow de continuidad con Claude Code"

**Notas:** Setup inicial. Todavía sin pantallas nuevas. El próximo trabajo arranca en Claude Code con el prompt de continuación.
