---
sdd: "0474"
title: "Guía de Alibaba — Shipping Mark conectado, costo real con tarifa viva y servicios plegados"
status: done
author: "founder + Claude Code"
created: 2026-09-17
updated: 2026-09-17
supersedes: null
superseded_by: null
related: ["0099", "0264", "0046", "0093"]
confidencialidad: interno
---

# DTD-0474 — La guía de Alibaba deja de pedirle al cliente lo que ya sabemos

> La guía interactiva llevaba meses viva con el término viejo, un campo de código
> abierto a cualquier invención, una calculadora que pedía impuestos que no
> aplican, y diez ofertas de servicio interrumpiendo a quien está aprendiendo a
> comprar. Esto lo cierra, y de paso deja rastro de por qué puerta entró cada
> cliente que se registra.

## Contexto

`public/guias/comprar-en-alibaba.html` (SDD-0099) es el lead magnet de la
Academia: nueve etapas, diez bloques de servicio, dos calculadoras y captura
progresiva. Es un **HTML suelto en `/public`**: no pasa por el build de Next, ni
por ESLint, ni por `tsc`.

Seis problemas acumulados, todos señalados por el founder el 2026-09-17:

1. **Decía «MARKBOX» 18 veces.** La política del proyecto (BD-029) barrió ese
   término a **«Shipping Mark»** en toda la web pública; la guía nació después y
   quedó fuera. La deuda estaba anotada en
   `docs/specs/0264-direccion-alibaba-en-chino/spec.md:119-120`, aparcada porque
   «vive en otro worktree y tocarlo cruzaría ramas».
2. **El Shipping Mark era un input libre.** Un visitante anónimo escribía
   cualquier cosa y la guía la trataba como código válido. Peor: la **plantilla
   del primer correo al proveedor** era el único bloque que no pasaba por
   `conMark()`, así que incluso el cliente que llegaba del portal con su mark
   copiaba una plantilla sin él.
3. **La calculadora de landed cost pedía arancel, IVA y last mile.** En el
   puerta a puerta DDP esos tres conceptos ya están **dentro** de la tarifa por
   CBM: pedirlos aparte le hacía sumar dos veces lo mismo y adivinar un código
   arancelario que no tiene por qué conocer. Y pedía el flete a mano teniendo la
   tarifa real en la DB.
4. **Los diez bloques de servicio, abiertos**, cada uno con un «Pedirlo por
   WhatsApp» que interrumpe a alguien que todavía está en el paso 2.
5. **Errores de dato:** el mínimo de la compra asistida decía «$50 por orden»
   (eso es el piso de la comisión, no el umbral del encargo), y la dirección de
   China aparecía tres veces, dos de ellas en el momento equivocado.
6. **Ni idea de dónde venía un registro.** Los enlaces iban a `/registro`
   pelados; imposible saber cuánta gente entra por la Academia o por la guía.

## Alcance

Se toca la guía, el registro público (origen del alta), la landing de la
Academia y el copy del FAQ que la describe. **No** se toca el esquema de la DB,
ni el dominio interno (`clients.markbox`, `?mark=`, `lib/guia-alibaba.ts`), ni
la tarifa en sí.

## Diseño

### 1 · «MARKBOX» → «Shipping Mark»

Barrido de las 18 apariciones **visibles y de comentario**. Los identificadores
internos quedan intactos: `lead.markbox`, `URL_MARK`, `MK_SHOW`, `HAS_MARK`,
`?mark=`, `LS_KEY`. El contrato con
[`lib/guia-alibaba.ts`](../../../lib/guia-alibaba.ts) depende de ellos byte a
byte —su propio docblock avisa que si las dos sanitizaciones divergen «el
cliente ve un Shipping Mark distinto del suyo y su caja llega a Yiwu sin poder
identificarse».

Cierra la deuda de SDD-0264.

### 2 · El Shipping Mark, presente y no inventable

- **`markBloqueHTML()`** — bloque nuevo, compartido por las dos tarjetas de
  dirección. Con mark real (viene del portal por `?mark=`) muestra el campo
  **bloqueado**. Sin mark **no hay campo**: hay un placeholder inerte
  `DTD-XXXX` y dos puertas — «Regístrate y obtén el tuyo» a
  `/registro?origen=guia-alibaba`, y «Ya soy cliente» a `/portal/academia`,
  donde [`GuiaAlibabaCard`](../../../components/GuiaAlibabaCard.tsx) reabre la
  guía ya con su mark.
  > La segunda puerta evita la regresión: antes un cliente no logueado podía
  > teclear su código; al cerrar el campo necesita un camino, y ese camino ya
  > estaba cableado.
- **La plantilla del proveedor** pasa por `conMark()` (texto, glosario y lo que
  va al portapapeles) y suma la línea que hace identificable la caja:
  `my shipping mark is {MARK} — please mark it on every carton`.
- **`dtdcargo.com/registro` del Paso 7** era `<b>texto</b>`: parecía clickeable
  y no lo era. Ahora es un `<a>` real. Estilo: se promueve el patrón que ya
  usaba `.dir-mark .h a` a una regla `.bloque p a` (wine `--marea`, negrita,
  subrayado). La guía **no tiene azul** —su acento es wine y el navy es
  `--abismo`—, así que un azul de navegador habría roto la marca.

### 3 · Costo real con la tarifa viva

- **Endpoint nuevo `GET /api/public/cbm-rate`** — envuelve
  `getPublicCbmRate()` (RPC anon `public_cbm_rate`) y devuelve exactamente
  `{ per_cbm, min_charge, valid_until }`. Nunca 500: si la RPC falla responde
  200 con `per_cbm: null` y la guía usa su fallback.
  `Cache-Control: s-maxage=300`, el mismo horizonte que `/tarifas/embed`.
  `app/api/**` está fuera de la frontera ESLint público↔ERP.
  > **Por qué no cablear el número:**
  > `supabase/migrations/0336_rate_ddp_850_septiembre_2026.sql` programó con
  > `pg_cron` el relevo $800 → $850 vigente 2026-09-04 → 2026-10-04, y su
  > cabecera avisa que el **2026-10-05 cae sola a $800** si nadie la renueva
  > desde `/studio/tarifas`. Una cifra copiada al HTML empezaría a mentir en
  > tres semanas sin que nadie lo note.
- **Formulario:** fuera `#lcA` (arancel), `#lcI` (IVA) y `#lcO` (otros/last
  mile). Queda FOB unidad + cantidad + **CBM del pedido** (`#lcCbm`), que se
  **prellena** con `lead.cbm.total` si ya usó la calculadora de CBM del Paso 2.
  Sin tarifa del ERP reaparece el campo de flete manual.
- **Fórmula:** `flete = max(CBM × per_cbm, min_charge)`;
  `total = FOB×unidades + flete`; `unidad = total / unidades`.
- **La regla del peso, contada por fin — y en 500 kg/m³, no en 1.000.** Un `tip`
  antes de la calculadora dice que se cuenten **500 kg por metro cúbico** y que
  por encima puede haber recargo.
  > **Discrepancia deliberada con el motor.** `lib/calculadora.ts` cobra hoy con
  > `pesoIncluidoKg: 1000`, pero **eso es una excepción temporal** (founder,
  > 2026-09-17): la regla de la casa son 500. La guía promete la regla, no la
  > excepción, para no quedar debiendo el día que se retire. La diferencia va en
  > la dirección segura: la guía queda **conservadora** frente a lo que cobra
  > `/tarifas` —un cliente con 800 kg/m³ leerá acá que podría haber recargo y en
  > la cotización real no lo habrá—, nunca al revés. Por eso el 500 va cableado y
  > **no** sale del endpoint de configuración: no es el valor vigente, es el que
  > queremos prometer.

  El disclaimer del resultado nombra lo que mueve el número: peso, embalaje
  especial, baterías (×1,3) y cajas de tamaños distintos al consolidar, y aclara
  que lo que calcula es el **flete base** —sin recargos ni entrega nacional—,
  enlazando `/tarifas` para el cálculo completo. Las dos superficies salen de la
  misma RPC `public_cbm_rate`, pero `calcularEnvioLCL` suma lo que la guía no:
  decirlo evita que parezcan contradecirse.

### 4 · Servicios plegados y sin venta

`servicioHTML()` pasa de `<div>` a **`<details>` cerrado**, con el título propio
en el `<summary>` para que se sepa de qué es sin abrirlo. `<details>` nativo:
cero JS, accesible de fábrica, `:focus-visible` explícito.

Se retiran los **diez** «Pedirlo por WhatsApp» y los diez campos `wa:`. Queda un
solo CTA, el enlace «Ver», promovido a primario. El WhatsApp del pie se queda.

**Mensajes prearmados retirados** (registro, por si hay que recuperarlos):

| Bloque | Mensaje |
|---|---|
| Paso 2 · Compra asistida | «quiero cotizar Compra asistida / sourcing. Mi producto es:» |
| Paso 3 · Verificar proveedor | «tengo dudas con un proveedor de Alibaba y quiero verificarlo. El proveedor es:» |
| Paso 4 · Compran por mí | «ya tengo proveedor en Alibaba y quiero que ustedes compren por mí. El proveedor es:» |
| Paso 5 · Courier de muestras | «necesito enviar una muestra desde China. Es:» |
| Paso 5 · Inspección en producción | «quiero cotizar una inspección durante la producción. Mi producto es:» |
| Paso 6 · Pagos | «necesito asesoría para pagarle a un proveedor en China.» |
| Paso 6 · Verificación de crédito | «quiero una verificación de crédito de un proveedor antes de pagarle. El proveedor es:» |
| Paso 7 · Servicios de recepción | «mi mercancía va en camino a la bodega de Yiwu y quiero pedir servicios de recepción (revisión / etiquetado / reempaque).» |
| Paso 7 · Pre-embarque | «quiero cotizar una inspección pre-embarque. Mi pedido es:» |
| Meta · Cierre | «terminé la guía de Alibaba y quiero hablar de mi importación.» |

### 5 · Dato y contenido

- **Compra mínima $1.000** reemplaza «Mínimo $50 por orden» en las **dos** tablas
  de comisión (Paso 2 · sourcing 10→3% y Paso 4 · ya-tienes-proveedor 5→1,5%).
  Decisión del founder 2026-09-17: los $50 eran el piso de la comisión, no el
  umbral del encargo.
- **La dirección, una vez por propósito:**

  | Etapa | Qué hace ahí | Qué ve |
  |---|---|---|
  | Inicio | nada todavía | solo la promesa, sin dirección |
  | Paso 1 | llena el formulario de Alibaba | la tarjeta de 10 campos, copiar por campo + atajo de autocompletado (**intacta**) |
  | Paso 7 | le pasa la dirección al proveedor por chat | **`direccion-completa`**: la dirección de una pieza, destinatario, teléfono y **un solo «Copiar todo»** |

  El string suelto de Inicio (`DIRECCION`/`dir`) se elimina: omitía `金华市`
  (Jinhua) frente a la tarjeta del Paso 1 —desfase documentado en
  `research/INVESTIGACION-curso-alibaba.md` §2.9— y dejarlo invitaba a reusar la
  versión incompleta. La cadena buena vive en una constante única,
  `DIR_AUTOFILL`, espejo de `CONTACT.cn.addressAutofillCjk`.
- **«Pide el precio FOB o EXW» → «puesto en NUESTRA bodega de Yiwu»**, la jerga
  de plaza («FOB Yiwu») con su contenido real explicado: flete interno de China
  por cuenta del proveedor. Se mantiene la tabla de Incoterms para el término
  exacto, y se dice qué **no** conviene pedir (DDP a su puerta: ahí el proveedor
  le cobra un flete que ya es nuestro). Coherente con el principio 4 de
  SDD-0099.
- **Control de calidad con enlaces reales.** El bloque describía dos cosas sin
  decir cómo se piden. Ahora nombra que la revisión de la muestra y el QC del
  pedido completo son **el mismo servicio en dos momentos** —«Revisión al
  recibir», que se pide en la pre-alerta e incluye el conteo contra factura— y
  lo distingue de la inspección en fábrica, reusando el lenguaje de
  `components/servicios/hub-fichas.tsx:259-275`.

### 6 · De qué puerta viene cada registro

`clients.registration_channel` es `text not null default 'admin'` **sin CHECK**
(migr 0092), y el alta self-service escribía `"portal"` fijo (SDD-0046).
**No hace falta migración** — pero sí un allowlist.

- **`lib/public/registro-origen.ts`** — `normalizarOrigen()` valida contra
  `['portal','academia','guia-alibaba']`, tolerante en la forma (recorta, baja a
  minúsculas, `_`→`-`) y estricto en el fondo. Todo lo demás cae a `'portal'`.
  Nunca tira: un querystring raro no puede impedirle a nadie registrarse.
- **Cableado** igual que `?est=` y `?ref=`: `page.tsx` lee y normaliza →
  `RegisterForm` lo lleva en un hidden → `actions.ts` lo escribe.
  Se normaliza **otra vez en la action**: el formData llega del navegador y es el
  último punto antes de escribir en el ERP. `'admin'` no se puede declarar desde
  la web, así que un alta pública no puede disfrazarse de alta interna.
- **Emisores:** la guía (`origen=guia-alibaba`) y la landing de la Academia
  (`origen=academia`, CTA de registro nuevo junto al form de lead, que sigue
  intacto porque manda a `/api/contact` y no crea cliente).

`select registration_channel, count(*) from clients group by 1` responde la
pregunta sin tocar el esquema.

### 6d · El cierre de la guía lleva al registro

El formulario final abría WhatsApp. Ahora el botón es **«Crear mi cuenta y
obtener mi Shipping Mark →»** hacia `/registro?origen=guia-alibaba`: el cliente
pasó nueve etapas viendo `DTD-XXXX` y aquí obtiene el suyo.

**Los datos que ya escribió no se pierden y no viajan por la URL.** Nombre y
WhatsApp van por el `localStorage` que la guía ya usaba (`dtd_guia_alibaba_v1`);
`/guias/*.html` y `/registro` comparten origen, así que es la misma caja.
`RegisterForm` la lee en un efecto (el servidor no ve el localStorage: leerlo en
el initializer rompería la hidratación) y **solo rellena lo que esté vacío**.

> Meter nombre y teléfono en el querystring era lo fácil y está descartado: son
> datos personales y acabarían en logs, en el historial y en el `Referer`.

### 7 · La red que faltaba: `scripts/check-guia-alibaba.ts`

La guía no pasa por build, ESLint ni `tsc`. Durante esta misma implementación se
introdujo un error que la habría dejado **en blanco en producción** —un
`<a href="...">` con comillas dobles dentro de un string delimitado por comillas
dobles— y solo se vio porque se corrió un check ad hoc. De ahí que el check
quede en el repo:

- comprueba que cada `<script>` sea JS válido (`node --check`);
- fija los invariantes (el mark del portal, `conMark`, la dirección en chino, el
  destinatario `林冠`, la llamada a `/api/public/cbm-rate`);
- y que no reaparezca lo retirado (`MARKBOX`, «Pedirlo por WhatsApp»).

Se corre a mano con `pnpm guia:check` y entra en `pnpm verify` vía
`__tests__/guia-alibaba-html.test.ts`, cuyo último caso es un **control del
propio detector**: rompe la guía a propósito de tres formas y exige que el check
las vea. Sin ese control, un `revisar()` que devolviera `[]` a ciegas pasaría
por verde para siempre.

### 8 · La calculadora, ejecutada de verdad

`__tests__/guia-alibaba-calculadora.test.ts` **carga la guía en jsdom y la
corre**. Un test que sólo mirase el texto del HTML no probaría que *calcula
bien*, y el número que sale de ahí es con el que un cliente decide si un negocio
le da o no.

Montaje: `runScripts: "outside-only"` deja el script sin ejecutar; se prepara el
entorno (`matchMedia` y `Element.animate`, que jsdom no trae) con el `fetch`
simulado; se corre el script **una vez** con `window.eval` —reinyectarlo en un
DOM ya arrancado duplicaría cada `const`— y se avanza por la UI esperando a que
el DOM confirme cada cambio de etapa, porque `completarEtapa` tiene un
`setTimeout` de 650 ms que **no** depende de `prefers-reduced-motion`.

Fija el caso de referencia —**FOB $3 × 500 unidades × 2 m³ → $6,40 la unidad**—,
el mínimo cobrable, la ausencia de arancel/IVA/last mile, y los dos caminos de
fallo (sin tarifa vigente y con el `fetch` caído, donde **no se inventa ningún
número**). Añade `@types/jsdom` como devDependency; `jsdom` ya estaba.

### Lo que encontró la revisión visual

El botón «Regístrate y obtén el tuyo» se pintaba como un **rectángulo wine sin
texto**: la regla preexistente `.dir-mark .h a` (especificidad 0-3-0) le ganaba
a `.dir-mark .mk-prim` (0-2-0), dejando texto wine sobre fondo wine. Arreglado
con `.dir-mark .h .mk-puertas a.mk-prim` y comentado en el CSS. Ningún test de
texto lo habría visto: hacía falta abrir la página.

## Fuera de alcance

- **`supabase/migrations/0393_academia_widget_alibaba_curso.sql` sigue sin
  aplicar a producción.** Una lección con `widget='alibaba_curso'` revienta el
  CHECK `academy_lessons_widget_chk`. Necesita el OK del founder nombrándola y
  el [runbook de producción](../../runbooks/aplicar-migraciones-prod.md).
- **`syncLead()` sigue siendo un `console.log`.** Perfil, nombre, WhatsApp, CBM,
  landed y scorecard se capturan y mueren en `localStorage`. El precedente de
  `/api/public/estimacion` dice que el visitante no registrado **no** genera
  filas en el ERP (founder 2026-07), así que conectarlo es otra decisión.
- **`tarifaBaseCBM: 800` en `lib/calculadora.ts:66`** está desalineado del $850
  vivo **a propósito** según la migr 0336. No se toca: tiene dueño.
- **La guía no está en `app/sitemap.ts`.**
- **La dirección de Yiwu sigue hardcodeada** en la guía en vez de venir de
  `CONTACT.cn`. Es inherente a ser un HTML estático sin build; ahora al menos
  está en **una** constante y no en tres literales.

## Adjuntos

Sin adjuntos. Las capturas del founder que originaron el encargo están en la
conversación de la tarea.
