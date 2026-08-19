# Link-in-bio de Instagram — `dtdcargo.com/enlaces`

> Guía práctica para el equipo. El **link de la bio** de DTD es una página propia
> (no un Linktree de pago): agrupa todos nuestros enlaces bajo **una sola URL** y
> nos deja **medir clics** sin marca de terceros ni costo recurrente.
>
> **En la app:** el equipo la ve en el hub interno de marca → `/interno/marca/enlaces`
> (tarjeta "Link-in-bio · Instagram", con preview en vivo).
> **Versión HTML** (para abrir en el navegador / compartir / imprimir):
> [`assets/link-in-bio-guia.html`](assets/link-in-bio-guia.html).

## Qué es y dónde vive

- **URL pública:** `https://dtdcargo.com/enlaces` ← esta es la que va en la bio de Instagram.
- **En código:** ruta `app/enlaces/` del sitio público (page.tsx + MapsRow.tsx). Diseño
  aprobado en el Norte (`docs/design/studio/_norte/handoff-enlaces/`). Es **activo de marca**,
  no módulo de producto.
- **Qué contiene hoy:** CTA principal a WhatsApp (Cotizar DDP) + accesos rápidos
  (Calcular CBM, Portal, Rastrear, Atención WhatsApp, Servicios, **Cómo llegar**) + redes
  (Instagram/TikTok/YouTube) + pie con RIF y dirección.

## Cómo ponerlo en Instagram (app)

1. Entra a tu **perfil** → **Editar perfil**.
2. Toca **Enlaces** (en cuentas viejas dice **Sitio web**).
3. **Agregar enlace externo** → pega `https://dtdcargo.com/enlaces`.
4. Título (opcional): **Enlaces DTD** o **Cotiza y rastrea**.
5. **Guardar**. Queda como el enlace debajo de la bio.

> ⚠️ El link escrito en el **texto** de la bio **no es clickeable** — tiene que ir sí o sí
> en el campo **Enlaces / Sitio web**.

## Botones nativos de cuenta profesional (recomendado, aparte del link)

Refuerzan el contacto directo y conviven con el link de la bio:

1. **Editar perfil** → **Botones de acción** (o **Información de contacto**).
2. Activa:
   - **WhatsApp** → `+58 412 166 8021` (CRM, número público primario).
   - **Cómo llegar** → dirección de la oficina en Valencia. ⚠️ **Usa el NAP exacto de
     [`identidad.md`](identidad.md)** — "Torre Profesional Kokuy, Calle 151 (entre Av. Bolívar
     Norte y Av. Paseo Cabriales)". NO abrevies a "Av. Bolívar Norte": es referencia cruzada, no
     la dirección, y esta es justo la superficie que Google cruza contra la ficha de Maps.
   - **Correo** → `info@dtdcargo.com`.

Resultado: botones nativos arriba del perfil **+** `/enlaces` como el link único que agrupa
todo y mide clics.

## Mismo link en otras redes

`dtdcargo.com/enlaces` sirve igual para el link de perfil de **TikTok** (`@doortudoor`) y
**YouTube** (`@doortudoor`). Un solo destino para mantener todo consistente.

## Atribución — de dónde vino cada clic

La página ya trae la atribución integrada (no hay que hacer nada extra al pegar el link):

- **Enlaces web** (Calcular, Portal, Rastrear, Servicios) llevan UTM:
  `utm_source=instagram&utm_medium=bio&utm_campaign=enlaces&origen=<botón>`.
  → se ven en **GA4** (`G-25CD7BZH98`) en Adquisición / por campaña "enlaces".
- **WhatsApp** (Cotizar, Atención): el mensaje pre-cargado termina con
  `(Vía: dtdcargo.com/enlaces · <origen>)` → el asesor/CRM sabe que el contacto vino del
  link-in-bio y de qué botón.
- **Cómo llegar**: abre mapas nativos (Apple Maps en iPhone, Google Maps con el pin
  verificado de DTD en Android/desktop).

## Cómo editar los enlaces (sin tocar el diseño)

Todo vive en el bloque de datos arriba del render en `app/enlaces/page.tsx`:

- `PRIMARY` → el CTA grande (hoy: Cotizar DDP por WhatsApp).
- `LINKS[]` → accesos rápidos (icono, label, sub, href).
- `SOCIAL[]` → Instagram / TikTok / YouTube.
- La fila **Cómo llegar** usa `CONTACT.ve.mapsUrl` (pin verificado) desde `lib/design-tokens`.

Números de WhatsApp y datos de contacto salen de `CONTACT` en `lib/design-tokens.ts` (fuente
única de NAP del sitio). Para agregar/quitar un acceso: editar el array y listo.

## Tips

- Al compartir el link en Stories / WhatsApp aparece la **miniatura** (og:image ya lista).
- Si algún día se cambia la URL de la ruta, actualizar también canonical, og:url y los
  textos "Vía: dtdcargo.com/enlaces" del código.

## Checklist de publicación

- [ ] Confirmar que `dtdcargo.com/enlaces` carga en prod (deploy de Vercel tras merge a `main`).
- [ ] Pegar `dtdcargo.com/enlaces` en la bio de Instagram (campo Enlaces).
- [ ] Activar botones nativos (WhatsApp / Cómo llegar / Correo) en la cuenta profesional.
- [ ] Poner el mismo link en TikTok y YouTube.
- [ ] Revisar en GA4 que llegan eventos con `utm_campaign=enlaces`.

---

*Relacionado:* plan de redes y reciclaje IG→YouTube en [`redes.md`](redes.md) · identidad y
NAP en [`identidad.md`](identidad.md).
