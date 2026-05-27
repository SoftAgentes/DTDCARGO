# Data model · sesión 2026-05-25 + Despacho

> Shapes TypeScript de TODAS las entidades + stores localStorage + APIs públicas. Incluye Despacho legacy + extensiones de hoy (v1.5 helpers + v1.5 emailsSent + v1.6 wiring no afecta data model).

---

## 1 · Stores localStorage · mapa exhaustivo

| Key | Tipo | Maneja | Default | Nuevo en |
|---|---|---|---|---|
| `dtd-ods` | `OrdenDespacho[]` | `od-bridge.jsx` → `window.DTDBridge` | `[]` | Despacho legacy |
| `dtd-cn-inbox` | `CnInboxItem[]` | `data-bridge.jsx` → `window.DTDData.cnInbox` | `[]` | Despacho legacy |
| `dtd-clients` | `Client[]` | `data-bridge.jsx` → `window.DTDData.clients` | `[]` | Despacho legacy |
| `dtd-rules` | `DispatchRules \| null` | `data-bridge.jsx` → `window.DTDData.rules` | `null` | Despacho legacy |
| `dtd-routes` | `Route[] \| null` | `data-bridge.jsx` → `window.DTDData.routes` | `null` | Despacho legacy |
| `dtd-cities` | `CityCatalogEntry[] \| null` | `data-bridge.jsx` → `window.DTDData.cities` | `null` | Despacho legacy |
| `dtd-rates` | `RateData \| null` | `data-bridge.jsx` → `window.DTDData.rates` | `null` | Despacho legacy |
| **`dtd-emails-sent`** | `EmailLogEntry[]` | `data-bridge.jsx` → `window.DTDData.emailsSent` | `[]` | **v1.5** |
| `dtd_audit_log_v1` | `AuditEntry[]` | escribe `data-bridge.jsx` (`sendWelcomeEmail`) y lee `audit-log` module | `[]` | extendido v1.5 |
| `dtd_qrqueue_v1` | `QrPrintOrder[]` | `nuevo/modules/qr-queue.jsx` (`useQrOrders` hook) | `SEED_ORDERS` | extendido v1.5 (storage listener) |
| **`dtd_codes_lastsync_${source}`** | `string` (ISO) | `erp/modules/admin.jsx` (`CodesSyncHeader`) | `null` | **v1.6** |

---

## 2 · API de stores (genérica · `makeStore`)

Definida por `makeStore(key, defaultValue)` en `data-bridge.jsx`:

```typescript
interface Store<T> {
  read(): T;
  write(value: T): void;       // emite CustomEvent('dtd-${key}-changed') + browser storage event
  subscribe(callback: (value: T) => void): () => void;
                                // poll 1.5s + storage + custom event · returns unsubscribe
  reset(): void;               // removeItem + emit custom
}
```

---

## 3 · API de bridges públicos

### `window.DTDBridge` (despacho.jsx · od-bridge.jsx)

```typescript
interface DTDBridge {
  publish(order: OrdenDespacho): void;
  advance(id: string, status: OrderStatus, extraFields?: Partial<OrdenDespacho>): void;
  cancel(id: string, reason: string): void;
  reassign(id: string, patch: Partial<Pick<OrdenDespacho, 'truckId' | 'driverId' | 'routeId'>>): void;
  remove(id: string): void;
  reset(): void;
  subscribe(callback: (ods: OrdenDespacho[]) => void): () => void;
  all(): OrdenDespacho[];
  find(id: string): OrdenDespacho | undefined;
  forHub(hub: string): OrdenDespacho[];          // filtra cancelada + cerrada
  forDriver(driverId: string): OrdenDespacho[];  // sólo status === 'lista'
}
```

### `window.DTDData` (data-bridge.jsx · v1.5 extendido)

```typescript
interface DTDData {
  // Stores
  cnInbox:    Store<CnInboxItem[]>;
  clients:    Store<Client[]>;
  rules:      Store<DispatchRules | null>;
  routes:     Store<Route[] | null>;
  cities:     Store<CityCatalogEntry[] | null>;
  rates:      Store<RateData | null>;
  emailsSent: Store<EmailLogEntry[]>;             // ← NUEVO v1.5

  // MARKBOX helpers (v1.5)
  validateMarkboxFormat(code: string): boolean;
  isMarkboxUnique(code: string): boolean;
  nextMarkbox(): string;

  // Email helpers (v1.5)
  sendWelcomeEmail(client: Client): EmailLogEntry | null;
  renderTemplate(body: string, vars: Record<string, string>): string;

  // Reset
  resetAll(): void;
}
```

### `window.DTDWiring` (wiring.jsx · v1.6)

```typescript
interface DTDWiring {
  openAttachModal(opts: { onSelect?: (files: FileMeta[]) => void }): void;
  openScheduleModal(opts: { onSchedule?: (s: ScheduleResult) => void }): void;
  openProfileModal(opts?: { tab?: 'profile' | 'password' | 'prefs' }): void;
  openShortcutsModal(): void;
  openGenerateBLModal(): void;
  openOAuthFlow(provider: 'gmail' | 'outlook'): void;
  MountHost: React.FC;     // ← montar UNA VEZ en <App>
}

interface FileMeta {
  name: string;
  size: number;
  type: string;       // MIME
  addedAt: string;    // ISO
}

interface ScheduleResult {
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  tz: string;         // e.g. 'America/Caracas'
  iso: string;        // YYYY-MM-DDTHH:MM:00 (sin tz)
}
```

---

## 4 · Entidades core

### 4.1 · `OrdenDespacho` (Despacho legacy)

```typescript
type OrderStatus =
  | 'creada'
  | 'cargando'
  | 'lista'
  | 'en-ruta'
  | 'entregada'
  | 'cerrada'      // terminal
  | 'cancelada';   // terminal

interface OrdenDespacho {
  id: string;                  // 'OD-2026-0142'
  status: OrderStatus;

  routeId: string;             // 'R-002' · FK Routes
  truckId: string;             // 'T-001' · FK Trucks
  driverId: string;            // 'd-001' · FK Drivers
  hub: 'Valencia' | 'La Guaira' | 'Punto Fijo';

  packageIds: string[];        // FK a cnInbox items
  packageCount: number;
  totalKg: number;
  totalCBM: number;
  capacityKg: number;          // snapshot truck al crear
  capacityCBM: number;
  cities: string[];            // orden de visita

  createdAt: string;
  updatedAt?: string;
  departedAt?: string;
  completedAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  reassignedAt?: string;

  progress: number;            // 0-100
  currentCity?: string;

  cancelReason?: string;       // requerido si status === 'cancelada'
  incidents?: Incident[];

  parentOdId?: string;         // si P2 generada por otra OD
  splits?: PackageSplit[];     // si tuvo paquetes fraccionados a P2
}
```

### 4.2 · `PackageSplit` (carga fraccionada)

```typescript
interface PackageSplit {
  packageId: string;
  originalBoxes: number;
  shippedBoxes: number;        // P1
  remainingBoxes: number;      // P2
  reason: 'falta_volumen' | 'cliente_pidio_esperar' | 'daño_caja' | 'documentacion_pendiente' | 'otro';
  reasonText?: string;         // si reason === 'otro'
  splitAt: string;
  splitBy: string;             // userId
  newOdId?: string;            // OD generada para P2
}
```

### 4.3 · `Incident`

```typescript
interface Incident {
  id: string;                  // 'INC-2026-0042'
  odId: string;
  severity: 'baja' | 'media' | 'alta' | 'crítica';
  category: 'mecanica' | 'accidente' | 'cliente_ausente' | 'direccion_errada' | 'aduana' | 'otro';
  description: string;
  reportedBy: string;
  reportedAt: string;
  resolvedAt?: string;
  resolution?: string;
  photos?: string[];
}
```

### 4.4 · `CnInboxItem`

```typescript
interface CnInboxItem {
  order: string;               // 'DTD-2026-0151' · primary key
  markbox: string;             // 'DTD-5452'
  clientName: string;
  city: string;                // destino VE (se completa al llegar a bodega VE)
  pay: 'pagado' | 'parcial' | 'pendiente';
  weight: number;              // kg
  cbm: number;                 // m³
  description: string;         // mercancía (SENIAT)
  hsCode?: string;
  aesCode?: string;
  receivedAtCn: string;
  releasedToVeAt?: string;
  status: 'en_cn' | 'en_transito' | 'aduana_ve' | 'bodega_ve' | 'despachado';
  containerId?: string;
}
```

### 4.5 · `DispatchRules` (Vista 2)

```typescript
interface DispatchRules {
  paymentPolicy: {
    mode: 'estricto' | 'hold' | 'credito_whitelist';
    whitelistMarkboxes: string[];
  };
  weights: {
    valencia: number;          // default 40
    fullPay: number;           // 30
    partialPay: number;        // 15
    fifo: number;              // 0-15 lineal
    vip: number;               // 10
    routeProx: number;         // 0-5
  };
  optionalRules: {
    tier: boolean;
    routes: boolean;
  };
  vipMarkboxes: string[];
  updatedAt: string;
  updatedBy: string;
}
```

### 4.6 · `Route` (admin-routes)

```typescript
interface Route {
  id: string;                  // 'R-002'
  name: string;
  type: 'directa' | 'intermedias';
  hub: 'Valencia' | 'La Guaira' | 'Punto Fijo';
  origin: { city: string; coords?: [number, number] };
  destination: { city: string; coords?: [number, number] };
  intermediateCities?: Array<{
    city: string;
    radiusKm: number;
    order: number;
  }>;
  slaHours: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 4.7 · `CityCatalogEntry` (admin-routes)

```typescript
interface CityCatalogEntry {
  id: string;                  // 'C-001'
  state: string;               // 'Carabobo'
  municipio: string;           // 'Valencia'
  city: string;                // 'Valencia'
  postalCode: string;          // '2001' (IPOSTEL)
  defaultRadiusKm: number;
  isHq: boolean;               // hub principal del tenant?
  active: boolean;
  usageCount: number;          // cuántas rutas la incluyen
}
```

### 4.8 · `Truck` y `Driver` (legacy v1.0 · seed `ERPData`)

```typescript
interface Truck {
  id: string;                  // 'T-001'
  plate: string;               // 'AC542XK'
  label: string;               // 'Volvo FH'
  hub: 'Valencia' | 'La Guaira' | 'Punto Fijo';
  capacityKg: number;
  capacityCBM: number;
  status: 'disponible' | 'cargando' | 'en_ruta' | 'mantenimiento' | 'fuera_de_servicio';
}

interface Driver {
  id: string;                  // 'd-001'
  name: string;
  phone: string;
  whatsapp?: string;
  hub: 'Valencia' | 'La Guaira' | 'Punto Fijo';
  license: { categories: string[]; expires: string };
  rating: number;              // 0-10
  status: 'activo' | 'licencia' | 'baja';
}
```

### 4.9 · `PackageInDispatch` (proyección runtime)

No es una entidad propia · es la proyección de `CnInboxItem` o `WAREHOUSE_VE` con scoring.

```typescript
interface PackageInDispatch {
  order: string;
  markbox: string;
  clientName: string;
  city: string;
  pay: 'pagado' | 'parcial' | 'pendiente';
  days: number;                // días en bodega VE
  weight: number;
  cbm: number;
  description: string;
  hsCode?: string;
  aesCode?: string;
  routeProximity?: number;     // 0-5 precalculado
  tier?: 'Gold' | 'Platinum' | 'Silver' | 'Bronze';
  score: number;               // 0-100 runtime
}
```

---

## 5 · Entidades v1.5+

### 5.1 · `Client` (extiende seed)

```typescript
interface Client {
  // Seed v1.0
  markbox: string;             // 'DTD-5452'
  name: string;
  company: string;
  rif: string;
  segment: string;
  shipments: number;
  billed: number;
  status: 'active' | 'pending' | 'inactive';
  city: string;
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  lastLogin?: string;

  // Extendido por portal/registro v1.5
  tipo?: 'persona' | 'empresa';
  cedula?: string;
  email?: string;
  phone?: string;
  whatsapp?: boolean;
  state?: string;
  municipio?: string;
  barrio?: string;
  postalCode?: string;
  address?: string;
  reference?: string;
  photoFachada?: string;       // mock: 'mock-photo-XXXX' · futuro: URL S3
  photoCedula?: string;
  since?: string;              // YYYY-MM-DD
  createdAt?: string;
}
```

### 5.2 · `EmailLogEntry` (v1.5)

```typescript
type EmailStatus = 'sent' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'queued';

interface EmailLogEntry {
  id: string;                  // 'e-{base36-timestamp}'
  to: string;                  // email destinatario
  toName: string;
  template: string;            // 'm-05'
  templateName: string;        // 'Bienvenida MARKBOX'
  subject: string;             // renderizado
  body: string;                // renderizado
  sentAt: string;              // ISO
  status: EmailStatus;
  markbox?: string;
  channel: 'email' | 'wa';
}
```

### 5.3 · `AuditEntry` (extendido v1.5 · escribe `sendWelcomeEmail`)

```typescript
type AuditAction = 'create' | 'edit' | 'delete' | 'config' | 'login' | 'auto';

interface AuditEntry {
  id: string;                  // 'a-{base36}'
  ts: string;                  // ISO
  action: AuditAction;
  module: string;              // 'Mailing' | 'Despacho' | 'Clientes' | etc.
  actor: {
    id: string;
    name: string;
    role: string;
  };
  target: {
    kind: string;              // 'email' | 'od' | 'client' | etc.
    id: string;
    label: string;
  };
  detail: string;
  sensitive?: boolean;
  diff?: Array<{ field: string; before: any; after: any }>;
  ipAddress?: string;
  userAgent?: string;
}
```

---

## 6 · Diffs vs seed v1.0

### `WAREHOUSE_CN` (modificado en Despacho legacy)

```typescript
// v1.0
interface CnReception {
  id: string;
  client: string;
  clientName: string;
  supplier: string;
  boxes: number;
  cbm: number;
  weight: number;
  received: string;
  warehouse: string;
  status: string;
  shipment: string | null;
  hsCode: string;
}

// v1.1+ (Despacho legacy)
interface CnReception {
  ... (todos los campos v1.0)
  description: string;         // ← NUEVO · texto largo · requerido
}
```

---

## 7 · Convenciones de naming

| Entity | Patrón | Ejemplo |
|---|---|---|
| MARKBOX | `DTD-NNNN` o `DTD-NNNNN` | `DTD-5452` |
| Container | `DTDU-NNNNNNN` | `DTDU-472816` |
| OD | `OD-YYYY-NNNN` | `OD-2026-0142` |
| Package bodega | `DTD-YYYY-NNNN` | `DTD-2026-0151` |
| Embarque CN | `CN-YYYY-NNNN` | `CN-2026-2841` |
| Cotización | `Q-YYYY-NNNN` | `Q-2026-0419` |
| Factura | `F-YYYY-NNNN` | `F-2026-0418` |
| Ruta | `R-NNN` | `R-002` |
| Camión | `T-NNN` + plate `XX###XX` VE | `T-001` (AC542XK) |
| Chofer | `d-NNN` | `d-001` |
| Incidencia | `INC-YYYY-NNNN` | `INC-2026-0042` |
| Audit | `a-{base36}` | `a-mb3xz4f` |
| Email log | `e-{base36}` | `e-mb3xz4f` |
| BL (v1.6 mock) | `DTDU{7}-{OR\|CP\|SW}` | `DTDU0151-OR` |

Todas con dígitos cero-padded para sort lexicográfico.

---

## 8 · Validaciones

| Campo | Regex / Regla |
|---|---|
| `markbox` | `/^DTD-\d{4,5}$/` · validate via `DTDData.validateMarkboxFormat` |
| `markbox unicidad` | `DTDData.isMarkboxUnique(code)` antes de escribir |
| `email` (Client) | TODO en frontend · backend valida con HTML5 type=email |
| `phone` | Hoy free-form · futuro libphonenumber-js |
| `cedula` VE | `V-NNNNNNNN` o `J-NNNNNNNN-X` (RIF) · TODO regex |
| `password` (ProfileModal) | min 12 chars + confirm match |
