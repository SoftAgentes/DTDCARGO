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

## 6. Pendiente de decisión del founder

1. **¿`customs_seniat` y `mobile_operator` deben bloquear la ruta?** Hoy sólo
   esconden el link. Convertirlos en guard real es un cambio de comportamiento.
2. **¿Se podan las 18 keys sin consumidor, o se cablean?** Cablearlas es trabajo
   real por flag; podarlas pierde la intención registrada. Hoy: ninguna de las
   dos, sólo etiquetadas.

## 7. Aplicación a producción

La migración **no se aplica** en este trabajo. Queda como archivo en la rama.
Aplicarla exige OK del founder nombrándola, de a una, por
[`docs/runbooks/aplicar-migraciones-prod.md`](../../runbooks/aplicar-migraciones-prod.md).

Al aplicarla, el efecto visible inmediato es que **el interruptor de Noticias
Web empieza a funcionar** (queda en OFF; encenderlo es otra decisión, y §1 del
default advierte que depende de que las migraciones de noticias estén en prod).
