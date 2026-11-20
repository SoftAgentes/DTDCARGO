---
sdd: "0693"
title: "La aceptación de T&C limita el portal, no la facturación"
status: proposed
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
> Esta spec es solo un documento para que Sam la apruebe. No trae código ni migración. Los números de
> migración los asigna Dir_DTD cuando se implemente.

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
| Qué se acepta | Una orden: monto, medida y documentos vigentes | El Acuerdo de Servicios y los documentos vigentes de cara al cliente, una vez por versión |
| Qué bloquea | Emitir la factura | Ver el seguimiento y el estado de cuenta en el portal |
| Qué no bloquea | — | Facturar, contabilizar, cobrar, enviar la factura por correo |

- **Sale de la emisión.** `createInvoice` y `emitInvoice` dejan de consultar la aceptación. No hay bloqueo,
  aviso ni override. La factura DDP se emite como cualquier otra.
- **Entra al portal.** La aceptación general del cliente (§5) abre el seguimiento y el estado de cuenta (§4).
- **Se retira la constante `LEGAL_GATE_HARD_BLOCK`.** Se borra de `gate-config.ts` y de
  `feature-constants.json`. El banner de modo de `/studio/legal` dice: «La aceptación de T&C se exige en el
  portal del cliente. No frena la facturación.» Apagarla y dejarla viva no sirve: la rama advisory pediría
  un override en cada factura DDP.
- **Queda un rastro informativo.** El evento de emisión agrega `tyc_portal` con uno de dos valores:
  `aceptados` o `pendientes`. Ese valor sale del mismo cálculo de §4.4. Solo se registra; no decide nada.
  Así se puede listar lo que se emitió con el cliente sin aceptar.
- **La aceptación por orden se retira** en la fase 4 (§7):
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
  2. Las filas SGE-00, MP-01 y BTN-01 del registro **no cambian**: siguen citando la EXC-0674 por el §1
     al §4. Si Sam quiere que la tabla lo diga, se agrega «(§6 AUT-04 retirado por SDD-0693)». Es la
     pregunta 9.
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
| `aceptados` | Hay una aceptación general íntegra que cubre todos los documentos vigentes (§5.3) | Todo el portal |
| `sin_aceptar` | Nunca aceptó | El aviso (§4.2) y los módulos cerrados (§4.3) |
| `version_nueva` | Aceptó una versión anterior y hay otra vigente | Igual que `sin_aceptar`, con el texto de versión nueva |
| `sin_documentos` | El tenant no tiene documentos vigentes de cara al cliente | Todo el portal, sin aviso (no hay nada que aceptar). El Studio lo señala en `/studio/legal` |
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

En el estado `version_nueva`, el título de la franja es «Actualizamos el Acuerdo de Servicios» y el texto
dice «Para seguir viendo tus envíos y tu estado de cuenta, lee y acepta la versión {versión}, vigente desde
{fecha}.» Se reutiliza el aviso de reaceptación de `acceptance-copy.ts`.

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
| Cotizaciones, Estimados, Compras, Proveedores, Academia, Club y Referidos | No son seguimiento ni estado de cuenta. Compras y Documentos son la pregunta 3 |
| Reportar un pago | La cobranza no se frena. Es la pregunta 4 |

- **La puerta se aplica en el servidor.** Cada página y cada ruta de PDF consulta el estado (§4.4) antes de
  leer datos. El candado del menú solo señala. Sigue el patrón de `verify-gate.ts`, en un módulo puro
  `lib/portal/tyc-gate.ts`.
- **Es una puerta de experiencia y de contrato, no de seguridad.** La RLS del portal no cambia: los datos
  son del cliente. No se agrega una policy nueva.
- **Fuera del portal no cambia nada:**
  - los correos y avisos push de seguimiento;
  - el correo de la factura emitida;
  - el canal de WhatsApp.

  Es la pregunta 5.

### 4.4 Cómo se calcula el estado

Una función pura `estadoTycPortal(aceptaciones, vigentes)` devuelve un estado de §4.1. La lectura va por
el principal del portal (`getPortalClientPrincipal`), con tenant y cliente explícitos, como en la
SDD-0549. Valen las mismas reglas que en `acceptanceRowValid`:

- el hash se recomputa desde la fila;
- la aceptación tiene que cubrir todos los documentos vigentes.

**No mira la medida ni la orden.** La emisión del Studio (§3.1) usa esta misma función para escribir
`tyc_portal`.

### 4.5 La pantalla de aceptación

- **Ruta:** `/portal/terminos/aceptar`, siempre abierta.
- **Encabezado:** «Acuerdo de Servicios · versión {versión}, vigente desde {fecha}». Debajo va el texto
  completo, que sale de `legal_docs` vigente.
- **Casilla 1:** «He leído y acepto el Acuerdo de Servicios, versión {versión}.» Si hay más documentos
  vigentes, se nombran todos, como en `acceptance-copy.ts`.
- **Casilla 2:** la declaración de comerciante que ya existe. Es la pregunta 6.
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

- Una aceptación `portal` vale mientras cubra todas las versiones vigentes de cara al cliente.
- Si se publica una versión nueva, el estado pasa a `version_nueva`. La aceptación vieja se conserva como
  evidencia. Cuándo se cierra el portal está en la pregunta 7: la cláusula 13.2 da 72 horas hábiles de
  vigencia diferida.
- **Quién la da.** Cubre al cliente (`client_id`), no solo al usuario que la dio. Si el cliente tiene
  varios usuarios del portal, basta con que acepte uno. Es la pregunta 8.

### 5.4 El correo y el acuse

- **Plantilla nueva:** `tyc_aceptada` en `mail_templates`. Se envía con `sendEmail` después del insert, al
  correo del usuario que aceptó (`client_users.email`).
  - El `mail_log` guarda en `metadata` el `acceptance_code`.
  - `legal_acceptances` no se actualiza.
  - Si el correo falla, la aceptación vale igual. El Studio ve el fallo en el registro de correos y puede
    reenviarlo.
- **El acuse** es el correo mismo: la constancia de DTD de que recibió la aceptación. Lleva el código, y en
  el portal queda una página que se puede imprimir: `/portal/terminos/constancia/[code]`. Esa página
  recomputa el hash y dice «La huella coincide» o «La huella no coincide». Si Sam quiere además que el
  cliente confirme que recibió el correo, es la pregunta 2.
- **El correo no lleva la IP ni el agente de usuario.** No hacen falta para la constancia, y así no viajan
  por un canal más.
- **Texto propuesto** (antes de publicarlo lo revisa el abogado, §6):

  > **Asunto:** Constancia de aceptación del Acuerdo de Servicios · {AC-2026-0001}
  >
  > Hola, {nombre}:
  >
  > Recibimos tu aceptación del Acuerdo de Servicios de DTD Cargo. Estos son los datos que quedaron
  > registrados:
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
| 4 | Derechos como caminos reales | Requisito de esta spec | El acceso a los propios datos (CRBV art. 28) no se condiciona a aceptar: Mensajes y Soporte quedan abiertos (§4.3). Que alcance o no, lo dice el abogado |
| 5 | Borrado | NO VERIFICABLE | `legal_acceptances` es de solo inserción (`0102_capa_legal.sql:125-138`). Una solicitud de supresión choca con la conservación de la prueba. `docs/legal/retention-schedule-v1.md` no tiene una fila para las aceptaciones. Hay que fijar el plazo |
| 8 | Terceros | NO VERIFICABLE | Resend envía el correo (`send-email.ts`). Su contrato está fuera del repo |
| 11 | Valor probatorio | CORRECTO en lo técnico; ENCONTRADO en el texto | Hash del contenido sellado en el servidor (`0297`, `seal.ts:142`) e inmutabilidad en la base (`0102:125-138`). No hay certificado de un PSC: es el art. 17. **ENCONTRADO:** la cláusula 13.1 (`lib/legal-public.ts:81`) dice que se acepta «al confirmar cada cotización»; con esta spec se acepta una vez por versión en el portal. Hay que reescribirla (§6) |
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

  Se dice «aceptación electrónica», «constancia» y «huella de integridad (hash)». Sam dijo que «funciona
  como firma electrónica»: esta spec propone no escribirlo así. Es la pregunta 1.
- **Hay que revisar el pie que ya existe.** «Conforme a la Ley sobre Mensajes de Datos y Firmas
  Electrónicas» (`acceptance-copy.ts:122`, `COPY_LEGAL_UI.md:23`). Lo revisa el abogado junto con el
  resto.
- **Condición previa.** El abogado revisa antes de publicar:
  1. la cláusula 13.1 y la 13.2 del Acuerdo;
  2. el aviso, las casillas y el pie (§4);
  3. el correo (§5.4);
  4. la puerta (§4.3): que condicionar el seguimiento y el estado de cuenta a la aceptación sea válido, y
     que el canal para pedir los datos baste.

  Sin esa revisión y el OK de Sam, la fase 3 no se enciende. La fase 3 necesita además un documento vigente
  sin marcadores pendientes en `legal_docs`, y que sea el mismo texto que publique `/terminos`
  (`TERMINOS_LIVE`).

## 7. Fases

| Fase | Qué | Depende de | Producción |
|---|---|---|---|
| 0 | Revisión del abogado y OK de Sam a los textos (§6) | — | No aplica |
| 1 | Facturación sin la puerta legal (§3.1), marca `tyc_portal`, retiro del §6 de la EXC-0674 y nota en la SDD-0054 | Aprobación de esta spec | Merge = despliegue. No tiene migración |
| 2 | Columnas `alcance`, `accepted_by` y `copy_sha256`, evidencia v4, `estadoTycPortal` y plantilla `tyc_aceptada` | Fase 1 y número de migración de Dir_DTD | Aplicar la migración con el OK nominal de Sam y el runbook |
| 3 | Portal: franja, pantalla de entrada, `/portal/terminos/aceptar`, constancia, puerta en el servidor y correo. Detrás de la bandera `PORTAL_TYC_GATE_LIVE = false` | Fases 0 y 2 | Encender la bandera con el OK nominal de Sam |
| 4 | Retiro de la aceptación por orden (§3.1) y estado de T&C en la ficha del cliente del Studio | Fase 3 encendida | Normal |

La fase 1 puede salir antes que la 0 porque no promete nada al cliente. En ese tiempo se emite sin
aceptación y `tyc_portal = pendientes` lo deja listado. Es la pregunta 10.

## 8. Aceptación verificable

**Fase 1**

1. Una prueba de `emitInvoice` y de `createInvoice` con `emit_on_create`: un borrador DDP sin aceptación
   se emite. No devuelve `needsLegalAck` ni error legal.
2. Esa prueba comprueba que el evento de emisión lleva `tyc_portal: "pendientes"`, y `"aceptados"` cuando
   hay una aceptación `portal` íntegra.
3. `LEGAL_GATE_HARD_BLOCK` no existe en el código ni en `feature-constants.json`. `check-feature-constants`
   pasa.
4. El §6 del documento de la EXC-0674 dice «Retirada» con la fecha, y `governance:check` pasa.

**Fase 2**

5. Una prueba SQL (`.test.sql`, PGlite):
   - una fila `portal` con `quote_code` y medida en `null` se inserta;
   - un `UPDATE` o un `DELETE` se rechaza;
   - las filas `orden` siguen validando.
6. Pruebas del sello v4:
   - la misma entrada da el mismo hash;
   - cambiar un carácter del cuerpo, de `copy_sha256`, de `accepted_by` o de `accepted_at` da otro hash;
   - una fila v3 se sigue verificando.
7. Pruebas de `estadoTycPortal` con los cinco estados de §4.1, una aceptación con el hash alterado
   (`sin_aceptar`) y una versión nueva (`version_nueva`).

**Fase 3**

8. Para cada ruta cerrada de §4.3, una prueba de página o de ruta comprueba que, con `sin_aceptar`, devuelve
   la pantalla de la puerta y no llama a la consulta de datos. Con `aceptados`, muestra los datos.
9. Una prueba comprueba que las rutas abiertas de §4.3 no consultan el estado.
10. La acción de aceptar:
    - rechaza sin las dos casillas, cada una con su error;
    - inserta una sola vez si se repite;
    - toma la IP y el agente de los headers, no del formulario;
    - envía `tyc_aceptada` con el `acceptance_code` en `metadata`.

    Si el correo falla, la aceptación queda igual.
11. Una prueba de contrato sobre los textos de §4 y §5.4 comprueba que no aparecen «firma», «firmad»,
    «certificad» ni «autógrafa». Y que no hay voseo.
12. `/ui-check` de la franja, la puerta y la pantalla de aceptación.
13. Un ensayo e2e local con datos inventados: entra un cliente sin aceptar, ve la franja, no ve Envíos,
    acepta, recibe el correo en modo de prueba y ve Envíos.

**Cierre de cada fase:** `pnpm verify` y el CI de GitHub de la PR.

## 9. Allowlist provisional

Se cierra en la PR de cada fase. Lo que no está aquí no se toca sin enmendar la spec.

**Fase 1**

- `app/studio/(app)/facturacion/actions.ts`
- `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx`
- `app/studio/(app)/facturacion/__tests__/` (prueba nueva de emisión DDP)
- `lib/studio/legal/gate-config.ts` (se borra o queda sin la constante)
- `app/studio/(app)/admin/page.tsx`
- `app/studio/(app)/legal/_components/LegalClient.tsx`
- `scripts/feature-constants.json`
- `docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md`
- `docs/specs/0054-capa-legal/spec.md` (solo la nota)
- `docs/governance/README.md` (solo si Sam contesta «sí» a la pregunta 9)

**Fase 2**

- `supabase/migrations/NNNN_tyc_portal_aceptacion.sql`, su `.test.sql` y su desarme en
  `supabase/desarmes/`
- `lib/studio/legal/seal.ts`, `lib/studio/legal/types.ts` y `lib/studio/legal/queries.ts`, con sus pruebas
  en `lib/studio/legal/__tests__/`
- `lib/portal/tyc-gate.ts` y su prueba
- Plantilla `tyc_aceptada` en `scripts/seed-mail-templates.ts`, o en la migración si Dir_DTD lo prefiere

**Fase 3**

- `app/portal/(app)/layout.tsx` y `app/portal/_components/PortalShell.tsx` (franja y pantalla de entrada)
- `app/portal/(app)/_components/PortalTycGate.tsx` (nuevo)
- `app/portal/(app)/terminos/aceptar/` y `app/portal/(app)/terminos/constancia/[code]/` (nuevos)
- Las páginas y rutas cerradas de §4.3, con sus pruebas
- `app/portal/_components/PortalSidebar.tsx` (candado del menú)
- `lib/portal/demo.ts` o el módulo de banderas que elija Dir_DTD, y `scripts/feature-constants.json`
- `lib/studio/legal/acceptance-copy.ts` y `docs/legal/COPY_LEGAL_UI.md`

**Fase 4**

- `app/portal/(app)/facturas/[code]/aceptar/`
- `app/portal/(app)/_components/PendingAcceptanceCard.tsx`
- `app/portal/(app)/facturas/[code]/_components/PendingInvoiceGate.tsx`
- `lib/portal/pending-acceptance.ts` y `lib/portal/portal-legal-queries.ts`
- La ficha del cliente en `app/studio/(app)/clientes/`

**Fuera de la allowlist en todas las fases**

- La RLS del portal.
- La 0564 y las filas que ya existen en `legal_acceptances`.
- `lib/legal-public.ts`: el texto del Acuerdo lo cambia el abogado, en su propio cambio.

## 10. Preguntas para Sam

1. **«Firma electrónica».** Esta spec propone que el correo y la pantalla digan «aceptación electrónica» y
   «huella de integridad», y no «firma electrónica» (§6). ¿De acuerdo, o prefieres esperar al abogado?
2. **El acuse de recibo.** ¿Basta con que el correo sea la constancia de DTD, o quieres que el cliente
   confirme que lo recibió, con un botón en el correo o en el portal?
3. **Compras y Documentos.** ¿Se cierran también? Compras muestra la recepción en bodega y Documentos trae
   el BL y el POD. La propuesta es dejarlos abiertos.
4. **Reportar un pago** sin haber aceptado. ¿Se deja? La propuesta es que sí, para no frenar la cobranza.
5. **Fuera del portal.** ¿Los correos y avisos push de seguimiento y el correo de la factura siguen
   saliendo aunque no haya aceptado? La propuesta es que sí: la regla limita el portal.
6. **La declaración de comerciante.** ¿Se mantiene como segunda casilla obligatoria?
7. **Versión nueva.** ¿El portal se cierra apenas se publica, o cuando entra en vigencia (72 horas hábiles,
   cláusula 13.2)? La propuesta es al entrar en vigencia.
8. **Varios usuarios de un mismo cliente.** ¿Basta con que acepte uno?
9. **El registro de gobernanza.** ¿Agregamos a las filas SGE-00, MP-01 y BTN-01 la nota «§6 AUT-04
   retirado por SDD-0693», o basta con el documento de la EXC-0674?
10. **El orden.** ¿La fase 1 (facturar sin la puerta) sale antes de que el abogado termine, con el rastro
    `tyc_portal = pendientes`?
11. **La aceptación por orden.** Confirma que el cliente ya no acepta el monto de cada orden DDP antes de
    la emisión (fase 4).
