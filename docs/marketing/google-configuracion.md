# Configuración de Google — inventario, qué está mal y en qué orden se arregla

> **Alcance:** todo lo que vive en una consola de Google y lleva el nombre de la empresa —
> cuenta de Google (Gmail), Perfil de Empresa (Maps), Merchant Center, Google Ads, GA4,
> Search Console. Lo de SEO on-site vive en [`seo.md`](seo.md); la identidad y el NAP
> canónico en [`identidad.md`](identidad.md).
>
> 🔴 **Lo de esta tabla NO está medido en vivo.** Sale de los docs del repo con la fecha que
> cada uno trae. Yo no tengo acceso a las consolas de Google: antes de tocar algo, **abre la
> consola y verifica**. Si lo que ves no coincide, gana la consola y se corrige este doc.

## 1. Por qué "sigue saliendo el nombre anterior"

No es un solo sitio: **el nombre viejo está en el nombre de las CUENTAS**, no en el contenido.
La marca pública es **DTD Cargo** desde hace tiempo, pero la infraestructura de Google se creó
antes y arrastra los nombres de entonces.

| Dónde | Nombre que tiene hoy | Debería | Fuente / fecha |
|---|---|---|---|
| Cuenta de Google (login) | `doortudoorservices@gmail.com` | *(no se puede renombrar — ver §2)* | `README.md` L85 |
| Administrador de Negocio / Merchant Center | **Doortudoor Trading, C.A** | razón social viva | captura del founder 2026-08-19 |
| Ficha de Maps | **DTD Cargo services** (*s* minúscula) | **DTD Cargo** | URL de Maps 2026-08-19 |
| Cuenta Google Ads | **Dooortudoor services** (ocid `579348138`) ⚠️ con tres "o" | **DTD Cargo** | `README.md` L50 |
| Campaña Ads | **DoorTuDoor Trafico** | interno, no lo ve el cliente | `README.md` L51 |
| GA4 — cuenta activa | DTD Cargo (`396905128`) ✅ | ya está bien | `README.md` L60 |
| GA4 — cuenta vieja | DoorTuDoor (`208873909`) — dormida | cerrar o dejar dormida | `README.md` L60 |

⚠️ **Ojo con la razón social.** "Doortudoor Trading, C.A" (RIF `J-50220185`) **no es** la entidad
viva. La viva es **INVERSIONES DTD SERVICES, C.A** / `J-50648869-8`. En el repo, nombrar la vieja
en recibos y rendiciones está **prohibido como regla absoluta**. Ver [`identidad.md`](identidad.md).

## 2. La decisión de fondo: renombrar, no migrar

**Una dirección de Gmail no se puede cambiar.** `doortudoorservices@gmail.com` es inmutable como
dirección. Lo que **sí** se cambia es el **nombre para mostrar** de la cuenta, que es lo que
aparece en las consolas y en los correos que salen.

Hay dos caminos, y no cuestan lo mismo:

| | ⭐ Renombrar (recomendado) | Migrar a `@dtdcargo.com` |
|---|---|---|
| Qué se hace | cambiar el *display name* de la cuenta y el nombre de cada propiedad | crear cuenta Workspace y transferir la propiedad de GA4, Ads, Merchant Center, Perfil de Empresa y YouTube |
| Riesgo | bajo | alto: cada transferencia puede tumbar una verificación |
| Tiempo | una tarde | semanas, con ventanas de re-verificación |
| Qué ve el cliente | **lo mismo en ambos casos** | idem |

✅ **DECIDIDO POR EL FOUNDER (2026-08-19): se renombra, no se migra.** El correo de login **no lo ve ningún cliente** — lo que ven es el
nombre del perfil, el de la ficha y el remitente. Migrar mueve mucho riesgo a cambio de un dato
que nadie externo mira. Si algún día se hace, que sea con las verificaciones ya estables, nunca
en el mismo movimiento que se arregla la ficha.

## 📍 Estado de la Fase 1 — medido en vivo el 2026-08-19

🔴 **El plan original de esta sección decía "reclamar la ficha". ESO ESTABA MAL:** al entrar al
Administrador de Perfil de Negocio se vio **"1 empresa · Se verificó el 100% · Verificada"**. La
ficha ya era del founder y ya estaba verificada — no había nada que reclamar. Los cambios de
abajo no le hicieron perder la verificación.

**Y el problema real era otro, mucho peor:** el campo de dirección estaba **corrupto**. Tenía las
coordenadas GPS metidas como texto en "Línea 2 de la dirección postal"
(`10.220449465809326, -68.00848104738162`), CP **5001** (que es San Cristóbal, Táchira — no 5000
como se había supuesto), "Edificio Kokuy", "Av. Bolivar Nte.", "Cabriaeles" mal escrito, y ciudad
repetida. Google no podía geocodificar eso: por eso el pin caía sobre el edificio vecino. **Los
tres síntomas eran un solo bug.**

*(Esos 15 decimales dentro del campo de dirección confirman que `CONTACT.ve.geo` y el pin de Google
son el mismo dato copiado, no dos mediciones que coinciden.)*

| | Estado |
|---|---|
| Nombre de la ficha → `DTD Cargo` | ✅ hecho (era "DTD Cargo services") |
| Dirección + CP **2001** | ✅ **aprobada** |
| Categoría "Compañía de transporte de carga" | ✅ correcta — se queda |
| Dirección con "Oficina 1" · pin · perfiles de redes | ⏳ **en cola de Google, hasta 7 días** |
| Nombre corto (sigue `DoorTuDoor`) | ⏳ al liberarse la cola |
| Código de tienda (sigue `DoorTuDoor`) | ⏳ idem |
| Doble coma en `Calle 151,, Oficina 1` | ⏳ idem — produce una "y," suelta al inicio de la dirección en Maps |
| Atributo "Se identifica como mujer empresaria" | ⏳ quitar si no aplica (es público y filtra búsquedas) |
| Logo + foto de perfil de la cuenta | ⏳ pendiente |

⚠️ **Mientras haya una edición en revisión, no encimar otras** — se acumulan en la misma cola.

✅ **El enlace corto `maps.app.goo.gl/76T5MAeeTyynwV1M6` sobrevivió a los cambios** (mismo CID
`0x8e805d8921ef9f17:0x534069318a455204`). No hay que tocar `CONTACT.ve.mapsUrl`.

⚠️ **Lección de método:** la URL de Google Maps **no sirve para medir dónde está el pin** — se
reescribe sola con la interacción. En una sesión dio dos coordenadas separadas por 4 km. El dato
fiable es el **Plus Code que la ficha publica**. Hoy publica `6XCR+5J`; el edificio está en
`6XCR+5H` — celdas contiguas de ~14 m, o sea el pin está al lado, no encima.

## 3. Fase 1 — Configuración de Google *(en curso)*

> 🔴 **Esta fase es del founder, entera.** Ningún agente tiene acceso a las consolas de
> Google — ni a la cuenta, ni al Perfil de Empresa, ni a Merchant Center, ni a Ads. Lo que sí
> se hace desde el repo es todo lo de la Fase 2 hacia abajo (traer la coordenada, el NAP, los
> docs). Si un agente dice que "ya renombró" algo de esta lista, está inventando.

Orden pensado para que ningún paso deshaga al anterior.

### 1.1 · La cuenta de Google
- [ ] Cambiar el **nombre para mostrar** a `DTD Cargo` (Cuenta de Google › Información personal › Nombre).
- [ ] Revisar la **foto de perfil** — es lo que sale junto al nombre en reseñas y respuestas.

### 1.2 · Reclamar la ficha de Maps *(bloquea todo lo demás de Maps)*
- [ ] 🔴 **Reclamar la ficha existente `DTD Cargo services`. NO crear una nueva** — una segunda
      ficha en la misma dirección es un duplicado, y Google suspende una (o las dos) y parte
      reseñas y antigüedad.
- [ ] En la pantalla "Confirma tu empresa", usar **"Este perfil corresponde a otra empresa"** para
      no colgarla del Administrador de Negocio *Doortudoor Trading, C.A*.
- [ ] Completar la verificación (en Venezuela suele ser por video).

### 1.3 · Corregir los datos de la ficha *(solo después de verificar)*
- [ ] Dirección: ver el bloque exacto en [`identidad.md`](identidad.md) § "La ficha de Google Maps".
- [ ] **Código postal: `2001`** — hoy tiene `5000`, que no es un CP válido de Valencia.
- [ ] Teléfono, horario, sitio web, categoría.
- [ ] **Renombrar la ficha** `DTD Cargo services` → `DTD Cargo`.
      ⚠️ Hacerlo **después** de que la verificación esté aprobada: cambiar el nombre de una ficha
      recién reclamada suele disparar una re-verificación.

### 1.4 · Las demás propiedades
- [ ] Renombrar la cuenta de **Google Ads** (`Dooortudoor services`, con la errata de las tres "o").
- [ ] Merchant Center: revisar si la razón social se puede corregir **sin** tumbar la verificación
      de comerciante. Si la tumba, **parar y consultar** — no vale perderla por un nombre.
- [ ] GA4: decidir qué hacer con la cuenta vieja `208873909` (dormida). Cerrarla es opcional.
- [ ] Borrar los 2 contenedores GTM sin uso (`GTM-KWRDZS4`, `GTM-PD3JF2GW`) — el sitio usa gtag directo.

## 4. Fase 2 — Geo *(después de la Fase 1)*

El pin **no se toca hasta que la dirección estructurada esté puesta y guardada**. Si se arrastra
antes, Google re-geocodifica contra un domicilio que no existe y deshace el arrastre.

- [ ] Arrastrar el pin a la entrada real por **Calle 151**. Referencia de una reseña del edificio:
      *"está al frente de la oficina del Digitel de la Av. Bolívar Norte"*.
- [ ] Copiar el **Plus Code** que quede y traerlo al repo → `CONTACT.ve.geo` en `lib/design-tokens.ts`.
- [ ] Actualizar la tabla de [`identidad.md`](identidad.md) con la coordenada nueva.

**Estado medido 2026-08-19:** el pin está en `6XCR+5JC`; el edificio está en `6XCR+5HQ` (~4 m).
La coordenada del repo está a 36 cm del pin **porque se copió de ahí** — es un eco, no una
verificación.

⚠️ **Google no tiene numeración de calle en esa zona.** La ficha del propio edificio —establecida,
con 10 reseñas— muestra `6XCR+5HQ, Calle 151`: un Plus Code en lugar de número de puerta. Por eso
llenar la dirección no alcanza y **el pin es la palanca real**.

## 5. Fase 3 — SEO local *(después de la Fase 2)*

- [ ] Pedir reseñas a clientes conformes por WhatsApp (tracción local gratis).
- [ ] Publicaciones y fotos en el Perfil de Empresa.
- [ ] Verificar que el NAP de la ficha quede **idéntico** al del sitio.
- [ ] Seguir el traspaso del "Cambio de dirección" de Search Console (~180 días).

El resto del SEO on-site vive en [`seo.md`](seo.md); la reestructura de Ads en
[`ads-reestructura-search.md`](ads-reestructura-search.md).

## 6. Lo que ya está hecho

- ✅ **NAP del sitio corregido** (commit `8eae702f`, 2026-08-19): el edificio es **Torre
  Profesional Kokuy**, no "Edificio Kokuy". Antes el sitio y la ficha nombraban el mismo local
  de dos formas distintas — inconsistencia NAP, que es señal negativa de SEO local por sí sola.
- ✅ **Diagnóstico de la ficha medido**, no supuesto: los 3 síntomas (dirección, CP, pin) son un
  solo bug — la ficha no tiene domicilio estructurado y hereda la geocodificación del POI vecino.
- ✅ GA4 + Ads cableados y recibiendo datos (`G-25CD7BZH98`, `AW-561290482`), fuera de rutas privadas.
- ✅ Dominio migrado `doortudoor.com → dtdcargo.com` con 301 path-preserving.
- ✅ Conversión "Click WhatsApp" cableada.
