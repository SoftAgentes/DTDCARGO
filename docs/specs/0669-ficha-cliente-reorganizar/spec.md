---
sdd: "0669"
title: "Ficha del cliente: reorganizar la presentación"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0049", "0131", "0151", "0258", "0507", "0531", "0558", "0650", "0664"]
confidencialidad: interno
---

# DTD-0669 — Ficha del cliente: reorganizar la presentación

> La ficha del cliente en el Studio (`/studio/clientes/<código>`) se lee de arriba abajo en una columna larguísima. Esta SDD la reparte en una franja fija y pestañas, con un solo bloque de documentos y las conversaciones siempre a la derecha. Es solo presentación: no lee datos nuevos, no cambia permisos ni la base y no tiene migración.

## 1. Pedido

Sam, 2026-11-18, en la reunión con la oficina: «Sí, pásalo». Lo trae el Director General a la sesión Worker de la Ficha 360° (SDD-0650). La sesión de la reunión miró la ficha a 1440 px y anotó lo de §2.

## 2. Lo que hay (medido en `main` `9434cc4f6`)

| Hecho | Fuente | Etiqueta |
|---|---|---|
| A 1440 px la ficha mide ≈ 2.470 px de alto. La columna izquierda junta datos, notas, perfil, acceso al portal, asesor, direcciones, identidad, facturación y «Documentos · hub» (que empieza ≈ y=1.900) | Observación de la sesión de la reunión | Medido |
| La columna del medio (historial de envíos, aliado, «Todos los adjuntos») termina ≈ y=1.500 y deja espacio vacío | Observación de la sesión de la reunión | Medido |
| La rejilla es de tres columnas (datos · operación · conversaciones) que pasan a dos a ≤ 1440 px y a una a menos: «Conversaciones en la Bandeja» está arriba a la derecha a 1512 px y abajo, a todo el ancho, a 1440 px | `app/studio/studio.css` (`.studio-ficha-grid`, reglas `max-width: 1440px`) | Código |
| Los documentos salen dos veces: «Documentos · hub» (los de la ficha, con subir, versiones y borrar) y «Todos los adjuntos» (los de la ficha **y** los de sus embarques, solo para ver) | `page.tsx` (`DocsPanel` y `TodosLosAdjuntos`); `lib/studio/documents/adjuntos-queries.ts` (`listarAdjuntosDelCliente` incluye `ficha`) | Código |
| El formulario de subir documento está siempre abierto | `app/studio/_components/documents/DocsPanel.tsx` (el `<form>` se pinta siempre) | Código |
| Las notas de la ficha (donde la oficina deja avisos como «PENDIENTE: asignar cliente») van dentro de «Datos del cliente», abajo a la izquierda | `page.tsx`, bloque `client.notes` | Código |
| La cabecera ya trae el Shipping Mark con sus códigos anteriores a la vista (0664), nombre o «Sin nombre», tipo, nivel, adjuntos y las acciones rápidas; debajo, los cuatro indicadores de la cuenta (0558) | `page.tsx`; `ShippingMarkChip.tsx`; `ClientAccountHeader` | Código |
| El Studio ya tiene pestañas con su estilo: `.studio-tabs`, `.studio-tab[data-activa]` y el contador `.studio-tab-n`; la selección va en tinta, no en vino | `app/studio/studio.css`; `docs/design/studio/_norte/BRAND-DECISIONS.md` (decisión de selección y su excepción, revisada por Sam el 2026-11-15) | Código y norma |

## 3. Diseño

### 3.1 Maqueta (≥ 1280 px)

```
← Volver al listado
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ FRANJA FIJA (sticky bajo la barra del Studio)                                        │
│ [DTD-0000 ▾] Antes: DTD-Z000   Cliente de prueba          Persona · Nivel  Asesor: … │
│                                         [Abrir chat] [Cotizaciones] [Estado] [Editar]│
└──────────────────────────────────────────────────────────────────────────────────────┘
 Saldo  —        Vencido  —        Último pago  —        En curso  —   (cabecera de la 0558)
 AVISOS (franjas planas, solo si hay)
 ▌ Solicitud de cambio de datos pendiente …                         [Revisar]
 ▌ Nota: PENDIENTE: asignar cliente …                                [Ver nota]

 [ Resumen ] [ Envíos 12 ] [ Documentos 7 ] [ Configuración ]  ┌ Conversaciones ──────┐
 ─────────────────────────────────────────────────────────────  │ (panel F2 o tarjeta  │
 Resumen                                                        │  F1; sticky; 360 px) │
 ┌ Datos del cliente ──────────┐ ┌ Perfil del cliente ───────┐  │                      │
 │ Tipo · Contacto · Email     │ │ ▓▓▓▓▓░░░ 5/8              │  │                      │
 │ Teléfono · Dirección · RIF  │ │ ✓ … / Falta …             │  │                      │
 │ Creado …                    │ └───────────────────────────┘  │                      │
 └─────────────────────────────┘                                │                      │
 ┌ Últimos envíos (5 de 12) ──────────────────── Ver todos → ┐  │                      │
 │ Código · Origen → Destino · Servicio · Fecha              │  │                      │
 └───────────────────────────────────────────────────────────┘  └──────────────────────┘
```

La captura con la ficha comodín (`DTD-0000`) o datos de prueba va a `assets/` al implementar; nunca con una ficha real (el repo es público).

### 3.2 Zonas

| Zona | Contenido | De dónde sale hoy |
|---|---|---|
| Franja fija | Shipping Mark con sus códigos anteriores (sin cambios: es de la 0664), nombre o «Sin nombre», tipo, nivel, **asesor asignado** (solo el nombre; se cambia en Configuración), acciones rápidas. Debajo, sin fijar, la cabecera de cuenta de la 0558 tal cual (sus tarjetas de 260 px no caben en una línea compacta sin rehacerla) | Cabecera de `page.tsx`, `ClientDetailClient`, `ClientAccountHeader`, `AdvisorAssignCard` (el nombre) |
| Avisos | Franjas planas (`Aviso`), arriba de las pestañas y a la vista en todas: la solicitud de cambio pendiente (0151), **las notas de la ficha** (dos líneas y «Ver nota completa» si es larga). El perfil incompleto sigue en su tarjeta del Resumen, que se ve al abrir. Sin avisos, la zona no ocupa nada | `ChangeRequestCard`, `client.notes` |
| Resumen | Datos del cliente, perfil del cliente y los últimos 5 envíos con «Ver todos» a la pestaña Envíos | Las mismas tarjetas de hoy |
| Envíos (N) | El historial de envíos completo de todos los códigos de la ficha (0650 F1), sin cambios | Sección «Historial de envíos» |
| Documentos (N) | **Un solo bloque**: arriba los de la ficha, con sus acciones de hoy (abrir, versiones, borrar) y el botón «Subir documento» que despliega el formulario; debajo, los de sus embarques agrupados por embarque, sin repetir los de la ficha | `DocsPanel` (formulario plegado) y `TodosLosAdjuntos` sin el grupo de la ficha |
| Configuración | Acceso al portal, asesor, aliado white-label, direcciones de entrega, verificación de identidad, datos de facturación e historial de solicitudes de cambio | `PortalAccessCard`, `AdvisorAssignCard`, `AliadoCard`, `DeliveryAddressesCard`, `IdentityVerificationCard`, `ClientBillingCard`, `ChangeRequestHistory` |
| Conversaciones (columna derecha) | El panel de la F2 o, apagado o sin uniones, la tarjeta de la F1; a la derecha en todas las pestañas, fija al bajar | `PanelConversacionesFicha` |

### 3.3 Comportamiento

1. **Pestañas.** Las del Studio (`.studio-tabs`, `role="tablist"`, flechas para moverse, `aria-controls`). La activa va en la URL (`?pestana=envios`): se puede enlazar, recargar y volver. Por defecto, Resumen. Cambiar de pestaña no recarga la página: el servidor pinta todas y las inactivas van con `hidden`.
2. **Conversaciones.** Con acceso a la Bandeja: columna de 360 px a la derecha desde 1024 px, fija al bajar. Por debajo de 1024 px va debajo de las pestañas, a todo el ancho (pintarla dentro de Resumen la leería dos veces de Chatwoot). Sin Bandeja no hay columna y las pestañas toman todo el ancho. Con la F2 apagada por su interruptor, la columna muestra la tarjeta de la F1, como hoy.
3. **El salto «N adjuntos · ver todos»** de la cabecera lleva a `?pestana=documentos`.
4. **Franja fija.** `position: sticky` bajo la barra del Studio. En pantallas de menos de 700 px de alto no es fija (no se come la pantalla).
5. **Móvil (< 768 px).** Las pestañas se desplazan en horizontal; la franja queda en dos líneas y los indicadores en una rejilla de 2 × 2.

### 3.4 Lo que no cambia

- Ningún dato nuevo: la página lee lo mismo, con las mismas condiciones. Nada de base, RLS, migraciones ni acciones del servidor.
- Los textos y el contenido de cada tarjeta. Solo cambia dónde van, salvo el formulario de documentos plegado, la nota con «Ver nota» y el perfil compacto en Avisos.
- `ShippingMarkChip` y lo del código anterior (0664): se mueve de sitio sin tocar su contenido ni sus props.
- El panel de conversaciones de la F2 y su interruptor.

## 4. Permisos y privacidad (invariantes)

1. **Reorganizar no muestra a un rol nada que hoy no ve.** Cada tarjeta conserva su condición actual: el saldo (`puedeVerSaldoCliente`), el estado de cuenta (`puedeVerEstadoDeCuenta`), la facturación (RLS de la 0466), la identidad (`showIdentityCard`), las conversaciones (Bandeja y su flag), el texto del chat (`readCanSeeClientNames`, 0531) y la edición (`canEditModule(..., "clients")`).
2. **Las cuatro pestañas tienen contenido para todo el que abre la ficha** (Configuración siempre lleva portal, asesor y direcciones), así que se arman las cuatro. Los contadores son los de envíos y adjuntos que la ficha ya mostraba. Si un día una pestaña quedara vacía para un rol, no se arma, y la URL no la puede abrir (`pestanaDeLaFicha`).
3. **El asesor en la franja** es el mismo nombre que hoy enseña `AdvisorAssignCard` a quien abre la ficha; no se lee nada más.
4. **La nota en Avisos** es la misma nota que hoy se ve en «Datos del cliente».
5. Las pruebas comparan, por rol, que el conjunto de tarjetas pintadas es el mismo antes y después.

## 5. Coordinación

- **SDD-0664 (Tracking en vivo):** fusionada (#677). Su Fase 3 no toca la ficha. Esta SDD mueve `ShippingMarkChip` de sitio sin cambiar su contenido; esa sesión está de acuerdo y esta entra primero (2026-11-18). Lo que la 0664 tocará después, sin fecha: el contenido de `ShippingMarkChip.tsx` (no sus props ni dónde se monta), `listMarkboxHistory` (mismo tipo, menos filas), `client-codigo-viejo.ts` y una prueba de la redirección en `page.tsx`. No toca la franja ni las pestañas; avisará antes de abrir rama y traerá main con esta SDD.
- **SDD-0650 F2:** la columna de conversaciones es la de la F2; con su interruptor apagado se ve la tarjeta de la F1.

## 6. Archivos previstos

| Archivo | Cambio |
|---|---|
| `app/studio/(app)/clientes/[markbox]/page.tsx` | Arma la franja, los avisos, las cuatro pestañas y la columna. No lee `?pestana=`: lo lee `FichaPestanas` en el cliente con `useSearchParams` |
| `app/studio/(app)/clientes/_components/FichaPestanas.tsx` (nuevo) | Pestañas del lado del cliente: estado en la URL, teclado, `hidden` |
| `app/studio/(app)/clientes/_components/NotaDeLaFicha.tsx` (nuevo) | La nota como franja plana (`Aviso`), plegable |
| `app/studio/(app)/clientes/_components/ClientDetailClient.tsx` | Prop `encabezado`: identidad y acciones forman la franja fija |
| `lib/studio/ficha-cliente.ts` | `pestanaDeLaFicha`: la URL solo elige entre las pestañas del rol |
| `app/studio/_components/documents/DocsPanel.tsx` | Prop opcional para plegar el formulario tras «Subir documento»; por defecto, igual que hoy (lo usan otras pantallas) |
| `app/studio/(app)/clientes/_components/TodosLosAdjuntos.tsx` | Prop opcional para omitir el grupo de la ficha |
| `app/studio/studio.css` | La rejilla nueva (contenido + columna) en lugar de `.studio-ficha-grid` de tres columnas; franja fija |
| Pruebas: `ficha-cliente-page.test.tsx` y nuevas de pestañas, avisos y permisos por rol | — |

## 7. Aceptación

- [ ] A 1440 px y a 1512 px, la ficha cabe en la franja, los avisos y una pestaña; conversaciones a la derecha en los dos anchos.
- [ ] Un solo bloque de documentos; el formulario se abre con «Subir documento»; ningún documento aparece dos veces.
- [ ] Las notas se ven arriba, en todas las pestañas.
- [ ] La pestaña activa está en la URL; flechas y Tab funcionan; foco visible.
- [ ] Por rol (Admin, Comercial, Operaciones, Contabilidad, Soporte, región China sin nombres), las tarjetas pintadas son las mismas que antes.
- [ ] Sin Bandeja, sin columna; con la F2 apagada, la tarjeta de la F1.
- [ ] `/ui-check` sobre lo tocado; captura con datos de prueba en `assets/`.
- [ ] `pnpm verify` en verde (con turno).

## 8. Preguntas abiertas (para el Director o Sam)

1. **Pestaña «Conversaciones».** La propuesta de la reunión trae pestaña y además columna a la derecha. Esta SDD deja solo la columna (siempre a la vista, que es lo que pidió Sam en la 0650) y no repite el panel en una pestaña. ¿Se acepta?
2. **Asesor en la franja.** Solo el nombre; cambiarlo sigue en Configuración. ¿O un menú para cambiarlo desde la franja?

## 9. Reparación de navegación (2026-11-24)

Allowlist exacta de esta reparación:

- `app/studio/(app)/clientes/_components/FichaPestanas.tsx`
- `app/studio/(app)/clientes/__tests__/ficha-pestanas.test.tsx`
- `docs/specs/0669-ficha-cliente-reorganizar/spec.md`
- `.agents/handoffs/sdd-0669-pestanas-ficha-20261124.md`

La API nativa recibe estado externo `null`: Next copia su árbol interno y
sincroniza `useSearchParams`. Reenviar `history.state` con `__NA` o `_N` evita
esa sincronización: la URL cambia pero el panel permanece. Referencia:
[Native History API de Next](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api).

La regresión usa una suscripción reactiva al contrato de History de Next,
sin `rerender` manual, y parte de `history.state.__NA=true`. Verifica los cuatro
paneles, teclado, acceso rápido con foco, parámetros y hash conservados,
estado de los paneles montados y filtro de permisos. Remontar desde la URL
comprueba la selección inicial; no representa una recarga observada en navegador.

A11Y-01 y BTN-01: se conservan controles nativos, roles, asociación tab/panel,
foco y orden de Tab. No cambia el contenido de las tarjetas ni sus permisos.
La comprobación local es focal con turno; la verificación global se delega
al CI de la PR por indicación del Director. Evidencia y límites en el handoff.
