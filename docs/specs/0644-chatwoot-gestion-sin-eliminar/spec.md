---
sdd: "0644"
title: "Chatwoot: nivel «gestión» (ve y edita todo, no elimina) y enmienda a la matriz 2.7"
status: proposed
author: "Claude (Worker 0644, carril del Subdirector de Chatwoot)"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0582", "0585", "0586", "0588", "0622", "0635", "0636"]
confidencialidad: interno
---

# SDD-0644 — Chatwoot: nivel «gestión» (ve y edita todo, no elimina)

> Decisión de Sam del 2026-11-16: en Chatwoot él es el único administrador completo. Su equipo
> (hoy dos personas) tiene que poder **ver y editar todo**, con una sola restricción: **no eliminar**.
> Chatwoot Community Edition no trae ese nivel. Esta spec dice cómo se consigue, cómo se prueba y
> cómo cambia la matriz de permisos del paso 2.7 (SDD-0585).

**Estado:** `proposed`. Es solo diseño: no hay código de producto, ni cambios en el VPS, ni
migraciones. La implementación empieza cuando Sam conteste las preguntas de §9.

## 1. Cómo leer la evidencia

Cada afirmación lleva una etiqueta:

| Etiqueta | Qué significa |
|---|---|
| **[CÓDIGO]** | Leído en el código de `chatwoot/chatwoot`, etiqueta `v4.19.1`, el 2026-11-16 |
| **[REPO]** | Leído en este repositorio (`origin/main` en `b9b29db96`) |
| **[MEDIDO]** | Medido antes por el Subdirector o en un runbook; se cita la fuente |
| **[INFERENCIA]** | Deducción mía; se comprueba en la implementación antes de apoyarse en ella |

No leí datos de producción ni entré al VPS para escribir esta spec.

## 2. Punto de partida

- Chatwoot es Community Edition 4.19.1 en `chat.dtdcargo.com` **[MEDIDO: Subdirector]**.
- CE tiene dos roles de cuenta: `administrator` y `agent`. Los roles a medida (`custom_roles`)
  viven en la carpeta `enterprise/`, que es otra licencia y no está en la imagen `-ce` **[CÓDIGO:
  `enterprise/app/models/custom_role.rb`]** **[REPO: `infra/chatwoot/rails/zz_dtd_revocar_sesiones.rb`,
  «No toca enterprise/»]**.
- La matriz vigente hace `administrator` solo al rol `admin` de Studio; el resto es `agent`. El
  cron diario `chatwoot-agentes` corrige lo que se cambie a mano en los agentes vinculados
  **[REPO: `lib/studio/chatwoot/matriz.ts`, `docs/runbooks/chatwoot-agentes.md`]**.
- Hoy hay dos agentes puestos a mano como Administrador y sin vínculo en Studio, a propósito,
  para que el cron no los baje. En Studio uno tiene el rol Administrador y el otro Contabilidad
  **[MEDIDO: Subdirector]**. No se vincula a nadie hasta decidir esta SDD.
- Ya extendemos Chatwoot con inicializadores propios montados en solo lectura, cada uno con su
  prueba local y su control **[REPO: `infra/chatwoot/rails/`, `infra/chatwoot/pruebas/`]**.

## 3. Qué puede eliminar y editar cada rol en CE 4.19.1

Fuente: `app/policies/*.rb` y los controladores de `app/controllers/api/v1/accounts/`
**[CÓDIGO]**. «Sin policy» quiere decir que el controlador no pregunta por el rol: lo puede
hacer cualquier miembro de la cuenta que llegue al registro.

### 3.1 Eliminar

| Qué | `administrator` | `agent` | Dónde se decide |
|---|---|---|---|
| Conversación | Sí | No | `ConversationPolicy#destroy?` |
| Contacto, uno o en lote | Sí | No | `ContactPolicy#destroy?`; el lote entra por `POST bulk_actions` con `action_name: delete` |
| Empresa | Sí | No | `CompanyPolicy#destroy?` |
| Mensaje | Sí | **Sí**, en las conversaciones que ve | `messages#destroy`, sin policy |
| Nota de un contacto | Sí | **Sí** | `contacts/notes#destroy`, sin policy |
| Respuesta rápida | Sí | **Sí** | `canned_responses#destroy`, sin policy |
| Macro | Las globales y las suyas | Solo las suyas | `MacroPolicy#destroy?` |
| Vista guardada (filtro) | Sí | Sí | `CustomFilterPolicy#destroy?` |
| Bandeja | Sí | No | `InboxPolicy#destroy?` |
| Agente (sacarlo de la cuenta) | Sí | No | `UserPolicy#destroy?` |
| Equipo y sus miembros | Sí | No | `TeamPolicy`, `TeamMemberPolicy` |
| Etiqueta | Sí | No | `LabelPolicy#destroy?` |
| Automatización | Sí | No | `AutomationRulePolicy#destroy?` |
| Atributo a medida | Sí | No | `CustomAttributeDefinitionPolicy#destroy?` |
| Campaña, webhook, integración, bot, aplicación del panel | Sí | No | `CampaignPolicy`, `WebhookPolicy`, `HookPolicy`, `AgentBotPolicy`, `DashboardAppPolicy` |
| Centro de ayuda (portal, categoría, artículo) | Sí | No | `PortalPolicy`, `CategoryPolicy`, `ArticlePolicy` |

Dos cosas que importan para el diseño:

1. **No todo lo que elimina es un `DELETE`.** El borrado de contactos en lote es un `POST`
   (`bulk_actions`), y la fusión de contactos (`POST actions/contact_merge`, sin policy) hace
   desaparecer la ficha fusionada **[CÓDIGO]**.
2. **Un `agent` también elimina:** mensajes, notas y respuestas rápidas **[CÓDIGO]**.

### 3.2 Editar

| Qué | `administrator` | `agent` |
|---|---|---|
| Conversaciones de sus bandejas y equipos: contestar, asignar, etiquetar, estado, prioridad | Sí (ve todas) | Sí (solo las de sus bandejas o equipos, `ConversationPolicy#show?`) |
| Contactos, empresas y notas: crear y editar | Sí | Sí |
| Respuestas rápidas: crear y editar | Sí | Sí |
| Macros | Todas | Las suyas |
| Ajustes de la cuenta | Sí | No |
| Agentes: invitar, cambiar nombre y **rol** | Sí | No |
| Bandejas: configuración, miembros, plantillas, bot | Sí | No |
| Equipos y sus miembros | Sí | No |
| Etiquetas y atributos a medida: crear y editar | Sí | No (solo usarlos) |
| Automatizaciones, campañas, webhooks, integraciones, bots | Sí | No |
| Informes y CSAT | Sí | No |
| Importar y exportar contactos | Sí | No |

Un `administrator` puede cambiarle el rol a cualquier otro agente, también a otro administrador
(`agents#update`, `UserPolicy#update?`) **[CÓDIGO]**. Por eso el diseño tiene que proteger al
administrador completo, no solo cerrar los borrados.

## 4. Opciones

### Opción A · `agent` con todas las bandejas y todos los equipos

Sin tocar Chatwoot: la matriz les da todas las bandejas y equipos.

- **Deja de poder editar:** todo lo que en §3.2 dice «No» para `agent` (ajustes, agentes,
  bandejas, equipos, etiquetas, atributos, automatizaciones, campañas, integraciones, informes).
- **Sigue pudiendo eliminar:** mensajes, notas de contacto y respuestas rápidas.
- **Costo:** casi cero. **Riesgo:** no cumple ninguna de las dos mitades del pedido.
- **Veredicto:** descartada.

### Opción B · `administrator` y un inicializador propio que reserva el borrado (recomendada)

El equipo es `administrator`, así que ve y edita todo. Un inicializador nuevo en
`infra/chatwoot/rails/` rechaza los borrados de cualquiera que no esté en una lista corta de
ids, que vive en el `.env` del VPS. El detalle está en §5.

- **Costo:** un inicializador (del tamaño de `zz_dtd_revocar_sesiones.rb`), su prueba local con
  control, una variable en el VPS y recrear `rails` y `sidekiq` una vez (80 s de corte medidos la última
  vez **[MEDIDO: runbook de agentes, puerta 5]**). Se suma a la prueba de versiones de E3.
- **Riesgos:**
  - una versión nueva de Chatwoot puede agregar una forma de eliminar que no sea `DELETE`. Se
    cubre con «todo `DELETE` se niega salvo excepción» y con la prueba de E3 antes de subir de
    versión;
  - el panel sigue mostrando los botones de eliminar al equipo; al usarlos verán un error. Es
    incómodo, no peligroso;
  - si la variable falta o está mal escrita, nadie elimina, tampoco Sam, hasta corregirla. Es
    a propósito (falla cerrado) y Studio avisa.
- **Veredicto:** es la única que cumple las dos mitades con lo que ya sabemos operar.

### Opción C · `administrator` y los `DELETE` bloqueados en el proxy (Traefik)

Una regla de Traefik que responde 403 a los `DELETE` de `chat.dtdcargo.com`, como la que ya
apaga «olvidé mi clave» **[REPO: runbook de agentes, puerta 5]**.

- **Costo:** bajo; etiquetas en el compose.
- **Riesgos:**
  - el proxy no sabe quién pide. Para dejar pasar a Sam habría que confiar en una cabecera, y
    las llamadas con token de API no la traen **[INFERENCIA]**;
  - no ve el cuerpo del pedido: el borrado de contactos en lote y la fusión son `POST` y pasan;
  - tampoco protege el rol del administrador completo (§3.2).
- **Veredicto:** descartada como solución. No hace falta ni como segunda red.

### Opción D · Roles a medida de Chatwoot Enterprise

Existen, pero son de la edición de pago y de otra licencia **[CÓDIGO]**. Descartada: cambia el
costo y la licencia de la instalación por un solo permiso.

### Resumen

| | Edita todo | No elimina | Sam sí elimina | Costo |
|---|---|---|---|---|
| A · `agent` ampliado | No | No del todo | Sí | Mínimo |
| **B · inicializador** | **Sí** | **Sí** | **Sí** | **Bajo** |
| C · proxy | Sí | A medias | Dudoso | Bajo |
| D · Enterprise | Sí | Sí | Sí | Licencia de pago |

## 5. Diseño de la opción B

### 5.1 El inicializador `zz_dtd_reservar_eliminar.rb`

Se monta en solo lectura, como los otros. Solo código propio; no toca `enterprise/`.

**La lista.** `DTD_CHATWOOT_ELIMINA_IDS`: ids de usuario de Chatwoot separados por coma, en el
`.env` del VPS. Va por id y no por correo: el correo se puede editar desde el panel, el id no.
Ningún administrador del panel puede cambiar una variable del servidor.

- **Lectura estricta, al arrancar.** Cada elemento tiene que cumplir `\A[1-9]\d{0,9}\z`, sin
  `to_i` (que convertiría `12abc` en 12) y conservando los vacíos (`split(',', -1)`), como hace
  `zz_dtd_proteccion_register.rb` **[REPO]**. Un solo elemento mal formado invalida la lista
  entera. Se lee una vez, al arrancar: cambiarla pide recrear el servicio (§5.5).
- **Solo un `User` puede estar «en la lista».** Se compara la clase además del id: un
  `AgentBot` o cualquier otro actor cuenta como fuera, aunque su id coincida con uno de la
  lista **[CÓDIGO: `ConversationPolicy#agent_bot?`; los bots entran a la misma API con su token]**.

**La regla,** para los pedidos de la API de cuenta (`/api/v1/accounts/…` y `/api/v2/accounts/…`,
que heredan de `Api::V1::Accounts::BaseController` **[CÓDIGO]**), entren con sesión del panel o
con token de API:

1. Si quien pide está en la lista, pasa todo, como hoy.
2. Si no está, se responde **403** a:
   - todo `DELETE`, salvo las excepciones de abajo;
   - el borrado de contactos en lote (`POST bulk_actions` de contactos con `action_name: delete`);
   - la fusión de contactos, si Sam lo decide así (pregunta 3);
   - cambiar el rol o sacar de la cuenta a alguien de la lista (candado del administrador
     completo, §6.3).
3. **Excepciones** (cosas personales o reversibles, que no pierden datos del negocio). Las
   candidatas son: el borrador propio de un mensaje, los avisos propios, las vistas guardadas
   propias, quitar un participante de una conversación y quitar miembros de una bandeja o
   equipo (Studio manda y el cron lo repone). Ninguna entra por estar en esta lista: entra
   cuando el inventario de rutas de §5.4 la clasifica con su razón.
4. Vale para todos, no solo para el equipo: con esto un `agent` tampoco elimina mensajes,
   notas ni respuestas rápidas (pregunta 2).

**Falla cerrado, también para el candado.** Con la variable vacía, ausente o mal formada:

- nadie pasa por el punto 1: se cierran los borrados para todos, también para Sam;
- como ya no se sabe quién es el administrador completo, se niega **a todos** cualquier cambio
  de rol y cualquier salida de la cuenta de un `administrator`. Sin esto, con la lista
  inválida un administrador podría bajarle el rol a Sam o sacarlo, y el candado no lo vería;
- el arranque lo escribe en el log y Studio lo avisa (§6.4).

Los cambios de rol legítimos de ese rato siguen entrando por Studio, que usa la Platform API.

**Si Chatwoot cambia.** Si falta el controlador base donde se engancha, el arranque se cae con
un mensaje claro, igual que hace hoy la revocación de sesiones con `RoomChannel`. No queda
instalado «en silencio» sin proteger.

**Logs:** id de Chatwoot del usuario, verbo y nombre del controlador, tanto de lo que se niega
como de lo que elimina alguien de la lista. Nunca correos, tokens ni contenido.

**Ruta de lectura para Studio.** `GET /platform/api/v1/dtd_permisos`, con el token de la
Platform App: devuelve los ids de la lista y si la protección está activa. No cambia nada.
Sirve para que la salud compare (§6.4).

### 5.2 Lo que queda fuera de este candado

- La consola `super_admin`, la consola de Rails y la base: son acceso de servidor, detrás de
  Cloudflare Access, y hoy son de Sam. Antes de instalar se comprueba que nadie del equipo
  tenga usuario de `super_admin`.
- La Platform API: solo la usa Studio.
- **Editar también puede destruir (riesgo aceptado).** Quien edita puede vaciar el nombre o el
  teléfono de un contacto, reescribir una respuesta rápida, apagar una automatización o
  cambiar la configuración de una bandeja. No es un borrado y este candado no lo impide: es lo
  que «editar todo» significa. Lo que se pierde así no tiene papelera en Chatwoot; la red es
  el respaldo diario **[REPO: `infra/chatwoot/respaldo.sh`]**.
- **Un administrador invitado a mano no queda corregido.** El nivel gestión puede invitar a un
  agente desde el panel y ponerlo como `administrator`. Mientras no tenga vínculo, el cron no
  le toca el rol **[REPO: `matriz.ts`, «No se los saca de la cuenta»]**: queda con nivel
  gestión de hecho, sin haber pasado por Studio. No elimina (no está en la lista), pero edita
  todo. La salud ya cuenta a los miembros sin vínculo; la implementación le da nombre propio a
  este caso: «hay un administrador sin vínculo» (§6.4).
- **Salida de datos: exportar contactos, webhooks e integraciones.** Un `administrator` puede
  exportar los contactos y crear webhooks e integraciones que mandan conversaciones a un
  tercero **[CÓDIGO: `ContactPolicy#export?`, `WebhookPolicy`, `HookPolicy`]**. No son
  borrados, pero sí datos personales que salen del sistema. Clasificación propuesta, que la
  implementación confirma con `.claude/skills/revisar-datos-ve/SKILL.md` y las políticas del
  AGENT-BRIEF para borrado y auditoría (AUD-01, AUD-02):

  | Acción en Chatwoot | Qué es | Clasificación propuesta |
  |---|---|---|
  | Eliminar (lo que cierra esta SDD) | Borrado de datos personales | **Excepción** a AUD-01: Chatwoot no escribe en la auditoría de Studio. El rastro es el log del inicializador (quién, verbo, controlador) |
  | Exportar contactos | Exportación de datos personales (AUD-02; inventario de `revisar-datos-ve`: exports) | **No conformidad** si queda abierto al nivel gestión sin registro. Se resuelve con la pregunta 6 |
  | Crear o editar webhooks e integraciones | Envío a terceros (inventario de `revisar-datos-ve`: payloads a terceros; evaluación de proveedores) | **No conformidad** si queda abierto sin evaluación del tercero. Se resuelve con la pregunta 6 |
  | Editar contactos y conversaciones | Tratamiento ordinario | **No aplica** |

### 5.3 Cómo se prueba

**En local,** `infra/chatwoot/pruebas/prueba-reservar-eliminar.sh`, contra la imagen real 4.19.1,
con tres usuarios: uno en la lista, un `administrator` fuera de la lista y un `agent`.

| Caso | Resultado esperado |
|---|---|
| Administrador fuera de la lista elimina conversación, contacto, mensaje, nota, respuesta rápida, etiqueta, automatización, equipo, bandeja y agente | 403 en cada uno, y el registro sigue (se cuenta antes y después) |
| El mismo, borrado de contactos en lote | 403 y los contactos siguen |
| El mismo, **edita** contacto, etiqueta, bandeja, automatización, equipo y ajustes de la cuenta | 2xx y el cambio queda: prueba que sigue editando todo |
| El mismo, con token de API en vez de sesión | Igual que con sesión |
| El mismo intenta bajar de rol o sacar al de la lista | 403 |
| `agent` elimina un mensaje, una nota, una respuesta rápida | 403 |
| Cualquiera borra su borrador, sus avisos, su vista guardada | 2xx |
| Usuario de la lista elimina lo mismo que el primer caso | 2xx y el registro desaparece: prueba que Sam sigue pudiendo |
| Sin la variable, o con un elemento mal formado (`12abc`, una coma de más) | 403 también para el de la lista, y el aviso en el log de arranque |
| Sin la variable, el administrador fuera de la lista intenta bajar de rol o sacar al completo | 403: con la lista inválida no se cambia el rol ni se saca a ningún `administrator` |
| Un `AgentBot` cuyo id coincide con uno de la lista intenta eliminar | 403: solo un `User` cuenta como «en la lista» |
| El inicializador cargado en `sidekiq` | Arranca sin error |
| **Control:** sin el inicializador | El administrador fuera de la lista **sí** elimina. Si este control no da rojo, la prueba no mide nada |

Es una corrida pesada (levanta Chatwoot): se hace con turno, o en Actions.

**En producción,** después de instalar y con el OK de Sam, solo con datos de prueba:

1. Sam crea una conversación en la bandeja de prueba y una etiqueta de prueba.
2. Una persona del equipo intenta eliminarlas: tiene que ver un error, y siguen ahí.
3. La misma persona les cambia el nombre o el estado: tiene que poder.
4. Sam las elimina: tiene que poder.
5. Se guarda la evidencia en `/srv/ops/evidencias/`, como en las puertas anteriores.

### 5.4 Inventario de rutas: el entregable que cierra la lista

La regla de §5.1 no se escribe de memoria. El primer entregable de la etapa 1 es un
inventario sacado de `rails routes` de la imagen `chatwoot/chatwoot:v4.19.1-ce`, guardado en
el repo, con **cada ruta** de la API de cuenta clasificada y con su razón:

| Clase | Qué entra |
|---|---|
| **Denegada** | Elimina o pierde datos del negocio. Se niega a quien no está en la lista |
| **Excepción** | Es un `DELETE`, pero personal o reversible. Se permite, con la razón escrita |
| **No elimina** | No pierde datos. No se toca |

El inventario tiene que cubrir, como mínimo:

- todos los `DELETE`;
- los `POST` y `PATCH` que pierden datos sin ser `DELETE`: `bulk_actions` (contactos en lote),
  `actions/contact_merge`, `destroy_custom_attributes` de contactos, empresas y conversaciones,
  `notifications/destroy_all`, y los `PATCH` que reemplazan una lista entera (miembros de
  bandeja y de equipo);
- el borrado de la cuenta: en CE, `Api::V1::AccountsController` solo tiene `create`, `show` y
  `update`, y `toggle_deletion` está en las rutas de `enterprise` **[CÓDIGO: `config/routes.rb`]**.
  El inventario lo confirma contra la imagen y deja escrita la clase de cada una, también de
  `accounts#update`;
- las acciones que ejecutan otras: `macros#execute`, `automation_rules#clone` y el catálogo de
  acciones de macros y automatizaciones. Hay que comprobar que ninguna acción disponible
  elimine registros **[INFERENCIA: asignan, etiquetan, cambian estado, envían; ninguna borra]**;
- lo que queda fuera de `Api::V1::Accounts::BaseController` y por qué (perfil propio,
  Platform API, `super_admin`, widget público).

Una ruta sin clasificar hace fallar la prueba: el inventario y `rails routes` tienen que
coincidir ruta por ruta.

**En E3 (SDD-0588).** Al evaluar una versión nueva se suma un **diff de rutas** entre la
versión instalada y la candidata. Toda ruta nueva o cambiada llega sin clasificar, y por eso
detiene la subida hasta que alguien la clasifique. El inicializador entra en `PIEZAS`
**[REPO: `lib/studio/chatwoot/versiones-fuentes.ts`]** con los archivos de Chatwoot de los que
depende.

### 5.5 Instalación en el VPS (puerta con OK de Sam)

Igual que la revocación de sesiones **[REPO: runbook de agentes, puerta 3]**:

1. Correr antes la prueba local: 0 fallas, con el control en rojo.
2. Copiar el inicializador a `/srv/chatwoot/rails/` y comprobar que su sha256 es el del repo.
3. **El compose del VPS se edita a mano, con respaldo. No se copia el del repo:** el del VPS
   tiene montajes que el del repo no. Se le agregan dos piezas: la variable en el entorno y el
   montaje del inicializador.
4. Cargar `DTD_CHATWOOT_ELIMINA_IDS` en `/srv/chatwoot/.env`.
5. Recrear, solo esos servicios:

   ```bash
   cd /srv/chatwoot && docker compose -f compose.yml up -d --no-deps --force-recreate rails sidekiq
   ```

   **Nunca `compose up` a secas** (recrearía todo). `docker restart` no sirve: no toma ni la
   variable ni el montaje nuevo.
6. Comprobar en el log de arranque de `rails` la línea de protección activa y cuántos ids leyó
   (el número, no los ids).

**Por qué también `sidekiq`.** La regla se aplica en `rails`, que es quien atiende los pedidos.
Pero `sidekiq` comparte los mismos montajes (`x-chatwoot`) **[REPO: `infra/chatwoot/compose.yml`]**,
así que carga el mismo inicializador: se recrea en el mismo comando para que los dos corran
los mismos archivos. La prueba local comprueba que el inicializador arranca limpio en `sidekiq`.

**Marcha atrás:** restaurar el compose del respaldo y recrear los mismos dos servicios.

## 6. Enmienda a la matriz 2.7

### 6.1 Tres niveles

| Nivel | Quién, en Studio | Rol en Chatwoot | En la lista de quién elimina | Bandejas y equipos |
|---|---|---|---|---|
| **Completo** | Superadministrador (`is_platform_admin()`, SDD-0250 y 0636) con vínculo | `administrator` | Sí | Todos |
| **Gestión** | Rol `admin`, o cualquier rol con el permiso nuevo «Chat: administrar» | `administrator` | No | Todos |
| **Atención** | Lo de hoy: `commercial`, `support`, u otro rol con la Bandeja | `agent` | No | Según el rol, como hoy |

Sin la Bandeja, sin cuenta: igual que hoy.

### 6.2 Cómo se expresa «gestión» en Studio

Con un permiso nuevo, **«Chat: administrar»** (módulo `bandeja-gestion`), no con un rol nuevo
ni con una lista suelta:

- El rol `admin` lo tiene siempre, como todos los módulos.
- A cualquier otra persona se le da **por persona**, con el mecanismo de accesos adicionales
  que ya existe (SDD-0622 y 0635), o por rol con un override. Tenerlo incluye entrar a la
  Bandeja.
- **Caso real, Contabilidad:** la persona conserva su rol `accounting` en Studio (sigue viendo
  dinero y nada más cambia para ella) y recibe «Chat: administrar» a su nombre. En Chatwoot
  queda `administrator` sin borrado. El resto de Contabilidad no entra al chat.
- Por qué no usar «ver y editar» del módulo `bandeja` que ya existe: `commercial` ya lo tiene
  de fábrica **[REPO: `lib/studio/rbac.ts`, `canEditModule`]**, así que todo comercial pasaría
  a administrador.
- Por qué no un rol nuevo: obligaría a sacar a la persona de Contabilidad de su rol, y el
  catálogo de roles está en la base y en muchas policies.

Hoy el ciclo de agentes decide solo por rol y el módulo `bandeja` está fuera de los accesos por
persona a propósito **[REPO: `lib/studio/user-module-grants.ts`]**. La implementación cambia
eso: el ciclo lee también los accesos por persona.

### 6.3 Qué hace el cron con cada nivel

- **Gestión:** lo pone o lo mantiene como `administrator` y en todas las bandejas y equipos.
  Si pierde el permiso, baja a `agent` o sale, como cualquier cambio de rol de hoy.
- **Completo:** lo mismo, y además **nunca lo degrada ni lo saca**. Si en Studio deja de ser
  superadministrador, el cambio queda «bloqueado» y la salud avisa: bajar al administrador
  completo se hace a mano y con Sam.
- **La lista del VPS no la escribe el cron.** Es una variable del servidor: se cambia a mano,
  con OK de Sam, cuando cambie quién es administrador completo (hoy, solo él).

**Candado del último administrador humano.** Sigue como está **[REPO: `planificarRoles`]**. Con
el nivel gestión habrá varios `administrator`, así que ese candado ya no alcanza para lo que
importa. Se le suma el **candado del administrador completo:**

- en Chatwoot, el inicializador no deja que nadie fuera de la lista le cambie el rol o lo
  saque (§5.1);
- en Studio, el cron no lo degrada ni lo saca, y el usuario de servicio sigue intocable.

### 6.4 Salud: alertas nuevas

| Alerta | Qué significa |
|---|---|
| La protección de borrado no está activa | La ruta de lectura no existe o dice que falta la variable |
| Nadie puede eliminar | La lista no tiene a ningún `administrator` humano de la cuenta |
| La lista no coincide con Studio | Hay un id en la lista que no es un superadministrador vinculado, o al revés |

Y una que ya existía como conteo y ahora tiene nombre: **hay un administrador sin vínculo**
(§5.2).

## 7. Cómo se vincula a los dos agentes de hoy sin que pierdan acceso

El vínculo es por correo: «Dar de alta» llama a `users#create` de la Platform API, que **adopta
al usuario que ya existe con ese correo**, sin crear otro, y lo deja al alcance de Studio
**[CÓDIGO: `platform/api/v1/users_controller.rb`, `User.from_email` y `platform_app_permissibles`]**.
Conserva el mismo id, sus conversaciones y su historial. Si el correo no coincide, Chatwoot
crea un usuario nuevo y la persona queda con dos: por eso la condición es estricta.

Orden, cada paso con su comprobación:

1. **Antes de todo:** el inicializador instalado y probado (§5.3) y Sam vinculado como nivel
   completo.
2. **Mismo correo.** Por cada persona, comparar el correo de Studio con el de Chatwoot (Ajustes
   → Agentes), sin mayúsculas ni espacios de más. Studio no puede leer por la Platform API el
   correo de un usuario que no creó **[REPO: runbook de agentes, «Límites conocidos»]**, así que
   esta comparación la hace una persona. Si difieren, Sam decide cuál manda y se corrige antes.
3. **Permiso primero.** A la persona de Contabilidad se le da «Chat: administrar» en Studio. La
   persona con rol `admin` ya lo tiene.
4. **Simular.** El cron, en modo simulación (nuevo, §8), tiene que decir «0 cambios de rol»
   para las dos. Si anuncia una degradación, no se vincula.
5. **Vincular** con «Dar de alta», una persona a la vez.
6. **Comprobar:** en Chatwoot sigue como Administrador, con el mismo id y sus conversaciones;
   entra desde Studio › Bandeja; no puede eliminar la etiqueta de prueba.

**Lo que sí cambia para ellas:**

- Si se vincula antes del paso 3, el cron baja a la persona de Contabilidad a `agent` sin
  bandejas. Se arregla dando el permiso y esperando la siguiente corrida, pero es justo lo que
  se quiere evitar: por eso el orden.
- Hoy el alta le pone una clave aleatoria a quien no es `admin` de Studio **[REPO: runbook de
  agentes]**. Con la regla actual, la persona de Contabilidad dejaría de entrar directo a
  `chat.dtdcargo.com` y entraría solo por Studio (pregunta 4).

## 8. Etapas de implementación (después del OK de Sam)

Cada etapa es una PR, con su allowlist exacta. Un archivo fuera de la lista no se toca en esa
etapa: si hace falta, se enmienda esta spec primero.

### Etapa 1 · Chatwoot: inicializador, inventario y prueba (sin producción)

**Allowlist:**

- `infra/chatwoot/rails/zz_dtd_reservar_eliminar.rb` (nuevo)
- `infra/chatwoot/rutas/inventario-v4.19.1.tsv` (nuevo; el inventario de §5.4)
- `infra/chatwoot/pruebas/prueba-reservar-eliminar.sh` (nuevo)
- `infra/chatwoot/pruebas/sonda-reservar-eliminar.rb` (nuevo)
- `infra/chatwoot/pruebas/compose.reservar-eliminar.yml` (nuevo; monta la sonda)
- `infra/chatwoot/pruebas/compose.sin-reservar-eliminar.yml` (nuevo; el control)
- `infra/chatwoot/compose.yml` (la variable en `x-entorno` y el montaje en `x-chatwoot`)
- `lib/studio/chatwoot/versiones-fuentes.ts` y `lib/studio/chatwoot/__tests__/versiones.test.ts`
  (la pieza nueva en `PIEZAS` y el diff de rutas de E3)

**Criterios de aceptación:**

1. El inventario coincide ruta por ruta con `rails routes` de la imagen 4.19.1; ninguna queda
   sin clase ni sin razón.
2. La prueba de §5.3 da 0 fallas, y su control sin el inicializador da rojo.
3. Con la lista inválida, bajar o sacar al completo da 403.
4. El inicializador arranca limpio en `rails` y en `sidekiq`.
5. E3 detiene una versión candidata que trae una ruta sin clasificar (probado con una ruta
   inventada).

### Etapa 2 · Studio: tres niveles, permiso por persona, candado, simulación y salud

**Allowlist:**

- `lib/studio/chatwoot/matriz.ts` y `lib/studio/chatwoot/__tests__/matriz.test.ts`
- `lib/studio/chatwoot/agentes-matriz.ts` y `lib/studio/chatwoot/__tests__/agentes-matriz.test.ts`
- `lib/studio/chatwoot/agentes-ciclo.ts` y `lib/studio/chatwoot/__tests__/agentes-ciclo.test.ts`
- `lib/studio/chatwoot/agentes-salud.ts` y `lib/studio/chatwoot/__tests__/agentes-salud.test.ts`
- `lib/studio/chatwoot/platform-api.ts` y `lib/studio/chatwoot/__tests__/platform-agentes.test.ts`
  (leer `dtd_permisos`)
- `lib/studio/rbac.ts` y `lib/studio/rbac.test.ts` (módulo `bandeja-gestion`)
- `lib/studio/modules.ts` (rótulo «Chat: administrar»)
- `lib/studio/user-module-grants.ts` y `lib/studio/user-module-grants-queries.ts` (`bandeja` y
  `bandeja-gestion` pasan a concederse por persona)
- `app/api/cron/chatwoot-agentes/route.ts` y sus `__tests__` (modo simulación)
- Una migración solo si la base la necesita para que `user_has_module` reconozca el módulo
  nuevo. Lleva su número, asignado por el Director, y su propia revisión; no se aplica en
  producción dentro de esta etapa.

**Criterios de aceptación,** cada uno con su prueba:

| # | Criterio | Cómo se mide |
|---|---|---|
| 1 | El cron no degrada ni saca al nivel completo | Con un superadministrador vinculado que pierde el rol en Studio, `planificarRoles` devuelve 0 cambios para él y lo deja en «bloqueadas» |
| 2 | La simulación no escribe | El modo simulación devuelve el plan y hace 0 llamadas de escritura a Chatwoot (se cuentan en el doble) |
| 3 | La simulación da 0 cambios para quien ya está bien | Con un `administrator` de nivel gestión ya en todas las bandejas, el plan sale vacío |
| 4 | Las tres alertas de §6.4 | Una prueba por alerta: protección inactiva, nadie puede eliminar, la lista no coincide. Y una cuarta: administrador sin vínculo |
| 5 | El ciclo lee los accesos por persona | Un `accounting` con «Chat: administrar» a su nombre sale `administrator` y con todas las bandejas; otro `accounting` sin el permiso no sale |
| 6 | Quitar el permiso baja de nivel | Al quitarle «Chat: administrar», la misma persona pasa a `agent` si conserva la Bandeja, o sale de la cuenta si no |
| 7 | `commercial` y `support` no cambian | Su fila de la matriz da lo mismo que antes de la enmienda |
| 8 | El candado del último administrador humano sigue | Las pruebas actuales de `planificarRoles` pasan sin tocarlas |

Cierre de la etapa: `pnpm verify`, con turno.

### Etapa 3 · Runbook

**Allowlist:** `docs/runbooks/chatwoot-agentes.md` (matriz de tres niveles, puerta de
instalación de §5.5, alertas nuevas y el orden de §7).

### Etapa 4 · Puertas con OK de Sam

En este orden: instalar el inicializador y la variable en el VPS (§5.5); prueba de §5.3 en
producción; vincular a Sam; vincular a las dos personas (§7). Sin archivos del repo.

Si Sam elige la opción a) de la pregunta 6, la etapa 1 suma al inventario, como «denegadas»,
exportar contactos y crear o editar webhooks e integraciones.

## 9. Preguntas para Sam

1. **¿Cómo se consigue «no eliminar»?**
   - a) Inicializador propio, opción B. **(Recomendada.)**
   - b) Dejarlos como `agent` con todo (no editan ajustes y siguen borrando mensajes).
2. **¿El «no eliminar» vale para todos los que no son tú, también para atención y comercial?**
   Hoy un agente puede eliminar mensajes, notas y respuestas rápidas.
   - a) Sí: solo tú eliminas. **(Recomendada: una sola regla, fácil de explicar.)**
   - b) No: los agentes siguen pudiendo eliminar esas tres cosas.
3. **¿Fusionar dos contactos cuenta como eliminar?** La ficha fusionada desaparece y no se
   deshace.
   - a) Sí: solo tú fusionas. **(Recomendada.)**
   - b) No: el equipo también fusiona.
4. **¿Quién de nivel gestión entra directo a `chat.dtdcargo.com` con su clave?**
   - a) Solo quien tiene rol `admin` en Studio, como hoy; los demás entran por Studio.
     **(Recomendada: la baja en Studio le cierra el chat de una vez.)**
   - b) Todo el nivel gestión conserva su clave.
5. **¿El rol `admin` de Studio da gestión automáticamente?**
   - a) Sí, como hoy da `administrator`. **(Recomendada.)**
   - b) No: gestión se da siempre persona por persona, también a los `admin`.
6. **¿El nivel gestión puede sacar datos del chat?** Hoy un administrador puede exportar los
   contactos y crear webhooks e integraciones que envían conversaciones a otro servicio.
   - a) No: exportar contactos y crear o editar webhooks e integraciones quedan solo para ti.
     **(Recomendada: son datos personales que salen del sistema.)**
   - b) Sí: el nivel gestión también puede.

## 10. Alcance

### Dentro

- En Chatwoot: reservar el borrado a una lista de ids, el candado del administrador completo
  y una ruta de lectura para Studio.
- En Studio: el nivel gestión, el permiso «Chat: administrar» por persona, el modo simulación
  del cron y las alertas de salud.
- El inventario de rutas y su diff en la prueba de versiones (E3).
- El runbook de agentes.

### Fuera

- Ocultar en el panel los botones de eliminar para quien no puede usarlos.
- Papelera o recuperación de lo que Sam elimine.
- Permisos más finos dentro de «editar» (por ejemplo, editar etiquetas pero no automatizaciones).
- Cualquier cambio de rol en Studio de las dos personas.
- Corregir los párrafos «Estado» vencidos de `chatwoot-agentes.md` y `chatwoot-bandeja.md`: van
  en una PR de documentos aparte.
