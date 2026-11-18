---
sdd: "0671"
title: "CRM: tarjetas sin botón Abrir y Bandeja visible para la oficina"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0585", "0622", "0647", "0648", "0655"]
confidencialidad: interno
---

# SDD-0671 — CRM: tarjetas sin botón Abrir y Bandeja visible para la oficina

> Dos pedidos de Sam sobre el tablero de Leads: (1) la tarjeta pierde el botón «Abrir» y toda ella abre la
> ficha; (2) diagnóstico de por qué una persona de la oficina abre el CRM y no ve la Bandeja, los chats ni los
> comentarios, y qué hace falta para que los vea.

**Estado:** `proposed`. La parte (1) va en esta PR. La parte (2) es un diagnóstico con decisiones de Sam
(§3.3): esta PR no cambia permisos.

## 0. El pedido de Sam, literal (transmitido por el DG el 2026-11-18)

> (1) «eso de abrir está muy grande. Elimínalo, porque ya al oprimir se abre automáticamente»
>
> (2) «Cuando está abriendo, no ve los chats y tampoco le sale la opción de bandeja… el usuario no lo está
> visualizando y tampoco ve los comentarios que están ahí. Necesito que rediseñes y también veas por qué no
> puede ver la bandeja»

No se leyeron datos de producción. La cuenta afectada no se nombra en el repo. El DG midió que esa cuenta
**no tiene rol admin efectivo**.

## 1. Tarjeta sin «Abrir» (en esta PR)

Antes (SDD-0648): nombre (abre con el ratón, fuera del Tab) + botón «Abrir ›» + menú «…».

Ahora:
- No hay botón «Abrir».
- Un clic en **cualquier parte de la tarjeta** abre la ficha, salvo el menú «…» y sus opciones.
- El nombre vuelve a ser la **parada de teclado**: botón con nombre accesible «Abrir ficha de …»; Enter o
  Espacio abren. La segunda parada es el menú.
- Se conservan el menú («Abrir ficha», «Abrir chat» si corresponde y «Mover a …»), el arrastre, el objetivo
  de 32 px del nombre (BD-037) y el descarte del clic fantasma tras soltar.
- Cursor: «grab» si se puede arrastrar; «pointer» en solo lectura.

Archivo: `app/studio/(app)/crm/_components/CrmTableroKanban.tsx`.

### 1.1 Enmienda de la regla de la tarjeta (SDD-0603 tramo 5d, BD-037)

El tramo 5d fijaba para la tarjeta del CRM: «lo que abre un registro es un botón real "Abrir <nombre>" y la
tarjeta sale del orden de Tab», con «Abrir» como `studio-btn-ghost -sm` visible y el nombre con
`tabIndex={-1}`. Esta SDD lo **enmienda solo para la tarjeta del CRM**:

- Sigue habiendo **exactamente un** botón real con nombre accesible «Abrir ficha de <nombre>». Ahora es el
  **propio nombre**, y es la **única parada de Tab** de la tarjeta antes del menú.
- **No lleva `studio-btn`.** Esa clase es la de un botón con caja; ponérsela al nombre devolvería el control
  grande que Sam pidió quitar. Lleva `studio-link-quiet` (subrayado siempre, SDD-0603), que es como el
  sistema marca un nombre que abre.
- **No vuelve un botón «Abrir» visible** (ni texto «Abrir» ni chevrón).
- Un clic en cualquier parte de la tarjeta abre la ficha, **salvo el menú «…» y sus opciones**.

Las filas de Conversaciones siguen con la regla original del tramo 5d. El contrato
`app/studio/_components/__tests__/claridad-t5d-contract.test.ts` cambia la cuenta de la tarjeta
(`fueraDeTab` de 1 a 0) y suma `formaTarjeta`, con estos mutantes: el nombre sale del Tab, vuelve un botón
«Abrir» aparte, el nombre deja de ser botón, el nombre pierde `studio-link-quiet`, el menú abre la ficha y
se quita el menú. `docs/specs/0603-claridad-controles/tramo-5d.md` lleva la nota de la enmienda.

## 2. Diagnóstico: por qué no ve la Bandeja, los chats ni los comentarios

Para ver la Bandeja y trabajar dentro de Chatwoot hacen falta **cuatro condiciones a la vez**. Si falla
cualquiera, desaparece todo lo que depende de ella.

| # | Condición | Dónde se decide | Si falla |
|---|---|---|---|
| 1 | Módulo `bandeja` por **rol**: solo `admin`, `commercial` y `support` | `lib/studio/rbac.ts:97`; admin pasa siempre (`rbac.ts:341`) | Sin pestaña Bandeja (`lib/studio/crm-acceso.ts:43`), sin «Abrir chat» en la tarjeta ni en la ficha (`CrmEmbudosSlot.tsx:67`, `TarjetaFichaDrawer.tsx:178`) y `/studio/bandeja` responde sin acceso (`bandeja/layout.tsx:19`) |
| 2 | Flag `chatwoot_inbox` de la empresa | `crm-acceso.ts:43`, `bandeja/layout.tsx:20` | Nadie la ve (tampoco admin) |
| 3 | Vínculo de la persona con un agente de Chatwoot (Usuarios › Bandeja › Agentes vinculados) | `bandeja/page.tsx:54` | La Bandeja abre en «sin agente» |
| 4 | Bandejas de Chatwoot asignadas **por rol**: `admin` → Clientes y Leads; `commercial` → Leads; `support` → Clientes; **cualquier otro rol → ninguna** | `lib/studio/chatwoot/matriz.ts:64-73` | Dentro de Chatwoot no aparecen conversaciones ni sus notas privadas («comentarios») |

Dos reglas cierran el cuadro:

- **El acceso adicional por persona (SDD-0622) no alcanza para la Bandeja.** `bandeja` está fuera de los
  módulos que se pueden conceder (`lib/studio/user-module-grants.ts:51-52`, lista `COVERED` en la línea 55),
  porque el ciclo de agentes de Chatwoot decide solo por rol y por desvío de rol, no por persona
  (`lib/studio/chatwoot/agentes-ciclo.ts:87`). En Usuarios aparece como «Aún no disponible».
- **El ciclo de agentes saca de Chatwoot a quien no tiene el módulo `bandeja` por su rol**
  (`lib/studio/chatwoot/agentes-salud.ts:64`, motivo `sin_bandeja`). Aunque alguien la haya vinculado como
  agente, el ciclo la da de baja en la siguiente pasada.

**Lo que explica el caso (inferencia del código, no medida en producción):** la persona ve Embudos, así que
tiene `kommo`. Como no es admin efectiva y no ve la pestaña Bandeja, su rol no es `commercial` ni `support`:
ve el CRM por un **acceso adicional de `kommo`** (SDD-0622). Ese acceso no puede incluir `bandeja`. Por eso:
- no le sale la pestaña Bandeja ni «Abrir chat» (condición 1);
- en Chatwoot, aunque tuviera usuario, el ciclo la saca y la matriz no le da bandejas (condiciones 3 y 4):
  no ve los chats ni los comentarios.

Lo que **sí** ve en la ficha de la tarjeta, con solo `kommo`: el estado de la conversación y quién la
atiende (RLS de `chatwoot_conversations`, `supabase/migrations/0540_comercial_rls_por_modulo.sql:291`) y las
notas de Studio. Las notas del chat («comentarios») viven en Chatwoot (`TarjetaFichaDrawer.tsx:264`).

Para confirmarlo sin leer datos: en **Usuarios**, abrir a esa persona y mirar su rol y «Lo que puede ver».
Si su rol es `commercial` o `support` y aun así no ve la pestaña, el problema es la condición 2 o 3, y hay
que medirla aparte.

## 3. Qué hace falta para que lo vea

### 3.1 Sin código (decide y hace Sam en Usuarios)

- **A. Cambiarle el rol a `commercial`.** Ve el CRM y la Bandeja de **Leads**. El ciclo de agentes la da de
  alta en Chatwoot con la bandeja y el equipo de Leads. Pierde los módulos de su rol actual que `commercial`
  no tiene, salvo que se le den como accesos adicionales.
- **B. Cambiarle el rol a `support`.** Ve la Bandeja de **Clientes** (no Embudos por rol: necesitaría el
  acceso adicional de `kommo`, que sí se puede dar) y queda de **solo lectura** en todo Studio.
- En los dos casos, un admin la vincula después en Usuarios › Bandeja › Agentes vinculados (condición 3).

### 3.2 Con código (otra SDD, carril de Chatwoot)

- **C. Desvío por rol:** sumar `bandeja` al rol actual para todo el tenant. Hoy no sirve sin código: la
  matriz (`matriz.ts:73`) no le da bandejas en Chatwoot a ese rol. Habría que decidir qué bandejas le tocan.
- **D. `bandeja` como acceso adicional por persona,** con las bandejas elegidas por persona (Leads,
  Clientes o las dos). Toca el ciclo de agentes, la matriz y la pantalla de accesos. Es lo más fino y lo más caro.

### 3.3 Decisiones de Sam (preguntas cerradas)

1. ¿Qué tiene que ver esa persona en la Bandeja: solo **Leads**, solo **Clientes** o **las dos**?
2. Con esa respuesta, ¿se le cambia el rol (A o B, sin código, hoy) o se abre la SDD de D (accesos por
   persona para la Bandeja)? Recomendación: si basta con Leads, **A** hoy; si necesita las dos, **D**.

## 4. Pruebas

`app/studio/(app)/crm/_components/CrmTableroKanban.test.tsx`:
- sin botón «Abrir»: el nombre («Abrir ficha de …») es la primera parada de Tab y la segunda es el menú;
  Enter abre una sola vez;
- un clic en el nombre abre una sola vez y conserva los 32 px;
- un clic en otra parte de la tarjeta abre; abrir el menú o elegir «Mover a …» no abre la ficha.

- `claridad-t5d-contract.test.ts`: la cuenta y la forma nuevas de la tarjeta, y los seis mutantes de §1.1.

## 5. Allowlist exacta

- `docs/specs/0671-crm-tarjeta-bandeja/spec.md` (nuevo) y `docs/specs/README.md` (índice generado).
- `app/studio/(app)/crm/_components/CrmTableroKanban.tsx`.
- `app/studio/(app)/crm/_components/CrmTableroKanban.test.tsx`.
- `app/studio/_components/__tests__/claridad-t5d-contract.test.ts` (enmienda §1.1) y
  `docs/specs/0603-claridad-controles/tramo-5d.md` (nota de la enmienda).
- `.agents/handoffs/sdd-0671-crm-tarjeta-bandeja.md`.

No cambia permisos, RLS, migraciones ni el ciclo de agentes.

## 6. Fuera de alcance

- Cambiar el rol de una persona: lo hace Sam en Usuarios.
- Las opciones C y D de §3.2: van en su propia SDD cuando Sam decida.
