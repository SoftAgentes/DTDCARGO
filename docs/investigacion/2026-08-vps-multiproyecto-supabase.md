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

# Múltiples proyectos de clientes en un solo VPS con Supabase self-hosted / Postgres
Investigación web (fuentes 2024-2026), agosto 2026. Todo lo no respaldado por URL se marca (aprox./estimación).

## TL;DR
- No existe multi-proyecto self-hosted oficial: 1 stack docker-compose = 1 proyecto (docs oficiales).
- Un stack completo idle pesa 2.5-3 GB (12+ contenedores); recortado (sin analytics/vector, realtime, storage, studio, edge) baja a ~0.8-1.2 GB. Desde 2026-06-03 analytics y vector son opt-in en el compose oficial.
- Regla de supascale: 4 GB → 1 proyecto; 8 GB → 2-3; 16 GB → 4-6 stacks completos. Con stacks recortados ~1 GB: 16 GB → 10-12.
- El patrón ganador de agencias 2025-2026: Hetzner (cloud CX o dedicado AX) + Coolify/Dokploy + Postgres compartido para clientes chicos + stack Supabase dedicado solo para el cliente que lo justifica.
- Para clientes nuevos dentro del ERP de DTD (tenant_id + RLS): viable técnicamente (shared-schema es el default recomendado 2026) pero NO recomendable para clientes de hosting: mezcla legal, salida del cliente y backups por cliente se complican.

## 1. Patrones reales multi-proyecto

### 1a. Un stack Supabase completo por cliente
- Consumo idle real por servicio (supascale, mediciones 2026-05): db 350-500 MB, kong 200 MB-2.5 GB (el descontrolado), analytics/logflare 400-600 MB (hasta 1.8 GB), realtime 150-300 MB, rest 80-150 MB, studio 60-400 MB, storage 30-50 MB, auth 8-20 MB, meta 40-70 MB, edge-functions 20-50 MB. Baseline total 1.5-4 GB según config.
  - https://www.supascale.app/blog/docker-container-resource-tuning-for-selfhosted-supabase
  - https://www.supascale.app/blog/running-selfhosted-supabase-on-lowmemory-servers
- Stack mínimo "headless" (db+kong+auth+rest+meta): <800 MB; +Studio ~1.2 GB. Tabla de supascale: Minimal 2 GB RAM / Standard 4 GB / Full 8 GB+.
- OOM típico en 2 GB: exit code 137, muere analytics o db (ssdnodes, 2026-08): https://www.ssdnodes.com/learn/lang/pcm/self-host-supabase
- Desde 2026-06-03 el compose oficial hace analytics+vector opt-in (docker-compose.logs.yml aparte) — recorte oficial del mayor consumidor. https://supabase.com/changelog
- Puertos: cada stack necesita rangos distintos (KONG 8000/8100/..., POSTGRES 5432/5532/...) o reverse proxy Traefik/Nginx por dominio. https://www.supascale.app/blog/managing-multiple-supabase-projects-on-selfhosted-infrastruc
- Comunidad: discussion #38048 — "1 instancia por proyecto, igual que Supabase Cloud; compartir DB solo para proyectos chicos/personales". https://github.com/orgs/supabase/discussions/38048
- Discussion #4907 — usuario de Uganda: "en 1 vCPU/4 GB alojo 20+ proyectos Laravel porque comparten PHP/MySQL; Supabase duplica todo por proyecto". Pedido de arquitectura compartida, sin respuesta oficial favorable. https://github.com/orgs/supabase/discussions/4907
- Docs oficiales: "Self-hosted Supabase runs as a single project… Studio doesn't support multiple organizations or projects". https://supabase.com/docs/guides/self-hosting

### 1b. Un Postgres compartido con una DB por cliente
- PlanetScale (2026-04): shared-schema con tenant_id es el recomendado general; database-per-tenant dentro de un cluster "generalmente no recomendado": choca con el modelo de conexiones de Postgres (PgBouncer pool per-database revienta max_connections) y cada CREATE DATABASE copia el template (~8 MB + catálogos propios). Aun así, para "apps distintas" (no tenants) en un cluster lo aceptan con cautela. https://planetscale.com/blog/approaches-to-tenancy-in-postgres
- ClickHouse (2026-05): tabla de 4 patrones. DB-per-tenant = backups independientes nativos, cero noisy neighbor a nivel storage, frontera de compliance fuerte — el patrón correcto para clientes regulados/white-label, no para la cola larga. Schema-per-tenant = "una trampa" (migraciones x N schemas). https://clickhouse.com/resources/engineering/multi-tenant-saas-postgres-architecture
- Problema real de pooling con N bases: pgcat issue #806 (cada DB exige su propio pool → se acaban las conexiones del cluster). https://github.com/postgresml/pgcat/issues/806
- Meter DBs de clientes DENTRO del Postgres del stack Supabase de DTD: técnicamente posible (es Postgres) pero mala idea: ese cluster carga roles/extensiones custom de Supabase (supabase_admin, authenticator, pgsodium, pg_net...) y el ciclo de upgrades del stack (ej. migración PG15→17 de 2026-06-17, breaking). Mejor: un Postgres Docker independiente ("cluster de la casa", imagen postgres:17 pelada) solo para clientes. https://www.supascale.app/blog/using-external-managed-postgres-with-selfhosted-supabase · https://supabase.com/changelog

### 1c. Herramientas de terceros
- **Supascale** (supascale.app): NO es SaaS ni fork — es un panel de gestión (CLI open source gratis + GUI de pago, pago ÚNICO lifetime) para desplegar/operar N instancias Supabase self-hosted: backups S3, dominios+SSL, servicios selectivos por proyecto, API REST y MCP. Precios del sitio (ago 2026): Free $0 (CLI) / Personal $99 / Commercial $299 / Agency $799 (incluye 1 año de updates; blog viejo menciona $39.99, precio desactualizado). Lo escribió una agencia ("Kevin") harta de pagar $25+$10/proyecto. https://www.supascale.app/
- **Coolify**: template Supabase de 1 clic, Traefik+SSL, genera secrets. Tutorial oficial de la comunidad Hetzner (2026-01): https://community.hetzner.com/tutorials/coolify-supabase-deploy/ — Coolify mismo pide 2-4 GB RAM para sí. Fricción conocida con múltiples instancias Supabase en el mismo servidor (routing/puertos/MCP): https://github.com/coollabsio/coolify/issues/7458 — POOLER_TENANT_ID hay que fijarlo ANTES del primer deploy o es cirugía de DB: https://www.supascale.app/blog/deploying-selfhosted-supabase-on-coolify-a-complete-guide
- **Dokploy**: template Supabase + compose nativo + Swarm; más liviano que Coolify; plantilla oficial: https://docs.dokploy.com/docs/templates/pre0.22.5-supabase — comunidad reporta templates con versiones viejas y poco personalizables (conviene compose propio): https://goroutine.cn/article/1cc7b35a-24cd-807d-b92d-eb6a48c3ed95
- **Oficial de Supabase para multi-proyecto self-hosted: no existe** (confirmado docs + discussions).

### 1d. Supavisor multi-tenant
- Supavisor ES multi-tenant por diseño: cada tenant (registrado vía API HTTP) apunta a un Postgres upstream distinto con pool y credenciales propias. Un solo Supavisor puede frontear varios Postgres/proyectos. https://github.com/orgs/supabase/discussions/36995 (ejemplo real: Supavisor standalone en Railway apuntando a otro Postgres) · https://www.pkgpulse.com/blog/pgbouncer-vs-pgcat-vs-supavisor-postgresql-connection-pooling-2026
- Aislamiento de pool por tenant = defensa anti noisy-neighbor: https://adamarant.com/en/blog/supabase-supavisor-when-the-pooler-saves-you-and-when-it-does-not
- Costo: latencia 80-160% mayor y ~la mitad de throughput vs PgBouncer co-localizado (bench de Tembo citado ahí). Y cada stack self-hosted ya trae su propio Supavisor; compartir uno entre stacks es trabajo custom (metadata _supavisor, JWT por tenant). Uso realista: UN Supavisor compartido frente al "Postgres de la casa" de clientes chicos, no para federar stacks Supabase.

## 2. Alternativas ligeras (lo que usa la comunidad freelance 2025-2026)
- **PocketBase**: 1 binario Go + SQLite, auth+storage+realtime+admin UI, corre en VPS de $5; 44k+ stars, backend de mayor crecimiento en SO Survey 2025. Ideal para clientes chicos (blogs, formularios, galerías). Pre-1.0: no prometer compatibilidad; writes serializados. https://encore.dev/articles/supabase-alternatives · https://checkthat.ai/brands/supabase/alternatives
- **Next.js + Drizzle + Postgres compartido**: Drizzle superó a Prisma en descargas semanales a fin de 2025 y es el default serverless/edge; agencias reportan 80+ productos sobre Postgres+Drizzle. https://www.robinwieruch.de/react-libraries/ · https://www.marsdevs.com/blog/best-tech-stack-for-startups-2026
- **NocoDB/Baserow** para CRUD/portales: OJO licencias — NocoDB pasó a Sustainable Use License que RESTRINGE ofrecerlo como servicio gestionado a terceros (problema si cobras hosting); Baserow self-hosted es MIT (open-core, vistas Kanban/calendario de pago), pide 2 vCPU/4 GB. https://www.stackfyi.com/guides/baserow-vs-nocodb-2026 · https://cloudzy.com/blog/best-self-hosted-airtable-alternatives/
- **PostgREST pelado**: patrón válido y mínimo (~80-150 MB) pero pierdes Auth/Studio/Storage; la comunidad converge más en PocketBase o Drizzle+Postgres (aprox., inferido).

## 3. Matemática de capacidad (estimación propia sobre datos citados)
Overhead del host: OS+Docker ~1 GB + Coolify ~1-2 GB + monitoreo ~0.5 GB ≈ 2.5-3.5 GB (Coolify pide 2-4 GB: https://contabo.com/blog/coolify-vs-easypanel-best-paas/ · https://www.davidbunting.de/articles/self-hosting-hetzner)

| Host | RAM usable p/ clientes | Stacks FULL (~3 GB c/u) | Stacks RECORTADOS (~1.2 GB c/u) | Apps ligeras s/ PG compartido (~300-500 MB app + cluster PG 1-2 GB) |
|---|---|---|---|---|
| 16 GB (Hetzner CX42 ~$16/mo) | ~13 GB | 4 (supascale dice 4-6) | 8-10 | 1 PG + 15-25 apps |
| 32 GB (CX52 ~$32/mo) | ~29 GB | 8-9 | 18-22 | 1-2 PG + 40-50 apps |
| 64 GB (AX42 dedicado ~€47-52/mo) | ~60 GB | 18-20 | 40+ | 2-3 PG + 80-100 apps |

Precios cloud: CX42 8vCPU/16GB $15.99 · CX52 16vCPU/32GB $32.19 · CCX23 dedicado 4c/16GB $29.20 · CCX33 8c/32GB $58.18: https://pythontpoint.in/cloud-cost-calculator/ · https://www.experte.com/server/hetzner — dedicados: AX42 ~$52 / AX52 ~$66 / AX102 128GB ~€107: https://www.comparisonhost.com/dedicated-servers · https://topsitehosters.com/providers/hetzner/ · configs: https://docs.hetzner.com/robot/dedicated-server/server-lines/ax-server/ — verificar en hetzner.com, los precios se mueven.
Regla supascale: "RAM decide: 4 GB = 1 proyecto, 8 GB = 2-3, 16 GB = 4-6". https://www.supascale.app/blog/self-hosted-supabase-pricing-what-it-actually-costs

## 4. Aislamiento entre clientes en el mismo VPS
- Límites por contenedor con deploy.resources (ejemplos por servicio): https://www.supascale.app/blog/docker-container-resource-tuning-for-selfhosted-supabase — hay que hacer `compose down && up -d` para aplicar.
- Redes Docker separadas por proyecto (Coolify/Dokploy lo hacen por diseño); Postgres nunca expuesto; dashboards detrás de tunnel/auth: https://adamblackington.blog/secure-dokploy-cloud-single-node-cloudflare-tunnels/
- En Postgres compartido: rol por DB con permisos mínimos, statement_timeout + idle_in_transaction_session_timeout, pg_dump por DB. https://planetscale.com/blog/approaches-to-tenancy-in-postgres · https://dev.to/philip_mcclarence_2ef9475/postgresql-connection-pooling-pgbouncer-supavisor-built-in-3i4c
- Noisy neighbor: Postgres no aísla recursos por tenant nativamente; defensa = límites + timeouts + monitoreo + pool por tenant. https://www.pingcap.com/ko/playbook-noisy-neighbor-multi-tenant-mysql/
- Cuándo separar a otro VPS o VPS por cliente (síntesis): compliance o clave de cifrado propia, backup/restore individual exigido por contrato, pico sostenido que ya quemó vecinos, o cuando el cliente paga suficiente (un CX42 propio son $16/mo). Azure lo formaliza igual: https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/storage-data

## 5. ¿Clientes nuevos como tenants dentro del Supabase de DTD?
- Técnicamente es el patrón recomendado 2026 para SaaS (shared-schema + tenant_id + RLS): https://clickhouse.com/resources/engineering/multi-tenant-saas-postgres-architecture
- PERO DTD es tu ERP interno, no un SaaS de clientes: (a) mezcla tu operación con datos por los que cobras hosting (responsabilidad legal y PII compartida); (b) salida del cliente: PITR/restore por tenant individual es "high effort" en shared-schema y exportar UN cliente de tablas compartidas es manual; (c) un deploy roto de DTD tira los negocios de tus clientes. Veredicto: clientes de hosting → DB propia en Postgres compartido o stack propio; tenants dentro de DTD solo si DTD se vuelve producto SaaS/white-label para ellos.
- Referencia de costos Cloud: 5 proyectos chicos en Supabase Cloud = $65+/mo; un solo VPS los corre todos: https://livemy.app/blog/supabase-pricing

## 6. Historias reales y qué cobrar
- darko.io (2026-04): 3 Hetzner (auction) + Coolify, decenas de servicios, ~€40-45/mo total; "un servidor cuesta lo mismo con 1 o 50 servicios"; 1-2 h/mes de ops. https://darko.io/posts/self-hosting-with-coolify-and-hetzner/
- birjob (2026-05): Supabase self-hosted $20-80/mo (CX32+backups), 3-6 h ops/mes; el break-even real son las horas de ingeniería. https://www.birjob.com/blog/self-hosting-renaissance-2026
- Fundador de Supascale: agencia con clientes que necesitan "Supabase simple" (blogs, galerías, formularios); $25 Pro + $10/proyecto le comían el margen → construyó la herramienta. https://www.supascale.app/
- "Devs corriendo múltiples apps en un Hetzner de $7 sin downtime": https://saascity.io/blog/self-hosting-alternatives-vercel-supabase-2026
- Qué se rompe: upgrades de Coolify con intervención manual, keys JWT mal generadas en versiones viejas, POOLER_TENANT_ID inmutable post-deploy, Realtime como el servicio más delicado. https://contabo.com/blog/coolify-vs-easypanel-best-paas/ · https://suparbase.com/blog/supabase-vs-self-hosted-postgres
- Qué cobran (mercado US/UK; para Venezuela bajar proporcional, aprox.): care plans básicos (hosting+backups+updates) $50-150/mo; con soporte humano $150-500/mo; retainers de agencia $295-750/mo. https://gruffygoat.com/blog/small-business-website-cost · https://theclaymedia.com/website-retainer-service-agency/ · https://www.networksolutions.com/blog/website-maintenance-cost/
