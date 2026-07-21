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

## Pendientes del abogado ya conocidos (no duplicar aquí)

Los ~11 placeholders `[…]` de v3.0 (RIF, no-competencia, DEG, días de reclamo, prima de
seguro, arts. del Código de Comercio, foro/arbitraje) están marcados **inline** en
`acuerdo-servicios-v3.mdx` y listados en `HANDOFF_CAPA_LEGAL.md` §3. Se resuelven en el
mismo paquete de v3.1.
