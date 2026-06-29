---
sdd: "0116"
title: "Club DTD — membresía recurrente + compra grupal (consolidación comunitaria)"
status: in-progress
author: "Claude Code (redactor de specs) + founder"
created: 2026-06-26
updated: 2026-06-28
supersedes: null
superseded_by: null
related: ["0093", "0107", "0106", "0051", "0066", "0042", "0085", "0090", "0047", "0053", "0077"]
confidencialidad: interno
---

# SDD-0116 · Club DTD — membresía recurrente + compra grupal

> **Lo que SDD-0093 dejó como "arquitectura ya, build fase 2".** El Club DTD es el
> **motor de dinero recurrente** de la Academia: convierte alumnos/leads en una **comunidad
> de importadores que importan CON DTD** (LTV cliente-contenedor), no en compradores de cursos.
> Hoy es un **sketch en el Norte** (`portal/academia.jsx`, pantalla `ClubScreen`) — sin tabla,
> sin código en ninguna superficie. Esta spec lo **modela** y **delimita**, dejando todas las
> decisiones de modelo de negocio expuestas al founder al final.

## 0. Por qué — y qué NO es

**Objetivo.** Especificar el dominio **Club DTD** como módulo del Studio ERP con cuatro
sub-dominios que ya esboza el sketch del Norte:

1. **Membresía recurrente** — quién es miembro del Club, en qué plan, con qué estado y vigencia.
2. **Compra grupal** — consolidación comunitaria: varios miembros juntan volumen (CBM/kg) en
   una "compra grupal" para bajar el costo por CBM. Es el corazón del "motor de dinero".
3. **Eventos / cohortes del Club** — encuentros en vivo, ferias, sesiones con el equipo DTD
   (distinto de las cohortes de cursos de SDD-0093, aunque puede compartir patrón).
4. **Proveedor del mes** — fábricas verificadas/recomendadas por la comunidad (ligadas a las
   inspecciones de SDD-0066 cuando exista verificación real).

**Principio rector (heredado de SDD-0093 — no se re-litiga acá):**
- La ganancia oculta = la **comunidad que importa con DTD** (optimizar por LTV, no por cuota).
- **Marca sobre cara:** la comunidad, la data y la relación son de DTD. Membresías, compras
  grupales y proveedores pasan por DTD; si una "cara" se va, la audiencia no se la lleva.

**NO es (límites duros de esta spec):**
- ❌ NO es un **marketplace** ni un carrito de e-commerce. La compra grupal **no** mueve dinero
  de producto entre miembros; agrega **intención de volumen** para una consolidación DTD.
- ❌ NO resuelve el **pricing** ni la **recurrencia** ni el **modelo de comunidad** — eso es del
  founder (ver §9). El modelo de datos los deja **configurables**, no hardcodeados.
- ❌ NO toca el **cobro real** de la membresía en esta fase (sin pasarela). El estado de pago se
  registra/concilia con lo que ya existe (facturas + contabilidad SDD-0077/0079); la integración
  de checkout queda **diferida** y atada a una decisión de negocio.
- ❌ NO re-modela la Academia: reusa `persons` (SDD-0106/0107) como ancla de identidad del miembro.
- ❌ NO crea una red social. Sin feed, sin mensajería miembro↔miembro en esta fase.

## 1. Contexto — de dónde sale

- **Sketch del Norte** (`docs/design/studio/_norte/portal/academia.jsx`, `ClubScreen`, líneas
  ~485-510): tab "Club" del portal-academia, con badge **"Próximamente · Fase 2"** y tres
  bloques: **Compra grupal**, **Eventos y cohortes**, **Proveedor del mes**. Copy vigente:
  *"La comunidad de importadores DTD. Donde aprender se vuelve hacer, en grupo."*
- **SDD-0093** (Academia): decidió "Club DTD (membresía recurrente, el motor de dinero vía
  compra grupal) = arquitectura ya, build fase 2". Definió que **miembro del portal = ≥1
  inscripción o diploma** — ojo: eso es "miembro de la Academia", **distinto** de "miembro del
  Club" (ver decisión D1 en §9).
- **SDD-0106/0107** (persons): cada humano se ancla a `persons.id` por cédula. El miembro del
  Club **es una persona**, no un `client_markbox` suelto.
- **SDD-0066** (inspecciones PSI/fábrica): fuente de "fábrica verificada" para Proveedor del mes
  (reporte white-label, nunca el proveedor de inspección crudo).
- **SDD-0051** (fidelización): niveles + referrals ya existen; el Club **no** los duplica —
  decisión pendiente si el "nivel de Club" se deriva de fidelización o es independiente (D2).
- **SDD-0047/0053** (consolidación + costing): la compra grupal desemboca en una **consolidación**
  real con su costeo; el Club agrega intención, la operación la ejecuta el flujo de embarques.

## 2. Alcance — entregable propuesto (por slices)

El modelo se entrega en **slices acotados**; el founder decide cuáles se construyen y en qué
orden (los primeros dos son fundacionales, el resto depende de las decisiones de §9).

- **Slice A — Membresía (fundacional):** tabla de miembros del Club ancladas a `persons`,
  con plan + estado + vigencia. Módulo `/studio/club` (lista + drawer), RBAC, RLS por tenant.
  Sin cobro real (estado de pago manual/conciliado).
- **Slice B — Compra grupal (el motor):** "compras grupales" (rondas de consolidación
  comunitaria) + participaciones de miembros (intención de volumen). Cierre de ronda → handoff
  a una **consolidación** (SDD-0047) sin mover dinero de producto.
- **Slice C — Eventos / cohortes del Club:** eventos en vivo + inscripciones de miembros
  (patrón espejo de `academy_cohorts`/`academy_enrollments`, pero del Club).
- **Slice D — Proveedor del mes:** fábricas destacadas (ligadas a inspección verificada de
  SDD-0066 cuando exista) + curaduría editorial; visible en portal del miembro.
- **Slice E — Portal del miembro (Club):** activar el tab "Club" real en `/portal` (hoy sketch):
  estado de membresía, compras grupales abiertas (unirse), próximos eventos, proveedor del mes.
- **(Diferido)** Checkout/recurrencia de la cuota; landing pública `/club`; gamificación.

## 3. Modelo de datos propuesto (BORRADOR — para revisión)

> Patrón estándar del repo (SDD-0144/0085): `tenant_id → tenants`, **RLS por tenant**,
> `revoke from anon` + `grant authenticated`, enums = `text` + `check`, soft-delete
> `deleted_at`, trigger `touch_updated_at`. **Defensa-en-DB** para todo FK polimórfico o
> cross-tenant: helper `*_in_tenant()` (SECURITY DEFINER, fail-closed) + trigger
> `*_same_tenant` BEFORE INSERT/UPDATE (la FK sola no cubre el tenant). **No Zod** — validación
> en Server Actions con `validate*Input()` propio. Tokens UI `var(--*)`. Terminología ERP =
> **Shipping Mark** (`markbox` interno).

Nombres y columnas son **propuesta**; los que dependen de una decisión de negocio están marcados.

### 3.1 `club_members` — la membresía (Slice A)
- `id uuid pk`, `tenant_id → tenants`.
- `person_id uuid → persons(id)` **(NOT NULL)** — el miembro **es una persona** (SDD-0106).
- `client_markbox text null` — vínculo opcional a su perfil de carga (`clients`); un miembro
  puede ser academia-only sin Shipping Mark todavía.
- `plan text check` — el plan/tier de membresía. Valores **= decisión D3** (placeholder:
  `comunidad | importador | mayorista`). NO hardcodear precios acá.
- `status text check (activa | pausada | vencida | cancelada)`.
- `joined_at timestamptz`, `current_period_end date null` — vigencia (cuándo "vence" la cuota).
  La **mecánica de recurrencia = decisión D4**; el modelo solo guarda el fin de período vigente.
- `source text null` — de dónde entró (academia, referido, evento, manual).
- `notes text null`, `created_at`, `updated_at`, `deleted_at`.
- **Unicidad:** índice único parcial `(tenant_id, person_id) where deleted_at is null` — una
  persona = una membresía viva por tenant.
- **Defensa-en-DB:** `person_in_tenant(person_id, tenant_id)` (ya existe de 0107) + trigger
  `club_members_person_same_tenant`. Idem `client_markbox` si se setea (mismo tenant).

### 3.2 `club_group_buys` — compra grupal / ronda de consolidación comunitaria (Slice B)
- `id uuid pk`, `tenant_id`.
- `title text`, `slug text`, `summary text null`.
- `status text check (abierta | cerrada | en_consolidacion | completada | cancelada)`.
- `opens_at timestamptz`, `closes_at timestamptz null` — ventana para unirse.
- `target_cbm numeric null`, `committed_cbm numeric default 0` — meta vs volumen comprometido
  (se recalcula desde las participaciones; **no** es la verdad financiera).
- `origin text null`, `destination text null` — ruta CN→VE (texto libre o ligado a ciudades de
  SDD-0055 si se decide).
- `consolidation_id uuid null` — al cerrar la ronda, FK al embarque/consolidación real (SDD-0047)
  que la ejecuta. Hasta entonces `null`. **Defensa same-tenant** vía trigger.
- `created_at`, `updated_at`, `deleted_at`.

### 3.3 `club_group_buy_participants` — intención de volumen por miembro (Slice B)
- `id uuid pk`, `tenant_id`.
- `group_buy_id uuid → club_group_buys(id)`.
- `member_id uuid → club_members(id)` **o** `person_id` directo — **decisión D5** (¿hace falta
  ser miembro del Club para participar, o basta ser persona/cliente?).
- `estimated_cbm numeric null`, `estimated_value_usd numeric null` — **intención**, no factura.
- `status text check (interesado | confirmado | retirado)`.
- `note text null`, `created_at`, `updated_at`, `deleted_at`.
- **Unicidad:** único parcial `(group_buy_id, member_id) where deleted_at is null`.
- **Aislamiento financiero:** esta tabla guarda **intención**, NO montos cobrables. Cualquier
  cobro/seña va por el camino de facturas existente (SDD-0077), **tabla aparte** — espejo de la
  lección de SDD-0102 (financieros separados del registro operativo).

### 3.4 `club_events` — eventos / cohortes del Club (Slice C)
- `id uuid pk`, `tenant_id`, `title`, `summary text null`.
- `kind text check (evento | feria | sesion_vivo | cohorte)`.
- `starts_at timestamptz`, `ends_at timestamptz null`, `modality text (online|presencial)`,
  `place text null`, `seats int null`, `status text check (proximamente|abierto|cerrado|completado)`.
- `created_at`, `updated_at`, `deleted_at`.

### 3.5 `club_event_registrations` — inscripciones a eventos (Slice C)
- `id`, `tenant_id`, `event_id → club_events(id)`, `member_id → club_members(id)`,
  `status (inscrito|asistio|no_asistio)`, timestamps + soft-delete.
- Único parcial `(event_id, member_id) where deleted_at is null`. Patrón espejo de
  `academy_enrollments`/`academy_attendance` (SDD-0093) — **no** reusar esas tablas (dominio
  distinto), pero sí el patrón.

### 3.6 `club_featured_suppliers` — Proveedor del mes (Slice D)
- `id`, `tenant_id`.
- `period text` (mes, ej. `2026-07`) — único parcial `(tenant_id, period) where deleted_at is null`.
- `supplier_name text` (white-label, **nunca** el proveedor de inspección crudo — regla SDD-0066).
- `inspection_id uuid null` → ligado a una inspección verificada de SDD-0066 cuando exista.
- `category text null`, `blurb text null` (curaduría editorial), `cover_path text null`.
- `status text check (borrador|publicado)`, timestamps + soft-delete.

### 3.7 RLS / defensa
- Todas con **RLS por tenant** (no por rol — la lección de SDD-0085: el aislamiento es por
  tenant; el rol se chequea en la capa app con RBAC).
- Tablas con FK a `persons`/`clients`/`consolidations`/`inspections` → **trigger same-tenant**
  por cada una (no confiar en la FK para el tenant).
- Si el portal del miembro (Slice E) lee estas tablas → policy de portal scoped por la persona
  del usuario (patrón `get_portal_client_*` de SDD-0042), **additiva**, sin tocar el RLS del Studio.

## 4. Capa app propuesta (Studio · Club)

- **Módulo** `club` en `lib/studio/modules.ts` (grupo COMERCIAL) + `lib/studio/rbac.ts`
  (`["commercial","support"]` propuesto; **D6**: ¿quién administra el Club?). `requireModuleView("club")`
  en la page; `moduleEditDenial` en actions (patrón SDD-0085).
- **Queries puras** `lib/studio/club/*-queries.ts` que reciben `SupabaseClient` (nunca crean el
  cliente). **Types/validators** `lib/studio/club/*-types.ts` (enums, `validate*Input()`, helpers
  de label/badge tone). Dominio con ≥3 archivos → carpeta `lib/studio/club/` (regla de AGENTS.md).
- **Server Actions** (`app/studio/(app)/club/actions.ts`): `"use server"` + `useActionState` +
  parsing manual de `FormData` + `validate*Input()` propio (**no Zod**) + `revalidatePath()`.
- **Drawer** con el patrón `DrawerShell` (`<form id>` + `<button form>`), tokens `var(--*)`.
- **Identidad del miembro:** reusar el lookup de persona por cédula de SDD-0107 (`normalizeCedula`
  + query de `persons`) para crear/ubicar la persona al dar de alta un miembro.

## 5. Portal del miembro (Slice E)

- Activar el tab **"Club"** real en `/portal` (hoy `ClubScreen` es sketch con "Próximamente").
  Reusa tokens + `window.Icon`. Mantener copy de marca vigente del sketch hasta tener uno nuevo.
- Estados a renderizar: **no-miembro** (gate + CTA "Quiero entrar al Club") · **miembro activo**
  (estado/vigencia, compras grupales abiertas para unirse, próximos eventos, proveedor del mes).
- **Diseño:** si el cambio visual es no trivial → pasa por `ui-ux-designer` y, si no hay diseño
  aprobado del Norte, `DESIGN-CHECK` antes de inventar (proceso handoff-first de AGENTS.md).

## 6. Slices (resumen ejecutable)

| Slice | Entregable | Depende de decisión §9 |
|---|---|---|
| **A** | `club_members` + módulo `/studio/club` (lista+drawer) + RBAC + RLS | D1, D3, D4, D6 |
| **B** | `club_group_buys` + `_participants` + cierre→consolidación | D5 (+ aislamiento financiero) |
| **C** | `club_events` + `_registrations` | — |
| **D** | `club_featured_suppliers` (ligado a SDD-0066) | — |
| **E** | Tab "Club" real en `/portal` | D1 |
| (dif) | Checkout/recurrencia · landing `/club` · gamificación | D4, D7 |

## 7. Criterios de aceptación (por slice)

- **A:** dar de alta una persona como miembro del Club por cédula (ubica/crea persona vía
  SDD-0107); `(tenant_id, person_id)` único; un `person_id` de otro tenant es **rechazado por el
  trigger** (no solo por app); la lista filtra por estado/plan; RBAC niega edición a roles sin permiso.
- **B:** crear una compra grupal `abierta`; un miembro se une con su `estimated_cbm`;
  `committed_cbm` refleja la suma; cerrar la ronda la pasa a `en_consolidacion` y permite ligar
  un `consolidation_id` del **mismo tenant** (trigger lo valida); **cero** montos cobrables en
  `_participants` (la verdad financiera vive en facturas, tabla aparte).
- **C:** crear evento, inscribir miembro, marcar asistencia; único `(event_id, member_id)`.
- **D:** publicar "Proveedor del mes" de un período; único por `(tenant_id, period)`; el nombre
  mostrado es white-label (grep 0 hits del proveedor de inspección crudo / "Canopy" — regla SDD-0066).
- **E:** portal del miembro muestra el estado correcto (no-miembro vs activo) scoped por la
  persona del usuario; no filtra datos de otra persona/tenant.
- **Transversal:** `node scripts/verify.mjs` TODO VERDE; migración probada en **branch efímero
  de Supabase** (no prod) con `get_advisors` limpio; `pnpm build` antes de cualquier push.
  **El agente NO aplica a prod** (lo hace coordinación/Director).

## 8. Seguridad / riesgos

- **Aislamiento financiero (crítico):** la compra grupal NO debe convertirse en un registro de
  cobros. Intención (CBM estimado) y dinero (facturas/señas) van en **tablas distintas** —
  espejo directo de SDD-0102 (gate de pago y financieros separados, defendidos en DB).
- **Cross-tenant:** cada FK a `persons`/`clients`/`consolidations`/`inspections` lleva trigger
  same-tenant; la FK sola no garantiza tenant (patrón polimórfico del repo).
- **Marca sobre cara:** el modelo guarda comunidad/proveedores **del tenant DTD**, no de una
  persona-cara — ninguna tabla "pertenece" a un facilitador/creador.
- **Proveedor del mes:** white-label obligatorio; nunca exponer el proveedor de inspección crudo.
- **Privacidad portal:** las policies de portal son additivas y scoped por persona; no ampliar el
  RLS del Studio.
- **Reversibilidad:** todo additivo (tablas nuevas, columnas nullable). Cero ripple en Academia,
  clientes o consolidaciones existentes.

## 9. Decisiones pendientes (founder)

> **Resueltas por el founder (2026-06-28) — desbloquean Slice A:**
> - **D1 = "mismo que Academia".** Miembro del Club = miembro de la Academia (≥1
>   inscripción/diploma). El gate del tab Club (Slice E) y la elegibilidad reusan ese criterio;
>   no hay un escalón de pago aparte.
> - **D3 = planes `comunidad | importador | mayorista`** (valores del `check` de `plan`).
> - **D4 = sin cuota (gratis).** No hay cobro ni recurrencia; se monetiza vía logística/compra
>   grupal. Sin pasarela, sin checkout.
> - **D6 = RBAC `commercial + support`** (support read-only V1; admin siempre).
> - **D2 (de facto):** el `plan` vive en `club_members` (no se deriva de fidelización).
>
> **Reconciliación de modelo (consecuencia de D1+D4):** como la entrada es gratis y el gate de
> elegibilidad lo da Academia, `club_members` **NO modela cobro ni vigencia**. Registra solo
> `plan` (tier) + `status` por persona. `current_period_end` queda **nullable y sin uso** (placeholder
> para una futura recurrencia si cambia D4); el `status` se reduce a `activa | pausada | cancelada`
> (se elimina `vencida`, que solo tenía sentido con cuota).
>
> **Resueltas por el founder (2026-06-28) — desbloquean Slice B:**
> - **D5 = solo miembros del Club** participan en una compra grupal (es gancho de
>   membresía) → `club_group_buy_participants.member_id → club_members`.
> - **D7 = 100% intención (sin dinero):** participants guarda solo CBM/valor
>   ESTIMADO, cero montos cobrables; el cobro va por facturas (SDD-0077) al
>   facturar la consolidación (aislamiento financiero, lección SDD-0102). Sin pasarela.
> - Nota de implementación: `committed_cbm` NO se persiste (derivado en lectura);
>   el vínculo a la consolidación real (SDD-0047) existe en action+DB
>   (`setGroupBuyStatusAction`), con el **selector de consolidación en UI diferido**.
>
> **Resueltas por el founder (2026-06-29) — desbloquean Slices C/D/E:**
> - **D9 = reusar cohortes de Academia.** Los eventos del Club NO son tablas nuevas
>   (`club_events`/`club_event_registrations` quedan **descartadas**): se modelan sobre
>   `academy_cohorts`/`academy_enrollments` (SDD-0093) con un **discriminador** (ej.
>   `context = 'academia' | 'club'` o `kind`). Implica acoplar el dominio de eventos al de
>   Academia — ripple a revisar al construir Slice C (schema + filtros + RLS).
> - **D8 = Proveedor del mes derivado de inspecciones.** `club_featured_suppliers` se
>   sugiere/deriva de inspecciones **verificadas** (SDD-0066); `inspection_id` pasa de
>   opcional a **eje del slice**. Sigue **white-label** (nunca el proveedor de inspección
>   crudo / "Canopy" — regla SDD-0066). Falta definir el criterio de ranking/elegibilidad.
> - **D10 = solo interno/portal.** Sin landing pública `/club` en esta fase. El Club vive en
>   `/studio/club` (admin) + tab en `/portal` (miembro, Slice E). No toca SEO ni
>   `docs/marketing/` todavía.
> - **D11 = solo importadores finales (V1).** El Club NO modela aliados mayoristas
>   white-label en esta fase; `plan` y compra grupal quedan como están (intención por
>   persona, no por aliado). Los aliados recurrentes del norte interno se modelan aparte
>   cuando aplique.

> Este spec **expone** las decisiones de negocio; no las resuelve. El modelo deja todo
> configurable (planes, estados, vigencia) para no clavar un número antes de tiempo.

- **D1 · ¿Qué es "ser miembro del Club"?** SDD-0093 definió "miembro de la Academia = ≥1
  inscripción/diploma". ¿El Club es lo mismo, un escalón de pago **encima** de la Academia, o un
  dominio independiente? Esto define el gate del tab "Club" en el portal (Slice A/E).
- **D2 · ¿El Club reusa fidelización (SDD-0051) o tiene niveles propios?** Si el "nivel/tier" del
  Club deriva de fidelización (niveles + referrals ya existen) evitamos duplicar; si es
  independiente, `plan` vive solo en `club_members`. ⭐ Recomendación a revisar: **derivar de
  fidelización** para no fragmentar la identidad del cliente.
- **D3 · ¿Cuáles son los planes/tiers y qué incluye cada uno?** (placeholder
  `comunidad/importador/mayorista`). Define los valores del `check` de `plan`.
- **D4 · ¿Cómo funciona la recurrencia y el cobro de la cuota?** ¿Mensual, anual, sin cuota
  (gratis + monetización vía logística)? ¿Cobro real (pasarela) o conciliación manual contra
  facturas? Esto decide si se construye el checkout diferido o se queda en estado manual.
- **D5 · ¿Hace falta ser miembro del Club para entrar a una compra grupal?** ¿O cualquier
  cliente/persona puede sumarse y la membresía solo da beneficios (mejor precio/prioridad)?
  Define si `_participants` referencia `member_id` o `person_id`.
- **D6 · ¿Quién administra el Club en el ERP?** ¿`commercial`, un rol nuevo `club`, o la Director-
  socia de la Academia? Define el RBAC del módulo.
- **D7 · Recurrencia económica del "motor de dinero":** ¿la compra grupal cobra una **seña** al
  unirse, o es 100% intención hasta que se factura la consolidación? Esto toca el aislamiento
  financiero (§8) y la pasarela.
- **D8 · Proveedor del mes:** ¿curaduría 100% editorial de DTD, votación de la comunidad, o
  derivado automáticamente de inspecciones verificadas (SDD-0066)? Define cuánto se automatiza.
- **D9 · Eventos del Club vs cohortes de Academia (SDD-0093):** ¿son el mismo objeto o dominios
  separados? (esta spec propone separados para no acoplar; confirmar).
- **D10 · Landing pública `/club`:** ¿se abre captación pública del Club ahora o primero solo
  interno/portal? (afecta SEO — coordinar con `docs/marketing/`).
- **D11 · Relación con white-label aliados (norte interno "2 contenedores/mes"):** ¿el Club es
  también el canal para aliados mayoristas recurrentes, o solo importadores finales? Puede cambiar
  el modelo de `plan` y de compra grupal.

## 10. Archivos (propuesta — al construir)

```
supabase/migrations/NNNN_club_members.sql            (Slice A · nuevo)
supabase/migrations/NNNN_club_group_buys.sql         (Slice B · nuevo)
supabase/migrations/NNNN_club_events.sql             (Slice C · nuevo)
supabase/migrations/NNNN_club_featured_suppliers.sql (Slice D · nuevo)
lib/studio/club/club-member-{types,queries}.ts       (nuevo)
lib/studio/club/group-buy-{types,queries}.ts         (nuevo)
lib/studio/modules.ts                                (editar: módulo `club`)
lib/studio/rbac.ts                                   (editar: permisos `club`)
app/studio/(app)/club/{page.tsx,actions.ts}          (nuevo)
app/portal/(app)/.../club/...                         (Slice E · activar tab real)
docs/specs/0116-club-dtd/spec.md                     (este archivo)
```

## 11. Notas

- Es un **borrador para revisión del founder**. No resuelve negocio; lo expone (§9).
- Reusa identidad de SDD-0106/0107 (persona por cédula), inspecciones de SDD-0066 (proveedor
  white-label), consolidación de SDD-0047 y facturación de SDD-0077 — **no** re-modela nada de eso.
- El sketch del Norte (`ClubScreen`) es la referencia visual de partida; el diseño real entra por
  el proceso handoff-first cuando el founder cierre D1–D11.
