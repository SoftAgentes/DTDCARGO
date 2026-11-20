---
sdd: "0693"
title: "La aceptación de T&C limita el portal, no la facturación"
status: approved
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0054", "0067", "0169", "0191", "0543", "0549", "0674", "0690"]
confidencialidad: interno
---

# SDD-0693 — La aceptación de T&C limita el portal, no la facturación

> **Decisión de Sam (2026-11-20):**
> - La aceptación de T&C no puede parar la facturación ni la contabilidad: el ERP factura normal.
> - Lo que se limita es el portal del cliente. Al entrar ve un aviso insistente para aceptar. Hasta que
>   acepte, no ve su seguimiento ni su estado de cuenta.
> - Al aceptar le llega un correo de confirmación con un hash del acto y un acuse de recibo.
>
> **Aprobada por Sam el 2026-11-20, por Dir_DTD: «Apruebo la 0693».**
>
> **Sam contestó las 11 preguntas el 2026-11-20, por Dir_DTD** (§10). En todas eligió la propuesta
> recomendada. Lo único pendiente es la revisión del abogado (§6): el texto del correo, la cláusula 13.1 y
> el plazo de retención.
>
> Esta spec es solo un documento. No trae código ni migración. Los números de migración los asigna Dir_DTD
> cuando se implemente.

## 1. Qué cambia en una línea

Hoy la puerta AUT-04 bloquea **la emisión** de una factura DDP sin aceptación. Con esta spec, la puerta
pasa al **portal**: se factura siempre, y lo que espera la aceptación es la vista del cliente.

## 2. Lo medido en main (`85ee08b76`)

### 2.1 La puerta AUT-04 en la emisión (SDD-0054)

- La regla la define la SDD-0054 (`docs/specs/0054-capa-legal/spec.md:285`). La factura DDP no se emite sin
  una aceptación de T&C vigente del cliente.
- `evaluateLegalGate` está en `app/studio/(app)/facturacion/actions.ts:299`. Solo aplica si el envío es
  `puerta_a_puerta_DDP` (`:321`). Busca una aceptación con `hasValidAcceptanceForMarkbox` (`:328`) que cuadre
  con:
  - el Shipping Mark;
  - el CBM y el peso del envío;
  - el total sin IVA (`base_amount`);
  - la orden (`shipment_code`).
- **Crear y emitir** (`createInvoice`, `:393-403`). Si la puerta está en bloqueo duro y no hay aceptación,
  la factura nace en borrador.
- **Emitir un borrador** (`emitInvoice`, llamada en `:611`). Con `LEGAL_GATE_HARD_BLOCK` rechaza y no ofrece
  override (`:617-625`). La rama advisory (`:626-633`) solo corre con la constante en `false`.
- `LEGAL_GATE_HARD_BLOCK = true` está en `lib/studio/legal/gate-config.ts:35`. La declaran
  `scripts/feature-constants.json:49` y el banner de modo del Studio (`app/studio/(app)/admin/page.tsx:417`,
  `app/studio/(app)/legal/_components/LegalClient.tsx:94`).
- `hasValidAcceptanceForMarkbox` (`lib/studio/legal/queries.ts:483`) exige cuatro cosas:
  - el tenant explícito;
  - el hash recomputado desde la fila (`rowHashVerified`, `:303`);
  - que cubra todos los documentos vigentes de cara al cliente (`coversCurrentDocs`, `:535`);
  - que la medida coincida.
- **`legal_ack` en la emisión normal.** En `facturacion/actions.ts` solo aparece en comentarios (`:389`,
  `:609`). Con el bloqueo duro no se escribe en ningún lado. El detalle de la factura conserva el centinela
  del modo advisory (`InvoiceDetailClient.tsx:97`).

### 2.2 La EXC-0674 y su ampliación en la SDD-0690

- El registro está en `docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md`.
  - Su §6 (`:75-87`) aparta la AUT-04 para la RPC `exc0674_facturar`, solo para la lista transitoria.
  - Cada factura lleva `legal_ack = 'exc_0674'` en `exc0674_facturas` y en `entity_audit_log`.
  - Revisión: 2027-01-31.
- La migración 0564 fija la marca con una restricción: `legal_ack text not null default 'exc_0674' check
  (legal_ack = 'exc_0674')` (`supabase/migrations/0564_exc0674_facturar_contenedor.sql:197`). El evento de
  auditoría está en `:549`.
- La SDD-0674 explica por qué existe la excepción (§3.1 a, `docs/specs/0674-boton-facturar-embarques/spec.md:117-142`).
  Los envíos del 64 entraron por la carga de consolidados y no tienen una aceptación ligada a una cotización.
- La SDD-0690 (PR #719, en borrador, cabeza `a0461447`, §3.4) amplía la EXC-0674 a «emitir la pre-orden» y
  a «Facturar todo». La ampliación vale **mientras la 0693 no cambie formalmente la AUT-04**.
- **Lo que no toca la AUT-04.** Las otras excepciones de la EXC-0674 (§1 a §4: vocabulario «Facturar»,
  diálogo propio y R3 sin motivo tecleado) son del botón, no de lo legal. Esta spec no las cambia.

### 2.3 Lo que ya existe de aceptación de T&C

| Pieza | Dónde | Qué hace |
|---|---|---|
| `legal_docs` | `supabase/migrations/0102_capa_legal.sql:50-76` | Documentos versionados por `(tenant, key, version)`, con a lo sumo una vigente por `key` |
| Huella del cuerpo | `0297_legal_docs_body_hash.sql:36-40` y `legal_docs_guard` `:61` | El servidor sella `body_sha256` y el documento publicado no se edita |
| `legal_acceptances` | `0102_capa_legal.sql:86-109`; columnas v2 en `0121_acceptance_evidence_v2.sql:40-43` | Aceptación con código `AC-AAAA-NNNN`, documentos aceptados, medida, `accepted_at`, `ip`, `user_agent`, declaración de comerciante y hash |
| Solo inserción | `0102_capa_legal.sql:125-138` | Un trigger rechaza `UPDATE` y `DELETE` |
| Sello | `lib/studio/legal/seal.ts:41` (evidencia v3), `:52` (`hashEvidence`), `:142` (`sealAcceptance`) | SHA-256 del payload canónico, sellado en el servidor |
| Acción del portal | `app/portal/(app)/facturas/[code]/aceptar/actions.ts:67` | Acepta **una orden**: borrador DDP, monto exacto y medida. El `user_agent` sale de los headers (`:155`) y la IP del edge (`:210`) |
| Aviso de «por aceptar» | `lib/portal/pending-acceptance.ts:49`; portada `app/portal/(app)/page.tsx:103` y `:137` | Muestra las facturas en borrador que esperan aceptación (SDD-0543) |
| Textos | `lib/studio/legal/acceptance-copy.ts:122`; `docs/legal/COPY_LEGAL_UI.md:23` | El pie dice «conforme a la Ley sobre Mensajes de Datos y Firmas Electrónicas» |
| Puerta de verificación | `lib/portal/verify-gate.ts:27`; uso en `app/portal/(app)/documentos/page.tsx:48` | Precedente: cierra módulos en el servidor, página por página, con una pantalla propia |
| Correo | `lib/studio/mail/send-email.ts:9-11` | Guarda cada envío en `mail_log`, con el id de Resend |
| Términos públicos | `lib/legal-public.ts:16` (`TERMINOS_LIVE = false`), cláusula 13.1 en `:81` | El texto no está publicado. La 13.1 dice que se acepta «al confirmar cada cotización» |
| Registro | `app/registro/RegisterForm.tsx:877-889` | No pide aceptar los T&C. El opt-in de correos va aparte |

**Conclusión.** Hoy toda aceptación es **por orden** y está atada al monto. No existe una aceptación
general del cliente. La 0693 la crea sin tocar las filas que ya existen.

## 3. El cambio de la política AUT-04

### 3.1 La regla nueva

| | Hoy (SDD-0054) | Con la 0693 |
|---|---|---|
| Dónde se exige | En la emisión de la factura DDP | En el portal del cliente |
| Qué se acepta | Una orden: monto, medida y documentos vigentes | Todo: el Acuerdo de Servicios completo y los documentos vigentes de cara al cliente, incluidas las condiciones del puerta a puerta (DDP), una vez por versión. Se aplican después a cada orden que se le facture (decisión 11) |
| Qué bloquea | Emitir la factura | Ver el seguimiento y el estado de cuenta en el portal |
| Qué no bloquea | — | Facturar, contabilizar, cobrar, enviar la factura por correo |

- **Sale de la emisión, desde la fase 1.** `createInvoice` y `emitInvoice` dejan de llamar a
  `evaluateLegalGate` y, con eso, a `hasValidAcceptanceForMarkbox`. No hay bloqueo, aviso ni override. La
  factura DDP se emite como cualquier otra. `hasValidAcceptanceForMarkbox` sigue existiendo solo para la
  acción de aceptar por orden del portal, hasta que se retire en la fase 4.
- **Entra al portal.** La aceptación general del cliente (§5) abre el seguimiento y el estado de cuenta (§4).
- **Se retira la constante `LEGAL_GATE_HARD_BLOCK`.** Se borra de `gate-config.ts` y de
  `feature-constants.json`. El banner de modo de `/studio/legal` dice: «La aceptación de T&C se exige en el
  portal del cliente. No frena la facturación.» Apagarla y dejarla viva no sirve: la rama advisory pediría
  un override en cada factura DDP.
- **Queda un rastro informativo.** El evento de emisión agrega `tyc_portal`. Solo se registra; no decide
  nada. Así se puede listar lo que se emitió con el cliente sin aceptar.
  - **En la fase 1 vale siempre `pendientes`.** Todavía no existen la columna `alcance` ni el cálculo de
    §4.4, y ninguna aceptación por orden cuenta como aceptación general.
  - **Desde la fase 2** sale del cálculo de §4.4 y puede valer `aceptados` o `pendientes`.
- **La aceptación por orden se retira** (decisión 11) en la fase 4 (§7):
  - la ruta `/portal/facturas/[code]/aceptar`;
  - `PendingAcceptanceCard` y `PendingInvoiceGate`;
  - `lib/portal/pending-acceptance.ts`.

  Las filas de `legal_acceptances` que ya existen no se tocan: son evidencia y la tabla es de solo inserción.

### 3.2 La EXC-0674 y la marca `legal_ack`

- **Se retira el §6 de la EXC-0674** el día que la fase 1 llega a producción. Con la regla nueva, la emisión
  ya no exige aceptación, así que ya no queda nada que exceptuar.
- **La marca `legal_ack = 'exc_0674'` se conserva.** La 0564 está aplicada y no se edita. La marca queda en
  las filas como rastro histórico. A partir de esa fecha significa «emitida por la regla transitoria 0674»,
  no «emitida sin aceptación por excepción». La restricción `check` de la 0564 sigue igual, y no hace falta
  una migración.
- **La SDD-0690.** Si la fase 1 se publica antes que la 0690, la 0690 ya no necesita ampliar la EXC-0674:
  su §3.4 se reduce a una nota que apunte aquí. Si la 0690 llega primero, su ampliación se retira junto con
  el §6. Dir_DTD serializa las dos PR.
- **Las excepciones §1 a §4 de la EXC-0674 siguen vigentes.** Mantienen su alcance y su revisión del
  2027-01-31.

### 3.3 El registro de gobernanza

- **Lo medido.** La AUT-04 no tiene fila en el registro maestro de `docs/governance/README.md`: no es una
  política de experiencia, es una regla legal de producto de la SDD-0054. Solo la nombra el §6 de la
  EXC-0674. Las filas SGE-00, MP-01 y BTN-01 (`README.md:68-70`) citan la EXC-0674 por el botón, no por la
  AUT-04.
- **Clasificación del cambio:**
  - es un cambio **L2** (§7 del índice): cambia lo que hace una regla aprobada;
  - toca lo legal, que está en el nivel 1 de la jerarquía (§5 del índice);
  - lo aprueba Sam, con la revisión del abogado (§6).
- **En la PR de la fase 1:**
  1. En el documento de la EXC-0674, el §6 pasa a «Retirada el AAAA-MM-DD por la SDD-0693: la emisión ya no
     exige aceptación». La frase del alcance común se ajusta.
  2. Las filas SGE-00, MP-01 y BTN-01 del registro (`README.md:68-70`) siguen citando la EXC-0674 por el §1
     al §4, y agregan la nota «§6 AUT-04 retirado por SDD-0693» (decisión 9).
  3. La SDD-0054 recibe una nota: su §3.1 (puerta en la emisión) queda reemplazado por la 0693. Su
     `status` no cambia.
  4. Correr `governance:check`.
- **Cómo se clasifica la evidencia:**

| Regla | Antes de la fase 1 | Después de la fase 1 |
|---|---|---|
| AUT-04 en «Facturar» del 64 | excepción (EXC-0674 §6) | cumplimiento (ya no exige aceptación en la emisión) |
| AUT-04 en Facturación | cumplimiento (bloqueo duro) | cumplimiento de la regla nueva |
| AUT-04 en el portal | no aplica | cumplimiento cuando la fase 3 esté encendida; hasta entonces, «no aplica hasta la fase 3» |

## 4. El portal cuando el cliente no ha aceptado

### 4.1 Estados

| Estado | Cuándo | Qué ve |
|---|---|---|
| `aceptados` | Hay una aceptación general íntegra que cubre todos los documentos que exige `documentosEfectivos` (§4.4) | Todo el portal |
| `sin_aceptar` | Nunca aceptó | El aviso (§4.2) y los módulos cerrados (§4.3) |
| `version_anunciada` | Aceptó la versión anterior y la nueva ya está publicada, pero todavía no entra en vigencia (§5.3) | Todo el portal, con una franja informativa que se puede cerrar |
| `version_nueva` | Aceptó una versión anterior y la nueva ya entró en vigencia por fecha, aunque el cron todavía no la haya activado (§4.4) | Igual que `sin_aceptar`, con el texto de versión nueva |
| `sin_documentos` | El tenant no tiene documentos vigentes de cara al cliente | Todo el portal, sin aviso, y el Studio lo señala en `/studio/legal`. Es un cambio de criterio deliberado (§4.4) |
| `no_comprobado` | Falló la lectura | Los módulos cerrados muestran «No pudimos comprobar tu aceptación. Prueba de nuevo en un rato.» Falla cerrado, pero sin aviso de aceptar |

### 4.2 El aviso

Es insistente sin atrapar al cliente. Tiene tres capas:

1. **Al entrar.** En cada sesión nueva, y hasta que acepte, la primera pantalla del portal es la de
   aceptación (§4.5). Tiene dos botones: «Leer y aceptar» y «Ahora no». «Ahora no» lleva a la portada con
   los módulos cerrados.
2. **En todas las páginas.** Una franja fija arriba, que no se puede cerrar:
   - **Título:** «Acepta los términos para ver tus envíos y tu estado de cuenta»
   - **Texto:** «Tu carga y tu facturación siguen su curso normal. Para verlas aquí, lee y acepta el
     Acuerdo de Servicios.»
   - **Botón:** «Leer y aceptar»
3. **En cada módulo cerrado.** Una pantalla propia, como `PortalVerifyGate`:
   - **Seguimiento:** «Tu seguimiento se activa al aceptar los términos» / «Lee el Acuerdo de Servicios y
     acéptalo para ver aquí dónde está tu carga.»
   - **Estado de cuenta:** «Tu estado de cuenta se activa al aceptar los términos» / «Lee el Acuerdo de
     Servicios y acéptalo para ver aquí tus facturas, tus pagos y tu saldo.»
   - Botón principal «Leer y aceptar», y uno secundario «Hablar con tu asesor», que lleva a Mensajes.
   - La pantalla del estado de cuenta suma un tercer botón, «Reportar un pago» (decisión 4, §4.3).

En el estado `version_nueva`, el título de la franja es «Actualizamos el Acuerdo de Servicios» y el texto
dice «Para seguir viendo tus envíos y tu estado de cuenta, lee y acepta la versión {versión}, vigente desde
{fecha}.» Se reutiliza el aviso de reaceptación de `acceptance-copy.ts`.

En el estado `version_anunciada`, la franja es informativa y se puede cerrar: «Actualizamos el Acuerdo de
Servicios. La versión {versión} entra en vigencia el {fecha}. Acéptala antes de esa fecha para seguir
viendo tus envíos y tu estado de cuenta.» Botón «Leer y aceptar».

### 4.3 Qué se cierra y qué no

| Se cierra (en el servidor) | Ruta o pieza |
|---|---|
| Seguimiento | `/portal/envios`, `/portal/envios/[code]` |
| Seguimiento en la portada | Actividad reciente, tarjetas de envíos y naviera (`app/portal/(app)/page.tsx`) y la vista simple (`_simple/InicioSimple`, `lib/portal/simple/*`) |
| Estado de cuenta | `/portal/finanzas`, `/portal/facturas`, `/portal/facturas/[code]` |
| PDF del estado de cuenta y de la factura | `app/portal/(app)/facturas/estado-de-cuenta/pdf/route.ts`, `app/portal/(app)/facturas/[code]/pdf/route.ts` |

| Sigue abierto | Por qué |
|---|---|
| Perfil, Mensajes, Soporte y Reclamos | El cliente nunca queda sin canal. Es también el camino para pedir sus datos (§5.5, habeas data) |
| El texto de los términos y la pantalla de aceptación | Es lo que tiene que leer |
| Constancias de aceptación (§5.4) | Son su prueba |
| Compras y Documentos | Decisión 3: quedan abiertos |
| Cotizaciones, Estimados, Proveedores, Academia, Club y Referidos | No son seguimiento ni estado de cuenta |
| Reportar un pago | Decisión 4: la cobranza no se frena. Hoy el reporte vive en el detalle de la factura (`app/portal/(app)/facturas/[code]/_components/InvoicePaymentReports.tsx`). Con el estado de cuenta cerrado, se ofrece desde la pantalla de la puerta, sin mostrar saldos ni la lista de facturas |

- **La puerta se aplica en el servidor.** Cada página y cada ruta de PDF consulta el estado (§4.4) antes de
  leer datos. El candado del menú solo señala. Sigue el patrón de `verify-gate.ts`, en un módulo puro
  `lib/portal/tyc-gate.ts`.
- **Es una puerta de experiencia y de contrato, no de seguridad.** La RLS del portal no cambia: los datos
  son del cliente. No se agrega una policy nueva.
- **Fuera del portal no cambia nada** (decisión 5). Siguen saliendo:
  - los correos y avisos push de seguimiento;
  - el correo de la factura emitida;
  - los mensajes por WhatsApp.

### 4.4 Cómo se calcula el estado

Una función pura `estadoTycPortal(aceptaciones, vigentes, programadas, hoy)` devuelve un estado de §4.1.
Nace en la fase 2.

- **La lectura** va por el principal del portal (`getPortalClientPrincipal`), con tenant y cliente
  explícitos, como en la SDD-0549.
- **Valen las mismas reglas que en `acceptanceRowValid`:**
  - el hash se recomputa desde la fila;
  - la aceptación tiene que cubrir todos los documentos que exige `documentosEfectivos`, no solo los que
    están en `vigente`.
- **Los documentos que se exigen** salen de una función pura, `documentosEfectivos(vigentes, programadas,
  hoy)`. La usan `estadoTycPortal`, la emisión y la pantalla de aceptación:
  - una `programada` con `effective_date` menor o igual a hoy **cuenta como vigente**, aunque el cron todavía
    no la haya activado. Reemplaza a la vigente de su misma clave y a las claves que declare en
    `reemplaza` (§5.3);
  - una `programada` con `effective_date` posterior a hoy no se exige todavía.
- **El período anunciado (§5.3).** Si hay una `programada` con `effective_date` posterior a hoy, una
  aceptación que cubre las vigentes da `version_anunciada` y no `aceptados`.
- **Al llegar la fecha** (decisión 7: el portal se cierra cuando la versión entra en vigencia), esa
  aceptación ya no cubre lo que exige `documentosEfectivos` y el estado es `version_nueva`. Eso vale también
  entre las 00:00 y las 00:05 de Caracas, antes de que corra el cron, y si el cron falla. El estado lo
  decide la fecha, no el cron.
- **`hoy` es la fecha de Caracas** (`fechaCaracas`, `lib/shared/fechas-caracas.ts:43`).
- **No mira la medida ni la orden.** Desde la fase 2, la emisión del Studio (§3.1) usa esta misma función
  para escribir `tyc_portal`.
- **Sin documentos vigentes, el portal queda abierto.** Es un cambio de criterio deliberado.
  `hasValidAcceptanceForMarkbox` falla cerrado en ese caso (`queries.ts:492`), y en la emisión tenía
  sentido: sin documentos no hay nada que acredite una aceptación, y la factura DDP no salía. Aquí cerrar
  le quitaría a todos los clientes su seguimiento y su estado de cuenta por un error de configuración del
  Studio, sin que exista un texto que puedan aceptar. Por eso se abre, se señala en `/studio/legal` y queda
  `tyc_portal = pendientes` en la emisión. Mientras la bandera de la fase 3 esté apagada, el caso no llega
  al cliente.

### 4.5 La pantalla de aceptación

- **Ruta:** `/portal/terminos/aceptar`, siempre abierta.
- **Encabezado:** «Acuerdo de Servicios · versión {versión}, vigente desde {fecha}». Debajo va el texto
  completo, que sale de `legal_docs` vigente.
- **Texto sobre las casillas** (decisión 11): «Al aceptar, aceptas los términos completos, incluidas las
  condiciones del servicio puerta a puerta (DDP). Se aplican a cada orden que te facturemos. No tendrás que
  aceptar cada orden por separado.»
- **Casilla 1:** «He leído y acepto el Acuerdo de Servicios, versión {versión}.» Si hay más documentos
  vigentes, se nombran todos, como en `acceptance-copy.ts`.
- **Casilla 2:** la declaración de comerciante que ya existe (decisión 6).
- Ninguna casilla viene marcada. Las dos son obligatorias y cada una tiene su error.
- **Botón:** «Aceptar los términos», que pasa a «Registrando…» mientras guarda. A la izquierda, «Ahora no».
- **Pie:** «Guardamos la fecha y la hora de tu aceptación, la versión que aceptaste, tu dirección IP, los
  datos de tu navegador y una huella de integridad (hash). Te enviamos una constancia por correo.»
- **Al aceptar:** «Listo. Aceptaste el Acuerdo de Servicios {versión} el {dd/mm/aaaa} a las {hh:mm}. Te
  enviamos la constancia a {correo con la parte central oculta}.» Botón «Ver mis envíos».
- La pantalla pasa por `/ui-check` y cumple A11Y-01, FRM-01, BTN-01 y AVS-01.

## 5. La aceptación

### 5.1 Qué se guarda

Se reutiliza `legal_acceptances`, que ya es de solo inserción, tiene RLS por tenant, su correlativo `AC-` y
el expediente para el abogado. Una migración (el número lo asigna Dir_DTD) agrega tres columnas:

| Columna | Tipo | Para qué |
|---|---|---|
| `alcance` | `text not null default 'orden'`, `check in ('orden', 'portal')` | Separa la aceptación general de las de orden que ya existen |
| `accepted_by` | `uuid`, el usuario de Auth del portal (`PortalClientPrincipal.userId`, `lib/portal/portal-queries.ts:65`) | Quién oprimió el botón. Lo pide la atribución del art. 16 de la ley |
| `copy_sha256` | `text` | Huella de los textos de las casillas que vio el cliente |

Para `alcance = 'portal'`:

- **Van:** `client_id`, `client_markbox`, `docs` (cada uno con `key`, `version` y `body_sha256`),
  `merchant_declaration`, `accepted_at`, `ip` y `user_agent`.
- **Van en `null`:** `quote_code`, `cbm`, `weight_kg`, `total_usd` e `invoice_id`.
- Una prueba SQL comprueba que las filas `orden` no cambian.

**La IP y el agente de usuario se guardan.** Hacen falta: atan el acto a una conexión y a un equipo, y eso
pesa en la sana crítica del art. 17. Ya hay un precedente: la evidencia v2 los usa, la política de
privacidad los declara para esta finalidad (`app/privacidad/page.tsx:98`) y el agente se recorta a 512
caracteres (`lib/studio/legal/types.ts:150`). No se agrega nada más:

- ni geolocalización a partir de la IP;
- ni huella del dispositivo.

### 5.2 De qué se saca el hash

- **Sale de la evidencia v4:** SHA-256 del JSON canónico `{ v: 4, payload }`. El `payload` tiene, en orden
  fijo:
  - `alcance: "portal"`;
  - `client_markbox`;
  - `accepted_by`;
  - `docs` con `key`, `version` y `body_sha256`. El `body_sha256` sella el **contenido** y no solo la
    referencia;
  - `copy_sha256`;
  - `merchant_declaration`;
  - `accepted_at`, en milisegundos, sellado por el servidor;
  - `ip`;
  - `user_agent`.
- **Se calcula en el mismo lugar que hoy.** `hashEvidence` (`seal.ts:52`) suma la rama v4, y el
  recómputo de `rowHashVerified` la reconoce. Las filas v3 se siguen verificando como v3.
- **Lo sella el servidor:** la hora, la IP, el agente y el usuario. El formulario solo trae las dos casillas.
- **La idempotencia** queda en `unique (tenant_id, hash)` y en una comprobación previa: si el cliente ya
  tiene `aceptados`, responde «ya aceptado» sin insertar.

### 5.3 Validez

- Una aceptación `portal` vale mientras cubra todos los documentos de cara al cliente que exige
  `documentosEfectivos` (§4.4).
- **Versión nueva (decisión 7).** El portal se cierra cuando la versión nueva **entra en vigencia**, no
  cuando se publica. La cláusula 13.2 da 72 horas hábiles.
  - La fecha de vigencia es `legal_docs.effective_date`. La puerta solo la lee.
  - Desde que se publica hasta esa fecha, el cliente que aceptó la versión anterior queda en
    `version_anunciada`: ve todo, con la franja informativa (§4.2).
  - Desde esa fecha, pasa a `version_nueva` y el portal se cierra hasta que acepte.
  - La comparación de fechas va en hora de Caracas.
  - La aceptación vieja se conserva como evidencia.
- **Cómo sigue vigente la versión anterior en ese período.** Hoy `legal_docs.status` solo admite `vigente`
  o `archivada` (`0102_capa_legal.sql:59-60`). Hay a lo sumo una vigente por `(tenant, key)`
  (`0102_capa_legal.sql:70-73`). `currentClientDocs` filtra `vigente` (`queries.ts:96`). El guard solo deja
  pasar de `vigente` a `archivada` (`0297_legal_docs_body_hash.sql:90-97`). Por eso hace falta un estado
  nuevo, que se declara en la migración de la fase 2:
  - **`programada`.** La versión nueva se publica como `programada`, con su `effective_date` futura. La
    anterior sigue `vigente` hasta esa fecha. El índice único de una vigente por `key` no cambia.
  - **El guard admite una transición más:** de `programada` a `vigente`, solo con `effective_date` menor o
    igual a hoy en Caracas. Una programada no se edita, igual que una vigente.
  - **Una sola programada por clave.** Se agrega un índice único parcial `on legal_docs (tenant_id, key)
    where status = 'programada'`.
  - **Cuándo se exige `programada`.**
    - El trigger rechaza un insert `vigente` si la clave tiene **cualquier** versión anterior, `vigente`,
      `programada` o `archivada`. No basta con mirar la vigente: el índice `legal_docs_current_uniq`
      (`0102_capa_legal.sql:70-73`) ya impide dos vigentes, y el atajo de la 0213 (`:15`: archivar la
      v3.0 y después insertar la v3.1) quedaría abierto.
    - Solo la primera versión de una clave, sin `reemplaza`, puede entrar `vigente`: no cambia nada que el
      cliente ya haya aceptado.
    - Toda versión siguiente entra `programada`.
  - **Archivar una vigente solo pasa dentro de una RPC.**
    - El guard (`0297_legal_docs_body_hash.sql:90-97`) deja de permitir `vigente → archivada` en cualquier
      momento.
    - Solo lo permite cuando la transacción tiene encendido `set local dtd.legal_docs_rpc = 'on'`. Lo
      enciende `legal_docs_activar_programadas`, y `legal_docs_retirar` para el caso de abajo.
    - Un `UPDATE` suelto de `status`, como el de la 0213 (`:113-120`), se rechaza.
    - El `set local` es un candado de procedimiento, no de permisos. Escribir `legal_docs` sigue limitado
      a quien hoy puede hacerlo.
  - **Retirar una programada (`programada → archivada`)** se permite mientras su `effective_date` sea
    posterior a hoy en Caracas, para corregir una publicación con error. No deja a ninguna clave sin
    vigente, porque la programada todavía no lo es. Desde su fecha ya no se retira: se reemplaza con otra
    versión.
  - **El guard protege también `reemplaza`.** Se suma a los campos que no cambian después del insert
    (`0297_legal_docs_body_hash.sql:75-82`).
  - **Cambio de clave.** Pasa cuando un documento reemplaza a otros, como en la 0213, donde
    `acuerdo-servicios` reemplazó a `tyc` y `operador`.
    - La `programada` declara las claves que reemplaza en una columna nueva, `reemplaza text[]`. Por
      ejemplo, `{tyc, operador}`.
    - Con `reemplaza` no vacío, la versión tiene que entrar `programada` y cumplir las 72 horas hábiles,
      aunque su propia clave sea nueva.
    - **Una clave nueva que reemplaza a otras entra siempre `programada`, con `reemplaza` lleno.** El
      patrón de la 0213 (`:18-21` y `:113-120`: insertar la clave nueva como `vigente` y archivar las viejas
      con un `UPDATE` suelto) ya no funciona. El insert `vigente` de una clave nueva se permite (primera
      versión), pero las viejas siguen vigentes y exigidas, porque archivarlas requiere la RPC.
    - El trigger exige que cada clave de `reemplaza` tenga una `vigente`.
    - La RPC archiva, en la misma transacción, la vigente de la misma clave y las de `reemplaza`, y activa la
      programada.
    - `documentosEfectivos` (§4.4) deja de exigir las claves reemplazadas desde la `effective_date`.
  - **Retirar un documento sin reemplazo** es una operación explícita y aparte, fuera del flujo automático.
    - La hace una migración con el OK nominal de Sam, que llama a `legal_docs_retirar(key, motivo)`.
    - Esa RPC enciende el mismo `set local` y archiva la vigente de esa clave.
    - Desde ese momento `documentosEfectivos` deja de exigirla.
    - El cron nunca retira nada.
  - **Una RPC programada** (`legal_docs_activar_programadas`, sin permiso para el cliente) archiva la
    anterior y activa la programada en la misma transacción. La llama un cron nuevo de Vercel,
    `/api/cron/legal-docs-activar`, a las 00:05 de Caracas, como los otros de `app/api/cron/`. Es idempotente.
    El cron solo ordena la tabla; no decide el estado del cliente. Si se atrasa o falla, la base sigue con
    la versión anterior en `vigente`, pero `documentosEfectivos` (§4.4) ya exige la `programada` desde su
    fecha, y el cliente queda en `version_nueva`. La pantalla de aceptación muestra y sella esa misma versión,
    así que el cliente puede aceptarla antes de que corra el cron. Si el cron falla, `/studio/legal` muestra
    la programada vencida sin activar.
  - **`currentClientDocs` no cambia.** Se agrega `scheduledClientDocs`. La puerta, la emisión, la franja
    informativa y la acción de aceptar del portal leen `documentosEfectivos(currentClientDocs,
    scheduledClientDocs, hoy)` (§4.4), así que sellan lo mismo que exige la puerta.
- **El cliente nuevo durante el período anunciado** acepta la versión vigente, que es la única que se puede
  aceptar. Queda en `version_anunciada` y, cuando entra la nueva, vuelve a aceptar.
- **Quién valida las 72 horas hábiles (cláusula 13.2).** La base, al insertar una versión `programada`,
  con o sin `reemplaza`:
  - el trigger rechaza una `effective_date` menor que la fecha de publicación más tres días hábiles en
    Caracas;
  - los días hábiles excluyen sábados, domingos y los feriados VE de `operational_calendar`
    (`0192_operational_calendar.sql:22`);
  - se prueba en el `.test.sql` de la fase 2.

  Hoy los documentos se publican por migración (`0213_acuerdo_servicios_v3.sql`) y no hay un botón de
  publicar en el Studio, así que la regla tiene que vivir en la base. Si algún día se agrega ese botón, usa
  la misma regla.
  - **Supuesto, a confirmar con el abogado:** «72 horas hábiles» equivale a tres días hábiles completos.
- **Quién la da (decisión 8).** Cubre al cliente (`client_id`). Si el cliente tiene varios usuarios del
  portal, basta con que acepte uno. Queda registrado quién fue en `accepted_by` y en el correo.

### 5.4 El correo y el acuse

- **Plantilla nueva:** `tyc_aceptada` en `mail_templates`. Se envía con `sendEmail` después del insert, al
  correo del usuario que aceptó (`client_users.email`).
  - El `mail_log` guarda en `metadata` el `acceptance_code`.
  - `legal_acceptances` no se actualiza.
  - Si el correo falla, la aceptación vale igual. El Studio ve el fallo en el registro de correos y puede
    reenviarlo.
- **El acuse (decisión 2).** El correo y la constancia del portal bastan; no hay botón de confirmación.
  - El correo es la constancia de DTD de que recibió la aceptación, y lleva el código.
  - En el portal queda una página que se puede imprimir: `/portal/terminos/constancia/[code]`. Recalcula el
    hash y dice «La huella coincide» o «La huella no coincide».
- **El correo no lleva la IP ni el agente de usuario.** No hacen falta para la constancia, y así no viajan
  por un canal más.
- **El correo dice quién aceptó** (decisión 8). Va al usuario que aceptó, con su nombre en el saludo.
- **Texto propuesto.** Antes de publicarlo lo revisa el abogado (§6, pendiente 1):

  > **Asunto:** Constancia de aceptación del Acuerdo de Servicios · {AC-2026-0001}
  >
  > Hola, {nombre}:
  >
  > Recibimos tu aceptación del Acuerdo de Servicios de DTD Cargo. Con ella aceptaste los términos
  > completos, incluidas las condiciones del servicio puerta a puerta (DDP), que se aplican a cada orden
  > que te facturemos. Estos son los datos que quedaron registrados:
  >
  > - Constancia: {AC-2026-0001}
  > - Cliente: {DTD-0000}
  > - Documento: Acuerdo de Servicios, versión {v3.1}, vigente desde {01/12/2026}
  > - Fecha y hora: {01/12/2026 10:15} (hora de Caracas)
  > - Huella del texto aceptado (SHA-256): {64 caracteres}
  > - Huella de la aceptación (SHA-256): {64 caracteres}
  >
  > La huella es un código que cambia si cambia una sola letra del texto o de los datos de tu aceptación.
  > Sirve para comprobar que el texto que aceptaste es el que guardamos y en qué momento lo aceptaste.
  >
  > Puedes ver esta constancia y el texto completo en tu portal: {enlace}.
  >
  > Si no fuiste tú, responde a este correo o escríbele a tu asesor.

  El ejemplo usa datos inventados.

### 5.5 Revisión de datos personales (`revisar-datos-ve`)

Se aplicó `.claude/skills/revisar-datos-ve/SKILL.md` a la captura de §5.1. Hay tres estados posibles:
ENCONTRADO, CORRECTO y NO VERIFICABLE. Ninguno es asesoría legal.

**Inventario**

| Campo | Qué es | Finalidad | Base | Retención | Quién lo ve |
|---|---|---|---|---|---|
| `legal_acceptances.client_id`, `client_markbox` | Identifica al cliente | Prueba del acto | Relación contractual | NO VERIFICABLE | Studio, por RLS de tenant |
| `accepted_by` (nuevo) | Persona que aceptó | Atribución del acto (art. 16) | Relación contractual | NO VERIFICABLE | Ídem |
| `ip` | Dato personal técnico | Constancia de la aceptación, declarada en `app/privacidad/page.tsx:98` | Ídem | NO VERIFICABLE | Ídem |
| `user_agent` | Dato técnico del navegador | Ídem | Ídem | NO VERIFICABLE | Ídem |
| `accepted_at` | Momento del acto | Prueba | Ídem | NO VERIFICABLE | Ídem |
| `client_users.email` (ya existe) | Correo | Envío de la constancia | Ídem | Ya existe | Resend, como encargado del envío |

**Puntos**

| # | Punto | Estado | Evidencia y nota |
|---|---|---|---|
| 2 | Minimización | CORRECTO con condición | IP y agente con finalidad declarada (`app/privacidad/page.tsx:98`). Agente recortado (`types.ts:150`). Sin geolocalización. El correo no lleva la IP (§5.4) |
| 3 | Consentimiento con evidencia | CORRECTO | Versión, fecha y huella del texto (`0102_capa_legal.sql:86-109`, `0297_legal_docs_body_hash.sql:36-40`). Casillas sin marcar (`AcceptanceForm.tsx:107-110`). El T&C va separado del opt-in de correos (`RegisterForm.tsx:877-889`). La aceptación del T&C no sustituye el tratamiento de datos de la política de privacidad |
| 4 | Derechos como caminos reales | Requisito de esta spec | El acceso a los propios datos (CRBV art. 28) no se condiciona a aceptar: Mensajes y Soporte quedan abiertos (§4.3) |
| 5 | Borrado | NO VERIFICABLE | `legal_acceptances` es de solo inserción (`0102_capa_legal.sql:125-138`). Una solicitud de supresión choca con la conservación de la prueba. `docs/legal/retention-schedule-v1.md` no tiene una fila para las aceptaciones. El plazo lo fija el abogado (§6, pendiente 3) |
| 8 | Terceros | NO VERIFICABLE | Resend envía el correo (`send-email.ts`). Su contrato está fuera del repo |
| 11 | Valor probatorio | CORRECTO en lo técnico; ENCONTRADO en el texto | Hash del contenido sellado en el servidor (`0297`, `seal.ts:142`) e inmutabilidad en la base (`0102:125-138`). No hay certificado de un PSC: es el art. 17. **ENCONTRADO:** la cláusula 13.1 (`lib/legal-public.ts:81`) dice que se acepta «al confirmar cada cotización»; con esta spec se acepta una vez por versión en el portal. La reescribe el abogado (§6, pendiente 2) |
| — | PIPL | NO VERIFICABLE | Solo leen `legal_acceptances` `lib/studio/legal/`, `lib/portal/portal-legal-queries.ts` y la acción de aceptar del portal. No se midió qué roles del equipo de China abren `/studio/legal` |

Recomendación de la skill: que otro modelo haga una segunda lectura cuando exista el código.

## 6. Lo legal

- **Qué es un hash sin certificado.** Un hash sin el certificado de un Proveedor de Servicios de
  Certificación acreditado por SUSCERTE **no es una firma electrónica certificada** según la Ley sobre
  Mensajes de Datos y Firmas Electrónicas.
  - No alcanza la equivalencia con la firma autógrafa de los arts. 16 y 18.
  - Vale como elemento de convicción que el juez valora según la sana crítica (art. 17).
  - El documento electrónico tiene la eficacia probatoria de un escrito (art. 4).
- **Qué prueba.** La integridad del texto aceptado y el momento del acto. La atribución al cliente sale del
  conjunto: la sesión del portal, la casilla, la IP, el agente, el correo y la constancia.
- **Lo que el correo y la pantalla no pueden decir:**
  - «firma electrónica», «firmado» o «firma digital»;
  - «certificado» o «certificada»;
  - «misma validez que tu firma autógrafa»;
  - cualquier otra promesa de más valor legal del que da la ley.

  Se dice «aceptación electrónica», «constancia» y «huella de integridad (hash)», nunca «firma»
  (decisión 1).
- **El pie que ya existe** dice «conforme a la Ley sobre Mensajes de Datos y Firmas Electrónicas»
  (`acceptance-copy.ts:122`, `COPY_LEGAL_UI.md:23`). Entra en la revisión del texto final (pendiente 1).

### 6.1 Pendiente: la revisión del abogado

Es lo único que queda abierto. Las fases 2 y 3 lo esperan (decisión 10).

1. **El texto final del correo** (§5.4). Incluye el pie de la pantalla de aceptación (§4.5), que repite sus
   frases.
2. **La cláusula 13.1 del Acuerdo** (`lib/legal-public.ts:81`). Dice que se acepta «al confirmar cada
   cotización». Con esta spec se acepta una vez por versión en el portal.
   - Una sola aceptación cubre los términos completos, incluidas las condiciones DDP, que se aplican a cada
     orden facturada (decisión 11).
   - El abogado revisa esa frase junto con la cláusula, y el texto sobre las casillas (§4.5).
   - De paso confirma el supuesto de la cláusula 13.2 que usa la base: «72 horas hábiles» son tres días
     hábiles completos (§5.3).
3. **El plazo de retención de las aceptaciones.** Va como fila nueva en
   `docs/legal/retention-schedule-v1.md`.

La fase 3 se enciende con el OK nominal de Sam cuando estén los tres. Necesita además un documento vigente
sin marcadores pendientes en `legal_docs`, que sea el mismo texto que publique `/terminos`
(`TERMINOS_LIVE`).

## 7. Fases

| Fase | Qué | Depende de | Producción |
|---|---|---|---|
| 0 | Revisión del abogado (§6.1) | — | No aplica |
| 1 | Facturación sin la puerta legal (§3.1): `emitInvoice` y `createInvoice` dejan de leer `hasValidAcceptanceForMarkbox`. Rastro `tyc_portal`, que en esta fase vale siempre `pendientes`. Retiro del §6 de la EXC-0674, nota en las filas SGE-00, MP-01 y BTN-01 del registro y nota en la SDD-0054 | Esta spec. **No espera al abogado** (decisión 10) | Merge = despliegue. No tiene migración |
| 2 | Columnas `alcance`, `accepted_by` y `copy_sha256`. Estado `programada` en `legal_docs`, con su guard, su índice único, `reemplaza`, la regla de las 72 horas hábiles y la RPC y el cron de activación (§5.3). Evidencia v4, `estadoTycPortal` (con `version_anunciada` y la excepción del período anunciado) y `tyc_portal` calculado en la emisión. Plantilla `tyc_aceptada` | Fases 0 y 1, y número de migración de Dir_DTD | Aplicar la migración con el OK nominal de Sam y el runbook |
| 3 | Portal: franja, pantalla de entrada, `/portal/terminos/aceptar`, constancia, puerta en el servidor, «Reportar un pago» desde la puerta y correo. Detrás de la bandera `PORTAL_TYC_GATE_LIVE = false` | Fases 0 y 2 | Encender la bandera con el OK nominal de Sam |
| 4 | Retiro de la aceptación por orden de las DDP (decisión 11) y estado de T&C en la ficha del cliente del Studio | Fase 3 encendida | Normal |

**Fase 1 antes que el abogado (decisión 10).** Mientras la fase 3 no esté encendida, se emite sin
aceptación y `tyc_portal = pendientes` deja la lista.

**La aceptación por orden sigue hasta la fase 4.** Así el cliente siempre tiene una manera de aceptar,
aunque desde la fase 1 ya no frene la emisión. Se quita cuando la aceptación general esté encendida.

## 8. Aceptación verificable

**Fase 1**

1. Una prueba de `emitInvoice` y de `createInvoice` con `emit_on_create`: un borrador DDP sin aceptación
   se emite. No devuelve `needsLegalAck` ni error legal.
2. Esa prueba comprueba que el evento de emisión lleva `tyc_portal: "pendientes"`, aunque el cliente tenga
   una aceptación por orden. Y que ni `emitInvoice` ni `createInvoice` llaman a
   `hasValidAcceptanceForMarkbox`.
3. `LEGAL_GATE_HARD_BLOCK` no existe en el código ni en `feature-constants.json`. `check-feature-constants`
   pasa.
4. El §6 del documento de la EXC-0674 dice «Retirada» con la fecha. Las filas SGE-00, MP-01 y BTN-01 de
   `docs/governance/README.md` llevan la nota «§6 AUT-04 retirado por SDD-0693». `governance:check` pasa.

**Fase 2**

5. Una prueba SQL (`.test.sql`, PGlite):
   - una fila `portal` con `quote_code` y medida en `null` se inserta;
   - un `UPDATE` o un `DELETE` se rechaza;
   - las filas `orden` siguen validando.
6. Pruebas del sello v4:
   - la misma entrada da el mismo hash;
   - cambiar un carácter del cuerpo, de `copy_sha256`, de `accepted_by` o de `accepted_at` da otro hash;
   - una fila v3 se sigue verificando.
7. Pruebas de `estadoTycPortal`:
   - los seis estados de §4.1;
   - una aceptación con el hash alterado da `sin_aceptar`;
   - una versión nueva publicada con vigencia de mañana da `version_anunciada`;
   - la misma versión, el día de su vigencia en hora de Caracas, da `version_nueva`, aunque siga
     `programada`:
     - a las 00:01 de Caracas, antes de que corra el cron de las 00:05;
     - con el cron caído, un día después de la fecha;
   - en ese mismo caso, `documentosEfectivos` devuelve la programada y no la vigente vieja, y la acción de
     aceptar sella la programada;
   - con una `programada` que reemplaza a `{tyc, operador}`: antes de la fecha se exigen `tyc` y `operador`,
     y desde la fecha solo la nueva clave;
   - dos usuarios del mismo cliente: si acepta uno, los dos ven `aceptados`, y la fila guarda en
     `accepted_by` al que aceptó;
   - un cliente nuevo durante el período anunciado acepta la vigente, queda en `version_anunciada`, y al
     llegar la fecha de la programada pasa a `version_nueva`, haya corrido o no el cron;
   - sin documentos vigentes da `sin_documentos`, y no `sin_aceptar`.
8. La emisión escribe `tyc_portal: "aceptados"` cuando hay una aceptación `portal` íntegra que cubre los
   documentos que exige `documentosEfectivos`, y `"pendientes"` en los demás casos.
   - La prueba usa esa función, no `currentClientDocs`.
   - Incluye el caso del cron caído: hay una `programada` con fecha de ayer y la vieja sigue `vigente`. Una
     aceptación de la vieja da `pendientes`, y una de la programada da `aceptados`.
9. Una prueba SQL de `programada`:
   - se inserta con una `effective_date` de tres días hábiles o más;
   - se rechaza con una menor, contando un feriado de `operational_calendar` y un fin de semana;
   - de `programada` a `vigente` se rechaza antes de la fecha;
   - `legal_docs_activar_programadas` archiva la anterior y activa la nueva en una transacción, y una
     segunda llamada no cambia nada;
   - nunca hay dos vigentes por `key`. Tampoco un momento sin vigente para una clave que no fue reemplazada
     ni retirada con `legal_docs_retirar`;
   - una segunda `programada` de la misma clave se rechaza por el índice único parcial;
   - la primera versión de una clave nueva sin `reemplaza` entra `vigente`;
   - **se rechaza** un insert `vigente` sobre una clave que ya tiene cualquier versión, aunque esté
     archivada;
   - **se rechaza** archivar una vigente a mano, con un `UPDATE` fuera de la RPC;
   - **se rechaza** el atajo de la 0213: archivar la v3.0 y después insertar la v3.1 `vigente`. Falla en el
     primer paso, y el segundo también fallaría solo;
   - una `programada` se retira (`programada → archivada`) antes de su fecha, y se rechaza retirarla desde
     su fecha;
   - cambiar `reemplaza` después del insert se rechaza;
   - `legal_docs_retirar` archiva la vigente de una clave y, fuera de ella, el mismo `UPDATE` se rechaza;
   - con `reemplaza`: se rechaza si alguna clave no tiene una vigente o si entra `vigente`, y la RPC archiva
     las claves reemplazadas junto con la activación.

**Fase 3**

10. Para cada ruta cerrada de §4.3, una prueba de página o de ruta comprueba que, con `sin_aceptar`, devuelve
    la pantalla de la puerta y no llama a la consulta de datos. Con `aceptados`, muestra los datos.
11. Una prueba comprueba que las rutas abiertas de §4.3 (Compras y Documentos incluidas) no consultan el
    estado.
12. Con `sin_aceptar`, la pantalla de la puerta del estado de cuenta ofrece «Reportar un pago», el reporte
    se registra igual que hoy, y la pantalla no muestra saldos ni la lista de facturas.
13. Con `sin_aceptar`, siguen saliendo los correos y avisos push de seguimiento y el correo de la factura.
    Ninguna prueba de esos envíos cambia.
14. La acción de aceptar:
    - rechaza sin las dos casillas, cada una con su error;
    - inserta una sola vez si se repite;
    - toma la IP y el agente de los headers, no del formulario;
    - envía `tyc_aceptada` con el `acceptance_code` en `metadata`.

    Si el correo falla, la aceptación queda igual.
15. Una prueba de contrato sobre los textos de §4 y §5.4 comprueba que no aparecen «firma», «firmad»,
    «certificad» ni «autógrafa», salvo en el nombre de la ley si el abogado lo deja.
    Comprueba también que no hay voseo, y que la pantalla y el correo dicen que la aceptación cubre los
    términos completos, incluidas las condiciones DDP (decisión 11).
16. `/ui-check` de la franja, la puerta y la pantalla de aceptación.
17. Un ensayo e2e local con datos inventados: entra un cliente sin aceptar, ve la franja, no ve Envíos,
    acepta, recibe el correo en modo de prueba y ve Envíos.

**Fase 4**

18. `/portal/facturas/[code]/aceptar` ya no existe. La portada y Facturas no muestran «por aceptar». Nada
    llama a `hasValidAcceptanceForMarkbox`; `emitInvoice` dejó de leerla en la fase 1 (criterio 2). Las filas
    `orden` siguen en la base y se exportan en el expediente.

**Cierre de cada fase:** `pnpm verify` y el CI de GitHub de la PR.

## 9. Allowlist provisional

Se cierra en la PR de cada fase. Lo que no está aquí no se toca sin enmendar la spec.

**Fase 1**

- `app/studio/(app)/facturacion/actions.ts`: se quita `evaluateLegalGate` y se agrega `tyc_portal: "pendientes"` fijo. No se
  toca `lib/studio/legal/queries.ts` ni se lee `legal_acceptances`.
- `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx`
- `app/studio/(app)/facturacion/__tests__/` (prueba nueva de emisión DDP)
- `lib/studio/legal/gate-config.ts` (se borra o queda sin la constante)
- `app/studio/(app)/admin/page.tsx`
- `app/studio/(app)/legal/_components/LegalClient.tsx`
- `scripts/feature-constants.json`
- `docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md`
- `docs/specs/0054-capa-legal/spec.md` (solo la nota)
- `docs/governance/README.md` (la nota en las filas SGE-00, MP-01 y BTN-01, decisión 9)

**Fase 2**

- `supabase/migrations/NNNN_tyc_portal_aceptacion.sql` (columnas de `legal_acceptances`; estado `programada`,
  columna `reemplaza`, índice único de una programada por clave, guard y regla de días hábiles en
  `legal_docs`; RPC de activación), su `.test.sql` y su desarme en
  `supabase/desarmes/`
- `lib/studio/legal/seal.ts`, `lib/studio/legal/types.ts` y `lib/studio/legal/queries.ts`, con sus pruebas
  en `lib/studio/legal/__tests__/`
- `lib/portal/tyc-gate.ts` y su prueba
- `app/api/cron/legal-docs-activar/route.ts` (nuevo) y su entrada en `vercel.json`
- `app/studio/(app)/facturacion/actions.ts`: solo para cambiar el `tyc_portal` fijo por el de `estadoTycPortal`
- `app/studio/(app)/legal/_components/LegalClient.tsx`: para mostrar la versión `programada` y su fecha
- Plantilla `tyc_aceptada` en `scripts/seed-mail-templates.ts`, o en la migración si Dir_DTD lo prefiere

**Fase 3**

- `app/portal/(app)/layout.tsx` y `app/portal/_components/PortalShell.tsx` (franja y pantalla de entrada)
- `app/portal/(app)/_components/PortalTycGate.tsx` (nuevo)
- `app/portal/(app)/terminos/aceptar/` y `app/portal/(app)/terminos/constancia/[code]/` (nuevos)
- Las páginas y rutas cerradas de §4.3, con sus pruebas
- `app/portal/_components/PortalSidebar.tsx` (candado del menú)
- `lib/portal/demo.ts` o el módulo de banderas que elija Dir_DTD, y `scripts/feature-constants.json`
- `lib/studio/legal/acceptance-copy.ts` y `docs/legal/COPY_LEGAL_UI.md`
- `app/portal/(app)/facturas/[code]/_components/InvoicePaymentReports.tsx`, solo para ofrecer «Reportar un pago» desde la puerta (decisión 4)

**Fase 4**

- `app/portal/(app)/facturas/[code]/aceptar/`
- `app/portal/(app)/_components/PendingAcceptanceCard.tsx`
- `app/portal/(app)/facturas/[code]/_components/PendingInvoiceGate.tsx`
- `lib/portal/pending-acceptance.ts` y `lib/portal/portal-legal-queries.ts`
- La ficha del cliente en `app/studio/(app)/clientes/`

**Fuera de la allowlist en todas las fases**

- La RLS del portal.
- Las páginas de Compras y Documentos (decisión 3).
- Los envíos de correo y push de seguimiento y el correo de la factura (decisión 5).
- La 0564 y las filas que ya existen en `legal_acceptances`.
- `lib/legal-public.ts` y `docs/legal/retention-schedule-v1.md`: los cambia el abogado, en su propio cambio (§6.1).

## 10. Decisiones de Sam (2026-11-20)

Sam contestó por Dir_DTD, una por una. En las 11 eligió la propuesta recomendada.

1. **Las palabras.** Se dice «aceptación electrónica» y «huella de integridad», nunca «firma». El abogado
   revisa el texto final (§6, §6.1).
2. **El acuse.** El correo y la constancia del portal bastan como acuse. No hay botón de confirmación
   (§5.4).
3. **Compras y Documentos** quedan abiertos. Se cierran el seguimiento, el estado de cuenta y las facturas
   (§4.3).
4. **Reportar un pago.** El cliente puede reportarlo sin haber aceptado (§4.2, §4.3).
5. **Fuera del portal.** Siguen saliendo los correos y avisos de seguimiento y el correo de la factura
   (§4.3).
6. **La declaración de comerciante** se mantiene como segunda casilla obligatoria (§4.5).
7. **Versión nueva.** El portal se cierra cuando la versión nueva entra en vigencia, a las 72 horas hábiles
   de la cláusula 13.2 (§4.1, §5.3).
8. **Varios usuarios.** Basta con que acepte un usuario por cliente, y queda registrado quién fue (§5.1,
   §5.3).
9. **El registro de gobernanza.** Se agrega la nota «§6 AUT-04 retirado por SDD-0693» a las filas SGE-00,
   MP-01 y BTN-01 (§3.3).
10. **El orden.** La fase 1 (facturar sin la puerta, con el rastro `tyc_portal = pendientes`) sale antes de
    que el abogado termine. Las fases 2 y 3 esperan al abogado (§7).
11. **La aceptación por orden** de las DDP se quita (§3.1, fase 4). Aclaración de Sam: «el cliente al
    aceptar acepta todo».
    - Con una sola aceptación en el portal, el cliente acepta los términos completos, incluidas las
      condiciones del puerta a puerta (DDP).
    - Esas condiciones se aplican después a cada orden que se le facture. No hay aceptación por orden.
    - Lo dicen la pantalla (§4.5) y el correo (§5.4). Lo revisa el abogado junto con la cláusula 13.1 (§6.1).

**Pendiente:** solo la revisión del abogado (§6.1):
- el texto del correo;
- la cláusula 13.1, con la frase «se acepta todo, incluidas las condiciones DDP, una sola vez»;
- el plazo de retención.
