# Motor de Crecimiento DTD — programa de construcción de los 6 sistemas

> **Qué es:** el programa ejecutable que construye los 6 sistemas de crecimiento del negocio
> ([`sistemas-negocio.md`](sistemas-negocio.md)): 1 Adquisición · 2 Ventas · 3 Entrega · 4 Manual
> de operaciones · 5 Contratación · 6 Control Financiero. Base conceptual (2 expertas):
> [`research/expertos-sistematizacion.md`](../../research/expertos-sistematizacion.md).
>
> **Versión:** v2 · 2026-07-18 — reescrito tras la **re-auditoría ultra** (20 agentes: 5 auditores
> frescos + 6 verificadores adversariales contra código y prod + auditor S6 + verificador de
> riesgos + 2 scouts + crítico de completitud). 29+5 claims verificados: **0 refutados**; los
> matices se aplicaron. Reemplaza al `plan-5-sistemas.md` (v1, mismo día).
> **v2.1 · 2026-07-19** — se agrega la **metodología de activación** (§M): la escalera 0→4 que
> define qué es "100%", la cadencia que mueve el Motor solo y el test de flujo completo.
> **Tablero vivo:** pestaña "Motor de Crecimiento" del dashboard general
> (`dashboard/motor-crecimiento/`, se mantiene con `/actualizar-dashboards`).
>
> **Estado:** aprobado por el founder (plan 18-jul) · decisiones abiertas en §6B.

---

## R · Resumen ejecutivo

**Una línea:** el software está construido (MÁS del que creíamos); la operación sigue en cero.
**El programa enciende, no construye.** Y como dice la base conceptual: *la cultura es lo que
toleras* — una operación al 0% con el ERP listo no es un problema de software.

**El número que manda:** ~85% de software construido, **~15% de activación** (marcador §M, medido
por la escalera 0→4 sobre las capacidades núcleo). Llegar al 100% = subir esa activación, no
escribir más código. Ningún sistema tiene todavía una capacidad núcleo en nivel 4.

**El estado en 8 números (prod, 18-jul-2026):**

- **0** avisos al cliente programados EN LA HISTORIA (motor SDD-0156 completo y configurado).
- **0** asientos en el libro diario (12 módulos FINANZAS listos; 91 cuentas seedeadas).
- **1** estimado marcado "enviada" en toda la historia (13 borradores).
- **0/405** clientes con llave Kommo↔ERP (`kommo_lead_id`).
- **19** embarques para **405** clientes registrados; pipeline de captura: 7 recepciones, 1 vinculada.
- **6** facturas de solo **2** clientes (lote de prueba de junio) — 4 vencidas por **$6.180** sin
  una sola gestión de cobro; **ambos clientes hoy en recompra vencida**.
- Nómina: **0** corridas; 6 empleados vivos, **6/6 con sueldo $0** (+3 registros soft-deleted por
  limpiar).
- "Pagas al llegar" (la promesa pública): **0** referencias a cobro en la app del camionero.

**Semáforo por sistema:**

| Sistema | Estado | Métrica norte | Dueño | Qué lo enciende |
|---|---|---|---|---|
| 1 · Adquisición | 🔴 opera ~0% | toques 50/sem · estimados 3-6/sem | asesor (§6B-2) | rutina diaria + Recuperación |
| 2 · Ventas | 🔴 opera ~5% | CBM pipeline vs 133/mes · recompra vencida = 0 | asesor + founder | cadena Kommo v2 + usar el cotizador |
| 3 · Entrega | 🔴 pipeline 0% | % cajas por pipeline · tránsito real | coordinación China (delegable F4) | embarque piloto E2E |
| 4 · Manual | 🔴 solo rol asesor | SOPs 0/18 · roles 0/4 | PMO edita, founder aprueba | SOPs desde el piloto |
| 5 · Contratación | 🔴 mitad humana en 0 | Sam fuera de ≥2 puestos · nuevo productivo ≤30d | PMO/Yolimar (RRHH, decidido) | kit F4 + nómina real |
| 6 · Financiero | 🔴 opera 0% | % cobrado vs facturado · DSO · margen/embarque | §6B-11 + contador (§6B-10) | piloto facturado/cobrado/costeado |

> **Cómo leer el 🔴** (metodología §M): con la escalera de activación, 🔴 = capacidad en **nivel
> 0-1** (construida, sin uso medido) — no un bug de software. Llegar al 100% = subir cada sistema
> a **nivel 4** (rutina en verde sostenida ≥4 semanas).

**3 riesgos verificados que no esperan** (van en F0):
1. **Gap RBAC del cotizador**: un rol solo-vista puede enviar/aceptar/rechazar estimados —
   disparando mail real al prospecto y write-back Kommo (sin mitigación por RLS ni middleware).
2. **Tarifas FCL públicas vencidas**: 20/41 con `valid_to` vencido servidas como vigentes en
   `/cotizador-flete`; el cron semanal de SeaRates no escribe desde el 6-jul.
3. **Write-back Kommo armado en REAL sin cron** (freno transitorio: el sync está en `error`).

**Decisiones: cerradas.** El 19-jul el founder respondió las 14 preguntas una por una (§6A) y se
aplicaron los 2 cambios autorizados a prod (write-back a dry-run · 2 add-ons apagados —
verificados). Quedan **3 micros**: la FECHA del contador · el dueño de las transiciones de
tracking · el nombre del usuario contable (§6B).

**Los 10 próximos pasos (dueño · semana):**
1. Founder responde §6B (sem 0).
2. Paquete seguridad F0: dry-run write-back + fix RBAC + tarifas FCL + apagar 2 add-ons (agente,
   con OK founder para lo que toca prod · sem 0).
3. Nombrar el operador de la rutina del asesor (founder · sem 0).
4. Semana 1 del asesor: kit WhatsApp completo + etiquetas unificadas + rutina + Recuperación
   (asesor · sem 1).
5. Consola GA4/Ads (~1h, prerrequisito real del gate de Ads) + GBP Valencia (founder · sem 1).
6. Cadena Kommo v2: sync verde → diagnosticar el 400/205 → dry-run → real → vincular 405
   (agente+founder · sem 1-2).
7. Embarque piloto E2E **facturado, cobrado y costeado** — S3 y S6 arrancan juntos (dueño
   Yiwu/Candy + oficina · sem 2-3).
8. Escribir SDD-0163 — el desbloqueador de S3+S4+S5 (agente · sem 2).
9. Estimación pública sin ERP + salida WhatsApp del estimado (agente · sem 2).
10. Agendar contador y abogada con fecha — gates de F3/F4 (founder · sem 2).

---

## 0 · Diagnóstico

**El patrón se confirmó y se amplió:** la re-auditoría encontró **más software dormido no
inventariado** (capa SEO/GEO completa de 18+ páginas, kit WhatsApp Business listo 0/10, SDD-0159
referidos con montos editables, SeaRates Container Tracking, TMS completo con on-time
instrumentado, módulo de asistencia, amonestaciones LOTTT, canal "Solicitar cotización" del
portal) y **menos operación de la declarada** (motor de avisos: 0 disparos jamás; nómina: 0
corridas; despacho/POD: 0 órdenes jamás; asistencia: 0 filas; libro diario: 0 asientos).

El eslabón roto es **humano** en los 6 sistemas: nadie opera la rutina, nadie adoptó el pipeline,
nadie factura dentro del sistema, nadie mide. Por eso el programa es **~70% arranque y medición,
~30% código** — y su regla madre viene de las expertas: *el negocio que depende del fundador no
escala; la palanca son sistemas, no más horas*.

---

## M · Metodología del Motor — cómo se sube al 100%

> La v2 tenía diagnóstico, riesgos y una lista de tareas. Lo que faltaba era **definir qué es
> "100%"** y **qué hace que el Motor se mueva solo**. Esto lo cierra. Regla madre (de la base
> conceptual): *el negocio que depende del fundador no escala* — así que la metodología misma
> tiene que funcionar sin que Sam la empuje.

### La escalera de activación (el corazón del método)

Una capacidad **no está lista cuando está construida**. Sube 5 escalones. Casi todo DTD está hoy
en el escalón 0 — por eso el software se veía "avanzado" y la operación estaba en cero:

| Nivel | | Qué significa | Manómetro |
|---|---|---|---|
| 0 | 🔲 Construido | el software existe; nadie lo usa (aquí está el ~85% de DTD) | — |
| 1 | 🟡 Instrumentado | hay un manómetro que muestra si se usa; el dato existe y se ve | amarillo |
| 2 | 🟠 Primer uso real | pasó **una** vez en la operación real (no seed, no prueba) | amarillo |
| 3 | 🔵 Rutina | pasa habitualmente, con **dueño y cadencia escritos** | verde claro |
| 4 | 🟢 En verde | el manómetro está en target y **se sostiene ≥4 semanas** | verde |

- **100% de un sistema = sus capacidades núcleo todas en nivel 4.** El Motor termina cuando los
  6 sistemas graduaron.
- **Regla dura: nada sube de nivel escribiendo código. Sube con USO real medido.** Esto corrige
  el sesgo que la auditoría destapó — "construido" se sentía como "avanzado".
- **El Motor es un termostato, no una lista.** Si un manómetro verde vuelve a amarillo (se dejó
  de usar), la capacidad **baja de nivel** y regresa al tablero. Graduar no es para siempre.

### El sistema operativo del Motor (la cadencia que lo mueve solo)

De la base conceptual (Marcilla, *el cuello eres tú* + *ritmo de reuniones*): el Motor necesita su
propio latido, o depende de que Sam se acuerde de mirarlo — el anti-patrón que el programa combate.

- **Diario · 5 min · cada dueño:** sube su número del día al manómetro. *Respuesta antes de la
  pregunta*: trae el dato, no la duda.
- **Viernes · 30 min · Revisión del Motor:** los 6 manómetros en pantalla; cada dueño reporta su
  top-3 y **qué subió de nivel**; se mueven las tarjetas; se fija el top-3 de la semana que viene.
  *Pirámide del habla en alza*: hablan primero los dueños, Sam cierra.
- **Mensual · cierre:** ¿qué sistema graduó? ¿qué capacidad **bajó** de nivel (regresión)? Ajustar
  fases y §3B.
- **Dueño del ritual:** Sam interino → **Yolimar (PMO)** en F4. El ritual es **lo primero que Sam
  delega** — coherente con sacar al fundador del cuello.

→ **Agenda para correr la Revisión del viernes** (los 30 min minuto a minuto, las 2 reglas, el
criterio de subir de nivel y el acta para Bitácora): [`revision-del-motor.md`](revision-del-motor.md).

### El test de flujo completo (para cazar lo que se cae del sistema)

De la base conceptual (Siavel, *¿qué pasa cuando el cliente paga?*): por cada evento de negocio se
traza el flujo entero y se marca **dónde se sale del sistema**.

- Eventos a trazar: **el cliente paga · la caja llega a China · el embarque arriba · el cliente
  reclama · entra un lead**.
- Es el test que ya cazó el hueco insignia: *"pagas al llegar"* con **0 referencias a cobro en
  `app/m/ve`** — el flujo del cobro se sale del sistema justo en la última milla.
- Cada flujo que se cae es una tarea de activación (entra a §2 brechas o §3B).

### Cómo se lee el avance (el % del tablero)

El % del tablero es de **tareas hechas** (mecánico); el % que importa es de **activación**: cuántas
capacidades núcleo llegaron a nivel 4. Mientras la Etapa B (page Studio con KPIs vivos) no exista,
la lectura de verdad son **los manómetros** — gris = construido, amarillo = instrumentado/primer
uso, verde = rutina en target. **Un sistema en 🔴 con todo el código listo no es una alerta de
software: es una capacidad en nivel 0-1 esperando USO.**

### Capacidades núcleo por sistema — el marcador del 100%

> Cada sistema **gradúa** cuando todas sus capacidades núcleo llegan a nivel 4. El "% de
> activación" de un sistema = Σ niveles ÷ (nº capacidades × 4). Marcador inicial (19-jul, del
> estado auditado); la Revisión del Motor lo va moviendo. **El software está ~85% construido; el
> Motor está ~15% activado — esa brecha ES el programa.**

**S1 · Adquisición — ~20% activado**

| Capacidad núcleo | Nivel | Dónde está |
|---|---|---|
| Captación inbound (web→aviso equipo, medida en GA4) | 🔵 3 | corre a diario (~1 lead/2 días); falta target vigilado |
| Prospección outbound del asesor (rutina + registro de toques) | 🔲 0 | sin operador, sin registro |
| Recuperación de leads fríos (SDD-0157, tandas) | 🔲 0 | lista, 0 uso |
| Kit WhatsApp Business en ejecución | 🔲 0 | construido, checklist 0/10 |
| Tablero semanal del asesor (5 números) | 🟡 1 | inbound medible en GA4; los 3 de actividad + SLA sin soporte |

**S2 · Ventas — ~10% activado**

| Capacidad núcleo | Nivel | Dónde está |
|---|---|---|
| Cotizador usado de verdad (marcar "enviada") | 🟡 1 | 1 sent en la historia; nadie lo marca |
| Cadena Kommo↔ERP (llave `kommo_lead_id` + write-back) | 🟡 1 | write-back en dry-run; 0/405 vinculados; sync en error |
| Recompra vencida medida y accionada (por embarque) | 🔲 0 | sin lazo; 0 gestión |
| Referidos $80/$60 flat en uso | 🔲 0 | LIVE editable, 0 referidos |
| KPI pipeline CBM/USD vs 133/mes | 🔲 0 | sin vista |

**S3 · Entrega — ~17% activado**

| Capacidad núcleo | Nivel | Dónde está |
|---|---|---|
| Pipeline de captura CN (predeclarar→escanear→estibar) | 🟡 1 | 7 recepciones, 1 vinculada; 23 predeclaradas sin recibir |
| Motor de avisos al cliente (SDD-0156) | 🔲 0 | 0 avisos jamás programados |
| Tránsito real (SeaRates tracking) | 🔲 0 | 0 filas; ETA heurística |
| Despacho/POD última milla VE (on-time instrumentado) | 🟡 1 | 0 órdenes/PODs; el on-time ya mide, sin datos |
| Orden accionable al operario (SDD-0163) | 🔲 0 | spec `proposed`, sin código |
| Lazo de calidad (reclamos) | 🟠 2 | 4 en prod, pipeline completo; sin ventana de plazo ni métrica |

**S4 · Manual — ~25% activado**

| Capacidad núcleo | Nivel | Dónde está |
|---|---|---|
| SOPs operativos por rol (15-18) | 🔲 0 | 0 SOPs formales; solo el rol asesor redactado |
| Casa del manual accesible a operación | 🟡 1 | lector SDD-0158 maduro pero RBAC excluye operations/warehouse |
| Fichas versión operario (paso a paso interno) | 🟡 1 | 24 fichas al cliente; sin versión interna; mezclan público/interno |
| Capa legal validada (Acuerdo v3.1 abogada) | 🟠 2 | v3 vigente y usado de base; validación final pendiente |

**S5 · Contratación — ~10% activado**

| Capacidad núcleo | Nivel | Dónde está |
|---|---|---|
| Nómina real corriendo | 🔲 0 | 0 corridas; 6/6 sueldo $0; criterio = contador (sin fecha) |
| Perfiles/roles con datos reales | 🟠 2 | 18 perfiles + roster 6/6 con `position_id`; 1 amonestación emitida |
| KPIs de puesto instrumentados (tablero desempeño) | 🔲 0 | 0/18; rosters desconectados (`operario_pins` sin FK) |
| Kit de contratación humana (reclutar→entrenar→medir d30) | 🔲 0 | sin doc |
| Onboarding self-service `/m/emp` | 🔲 0 | construido, 0 invitaciones/registros |

**S6 · Financiero — ~8% activado**

| Capacidad núcleo | Nivel | Dónde está |
|---|---|---|
| Facturación real (factura al arribo) | 🟡 1 | 6 facturas de prueba; 0 en 6 sem con 19 embarques |
| Cobranzas / cobro contra entrega con monto | 🔲 0 | 0 recibos; "pagas al llegar" con 0 refs en `app/m/ve` |
| Motor de asientos (libro diario) | 🔲 0 | 0 asientos |
| Costing por embarque (margen real) | 🔲 0 | 0 filas; margen desconocido |
| Cierre mensual + conciliación | 🔲 0 | 0 cierres, 0 conciliaciones |
| Reportes financieros (aging/cashflow/DSO) mirándose | 🟡 1 | implementados; muestran $6.180 vencido, sin rutina de revisión |

**Marcador global: ~15% activado** (18/124 puntos de nivel). Por sistema: **S4 25 · S1 20 · S3 17 ·
S2 10 · S5 10 · S6 8**. La lectura clave: **no hay un solo sistema con una capacidad núcleo en
nivel 4** — el Motor entero está entre construido y primer-uso. Subir de 🔲/🟡 a 🔵/🟢 es
exactamente la hoja de ruta §3.

---

## 1 · Estado por sistema (auditoría 18-jul, verificada adversarialmente)

### Sistema 1 — Adquisición de clientes

**Operando:** captación inbound completa en prod — calculadora con tarifa/topes en config de DB →
estimado `EST-` → **aviso al equipo verificado E2E** (email+Telegram con `wa.me`; volumen real:
~1 lead web cada 2 días, 3 avisos `delivered` el 17-jul) · `/registro` real (Shipping Mark +
opt-in + referido con crédito automático) · `/enlaces` con UTM · `/contacto` · pestaña
**Recuperación** (SDD-0157) lista · **capa SEO/GEO que la v1 subponderó**: 18 geo-páginas + hub
`/importar-de-china` + `/puerta-a-puerta` + `/markbox` + `/cotizador-flete` + `/calculadora-fcl` +
`/calculadora-terrestre` + `/faq` + `/glosario` con schema rico · GA4 ya mide `generate_lead` y
`whatsapp_click`.

**Dormido:** write-back ERP→Kommo (ver S2) · **kit WhatsApp Business completo sin ejecutar**
(8 perfiles + catálogo + 9 respuestas rápidas + 2 herramientas HTML; faltan 3 fotos; checklist
0/10) · GBP Valencia sin verificar · YouTube con plan escrito y 0 ejecución · **3 videos del
registro YA GRABADOS sin publicar** · cron `portal-cold-reminder` gated OFF · ~231 clientes sin
invitar al portal (freno: ~20% rebote) · Ads Fase 2 apagada — **su gate real incluye limpiar la
consola GA4/Ads** (quitar "Vista de página" como conversión principal; 9k page views contaminan
Smart Bidding) además del SLA <5 min (hoy inmedible).

**Falta:** lazo de **recompra 30/45** (cero código; la fuga #1) · sender de campañas (matiz: el
activo opt-in son solo **11 personas** — la base real es Kommo ~2.100) · persistir `/contacto` en
DB · módulo white-label (pero el **carril comercial del Motor 2 NO depende del módulo**: pitch
escrito, tarifa fija facturable a mano; faltan acuerdo de 1 página + lista de ~15 prospectos
aliados + dueño) · **barrido DDP→"Puerta a Puerta"** (rama `origin/claude/jolly-proskuriakova`
sin mergear — necesita REBASE; 18 menciones en `lib/geo-zonas.ts`; el CTA de `/enlaces` dice
"Cotizar DDP") · copy del año en `<RespuestaRapida>` del home ("empresa 2010" → narrativa 2015).

**Decidido 18-jul:** los **estimados públicos salen del ERP** — el visitante no registrado ya no
crea `EST-`; cotiza y el desglose viaja en el `wa.me` (el CRM gana contexto, el ERP queda limpio).

**Sin dueño:** TODA la rutina §5 de [`adquisicion.md`](adquisicion.md) · ritual del viernes ·
checklist del link-in-bio (5 casillas vacías) · monitoreo del "Cambio de dirección" de Search
Console (corre hasta ~dic-2026).

**Sin medir:** del tablero semanal de 5 números — los 3 de actividad del asesor + la mediana de
respuesta no tienen soporte; el volumen inbound SÍ es medible ya en GA4; "estimados enviados" es
parcial (falta la vista semanal).

### Sistema 2 — Ventas

**Operando:** Kommo connector read-only (edge `kommo-sync` v6, cron diario; espejo CON usuarios —
los asesores tienen nombre) · cotizador completo draft→sent→accepted→shipment · tablero SDD-0078 ·
reporte "Por agente" (SDD-0142 — pero lee el espejo y atribuye por `kommo_lead_id`: con 0/405
vinculados rinde $0 para todos) · doctrina completa (embudo, 18 guiones, manual de peso).

**Dormido — la cadena estimado→Kommo→recompra, con el diagnóstico CORREGIDO por verificación:**
1. `kommo_connections.status='error'` desde el sync fallido del 18-jul — drain y push rehúsan
   hasta que vuelva a `active`.
2. El push de alta falló con **Kommo 400 code 205** (derechos de cuenta/payload al crear
   contacto) — **NO es un 401 de token** como decía la v1. Diagnóstico antes de flip.
3. **0/405 clientes con `kommo_lead_id`** → todo lo que atribuye o encola rinde 0.
4. Estimados: 1 solo pasó por "sent" en la historia — la transición SÍ corrió y encoló nada por
   falta de llave; en la práctica nadie marca "enviada".
5. Cron del drain sin programar (los flags quedaron prendidos FUERA del orden del checklist).

También dormido: fidelización + **referidos con montos LIVE** ($80 referidor / $60 referido,
editables — SDD-0159; 0 referidos en prod; el crédito 0197 es advisory: registra, el asesor lo
aplica en la próxima factura) · venta adicional de add-ons (0 solicitudes; el staff SÍ puede
cotizarlas — la brecha es facturarlas/sumarlas al estimado) · **canal "Solicitar cotización" del
portal: LIVE con 0 usos jamás y sin vigía** · SDD-0075 Slice B sin construir (alcance real del
flag `SHIPMENT_ACCEPTANCE_CTA_LIVE`: solo duplica el CTA del detalle; `/portal/facturas/.../aceptar`
sigue viva por diseño; la card del dashboard del portal es SDD-0054, otro flujo).

**Falta:** reporte de **recompra vencida** sobre compras reales (decisión previa: fuente —
backfill facturas / proxy embarque / Kommo; hoy solo 2-7 clientes tienen historial) · KPI CBM/USD
pipeline vs **133 CBM/mes** · **salida WhatsApp/PDF del estimado** (94,5% de Kommo sin email — el
envío real es transcripción manual) · regla mail `quote_accepted` (aceptar no notifica a nadie) ·
columna asesor en `quotes` (atribución imposible hoy) · job de expiración (`expired` es
display-only: el auto-perdido a 14 días no puede ocurrir) · **fix RBAC `transitionStatus`**
(verificado — F0).

### Sistema 3 — Entrega (el núcleo operativo)

**Operando (software):** motor de avisos SDD-0156 A–E + SDD-0162 · tracking `/track` + portal ·
add-ons SDD-0098 · packing list + link proveedor SDD-0096 · recepción VE por escaneo · TMS
completo (rutas → `out_for_delivery`/`last_mile` automáticos; POD con foto; **on-time de última
milla ya instrumentado**) · inspecciones white-label SDD-0066.
**Realidad de operación: cero.** El motor de avisos **jamás programó un aviso** (0 filas; último
`shipment_event`: 2026-06-03 — el journey lleva 6 semanas congelado); despacho/TMS: **0 órdenes,
0 PODs jamás**; estiba: 0 posiciones, `consolidation_items`=1, cola QR 0 impresiones.

**Construido y 0% adoptado — pipeline de captura (migr 0244/0245/0246):** pre-declarar →
`/m/cn/recibir` por escaneo → pedir contenedor → estibar por lotes → aviso 0162. Prod: 7
recepciones, 1 con `prealerta_id` (vía UPDATE del Studio, no escaneo); las 23 cajas pre-declaradas
siguen `esperada`. El operario usa `/m/cn/nueva` (tipeo) — **que NO dispara el aviso de
recepción** (solo `recibir/actions.ts` lo llama).

**Fuente de tránsito real construida y dormida:** SeaRates Container Tracking completo
(`lib/studio/naviera-tracking/`, guard de cuota, snapshots) con **0 filas** — nunca usado; la ETA
pública es una heurística `created_at + 45/50/35/5` días.

**Falta:** **SDD-0163** (sin spec ni código): modalidad + orden LCL/FCL + **orden accionable al
operario** (hoy `app/m/` tiene 0 referencias a add-ons: el operario no ve qué servicios pidió el
cliente) · HOLD sin efecto físico (nada retiene, excluye ni corre el reloj de bodegaje; la config
de 15 días que la ficha promete tampoco existe) · `prealertas.shipment_id` con consumidores y sin
escritor · POD→`delivered` (NO es fix chico: la cadena de despacho no tiene `shipment_id` — FK
polimórfico por markbox; tarea propia) · `/track` público ignora la visibilidad configurada (el
fix va en la RPC `public_track_shipment` o `lib/shared` — la frontera ESLint impide importar
`lib/studio`) · skips del fanout sin fila · config de avisos incompleta (falta regla
`received_ve` y copy propio de `consolidated`/`eta_set`) · **contradicción bodegaje 7 vs 15 días**
(`lib/servicios-detalle.ts` vs FAQ+Acuerdo) · alcance de canales: 136/405 clientes sin email
(33,6% inalcanzable), 3 push.

**Lazo de calidad:** reclamos = único con uso real (4 en prod, pipeline completo) — sin ventana
de plazo ni métrica; el POD no tiene flag estructurado daño/faltante; scorecard de proveedores
(SDD-0111, migr 0236) existe y es la plantilla del desempeño.

### Sistema 4 — Manual de operaciones

**Cubierto:** rol asesor-captación (guiones + manual de peso + rutina + condiciones de cotización
— este último YA se sirve en el lector). **La capa legal es medio manual escrito**: Acuerdo v3
(pre-alerta obligatoria con checklist · bodegaje 15 días y abandono a 60 · PCE "no se entrega sin
pago completo" · cargos de cancelación) + GLOSARIO (PCE, retención, HOLD de despacho, Override
solo-Sam) — los SOPs se redactan como **destilado citado** de esas cláusulas + los módulos ya
construidos (p.ej. `DispatchPaymentPolicy` estricto/hold/credito_whitelist = el motor del cobro
contra entrega), y pasan por la abogada (v3.1 pendiente).

**Disperso / no operativo:** las **24 fichas** de servicios están redactadas al cliente (falta nº
de fotos y el paso a paso interno ante faltante; "contra qué doc se cuenta" SÍ está) · 19
runbooks 19/19 técnicos · specs que ningún operario leería · Bitácora que no destila a SOP ·
`docs/operaciones/` = 2 planillas de costeo.

**La casa del manual (hechos verificados):** el lector SDD-0158 es la infraestructura más madura
**pero es invisible para operación** — RBAC solo marketing/commercial/support (+admin); operations
y warehouse quedan fuera y los operarios PIN ni tienen sesión Studio; además el root está fijo en
`docs/marketing` (servir `docs/operaciones/` exige tocar root + tracing). 4ª opción detectada:
la capa por-servicio ya editable (`service_configs.notes_internal` + `service_faqs` con audiencia
interna + skill Asesor de Servicios). ⚠️ Las fichas mezclan copy publicable con datos internos —
**split público/interno obligatorio** antes de renderizarlas o se filtra IP.

**Colisión de nombres a desambiguar en los SOPs:** HOLD-consolidar (add-on del cliente) ≠ HOLD de
despacho (retención por pago).

### Sistema 5 — Contratación

**Operando (ERP):** 18 perfiles REALES con triggers/skills/KPI/gobernanza (la gobernanza del
dinero vive en el seed: operador-erp no mueve plata, 2ª firma internacional, proveedores nunca al
ERP) · alta unificada · RBAC 7 roles + 4 de operario por PIN · **roster real cargado**: 6
empleados vivos 6/6 con `position_id` · amonestaciones Art. 79 LOTTT (1 emitida — el único acto de
gestión registrado) · offboarding construido (disable RPC anti-lockout + ban Auth + PIN off; falta
solo el checklist).

**Construido, operación CERO (corrige a la v1, que los daba "operando"):** nómina — 0 corridas,
sueldos 6/6 en $0, el criterio de prestaciones es **TODO del contador** (gate externo sin fecha);
el único dinero real: 2 pagos a prestadores · onboarding self-service `/m/emp` — 0 invitaciones,
0 registros (los 6 se crearon del lado admin) · asistencia — módulo completo, 0 filas · bitácora —
0 tareas (el push diario de tareas está LIVE y mudo).

**Falta:** la mitad humana (reclutar → entrevistar → contratar → entrenar → medir) sin un doc ·
**tercer roster desconectado**: `operario_pins` sin FK a `nomina_employees` (migración chica,
prerequisito del tablero de desempeño) · KPIs de puesto 0/18 instrumentados · contrato de
PRESTADOR de servicios (el lane que ya mueve dinero) · limpieza: 3 empleados soft-deleted +
revisar perfiles de las contrataciones (pedido del founder 18-jul).

**Decidido 18-jul:** RRHH → **PMO (Yolimar)** con el kit F4 · Sam sale primero de **Coordinación
China y Sourcing/compras** (nota de realidad: Yiwu es operador EXTERNO — Candy; la palanca es
SOP de proveedor + PIN `/m/cn`, medido con el patrón scorecard 0236, no contratación propia).

### Sistema 6 — Control Financiero *(sumado por el founder 18-jul)*

**El caso más extremo del patrón:** el hilo MÁS construido del ERP (12 módulos FINANZAS · 8
motores de posting · specs 17/18 `done` y fieles al código · reportes de aging/cashflow/estado de
resultados/posición IVA ya implementados · cabina del dueño con forecast de salidas CxP) y **la
operación es literalmente cero**: 0 asientos · 6 facturas (lote de prueba de junio; cero facturas
en 6 semanas con 19 embarques) · 0 recibos de cobranza · costing 0 filas (el margen real es
desconocido) · 0 conciliaciones · 0 cierres · fiscal v2 **OFF por decisión vigente del founder
(15-jul — no es deuda)** · financiero China 0 movimientos · 0 crons financieros.

**Dormido (despierta con USO, casi sin código):** cobranzas completo (recibo correlativo, pagos
sin identificar, PDF) · motor de asientos (dispara solo al primer uso real) · cierre de período ·
conciliación · costing (las 2 planillas xlsx de `docs/operaciones/` son la fuente) · nómina ·
rendición a la Operadora · portal reportar-pago · financiero China.

**Falta (código con retorno):** **cobro contra entrega dentro del sistema** — "pagas al llegar"
está en todo el sitio y `app/m/ve` no tiene NI UNA referencia a cobro; nada dispara la factura al
arribo · proyección de caja de ENTRADAS (CBM en agua × tarifa) · posición de caja real (cuentas
1.1.1.x vacías; sin arqueos) · política de crédito a clientes (0 columnas) · presupuesto vs real.

**Sin dueño:** ¿quién factura? ¿quién cobra? ¿quién concilia? ¿quién cierra el mes? ¿quién es el
contador? (1 usuario con rol `accounting` sin rutina).

---

## 2 · Brechas priorizadas

**P1 = bloquea el sistema · P2 = lo hace medible/repetible · P3 = lo escala.**

| # | Brecha | Cierra con |
|---|---|---|
| 1-P1 | Rutina del asesor sin operador | §6B-2 + F1 |
| 1-P1 | Lazo de recompra 30/45 inexistente | reporte + aviso (F1) — decidir fuente antes |
| 1-P2 | Tablero semanal inmedible (3 números de actividad + SLA) | registro de toques + vista semanal (F1) |
| 1-P3 | Motor 2 aliados sin carril comercial | acuerdo 1 pág + lista ~15 + dueño (F2) — no espera el módulo |
| 2-P1 | Cadena Kommo (status error → 400/205 → llave 0/405 → cron) | F1, en ese orden |
| 2-P1 | Gap RBAC transiciones + write-back armado | F0 (verificados) |
| 2-P2 | KPI pipeline CBM/USD · conversión · salida WhatsApp del estimado | F1 |
| 3-P1 | 0% adopción del pipeline · avisos jamás disparados | piloto E2E + puente `/m/cn/nueva` + config completa (F0/F2) |
| 3-P1 | SDD-0163 sin spec (orden al operario) | escribirla (F2) — desbloquea S3+S4+S5 |
| 3-P2 | Conexiones rotas (prealerta↔shipment · /track · skips · POD→delivered) | 3 PRs chicos + 1 tarea propia (F2) |
| 4-P1 | 0 SOPs operativos; fichas sin versión operario | 15 SOPs + 3 de plata, destilados del Acuerdo, desde el piloto (F3) |
| 4-P2 | La casa del manual es invisible para operación | RBAC + root/tracing del lector, o alternativa (§6B-5, F3) |
| 5-P1 | Mitad humana en cero + gates externos sin fecha | kit F4 + contador/abogada con fecha |
| 5-P2 | KPIs 0/18 · rosters desconectados | tablero desempeño + puente pins↔employees (F4) |
| 6-P1 | Nadie factura/cobra dentro del sistema; cobro al arribo extra-sistema | piloto facturado/cobrado/costeado (F2) + SOP de plata (F3) |
| 6-P2 | Margen, DSO, caja: invisibles | costing del piloto + reportes ya listos mirándose (F2-F3) |

---

## 3 · Hoja de ruta (re-cortada POR DUEÑO — tope: top-3 por semana por dueño; el resto → §3B)

> Las fases F1 (ventas) y F2 (entrega+financiero) corren **en paralelo** — dueños distintos. F3
> (manual) se escribe DESPUÉS del piloto para documentar realidad. F4 entrena con el manual.
> El detalle tarea por tarea, con IDs y bloqueadores, vive en el **tablero**
> (`dashboard/motor-crecimiento/dashboard-data.json`) — este doc manda, el tablero refleja.

### F0 · Decisiones y seguridad (semana 0 · casi 0 código)
- **Founder:** ✅ respondió §6B (14/14, 19-jul) · dueños: asesor=Sam interino ✅, Yiwu=acuerdo con
  Candy ✅, **tracking = pendiente** · ✅ OK para apagar los 2 add-ons.
- **Agente — hecho el 19-jul (sin commit):** ✅ fix RBAC `transitionStatus`
  (+`linkEstimateToClientAction`) · ✅ tarifas FCL (helper `isOceanRateExpired` + degradado a
  `no_rate` + 5 tests; "referencial" ya existía) · ✅ write-back a dry-run (aplicado y verificado
  en prod) · ✅ add-ons `compactar`/`cotizar_medir` apagados en prod · ✅ `checklist-kommo.md`
  sincronizado · ✅ etiquetas WhatsApp unificadas · ✅ bodegaje 7→15 en `servicios-detalle`.
- **Agente — pendiente:** completar config del motor de avisos (regla `received_ve` + copy) ·
  filtro `valid_to` en la RPC (migración, va con la próxima ronda a prod) · diagnosticar el cron
  SeaRates muerto desde el 6-jul.

### F1 · Encender Ventas (S1+S2 · semanas 1-3)
- **Asesor (al nombrarse):** rutina diaria completa (guiones cargados + kit WhatsApp + tandas
  Recuperación + registro de toques) · usar el cotizador (marcar "enviada") · pedir 1 referido/día
  (con el flat $80/$60 si §6B-6 = sí) · ritual del viernes.
- **Founder:** limpieza consola GA4/Ads (~1h — prerrequisito real del gate de Ads) · GBP
  Valencia · custom fields Kommo + migrar embudos + repartir cartera (pasos de navegador).
- **Agente:** cadena Kommo v2 (sync verde → diagnóstico 400/205 → dry-run → real → vincular ~405)
  · reporte "Recompra vencida" + KPI pipeline · **estimación pública sin ERP** (decisión 18-jul) ·
  salida WhatsApp/PDF del estimado + regla `quote_accepted` · vigía del canal "Solicitar
  cotización" del portal (meterlo a la rutina con SLA).

### F2 · Adoptar la Entrega + arrancar el Financiero (S3+S6 · paralela a F1 · semanas 1-4)
- **Operación (dueño Yiwu/Candy + oficina):** embarque piloto E2E — prealerta → etiqueta →
  escaneo → estiba → `consolidation_items` → avisos reales → **factura al arribo → recibo de
  cobranzas (primeros asientos reales) → costos en costing (margen conocido)**. Dueño de
  transiciones de tracking con cadencia diaria.
- **Agente:** ✅ SDD-0163 (spec escrita 19-jul, `proposed` — `docs/specs/0163-orden-al-operario/`;
  3 slices: orden al operario + modalidad de envío + orden LCL/FCL diferida) · PRs de conexión
  (prealerta→shipment · `/track` visibilidad vía RPC · skips con fila · aviso desde `/m/cn/nueva`)
  · card de adopción + vista staff de avisos · verificación E2E push/email + campaña de los 136
  emails · POD→delivered (tarea propia) · Motor 2: acuerdo 1 pág + lista de prospectos aliados.

### F3 · Escribir el Manual (S4+S6 · al cerrar el piloto · semanas 4-8)
- 15 SOPs por rol + **3 SOP de plata** (facturar+cobrar diario · cobro contra entrega · cierre
  mensual) — como destilado citado del Acuerdo v3 + GLOSARIO + módulos; desambiguar HOLD ·
  revisión de la **abogada** (v3.1) con fecha · casa del manual según §6B-5 (con RBAC ampliado y
  split público/interno) · versión operario de las 6 fichas · checklist de excepciones en `/m`.

### F4 · Delegar y medir (S5+S6 · tras F3 · semanas 8-12)
- Tablero de desempeño (patrón scorecard 0236; prerequisito: puente `operario_pins`↔
  `nomina_employees`) · kit de contratación (Yolimar; + contrato de prestadores) · plan de
  entrenamiento + evaluación día 30 (SOPs entregados con acuse vía `nomina_employee_comms`) ·
  **encender la nómina real** (contador → sueldos reales → 1ª corrida; limpiar los 3
  soft-deleted y revisar perfiles) · offboarding checklist · **Sam sale de Coordinación China y
  Sourcing** (titulares nuevos en `nomina_positions`).

### 3B · Backlog explícito (con fase tentativa, no entra al presupuesto de capacidad)
Publicar los 3 videos grabados + arranque YouTube (F2) · invitaciones portal por tandas con
control de rebote (F2) · persistir `/contacto` en DB (F3) · sender de campañas — bajo impacto: 11
opt-ins (F4) · módulo white-label tenant (SDD futuro; gate billing) · factura automática al
arribo + proyección de caja de entradas + cobro con monto en el POD (SDD S6) · columna asesor en
`quotes` + job de expiración (F2-F3) · add-ons cotizables dentro del estimado (F3) · flag
daño/faltante en el POD + bodegaje cobrable instrumentado (F3) · conectar "Reportar fricción" al
ciclo del manual (F3) · Academia con audiencia empleado (F4) · Etapa B del dashboard: page
`/studio/marketing/programa` patrón Radar con KPIs vivos (F2-F3) · piloto SeaRates tracking 1
contenedor (F2) · scorecard de proveedores al tablero (F4) · monitoreo Search Console (rutina
founder).

---

## 4 · Dueños y métricas

| Sistema | Dueño | Métrica norte | Dónde se ve |
|---|---|---|---|
| 1 · Adquisición | **Sam (interino** — traspaso en F4) | toques 50/sem · estimados 3-6/sem | tablero Motor (manómetros S1) + ritual viernes |
| 2 · Ventas | Sam (interino) + founder en cierre | CBM pipeline vs 133/mes · recompra vencida = 0 | reportes F1 + manómetros S2 |
| 3 · Entrega | coordinación China (delegable en F4) · tracking: §6B-2 | % cajas por pipeline (100% en 60 días) · tránsito real | card adopción + manómetros S3 |
| 4 · Manual | PMO (Yolimar) edita · founder aprueba | SOPs /18 · roles /4 | lector SDD-0158 ampliado + manómetros S4 |
| 5 · Contratación | PMO (Yolimar) — RRHH decidido 18-jul | Sam fuera de ≥2 puestos · nuevo productivo ≤30d | nomina_positions + manómetros S5 |
| 6 · Financiero | **usuario contable actual** (§6B-3 el nombre) + contador (fecha §6B-1) | % cobrado vs facturado · DSO · margen/embarque | reportes FINANZAS (ya listos) + manómetros S6 |

---

## 5 · Reglas del programa

1. **No se rehace ningún módulo LIVE** — se enciende, se conecta o se completa.
2. Todo lo decidido queda escrito en este tree o en specs SDD — no en memoria suelta.
3. **Presupuesto de capacidad: top-3 tareas por semana POR DUEÑO** (founder / asesor / PMO /
   agente). Lo que no cabe vive en §3B — visible, no olvidado. (La regla vieja de "1 mejora por
   semana por sistema" se reemplaza: con 6 sistemas y 4 dueños, el corte correcto es por dueño.)
4. Cuando prod contradiga un doc de estado, se corrige el doc en el mismo ciclo (el drift del
   checklist Kommo ocultó un riesgo real y 4 pasos ya hechos).
5. Los sistemas 3 y 4 construyen sobre el momentum del portal + infografías; el catálogo maestro
   es la fuente del "qué", los SOPs del "cómo".
6. **Claims sin verificación adversarial se marcan** "(1 auditor)" — hoy no queda ninguno: los 5
   riesgos nuevos fueron verificados el 18-jul (5/5 confirmados).
7. **Regla de la respuesta antes de la pregunta** (de la base conceptual): nadie escala un
   problema sin traer la solución propuesta ("pasó esto, lo resolví así, tengo A o B").
8. **IA para lo repetitivo; el criterio es humano** — las decisiones del §6 son del founder,
   siempre.
9. **El avance se mide por la escalera de activación (§M), no por tareas cerradas** — una
   capacidad sube de nivel solo con USO real medido; si un manómetro verde vuelve a amarillo,
   baja de nivel y regresa al tablero. El Motor se maneja con la cadencia §M (diario · viernes ·
   mensual), no con la memoria de Sam.

---

## 6 · Decisiones

### 6A · Decididas (2026-07-18, founder)

1. **Nombre del programa: "Motor de Crecimiento DTD"** ("Motor 1/Motor 2" de ventas.md se citan
   siempre con número para no colisionar).
2. **+Sistema 6 · Control Financiero** — el Motor son 6 sistemas; el ERP controla todo.
3. **Dashboard: los 3 encajes por etapas** — pestaña Kanban propia (✅ creada) + docs en el lector
   del ERP (✅) + page Studio con KPIs vivos (Etapa B, backlog).
4. **Contenido mixto desde el día 1** — avance del programa + manómetros; lo no instrumentado en
   gris.
5. **Año fundacional oficial: 2015** (fundación Venezuela) · 2008 = experiencia · 2010 = solo
   hito. Docs corregidos (estrategia, seo, llms.txt); queda `<RespuestaRapida>` del home (copy
   visible, CC-T03 del tablero).
6. **Canal de avisos: wa.me asistido + captura de emails** (API de WhatsApp se revisa a los 256
   contactos/3 agentes; campaña para los 136 emails faltantes).
7. **RRHH → PMO (Yolimar)** con el kit F4.
8. **Delegación de Sam: primero Coordinación China y Sourcing/compras.**
9. **Estimados públicos fuera del ERP** — el no registrado no crea `EST-`; su cotización viaja en
   el `wa.me`. (Implementación: F1; definir destino de los 8 EST- web históricos.)
10. Fiscal v2 permanece **OFF** (decisión vigente 15-jul — no es deuda del programa).

**Ronda 2 (2026-07-19 — el founder respondió las 14 preguntas una por una):**

11. **Write-back Kommo → dry-run YA.** ✅ Aplicado y verificado en prod (`writeback_dry_run=true`);
    el encendido sigue el orden del runbook (cron en ensayo → validar → real, F1-T04).
12. **La rutina del asesor la opera SAM como interino** — el traspaso a una persona dedicada
    sigue siendo meta explícita de F4.
13. **Piloto = el próximo embarque que entre**, corrido completo (captura + avisos + factura +
    cobro + costeo). Sub-tarea: acuerdo con Candy para el escaneo con PIN en Yiwu.
14. **SDD-0163 se escribe YA** (spec primero; implementación tras el Gate 1 de Cloud Design).
15. **Casa del manual = lector del ERP ampliado** (grupo Operaciones + RBAC a operations/warehouse
    + servir `docs/operaciones/`).
16. **Referidos arrancan YA con el flat $80/$60** (editables); la variante $/CBM de Aliados va
    aparte.
17. **Recompra vencida se mide POR EMBARQUE** (último shipment; facturas como 2ª fuente cuando S6
    arranque).
18. **El CTA de aceptación se prende CON EL PILOTO** (cuando genere su factura real).
19. **Bodegaje gratis en Yiwu = 15 días** (canon del Acuerdo). ✅ Ficha pública corregida (7→15 en
    `lib/servicios-detalle.ts`).
20. **Contador: el founder lo tiene y lo agenda** — falta solo la fecha (BLK-008 del tablero).
21. **Factura y cobra el usuario contable actual** (rol `accounting` del Studio).
22. **La abogada se agenda YA** — la v3.1 corre en paralelo a F1/F2 para que los SOPs lleguen con
    base validada.
23. **El expediente de defensa se abre a soporte/comercial** (cambio de RBAC, F1-T12).
24. **Add-ons `compactar` + `cotizar_medir`: apagados.** ✅ Aplicado y verificado en prod (2 filas
    `is_active=false`; los otros 5 intactos).

### 6B · Abiertas (3 micros)

1. **Fecha del contador** (sesión: criterio de prestaciones + primer cierre) → al fijarla,
   BLK-008 se resuelve y F4-T06 se destraba.
2. **Dueño de las transiciones de tracking** (cadencia diaria en `/studio/tracking`) — el único
   de los 3 dueños de F0-T03 sin nombre.
3. **Nombre del usuario contable** (para fijarlo en el tablero y en los SOPs de plata).

---

## 7 · Registro de riesgos estructurales

| Riesgo | Estado | Mitigación |
|---|---|---|
| Automatización email-first en base WhatsApp-first (34% inalcanzable; 94,5% de Kommo sin email) | activo | decisión 6A-6 (wa.me asistido + captura) — todo KPI de avisos lleva asterisco de alcance hasta cerrar la campaña de emails |
| Concentración en Sam (4-5 titularidades + 2ª firma + suplencias) | activo | F4 + decisión 6A-8; el propio programa mide la salida |
| Gates externos sin fecha (contador · abogada) | activo | §6B-10/12 — bloqueadores con owner externo en el tablero |
| Sobrecarga (~30 tareas nuevas) vs capacidad real | mitigado | regla 3 (top-3/semana/dueño) + §3B backlog visible |
| Drift documental recurrente (checklist Kommo, año, etiquetas, README) | mitigado | regla 4 + tablero como espejo + ritual del viernes |

---

*Evidencia: re-auditoría 18-jul (5 auditores + 6 verificadores + S6 + verificador de riesgos + 2
scouts + crítico; transcripciones en la sesión `feat/5-sistemas`). Números citados (0 avisos, 0
asientos, 1 sent, 0/405, 7/1, $6.180, 6/6 en $0, 20/41, error 400/205) verificados contra prod
por agregados read-only, sin PII. La v1 (`plan-5-sistemas.md`) fue reemplazada por este doc el
mismo día — el prompt histórico que la generó vive en
[`prompt-sesion-5-sistemas.md`](prompt-sesion-5-sistemas.md).*
