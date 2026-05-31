# DTD-Cargo · Changelog de la sesión

Resumen completo de todo lo construido en esta sesión sobre el ERP DTD-Cargo.

---

## 🧱 Módulos construidos

### 1 · Despacho admin (Vista 1)
`erp/modules/despacho.jsx` · standalone `Despacho · Vista 1.html`

- Cola priorizada de paquetes pendientes con drag & drop manual
- 5 KPIs: pendientes · listos · atrasados · días promedio · sin coordenadas
- 5 filtros: ciudad · barrio (dependiente) · pago · días · ruta
- Score 0–100 con motor de reglas; badges de prioridad por color
- Badge Tier (Gold/Platinum) inline en cada paquete
- Columna "Descripción mercancía" con HS + weight + volume para SENIAT
- Modal de asignación al almacenista: ruta + camión + chofer + validador de capacidad (peso/volumen) + resumen SENIAT por HS code
- Panel "Órdenes activas hoy" con status pills, progreso, capacity bars
- Botón **Cancelar OD** por orden
- Modal contactar transportista (Llamar / WhatsApp / Push)
- Job de geocoding sintético al hacer click en KPI "Sin coordenadas"

### 2 · Reglas de prioridad (Vista 2)
`erp/modules/despacho-rules.jsx` · standalone `Despacho · Vista 2.html`

- Patrón Stripe/Linear · cards plegables con header siempre visible (icono + nombre + tag + resumen + switch + chevron)
- Política maestra **Pago primero anclada** (no se puede apagar; 3 modos: Estricto · Hold · Crédito con whitelist)
- Card opcional **Tier · Gold/Platinum** con lista de clientes elegibles
- Card opcional **Rutas** placeholder con link a Admin
- "Puntos por regla" (renombrado de "Pesos del motor") con sliders y vista previa en vivo
- 2 presets: Equilibrado · FIFO estricto
- Validación de suma ≤ 100
- Selector de tenant per-tenant
- Renames: "Pesos" → **Puntos** · "Pago parcial" → **Abono** · "Carga parcial" → **Carga fraccionada**

### 3 · Almacenista móvil (Vista 3)
`operario/almacenista-despacho.jsx` · standalone `Despacho · Vista 3.html`

- **Role picker** al login (Almacenista / Transportista)
- **Home del almacenista** post-cierre con resumen de última OD + 2 sub-modos
- **Modo Despachar al camión** (LIFO): banner ruta + timeline de ciudades + cola priorizada por ciudad
- **Modo Recibir mercancía**: selector tipo (mono-cliente / LCL) → lista de contenedores ordenada (sin abrir → en curso → completado) → detalle del contenedor seleccionado
- **Demo escáner**: cámara mock con reticle, animación scan, detección de MARKBOX a los ~2.4s, actualiza packing list, auto-cierra
- Card de paquete actual con bloque SENIAT (HS + AES + descripción)
- Carga fraccionada (P1/P2) con modal de split, badges, sección "Próximo viaje" en bodega
- Botón "Cerrar carga · entregar al transportista" cuando termina el viaje
- Toggle light/dark + modo "Comparar light + dark" en wrapper
- Banner "OD recibida desde admin" cuando el bridge está activo

### 4 · Transportista móvil
`operario/transportista.jsx` · standalone `Transportista.html`

- Banner ruta del día asignada + camión + chofer
- GPS block con switch + animación pulse + push notification overlay si se apaga
- Card de entrega actual con foto fachada (SVG stylized), datos completos, coords, dirección + referencia
- **Bloque SENIAT** con HS + AES + descripción por paquete
- Botones Llamar (tel:) + WhatsApp (wa.me)
- Modal POD bottom-sheet con foto + firma; confirmar entrega habilitado solo cuando ambos completos
- Lista de próximas entregas + entregadas
- Banner "OD recibida desde almacenista" cuando el bridge está activo

### 5 · Admin → Administrar rutas (módulo nuevo)
`erp/modules/admin-routes.jsx` · standalone `Admin · Rutas.html`

- Nueva sección en Admin (nivel BÁSICO)
- 4 KPIs · toolbar · listado de rutas
- Drawer editor con CRUD completo: tipo (Directa / Con ciudades intermedias) · origen (selector multi-hub prep) · destino · ciudades intermedias con radio km
- **CityPicker custom** con buscador + "Agregar ciudad nueva al catálogo" inline
- Sub-tab **"Configurable por ciudad"**: catálogo per-tenant con Estado · Municipio · CP IPOSTEL · radio default · HQ · activa · uso
- Selector de tenant
- Renames: "Paradas" → **Ciudades intermedias** en todo el flujo

### 6 · Catálogo Venezuela
`erp/modules/venezuela-catalog.jsx`

- 24 estados + Distrito Capital + Dependencias Federales
- ~85 municipios y ~95 ciudades con códigos postales IPOSTEL reales
- Parroquias y barrios para ciudades operativas
- API `window.VECatalog`: `STATES`, `allCities()`, `findCity()`, `findByPostal()`, `searchCities()`, `getRegions()`, `statesByRegion()`, `stats()`

### 7 · OD Bridge (pipeline localStorage)
`erp/od-bridge.jsx`

- Helper `window.DTDBridge` con `publish()` · `advance()` · `cancel()` · `reassign()` · `subscribe()` · `reset()`
- Pipeline localStorage compartido entre Admin · Almacenista · Transportista
- Polling 1.5s como fallback al evento `storage` (que no dispara en mismo tab)
- Sincronización del ciclo: creada → cargando → lista → en-ruta → entregada → cerrada · más cancelada

---

## 🧩 Cambios en módulos existentes

### Almacén CN (`erp/modules/cn.jsx`)
- Nueva columna **"Descripción mercancía"** en la tabla con truncado a 2 líneas + tooltip
- Campo **"Descripción de la mercancía interna"** obligatorio en ReceptionForm (oficina CN lo llena)
- Búsqueda incluye descripción
- 7 recepciones mock enriquecidas con descripción real

### Admin (`erp/modules/admin.jsx`)
- Nueva sección "Administrar rutas" en nivel BÁSICO
- Nuevo feature toggle "Ubicación en bodega · pasillo · zona · estante" (default OFF)

### Datos (`erp/data.jsx`)
- WAREHOUSE_CN enriquecido con campo `description` en cada recepción

---

## 🔌 Estado del pipeline OD

Bridge construido + integrado en Vista 1 admin (publish + cancel). Falta cerrar:

- ⚠ Cargar `od-bridge.jsx` en los 3 HTML standalone (path con `·` dio problemas en script automático)
- ⚠ Wire subscribe en almacenista + transportista (parcial · banner agregado pero no consumo de OD real)

Estos 3 puntos se cierran en 5 minutos manualmente o en próxima sesión.

---

## 🎨 Renames y consolidaciones

| Antes | Ahora | Motivo |
|---|---|---|
| Pesos del motor | Puntos por regla | Más obvio para no-técnicos |
| Pago parcial | Abono | No confundir con Carga parcial |
| Carga parcial | Carga fraccionada | Diferenciar del pago |
| Paradas (en almacenista) | Ciudades | Operativo más claro |
| Paradas (en Admin Rutas) | Ciudades intermedias | Consistencia |
| Cargar al camión / Despachar (FIFO) | Despachar / Recibir mercancía | Refleja los 2 sub-modos reales del almacenista |

---

## 🗂 Archivos nuevos

```
erp/modules/despacho.jsx
erp/modules/despacho-rules.jsx
erp/modules/admin-routes.jsx
erp/modules/venezuela-catalog.jsx
erp/od-bridge.jsx
operario/almacenista-despacho.jsx
operario/transportista.jsx

Despacho · Vista 1.html
Despacho · Vista 2.html
Despacho · Vista 3.html
Admin · Rutas.html
Transportista.html
```

---

## 📋 Pendientes para próxima sesión (mi lista)

1. Cerrar pipeline bridge (3 cargas de `<script>` + wire almacenista/transportista al state real)
2. POD del transportista → marca OD entregada automáticamente en admin (vía bridge)
3. Sidebar del ERP reorganizado en grupos (Comercial / Operaciones / Finanzas / Contenidos / Sistema)
4. Registrar módulo Despacho en `ERPShell.MODULES` para que aparezca en sidebar
5. Carga fraccionada P2 genera 2da OD automática
6. Multi-tenant: filtrado real de datos por tenant
7. Registro de clientes (signup) con MARKBOX auto-generado + foto cédula + foto fachada
8. Geocoding real (Google Maps / Mapbox)
9. Push notifications reales (FCM/APNs)
10. Reportes / dashboard del módulo despacho

---

## 🎯 Lo más valioso construido en la sesión

1. **Flujo end-to-end del módulo Despacho** desde admin → almacenista → transportista, con role-aware UIs separadas
2. **Motor de reglas configurable** con presets, anclajes y previsualización en vivo
3. **Datos reales venezolanos** (IPOSTEL, estados, municipios) que estructuran direcciones para geocoding futuro
4. **Carga fraccionada** como mecánica operativa explícita
5. **SENIAT compliance** visible en almacenista + transportista
6. **Demo del escáner** funcional para reuniones de venta
7. **Patrón de cards plegables** (Stripe/Linear) reutilizable en cualquier futuro módulo de reglas

---

## 📅 Addendum · cierre de sesión

### Críticos completados después del changelog inicial

**1 · POD transportista → OD entregada automática** (`operario/transportista.jsx`)
- Cuando el chofer marca la última entrega como POD, llama `DTDBridge.advance(id, 'entregada')`
- El admin ve la OD pasar a 'entregada' en su panel sin tocar nada

**2 · P2 fraccionada genera 2da OD automática** (`operario/almacenista-despacho.jsx`)
- Cuando almacenista cierra carga y hay paquetes en "Próximo viaje", el `BridgeCloseHook` avanza la OD actual a 'lista' y publica una OD-V2 nueva con status 'creada' (sin camión/chofer asignado)
- El admin la ve aparecer en "Órdenes activas" para asignarle recursos cuando esté listo el próximo viaje

**3 · Despacho registrado en sidebar del ERP real**
- `Despacho` y `Reglas de despacho` agregados a `erp/shell.jsx` MODULES (grupo OPERACIÓN)
- Scripts cargados en `DTD Studio · ERP.html`: `despacho.jsx`, `despacho-rules.jsx`, `admin-routes.jsx`, `od-bridge.jsx`
- `moduleMap` enchufado a `window.ModuleDespacho` y `window.ModuleDespachoRules`

### Registro de Cliente (módulo nuevo)
`portal/registro.jsx` · standalone `Registro Cliente.html`

- 3 pasos + confirmación: Datos → Dirección VE → Confirmar → Éxito
- Step 1: tipo persona/empresa · nombre · cédula/RIF · foto identidad · email · teléfono + WhatsApp toggle
- Step 2: Estado → Municipio → Ciudad → Barrio en cascada usando `window.VECatalog`, auto-fill de código postal, dirección detallada, punto de referencia, **foto fachada** (que luego usa el transportista)
- Step 3: review completo de datos
- Step 4 éxito: MARKBOX generado random (`DTD-XXXX`) en card wine destacada
- Mensaje "Bienvenido a la familia de DoorTuDoor Cargo"
- **Guía visual de codificación MARKBOX** (1 min) plegable con 4 pasos:
  - Pasale el MARKBOX al proveedor chino
  - Formato de etiqueta visual (mockup con MARKBOX real)
  - Numerá las cajas Box X/Y
  - Qué pasa después (almacén CN → consolidación → zarpe → aduana → entrega)
- **Botón "Cómo usar tu MARKBOX"** con animación pulsante wine + chevron rebotando para captar atención
- Email preview con mención de la guía adjunta

### Pipeline bridge cerrado
- `od-bridge.jsx` cargado en los 3 HTML standalone (Vista 1, Vista 3, Transportista)
- Almacenista y Transportista suscritos al bridge con `useEffect` + banners verdes "OD recibida"
- Polling 1.5s como fallback al evento `storage`
- Admin: botón **Cancelar OD** en cada card de OD activa con `window.confirm` antes de cancelar

### Instrucciones para Claude Code
- Bloque de comentarios al principio de `portal/registro.jsx` indicando dónde leer la nomenclatura oficial (CLAUDE.md + docs internos + template `m-05`)
- Párrafo agregado al header de `HANDOFF.md` con la misma advertencia

---

## 🗂 Archivos nuevos (actualizado)

```
erp/modules/despacho.jsx
erp/modules/despacho-rules.jsx
erp/modules/admin-routes.jsx
erp/modules/venezuela-catalog.jsx
erp/od-bridge.jsx
operario/almacenista-despacho.jsx
operario/transportista.jsx
portal/registro.jsx               ← NUEVO

Despacho · Vista 1.html
Despacho · Vista 2.html
Despacho · Vista 3.html
Admin · Rutas.html
Transportista.html
Registro Cliente.html             ← NUEVO

CHANGELOG-sesion.md
```

---

## 📋 Pendientes para próximas sesiones (actualizado)

✅ Cerrados en esta sesión:
- ~~POD transportista → marca OD entregada en admin~~
- ~~Carga fraccionada P2 genera 2da OD~~
- ~~Cancelar OD desde admin~~
- ~~Registrar Despacho en sidebar del ERP~~
- ~~Registro de clientes con MARKBOX + foto cédula + foto fachada~~

## 📅 Addendum #2 · cierre final de sesión

### A · Pipeline CN → Despacho
- `erp/data-bridge.jsx` con stores: `cnInbox`, `clients`, `rules`, `routes`, `cities`, `rates`
- Vista 1 despacho suscribe a `cnInbox` y mergea paquetes nuevos a la cola
- Almacén CN tiene helper `liberarADespacho(rec)` que publica al inbox

### B · Registro → Clientes shared
- Registro publica al bridge con MARKBOX secuencial (no random)
- Transportista lee `photoFachada` por MARKBOX del bridge clientes

### C · Reglas Vista 2 → persistencia
- `despacho-rules.jsx` guarda pesos/policy/rules en bridge al hacer "Guardar"
- `despacho.jsx` (Vista 1) lee del bridge y aplica al scoring

### D · Rutas Admin → bridge
- `admin-routes.jsx` persiste rutas y catálogo de ciudades al bridge
- `despacho.jsx` lee routes del bridge para el filtro

### E · Tasas BCV
- Scrapers publican al bridge al sincronizar (rates store)
- Datos disponibles para módulos de costing/facturas

### Dashboard de despacho (nuevo)
`erp/modules/despacho-dashboard.jsx`
- 5 KPIs: Total ODs · Completadas · On-time % · Tarde/Canceladas · Tiempo prom.
- Ranking de rutas con on-time % y costo/km
- Top 5 ciudades por volumen con barras
- Registrado en sidebar bajo OPERACIÓN

### Audit log (nuevo)
`erp/modules/audit-log.jsx`
- Historial de cambios en Reglas / OD / Rutas / Despacho / POD / Política / Clientes
- Filtro por módulo
- 8 entradas mock realistas
- Registrado en sidebar bajo SISTEMA

### Sidebar con grupos colapsables
- `erp/shell.jsx` · grupos `OPERACIÓN · COMERCIAL · FINANZAS · SISTEMA` ahora clickeables
- Estado persistido en localStorage por usuario
- Chevron rota al abrir/cerrar

### Tasas BCV · scrapers automáticos
- `erp/modules/admin.jsx` agregó card "Fuentes de scraping · automático"
- 4 fuentes mock: BCV · Monitor Dólar VE · DolarToday · PBOC
- Botón sincronizar individual + global, toggle on/off por fuente
- Banner explicativo sobre scraping server-side

### Renames consolidados
- Transportista → **Transportista** (display only · archivos siguen transportista.jsx)

---

## 🔌 Estado del bridge end-to-end

```
ALMACÉN CN          DESPACHO ADMIN          BODEGUERO          TRANSPORTISTA
────────────         ──────────────          ─────────          ─────────────
liberarADespacho()→  cnInbox subscribe       
                     score + cola
                     publish OD            → subscribe          
                                             cargar LIFO
                                             cerrar carga      → subscribe OD
                                                                 GPS + POD
                                                                 advance entregada → admin ve
```

### Pendientes 8-10 para próxima sesión
8. **Validación MARKBOX server-side** (secuencial real + check duplicados)
9. **Generación de etiquetas PDF** para suppliers chinos con MARKBOX + Box X/Y
10. **Email de bienvenida real** (template m-05 ya está en `erp/data.jsx`)
11. **Geocoding API real** (Google Maps / Mapbox)
12. **Push notifications reales** (FCM / APNs)

### Archivos nuevos en esta sesión (addendum)
```
erp/data-bridge.jsx
erp/modules/despacho-dashboard.jsx
erp/modules/audit-log.jsx
```
