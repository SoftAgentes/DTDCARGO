---
sdd: "0704"
title: "IA: pantalla con cadena de tres modelos por función, cambio automático y costo configurable"
status: proposed
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-21
updated: 2026-11-21
supersedes: null
superseded_by: null
related: ["0626", "0638", "0639", "0702", "0703"]
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
> Sam aprobó «arranca la construcción de la pantalla IA con tres niveles». Después fijó el alcance: «Sí: aquí solo
> el ERP; la parte de Hermes de la 0703 y la 0704 pasa a Ofi_Hermes».
>
> **Estado: propuesta, solo spec.** Esta spec **amplía** la SDD-0639, no la reemplaza: lo que la 0639 llama
> «principal y respaldo» pasa a ser una **cadena de hasta tres puestos** para las funciones del ERP, y se suma el
> **costo** en la misma pantalla. No toca código, ni la base, ni producción, ni el `.env`. El repo es público: sin
> llaves, montos reales, IP ni datos de clientes. Las tarifas y los topes que aparecen son de ejemplo.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia · **NV** no verificado. Base:
`origin/main` `9ae885c88`. La 0702 y la 0703 aún no están en `main`: se leyeron en sus ramas
(`origin/sdd/0626-modelo-real` y `origin/claude/sdd-0703-openai-respaldo-741f7a`, PR #757) y se citan como **D**.

## 0. Alcance: solo el ERP

- **Entra:** la pantalla «IA» para las funciones que el ERP llama directo (el catálogo de la 0639), su cadena de
  tres puestos con cambio automático, y **todo el costo**, incluido el contador del cable de la Oficina (tope, tarifa
  y tipo de cobro), porque ese contador vive en el ERP (C `lib/studio/oficina/despachador-config.ts`).
- **No entra:** la cadena de modelos de la Oficina la lleva el Director Ofi_Hermes en su proyecto; esta pantalla no
  la cambia. Como mucho la muestra de solo lectura (§2.4).

## 1. Qué existe hoy

| Hecho | Ev. |
|---|---|
| El motor común de la 0639 (`lib/studio/ia/`, catálogo, `ia_motores`, llaves en Vault) **no existe**: el directorio no está. La 0638 (clasificador, `ia_eventos`, pantalla «Estado de la IA») tampoco está implementada | C (directorio ausente) · D 0639 §5, 0638 §7 |
| La 0639 fija **un principal y un respaldo**, y dice expresamente «No es una cadena larga» | D `docs/specs/0639-ia-cambio-de-proveedor/spec.md:72-82` |
| La 0703 repite «una sola vez … No hay cadena larga ni un tercer proveedor» para A3-A5 | D 0703 §7 |
| Hoy A1 noticias y A2 brief tienen el modelo fijo en el código; A3, A4 y A5 lo leen de una variable | D 0639 §1 · D 0638 §2.1 |
| Tope y tarifa de la Oficina son variables de entorno: `OFICINA_TOPE_MENSUAL_USD`, `OFICINA_PRECIO_ENTRADA_USD_MTOK`, `OFICINA_PRECIO_SALIDA_USD_MTOK`, con valores por defecto en el código | C `lib/studio/oficina/despachador-config.ts:14-21`, `:101`, `:109-112` |
| **Techo en el código:** `TOPE_MENSUAL_MAXIMO_USD = 15`; un tope mayor vale 15 (D5 de la 0626) | C `despachador-config.ts:33`, `:101` |
| La tarifa de la Oficina es **una sola, global**, no por modelo: cada llamada se cobra con `config.precios` | C `despachador-config.ts:120-123`, `lib/studio/oficina/despachador.ts:232` |
| El cable guarda en `task_events.modelo_usado` lo que devuelve el runtime; la 0702 hace que ahí quede el modelo real | C `despachador.ts:233` · D 0702 §2 |
| El 2026-11-21 se corrigieron a mano en el `.env` de producción la tarifa y el tope de la Oficina (valores fuera del repo) | D encargo de Dir_DTD |
| El gasto del mes es la suma de `task_events.costo_usd` del mes en UTC; la auto-pausa al 80 % **solo pausa** | C `supabase/migrations/0548_oficina_despachador.sql:411-420`, `:422-451` |
| `task_events` guarda `costo_usd` y `modelo_usado`, **no** los tokens (van solo en el texto del `resumen`) | C `supabase/migrations/0541_oficina_cable_tablas.sql:165-174` · C `despachador.ts:231` |
| Un módulo de `SUPERADMIN_ONLY_MODULES` no se puede conceder por persona: el guard exige `is_platform_admin()` | C `lib/studio/rbac-guard.ts:170-174` |
| Llaves en Vault: el patrón de Kommo guarda solo el nombre del secreto | C `supabase/migrations/0082_kommo_mirror_schema.sql:9`, `:18` |
| Administración ya tiene el grupo PRO (Agentes, Actualizaciones de Chatwoot) | C `app/studio/(app)/admin/page.tsx:360-362` |

**Consecuencia:** el costo (incluida la Oficina) se puede llevar a la pantalla **ya**, porque no depende del motor.
La cadena de las funciones del ERP necesita una pieza que llame al modelo elegido; la fase 1 la resuelve con lo mínimo
(§11).

## 2. La pantalla «IA»

### 2.1 Dónde va

Ruta `/studio/admin/ia`, tarjeta **«IA»** en Administración › PRO, junto a Agentes. Es la misma pantalla que la 0638
llama «Estado de la IA» y la 0639 usa para elegir proveedor: **una sola pantalla**, no tres. La 0638 dejó abierta su
D-1 (tarjeta en PRO o sección nueva en la barra); aquí se recomienda la tarjeta (§12, D-1).

### 2.2 Cuatro pestañas

| Pestaña | Qué hace | Fase |
|---|---|---|
| **Funciones** | Por cada función del ERP, la cadena 1.º, 2.º y 3.º, con el estado de cada puesto y el último salto | 1 (A1, A2), 3 (resto) |
| **Gasto** | Gasto del mes por función y por modelo, tope y auto-pausa, **Oficina incluida** | 1 |
| **Cuentas y tarifas** | Cada cuenta con su tipo de cobro, y cada modelo con su tarifa | 1 (tarifas), 2 (llaves) |
| **Estado** | Lo de la 0638 §4: llave presente, sondeo, última generación, último error, renovación | 0638 fase 4 |

Funciones con cadena: el catálogo de la 0639 §3 y la 0638 §2.1 (A1 noticias, A2 brief, A3 actas, A4a y A4b
resúmenes, A5 documentos, A8 análisis de Chatwoot). A6 Agentes se lista **solo para ver**: sigue fuera, en Anthropic
(0639 D-5). A7 (Whisper de Cloudflare) también, porque no tiene alternativa en el catálogo (**I**).

### 2.3 Boceto: pestaña «Funciones» (para que Dir_DTD lo dibuje)

```
 IA                                              [Funciones] Gasto  Cuentas y tarifas  Estado
 ────────────────────────────────────────────────────────────────────────────────────────────
 A1 · Noticias web                                  Sin datos de clientes · todos
   1.º  [ modelo-a · Anthropic               ▾ ]   ● Respondió hace 2 h
   2.º  [ modelo-b · Anthropic               ▾ ]   ○ Sin uso este mes
   3.º  [ — vacío —                          ▾ ]
   Último salto: ninguno este mes                               [ Guardar cambios ]
 ────────────────────────────────────────────────────────────────────────────────────────────
 A3 · Actas de Bitácora                             Con datos de clientes · solo no chinos
   1.º  [ … ▾ ]   2.º [ … ▾ ]   3.º [ … ▾ ]          (llega en la fase 3)
 ────────────────────────────────────────────────────────────────────────────────────────────
 Oficina_Virtual                                    Solo lectura · la lleva Ofi_Hermes
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

### 2.4 La Oficina en la pantalla

La cadena de modelos de la Oficina la lleva el Director Ofi_Hermes en su proyecto; esta pantalla no la cambia. En
«Funciones» la Oficina aparece en una fila de solo lectura que dice eso y enlaza a «Gasto». **Mostrar** los modelos
de Hermes queda fuera: el ERP no los lee y no se propone que los lea. Lo único que se ve de la Oficina son los
modelos que ya constan en `task_events.modelo_usado` (0702), en la pestaña «Gasto».

## 3. La cadena de hasta tres (funciones del ERP)

### 3.1 Qué cambia respecto a la 0639

| 0639 | 0704 |
|---|---|
| `ia_motores` (tenant, función, principal, respaldo) | `ia_cadenas` (tenant, función, **puesto 1-3**, cuenta, modelo). Puesto 1 = el principal de la 0639; puesto 2 = su respaldo |
| «Un principal y un respaldo, no una cadena larga» (0639 §3.4) | Hasta **tres** puestos, por pedido de Sam. Sigue sin ser una cadena larga: el techo es 3 y está en el código |
| 0703 §7 (A3-A5): «una sola vez, sin tercer proveedor» | Se reemplaza por esta regla al aprobarse la 0704. La regla D-2 de la 0703 (nunca un chino) se mantiene |

Todo lo demás de la 0639 sigue igual: catálogo aprobado en código, habilitación por prueba, llaves en Vault, permisos.

### 3.2 El catálogo en código

`lib/studio/ia/catalogo.ts` (el de la 0638 §4.2 y la 0639 §3.2) gana dos datos:

- por **proveedor**: `origen: "chino" | "no_chino"` (Z.AI/GLM y DeepSeek son `chino`; Anthropic y OpenAI, `no_chino`);
- por **función**: su marca de datos de la 0639 §4 (`sin_datos`, `solo_shipping_mark`, `con_datos`) y la lista de
  modelos **habilitados** (los que pasaron su prueba de contrato).

## 4. El cambio automático

### 4.1 Cuándo salta al siguiente puesto

Se usa el clasificador de la 0638 §5.1. La llamada **pasa al siguiente puesto** ante:

| Clase | ¿Salta? | Por qué |
|---|---|---|
| `proveedor_caido` (5xx, 529, tiempo agotado, conexión) | **Sí** | Es el caso que pidió Sam |
| `falta_de_pago`, `cuenta_suspendida`, `llave_invalida` | **Sí** | Ya saltaban en la 0639 §3.4; el siguiente puesto suele ser otra cuenta |
| `limite_de_uso` (429 sin señal de cobro) | **No** | Se reintenta solo donde la función ya reintenta (0639, 0703) |
| `otro`, un 400 de entrada inválida | **No** | Otro modelo recibiría la misma entrada mala |
| La respuesta no valida su esquema | **No** | Es un fallo de la función, no del proveedor (0703 §3.2) |

Si el último puesto también falla con una clase que salta, la función **falla con la clase del último error** y sigue
su salida manual de siempre (noticias se escriben a mano; el brief sale con solo números; el documento se llena a
mano). Nunca se sale del catálogo de la función ni cae a un proveedor chino en una función `con_datos`.

### 4.2 Que haga la tarea sin pasarse de sus límites

- Un salto **no** gasta el reintento propio de la función (si lo tiene).
- Los límites que la función ya tiene valen para **la cadena entera**: A5 conserva sus trabajos por día y su
  presupuesto diario de tokens (D 0638 §2.1); cada función conserva su tiempo máximo. Si no queda tiempo para el
  siguiente puesto, la función falla con la clase en vez de saltar.
- Techo duro de **3 llamadas por tarea** por saltos (una por puesto), en el código.

### 4.3 Cada salto queda registrado y avisa

- **Registro:** en `ia_eventos` (0638 §5.3) una fila por intento: función, puesto, proveedor, modelo, resultado (`ok`
  o la clase), status, código, tokens y costo. Sin texto.
- **Aviso:** el primer salto de una función en el día avisa a los administradores con el aviso de la 0638 §5.5
  (deduplicado en la base, uno por función, puesto y día). El canal es la D-3 de la 0638, todavía abierta.
- **Pantalla:** «Último salto» por función, con la fecha, el puesto y la clase.

### 4.4 Cuándo vuelve al 1.º

Recomendación (§12, D-2): **cada llamada nueva empieza por el 1.º**, con un cortacircuito corto:

- Si el 1.º falló con `falta_de_pago`, `cuenta_suspendida` o `llave_invalida`, queda **abierto**: las llamadas lo
  saltan hasta que un sondeo («Probar ahora» o el automático cada 15 min) o una generación real lo cierre. Un pago no
  se arregla solo en un minuto.
- Si el 1.º falló con `proveedor_caido` **3 veces seguidas**, queda abierto **5 min**; después se prueba de nuevo con
  una llamada real.
- El estado del cortacircuito vive en la base (`ia_cortacircuitos`), no en memoria, porque el servidor se reinicia.

## 5. La regla D-2 dentro de la pantalla

Tres capas, para que ninguna sola alcance:

1. **Lista:** en una función `con_datos`, el selector **no muestra** modelos de proveedores `chino`. El texto de la
   marca explica por qué.
2. **Servidor:** la acción que guarda la cadena vuelve a validar contra el catálogo. Si llega un modelo chino para
   una función `con_datos` (por ejemplo, desde un formulario manipulado), responde `no_permitido` y no guarda nada.
3. **Base:** `ia_cadenas` tiene un CHECK que impide `datos_clientes = true` con un proveedor de la lista china fija
   en la migración, y un trigger que copia `datos_clientes` desde la lista de funciones `con_datos` de la misma
   migración (quien escribe no la elige).

Las pruebas que fallan si el catálogo lo permite están en §10.

## 6. El costo en la misma pantalla

### 6.1 Cuentas y tipo de cobro

El sistema **no adivina** si una cuenta cobra por token o por membresía: ningún proveedor lo dice en la respuesta de
una llamada (**I**; **NV** por proveedor). Lo declara Sam una vez por cuenta, en «Cuentas y tarifas».

Tabla `ia_cuentas` (por tenant): alias (no el correo), proveedor, entorno, **tipo de cobro**, uso (`erp` u `oficina`)
y, en la fase 2, el nombre del secreto en Vault (0639 D-7; solo para las cuentas `erp`). Un modelo siempre pertenece
a una cuenta.

| Tipo de cobro | Qué suma | Tope |
|---|---|---|
| **Por token** | USD estimados: tokens de entrada × tarifa de entrada + tokens de salida × tarifa de salida, del **modelo que respondió** | Tope mensual en USD (§6.3) |
| **Plan fijo o membresía** | **No suma USD** (cuenta 0). Cuenta llamadas y tokens | Un **tope de llamadas al mes** propio, opcional, con su auto-pausa al 80 % |

- La cuota fija del plan, si Sam quiere verla, va en `ia_suscripciones` (0638 §4.4) como dato aparte. **No** entra en
  el tope en USD, porque se paga igual aunque no se use.
- Muchas membresías de chat **no dan llave de API**. Si una cuenta de plan fijo no tiene llave que el ERP pueda usar,
  no se puede poner en una cadena (**NV** por proveedor; lo confirma Sam al cargarla).
- **La cuenta de la Oficina** se declara aquí igual que las demás (uso `oficina`), para el costo del cable. Su llave
  no pasa por el ERP: la maneja Ofi_Hermes.

### 6.2 Tarifa por modelo

Tabla `ia_modelos` (por tenant): cuenta, id del modelo, tarifa de entrada y de salida en USD por millón de tokens,
`vigente_desde`. La tarifa **vive con el modelo**, no es global.

- Las tarifas las carga Sam en la pantalla; **no van en el repo** (cambian y son datos de cuenta, 0703 §8).
- Un modelo de una cuenta **por token** exige tarifa mayor que 0: con 0 la auto-pausa no saltaría nunca (la misma
  regla de `despachador-config.ts:67-72`). Uno de **plan fijo** no lleva tarifa.
- Cambiar una tarifa vale desde ese momento; lo ya gastado no se recalcula.
- **Oficina:** el despachador cobra cada llamada con la tarifa del modelo que consta en `modelo_usado` (0702). Si el
  modelo no consta o no está declarado en `ia_modelos`, cobra con la **tarifa más alta** de los modelos declarados de
  la cuenta de la Oficina (estimación conservadora, 0703 §8). Sin ningún modelo declarado, siguen las variables de
  entorno de hoy.

### 6.3 Tope mensual editable con techo en el código

- Tabla `ia_topes` (por tenant y función, Oficina incluida): tope en USD y tope de llamadas (para plan fijo).
- **Techo en el código**, por función: la Oficina sigue con `TOPE_MENSUAL_MAXIMO_USD` (C `despachador-config.ts:33`);
  cada función del ERP que tenga tope recibe su propio techo en el código. Un tope mayor que el techo vale el techo,
  igual que hoy. Subir un techo es una PR con OK de Sam.
- **Precedencia:** valor de la pantalla → variable de entorno (queda de respaldo, para no romper lo que ya funciona) →
  valor por defecto. Siempre recortado al techo.
- **El umbral es fijo al 80 %** (`UMBRAL_AUTOPAUSA`, C `despachador-config.ts:34`); la pantalla lo muestra, no lo edita.
- Los topes por corrida de la Oficina (llamadas, tokens, pasos, tiempo) **no cambian** en esta spec.

### 6.4 Cómo se ve el gasto del mes

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
- **Fuente:** para la Oficina, `task_events` con dos columnas nuevas de tokens (§9); para A1-A8, `ia_eventos` con
  tokens y costo (0638 §5.3, ampliada).

### 6.5 Auto-pausa al 80 %

- **Oficina:** se conserva `office_autopausar_por_tope` (solo pausa). Recibe el tope de la pantalla en vez del de la
  variable. Si la cuenta de la Oficina es de plan fijo, se suma la pausa por **llamadas** del mes.
- **Funciones del ERP (fase 3):** al 80 % la función queda **pausada** y usa su salida manual; avisa con la 0638 §5.5.
  Despausar es manual, con permiso Editar y motivo.
- Bajar el tope por debajo de lo ya gastado pausa en la llamada siguiente. Subirlo **no** despausa solo: hay que
  despausar a mano (evita que un error de tecleo reactive el gasto).

## 7. Permisos, auditoría y llaves

- **Módulo `ia`** con Ver y Editar (0639 §3.5). No entra en `SUPERADMIN_ONLY_MODULES`, para que se pueda dar por
  persona (C `rbac-guard.ts:170-174`); lleva su propio candado «superadmin o extra Editar», también en la RLS.
  - **Ver:** todas las pestañas, sin llaves.
  - **Editar:** cambiar la cadena, las tarifas y el tipo de cobro, **bajar** el tope y despausar.
  - **Solo superadmin con AAL2:** **subir** el tope (§12, D-4) y cargar o borrar llaves (0639 D-7).
- **Auditoría:** cada cambio (cadena, tarifa, tipo de cobro, tope, pausa, llave) deja una fila con quién, cuándo, qué
  campo, el valor anterior, el nuevo y el motivo. **Nunca** el valor de una llave. Se usa el registro de auditoría que
  ya existe en el Studio si cubre estos campos (**NV**: se decide al implementar, sin crear uno paralelo si no hace
  falta). Los saltos automáticos no son cambios de configuración: van a `ia_eventos` (§4.3).
- **Llaves:** en Supabase Vault, de solo escritura, nunca se muestran (ni enteras ni truncadas), con el patrón de
  Kommo (0639 §3.7). Solo las cuentas de uso `erp`.

## 8. Relación con otras specs

- **0638:** su pantalla «Estado de la IA» es la cuarta pestaña; su clasificador y su `ia_eventos` son la base del
  cambio automático.
- **0639:** se amplía de dos a tres puestos (§3.1). Al aprobarse la 0704, su §3.4 se ajusta.
- **0703:** su adaptador de OpenAI para A3-A5 entra como un modelo más del catálogo; su §7 («sin tercer proveedor»)
  se ajusta al aprobarse la 0704. Su parte de la Oficina pasa a Ofi_Hermes, por decisión de Sam.
- **0702:** da el modelo real de cada llamada de la Oficina, que la tarifa por modelo necesita (§6.2).

## 9. Migraciones necesarias

Todas nuevas, numeradas al implementar con la reserva del Director. **Aplicarlas en producción exige el OK nominal de
Sam** y el [runbook de producción](../../runbooks/aplicar-migraciones-prod.md). Ninguna se aplica antes de aprobar su
PR.

| Migración | Qué crea | Fase |
|---|---|---|
| Costo | `ia_cuentas` (sin llave aún), `ia_modelos`, `ia_topes`; `task_events.tokens_entrada` y `tokens_salida` (enteros, por defecto 0); función de llamadas del mes por cuenta. `office_gasto_del_mes` sigue igual | 1 |
| Cadenas | `ia_cadenas` (con el CHECK y el trigger de la D-2, §5) y `ia_cortacircuitos` | 1 |
| Registro común | `ia_eventos` de la 0638, ampliada con puesto, tokens y costo | 1 (adelanta la parte de la 0638 fase 2 que hace falta) |
| Llaves | `ia_cuentas.vault_secret_name` y las funciones `security definer` de lectura (0639 D-7) | 2 |

RLS en todas: Ver con el módulo `ia`; Editar con superadmin o el extra; `anon` sin nada. Contratos `.test.sql` en
PGlite.

## 10. Pruebas previstas

- **Regla D-2 (la que impide el atajo):**
  - una prueba recorre el catálogo y **falla** si una función `con_datos` (A3, A4a, A4b, A5, A6) tiene habilitado un
    modelo de un proveedor `chino`;
  - la acción de guardar rechaza un modelo chino para una función `con_datos`, aunque llegue en el formulario;
  - en PGlite, un `insert` directo de un modelo chino en una función `con_datos` falla por el CHECK, también con la
    clave de servicio.
- **Cadena:** no se guarda un 1.º vacío, un modelo repetido, un 4.º puesto ni un modelo fuera del catálogo.
- **Cambio automático** (con un doble HTTP, sin llamadas reales):
  - un 5xx en el 1.º pasa al 2.º; un 5xx en el 2.º pasa al 3.º y la tarea termina;
  - un 400 o un esquema inválido no saltan; un 429 sin código de saldo no salta;
  - cada salto deja su fila y un solo aviso por día;
  - si los tres fallan, la función falla con la clase del último y sigue su salida manual;
  - los límites de la función valen para la cadena entera;
  - cortacircuito: tras `falta_de_pago` el 1.º se salta hasta un sondeo bueno; tras 3 `proveedor_caido` se salta 5
    min y luego se prueba.
- **Costo:**
  - el costo usa la tarifa del modelo que respondió, no una global (también en la Oficina, con `modelo_usado`);
  - modelo de la Oficina desconocido → tarifa más alta declarada; sin modelos declarados → variables de entorno;
  - plan fijo suma 0 USD y cuenta llamadas y tokens; su tope de llamadas pausa al 80 %;
  - un tope mayor que el techo vale el techo; sin valor en pantalla, manda la variable de entorno;
  - una tarifa 0 en una cuenta por token no se guarda;
  - subir el tope no despausa.
- **Permisos:** Ver no edita; Editar sin superadmin no sube el tope ni carga llaves; sin AAL2 se rechaza; cada cambio
  queda en la auditoría con su motivo.
- **Llaves:** una llave falsa sembrada no aparece en el HTML, las respuestas, los logs ni la auditoría (0639 §6).
- **Sin literales de modelo** fuera de la configuración y el catálogo.
- Cada fase de producto cierra con `pnpm verify` y la UI con `/ui-check`.

## 11. Fases

| Fase | Qué entrega | Necesita |
|---|---|---|
| **0 · Esta spec** | Aprobación y decisiones D-1 a D-4 | Sam |
| **1 · Lo mínimo sin el chat** | `/studio/admin/ia` con «Funciones», «Gasto» y «Cuentas y tarifas» (sin llaves); módulo `ia`; migraciones de la fase 1. **Costo:** el despachador de la Oficina lee tope, tarifa por modelo y tipo de cobro de la base, con las variables de entorno de respaldo. **Cadena:** A1 y A2 (las primeras de la 0639 D-4) con hasta tres modelos **de Anthropic**, la llave que ya existe y el cambio automático de §4; es el nivel 1 de la 0639 (modelo, no proveedor), así que no necesita el motor multiproveedor. **Con esto Sam cambia el modelo, la cadena y el tope sin el chat** | Migraciones con OK nominal de Sam; clasificador de la 0638 fase 1 |
| **2 · Motor y llaves** | Fase 2 de la 0639 con cadena de tres: adaptadores de otros proveedores y llaves en Vault | Fase 1 |
| **3 · El resto de funciones** | A1 y A2 con proveedores distintos (0639 D-1); A3-A5 con respaldo no chino (0703); A8; auto-pausa por función | Fase 2 |

## 12. Decisiones para Sam

Pocas, cada una con la recomendada primero y con su boceto.

### D-1 · ¿Dónde va la pantalla?

- **Recomendada: tarjeta «IA» en Administración › PRO**, con las cuatro pestañas de §2.2. Junta lo de la 0638, la
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

### D-2 · ¿Cuándo vuelve al 1.º?

- **Recomendada: cada llamada empieza por el 1.º, con cortacircuito** (§4.4): un error de pago lo salta hasta que una
  prueba salga bien; una caída repetida lo salta 5 min.
- Alternativa: pegajoso: tras un salto se queda en el 2.º durante 24 h.

```
 Recomendada                              Pegajosa (24 h)
 10:00  1.º cae  → 2.º responde           10:00  1.º cae  → 2.º responde
 10:01  1.º ✓ responde                    10:01  2.º (sigue)
 10:02  1.º ✓                             …       2.º hasta mañana 10:00
```

### D-3 · Membresías: ¿cómo se cuentan?

- **Recomendada: plan fijo = 0 USD, cuenta llamadas y tokens, con un tope de llamadas propio opcional** (§6.1). La
  cuota del plan, si la quieres ver, va aparte y no entra en el tope.
- Alternativa: además, mostrar «lo que costaría por token» con una tarifa de referencia. Más claro para comparar,
  pero es un número que nadie paga y puede confundir.

```
 Cuenta                Proveedor   Cobro                 Tope
 Oficina · cuenta 1    Anthropic   (•) Por token          4,00 USD/mes
                                   ( ) Plan fijo
 Análisis · cuenta 2   Z.AI        ( ) Por token          150 llamadas/mes
                                   (•) Plan fijo
```

### D-4 · ¿Quién sube el tope?

- **Recomendada: con Editar se puede bajar; subirlo solo el superadministrador con verificación en dos pasos.** Bajar
  el gasto nunca es un riesgo; subirlo sí.
- Alternativa: Editar sube y baja.

```
 Tope del mes: [ 4,00 ] USD   (máximo 15,00)
   ↓ Bajar  → cualquiera con Editar
   ↑ Subir  → «Confirma con tu segundo factor»  (solo superadmin)
```

**Decisiones que esta spec no abre** (siguen donde están): el canal de los avisos (0638 D-3), el modelo de OpenAI y
la retención (0703 P-1, P-4).

## 13. Riesgos

- **Tres puestos triplican el gasto en el peor caso** de una tarea. Mitigación: los límites de la función valen para
  la cadena entera (§4.2) y el tope del mes se mira después de cada llamada.
- **En la fase 1 los tres puestos son de Anthropic**: una caída de Anthropic entera tumba la cadena. Lo resuelve la
  fase 2, con otros proveedores; hasta entonces sigue la salida manual de cada función.
- **Tarifa mal cargada.** Una tarifa baja hace que la auto-pausa llegue tarde. Mitigación: tarifa > 0 obligatoria,
  auditoría con valor anterior y nuevo, y el tope duro en el panel de cada proveedor (0639 §7).
- **Modelo de la Oficina desconocido.** Sin la 0702, el costo se estima con la tarifa más alta: puede pausar antes de
  tiempo, nunca después.
- **Plan fijo sin tope en USD.** Una membresía que en realidad cobra por exceso no se vería. Mitigación: tope de
  llamadas propio y la renovación de la 0638.

## 14. Fuera de alcance

- Código, migraciones y producción en esta etapa.
- **La cadena de modelos de la Oficina:** la lleva el Director Ofi_Hermes en su proyecto; esta pantalla no la cambia
  ni la lee.
- A6 Agentes (0639 D-5) y A7 Whisper.
- Elegir modelos por calidad, abrir cuentas, pagar o cargar las llaves de la Oficina: lo hacen Sam y Ofi_Hermes.
- Cambiar el mes de UTC a la hora de Caracas.
- Editar la 0639 o la 0703: esta spec las amplía; sus textos se ajustan cuando la 0704 se apruebe.
