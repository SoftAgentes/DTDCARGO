# SDD-0603 · Tramo 4e · Avisos del portal del cliente

Parte de [SDD-0603](spec.md) y de BD-037. Extensión al portal de [SDD-0628](../0628-aviso-studio/spec.md), sin número nuevo. Rama `claude/0603-t4e-portal-avisos-dd68a3`, desde `origin/main` `da8d123ee`, con la ola 1 (T3 #537, T4a #536, T5a #535) ya integrada.

El tramo 3 dejó planos los avisos del portal que traían cajón con la clase `border`. Quedaban los que pintan a mano su fondo o su borde de estado con estilo en línea (`borderLeftColor: var(--color-status-warning)`, `background: var(--color-status-success)`, fondo y borde vino). Este tramo los pasa a la misma franja que `Aviso` del Studio.

## Decisión

El portal no puede importar del Studio. En vez de un componente nuevo (que habría que registrar en CMP-01), una **clase del portal** en `app/portal/claridad.css`, bloque «2b · Franja de aviso del portal», que reproduce la franja de `Aviso` con los tokens `--color-*` del portal:

```tsx
<div className="portal-aviso rounded-[16px] p-5" data-tono="atencion">
  <span className="portal-aviso-icono">
    <StatusIcon tone="warning" size={16} />
  </span>
  <div className="portal-aviso-cuerpo">…el contenido de siempre…</div>
</div>
```

`StatusIcon` vive en `components/` (compartido) y el portal ya lo usaba. Ningún componente nuevo, ningún registro CMP.

| Tono | Fondo | Icono (forma) | Color del icono | Texto |
|---|---|---|---|---|
| `info` | `--color-grey-100` | círculo con «i» | `--color-ink` | `--color-ink` / `--color-grey-700` |
| `atencion` | `--color-status-warning` al 14 % sobre `--color-grey-100` | triángulo con «!» | claro: `--color-ink` · oscuro: `--color-status-warning` | igual |
| `exito` | `--color-grey-100` | círculo con visto | `--color-status-success` | igual |
| `error` | `--color-grey-100` | círculo con equis | `--color-status-danger` | igual |

- Franja plana: `border: 0`, `box-shadow: none`. El radio y el relleno los conserva cada pantalla con sus clases.
- **Cero colores nuevos.** El tinte dorado de atención es el `--color-status-warning` existente mezclado con la franja (`color-mix`), el mismo recurso que ya usa el portal para teñir; no hay token ni hex nuevo. Es lo que pide BRAND §Estados («acento dorado, texto neutro») y lo que hace `--warning-bg` en el Studio.
- **Atención en claro.** El dorado (#B8893A) mide 2,76:1 sobre la franja gris: no llega al 3:1 de un icono. Como en el Studio, en claro el icono va en tinta y el dorado queda en el fondo; en oscuro (`[data-portal-theme="dark"]`) vuelve al icono. A diferencia del Studio, la excepción oscura no va bajo `@media screen`: el contrato del tramo 3 exige que todo selector de la hoja empiece por `.portal-sys` y ese archivo está fuera de esta allowlist.
- El selector del tramo 3 (`[role=…][class*="border"]`) no toca estas franjas: ninguna lleva `border` en sus clases.

## Clasificación de los 11 candidatos

| Archivo | Resultado | Detalle |
|---|---|---|
| `_components/PendingAcceptanceCard.tsx` | cambiado | 1 franja `atencion`. Las filas de la lista (enlaces) pasan a superficie `bg-white` con contorno `--color-grey-500` para leerse como pulsables sobre la franja. |
| `_components/ProfileIncompleteCard.tsx` | cambiado | 1 franja `atencion`. |
| `facturas/[code]/_components/PendingInvoiceGate.tsx` | cambiado | 1 franja `atencion`. |
| `perfil/CedulaPhotoRow.tsx` | cambiado | 1 franja `atencion` (confirmación del reemplazo, `id="cedula-photo-confirm"` se conserva). **No aplica:** la fila del documento (borde izquierdo ámbar y punto de estado) es una fila resaltada, no un aviso. |
| `perfil/DataChangeEditor.tsx` | cambiado | 2 franjas `atencion`: confirmación de guardar y «Cambio en revisión». **No aplica:** la caja «Ya usaste tus 3 cambios» no tiene color en línea (cajón neutro sin rol): queda para un tramo siguiente si Sam lo pide. |
| `perfil/ProfilePendingBanner.tsx` | cambiado | 1 franja `info` (antes, borde en tinta: pendiente no es riesgo). Los enlaces de cada pendiente pasan a `bg-white` y contorno `--color-grey-500`. |
| `perfil/page.tsx` | cambiado | 2 franjas: «¿Importas para tu negocio?» pasa de borde vino a `info` (el vino es marca, no estado); «Empresa/Datos guardados» pasa a `exito`, sigue `role="status"`. **No aplica:** pastilla «1 pendiente» (lectura) y la sección «Tu Shipping Mark» (tarjeta de contenido con acento vino). |
| `envios/_components/PortalAlertasHub.tsx` | cambiado | 1 franja `info`: «Próximo consolidado» (antes, fondo y borde vino). **No aplica:** iconos y pastillas de etapa, chips de documentos, barra de progreso. |
| `compras/nueva/NewPurchaseForm.tsx` | cambiado | 1 franja `exito`: «Tu compra quedó registrada.» (antes, círculo verde relleno con color en línea). |
| `facturas/[code]/reportar/PaymentReportForm.tsx` | cambiado | 1 franja `exito`: «Reporte registrado.» (antes, círculo verde relleno; en oscuro el visto salía navy sobre verde). El `role="status"` sigue en el título. |
| `proveedores/SuppliersClient.tsx` | cambiado | 1 franja `info`: «Copia el código…» (antes, borde y círculo verdes con `#fff` literal). Es una indicación, no un resultado: `info`. **No aplica:** número del proveedor e iconos de los argumentos (acento vino). |

Total: **13 franjas en 11 archivos**. Ningún texto visible cambia (ni puntuación). Ningún `role` cambia: los banners persistentes siguen sin rol, y los dos mensajes que ya eran `status` lo siguen siendo. Ninguno es `alert`.

## Allowlist

- Los 11 archivos de arriba.
- `app/portal/claridad.css` (bloque 2b).
- `app/portal/__tests__/avisos-portal-contract.test.ts` (nuevo).
- `docs/specs/0603-claridad-controles/tramo-4e.md` (este documento), nota en `docs/specs/0628-aviso-studio/spec.md`.
- `.agents/handoffs/0603-t4e-portal-avisos.md`.

Sin cambios en `app/globals.css`, `claridad-portal-contract.test.ts`, `/privacidad`, rutas, datos, acciones de servidor ni dependencias. Sin migraciones.

## Aceptación

- Las 13 franjas usan `.portal-aviso` con `data-tono` y el `StatusIcon` de la forma de su tono; ninguna lleva `border`, `shadow` ni `bg-` en sus clases.
- En claro y oscuro: texto (tinta y `grey-700`) ≥ 4,5:1 e icono ≥ 3:1 sobre la franja de cada tono (24 mediciones). Peor caso: icono de atención en oscuro, 4,46:1.
- Ninguna franja que no sea error lleva `role="alert"`.
- El contrato cuenta las franjas por archivo y por tono ignorando comentarios, y cuenta los restos de color de estado en línea por archivo (los «no aplica» quedan fijados: si alguien agrega uno, rompe).
- Ocho mutantes rompen el contrato: dorado al icono en claro, franja con contorno y sombra, texto en gris de borde, pantalla de vuelta al cajón con borde dorado en línea, franja citada en un comentario, tono e icono cruzados, banner de atención en `alert`, dorado que recolorea la franja entera.
- El contrato del tramo 3 sigue verde: todo selector bajo `.portal-sys`, sin colores literales, sin `!important`.

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: la franja es nivel 0. Los CTA que ya vivían dentro (primario, secundario) no cambian. |
| Acción dominante | Cumple: no cambia la cantidad de primarios. |
| Semántica de color | Cumple con BRAND §Estados: el vino deja de usarse como estado en dos avisos y el verde deja de marcar una indicación. |
| Contraste | Cumple: medido y vigilado por contrato en los dos temas. |
| Tokens | Cumple: ningún token ni color nuevo. |
| Estados sin color | Cumple: forma de icono distinta por tono y mensaje en texto. |
| Light/dark | Cumple en contrato. Recorrido visual pendiente en la imagen de prueba. |
| Móvil | Sin cambio de distribución: el icono ocupa una columna a la izquierda y el cuerpo crece; sin medir pantalla por pantalla. |
| Movimiento reducido | No aplica: la franja no anima. |

## Límites

- jsdom no calcula estilos: el contraste se mide sobre los tokens y las reglas, no sobre píxeles.
- El recuento de restos en línea solo mira `style={{ … }}`; un estilo condicional (`style={x ? undefined : { … }}`, la fila de la cédula) no entra en la cuenta.
- La revisión en pantalla real, en claro y oscuro y a 375 px, la hace Sam en la imagen de prueba antes de fusionar.
