---
sdd: "0619"
title: "Inventario para la limpieza de Kommo (paso 8.10 de la SDD-0582)"
status: draft
author: "Claude"
created: 2026-11-08
updated: 2026-11-08
supersedes: null
superseded_by: null
related: ["0582", "0590", "0614", "0587", "0586"]
confidencialidad: interno
---

# SDD-0619 · Limpieza de Kommo en el ERP (paso 8.10 de la SDD-0582) — diseño e inventario

- **Estado:** diseño. **No borra nada.** Este documento es el inventario, con `git grep` sobre `main`, y el plan. Borrar va mucho después del corte de E8, y cada PR de borrado lleva el OK de Sam.
- **Programa:** [SDD-0582](../0582-chatwoot-piloto/checklist.md), fila 8.10: «SDD de limpieza: vista y módulo Kommo, `lib/studio/kommo-*`, edge functions, crons, variables, secretos y scripts de ops; `clients` al vínculo propio; `git grep -i kommo` solo con historia».
- **Base medida:** `main` en `3c14715ad`, el 2026-11-08. Si `main` cambió, el inventario se mide de nuevo antes de cada PR, con los comandos de §8.
- **Etiquetas:** C código, R comprobado aquí, I inferencia, NV no verificado (por ejemplo, lo que corre hoy en producción).

## 1. Dónde cae en E8

La limpieza del código es la penúltima pieza de la salida de Kommo. Va en este orden, y cada fila tiene su puerta:

| Paso | Qué | Puerta |
|---|---|---|
| 8.6 | Acta de conciliación final firmada por Sam | **Abre 8.7 a 8.12** |
| 8.7 | Detener los productores de Kommo (§3.1) y resolver o congelar la outbox | PR; despliegue con OK de Sam |
| 8.8 | Quitar el canal en Kommo y a Kommo como socio en Meta | Sin retorno; OK de Sam |
| 8.9 | Exportar cifradas, fuera de Git, las tablas y columnas Kommo; revisar-datos-ve del borrado | OK de Sam (lectura de PII) |
| **8.10** | **Esta SDD: borrar el código, la configuración y las pruebas (§3.2 a §3.6)** | PR → OK de Sam |
| 8.11 | Migración de borrado de tablas, columnas y funciones (§3.3) | Migración: OK nominal de Sam; sin retorno |
| 8.12 | Cancelar la licencia | Sin retorno; OK de Sam |

**Regla:** nada de §3.2 en adelante se borra mientras un productor de §3.1 siga vivo. Primero 8.7 los apaga en producción, y después 8.10 borra su código. Al revés, una función programada llamaría a una ruta que ya no existe.

## 2. Lo que ya está hecho

- **SDD-0614, S0 (#415), S0b (#419) y S0b-bis (#425):** Kommo ya no se ve en el Studio. Las pestañas y las cifras quedan ocultas, sin borrar nada. Lo que S0 escondió es lo que esta SDD borra.
- **Embudo propio (SDD-0587, E6):** las tarjetas del CRM, que reemplazan a los leads de Kommo.

## 3. Inventario (C, `git grep` sobre `3c14715ad`)

En total, 101 rutas tienen «kommo» en el nombre, sin contar `docs/` ni `.agents/`. Otros 77 archivos de código lo mencionan en su contenido. Por capa (rutas más menciones, sin pruebas):

| Capa | Archivos |
|---|---|
| `lib/studio` | 38 |
| `infra/ops` (de ellos, 18 en `kommo-historial`) | 28 |
| `app/studio` | 27 |
| `supabase/migrations` | 24 |
| `supabase/functions` | 20 |
| `supabase/tests` | 13 |
| `scripts` | 5 |
| `lib` (fuera de `studio`) | 5 |
| `infra/dtd-cargo` | 5 |
| `infra/chatwoot` | 4 |
| `app/api` | 3 |
| público y portal (`app`, `components`) | 3 |
| `vercel.json`, `.github` y un archivo en la raíz | 3 |

Hay además **83 archivos de prueba** que mencionan Kommo.

### 3.1 Productores: corren solos y hablan con Kommo (los apaga 8.7, no 8.10)

| Productor | Dónde (C) | Qué hace | En producción |
|---|---|---|---|
| `kommo-sync` | `supabase/functions/kommo-sync/`; `pg_cron` `kommo-sync-dtd` a las 07:00 (`0084_kommo_cron_sync.sql:52`, `kommo_run_sync()`) | Trae leads, contactos y etapas a las tablas `kommo_*` | NV |
| `kommo-webhook` | `supabase/functions/kommo-webhook/` | Recibe los eventos de Kommo; usa `KOMMO_WEBHOOK_SECRET` | NV |
| `kommo-writeback` | `supabase/functions/kommo-writeback/`; la cola `kommo_writeback_outbox` (0136) y `kommo_run_writeback_drain()`. El `cron.schedule` de `0136:190` está comentado | Le escribe a Kommo desde el ERP | NV: si hay un job de drenaje vivo |
| `kommo-push-client` | `supabase/functions/kommo-push-client/` | Empuja a Kommo el cliente del alta | NV. Lo gobierna `KOMMO_PUSH_DRY_RUN` |
| Estado comercial | `app/api/cron/kommo-contact-status/route.ts`; `infra/dtd-cargo/cron/crontab:10` (10:00) y `vercel.json:18` | Sincroniza el estado de los contactos | NV |
| Alta web | `app/registro/actions.ts` (paso 11, `altaWebSinKommo`, `:71`) y `lib/studio/crm-alta-web.ts` | El push del alta | NV |
| Cotizador | `app/studio/(app)/cotizador/actions.ts` y `lib/studio/kommo-writeback.ts` | Le escribe el estimado a Kommo | NV |

**8.7 empieza con una lectura de solo lectura en producción:** jobs de `cron.job` con «kommo», funciones desplegadas y si `KOMMO_PUSH_DRY_RUN` está vacío o no (se registra solo eso, nunca el valor), con el OK del Director General. Así se sabe qué está vivo de verdad.

### 3.2 Código de la aplicación (lo borra 8.10)

- **`lib/studio/kommo-*.ts`** (9): `kommo-analytics`, `kommo-atencion`, `kommo-contact-status`, `kommo-conversacion`, `kommo-convert`, `kommo-queries`, `kommo-recovery`, `kommo-types` y `kommo-writeback`, con sus pruebas en `lib/studio/__tests__/`.
- **`supabase/functions/_shared/kommo-*.ts`** (7): `mapping`, `outbound`, `prune`, `reapertura`, `router`, `webhook-parse` y `writeback-plan`, con 6 pruebas.
- **Las 4 edge functions** de §3.1: sus carpetas del repo. Las desplegadas no se retiran aquí (§3.4.1).
- **Vistas del CRM en el Studio:** `KommoClient.tsx`, `KommoBoardView.tsx` y `kommo-tabs.shared.ts`. También `StageMapConfig.tsx`, `MarkboxFieldConfig.tsx` y `RecoveryTab.tsx`, y las ramas de Kommo de `crm/page.tsx`, `crm/actions.ts`, `LeadDrawer.tsx`, `LeadActionsButton.tsx`, `ConvertLeadDrawer.tsx`, `StageControl.tsx` y `DireccionTab.tsx`. Son 27 archivos de `app/studio` en total. Cada uno se mide al borrar: algunos solo tienen una rama de Kommo, no son enteros de Kommo.
- **Cifras de Kommo** que S0b ocultó: `lib/studio/dashboard/*`, `lib/studio/direccion/queries.ts`, `lib/studio/reports/*` y `app/studio/(app)/direccion/_components/CommercialCard.tsx`.
- **Comentarios que nombran a Kommo** en código público: `components/PuertaAPuerta.tsx:7`, `lib/money.ts:6-12`, `lib/seo-offer-catalog.ts:4`, `lib/servicios-detalle.ts:4` y `:155`, `app/api/contact/route.ts:49-51`, `app/api/cron/portal-cold-reminder/route.ts:18` y `app/privacidad/page.tsx:37`. No son texto visible. Se reescriben o se quitan con la historia en el commit.

### 3.3 Datos (los borra 8.11, después del export de 8.9)

- **12 tablas:** `kommo_connections`, `kommo_contacts`, `kommo_custom_fields`, `kommo_lead_contacts`, `kommo_leads`, `kommo_pipelines`, `kommo_statuses`, `kommo_tasks`, `kommo_unsorted`, `kommo_users`, `kommo_writeback_echo` y `kommo_writeback_outbox`.
- **20 funciones:**
  - de la cola de escritura: `bump_kommo_writeback_attempt`, `claim_kommo_writeback_batch`, `enqueue_kommo_contact_writeback`, `enqueue_kommo_writeback`, `mark_kommo_writeback_sent`, `mark_kommo_writeback_skipped`, `reap_kommo_writeback_stale`, `record_kommo_writeback_echo`, `record_kommo_writeback_error` y `kommo_run_writeback_drain`;
  - de sincronización y mezcla: `kommo_discard_stale_update`, `kommo_get_token`, `kommo_merge_custom_fields`, `kommo_merge_payload`, `kommo_merge_tag_lists`, `kommo_replace_lead_contacts`, `kommo_replace_lead_contacts_bulk`, `kommo_run_sync`, `kommo_touch_lead_message` y `kommo_vincular_clientes_por_telefono`.
- **Columnas en tablas que se quedan:** `clients.kommo_lead_id`, con su FK y su índice único (`0108_clients_kommo_lead.sql`), y `clients.kommo_contact_id` (`0342_kommo_contact_link.sql:35`), más las de `kommo_writeback_outbox`, que se va entera.
- **El job `kommo-sync-dtd`** de `pg_cron` y los secretos de vault: `kommo_cron_key` y el token que lee `kommo_get_token`.
- **Las migraciones aplicadas no se borran ni se renumeran.** La 8.11 es una migración nueva que hace `drop`.

### 3.4 Configuración, crons y scripts (los borra 8.10)

- **Variables** (buscadas por valor con `git grep -n "<NOMBRE>"`; C):
  - `KOMMO_WEBHOOK_SECRET` y `KOMMO_PUSH_DRY_RUN`: declaradas en `infra/dtd-cargo/.env.example:363-364` y pasadas en `infra/dtd-cargo/compose.supabase.yml:479-480`. Las leen `supabase/functions/kommo-webhook/index.ts:545` y `supabase/functions/kommo-push-client/index.ts:110`. También las nombran `infra/ops/staging/verificar-aislamiento.sh:187` y `infra/ops/tests/prueba-scripts-entorno-prueba.sh:61`. **No están** en el `.env.example` de la raíz.
  - `CRM_ALTA_WEB_SIN_KOMMO`: `.env.example:309` e `infra/dtd-cargo/.env.example:171`. La lee `lib/studio/crm-alta-web.ts:40`, la cita `app/registro/actions.ts:467` y la prueban `app/registro/__tests__/register-tarjeta-crm.test.ts:263` e `infra/ops/tests/prueba-scripts-entorno-prueba.sh:142-144`.
  - `infra/dtd-cargo/compose.yml` no las tiene: solo nombra a Kommo en un comentario (`:20`). `infra/dtd-cargo/README.md` tampoco las nombra; menciona a Kommo en `:77` (`FUNCTIONS_VERIFY_JWT`) y `:150`. Esos textos se ajustan en L3.
- **Crons:** la línea de `infra/dtd-cargo/cron/crontab:10` y la entrada de `vercel.json:18`.
- **Ops:**
  - `infra/ops/migrate/{import-from-cloud.sh,vault-set-secret.sh}`;
  - `infra/ops/staging/{prueba.sets,semilla-prueba.sql,verificar-aislamiento.sh}`;
  - las pruebas de `infra/ops/tests/` que lo mencionan.
- **Scripts:** `scripts/check-edge-functions.mjs`, `scripts/verify.mjs`, `scripts/check-numbering.mjs` (choques históricos de `0342` y `0363`, que se quedan), `scripts/build-marketing-reader.mjs` y `scripts/qa/profile-merge-chain.mjs`.
- **Chatwoot:** `infra/chatwoot/rails/zz_dtd_proteccion_register.rb` protege el número que se comparte con Kommo. Se quita cuando el número salga de Kommo (8.8), y lleva su propia prueba.

### 3.4.1 Repo no es producción

Borrar del repo (§3.2 y §3.4) **no retira nada de lo que está desplegado**:
- las 4 edge functions de §3.1 siguen desplegadas en Supabase;
- los valores de `KOMMO_WEBHOOK_SECRET`, `KOMMO_PUSH_DRY_RUN` y los de vault (§3.3) siguen en producción;
- la línea del crontab del VPS (la copia viva de `infra/dtd-cargo/cron/crontab:10`) sigue corriendo hasta que se cambie allá.

**Retirar eso en producción queda fuera de la 0619 y pide el OK nominal de Sam**, con el [runbook de producción](../../runbooks/aplicar-migraciones-prod.md). Lo apaga primero la 8.7 (§3.1). El borrado físico de datos de la 8.11 lo corre Sam.

### 3.5 Herramientas de E5 (se quedan hasta 8.9)

`infra/ops/kommo-historial/` (18 archivos) y `.github/workflows/kommo-historial-cargador.yml` respaldaron y cargaron el historial. Hacen falta para la extracción final (8.5) y el acta final (8.6). Después de 8.9, archivarlas o borrarlas lo decide Sam (D3).

### 3.6 Historia permitida (se queda)

`supabase/migrations/` (aplicadas), `docs/`, `.agents/handoffs/` y `PROMPT_CLAUDE_CODE_kommo_conexion_A.md` en la raíz. Este último es un prompt viejo, y su destino lo decide el Director General.

## 4. Decisiones abiertas

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| D1 | La clave interna `kommo` del módulo CRM (`lib/studio/modules.ts:130`, `lib/studio/rbac.ts:99`), que también es la de los overrides de permisos | (a) renombrarla a `crm`, con una migración de datos de los overrides y una prueba de que ningún rol pierde ni gana acceso; (b) dejarla como plomería, como excepción escrita del criterio de salida | (a), en una PR propia y antes de 8.11 |
| D2 | `clients` al vínculo propio: qué reemplaza a `kommo_lead_id` y `kommo_contact_id` | La tarjeta del CRM (SDD-0587) y el contacto de Chatwoot (SDD-0586) ya vinculan cliente y conversación. Hay que medir quién lee esas columnas fuera del código de Kommo: hoy, `app/studio/(app)/crm/actions.ts` (4 usos); el resto es código que se borra | Medir antes de 8.11; si alguien más las lee, pasarlo al vínculo propio en 8.10 |
| D3 | Las herramientas de E5 (§3.5) después de 8.9 | Archivarlas en una etiqueta de Git o borrarlas | Etiqueta y borrado |
| D4 | Las pruebas de `supabase/tests/` de migraciones cuyos objetos borra la 8.11 | Quedan, si prueban su migración aislada (NV); o se retiran con la 8.11 | Medir con el gate de migraciones al preparar la 8.11 |

## 5. Partición propuesta de 8.10, en serie

Cada PR mide de nuevo su parte con §8 y lleva su allowlist exacta.

1. **L1 · Vista y módulo:** §3.2, las vistas del CRM y las cifras, y D1 si es (a).
2. **L2 · Lógica y funciones:** `lib/studio/kommo-*`, `_shared/kommo-*` y las carpetas de las 4 edge functions, con sus pruebas. Solo repo.
3. **L3 · Configuración y ops:** §3.4. Solo repo: el crontab del VPS y los secretos vivos siguen §3.4.1.
4. **L4 · Barrido final:** comentarios y restos, más el criterio de salida (§7).

## 6. Datos personales (revisar-datos-ve)

Este diseño no captura, mueve ni borra datos.
- El borrado de datos es la 8.11, después del export cifrado de la 8.9, con el conteo de `entity_audit_log` y de los respaldos (fila 8.9). Ese borrado físico lo corre Sam.
- Borrar el código de 8.10 no borra filas. Antes de la 8.11 se anota que las tablas siguen en la base.

## 7. Criterio de salida de 8.10

`git grep -i -l kommo` sobre `main` solo devuelve rutas de la historia permitida de §3.6, más la excepción de D1 si Sam elige (b). Lo comprueba una prueba que corre ese `grep` con la lista de permitidos. Sin esa prueba, el criterio se vence solo (I).

## 8. Comandos que reproducen el inventario

```bash
git ls-tree -r --name-only origin/main | grep -i kommo | grep -v -E "^docs/|^\.agents/"
git grep -l -i kommo origin/main -- app lib components supabase/functions scripts infra vercel.json ':!**/__tests__/**' ':!**/*.test.*'
git grep -h -i -o -E "create table (if not exists )?(public\.)?[a-z_]*kommo[a-z_]*" origin/main -- supabase/migrations | sort -u
git grep -h -i -o -E "create (or replace )?function (public\.)?[a-z_]*kommo[a-z_]*" origin/main -- supabase/migrations | sort -u
git grep -c -E "kommo_lead_id|kommo_contact_id" origin/main -- app lib components supabase/functions ':!**/__tests__/**' ':!**/*.test.*'
```

## Allowlist de este diseño

- `docs/specs/0619-limpieza-kommo-inventario/spec.md`
- `docs/specs/README.md` (índice regenerado)
- `docs/specs/0582-chatwoot-piloto/checklist.md` (solo la fila 8.10)
