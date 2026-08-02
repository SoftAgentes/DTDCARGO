# Investigación: Next.js en Vercel ↔ backend autohospedado en VPS (Supabase self-hosted) y arquitecturas alternativas
**Fecha:** 2026-07 · **Alcance:** PYME logística (usuarios Venezuela + China), ERP Next.js 16 (App Router, Server Actions, @supabase/supabase-js + @supabase/ssr), hoy contra Supabase Cloud, sitio público en Vercel. Motivación: costos de storage de archivos pesados.
**Nota:** precios verificados con fuentes web de 2025-2026 (URLs inline). Lo marcado como *(aprox./memoria)* no fue re-verificado en fuente primaria.

---

## 1. Viabilidad técnica Vercel ↔ Supabase self-hosted en VPS

### Es viable y es un patrón documentado
`NEXT_PUBLIC_SUPABASE_URL` es simplemente la URL HTTPS del gateway de API de Supabase. En self-hosted, el stack Docker oficial expone todo (Auth, REST, Realtime, Storage, Studio) detrás del gateway **Kong en el puerto 8000**, y delante se pone un reverse proxy con TLS (Nginx/Caddy/Traefik). Guías de referencia:
- RunCloud: deploy de Supabase self-hosted en Hetzner/DO/Vultr con reverse proxy Nginx al puerto 8000 (2025-11): https://runcloud.io/blog/how-to-deploy-supabase
- Supascale: guía completa de deploy en Hetzner Cloud (2026-07): https://www.supascale.app/blog/deploying-selfhosted-supabase-on-hetzner-cloud-a-complete-guide
- Supadex: "How to Self-Host Supabase" (2026-02): https://www.supadex.app/blog/how-to-self-host-supabase-(without-losing-your-mind)

Configuración clave en el `.env` del stack: `SITE_URL` y `API_EXTERNAL_URL` al dominio real, y regenerar **todos** los secretos por defecto (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`/`SERVICE_ROLE_KEY` firmadas con tu JWT secret, `DASHBOARD_USERNAME/PASSWORD`) porque el `.env.example` trae credenciales públicamente conocidas (fuente: Supascale, ibíd.).

### TLS obligatorio
Sí, en la práctica obligatorio: el browser llamará a Auth/Realtime (WSS) y Storage desde la página HTTPS de Vercel; sin TLS hay mixed-content y los JWT viajan en claro. Caddy o Traefik (Coolify/Dokploy lo hacen automático con Let's Encrypt). La renovación automática (Let's Encrypt caduca a 90 días) es ítem explícito del checklist de producción self-hosted: https://www.supascale.app/blog/production-checklist-for-selfhosted-supabase-25-steps-before

### CORS
En self-hosted el CORS lo controla Kong (variables tipo `KONG_CORS_ORIGINS` / config del gateway). El checklist de producción incluye "Verify CORS configuration" con los dominios del frontend (mismo enlace anterior). En Cloud no existía este paso porque el dominio `*.supabase.co` ya viene configurado: es una diferencia real que hay que operar a mano.

### Latencia Vercel (iad1) → VPS
- Las Vercel Functions corren por defecto en **iad1 = AWS us-east-1 (Washington D.C./N. Virginia)**, configurable por proyecto y por función (`vercel.json` → `"regions"`, o dashboard). Docs oficiales: https://vercel.com/docs/functions/configuring-functions/region y https://vercel.com/docs/regions
- Consejo oficial de Vercel: "Functions should be executed in the same region as your database, or as close to it as possible" (docs de regions, ibíd.).
- Penalización cross-region medida (dashboard de Neon, funciones Vercel → Postgres): misma región ≈ 5-16 ms; iad1 → Frankfurt ≈ **95 ms**; iad1 → São Paulo ≈ 206 ms; iad1 → Sídney ≈ 262 ms: https://neon.com/demos/regional-latency
- **Proveedores VPS cerca de iad1** (N. Virginia / "Data Center Alley", donde vive us-east-1):
  - **Hetzner Ashburn, VA (ASH)** — mismo corredor que AWS us-east-1. Ojo: regiones US de Hetzner incluyen solo **1 TB/mes** de tráfico (EU: 20 TB): https://betterstack.com/community/guides/web-servers/hetzner-cloud-review/
  - Vultr (Ashburn/NJ), DigitalOcean NYC, OVH US (Vint Hill, VA), Linode/Akamai (Washington DC). Contexto del corredor de Ashburn (~70% del tráfico de internet de EE. UU.; proximidad a us-east-1 = RTTs de ~2 ms vs ~70 ms cross-country): https://colossuscloud.com/en/articles/ashburn-virginia-east-coast-vps/
- Conclusión: VPS en Ashburn/Virginia + functions en iad1 = latencia de red despreciable (pocos ms). Es la combinación ideal.

### Cold starts + Postgres remoto
- Cada cold start de una función puede abrir una conexión nueva a Postgres → riesgo de `FATAL: too many connections` bajo carga. Es "el incidente de producción más común" en SaaS early-stage según Makerkit: https://makerkit.dev/blog/tutorials/best-database-software-startups
- Fluid Compute de Vercel (modelo de ejecución actual, default en proyectos nuevos) reusa instancias y reduce cold starts: https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel
- Cold starts reportados: 500 ms – 2 s en rutas poco usadas (kuberns, 2026-04): https://kuberns.com/blogs/vercel-supabase/

### Connection pooling: Supavisor SÍ existe en self-hosted
Docs oficiales de self-hosting Docker: "The self-hosted Supabase stack provides the **Supavisor** connection pooler", con dos modos:
- Session mode: `postgres://postgres.[POOLER_TENANT_ID]:[PASS]@[dominio]:5432/postgres`
- Transaction mode: puerto **6543** (el recomendado para serverless)
Fuente: https://supabase.com/docs/guides/self-hosting/docker
Gotchas reales reportados:
- La connection string debe incluir el `POOLER_TENANT_ID` (default literal `your-tenant-id`) o no conecta — confusión frecuente: https://github.com/orgs/supabase/discussions/40399
- Bug de inicialización de Supavisor 2.7.4 dejaba el pooler en restart-loop y tumbaba Kong/REST/Auth (feb 2026, con workaround): https://github.com/supabase/supabase/issues/42859
- Exponer el puerto 6543 a internet en Coolify requiere ajuste manual del compose: https://github.com/coollabsio/coolify/discussions/6341
- Supavisor añade ~2 ms por query vs conexión directa; transaction mode desactiva features que algunos ORMs usan (prepared statements cross-transaction): https://adamarant.com/en/blog/supabase-supavisor-when-the-pooler-saves-you-and-when-it-does-not

### Límites de payload de Vercel y archivos grandes
- **Body máximo de request/response en Vercel Functions: 4.5 MB** — aplica igual a Server Actions y Route Handlers; error `413 FUNCTION_PAYLOAD_TOO_LARGE`. No hay flag que lo suba; es de infraestructura (AWS Lambda). KB oficial: https://vercel.com/kb/guide/vercel-file-uploads y https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions
- **Resolución estándar: uploads client-direct** (el browser sube directo al storage; la función solo firma tokens/URLs). Es exactamente el modelo que Supabase Storage ya soporta:
  - **TUS resumable uploads** hasta 50 GB (self-hosted configurable; en Cloud, hasta **500 GB** en planes pagos desde jul 2025): https://supabase.com/blog/storage-500gb-uploads-cheaper-egress-pricing y https://supabase.com/blog/storage-v3-resumable-uploads
  - **S3 protocol multipart** en Storage (desde abr 2024). Self-hosted: `FILE_SIZE_LIMIT`, `TUS_ENABLE=true`, y ojo: `TUS_ALLOW_S3_TAGS=false` si el backend es R2 (R2 no implementa S3 object tagging; sin eso TUS falla con HTTP 500): https://www.supascale.app/blog/resumable-uploads-for-selfhosted-supabase-handle-large-files y https://github.com/supabase/supabase/blob/master/docker/CONFIG.md
- **Timeouts de functions (con Fluid Compute, default actual)**: Hobby 300 s (default y máx); Pro 300 s default, 800 s máx, 1800 s beta extendido; Enterprise igual que Pro. Docs oficiales: https://vercel.com/docs/functions/limitations y https://vercel.com/docs/functions/configuring-functions/duration. *(Ojo: guías viejas citan 10 s Hobby / 60 s Pro — eran los límites pre-Fluid; fuentes secundarias de 2026 aún los mezclan.)*
- Implicación para el ERP: **nunca** subir archivos pesados a través de un Server Action. El patrón correcto (idéntico en Cloud y self-hosted): el Server Action genera signed URL / inicia sesión TUS → el browser sube directo al endpoint de Storage del VPS → el archivo jamás toca Vercel. Con VPS en Ashburn, incluso el tráfico browser→VPS es razonable desde Venezuela.

---

## 2. Next.js 16 en Vercel con backend externo: restricciones

No hay restricción de plataforma: una app Next.js 16 en Vercel puede apuntar a cualquier backend HTTPS externo (VPS incluido). Puntos prácticos:
- **Variables de entorno**: se definen en el dashboard de Vercel por entorno (Production/Preview/Development). Las `NEXT_PUBLIC_*` se inyectan **en build time** — si falta alguna al buildear, falla el build o queda horneada vacía. Error clásico: variables creadas solo para Production que fallan en Preview deploys (fix: asignarlas a todos los entornos): https://stackoverflow.com/questions/74264517/nextjs-supabase-not-deploying-supabaseurl-is-required
- Next.js 16 corre soportado en Vercel (evidencia: guía MakerKit "Deploy your MakerKit **Next.js 16** application to Vercel", 2026): https://makerkit.dev/docs/next-supabase-turbo/going-to-production/vercel
- **Regiones configurables**: default iad1; cambiable por proyecto (`vercel.json`, dashboard, CLI) y por función; Pro/Enterprise pueden multi-región y failover: https://vercel.com/docs/functions/configuring-functions/region
- Env vars del backend self-hosted en Vercel: `NEXT_PUBLIC_SUPABASE_URL=https://api.tudominio.com`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (JWT firmada con tu JWT_SECRET del VPS) y `SUPABASE_SERVICE_ROLE_KEY` solo server-side. Funciona con `@supabase/ssr` igual que contra Cloud.

---

## 3. Arquitecturas alternativas recomendadas para este caso (ERP con muchos archivos)

### a) Supabase Cloud (DB/Auth) + archivos en R2/B2 — la de menor fricción
Mantener DB/Auth en Supabase Cloud y sacar solo el storage:
- **Cloudflare R2** vía S3 API directa con presigned URLs (el patrón oficial anti-4.5MB de Vercel). $0.015/GB-mes, egress $0: https://developers.cloudflare.com/r2/pricing/
- **Backblaze B2** $6.95/TB-mes, egress gratis hasta 3x del almacenado y gratis ilimitado hacia Cloudflare (Bandwidth Alliance): https://infratally.com/articles/backblaze-b2-vs-aws-s3-2026/ y https://blober.io/kb/articles/tags/backblaze-b2/
- Alternativa intermedia: **Supabase Storage self-hosted solo para archivos** (el storage-api apunta a backend S3-compatible: R2/B2/MinIO/Hetzner), conservando RLS de buckets contra la misma DB. El storage-api soporta backend S3 externo (CONFIG.md de supabase/docker, citado arriba).
- Referencia de lo que se evita: Supabase Cloud cobra file storage a $0.021/GB-mes extra (~$21/TB) y egress no-cacheado a $0.09/GB tras 250 GB incluidos: https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance

### b) VPS único con Coolify/Dokploy corriendo TODO (salir de Vercel)
- Coolify: 280+ templates (incluye Supabase), PR preview deployments vía GitHub App, backups a S3, deploys Nixpacks/Docker de Next.js. Guía de migración Supabase Cloud → self-hosted con Coolify en Hetzner (CPX21 ~€8/mes, mínimo 2 vCPU/2 GB/30 GB): https://msof.me/blog/how-to-self-host-supabase-with-coolify-and-migrate-your-project-from-the-official-supabase-platform/
- Dokploy: mismo alcance, Docker Swarm nativo (multi-nodo más limpio), PR previews desde fin de 2025, UI más moderna; comunidad menor. Comparativas 2026: https://www.cherryservers.com/blog/coolify-vs-dokploy y https://lumadock.com/tutorials/coolify-vs-dokploy
- **Pros**: costo total ~€20-60/mes de VPS por todo el stack; sin egress fees (Hetzner EU 20 TB incluidos); control total; los previews existen (menos pulidos que Vercel).
- **Contras**: pierdes la edge network de Vercel (126 PoPs) — todo sale de 1 región; pierdes Image Optimization/edge middleware tal cual; te apropias de: backups (DB **y** archivos por separado), SSL, actualizaciones del stack (~mensuales), SMTP de Auth (el emisor built-in de self-hosted está limitado a ~2 emails/hora: hay que configurar SMTP real), monitorización. Checklist de 25 puntos: https://www.supascale.app/blog/production-checklist-for-selfhosted-supabase-25-steps-before
- Fricciones reales de migración reportadas: puertos en conflicto (5432 ocupado por el proxy de Coolify), restores que cuelgan con poca RAM, extensiones que hay que recrear a mano: https://prototypr.io/post/migrate-heroku-supabase-coolify-hetzner

### c) Híbrido: web pública en Vercel + ERP self-hosted en subdominio (erp.dominio.com)
- El sitio público conserva edge/previews/SEO en Vercel; el ERP (55 módulos, usuarios internos conocidos) corre entero en el VPS con Next.js self-hosted (output standalone en Docker) + Supabase self-hosted, mismo stack de código.
- Ventaja extra para este caso concreto: **Vercel es poco fiable desde China** (ver §6); un subdominio propio apuntando a un VPS controla mejor el routing. Y el ERP es la superficie que genera los archivos pesados → los archivos nunca salen del VPS/R2.
- Patrón alineado con las guías de "salida gradual" citadas (msof.me) y con ADRs que mantienen Vercel solo para el front público: https://odsea.com/blog/production-ai-stack-langgraph-nextjs-supabase

### d) Bases gestionadas alternativas (precios 2026)
| Proveedor | Precio entrada | Notas | Fuente |
|---|---|---|---|
| **Neon** (Databricks) | Free: 100 CU-h + 0.5 GB; Launch sin mínimo mensual: compute $0.106/CU-h, storage $0.35/GB-mes; Scale $0.222/CU-h | Scale-to-zero; caro si es 24/7 always-on (4 CU 24/7 + 100 GB ≈ $345/mes Launch); egress tras 500 GB: $0.10/GB | https://selfhost.dev/blog/neon-pricing-cost-of-serverless-postgres/ |
| **Railway** | Hobby $5/mes mínimo (incluye $5 de uso) + metering: vCPU $20/mes, RAM $10/GB-mes, egress $0.05/GB | Sin tope de gasto por defecto (queja #1); Postgres pequeña ≈ $7-13/mes | https://expresstech.io/render-vs-railway-vs-fly-io-2026-pricing-showdown/ |
| **Fly.io** | VM 1 GB always-on ≈ $5.70/mes; Postgres DIY ≈ $2-7/mes; **Managed Postgres desde $38/mes** (Basic, storage $0.28/GB) | Egress: $0.02/GB NA/EU, $0.04 APAC, $0.12 África/India | https://kuberns.com/blogs/flyio-pricing/ y https://fly.io/docs/mpg/ |
| **Aiven** | Free (1 GB); Developer $5/mes (8 GB); Hobbyist desde ~$12-19/mes; Startup desde $75/mes | Multi-cloud, 100+ regiones | https://aiven.io/pricing/postgresql y https://aiven.io/blog/new-developer-tier-for-aiven-for-postgres |
| **Supabase Cloud Pro** | $25/mes (incluye $10 crédito compute = Micro gratis) | Compute: Micro $10 · Small $15 · Medium $60 · Large $110 · XL $210 · 2XL $410; DB storage 8 GB incl., $0.125/GB extra; file storage 100 GB incl., $0.021/GB; egress 250 GB incl., luego $0.09/GB (cached $0.03); PITR $100/mes; Team $599/mes | https://makerkit.dev/blog/saas/supabase-pricing y https://schematichq.com/blog/supabase-pricing |
| Tembo | *(no verificado en esta investigación)* | Managed Postgres con stacks por workload | — |

---

## 4. Object storage económico 2025-2026 (tabla comparativa)

| Proveedor | Storage | Egress | Notas | Fuente |
|---|---|---|---|---|
| **Cloudflare R2** | $0.015/GB-mes ($15/TB) | **$0** | Ops: Class A $4.50/M, Class B $0.36/M; free tier 10 GB + 1M/10M ops; sin residencia EU garantizada | https://developers.cloudflare.com/r2/pricing/ |
| **Backblaze B2** | $6.95/TB-mes | Gratis hasta **3x** lo almacenado; luego $0.01/GB; **gratis ilimitado vía Cloudflare/Fastly** (Bandwidth Alliance) | 10 GB gratis; DCs: Reston VA, Ámsterdam, Toronto; sin APAC; subió de $6 a $6.95 en 2026 | https://infratally.com/articles/backblaze-b2-vs-aws-s3-2026/ · https://akave.com/blog/wasabi-vs-backblaze-vs-akave-backup-pricing-2026 |
| **Wasabi** | $7.99/TB-mes (subió de $6.99 el 1-jul-2026) | Gratis con fair-use: egress ≤ lo almacenado (1:1), tope 100 TB/mes | **Mínimo 1 TB facturado; retención mínima 90 días** (borrar antes se paga igual); sin fees de API | https://tuskbackup.com/blog/backblaze-b2-vs-wasabi-vs-cloudflare-r2 · https://n2ws.com/blog/wasabi-pricing-guide |
| **Hetzner Object Storage** | Base **€4.99/$5.99-mes incluye 1 TB + 1 TB egress**; extra ~€5.99/$6.26 por TB-mes | Extra: **€1.00/$1.20 por TB** | Lanzado dic-2024; solo EU (FSN1/NBG1/HEL1); objeto mínimo facturable 64 KB; S3-compatible limitado (sin versioning ni lifecycle) | https://www.hetzner.com/pressroom/object-storage/ · https://docs.hetzner.com/storage/object-storage/overview/ |
| **AWS S3** | $0.023/GB-mes ($23/TB) | **$0.09/GB (~$90/TB)** | Referencia cara en egress; Glacier Instant Retrieval ~$4/TB para archivo frío | https://danubedata.ro/blog/best-s3-compatible-object-storage-europe-2025 |
| **Supabase Storage (Cloud)** | Pro: 100 GB incl.; extra $0.021/GB (~$21/TB) | 250 GB incl.; luego $0.09/GB (cached $0.03/GB) | Archivos hasta 500 GB en planes pagos (TUS/S3 multipart) | https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance |
| Google Cloud Storage | ~$20/TB | ~$120/TB | Referencia | https://danubedata.ro/blog/best-s3-compatible-object-storage-europe-2025 |
| DigitalOcean Spaces | $5/mes plano (250 GB + 1 TB egress) | $0.01/GB tras 1 TB | Simple, predecible | https://www.buildmvpfast.com/alternatives/cloudflare-r2 |

Ejemplo anclado (1 TB almacenado + 1 TB servido/mes): R2 ≈ $15 · B2+Cloudflare ≈ $6-7 · Hetzner ≈ €5-6 · Supabase Cloud ≈ $90-110 · S3 ≈ $107-113. Fuentes: https://egresscost.com/cloudflare/ · https://infratally.com/articles/backblaze-b2-vs-aws-s3-2026/

---

## 5. Experiencias reportadas (migraciones Cloud → self-hosted / Vercel contra VPS)

- **msof.me (abr 2025)** — migración real Supabase Cloud → Coolify+Hetzner: proceso por pasos (dump/restore, actualizar env vars, Studio self-hosted); advierte que Coolify estaba en beta pública: https://msof.me/blog/how-to-self-host-supabase-with-coolify-and-migrate-your-project-from-the-official-supabase-platform/
- **Supadex (feb 2026)** — "self-host sin volverte loco": Hetzner 8 vCPU/32 GB ≈ $50/mes vs ~$410/mes equivalente en Supabase Cloud; cita de Reddit r/selfhosted: *"I run a self-hosted Supabase instance on a Hetzner box — works beautifully and saves me hundreds a month"*: https://www.supadex.app/blog/how-to-self-host-supabase-(without-losing-your-mind)
- **Supascale (2026)** — lecciones duras de producción self-hosted: regenerar secretos por defecto; SMTP real obligatorio (built-in = 2 emails/hora); backups de DB **y de Storage por separado** (el dump no incluye archivos); probar restores; Postgres 17 es default desde jun-2026 (no re-pullear imágenes sobre un deploy PG15); **Kong será reemplazado por Envoy como gateway en ago-2026** (si personalizaste Kong, pinea versiones): https://www.supascale.app/blog/deploying-selfhosted-supabase-on-hetzner-cloud-a-complete-guide · https://www.supascale.app/blog/production-checklist-for-selfhosted-supabase-25-steps-before
- **prototypr (ene 2026)** — migración con Coolify: restore que se cuelga con poca RAM (mínimo 4 GB recomendado), puerto 5432 bloqueado por el contenedor proxy de Coolify, extensiones (`uuid-ossp`) que hay que crear explícitamente antes del restore: https://prototypr.io/post/migrate-heroku-supabase-coolify-hetzner
- **GitHub supabase** — gotchas de Supavisor self-hosted: tenant-id en la connection string (#40399), restart-loop de Supavisor 2.7.4 que tumbaba todo el stack (#42859): https://github.com/orgs/supabase/discussions/40399 · https://github.com/supabase/supabase/issues/42859
- **Vercel + DB externa** — kuberns (2026): dos dashboards, dos facturas, env vars que se dessincronizan entre entornos; cold starts 500 ms-2 s; el pool exhaustion solo aparece bajo tráfico real: https://kuberns.com/blogs/vercel-supabase/ · tinyroi: "deployá las functions cerca de tu DB" + await de todas las queries (promesas colgadas mueren al terminar la función): https://tinyroi.com/engineering/nextjs-vercel-prisma-postgres-optimization
- Consenso de las experiencias: el self-hosting de Supabase **funciona bien y ahorra mucho** si aceptas que backups, updates, SSL, SMTP y monitoreo pasan a ser tuyos; los incidentes típicos son de configuración (secretos, tenant-id, CORS, SMTP), no de Postgres.

---

## 6. Acceso desde China (equipo en Yiwu)

- **Vercel y China (oficial)**: Vercel no tiene infraestructura en mainland China; los subdominios `.vercel.app` son bloqueados o throttleados por el GFW; incluso con dominio propio "Vercel cannot guarantee availability or performance within mainland China". Recomiendan dominio propio, self-hostear recursos de terceros y espejo/dual-deploy: https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china
- Evidencia de bloqueo: `vercel.app` bloqueado por SNI + DNS pollution (tests OONI en el issue comunitario): https://github.com/vercel/community/discussions/803
- **Cloudflare desde China sin China Network**: los usuarios mainland pegan contra PoPs fuera de China (HK/SG/US-West) vía Anycast; latencia transfronteriza real ~80-150 ms (ideal 8-25 ms al PoP de HK), con China Unicom especialmente inestable; muchos sitios detrás de Cloudflare cargan lento o roto (30+ s reportados en sitios tipo Shopify). Fuentes: https://chdh.me/reports/cloudflare-stack-2026/ · https://www.21cloudbox.com/support/shopify-china.html
- **Cloudflare China Network** (la única vía Cloudflare "real" en mainland): suscripción separada sobre plan **Enterprise**, opera sobre datacenters de **JD Cloud**, exige **ICP filing/licencia por cada apex domain** + content vetting de JD Cloud + número ICP en el footer. No disponible en Pro/Business: https://developers.cloudflare.com/china-network/ · https://chinaready.co/insights/cloudflare-and-china-what-works/
- **ICP**: requiere entidad de negocio china (o socio que la gestione); hosting en mainland toma 4-8 semanas con filing; **Hong Kong no requiere ICP** y da latencia baja desde mainland (1-2 semanas de setup) — es el compromiso estándar para empresas sin entidad china: https://www.shanghaijungle.com/blog/b2b-marketing-china-guide
- Recomendaciones prácticas para un VPS US/EU accedido desde Yiwu:
  1. Dominio propio (jamás subdominio de plataforma); probar con herramientas tipo Blocky/greatfire antes de comprometer.
  2. **Cero dependencias bloqueadas**: Google Fonts/Analytics/Maps/reCAPTCHA/YouTube rompen o ralentizan páginas en China (15-30 s). Self-hostear fuentes y assets (el proyecto ya usa `next/font`, que sirve local — correcto).
  3. Rutas: para un ERP interno, US East funciona pero con latencia ~200-300 ms desde China; si el equipo chino es usuario pesado, mejor compromiso: VPS en **Singapur o Hong Kong** (Hetzner tiene Singapur; Vultr/DO/OVH tienen SG/HK) o réplica/relé HK solo para el front del ERP, manteniendo DB en US.
  4. Evitar poner el ERP detrás de Cloudflare gratuito si el equipo chino es el usuario principal — medir primero (RUM desde dentro de China); Cloudflare puede empeorar el caso Unicom.
  5. Si algún día China se vuelve mercado serio para el sitio público: Alibaba Cloud/Tencent Cloud + ICP, o Cloudflare Enterprise China Network (Enterprise desde varios miles USD/mes + add-on; *(aprox., precio no público)*: https://chdh.me/reports/cloudflare-stack-2026/).

---

## Síntesis para el caso DTD (PYME logística, VE + CN, archivos pesados)

1. **Viable sí, y común**: Vercel(iad1) → Supabase self-hosted en VPS Ashburn/Virginia con Caddy/TLS es técnicamente sólido; Supavisor (incluido en el stack) resuelve el pooling serverless. El cuello de botella real no es la red sino la operación (backups/updates/SMTP/SSL).
2. **Los archivos nunca deben atravesar Vercel** (body de 4.5 MB, es estructural): signed URLs / TUS directos al VPS o a R2 — que es el patrón que Supabase Storage ya implementa.
3. **Orden de opciones por esfuerzo/beneficio** (opinión derivada de las fuentes):
   - ⭐ **Opción 1 (menor riesgo)**: Supabase Cloud para DB/Auth + mover archivos a **R2** ($15/TB, egress $0) o **B2+Cloudflare** (~$7/TB con egress gratis) vía S3/presigned URLs. Elimina el driver de costo (storage/egress) sin tocar la operación de DB.
   - **Opción 2 (ahorro máximo, más ops)**: VPS Ashburn (Hetzner CPX/CCX o DO/Vultr VA) con **todo self-hosted vía Coolify/Dokploy**: Supabase + ERP Next.js; el sitio público queda en Vercel (arquitectura híbrida c). Costo ≈ €20-60/mes + R2/B2 para archivos + horas de ops mensuales.
   - **Opción 3 (intermedia)**: Vercel ↔ VPS self-hosted completo (lo investigado arriba). Misma latencia que hoy contra Cloud si el VPS está en N. Virginia; a cambio heredas toda la operación del stack.
4. **China es un argumento a favor de sacar el ERP de Vercel**, no solo el storage: Vercel no garantiza acceso desde mainland ni con dominio propio; un VPS con dominio propio (idealmente SG/HK si el equipo de Yiwu es usuario intensivo) da más control. El sitio público para Venezuela/Latam sí se beneficia del edge de Vercel.
5. **Presupuesto orientativo mensual (aprox.)**: hoy Supabase Pro $25 + storage/egress crecientes vs. Opción 2: VPS ~€20-50 + R2 ~$7-15 + backups B2 ~$6-14 + TLS ~$0 (Let's Encrypt) ≈ **$40-80/mes todo incluido**, con 1 TB de archivos servidos sin costo de egress adicional.
