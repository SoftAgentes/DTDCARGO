---
sdd: politicas-digitales-verificacion
title: "Políticas digitales (Cookies + Privacidad) — paquete de verificación para la abogada"
status: proposed
author: DTD Cargo
created: 2026-07-12
updated: 2026-07-12
related: [acuerdo-servicios-v3]
confidencialidad: interna
---

# Políticas digitales de DTD Cargo — Paquete de verificación
### Companion del *Acuerdo de Servicios y Políticas Generales v3* · Documento v3 · 12 de julio de 2026

> **PARA:** Abogada de DTD Cargo. **DE:** DTD Cargo. **OBJETO:** Verificación de las dos políticas digitales del sitio (Cookies y Privacidad) que acompañan al Acuerdo de Servicios v3. Son **borradores comercial-legales**; falta tu visto bueno para considerarlas definitivas.

## 1. Qué estás verificando
Dos documentos públicos, complementarios entre sí y subordinados al Acuerdo de Servicios (relación **mercantil entre comerciantes**, no de consumidor):
- **Política de Cookies** — qué cookies usa el sitio, cuáles son opcionales, cómo se pide el consentimiento.
- **Política de Privacidad** — qué datos se recogen, para qué, con quién se comparten, transferencia China↔Venezuela, conservación, derechos.

Ambas ya están **implementadas en el sitio** (páginas `/cookies` y `/privacidad`, enlazadas desde el pie de página) con un mecanismo técnico de consentimiento (ver §4).

## 2. Nuevos updates de esta ronda (lo que cambió para tu verificación)
Cambios aplicados a la **Política de Privacidad** para que el texto refleje exactamente lo que el sistema hace:
1. **Dirección de entrega:** se aclara que se recoge **en el Portal**, no en el registro inicial.
2. **Datos sensibles nombrados:** el Portal guarda **foto del documento de identidad (cédula/RIF)** y **comprobantes de pago (con datos bancarios)** — ahora declarados de forma expresa.
3. **Seguridad y evidencia:** nueva fila que declara la recolección de **dirección IP y user-agent** para proteger la cuenta, prevenir abuso y **dejar constancia de la aceptación electrónica** (liga con la cláusula 13 del Acuerdo, Ley sobre Mensajes de Datos y Firmas Electrónicas).
4. **Datos de terceros:** nuevo párrafo — el usuario declara tener permiso para compartir datos de un tercero (referido, destinatario de la entrega).

Decisiones del founder ya fijadas (no requieren cambio, se listan para tu contexto):
- **Responsable = solo "DTD Cargo"** (sin razón social ni RIF visibles en estas políticas).
- **Proveedores (Privacidad §4):** en **genérico** (sin nombrar Supabase/Resend/Vercel/Google/Kommo), para no amarrar el texto al stack.
- **Conservación fiscal (Privacidad §6):** en **genérico** ("el tiempo que exija la ley").
- **Dirección física:** **omitida** por ahora (hay un desfase de dirección en el sistema pendiente de alinear).

## 3. Puntos abiertos que te pedimos revisar / confirmar
| # | Punto | Estado propuesto |
|---|---|---|
| 1 | Plazo de respuesta a derechos (acceso/rectificación/supresión) | Hoy: "plazo razonable". ¿Fijamos un número (p. ej. 15 días hábiles)? |
| 2 | Plazos de conservación fiscal/contable | Genérico. Confirmar si conviene un número concreto con el contador. |
| 3 | Fraseo de transferencia internacional China↔VE (Privacidad §5) | Redactado honesto según la operación real; validar suficiencia legal. |
| 4 | Base legal citada | Se apoya en Ley sobre Mensajes de Datos y Firmas Electrónicas + habeas data (Constitución art. 28). ¿Agregamos algo? |
| 5 | Mención de menores de edad | Frase estándar incluida; confirmar. |
| 6 | Consentimiento de cookies al login/registro (no en primera visita) | Viable porque el consentimiento arranca en "denegado" y no cae ninguna cookie opcional antes de aceptar (ver §4). Validar el enfoque. |

## 4. Cómo funciona el consentimiento (contexto técnico, no legal)
- **Google Consent Mode v2 con default = "denegado":** mientras el usuario solo navega/lee, la analítica y la publicidad de Google corren en modo restringido y **no plantan cookies reales** en su equipo.
- **Banner de consentimiento** al ir a **acceder o registrarse** (punto de mayor intención): aceptar/rechazar las cookies opcionales. La elección se guarda en una cookie propia `dtd_cookie_consent` (6 meses) y se puede cambiar desde **"Preferencias de cookies"** en el pie de página.
- **Separación estricta Portal ↔ analítica:** la analítica **nunca** se carga dentro del Portal del Cliente ni en páginas cuya URL lleve datos del cliente. No se envía información personal a Google.

---
---

# ANEXO A — POLÍTICA DE COOKIES (texto vigente)

> Operador del sitio: **DTD Cargo** · https://dtdcargo.com · info@dtdcargo.com · WhatsApp +58 412 166 8021 · Última actualización: 12 de julio de 2026

## 1. Qué es una cookie
Una cookie es un pequeño archivo de texto que un sitio web guarda en tu navegador (o dispositivo) cuando lo visitas. Sirve para que el sitio funcione, recuerde tus preferencias o entienda cómo se usa. Algunas se borran al cerrar el navegador (de sesión) y otras permanecen un tiempo (persistentes). En esta política tratamos igual a las cookies y a otras tecnologías equivalentes de almacenamiento local del navegador.

## 2. Cómo pedimos tu consentimiento
Dividimos las cookies en **necesarias** (que no requieren tu permiso porque sin ellas el servicio no funciona) y **opcionales** (analítica y publicidad, que solo activamos si las aceptas).
- **Mientras solo navegas y lees el sitio, no instalamos ninguna cookie opcional.** Las cookies de analítica y publicidad de Google arrancan en un modo restringido, sin almacenar información en tu equipo, hasta que das tu consentimiento.
- Cuando vas a **registrarte o iniciar sesión** en el Portal del Cliente, te mostramos el aviso de cookies para que aceptes o rechaces las opcionales. También puedes cambiar tu decisión cuando quieras (ver sección 7).
- Las cookies **estrictamente necesarias** (por ejemplo, mantener tu sesión iniciada) se activan siempre que usas esas funciones, porque son imprescindibles para prestarte el servicio que pediste.

Tu elección se guarda en una cookie propia (`dtd_cookie_consent`) para no volver a preguntarte en cada visita.

## 3. Qué cookies usamos

**a) Estrictamente necesarias (siempre activas, no requieren consentimiento)**

| Cookie | Quién la pone | Duración | Para qué |
|---|---|---|---|
| `sb-…-auth-token` | DTD Cargo (Supabase) | Sesión | Mantener tu sesión iniciada de forma segura en el Portal. |
| Verificación de login (PKCE) | DTD Cargo (Supabase) | Minutos, durante el login | Completar el inicio de sesión con enlace mágico de forma segura. |
| `dtd_cookie_consent` | DTD Cargo | 6 meses | Recordar si aceptaste o rechazaste las cookies opcionales. |

> Estas cookies **no** se usan para publicidad ni se comparten con terceros con fines de marketing.

**b) De preferencia / funcionales**

| Cookie | Quién la pone | Duración | Para qué |
|---|---|---|---|
| `portal-theme` | DTD Cargo | 12 meses | Recordar si prefieres el Portal en modo claro u oscuro. |

**c) De analítica *(opcionales — solo si las aceptas)***

| Cookie | Quién la pone | Duración | Para qué |
|---|---|---|---|
| `_ga` | Google Analytics 4 | 2 años | Distinguir visitantes de forma anónima para medir el uso del sitio. |
| `_ga_25CD7BZH98` | Google Analytics 4 | 2 años | Mantener el estado de la sesión de analítica. |

Usamos Google Analytics 4 solo en las páginas públicas de marketing. **Nunca** cargamos analítica dentro del Portal ni en páginas cuya dirección contenga datos tuyos.

**d) De publicidad *(opcionales — solo si las aceptas)***

| Cookie | Quién la pone | Duración | Para qué |
|---|---|---|---|
| `_gcl_au` | Google Ads | 90 días | Atribuir de forma anónima si llegaste desde un anuncio. |
| `_gcl_aw` / `_gcl_gb` | Google Ads | 90 días | Solo si llegas desde un clic de anuncio de Google; miden esa conversión. |

## 4. Tus datos en el Portal del Cliente
El Portal maneja **información confidencial**. Las cookies del Portal son **únicamente de sesión y seguridad**; no usamos cookies de publicidad ni rastreo dentro del Portal. Tu sesión viaja **cifrada** y el acceso está restringido a tu propia cuenta. **No compartimos** los datos del Portal con Google ni con ninguna plataforma de publicidad. Los documentos que subes no se guardan en cookies.

## 5. Terceros que instalan cookies
El único tercero que puede instalar cookies a través del sitio es **Google** (Analytics 4 y Ads), y **solo si aceptas** las opcionales. Políticas de Google: https://policies.google.com/privacy · https://policies.google.com/technologies/cookies

## 6. Base para usar cookies
- **Necesarias y de sesión:** imprescindibles para el servicio → sin consentimiento.
- **Analítica y publicidad:** **con base en tu consentimiento**, revocable en cualquier momento.

## 7. Cómo cambiar o retirar tu consentimiento
Desde **"Preferencias de cookies"** en el pie de página; y borrando/bloqueando cookies desde tu navegador (bloquear las necesarias puede romper el Portal).

## 8. Cambios en esta política
Publicaremos siempre la versión vigente con su fecha.

## 9. Contacto
info@dtdcargo.com · WhatsApp +58 412 166 8021.

---
---

# ANEXO B — POLÍTICA DE PRIVACIDAD (texto vigente, con los updates de esta ronda)

> Responsable: **DTD Cargo** · https://dtdcargo.com · info@dtdcargo.com · WhatsApp +58 412 166 8021 · Última actualización: 12 de julio de 2026

En DTD Cargo cuidamos tu información. Esta política explica **qué datos recogemos, para qué los usamos, con quién los compartimos y qué derechos tienes**. Es complementaria a la Política de Cookies.

## 1. Qué datos recogemos y cuándo

| Momento | Datos que recogemos |
|---|---|
| **Formulario de contacto** | Nombre, correo, teléfono/WhatsApp y el mensaje que escribes. |
| **Estimado / Calculadora** | Datos del envío (tipo de carga, volumen/peso, origen-destino) y el contacto que dejas para enviarte el estimado (EST-XXXX). |
| **Registro de cliente** | Nombre, documento de identidad (cédula o RIF), correo y teléfono. Al registrarte se genera tu Shipping Mark. **La dirección de entrega se agrega después, en tu perfil del Portal.** |
| **Portal del Cliente** | Información de tus envíos, direcciones de entrega, **foto de tu documento de identidad (cédula/RIF)**, **comprobantes de pago (que pueden incluir datos bancarios)**, otros documentos que subes, pagos reportados y comunicaciones con nuestro equipo. |
| **Seguimiento de envío** | El código de rastreo que introduces. |
| **Navegación** | Datos técnicos anónimos de uso del sitio (solo si aceptas las cookies de analítica). |
| **Seguridad y registro de actividad** | **Tu dirección IP y datos técnicos de tu navegador (user-agent)**, para proteger tu cuenta, prevenir usos indebidos y dejar constancia de tu aceptación electrónica de nuestros términos. |

**No pedimos** datos sensibles que no necesitemos, ni recogemos información de menores de edad de forma intencional.

**Datos de terceros que nos aportas.** Si nos das datos de otra persona —por ejemplo, a quién refieres o quién recibirá tu envío en destino—, declaras que cuentas con su permiso para compartirlos. Usamos esos datos únicamente para el fin por el que nos los diste.

## 2. Para qué usamos tus datos
Prestarte el servicio (cotizar, coordinar, dar seguimiento); comunicarnos contigo; gestionar tu cuenta; cumplir obligaciones administrativas, contables y legales; mejorar el sitio y medir campañas (**solo si aceptas** las cookies). **No vendemos tus datos.**

## 3. Base para el tratamiento
Ejecución del servicio; tu consentimiento (marketing y cookies opcionales, revocable); cumplimiento de obligaciones legales.

## 4. Con quién compartimos datos
Proveedores de infraestructura y alojamiento; proveedor de correo transaccional; herramientas de analítica/publicidad (Google, **solo si aceptas**); nuestro equipo operativo en Venezuela y China; autoridades (solo cuando la ley lo exija). No compartimos la información del Portal con plataformas de publicidad.

## 5. Transferencias internacionales
Operamos entre **China y Venezuela**; parte de tus datos de contacto y de la carga se procesan en ambos países por nuestro propio equipo, solo en la medida necesaria para el servicio.

## 6. Cuánto tiempo guardamos tus datos
Mientras tengas relación activa; después, el tiempo que exijan las obligaciones legales/contables/fiscales; los datos de contacto que no derivan en servicio se conservan solo lo necesario y luego se eliminan o anonimizan.

## 7. Cómo protegemos tus datos
Acceso restringido a tu propia cuenta (controles a nivel de base de datos); sesiones cifradas; acceso interno limitado; documentos en almacenamiento seguro.

## 8. Tus derechos
Acceder, corregir, eliminar (salvo lo que debamos conservar por ley) y retirar consentimiento. Para ejercerlos: info@dtdcargo.com.

## 9. Comunicaciones de marketing
Puedes darte de baja cuando quieras. Los correos transaccionales (envío, cuenta, factura) no son marketing.

## 10. Cambios en esta política
Publicaremos la versión vigente con su fecha; si el cambio es importante, te lo comunicaremos.

## 11. Contacto
info@dtdcargo.com · WhatsApp +58 412 166 8021.
