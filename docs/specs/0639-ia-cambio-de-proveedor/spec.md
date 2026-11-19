---
sdd: "0639"
title: "IA: cambiar de modelo o de proveedor por función, con principal y respaldo"
status: approved
author: "Claude (Worker pagos-de-ia)"
created: 2026-11-16
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0638", "0020", "0146", "0473", "0588", "0626", "0637"]
confidencialidad: interno
---

# SDD-0639 — Cambiar de modelo o de proveedor de IA

> Pregunta de Sam (2026-11-16): «si Anthropic se cae, los botones de noticias, el brief y Bitácora no
> funcionan. ¿Se puede cambiar desde el mismo menú?». Sí se puede, con trabajo previo. Esta spec
> propone un **motor común** con un **principal** y un **respaldo** por función, que se elige desde la
> pantalla «Estado de la IA» de la SDD-0638.
>
> **Estado: approved (como plan, sin implementar).** Sam aprobó la spec el 2026-11-17 con «Sí, las
> dos», en respuesta a «¿apruebo las dos especificaciones de IA para que entren a main?» (SDD-0638 y
> SDD-0639, por el chat del DG). Depende de la SDD-0638 (clasificador y registro) y se coordina con
> el fallback de la Oficina (SDD-0626 §7). **v0.4:** Sam decidió las D-1 a D-7 el 2026-11-16 (§9).
> Queda abierto el choque de la D-2 con la SDD-0626 (§7), que lleva el DG.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia · **NV** no
verificado. Base: `main` `4a3046745`. El repo es público: sin llaves, montos ni datos de cuentas.

## 1. Dos niveles de cambio

| Nivel | Qué es | Dificultad | ¿Salva una caída de Anthropic? |
|---|---|---|---|
| **1 · Modelo** | Otro modelo del mismo proveedor (por ejemplo, Sonnet → Haiku) | Baja: llevar el id del modelo a la configuración | No |
| **2 · Proveedor** | Otro proveedor (por ejemplo, Anthropic → GLM o DeepSeek) | Media o alta, según la función | Sí |

Hoy unas funciones leen el modelo de una variable (A3, A4 y A5 de la SDD-0638) y otras lo tienen
fijo en código: `claude-sonnet-4-6` en noticias (C `noticias-web/actions.ts:220`) y en el brief (C
`lib/news/ceo-brief.ts:53`). Las tarifas de Agentes también están fijas (C
`agents/runtime/llm-client-anthropic.ts:38-46`).

## 2. Lo que hace difícil el nivel 2

Cada función usa la librería de Anthropic directamente, y algunas usan capacidades que no todos los
proveedores tienen:

| Función (SDD-0638) | Capacidad que usa | Riesgo al cambiar | Ev. |
|---|---|---|---|
| A1 noticias, A2 brief | Texto libre | Bajo | C |
| A3 actas, A4 resúmenes | Herramienta forzada (`tool_choice`) para una respuesta con forma fija | Medio: el respaldo debe soportarla, o la función tiene que validar un JSON | C `bitacora/extract.ts:278` |
| A5 documentos | PDF como entrada, `countTokens` y `output_config` con `json_schema` | **Alto**: pocos proveedores leen PDF, y DeepSeek documenta un soporte limitado de `output_config` | C `document-import/anthropic.ts:41-50` |
| A6 Agentes | Bucle de herramientas y precios por modelo | Alto: hay que validar el bucle y recalcular las tarifas | C `llm-client-anthropic.ts:275` |
| A8 análisis Chatwoot | Ya usa GLM con una API compatible con OpenAI | Bajo | C `chatwoot/analisis-motor.ts` |

**Posible atajo (NV):** Z.AI y DeepSeek publican un endpoint compatible con la API de Anthropic
(documentación de cada proveedor, revisada por Codex el 2026-11-16). En ese caso, para las funciones de
texto libre el cambio sería casi solo de dirección, llave y modelo. Pero eso **no prueba** que funcionen
la herramienta forzada, el bucle de herramientas, el PDF ni el `json_schema`. Cada combinación de
función y proveedor se habilita solo después de pasar su prueba (§6).

## 3. Diseño mínimo

1. **Un motor común**, `lib/studio/ia/motor/`, con una interfaz pequeña: texto libre, respuesta con
   forma fija y, si la función lo necesita, documento. Hay un adaptador por proveedor. Las funciones le
   hablan al motor y no a la librería del proveedor.
2. **Un catálogo aprobado por función** (en código, revisado por PR): qué proveedores y modelos puede
   usar cada función. Lo que no está en el catálogo no se puede elegir en la pantalla.
3. **La elección por función** se guarda en una tabla `ia_motores` (tenant, función, principal,
   respaldo), que se cambia desde la pantalla de la SDD-0638. Las llaves siguen en variables de
   entorno; la tabla solo guarda nombres de proveedor y modelo. **Valor predeterminado (D-1):** GLM
   como principal y DeepSeek como respaldo, en las funciones que lo permite la regla de datos (§4).
4. **Cambio automático, con opción manual (D-3).**
   - **Automático:** si el principal da `falta_de_pago`, `cuenta_suspendida`, `llave_invalida` o
     `proveedor_caido` (clasificador de la SDD-0638), esa llamada se reintenta una vez con el respaldo.
     La pantalla lo muestra y avisa al equipo, con el aviso de la SDD-0638 §5.5. Un error de entrada
     (400 sin señal de cobro) no cambia de proveedor.
   - **Vuelta al principal:** cuando el principal vuelve a responder (sondeo o generación real), las
     llamadas regresan a él. No es una cadena larga: es un principal y un respaldo, igual que en Faro
     (SDD-0637 §6.5).
   - **Manual:** quien tenga el permiso (punto 5) puede fijar el respaldo («Usar el respaldo»),
     cambiar el principal, por ejemplo a Anthropic si Sam tiene esa suscripción, o volver al
     predeterminado. Cada cambio queda en la auditoría, con quién lo hizo, cuándo y el motivo.
5. **Quién puede cambiar (D-6).** Por defecto, solo el **superadministrador**. Además, el permiso se
   puede dar a una persona concreta desde **Usuarios › Acceso** (SDD-0622/0635):
   - la pantalla «Estado de la IA» pasa a ser un módulo propio, `ia`;
   - **Ver** = ver los estados; **Editar** = cambiar proveedor y modelo;
   - hoy un módulo `SUPERADMIN_ONLY_MODULES` **no** se puede conceder por persona: `rbac-guard.ts:170`
     exige `is_platform_admin()` aunque haya un extra (C). Por eso `ia` no entra en esa lista: va con
     el candado propio «superadmin o extra Editar de esa persona», también en la base (RLS de
     `ia_motores`);
   - `moduleCoverage` (C `lib/studio/user-module-grants.ts:66`) lo marca como cubierto, y el aviso
     de módulo sensible (SDD-0622 §5.1) explica qué podrá hacer la persona antes de confirmar;
   - un admin normal **no** lo tiene si no se le da.
6. **Agregar un proveedor o una suscripción nueva** (por ejemplo, si Sam contrata Anthropic u otro):
   - **la llave se pega desde la pantalla (D-7)**, con las reglas del punto 7;
   - si el proveedor ya tiene adaptador, basta con pegar su llave y elegirlo;
   - si no tiene adaptador, hace falta una PR pequeña con ese adaptador y su prueba de contrato (§6).
7. **Llaves desde la pantalla (D-7).** Se reutiliza el patrón que ya usa Kommo: **Supabase Vault**, donde
   la tabla solo guarda el nombre del secreto y no la llave (C `supabase/migrations/0082_kommo_mirror_schema.sql:9-27`,
   `0472_kommo_functions_base_url.sql:42`).
   - **Solo escritura:** la llave se pega, se guarda cifrada en Vault y **nunca vuelve a mostrarse**,
     ni entera ni truncada. La pantalla solo dice «llave puesta», con la fecha y quién la puso.
   - **Quién:** solo el superadministrador, con verificación en dos pasos (AAL2, como
     `audit_view_sensitive`). El extra «Editar» del módulo `ia` permite elegir proveedor, **no**
     cargar llaves.
   - **Lectura:** solo el servidor la descifra, con una función `security definer` llamada con la
     clave de servicio, en el momento de la llamada. Nunca viaja al navegador, a los logs ni a los
     errores. `authenticated` y `anon` no tienen ningún permiso sobre ella.
   - **Precedencia:** si hay llave en la pantalla, se usa esa. Si no, la variable de entorno, que queda
     como respaldo, para no romper lo que ya funciona.
   - **Antes de guardar:** se prueba con un sondeo sin gasto. Si no autentica, no se guarda.
   - **Cambiar o borrar:** reemplazar o borrar la llave queda en la auditoría, sin el valor. Al
     borrarla, la función vuelve a la variable de entorno o queda «Sin configurar».
   - **Riesgo aceptado por Sam:** la llave pasa a vivir también en la base de producción, cifrada. Si
     alguien obtuviera la clave de servicio, podría leerla. Por eso queda solo en manos del superadmin,
     con dos pasos y auditoría.
8. **Costos:** las tarifas pasan a una tabla o a la configuración por modelo, para que el tope de
   Agentes y el de Faro sigan sumando bien con otro proveedor.

**Coordinación con la Oficina:** la SDD-0626 §7 ya diseña una cadena con fallback del lado de Hermes.
Esta spec cubre solo las llamadas **directas** del ERP. Si la Oficina extrae su política de fallos a un
módulo común, este motor la adopta y no mantiene otra (la misma regla que aceptó el DG para Faro).

## 4. Regla de datos: a un proveedor chino solo va código

**Decisión de Sam (2026-11-16, D-2):** los datos de clientes **nunca** van a un proveedor chino (Z.AI/GLM,
DeepSeek). Lo único que puede recibir sobre un cliente es su **código, el Shipping Mark**. Nombres,
teléfonos, direcciones, conversaciones, documentos y montos de un cliente quedan fuera.

Cada función del catálogo lleva una de tres marcas, y la elección de proveedor solo ofrece lo que la
marca permite:

| Marca | Funciones (SDD-0638) | Qué proveedores admite |
|---|---|---|
| **Sin datos de clientes** | A1 noticias web (contenido público), A2 brief del CEO (solo conteos del día, C `lib/news/ceo-brief.ts`), A8 análisis de Chatwoot (solo código) | Todos, incluido GLM → DeepSeek (el predeterminado) |
| **Solo Shipping Mark** | Ninguna hoy. Una función que necesite referirse a un cliente podrá mandar solo el código, si se escribe así a propósito | Todos, si una prueba demuestra que solo sale el código |
| **Con datos de clientes** | A3 actas de Bitácora (pueden nombrar clientes, **I**), A4 resúmenes de conversaciones, A5 documentos, A6 Agentes y Skills (sus herramientas devuelven nombre y dirección del cliente, C `lib/studio/agents/tools/shipment-tools.ts:80-81`) | Solo proveedores **no chinos** (hoy, Anthropic). El respaldo también tiene que ser no chino o quedar vacío |

- La regla vive en código (el catálogo) **y** en una prueba: si una función «con datos de clientes»
  apunta a un proveedor chino, la prueba falla y la pantalla no ofrece esa opción.
- Antes de pasar una función a «solo Shipping Mark», se revisa con
  `.claude/skills/revisar-datos-ve/SKILL.md` que el texto que sale no lleve nada más.
- Retención: se usa la política de no conservar del proveedor donde exista, y queda escrita por
  proveedor en el catálogo.

## 5. Fases (orden aprobado, D-4)

| Fase | Qué entrega | Necesita |
|---|---|---|
| **1 · Nivel 1** | Los ids de modelo de A1, A2 y A6 pasan a la configuración, sin literales en el código | Nada |
| **2 · Motor** | Interfaz y adaptadores de Anthropic, GLM y DeepSeek; catálogo con las marcas de §4; módulo `ia` y permiso por persona; llaves en Vault desde la pantalla (migración, con OK de Sam para aplicarla) | SDD-0638 fase 1 |
| **3 · Noticias web (A1)** | **La primera función.** GLM → DeepSeek, con cambio automático y manual | SDD-0638 fase 4 |
| **4 · Brief del CEO (A2)** | Mismo esquema. Ya tiene salida sin IA, así que es la segunda más segura | Fase 3 |
| **5 · Funciones con datos de clientes** | A3, A4 y A5 se quedan en Anthropic, sin respaldo chino; solo se suma un respaldo no chino si Sam contrata uno | Una suscripción nueva no china, con su llave cargada desde la pantalla |
| — | A6 Agentes | Fuera de esta spec; sigue en Anthropic (D-5) |

**Por qué noticias primero:** es el botón que Sam echó en falta, es contenido público sin datos de
clientes, son ocho acciones de texto libre (lo más fácil de pasar a otro proveedor) y, si algo sale
mal, el equipo lo ve en el momento y puede seguir a mano. El brief va segundo porque ya tiene salida
sin IA, y un error ahí no se nota tanto.

## 6. Pruebas previstas

- **Contrato del motor:** la misma batería contra cada adaptador (Anthropic, GLM, DeepSeek): texto,
  forma fija (JSON válido según su esquema) y tiempo agotado.
- **Habilitación:** una función no ofrece un proveedor si no pasó su prueba (el catálogo lo marca).
- **Regla de datos:** una función «con datos de clientes» no puede apuntar a GLM ni a DeepSeek; la
  prueba falla si el catálogo lo permite. Una «solo Shipping Mark» falla si el texto de salida lleva
  algo distinto del código.
- **Sin literales:** una prueba busca ids de modelo fuera de la configuración (como en Faro).
- **Automático:** con un 402 simulado en GLM, la llamada va a DeepSeek una sola vez, queda registrada
  y avisa. Un 400 de entrada inválida no cambia de proveedor. Cuando GLM vuelve, las llamadas regresan.
- **Llaves (D-7):**
  - una llave pegada nunca aparece en el HTML, en la respuesta de la acción, en los logs ni en la
    auditoría; la prueba siembra una llave falsa y la busca en cada salida;
  - `authenticated` y `anon` no pueden leerla (PGlite);
  - sin AAL2 o sin ser superadmin, se rechaza;
  - una llave que no autentica no se guarda;
  - al borrarla, se vuelve a la variable de entorno.
- **Manual y permisos:** el superadmin puede cambiar. Un admin sin el extra «Editar» del módulo `ia`
  no puede cambiar, ni desde la pantalla ni directo en la base (RLS en PGlite). Una persona con el
  extra sí puede. Cada cambio queda en la auditoría.

## 7. Riesgos

- **Regla D-2 y la Oficina:** hay un choque entre la regla D-2 y la SDD-0626, que queda como decisión
  pendiente de Sam. Lo lleva el DG; esta spec no lo resuelve.
- **Llaves en la base (D-7):** con la clave de servicio se puede leer Vault. Mitigación: solo el
  superadmin con dos pasos carga llaves, nunca se muestran y cada cambio queda en la auditoría.
  Además, conviene que cada llave tenga su propio tope de gasto en el panel del proveedor.
- **Compatibilidad:** que el endpoint compatible de un proveedor exista no prueba que soporte cada
  capacidad (§2). Por eso cada función se habilita solo después de pasar su prueba.

## 8. Fuera de alcance

- La cadena de fallback de la Oficina (SDD-0626 §7) y el proveedor del agente `soporte-chatwoot`.
- Elegir el modelo «mejor» por calidad: eso se mide en la evaluación de cada función.
- Comprar o crear cuentas en proveedores nuevos: lo hace Sam en cada panel.

## 9. Decisiones

### 9.1 Decididas por Sam (2026-11-16)

- **D-1 · Predeterminado:** GLM como principal y DeepSeek como respaldo. Sam puede cambiarlo, por
  ejemplo a Anthropic si tiene esa suscripción (§3, puntos 4 y 6).
- **D-2 · Datos de clientes:** nunca van a un proveedor chino. Solo el código, el Shipping Mark (§4).
- **D-3 · Modo:** cambio automático, con opción manual (§3, punto 4).
- **D-6 · Quién cambia:** el superadministrador. El permiso se puede dar a una persona concreta desde
  Usuarios › Acceso, como un permiso nuevo (§3, punto 5).
- **D-4 · Por dónde se empieza:** por **noticias web (A1)** y después por el **brief (A2)**, en el
  orden de §5. Lo aprobó Sam con «Sí, así».
- **D-5 · Agentes y Skills:** **queda fuera de esta spec y sigue en Anthropic**, porque sus
  herramientas devuelven nombre y dirección del cliente (regla D-2). Si algún día hace falta un
  respaldo, tendrá que ser un proveedor no chino, en su propia spec. Lo aprobó Sam con «Sí, así».
- **D-7 · Llaves nuevas:** se pegan **desde la pantalla**, guardadas en Supabase Vault. Solo las
  carga el superadmin con dos pasos, son de solo escritura y la variable de entorno queda de respaldo
  (§3, punto 7). Lo eligió Sam: «Desde la pantalla».
