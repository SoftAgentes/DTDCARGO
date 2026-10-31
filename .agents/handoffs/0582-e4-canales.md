# SDD-0582 E4: pasos 4.4 Messenger, 4.6 Instagram y 4.7 TikTok (handoff del Worker)

Rama `codex/0582-e4-canales`, apilada sobre `codex/0582-e4-meta` (PR #333). Solo docs. No lleva
tokens, secretos, IDs ni datos personales. Etiquetas: **D** documentado por la fuente, **R**
comprobado aquí, **I** inferencia, **NV** no verificado.

**Encargo (Director, 2026-10-30).** Sam eligió los canales con un selector, ante la pregunta
«¿Qué otros canales, además de WhatsApp, conectamos a Chatwoot?». Respuesta literal: «Correo
(info@), Instagram, Messenger, TikTok». A esta tarea le tocan 4.4, 4.6 y 4.7. El correo es 4.8 y
los «canales» del portal son 10.5; no son de aquí.

**Límites.** Igual que en 4.9:
- Nada que escriba en Meta o en TikTok sin el OK nominal de Sam en esta sesión: agregar páginas
  o cuentas, suscribir apps, enviar a revisión, OAuth.
- Nada sobre la cuenta principal de WhatsApp.
- Pruebas solo en bandejas de prueba.

## Lo que pide Chatwoot 4.19.1 (R, leído en el contenedor del VPS)

Los tres canales están habilitados en la cuenta 1 (`channel_facebook`, `channel_instagram` y
`channel_tiktok` = true). Ninguno tiene credenciales: `FB_APP_ID`, `INSTAGRAM_APP_ID` y
`TIKTOK_APP_ID` están vacíos en `GlobalConfigService`. Se cargan en `/super_admin/app_config`
(detrás de Cloudflare Access) o como variables de entorno.

| Canal | Configuración de Chatwoot | Permisos que pide en el OAuth (código) | Webhook / callback |
|---|---|---|---|
| Messenger | `FB_APP_ID`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN` (`FACEBOOK_API_VERSION`) | `pages_manage_metadata`, `business_management`, `pages_messaging`, `pages_show_list`, `pages_read_engagement` (`facebookScopes.js`) | `POST/GET /bot` |
| Instagram (Instagram Business Login, el recomendado desde la v4.1) | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_VERIFY_TOKEN` (`INSTAGRAM_API_VERSION`, `ENABLE_INSTAGRAM_CHANNEL_HUMAN_AGENT`) | `instagram_business_basic`, `instagram_business_manage_messages` (`Instagram::IntegrationHelper::REQUIRED_SCOPES`) | `/webhooks/instagram`; redirect `/instagram/callback` |
| TikTok | `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` (`TIKTOK_API_VERSION` = v1.3) | `user.info.basic`, `user.info.username`, `user.info.stats`, `user.info.profile`, `user.account.type`, `user.insights`, `message.list.read`, `message.list.send`, `message.list.manage` (`Tiktok::AuthClient::REQUIRED_SCOPES`). Si falta uno, el callback falla con `ungranted_scopes` | `/webhooks/tiktok` (se registra con `Tiktok::AuthClient.update_webhook_callback`); redirect `/tiktok/callback` |

**Rutas desde fuera (R, 2026-10-30):**
- `/bot` con un token falso responde «Error; wrong verify token».
- `/webhooks/instagram` responde 401 con un token falso.
- `POST /webhooks/tiktok` sin firma responde 401.
- `/instagram/callback` y `/tiktok/callback` dan 500 sin parámetros, porque todavía no tienen
  configuración.

Las rutas llegan a Chatwoot y Traefik no hay que tocarlo.

**Datos públicos de DTD (R):**
- Instagram `@dtdcargo.ve` y TikTok `@dtdcargo.ve` (los dos en `lib/design-tokens.ts`).
- El sitio no enlaza ninguna página de Facebook: falta confirmarla en Business Suite (puerta P0).
- `https://dtdcargo.com/privacidad` y `/terminos` responden 200. Son las URL que piden la App
  Review de Meta y la app de TikTok.

## P0: página e Instagram del portafolio (R, Business Suite, 2026-10-30, solo lectura)

Sam inició sesión en Facebook en el navegador integrado y yo solo leí. Aquí no van nombres de
personas ni IDs.
- **Página de Facebook: una sola, «Importador de China»** (página principal de la empresa).
  - Es del portafolio «Importador de China».
  - Tiene 2 personas con acceso total, una de ellas Sam, y 1 con acceso parcial: el perfil de
    Instagram, con «Mensajes y llamadas».
  - Tiene 1 activo conectado: el Instagram `@importadechinaavzla`.
  - Seguidores en Facebook: 4.
- **Instagram: un solo perfil en el portafolio, `@importadechinaavzla`.**
  - Es propiedad de «Importador de China».
  - Sam tiene acceso parcial, que incluye Mensajes.
  - Business Suite pide «Es necesario que inicies sesión» en Instagram para ver las demás
    configuraciones.
  - Seguidores: 16.
- **`@dtdcargo.ve`, el Instagram que enlaza dtdcargo.com, no está en el portafolio.** No se
  puede saber desde aquí si es cuenta profesional ni quién la administra (NV). El portafolio
  tampoco tiene ninguna página de Facebook «DTD Cargo».

**Decisión P0-b, tomada por Sam el 2026-10-30.** La tomó en la sesión del Director, con un
selector, y el Director me la pasó con la cita literal. A la pregunta «¿Qué cuentas de Instagram
y Facebook conectamos a Chatwoot?», Sam respondió **«Las dos marcas»**. Es una decisión de
alcance, no un OK de escritura: cada paso que escriba en Meta o en Chatwoot sigue pidiendo el OK
de Sam en esta sesión.
- **Importador de China:** la página «Importador de China» y `@importadechinaavzla`. Ya están
  en el portafolio, así que esta marca se puede preparar ya, desde P2.
- **DTD Cargo:** `@dtdcargo.ve` y una página de Facebook «DTD Cargo». Antes hacen falta los tres
  pasos previos de Sam que están abajo. Yo no escribo en Meta.

**Dato nuevo de Sam en esta sesión (2026-10-30):** «El Instagram está conectado a otro Facebook.
Me avisas y yo te paso la conexión.» Entonces `@dtdcargo.ve` ya está vinculado a un Facebook que
no es el de este portafolio. Todavía no sé si es una página o un perfil personal (NV). Lo leo
cuando Sam entre con esa cuenta en el navegador integrado. De eso depende el paso 3: traer la
página que ya existe o crear una nueva.

### Lectura del otro Facebook (R, Business Suite, 2026-10-31, solo lectura)

Sam inició sesión con la otra cuenta de Meta en su Chrome y yo solo leí. Aquí no van nombres de
personas, correos, teléfonos ni IDs.
- **Existe un segundo portafolio, «DTD Cargo»,** distinto de «Importador de China».
- **Página de Facebook «DTD Cargo»:**
  - Es propiedad del portafolio «DTD Cargo».
  - Esa cuenta tiene acceso total.
  - El Instagram tiene acceso parcial, que incluye «Mensajes y llamadas».
- **Instagram `@dtdcargo.ve`:**
  - Es propiedad del portafolio «DTD Cargo».
  - Tiene un activo conectado: la página «DTD Cargo».
  - Esa cuenta tiene acceso parcial, que incluye Mensajes.
- Que `@dtdcargo.ve` sea cuenta profesional se deduce de que es un perfil de Instagram de un
  portafolio con una página conectada (I).
- **Mensajes de Instagram (R, 2026-10-31):** la bandeja de Business Suite de la página «DTD
  Cargo» carga las conversaciones de Instagram Direct sin ningún aviso de permiso. No leí las
  conversaciones. De ahí se deduce que «Permitir acceso a los mensajes» está activado, porque
  la bandeja de Meta lo necesita igual que la API (I). La prueba definitiva es que el webhook
  de Instagram reciba el primer mensaje en P5.
- Instagram en el navegador pide un captcha al iniciar sesión. No lo resuelvo; Sam lo resuelve
  o lo revisa en el teléfono.
- La cuenta de Meta de Sam con la que se hizo P0 no tiene vinculado `@dtdcargo.ve` ni administra
  la página «DTD Cargo» (R).

**Qué cambia en la guía:**
- El paso 3 ya está hecho: la página existe y está vinculada.
- El paso 1 también parece hecho (I): la bandeja de Business Suite ya recibe los mensajes de
  Instagram.
- El paso 2, pasar `@dtdcargo.ve` al portafolio «Importador de China», **ya no es necesario**.

La app «Whats DTD» puede pedir acceso a la página y al Instagram de otro portafolio por OAuth (D).
La condición es que quien inicie sesión en Chatwoot tenga control de esos activos. En Standard
Access, además, esa persona necesita un rol en la app. Las dos rutas:
- **(A) Recomendada:** dejar la marca DTD Cargo en su portafolio.
  - La cuenta que administra «DTD Cargo» recibe un rol en la app Whats DTD: tester o
    desarrollador. Es una escritura en Meta que hace Sam con OK.
  - En P4, esa misma cuenta hace el OAuth de Messenger.
  - Para Instagram, el OAuth lo hace `@dtdcargo.ve` con su propio usuario.
  - No se mueve ningún activo.
- **(B):** compartir o mover la página y el Instagram al portafolio «Importador de China».
  - Es más cambio y mezcla dos marcas en un portafolio.
  - Solo conviene si Sam quiere administrar todo desde uno.

**Decisión de Sam, en esta sesión, el 2026-10-31.** A la pregunta «¿Por qué ruta conectamos DTD
Cargo?», respondió **«el rol en la app.»** La ruta elegida es la A. La decisión no autoriza
escribir en Meta: cada escritura lleva su OK nominal en esta sesión.

Escrituras que pide la ruta A, en orden:
1. **Rol de Facebook.** En la app Whats DTD, *Roles de la app* → *Agregar personas* → **Tester**,
   con el Facebook que administra «DTD Cargo». Tester es el rol mínimo que alcanza para el OAuth
   en Standard Access (D). Ese Facebook acepta la invitación en
   `developers.facebook.com/requests`, y quizá Meta le pida registrarse como desarrollador (D).
2. **Rol de Instagram.** Va después de P2, cuando la app ya tiene el producto de Instagram.
   - En *Roles de la app* → *Testers de Instagram* se agrega `@dtdcargo.ve`.
   - La cuenta acepta en Instagram: *Configuración* → *Apps y sitios web* → *Invitaciones de
     tester*.
   - Instagram Business Login lo exige mientras la app esté en modo de desarrollo o en
     Standard Access (D).

### Guía para Sam: tres pasos previos para la marca DTD Cargo (escrita antes de la lectura de arriba; vale la nota «Qué cambia»)

Estos tres pasos los hace Sam con sus cuentas. Yo solo leo después que quedaron bien. Los
nombres de los menús son de la interfaz en español de octubre de 2026 y pueden variar un poco (D).

1. **Que `@dtdcargo.ve` sea cuenta profesional y deje entrar a las apps a los mensajes.**
   - En la app de Instagram, con la sesión de `@dtdcargo.ve`, ve a Perfil → menú ☰ →
     *Configuración y actividad* → *Tipo de cuenta y herramientas*.
   - Si aparece *Cambiar a cuenta profesional*, tócalo y elige **Empresa**.
   - Si aparece *Cambiar a cuenta personal*, no lo toques: la cuenta ya es profesional.
   - Luego ve a *Configuración y actividad* → *Mensajes y respuestas a historias* →
     *Controles de mensajes* (o *Herramientas conectadas*). Activa **«Permitir acceso a los
     mensajes»**. Sin esto, la API de Instagram no entrega los mensajes a Chatwoot (D).
2. **Agregar `@dtdcargo.ve` al portafolio «Importador de China».**
   - En `business.facebook.com` → *Configuración* → *Cuentas* → *Perfiles de Instagram* →
     *Agregar*.
   - Inicia sesión con `@dtdcargo.ve` cuando lo pida.
   - Al terminar, `@dtdcargo.ve` aparece en la lista junto a `@importadechinaavzla`.
3. **Página «DTD Cargo» vinculada a `@dtdcargo.ve`.** Cuál camino toca lo decide la lectura del
   otro Facebook:
   - **3a. Si el otro Facebook ya tiene una página de DTD:**
     - Desde ese Facebook, dale a tu Facebook personal **control total** de la página: en la
       página, *Configuración* → *Acceso a la página* → *Agregar persona nueva*.
     - Después, en el portafolio: *Cuentas* → *Páginas* → *Agregar* → **Reclamar una página**.
   - **3b. Si es un perfil personal y no una página:**
     - En el portafolio: *Cuentas* → *Páginas* → *Agregar* → **Crear una página nueva** con el
       nombre «DTD Cargo».
     - En la página nueva: *Configuración* → *Cuentas vinculadas* → *Instagram* → *Conectar
       cuenta*, con `@dtdcargo.ve`.
     - Si Instagram dice que la cuenta ya está vinculada a otra página, primero hay que
       desvincularla desde el otro Facebook.

Cuando estén los tres, leo el portafolio y anoto en esta sección lo que quedó.

## 4.4 Messenger: acceso, permisos y demostración

**Acceso de Meta (D, documentación de Meta y de Chatwoot):**
- **Standard Access** es el nivel inicial. El canal funciona, pero solo con conversaciones de
  personas que tienen rol en la app, la página o el negocio.
- Con conversaciones de cualquier persona, Meta no entrega los mensajes nuevos hasta tener
  **Advanced Access**. Chatwoot lo dice así: «Until the application is approved for production,
  Facebook wouldn't send the new messages».
- **Advanced Access** exige App Review y la verificación del negocio. El portafolio ya está
  verificado: la lectura de 4.9 dio `business_verification_status=verified` (R).

**Permisos que van a revisión** (Chatwoot, «Going into production»):
- `pages_messaging`
- `pages_show_list`
- `pages_manage_metadata`
- `business_management`
- `pages_read_engagement`
- la función «Business Asset User Profile Access», para mostrar el nombre y la foto de quien
  escribe.

**Decisión propuesta: usar la app «Whats DTD».** Ya está publicada, es del tipo empresa y su
negocio está verificado. Una sola app concentra la revisión. Chatwoot usa `FB_APP_ID` solo para
Messenger y para Instagram por Facebook Login, y la bandeja manual de WhatsApp no lo lee (I, del
código de 4.9). Así, cargarlo no toca las bandejas de WhatsApp.

**Demostración (piloto), sin App Review:**
1. Sam pasa la puerta P2 (Messenger en la app) y la P3 (configuración en Chatwoot).
2. Sam crea en Chatwoot la bandeja de Facebook con OAuth y elige la página de DTD (P4).
3. En «Messenger → Configuración» de la app suscribe la página a `messages`,
   `messaging_postbacks`, `message_deliveries`, `message_reads` y `message_echoes`.
4. Desde su cuenta personal, que tiene rol en la app, Sam escribe a la página. El mensaje tiene
   que entrar a la bandeja y la respuesta desde Chatwoot tiene que llegarle.
5. Yo leo solo conteos y estados, como en 4.3.

## 4.6 Instagram: demostración y expediente (sin enviarlo)

**Ruta:** Instagram Business Login. Requisitos:
- **Producto «Instagram API with Instagram Login»** en la app, con su app ID y secreto propios de
  Instagram.
- **Webhooks:** `messages`, `messaging_seen` y `message_reactions`, apuntando a
  `/webhooks/instagram`.
- **Redirect:** `/instagram/callback`.
- **`@dtdcargo.ve` como cuenta profesional** (empresa o creador, NV), con «Permitir acceso a los
  mensajes» activado en la app de Instagram (Configuración → Mensajes → Herramientas
  conectadas, NV en la cuenta).

**Acceso:**
- En Standard Access solo funciona con cuentas que tienen el rol «Instagram Tester» en la app.
  La demostración se hace así: Sam agrega su cuenta personal como tester y escribe a
  `@dtdcargo.ve`.
- Para atender a cualquiera hace falta Advanced Access de `instagram_business_basic` y
  `instagram_business_manage_messages` (App Review + negocio verificado, D).
- La función «Human Agent», que alarga la ventana a 7 días, es opcional y también va a
  revisión. Se deja para después.

**Expediente para App Review (borrador; Sam lo envía con su OK, nunca esta tarea):**
- **Datos de la app:**
  - nombre «Whats DTD»;
  - política de privacidad `https://dtdcargo.com/privacidad`;
  - términos `https://dtdcargo.com/terminos`;
  - categoría «Negocios y páginas»;
  - ícono de DTD Cargo.
- **Texto de uso común (ES/EN):** «DTD Cargo es una empresa de envíos China → Venezuela. Usamos
  Chatwoot autohospedado en chat.dtdcargo.com como bandeja de atención: los agentes de DTD leen y
  responden los mensajes que los clientes mandan a nuestra cuenta de Instagram y a nuestra página
  de Facebook. No hacemos envíos masivos ni mensajes promocionales por estas vías; solo
  respondemos a quien nos escribe, dentro de la ventana que permite Meta.»
- **Por permiso:**
  - `instagram_business_basic`: para identificar la cuenta conectada (nombre de usuario, foto) y
    mostrarla en la bandeja.
  - `instagram_business_manage_messages`: para recibir los DM de los clientes en Chatwoot y
    responderlos desde ahí.
  - `pages_messaging`: para responder desde Chatwoot a quien escribe a la página.
  - `pages_show_list`: para elegir la página al conectar la bandeja.
  - `pages_manage_metadata`: para suscribir la página al webhook de Chatwoot.
  - `pages_read_engagement` y Business Asset User Profile Access: para mostrar el nombre del
    remitente.
  - `business_management`: es dependencia de `pages_messaging` en Meta.
- **Video (uno por plataforma, 1–2 min, en inglés o subtitulado):**
  1. login en chat.dtdcargo.com;
  2. «Agregar bandeja» y el OAuth con los permisos visibles;
  3. un tester escribe un DM;
  4. el mensaje aparece en Chatwoot;
  5. el agente responde;
  6. la respuesta llega al teléfono.
- **Capturas:**
  - la pantalla de permisos del OAuth;
  - la bandeja con la conversación, con los datos de prueba tapados;
  - la configuración del webhook.
- **Tratamiento de datos (cuestionario de Meta):**
  - Los mensajes se guardan en el servidor de DTD, en el VPS propio con respaldo cifrado (E1).
  - No se venden ni se comparten con terceros.
  - El acceso es por agente con su usuario.
  - El borrado sigue la política de `/privacidad`.
- Antes de enviarlo, revisar con `revisar-datos-ve` que lo que se declara coincida con la
  política publicada (I).

**Orden recomendado:** Messenger primero, porque es el piloto (4.4). Instagram reutiliza la misma
app, el mismo expediente y el mismo video base. Se envía un solo paquete a revisión con los
permisos de las dos plataformas, si Sam lo autoriza.

## 4.7 TikTok: elegibilidad

**Hallazgo (D, documentación de TikTok y de Chatwoot, 2026-10-30):**
- La Business Messaging API está en **Open Beta en APAC, LATAM, METAP y Norteamérica**. Venezuela
  es LATAM (I). Las únicas exclusiones explícitas son el EEE, Suiza y el Reino Unido.
- **No es elegible para descartar.** El paso queda en espera de TikTok, no «descartado».

**Requisitos (D):**
- Una **TikTok Business Account** (no personal) registrada en una región elegible, con Advanced
  Access o como Verified Business Account. Que `@dtdcargo.ve` sea Business Account es NV.
- La cuenta tiene que aceptar mensajes directos de todos. Si no, hay que aceptar cada mensaje a
  mano en la app.
- **Cuenta de desarrollador** en developers.tiktok.com y **app** en
  business-api.tiktok.com/portal/apps, con URL de términos y de privacidad (ya las tenemos).
- **Solicitud de acceso a la Business Messaging API** con el caso de uso y el manejo de datos.
  TikTok la aprueba después de su revisión de seguridad y privacidad de datos; Chatwoot calcula
  «unos días».
- Después: el permiso «TikTok Accounts», la redirect `https://chat.dtdcargo.com/tiktok/callback`,
  `TIKTOK_APP_ID` y `TIKTOK_APP_SECRET` en Chatwoot y `Tiktok::AuthClient.update_webhook_callback`.

**Límites del canal (D, de terceros):**
- Ventana de 48 h para responder.
- No hay mensajes iniciados por la empresa.
- Que el beta tenga funciones distintas por región es NV.

**Salida, si TikTok rechaza o no aprueba en un plazo razonable:** el paso pasa a «descartado con
evidencia», con la respuesta de TikTok. El costo es cero, porque Chatwoot ya trae el canal.

## Puertas (cada escritura en Meta, TikTok o Chatwoot lleva el OK nominal de Sam en esta sesión)

| Puerta | Quién | Qué | ¿Escribe? |
|---|---|---|---|
| P0 | Sam (yo leo) | **Hecha** el 2026-10-30: ver la sección «P0». Decisión P0-b: «Las dos marcas» (Sam, 2026-10-30) | No |
| P0-c | Sam | Marca DTD Cargo. Lectura **hecha** el 2026-10-31: portafolio propio «DTD Cargo», con la página «DTD Cargo» conectada a `@dtdcargo.ve`. Los mensajes de Instagram ya entran a la bandeja de Business Suite (I: el permiso de mensajes está activo). Ruta elegida por Sam (2026-10-31): «el rol en la app.», es decir la A. Faltan las dos invitaciones de tester, Facebook e Instagram, cada una con su OK | Meta (lo hace Sam) |
| P1 | Sam | En TikTok: si `@dtdcargo.ve` es Business Account y si acepta DM de todos | No |
| P2 | Sam, con OK | En la app Whats DTD: agregar los productos **Messenger** e **Instagram API with Instagram Login**; dominio `chat.dtdcargo.com`; Facebook Login for Business con `https://chat.dtdcargo.com` | Meta |
| P3 | Sam, con OK | Cargar en Chatwoot `FB_APP_ID`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN` y los tres de Instagram. Hay dos formas: Sam los pega en `/super_admin/app_config` (detrás de Access), o un guion `read -rs` que los guarda con `rails runner` sin mostrarlos. Los verify tokens los genera el guion | Chatwoot |
| P4 | Sam, con OK | Webhooks de la app: Messenger → `/bot` con `FB_VERIFY_TOKEN`; Instagram → `/webhooks/instagram` con `INSTAGRAM_VERIFY_TOKEN`. Crear las bandejas por OAuth (Sam inicia sesión y elige la página o la cuenta) y suscribir la página a los cinco campos | Meta y Chatwoot |
| P5 | Sam | Demostración: escribir a la página y a `@dtdcargo.ve` desde cuentas con rol en la app. Yo leo conteos y estados | No (prueba) |
| P6 | Sam, con OK | **Enviar** el paquete de App Review con el expediente de arriba | Meta |
| P7 | Sam, con OK | TikTok: cuenta de desarrollador, app y solicitud de acceso a la Business Messaging API | TikTok |

## FUERA DE ALCANCE DETECTADO

- **Allowlist.** La de SDD-0582 no nombra los handoffs de E4 (`0582-e4-meta.md`,
  `0582-e4-canales.md`) ni un archivo de investigación propio. Por eso la investigación de esta
  tarea vive aquí. El Director decide si se agrega a la allowlist.
- **«Canales» del portal del cliente como tickets** (nota de Sam): es 10.5 de E10.
- **Correo `info@`**: es 4.8.
- **Instagram y la privacidad.** Al conectar Instagram y Facebook entran nombres y fotos de
  personas a Chatwoot. La política `/privacidad` debería nombrar esos canales antes de pasar a
  producción. Pasa por `revisar-datos-ve` (I).
