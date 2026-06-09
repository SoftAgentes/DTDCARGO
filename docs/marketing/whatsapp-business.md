# WhatsApp Business — Guía de configuración (perfiles corporativos)

> **Para qué:** estandarizar el WhatsApp Business de los teléfonos corporativos de DTD Cargo
> (perfil, logo nuevo, fotos, catálogo de servicios, respuestas automáticas) y **dejar un
> instructivo que el founder reenvía al equipo para que cada quien configure su teléfono**.
>
> **Fuentes:** NAP en [`identidad.md`](identidad.md) · teléfonos en memoria `dtd-corporate-phones` ·
> detalle de servicios en [`lib/servicios-detalle.ts`](../../lib/servicios-detalle.ts) (DTD-0063,
> dictado founder 2026-06-09) · buenas prácticas WhatsApp Business 2025/2026 (ver fuentes al pie).
>
> **Estado:** 🟢 LISTA PARA EJECUTAR — los 3 datos del founder ya están confirmados (email · horario · nº transporte). Falta solo la ejecución manual en los teléfonos + 3 fotos (ver sección 5).

---

## 0 · Datos pendientes de confirmar (bloquean el cierre)

| Dato | Estado |
|---|---|
| **Email público** | ✅ `info@dtdcargo.com` (alias del buzón real `vzla@` en Hostinger — mismo correo) |
| **Horario de atención** | ✅ **Todos los días · 8:00 – 20:00 (GMT-4)** (= `whatsappHours` del sitio) |
| **Nº Transporte (Javier)** | ✅ `+58 424 950 8848` (confirmado founder 2026-06-09) |

> Datos resueltos: email público = `info@dtdcargo.com`, horario WhatsApp = todos los días 8–20.
> *(El sitio también tiene un horario de oficina/fijo distinto: Lun–Vie 9:00–17:00.)*

---

## 1 · Perfil de cada teléfono — qué lleva cada uno

**Regla de oro:** solo **2 números se publican** en el sitio/ads (CRM + Administración). El resto son
internos. Pero **el catálogo de servicios** se carga en los teléfonos que **hablan con el cliente
final**, aunque su número no se publique (el catálogo solo ayuda a quien ya tiene el contacto).

| # | Teléfono | Responsable | Perfil completo | Catálogo de servicios | Respuestas auto |
|---|---|---|---|---|---|
| 1 | `+58 412 166 8021` CRM | — (cuenta API) | ✅ completo (público #1) | ✅ **Sí** ⭐ | ✅ Sí |
| 2 | `+58 241 414 7886` Administración | — | ✅ completo (público #2) | ✅ **Sí** | ✅ Sí |
| 8 | `+58 412 454 5325` Asesor de ventas | — | ✅ completo | ✅ **Sí** ⭐ | ✅ Sí |
| 4 | `+58 414 888 8805` Logística | Alberto | 🟦 básico | ⚪ opcional | ✅ Sí (operativa) |
| 3 | `+58 414 887 0000` Contabilidad | Yoli | 🟦 básico | ❌ No | ✅ Sí (operativa) |
| 5 | `+58 424 950 8848` Transporte ⚠️ | Javier | 🟦 básico | ❌ No | ✅ Sí (operativa) |
| 6 | `+58 414 884 0000` CEO + Dir. Compras | Sam | 🟦 básico | ❌ No | ⚪ opcional |
| 7 | `+58 412 160 5202` Redes sociales | — | 🟦 básico | ❌ No | ⚪ opcional |

- **✅ completo** = todos los campos de la sección 2 + catálogo + respuestas auto.
- **🟦 básico** = logo + nombre + categoría + descripción + dirección + horario (sin catálogo, sin
  exponer en superficies públicas).
- **⭐ recomendado** = el cliente final compra por acá; el catálogo cierra ventas.

### Nombre del perfil por teléfono

| # | Nombre del perfil (lo que ve el cliente) | Foto de perfil |
|---|---|---|
| 1 | `DTD Cargo` | Logo nuevo (isologo) |
| 2 | `DTD Cargo · Administración` | Logo nuevo |
| 8 | `DTD Cargo · Ventas` | Logo nuevo |
| 4 | `DTD Cargo · Logística` | Logo nuevo |
| 3 | `DTD Cargo · Contabilidad` | Logo nuevo |
| 5 | `DTD Cargo · Transporte` | Logo nuevo |
| 6 | `DTD Cargo · Dirección` | Logo nuevo |
| 7 | `DTD Cargo · Redes` | Logo nuevo |

> El nombre de la persona (Yoli, Alberto, Javier…) **NO va** en el nombre público del perfil — es
> referencia interna. Así, si rota el personal, no hay que renombrar el WhatsApp.

---

## 2 · Datos del perfil (campos comunes a TODOS)

> 📲 **Dónde:** WhatsApp Business → toca el nombre de la empresa arriba → **Editar** (✏️).
> En el menú **⋮ → Herramientas para la empresa → Perfil de empresa**.

| Campo | Valor a cargar | OK |
|---|---|---|
| **Foto de perfil** | Logo nuevo (isologo), cuadrado **mín. 640×640 px** | [ ] |
| **Nombre** | Según la tabla de arriba | [ ] |
| **Categoría** | *Servicio de carga / Logística / Transporte* | [ ] |
| **Descripción** (máx. 512) | "Logística puerta a puerta China → Venezuela. +15 años. DDP todo incluido, consolidación LCL/FCL, aduana, agente de compra e inspección en origen. 📦 Calcula tu importación: dtdcargo.com/calculadora" | [ ] |
| **Dirección** | Edificio Kokuy, Av. Bolívar Norte — Valencia, Carabobo, VE | [ ] |
| **Horario** | `todos los días de 8:00 a 20:00` | [ ] |
| **Email** | `info@dtdcargo.com` | [ ] |
| **Sitio web 1** | `www.dtdcargo.com` | [ ] |
| **Sitio web 2** | `www.dtdcargo.com/calculadora` | [ ] |

---

## 3 · Catálogo de servicios (teléfonos ✅ — CRM, Administración, Ventas)

> 📲 **Dónde:** ⋮ → **Herramientas para la empresa → Catálogo → Agregar artículo**.
> Por cada servicio: **Nombre · Precio · Descripción · Imagen · Enlace**.
> **Precio:** poner **"Consultar"** (no publicamos tarifas; van por calculadora/asesor).
> **Enlace:** el de cada ficha (abajo).

> 💡 Buena práctica 2025: con el catálogo cargado puedes mandar **mensajes multi-producto**
> (hasta 30 ítems en un carrusel dentro del chat) — ideal para que el asesor mande "estos son
> nuestros servicios" en un toque.

### Los 8 ítems del catálogo (texto listo para pegar)

Cada bloque = un artículo. `Nombre` / `Descripción` / `Enlace` van tal cual.

---

**① Puerta a puerta DDP — Pagas al llegar** ⭐ *(principal)*
- **Precio:** Consultar (por CBM y ciudad)
- **Descripción:** Traemos tu mercancía de China hasta tu puerta en Venezuela, todo incluido (DDP): consolidamos en Yiwu, embarcamos, nacionalizamos a nuestro nombre y entregamos. **Pagas cuando la carga llega**, no por adelantado.* Incluye flete, aduana e impuestos y entrega hasta el casco central. No incluye el seguro de carga. ⏱️ 60–90 días puerta a puerta. *(*pueden aplicar restricciones)
- **Enlace:** `www.dtdcargo.com/calculadora`

**② LCL Consolidado (carga compartida, con BL propio)**
- **Precio:** Consultar (por CBM)
- **Descripción:** Carga marítima compartida más económica: tu mercancía viaja consolidada con otros clientes y recibes tu propio Bill of Lading en Venezuela. Incluye consolidación en Yiwu + flete + tu BL. La aduana es opcional aparte. ⏱️ 60–90 días hasta la entrega del BL.
- **Enlace:** `www.dtdcargo.com/servicios`

**③ FCL Consolidado en Bodega (contenedor completo)**
- **Precio:** Consultar
- **Descripción:** Llenamos tu contenedor completo en nuestra bodega de Yiwu con la mercancía de varios de tus proveedores. Incluye recepción, consolidación, despacho de exportación, reserva de contenedor y flete + **7 días de almacenaje gratis**. ⏱️ 40–55 días (no espera salida consolidada).
- **Enlace:** `www.dtdcargo.com/servicios`

**④ FCL Directo Fábrica (cargado en origen)**
- **Precio:** Consultar
- **Descripción:** Tu contenedor completo se carga directo en la fábrica de tu proveedor, sin pasar por bodega. Reservamos contenedor y buque; el BL sale a nombre de nuestra empresa china como shipper (contigo como consignatario) → **el proveedor no puede desviar ni cambiar el destino**. ⏱️ 40–55 días.
- **Enlace:** `www.dtdcargo.com/servicios`

**⑤ Tránsito de aduana y desaduanaje** *(adicional)*
- **Precio:** Consultar (por valorización de la factura)
- **Descripción:** Gestionamos el paso por la aduana venezolana y la nacionalización de tu carga. Servicio adicional para LCL y FCL (en el DDP ya va incluido). Te representamos como tu agente con tu carta poder; tú pagas las planillas directo a la aduana. ⏱️ Nacionalización de 5–6 días hábiles.
- **Enlace:** `www.dtdcargo.com/servicios`

**⑥ Inspección de calidad en China**
- **Precio:** Consultar
- **Descripción:** Verificación física de tu mercancía contra la ficha técnica, en la fábrica y antes del embarque. Parte de nuestra línea de inspección y control de calidad en origen.
- **Enlace:** `www.dtdcargo.com/servicios/inspeccion`

**⑦ Compra asistida / sourcing**
- **Precio:** Consultar
- **Descripción:** Somos tu departamento de compras en China: ubicamos el producto, negociamos, gestionamos la compra y le pagamos al proveedor antes de consolidar tu carga.
- **Enlace:** `www.dtdcargo.com/servicios`

**⑧ Transporte terrestre nacional** *(próximamente)*
- **Precio:** Consultar
- **Descripción:** Transporte de carga por vía terrestre dentro de Venezuela, entre ciudades o hasta tu destino final. **Disponible próximamente.**
- **Enlace:** `www.dtdcargo.com`

> ➕ Servicios secundarios que el asesor puede ofrecer (no hace falta cargarlos como ítem, pero
> sí tenerlos a mano): revisión/conteo en bodega con fotos · etiquetado por pieza · reempaque de
> cajas defectuosas · verificación de proveedores · lab testing (RoHS/CE/FDA) · asesoría de pagos
> (Alipay/WeChat) · courier de muestras (DHL/UPS/FedEx) · visado de negocios chino · registro de
> marca en China (CNIPA).

---

## 4 · Respuestas automáticas — INSTRUCTIVO PARA EL EQUIPO

> **👉 Esta sección es la que reenvías al equipo.** Cada quien lo hace en su teléfono.
> Aplica completa a CRM/Administración/Ventas; los operativos (Logística/Contabilidad/Transporte)
> solo configuran **mensaje de ausencia** + 2-3 respuestas rápidas de su área.

### 4.1 · Mensaje de bienvenida (saludo automático)

**Pasos (Android):** WhatsApp Business → **⋮ → Herramientas para la empresa → Mensaje de
bienvenida** → activá el interruptor → toca el texto → pegá esto → **Destinatarios: Todos** →
**Guardar (✓)**.

```
¡Hola! 👋 Bienvenido a DTD Cargo — logística puerta a puerta de China a Venezuela 🇨🇳→🇻🇪

Para ayudarte rápido, cuéntanos:
1️⃣ ¿Qué producto quieres importar?
2️⃣ ¿Ciudad de destino en Venezuela?
3️⃣ ¿Volumen aproximado (CBM) o nº de cajas?

📦 Calcula tu estimado al instante: www.dtdcargo.com/calculadora

Un asesor te atiende en breve. ¡Gracias por escribirnos!
```

### 4.2 · Mensaje de ausencia (fuera de horario)

**Pasos:** ⋮ → **Herramientas para la empresa → Mensaje de ausencia** → activá → pegá el texto →
**Programar: Fuera del horario de atención** (configurá `todos los días de 8:00 a 20:00`) → **Guardar (✓)**.

```
Gracias por escribir a DTD Cargo 📦

Nuestro horario es todos los días de 8:00 a 20:00. Recibimos tu mensaje y te respondemos apenas abramos.

Mientras tanto, calcula tu importación de China en:
www.dtdcargo.com/calculadora
```

### 4.3 · Respuestas rápidas (atajos con "/")

**Pasos:** ⋮ → **Herramientas para la empresa → Respuestas rápidas → +** → escribí el **atajo**
(ej. `calculadora`) y el **mensaje** → **Guardar**. En el chat, escribí `/` + atajo para insertarla.

| Atajo | Mensaje |
|---|---|
| `/calculadora` | Calcula tu estimado de importación en segundos 👉 www.dtdcargo.com/calculadora — solo necesitas el volumen (CBM) y tu ciudad de destino. |
| `/ddp` | Puerta a puerta DDP: traemos tu carga de China hasta tu puerta, todo incluido (flete + aduana + impuestos + entrega). Pagas cuando llega a Venezuela.* ⏱️ 60–90 días. *(pueden aplicar restricciones) |
| `/aduana` | Gestionamos la nacionalización de tu carga LCL/FCL (en el DDP ya va incluida). Te representamos como agente con tu carta poder. ⏱️ 5–6 días hábiles. |
| `/servicios` | Nuestros servicios: DDP puerta a puerta, LCL/FCL marítimo, aduana, inspección en fábrica y compra asistida en China. Detalle 👉 www.dtdcargo.com/servicios |
| `/track` | Rastrea tu envío con tu código DTD 👉 www.dtdcargo.com/track |
| `/registro` | Regístrate para obtener tu Shipping Mark (唛头) y empezar a importar 👉 www.dtdcargo.com/registro |
| `/horario` | Nuestro horario de atención es todos los días de 8:00 a 20:00. ¡Con gusto te ayudamos! |
| `/ubicacion` | 📍 Edificio Kokuy, Av. Bolívar Norte — Valencia, Carabobo. También operamos bodega propia en Yiwu, China. |
| `/pago` | Con el servicio DDP pagas cuando tu carga llega a Venezuela, no por adelantado.* Te avisamos al arribo. *(pueden aplicar restricciones) |

### 4.4 · Etiquetas para organizar los chats (recomendado en CRM/Ventas)

**Pasos:** mantené presionado un chat → **Etiqueta** → creá/asigná. Sugeridas:
`Nuevo lead` · `Cotizando` · `Esperando pago` · `En tránsito` · `Entregado` · `Postventa`.

---

## 5 · Fotos / assets a preparar — qué imagen va en cada servicio

**Regla:** priorizar **fotos reales de la operación DTD** (bodega de Yiwu, contenedores, equipo,
carga real) → es lo más creíble y anti-genérico. Si no hay foto propia, plantilla cuadrada con
logo + ícono + título. Cada imagen **cuadrada 1080×1080** con un **dato clave en overlay** (poco
texto, fuente Archivo, fondo navy de marca).

| Asset | Dato/overlay encima | Foto real del repo (banco SEO) | Listo |
|---|---|---|---|
| **Foto de perfil (×8)** | — (solo logo) | `public/brand/dtdcargo-isologo-primary.png` | [ ] |
| **Portada / banner** | "China → Venezuela · puerta a puerta" | ✅ `public/videos/equipo-cargando-contenedor-…-poster.jpg` | [ ] |
| **① DDP** ⭐ | "Todo incluido · pagas al llegar · 60–90 días" | ✅ `equipo-cargando-contenedor-…-poster.jpg` (o carga-contenedor) | [ ] |
| **② LCL** | "Carga compartida · con tu BL propio" | ✅ `public/videos/shipping-mark-dtd-pallets-…-poster.jpg` | [ ] |
| **③ FCL Bodega** | "Contenedor completo · 7 días gratis · 40–55 días" | ✅ `public/fotos/carga-contenedor-precinto-…​.jpg` | [ ] |
| **④ FCL Fábrica** | "Directo de fábrica · carga segura" | ✅ `public/fotos/precinto-doortudoor-contenedor-…​.jpg` | [ ] |
| **⑤ Aduana** | "Nacionalización · 5–6 días hábiles" | 🟡 aprox.: `carga-contenedor-precinto` (no hay foto de aduana/puerto) | [ ] |
| **⑥ Inspección** | "Inspección en fábrica antes de embarcar" | ✅ banco externo: `supervisor-inspeccion-fabrica-portapapeles.jpg` (stock) · **mejor:** frame de `videos-redes/reels-oplus/reel-2-inspectora-packing-list.mp4` (operación real DTD) | [ ] |
| **⑦ Compra asistida** | "Tu departamento de compras en China" | ✅ banco externo: `Yiwu-market.jpg` — vista aérea del Mercado Internacional de Yiwu ⭐ | [ ] |
| **⑧ Terrestre** | "Transporte nacional · Próximamente" | ✅ banco externo: `fila-contenedores-carretera.jpg` o `contenedores-sobre-camiones-logistica.jpg` | [ ] |

> ✅ **Banco SEO real disponible** (`public/fotos/` + `public/videos/`): 5 fotos de operación con
> marca DoorTuDoor visible (equipo cargando, precinto, shipping mark, cinta, contenedor). Cubren
> portada + DDP + LCL + FCL Bodega + FCL Fábrica. La cinta-embalaje sirve para reempaque/⑤.
>
> ✅ **Las 3 que faltaban ya aparecieron** en el banco externo de marca (`Desktop/COSAS DEL BRANDING
> Y REDES`): inspección (`supervisor-inspeccion-fabrica-portapapeles.jpg` o, mejor, un frame del reel
> real `reels-oplus/reel-2-inspectora-packing-list.mp4`) · compra asistida (`Yiwu-market.jpg`,
> aéreo del mercado de Yiwu) · transporte terrestre (`fila-contenedores-carretera.jpg`). Ese banco
> también trae fotos reales de operación (`O+ Connect/`, `WhatsApp.../FOTOS DTD/`, `equipo
> doortudoor trabajando.png`) y reels listos para redes (`videos-redes/`).
>
> ➡️ **Para el catálogo:** cargás el archivo directo en el generador (no hace falta meterlo al repo).
> Si querés sumarlas al banco web (`public/fotos/`), copiar **solo** fotos de operación/marca con
> nombre kebab-case. ⚠️ **NUNCA copiar al repo** las cédulas, pasaporte, tarjetas de cliente,
> `QR_Sam`, cartas WeChat ni la carpeta de docs legales de esa misma carpeta — son PII.
>
> **Estilo unificado:** mismo tratamiento en las 8 → franja inferior navy con el logo a la
> izquierda + el dato clave a la derecha. Así el catálogo se ve como un set, no fotos sueltas.
>
> 🛠️ **Generador listo:** abrí [`assets/whatsapp-catalogo-plantillas.html`](assets/whatsapp-catalogo-plantillas.html)
> en el navegador → las 8 tarjetas + portada **enfocadas en el servicio** (foto arriba + franja navy
> con el título del servicio y un dato simple; **sin logo** — la marca va en la metadata del PNG).
> Cargás la foto real de cada servicio, editás título/dato si hace falta, y **Descargar PNG**
> (1080×1080). Cada PNG sale con metadata de procedencia (`Copyright`, `Source: dtdcargo.com`, etc.).

---

## 6 · Buenas prácticas extra (sugeridas — 2025/2026)

1. **Logo en alta resolución y consistente** en los 8 (refuerza marca; nada borroso).
2. **Mensaje multi-producto (MPM):** con el catálogo cargado, el asesor manda hasta 30 servicios en
   un carrusel dentro del chat — más rápido que pegar texto.
3. **Botón "click para chatear" (wa.me):** generar el link `https://wa.me/584121668021?text=Hola%20DTD%20Cargo`
   para webs, ads y redes → abre el chat con mensaje pre-cargado. (El CRM ya lo usa en el sitio.)
4. **Verificar el perfil de empresa** (tilde verde) en el número CRM cuando sea posible — sube confianza.
5. **Respuestas en < 24 h:** WhatsApp premia la respuesta rápida; el mensaje de ausencia cubre el resto.
6. **Catálogo siempre actualizado:** cuando el transporte terrestre pase a activo, cambiar el ítem ⑧.
7. **Coherencia con la web y el FAQ:** los textos de arriba salen de `lib/servicios-detalle.ts` — si
   cambia un servicio en la web, actualizar también el catálogo (y viceversa).
8. **Nunca la palabra "responsabilidad"** en copy de servicios (dispara temas de seguro): usar
   "hasta dónde llega el servicio". Regla de DTD-0063.

---

## 7 · Checklist de cierre

- [ ] Confirmados los 3 datos pendientes (sección 0)
- [ ] Logo nuevo en los 8 perfiles
- [ ] Datos del perfil (sección 2) en los 8
- [ ] Nombre correcto por número
- [ ] Catálogo de 8 servicios en CRM + Administración + Ventas
- [ ] Imágenes de servicios listas
- [ ] Bienvenida + ausencia + respuestas rápidas en los 3 públicos
- [ ] Ausencia + 2-3 respuestas de área en los operativos
- [ ] Etiquetas creadas en CRM/Ventas
- [ ] Verificado: ningún número 🟦 básico quedó con catálogo o expuesto en la web

---

### Fuentes (buenas prácticas WhatsApp Business)
- [Business To Mark — Profile Optimization 2025](https://www.businesstomark.com/whatsapp-business-profile-optimization-best-practices-2025/)
- [QuickReply.ai — Setting Up a WhatsApp Business Profile](https://www.quickreply.ai/whatsapp-marketing/setting-up-a-whatsapp-business-profile)
- [Kanal — Profile Optimization: 12 Hacks for 2026](https://getkanal.com/blog/whatsapp-business-profile-optimization)
- [MyOperator — Top 10 Best Practices 2025](https://myoperator.com/blog/best-practices-for-using-whatsapp-for-business)
