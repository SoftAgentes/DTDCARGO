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
  control, una variable en el VPS y recrear `rails` una vez (80 s de corte medidos la última
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
3. **Excepciones** (cosas personales o reversibles, que no pierden datos del negocio): el
   borrador propio de un mensaje, los avisos propios, las vistas guardadas propias, quitar un
   participante de una conversación y quitar miembros de una bandeja o equipo (Studio manda y
   el cron lo repone). La lista exacta se cierra en la implementación contra `rails routes` de
   la imagen 4.19.1.
4. Vale para todos, no solo para el equipo: con esto un `agent` tampoco elimina mensajes,
   notas ni respuestas rápidas (pregunta 2).

**Falla cerrado.** Con la variable vacía, ausente o mal formada, nadie pasa por el punto 1. El
arranque lo escribe en el log y Studio lo avisa (§6.4).

**Si Chatwoot cambia.** Si falta el controlador base donde se engancha, el arranque se cae con
un mensaje claro, igual que hace hoy la revocación de sesiones con `RoomChannel`. No queda
instalado «en silencio» sin proteger.

**Logs:** id de Chatwoot del usuario, verbo y nombre del controlador. Nunca correos, tokens ni
contenido.

**Ruta de lectura para Studio.** `GET /platform/api/v1/dtd_permisos`, con el token de la
Platform App: devuelve los ids de la lista y si la protección está activa. No cambia nada.
Sirve para que la salud compare (§6.4).

### 5.2 Lo que queda fuera de este candado

- La consola `super_admin`, la consola de Rails y la base: son acceso de servidor, detrás de
  Cloudflare Access, y hoy son de Sam. Antes de instalar se comprueba que nadie del equipo
  tenga usuario de `super_admin`.
- La Platform API: solo la usa Studio.
- El equipo podrá crear webhooks e integraciones, invitar agentes y cambiar ajustes. Es lo que
  «editar todo» significa; el cron sigue corrigiendo roles y miembros de los vinculados.

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
| Sin la variable | 403 también para el de la lista, y el aviso en el log de arranque |
| **Control:** sin el inicializador | El administrador fuera de la lista **sí** elimina. Si este control no da rojo, la prueba no mide nada |

Es una corrida pesada (levanta Chatwoot): se hace con turno, o en Actions.

**En producción,** después de instalar y con el OK de Sam, solo con datos de prueba:

1. Sam crea una conversación en la bandeja de prueba y una etiqueta de prueba.
2. Una persona del equipo intenta eliminarlas: tiene que ver un error, y siguen ahí.
3. La misma persona les cambia el nombre o el estado: tiene que poder.
4. Sam las elimina: tiene que poder.
5. Se guarda la evidencia en `/srv/ops/evidencias/`, como en las puertas anteriores.

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

1. Inicializador, ruta de lectura y prueba local con control. Sin producción.
2. Studio: permiso «Chat: administrar», el ciclo lee accesos por persona, tres niveles en
   `matriz.ts`, candado del administrador completo, modo simulación del cron y alertas de
   salud. Con sus pruebas. Si la base necesita una migración para el permiso nuevo, se numera
   y se revisa aparte.
3. Runbook de agentes: matriz nueva, puerta de instalación y comprobación.
4. Puertas con OK de Sam, en este orden: instalar el inicializador y la variable en el VPS;
   prueba de §5.3 en producción; vincular a Sam; vincular a las dos personas (§7).

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

## 10. Fuera de alcance

- Ocultar en el panel los botones de eliminar para quien no puede usarlos.
- Papelera o recuperación de lo que Sam elimine.
- Permisos más finos dentro de «editar» (por ejemplo, editar etiquetas pero no automatizaciones).
- Cualquier cambio de rol en Studio de las dos personas.
