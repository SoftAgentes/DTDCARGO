# Manual de vendedores — Cómo cotizar el peso (INTERNO)

> **Confidencial · uso interno. No se comparte con el cliente.** Nunca le muestres al
> cliente las densidades reales, el "por qué podemos dar 1.000", ni estos números crudos.
> Al cliente le hablas de **condiciones**, no de datos. La evidencia que respalda estos
> límites está en el **informe de calibración** (confidencial, `docs/legal/casos/`) y en el
> **brief legal v3.1** (`brief-abogado-parametros-lcl-v3.1.md`).

## La regla de oro (30 segundos)

Cobramos por **volumen (m³)**, no por peso. Incluimos una **franquicia de peso muy
generosa por cada m³** porque, en la práctica, el contenedor **se llena de espacio antes
que de peso** — nuestra carga real casi nunca se acerca al tope físico del contenedor. Por
eso podemos ser generosos sin perder plata. Pero esa generosidad **tiene candados** para
que nadie abuse.

**La oferta es "por kilos": el kilo no te limita.** Cada m³ trae **hasta 1.000 kg de gracia**
sin recargo — mucho más que lo que pesa la carga real (por eso el 97% cotiza liso). Pasado eso,
la calculadora suma **$2 por kg**, no deriva a nadie. El único freno duro es el **tope por
envío: 9.000 kg** — y solo muerde cuando la carga además es **densa** (ver abajo). Es la
protección para que un solo cliente no se coma el peso del contenedor.

## Los números (SOLO para ti)

| Tramo | Regla | Qué cobra la calculadora |
|---|---|---|
| **Gracia** | hasta **1.000 kg por m³** | Tarifa por volumen, sin recargo (el 97%) |
| **Recargo por peso** | más de **1.000 kg por m³** | **Auto-cotiza**: tarifa + **$2 por cada kg de más**. Sin "consulta asesor". |
| **Tope por envío** (anti-abuso) | más de **9.000 kg** **Y** carga **densa** (> ≈400 kg/m³) | Deriva al asesor (a medida). Carga pesada pero **voluminosa** NO cae aquí: sigue auto-cotizando. |
| **Tope contenedor** | más de **68 m³** ó **27.000 kg** | Deriva al asesor (FCL) |

Tarifa base de referencia hoy: **$800 por m³** · mínimo facturable **$380**. (La tarifa es
editable en la calculadora; ajústala dentro de tu margen, nunca bajo el mínimo.)

**El $2/kg es tu protección:** la carga densa (maquinaria, metal) paga lo justo por el peso
extra Y recibe precio al instante — no tienes que derivar nada al asesor salvo lo gigante.

**El tope de 9.000 kg — por qué existe y cuándo muerde.** Es **⅓ de los 27.000 kg** que aguanta
un contenedor: así garantizamos **≥3 clientes por consolidado** y nadie se come el peso solo. La
calculadora **no lo aplica a lo bruto**: solo deriva al asesor si el envío pesa **más de 9.000 kg
Y** además es **denso** — o sea, por encima del **punto de equilibrio del contenedor (27.000 ÷ 68
≈ 400 kg/m³)**. Traducido: si alguien mete mucho peso en poco volumen (metal, maquinaria) y pasa
los 9.000 kg, **acapara el peso dejando espacio sin vender → lo cotizamos a medida**. Pero un
envío pesado y **voluminoso** (baja densidad) sí auto-cotiza: usa su parte justa de espacio, no
monopoliza nada. *(Está automatizado en la calculadora; tú no calculas densidades — si dice
"consulta asesor" por peso, es este caso.)*

## Cómo cotizar, paso a paso

1. Pide **volumen (m³) y peso (kg)** de TODA la carga del cliente.
2. Mételo en la calculadora. Si **da precio** → es LCL normal, ese es tu punto de partida.
3. Si dice **"consulta con un asesor"** → es uno de dos casos: **(a)** un envío **gigante** (más
   de un contenedor: 68 m³ ó 27.000 kg), o **(b)** carga **densa que pasa los 9.000 kg** (acapara
   el peso del contenedor). Cotízalo a medida / FCL con tu supervisor. Ojo: la carga densa que
   **no** pasa los 9.000 kg auto-cotiza con su recargo de $2/kg — esa no la derivas.
4. **Siempre** cierra con: *"la tarifa final se confirma con el peso y volumen reales al
   recibir tu carga"*.

## Ejemplo trabajado (los casos típicos · tarifa $800/m³)

| Cliente trae | Densidad | Cálculo | Resultado |
|---|---|---|---|
| **3 m³ · 900 kg** | 300 kg/m³ | 3 × $800 | **$2.400** ✅ por volumen |
| **1 m³ · 2.000 kg** | 2.000 kg/m³ | 800 + (2.000−1.000) × $2 | **$2.800** ✅ auto-cotiza (recargo peso) |
| **2 m³ · 3.000 kg** | 1.500 kg/m³ | 1.600 + (3.000−2.000) × $2 | **$3.600** ✅ auto-cotiza |
| **12 m³ · 8.000 kg** | 667 kg/m³ | 12 × $800 | **$9.600** ✅ por volumen (dentro de la gracia, bajo los 9.000 kg) |
| **30 m³ · 10.000 kg** | 333 kg/m³ | 30 × $800 | **$24.000** ✅ por volumen (pesa +9.000 kg **pero es voluminosa**: no acapara) |
| **5 m³ · 10.000 kg** | 2.000 kg/m³ | — | ⚠️ **Consulta asesor** (+9.000 kg **y densa**: acapararía el peso del contenedor) |

## 🛡️ Cómo NO caer en la estrategia del cliente

| El cliente intenta… | Tu escudo |
|---|---|
| Declarar **poco peso** para un estimado barato | *"El estimado usa lo que declaras; al llegar a China pesamos y medimos, y se cobra sobre lo real."* Nunca cierres precio sobre el declarado. |
| **Partir** un envío grande en varios para esquivar el tope | Los límites aplican a **toda su carga** (su Shipping Mark), no a cajas sueltas. No se fracciona para evadir. |
| *"Pero la web me dio X"* | *"Ese estimado es referencial, no es el precio final."* (respaldo: cláusula 3.5 del Acuerdo) |
| Exigir la franquicia como un derecho | La franquicia es una **condición del servicio**, no ilimitada. Carga muy densa/grande se reclasifica. |
| Carga densa *"no me cobres el peso extra"* | Arriba de 1.000 kg/m³ la calculadora suma $2/kg automático. Es el precio, no es negociable. |

## 🤝 La negociación — tus palancas

**Palancas que SÍ mueves:**

| Palanca | Cómo la usas |
|---|---|
| **Tarifa por m³** | Editable. Puedes bajar el $/m³ a un cliente serio o recurrente — **nunca bajo el mínimo ($380)**. |
| **Financiamiento "pagas al llegar"** | Tu carta más fuerte. No adelanta nada; paga cuando llega a Venezuela. Vale más que una rebaja. |
| **Franquicia de peso** | Ya es generosa. Véndela ("te incluyo buen margen de peso"), **sin dar el número**. |
| **FCL como alternativa** | Para carga grande o densa, un contenedor completo a veces sale mejor por unidad. Ofrécelo. |
| **Tarifa preferencial por recurrencia/volumen** | Al mayorista que trae todos los meses, mejor $/m³ a cambio de continuidad. Es nuestro norte. |
| **Todo incluido (DDP)** | Flete + aduana + impuestos + entrega puerta a puerta. Recuérdalo cuando comparen precios pelados. |

**Palancas que NO tocas:** bajar del **mínimo**, regalar peso **sobre el tope** sin recargo,
cerrar **precio firme antes de medir**, ceder ante el que **subdeclara**.

> **La filosofía:** cuando el cliente empuja el precio, no bajes el número — **sube el
> valor**. El peso generoso, el "pagas al llegar" y el puerta-a-puerta son tus cartas.

## 🎭 Tres ejemplos en vivo (con precios reales · $800/m³)

### Ejemplo 1 — El que pide rebaja (carga normal)
> **Cliente:** Tengo 4 m³ y como 1.100 kg para Valencia. Me salió **$3.200** en la
> calculadora *(4 × $800)*… ¿me haces mejor precio?
> **Vendedor:** Con gusto reviso. Tu carga está cómoda de peso, sin recargos. Y lo mejor no
> es el número: con nosotros **no adelantas nada** — pagas cuando tu carga llega a Valencia,
> ya nacionalizada y en tu puerta.
> **Cliente:** Sí, pero la competencia me tiró $3.000…
> **Vendedor:** ¿Todo incluido y pagando al llegar? Casi nunca. Si me confirmas hoy y sueles
> traer seguido, te dejo el m³ en **$750** — te queda en **$3.000** *(4 × $750)* — y te lo
> fijo para tus próximos envíos.

*Lección: igualó al competidor con una palanca concreta (recurrencia), no con una rebaja
seca, y sumó el valor del financiamiento.*

### Ejemplo 2 — El de carga densa que la quiere colar
> **Cliente:** Son 2 m³ nada más, repuestos de metal. A $800 el m³ son **$1.600**, ¿verdad?
> **Vendedor:** Déjame verlo… ¿cuánto pesa esa carga?
> **Cliente:** Ah, ponle unos 800 kg. *(realmente pesa ~2.400)*
> **Vendedor:** Perfecto, pero te adelanto algo para que no te sorprendas: el estimado usa lo
> que me declaras, **pero al llegar a China pesamos y medimos**, y se cobra sobre lo real. Si
> esos repuestos pesan 2.400, la calculadora le suma un adicional justo por el peso extra —
> te da un número claro de una (**$2.400** en vez de $1.600). Con metal muy pesado te comparo
> un contenedor, por si te conviene.
> **Cliente:** ¿O sea que los $1.600 no son fijos?
> **Vendedor:** Ese número es referencial. Te lo confirmo con tu carga real y así el precio
> es justo.

*Lección: activó el escudo "medido, no declarado" ANTES del conflicto, no cerró sobre los
$1.600 del peso subdeclarado, y le mostró el precio real con el recargo por peso.*

### Ejemplo 3 — El mayorista grande
> **Cliente:** Yo muevo como 18 m³ todos los meses. En la web me da **$14.400** *(18 × $800)*.
> ¿Qué me haces?
> **Vendedor:** Ese volumen ya lo trabajo a medida, no con el precio de la web. Te armo una
> tarifa preferencial: **$700 el m³ → $12.600 al mes** *(18 × $700)*, **a cambio de que
> consolides con nosotros cada mes**. Te comparo también un contenedor completo, por si a tu
> volumen ya te conviene.
> **Cliente:** ¿Y si un mes traigo más pesado?
> **Vendedor:** Tienes buen margen de peso incluido; solo si viene excepcionalmente denso lo
> revisamos juntos. Lo importante: te doy estabilidad de precio y el "pagas al llegar", que a
> tu escala es mucho capital que no inmovilizas.

*Lección: sacó al cliente grande de la tarifa pública, negoció recurrencia por precio ($1.800
menos al mes), comparó LCL vs FCL, y cerró con el valor del financiamiento a escala.*

## Qué decir / qué NO decir

- ✅ **Dices:** "incluimos un buen margen de peso por m³", "si tu carga es muy densa o muy
  grande te la cotizo a medida", "se confirma con el peso real".
- ❌ **NO dices:** "aguantamos hasta 1.000 kg", "al contenedor nos sobra peso", ni ningún
  número interno ni dato de densidad. Eso es información nuestra.

---

*Relacionado: informe de calibración (confidencial) · brief legal `brief-abogado-parametros-lcl-v3.1.md` · condiciones públicas en [`condiciones-cotizacion.md`](condiciones-cotizacion.md) · config en Studio › Parámetros.*
