# Recomendación: migración del ERP DTD Cargo a VPS — análisis y ruta óptima

> **Fecha:** 2026-07-31 · **Autor:** análisis asistido por IA (3 investigaciones profundas con fuentes verificadas) · **Estado:** advisory, requiere decisión del founder
> **Documento hermano (investigación cruda):** [`migracion-vps-2026-07-investigacion.md`](migracion-vps-2026-07-investigacion.md)
> ⚠️ **Falta una de las tres investigaciones.** Este documento citaba también un
> `INFORME-supabase-self-hosted-vps.md` que nunca se guardó: el archivo existía en la raíz del repo
> pero eran 253 bytes que decían *"ver contenido completo en la respuesta del subagente"*. Ese
> contenido se perdió al cerrarse la sesión. Las conclusiones de abajo que dependan sólo de esa
> fuente **no tienen respaldo verificable** y hay que rehacerlas antes de decidir.

---

## 0. Contexto medido en este repo

- **Stack:** Next.js 16 + React 19, 4 superficies (pública, Studio ERP, PWA móvil, Back CMS). Deploy en Vercel.
- **Backend:** Supabase Cloud — **297 archivos de migración**, RLS, RPCs, Auth, Realtime.
- **Storage:** ~13 buckets con `file_size_limit` definidos en migraciones (`0022`, `0049`, `0066`, `0086`, `0091`, `0097`, `0118`, `0147`, `0155`, `0176`, `0195`, `0214`): fotos de recibos, POD con firma, evidencias de reclamos, inspecciones, packing lists, documentos de embarque, bitácora, avatares, comprobantes de pago. Los uploads ya van **directo a Storage** (no atraviesan Vercel) — patrón correcto que hay que conservar.
- **Driver de costo futuro:** archivos pesados por transacción + contenido de marketing (imágenes/video).
- **Usuarios:** equipo en Valencia (VE) y Yiwu (CN). Dato clave: **Vercel no garantiza disponibilidad en China continental** (fuente oficial de Vercel) — el equipo de Yiwu ya sufre eso hoy.

---

## 1. Resumen ejecutivo (TL;DR)

| Decisión | Recomendación |
|---|---|
| ¿VPS sí o no? | **Sí**, pero no por pánico al costo: Supabase Cloud a 1 TB cuesta ~$110-130/mes; un VPS bien armado cuesta **$40-70/mes todo incluido**. El ahorro es real pero el motivo más fuerte es **control + acceso desde China**. |
| ¿Qué VPS? | **Hetzner** si aceptan EU (CX43: 8 vCPU/16 GB/160 GB NVMe, $18.49/mes) o **Vultr/DO/Linode en Ashburn** (~$48/mes por 8 GB) si quieren US East al lado de Vercel. Contabo solo para archivos/staging (rendimiento variable). |
| ¿Qué base de datos? | **Supabase autohospedado** (es Postgres + todo lo que el código ya usa: Auth, RLS, RPCs, Storage). Cambiar a otra DB = reescribir el ERP. No hacerlo. |
| ¿Multi-proyecto? | Sí: Docker + **Coolify** (PaaS self-hosted de facto en 2026), un compose por proyecto, proxy Caddy/Traefik. |
| ¿Vercel? | **La web pública se queda en Vercel.** El ERP se puede self-hostear en el VPS (subdominio) — resuelve China y quita carga de Vercel. Conexión Vercel↔VPS es viable y común si se necesita. |
| ¿Los archivos? | **Regla de oro: los archivos nunca en el disco del VPS.** Supabase Storage self-hosted con backend S3: **Cloudflare R2** ($15/TB, egress $0) u **Hetzner Object Storage** (1 TB por ~€6.5/mes). |
| ¿Migración difícil? | **Media (6/10).** DB + Auth: documentado, contraseñas se preservan, un re-login. Lo pesado: sync de los 13 buckets con rclone y reescribir URLs. Un fin de semana con ensayo previo. |

---

## 2. Respuestas a los 5 puntos del founder

### 2.1 Plataforma para el VPS

**Ganador precio/rendimiento 2026 (con advertencia):** Hetzner sufrió **dos subidas de precio en 2026** (abril y junio, crisis de DRAM/NAND por el boom de IA). Aun así sigue imbatible en EU:

| Proveedor / plan | vCPU | RAM | Disco NVMe | Tráfico | USD/mes |
|---|---|---|---|---|---|
| **Hetzner CX43** (solo EU) ⭐ | 8 | 16 GB | 160 GB | 20 TB | **$18.49** |
| Hetzner CPX32 (US Ashburn) | 4 | 8 GB | 160 GB | 20 TB | $41.99 |
| **Vultr High Perf.** (tiene Miami y Ashburn) ⭐ US | 4 | 8 GB | 180 GB | 6 TB | $48 |
| DigitalOcean Basic (NYC/SFO) | 4 | 8 GB | 160 GB | 5 TB | $48 |
| Linode/Akamai (Newark/Atlanta/DC) | 4 | 8 GB | 160 GB | 5 TB | $48 |
| Contabo VPS 30 ⚠️ | 8 | 24 GB | 200 GB | 32 TB | $14.95 |
| Hostinger KVM 4 ⚠️ | 4 | 16 GB | 200 GB | 16 TB | $12.99 → $28.99 renovación |
| AWS Lightsail ⚠️ | 2 (burstable 20%) | 8 GB | 160 GB | 5 TB | $44 |

⚠️ Contabo: CPU steal 10-30% en horas pico, Postgres fsync sufre, soporte lento — sirve para archivos/staging, riesgoso para el ERP. Hostinger: renovación +140%. Lightsail: CPU burstable insuficiente para Postgres sostenido.

**Requisitos del stack Supabase self-hosted:** mínimo 4 GB RAM/2 cores; **recomendado 8 GB/4 cores/80 GB NVMe** (docs oficiales). El stack idle consume ~2.5-3 GB RAM (~12-14 contenedores: Postgres, Kong, GoTrue, PostgREST, Realtime, Storage, imgproxy, Studio, Supavisor, Edge Runtime).

**Región:** **US East (Ashburn)** es la recomendación técnica: mismo corredor que Vercel iad1 (RTT ~2 ms), Caracas↔Miami mide ~39 ms reales, Ashburn ~55-75 ms desde Venezuela. Europa (única opción barata de Hetzner) son ~110-130 ms desde Valencia — usable pero se siente. No montar en Singapur "por China": empeora a Venezuela y el GFW se traga la ganancia en hora pico.

**Base de datos:** quedarse con **Supabase autohospedado**. El código usa Auth + RLS + RPCs + Storage + Realtime; cambiar de stack (Neon, Railway, raw Postgres) implicaría reescribir la capa de datos. Esas alternativas gestionadas existen (Neon ~$0.35/GB storage, Railway ~$7-13/mes, Fly Managed desde $38, Aiven desde $5 dev/$75 startup) pero no resuelven nada que Supabase self-hosted no resuelva ya.

### 2.2 Multiproyecto en un solo VPS

**Sí, es posible y es la práctica estándar.** Los "espacios independientes" son contenedores Docker:

- Un `docker-compose.yml` por proyecto, cada uno con su **red bridge propia**; las DBs nunca expuestas a la red pública.
- **Reverse proxy único** en 80/443 con SSL automático: **Caddy** (simple) o **Traefik** (auto-descubrimiento Docker).
- **Panel PaaS self-hosted:** **Coolify** es el estándar de facto 2026 (Git→deploy, SSL automático, backups programados a S3, multi-servidor, 280+ templates). Alternativas: Dokploy (más nuevo, previews por PR), CapRover (veterano y liviano), Easypanel (pago).
- **Aislamiento:** límites `deploy.resources.limits` por contenedor + healthchecks.
- Un VPS de 8 vCPU/16 GB aloja cómodamente: Supabase self-hosted + el ERP Next.js + 3-5 proyectos más.

⚠️ Ojo: Docker manipula iptables y puede saltarse UFW — configurar firewall explícitamente.

### 2.3 Conexión con Vercel

**Viable, documentada y común.** No hace falta cambiar de stack:

1. `NEXT_PUBLIC_SUPABASE_URL` apunta a `https://api.dtdcargo.com` (el Kong del VPS detrás de Caddy con TLS).
2. VPS en **Ashburn** = misma región que Vercel iad1 → latencia igual a la de hoy con Supabase Cloud.
3. **Supavisor** (incluido en el stack self-hosted) resuelve el connection pooling serverless (transaction mode :6543, con `POOLER_TENANT_ID`).
4. **Los archivos nunca atraviesan Vercel**: límite estructural de 4.5 MB por request. El código ya sube directo a Supabase Storage (signed URLs/TUS hasta 50 GB) — patrón correcto, se conserva.

**Pero hay un argumento fuerte para sacar el ERP de Vercel:** el equipo de **Yiwu** usa el ERP a diario y Vercel oficialmente no garantiza servicio en China continental (bloqueos SNI/DNS documentados). Arquitectura híbrida recomendada:

- `dtdcargo.com` (marketing/SEO) → **queda en Vercel** (edge, previews, Image Optimization).
- `studio.dtdcargo.com` (ERP) → **self-hosted en el VPS** con Coolify (Next.js standalone en Docker, mismo repo, mismo build).
- El sitio público habla con el ERP por HTTP (ya es la frontera arquitectónica del repo vía `NEXT_PUBLIC_HAILUWAY_API`).

### 2.4 Alternativas de tecnología (lista de consideración)

**VPS / cómputo:**
- ⭐ Hetzner (EU barato, US caro tras subidas) · Vultr (32 DCs, tiene Miami) · DigitalOcean · Linode/Akamai (egress más barato: $0.005/GB) · OVH (tráfico no medido) · Contabo (solo staging/archivos) · Hostinger (ojo renovaciones) · Oracle Free Tier (❌ reducido a la mitad en jun-2026, no para producción).

**Object storage (el verdadero salvavidas de costos):**

| Proveedor | Storage | Egress | Nota |
|---|---|---|---|
| **Cloudflare R2** ⭐ | $0.015/GB ($15/TB) | **$0** | Egress cero = videos/PDFs a VE sin costo |
| **Backblaze B2** ⭐ | $6.95/TB | Gratis 3x, e ilimitado vía Cloudflare | El más barato en storage puro |
| **Hetzner Object Storage** | 1 TB incluido por ~€6.5/mes | 1 TB incluido, extra €1/TB | El S3 más barato del mercado; solo EU |
| Wasabi | $7.99/TB | Fair-use 1:1 | Mínimo 1 TB + retención 90 días |
| Supabase Cloud Storage | $21/TB | $90/TB tras 250 GB | Lo que quieren evitar |
| AWS S3 | $23/TB | $90/TB | Referencia cara |

**Paneles/ops:** Coolify ⭐ · Dokploy · CapRover · Caddy/Traefik · Tailscale (acceso admin) · restic/borg + Hetzner Storage Box (5 TB por €10.90) para backups · Uptime Kuma.

**DBs gestionadas (solo si se abandonara Supabase, no recomendado):** Neon · Railway · Fly.io · Aiven · Supabase Pro ($25/mes).

### 2.5 Complejidad de la migración

**Media (6/10). Tres migraciones separadas:**

1. **Base de datos (bajo riesgo):** `supabase db dump` (roles/schema/data) → `psql` restore contra el VPS. Documentado oficialmente. Con 297 migraciones, el dump captura el estado final — no hay que replayear nada.
2. **Auth (bajo riesgo):** `auth.users` migra con hashes bcrypt intactos → **nadie resetea contraseña**. Las sesiones activas mueren (un re-login) salvo copiar el JWT secret de Cloud al `.env` self-hosted (truco comunitario).
3. **Storage (la parte pesada):** los binarios no viajan en el dump. Sync con **rclone** vía endpoint S3 (`/storage/v1/s3`) al nuevo backend + **reescribir URLs** de storage en filas de la DB. Presupuestar ventana de mantenimiento.

**Trampas conocidas (todas documentadas):**
- Cloud corre PG17; la imagen Docker self-hosted estuvo en PG15 por defecto (PG17 default desde jun-2026) → errores tipo `transaction_timeout` y COPY a tablas nuevas. **Ensayar en instancia desechable primero** (recomendación oficial).
- Regenerar TODOS los secretos juntos (JWT_SECRET + ANON_KEY + SERVICE_ROLE) o falla todo.
- SMTP real obligatorio (el built-in de Auth self-hosted ~2 emails/hora) → Resend/SES.
- Backups ya no existen solos: `pg_dump` nocturno + snapshots del proveedor desde el día 1.

---

## 3. Rutas posibles y recomendación

### Ruta A — Híbrida mínima (menos dolorosa, NO sale de Supabase Cloud)
Quedarse en Supabase Cloud (DB + Auth + Realtime) y mover solo los archivos pesados a R2/B2 (cambio acotado en la capa de uploads; opción avanzada: self-hostear solo el storage-api con backend S3 contra la misma DB).
- **Costo:** ~$25 Pro + $15/TB R2 ≈ **$40-50/mes con 1 TB**.
- **Dolor:** bajo. **Ahorro:** captura ~80% del ahorro de storage/egress. **No resuelve:** dependencia de Supabase Cloud, China/Vercel.

### Ruta B — VPS completo (lo que preguntó el founder) ⭐ RECOMENDADA
VPS US East (Vultr/DO Ashburn ~$48, o Hetzner EU CX43 $18.5 si aceptan latencia EU) + Coolify + Supabase self-hosted con **storage backend en R2** + ERP self-hosted en subdominio + web pública en Vercel + backups automáticos (pg_dump a B2/Storage Box + snapshots).
- **Costo:** **$50-75/mes todo incluido** (VPS $18-48 + R2 $8-15 + backups $7-11 + IPv4 $0.5).
- **Resuelve:** storage ilimitado barato, egress cero, China (ERP fuera de Vercel), multi-proyecto futuro, control total.
- **Costo de oportunidad:** ~1 fin de semana de migración + ops mensual liviana (updates ~mensuales del compose, monitoreo).

### Ruta C — No hacer nada todavía
Válida si hoy tienen <100 GB. Supabase Cloud: 100 GB incluidos en Pro; a 1 TB + 1 TB egress ≈ $110-130/mes extra. El break-even contra la Ruta B llega alrededor de **300-500 GB almacenados** o cuando marketing empiece a servir video pesado.

### Secuencia sugerida (Ruta B, sin apagar nada)
1. **Semana 0:** medir uso real actual (GB en storage, GB de egress/mes) en el dashboard de Supabase. Decidir con datos.
2. **Semana 1:** contratar VPS + dominio `api.dtdcargo.com`/`studio.dtdcargo.com` + instalar stack con compose oficial + R2 + Coolify. Ensayo de restore en seco.
3. **Semana 2:** sync de buckets con rclone (se puede hacer en caliente, incremental), pruebas del ERP apuntando al VPS en rama preview.
4. **Semana 3:** ventana de mantenimiento corta: dump final + restore + re-login general + flip de DNS. Supabase Cloud queda encendido 2 semanas como red de seguridad (rollback = cambiar env vars).
5. **Día 1 post-migración:** verificar backups automáticos funcionando (restaurar uno de prueba).

---

## 4. Errores que NO hay que cometer (lecciones de la investigación)

1. **No** poner los archivos en el disco del VPS "porque es gratis" — es lo que hace caro y frágil el escalado. S3 desde el día 1.
2. **No** montar el servidor en la oficina (la idea del equipo): ISP venezolano, cortes eléctricos, IP dinámica, sin redundancia — un ERP de producción no puede depender de eso. La intuición del founder (VPS) es la correcta.
3. **No** copiar el directorio de datos de Postgres en caliente como "backup" (copias corruptas). `pg_dump` o nada.
4. **No** dejar los secretos demo del docker-compose de Supabase (son públicos).
5. **No** exponer el Studio/paneles de Coolify a internet sin allowlist o Tailscale.
6. **No** montar en Singapur pensando en Yiwu: US East + Cloudflare delante es el compromiso correcto; si China se vuelve crítico, relé en Hong Kong después (sin ICP).
7. **No** pagar Hostinger/Contabo por el precio de vidriera para producción sin leer renovación/steal.

---

## 5. Fuentes principales (verificadas jul-2026)

- Supabase Docs — Self-Hosting, Docker, Restore from Platform, Configure S3 Storage, Pricing: supabase.com/docs
- GitHub Discussion #39820 "Self-hosting: What's working (and what's not)?"
- Hetzner price adjustments 2026: docs.hetzner.com/general/infrastructure-and-availability/price-adjustment
- Vultr / DigitalOcean / Linode / Contabo / Hostinger pricing pages + benchmarks (vpsbenchmarks, costgoat)
- Cloudflare R2 pricing: developers.cloudflare.com/r2/pricing
- Backblaze B2 / Wasabi / Hetzner Object Storage pricing pages
- Vercel: file upload limits (4.5 MB), function regions, mainland China availability (KB oficial)
- Wondernetwork (latencias Caracas↔Miami ~39 ms medidos)
- Guías de migración reales: msof.me (Cloud→Coolify+Hetzner), supadex.app, supascale.app, meetrix.io
