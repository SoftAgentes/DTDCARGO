# Competencia · cómo cobran el volumen chico

> **Qué es esto:** las reglas de precio verificadas de las empresas que compiten con DTD en la ruta
> China→Venezuela, con foco en **el mínimo** (piso de cobro, volumen mínimo facturable y tamaño de
> caja de referencia). Se levantó el **2026-08-01** para validar la medida de la caja mínima de
> reempaque antes de mandarla a fabricar.
>
> **Este archivo se re-verifica, no se acumula.** Cuando alguien vuelva a chequear, actualiza las
> cifras y la fecha de la fila — no agregues una versión nueva abajo.
>
> Fichas de posicionamiento (seguidores, servicios, canal) → [`adquisicion.md`](adquisicion.md) §campo
> competitivo y el dump con fuentes en [`research/INVESTIGACION-adquisicion-clientes.md`](../../research/INVESTIGACION-adquisicion-clientes.md) línea C.
> Acá van **solo los números de precio**.

---

## 1. La caja mínima del mercado = 1 pie cúbico = 30 × 30 × 30 cm

**Ninguna empresa de la ruta China→Venezuela vende ni entrega una caja de reempaque estandarizada.**
Lo revisamos en nueve. El mercado no compite por caja: compite por **cómo cobra el volumen chico**.

Pero sí existe una **unidad de referencia compartida**, heredada del tráfico USA→Venezuela, que se
cobra en pies cúbicos:

> *"un pie cúbico es una caja que tiene medidas de 30 cm de largo, 30 cm de ancho y 30 cm de alto"*
> — Envíos hacia Venezuela

| Unidad | Volumen | Caja de referencia |
|---|---|---|
| **1 pie cúbico** | 0,0283 m³ | **30 × 30 × 30 cm** |
| 2 pies cúbicos | 0,0566 m³ | — |
| Caja mínima DTD | 0,030 m³ = **1,06 ft³** | 40 × 30 × 25 cm |

**Esto valida el 0,03.** El número que el founder tenía en la cabeza es la conversión del pie
cúbico — la unidad mínima que el comerciante venezolano ya conoce, expresada en métrico. No estaba
en `lib/calculadora.ts` porque nunca fue un parámetro nuestro: es convención de mercado.

**Consecuencia para el copy:** decirle a un comerciante **"una caja de un pie cúbico"** comunica
más que "0,03 m³". Nuestra caja es 1,06 ft³ — cabe llamarla así sin faltar a la verdad.

### Los dos mecanismos que sí usan

No confundirlos, porque se comportan distinto:

- **Piso de cobro en dólares** — se cobra el CBM medido, pero nunca menos de X. Es lo más común.
- **Volumen mínimo facturable** — por debajo de X CBM, se factura X igual.

---

## 2. AsiaVen Cargo · motor de precios completo

`asiavencargo.com/calculadora/` · verificado 2026-08-01

Su calculadora es pública y **toda la lógica viaja en JavaScript del lado del cliente**. Lo de abajo
está leído de su código, no de su marketing.

| Regla | Valor |
|---|---|
| Tarifa por m³ | Valencia **920** · Maracay 940 · Caracas 960 · Miranda 980 · Barquisimeto 1.000 · Oriental / Llanos-Andes / Occidental 1.100 · Porlamar 1.200 |
| **Piso mínimo** | **50** |
| Densidad · tramo 1 | > 380 kg/m³ → **+55** al precio del m³ |
| Densidad · tramo 2 | > 1.000 kg/m³ → deja de cobrar por volumen y cobra **por peso**: 0,92 /kg (Valencia) … 1,20 /kg (Porlamar) |
| Madera / paleta | +50 |
| Baterías | **× 2** sobre el precio base |
| Volumen mínimo | **no tiene** — cobran el CBM medido, con el piso de 50 |

⚠️ **La moneda no está clara.** El campo de resultado de su calculadora está rotulado **«(€)»**
mientras el mercado opera en dólares. Puede ser un descuido de plantilla. Si el número va a sostener
una decisión de precio, hay que confirmarlo cotizando como cliente.

---

## 3. Import2Ven · tarifas publicadas

`import2ven.com/calculadora-de-envios-maritimos/` · verificado 2026-08-01

| Destino | USD / m³ |
|---|---|
| **Valencia** | **905** |
| Maracay | 930 |
| Caracas | 970 |
| Barquisimeto | 1.030 |
| Otros estados | 1.130 |
| Nueva Esparta | 1.240 |

- Entrada comunicada: **"desde una caja pequeña de $39 USD vía marítimo"** → el $39 opera como piso
  de facto (equivale a 0,043 m³ a la tarifa de Valencia).
- **Aéreo sin mínimo de envío** (15 días); marítimo 60 días.
- Ofrecen **financiamiento**: pago diferido hasta el arribo a puerto venezolano.
- Su calculadora pide los mismos campos que la nuestra: dimensiones, peso, cantidad de cajas, tipo de
  embalaje (cartón / madera / paleta) y si lleva baterías.
- Nota en su sitio: *"tarifas aplicadas para solo pagos en divisas"*.

---

## 4. El resto del campo

| Empresa | Ruta | Mínimo declarado | Verificado |
|---|---|---|---|
| **Cómpralo China** | CN→VE | marítimo **desde 0,125 CBM** · aéreo desde 5 kg | 2026-08-01 |
| **GLE Cargo** | CN→VE | marítimo **mínimo 1 m³** (consolidado con BL propio) | 2026-08-01 |
| **Instacaja** (comercial) | CN→VE | **$1.000/m³ + reparto**; exige factura comercial y entrega del proveedor en Guangzhou; almacenaje > 15 días a $2,50 diarios por CBM | 2026-08-01 |
| **VPL** | CN→VE | $1,2/kg puerta a puerta · 20' $4.500 · 40' $5.000; no publica mínimo | 2026-08-01 |
| **Envíos hacia Venezuela** | USA→VE | marítimo **mínimo $25** · aéreo mínimo **5 libras** | 2026-08-01 |
| **One Way Cargo** | USA→VE | marítimo **mínimo 1 pie cúbico** (región central) · **2 pies cúbicos** (resto del país) · aéreo 1 libra / 6 libras | 2026-08-01 |
| **Tealca USA** | USA→VE | **mínimo $60 por guía** (≈ 2 pies cúbicos) | 2026-08-01 |

⚠️ **Las últimas tres son ruta USA→Venezuela, no China.** No son competencia directa: el flete es
mucho más corto y barato. Están acá porque **son las que fijaron la convención del pie cúbico** que
el cliente venezolano trae puesta cuando nos escribe.

**Dato que confirma una regla nuestra:** el mínimo de 1 m³ de GLE coincide exacto con nuestro
`CONSOLIDADO_CBM_MINIMO = 1` ([`lib/calculadora.ts:219`](../../lib/calculadora.ts)). Ese piso es
convención del sector, no una rareza de DTD.

---

## 5. Dónde queda DTD

| | **DTD** | AsiaVen | Import2Ven |
|---|---|---|---|
| Tarifa Valencia / m³ | **$800** ⭐ | 920 | $905 |
| Piso de cobro | $50 | 50 | ~$39 |
| **El piso deja de morder en** | **0,0625 m³** 🔴 | 0,054 m³ | 0,043 m³ |
| Densidad incluida | **500 kg/m³** ⭐ | 380 kg/m³ | n/d |
| Recargo por densidad | $1/kg excedente | +55/m³, o cobro por peso sobre 1.000 kg/m³ | n/d |
| Baterías | **× 1,5** ⭐ | × 2 | n/d |
| Embalaje especial | $50 | 50 | n/d |
| Tarifa publicada sin registro | sí | sí | sí |

**Somos los más baratos en tarifa base y los más blandos en densidad y baterías.** La tarifa de
Valencia está 13 % por debajo de AsiaVen y 12 % por debajo de Import2Ven, y damos 120 kg/m³ más de
gracia de peso antes de recargar.

**El piso es el único frente donde el cliente chico nos ve más caros que el líder.** Con $50 sobre
una tarifa de $800, muerde hasta 0,0625 m³: hacen falta **3 cajas mínimas** para pagar tarifa limpia,
contra ~2 en AsiaVen y ~1,5 en Import2Ven.

### ✅ Decisión del founder (2026-08-01): el piso se queda en $50

**Es deliberado, no una brecha.** El cliente chico no es nuestro objetivo — el norte interno son
2 contenedores/mes vía mayoristas recurrentes ([`estrategia.md`](estrategia.md)), y un envío de una
caja consume la misma atención de asesor, la misma línea de aduana y el mismo cupo de galpón que uno
de 3 m³. **El piso funciona como filtro de segmento**, no como error de precio.

Consecuencia práctica: **no volver a proponer bajarlo** como "mejora competitiva". Si algún día
cambia el objetivo comercial, el número vive en `CONFIG.minimoFacturable`
([`lib/calculadora.ts:113`](../../lib/calculadora.ts)) y se edita desde `/studio/tarifas ›
Parámetros`, sin desplegar código.

**Dónde sí competimos:** tarifa base 13 % bajo el líder, más gracia de peso y menos recargo por
baterías. Todas esas ventajas **crecen con el volumen** — o sea, pegan justo en el cliente que
queremos.

---

## 6. ⚠️ Una afirmación del dump de julio quedó falsada

[`research/INVESTIGACION-adquisicion-clientes.md`](../../research/INVESTIGACION-adquisicion-clientes.md)
(jul-2026) línea 240 dice:

> *"La opacidad de precio es la norma. **Solo VPL publica un número**; el resto exige registro o DM.
> Una calculadora pública con tarifa LCL/DDP visible es un diferenciador real y raro en el nicho."*

**Hoy publican números al menos cinco:** Asiaven (su calculadora), Import2Ven (tabla por destino),
Instacaja ($1.000/m³), Envíos hacia Venezuela ($25 mínimo) y One Way Cargo (mínimos en pies cúbicos).

**Por qué importa:** de esa frase cuelga la recomendación *"la calculadora pública es el arma
competitiva #1"*, que aparece dos veces más en el mismo documento (líneas 274 y 284). Si el líder
también publica, esa arma vale menos y la diferenciación hay que apoyarla en otra parte:
- ❌ ya no es *"somos los únicos que publicamos precio"*
- ✅ sigue siendo **precio más bajo** (13 % bajo el líder, verificado), **"pagas al llegar"** (que
  nadie del campo comunica como promesa central) y **cadencia de recompra** (que nadie vende como
  producto)

**El precio de esa calculadora ES el precio real** (founder, 2026-08-01). Lo presentan como
"estimado" por resguardo legal, para poder ajustar contra la medición real en almacén — igual que
hacemos nosotros. No es un número de vitrina: es lo que cobran.

### La única salvedad

**No sabemos desde cuándo está pública esa calculadora.** Verificamos que hoy lo está; no que lo
estuviera en julio. Y la explicación de por qué se nos pasó es simple: **la página de Asiaven que se
llama `/tarifa/` no trae tarifas** — solo el pitch "pagas por CBM, no por peso". Los números viven en
`/calculadora/`. Quien investigó en julio abrió la primera, que es la que uno abriría.

El dump no se edita — es un documento fechado. Esta ficha lo anota desde afuera.

---

## Método y limitaciones

- **AsiaVen** e **Import2Ven**: cifras leídas de sus calculadoras públicas — en AsiaVen, del código
  JavaScript del lado del cliente. Es lo que su propia herramienta le muestra a cualquiera.
- El resto: texto publicado en sus sitios.
- **No cotizamos como cliente.** Nadie nos pasó una tarifa por WhatsApp ni por DM, que es donde
  varias de estas empresas dan el número real. **Lo publicado puede diferir de lo que cobran.**
- Los precios del flete China→Venezuela se mueven con la temporada y con el costo del contenedor:
  esta foto vale para el trimestre, no para el año.
- Nueve empresas revisadas. No es el censo del mercado: es el campo visible en búsqueda pública.

**Fuentes:** asiavencargo.com · import2ven.com · compralochina.com · instacaja.com · gle-cargo.com ·
vpl-ve.com · envioshaciavenezuela.com · onewaycargo.net · tealca.us
