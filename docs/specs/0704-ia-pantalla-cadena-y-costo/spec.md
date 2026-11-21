---
sdd: "0704"
title: "IA: pantalla con cadena de tres modelos por función, cambio automático y costo configurable"
status: proposed
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-21
updated: 2026-11-21
supersedes: null
superseded_by: null
related: ["0626", "0638", "0639", "0700", "0702", "0703"]
confidencialidad: interno
---

# SDD-0704 — Pantalla «IA»: cadena de tres, cambio automático y costo

> Pedido de Sam (2026-11-21), con sus palabras:
>
> - «Tiene que haber alguna función o algo que pongamos en configuraciones... donde yo pueda cambiar el modelo
>   aquí. ¿Por qué tengo que escribirlo en el chat?»
> - «Un script donde si un modelo arroja error, me lo cambie automáticamente al siguiente y tener tres opciones: si
>   el segundo vuelve a fallar me lleva al tercero, pero que haga la tarea.»
> - «¿El contador de gasto lo podemos configurar en estas mismas pantallas?»
> - Sobre el consumo: tiene planes de membresía que no cobran por token, y pregunta cómo los identifica y los suma
>   el sistema.
>
> Sam aprobó «arranca la construcción de la pantalla IA con tres niveles».
>
> **Estado: propuesta, solo spec (v6).** Sam decidió las seis decisiones (D-1 a D-6) el 2026-11-21 (§12).
> Esta spec **amplía** la SDD-0639, no la reemplaza: lo que la 0639 llama «principal y respaldo» pasa a ser una
> **cadena de hasta tres puestos**, y se suma el **costo** en la misma pantalla. No toca código, ni la base, ni
> producción, ni el `.env`. El repo es público: sin llaves, montos reales, IP ni datos de clientes. Las tarifas, los
> topes y los nombres de modelo de los bocetos son de ejemplo.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia · **NV** no verificado. Base:
`origin/main` `05c356a74` (ya trae la 0702). La 0703 aún no está en `main`: se leyó en su rama
(`origin/claude/sdd-0703-openai-respaldo-741f7a`, PR #757) y se cita como **D**.

**Frontera con la Oficina:** la 0704 diseña y el ERP guarda la cadena; cualquier cambio en el VPS de Hermes lo ejecuta
Ofi_Hermes.

## 1. Qué existe hoy

| Hecho | Ev. |
|---|---|
| El motor común de la 0639 (`lib/studio/ia/`, catálogo, `ia_motores`, llaves en Vault) **no existe**: el directorio no está | C (directorio ausente) · D 0639 §5 |
| **La 0638 tampoco está implementada:** no existen el clasificador (`clasificar-error.ts`, §5.1), el registro `ia_eventos` (§5.3) ni el aviso deduplicado (§5.5) | C (directorio ausente) · D 0638 §7 |
| La 0639 fija **un principal y un respaldo**, y dice expresamente «No es una cadena larga» | D `docs/specs/0639-ia-cambio-de-proveedor/spec.md:72-82` |
| La 0703 repite «una sola vez … No hay cadena larga ni un tercer proveedor» para A3-A5 | D 0703 §7 |
| Hoy A1 noticias y A2 brief tienen el modelo fijo en el código; A3, A4 y A5 lo leen de una variable | D 0639 §1 · D 0638 §2.1 |
| La Oficina **no elige el modelo desde el ERP**: el cable llama a Hermes con `model: "soporte-chatwoot"` (el alias del perfil) y Hermes decide | C `lib/studio/oficina/runtime-cliente.ts:54-69` |
| El ERP solo ve el status del runtime (`http_<status>`, `red`, `json`), no el error del proveedor de fondo | C `runtime-cliente.ts:73-82` · D 0638 §5.4 |
| Hoy un error del runtime **escala la conversación al momento** (`runtime:<código>`): no hay segundo intento con otro modelo desde el ERP | C `lib/studio/oficina/despachador.ts:216-218` |
| El respaldo del perfil se configura con `fallback_model`, que se quitó el 2026-11-16. Cuántos respaldos admite Hermes (uno o una lista) es **NV** | D `docs/runbooks/oficina-cable.md:330` |
| Hermes v0.23.1 no devuelve el modelo real en `/v1/chat/completions`; la 0702 (ya en `main`) lo lee de la sesión antes de borrarla y lo deja en `task_events.modelo_usado` | D `docs/specs/0702-oficina-modelo-real/spec.md` §1-§2 · C `despachador.ts:212-214`, `:242` |
| Estado del 2026-11-21: `soporte-chatwoot` en `claude-sonnet-5-5`, con `claude-haiku-5-5` de respaldo; Z.AI y DeepSeek fuera del perfil | D informe de Ofi_Hermes al DG (citado en 0703 §5.2 y en el encargo). **NV** desde el repo |
| Tope y tarifa de la Oficina son variables de entorno: `OFICINA_TOPE_MENSUAL_USD`, `OFICINA_PRECIO_ENTRADA_USD_MTOK`, `OFICINA_PRECIO_SALIDA_USD_MTOK`, con valores por defecto en el código | C `lib/studio/oficina/despachador-config.ts:14-21`, `:101`, `:109-112` |
| **Techo en el código:** `TOPE_MENSUAL_MAXIMO_USD = 15`; un tope mayor vale 15 (D5 de la 0626) | C `despachador-config.ts:33`, `:101` |
| La tarifa de la Oficina es **una sola, global**, no por modelo | C `despachador-config.ts:120-123`, `despachador.ts:241` |
| El 2026-11-21 se corrigieron a mano en el `.env` de producción la tarifa y el tope de la Oficina (valores fuera del repo) | D encargo de Dir_DTD |
| El gasto del mes es la suma de `task_events.costo_usd` del mes en UTC; la auto-pausa al 80 % **solo pausa** | C `supabase/migrations/0548_oficina_despachador.sql:411-420`, `:422-451` |
| `task_events` guarda `costo_usd` y `modelo_usado`, **no** los tokens (van solo en el texto del `resumen`) | C `supabase/migrations/0541_oficina_cable_tablas.sql:165-174` · C `despachador.ts:240` |
| Por corrida de la Oficina: como mucho 2 llamadas (la llamada y un reintento) y 24 000 tokens | C `despachador-config.ts:104-105` |
| Un módulo de `SUPERADMIN_ONLY_MODULES` no se puede conceder por persona: el guard exige `is_platform_admin()` | C `lib/studio/rbac-guard.ts:170-174` |
| Llaves en Vault: el patrón de Kommo guarda solo el nombre del secreto | C `supabase/migrations/0082_kommo_mirror_schema.sql:9`, `:18` |
| Administración tiene el grupo PRO con «Agentes y Skills» y «Actualizaciones de Chatwoot». La revisión de la Oficina vive en su propia ruta (`/studio/admin/oficina-virtual`), fuera de esa lista | C `app/studio/(app)/admin/page.tsx:355-362` · C `app/studio/(app)/admin/oficina-virtual/page.tsx` |

**Consecuencia:** el costo (incluida la Oficina) se puede llevar a la pantalla ya, porque no depende del motor. La
cadena de A1 y A2 se puede hacer con modelos de un solo proveedor, sin el motor (nivel 1 de la 0639). La cadena de la
Oficina depende de lo que mida y configure Ofi_Hermes (§6).

## 2. La pantalla «IA»

### 2.1 Dónde va

Ruta `/studio/admin/ia`, tarjeta **«IA»** en Administración › PRO, junto a Agentes. Es la misma pantalla que la 0638
llama «Estado de la IA» y la 0639 usa para elegir proveedor: **una sola pantalla**, no tres. La 0638 dejó abierta su
D-1; aquí Sam decidió la tarjeta (§12, D-1).

### 2.2 Cuatro pestañas

| Pestaña | Qué hace | Fase |
|---|---|---|
| **Funciones** | Por cada función, la cadena 1.º, 2.º y 3.º, con el estado de cada puesto y el último salto | 1 (A1, A2), 1b (Oficina), 3 (resto) |
| **Gasto** | Gasto del mes por función y por modelo, tope y auto-pausa, Oficina incluida | 1 |
| **Cuentas y tarifas** | Cada cuenta con su tipo de cobro, y cada modelo con su tarifa | 1 (tarifas), 2 (llaves) |
| **Estado** | Lo de la 0638 §4: llave presente, sondeo, última generación, último error, renovación | 0638 fase 4 |

Las funciones son el catálogo de la 0639 §3 y la 0638 §2.1 (A1 noticias, A2 brief, A3 actas, A4a y A4b resúmenes,
A5 documentos, A8 análisis de Chatwoot) **más la Oficina** (`soporte-chatwoot`). A6 Agentes se lista **solo para ver**:
sigue fuera, en Anthropic (0639 D-5). A7 (Whisper de Cloudflare) también, porque no tiene alternativa en el catálogo
(**I**).

### 2.3 Boceto: pestaña «Funciones» (para que Dir_DTD lo dibuje)

```
 IA                                              [Funciones] Gasto  Cuentas y tarifas  Estado
 ────────────────────────────────────────────────────────────────────────────────────────────
 Oficina_Virtual · soporte-chatwoot                 Con datos de clientes · solo no chinos
   1.º  [ modelo-a · Anthropic               ▾ ]   ● Respondió hace 2 h
   2.º  [ modelo-b · Anthropic               ▾ ]   ○ Sin uso este mes
   3.º  [ — vacío —                          ▾ ]
   ⓘ Guardada en el ERP. La Oficina la obedece cuando Ofi_Hermes la conecte (fase 1b).
   Último salto: ninguno este mes                               [ Guardar cambios ]
 ────────────────────────────────────────────────────────────────────────────────────────────
 A1 · Noticias web                                  Sin datos de clientes · todos
   1.º  [ modelo-a ▾ ]   2.º [ modelo-b ▾ ]   3.º [ — ▾ ]
 ────────────────────────────────────────────────────────────────────────────────────────────
 A6 · Agentes y Skills                              Solo lectura · fuera de esta spec (D-5)
```

- La marca de datos va arriba a la derecha de cada función, en texto, y explica por qué faltan opciones.
- «Guardar cambios» abre una confirmación con el antes y el después y pide un **motivo** (1-200 caracteres, sin datos
  personales; el mismo filtro que ya usa la revisión de la Oficina).
- Estados con icono y texto, nunca solo color (`BRAND.md` §Estados y mensajes): «Respondió» en éxito, «Saltado por
  error» en atención (dorado), «Llave inválida» o «Sin saldo» en error. La acción principal en azul de acción
  (BD-076). Densidad compacta del Studio. La UI pasa por `/ui-check`.
- Un puesto vacío es válido: la cadena puede tener 1, 2 o 3 puestos. No se puede dejar vacío el 1.º.
- No se puede repetir el mismo modelo en dos puestos.

## 3. La cadena de hasta tres

### 3.1 Qué cambia respecto a la 0639

| 0639 | 0704 |
|---|---|
| `ia_motores` (tenant, función, principal, respaldo) | `ia_cadenas` (tenant, función, **puesto 1-3**, **proveedor**, cuenta, modelo). Puesto 1 = el principal de la 0639; puesto 2 = su respaldo |
| «Un principal y un respaldo, no una cadena larga» (0639 §3.4) | Hasta **tres** puestos, por pedido de Sam. Sigue sin ser una cadena larga: el techo es 3 y está en el código |
| 0703 §7 (A3-A5): «una sola vez, sin tercer proveedor» | Se reemplaza por esta regla al aprobarse la 0704. La regla D-2 de la 0703 (nunca un chino) se mantiene |

Todo lo demás de la 0639 sigue igual: catálogo aprobado en código, habilitación por prueba, llaves en Vault, permisos.

### 3.2 El catálogo: en código y en la base

- **En código**, `lib/studio/ia/catalogo.ts` (el de la 0638 §4.2 y la 0639 §3.2) gana:
  - por **proveedor**: `origen: "chino" | "no_chino"` (Z.AI/GLM y DeepSeek son `chino`; Anthropic y OpenAI,
    `no_chino`);
  - por **función**: su marca de datos de la 0639 §4 (`sin_datos`, `solo_shipping_mark`, `con_datos`) y los modelos
    **habilitados** (los que pasaron su prueba de contrato). La Oficina entra con marca `con_datos` (0703 §4, **I**:
    los datos llegan tapados por la 0700, pero el texto sigue siendo la conversación de un cliente).
- **En la base**, una tabla `ia_catalogo_modelos` (proveedor, modelo, origen) sembrada por la migración. Así la base
  puede limitar lo que se guarda (§5) sin leer el código. Una prueba compara la siembra con el catálogo en código.
- **Sumar un modelo al catálogo es una migración**: una PR con los dos cambios, y aplicarla en producción pide el **OK
  nominal de Sam** (§9). Lo que se cambia sin el chat, desde la pantalla, es la **cadena entre los modelos que ya
  están en el catálogo**, sus tarifas y los topes. Un modelo nuevo de un proveedor no aparece en la lista hasta que
  su migración esté aplicada.

## 4. El cambio automático

### 4.1 Cuándo salta al siguiente puesto

Se usa el clasificador de la 0638 §5.1. La llamada **pasa al siguiente puesto** ante:

| Clase | ¿Salta? | Por qué |
|---|---|---|
| `proveedor_caido` (5xx, 529, tiempo agotado, conexión) | **Sí** | Es el caso que pidió Sam |
| `falta_de_pago`, `cuenta_suspendida`, `llave_invalida` | **Sí** | Ya saltaban en la 0639 §3.4; el siguiente puesto suele ser otra cuenta |
| `limite_de_uso` (429 sin señal de cobro) | **No** | Se reintenta solo donde la función ya reintenta (0639, 0703) |
| `otro`, un 400 de entrada inválida | **No** | Otro modelo recibiría la misma entrada mala |
| La respuesta no valida su esquema, o el eval de la Oficina la rechaza | **No** | Es un fallo de la función, no del proveedor (0703 §3.2). La Oficina conserva su reintento por acuse |

Si el último puesto también falla con una clase que salta, la función **falla con la clase del último error** y sigue
su salida manual de siempre (la Oficina escala a una persona; noticias se escriben a mano; el brief sale con solo
números). Nunca se sale del catálogo de la función ni cae a un proveedor chino en una función `con_datos`.

### 4.2 La Oficina: un error de Hermes que esconde un 400

El ERP no ve el error del proveedor: solo `http_<status>` del runtime (C `runtime-cliente.ts:77`). Un `http_500` de
Hermes puede venir de un 400 del proveedor (entrada inválida), y con un 400 **no se debe saltar**. Regla, mientras
Hermes no pase la causa:

| Lo que ve el ERP | Clase para el salto |
|---|---|
| `red` (sin respuesta), tiempo agotado, `http_502`, `http_503`, `http_504` | `proveedor_caido` → **salta** |
| `http_500` y cualquier otro `http_5xx` | `otro` → **no salta**, escala como hoy |
| `http_4xx` del runtime | `otro` → **no salta** |
| `json` (respuesta ilegible) | Fallo de la función → **no salta** |

Cuando Ofi_Hermes haga que el runtime devuelva el status y el código del proveedor de fondo (0638 §5.4), el ERP
clasifica ese dato con el clasificador normal y la tabla de arriba queda solo para cuando falte. Que Hermes devuelva
502, 503 o 504 cuando el proveedor se cae es **NV**: lo mide Ofi_Hermes en la fase 1b (§6.3). Si Hermes contesta 500 a
todo, la Oficina **no salta** hasta tener la causa.

### 4.3 Que haga la tarea sin pasarse de sus límites

- Un salto **no** gasta el reintento propio de la función.
- **Oficina:** hoy son 2 llamadas por corrida (C `despachador-config.ts:104`); pasa a **2 por formato + hasta 2 por
  salto**, con un techo duro de **4** en el código. Los 24 000 tokens y los 200 s de la corrida (C
  `despachador-config.ts:40`, `:105`) valen para **toda** la cadena. Si quedan menos de 30 s (**I**), escala en vez de
  saltar. Una llamada abortada por pausa no salta: se aborta todo, como hoy (AC-3).
- **Funciones del ERP:** sus límites actuales (por ejemplo, los trabajos por día y el presupuesto diario de tokens de
  A5, D 0638 §2.1) valen para la cadena entera. Techo duro de 3 llamadas por tarea por saltos.

### 4.4 Cada salto queda registrado y avisa

**Con la 0638 implementada:**

- **Registro:** en `ia_eventos` (0638 §5.3) una fila por intento: función, puesto, proveedor, modelo, resultado (`ok`
  o la clase), status, código, tokens y costo. Sin texto. En la Oficina, además, un `task_events` de tipo
  `modelo.salto` con el puesto de origen y de destino.
- **Aviso:** con el aviso de la 0638 §5.5, deduplicado en la base según la D-6 (§12).
- **Pantalla:** «Último salto» por función, con la fecha, el puesto y la clase.

**Mientras la 0638 no exista** (dependencias explícitas por fase en §11):

- **Clasificador:** es requisito de la fase 1 (0638 fase 1: módulo puro, sin base). Sin él no hay salto automático.
- **Registro:** la fase 1 crea `ia_eventos` con los campos de la 0638 §5.3 más los de arriba, para no tener dos
  registros. La Oficina sigue escribiendo en `task_events`.
- **Aviso:** **no sale aviso fuera del Studio** (ni Discord, ni Telegram, ni correo), porque el canal es la D-3 de la
  0638, todavía abierta. El salto se ve solo en la pantalla («Último salto») y en un contador de saltos del día en la
  tarjeta «IA» de Administración. El aviso externo entra con la 0638 fase 5.

### 4.5 Cuándo vuelve al 1.º

Decidido por Sam (§12, D-2): **cada llamada nueva empieza por el 1.º**. A partir de la fase 2, cuando los puestos puedan
ser de cuentas distintas, se suma un cortacircuito corto:

- si el 1.º falló con `falta_de_pago`, `cuenta_suspendida` o `llave_invalida`, queda **abierto**: las llamadas lo
  saltan hasta que un sondeo («Probar ahora» o el automático cada 15 min) o una generación real lo cierre;
- si el 1.º falló con `proveedor_caido` **3 veces seguidas**, queda abierto **5 min**; después se prueba de nuevo;
- el estado vive en la base (`ia_cortacircuitos`), no en memoria.

En la fase 1 no hace falta: los puestos de A1 y A2 son de la misma cuenta, así que un error de pago los tumba a todos
por igual.

## 5. La regla D-2 dentro de la pantalla

Tres capas en el ERP, para que ninguna sola alcance, más una en la Oficina:

1. **Lista:** en una función `con_datos`, el selector **no muestra** modelos de proveedores `chino`. El texto de la
   marca explica por qué.
2. **Servidor:** la acción que guarda la cadena vuelve a validar contra el catálogo. Si llega un modelo chino para
   una función `con_datos` (por ejemplo, desde un formulario manipulado), responde `no_permitido` y no guarda nada.
3. **Base:**
   - `ia_cadenas.proveedor` es una columna con un CHECK de **lista cerrada** (`anthropic`, `openai`, `zai`,
     `deepseek`; se amplía por migración);
   - `(proveedor, modelo)` de `ia_cadenas` y de `ia_modelos` tiene una llave foránea a `ia_catalogo_modelos`: no se
     guarda un modelo fuera del catálogo;
   - `ia_cuentas.proveedor` usa la misma lista cerrada, y un trigger exige que el proveedor del puesto sea el de su
     cuenta;
   - un trigger copia `datos_clientes` desde la lista de funciones `con_datos` fija en la migración (quien escribe no
     la elige), y un CHECK impide `datos_clientes = true` con `proveedor in ('zai', 'deepseek')`. Vale para los
     **tres puestos**, también con la clave de servicio.
4. **Oficina:** la ejecuta Hermes. Ofi_Hermes configura en Hermes solo modelos no chinos para los puestos de la
   Oficina (§6.3), y el runbook de la Oficina pide comprobarlo antes de la etapa 2 (0703 §5.4).

Las pruebas que fallan si el catálogo lo permite están en §10.

## 6. La Oficina: cómo gobierna la pantalla la cadena de Hermes

### 6.1 Tres caminos

| Camino | Cómo funciona | A favor | En contra |
|---|---|---|---|
| **A · El ERP pide el modelo en cada llamada** (decidido, D-3) | El despachador lee la cadena de `ia_cadenas`, llama a Hermes pidiendo el **puesto 1**, y si el runtime falla con una clase que salta (§4.2), vuelve a llamar pidiendo el **puesto 2**, y luego el 3. Hermes deja de tener respaldo propio | Una sola cadena y una sola regla (§4) para todo el ERP; el ERP sabe qué modelo pidió, así que la tarifa por modelo sale exacta; el cambio vale en la llamada siguiente, sin reiniciar nada | Que Hermes acepte el modelo por llamada es **NV**; la clase es gruesa mientras Hermes no pase la causa (§4.2) |
| **B · Sincronizar hacia Hermes** | El ERP expone la cadena en un endpoint de solo lectura con el token del cable; un proceso en el VPS, que monta Ofi_Hermes, la lee cada pocos minutos y reescribe el modelo y el respaldo del perfil | El ERP no cambia su forma de llamar | Si Hermes admite un solo respaldo (**NV**), el 3.º puesto no cabe; hay que reiniciar el gateway; dos fuentes de verdad durante la sincronización; la tarifa depende de la 0702 |
| **C · Dejarlo en Hermes y solo mostrarlo** | La pantalla muestra la cadena como dato, sin editarla | Cero trabajo en el VPS | No cumple lo que pidió Sam |

**Decidido por Sam: A** (§12, D-3). Si la fase 1b demuestra que Hermes no acepta el modelo por llamada, se pasa a **B**,
con dos puestos si Hermes admite un solo respaldo, y la pantalla lo dice («El 3.º puesto no se aplica en la Oficina»).

### 6.2 Cómo se pide el modelo en el camino A (NV)

La 0702 leyó en Hermes v0.23.1 que existe una «ruta pedida» que Hermes registra en la sesión (D 0702 §1). Que
`/v1/chat/completions` la acepte desde el cuerpo o un encabezado **no está verificado**. Opciones, en orden de
preferencia:

1. un alias de modelo por puesto en Hermes (por ejemplo, `soporte-chatwoot-1`, `-2`, `-3`), cada uno con su modelo y
   **sin** respaldo propio; el ERP pide el alias. La lista de modelos permitidos queda en Hermes (4.ª capa de la D-2);
2. el campo `model` con el id real, si Hermes lo honra y lo limita a una lista.

En los dos casos el ERP **nunca** pide un modelo que no esté en `ia_cadenas`, y Hermes **nunca** sirve un modelo que
no esté en su lista.

### 6.3 Qué ejecuta Ofi_Hermes (en el VPS, fuera de este repo)

- Medir si Hermes v0.23.x acepta un modelo o alias por llamada en `/v1/chat/completions` (§6.2).
- Medir qué status devuelve el runtime cuando el proveedor se cae y cuando rechaza la entrada (§4.2).
- Crear los alias por puesto (o la lista permitida), **sin chinos**, y quitar el respaldo propio del perfil, para que
  no haya dos cadenas a la vez.
- Que el runtime devuelva al menos el status y el código del proveedor de fondo (0638 §5.4, D-5 de la 0638).
- Mantener las llaves de la Oficina en el gestor de secretos del VPS. La pantalla del ERP **no** guarda esas llaves:
  solo nombra la cuenta y su tipo de cobro.
- Dejar evidencia en el runbook de la Oficina, con texto inventado y el 1.º caído a propósito.

Hasta que Ofi_Hermes termine, la cadena de la Oficina en la pantalla dice **«Guardada en el ERP. La Oficina la
obedece cuando Ofi_Hermes la conecte»**, para que nadie crea que ya manda.

## 7. El costo en la misma pantalla

### 7.1 Cuentas y tipo de cobro

El sistema **no adivina** si una cuenta cobra por token o por membresía: ningún proveedor lo dice en la respuesta de
una llamada (**I**; **NV** por proveedor). Lo declara Sam una vez por cuenta, en «Cuentas y tarifas».

Tabla `ia_cuentas` (por tenant): alias (no el correo), proveedor (lista cerrada, §5), entorno, **tipo de cobro**, uso
(`erp` u `oficina`) y, en la fase 2, el nombre del secreto en Vault (0639 D-7; solo para las cuentas `erp`). Un
modelo siempre pertenece a una cuenta.

| Tipo de cobro | Qué suma | Tope |
|---|---|---|
| **Por token** | USD estimados: tokens de entrada × tarifa de entrada + tokens de salida × tarifa de salida, del **modelo que respondió** | Tope mensual en USD (§7.3) |
| **Plan fijo o membresía** | **No suma USD** (cuenta 0). Cuenta llamadas y tokens | Un **tope de llamadas al mes** propio, con su auto-pausa al 80 % |

- La cuota fija del plan, si Sam quiere verla, va en `ia_suscripciones` (0638 §4.4) como dato aparte. **No** entra en
  el tope en USD, porque se paga igual aunque no se use.
- Muchas membresías de chat **no dan llave de API**. Si una cuenta de plan fijo no tiene llave utilizable, no se puede
  poner en una cadena (**NV** por proveedor; lo confirma Sam al cargarla).
- Pasar una cuenta a plan fijo **afloja el freno** (deja de sumar USD): pide superadmin con AAL2 (§8).

### 7.2 Tarifa por modelo

Tabla `ia_modelos` (por tenant): cuenta, proveedor y modelo (con llave foránea al catálogo, §5), tarifa de entrada y
de salida en USD por millón de tokens, `vigente_desde`. La tarifa **vive con el modelo**, no es global.

- Las tarifas las carga Sam en la pantalla; **no van en el repo** (cambian y son datos de cuenta, 0703 §8).
- Un modelo de una cuenta **por token** exige tarifa mayor que 0: con 0 la auto-pausa no saltaría nunca (la misma
  regla de `despachador-config.ts:67-72`). Uno de **plan fijo** no lleva tarifa.
- Cambiar una tarifa vale desde ese momento; lo ya gastado no se recalcula.
- **Valor efectivo previo de la tarifa de un modelo:** la de su fila en `ia_modelos`; si no tiene fila, la que se le
  aplicaría hoy (en la Oficina, la regla del punto siguiente: la más alta declarada de la cuenta o, si no hay, la de
  las variables de entorno). **Dar de alta un modelo con una tarifa menor que ese valor previo afloja el freno**, igual
  que bajar una tarifa existente: pide superadmin con AAL2 (§8). Ejemplo: sin modelos declarados y con la variable de
  entorno de salida en 10, dar de alta el modelo de la Oficina con salida 8 pide AAL2; con salida 12, no.
- **Oficina:** cada llamada se cobra con la tarifa del modelo que consta en `modelo_usado` (0702); en el camino A, con
  la del modelo que el ERP pidió. Si el modelo no consta o no está declarado en `ia_modelos`, se cobra con la **tarifa
  más alta** de los modelos declarados de la cuenta de la Oficina (estimación conservadora, 0703 §8). Sin ningún modelo
  declarado, siguen las variables de entorno de hoy.

### 7.3 Tope mensual editable con techo en el código

- Tabla `ia_topes` (por tenant y función): tope en USD y tope de llamadas (para plan fijo).
- **Techo en el código**, por función: la Oficina sigue con `TOPE_MENSUAL_MAXIMO_USD` (C `despachador-config.ts:33`);
  cada función del ERP que tenga tope recibe su propio techo en el código. Subir un techo es una PR con OK de Sam.
- **Valor efectivo** de cada freno (tope en USD, tope de llamadas, tarifa): el de la pantalla; si no hay, la variable de
  entorno (queda de respaldo, para no romper lo que ya funciona); si no, el valor por defecto del código. El tope
  siempre se recorta al techo.
- **«Subir» se mide contra el valor efectivo**, no contra lo último guardado en la pantalla. Ejemplo: sin valor en la
  pantalla, con la variable en 4 y el techo en 15, poner 6 es **subir** (pide AAL2), aunque la pantalla estuviera vacía.
- **El umbral es fijo al 80 %** (`UMBRAL_AUTOPAUSA`, C `despachador-config.ts:34`); la pantalla lo muestra, no lo edita.

### 7.4 Cómo se ve el gasto del mes

Boceto de la pestaña «Gasto» (para que Dir_DTD lo dibuje):

```
 IA                                               Funciones [Gasto] Cuentas y tarifas  Estado
 ────────────────────────────────────────────────────────────────────────────────────────────
 Noviembre 2026 (UTC)
 Función               Modelo               Cobro       Llamadas   Tokens      USD est.
 Oficina_Virtual       modelo-a             Por token        124   310.200      1,23
                       modelo-b             Por token          3     7.100      0,01
                       ─ Total ─                             127   317.300      1,24
                       Tope 4,00 USD  ▓▓▓▓▓▓░░░░░░░░░░░░░  31 %   Auto-pausa al 80 %
                                                                       [ Cambiar tope ]
 A8 Análisis Chatwoot  modelo-c             Plan fijo         12    40.000        —
                       Tope 150 llamadas  ▓░░░░░░░░░░░░░░░░░░░   8 %
```

(Los números y los nombres de modelo del boceto son inventados.)

- Por función y por modelo: llamadas, tokens de entrada y salida, USD estimados (solo por token).
- La barra del tope cambia a atención (dorado) desde el 60 % y a error (rojo) cuando la auto-pausa ya actuó, siempre
  con texto («Pausada por tope el 21/11»).
- Las cifras en tinta y con coma decimal (`1.234,50`, decisión de Sam del 2026-11-20).
- **El mes:** hoy se mide en UTC (C `0548_oficina_despachador.sql:417-419`). La pantalla lo rotula «(UTC)». Pasar a la
  hora de Caracas sería otra migración; no se propone aquí (**I**: la diferencia son 4 horas al cierre de mes).
- **Fuente:** para la Oficina, `task_events` con dos columnas nuevas de tokens (§9); para las funciones del ERP,
  `ia_eventos` (§4.4).

### 7.5 Auto-pausa al 80 %

- **Oficina:** se conserva `office_autopausar_por_tope` (solo pausa). Recibe el tope efectivo en vez del de la
  variable. Si la cuenta de la Oficina es de plan fijo, se suma la pausa por **llamadas** del mes.
- **Funciones del ERP (fase 3):** al 80 % la función queda **pausada** y usa su salida manual. Despausar es manual, con
  permiso Editar y motivo.
- Bajar el tope por debajo de lo ya gastado pausa en la llamada siguiente. Subirlo **no** despausa solo: hay que
  despausar a mano (evita que un error de tecleo reactive el gasto).

## 8. Permisos, auditoría y llaves

- **Módulo `ia`** con Ver y Editar (0639 §3.5). No entra en `SUPERADMIN_ONLY_MODULES`, para que se pueda dar por
  persona (C `rbac-guard.ts:170-174`); lleva su propio candado «superadmin o extra Editar», también en la RLS.
  - **Ver:** todas las pestañas, sin llaves.
  - **Editar:** cambiar la cadena y todo lo que **aprieta** el freno: bajar el tope en USD, bajar o poner el tope de
    llamadas, subir una tarifa, pasar una cuenta de plan fijo a por token; y despausar.
  - **Solo superadmin con AAL2:** todo lo que **afloja** el freno, comparado con el valor efectivo (§7.3):
    - subir el tope en USD;
    - subir o quitar el tope de llamadas;
    - bajar una tarifa o borrarla (al borrarla, el valor efectivo cambia);
    - dar de alta un modelo con una tarifa menor que su valor efectivo previo (§7.2);
    - pasar una cuenta de por token a plan fijo;
    - cargar o borrar llaves (0639 D-7).
  - La regla se valida en el servidor **y** en la base (la función que guarda compara con el valor efectivo y exige el
    claim AAL2), no solo en el botón.
- **Auditoría:** cada cambio (cadena, tarifa, tipo de cobro, tope, pausa, llave) deja una fila con quién, cuándo, qué
  campo, el valor anterior, el nuevo y el motivo. **Nunca** el valor de una llave. Se usa el registro de auditoría que
  ya existe en el Studio si cubre estos campos (**NV**: se decide al implementar, sin crear uno paralelo si no hace
  falta). Los saltos automáticos no son cambios de configuración: van a `ia_eventos` (§4.4).
- **Llaves:** en Supabase Vault, de solo escritura, nunca se muestran (ni enteras ni truncadas), con el patrón de
  Kommo (0639 §3.7). Solo las cuentas de uso `erp`; las de la Oficina las maneja Ofi_Hermes (§6.3).

## 9. Migraciones necesarias

Todas nuevas, numeradas al implementar con la reserva del Director. **Aplicarlas en producción exige el OK nominal de
Sam** y el [runbook de producción](../../runbooks/aplicar-migraciones-prod.md). Ninguna se aplica antes de aprobar su
PR.

| Migración | Qué crea | Fase |
|---|---|---|
| Catálogo y costo | `ia_catalogo_modelos` (sembrada), `ia_cuentas` (sin llave), `ia_modelos`, `ia_topes`; `task_events.tokens_entrada` y `tokens_salida` (enteros, por defecto 0); función de llamadas del mes por cuenta; la función que guarda frenos con la regla de §8. `office_gasto_del_mes` sigue igual | 1 |
| Cadenas y registro | `ia_cadenas` (con proveedor, llaves foráneas, CHECK y triggers de la D-2, §5) e `ia_eventos` (campos de la 0638 §5.3 más puesto, tokens y costo) | 1 |
| Cortacircuitos | `ia_cortacircuitos` | 2 |
| Llaves | `ia_cuentas.vault_secret_name` y las funciones `security definer` de lectura (0639 D-7) | 2 |

RLS en todas: Ver con el módulo `ia`; Editar con superadmin o el extra; `anon` sin nada. Contratos `.test.sql` en
PGlite.

## 10. Pruebas previstas

- **Regla D-2 (la que impide el atajo):**
  - una prueba recorre el catálogo y **falla** si una función `con_datos` (Oficina, A3, A4a, A4b, A5, A6) tiene
    habilitado un modelo de un proveedor `chino`;
  - la acción de guardar rechaza GLM o DeepSeek para una función `con_datos` **en el puesto 1, en el 2 y en el 3**,
    aunque lleguen en el formulario;
  - en PGlite, un `insert` o `update` directo de GLM o DeepSeek en una función `con_datos`, **en cualquiera de los tres
    puestos**, falla por el CHECK, también con la clave de servicio;
  - en PGlite, un proveedor fuera de la lista cerrada o un modelo fuera de `ia_catalogo_modelos` no se guarda;
  - la siembra de `ia_catalogo_modelos` es igual al catálogo en código.
- **Cadena:** no se guarda un 1.º vacío, un modelo repetido, un 4.º puesto ni un modelo fuera del catálogo.
- **Cambio automático** (con un doble HTTP, sin llamadas reales):
  - un 5xx en el 1.º pasa al 2.º; un 5xx en el 2.º pasa al 3.º y la tarea termina;
  - un 400 o un esquema inválido no saltan; un 429 sin código de saldo no salta;
  - **Oficina:** `red`, tiempo agotado, `http_502/503/504` saltan; `http_500`, otro 5xx, `http_4xx` y `json` **no**
    saltan;
  - cada salto deja su fila; el aviso sigue la D-6;
  - si los tres fallan, la función falla con la clase del último y sigue su salida manual;
  - Oficina: techo de 4 llamadas, 24 000 tokens y 200 s para la cadena entera;
  - fase 2: cortacircuito tras `falta_de_pago` y tras 3 `proveedor_caido`.
- **Costo:**
  - el costo usa la tarifa del modelo que respondió, no una global (Oficina con `modelo_usado`);
  - modelo de la Oficina desconocido → tarifa más alta declarada; sin modelos declarados → variables de entorno;
  - plan fijo suma 0 USD y cuenta llamadas y tokens; su tope de llamadas pausa al 80 %;
  - un tope mayor que el techo vale el techo; sin valor en pantalla, manda la variable de entorno;
  - una tarifa 0 en una cuenta por token no se guarda;
  - subir el tope no despausa.
- **Permisos (frenos):** con Editar y sin AAL2 de superadmin, **se rechazan**: subir el tope en USD, subir o quitar el
  tope de llamadas, bajar o borrar una tarifa y pasar a plan fijo. Se compara con el valor efectivo: con la pantalla
  vacía y la variable de entorno en 4, guardar 6 se rechaza. **Alta de un modelo:** sin modelos declarados y con la
  tarifa de la variable de entorno en 10, dar de alta un modelo con tarifa 8 se rechaza sin AAL2 y con tarifa 12 se
  acepta; con un modelo declarado en 10, dar de alta otro de la misma cuenta con 8 se rechaza sin AAL2. Con Editar sí
  se puede apretar el freno. Lo mismo directo
  en la base (PGlite). Cada cambio queda en la auditoría con su motivo.
- **Llaves:** una llave falsa sembrada no aparece en el HTML, las respuestas, los logs ni la auditoría (0639 §6).
- **Sin literales de modelo** fuera de la configuración y el catálogo.
- **Oficina, fase 1b (en el VPS, no en CI; la ejecuta Ofi_Hermes):** prueba con texto inventado y el 1.º caído a
  propósito; evidencia en el runbook.
- Cada fase de producto cierra con `pnpm verify` y la UI con `/ui-check`.

## 11. Fases

| Fase | Qué entrega | Depende de |
|---|---|---|
| **0 · Esta spec** | Aprobación de la spec (D-1 a D-6 ya decididas) | Sam |
| **1 · Lo mínimo sin el chat** | `/studio/admin/ia` con «Funciones» (A1 y A2), «Gasto» y «Cuentas y tarifas» (sin llaves); módulo `ia`; migraciones de fase 1. **Costo:** el despachador de la Oficina lee tope, tarifa por modelo y tipo de cobro de la base, con las variables de entorno de respaldo. **Cadena:** A1 y A2 (las primeras de la 0639 D-4) con hasta tres modelos **de Anthropic**, con la llave que ya existe y el cambio automático de §4; es el nivel 1 de la 0639 (modelo, no proveedor), así que no necesita el motor. Registro en `ia_eventos`; aviso solo dentro del Studio (§4.4). **Con esto Sam cambia el modelo de A1 y A2 y el tope de la Oficina sin el chat** | **0638 fase 1** (clasificador, sin base); migraciones con OK nominal de Sam |
| **1b · La Oficina obedece la cadena** | Fila de la Oficina editable en «Funciones»; el despachador recorre la cadena (§4.2-§4.3) por el camino de la D-3. **Con esto Sam cambia el modelo de la Oficina sin el chat** | Fase 1; Ofi_Hermes (§6.3) |
| **2 · Motor y llaves** | Fase 2 de la 0639 con cadena de tres: adaptadores de otros proveedores, llaves en Vault y cortacircuitos | Fase 1 |
| **3 · El resto de funciones** | A1 y A2 con proveedores distintos (0639 D-1); A3-A5 con respaldo no chino (0703); A8; auto-pausa por función; aviso externo | Fase 2; **0638 fase 5** (aviso) para el aviso fuera del Studio |

## 12. Decisiones

**Decididas por Sam (2026-11-21), textual, por el chat de Dir_DTD:** «SDD-0704: apruebo las cinco opciones
recomendadas (A en las cinco)». Lo decidió **sobre la v1** (`c24353a6b`) y cubre la D-1 a la D-5 tal como estaban ahí.
La D-5 que sigue es más amplia que la de la v1, por la revisión independiente (ver su nota).

**D-6, decidida por Sam (2026-11-21), textual, por el chat de Dir_DTD:** «SDD-0704 D-6: opción A, un aviso por
función y puesto al día». Nació en la revisión independiente. Se conservan las alternativas y los bocetos como
registro.

### D-1 · ¿Dónde va la pantalla? — DECIDIDA

- **Decidida (Sam, 2026-11-21): tarjeta «IA» en Administración › PRO**, con las cuatro pestañas de §2.2. Junta lo de la 0638, la
  0639 y esta spec en un solo lugar.
- Alternativa: una sección «IA» propia en la barra lateral.

```
 Administración › PRO                         Barra lateral (alternativa)
 ┌───────────────┐ ┌───────────────┐          SISTEMA
 │ Agentes y     │ │ IA            │           · Administración
 │ Skills        │ │ Cadena, gasto │           · IA            ← nueva
 └───────────────┘ │ y cuentas     │           · Usuarios
                   └───────────────┘
```

### D-2 · ¿Cuándo vuelve al 1.º? — DECIDIDA

- **Decidida (Sam, 2026-11-21): cada llamada empieza por el 1.º**, con cortacircuito desde la fase 2 (§4.5).
- Alternativa: pegajoso, como Hermes hoy (0626 §7): tras un salto se queda en el 2.º durante 24 h.

```
 Recomendada                              Pegajosa (24 h)
 10:00  1.º cae  → 2.º responde           10:00  1.º cae  → 2.º responde
 10:01  1.º ✓ responde                    10:01  2.º (sigue)
 10:02  1.º ✓                             …       2.º hasta mañana 10:00
```

### D-3 · ¿Cómo manda la pantalla a la Oficina? — DECIDIDA

- **Decidida (Sam, 2026-11-21): A, el ERP pide el modelo en cada llamada** (§6.1), con alias por puesto en Hermes
  que crea Ofi_Hermes. Si Hermes no lo permite, B. Que Hermes lo acepte sigue siendo **NV** (§6.2): lo mide Ofi_Hermes
  en la fase 1b.
- Alternativas: B (sincronizar hacia Hermes) o C (solo mostrar).

```
 A · El ERP pide                      B · Sincronizar
 ERP ──«usa el 1.º»──▶ Hermes          ERP ──cadena──▶ [tarea en el VPS] ──▶ config de Hermes
     ◀──falla──                                                         (reinicia el gateway)
 ERP ──«usa el 2.º»──▶ Hermes          Hermes decide el salto con su propia regla
```

### D-4 · Membresías: ¿cómo se cuentan? — DECIDIDA

- **Decidida (Sam, 2026-11-21): plan fijo = 0 USD, cuenta llamadas y tokens, con un tope de llamadas propio** (§7.1). La cuota del
  plan, si la quieres ver, va aparte y no entra en el tope.
- Alternativa: además, mostrar «lo que costaría por token» con una tarifa de referencia. Más claro para comparar,
  pero es un número que nadie paga y puede confundir.

```
 Cuenta                Proveedor   Cobro                 Tope
 Oficina · cuenta 1    Anthropic   (•) Por token          4,00 USD/mes
                                   ( ) Plan fijo
 Análisis · cuenta 2   Z.AI        ( ) Por token          150 llamadas/mes
                                   (•) Plan fijo
```

### D-5 · ¿Quién afloja el freno? — DECIDIDA

- **Decidida (Sam, 2026-11-21, sobre la v1): con Editar solo se baja el tope; subirlo es del superadministrador con
  verificación en dos pasos.** Es la opción recomendada de la v1.
- **Extensión por la revisión (no es texto de Sam):** la D-5 de la v3 es más amplia que la que Sam aprobó sobre la v1.
  Es la aplicación del bloqueante 1 de la revisión independiente: pasar a plan fijo, bajar una tarifa, quitar el tope
  de llamadas y dar de alta un modelo con tarifa menor que su valor efectivo previo también permiten gastar más sin
  «subir» el tope, así que piden lo mismo: superadmin con AAL2 (§8). Bajar el gasto nunca es un riesgo.
- Alternativa: Editar hace todo.

```
 Tope del mes: [ 6,00 ] USD   (efectivo hoy: 4,00 · máximo 15,00)
   ↓ Bajar, poner tope de llamadas, subir tarifa      → cualquiera con Editar
   ↑ Subir, quitar tope de llamadas, bajar tarifa,
     alta con tarifa menor, pasar a plan fijo          → «Confirma con tu segundo factor»
```

### D-6 · ¿Cuántos avisos por salto? — DECIDIDA

- **Decidida (Sam, 2026-11-21): opción A, uno por función, puesto y día.** El primer salto del día desde un puesto avisa; los siguientes del
  mismo día solo se cuentan en la pantalla.
- Alternativas: uno por cada salto (más ruido en una caída larga) o un resumen diario (puede llegar tarde).

```
 Recomendada                         Cada salto                 Resumen diario
 09:10 A1: 1.º → 2.º  🔔             09:10 🔔  09:11 🔔 …         23:59 🔔 «A1: 14 saltos»
 09:11 A1: 1.º → 2.º  (contado)
 11:40 A1: 2.º → 3.º  🔔
```

Hasta la 0638 fase 5 el aviso sale solo dentro del Studio (§4.4). **Decisiones que esta spec no abre** (siguen donde
están): el canal de los avisos (0638 D-3), el modelo de OpenAI y la retención (0703 P-1, P-4).

## 13. Riesgos

- **Hermes puede no aceptar el modelo por llamada** (§6.2, NV). Mitigación: la fase 1 no depende de eso; la 1b mide
  primero y cae a B.
- **Hermes puede contestar 500 a todo.** Entonces la Oficina no salta (§4.2) hasta que Ofi_Hermes pase la causa: se
  prefiere escalar a una persona antes que saltar ante un posible 400.
- **Tres puestos triplican el gasto en el peor caso.** Mitigación: los límites de cada función valen para la cadena
  entera (§4.3) y el tope del mes se mira después de cada llamada.
- **En la fase 1, A1 y A2 solo tienen modelos de Anthropic**: una caída de Anthropic entera tumba su cadena. Lo
  resuelve la fase 2; hasta entonces sigue la salida manual.
- **Dos cadenas a la vez** (la del ERP y el respaldo propio de Hermes) harían saltos dobles. Mitigación: §6.3 pide
  quitar el de Hermes en la fase 1b.
- **Freno aflojado sin querer.** Mitigación: todo lo que afloja pide AAL2 y se compara con el valor efectivo (§8);
  auditoría con valor anterior y nuevo; tope duro en el panel de cada proveedor (0639 §7).
- **Plan fijo sin tope en USD.** Una membresía que en realidad cobra por exceso no se vería. Mitigación: tope de
  llamadas propio y la renovación de la 0638.

## 14. Fuera de alcance

- Código, migraciones y producción en esta etapa.
- Ejecutar cambios en el VPS de Hermes: los hace Ofi_Hermes (§6.3).
- A6 Agentes (0639 D-5) y A7 Whisper.
- Elegir modelos por calidad, abrir cuentas, pagar o cargar las llaves de la Oficina: lo hacen Sam y Ofi_Hermes.
- Cambiar el mes de UTC a la hora de Caracas.
- Editar la 0639 o la 0703: esta spec las amplía; sus textos se ajustan cuando la 0704 se apruebe.
