# Microsoft Clarity en dtdcargo.com: evaluación

> **Fecha:** 2026-11-18 · **Pedido por:** Sam (vía Director General) · **Tipo:** solo investigación.
> No se creó cuenta, no se aceptaron términos, no se instaló nada y no hay ID de proyecto en este documento.
> Esto no es asesoría legal; los puntos de privacidad son un inventario técnico para revisar con el abogado.

## Respuesta corta

**Sitio público: sí, con condiciones (fases 1 a 4). Portal del Cliente: sí, por decisión de Sam, en la fase 5 y con las condiciones de §3.6.**

- En las páginas públicas (home, servicios, tarifas, calculadora, geo-páginas, noticias), Clarity da lo que GA4 no da: **ver cómo se usa la página** (grabaciones, mapas de calor, clics de rabia o sin respuesta y abandono). Es gratis y no tiene tope de tráfico.
- En el **Portal del Cliente** entra después del público y con condiciones propias, porque:
  1. Hoy le prometemos por escrito al cliente que **nunca** cargamos analítica en el Portal.
  2. Los términos de Clarity excluyen contenido de **servicios financieros**, y el Portal tiene facturas y finanzas.
  3. El modo de enmascarado por defecto **no oculta nombres ni direcciones**.
  4. Las URL del Portal llevan el **código del envío**.
  5. Clarity **no puede borrar los datos de una sola persona**: para borrarlos hay que eliminar el proyecto completo.

  Los riesgos están en §3.3 y las condiciones que los atienden, en §3.6.

> *Recomendación original (superada por la decisión de Sam):* «Portal del Cliente: no, por ahora».

## Decisión de Sam (2026-11-18)

Texto de Sam, en la conversación con esta sesión, después de leer la recomendación:

> «Página web. También podemos ponerlo en el portal del cliente. Es lo mismo, confirmo.»

**Alcance decidido:** el sitio público **y** el Portal del Cliente. Esto deja sin efecto la recomendación original de no instalarlo en el Portal. Los riesgos de §3.3 siguen siendo reales y se convierten en **condiciones de implementación** del Portal (§3.6 y fase 5).

**Lo que esta decisión no autoriza:**

- crear la cuenta;
- aceptar los términos;
- cambiar la política;
- encender Clarity en producción.

Cada uno de esos pasos sigue necesitando su OK concreto (§5).

---

## 1. Qué es y qué da

Microsoft Clarity es una herramienta de **analítica de comportamiento**: registra cómo se renderiza la página y lo que hace el visitante (movimiento del ratón, clics, desplazamiento, cambios de tamaño de la ventana) para reconstruirlo después ([FAQ](https://learn.microsoft.com/en-us/clarity/faq), [datos que recoge](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data)).

| Función | Qué es | Para qué nos sirve |
|---|---|---|
| **Grabaciones de sesión** | Reconstrucción de la visita a partir del DOM y los eventos. No es un video de la pantalla. | Ver dónde se traba alguien en la calculadora, en `/estimacion` o en `/registro`. |
| **Mapas de calor** | Clics, desplazamiento y zonas de atención agregadas por página. | Saber si se ven los CTA de la home y hasta dónde se baja en las geo-páginas. |
| **Insights (clics de rabia, clics sin respuesta, desplazamiento excesivo, regreso rápido)** | Señales automáticas de frustración ([FAQ](https://learn.microsoft.com/en-us/clarity/faq)). | Encontrar elementos que parecen botones y no lo son, o pasos confusos de la calculadora. |
| **Integración con Google Analytics** | Clarity crea una dimensión personalizada en GA y muestra los segmentos de GA en Grabaciones ([FAQ: integración GA](https://learn.microsoft.com/en-us/clarity/faq)). | Abrir las grabaciones de quienes hicieron `whatsapp_click` o `generate_lead`. |
| **Search Console** | La documentación oficial que revisé **no** describe integración con Google Search Console. | No contar con eso. Search Console sigue siendo la fuente de SEO (`docs/marketing/seo.md`). |

**Costo y límites.** Microsoft dice que es *"a free service forever"* sin límites de tráfico, y que no hay tope de sitios por cuenta, de proyectos ni de miembros del equipo ([FAQ](https://learn.microsoft.com/en-us/clarity/faq)). Solo admite 10 invitaciones pendientes a la vez.

**Retención** ([Data retention](https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention)):

| Dato | Retención |
|---|---|
| Datos de reproducción (grabaciones) | **30 días** |
| Datos de clics y mapas de calor | **9 meses** |
| Sesiones marcadas o favoritas | **9 meses** |

Pasado ese plazo, los datos y sus respaldos se borran y no se pueden recuperar. **No existe borrado por persona:** según la FAQ, para borrar los datos de un usuario hay que eliminar el proyecto entero.

**Límites técnicos.** Clarity no graba dentro de iframes de terceros ni de `canvas` ([FAQ](https://learn.microsoft.com/en-us/clarity/faq)). Por eso el widget de Chatwoot y los embeds en sitios ajenos quedarían fuera de la grabación.

---

## 2. Cómo se implementaría aquí

### 2.1 Lo que ya existe (y conviene reutilizar)

| Pieza | Dónde | Qué hace |
|---|---|---|
| GA4 + Google Ads con gtag directo | `components/Analytics.tsx` | Es la única analítica de terceros en el código. No hay Hotjar, PostHog, Plausible, Vercel Analytics ni el beacon de Cloudflare. |
| Lista de rutas privadas | `components/Analytics.tsx:71` (`PRIVATE_PREFIXES`) y `:92` (`isPrivatePath`) | Excluye `/studio`, `/portal`, `/m`, `/back`, `/invitar`, `/acceso`, `/entrar`, `/abrir`, `/verificar`, `/p`, `/interno`, `/marca`, `/tarifas/embed`, `/fcl/embed` y `/track/<código>`. |
| Consent Mode v2 (por defecto, denegado) | `components/Analytics.tsx:502` | Mientras no haya cookie `dtd_cookie_consent=granted`, Google corre sin cookies. |
| Banner de cookies | `components/CookieConsentBanner.tsx`, montado en `app/layout.tsx:312` | **El sitio sí tiene banner.** El encargo decía que no, y no es así. Se abre solo en `/entrar` y `/registro` (`CookieConsentBanner.tsx:38`); en el resto del sitio se abre desde «Preferencias de cookies» en el pie. La mayoría de los visitantes nunca decide, así que su consentimiento queda **denegado**. |
| CSP | `next.config.ts:66` (`script-src`) y `:75` (`connect-src`) | Allowlist explícita. Hoy bloquearía Clarity. |

### 2.2 Dónde va el script

- Va en un componente cliente nuevo, `components/Clarity.tsx`, montado junto a `<Analytics />` en `app/layout.tsx`, con `next/script` y la estrategia `afterInteractive` o `lazyOnload` ([Next.js: Script](https://nextjs.org/docs/app/api-reference/components/script), [Next.js: librerías de terceros](https://nextjs.org/docs/app/guides/third-party-libraries)). `@next/third-parties` no trae componente para Clarity, así que se usa el snippet oficial.
- Debe usar **la misma guarda que GA**: `isPrivatePath`, la regla de query no aprobada y la de credenciales en el fragmento. No basta con «no está en `/studio`».
- Además, hay que excluir del todo **`/registro`** en la fase 1 (formulario de alta con datos personales) y mantener fuera `/entrar` y `/abrir`. Clarity guarda la URL completa de la página, y `/abrir` recibe `token_hash` en la query: grabarla sería filtrar un enlace de acceso.
- **Navegación SPA hacia una zona privada:** si el script ya cargó en una página pública y el usuario pasa con navegación cliente a `/portal`, el script sigue vivo. GA tiene un *kill-switch* (`ga-disable-*`). Para Clarity, en la fase 1 hay que comprobar el corte: llamar a `clarity('consent', false)` (documentado: borra las cookies y detiene el seguimiento, [Consent API v2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)) o forzar una navegación completa en esa frontera. *Inferencia: no encontré en la documentación oficial una orden para detener solo la grabación.* Esto necesita una prueba e2e que mire las peticiones a `*.clarity.ms` después de entrar al Portal.

### 2.3 Variable de entorno y apagado

- La variable sería `NEXT_PUBLIC_CLARITY_ID`. Si está ausente, vacía, con solo espacios o vale `off`, **no se carga nada**.
- **Sin ID de respaldo en el código.** Es lo contrario de GA ([SDD-0518](../specs/0518-ga-respaldo-cadena-vacia/spec.md)): aquí, si la variable falta, la opción segura es apagado.
- Como es `NEXT_PUBLIC_*`, el valor queda fijado en el build. Apagarlo exige reconstruir la imagen. El apagado inmediato sin despliegue es pausar o eliminar el proyecto desde el panel de Clarity.
- `prueba.dtdcargo.com` debe ir con `off` (igual que GA en [SDD-0544](../specs/0544-prueba-producto-minimo/spec.md)).
- El ID del proyecto no es secreto, porque aparece en el HTML público. Aun así va en la configuración del entorno y no en el repo, como pide el encargo.

### 2.4 CSP y Cloudflare

- Según Microsoft ([Clarity CSP](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-csp)), hay que permitir `https://www.clarity.ms`, `https://[a-z].clarity.ms` (en la práctica, `https://*.clarity.ms`) y `https://c.bing.com`.
- Microsoft sugiere meterlos en `default-src`. **Aquí no:** van en `script-src`, `connect-src` e `img-src`, solo en el CSP del sitio público. Ni el CSP de las rutas privadas ni `frame-ancestors` se tocan.
- `c.bing.com` es el dominio que pone las cookies de terceros de Microsoft (`MUID` y otras, §3.1). Si se decide no aceptarlas nunca, se puede dejar fuera de `img-src` y `connect-src`. *Inferencia: hay que medir en la fase 1 que el panel siga recibiendo datos.*
- **Cloudflare:** no hace falta cambiar nada en Cloudflare para que funcione. No conviene inyectarlo con Zaraz ni con otra herramienta del borde, porque saltaría la guarda de rutas privadas del código. Si en el futuro Cloudflare agrega cabeceras CSP propias, también tendrían que incluir estos dominios.

### 2.5 Rendimiento

- Microsoft dice que el script es asíncrono y no afecta el tiempo de carga ([FAQ](https://learn.microsoft.com/en-us/clarity/faq)). **No publica el peso del script**, así que hay que medirlo.
- Riesgo probable (*inferencia*): el costo no está en la descarga sino en observar el DOM mientras la persona interactúa. Puede subir el **INP** en páginas pesadas como la calculadora o las tarifas.
- Antes y después de encenderlo, en la fase 1, hay que medir LCP, INP y CLS de `/`, `/tarifas` y `/calculadora` con Lighthouse o con los datos de campo de Search Console. Si el INP empeora de forma visible, se carga con `lazyOnload` o solo en una muestra de páginas.

---

## 3. Privacidad y cumplimiento

### 3.1 Qué recoge, dónde lo guarda y quién lo ve

- **Qué recoge** ([datos que recoge](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data)): estructura y contenido del DOM (con el texto sensible enmascarado), interacciones (clic, desplazamiento, movimiento, selección, entrada), errores de script, rendimiento, URL e IDs de usuario y sesión.
- **Ubicación:** Clarity estima la ubicación por IP ([FAQ: consentimiento](https://learn.microsoft.com/en-us/clarity/faq)).
- **Dónde lo guarda:** en la nube de Microsoft Azure. La FAQ no da la región. Para clientes fuera de la UE, la contraparte es Microsoft Corporation (EE. UU.).
- **Rol de Microsoft:** la FAQ dice que Clarity *"operates as a data controller"*. Los términos (vistos en fragmentos, porque la página carga con JavaScript) dicen que Microsoft puede usar los datos personales que recoge *"for any purpose in accordance with the Microsoft Privacy Statement"* ([Términos de Clarity](https://clarity.microsoft.com/terms), [Microsoft Privacy Statement](https://www.microsoft.com/privacy/privacystatement)). **Microsoft no trabaja con nuestras instrucciones: decide sus propios fines.** Según la plantilla `evaluacion-proveedores.md` de la skill, eso lo hace «otro que trata datos por su cuenta», y el titular tiene que saberlo.
- **Quién ve los datos:** los miembros del proyecto en Clarity y Microsoft ([FAQ](https://learn.microsoft.com/en-us/clarity/faq)). Microsoft dice que no vende los datos.
- **Cookies** ([Clarity cookies](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-cookies)):

  | Tipo | Cookies | Para qué |
  |---|---|---|
  | Primera parte | `_clck` | ID de usuario y preferencias |
  | Primera parte | `_clsk` | Unir páginas en una sesión |
  | Terceros (Microsoft) | `CLID`, `MUID`, `MR`, `SM`, `ANONCHK` | `MUID` se usa también para publicidad y analítica de Microsoft |

- **Términos:** cada parte debe mantener un aviso de privacidad que cumpla la ley y refleje los términos. Microsoft además recomienda un aviso en el sitio y otro en la política, con enlace a su declaración de privacidad ([texto sugerido](https://learn.microsoft.com/en-us/clarity/setup-and-installation/privacy-disclosure)).
- **Menores:** la misma página dice que Clarity no debe usarse en sitios dirigidos a menores de 18 años. No es nuestro caso.
- **Contenido sensible:** los términos excluyen su uso con contenido que pueda tener *"health care, financial services or government-related information"*. Esta frase salió en la búsqueda sobre la página oficial y en fuentes secundarias. **Hay que releerla en la página viva antes de aceptar los términos.**

### 3.2 Enmascarado

Según [Masking content](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking):

| Modo | Qué enmascara |
|---|---|
| **Strict** | Todo el texto |
| **Balanced** (por defecto) | Solo números y correos |
| **Relaxed** | Nada, salvo campos y menús |

- **Los campos de entrada y los menús desplegables se enmascaran siempre**, en cualquier modo. Lo enmascarado no sale del navegador.
- En **Balanced**, un **nombre, una dirección o un texto libre que la página muestre como texto (no dentro de un input) se graba legible.** Ejemplos: el resumen de una cotización, el saludo «Hola, María», el mensaje de un chat propio.
- `data-clarity-mask="True"` en un elemento enmascara ese nodo y sus hijos, y tiene prioridad sobre el modo del panel.
- El contenido de las hojas de estilo no se enmascara.
- Los cambios de enmascarado tardan hasta una hora y **no son retroactivos**.
- Los parámetros de la URL **no** se enmascaran salvo que se pida a soporte de Clarity, parámetro por parámetro. Por eso las rutas con query sensible se excluyen en el código y no se confía en el enmascarado.

**Para el sitio público, en la fase 1:**

- Modo **Balanced**, más `data-clarity-mask` en:
  - el bloque de resultados de la calculadora y de `/estimacion` cuando muestre datos que escribió la persona;
  - cualquier eco de nombre, teléfono o correo;
  - el formulario de contacto completo.
- Las páginas públicas no deberían tener datos de clientes en el texto. Si una los tiene, es un hallazgo aparte.

### 3.3 El Portal del Cliente: ventajas y riesgos

Sam preguntó si «la página» incluye el Portal y qué ventajas y desventajas tendría instalarlo ahí.

**Lo que se ganaría en el Portal**

- Ver dónde se pierden los clientes al consultar envíos, subir documentos, revisar facturas o usar el chat.
- Detectar errores de interfaz (clics sin respuesta) en pantallas nuevas como la de mensajes o la de cotizaciones.
- Medir la adopción real de secciones (club, referidos, academia) sin preguntarle a nadie.

**Lo que se arriesga o se rompe**

| # | Riesgo | Evidencia |
|---|---|---|
| 1 | **Rompe una promesa publicada.** `/cookies` dice: «**Nunca** cargamos analítica dentro del Portal del Cliente» y «No compartimos los datos de tu Portal con Google ni con ninguna plataforma de publicidad o analítica». Instalarlo exige cambiar la política *antes*, avisar a los clientes que ya se registraron con esa promesa y pasarlo por el abogado. | `app/cookies/page.tsx:238-243` y `:270-273` |
| 2 | **Choque con los términos de Clarity.** El Portal muestra facturas, finanzas y pagos (`app/portal/(app)/facturas`, `finanzas`), que es contenido de servicios financieros, el tipo que los términos excluyen (§3.1). | Términos de Clarity (por confirmar en la página viva) |
| 3 | **El enmascarado por defecto deja ver datos personales.** Nombre, dirección de entrega, Shipping Mark escrito con letras, descripción de la mercancía y texto de los mensajes se renderizan como texto, no en inputs. En Balanced, lo que no es número ni correo queda legible. | [Masking](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking) |
| 4 | **El código del envío va en la URL.** `/portal/envios/[code]` y `/track/<código>`. Clarity guarda la URL completa, y el enmascarado de parámetros no cubre segmentos de ruta. Es la misma fuga que obligó a sacar GA de esas rutas en 2026-07-05. | `app/portal/(app)/envios/[code]`, `docs/marketing/seo.md` §2026-07-05 |
| 5 | **No hay borrado por persona.** Un cliente que ejerza el habeas data (CRBV art. 28: conocer uso y finalidad, pedir destrucción) no puede ser borrado de Clarity sin eliminar todo el proyecto. Las grabaciones duran 30 días; los clics y mapas, 9 meses. | [FAQ](https://learn.microsoft.com/en-us/clarity/faq), [Data retention](https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention) |
| 6 | **Microsoft decide sus propios fines.** Mandarle la sesión de un cliente identificado equivale a darle datos de clientes a un tercero que no actúa por nuestras instrucciones. Choca con la regla del proyecto de no enviar datos de clientes a proveedores no permitidos, y con la sentencia 332/2001 de la Sala Constitucional (finalidad predeterminada y consentimiento previo e informado). | §3.1 |
| 7 | **Acceso al panel.** Quien tenga acceso a Clarity puede ver sesiones de clientes. Si el panel se consulta desde China, hay además tratamiento sujeto a la PIPL, con consentimiento separado para la transferencia. | `.claude/skills/revisar-datos-ve/references/marco-legal-cn-pipl.md` |

Sam decidió incluir el Portal (ver «Decisión de Sam»). Estos riesgos no lo impiden: cada uno tiene su condición en §3.6, y el Portal entra en la fase 5 con su propia SDD.

> *Recomendación original (superada por la decisión de Sam):* no instalarlo en el Portal y, si hacía falta ver uso ahí, preferir una herramienta autoalojada como PostHog (§4).

### 3.4 Consentimiento y aviso de cookies

**Venezuela.** No hay ley de cookies ni autoridad de protección de datos. El marco es:

- la CRBV, art. 28 (conocer uso y finalidad) y art. 60 (intimidad y límite al uso de la informática);
- la sentencia 332/2001 de la Sala Constitucional: consentimiento previo, libre, informado, inequívoco y revocable, finalidad predeterminada y temporalidad.

Fuente: `.claude/skills/revisar-datos-ve/references/marco-legal-ve.md`. Para datos de navegación seudónimos en páginas públicas, lo exigible es **transparencia y finalidad declarada**. Lo que sí obliga con seguridad es **lo que ya publicamos**:

- `/privacidad` dice que los datos técnicos de uso se recogen «solo si aceptas las cookies de analítica» (`app/privacidad/page.tsx:94`).
- `/cookies` dice que el único tercero que pone cookies es Google (`app/cookies/page.tsx:285-288`).

**Microsoft** exige señal de consentimiento solo para visitas desde el EEE, el Reino Unido y Suiza desde el 31-10-2025. Sin consentimiento, Clarity corre **sin cookies**: un ID por página vista, sin unir páginas. Las grabaciones de recorrido completo y los embudos se pierden; los mapas y las interacciones básicas siguen ([Consent API v2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2), [FAQ](https://learn.microsoft.com/en-us/clarity/faq)). Usarlo sin consentimiento no viola los términos. El soporte de Google Consent Mode figura como «coming soon», así que hay que llamar a la API de Clarity aparte.

**Propuesta, coherente con el banner actual:**

1. Configurar el proyecto en Clarity como «requiere consentimiento».
2. Cargar el script en las páginas públicas permitidas. Arranca sin cookies.
3. Cuando `dtd_cookie_consent=granted`, llamar a `clarity('consentv2', { ad_Storage: "denied", analytics_Storage: "granted" })`. El almacenamiento publicitario queda siempre denegado, porque no usamos publicidad de Microsoft.
4. Al revocar desde «Preferencias de cookies», llamar a `clarity('consent', false)`.

**Consecuencia práctica:** como el banner casi nunca se abre fuera de `/entrar` y `/registro`, la mayoría de las sesiones serán por página y sin cookies. Para ver recorridos completos habría que abrir el banner en más páginas. Eso es una decisión de UX y de marca aparte; no se propone aquí.

### 3.5 Qué cambiar en `/privacidad` y `/cookies` (con el abogado)

Hay que cambiarlo **antes** de encenderlo en producción:

- **`/cookies` §3c (analítica):** agregar Clarity con `_clck` y `_clsk` (primera parte) y explicar que corre sin cookies si no se acepta.
- **`/cookies` §5:** dejar de decir que Google es el único tercero. Nombrar a Microsoft y sus cookies de terceros, o declarar que no se aceptan si se bloquea `c.bing.com`.
- **`/privacidad`, lista de terceros (`app/privacidad/page.tsx:290-292`) y el punto de la línea 94:**
  - qué es Clarity y que se graban **interacciones** en páginas públicas, con texto de formularios enmascarado;
  - finalidad: mejorar el sitio;
  - que Microsoft trata esos datos también para sus fines, con enlace a su declaración de privacidad;
  - que se guardan 30 días las grabaciones y 9 meses los mapas;
  - en la fase 1, que **no** se usa en el Portal; en la fase 5, el texto del Portal de §3.6.
- **Aviso en el sitio:** Microsoft recomienda una línea en el pie. Su texto sugerido dice «By using our site, you agree…». No conviene copiarlo, porque presume un consentimiento que nuestro banner no pide así. Basta un enlace a la política desde el pie, que ya existe.
- **Sin promesas que el sistema no cumple:** no escribir «puedes pedir que borremos tu grabación», porque Clarity no lo permite por persona.

### 3.6 Condiciones para el Portal (alcance decidido por Sam)

Para no publicar una promesa falsa ni grabar datos de clientes, el Portal entra así:

1. **Política primero.**
   - Se reescriben `/cookies` (`app/cookies/page.tsx:238-243` y `:270-273`, que hoy dicen «nunca») y `/privacidad` **antes** del encendido.
   - Se avisa a los clientes ya registrados (correo o aviso dentro del Portal), porque se registraron con la promesa anterior.
   - El abogado revisa el texto.
2. **Términos.** Antes de aceptar los términos, se relee en la página viva la cláusula de *financial services*. Si prohíbe el uso en pantallas con facturas o pagos, esas pantallas quedan fuera (punto 4).
3. **Enmascarado Strict solo en el Portal.**
   - Clarity tiene un único modo por proyecto. Lo más simple es un **segundo proyecto** para el Portal, con modo Strict, y el público en Balanced. Cada proyecto lleva su propia llamada de consentimiento ([FAQ](https://learn.microsoft.com/en-us/clarity/faq)).
   - Si se usa un solo proyecto, va `data-clarity-mask="True"` en el contenedor raíz del layout del Portal (`app/portal/(app)/layout.tsx`).
   - En ambos casos, los mapas de clics y las señales de frustración se conservan, y el texto se ve en puntos.
4. **Rutas del Portal que quedan fuera** aunque se cargue en el resto:
   - toda URL con código o ID en la ruta, como `/portal/envios/[code]` (y `/track/<código>` en el público);
   - facturas, finanzas, documentos y mensajes (chat);
   - `(auth)`: callback y registro.

   Una prueba e2e debe fallar si aparece una petición a `*.clarity.ms` en esas rutas.
5. **Consentimiento dentro del Portal.**
   - Clarity corre sin cookies hasta que el cliente acepte, con la misma `dtd_cookie_consent`.
   - Si se quieren recorridos completos de clientes, el Portal debe pedir la decisión una vez, con un texto que diga qué se graba.
6. **Acceso al panel:** solo el equipo de Venezuela que lo necesite, con una cuenta de la empresa. Si alguna vez se consultara desde otro país, se revisa antes la ley aplicable (por ejemplo, la PIPL en China).
7. **Borrado:** la política no promete borrar la grabación de una persona, porque Clarity no puede hacerlo. Decir los plazos: 30 días para las grabaciones y 9 meses para los clics.
8. **El ID de usuario no se manda.** No se usa `clarity('identify', …)` ni se ponen variables con correo, cédula, RIF, Shipping Mark ni nombre. Clarity queda seudónimo.

---

## 4. Comparación

**Lo que ya tenemos (GA4 + Ads):** cuenta visitas, fuentes, conversiones (`whatsapp_click`, `generate_lead`) y audiencias. **No muestra el porqué**: no ve dónde se traba alguien. Clarity **complementa** a GA4, no lo reemplaza.

| | **Clarity** | **PostHog** | **Hotjar (Contentsquare)** | **Plausible** | **Cloudflare Web Analytics** |
|---|---|---|---|---|---|
| Grabaciones y mapas de calor | Sí | Sí | Sí | No | No |
| Analítica de tráfico | Básica | Completa (eventos y embudos) | Básica | Completa y simple | Básica (más rendimiento real, RUM) |
| Costo | Gratis, sin tope | Capa gratis por uso; luego paga por uso | Plan gratis con límites; Hotjar ahora vende como Contentsquare | Sin plan gratis en la nube (desde unos 9 USD/mes); código abierto autoalojable | Gratis |
| Cookies o consentimiento | Cookies propias y de Microsoft; modo sin cookies | Configurable; se puede sin cookies | Usa cookies | **Sin cookies; dicen que no hace falta banner** | Dicen que no recoge datos personales |
| Quién guarda los datos | Microsoft (Azure), que **decide sus fines** | Su nube (EE. UU. o UE) o **nuestro servidor** | Contentsquare | Servidores en la UE, o el nuestro | Cloudflare |
| Borrar a una persona | **No** (solo el proyecto entero) | Sí (ver su doc.) | Ver su doc. | No guarda personas | No guarda personas |
| Integración con lo que hay | GA4 | Reemplazaría parte de GA4 | GA4 | Duplicaría GA4 | Ya usamos Cloudflare delante del sitio |
| Encaje con DTD | **Bueno en el público; en el Portal, solo con las condiciones de §3.6** | Bueno si se autoaloja; más trabajo de operación | Peor que Clarity por precio y límites | No resuelve el «porqué» | Útil solo para medir Core Web Vitals |

**Fuentes de la tabla:**

- Clarity: §1 y §3.
- Plausible: [data policy](https://plausible.io/data-policy).
- Cloudflare: [Web Analytics](https://developers.cloudflare.com/web-analytics/about/).
- PostHog y Hotjar: los límites del plan gratis **no se pudieron leer en sus páginas oficiales** (cargan con JavaScript o redirigen a [contentsquare.com/pricing](https://contentsquare.com/pricing/)). Las cifras que circulan (PostHog con 1 M de eventos y unas 5.000 grabaciones al mes; Hotjar con cifras contradictorias) vienen de comparadores como [posthog.com/blog/posthog-vs-hotjar](https://posthog.com/blog/posthog-vs-hotjar). Hay que confirmarlas antes de decidir.

**Pros de Clarity frente a todo lo anterior:**

- es gratis sin tope;
- se instala en minutos;
- se integra con GA4;
- las señales de frustración son automáticas;
- los inputs van enmascarados siempre.

**Contras:**

- Microsoft como controlador de los datos, con uso para sus fines;
- sin borrado por persona;
- cookies de terceros de Microsoft;
- la exclusión de contenido financiero en los términos;
- grabaciones de solo 30 días;
- sin consentimiento, sesiones partidas por página.

---

## 5. Recomendación y fases

**Sí, con condiciones: primero el sitio público (fases 1 a 4) y después el Portal del Cliente (fase 5, decisión de Sam del 2026-11-18, con las condiciones de §3.6).**

> *Recomendación original (superada):* «solo en el sitio público. No en el Portal».

| Fase | Qué se hace | Quién | Necesita OK de Sam |
|---|---|---|---|
| **0. Decidir** | Leer este documento. Releer los términos vivos de Clarity, sobre todo la cláusula de contenido financiero y la de uso de datos. | Sam y abogado | **Sí:** decidir y **aceptar los términos**. |
| **1. Código, apagado** | SDD nueva: `components/Clarity.tsx` con la guarda de GA más `/registro`, `/entrar` y `/abrir`; `NEXT_PUBLIC_CLARITY_ID` (sin respaldo; vacío u `off` = apagado); CSP solo pública; Consent API v2 enlazada a `dtd_cookie_consent`; `data-clarity-mask` en resultados y ecos de datos; pruebas que comprueben que no hay peticiones a `*.clarity.ms` en rutas privadas ni tras pasar del público al Portal por navegación cliente. Se fusiona **apagado**. | Worker con PR | No para el código. La fusión sigue el flujo normal. |
| **2. Política** | Cambiar `/privacidad` y `/cookies` según §3.5, con el abogado. Se publica antes o junto con el encendido. | Worker con PR, más abogado | **Sí:** texto aprobado de la política. |
| **3. Cuenta y encendido** | Crear el proyecto en Clarity con una cuenta de la empresa (no personal). Enmascarado Balanced; «requiere consentimiento»; acceso al panel solo para el equipo de Venezuela. Poner el ID en el entorno de producción; `prueba` queda en `off`. Medir LCP, INP y CLS antes y después. | Sam crea la cuenta; un Worker configura el entorno | **Sí:** crear la cuenta, aceptar los términos y **encender en producción**. |
| **4. Revisión a 30 días** | Ver qué aprendimos (calculadora, home, `/estimacion`). Revisar algunas grabaciones al azar buscando datos personales visibles; si aparece uno, se enmascara o se apaga. Revisar el impacto en el INP. Decidir si sigue. | DG y marketing | Sí, si se propone ampliar el alcance. |
| **5. Portal** (decidido por Sam el 2026-11-18) | SDD propia, después de que el público funcione bien en la fase 4. Se aplican las condiciones de §3.6: política y aviso a clientes primero, segundo proyecto en Strict, rutas con código o con contenido financiero fuera, prueba e2e de no-fuga, sin `identify`. | Worker con PR, más abogado | **Sí:** texto de la política del Portal, aviso a clientes, aceptar los términos tras releer la cláusula financiera, y **encender en el Portal**. |

**Seguimiento:** la fase 1 es la [SDD-0684](../specs/0684-clarity-fase-1-apagado/spec.md) (código apagado). Aplica el modo de §3.4 tal cual (carga sin cookies; `consentv2` concedido solo con `dtd_cookie_consent=granted`).

**Lo que no se hizo en esta tarea:** crear la cuenta, aceptar los términos, agregar el script, tocar el CSP o la política, y medir el peso real del script o su efecto en el INP.

---

## Fuentes

- Microsoft Clarity:
  - [FAQ](https://learn.microsoft.com/en-us/clarity/faq)
  - [Datos que recoge](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data)
  - [Retención](https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention)
  - [Enmascarado](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking)
  - [Cookies](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-cookies)
  - [Consent API v2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
  - [CSP](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-csp)
  - [Texto de aviso sugerido](https://learn.microsoft.com/en-us/clarity/setup-and-installation/privacy-disclosure)
  - [Términos](https://clarity.microsoft.com/terms): la página carga con JavaScript; las citas salen de fragmentos indexados y hay que confirmarlas en la página viva.
- [Microsoft Privacy Statement](https://www.microsoft.com/privacy/privacystatement)
- Next.js: [Script](https://nextjs.org/docs/app/api-reference/components/script) · [Librerías de terceros](https://nextjs.org/docs/app/guides/third-party-libraries)
- Cloudflare: [Web Analytics](https://developers.cloudflare.com/web-analytics/about/)
- Plausible: [Data policy](https://plausible.io/data-policy)
- Marco venezolano: `.claude/skills/revisar-datos-ve/references/marco-legal-ve.md` (CRBV arts. 28 y 60; sentencia 332/2001 de la Sala Constitucional) y `marco-legal-cn-pipl.md`.
- Código: `components/Analytics.tsx`, `components/CookieConsentBanner.tsx`, `lib/cookie-consent.ts`, `next.config.ts`, `app/cookies/page.tsx`, `app/privacidad/page.tsx`.
