# Identidad pública — DTD Cargo

> **Fuente única de la identidad pública de la empresa** (nombre legal, datos, convención de
> nombres, NAP). Lo consumen el schema (`app/layout.tsx`), el footer, `/contacto` y `llms.txt`.
> Mantiene la consistencia entre esas superficies.
>
> **Estado (2026-06-08).**

## Entidad legal

| Dato | Valor |
|---|---|
| Marca comercial (pública) | **DTD Cargo** |
| Nombre del ERP/Studio interno | **DTD Cargo** (decisión founder 2026-07-14) |
| Razón social | **INVERSIONES DTD SERVICES, C.A** |
| RIF / taxID | **J-50648869-8** |
| Representante legal | **José Méndez** |
| Fundada | **2015** (fundación e inauguración en Venezuela = `foundingDate`) |
| Experiencia con China | **desde 2008** (total autocalculado, nunca fijo) |
| Oficina propia en China | **desde 2010** (hito, no es "empresa desde") |
| Handle social | **@dtdcargo.ve** (Instagram, 20 mil seguidores) · **@dtdcargo** (YouTube) · **@dtdcargo.ve** (TikTok) — migrados desde `@doortudoor_`/`@doortudoor` (verificado en vivo 2026-08-04, ver nota abajo) |

## Convención de nombres (regla del founder)

- **Público = "DTD Cargo"** (dos palabras; nunca "DTDCARGO").
- 🔴 **"DoorTuDoor" está RETIRADO del vocabulario de marca** (founder, 2026-08-19:
  *"ya no existe esa palabra en nuestro vocabulario"*). **Deroga la política anterior**, que lo
  mantenía como "sello de herencia" vivo en `alternateName`, el sello de `/brochure` y los alt/
  caption de la galería. Ninguno de esos sigue en pie. **No se escribe en superficie alguna.**

  Sobrevive **sólo en dos formas, y ninguna es texto de marca**:
  1. **El dominio `doortudoor.com`** — es el 301 que transfiere la autoridad SEO a `dtdcargo.com`.
     Regla dura: no se quita, no se deja expirar, no vuelve a servir contenido propio.
  2. **La cuenta `doortudoorservices@gmail.com`** — una dirección de Gmail es inmutable, y esa
     cuenta es dueña de la ficha de Maps verificada, de GA4 y de Ads. Es un login; su nombre
     visible ya dice "DTD Cargo".

  ⚠️ **Y hay un tercer sitio donde la palabra DEBE quedarse: los tests.**
  `lib/studio/receipts/__tests__/receipt-template.test.ts`, `renditions.test.ts` y
  `app/studio/(app)/etiquetas/__tests__/white-label.test.tsx` la usan en **aserciones negativas**
  (`expect(...).not.toMatch(/doortudoor/i)`) y en un regex de detección. Son el candado que
  impide que la razón social muerta reaparezca en un recibo: **borrar la palabra ahí desarma la
  alarma.** Un `sed` global sobre el repo rompe 8 tests por esta vía.

  ⚠️ **Los handles `@doortudoor_` / `@doortudoor` ya no existen** — las redes migraron a
  `@dtdcargo.ve` / `@dtdcargo` (verificado 2026-08-04: `@doortudoor_` en Instagram da "Página no
  encontrada"). No volver a citarlos como vigentes.
- **ERP/Studio interno (`app/studio`) = "DTD Cargo"** — mismo nombre que la marca pública.
  ⚠️ No confundir con **"DoorTuDoor Trading" / J-50220185**: esa es otra razón social y sigue
  **prohibida** en recibos y rendiciones (regla absoluta del handoff legal).
- La **razón social y el RIF van SOLO en el schema** (`legalName`/`taxID`) — **nunca en texto
  visible** del sitio.
- **RIF ÚNICO (decisión founder 2026-06-10): `J-50648869-8`.** Cualquier otro RIF de DTD que
  aparezca en material de marca/diseño/legal (`J-410322887`, `J-40558712-0`, `J-40551122-3`,
  `J-50220185-8` circulaban en el Norte) es **incorrecto → reemplazar** por el canónico. En
  material impreso/legal (factura, tarjeta, membrete, T&C) el RIF **sí** va visible — la regla
  "solo en schema" aplica al **sitio público** (SEO). Los RIF mock de clientes demo no se tocan.

## NAP canónico (Name–Address–Phone)

| Campo | Valor |
|---|---|
| Nombre (schema `name`) | DTD Cargo |
| `alternateName` | *(vacío — retirado 2026-08-19)* |
| Sede Venezuela | Torre Profesional Kokuy, Calle 151 (entre Av. Bolívar Norte y Av. Paseo Cabriales) — Valencia, Carabobo, VE · CP 2001 · GPS 10.220449, -68.008481 |
| Bodega China | Yiwu Port Phase II, Warehouse 2, No. 2 (Cargo 7-11) — Yiwu, Zhejiang, CN |
| Teléfono público primario | +58 412 166 8021 (CRM WhatsApp) |
| Teléfono público secundario | +58 241 414 7886 (Fijo Valencia) |
| Email general | info@dtdcargo.com |

*(Los datos vivos están en `CONTACT` de `lib/design-tokens.ts` — esa es la fuente que consume el
schema. Esta tabla es la referencia canónica para mantener la consistencia entre superficies.)*

### Dirección VE — una sola, y las variantes muertas

**Canónica (founder 2026-07-11, reconfirmada 2026-07-30; nombre del edificio corregido
2026-08-19):** `Torre Profesional Kokuy, Calle 151 (entre Av. Bolívar Norte y Av. Paseo
Cabriales) — Valencia, Carabobo, VE`. **La entrada da únicamente a Calle 151**; Av. Bolívar
Norte es referencia cruzada, **no la dirección, y no lleva número de puerta**. CP **2001**
(Valencia; el 5001 es San Cristóbal/Táchira).

⚠️ El pin `https://maps.app.goo.gl/76T5MAeeTyynwV1M6` **decía "verificado" y no lo estaba** —
ver § "La ficha de Google Maps" más abajo.

Estas tres variantes circularon y son **incorrectas — reemplazar donde aparezcan**:

| Variante muerta | Por qué está mal | Dónde sobrevive |
|---|---|---|
| `Edificio Kokuy, Av. Bolívar Norte — Valencia, Carabobo` | le falta la calle real (Calle 151) | Brand Book v4.6 (`_norte/` + `private/marca/`), `docs/specs/0001-mvp-public-web/spec.md` |
| `Edificio Kokuy` (a secas, sin "Torre Profesional") | nombre **incompleto** del edificio: no es como se llama ni como Google lo tiene indexado, así que el NAP del sitio no casaba con el de la ficha | fue el valor del repo hasta 2026-08-19 (`lib/design-tokens.ts`, `public/llms.txt`); sigue vivo en `docs/legal/casos/` (histórico: cita textual de un cliente, **no se reescribe**) y en `docs/specs/0001-mvp-public-web/spec.md` |
| `Av. Bolívar Norte 14, Valencia` | el **"14" no existe** — confirmado por el founder 2026-07-30; además pierde "Edificio Kokuy" y la calle | piezas del Norte: `Aplicaciones de Marca.html`, `Ficha 3D · Aviso de Fachada`, `_norte/CLAUDE.md`, `design_handoff_mobile_app/CLAUDE.md`, `handoff-enlaces/HANDOFF.md`, `SYNC-NORTE-2026-06-14.md` |

⚠️ La variante del "14" está en **colateral que se imprime** (membrete A4, credencial CR-80,
vinilo de camión, roll-up) y en el **aviso de fachada**. Antes de mandar a imprenta, verificar
contra esta sección.

El material del Norte es **read-only** (se reemplaza en el próximo NORTE-SYNC): la corrección se
sube a Cloud Design, no se parcha acá.

### La ficha de Google Maps — medido 2026-08-19

La ficha **`DTD Cargo services`** (`0x8e805d8921ef9f17:0x534069318a455204` · `/g/11r9w2fzdb`)
está mal en tres cosas a la vez, y **las tres son el mismo bug de fondo: la ficha no tiene
domicilio estructurado propio**, así que Google la cuelga del punto de interés más cercano y
hereda su geocodificación.

| Qué muestra | Qué debería | Nota |
|---|---|---|
| `Torre Profesional Kokuy, Valencia` | la dirección canónica de arriba | eso **no es una dirección**: es el nombre de un POI + la ciudad |
| CP `5000` | CP **2001** | `5000` no es un código postal válido de Valencia |
| pin en Plus Code `6XCR+5JC` | el edificio está en `6XCR+5HQ` | ~4 m corrido — el founder lo confirmó a ojo |

⚠️ **La coordenada de `CONTACT.ve.geo` NO verifica nada:** está a **36 cm** del pin de la ficha
porque se copió de ahí. No es una segunda fuente que confirma — es un eco. Cuando el pin se
corrija en Google Business Profile, hay que traer la coordenada nueva a `lib/design-tokens.ts`
y a este documento.

⚠️ **Google no tiene numeración de calle en esa zona.** La prueba: la ficha del propio edificio
—que está establecida, con 10 reseñas— muestra como dirección `6XCR+5HQ, Calle 151`, o sea un
Plus Code en lugar de un número de puerta. Por eso llenar la dirección estructurada **no
alcanza**: lo que fija la ubicación de verdad es el pin, y el Plus Code que resulta de él.

🔴 **No crear una ficha nueva:** `DTD Cargo services` ya existe. Una segunda ficha en la misma
dirección es un duplicado, y Google los castiga suspendiendo una (o las dos) y partiendo
reseñas y antigüedad. El camino es **reclamar** la existente.

🔴 **Ojo con el Administrador de Negocio:** el flujo de alta ofrece vincular la ficha a
**"Doortudoor Trading, C.A"** (una cuenta de Merchant Center que ya existe). Esa es la razón
social **muerta** — la viva es `INVERSIONES DTD SERVICES, C.A` / `J-50648869-8`. El link
*"Este perfil corresponde a otra empresa"* es la salida para no colgarlo de ahí.

## Los cuatro buzones — medido 2026-08-19

El repo daba por hecho que había un solo correo público. Hay **cuatro direcciones en
circulación**, y ninguna documentación las reconocía juntas:

| Dirección | Qué es de verdad | Dónde vive |
|---|---|---|
| `info@dtdcargo.com` | **alias que SOLO RECIBE** y reenvía a `vzla@` | lo que se publica en TODA superficie pública (18 sitios) |
| `vzla@dtdcargo.com` | **el buzón real** en Hostinger — desde acá salen las respuestas a mano | no se publica en ningún lado |
| `noreply@dtdcargo.com` | `from` del correo transaccional | `mail_config`, sembrada en `supabase/migrations/0018_mailing.sql:417` |
| `comercial@dtdcargo.com` | **`reply_to` del correo transaccional** | idem |

🔴 **El problema que esto genera, en dos frentes:**

1. **A mano:** publicas `info@`, el cliente escribe a `info@`, y le contesta `vzla@`. Dirección
   distinta a la que él escribió — rompe el hilo en su cliente de correo y puntúa peor en spam.
2. **Automático:** si el cliente le da "Responder" a una factura, una cotización o el newsletter,
   **no cae ni en `info@` ni en `vzla@`: cae en `comercial@`**, que hasta hoy no figuraba en este
   documento ni en `CONTACT`.

**La salida del frente 1** no es tocar Hostinger: es configurar un **"enviar como"** en el cliente
de correo, para que las respuestas *salgan* desde `info@` aunque se escriban desde el buzón
`vzla@`. Así queda **una sola dirección pública y un solo buzón que atender**. SPF y DKIM ya
cubren porque es el mismo dominio.

⏳ **PENDIENTE DE DECISIÓN DEL FOUNDER (frente 2):** si el `reply_to` transaccional debe seguir
siendo `comercial@` o pasar a `info@`. No es una corrección de dato — depende de quién atiende
qué. Hasta que se decida, **no se toca `mail_config`**.

⚠️ Los valores de la tabla de arriba para `noreply@`/`comercial@` son los **sembrados en la
migración**. El valor **vivo** está en `mail_config` en producción y **no se ha leído** — leer
filas de negocio requiere OK del founder. No dar por hecho que siguen igual.

## Versión-máquina (schema.org)

La identidad legible por Google / motores de IA vive en el **`@graph` de `app/layout.tsx`**
(nodo `#organization` `LocalBusiness` + nodo `#website`). `legalName`, `taxID` y `founder` solo
existen ahí, no en texto visible. *(Pendiente de la Fase 2 del plan de identidad.)*

## Ficha portable — "arrancar un chat nuevo"

```
EMPRESA: DTD Cargo (público) · sello "DoorTuDoor" · IG @dtdcargo.ve
RAZÓN SOCIAL: INVERSIONES DTD SERVICES, C.A — RIF J-50648869-8 — rep. legal José Méndez
RUBRO: logística end-to-end China→Venezuela. Fundada en Venezuela en 2015; en el comercio
  con China desde 2008 y con oficina propia en China desde 2010. DDP puerta a puerta,
  agente de compra, inspección de fábrica; equipo propio en Yiwu y Valencia.
WEB: dtdcargo.com (Next.js 16 App Router / React 19 / Tailwind v4 / pnpm). doortudoor.com
  redirige 301 (no dejar expirar, no servir contenido propio ahí).
NOMBRES: público "DTD Cargo"; razón social SOLO en schema (legalName/taxID).
FOUNDER (Sam): dueño-operador entre Yiwu y Venezuela; decide rápido, español (VE), quiere
  salidas listas para copiar con rutas explícitas. Opciones A/B/C ordenadas por prioridad,
  #1 con ⭐. Preguntas cortas. Decir "Fase 5", no "F5". Verificar la rama antes de commit;
  NO push sin su OK; commits selectivos si hay varias ventanas.
NORTE: cerrar el loop comercial del ERP (recompra día 30/45 + alertas de cadencia + KPI 2
  contenedores/mes + white-label para aliados) sobre el Studio existente (20+ módulos en prod).
REPO: instrucciones en AGENTS.md (CLAUDE.md solo lo importa). Marketing/SEO en docs/marketing/.
```

## Relacionados
- Estrategia (propósito/misión/visión/valores): [`estrategia.md`](estrategia.md).
- Ventas / cliente-ancla: [`ventas.md`](ventas.md).
- Reglas SEO/GEO: [`seo.md`](seo.md).
