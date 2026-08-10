---
sdd: "0240"
title: "Feature flags: siembra por tenant y panel que no miente"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-08-02
updated: 2026-08-02
supersedes: null
superseded_by: null
related: ["0085", "0224"]
confidencialidad: interna
---

# SDD-0240 · Feature flags: siembra por tenant y panel que no miente

> ## ⚠️ Corrección con datos de producción · 2026-08-02
>
> Escribí §1.1 y §1.2 leyendo **sólo el repo**. Al aplicar la migración pude
> consultar producción y **una parte del diagnóstico era falsa**. Queda acá
> arriba porque el error importa más que la conclusión.
>
> **Lo que estaba MAL:**
>
> - **`marketing_news` SÍ está en producción, y en `true` desde 2026-05-28.**
>   Su fila tiene `updated_by = NULL`: la sembró alguien por SQL, fuera de las
>   migraciones del repo. O sea que **Noticias Web nunca estuvo inalcanzable**
>   en prod. Mi frase "el toggle siempre falla y el módulo es inalcanzable" vale
>   para un entorno reconstruido desde las migraciones (el `schema-rebuild`, una
>   branch de Supabase, un tenant nuevo), **no para producción**.
> - Los 22 flags existen. La parte de **siembra** de 0337 fue un **no-op** para
>   el único tenant que hay. Confirmado: 22 filas antes, 22 después, y
>   `marketing_news`/`cn_translation` conservaron su valor.
>
> **Lo que estaba BIEN, y era lo importante:**
>
> - **El trigger NO existía** (`pg_trigger` → 0 antes de aplicar). Un tenant
>   nuevo seguía naciendo con cero filas. Hoy hay **un solo tenant**, así que la
>   rotura del panel para aliados white-label era **latente, no activa**.
> - **Ninguna migración del repo siembra `marketing_news`.** Eso es drift real
>   en la dirección que el gate no mira: producción tiene una fila que ningún
>   archivo crea. Cualquier entorno reconstruido desde el repo nace sin ella.
> - El error silencioso del UI (§1.2) es código, no dato: era real igual.
> - Los 17 flags sin consumidor (§1.4) son reales igual.
>
> **La lección:** para un bug de DATOS, el repo dice qué *debería* haber, no qué
> *hay*. Las dos preguntas se responden en fuentes distintas y yo contesté la
> segunda con la primera.

## 1. El problema

El panel `/studio/admin/feature-flags` pinta 21 interruptores idénticos. Tres
cosas están mal, y las tres se tapan entre sí.

### 1.1 El interruptor de Noticias Web nunca pudo encenderse

`marketing_news` se agregó al catálogo del **código**
(`lib/studio/feature-flags-types.ts`) sin migración que sembrara la fila. La RPC
de toggle (`0289`, rama `feature_flag.toggle`) hace **UPDATE**, no UPSERT, sobre
una fila que tiene que existir:

```sql
if v_entity_id is null then
  raise exception 'invalid_state' using errcode = 'P0002';
end if;
```

Sin fila → `invalid_state` → el toggle falla. Y como `noticias-web/page.tsx`
exige el flag encendido para dejar entrar, **el módulo quedó inalcanzable desde
la app**: no había forma de encender lo único que lo abre.

### 1.2 El error era invisible

`FeatureFlagsClient` filtra el mensaje por flag:

```tsx
{state.error && state.flagKey === flagKey && ( … )}
```

…pero el `catch` de la action devolvía `{ error }` **sin `flagKey`**. La
condición nunca se cumplía. El admin tocaba el interruptor, volvía a su lugar, y
no aparecía nada. Por eso 1.1 sobrevivió sin que nadie lo reportara: no había
qué reportar, sólo un botón que no hacía nada.

### 1.3 Un tenant nuevo nace con el panel muerto

`0042` y `0066` siembran con un bloque `DO` de **una sola pasada** sobre los
tenants que existían ese día. No hay trigger. Un tenant creado después nace con
**cero filas**: el sidebar sobrevive porque `listFeatureFlags()` cae a
`FEATURE_FLAG_DEFAULTS`, pero *todos* los toggles levantan `invalid_state`.

Para el caso de negocio que viene —**aliados white-label**, cada uno su
tenant— eso significa que el panel de configuración llega roto de fábrica.

### 1.4 Y de los 22, 17 no están conectados

Medido contra el código, no contra la intención del handoff. Los únicos
consumidores de flags en todo el repo son dos:

| Consumidor | Alcance |
|---|---|
| `StudioSidebar.tsx:454` → `isModuleEnabled()` | esconde del sidebar `seniat`, `no-olvidar`, `qrqueue`, `operarios`, `noticias-web` |
| `noticias-web/page.tsx:62` → `flags.marketing_news` | **guard de ruta** |

Todo lo demás —`whatsapp`, `comments`, `webhooks`, `sso`, `backup_auto`,
`multi_currency`…— no tiene un solo lector. Son nombres del catálogo del Norte
v1.7 para features que no se construyeron, o que se construyeron sin cablear el
flag.

Y hay un cuarto flag, `dispatch.show_warehouse_location`, que **sí** se lee de
verdad (`app/m/ve/bodeguero/page.tsx`) pero nunca estuvo en el catálogo de TS:
no aparecía en el panel y sólo se podía tocar por SQL.

> **`sidebar` no es un permiso.** Apagar `customs_seniat` esconde el link, pero
> `/studio/seniat` sigue abriendo si tipeás la URL. Es exactamente la clase de
> hueco que cerró SDD-0085 con RBAC. Un flag es una preferencia de producto,
> no un control de acceso — y el panel tiene que decirlo.

## 2. Decisión

**Sembrar, hacer visible el error, y etiquetar honestamente. No apagar nada.**

Lo que **no** se hace, a propósito:

- **No se borran las 18 keys sin consumidor.** Nombran el roadmap y el valor
  guardado sirve cuando se cableen. Borrarlas perdería la intención registrada.
- **No se agregan guards de ruta a `seniat` / `qrqueue` / `operarios`.** Sería
  un cambio de comportamiento: un módulo que hoy abre por URL dejaría de abrir.
  Eso necesita OK del founder, no entra por la puerta de un bug fix. Queda
  anotado en §6.

## 3. Alcance

| Archivo | Cambio |
|---|---|
| `app/studio/(app)/admin/feature-flags/actions.ts` | devuelve `flagKey` en el error; distingue `invalid_state` con mensaje propio |
| `lib/studio/feature-flags-types.ts` | `FEATURE_FLAG_EFFECT` + labels; agrega `dispatch.show_warehouse_location` |
| `app/studio/(app)/admin/feature-flags/_components/FeatureFlagsClient.tsx` | badge de efecto, orden por efecto, nota de cabecera |
| `app/studio/(app)/admin/feature-flags/page.tsx` | copy que no promete de más |
| `supabase/migrations/0337_feature_flags_seed_and_trigger.sql` | catálogo SQL + seed idempotente + trigger `after insert on tenants` |
| `lib/studio/__tests__/feature-flags-catalog.test.ts` | contrato: TS ↔ SQL ↔ código |
| `lib/studio/feature-flag-guard.ts` | **(§6.1)** `requireFeatureEnabled()` — el guard de ruta |
| `app/studio/(app)/{seniat,cola-qr,operarios}/layout.tsx` | **(§6.1)** los tres gates |
| `app/studio/(app)/_components/DeniedToast.tsx` | **(§6.1)** aviso propio para `?off=` |

## 4. La migración 0337

Tres piezas:

1. **`feature_flag_catalog()`** — función `immutable` con las 22 keys, sus
   defaults y descripciones. Fuente única.
2. **Seed idempotente** — `cross join` catálogo × tenants con
   `on conflict do nothing`. **No pisa ningún valor ya elegido**: un flag que el
   admin apagó a mano sigue apagado.
3. **`trg_seed_feature_flags_for_tenant`** — `after insert on public.tenants`,
   `security definer`. Cierra §1.3 para siempre.

El catálogo se duplica en SQL y en TS porque cumplen funciones distintas —el de
TS no puede sembrar filas, el de SQL no tipa el cliente. La duplicación es
deliberada y **verificada**: el contrato de §5 los compara.

## 5. Verificación

`feature-flags-catalog.test.ts` cubre las tres formas en que esto se rompió:

1. **TS ↔ SQL**: cada key de `FEATURE_FLAG_DEFAULTS` está en el catálogo de
   `0337` con el mismo default, y viceversa. *Este test es el que hubiera
   agarrado el bug de `marketing_news` el día que se introdujo.*
2. **Cobertura de metadatos**: toda key tiene `LABEL` y `EFFECT`.
3. **`EFFECT` ↔ código**: el efecto declarado se contrasta contra el código
   real. Un flag marcado `ninguno` que aparezca en `MODULE_FLAG_MAP` o en un
   guard de ruta pone el test rojo. Es lo que impide que este mapa se vuelva
   documentación decorativa.

Además: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `node scripts/verify.mjs`.

## 6. Decisiones del founder · 2026-08-02

### 6.1 ✅ `customs_seniat` y `mobile_operator` ahora **bloquean la ruta**

Aprobado. `lib/studio/feature-flag-guard.ts` → `requireFeatureEnabled(moduleId)`,
llamado en los layouts de `seniat`, `cola-qr` y `operarios`, **después** del gate
RBAC. Los dos conviven porque responden preguntas distintas:

```ts
await requireModuleView("qrqueue");     // ¿tu ROL puede verlo?
await requireFeatureEnabled("qrqueue"); // ¿esta EMPRESA lo usa?
```

Detalles que importan:

- **Redirect con `?off=`, no `?denied=`.** El motivo es distinto y el aviso
  también: "no tienes acceso" manda a pedirle permiso a un admin; "está
  desactivado" le dice al admin que puede prenderlo él mismo. `DeniedToast`
  distingue los dos.
- **Fail-open a propósito.** Si la consulta de flags falla, `listFeatureFlags`
  cae a los defaults. Un problema de base no puede dejar al equipo sin módulos —
  cerrar el acceso es trabajo de RBAC, que sí es fail-closed.
- **`seniat` no tenía `layout.tsx`**: su gate de rol vivía en `page.tsx`, que no
  envuelve a los hijos. Ahora tiene layout y cubre el subtree.
- **`vault` queda en `sidebar`.** Su módulo (`no-olvidar`, SDD-0025) es un
  `EmptyState` "Próximamente" que no toca la base: cerrarlo por ruta no
  protegería nada que no esté ya vacío.

> ✅ **Bloqueante resuelto · 2026-08-03**
>
> Al medir producción apareció el riesgo: el gate de ruta **cerraría**
> `/studio/seniat`, que estaba en `customs_seniat = false` desde el 2026-07-05
> **pero con datos reales cargados** (`customs_agents` = 4, `customs_documents`
> = 7, `customs_filings` = 1). Se llegaba por URL, porque el sidebar lo escondía.
> Desplegar así no era el cambio pedido: era una regresión.
>
> **Decisión del founder: encender `customs_seniat`.** Aplicado en producción
> (`update … set enabled = true`). El módulo vuelve al sidebar y el gate queda
> correcto e inofensivo.
>
> Estado de los cuatro flags con efecto, después de la decisión:
>
> | Flag | Valor en prod | Efecto del gate al desplegar |
> |---|---|---|
> | `customs_seniat` | **`true`** | ninguno · `/studio/seniat` abre y vuelve al sidebar |
> | `mobile_operator` | **`true`** | ninguno · `cola-qr` y `operarios` siguen abiertos |
> | `marketing_news` | **`true`** | ninguno · Noticias Web sigue abierto |
> | `vault` | `true` | sólo sidebar (sin guard de ruta, ver arriba) |
>
> **Ningún módulo se cierra al desplegar.** El gate queda armado para cuando
> alguien apague un flag a conciencia — que era el punto.
>
> *(De paso: esto corrige la memoria `mobile_operator = false oculta Cola de QR`
> — hoy está en `true` y los dos módulos se ven.)*

### 6.2 ⬜ Las 17 keys sin consumidor

Sin decisión todavía. Cablearlas es trabajo real por flag; podarlas pierde la
intención registrada. Hoy: ninguna de las dos, sólo etiquetadas honestamente.

## 7. Aplicación a producción · ✅ 2026-08-02

Aplicada con OK del founder nombrándola ("aplicar 0337"), de a una, por
[`docs/runbooks/aplicar-migraciones-prod.md`](../../runbooks/aplicar-migraciones-prod.md).
`name` en el ledger = `0337_feature_flags_seed_and_trigger` (basename exacto).

Verificado **contra el objeto**, no contra el ledger:

| Comprobación | Resultado |
|---|---|
| `feature_flag_catalog()` devuelve el catálogo | 22 llaves |
| `trg_seed_feature_flags_for_tenant` sobre `public.tenants` | existe · habilitado (`tgenabled='O'`) |
| `seed_feature_flags_for_tenant` es `security definer` | sí |
| Filas de `feature_flags` antes → después | 22 → 22 (**la siembra fue no-op**) |
| Valores elegidos a mano | intactos: `marketing_news=true`, `cn_translation=false` |
| Paso `migrations-applied` del gate | verde |

El valor real de esta migración **no fue sembrar** —los 22 flags ya estaban—
sino el **trigger**, que no existía: hasta hoy un tenant nuevo nacía con cero
filas y el panel de admin le llegaba muerto. Ver la corrección al tope.
