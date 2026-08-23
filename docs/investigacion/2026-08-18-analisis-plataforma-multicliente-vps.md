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

# Plataforma multi-cliente en VPS — análisis y plan de transición

> **Fecha:** 2026-08-18 · **Autor:** análisis asistido por IA (2 investigaciones profundas con fuentes) · **Estado:** advisory, requiere decisión del founder
> **Documentos hermanos:** `RECOMENDACION-vps-migracion-2026.md` (VPS para DTD solo) · `AUDIT-2026-07-31.md` (bloqueantes de seguridad para VPS) · `docs/investigacion/2026-08-vps-multiproyecto-supabase.md` (investigación cruda con URLs)

---

## 0. Lo que cambió respecto al análisis anterior

El análisis de julio era "mover DTD a un VPS". Ahora el objetivo es mayor: **convertirte en el proveedor de hosting de tus clientes** — una plataforma donde creas sistemas para ti y para terceros, cada cliente aislado en sus contenedores, cobrando mensualidad. Esto añade tres dimensiones nuevas: (1) arquitectura multi-cliente, (2) operación como proveedor (SLA, monitoreo, backups por cliente), (3) negocio y contrato (precios, salida del cliente, facturación SENIAT).

**Supuesto declarado:** no tengo acceso a las carpetas de tus otros proyectos. Este análisis asume que son apps web (probablemente Next.js) que pueden o no usar Supabase. La decisión final por proyecto depende de eso — hay un árbol de decisión en §2.

---

## 1. La pregunta central: ¿"SQL pelado" o "Supabase en contenedores"?

**Respuesta: los dos, por tiers. Ni un Supabase completo por cliente, ni Postgres pelado para todos.**

Los números que mandan (verificados en la investigación):

- Un stack Supabase self-hosted **completo consume 2.5-3 GB RAM idle** (12-14 contenedores). En un VPS de 16 GB caben 4-6; no escala para "muchos clientes".
- Un stack Supabase **recortado** (sin Analytics/Vector — opt-in desde jun-2026 —, sin Realtime, sin Studio, sin Edge Functions) baja a **~0.8-1.2 GB** → 8-10 por VPS de 16 GB.
- Un Postgres Docker pelado (`postgres:17`) con **una base de datos por cliente** + apps Next.js ligeras: ~300-500 MB por app → **15-25 apps en 16 GB**.
- No existe multi-proyecto oficial en Supabase self-hosted: 1 stack = 1 proyecto (docs oficiales). Herramientas de terceros: **Supascale** (panel para N instancias; CLI gratis, GUI pago único $99-799) y templates de Coolify/Dokploy (con fricciones conocidas: puertos, `POOLER_TENANT_ID` inmutable post-deploy — fijarlo ANTES del primer deploy).

### El árbol de decisión por proyecto

```
¿El proyecto usa Supabase Auth + RLS + Storage + RPCs de forma estructural?
│
├── SÍ, a fondo (caso DTD) ──→ stack Supabase self-hosted COMPLETO propio.
│     Migrarlo a "SQL pelado" = reescribir auth, permisos, storage y realtime.
│     No se hace. DTD conserva su stack completo.
│
├── SÍ, pero liviano (login + un par de tablas) ──→ stack Supabase RECORTADO
│     (~1.2 GB) o migración acotada a Postgres compartido + auth propia.
│
└── NO (o proyecto nuevo) ──→ "Postgres de la casa": UN cluster Postgres
      compartido, una DB por cliente, app en su contenedor (Next.js + Drizzle,
      o PocketBase para clientes muy simples: 1 binario, auth+storage+realtime).
```

**Regla de oro:** los clientes de hosting **nunca** como tenants dentro del Supabase de DTD. Mezcla tu operación con datos por los que cobras, la salida del cliente se vuelve cirugía manual, y un deploy roto de DTD tumba los negocios de tus clientes. (Excepción futura: si DTD se convierte en producto white-label para aliados — esa es otra decisión de producto, no de hosting.)

**⚠️ Licencias:** NocoDB cambió a Sustainable Use License que **restringe ofrecerlo como servicio gestionado a terceros** — si lo usabas para clientes, revisar. Baserow self-hosted es MIT.

---

## 2. Arquitectura objetivo

```
                    ┌─────────────── VPS #1 (32 GB) ───────────────┐
                    │                                              │
 Internet ──▶ Caddy/Traefik (SSL automático, único 80/443)         │
                    │                                              │
   dtdcargo.com ────┼─▶ (queda en Vercel — marketing/SEO)          │
   studio.dtdcargo ─┼─▶ [Stack DTD] Supabase completo + ERP Next   │
                    │    ~4-6 GB · aislado · red propia            │
                    │                                              │
   cliente1.com ────┼─▶ [App cliente 1] Next.js ──┐                │
   cliente2.com ────┼─▶ [App cliente 2] Next.js ──┤                │
   app.cliente3 ────┼─▶ [PocketBase cliente 3] ───┼──▶ [Postgres   │
                    │    ~0.3-0.5 GB c/u           │    de la casa]│
                    │                              │    1 DB por   │
                    │                              └─── cliente    │
                    │                                   1-2 GB     │
                    │  Coolify (orquesta todo) ~1-2 GB             │
                    │  Límites CPU/RAM por contenedor              │
                    └──────────────────────────────────────────────┘
                                    │
   Archivos (todos)  ──▶  S3 externo: R2 ($15/TB, egress $0) o Hetzner Obj.
   Backups DB        ──▶  pg_dump nocturno POR CLIENTE ──▶ S3 externo
   Backups Storage   ──▶  rclone sync de buckets ──▶ B2 (~$7/TB)
   Monitoreo         ──▶  Uptime Kuma/Better Stack EN OTRO SERVIDOR
                          (si el monitor vive aquí, cae junto con todo)
```

**Región:** US East (Ashburn/Miami) por Venezuela + Vercel. Hetzner EU si prima el precio (CX52 16 vCPU/32 GB ≈ $32/mes, pero ~110-130 ms desde VE). Alternativa US: Vultr/DO 8 GB $48 (empieza chico y escala) o Hetzner dedicado AX42 (~$52, 64 GB) cuando haya 6+ clientes.

---

## 3. Matemática de capacidad y costos

Reserva del host: OS + Docker + Coolify + monitoreo ≈ 3 GB. Regla de la comunidad (supascale): **4 GB → 1 stack Supabase completo · 8 GB → 2-3 · 16 GB → 4-6**.

| Host | Precio aprox. | Caben |
|---|---|---|
| 16 GB (Hetzner CX42 ~$16 / CX52 es 32 GB) | $16-32/mes | Stack DTD completo + Postgres de la casa + 10-15 apps de clientes |
| 32 GB (CX52 ~$32) ⭐ recomendado para arrancar | ~$32/mes | DTD + Postgres de la casa + 25-40 apps, con aire |
| 64 GB (dedicado AX42 ~$52) | ~$52/mes | DTD + 2 clusters PG + 60-80 apps |

**Costo mensual real de la plataforma (arranque):** VPS 32 GB ($32) + R2/Hetzner Obj ($6-15) + backups B2 ($7-14) + monitoreo ($0-29) + dominio status ≈ **$50-90/mes total**. Comparación: 5 proyectos chicos en Supabase Cloud ya son $65+/mes **sin contar DTD**.

**Cuándo escalar o separar (reglas documentadas):**
- Un cliente con pico sostenido que afecta a los demás (noisy neighbor) → su propio VPS (un CX42 de $16 no duele) — puedes seguir gestionándolo tú y cobrando más.
- Cliente que exige SLA 99.99%, auditoría o compliance → infraestructura propia gestionada por ti.
- Tu factura de VPS supera ~$80-150/mes → dedicado Hetzner rinde más.
- Regla del caso real (darko.io): corre **tres servidores chicos "porque me gusta la separación"**, no uno gigante — con clientes de por medio, dos VPS chicos (producción clientes / DTD + staging) es más sano que uno grande.

---

## 4. Operación mínima para poder cobrar (el piso serio)

| Pieza | Estándar |
|---|---|
| Deploy/aislamiento | Coolify + un proyecto por cliente, redes Docker separadas, límites `deploy.resources` |
| Backups | Automatizados a S3 externo **por cliente** (Coolify lo trae nativo) + prueba de restore documentada cada trimestre |
| Monitoreo | **Externo al VPS** (Better Stack free o Uptime Kuma en otro server) + status page pública (`status.tumarca.com`) |
| Soporte | Un solo canal (WhatsApp Business/email), horario publicado, tiempos de respuesta por escrito |
| Actualizaciones | Ventana de mantenimiento avisada 72 h antes, madrugada de fin de semana |
| Seguridad | Tailscale para acceso admin, UFW + regla Docker/iptables, secretos regenerados por stack |

**Y los bloqueantes de TU auditoría de seguridad (2026-07-31) que aplican antes de migrar:**
1. `deployActions` sin autenticación → fuera de Vercel es RCE-equivalente. **Bloqueante.**
2. Los backups de Supabase Cloud no cubren Storage → en self-hosted tampoco la DB se respalda sola: pg_dump + sync de buckets desde el día 1.
3. El lockout del PIN de operarios conviene cerrarlo antes de mover producción.

---

## 5. El lado del negocio (lo que la investigación documentó)

**Responsabilidad nueva:** dejas de ser "el que hizo la web" y pasas a ser el proveedor de infraestructura. El cliente te llamará a ti a cualquier hora cuando algo caiga. Mitigación estándar: contrato con SLA **best-effort** (99.9% mensual ≈ 43 min de caída; no prometas 99.99% con un VPS), créditos topados (ej. 5-10% de la mensualidad, tope 30%), exclusiones escritas (DDoS, contenido del cliente, integraciones de terceros, fuerza mayor).

**Precios de mercado 2025-2026 (rangos orientativos US/LATAM):**
- App pequeña (hosting + backups + updates + monitoreo): **$35-100/mes**
- Con soporte humano y bolsa de cambios acotada ("hasta 1 h/mes, no rueda"): **$100-300/mes**
- Apps transaccionales/críticas: $300+/mes
- Margen real tras soporte y tu tiempo: 15-50% — no es ingreso pasivo, es un servicio.

**Contrato (antes del primer deploy de cliente):**
1. El cliente es dueño de sus datos y contenido; tú recibes licencia limitada para prestar el servicio (sin esa frase, técnicamente no tienes permiso ni de hacer backups).
2. **Tú retienes tu "Background Technology"** (tu motor/framework reutilizable); el código específico del cliente se asigna solo tras pago completo.
3. Dominio y DNS **siempre a nombre del cliente** (nunca los registres tú).
4. Salida ordenada: handoff en ≤10 días hábiles (repo + export de DB + DNS), datos disponibles 15-30 días post-terminación, suspensión por impago a los 14-30 días con aviso — **suspender ≠ retener el export como rehén**.
5. Anexo de tratamiento de datos: tú eres el encargado, el cliente es el responsable; notificación de brechas ≤24-72 h; lista de sub-procesadores (Hetzner/Vultr, R2/B2). En Venezuela esto opera por vía **contractual** (no hay ley especial de datos) — es tu protección real.

**Fiscal Venezuela (confirmar con contador):** facturación digital homologada SENIAT **obligatoria desde el 19-03-2025** (Providencia SNAT/2024/000102 — incluye explícitamente "empresas de hosting"), IVA 16% local, revisar IGTF si cobras en divisas, exportación de servicios a clientes internacionales puede calificar a IVA 0%.

---

## 6. Plan de transición (fases, sin apagar nada)

**Fase 0 — Inventario (1 semana).** Lista tus proyectos de clientes: stack, ¿usan Supabase? ¿qué servicios (auth/storage/realtime)?, GB de datos y archivos, tráfico. Aplica el árbol de decisión de §2 a cada uno. Mide el uso real de DTD en Supabase Cloud (GB storage + egress).

**Fase 1 — Plataforma base (1 semana).** VPS 32 GB US East (o Hetzner EU) + Coolify + Caddy/Traefik + Postgres "de la casa" (`postgres:17`) + bucket S3 para archivos y otro para backups + monitoreo externo + status page. Hardening mínimo (SSH por llave, UFW, fail2ban, Tailscale).

**Fase 2 — DTD (2-3 semanas, la pieza grande).** Primero los 3 fixes bloqueantes de la auditoría. Luego el plan ya documentado en `RECOMENDACION-vps-migracion-2026.md` §3: stack self-hosted con storage en R2, ensayo de restore, sync rclone de los 13 buckets, ventana corta de flip DNS, Supabase Cloud encendido 2 semanas de cortesía.

**Fase 3 — Clientes, del más chico al más grande (1 por semana).** Los que van al Postgres compartido: migración = pg_dump de su DB + deploy del contenedor + DNS. Los que necesitan Supabase recortado: compose propio con `POOLER_TENANT_ID` fijado desde el inicio. Cada migración con su export de cortesía y rollback documentado.

**Fase 4 — Empaquetar el negocio (en paralelo a Fase 3).** Contrato tipo + anexo de datos + pricing de 2-3 tiers + status page pública + facturación digital SENIAT. Sin esto, no actives mensualidades.

**Crecimiento:** 32 GB → segundo VPS (separar DTD de clientes o clientes pesados) → dedicado AX42 → clientes enterprise a su propio VPS gestionado por ti (mantienes el retainer sin el riesgo de propiedad).

---

## 7. Riesgos honestos

1. **Single point of failure humano:** si el VPS cae a las 3 AM, no hay PaaS detrás de ti. Mitigación: monitoreo con alerta al teléfono + contrato best-effort + snapshots para reconstrucción rápida.
2. **Multi-Supabase en un VPS tiene fricciones reales** (puertos, POOLER_TENANT_ID inmutable, issue Coolify #7458). Por eso la recomendación es: UN stack completo (DTD) + Postgres compartido para el resto, no N stacks completos.
3. **Horas de operación:** 3-6 h/mes reportadas para un Supabase self-hosted sano + lo que sume cada cliente. El break-even real son tus horas, no el VPS — de ahí que los tiers de precio importen más que el ahorro de infra.
4. **Concentración:** todos tus huevos en un VPS. El segundo VPS (separación DTD/clientes) es el primer upgrade que se paga solo en tranquilidad.
5. **No verificado:** el stack de tus otros proyectos (Fase 0 lo resuelve) y los precios de Hetzner — verificarlos en hetzner.com al contratar (subieron 2 veces en 2026).

---

## 8. Respuesta corta a tu pregunta

> **¿SQL interno o Supabase adentro de los contenedores?**

- **DTD:** Supabase self-hosted completo en su propio contenedor-stack. Migrarlo a SQL pelado es reescribir el ERP — no.
- **Clientes:** un Postgres pelado compartido (una DB por cliente) para los que no necesiten Supabase; Supabase recortado (~1.2 GB) solo para el que lo justifique; PocketBase para el cliente simple nuevo.
- **Todo orquestado con Coolify, archivos en S3 externo, backups por cliente, monitoreo fuera del VPS, y contrato antes de cobrar.**

Presupuesto de arranque: **$50-90/mes** por la plataforma entera, que con 3 clientes a $50/mes ya se paga sola.
