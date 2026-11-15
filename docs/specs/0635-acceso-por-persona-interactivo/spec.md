---
sdd: "0635"
title: "Acceso por persona interactivo y matriz de roles legible: mapa de módulos, persona frente a rol y Actividad completa"
status: proposed
author: "Claude (Worker 0635) + Sam"
created: 2026-11-15
updated: 2026-11-15
supersedes: null
superseded_by: null
related: ["0139", "0252", "0273", "0603", "0622", "0624"]
confidencialidad: interno
---

# SDD-0635 — Acceso por persona interactivo

> Sam probó en producción el panel de la SDD-0622 (migraciones 0538 a 0540, web f6f8199d6). No encontró dónde
> elegir «ver y editar», notó que Actividad solo muestra los extras y no los cambios de rol, y pidió decidir
> los permisos **persona por persona** de forma más intuitiva. Esta spec rediseña la pestaña **Acceso** de la
> ficha de usuario sin tocar la base: mismas tablas, mismas RPC, misma regla «solo suma». El mismo día Sam
> amplió el alcance a la matriz **«Roles y permisos»** (§3.8): encabezados fijos, palabras en vez de «V·E» y
> «de fábrica» en vez de «desvío del default».

**Estado:** `proposed`. Primera etapa = solo diseño: esta spec, la maqueta y `/ui-check`. El Director General
la revisa y Sam aprueba el diseño antes de implementar. Sin migraciones, sin datos y sin tocar producción.

**Maqueta navegable:** [`maqueta/acceso-por-persona.html`](maqueta/acceso-por-persona.html) (archivo
autocontenido; ábrelo en el navegador). Capturas en [`maqueta/`](maqueta/), listadas en §10.

## 1. Pedido

Sam, 2026-11-15, al probar el panel en producción:

1. En **«Lo que puede ver»**, actuar directo sobre cada módulo: un clic para agregarlo como extra (ver o ver y
   editar, con motivo), quitar un extra y ver de dónde viene cada permiso (rol, extra, sensible).
2. Que quede claro que el cambio es **para esa persona** y no para todo el rol. La pantalla «Roles y permisos»
   (`studio_role_module_overrides`, SDD-0252) cambia a todos los de un rol: explicar la diferencia o unificar.
3. Más intuitivo: el selector «Ver / Editar» solo aparece después de elegir un módulo en el buscador y Sam no lo
   encontró. El campo «Almacén» confunde cuando no aplica.
4. Evaluar la Fase 6 de la 0622 (rol `custom` / «Personalizado») sin implementarla.
5. **Ampliación del 2026-11-15 (vía Director General), matriz «Roles y permisos»:** encabezado de roles fijo
   arriba y columna de módulos fija a la izquierda, con señal de que hay más contenido y el grupo visible; «V·E»
   cambiado por palabras o íconos claros con leyenda siempre a la vista; explicar en palabras «desvío del
   default» y su ×; rediseño moderno y simple que distinga «todo el rol» de «una persona».

Pregunta que lo resume: **¿cómo tratar a dos personas de contabilidad con accesos distintos sin que choquen con
los cambios por rol?** La respuesta está en §4.

## 2. Qué hay hoy (leído en el repo el 2026-11-15, base `540d607f8`)

| Pieza | Dónde | Qué hace hoy | Problema que vio Sam |
|---|---|---|---|
| Pestaña Acceso | `app/studio/(app)/usuarios/_components/acceso/AccesoPanel.tsx` | Tres bloques apilados: rol base, «Accesos extra» (buscador «Agregar módulo o área…» + lista de extras) y «Lo que puede ver» (chips por área) | «Lo que puede ver» es **solo lectura**: muestra los módulos con acceso, pero no deja actuar sobre ellos. Para dar algo hay que ir al buscador de arriba |
| Ver / Editar | `FormAlta` en el mismo archivo | El selector `Ver · Editar` aparece **solo** después de elegir un módulo en el buscador, en la esquina del formulario | Sam no lo encontró. Además el valor por defecto es «Ver» y el control es chico |
| Módulos que no se pueden dar | `grantableStatus` y `COVERAGE_HINT` en `lib/studio/user-module-grants.ts` | Salen deshabilitados en la lista; el motivo va en `title` (tooltip) | El motivo no se ve sin pasar el mouse; con teclado no se ve |
| «Lo que puede ver» | `LoQuePuedeVer` en `AccesoPanel.tsx` | Solo lista lo que la persona **ya** ve; el origen va en `title` | No muestra lo que le falta, que es justo lo que se quiere sumar |
| Rol base y almacén | `ficha/RolYAlcanceCard.tsx` | Selector segmentado de 7 roles y un `<select>` «Almacén» **siempre visible**, deshabilitado si el rol no tiene lado (`SCOPED_ROLES` = operaciones, almacenista, soporte) | Un campo gris que no aplica a Contabilidad confunde |
| Matriz por rol | `app/studio/(app)/admin/_components/PermissionsSection.tsx`, pestaña «Roles y permisos» de `UsersClient.tsx` | Cada clic cambia la celda del rol para **todas** sus personas. Guarda solo el estado actual de la celda con `updated_by`/`updated_at` (`0357_role_module_overrides.sql`) | Nada en pantalla dice cuántas personas afecta ni que existe la vía por persona |
| Actividad | `acceso/ActividadAcceso.tsx` + `listUserAccessActivityAction` (`usuarios/actions.ts`) | Lee `entity_audit_log`, entidad `studio_user_module_grant`. La cabecera del archivo dice que los cambios de rol «viven en otra bitácora» | Los cambios de rol, de almacén y las suspensiones no aparecen |

Bitácoras disponibles **sin migración** (verificado en el repo):

- **Extras:** `entity_audit_log`, entidad `studio_user_module_grant` (0538), con motivo. Ya se muestra.
- **Rol y almacén:** `changeUserRoleAction` y `changeWarehouseScopeAction` pasan por `executeD1Operation`
  (`membership.role_change`, `membership.scope_change`, `lib/studio/audit/d1-access-config-adapters.ts`), que
  escribe en `entity_audit_log`, entidad `membership` (0289), **con motivo**. Además el trigger de la 0201
  llena `user_role_audit` (`role_change`, `disable`, `enable`, `scope_change`), sin motivo.
- **Matriz por rol:** sin historial. `studio_role_module_overrides` guarda la última versión de cada celda
  (`updated_by`, `updated_at`), sin motivo ni valor anterior.

## 3. Diseño propuesto

### 3.1 Un solo mapa: «Lo que puede hacer»

Se fusionan «Accesos extra» y «Lo que puede ver» en un único bloque **«Lo que puede hacer»** (captura 01):

- Por área (Comercial, Operación, Finanzas, Marketing, Sistema) se muestran **todos** los módulos del área como
  chips, no solo los que ya ve.
- Cada chip dice su estado sin abrirlo:

  | Estado | Aspecto | Texto |
  |---|---|---|
  | Por su rol | relleno neutro (`--neutral-bg`) | nombre + `V` o `V·E` |
  | Extra | relleno índigo (`--cat-2-bg`, borde `--cat-2`) | nombre + `V` o `V·E` |
  | Sensible | borde dorado (`--warning`) sobre cualquiera de los anteriores | igual |
  | Sin acceso, se puede dar | contorno punteado | `+ nombre` |
  | Todavía no se puede dar | contorno punteado tenue, ícono de candado | nombre |
  | Cambio sin guardar | contorno wine | igual, con el estado nuevo |

- Los que «todavía no se pueden dar» van **plegados** por área: «N todavía no se pueden dar como extra · ver».
  Así el mapa no se llena de opciones muertas, pero nadie piensa que el módulo no existe.
- El contador por área cambia a «7 de 13» = módulos con acceso de los del área.
- El nombre accesible de cada chip incluye el estado («CRM: sin acceso», «Tesorería: por su rol, ver y
  editar»). No depende del color (A11Y-01).

### 3.2 Clic en un módulo: detalle con las tres opciones a la vista

Al tocar un chip se abre, **debajo de su área**, el detalle del módulo (captura 02):

- **Origen** en texto, no en tooltip:
  - «Por su rol Contabilidad: ver y editar. Lo tienen las 2 personas del rol.»
  - «Extra · «motivo» · dado por … · fecha · vence …»
  - «Sin acceso. Su rol Contabilidad no incluye CRM.»
- **Tres opciones grandes**, siempre visibles, como radio: **Sin extra / Quitar extra · Solo ver · Ver y
  editar**. Cada una dice qué significa en una línea. Esto reemplaza el `Ver · Editar` chico que Sam no encontró.
- Si su rol ya lo da completo, no hay opciones: el detalle explica que un extra no suma nada y enlaza a «Roles y
  permisos» para cambiarlo a todo el rol (con la nota de que el dinero no se cambia por rol, candado de la 0357).
- Si su rol ya lo deja **ver**, la única opción activa es «Ver y editar» (equivale al `role_view` de hoy).
- Si todavía no se puede dar, el detalle muestra **el motivo en texto** (el de `COVERAGE_HINT`) y ninguna opción
  (captura 04). Es la regla de la 0622 §5.3: no prometer lo que la base niega.
- Si el extra solo puede ser de ver (R1 de la 0622: `users`, `admin`; o rol `support`), «Ver y editar» sale
  deshabilitada con el motivo escrito al lado.
- Teclado: el chip es un botón con `aria-expanded`; `Esc` cierra el detalle y devuelve el foco al chip; las
  opciones son un `radiogroup` con flechas, como el selector de rol.

### 3.3 Cambios para esta persona: un motivo, un «Guardar»

Elegir una opción **no guarda**. El cambio va a una bandeja fija al pie del panel, **«N cambios para
<persona>»**, con la etiqueta «No cambia el rol <rol>» (captura 02):

- Lista de cambios con «Deshacer» cada uno.
- **Un motivo** (obligatorio, 5 a 500 caracteres, con el aviso de datos personales de `MOTIVO_AVISO_PII`) y un
  **vencimiento opcional** para todos.
- «Guardar N cambios» llama a `grantUserModuleAction` / `revokeUserModuleGrantAction` **una vez por módulo**,
  con el mismo motivo. Es el mismo patrón que ya usa «Agregar todo Comercial»; no cambia ninguna firma.
- Si en la lista hay un módulo sensible, antes de guardar se abre el **doble aviso** existente
  (`DobleAvisoDialog`), con la lista de efectos de ese módulo. Mientras ningún sensible esté cubierto (0622
  §13.2) este camino no se alcanza, igual que hoy.
- **Fallo a medias:** si un módulo falla, los anteriores ya quedaron guardados. La bandeja conserva solo los que
  faltan, dice cuál falló y por qué, y el resto se ve en el mapa. Nada se revierte por detrás.
- Al guardar, el resultado se dice en la sección («2 cambios guardados para Contable A»), no solo en un toast
  (BTN-01 §5).
- Si la persona cierra la ficha con cambios sin guardar, se pide confirmar el descarte.
- El atajo «Agregar todo Comercial» pasa a ser «Todo Comercial» dentro del encabezado del área: llena la
  bandeja con los comerciales que se pueden dar, en «Ver y editar», para revisar antes de guardar.

### 3.4 «Para esta persona» frente a «para todo el rol»

**Recomendación: no unificar las dos pantallas; nombrarlas y cruzarlas.** Resuelven cosas distintas: la matriz
por rol fija el piso común y la ficha suma excepciones con nombre y motivo. Unificar en una sola vía obligaría a
elegir entre perder los desvíos por rol (y repetir el mismo extra en cada persona) o perder la trazabilidad por
persona. Cambios de pantalla:

En la ficha (pestaña Acceso):

1. Franja arriba, en índigo: «Lo que cambies aquí es **solo para <persona>**. No toca a las otras personas de
   <rol>. Para cambiar a todo el rol usa Roles y permisos.» con enlace.
2. En el rol base: «**N personas** tienen este rol. El rol es el piso: lo que todas comparten.»
3. En cada detalle de módulo que viene del rol, el texto «Lo tienen las N personas del rol».

En «Roles y permisos» (rediseño completo en §3.8, capturas 07 y 09 a 13):

4. Franja dorada arriba: «**Esta tabla cambia a todas las personas de cada rol.** Para darle algo a una sola
   persona, abre su ficha › Acceso (accesos extra).»
5. Bajo el nombre de cada rol, «N personas».
6. Cada celda abre un panel que **nombra a las personas afectadas** y avisa si alguna ya tiene ese módulo como
   extra (quedará «sobra» o lo conservará).
7. Nada se guarda con el primer clic: se elige el nivel y se pulsa «Aplicar a las N». Hoy la celda guarda al
   clic con un ciclo de tres estados; el pedido del 2026-08-07 (que el cambio se note) se conserva con el toast
   que nombra el cambio y el destello, pero ahora el alcance se lee antes. Cambia el acceso de varias personas:
   MP-01 pide confirmación con consecuencia.

### 3.5 Regla de combinación y el caso de las dos personas de contabilidad

La regla ya está implementada (0622 §13.1, en SQL y en TypeScript con paridad probada) y esta spec no la cambia:

```
acceso efectivo = rol (default de código ± desvío por rol)  ∪  extras vigentes de la persona
```

con los candados de siempre: admin todo, `support` sin edición, alcance de almacén encima, desvíos por rol nunca
sobre módulos sensibles. Consecuencias que la pantalla tiene que decir:

| Situación | Qué pasa | Qué muestra la pantalla nueva |
|---|---|---|
| Se le **suma** al rol un módulo que una persona ya tiene como extra | Su extra deja de sumar nada | Chip «Por su rol»; el extra aparece como «sobra» en la bandeja de la ficha, con un botón para quitarlo. La confirmación de la matriz lo avisa antes (punto 7) |
| Se le **quita** al rol un módulo que una persona tiene como extra | Esa persona lo conserva por su extra; las demás lo pierden | Es el resultado buscado: la excepción sobrevive. La confirmación de la matriz nombra quién lo conserva |
| Se le **cambia el rol** a una persona | Conserva sus extras; los que el rol nuevo ya da quedan «sobra» | El diálogo de cambio de rol lista los extras que conserva (captura del diálogo en la maqueta) |
| Se le quiere dar a una persona **menos** que a su rol | No existe: los extras solo suman (0622 §5.1 regla 1) | El detalle de un módulo «por su rol» lo explica y lleva a la matriz |

**Patrón para dos personas de contabilidad con accesos distintos:** el rol Contabilidad lleva lo que ambas
comparten (el piso) y la diferencia va como extra en la persona que necesita más. Si una necesita **menos** que
la otra en un módulo **no sensible**, se baja el piso en «Roles y permisos» y se le da el extra a la otra. En
la maqueta: Contable A y Contable B tienen el mismo rol; B tiene además CRM (ver y editar) y Conversaciones
(solo ver, vence el 31 dic).

**Límite que hay que decirle a Sam:** en los módulos de **dinero** no se puede diferenciar hoy a dos personas
de contabilidad. El rol Contabilidad los da completos, la matriz por rol no puede tocarlos (candado de la 0357)
y los extras no restan. Diferenciarlas en dinero pide un rol de piso más bajo más extras de dinero, y eso
depende de la fase 8 de la 0622 (dinero por extra) y, si el piso es `custom`, de la Fase 6 (§6).

### 3.6 Almacén solo cuando aplica

- El campo «Almacén que ve» **no se dibuja** si el rol elegido no está en `SCOPED_ROLES`. Aparece al elegir
  Operaciones, Almacenista o Soporte (captura 05), con la línea «Solo limita los módulos de almacén (CN o VE)».
- Se quita la frase gris «El almacén no aplica a …». Para admin no se muestra nada.
- Si una persona cambia de un rol con alcance a uno sin alcance, su `warehouse_scope` guardado no se toca (igual
  que hoy) y la pantalla deja de mostrarlo.

### 3.7 Actividad: una sola línea de tiempo

La pestaña Actividad junta, para esa persona y en orden de fecha (captura 06):

| Tipo | Fuente | Con motivo | Etapa |
|---|---|---|---|
| Extra (dado, cambiado, quitado) | `entity_audit_log`, entidad `studio_user_module_grant` | Sí | Hoy |
| Rol y almacén | `entity_audit_log`, entidad `membership` (D1, 0289) | Sí | Etapa 2, sin migración |
| Suspensión y reactivación | `user_role_audit` (`disable`, `enable`) o su evento D1 si existe | Según la fuente | Etapa 2, sin migración |
| Cambio de la matriz de **su** rol | `studio_role_module_overrides` | No (no hay historial) | Etapa 3, con migración |

- Filtros: Todo · Rol y estado · Accesos extra · Cambios a todo el rol.
- Se lee con el cliente de servicio, como ya hace `listUserAccessActivityAction` (decisión del Director General
  del 2026-11-14, 0622 §11), filtrando por tenant activo y por la persona. No se agrega lectura de
  `authenticated` sobre `entity_audit_log`.
- La implementación verifica qué `entity_id` usa D1 para `membership` antes de filtrar; si no permite filtrar por
  persona de forma exacta, Actividad muestra solo lo que sí pueda atribuir y lo dice. No se adivina.
- **Etapa 3 (fuera de esta entrega):** que la matriz por rol escriba su propio evento en `entity_audit_log` con
  valor anterior, valor nuevo y motivo. Pide migración y RPC nuevas (`studio_set_role_module_access` hoy no
  recibe motivo), así que va en una spec propia o en una enmienda de esta con su OK de Sam.

### 3.8 Matriz «Roles y permisos» (ampliación pedida por Sam el 2026-11-15)

Pantalla: pestaña «Roles y permisos» de Usuarios (`UsersClient.tsx` → `PermissionsSection.tsx`, que vive en
`app/studio/(app)/admin/_components/`). Hoy: tabla de módulos × 7 roles, celdas `TOTAL / V·E / V / —` que ciclan
al clic y guardan solas, punto wine de «desvío del default» con una × que aparece al pasar el mouse, y una
leyenda arriba que se pierde al bajar. El contenedor tiene `overflowX: auto`: la columna de módulos queda fija
al desplazarse a los lados, pero **el encabezado de roles no** queda fijo al bajar, porque el desplazamiento
vertical es el de la página.

Lo que dijo Sam y cómo lo resuelve el diseño:

| Pedido de Sam | Diseño |
|---|---|
| **1. Encabezados fijos.** Al bajar se olvida cuál columna es cada rol | La tabla vive en un contenedor con alto propio (`max-height` = alto de la ventana menos la cabecera) y desplazamiento en los dos sentidos. Dentro: la fila de roles queda fija arriba (`position: sticky; top: 0`), la columna de módulos fija a la izquierda (`left: 0`) y la esquina por encima de ambas. Cada rol muestra su nombre y «N personas» |
| …que se note que hay más contenido | Al bajar, el encabezado proyecta una sombra hacia abajo; al desplazar a los lados, la columna de módulos la proyecta hacia la derecha. Desaparecen en el borde (captura 09) |
| …y que el grupo quede visible | La fila del grupo («OPERACIÓN · 19 módulos») queda fija justo debajo de los roles mientras dura su sección y la siguiente la empuja (captura 09) |
| **2. «V·E» no se entiende** | Cada celda dice el nivel con **ícono + palabra**: lápiz «Ver y editar», ojo «Solo ver», guion «Sin acceso», escudo «Todo» (solo Administración). En pantallas angostas (menos de ~1180 px) pasa a la forma corta «Edita · Ve · No · Todo» con el mismo ícono (captura 12) |
| …leyenda siempre a la vista | La leyenda pasa al **pie fijo** del contenedor: se ve en cualquier punto del desplazamiento. En forma corta dice además «Edita = Ver y editar», etc. |
| **3. «Desvío del default» y la ×** | La palabra «desvío» desaparece. La celda cambiada lleva debajo «● Cambiado». Al abrirla, el panel dice en palabras: «De fábrica, Comercial tiene **ver y editar** en Reclamos. Hoy está cambiado a **solo ver**. *Volver a lo de fábrica*». La × se elimina: volver a fábrica es un enlace con texto dentro del panel. La opción de fábrica lleva la marca «· de fábrica» (captura 11) |
| **4. Moderno, simple, y que se distinga de la ficha** | Panel por celda en vez de ciclo ciego (ver referencias abajo); franja dorada «cambia a todas las personas de cada rol» con enlace a la ficha; conteo de personas por rol; el panel nombra a quiénes afecta. En la ficha, la franja índigo dice «solo para esta persona» (§3.4). Dorado = alcance amplio, índigo = una persona |

Detalle del panel de una celda (captura 10):

- Título «CRM · todo el rol Contabilidad» y «Cambia para **2 personas**: Contable A, Contable B».
- Tres opciones como radio, con una línea cada una: Sin acceso («No le aparece en el menú»), Solo ver («Lo abre sin
  poder cambiar nada»), Ver y editar («Puede crear y modificar»). Soporte tiene «Ver y editar» deshabilitada con
  el motivo («Soporte nunca edita»).
- Recuadro «De fábrica…» y, si está cambiada, «Volver a lo de fábrica».
- Si alguna persona del rol tiene ese módulo como extra: «Contable B ya lo tiene como acceso extra en su ficha. Si lo
  aplicas, ese extra quedará marcado «sobra»» (o «Lo conserva aunque el rol no lo tenga» si se quita).
- «Cancelar» y «Aplicar a las N», deshabilitado mientras no cambie nada. `Esc` cierra y devuelve el foco a la
  celda. Al desplazar la tabla el panel se cierra.
- Al aplicar: toast que nombra el cambio y las personas («Contabilidad: CRM ahora en «Solo ver» para 2
  personas») y el destello actual de la celda (`studio-permcell-flash`).

Otros cambios de la matriz:

- **Buscar módulo** y filtro **«Solo los cambiados (N)»**, para revisar de un vistazo todo lo que se apartó de
  fábrica.
- Columna **Administración** con fondo de base y «Todo» fijo; su encabezado dice «ve y edita todo».
- Celdas **fijas** (dinero y administración, `LOCKED_MODULES`): borde punteado, candado en el nombre del módulo y
  en la leyenda «Fijo: dinero y administración no se cambian aquí». No abren panel.
- Cada celda es un botón con nombre accesible completo («Contabilidad, CRM: Sin acceso. Cambiar para todo el
  rol»); la tabla tiene `caption` y encabezados con `scope`.
- Lógica sin cambios: `setRoleModuleAccessAction` / `resetRoleModuleAccessAction`, mismos candados, misma regla
  de `support`.

**Referencias de productos actuales** (de memoria, **sin verificar en línea** en esta tarea; orientan el diseño,
no son cita. Si se van a usar como argumento, verificar antes):

- Las matrices de roles de herramientas SaaS de equipo (administración de cuentas tipo Google Workspace, Atlassian,
  Odoo) usan **palabras o íconos con etiqueta** en las celdas, no siglas, y encabezados fijos en tablas largas.
- Los editores de permisos más usados abren **un menú o panel por celda** con las opciones nombradas («Sin
  acceso / Lector / Editor») en vez de ciclar al clic.
- Para lo cambiado se ve una marca «Modificado» o «Personalizado» y una acción con texto «Restablecer», no un
  ícono suelto.
- Se separa visualmente lo que aplica a un grupo de lo que aplica a una persona, y se dice a cuántos afecta antes
  de guardar.

## 4. Respuesta corta para Sam

- **Dónde está «ver y editar»:** al tocar cualquier módulo, las tres opciones salen grandes y a la vista.
- **Persona o rol:** la ficha dice «solo para esta persona» y cuántas comparten el rol; la matriz dice «esto
  cambia a todas» y pide confirmar nombrando a quiénes. Dos pantallas, cada una con su alcance escrito.
- **Dos contables distintas:** mismo rol como piso, la diferencia como extra con motivo. Si la diferencia es
  quitar, se baja el piso y se suma a la otra. En dinero no se puede todavía (§3.5).
- **Actividad:** rol, almacén, suspensiones y extras en una sola línea de tiempo; los cambios a todo el rol,
  cuando la matriz tenga historial.
- **Matriz de roles:** los roles y el grupo quedan a la vista al bajar; cada celda dice «Ver y editar», «Solo
  ver», «Sin acceso» o «Todo»; lo cambiado dice «Cambiado» y el panel explica «de fábrica» y cómo volver.

## 5. Alternativas evaluadas

| Opción | Ventaja | Por qué no |
|---|---|---|
| A · **Mapa interactivo + bandeja + cruce de pantallas** (esta spec) | Un solo lugar para ver y cambiar; sin migración; respeta «solo suma» | — (recomendada) |
| B · Matriz completa por persona (filas de módulos × columnas Rol / Extra / Efectivo) | Muy explícita | En el cajón de 560 px no cabe sin scroll horizontal; repite la matriz por rol |
| C · Quitar «Roles y permisos» y dejar solo extras | Una sola vía | El mismo cambio para 4 personas serían 4 extras con 4 motivos; se pierde «el piso del rol» |
| D · Plantillas de acceso con nombre (roles propios) | Reutilizable | Fuera de alcance por la 0622 §10; es otra spec |
| E · Guardar al clic sin bandeja | Más rápido | Obliga a un motivo por módulo y repite el problema de la matriz: cambios sin rastro visible antes de ocurrir |

## 6. Evaluación de la Fase 6 de la 0622 (rol `custom` / «Personalizado») — sin implementar

**Qué daría:** una persona sin rol de piso (solo lo transversal: dashboard, calendario, bitácora, menciones, bug
tracker, mis reportes) a la que se le arma el acceso módulo a módulo. Con el mapa de §3.1, el editor ya
existe: «Personalizado» sería el rol cuyo mapa empieza casi vacío.

**Qué cuesta hoy** (de la 0622 §5.5, §12 y §13.2, sin medir de nuevo):

1. **Base:** nuevo valor en los CHECK de `user_tenants.role` y `user_invitations`; revisar las RPC que validan
   listas de roles (invitar, cambiar rol) y las fachadas que comparan `v_role in (...)` (0411–0413), que hoy
   **fallan cerrado** ante un rol desconocido. Migración propia con OK de Sam.
2. **Cobertura:** hoy solo 8 módulos se pueden dar como extra (`COVERED` en `user-module-grants.ts`: CRM,
   Clientes, Estimados, Órdenes de venta, Compras asistidas, Conversaciones, Tarifas, PreAlertas). Un
   Personalizado hoy solo podría tener esos 8 más lo transversal. Nada de Operación, Almacén, Finanzas ni
   Marketing.
3. **Dinero:** depende de la fase 8 (redefinir `studio_can_read_money()` con `user_has_module`, SDD-0624). Sin
   ella, un Personalizado no ve dinero aunque se le dé.
4. **Pendiente de Sam desde la 0622 §9:** confirmar que §5.5 es lo que quiere y si `documents` es transversal
   para `custom`.

**Recomendación:** no abrir la Fase 6 todavía. Orden sugerido: (1) esta spec (pantalla); (2) ampliar la
cobertura de módulos que se pueden dar, empezando por lo que pida un caso real; (3) fase 8, dinero; (4) recién
entonces `custom`, que será casi solo una migración de CHECK y fachadas más una opción en invitar y cambiar rol.
Mientras tanto, el patrón es «el rol más cercano como piso + extras». Si Sam quiere un Personalizado antes, el
mínimo viable sería `custom` con solo los 8 módulos cubiertos; la pantalla de esta spec lo soporta sin cambios.

## 7. Pruebas de aceptación (para la etapa de implementación)

1. **Mapa completo:** para una persona de Contabilidad, cada área lista todos sus módulos visibles; los que dan
   rol, extra, sensible, sin acceso y no disponibles se distinguen por texto accesible, no solo por color.
2. **Tres opciones a la vista:** al abrir un módulo que se puede dar aparecen «Sin extra · Solo ver · Ver y
   editar» sin otro paso. Prueba de componente que busca los tres `radio` por nombre.
3. **No promete lo que la base niega:** un módulo fuera de `COVERED` no ofrece opciones y muestra su motivo en
   texto. Prueba con `bandeja`, `treasury` (para un rol que no es Contabilidad) y `users`.
4. **Solo ver cuando corresponde:** `users`/`admin` (R1) y rol `support` no ofrecen «Ver y editar».
5. **Bandeja:** varios cambios, un motivo, un guardado; una llamada por módulo con el mismo motivo; la validación
   del motivo es `reasonError`. Fallo en el segundo de tres: el primero queda guardado, la bandeja conserva dos y
   nombra el que falló.
6. **Nada se guarda sin «Guardar»:** cambiar de opción no llama a ninguna acción de servidor (espía en la prueba).
7. **Persona frente a rol:** la ficha muestra «solo para <persona>» y el número de personas del rol; la matriz
   muestra la franja, los conteos y pide confirmar con los nombres afectados antes de llamar
   `setRoleModuleAccessAction`.
8. **Almacén:** con rol Contabilidad no hay campo Almacén en el DOM; con Operaciones sí.
9. **Actividad:** con eventos de extras y de rol para la misma persona, la pestaña los muestra juntos y en orden;
   el filtro «Rol y estado» deja solo los de rol. Prueba en `actividad-acceso.test.ts` con dobles, sin datos
   reales.
10. **Sobra:** si el rol ya da lo que el extra da, el extra se marca «sobra» y se puede quitar con motivo.
11. **Sin regresiones:** `AccesoPanel.test.tsx`, `RolYAlcanceCard.test.tsx`, `rbac.test.ts`,
    `rbac-guard.test.ts` y `rbac-actions-guard.test.ts` siguen verdes; `pnpm verify` al cierre.
12. **UI:** `/ui-check` sin hallazgos altos; claro y oscuro con tokens de `app/studio/tokens.css`; foco visible y
    `Esc` en el detalle.
13. **Privacidad:** sin nombres reales en fixtures ni capturas; el motivo conserva su aviso de datos personales.
14. **Matriz, encabezados fijos:** el encabezado de roles, la columna de módulos y la fila de grupo tienen
    `position: sticky` dentro de un contenedor con desplazamiento propio; al desplazar aparecen las sombras.
    Comprobación en navegador (e2e o captura) con la tabla desplazada, no solo en la prueba de componente.
15. **Matriz, sin siglas:** ninguna celda muestra «V·E», «V» ni «TOTAL»; el texto visible o el nombre accesible
    dice «Ver y editar», «Solo ver», «Sin acceso» o «Todo». La leyenda está en el pie fijo.
16. **Matriz, de fábrica:** una celda cambiada muestra «Cambiado»; su panel dice el nivel de fábrica y el actual
    y ofrece «Volver a lo de fábrica», que llama `resetRoleModuleAccessAction`. No queda ninguna «×» suelta.
17. **Matriz, alcance:** el panel nombra a las personas del rol y avisa de los extras afectados; nada se guarda
    hasta «Aplicar a las N» (espía en la prueba); celdas fijas y columna Administración no abren panel.
18. **Matriz, forma corta:** bajo ~1180 px las celdas muestran «Edita / Ve / No / Todo» y la leyenda las traduce.

## 8. Gobernanza

| Política | Aplicación | Clasificación |
|---|---|---|
| MP-01 (acciones con consecuencia) | Motivo obligatorio en la bandeja; confirmación con alcance en la matriz por rol | Cumplimiento (la matriz hoy no confirma: se corrige aquí) |
| BTN-01 | Resultado en la sección, no solo toast; motivo de bloqueo escrito, no en tooltip | Cumplimiento |
| AUD-01 | Actividad junta las bitácoras existentes; la matriz por rol sin historial queda como etapa 3 | Excepción temporal, nombrada en §3.7 |
| A11Y-01 | Chips con nombre accesible y estado; `radiogroup` con flechas; `Esc` y retorno de foco | Cumplimiento |
| VIS-01 / `BRAND.md` | Solo tokens existentes; dorado = sensible (riesgo), índigo = extra, wine = acción pendiente | Cumplimiento |
| Privacidad (`revisar-datos-ve`) | No se captura dato nuevo; el motivo sigue con su aviso. Actividad lee bitácoras que ya existen con el cliente de servicio, limitado a admin | No aplica revisión nueva; se revisa en la PR de implementación si cambia la lectura |

## 9. Fases

| Etapa | Contenido | Base de datos | Entrega |
|---|---|---|---|
| **1 · Diseño** (esta PR) | Spec, maqueta, `/ui-check` | No | PR draft; DG revisa, Sam aprueba |
| **2 · Pantalla** | §3.1 a §3.7 sin la fila «matriz de su rol» de Actividad | No | PR con la allowlist de §11 y `pnpm verify` |
| **3 · Historial de la matriz por rol** | Evento con valor anterior, nuevo y motivo al cambiar una celda | Sí: migración y RPC | Spec propia o enmienda, con OK nominal de Sam |
| — Fase 6 de la 0622 | `custom` | Sí | Según §6, no antes de la fase 8 |

## 10. Maqueta y capturas

Archivo: `maqueta/acceso-por-persona.html`. Personas ficticias; estados de cada módulo tomados de
`ROLE_MODULE_ACCESS` y `COVERED` al 2026-11-15. Tokens copiados de `app/studio/tokens.css`. El hash de la URL
fija el estado de cada captura (lo explica el script del archivo).

| Captura | Muestra |
|---|---|
| `01-mapa-contable-a.png` | Mapa completo de una persona de Contabilidad, sin extras |
| `02-crm-ver-y-editar.png` | Detalle de CRM con las tres opciones y la bandeja con un cambio y su motivo |
| `03-contable-b-extras.png` | Mismo rol, otra persona: CRM y Conversaciones como extra, con su origen |
| `04-bandeja-no-disponible.png` | Bandeja: módulo que todavía no se puede dar, con el motivo en texto |
| `05-almacen-solo-operaciones.png` | Al elegir Operaciones aparece «Almacén que ve» |
| `06-actividad-unificada.png` | Actividad con rol, estado, extras y cambios a todo el rol |
| `08-oscuro-crm.png` | Tema oscuro de la ficha |
| `07-matriz-roles-arriba.png` | Matriz «Roles y permisos» al inicio: franja de alcance, roles con personas, leyenda en el pie |
| `09-matriz-fija-al-bajar.png` | Al bajar: roles y grupo fijos, sombra bajo el encabezado, leyenda a la vista |
| `10-matriz-celda-crm-contabilidad.png` | Panel de una celda: personas afectadas, tres opciones y aviso del extra de Contable B |
| `11-matriz-volver-a-fabrica.png` | Celda «Cambiado»: «de fábrica» y «Volver a lo de fábrica» |
| `12-matriz-angosta-forma-corta.png` | Forma corta «Edita · Ve · No» con leyenda que la traduce |
| `13-matriz-oscuro.png` | Matriz en tema oscuro |

## 11. Allowlist exacta para la etapa 2 (implementación, sin base de datos)

**Aplicación**
- `app/studio/(app)/usuarios/_components/acceso/AccesoPanel.tsx`
- `app/studio/(app)/usuarios/_components/acceso/AccesoPanel.test.tsx`
- `app/studio/(app)/usuarios/_components/acceso/MapaAcceso.tsx` (nuevo: §3.1 y §3.2)
- `app/studio/(app)/usuarios/_components/acceso/MapaAcceso.test.tsx` (nuevo)
- `app/studio/(app)/usuarios/_components/acceso/CambiosPendientes.tsx` (nuevo: §3.3)
- `app/studio/(app)/usuarios/_components/acceso/CambiosPendientes.test.tsx` (nuevo)
- `app/studio/(app)/usuarios/_components/acceso/ActividadAcceso.tsx`
- `app/studio/(app)/usuarios/_components/acceso/permisos.css`
- `app/studio/(app)/usuarios/_components/ficha/RolYAlcanceCard.tsx`
- `app/studio/(app)/usuarios/_components/ficha/RolYAlcanceCard.test.tsx`
- `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx`
- `app/studio/(app)/usuarios/_components/UsersClient.tsx`
- `app/studio/(app)/usuarios/actions.ts` (solo `listUserAccessActivityAction` y su tipo de evento)
- `app/studio/(app)/usuarios/__tests__/actividad-acceso.test.ts`
- `app/studio/(app)/admin/_components/PermissionsSection.tsx` (§3.8 completo; las acciones de servidor no cambian)
- `app/studio/(app)/admin/_components/PermissionsSection.test.tsx` (nuevo)
- `app/studio/(app)/admin/_components/PermisoCeldaPanel.tsx` (nuevo: panel de la celda)
- `app/studio/(app)/admin/page.tsx` (solo si la sección se sigue mostrando ahí; hoy enlaza a Usuarios)
- `app/studio/studio.css` (solo las reglas `.studio-permcell*` y las nuevas de la matriz)
- `e2e/` un spec nuevo para los encabezados fijos de la matriz (nombre a fijar al implementar)

**Biblioteca**
- `lib/studio/user-module-grants.ts` (estado por chip y textos; sin tocar `COVERED` ni la regla)

**Documentación**
- Esta spec, su maqueta y el índice regenerado con `pnpm docs:index`.
- `.agents/handoffs/` de la tarea de implementación.

**Fuera, por decisión:** `supabase/` entero, `lib/studio/rbac.ts`, `lib/studio/rbac-guard.ts`, la lista
`COVERED`, `.env*`, producción, el portal público y Chatwoot. Cualquier otro archivo pide enmendar esta spec.

## 12. Decisiones que pide a Sam

| # | Pregunta | Propuesta | Estado |
|---|---|---|---|
| 12.1 | ¿Aprueba el mapa con bandeja (opción A de §5)? | Sí | Pendiente de Sam |
| 12.2 | ¿Dos pantallas cruzadas en vez de unificar? | Sí (§3.4) | Pendiente de Sam |
| 12.3 | ¿La matriz por rol pasa a pedir confirmación en cada clic? | Sí, con los nombres afectados | Pendiente de Sam |
| 12.4 | ¿Etapa 3 (historial de la matriz por rol, con migración)? | Sí, después de la etapa 2 | Pendiente de Sam |
| 12.5 | ¿Fase 6 (`custom`) espera a la cobertura y a la fase 8? | Sí (§6) | Pendiente de Sam |
| 12.6 | ¿Matriz con panel por celda en vez de ciclo al clic? | Sí (§3.8) | Pendiente de Sam |
| 12.7 | ¿Textos «Ver y editar · Solo ver · Sin acceso · Todo» y «Cambiado / de fábrica»? | Sí (§3.8) | Pendiente de Sam |

## 13. Fuera de alcance

- Cambiar la regla de combinación, `COVERED`, las RPC, las tablas o los candados de la 0622.
- Quitar permisos por persona (sigue «solo suma»).
- Conceder capabilities.
- Diferenciar personas de contabilidad en módulos de dinero (depende de la fase 8 de la 0622).
- La pestaña Perfil y la lista de personas («Personas con excepciones» queda como está).

## 14. `/ui-check` de la maqueta (2026-11-15, advisory)

Corrido sobre `maqueta/acceso-por-persona.html` contra `BRAND.md`, el Norte y `app/studio/tokens.css`.

| # | Prioridad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Alta | Emoji de candado en chips y en la matriz (BRAND: sin emoji en UI de producto) | Corregido en la maqueta con un ícono de trazo; en código va `Icon.lock` |
| 2 | Media | Nivel `V·E` del chip en 10 px con opacidad: contraste dudoso sobre el relleno índigo | Corregido: 11 px sin opacidad |
| 3 | Media | Espaciados de la maqueta en px sueltos (6, 9, 10 px) | Para la implementación: solo `var(--s-*)` y las clases `perm-*` existentes |
| 4 | Media | Chips de 30 px y botones chicos de 28 px de alto: bajo 44 px en táctil | El Studio es de escritorio denso, igual que hoy; en móvil, subir a 44 px |
| 5 | Baja | Diálogos de la maqueta sin trampa de foco | En código se reusan `ConfirmDialog` y `DobleAvisoDialog` |
| 6 | Baja | Bandeja fija con márgenes negativos | En código va como pie del cajón, con el patrón de pie del drawer |

Bien: solo tokens existentes (claro y oscuro), Archivo como `--f-sans` del Studio según `tokens.css`, sin
gradientes ni efectos, alineado a la izquierda, foco visible, nombres accesibles con estado, tuteo sin voseo.
Veredicto: **OK con ajustes menores** para pasar a implementación.

### 14.1 `/ui-check` de la matriz «Roles y permisos» (2026-11-15)

| # | Prioridad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Media | El panel de la celda se cerraba con el desplazamiento que provoca su propio `scrollIntoView` | Corregido en la maqueta (gracia de 400 ms); en código, cerrar solo por desplazamiento del usuario |
| 2 | Media | En forma corta la leyenda mostraba las palabras largas y no traducía «Edita / Ve / No» | Corregido: la leyenda dice «Edita = Ver y editar», etc. |
| 3 | Media | Sombras con `rgba` sin token | El panel ya usa `--shadow-pop`. Las sombras direccionales de los encabezados fijos no tienen token: pedir uno antes de implementar (BRAND regla 5) o usar solo el borde `--border-strong` |
| 4 | Baja | Panel posicionado a mano (`position: fixed`) | En código, el popover del sistema si existe; si no, el mismo cálculo con prueba de bordes |
| 5 | Baja | Celdas de 30 px de alto | Igual que hoy en escritorio; en táctil, 44 px |

Bien: encabezado, columna, grupo y leyenda fijos; ícono + palabra en vez de siglas; «de fábrica» en palabras;
solo tokens de color existentes; foco visible y `Esc`; nombres accesibles completos; tuteo.
Veredicto: **OK con ajustes menores**.
