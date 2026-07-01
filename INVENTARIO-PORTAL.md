# Inventario del Portal del Cliente — ¿qué le falta camino al Norte?

> **Tipo:** exploración + diagnóstico (read-only). **Autor:** agente secundario · **Fecha:** 2026-07-01
> **Rama:** `feat/portal-inventario` · **Base:** `main` @ `c2e8a8a7`
> **Alcance:** estado REAL en `main` (no ramas en vuelo). No implementa features — es un mapa priorizado + propuesta de SDDs para el Director.

## TL;DR

El portal está **muy por encima** de lo que dice el roadmap `docs/architecture/portal-norte-erp-gaps.md` (fechado 2026-06-20): ese doc quedó **desactualizado** — sus prioridades #1 (asesor) y #2 (Naviera Tier 1) **ya están en prod**. Lo que queda es más fino:

- **Núcleo Norte LIVE para TODOS** (`NORTE_PORTAL_LIVE = true`): dashboard, envíos, detalle, finanzas, facturas, cuenta rediseñados + modo oscuro por defecto.
- **23 rutas** vivas, RLS sólida (defensa en profundidad, sin fugas encontradas).
- Lo que falta se divide en **(a) degradaciones honestas de backend** (hitos con fechas reales, cut-off de zarpes) y **(b) piezas visuales del Norte más nuevo** (ciclo animado en el héroe, nueva-compra 3-pasos, academia 2-col).

---

## 1 · Qué existe HOY (mapa de rutas)

Superficie: `app/portal/`. Backend: Supabase propio (como `/m` y `/back`), fuera de la frontera pública↔ERP. Auth **passwordless** (magic-link, SDD-0094; TTL en Supabase Auth = 1800s). Nav de **11 ítems**: Inicio · Mis envíos · Compras · Finanzas · Documentos · Reclamos · Referidos · Academia · Club · Mensajes · Cuenta.

### Auth (`app/portal/(auth)/`)
| Ruta | Qué hace |
|---|---|
| `/portal/login` | Magic-link solo-email (SDD-0094); copy explica "sin contraseñas, un solo uso" sin nombrar el TTL. |
| `/portal/callback` | Vincula sesión ↔ cliente vía `portal_bind_session` (acepta PKCE **y** token-hash). |
| `/portal/registro` | Redirect a `/registro` público (preserva `?est=`). |

### App autenticada (`app/portal/(app)/`)
| Ruta | Qué muestra | Datos | Norte |
|---|---|---|---|
| `/portal` | Dashboard: gate de activación → KPIs + próximo arribo (buque real) + actividad + cards de acción (aceptación T&C pendiente, perfil incompleto). | `getPortalActivation`, `getDashboardKpis`, `getNextArrival`, `getShipmentNaviera`, `listMyShipments` | ✅ `PortalDashboardNorte` |
| `/portal/envios` | Lista de envíos (tabs + buscador + progreso). | `listMyShipments` | ✅ `PortalShipmentsNorte` |
| `/portal/envios/[code]` | Detalle: **stepper horizontal** + card Naviera (buque/ETA/tracking vivo SeaRates) + documentos. | `getMyShipment`, `getShipmentNaviera`, `getShipmentTrackingSnapshot`, `listShipmentDocuments` | ✅ `PortalShipmentDetailNorte` |
| `/portal/proveedores` | Proveedores chinos del cliente + próximo código de compra. | `listSuppliers`, `listPrealertas` | Slice B |
| `/portal/compras` | Compras/prealertas con estado + acceso a etiquetas. | `listPrealertas`, `listSuppliers` | Slice B |
| `/portal/compras/[code]/etiquetas` | Etiquetas imprimibles de cajas + compartir con proveedor + add-ons de recepción (SDD-0098). | `getPrealertaByCode`, `listActivePrealertaAddons`, `listPrealertaServiceRequests` | Slice B |
| `/portal/finanzas` | Hub: KPIs de saldo + chips a Estimados/Cotizaciones + tabla de facturas. | `listMyInvoices`, `listMyEstimates` | ✅ card ciclo |
| `/portal/facturas` | Tabla de facturas + KPIs (Total/Pagado/Pendiente). | `listMyInvoices` | ✅ |
| `/portal/facturas/[code]` | Detalle: conceptos, totales, saldo, envío asociado, link a comprobante. | `getMyInvoice` | — |
| `/portal/facturas/[code]/comprobante` | Comprobante imprimible (**no fiscal**) `window.print()`. | `buildComprobante` | — |
| `/portal/facturas/[code]/aceptar` | Aceptación de T&C DDP con evidencia (hash/IP/versión) — capa legal SDD-0054. | `getPendingAcceptanceInvoice`, `buildAcceptanceCopy` | — |
| `/portal/estimados` | Estimados LEAD (calculadora pública) + "Avanzar a cotización". | `listMyEstimates` | — |
| `/portal/cotizaciones` + `/nueva` | Cotizaciones formales (cliente registrado pide, asesor cotiza). | `listMyCotizaciones` | — |
| `/portal/documentos` | Galería global de documentos de embarque (BL/POD/otros). | `listMyDocuments`, `signDocumentUrls` | — |
| `/portal/reclamos` | Reclamos del cliente (read-only) con evidencia + estado (SDD-0102). | `listMyClaims`, `listClaimEvidence` | Slice B |
| `/portal/referidos` | Código de referido + créditos + nivel (facturación) — cara de SDD-0051. | `getMyReferralProgram` | — |
| `/portal/academia` (+ curso/lección) | Cursos, progreso, diplomas, reproductor de lección (SDD-0093/0107). | `getPortalAcademy`, `getPortalCourseDetail`, `getPortalLesson` | — |
| `/portal/club` | Club DTD: membresía + compras grupales abiertas (SDD-0116, read-only V1). | `getPortalClub` | Slice E |
| `/portal/mensajes` | Chat con asesor + card **"Tu asesor" REAL** (nombre/cargo/WhatsApp) o fallback CRM público. | `getPortalThread`, `getPortalAdvisor` | — |
| `/portal/cuenta` | Perfil read-only + MARKBOX destacado + instrucciones para proveedor. | `getPortalClient`, `buildPortalSupplierMark` | ✅ hero navy |
| `/portal/perfil` | Form para completar foto de cédula + dirección (registro express). | `ProfileForm`, `getProfileCompleteness` | — |

**Ya conectado al Norte (poco/nada que construir):** Asesor asignado (`clients.advisor_id`), Naviera Tier 1 (SDD-0101: buque/ETA/tracking SeaRates deep-link), Referidos, Estimados↔Cotizaciones, Fidelización, Academia, Reclamos, Club, comprobante imprimible.

---

## 2 · Qué le falta vs. el Norte (priorizado)

Esfuerzo: **S** ≤1 día · **M** 2–4 días · **L** ≥1 semana. "Backend" = degradación honesta que la web ya espera; "UI" = pieza visual del Norte más nuevo.

| # | Falta | Tipo | Esf. | Dependencias | Por qué |
|---|---|---|---|---|---|
| **⭐1** | **Hitos reales con fecha + push de estado al cliente** (`shipment_events`) | Backend | **M** | tabla nueva + que la operación/automatización la puebla | Hoy el stepper deriva del `status` (`buildTimeline`), **sin fechas por hito**. Cierra la degradación más visible del detalle **y** el gap ya anotado "el portal es read-only, no hay push de estado al cliente". Desbloquea notificaciones de hito (mail/WhatsApp/push). |
| 2 | **Cut-off / calendario de zarpes en el portal** (`NextSailingCard`) | Backend | **M** | ninguna nueva — `sailings` ya existe (migr 0096: `cutoff/etd/pol/pod/space`) | La firma del Norte ("próxima salida de TU puerto" con cuenta regresiva al cierre de carga) **no existe**. La data ya está; falta la lógica "próximo zarpe del puerto del cliente" + la card. |
| 3 | **Ciclo del Cliente animado en el héroe** (4 estaciones) | UI | **S/M** | ninguna (frontend puro) | El Norte más nuevo (handoff `ciclo-cliente 2026-06-13`) reemplaza el arco SVG por un bucle animado Cotiza→Compra→Recibimos→Entregamos. Alto impacto de marca, sin migración ni ops. Quick win visible. |
| 4 | **Nueva compra full-screen 3-pasos + celebración Shipping Mark** | UI | **M** | ninguna (reusa prealertas) | Hoy `/compras` es lista + flujo plano. El Norte pide asistente guiado (proveedor→detalle→adjuntos) con celebración del MARKBOX al crear. |
| 5 | **Etiquetas: adjuntar packing list/factura/fotos antes de generar** | UI | **S** | Storage ya existe | `TODO` explícito en `compras/[code]/etiquetas/page.tsx:33` (Norte `LabelGenerator` paso "docs"). |
| 6 | **Academia desktop 2-columnas** | UI | **S** | ninguna | Hoy embebe la vista mobile-first; el Norte pide 2-col (catálogo + progreso) en desktop. |
| 7 | **Reportar pago / subir comprobante de transferencia** | Producto | **M** | decisión del founder | Hoy Facturas remite "escríbele a tu asesor". Un flujo de reportar pago + subir comprobante bajaría fricción del asesor. **Probablemente intencional** (DDP prepago por transferencia) → confirmar con founder antes de construir. |

### Diferidos ya conocidos (no re-priorizar acá)
- **Club Eventos + Proveedor del mes** → "próximamente" (SDD-0116 Slices C/D pendientes).
- **Factura FISCAL en PDF** → atado a SDD-0073 (fiscal v2, diferido). El comprobante no-fiscal ya cubre "descargar".
- **Mensajería en vivo / WhatsApp del cliente** → SDD-0056 F3 (diferida). El hilo ya existe.
- **Tracking público con snapshot vivo** → SDD-0101 Slice C (única pieza pendiente de Naviera).

---

## 3 · Deuda / roña detectada

**RLS / seguridad — sólida, sin hallazgos críticos.** Defensa en profundidad bien documentada: helpers `get_portal_client_id()` / `get_portal_client_markbox()` (SECURITY DEFINER, `search_path` fijo, migr 0080/0081) separadas de `get_user_tenant_id()`, y las queries filtran **explícito por markbox** además de la RLS (para el principal dual team+portal). Observaciones menores:
- **Dependencia de orden de llamada:** las lecturas con `createAdminClient()` (asesor, hilo, referidos, facturas borrador, aceptaciones) **asumen que la página llamó `getPortalClient()` PRIMERO** y pasa `markbox`/`tenant_id` ya resueltos por sesión. Invariante correcto y documentado, pero **frágil**: una página nueva que se olvide del orden abriría una fuga. → Valdría un helper `withPortalIdentity()` que encapsule el patrón (deuda preventiva, no bug).
- Tablas sin policy de portal leídas solo por admin scopeado: `user_tenants`, `user_profiles` (asesor), `referrals`, `legal_acceptances`, `conversations`. Todas con scope explícito. Aceptable.

**UX / mobile / a11y**
- **Nav de 11 ítems en scroll horizontal** sin overflow/hamburguesa. En mobile es una tira scrolleable larga → descubribilidad pobre (el 11º ítem "Cuenta" queda fuera de vista). Candidato a menú "Más" o agrupar. El comentario del `PortalHeader` está **desactualizado** ("Envíos · Facturas · Cuenta" / "4 ítems").
- **`/cuenta` (read-only, "lo cambia tu asesor") vs `/perfil` (self-service foto+dirección):** dos entradas al mismo concepto con narrativa distinta → posible confusión. Revisar consistencia del copy.
- **ETA heurística:** `estimatePortalEta` (45/50/35/5 días por servicio sobre `created_at`) cuando no hay ETA real de Naviera. Honesto y documentado; se resuelve solo cuando el operador refresca el tracking (operativo, no código).

**Copy / "próximamente" activos**
- `club/page.tsx:197` — Eventos + Proveedor del mes.
- `PrealertaAddons.tsx:71` — "Video de ayuda próximamente".
- `academia/.../[lessonId]/page.tsx:55` — placeholder "el video estará disponible pronto".
- **Código muerto:** `AccesoChip` en `finanzas/page.tsx` tiene prop `soon` ("Próximamente") que **ningún chip usa** → borrar.

**Docs**
- `docs/architecture/portal-norte-erp-gaps.md` **quedó obsoleto** (prioridades #1 asesor y #2 Naviera ya en prod). Este inventario lo supera; recomiendo que el Director lo actualice o lo marque como superado.

---

## 4 · Propuesta: qué SDD abrir y en qué orden

> **Numeración:** en `main` el máx de spec = **0119** y de migración = **0189**; hay ramas en vuelo hasta spec **0122** / migr **0191** (p. ej. `feat/construccion-norte`). **El Director asigna el número libre real** — abajo van con letra, no con número, a propósito.

1. **⭐ SDD-A · "Hitos del envío + notificación de estado al cliente"** — tabla `shipment_events` (`shipment_id`, `milestone`, `at`, `payload`) + poblado (manual al inicio, luego automatización) + stepper con fechas + notificación de hito (mail/WhatsApp/push). **Migración nueva.** Es el que más mueve la aguja: cierra la degradación del timeline y el gap de "push de estado al cliente". Empezar acá.
2. **SDD-B · "Cut-off / calendario de zarpes en el portal"** — lógica "próximo zarpe del puerto del cliente" sobre `sailings` (ya existe) + `NextSailingCard` con cuenta regresiva al cut-off. **Sin migración** (reusa SDD-0047). Barato relativo al impacto (es la firma del Norte que falta).
3. **SDD-C · "Portal Norte UI v2"** — agrupa las piezas visuales sin backend: ciclo animado en el héroe (#3), nueva-compra 3-pasos + celebración (#4), etiquetas-adjuntar-docs (#5), academia 2-col (#6). **Sin migración.** Se puede cortar en slices e ir de a poco.
4. **Decisión de founder (no SDD todavía):** reportar-pago/subir-comprobante (#7) — confirmar si el modelo DDP prepago lo quiere o si sigue 100% por asesor.

**Cierre de pendientes de specs viejas:** SDD-0075 (`portal-norte-alineacion`, proposed) agrupaba 3 frentes: **§2 soporte con casos** (✅ SDD-0102 Reclamos) y **§3 cotización desde el portal** (✅ en prod) ya están hechos; **solo queda §1** (estimado cosido al ciclo del envío + aceptación de T&C fundida en el detalle del envío). Ya la **reduje a §1** en su cabecera (`updated: 2026-07-01`) — **no se puede marcar done entera**. §1 es primo del roadmap #7 (aceptación fundida); evaluar fusionarlo con **SDD-B/SDD-C** o dejarlo como spec propia.

---

*Este documento es diagnóstico. La integración (merge/push/aplicar migraciones/abrir specs) la decide el Director.*
