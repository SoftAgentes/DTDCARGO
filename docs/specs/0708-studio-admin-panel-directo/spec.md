---
sdd: "0708"
title: "Studio · Administración: entrar directo a cada sección y reordenar el panel"
status: in-progress
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-22
updated: 2026-11-22
supersedes: null
superseded_by: null
related: ["0020", "0274", "0356", "0606", "0588", "0704"]
confidencialidad: interno
---

# SDD-0708 — Administración: entrar directo a cada sección y reordenar el panel

> Pedido de Sam (2026-11-22), textual: «cada vez que voy a implementar o entrar en una sección, me da como una doble
> ventana para volver a entrar… entro justamente ahí y en la barra de la derecha me sale volver a entrar otra vez,
> como con un doble clic innecesario. No entiendo por qué se hizo esto, pero hay que corregirlo». Y: «Revisa el panel
> de administración; reorganicemos o revisemos qué mejoras se pueden hacer».
>
> **Estado: en curso.** Sam eligió el 2026-11-22, viendo el simulador: «Elijo B (el menú acompaña) y el menú ordenado
> por tema (R1)» (§6). La fase 1 se implementa en la misma rama. El repo es público: sin datos de clientes, correos ni
> montos.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia. Base: `main` `8c15a4bb0`.

## 1. Diagnóstico: de dónde sale el doble clic

| Hecho | Ev. |
|---|---|
| `/studio/admin` es una sola página con menú de secciones a la izquierda y el contenido a la derecha, elegido por `?section=` | C `app/studio/(app)/admin/page.tsx:372-382` |
| Cuando la sección tiene `href` (vive en otra ruta) y no tiene pantalla en línea, la derecha muestra la tarjeta `LinkedSectionCTA`: «Esta sección tiene su módulo dedicado… **Abrir X →**». Ese es el segundo clic | C `page.tsx:798-799`, `:807-861` |
| El menú siempre enlaza a `/studio/admin?section=<id>`, nunca al `href` | C `page.tsx:615-617` |
| La tarjeta nació el 2026-05-24 (`d0e8299dd`, SDD-0020), al pasar Administración de un grid de tarjetas a menú lateral. Entonces solo «Agentes y Skills» tenía módulo propio y las demás eran marcadores; la tarjeta era un puente temporal «para mantener el área de configuración liviana» | C `git show d0e8299dd` · C `page.tsx:1-17` |
| Cada módulo que se sumó después (etiquetas, ON/OFF, notificaciones, alertas, rutas, Chatwoot, IA) se agregó con `href` y **heredó el puente** sin que nadie lo revisara | C `page.tsx:121`, `:139`, `:148`, `:158`, `:213`, `:360-363` |
| El diseño Norte no tiene puente: todas las secciones se pintan en línea | D `docs/design/studio/_norte/erp/modules/admin.jsx:95-102` |
| Las subpáginas no repiten el menú de Administración. Unas traen su propio «← Volver», con textos distintos; otras (rutas, agentes, actualizaciones, alertas) solo una etiqueta «Administración» sin enlace de vuelta | C `feature-flags/page.tsx:56`, `notificaciones/page.tsx:89`, `ia/page.tsx:50`, `etiquetas/page.tsx:19`; sin «Volver»: `rutas/page.tsx:47`, `alertas-telegram/page.tsx:53`, `actualizaciones/page.tsx:50` |
| No hay `layout.tsx` en `admin/`; cada subcarpeta trae el suyo con su guardia | C `ls app/studio/(app)/admin` |

**Respuesta a «por qué se hizo»:** fue un andamio de mayo para un panel que casi no tenía módulos. Nunca se retiró, y
hoy 10 de 27 secciones son un clic de más (**I**, sobre los hechos de arriba).

## 2. Inventario de secciones (27)

**En línea** = la pantalla real aparece a la derecha. **Puente** = tarjeta «Abrir X →». **Marcador** = «Por
implementar». **Atajo** = sección que solo manda a otro módulo.

| Grupo hoy | Sección (`id`) | Hoy | Dónde vive | Guardia de la ruta real |
|---|---|---|---|---|
| BÁSICO | Edición de etiquetas (`shipping-labels`) | **Puente** | `/studio/admin/etiquetas` | `admin` + rol admin |
| BÁSICO | Datos de la empresa (`company`) | En línea | — | `admin` |
| BÁSICO | Casos de uso · ON/OFF (`features`) | **Puente** | `/studio/admin/feature-flags` | `admin` + rol admin |
| BÁSICO | Notificaciones al cliente (`client-notifications`) | **Puente** | `/studio/admin/notificaciones` | `admin` + rol admin |
| BÁSICO | Alertas del equipo (`telegram-alerts`) | **Puente** | `/studio/admin/alertas-telegram` | `admin` |
| BÁSICO | Master data (`masterdata`) | En línea (solo lectura, mapa de catálogos) | — | `admin` |
| BÁSICO | Tasas de cambio (`rates`) | En línea | — | `admin` |
| BÁSICO | Impuestos · IVA/SENIAT (`fiscal`) | **Puente** | `/studio/fiscal` (otro módulo) | `fiscal` |
| BÁSICO | Feriados CN/VE (`holidays`) | En línea | — | `admin` |
| BÁSICO | Apariencia (`appearance`) | En línea (preferencia **por usuario**) | — | `admin` |
| BÁSICO | Administrar rutas (`routes`) | **Puente** | `/studio/admin/rutas` | `admin-rutas` (también `operations`) |
| MARCA | Sistema de marca, Íconos de perfil, Aplicaciones de marca, Publicidad activa, Estudio de Redes (5) | **Marcador** ×5 | — | `admin` |
| INTERMEDIO | Permisos por rol (`permissions`) | **Atajo** a Usuarios (SDD-0274) | `/studio/usuarios?tab=roles` | `users` |
| INTERMEDIO | Audit log (`audit`) | En línea | — | `admin` + `audit_view` |
| INTERMEDIO | Servicios de recepción (`recepcion-addons`) | En línea | — | `admin` |
| INTERMEDIO | Invitaciones al portal (`portal-invites`) | En línea (envía correos reales) | — | `admin` |
| INTERMEDIO | Numeración & legal (`numbering`) | En línea | — | `admin` |
| INTERMEDIO | Documentación legal (`legal-docs`) | En línea (lectura) | también `/studio/legal` | página: `admin`; módulo `legal`: superadministrador |
| INTERMEDIO | Aceptaciones T&C (`acceptances`) | En línea (lectura) | también `/studio/legal` | ídem |
| PRO | API keys & webhooks (`api`) | En línea | — | `admin` |
| PRO | Workflows custom (`workflows`) | **Atajo** al editor de Servicios | `/studio/servicios` | — |
| PRO | Importar / Exportar (`import`) | En línea (solo exporta) | — | `admin` |
| PRO | Calculadora pública (`calculadora`) | En línea | — | `admin` |
| PRO | Agentes y Skills (`agents`) | **Puente** | `/studio/admin/agentes` | `admin` |
| PRO | Actualizaciones de Chatwoot (`chatwoot-updates`) | **Puente** | `/studio/admin/actualizaciones` | `admin` |
| PRO | IA (`ia`) | **Puente** | `/studio/admin/ia` | `admin` + **superadministrador** (si no, 404) |
| — | Oficina Virtual | **No figura en el menú** | `/studio/admin/oficina-virtual` | `admin` + superadministrador |

Fuentes: C `page.tsx:120-364`; guardias C en cada `page.tsx`/`layout.tsx` de las subcarpetas, C `lib/studio/rbac.ts:83`,
`:151`, `:205-210`, C `lib/studio/modules.ts:121`.

**Problemas que salen del inventario**

1. **10 puentes** (las 9 marcadas + el atajo de Permisos): un clic de más cada vez.
2. **5 marcadores de Marca** que no hacen nada y ocupan un grupo entero.
3. **IA aparece a cualquier admin** y le da 404 si no es superadministrador. **Oficina Virtual**, en cambio, no aparece
   en el menú y solo se llega por el aviso de Discord.
4. **Grupos por «nivel»** (Básico / Intermedio / Pro) en vez de por tema: «Numeración & legal» queda lejos de «Datos de
   la empresa»; «Notificaciones al cliente» lejos de «Invitaciones al portal».
5. **Duplicados con el menú principal:** Rutas y ciudades ya está en OPERACIÓN (y la usa `operations`); Impuestos
   vive en Fiscal; Permisos en Usuarios.
6. **Nombres desparejos:** «Audit log», «Master data», «API keys & webhooks», «Workflows custom» en inglés; el `id`
   `telegram-alerts` para algo que ya es Discord (el `id` es plomería, no se ve; se conserva).
7. **Apariencia** es preferencia de cada usuario, no configuración de la empresa (**I**: también cabe en el menú del
   usuario; ver D-4).

## 3. Opciones para quitar el doble clic (D-1)

Ambas opciones cumplen: **un clic en el menú = la pantalla real**. Ninguna cambia permisos ni toca la base.

### Opción A — «Clic directo» (salta al módulo)

El ítem del menú enlaza directo al `href`. La subpágina se abre sola, sin el menú de Administración, con su «← Volver
a Administración» (que se unifica en texto y lugar).

```
 Menú de Administración            clic en «IA»           /studio/admin/ia
┌──────────────────────┐                               ┌──────────────────────────────────┐
│ EMPRESA              │                               │ ← Administración                 │
│  Datos de la empresa │      ───────────────▶         │ IA                               │
│  ...                 │                               │ Gasto del mes · Tope · Cuentas   │
│ IA ▸                 │                               │ [pantalla real, ancho completo]  │
│  IA            ↗     │                               │                                  │
└──────────────────────┘                               └──────────────────────────────────┘
   (el menú se queda atrás; para cambiar de sección hay que volver)
```

- Ícono «↗» en los ítems que salen del panel, para que no sorprenda.
- Costo: bajo (una línea en el menú + redirección + unificar el «Volver»).
- Contra: al entrar a un módulo se pierde el menú; para saltar a otra sección son dos clics (volver + elegir).

### Opción B — «El menú acompaña» (recomendada)

Un `layout.tsx` nuevo en `admin/` pinta el mismo menú lateral alrededor de **todas** las pantallas de
`/studio/admin/*`. El clic va a la ruta real y el menú se queda a la izquierda, con la sección marcada.

```
/studio/admin/ia
┌──────────────────────┬───────────────────────────────────────────────┐
│ EMPRESA              │ IA                                            │
│  Datos de la empresa │ Gasto del mes, tope de la Oficina_Virtual y   │
│  Impuestos ↗         │ lo que cobra cada cuenta de IA.               │
│  ...                 │ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ INTELIGENCIA ARTIF.  │ │ Gasto    │ │ Tope     │ │ Cuentas  │        │
│▌ IA                  │ └──────────┘ └──────────┘ └──────────┘        │
│  Agentes y Skills    │ [pantalla real]                               │
│  Oficina Virtual     │                                               │
└──────────────────────┴───────────────────────────────────────────────┘
   un clic = pantalla real; el menú nunca se va
```

- Las subpáginas pierden su «← Volver a Administración» (ya no hace falta) y su encabezado repetido.
- Lo que vive **fuera** de `/studio/admin` (Impuestos → Fiscal, Permisos → Usuarios, Workflows → Servicios) sigue
  siendo enlace directo con «↗»: sale del panel, pero sin tarjeta intermedia.
- Costo: medio. Toca el menú, un layout nuevo y el encabezado de 8 subpáginas.
- Por qué la recomiendo: es lo que dibuja el Norte (todo dentro del panel) y es lo que Sam describe como esperado.

### Cuidados comunes a A y B (no negociables)

| Riesgo | Cómo se cubre |
|---|---|
| **Permisos.** El layout nuevo de B **no** puede exigir `admin` a todo `/studio/admin/*`: `/studio/admin/rutas` es del módulo `admin-rutas` y lo usa `operations` | El layout de B solo **pinta** el menú si quien entra pasa `admin`; si no, deja la página sola. Cada subcarpeta conserva su guardia actual sin cambios |
| **IA y Oficina Virtual** son solo del superadministrador | El menú las muestra solo si `isPlatformAdmin()`; las rutas conservan su 404 y la base su RLS |
| **Rutas viejas** `/studio/admin?section=<id>` (marcadores, avisos, historial del navegador) | Si la sección tiene `href`, la página responde con `redirect(href)` (temporal, 307). Se conservan los mismos `id`; ninguno se renombra |
| `?section=` desconocido | Igual que hoy: cae en la primera sección |
| Enlaces internos que ya apuntan a `?section=calculadora&tab=…`, `?section=audit&…` | Son secciones en línea: no cambian |

## 4. Reorganización del menú (D-2)

### R1 — Por tema (recomendada)

Seis grupos con nombre de lo que se hace, no de «nivel». Mismo `id` por dentro.

```
EMPRESA
  Datos de la empresa
  Impuestos · IVA/SENIAT        ↗ Fiscal
  Tasas de cambio
  Numeración de documentos      (antes «Numeración & legal»)
  Feriados CN/VE
OPERACIÓN
  Catálogos                     (antes «Master data»)
  Rutas y ciudades              (también en el menú principal; ver D-3)
  Servicios de recepción
  Edición de etiquetas
  Calculadora pública
CLIENTES Y PORTAL
  Notificaciones al cliente
  Invitaciones al portal
  Documentos legales
  Aceptaciones T&C
EQUIPO Y SEGURIDAD
  Permisos por rol              ↗ Usuarios
  Alertas del equipo
  Registro de actividad         (antes «Audit log»)
INTEGRACIONES
  Casos de uso · ON/OFF
  API y webhooks                (antes «API keys & webhooks»)
  Flujos automáticos            ↗ Servicios  (antes «Workflows custom»)
  Importar / Exportar
  Actualizaciones de Chatwoot
INTELIGENCIA ARTIFICIAL         (solo superadministrador; «Agentes» lo ve todo admin)
  IA
  Agentes y Skills
  Oficina Virtual               (nueva entrada; hoy no figura)
```

### R2 — Mínima

Se quedan los grupos Básico / Intermedio / Pro y el orden actual. Solo: quitar los 5 marcadores de Marca, esconder IA a
quien no es superadministrador, sumar Oficina Virtual en Pro y traducir los cuatro nombres en inglés.

### Qué pasa con MARCA y Apariencia (D-4)

- **Marca (5 marcadores):** **M-a** quitarlos del menú hasta que exista una pantalla real (recomendada; las rutas
  `?section=brand-*` caen en la primera sección); **M-b** dejarlos agrupados en un solo ítem «Marca (próximamente)».
- **Apariencia:** **P-a** se queda en Administración, grupo Equipo y seguridad (recomendada, sin mudanza); **P-b** se
  muda al menú del usuario (arriba a la derecha) y en Admin queda como atajo.

## 5. Alcance y allowlist (para la fase de código, después de que Sam elija)

**Fase 1 — quitar el doble clic (D-1) + orden del menú (D-2, D-4).** Una PR.

| Archivo | Cambio | A | B |
|---|---|---|---|
| `app/studio/(app)/admin/page.tsx` | Catálogo de secciones (grupos, nombres, orden), redirección `?section=` con `href`, retirar `LinkedSectionCTA`, filtro de IA/Oficina por superadministrador | ✓ | ✓ |
| `app/studio/(app)/admin/_components/AdminNav.tsx` (nuevo) | El menú lateral sale de `page.tsx` a un componente reutilizable; enlace directo al `href`, marca activa por ruta | ✓ | ✓ |
| `app/studio/(app)/admin/_components/admin-sections.ts` (nuevo) | Catálogo de secciones como dato puro, compartido por página, layout y pruebas | ✓ | ✓ |
| `app/studio/(app)/admin/layout.tsx` (nuevo) | Pinta el menú alrededor de `/studio/admin/*` solo para quien pasa `admin`; **no** agrega guardias | — | ✓ |
| `app/studio/(app)/admin/{etiquetas,feature-flags,notificaciones,ia,oficina-virtual}/page.tsx` | A: unificar el «← Administración». B: quitar el «Volver» (las demás subpáginas no tenían) | ✓ | ✓ |
| `app/studio/(app)/admin/_components/WorkflowsSection.tsx` (se borra) | Era un atajo a Servicios · Flujo con su propio botón «Abrir»; ahora el ítem «Flujos automáticos» enlaza directo (↗). También se retira el atajo en línea de Permisos | ✓ | ✓ |
| `app/studio/(app)/admin/__tests__/admin-sections.test.ts` (nuevo) | Pruebas de §7 | ✓ | ✓ |

**Fuera de la allowlist:** migraciones, RLS, `lib/studio/rbac*.ts`, `lib/studio/modules.ts` (el menú principal no
cambia en esta fase), las pantallas internas de cada módulo, el contenido de las secciones en línea.

**Carril:** revisión previa (toca la navegación de un área con guardias de permisos, aunque no las cambie).

## 6. Decisiones de Sam

**Elegido (2026-11-22, textual):** «Elijo B (el menú acompaña) y el menú ordenado por tema (R1).» D-3 y D-4 no se
nombraron: la fase 1 aplica las recomendaciones (Rutas y ciudades en los dos menús; M-a, los marcadores de Marca salen
del menú; P-a, Apariencia se queda en Equipo y seguridad). Si Sam cambia alguna, es un ajuste del catálogo.

Sam aclaró además que la «pantalla de guía» que mencionó es la de IA (SDD-0704). En esta spec entra solo su acceso:
un clic, grupo Inteligencia artificial y visible solo al superadministrador. Su contenido sigue en la 0704.

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| **D-1** | ¿Cómo se entra a una sección con módulo propio? | **A** clic directo (sale del panel) · **B** el menú acompaña | **B** |
| **D-2** | ¿Cómo se ordena el menú? | **R1** por tema (6 grupos) · **R2** mínima (grupos actuales) | **R1** |
| **D-3** | Rutas y ciudades está en OPERACIÓN y en Administración | **Ambas** (como hoy) · **solo OPERACIÓN** | **Ambas** (operations no entra a Admin; el admin la busca aquí) |
| **D-4** | Marca y Apariencia | **M-a / M-b** · **P-a / P-b** | **M-a**, **P-a** |

## 7. Aceptación (fase 1)

1. Para cada sección con `href`, el ítem del menú enlaza al `href` (prueba sobre el catálogo: ninguna sección con
   `href` se pinta con tarjeta; `LinkedSectionCTA` ya no existe).
2. `/studio/admin?section=<id>` con `href` responde 307 a ese `href` (los 9 puentes de §2 más los atajos `permissions`
   y `workflows`, que con la fase 1 también enlazan directo).
3. Un admin que no es superadministrador no ve IA ni Oficina Virtual en el menú, y sus rutas siguen dando 404.
4. Un usuario `operations` entra a `/studio/admin/rutas` igual que hoy (sin menú de Admin, sin redirección).
5. Ningún `id` de sección cambia; los enlaces existentes con `?section=…&tab=…` siguen abriendo lo mismo.
6. (Solo B) Las subpáginas de `/studio/admin/*` muestran el menú con su ítem marcado y sin «← Volver».
7. `/ui-check` sobre el diff y capturas claro/oscuro de: Administración (sección en línea), IA, Rutas y ciudades.
8. `pnpm verify` con turno del Director.

## 8. Fuera de alcance

- Pantallas reales de Marca, Importar (carga masiva) y Flujos automáticos a nivel empresa: specs propias.
- Mover Apariencia al menú del usuario si Sam elige P-b: va como fase 2 o spec aparte.
- La visibilidad de las secciones legales dentro de Administración frente al módulo `legal`: el Director lo recibe
  por separado.
