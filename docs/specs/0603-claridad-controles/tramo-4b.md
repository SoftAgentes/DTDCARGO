# SDD-0603 · Tramo 4b · Avisos de Plataforma en `Aviso`

Parte de [SDD-0603](spec.md) y primera adopción del componente `Aviso` de SDD-0628. Aplica BD-037 a los avisos del grupo **Plataforma**: lo que avisa es una franja plana con icono y sin contorno. Las cajas de aviso hechas a mano pasan a `<Aviso>`, con el tono que dice BRAND §Estados.

Rama `claude/0603-t4b-plataforma-0af1d7`, desde `claude/tren-ae` `4441f65ac`, el tren #540 de la ola 1, que trae `Aviso`. Tramos hermanos de la ola 2, con allowlists que no se cruzan: T4c Finanzas y T4d Operación.

## Allowlist

Los 62 archivos de la lista `rebrand-0603-allowlist-t4b-4441f65ac.txt` del Subdirector Rebrand. Es el inventario del grupo, sin los archivos de PRs abiertas: StudioTopbar y UserDetailDrawer (#509), ExchangeRatesSection (#527), legal/evidencia y mis-bugs (#515), ErrorAlert (#536). Más:

- `app/studio/(app)/debug/__tests__/NorteTab.test.tsx` y `RadarTab.test.tsx`, ajustadas (ver Pruebas).
- `docs/specs/0603-claridad-controles/tramo-4b.md` (este documento) y `.agents/handoffs/0603-t4b-plataforma.md`.

Sin cambios en `studio.css`, `tokens.css`, `Aviso.tsx`, `ErrorAlert.tsx`, los `spec.md` de 0603 y 0628, el registro de componentes ni `docs/specs/README.md`. Sin colores, tokens, rutas, acciones de servidor, permisos, migraciones ni dependencias nuevas. **Los textos visibles no cambian**, incluidos los que tienen voseo (ver Fuera de alcance).

## Medición

Sobre `4441f65ac`, en los 62 archivos. Se buscaron `--danger-bg`, `--warning-bg`, `--success-bg`, `--info-bg`, `var(--danger|warning|success)`, `role="alert"`, `role="status"` y `ErrorAlert`, y cada aparición se leyó en su contexto con el criterio de la 0628 (§Adopción posterior, Criterio).

| Resultado | Archivos |
|---|---|
| Con al menos un aviso adoptado | **43** |
| No aplica: sin aviso real o excepción | **19** |
| Avisos reemplazados por `<Aviso>` | **77** |

Tonos de los 77: `error` 42, `atencion` 12, `exito` 9, `info` 9 y 5 con tono calculado (ver Decisiones de tono).

Diff de producto, en 43 archivos: 391 líneas agregadas y 1.063 quitadas. El estilo en línea de cada caja se va y lo pone `.studio-aviso`.

## Qué cambia

### Patrón

- Caja con fondo o borde de estado, o `<p>`/`<div>` de error de formulario con `role="alert"` → `<Aviso tono=… >`, con `compacto` en drawers, modales y formularios densos (lo que antes iba a 11-12,5 px).
- El margen exterior que tenía la caja pasa a un `<div>` envoltorio con solo `marginTop` o `marginBottom`: es diseño, no color. `Aviso` no recibe `style`.
- Los iconos hechos a mano dentro de la caja (`Icon.info`, `Icon.warn`, `Icon.shield`, puntos de color) se quitan: el icono lo pone `Aviso`.
- `<strong style={{ color: "var(--ink)" }}>` dentro de un aviso queda como `<strong>`: el texto de la franja ya es `--ink`.
- Los respaldos con hex en línea de las cajas reemplazadas (`var(--success, #1F8A5B)`, `rgba(184,137,58,0.10)`) desaparecen con ellas.

### Alcance real de dos helpers compartidos

`FormError` de `academia/_components/Field.tsx` y de `club/_components/Field.tsx` está en la allowlist, pero lo pintan otros drawers que no se editan: Cohort, Course, Enrollment, Lesson y Module en Academia; ClubEvent, ClubMember, EventRegistration, FeaturedSupplier, GroupBuy y Participant en Club. Esos 11 drawers muestran su error con `Aviso` sin cambiar una línea propia, como pasó con los consumidores de `ErrorAlert` en la 0628.

### Roles

- `error` → `role="alert"`; `info`, `atencion` y `exito` → `role="status"`, como manda `rolDeAviso`.
- Bajan a `status` los avisos que no son error. Ejemplos: el de feriados CN (era `role="note"`) y el aviso de correos saturados del portal, que se queda en `alert` con `urgente` porque pide revisar antes de reenviar.
- Varias cajas de error no tenían rol: los `FormError` de los drawers de admin, el error de CompanySection, Numbering y CityDrawer de rutas, y los errores de BugDrawer y ProfileModal. Ahora lo anuncian con `role="alert"`.

### Foco en el error (BulkPriceDrawer, CityDrawer de calculadora, TariffDrawer)

Estos tres drawers mueven el foco al error al fallar el guardado, y las pruebas lo vigilan (`CityDrawer.test.tsx`, `TransportistasPanel.test.tsx`). `Aviso` no recibe `ref` ni `tabIndex`, y `Aviso.tsx` está fuera de la allowlist. El `ref` pasa a un `<div>` envoltorio y una función local, `enfocarAviso`, busca la franja (`[role="alert"]`), le pone `tabIndex = -1` y la enfoca. El foco queda en el elemento con el rol, como antes. **Propuesta para un tramo con `Aviso.tsx` en la allowlist:** aceptar `ref` y `tabIndex` en `Aviso`, y borrar las tres copias de `enfocarAviso`.

### Decisiones de tono

Según BRAND §Estados, no según el color que tenía la caja:

| Aviso | Antes | Ahora | Por qué |
|---|---|---|---|
| Token de API recién creado («Copia este token ahora…») | verde | `atencion` | Pide actuar ya: no se vuelve a mostrar. **El token y sus botones van debajo y fuera de la franja**: el aviso es `role="status"` y el lector de pantalla no debe leer en voz alta un secreto efímero (ajuste del DG). Lo fija `ApiIntegrationSection.test.tsx`, con un mutante que mete el token en la franja y la hace fallar. El bloque del token pasa a `--bg-elevated` para separarse de la tarjeta. |
| Resultado de invitaciones del portal | verde con borde | `exito`, o `atencion` si hubo fallas, correos fallidos o pendientes | El resultado mixto no es un éxito. |
| Banner de modo de Debug, Norte y Radar | verde, ámbar o gris | `info`; `atencion` en snapshot o web | Informar que algo es local no es éxito ni riesgo. |
| Gate DDP de Legal | verde o ámbar | `exito` con bloqueo duro, `atencion` en advisory | Igual que antes: el bloqueo activo es el estado deseado. |
| Requisitos de contraseña (ProfileModal) | ámbar | `info` | Es una regla, no un riesgo. |
| Ciudades con venta bajo costo (BulkPriceDrawer) | rojo | `atencion` | Advertencia previa: todavía no hay error. |
| Catálogo de ciudades vacío (Rutas) | azul con borde | `info` con título | El botón «Seedear desde catálogo VE» queda dentro, bajo el texto. |

## No aplica (19 archivos)

| Archivo | Por qué |
|---|---|
| `admin/_components/PermissionsSection.tsx` | Leyenda y celdas V/V·E de la matriz: estado, no aviso. |
| `admin/agentes/_components/AgentRowActions.tsx` | Error en línea dentro de la fila, junto a sus botones; una franja rompería la fila. |
| `bugs/_components/BugKanban.tsx`, `BugStats.tsx`, `BugTable.tsx` | Mapas de tonos para pastillas de severidad y estado. |
| `bugs/_components/BugsAdminClient.tsx` | El bloque ámbar es un **botón** («bugs sin revisar»): lo que se pulsa no es aviso. Ver Fuera de alcance. |
| `calendario/_components/MonthView.tsx`, `WeekView.tsx` | Chips de feriados dentro de las celdas del calendario. |
| `debug/_components/EstadoTab.tsx` | Tarjeta de entorno teñida por tono, chips de variables y estados de salud: lectura. |
| `debug/_components/PublicacionesServidor.tsx` | «Sin datos» es `Badge` más texto; las tarjetas de publicación son lectura. |
| `(app)/error.tsx` | Pantalla de error del límite de errores: superficie neutra, título y acciones, sin color de estado. Es un estado de página, no una franja. |
| `legal/expediente/[code]/page.tsx` | Pastillas de evidencia presente o ausente, sello de hash y variables de impresión. |
| `mis-bugs/_components/BugCard.tsx` | Mapa de tonos de pastillas. |
| `usuarios/_components/InvitationsTable.tsx` | Mapa de tonos y error en línea de la fila (revocar). |
| `(auth)/login/LoginForm.tsx`, `(auth)/login/recuperar/RecoveryForm.tsx` | **Excepción.** La pantalla de acceso usa una paleta oscura fija (rgba y hex propios, `studio-input-dark`) que no sigue el tema. `Aviso` sí lo sigue: con el tema claro elegido pintaría una franja clara sobre el panel oscuro. Adoptarlo pide antes llevar la pantalla de acceso a los tokens, que es otro tramo. |
| `_components/ui/Avatar.tsx` | Colores de avatar. |
| `_components/ui/ToastProvider.tsx` | Toasts: AVS-01, fuera del criterio de la 0628. |
| `_components/wiring/OAuthFlowModal.tsx` | Ilustración del paso «Conectado correctamente» (círculo con ✓): estado de pantalla, no franja. |

Dentro de los archivos adoptados también quedan sin tocar, a propósito: los mensajes de campo bajo un input (`FieldError`, `fieldErrors.*`, ERR-01 «Campo»), las pastillas (`demo?`, tipo de ruta, número de parada), el margen en vivo de TariffDrawer (`role="status"` de lectura), el estado de «mantener para confirmar» de ConfirmDialog, la tarjeta «Pendiente de revisión legal» (panel de contenido con lista), los errores en línea de las filas del portal y el acuse en vivo «ID guardado» de ProfileModal.

## Pruebas

- `debug/__tests__/NorteTab.test.tsx` y `RadarTab.test.tsx`: el `data-norte-mode` y el `data-radar-mode` pasan al envoltorio, porque `Aviso` no recibe atributos `data-*`. La prueba busca la franja por su rol, como antes, y lee el modo con `closest(...)`. **Se endurece:** ahora también exige `data-tono="atencion"` en web y `"info"` en local. Ninguna aserción se quitó.
- Pruebas vecinas que siguen sin cambios y vigilan lo convertido: `CityDrawer.test.tsx` y `TransportistasPanel.test.tsx` (foco en el error), `DebugTabs.test.tsx` (banner `status` con «Modo vivo»), `DiscordChannelsStatus.test.tsx`, `ActualizacionesPanel.test.tsx`, `CommentsThread.test.tsx`, `PortalBackfillSection.test.tsx`, `AttachmentUploader.test.tsx`, `GuiaMotor.test.tsx`, `GenerateBLModal.test.tsx`, `ConfirmDialog.test.tsx` y `pantallas-muestran-la-denegacion.test.tsx`.
- **Contrato que se destapó:** `dark-theme-contrast-contract.test.ts` busca hacia arriba el fondo más cercano a cada uso de la tinta invertida. En `PortalBackfillSection.tsx`, el `Chip` de filtro activo pintaba esa tinta sobre `--wine`, y en oscuro la tinta se vuelve navy. La caja de resultado que este tramo quitó tenía un `background` neutro que tapaba la violación. Se corrige con `--ink-side-strong`, que es blanco en los dos temas: el mismo token del botón primario sobre vino. No es un color nuevo.
- **Mutante:** quitar `franja.tabIndex = -1` de `enfocarAviso` en CityDrawer y TariffDrawer hace caer 4 pruebas (`CityDrawer.test.tsx` y `TransportistasPanel.test.tsx`).
- Resultados completos: en el handoff.

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: ningún primario nuevo. El botón «Seedear desde catálogo VE» ya era primario. |
| Semántica de color | Cumple: el tono sale de BRAND §Estados (tabla de arriba), no del color anterior. |
| Contraste | Cumple por herencia: texto `--ink` sobre la franja de cada tono, ≥4,5:1 en claro y oscuro, e icono ≥3:1. Lo mide `avisos-contract.test.ts` sobre los tokens. Antes había texto `--danger` o `--warning` sobre su franja, que en oscuro no siempre pasaba. |
| Tokens | Cumple: cero colores nuevos; se quitan colores en línea. |
| Estados sin color | Cumple: forma de icono distinta por tono, más el mensaje. |
| Light/dark | Cumple en contrato. Falta verlo en pantalla: ver Límites. |
| Tamaño pulsable | Sin cambios: no se agregó nada pulsable. Los botones que quedaron dentro de un aviso (Copiar, Ya lo copié, Seedear) conservan sus clases `studio-btn*` (≥32 px). |
| Movimiento reducido | No aplica: el aviso no anima. |

## Límites

- **No se vio en pantalla.** La 0628 deja la revisión en navegador para la primera adopción, que es esta. El Studio pide sesión y datos, y la imagen de prueba no está autorizada en este encargo. Queda para la revisión visual del tren: claro, oscuro, compacto y 375 px, al menos en Admin › Integración API, Admin › Portal (invitaciones), Debug › Norte y Calendario.
- jsdom no calcula estilos: el contraste se mide sobre tokens, no sobre píxeles.
- El texto de los avisos pasa a 14 px (13 px en `compacto`). Muchos iban a 11-12,5 px: el bloque se ve más grande en drawers densos.

## Fuera de alcance detectado

- **Voseo en textos visibles** que este tramo no cambia, porque los textos no se tocan: «corré de nuevo» (PortalBackfillSection), «Regeneralo» (NorteTab), «regenerá» (RadarTab), «Habilitalas» (ProfileModal).
- `BugsAdminClient.tsx`: botón ámbar con `onMouseEnter`/`onMouseLeave` que pinta estilo en línea y respaldos hex. Es un control: le toca a un tramo de controles, no de avisos.
- Pantalla de acceso (`LoginForm`, `RecoveryForm`): paleta propia fuera de tokens; ver No aplica.
- `Aviso` sin `ref`, `tabIndex` ni `data-*`: obliga a envoltorios (foco y modo de Debug). Propuesta arriba.
