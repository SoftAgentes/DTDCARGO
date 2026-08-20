# Acuerdo de Servicios — cambios pendientes para v3.1

> **Propósito:** acumular los cambios de **contenido** que deben entrar al *Acuerdo de
> Servicios y Políticas Generales* cuando se publique **v3.1** (texto final del abogado).
> El texto de **v3.0 está CONGELADO** — `acuerdo-servicios-v3.mdx` no se edita en su
> redacción (regla `HANDOFF_CAPA_LEGAL.md` §1-TER). Cada cambio de contenido = **nueva
> versión** con su migración (patrón de `supabase/migrations/0213_acuerdo_servicios_v3.sql`),
> no un parche in-place, porque las aceptaciones de cliente quedan vinculadas a la versión
> + hash de integridad (cláusula 13.1).
>
> Cuando el abogado entregue el texto final: incorporar estos cambios + resolver los
> placeholders, publicar v3.1 (nueva migración), archivar v3.0.

## Cambios acumulados

### 1. Anexo B — sumar rubros a la mercancía prohibida (2026-07-10, decisión Sam)

El Anexo B de v3.0 lista: *baterías de litio sin UN38.3; líquidos inflamables y aerosoles;
gases comprimidos; sustancias tóxicas; armas, municiones y réplicas; medicamentos sin
registro y psicotrópicos; alimentos perecederos; divisas, valores y metales preciosos;
réplicas de marcas y productos pirata; pirotecnia y explosivos.*

**Sumar a esa lista:**
- **Juguetes bélicos** (junto a "armas, municiones y réplicas").
- **Uniformes y accesorios militares.**

**Por qué:** son mercancía restringida real en la importación a Venezuela; la web y el bot
ya los reflejan y el texto legal debe alinearse en la próxima versión.

**Dónde queda ya reflejado (fuera del texto legal congelado):**
- FAQ pública `/faq` → `lib/faqs.ts` (respuesta "¿Qué productos están prohibidos…").
- Base del bot Kommo → `docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md` (#25, nota interna).

**Al publicar v3.1, sincronizar los 3 espejos del acuerdo** (se mueven juntos):
1. `docs/legal/acuerdo-servicios-v3.mdx` (Anexo B).
2. `lib/legal-public.ts` (`ACUERDO_SERVICIOS`, Anexo B — copia pública de `/terminos`).
3. `supabase/migrations/NNNN_*.sql` (INSERT de la fila `legal_docs` v3.1).

### 2. Evaluar reincorporación de cláusulas del antiguo "Condiciones del Operador" (2026-07-10, decisión Sam)

Al fusionar los dos documentos de cliente en el Acuerdo v3.0, tres cláusulas del antiguo
*Condiciones del Operador de Consolidación* (key `operador` v1.4, archivada) **no quedaron
explícitas** en el texto único. La abogada debe decidir si se reincorporan en v3.1:

- **Avería gruesa (General Average).** Si la naviera declara avería gruesa, el Cliente aporta
  el depósito o la garantía exigida para liberar su carga, conforme a las Reglas de
  York-Amberes. Es el más relevante (figura marítima con impacto económico directo para el
  Cliente); el v3.0 no la menciona.
- **Derecho del operador a abrir, pesar, fotografiar y reembalar** la carga para optimizar el
  cubicaje, con registro de evidencia fotográfica. El v3.0 habla de "consolidación" pero no lo
  explicita.
- **Consolidación parcial (P1/P2).** Si la carga no entra completa en el contenedor en curso, el
  operador puede dividirla y despacharla en embarques sucesivos, notificando al Cliente. No
  explícito en el v3.0.

Texto original de referencia: fila `legal_docs` key `operador` v1.4 (archivada) en Supabase —
secciones 8, 2 y 4 respectivamente.

### 3. Comunicación pública de las dos modalidades de importación (2026-07-10, decisión Sam)

El FAQ público ahora distingue **dos modalidades dentro del LCL**: (a) **puerta a puerta (DDP)**,
donde la importación NO queda a nombre del Cliente y no se le entregan documentos de nacionalización
ni factura de importación; (b) **con su propia aduana**, donde el Cliente importa a su nombre, DTD
cobra el CBM hasta almacén fiscal y el Cliente cubre impuestos, permisos y gastos de almacén fiscal.

**A validar con la abogada:** que el copy público de la modalidad DDP sea consistente con la
arquitectura de importación del Acuerdo (cláusula 1.3: el importador de registro es el **Operador de
Consolidación**, no DTD Services ni el Cliente). En el FAQ se dice *"la importación no queda a tu
nombre"* SIN afirmar a nombre de quién queda, justamente para no chocar con esa estructura.
Confirmar que es la redacción correcta y si conviene **reflejar las dos modalidades en el texto del
Acuerdo** (hoy asume implícitamente el flujo consolidado/DDP).

### 4. Manejo del bolívar en el copy público (2026-07-10, decisión Sam)

El FAQ y la base del bot **ya no listan medios de pago** ni mencionan el bolívar: enmarcan el pago
como *"servicio internacional cotizado en dólares"* y derivan la forma de pago al asesor. Razón: el
bolívar es de curso legal (no se puede rechazar por escrito), pero en la práctica la empresa cobra
en divisas (≈95 % de los costos son a terceros en USD).

**A validar con la abogada:** que este enfoque (no negar ni prometer el bolívar; cotizar en dólares
por la naturaleza internacional del servicio; forma de pago caso por caso) sea la postura más segura
frente a SUNDDE/BCV, y si conviene una **cláusula de moneda de pago** en el Acuerdo.

### 5. Piso de volumen del LCL Consolidado + excepción por alto valor comercial (2026-07-21, propuesta Sam/Claude — falta redacción final de la abogada)

La calculadora pública (`lib/calculadora.ts`, constante `CONSOLIDADO_CBM_MINIMO`, regla del
founder 2026-07-20) no cotiza el LCL Consolidado por debajo de **1 m³**: deriva al asesor por
WhatsApp con este mensaje —

> *"Esta modalidad requiere un BL a tu nombre, y solo el BL puede llegar a costar
> USD 300. Por debajo de 1 m³ ese gasto fijo se come tu margen. Si tu mercancía es de
> alto valor comercial y aun así te conviene, háblalo con un asesor."*

**Por qué existe el piso:** el Consolidado va hasta puerto con **BL propio del cliente** — un
gasto fijo (hasta **USD 300**, `CONSOLIDADO_BL_COSTO_MAX`) que no baja con el volumen. Bajo
1 m³ ese fijo se come el envío entero, y la mercancía chica queda en riesgo real de **abandono
en el almacén fiscal** cuando el cliente ve la cuenta final — costo y riesgo para DTD, no solo
mal negocio para el cliente.

**La excepción (hoy sin tratamiento legal — código en `lib/calculadora.ts` marcado
`🔶 PENDIENTE LEGAL`):** mercancía de muy alto valor comercial puede justificar el Consolidado
aun bajo 1 m³, **bajo el riesgo del cliente**. Hoy la calculadora deriva a un asesor humano; no
hay proceso ni documento que formalice la aceptación de ese riesgo.

**Propuesta a validar/redactar por la abogada** (punto de partida, no texto final):

1. **Cláusula del piso de volumen** en el Acuerdo: declarar explícitamente que el Consolidado
   LCL tiene un volumen mínimo comercializable (hoy 1 m³) por el gasto fijo del BL propio, y que
   DTD puede rechazar o derivar a evaluación comercial cualquier solicitud por debajo de ese
   piso.
2. **Cláusula de excepción por alto valor comercial:** DTD puede, a su sola discreción y previa
   evaluación de un asesor, aceptar carga bajo el piso cuando el valor comercial de la mercancía
   lo justifique. En ese caso el Cliente **reconoce y acepta expresamente** que el costo fijo del
   BL propio puede representar una proporción desproporcionada del valor del flete, y asume ese
   riesgo económico.
3. **Cómo se documenta la aceptación** (abierto — necesita decisión de la abogada, no solo
   redacción): la excepción hoy se resuelve por WhatsApp con un asesor, canal que no deja
   evidencia con la misma fuerza que la aceptación digital versión+hash del Acuerdo (cláusula
   13.1). Opciones a evaluar: (a) capturar la conversación de WhatsApp como evidencia informal
   —ya es lo que pasa hoy, sin respaldo formal—; (b) un addendum/rider digital específico para
   estos casos, firmado con el mismo mecanismo de versión+hash antes de confirmar el embarque;
   (c) un checkbox de riesgo explícito en el flujo de aceptación del Portal cuando el asesor
   registre el embarque bajo el piso. **No implementar nada de esto en código hasta que la
   abogada defina el mecanismo** — es una decisión legal, no solo de producto.

**Al publicar v3.1, si se incorpora:** sincronizar los mismos 3 espejos del punto 1 de este
archivo (`acuerdo-servicios-v3.mdx`, `lib/legal-public.ts`, migración `legal_docs`) — y si se
elige la opción (b) o (c) de arriba, hay trabajo de código pendiente aparte (no cubierto acá).

### 6. Cláusula 11.3 — sacar la terminología mexicana y anclarla al marco venezolano (2026-07-30, decisión Sam)

**El problema.** La 11.3 vigente dice **"Derechos ARCO"** (Acceso, Rectificación,
Cancelación, Oposición). Eso es la nomenclatura de la **ley mexicana**: no existe en
el derecho venezolano. Además empaqueta tres finalidades distintas en un solo
consentimiento y mete la transferencia internacional dentro de la aceptación general.

Detectado en la auditoría de datos personales:
[`docs/legal/privacidad/AUDITORIA-2026-07.md`](privacidad/AUDITORIA-2026-07.md) §7.2.

**Texto vigente (v3.0, NO editar — está congelado y hay aceptaciones vinculadas):**

> *11.3. Datos personales: tratamiento exclusivo para fines logísticos, administrativos
> y de comunicación comercial, con consentimiento expreso para almacenamiento y
> transferencia internacional. Derechos ARCO: solicitud escrita a info@dtdcargo.com con
> asunto "Privacidad".*

**Propuesta de reemplazo para v3.1** (punto de partida para la abogada, no texto final):

> **11.3. Datos personales.**
>
> **(a) Finalidad.** DTD Cargo trata los datos personales del Cliente y de las personas
> que este designe únicamente para prestar el servicio contratado, cumplir sus
> obligaciones administrativas, contables, fiscales y legales, y comunicarse con el
> Cliente sobre su operación.
>
> **(b) Comunicaciones comerciales.** El envío de novedades, promociones u ofertas
> requiere una manifestación de voluntad **separada y específica** del Cliente, que
> este puede retirar en cualquier momento **sin que ello afecte la prestación del
> servicio**.
>
> **(c) Derechos del Cliente.** Conforme al **artículo 28 de la Constitución de la
> República Bolivariana de Venezuela**, el Cliente tiene derecho a acceder a la
> información y a los datos que sobre su persona o sus bienes consten en los registros
> de DTD Cargo, a **conocer el uso que se hace de ellos y su finalidad**, y a solicitar
> su **actualización, rectificación o destrucción** cuando fueren erróneos o afectaren
> ilegítimamente sus derechos. Conforme a la jurisprudencia vinculante de la **Sala
> Constitucional del Tribunal Supremo de Justicia**, puede asimismo solicitar la
> **supresión, la confidencialidad, la inclusión o el uso correcto** de sus datos.
>
> **(d) Cómo ejercerlos.** Por escrito a **info@dtdcargo.com** con el asunto
> "Privacidad", o por el Portal del Cliente. DTD Cargo acusará recibo dentro de **[5]
> días hábiles** y se pronunciará dentro de **[20] días hábiles** contados desde la
> solicitud completa.
>
> **(e) Política de Privacidad.** El detalle de qué datos se recogen, con qué finalidad,
> con quién se comparten y por cuánto tiempo se conservan consta en la Política de
> Privacidad publicada en **dtdcargo.com/privacidad**, identificada por su versión y
> fecha, que forma parte integrante de este Acuerdo.
>
> **(f) Procesamiento fuera de Venezuela.** *(redacción condicionada — ver abajo)*

**Por qué cada cambio:**

| Cambio | Razón |
|---|---|
| Fuera "ARCO" | Terminología **mexicana**. En Venezuela los derechos son los del art. 28 CRBV |
| Se nombran los derechos uno por uno | El art. 28 da **cinco** (incluido "conocer el uso y la finalidad", que es autónomo) y la SC 759/2025 suma cuatro más |
| **No** se ofrecen portabilidad ni oposición | **No son derechos reconocidos en Venezuela.** Prometerlos sería asumir una obligación que la ley no impone |
| Marketing separado del servicio | SC 332/2001: el consentimiento debe ser **específico por finalidad**. Hoy van empaquetados |
| Plazos con número | Venezuela **no fija plazo legal**; el que se publique se vuelve exigible por haberlo publicado. *"Plazo razonable"* no se puede auditar |
| La Política de Privacidad se incorpora **por referencia** | Que se **lea**, no que se **firme**. Hacerla firmar sugiere que todo el tratamiento se apoya en consentimiento, y el día que lo retiren se queda sin base lo que hace falta para operar |

**⬜ (f) queda condicionada a una decisión del founder aún abierta.** Hoy la PWA del
operario en China muestra el nombre del cliente
([`app/m/cn/estibar/actions.ts:131`](../../app/m/cn/estibar/actions.ts)) y la política
publicada declara ese procesamiento (`/privacidad` §4 y §5). Dos redacciones posibles:

- **Si el equipo en China sigue viendo datos de clientes:** declararlo de forma
  específica —qué datos, para qué, a qué equipo— y no dentro de la aceptación general.
- **Si se quita `client_name` de esa superficie** (el Shipping Mark `DTD-NNNN` basta
  para estibar y es seudónimo): (f) se elimina, **y hay que corregir `/privacidad` §4
  y §5**, que hoy declaran una transferencia que dejaría de ocurrir.

**Al publicar v3.1, sincronizar los mismos 3 espejos del punto 1:**
1. `docs/legal/acuerdo-servicios-v3.mdx` → cláusula 11.3
2. `lib/legal-public.ts` (`ACUERDO_SERVICIOS`, bloque de la sección 11 — línea 73)
3. `supabase/migrations/NNNN_*.sql` → INSERT de la fila `legal_docs` v3.1

### 7. Cláusula 7.1 — la modalidad de cobro real no está contemplada (2026-08-20, decisión Sam)

**7.1 de v3.0 sólo ofrece dos modalidades:** *pago anticipado (100% antes del embarque)* o
*pago contra entrega (PCE)*, y en PCE fija el plazo desde la **notificación de arribo**
(15 días hábiles antes de que corran retención y bodegaje).

**Lo que la operación hace de verdad no es ninguna de las dos:** la gestión de cobranza
**arranca de 5 a 10 días ANTES de que la mercancía llegue a puerto venezolano**, y el pago
se completa en esa ventana — antes del arribo, no después. Aplica a **todo marítimo**: LCL
puerta a puerta, consolidado y FCL.

**Y falta la excepción al "sin adelantos":** si el **flete resulta más costoso que la
mercancía**, se exige un **50% por adelantado**. Hoy el texto legal no la nombra, aunque es
la única condición dura del esquema.

**Qué pedirle al abogado:** una tercera modalidad (o una redacción de PCE que admita el
cobro pre-arribo) + la excepción del 50% con su criterio de disparo.

**Ya reflejado fuera del texto congelado:**
- `/faq` → `lib/faqs.ts` ("¿Cuándo pago mi mercancía?").
- Base del bot → `faq-knowledge-base.md` §22 (respuesta + nota interna).
- Manual del asesor → `equipo-crm/02-respuestas-CRM.md` §10 `/pago`.

### 8. Anexo A — la ventana de arrepentimiento y el cargo por cancelación (2026-08-20, decisión Sam)

Dos divergencias **deliberadas** entre el Anexo A de v3.0 y la regla comercial vigente. Se
anotan, no se parchean, porque el texto de v3.0 está congelado.

**8a. El corte se mueve.** **A.2** corta el reembolso cuando la carga es *recibida,
consolidada o embarcada* — o sea, ya al **recibirla en bodega de origen**. La regla vigente
lo corta más tarde: **el punto de no retorno es la salida del contenedor**. Mientras el
contenedor no zarpe, el cliente puede retirar su mercancía; se le despacha al destino que
indique y **él paga ese flete**, más los costos ya causados al recibirla. Confirmada la
salida del depósito en China, hasta ahí llega el servicio de DTD Cargo.

**8b. 🔴 El cargo de A.3 se elimina.** **A.3** cobra **5% del flete cotizado** (10% con
gestiones iniciadas), **mínimo USD 30**. La regla vigente **ya no lo cobra** y el copy
público dejará de mencionarlo.

> ⚠️ **Esta es la divergencia que más pesa, y es consciente.** `/terminos` está `noindex` y
> sin link en el footer (`TERMINOS_LIVE = false`), pero **el Acuerdo v3.0 es vinculante
> igual**: el cliente lo acepta al confirmar su cotización. Hasta que salga v3.1 hay un
> cargo aceptado por contrato que no se cobra y que el FAQ no nombra. Decisión explícita
> del founder el 2026-08-20 — no es un descuido de redacción.

**Qué pedirle al abogado:** reescribir A.2 con el corte en la salida del contenedor, definir
quién asume el flete de salida y los costos causados, y **suprimir A.3**.

**Ya reflejado fuera del texto congelado:**
- `/faq` → `lib/faqs.ts` ("¿Puedo cancelar mi envío o pedir un reembolso?").
- Base del bot → `faq-knowledge-base.md` §17.
- Manual del asesor → `equipo-crm/02-respuestas-CRM.md` §10-bis `/cancelar`.

## Pendientes del abogado ya conocidos (no duplicar aquí)

Los ~11 placeholders `[…]` de v3.0 (RIF, no-competencia, DEG, días de reclamo, prima de
seguro, arts. del Código de Comercio, foro/arbitraje) están marcados **inline** en
`acuerdo-servicios-v3.mdx` y listados en `HANDOFF_CAPA_LEGAL.md` §3. Se resuelven en el
mismo paquete de v3.1.
