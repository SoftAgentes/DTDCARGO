> # ⛔ CERRADA — NO SE IMPLEMENTA
>
> **Decisión del founder, 2026-08-23.** El VPS multi-cliente **no se va a
> trabajar**: esto fue investigación para decidir, la decisión ya se tomó y es
> que no. DTD se queda donde está.
>
> Se conserva por lo que costó levantarla y porque el día que la pregunta
> vuelva, la respuesta ya está estudiada. **No es un pendiente. No se propone
> de nuevo, no se lista en checklists y no se resume sin que el founder la pida
> por su nombre.**

# Contabo como plataforma VPS para producción — informe actualizado (ago 2026)

> Investigación web profunda, agosto 2026. Contexto: hospedar un ERP de producción
> (Postgres/Supabase self-hosted + Next.js + ~13 buckets de archivos) y varias apps web
> de clientes cobrando mensualidad, desde una cuenta creada en Venezuela.
> Todo lo aproximado está marcado **[aprox.]**. Las cifras llevan URL de origen.
> Los precios de Contabo cambian seguido — confirmar en checkout antes de comprar.

---

## 1. Catálogo y precios actuales (ago 2026)

### 1.1 Cloud VPS "Core" (línea económica, SSD)

Contabo renombró la línea en 2026: los nombres ahora son el **número de vCPU**
(Cloud VPS 4/6/8/12/16/18); los viejos "VPS 10/20/30/40/50/60" quedaron retirados
a mediados de 2026.

Leído de contabo.com/en/vps (ago 2026) y del configurador (lectura de terceros, 5-6 ago 2026):

| Plan | vCPU | RAM | Disco | Puerto | Precio lista (1 mes) | 12 meses | 24 meses |
|---|---|---|---|---|---|---|---|
| Cloud VPS 4 | 4 | 8 GB | 100 GB SSD | 200 Mbit/s | €5.50 | ~€4.68/mo | ~€4.40/mo |
| Cloud VPS 6 | 6 | 12 GB | 200 GB SSD | 300 Mbit/s | €7.50 | — | ~€6.00/mo |
| Cloud VPS 8 | 8 | 24 GB | 300 GB SSD | 600 Mbit/s | €14.00 | — | ~€11.20/mo |
| Cloud VPS 12 | 12 | 48 GB | 400 GB SSD | 800 Mbit/s | €25.00 | — | ~€20.00/mo |
| Cloud VPS 16 | 16 | 64 GB | 500 GB SSD | 1 Gbit/s | €37.00 | — | ~€29.60/mo |
| Cloud VPS 18 | 18 | 96 GB | 600 GB SSD | 1 Gbit/s | €49.00 | — | ~€39.20/mo |

- Snapshots incluidos: 1 (VPS 4), 2 (VPS 6), 3 (VPS 8 en adelante).
- Descuento por permanencia: **~15% a 12 meses, ~20% a 24 meses**.
- **Ojo, crítico para Venezuela:** los precios "promo" de la home son la tarifa efectiva
  a 24 meses, y **a clientes fuera de Alemania les cobran TODO el período por adelantado
  el día 1** ("Due Today — Prepaid 24 Months"). Los clientes alemanes sí pagan mes a mes.
  El precio mostrado incluye el IVA del país detectado (el mismo plan se ve distinto
  según dónde estés). Fuentes: https://luxvps.net/contabo-alternative (lectura del
  configurador, 5-6 ago 2026) · https://vpshostingradar.com/deals/contabo/ (ago 2026)
- **La línea Core es SSD; NO hay opción NVMe en el order flow de Core.** El NVMe más
  barato es "Cloud VPS Plus 4" (~€13.50/mo, 150 GB NVMe) **[aprox.]**.
  Fuente: https://luxvps.net/luxvps-vs-contabo
- En USD (fuente con nombres viejos, jun 2026 — referencia de orden): VPS 10 $6.60
  (1 mes) / $3.96 (12 meses); VPS 40 $30 / $24; VPS 60 $58.80 / $47.04. Contabo
  **no sube el precio al renovar** dentro de la misma tarifa de lista.
  Fuente: https://cybernews.com/best-web-hosting/contabo-review/pricing/ (17 jun 2026)

### 1.2 Cloud VDS ("Max Performance VPS", CPU dedicada)

Leído de contabo.com/en/vds (ago 2026):

| Plan | Cores dedicados | RAM | NVMe | Puerto | 1 mes | 24 meses |
|---|---|---|---|---|---|---|
| VDS S | 6 (AMD EPYC 7282 2.8 GHz) | 24 GB | 180 GB | 250 Mbit/s | €39.00 | €31.20/mo |
| VDS M | 8 | 32 GB | 240 GB | 500 Mbit/s | €49.00 | €39.20/mo |
| VDS L | 12 | 48 GB | 360 GB | 750 Mbit/s | €69.00 | €55.20/mo |
| VDS XL | 16 | 64 GB | 480 GB | 1 Gbit/s | €94.00 | €75.20/mo |
| VDS XXL | 24 | 96 GB | 720 GB | 1 Gbit/s | €139.00 | €111.20/mo |

- CPU y RAM dedicadas ("no noisy neighbors" en CPU/RAM); **red y backbone de storage
  siguen compartidos**. Fuente: https://cybernews.com/best-web-hosting/contabo-review/pricing/
- Sin setup fee en VDS en ningún término. Fuente: FAQ oficial en https://contabo.com/en/vds/

### 1.3 Dedicated Servers (bare metal)

USD, jun 2026 (cybernews): AMD Ryzen 12 cores $110/mo (1 mes) → $99/mo (12 meses);
AMD Genoa 24c $189 → $170.10; AMD Turin 32c $289 → $260.10; Turin 64c $769 → $692.10.
https://cybernews.com/best-web-hosting/contabo-review/pricing/
EUR largo plazo **[aprox.]**: 86.40 / 152.10 / 224.10 / 599.40 respectivamente.
https://pricingsaas.com/companies/contabo

### 1.4 Storage VPS (mucho disco barato)

Verificado por el propio blog de Contabo contra su pricing page, 10 ago 2026:

| Plan | vCPU | RAM | SSD | Precio/mo |
|---|---|---|---|---|
| Storage VPS 1 | 2 | 4 GB | 500 GB | €5.24 |
| Storage VPS 2 | 4 | 8 GB | 800 GB | €7.14 |
| Storage VPS 3 | 6 | 18 GB | 1 TB | €13.33 |
| Storage VPS 4 | 8 | 30 GB | 1.2 TB | €23.80 |
| Storage VPS 5 | — | — | 1.4 TB | €35.22 |

Fuente: https://contabo.com/blog/most-storage-per-euro-vps-comparison/
(probablemente tarifas de término largo — **[aprox.]**, confirmar término en checkout)

### 1.5 Object Storage (S3-compatible)

- **€2.49/mo por 250 GB** (Europa y EE.UU.); **~$2.99/250 GB en Singapur**; escala en
  pasos de 250 GB hasta **25 TB**; **sin cargos de egress** (transferencia incluida).
  Backend Ceph, API S3. Regiones: EU / US / Asia-Pacífico (SG algo más caro).
  Fuentes: https://contabo.com/blog/most-storage-per-euro-vps-comparison/ (10 ago 2026) ·
  https://pricingsaas.com/companies/contabo ·
  https://contabo.com/blog/vps-vds-object-storage-european-iaas-saas/ (30 jul 2026)

### 1.6 Fees y condiciones que importan

| Concepto | Detalle | Fuente |
|---|---|---|
| Setup fee | Desde ~abr 2026 **solo** en el plan de entrada (Cloud VPS 4 / Storage VPS 10) y solo en términos de 1 o 6 meses; **se elimina a 12 meses**. Monto no publicado claramente (~€5 histórico) **[aprox.]** | https://abovef.com/contabo-vps-review/ (13 ago 2026) |
| Location fee | Regiones fuera de la UE cobran recargo mensual **desde ~$1.15/mo y escala con el tamaño del plan**. EU = €0. Ejemplo **[aprox.]**: VPS 10 en Singapur ≈ €6.10/mo vs €4.40–5.50 en UE | https://cybernews.com/best-web-hosting/contabo-review/pricing/ · https://www.postclic.com/en-sg/letters/cloud-storage/cancellation-contabo/ |
| Migración de región | **Live Migration: €33 única vez** (conserva datos, servidor queda online, **cambia la IP**). "New Setup": gratis pero **borra todo**. Dedicated servers no pueden moverse | https://contabo.com/blog/transfer-contabo-vps-to-another-region/ · https://help.contabo.com/en/support/solutions/articles/103000269700 |
| Tráfico | Entrante ilimitado; saliente "ilimitado" con fair-use: en la práctica **~32 TB/mo, se estrangula al llegar al tope, nunca se cobra overage** (Japón/Sídney históricamente 10 TB — dato 2022, verificar) | https://learnwithhasan.com/vps-providers/contabo-vps/ · https://www.pigji.com/1738.html |
| IP adicional | $3.85/mo por IPv4 extra | cybernews pricing (jun 2026) |
| Auto Backup | Add-on pago: **~€1.65/mo neto en VPS 4** / "from $1.23/mo" según tier; diario, off-server, ~10 versiones | https://luxvps.net/contabo-alternative · cybernews |
| Windows Server | Pago, escala por plan: €8/mo neto en VPS 4, €17 en VPS 6, €28 en VPS 8 | https://luxvps.net/luxvps-vs-contabo |
| Reembolso | **14 días** desde la compra; renovaciones automáticas reembolsables solo 72 h; sin reembolsos parciales después | https://learnwithhasan.com/vps-providers/contabo-vps/ |
| Permanencia mínima | 1 mes; sin preaviso si prepago, 4 semanas si post-pago | pie de página de precios en https://contabo.com/en/vds/ |
| Verificación de cuenta | Puede pedir documento de identidad; pagos: tarjeta, PayPal, transferencia | https://www.gwvpsceping.com/en/13399.html |

---

## 2. Rendimiento real medido 2025–2026

### Benchmarks independientes (comprados y medidos por terceros)

- **VPSBenchmarks — Cloud VPS 10, Lauterbourg FR, 13 dic 2025** (trial pagado por
  VPSBenchmarks, no por Contabo): **Overall 22/100 (price-weighted). Web F · CPU cruda D ·
  Estabilidad F · Disco E · Red E.** Aprovisionó en 2 minutos. Es el dato más duro y más
  reciente de la línea compartida.
  https://www.vpsbenchmarks.com/trials/contabo_performance_trial_12Dec2025
- **YABS comunitario — Cloud VPS 30, Lauterbourg, 9 sep 2025:** fio 4k mixto ~41.5k IOPS,
  1m ~8.6 GB/s, iperf3 ~590 Mbps. Números buenos **en ese momento** — ilustra la
  lotería del nodo. https://www.lukytech.com/post/contabo-cloud-vps-30-yabs-%E8%84%9A%E6%9C%AC%E6%B5%8B%E8%AF%95.html/
- **Comparativa YABS 4k IOPS combinados (mar 2026, 3 planes idénticos 4 vCPU/8 GB):**
  GigaNodes 141,108 · DigitalOcean 59,301 · **Contabo 22,849**. (Fuente competidora, pero
  enlaza a YABS públicos de vpsbenchmarks.com — reproducible.)
  https://giganodes.host/blog/epyc-vps-india-benchmarks-comparison
- **Raff vs Contabo (ago 2026):** Geekbench 6 single-core **1,163 Contabo Cloud VPS vs
  2,266 Raff (~1.95x por core)**; steal de Contabo "mayor bajo carga sostenida" (Raff midió
  0.13–0.32% en 26 h). Fuente competidora con benchmark publicado.
  https://rafftechnologies.com/learn/compare/raff-vs-contabo
- **Red (feb 2026, metodología propia, tier bajo US):** Contabo 800 Mbps intra-DC,
  latencia intra-DC 2.0 ms, jitter 0.5 ms. Correcto, no brillante.
  https://bestusavps.com/blog/vps-networking/
- **Review experto favorable (hostadvice, 2026, Cloud VPS 20 SSD):** escritura secuencial
  524 MiB/s; random sync 4k p95 0.68 ms; stress 5 min limpio; red 299/295 Mbps 0% pérdida;
  ticket respondido en 12 min. Contrapunto: review con afiliación, un solo VPS, una sola
  ventana. https://hostadvice.com/hosting-company/contabo-reviews/
- **experte.com (7 ene 2026):** Performance **2.3/10** — "no es opción real para usuarios
  exigentes o profesionales". https://www.experte.com/server/contabo

### CPU steal e IOPS en la vida real (reportes de usuarios)

- Rango típico reportado: **steal 5–10% en nodos buenos; 15–30% en horas pico en nodos
  cargados; picos de 40–70%** documentados en LowEndTalk. La varianza **por nodo** es la
  constante: "si te toca un buen nodo, funciona; UK suele estar menos lleno que Alemania".
  https://lowendtalk.com/discussion/186213/contabo-a-good-choice
- **Deterioro con el tiempo en el mismo VPS:** mismo benchmark, misma máquina, 3 años
  después: IOPS de escritura 4k cayó a **menos de un tercio** (6,918 → ~2,005 avg).
  "Disk IOPS steal" brutal.
  https://lowendtalk.com/discussion/199583/contabo-limits-my-vps-performance (18 nov 2024)
- IOPS NVMe en nodos contendidos ≈ **un cuarto** de un SATA datacenter dedicado comparable
  (síntesis de threads de LowEndTalk + reviews). https://learnwithhasan.com/vps-providers/contabo-vps/
- **fsync (lo que le duele a Postgres):** host quieto 1–3 ms; host ocupado en horario
  laboral europeo: picos sostenidos de **50+ ms** — suficiente para hacer fallar pg_repack,
  frenar AOF de Redis y convertir requests HTTP en esperas de segundos.
  https://danubedata.ro/blog/contabo-alternatives-reliability-2026 (competidor, pero describe
  el patrón canónico y cita reportes de usuarios)

### ¿Mejoró con las subidas de precio de 2026?

La entrada subió de €4.50 (dic 2025) a €5.50 (2026) y la línea se reorganizó, pero
**no hay evidencia de mejora estructural medida**: el trial de VPSBenchmarks de dic 2025
salió F en estabilidad y el VDS XL de mar 2026 siguió con disco D (ver §5). La CPU de
toda la flota sigue siendo **AMD EPYC 7282 (2019, 2.8 GHz)** en los trials de 2026.

---

## 3. Reputación y confiabilidad actual

- **Trustpilot: 4.5/5 con ~10.5–11k reviews (2026)** — mejoró de 3.5 (2024) a 4.4–4.5
  (2025–2026). **G2: 2.2/5 con 24 reviews** — el público empresarial es mucho más duro.
  https://www.rfp.wiki/cloud-computing/web-hosting-domain-services/dedicated-servers-colocation-services/hetzner/contabo ·
  https://ie.trustpilot.com/review/contabo.com
- **Temas recurrentes en reviews negativas** (agregación de 12k+ reviews, 3 sitios):
  verificación de cuenta con fricción, disputas de facturación, **suspensiones abruptas**,
  tickets lentos durante incidentes de alto estrés. (rfp.wiki, enlace arriba)
- **IPs recicladas "sucias":** clase pequeña pero recurrente de casos — VPS nuevo
  **suspendido el mismo día** porque la IP asignada tenía historial de abuso ajeno; en
  algunos casos Contabo cobró **fee de reactivación ~$46/€30**. Recomendación de la
  comunidad: al aprovisionar, chequear reputación de IP y port 25 de inmediato y pedir
  cambio de IP antes de desplegar. https://learnwithhasan.com/vps-providers/contabo-vps/
- **Incidentes grandes documentados:**
  - Ago 2024: US East, "aumento inesperado de temperatura" → **~3 días caído**.
    https://lowendtalk.com/discussion/196928/worst-experience-with-contabo-down-since-3-days-and-counting
  - 18–21 nov 2024: Düsseldorf / Hub Europe → **3 días** de servidores inalcanzables.
    https://status.oneclick-cloud.com/cm3n0y9ou000ejqqzie8c9shn
  - Ene 2025: caso Cloudron — host muerto **2+ días sin ETA**, fin de semana de por medio,
    respuesta genérica. https://forum.cloudron.io/topic/13052/my-server-vps-stopped-on-contabo-two-days-ago
  - 2025–2026: statusgator registra incidentes menores (p. ej. 44 min el 14 jun 2025);
    pulsetic (monitorea desde abr 2026) y la status page oficial están limpios al
    18 ago 2026. https://statusgator.com/services/contabo ·
    https://pulsetic.com/status/contabo/ · https://contabo-status.com/
- **SLA:** 99.9% de red publicado; la home reclama 99.996% alcanzado (auto-reportado).
  Medición externa puntual: ~99.97% en 30 días en Alemania **[muestra única]**.
  https://learnwithhasan.com/vps-providers/contabo-vps/
- **Soporte:** tickets/email + chatbot IA ("ContaBro"); sin teléfono para soporte general.
  Mediana de respuesta 2–12 h; temas complejos/fines de semana **24–72 h**. La página de
  "agency hosting" promete "human support 24/7" — marketing; los reportes de usuarios no
  lo respaldan para el tier estándar.
  https://learnwithhasan.com/vps-providers/contabo-vps/ · https://contabo.com/en-us/agency-hosting/
- **Suspensión por falta de pago: inmediata**; datos borrables si la suspensión se
  prolonga; reactivación puede cobrar fee.
  https://blog.rdphostings.com/kamatera-vs-contabo (6 ago 2026)

---

## 4. Características de plataforma (lo que importa para operar producción)

| Característica | Estado ago 2026 | Detalle / Fuente |
|---|---|---|
| Snapshots | ✅ incluidos | 1–3 gratis según tier; **auto-eliminan a los 30 días**; por panel y API. learnwithhasan (abr 2026) · https://www.hosttest.co.uk/reviews/contabo-vps |
| Backups automáticos | ⚠️ add-on pago | Auto Backup diario off-server, ~10 versiones; desde ~€1.65/mo neto (VPS 4). luxvps · cybernews |
| API | ✅ REST completa | https://api.contabo.com/ — compute, snapshots, imágenes custom, object storage, private networking, secrets, usuarios/roles |
| CLI | ✅ oficial | `cntb` (Win/Linux/macOS) |
| Terraform | ⚠️ solo provider comunitario | No hay provider oficial en el registry (verificar estado actual). https://rafftechnologies.com/learn/compare/raff-vs-contabo |
| Firewall de red | ✅ gratis | Reglas inbound desde el panel; incluido en todos los planes (agregado recientemente — reviews de jul 2025 aún decían que no existía). contabo.com/en/vps · https://bestusavps.com/reviews/contabo/ |
| DDoS | ✅ incluido | Mitigación volumétrica always-on; para L7 o ataques serios hace falta Cloudflare delante igual. danubedata.ro |
| Rescue mode | ✅ | Sistema de rescate booteable desde el panel (VPS y VDS). help.contabo.com |
| Reinstall | ✅ self-service | Borra todo; el modal advierte que "puerto VNC e IP pueden cambiar" — **la IP NO está garantizada en reinstall**; en cambio de región la IP cambia SIEMPRE. https://ca.hostadvice.com/hosting-company/contabo-reviews/contabo-openclaw-review/ (jul 2026) · help.contabo.com |
| IPv6 | ✅ | IPv4 dedicada + IPv6 /64 incluidos; IPv4 extra $3.85/mo. contabo.com · cybernews |
| Private networking | ✅ pero pago y con truco | **€2.73/mo por VPS, €6.89/mo por VDS**; solo misma región; tráfico interno ilimitado; **agregar una instancia existente a una red privada exige REINSTALARLA**. https://contabo.com/en/private-networking/ · https://api.contabo.com/ |
| Object Storage S3 | ✅ | €2.49/250 GB (EU/US), sin egress fees, hasta 25 TB, Ceph. §1.5 |
| Monitoring | ❌ | Sin gráficas de CPU/RAM/disco en el panel; traer Netdata/Prometheus propio. bestusavps.com |
| Load balancer / managed DB / k8s / CDN | ❌ | No existen como producto; k8s es self-managed. learnwithhasan |
| Panel | ✅ funcional, feo | my.contabo.com completo pero "engineer-built"; nueva UI en beta. https://rackdiff.com/en/provider/contabo · hosttest.co.uk |
| 1-click apps | ✅ básicas | n8n, Nextcloud, WireGuard, GitLab CE, OpenClaw; imágenes custom ISO/qcow2; cloud-init; SSH keys. contabo.com/en/vps |
| SMTP | ⚠️ | Port 25 abierto pero rate-limit ~25 emails/min y sujeto a reputación de IP. learnwithhasan |

---

## 5. Contabo para Postgres / Supabase / producción específicamente

- **La queja canónica sigue vigente:** Postgres es fsync-sensible y el storage compartido
  de la línea Cloud VPS es exactamente donde Contabo flojea (grado E en el trial de
  dic 2025; fsync spikes de 50 ms+ reportados en hora pico). pg_repack fallando, Redis AOF
  frenando, p95 feo. Fuentes: vpsbenchmarks trial dic 2025 · danubedata.ro (jul 2026).
- **¿El VDS resuelve el steal?** En CPU, **sí, medido**: los trials de VPSBenchmarks de la
  línea VDS (cores dedicados) mejoran "Performance Stability" de **F (Cloud VPS dic 2025)
  a B/C** (VDS S sep 2023: B · VDS M ene 2024: B · VDS XL dic 2024: C · VDS XL mar 2026: C).
  Pero **el disco sigue siendo el eslabón débil: C/C/C/D** en esos mismos trials — el
  backbone de storage y la red se comparten aunque los cores no. Y el silicio sigue siendo
  EPYC 7282 de 2019.
  https://www.vpsbenchmarks.com/trials/contabo_performance_trial_12Mar2026 (VDS XL, mar 2026,
  Overall 61: Web C · CPU B · Estabilidad C · Disco D · Red D) ·
  https://www.vpsbenchmarks.com/trials/contabo_performance_trial_09Sep2023 ·
  https://www.vpsbenchmarks.com/trials/contabo_performance_trial_09Dec2024
- **Precio VDS vs VPS:** VDS S (6 cores dedicados / 24 GB / 180 GB NVMe) €39/mo vs
  Cloud VPS 8 (8 compartidos / 24 GB / 300 GB SSD) €14/mo → **~2.8x** por previsibilidad
  de CPU (no de disco). §1.1 y §1.2.
- **Supabase self-hosted en Contabo:** no se encontraron casos documentados específicos
  (ni buenos ni malos) en 2025–2026. Lo genérico aplica: Supabase self-host te deja a
  cargo de HA, backups y PITR (https://supabase.com/docs/guides/self-hosting); un VPS
  único con fsync variable es el peor lugar posible para el Postgres que sostiene todo el
  ERP. Si se hace: VDS mínimo, `pg_test_fsync` al aprovisionar, WAL archiving a Object
  Storage externo, monitoreo propio.
- **Metodología comunidad Postgres para medir el disco** (pg_test_fsync):
  https://www.ppmy.cn/news/1703712.html (may 2025)

---

## 6. Agencias / resellers usando Contabo para clientes

- Contabo **marketea activamente el caso agencia** (página dedicada: "manage multiple
  client websites", "our self-managed hosting solutions are perfect for reselling"), pero
  **no hay programa reseller con white-label billing ni cuentas por cliente**: revendes
  a mano sobre tu cuenta. https://contabo.com/en-us/agency-hosting/
- Existe ecosistema de terceros que lo hace: módulos **WHMCS para Contabo** (crear/
  suspender/reinstalar VPS por API) — p. ej. proyecto documentado:
  https://www.freelancer.com/projects/whmcs/whmcs-addon-for-contabo-vps
- MSPs que venden "Contabo administrado": RDEM Systems cobra **€129–150/mo** por
  gestionar servidores Contabo (monitoreo 24/7, on-call, backups externos) — su FAQ es
  honesta sobre por qué hace falta: "soporte solo por tickets, sin teléfono, delays
  largos, sin monitoreo proactivo".
  https://managed-services.rdem-systems.com/en/managed-server/contabo.html
- La lectura común: sí se usa para clientes, pero **el que revende absorbe todo el riesgo
  operativo** (suspensiones, soporte lento, variabilidad) — el ahorro de Contabo paga la
  capa de gestión que tú tienes que aportar.

---

## 7. Veredicto de la comunidad 2026

**Para qué SÍ sirve (consenso):**
- Storage barato: backups, archivos, media (Object Storage €2.49/250 GB sin egress es
  genuinamente competitivo; Storage VPS 1 TB SSD €13.33/mo imbatible en precio).
- Staging, dev, CI runners, ambientes desechables.
- Batch jobs nocturnos (no les importa la varianza de latencia).
- Hobby/self-hosting (Plex, Nextcloud personal, game servers chicos), VPNs, nodos de
  monitoreo, standby frío.
- Apps web tolerantes donde un pico de latencia ocasional no cuesta clientes.

**Para qué NO (consenso):**
- **Base de datos de producción fsync-intensiva en la línea Cloud VPS compartida** —
  es literalmente el caso de queja #1. VDS lo mitiga en CPU, no del todo en disco.
- Cualquier cosa con SLA serio frente a clientes (99.9%+ con penalidades): entre steal,
  IOPS erráticos, soporte de 24–72 h e incidentes multi-día documentados, el error budget
  no cierra.
- APIs latency-sensitive, tiempo real (WebRTC, trading, game servers serios).
- Mail transaccional a volumen (port 25 limitado + riesgo de IP reciclada sucia).
- Quien necesite soporte humano rápido como parte del producto.

**Si igual se usa para producción (playbook que repite la comunidad):**
1. Línea VDS o Plus (NVMe), región EU (sin location fee).
2. Benchmark al aprovisionar (yabs + pg_test_fsync) dentro de la ventana de reembolso de
   14 días; si el nodo es malo, pedir cambio o reembolso.
3. Chequear reputación de la IP el día 1 (ruleta de IPs recicladas).
4. Backups propios fuera de Contabo (Restic/Borg → B2/Wasabi), no depender del add-on.
5. Monitoreo externo (Uptime Kuma/Prometheus) — Contabo no te avisa rápido.
6. No poner el único punto de fallo del negocio ahí; plan de migración listo (la IP cambia
   al mover de región; €33 la live migration).
7. Para los ~13 buckets: Object Storage S3 de Contabo (mismo vendor, sin egress) o B2/R2.

---

## Anexo: fuentes principales (fecha de lectura/publicación)

- contabo.com/en/vps · /en/vds · /en/private-networking · /blog (oficial, ago 2026)
- cybernews.com/best-web-hosting/contabo-review/pricing/ (17 jun 2026)
- luxvps.net/contabo-alternative y /luxvps-vs-contabo (lectura del configurador, 5-6 ago 2026)
- vpsbenchmarks.com/trials/contabo_performance_trial_12Dec2025 (13 dic 2025) y trials VDS
  (09Sep2023 · 29Jan2024 · 28Apr2024 · 09Dec2024 · 12Mar2026)
- learnwithhasan.com/vps-providers/contabo-vps/ (verificado abr–ago 2026)
- danubedata.ro/blog/contabo-alternatives-reliability-2026 (28 jul 2026, competidor)
- rafftechnologies.com/learn/compare/raff-vs-contabo (10 ago 2026, competidor)
- giganodes.host/blog/epyc-vps-india-benchmarks-comparison (5 mar 2026, competidor)
- bestusavps.com/blog/vps-networking/ (4 feb 2026)
- lowendtalk.com threads 186213 / 199583 / 196928 / 177717
- rfp.wiki Hetzner-vs-Contabo (24 may 2026) · Trustpilot · hostadvice (2026) ·
  experte.com (7 ene 2026)
- help.contabo.com (región / reinstall / rescue) · api.contabo.com
- vpshostingradar.com/deals/contabo/ (12 ago 2026) · abovef.com/contabo-vps-review/ (13 ago 2026)
- pricingsaas.com/companies/contabo (2026) · postclic.com (21 feb 2026)
