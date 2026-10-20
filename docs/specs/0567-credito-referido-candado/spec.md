---
sdd: "0567"
title: "El crédito de referido no nace sin venta ni se aplica dos veces"
status: in-progress
author: "founder"
created: 2026-10-20
updated: 2026-10-20
supersedes: null
superseded_by: null
related: ["0051", "0137", "0159", "0496", "0566"]
confidencialidad: interno
---

# SDD-0567 — El crédito de referido no nace sin venta ni se aplica dos veces

> Las transiciones de `referrals` pasan a la base: un crédito de referido nace solo de una venta real o de una acreditación manual con motivo, su monto no cambia después de acreditarse, sale de «aplicado» solo por la reversión, y vuelve a espera si se anula la venta que lo acreditó.

**Estado:** diseño aprobado por el Director el 2026-10-20 (las seis preguntas, con la propuesta; ver *Decisiones*), e implementado. La migración 0494 espera el OK nominal de Sam (MIGRATE-FIRST).

## Decisiones del Director, 2026-10-20

«Revisé el diseño de la 0567 en `c1190ae3`. **Aprobado.** Las seis preguntas van con tu propuesta»:
1. la «espera» es `registrado`;
2. la acreditación manual con motivo la hace solo el admin;
3. un `aplicado` cuya venta se anula se muestra y **no** se revierte solo;
4. DEFINER, no UPDATE por columna;
5. un `acreditado` o `aplicado` no se borra;
6. `registrado` exige `referred_client_id`.

El Director se lo avisa a Sam: si quiere cambiar alguna, se corrige.

### La previa de catálogo del Director (producción, 2026-10-20, sin leer filas)

| Función | md5 vivo (CRLF→LF) | md5 sin espacios | Largo | Contra el repo |
|---|---|---|---|---|
| `accredit_referral_on_first_invoice()` | `4d3026c55e3507024cc3b44e57f0dca9` | `c808193448382b4908fd3543cbaa4fcb` | 994 | **deriva**: la última definición es la 0250 (1306 caracteres); el vivo es ese cuerpo **sin sus líneas de comentario**, y da exactamente este md5. La lógica es idéntica |
| `apply_referral_credit(uuid,uuid)` | `8c32487e62bc23c16def30cc4e3c343b` | `63b7e0eab68c60f5aa5d12796b16d66e` | 4455 | coincide con la 0471 |
| `revert_referral_credits(uuid,uuid)` | `256c1331a53ab794af184f8bb90a1ca4` | `0bc1e5497316176f03dadefb7cb9897f` | 3344 | coincide con la 0471 |

Policies vivas de `referrals`: `referrals by tenant` (`*`, `authenticated`, `(tenant_id = get_user_tenant_id())`) y `referrals service_role all`. Grants vivos: `authenticated` DELETE, INSERT, SELECT y UPDATE; `service_role` todo. **Pendiente de confirmar con el Director:** si el `qual` vivo no tiene el `and deleted_at is null` de la 0098, es otra deriva (ver *Riesgos*).

## Contexto

### El plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`)

- **B20 (b), riesgo alto:** «el crédito de USD 80 del que refiere **puede nacer sin venta, renacer después de aplicado y aplicarse dos veces**: la máquina de estados de `referrals` no tiene candado (`app/studio/(app)/fidelizacion/actions.ts:220-260`), un crédito "aplicado" puede volver a "acreditado" y abonar una segunda factura sin asiento nuevo, y la RLS "for all" deja a cualquier rol del tenant cambiar estado y monto por la API».
- **2.11:** «Candado del crédito de referido: las transiciones de `referrals` pasan a la base con un trigger guardián ("aplicado" solo sale por la reversión; "acreditado" solo nace de una venta real, por el trigger o por una RPC con motivo); el monto queda inmutable después de acreditar; se quita el UPDATE directo a `authenticated`; al anular la factura del referido, el crédito vuelve a espera si no se aplicó.» Es independiente del resto de la fase 2: toca `fidelizacion` y `referrals`.

### Decisiones de Sam del 2026-10-19 que aplican

- **Decisión 2:** «lo que ves en el sistema no es nada, simplemente eran pruebas… tenemos que abrir cuentas nuevas a todos». El mecanismo se construye sin reparación histórica, y no se borran datos de producción.
- **Decisión 1:** el mayor va en USD (USDT = USD 1:1). El crédito de referido ya es en USD.

### Radiografía de producción, en solo lectura

- **Autorización de Sam, literal**, en la sesión del Director el 2026-10-20: «autorizo la radiografía 2.11 de referidos, solo conteos».
- **Archivo:** `2.11-radiografia-referrals.sql`, sha256 `73d48a2c1d4340a2d080ad682b03bd67c1743d4d917c8a014a8f6204ee111513`. El Director lo corrió el 2026-10-20T06:20:12Z en `dtd-cargo-db-1`, con `read only` y `rollback`.
- **Validación previa del Director, sin leer filas:**
  - en el catálogo existen las 19 columnas que usa la consulta;
  - `referral_status` tiene los valores invitado, registrado, primer-embarque, acreditado y aplicado;
  - `entry_status` incluye anulado e `invoice_status` incluye anulada;
  - el `EXPLAIN (costs off)` se planificó sin errores.
- **Resultado: 0 filas en todos los chequeos, R0 incluido.** No hay ningún referido, vivo ni borrado, ni asientos `referral_credit` vivos. El candado no choca con filas existentes: los CHECK nuevos validan sin `NOT VALID` y no hay transiciones pendientes.
- **Validación local** de la misma versión, sobre el esquema completo de `main` en postgres:17 (468 migraciones):
  - una base vacía da 0 filas;
  - con un fixture limpio salen solo las 3 filas R0;
  - con uno sucio salen exactamente R0 (2 filas), R1, R2, R3c, R4, R4d y R5;
  - el control rojo, con una columna inexistente, falla.

## Lo que hay hoy

Mapa completo, con origen en `main` `be746707`.

### Quién escribe en `referrals`

| Camino | Cliente | Qué hace | Problema |
|---|---|---|---|
| `registerReferral` (`fidelizacion/actions.ts:191`) | sesión | INSERT en `invitado`, monto 0 | ninguno |
| `accreditReferral` (`actions.ts:226-232`) | sesión, editor de Fidelización (admin o commercial) | UPDATE a `acreditado` con el monto de la configuración, **filtrando solo por `id`** | acredita desde cualquier estado, también desde `invitado` (sin venta) o desde `aplicado` (renace); reescribe el monto |
| `updateReferralStatus` (`actions.ts:250-253`) | sesión | UPDATE a cualquiera de los 4 pasos (`VALID_STATUS` incluye `acreditado`) | retrocede, salta a `acreditado` sin monto, saca de `aplicado` sin limpiar `applied_*` |
| `applyReferralCredit`, enlace del asiento (`actions.ts:521-525`) | sesión | UPDATE de `applied_entry_id` | sin filtro de estado |
| `apply_referral_credit` (0471, INVOKER) | sesión, admin o accounting | `acreditado → aplicado`, con la factura `FOR UPDATE` | correcto, pero escribe con los permisos de `authenticated` |
| `revert_referral_credits` (0471, INVOKER) | sesión; la llaman `voidInvoice` y la compensación | `aplicado → acreditado` y limpia `applied_*` | correcto, mismo permiso |
| Portal: `inviteReferral` (`lib/portal/referral-invite.ts:120`) | `service_role` | INSERT en `invitado` | ninguno |
| Registro: `lib/portal/referral-link.ts:70, :118, :134` | `service_role` | `invitado → registrado` con `referred_client_id`, o INSERT en `registrado` | ninguno |
| `accredit_referral_on_first_invoice` (0250, DEFINER, disparador de `invoices`) | dueño | `registrado`/`primer-embarque` → `acreditado` en la primera factura facturable | **no guarda qué factura acreditó** |
| `merge_clients` (0361) y `rename_client_markbox` (0371), DEFINER | dueño | cambian `referrer_client_id`, `referred_client_id` y `referrer_markbox` | ninguno; no tocan el estado |

### Permisos

- `grant select, insert, update, delete on public.referrals to authenticated` (`0098:162`), con la policy `"referrals by tenant" … for all` (`0098:172-175`). Sigue vigente; ninguna migración la cambió.
- Por la API, cualquier rol del tenant puede:
  - cambiar el estado, el monto y las columnas `applied_*` de cualquier referido;
  - borrarlo, ya sea con un DELETE o fijando `deleted_at`.

### Anular la factura del referido

`void_invoice_with_audit_reason` (0294) pasa la factura a `anulada`, y el disparador de 0250 sale sin hacer nada, porque esa no es una factura facturable. **Nada devuelve el referido a espera.** Además, el sello de `accredited_at` (0238) solo escribe cuando está en null. Si alguien devolviera el referido a mano sin limpiar la fecha, la próxima acreditación conservaría la fecha vieja.

### Pruebas que fijan lo de hoy

Contratos `0098`, `0250`, `0471` y `0467` (dblink). Cargan sus propias migraciones y no la 0494, así que no chocan con esta SDD. Sí siembran estados con UPDATE directo:
- `0098…test.sql:220`;
- `0250…test.sql:165`;
- `0471…test.sql:151-192`;
- `0467…test.sql:420-445`.

Ningún test cubre `accreditReferral`, `updateReferralStatus` ni `registerReferral`.

## Diseño propuesto: migración `0494_credito_referido_candado.sql` (MIGRATE-FIRST)

### 1. Sin UPDATE ni DELETE para `authenticated`

- `revoke update, delete on public.referrals from authenticated`. Quedan SELECT e INSERT; el INSERT pasa por el guardián.
- La policy «for all» se reemplaza por una de SELECT y otra de INSERT, con el mismo predicado de tenant de hoy. Primero se compara el `using` vivo contra el nuevo.
- `service_role` conserva sus permisos, porque el portal y el registro lo usan. El guardián vale también para `service_role`.

### 2. Las dos RPC de 0471 pasan a SECURITY DEFINER

**Implementado con `alter function … security definer`, sin reescribir el cuerpo.** El cuerpo de la 0471 ya filtra cada lectura por el tenant de la sesión (`get_user_tenant_id`) y exige admin o accounting antes de tocar nada, así que no dependía de la RLS para el alcance. Su md5 vivo no cambia, y el contrato lo afirma. El texto de abajo era el diseño:


Sin el UPDATE, `apply_referral_credit` y `revert_referral_credits` dejarían de funcionar. Se reescriben **desde su última definición (0471)**, con un preflight que compara el md5 del cuerpo vigente.
- Conservan las mismas guardas: rol admin o accounting, `FOR UPDATE` y los mismos códigos de error.
- Agregan **el filtro de tenant explícito**: como DEFINER ya no las cubre la RLS.
- EXECUTE sigue solo para `authenticated`.

La alternativa era dar a `authenticated` UPDATE por columna (`status`, `applied_*`), y se descarta. Con ese grant, un UPDATE directo podría hacer una «reversión falsa» (`aplicado → acreditado`, limpiando `applied_*`) sin bajar el pagado de la factura del referidor. Es justo el camino para aplicar el crédito dos veces.

### 3. RPC nuevas para lo que hoy hace la app con UPDATE directo

Todas son SECURITY DEFINER, con `search_path` vacío, guarda de tenant y guarda de rol, y EXECUTE solo para `authenticated`:

| RPC | Reemplaza | Qué permite |
|---|---|---|
| `acreditar_referido_con_motivo(p_referral_id, p_motivo)` | `accreditReferral` | `registrado` o `primer-embarque` → `acreditado`, con el monto de la configuración, un motivo de al menos 10 caracteres y quién lo hizo |
| `avanzar_referido(p_referral_id, p_estado)` | `updateReferralStatus` | solo `invitado → registrado` y `registrado → primer-embarque`; nunca `acreditado` ni hacia atrás |
| `vincular_asiento_del_credito(p_referral_id, p_entry_id)` | el enlace de `actions.ts:521-525` | `applied_entry_id` de null a un asiento `referral_credit` vivo de ese referido y esa factura |

### 4. Columnas nuevas

Ninguna se rellena: hoy no hay filas.
- `sale_voided_at timestamptz`: cuándo se anuló o borró la venta que acreditó un crédito **ya aplicado** (pregunta 3: no se revierte solo, se muestra). La app pinta un aviso en el cajón del referido.
- `accredited_invoice_id uuid references public.invoices(id) on delete set null`: la venta que acreditó, que la escribe el disparador de 0250.
- `accredited_reason text` y `accredited_by uuid`: los de la acreditación manual.

### 5. El guardián: `referrals_candado` (BEFORE INSERT OR UPDATE, para todos los roles)

Es una propiedad de la base, no un consejo de la app.
- **INSERT:**
  - solo en `invitado` o `registrado`;
  - con monto 0;
  - sin `accredited_*` ni `applied_*`.
- **Transiciones permitidas.** Cualquier otra lanza `check_violation`, con un mensaje que dice de cuál a cuál:
  - `invitado → registrado`;
  - `registrado → primer-embarque`;
  - `registrado | primer-embarque → acreditado`;
  - `acreditado → aplicado`;
  - `aplicado → acreditado`, que es la reversión;
  - `acreditado → registrado`, que es la vuelta a espera (§6).
- **Al llegar a `acreditado`:**
  - hace falta una venta real (`accredited_invoice_id`: una factura viva y facturable del cliente referido, del mismo tenant) **o** un motivo (`accredited_reason`);
  - y un monto mayor que 0.
- **Mientras está `acreditado` o `aplicado`:** el monto, `accredited_at`, `accredited_reason` y `accredited_by` no cambian. Solo cambian al volver a espera, que los limpia. `accredited_invoice_id` cambia en un solo caso: si la factura que acreditó ya está anulada o borrada, pasa a otra factura viva y facturable del mismo cliente referido (§6).
- **`acreditado → aplicado`:** exige `applied_invoice_id` y `applied_at` en la misma escritura.
- **`aplicado → acreditado`:** exige que `applied_*` quede en null.
- **Estando `aplicado`:**
  - `applied_invoice_id` no cambia;
  - `applied_entry_id` solo pasa de null a un valor.
- **`deleted_at`:** no se puede fijar en un `acreditado` ni en un `aplicado` (pregunta 5).
- **Lo que cambia sin cambiar el estado:** `referrer_client_id`, `referred_client_id` y `referrer_markbox`. Así lo necesitan `merge_clients` y `rename_client_markbox`.
- **Al volver a `registrado`:** el guardián limpia el sello. La próxima acreditación sella una fecha nueva.

### 6. La vuelta a espera al anular la venta que acreditó

Un disparador AFTER UPDATE en `invoices` actúa cuando una factura pasa a `anulada` o se borra (`deleted_at`) y es la `accredited_invoice_id` de un referido. Según el estado del referido:
- **`acreditado`**, todavía sin aplicar:
  - si el cliente referido tiene **otra** factura viva y facturable, el crédito queda acreditado y apunta a esa;
  - si no, vuelve a `registrado`, con el monto en 0 y `accredited_*` en null. La próxima venta lo acredita de nuevo por el disparador de 0250.
- **`aplicado`:** no cambia solo (pregunta 3). Queda visible como «crédito aplicado por una venta anulada».
- **Acreditado a mano**, sin `accredited_invoice_id`: no le aplica.

### 7. El disparador de 0250

Se reescribe `accredit_referral_on_first_invoice` desde la 0250, con el preflight del md5, para que escriba `accredited_invoice_id = new.id`. Lo demás no cambia.

### 8. La radiografía queda versionada

`scripts/qa/radiografia-referidos.sql` es la consulta de hoy. Lleva su prueba de forma sobre el esquema completo, en `schema-rebuild`, como la radiografía de integridad. También lleva el fixture limpio y el sucio como prueba, para repetirla después de aplicar la 0494.

## Lo que se agregó al implementar

- **Si se revierte un aplicado cuya venta ya se anuló,** ya no está aplicado y vale la regla de la venta anulada. Pasa a otra venta viva del referido o vuelve a `registrado`, y no queda acreditado sin una venta real. El guardián lo resuelve en la misma escritura de `revert_referral_credits`, sin tocar su cuerpo.
- **El cliente se exige al entrar en `registrado`, no al quedarse ahí.** Borrar el cliente pone `referred_client_id` en null (`on delete set null`), y eso no tiene que trabar el borrado.
- **El guardián es SECURITY DEFINER,** igual que el disparador de la 0250. Sus ayudantes no tienen EXECUTE para la API, y así responden igual para cualquier rol.
- **La marca de un paso manual a `registrado`** se hace con el markbox del cliente, que el cajón pide.
- **Los mensajes propios llevan `hint = 'dtd-referidos'`,** y la app muestra solo esos (ERR-01), como el `dtd-cierre` de la 0566.
- **Sin la 0494, la lista no se rompe:** si la base no tiene las columnas nuevas, la consulta responde 42703 y se vuelve a leer sin ellas.

## Riesgos

- **Aceptado:** el guardián permite `aplicado → acreditado` con el rastro limpio, porque es la reversión. Una reversión falsa, que no baja el pagado de la factura, ya **no** se puede hacer por la API, porque `authenticated` no tiene UPDATE (lo prueba el contrato). La podría hacer código con `service_role`, y hoy ninguno lo hace. Cerrarla del todo exige reescribir el cuerpo de `revert_referral_credits` para que deje un permiso, y eso cambia su md5. Queda para el Director.
- **Por confirmar:** la policy de SELECT nueva lleva `deleted_at is null`, como la 0098. Si en producción la policy viva no lo tiene, desde la 0494 los referidos borrados dejarían de verse por la API. La radiografía midió 0 referidos.

## App

- `accreditReferral(id, motivo)` llama a la RPC. El cajón del referido pide el motivo y dice que la acreditación manual queda registrada.
- `updateReferralStatus` llama a `avanzar_referido`. El cajón ya ofrece solo el paso siguiente.
- `applyReferralCredit` enlaza el asiento con `vincular_asiento_del_credito`.
- El portal y el registro (`service_role`) no cambian. Sus transiciones ya caben en el guardián.
- Sin la 0494 aplicada, las RPC nuevas no existen. Cada acción devuelve su mensaje de siempre y la app no se rompe. Los símbolos se declaran en `supabase/pending-migration-symbol-declarations.json`.

## Pruebas previstas

- Contrato `supabase/tests/0494_credito_referido_candado.test.sql`. Cubre:
  - cada transición permitida y cada transición prohibida, también con `service_role`;
  - el monto inmutable;
  - la venta real o el motivo;
  - la vuelta a espera, con y sin otra venta;
  - el `aplicado` con su venta anulada;
  - que `authenticated` no puede hacer UPDATE ni DELETE;
  - el tenant de las RPC DEFINER;
  - el preflight;
  - **el camino del crédito aplicado dos veces, que tiene que fallar.**
- El mismo contrato en PGlite, con control rojo y un mutante por regla.
- La carrera de 0467 (dblink) contra la versión DEFINER, para confirmar que el `FOR UPDATE` sigue cubriendo las mismas ventanas.
- Acciones de Fidelización: el motivo, los mensajes y lo que pasa sin la 0494.

## Preguntas para el Director (respondidas el 2026-10-20: ver *Decisiones*)

1. **«Espera» es `registrado`**, con el monto en 0 y `accredited_*` en null, ¿o se vuelve al estado anterior, que puede ser `primer-embarque`? Propongo `registrado`: no hay columna que guarde el estado anterior, y `primer-embarque` hoy solo se marca a mano.
2. **La acreditación manual con motivo, ¿quién la hace?** Hoy son los editores de Fidelización (admin y commercial). Propongo solo admin, porque crea un crédito en dinero sin venta. ¿O admin y accounting?
3. **Un crédito `aplicado` cuya venta se anula:** ¿se deja como está y se muestra para que lo resuelva la contadora, o se revierte solo? Revertirlo baja el pagado de la factura del referidor, que puede estar cerrada o cobrada. Propongo dejarlo y mostrarlo.
4. **Apply y revert a DEFINER, reescritas desde la 0471, con preflight.** Propongo esto, en vez del UPDATE por columna. Necesito que la previa mida el md5 vivo de las dos funciones y de `accredit_referral_on_first_invoice`.
5. **Borrar un referido** (`deleted_at`): hoy nadie lo hace, pero la API lo permite. Propongo que no se pueda en `acreditado` ni en `aplicado`, sin RPC de borrado por ahora.
6. **`registrado` sin `referred_client_id`:** el avance manual del Studio, de `invitado` a `registrado`, no fija el cliente, y sin cliente el disparador nunca acredita. ¿El guardián exige el cliente para entrar en `registrado`? Propongo que sí: `avanzar_referido` pediría elegir el cliente.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0494_credito_referido_candado.sql` | la migración |
| `supabase/tests/0494_credito_referido_candado.test.sql` | el contrato |
| `lib/studio/__tests__/credito-referido-candado.migration.test.ts` | el contrato en PGlite: control rojo, 24 mutantes, la deriva de la 0250, el preflight, la reaplicación y la espera |
| `supabase/migrations-baseline.json` | la espera de la 0494 |
| `supabase/pending-migration-symbol-declarations.json` | los 5 símbolos y su degradación |
| `app/studio/(app)/fidelizacion/actions.ts` | acreditar, avanzar y enlazar el asiento por las RPC; `errorDeReferido` |
| `app/studio/(app)/fidelizacion/page.tsx` | `canAccreditManually` (solo admin) |
| `app/studio/(app)/fidelizacion/_components/FidelizacionClient.tsx` | pasa `canAccreditManually` |
| `app/studio/(app)/fidelizacion/_components/ReferralDrawer.tsx` | el markbox para registrado, el motivo para acreditar sin venta, el aviso de la venta anulada |
| `lib/studio/fidelizacion/types.ts` | `accredited_reason` y `sale_voided_at` en `Referral` |
| `lib/studio/fidelizacion/queries.ts` | las columnas de la 0494, con la lectura de respaldo |
| `app/studio/(app)/fidelizacion/__tests__/apply-referral-credit.test.ts` | el enlace del asiento por la RPC |
| `app/studio/(app)/fidelizacion/__tests__/referido-candado-acciones.test.ts` | nueva: acreditar y avanzar |
| `scripts/qa/radiografia-referidos.sql` | la radiografía versionada |
| `scripts/qa/radiografia-referidos.fixture.sql` | su fixture para PGlite |
| `scripts/__tests__/radiografia-referidos.test.ts` | su prueba, con control rojo |
| `scripts/check-schema-rebuild.mjs` | la radiografía de referidos sobre el esquema completo |
| `docs/specs/0567-credito-referido-candado/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0567-credito-referido-candado.md` | handoff |

## Criterios de aceptación

1. `authenticated` no tiene UPDATE ni DELETE sobre `referrals`. La «reversión falsa» por la API se rechaza.
2. Un crédito nace solo de una venta real del cliente referido (el disparador de la 0250, que guarda la factura) o de `acreditar_referido_con_motivo`: solo el admin, con un motivo de 10 a 1000 caracteres, y queda quién.
3. Las transiciones fuera de la lista se rechazan para todos los roles. Un referido nace invitado o registrado, sin monto. `registrado` exige el cliente.
4. El monto, la fecha, el motivo y el autor de una acreditación no cambian. La venta que acreditó cambia solo si ya no es real.
5. `aplicado` entra con su factura y su fecha, y sale solo con el rastro limpio. Su factura no cambia, y el asiento se enlaza una sola vez, y solo el del crédito.
6. Anulada o borrada la venta que acreditó: sin aplicar, pasa a otra venta viva o vuelve a `registrado` limpio; aplicado, queda marcado y no se revierte solo. Revertido después, no queda acreditado sin venta.
7. Un `acreditado` o `aplicado` no se borra, ni con DELETE ni con `deleted_at`.
8. El preflight acepta el cuerpo del repo y el vivo del trigger de la 0250, y ningún otro; aplicada dos veces, aborta con «ya existe».
9. La app usa las RPC, muestra solo los mensajes con `hint = 'dtd-referidos'` y, sin la 0494, no se rompe.
10. La radiografía queda versionada, con su prueba (vacía, limpia y sucia, más el control rojo) y su corrida en `schema-rebuild`.
11. Control rojo: cada regla tiene un mutante que muere.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec, con allowlist exacta |
| AUD-01 | cumplimiento parcial | la acreditación manual guarda el motivo y el autor en la fila, y no cambian (guardián). `referrals` todavía no entra en `entity_audit_log`: queda en FUERA DE ALCANCE del handoff |
| ERR-01 | cumplimiento | la app muestra solo los mensajes con `hint = 'dtd-referidos'`; un 42501 nativo o un error de la base no (pruebas de las acciones) |
| FRM-01, A11Y-01 | cumplimiento | el markbox y el motivo con `<label>`; la ayuda del motivo con `aria-describedby`; el aviso de la venta anulada con `role="status"` |
| Producción | cumplimiento | la radiografía corrió con la autorización literal de Sam, solo conteos; la 0494 se aplica con su OK nominal y el runbook |
| Datos personales | no aplica | no se leen ni se mueven nombres, correos ni teléfonos del referido |

## Validación

Ver el handoff `.agents/handoffs/0567-credito-referido-candado.md`.
