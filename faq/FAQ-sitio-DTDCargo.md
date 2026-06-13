# Preguntas frecuentes — DTD Cargo (listas para el sitio)
### Borrador final · tuteo venezolano · jun-2026 · destino: /faq (con FAQPage schema)

> Pendientes de Sam para cerrar al 100%: (1) valor del MÍNIMO de envío; (2) política de
> baterías (DG pleno o solo SP188). Marcados con [PENDIENTE].

---

## Guía destacada: cómo poner la dirección de la bodega en Alibaba

Copia y pega esta dirección TAL CUAL en el formulario de Alibaba (en chino, sin traducir):

| Campo en Alibaba | Qué pones |
|---|---|
| 收货人 / Destinatario | `DTD Cargo - [TU SHIPPING MARK]` (ej. DTD Cargo - DTD-1014) |
| 电话 / Teléfono (+86) | `18006891419` |
| 地址 / Dirección | `浙江省义乌市义乌港二期直通仓2栋2号 货7-货11` |
| 省 / Provincia | `浙江省` (Zhejiang) |
| 市 / Ciudad | `义乌市` (Yiwu) — en el selector está bajo `金华市` (Jinhua) |
| 邮编 / Código postal | `322000` |
| 仓库联系人 / Contacto bodega | `林冠 (Lin Guan)` |
| Email | `info@dtdcargo.com` |

**Importante:** en el formulario el destinatario lleva "DTD Cargo + tu Shipping Mark", pero
en el **rótulo físico de la caja** va SOLO tu Shipping Mark (sin nombre ni datos personales).
Tu Shipping Mark es lo que nos permite identificar tu caja.

---

## FAQ

**¿Cómo registro la dirección de DTD en Alibaba para que mi proveedor envíe a la bodega?**
Copia y pega la dirección de nuestra bodega de Yiwu en el formulario de Alibaba, tal cual, en
chino. En "Destinatario" pon `DTD Cargo - [tu Shipping Mark]`, el teléfono +86 18006891419, y la
dirección, provincia (Zhejiang), ciudad (Yiwu, bajo Jinhua) y código postal 322000 de la guía. Tu
Shipping Mark es lo que nos permite saber que esa caja es tuya.

**¿Tienen casillero o bodega en China?**
Sí. Tenemos bodega propia en Yiwu donde recibimos lo que compras en Alibaba, 1688, Taobao o a
cualquier proveedor chino. Tú compras y pides que envíen a nuestra dirección con tu Shipping Mark;
nosotros recibimos, consolidamos y despachamos a Venezuela.

**¿Qué es el Shipping Mark y por qué debo ponerlo?**
Es tu código único en DTD (formato DTD-XXXX). Identifica tu caja en la bodega, el sistema y los
documentos. Ponlo siempre que puedas en el destinatario y en la caja: es lo que nos deja encontrar
tu mercancía rápido y sin confusiones.

**¿Cuánto cuesta enviar? ¿Cómo se cobra el CBM?**
El flete marítimo consolidado se cobra por metro cúbico (CBM) o fracción. Usa la calculadora del
sitio para una estimación al instante según tu volumen y ciudad de destino.

**¿Hay un mínimo para enviar?**
[PENDIENTE: confirmar valor del mínimo.] Puedes consolidar varias compras bajo tu mismo Shipping
Mark para aprovechar mejor el flete.

**¿Cuánto tiempo puede quedarse mi compra en la bodega?**
En China tienes 15 días continuos de almacenaje gratis desde que llega; luego se coordina el
despacho (permanencia máxima 60 días). En Venezuela, 15 días hábiles de gracia desde el arribo; a
partir del día 16 se causa bodegaje por CBM/día. (Acuerdo de Servicios, cl. 4.)

**¿La carga está asegurada?**
El flete no incluye seguro. Puedes contratar un seguro de carga opcional a través de DTD,
solicitándolo antes de que tu mercancía llegue a la bodega de origen y declarando su valor real.

**¿Puedo enviar baterías o productos con batería (powerbanks, electrónica)?**
Sí. Los equipos con baterías pequeñas (hasta 100 Wh, como powerbanks, teléfonos y laptops) viajan
con un trámite simplificado si tu proveedor entrega el certificado UN38.3 y la hoja de seguridad
(MSDS). Las baterías grandes, de scooter o paneles solares son mercancía peligrosa y necesitan
documentos adicionales y un canal especial: escríbenos antes de comprar. Indícalo siempre en tu
pre-alerta. [PENDIENTE: ajustar según política DG pleno vs solo SP188.]

**¿Llegan a mi ciudad?**
Entregamos a nivel nacional desde nuestra sede en Valencia. Si tu ciudad no aparece en la
calculadora, escríbenos y te cotizamos.

**Ya mi proveedor envió, ¿qué hago ahora?**
Carga tu pre-alerta en el portal: tu Shipping Mark, el número de guía (tracking) del proveedor y la
descripción/packing list. Así sabemos que tu mercancía viene en camino y la recibimos a tu nombre.

**¿Puedo rastrear con el número que me dio mi proveedor chino?**
No. Ese número es del courier interno de China. Para seguir tu envío con DTD usa el código que te
damos al abrir tu embarque, en dtdcargo.com/track.

**Si envío a la bodega de DTD en vez de a Venezuela, ¿pierdo la protección de Alibaba?**
No. La protección de Trade Assurance depende de que pagues dentro de Alibaba, no de la dirección de
entrega. Solo pagar por fuera de la plataforma la anula.

---
*Listo para pegar en lib/faqs.ts. Implementación: la primera entrada como destacada; FAQPage schema
en /faq; enlazar la guía de Alibaba desde el portal (pre-alerta), el registro y el correo de bienvenida.*
