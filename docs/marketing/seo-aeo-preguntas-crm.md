# SEO + AEO — 20 preguntas prioritarias desde el CRM

> **Estado:** aprobado editorialmente con condiciones; **no autorizado todavía para publicación**  
> **Corte de evidencia CRM:** 2026-06-07  
> **Preparado:** 2026-07-22  
> **Revisión canónica:** 2026-07-22  
> **Destino principal:** `/faq` + páginas canónicas existentes del sitio público

## Resultado

Estas son las 20 preguntas que DTD Cargo debe responder primero para captar y convertir demanda
orgánica relacionada con importaciones China→Venezuela. El orden combina dos señales:

1. **Frecuencia observada en Kommo:** el análisis de 401 conversaciones identificó seis temas
   comerciales de alta frecuencia y cuantificó que 42% del Inbox era cortesía/ruido, 10% eran
   consultas de cotización y 6% consultas de servicios específicos.
2. **Prioridad editorial:** para los puestos 7–20 no existen conteos individuales conservados en
   el repo. Se ordenaron los temas recurrentes de la base Kommo por intención comercial, utilidad
   para el cliente y capacidad de DTD para responder con experiencia propia.

Por tanto, esto es un **top 20 operativo**, no una tabla estadística que finja una frecuencia
exacta para cada pregunta. Las posiciones 1–6 sí conservan el orden del bloque marcado como
“alta frecuencia” en la investigación original.

## Evidencia utilizada

- [`../specs/0062-crm-erp-cierres-automaticos/spec.md`](../specs/0062-crm-erp-cierres-automaticos/spec.md):
  diagnóstico agregado del Inbox de Kommo, sin PII.
- [`../specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md`](../specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md):
  intenciones, variaciones de las preguntas y respuestas preparadas para Kommo.
- [`../../lib/faqs.ts`](../../lib/faqs.ts): respuestas públicas actualmente vigentes en `/faq`.
- [`../../equipo-crm/DTDCARGO-baterias-CRM.md`](../../equipo-crm/DTDCARGO-baterias-CRM.md):
  política operativa y respuestas sobre baterías.
- [`adquisicion.md`](adquisicion.md): nombre comercial vigente de la oferta, **Puerta a Puerta**
  con la aclaración “todos los gastos pagados”.

La investigación técnica anterior de `tamibot/kommo-crm-audit` no se usó para inferir preguntas:
sirvió para diseñar la integración, pero no contenía las conversaciones de los clientes. La fuente
de demanda real es SDD-0062.

## Acta de revisión canónica

**Decisión:** el enfoque, la arquitectura SEO/AEO y la redacción base quedan aprobados. La aplicación
al sitio público permanece cerrada hasta completar las validaciones indicadas abajo.

| Estado editorial | Preguntas | Decisión |
|---|---|---|
| Aprobadas | 1, 2, 4, 5, 8, 9, 12, 13, 14, 18 y 20 | Se pueden implementar cuando el founder autorice tocar el sitio público. |
| Aprobadas con validación obligatoria | 3, 15, 16, 17 y 19 | Operaciones debe confirmar plazos, cobertura, restricciones y alcance real. |
| Aprobadas con validación obligatoria | 6, 7, 10 y 11 | Comercial/Legal debe confirmar pagos, gastos incluidos, importador y documentos. |
| Rechazadas | Ninguna | No hay temas descartados; sí hay afirmaciones condicionadas. |

La aprobación no convierte los rangos operativos ni las condiciones legales en datos permanentes.
Todo monto, plazo, política de mercancía, cobertura o requisito documental debe mostrar fecha de
revisión y tener un responsable interno.

## Decisión SEO/AEO

No se deben crear 20 páginas delgadas con variaciones de una misma consulta. La arquitectura
recomendada es:

- **`/faq`:** índice canónico con las 20 respuestas directas y el resto de preguntas de soporte.
- **Páginas de intención:** ampliar solo cuando ya existe una ruta natural como `/calculadora`,
  `/registro`, `/portal`, `/servicios` o `/glosario`.
- **Cada respuesta:** comenzar con una conclusión autosuficiente de 40–80 palabras; después añadir
  proceso, límites, prueba operativa y un solo siguiente paso.
- **Consistencia:** la respuesta visible, los datos estructurados, Kommo y el contenido del portal
  deben decir lo mismo.
- **Nombre de la oferta:** aunque la investigación histórica contiene la sigla técnica anterior,
  el copy nuevo usa **Puerta a Puerta (todos los gastos pagados)**, según la decisión comercial del
  17 de julio de 2026.
- **Sin trucos AEO:** Google considera AEO/GEO parte de SEO y no exige marcado especial. Desde el
  7 de mayo de 2026 ya no muestra resultados enriquecidos de FAQ; `FAQPage` puede mantenerse para
  consumidores compatibles, pero no debe presentarse como palanca de ranking ni de AI Overviews.

Fuentes actuales: [guía oficial de Google para búsqueda generativa](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide),
[retiro del resultado enriquecido FAQ](https://developers.google.com/search/updates#removing-faq-rich-result)
y [medición de citas en respuestas de IA de Bing](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview).

## Mapa de las 20 preguntas

| # | Pregunta principal | Señal | Intención | Ruta canónica |
|---:|---|---|---|---|
| 1 | ¿Cómo empiezo a importar de China con DTD Cargo? | CRM alta frecuencia | Acción | `/registro` |
| 2 | ¿Cuánto cuesta traer mercancía de China a Venezuela? | CRM alta frecuencia | Cotización | `/calculadora` |
| 3 | ¿Cuánto tarda un envío marítimo de China a Venezuela? | CRM alta frecuencia | Expectativa | `/faq` |
| 4 | ¿Cómo envío mis compras a la bodega de DTD Cargo en China? | CRM alta frecuencia | Operación | `/faq` + `/registro` |
| 5 | ¿Qué significan FOB y EXW? | CRM alta frecuencia | Comparación | `/glosario` + `/faq` |
| 6 | ¿Cómo y en qué moneda pago mi envío? | CRM alta frecuencia | Pago | `/faq` |
| 7 | ¿Qué incluye el servicio Puerta a Puerta? | CRM + oferta principal | Comparación | `/servicios` + `/faq` |
| 8 | ¿Cómo se calcula el CBM y el costo del flete? | Cluster cotización | Cálculo | `/calculadora` |
| 9 | ¿Qué diferencia hay entre carga consolidada LCL y contenedor FCL? | CRM servicios | Comparación | `/servicios` + `/faq` |
| 10 | ¿Quién paga la aduana y los impuestos? | CRM servicios | Riesgo/costo | `/faq` |
| 11 | ¿La importación queda a mi nombre y recibo documentos? | CRM servicios | Legal/operativa | `/faq` |
| 12 | ¿Qué es el Shipping Mark y por qué debo ponerlo? | CRM operación | Definición | `/registro` + `/faq` |
| 13 | ¿Qué hago después de que mi proveedor envía la mercancía? | CRM operación | Acción | `/portal` + `/faq` |
| 14 | ¿Cómo rastreo mi envío de China a Venezuela? | CRM seguimiento | Acción | `/portal` |
| 15 | ¿DTD Cargo entrega en toda Venezuela? | CRM cobertura | Local/comercial | `/calculadora` + `/faq` |
| 16 | ¿Qué productos están prohibidos o restringidos? | CRM calificación | Riesgo | `/faq` |
| 17 | ¿Puedo enviar baterías o productos electrónicos con batería? | CRM servicio específico | Viabilidad | `/faq` |
| 18 | ¿DTD Cargo valida proveedores en China? | CRM servicio específico | Confianza | `/servicios` + `/faq` |
| 19 | ¿DTD Cargo inspecciona la mercancía antes de embarcar? | CRM servicio específico | Confianza | `/servicios/inspeccion` + `/faq` |
| 20 | ¿DTD Cargo puede ayudarme a comprar y consolidar varios proveedores? | CRM servicio específico | Servicio | `/servicios` + `/faq` |

## Contenido listo para publicar

### 1. ¿Cómo empiezo a importar de China con DTD Cargo?

**Respuesta directa:** Regístrate gratis en `dtdcargo.com/registro`. Recibirás tu Shipping Mark,
un código único con formato `DTD-XXXX` para identificar tus cajas en China, y acceso al portal del
cliente. Después registras cada compra mediante una pre-alerta y compartes con tu proveedor la
dirección y las etiquetas generadas para ese envío.

**Desarrollo útil:** El proveedor no necesita crear una cuenta. Desde tu portal puedes enviarle un
enlace bilingüe con la dirección de la bodega, tu Shipping Mark y las etiquetas que debe pegar en
cada caja. Así DTD puede recibir, identificar y consolidar tus compras correctamente.

**Siguiente paso:** Regístrate en `/registro` antes de pedirle al proveedor que despache.

### 2. ¿Cuánto cuesta traer mercancía de China a Venezuela?

**Respuesta directa:** El costo depende principalmente del volumen de la carga en metros cúbicos
(CBM), la modalidad del envío y la ciudad de entrega en Venezuela. Para una referencia inmediata,
introduce las medidas de tus cajas en `dtdcargo.com/calculadora`. Las cargas muy pesadas,
restringidas o especiales deben confirmarse con un asesor antes de embarcar.

**Desarrollo útil:** La calculadora usa la tarifa vigente y evita publicar montos que pueden quedar
desactualizados. Un contenedor completo, una carga especial o una operación con aduana propia
requiere una cotización individual.

**Siguiente paso:** Calcula el estimado en `/calculadora` y solicita confirmación si tu carga tiene
baterías, líquidos, densidad alta o requisitos especiales.

### 3. ¿Cuánto tarda un envío marítimo de China a Venezuela?

**Respuesta directa:** Un envío marítimo de China a Venezuela tarda normalmente entre 60 y 90
días. El rango incluye el traslado interno hasta la bodega de DTD en China, la espera de la próxima
salida —habitualmente cada 15 a 21 días— y la travesía marítima. Aduana, clima y cambios de ruta
pueden modificar el estimado.

**Desarrollo útil:** El plazo no comienza automáticamente cuando pagas al proveedor, sino cuando la
carga entra en el flujo logístico. La fecha aplicable a tu embarque debe confirmarse al cotizar y
se actualiza en el portal a medida que avanza.

**Siguiente paso:** Si ya embarcaste, consulta el estado desde `/portal`; si todavía estás
cotizando, confirma la próxima salida con el equipo.

### 4. ¿Cómo envío mis compras a la bodega de DTD Cargo en China?

**Respuesta directa:** Envía tus compras a la bodega de DTD Cargo en Yiwu, Zhejiang, usando la
dirección vigente en chino y tu Shipping Mark en el nombre del destinatario. El código debe aparecer
también en cada caja. La guía de `/faq` muestra cómo llenar Alibaba, 1688 o Taobao campo por campo.

**Desarrollo útil:** Primero regístrate para obtener tu Shipping Mark. Luego crea la pre-alerta y
comparte el enlace bilingüe con el proveedor. Si la caja llega sin el código, DTD puede recibirla
pero no identificar inmediatamente a qué cliente pertenece.

**Siguiente paso:** Usa la guía interactiva de `/faq` y no copies direcciones antiguas desde chats.

### 5. ¿Qué significan FOB y EXW cuando compro en China?

**Respuesta directa:** FOB y EXW reparten costos, trámites y riesgos entre vendedor y comprador. En
FOB, el vendedor despacha la exportación y entrega la mercancía a bordo del buque en el puerto de
embarque acordado; desde allí el riesgo pasa al comprador. En EXW, el vendedor pone la mercancía a
disposición en su fábrica o almacén y el comprador asume casi todo el traslado y los trámites.

**Desarrollo útil:** Para comparar dos proveedores no basta con mirar el precio del producto. Pide
el Incoterm, el punto de entrega y el costo de llevar la mercancía hasta la bodega de DTD en Yiwu.
Eso permite comparar el costo total, no solo el precio de fábrica. En carga contenerizada conviene
confirmar con el agente de carga si FCA corresponde mejor que FOB al punto real de entrega, según la
[lista de verificación oficial de Incoterms® 2020](https://library.iccwbo.org/content/clp/Others/incoterms_2020_checklist_2024-update.pdf).

**Siguiente paso:** Envía a tu asesor la cotización del proveedor antes de aprobar la compra.

### 6. ¿Cómo y en qué moneda pago mi envío?

**Respuesta directa:** El servicio de logística internacional se cotiza en dólares porque la mayor
parte de sus costos —flete, aduana y operación en China— se paga en divisas a terceros. La forma de
pago y los datos aplicables a tu operación los entrega un asesor de manera segura, vinculados a tu
Shipping Mark.

**Desarrollo útil:** No publiques comprobantes ni datos bancarios en grupos. Si ya tienes una
factura, reporta el pago desde el portal para que el equipo pueda verificarlo y mantener visible tu
saldo.

**Siguiente paso:** Confirma los datos con tu asesor o reporta el comprobante desde `/portal`.

### 7. ¿Qué incluye el servicio Puerta a Puerta?

**Respuesta directa:** En el servicio Puerta a Puerta (todos los gastos pagados), DTD Cargo coordina
el flete desde China, la aduana, los impuestos y la entrega en tu dirección en Venezuela. Recibes un
precio integral y no gestionas directamente la nacionalización. La importación no queda a tu nombre;
si necesitas documentos propios, debes elegir la opción con tu propia aduana.

**Desarrollo útil:** Puerta a Puerta describe qué gastos y gestiones incluye el servicio; LCL y FCL
describen si compartes un contenedor o usas uno completo. Son decisiones distintas y conviene definir
ambas antes de cotizar.

**Siguiente paso:** Indica al asesor si prefieres comodidad puerta a puerta o importar formalmente
a nombre de tu empresa.

### 8. ¿Cómo se calcula el CBM y el costo del flete?

**Respuesta directa:** El CBM es el volumen de la carga en metros cúbicos. Para una caja, multiplica
largo × ancho × alto usando metros; para varias cajas, suma el volumen de todas. DTD usa ese volumen,
la ruta y la modalidad para estimar el flete marítimo. Cargas densas o especiales pueden necesitar
una revisión adicional.

**Desarrollo útil:** Una caja de 0,50 m × 0,40 m × 0,30 m ocupa 0,06 CBM. Si tienes diez cajas
iguales, el total es 0,60 CBM. Introduce las medidas reales, no las del producto sin empaque.

**Siguiente paso:** Usa `/calculadora` con las dimensiones exteriores de cada caja.

### 9. ¿Qué diferencia hay entre carga consolidada LCL y contenedor FCL?

**Respuesta directa:** En LCL tu mercancía comparte el contenedor con otros importadores y pagas
por el volumen que ocupa; es útil cuando no llenas un contenedor. En FCL reservas un contenedor
completo para tu operación. La mejor opción depende del volumen, la frecuencia, el tipo de carga y
la necesidad de control operativo.

**Desarrollo útil:** DTD puede reunir en Yiwu mercancía de varios proveedores bajo el mismo Shipping
Mark antes de consolidar. Tener varios proveedores no obliga a contratar un contenedor completo.

**Siguiente paso:** Comparte el volumen total y la cantidad de proveedores para cotizar LCL frente
a FCL.

### 10. ¿Quién paga la aduana y los impuestos al importar de China?

**Respuesta directa:** En Puerta a Puerta (todos los gastos pagados), la aduana y los impuestos están
incluidos en el precio acordado con DTD Cargo. Si importas con tu propia aduana, DTD lleva la carga
hasta el almacén fiscal y tú asumes impuestos, permisos y gastos posteriores de nacionalización.

**Desarrollo útil:** Elegir una modalidad cambia tanto el precio como la documentación que recibes.
No compares una tarifa Puerta a Puerta con una tarifa hasta almacén fiscal como si incluyeran lo
mismo.

**Siguiente paso:** Define antes de cotizar si necesitas que la importación quede a tu nombre.

### 11. ¿La importación queda a mi nombre y recibo documentos?

**Respuesta directa:** Depende de la modalidad. En Puerta a Puerta (todos los gastos pagados)
recibes la mercancía, pero la importación no queda a tu nombre y no obtienes documentos de
nacionalización propios. Con tu propia aduana, tú eres el importador y los documentos pueden quedar
a nombre de tu empresa, aunque asumes los impuestos, permisos y gastos del almacén fiscal.

**Desarrollo útil:** Esta decisión debe tomarse antes de embarcar. Cambiarla cuando la carga ya está
en tránsito puede no ser viable y puede alterar costos y requisitos.

**Siguiente paso:** Si necesitas soporte fiscal o documental a nombre de tu empresa, dilo en la
primera conversación de cotización.

### 12. ¿Qué es el Shipping Mark y por qué debo ponerlo?

**Respuesta directa:** El Shipping Mark es el código único de cada cliente de DTD Cargo, con formato
`DTD-XXXX`. Identifica tus cajas en la bodega de China, el sistema y los documentos del envío. Debe
aparecer en el destinatario y en el rótulo de cada caja para evitar confusiones al recibir y
consolidar mercancía.

**Desarrollo útil:** En China también se conoce como 唛头. No es un número de rastreo del courier:
es la identidad logística de tu mercancía dentro de DTD.

**Siguiente paso:** Obtén el tuyo gratis en `/registro` antes de despachar.

### 13. ¿Qué hago después de que mi proveedor envía la mercancía?

**Respuesta directa:** Registra una pre-alerta en el portal con tu Shipping Mark, el número de guía
del proveedor y la descripción o packing list. La pre-alerta avisa a DTD que la mercancía va en
camino y permite relacionar el paquete con tu compra cuando llega a la bodega en Yiwu.

**Desarrollo útil:** Hazla antes de que llegue la primera caja, especialmente si usarás validación,
reempaque, etiquetado o consolidación de varios trackings. Algunos servicios deben coordinarse antes
de la recepción.

**Siguiente paso:** Entra a `/portal` y crea la pre-alerta apenas recibas el tracking chino.

### 14. ¿Cómo rastreo mi envío de China a Venezuela?

**Respuesta directa:** Sigue el envío desde tu portal en `dtdcargo.com/portal`, donde aparecen las
etapas y eventos de la carga. El tracking que entrega el proveedor chino solo cubre el trayecto
interno hasta la bodega de Yiwu. Después, DTD identifica la mercancía con el Shipping Mark y muestra
los eventos del envío; cuando el embarque ya tiene BL o número de contenedor, esos datos permiten
consultar la etapa naviera.

**Desarrollo útil:** El Shipping Mark no es un número universal de rastreo ni muestra por sí solo la
posición del buque. La antigua ruta pública `/track` redirige al inicio de sesión del portal. El
portal puede mostrar hitos internos, datos del buque y un enlace naviero cuando esa información está
disponible; no se debe prometer seguimiento satelital o tiempo real para todos los embarques.

**Siguiente paso:** Revisa primero el portal y escribe al asesor solo si falta un evento esperado.

### 15. ¿DTD Cargo entrega en toda Venezuela?

**Respuesta directa:** Sí. DTD Cargo coordina entregas desde Valencia hacia ciudades de toda
Venezuela. El costo depende del destino y de si la dirección está dentro de la ruta base o necesita
un tramo terrestre adicional. La calculadora ofrece una referencia y el asesor confirma la entrega
para la dirección exacta.

**Desarrollo útil:** “Puerta a puerta” significa que no tienes que retirar la carga en un puerto,
pero una ubicación fuera del casco o de la ruta habitual puede cambiar el precio de la última milla.

**Siguiente paso:** Introduce tu ciudad en `/calculadora` y confirma la dirección final al cotizar.

### 16. ¿Qué productos están prohibidos o restringidos para importar?

**Respuesta directa:** Algunos productos requieren permisos, documentación o un canal especial, y
otros no pueden aceptarse. Entre los rubros sensibles están baterías de litio, inflamables,
aerosoles, gases, armas y réplicas, medicamentos, perecederos, productos pirateados y explosivos.
La viabilidad depende del producto exacto y de la normativa aplicable.

**Desarrollo útil:** No ocultes ni declares con otro nombre una mercancía restringida. Una carga mal
declarada puede generar retenciones, decomisos, multas y retrasos para todo el contenedor consolidado.

**Siguiente paso:** Envía la ficha técnica y la lista de productos antes de pagar al proveedor.

### 17. ¿Puedo enviar baterías o productos electrónicos con batería?

**Respuesta directa:** Sí, pero debes declararlos antes de comprar y embarcar. Para equipos con
baterías pequeñas, el proveedor debe entregar el certificado UN38.3 y la hoja de seguridad MSDS del
modelo. Las baterías grandes, de scooters o de sistemas solares se tratan como mercancía peligrosa
y requieren evaluación, documentos y canal especial.

**Desarrollo útil:** La capacidad en Wh debe estar identificada en la batería. DTD aplica manejo y
tarifa especial a la carga con baterías; la calculadora permite marcar esa condición para obtener
una referencia.

**Siguiente paso:** Envía UN38.3, MSDS, capacidad en Wh y ficha del producto antes de confirmar la
compra.

### 18. ¿DTD Cargo valida proveedores en China?

**Respuesta directa:** Sí. DTD Cargo ofrece validación de proveedores para comprobar que la empresa
existe y evaluar información como su registro, capacidad e instalaciones. Es un servicio adicional
útil antes de pagar a un proveedor nuevo o comprometer una producción importante.

**Desarrollo útil:** La validación de la empresa no sustituye la inspección del producto terminado.
Son controles distintos: uno reduce el riesgo del proveedor y el otro revisa la mercancía contra lo
acordado.

**Siguiente paso:** Comparte los datos legales, el enlace de la tienda y la cotización del proveedor
para definir el alcance.

### 19. ¿DTD Cargo inspecciona la mercancía antes de embarcar?

**Respuesta directa:** Al recibir la mercancía en Yiwu, DTD registra la recepción, cuenta los bultos
y revisa su estado externo. Para comprobar calidad, cantidad y especificaciones contra una ficha
técnica, puedes contratar una inspección de producto con muestreo y evidencia fotográfica antes de
embarcar.

**Desarrollo útil:** La recepción en bodega no equivale a una inspección de calidad. Si necesitas
validar color, medidas, funcionamiento, empaque o tolerancia de defectos, define esos criterios por
escrito antes de producir.

**Siguiente paso:** Solicita la inspección antes de que la mercancía salga de la fábrica o sea
consolidada.

### 20. ¿DTD Cargo puede ayudarme a comprar y consolidar varios proveedores?

**Respuesta directa:** Sí. Con compra asistida, DTD puede ayudarte a ubicar y gestionar proveedores,
negociar la compra y coordinar el pago cuando aplique. Además, la bodega de Yiwu puede recibir
compras de distintos proveedores bajo tu mismo Shipping Mark y consolidarlas en un solo envío.

**Desarrollo útil:** Para cotizar correctamente se necesita la lista de productos, cantidades,
especificaciones y presupuesto. Consolidar reduce la fragmentación logística, pero cada proveedor
debe usar el Shipping Mark y la pre-alerta correspondientes.

**Siguiente paso:** Envía tu lista de compra y registra cada tracking en el portal.

## Cruce con la investigación de palabras clave aportada

La captura entregada por el founder confirma demanda alrededor de diez grupos: importar de China a
Venezuela, Puerta a Puerta, compra en Alibaba, mercado de Yiwu, agente de carga, LCL/FCL, inspección,
registro de marca en China, visado de negocios y Shipping Mark. La imagen no muestra volumen,
dificultad ni posición actual; por eso sirve para **descubrir clusters**, no para declarar cuál tiene
más búsquedas ni para reemplazar Search Console.

| Cluster de la captura | Página canónica recomendada | Tratamiento |
|---|---|---|
| Cómo importar de China a Venezuela | `/importar-de-china` | Página pilar; responder preguntas 1, 3, 4 y 13 sin duplicarlas. |
| Puerta a Puerta | `/puerta-a-puerta` | Usar el nombre comercial vigente; “DDP” solo como término explicativo secundario si hace falta captar la consulta. |
| Comprar en Alibaba | `/faq` + guía existente | Expandir la guía práctica; no crear tres artículos casi iguales. |
| Mercado de Yiwu | Futura guía editorial | Una pieza de autoridad sobre Yiwu, abastecimiento y operación de DTD. |
| Agente de carga China–Venezuela | `/servicios` | Página transaccional; explicar alcance, responsabilidades y CTA. |
| Carga consolidada LCL vs. FCL | `/servicios` + `/fcl` | Comparación útil y enlace a la calculadora correspondiente. |
| Inspección y control de calidad | `/servicios/inspeccion` | Página de servicio con alcance, entregable y límites verificables. |
| Registro de marca en China | `/servicios#registro-marca-cn` + futura guía | Un artículo pilar, con revisión jurídica y fuentes oficiales. |
| Visado de negocios chino | `/servicios` | Mantenerlo separado de logística y validar requisitos antes de publicar. |
| Shipping Mark | `/registro` + `/faq` | Definición AEO y conversión a registro; no presentarlo como tracking naviero. |

### Idea aprobada 1 — guía de rastreo marítimo

- **Estado:** concepto aprobado para redacción; no publicado.
- **Título canónico:** **Cómo rastrear un envío marítimo de China a Venezuela paso a paso**.
- **Slug propuesto:** `/noticias/como-rastrear-envio-maritimo-china-venezuela`.
- **Veredicto sobre los títulos de la captura:** “desde Venezuela” se rechaza porque invierte el
  sentido principal de la ruta. “Guía para seguir tu carga marítima paso a paso” es correcto pero
  poco específico. “¿Dónde está mi mercancía?” funciona como subtítulo o H2, no como H1 principal.
- **Estructura:** tracking del proveedor dentro de China → recepción/pre-alerta en Yiwu → Shipping
  Mark dentro de DTD → BL y contenedor en la etapa naviera → hitos del portal → qué hacer cuando no
  aparece un evento.
- **Guardas de exactitud:** no decir que el Shipping Mark sustituye al BL/contenedor; no prometer
  “tiempo real” universal; explicar que la disponibilidad de buque, ETA y enlace naviero depende de
  que esos datos hayan sido asociados al embarque.

### Idea aprobada 2 — precio semanal de un contenedor

- **Estado:** concepto aprobado; automatización y publicación bloqueadas hasta reparar y validar la
  fuente semanal.
- **Título canónico:** **¿Cuánto cuesta un contenedor de China a Venezuela? Tarifas actualizadas**.
- **Destino recomendado:** ampliar la página viva `/fcl`, no crear una noticia nueva cada semana.
  Una sola URL acumula autoridad y puede mostrar “actualizado el…” más el histórico.
- **Qué existe hoy:** calculadora FCL pública, caché semanal de rutas China→Venezuela y tarifa
  referencial. La automatización cachea solo **40' High Cube**; 20' y 40' estándar se derivan a un
  asesor. El precio firme se confirma al reservar.
- **Metodología propuesta:** fijar una canasta estable de rutas; excluir tarifas vencidas, errores y
  rutas sin oferta; publicar la mediana como referencia central, un rango representativo bajo–alto,
  cantidad de rutas válidas, fecha y tipo de contenedor. No promediar tamaños diferentes. Si más
  adelante existen pesos reales por volumen de negocio, usar promedio ponderado y documentarlos.
- **Alcance del precio:** debe llamarse **flete marítimo referencial**. No llamarlo precio Puerta a
  Puerta ni “todo incluido” mientras no incorpore de forma verificable aduana, impuestos, operación
  en origen y entrega final.
- **Histórico:** la tabla actual hace `upsert` por ruta y sobrescribe el valor anterior; no conserva
  series semanales. Antes de publicar el histórico se necesita una tabla de snapshots inmutable y
  una política de retención/corrección.
- **Bloqueos operativos:** el diagnóstico del 19 de julio registró que el cron semanal no escribía
  desde el 6 de julio. Debe quedar verde y monitoreado antes de exponer una fecha de actualización.
  La fuente se mantiene white-label y la página pública no consume la API en cada visita.

### Idea aprobada 3 — protección de marca en China

- **Estado:** tema aprobado; publicación condicionada a revisión jurídica y al cierre del alcance
  comercial del servicio.
- **Título canónico:** **Cómo proteger y registrar tu marca en China antes de fabricar: guía para
  importadores venezolanos**.
- **Destino recomendado:** un solo artículo pilar. “Por qué debes protegerla” y “5 riesgos de no
  hacerlo” funcionan como H2 dentro de esa guía, no como artículos separados que compitan entre sí.
- **Contenido mínimo:** búsqueda previa, titular correcto, marca denominativa/gráfica y posible
  versión china, clases de productos/servicios, vía nacional frente al Sistema de Madrid, documentos,
  examen, seguimiento, uso y vigilancia. Incluir una advertencia clara de que no es asesoría legal.
- **Claim aprobado de DTD:** “DTD Cargo prepara documentos y traducciones, brinda orientación desde
  Venezuela y coordina la gestión legal ante CNIPA en China”. No afirmar que DTD es la autoridad, que
  garantiza el registro o que actúa directamente como agente habilitado sin confirmar ese contrato.
- **Bloqueos comerciales:** el catálogo interno todavía tiene pendientes los honorarios, tasas
  oficiales, tiempos, exclusiones y entregable. Esos datos deben cerrarse antes del CTA público.
- **Fuentes jurídicas base:** [CNIPA](https://english.cnipa.gov.cn/art/2026/3/17/art_2996_205374.html)
  exige que el solicitante extranjero sin domicilio comercial en China tramite la vía nacional
  mediante una agencia de marcas establecida legalmente; la vía del
  [Sistema de Madrid](https://www.wipo.int/en/web/madrid-system/how_to/file/basics) parte de una
  solicitud o registro base y cada oficina designada decide la protección bajo su propia ley. Como
  la [ley china revisada](https://english.cnipa.gov.cn/art/2026/7/15/art_3090_207198.html) entra en
  vigor el 1 de enero de 2027, el artículo debe llevar fecha y revisión jurídica antes de publicarse.

## Reglas de implementación

1. No publicar las 20 como artículos independientes. Primero ordenar y destacar las preguntas en
   `/faq`; después reforzar las rutas canónicas de la tabla.
2. Mantener la respuesta directa visible en HTML. El acordeón es válido si el usuario puede abrirlo,
   pero la respuesta no debe existir solo en un chatbot, imagen o PDF.
3. Incluir fecha de revisión y responsable del contenido operativo. Tiempos, tarifas, recargos,
   dirección de bodega y políticas de mercancía cambian y necesitan revisión trimestral.
4. Enlazar hacia una sola acción útil. Evitar cerrar cada bloque con varios CTA competidores.
5. No repetir la razón social ni el RIF en texto visible. Marca pública: DTD Cargo.
6. No afirmar que AEO garantiza citas, rankings ni inclusión en AI Overviews.
7. Antes de publicar cambios de baterías, mercancía restringida, pagos o aduana, validar el copy con
   Operaciones y, cuando corresponda, Legal.

## Medición recomendada

- Search Console: impresiones, clics, CTR y consultas por `/faq` y cada ruta canónica.
- GA4: búsquedas internas del explorador FAQ, apertura de cada pregunta y salida a calculadora,
  registro, portal o WhatsApp.
- Kommo: etiquetar la intención inicial con estas 20 categorías y medir volumen mensual, escalado a
  asesor y conversión. Esto permitirá reemplazar el ranking editorial 7–20 por frecuencia real.
- Bing Webmaster Tools: revisar páginas citadas y grounding queries en AI Performance cuando la
  propiedad esté configurada.

## Pendientes de publicación

- Validación de Operaciones: preguntas 3, 15, 16, 17 y 19.
- Validación Legal/comercial: preguntas 6, 7, 10 y 11.
- Instrumentación: hoy el repo conserva el análisis agregado de 401 conversaciones, no el conteo
  por intención. Para tener un ranking estadístico vivo hay que etiquetar o clasificar el Inbox.
- Implementación pública: priorizar/ordenar estas 20 dentro de `/faq` y ajustar las páginas
  canónicas sin duplicar el contenido.
- Contenido futuro: redactar la guía de rastreo; reparar y validar el cron + diseñar snapshots antes
  de la página semanal FCL; cerrar alcance comercial y revisión jurídica antes de la guía de marca.
