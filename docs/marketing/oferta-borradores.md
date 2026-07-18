# Oferta — decisiones cerradas del founder

> **Qué es:** el copy y la estructura de los 3 paquetes de [`adquisicion.md`](adquisicion.md) §2.
> **Decisiones del founder cerradas 2026-07-17** (antes borrador). Regla de nombre vigente: el
> servicio se llama **Puerta a Puerta**; "DDP" solo como aclaración interna.

## 1. El ancla — "Un Solo Precio, Hasta Tu Puerta" ✅

Para todo mayorista. El servicio Puerta a Puerta, todo incluido, pagas al llegar.

**Pitch de WhatsApp (copiable):**
> Nuestro servicio Puerta a Puerta funciona así: me dices qué traes, te doy UN precio por metro
> cúbico que lo incluye TODO — flete, aduana, impuestos y entrega en tu puerta. Una vez medida tu
> carga en China, ese número es el final: cero cobros sorpresa en destino. Y lo mejor: no adelantas
> nada — pagas cuando tu carga llega.

**Letra chica (ya cubierta por [`condiciones-cotizacion.md`](condiciones-cotizacion.md)):** el
estimado web es referencial; el precio se fija con peso/volumen reales al recibir la carga; aplica
franquicia de peso (sin publicar números); "pagas al llegar" con asterisco "* pueden aplicar
restricciones".

**Precio y pesos = atados a la calculadora** (decisión founder): la tarifa y los topes de peso NO se
hardcodean en el copy ni en los docs — **la calculadora es la fuente de verdad** (config editable).
El copy comercial habla de condiciones, nunca de números.

## 2. El piloto — "Pruébanos con un Metro" ✅

Para el mayorista nuevo que duda. Primer embarque chico para que te pruebe.

**Pitch de WhatsApp (copiable):**
> Si nunca has trabajado con nosotros, empieza chiquito: tu primer embarque desde medio metro
> cúbico. Yo mismo te armo el estimado y el packing list, sigues tu carga por el portal en cada
> paso, y tienes un asesor fijo — no un bot. Cuando veas cómo llega, hablamos de tu reposición
> mensual con tarifa preferencial.

**Condición:** perfil mayorista con intención de recompra (30-45 días). No es para compra única.

**Garantía de fecha — DECISIÓN: medir el tránsito real primero** ✅. NO se promete todavía. Antes de
lanzar cualquier crédito por demora (idea: 10-15% del flete al próximo embarque si nos pasamos de la
ventana >7 días, estilo APL OceanGuaranteed), revisar los tiempos reales de los últimos 6 meses y
solo prometerla si la ventana se cumple ≥90%.

## 3. Los dos tipos de "aliado" (¡NO confundir!) ✅

El founder distingue dos cosas que ambas se decían "aliado":

| Tipo | Qué es | Relación | Cómo se le vende |
|---|---|---|---|
| **Aliado cliente** (= mayorista) | Comercio que trae SU mercancía de China con nosotros y reabastece cada 30-45 días | Es NUESTRO cliente directo | Paquetes 1 y 2 + tarifa preferencial por cadencia |
| **Aliado comercial** (white-label) | Revende NUESTRO servicio logístico bajo su marca; **atiende él a sus propios clientes** (DTD no los toca) | Es un cliente con **tarifa fija especial** que él marca a su gusto | Programa **"Aliados DTD"** (§4) |

Cuando en marketing se dice "aliados" a secas, es el programa white-label (§4). El mayorista es
"mayorista" o "cliente ancla". Esta distinción va en todo el copy para no confundir.

## 4. "Aliados DTD" — el programa white-label ✅

**Nombre público: "Aliados DTD"** (se mantiene la palabra; los docs separan aliado-cliente de
aliado-comercial para que no choque).

**El modelo (corregido por el founder — NO es % de margen):**
- El aliado comercial es un **cliente con tarifa fija especial**: DTD le da un precio fijo por CBM,
  **él revende al precio que quiera** y **atiende él mismo a sus clientes**. DTD no atiende a los
  clientes del aliado.
- **Nivel Referidor** (solo pasa el contacto, no revende ni atiende): **monto fijo por CBM** del
  embarque referido *(el $ exacto queda por definir con los números de margen en mano)*. Recurrente
  mientras el referido embarque.

**Lo que hay que CONSTRUIR para el white-label** (pieza de sistema, no marketing — ver
[`adquisicion.md`](adquisicion.md) §7 y memoria):
- Un espacio tipo **tenant aparte** para el aliado dentro de la plataforma, con **lectura de nuestro
  tracking y datos** para sus clientes.
- **Codificación de letras** propia del aliado para que asigne/identifique a sus usuarios.
- **Billing del aliado: POR DEFINIR** (cómo se le factura / concilia la tarifa fija). Es el gate.
- Base ya existente: arquitectura multi-tenant + portal (SDD-0042); el white-label es extensión.

**Pitch de reclutamiento (copiable):**
> Tú tienes los clientes, nosotros tenemos la operación en Yiwu y Valencia. Te doy una tarifa fija
> por metro cúbico, tú la revendes al precio que quieras y manejas a tus propios clientes — ellos
> siguen su carga en un portal con tu marca. Sin oficina en China, sin nómina, sin tocar aduana.

## 5. El guion del referido (para el asesor, día 30-45)

> [Nombre], me alegra que llegara todo bien. Una pregunta: ¿conoces a otro comerciante que traiga
> de China o quiera empezar? Preséntamelo y por cada embarque que haga, tú recibes [monto por CBM]
> en tu próximo flete. Solo pásame el contacto y yo me encargo.

## Estado de las decisiones (2026-07-17)

| # | Decisión | Estado |
|---|---|---|
| 1 | Nombres de los paquetes | ✅ Un Solo Precio, Hasta Tu Puerta · Pruébanos con un Metro · Aliados DTD |
| 2 | Garantía de fecha | ✅ Medir tránsito real primero (no prometer aún) |
| 3 | Comisión del referidor | ✅ Monto fijo por CBM — **falta el $ exacto** |
| 4 | Comisión del aliado white-label | ✅ NO es %: es tarifa fija (cliente especial). **Falta: módulo white-label + billing** |
| 5 | Tarifa preferencial + pesos | ✅ Atados a la **calculadora** (config = fuente de verdad); cadencia 30-45 días según volumen (convención de `ventas.md`) |

**Lo que queda por afinar** (números/build, no decisiones de rumbo): el $ por CBM del referidor · el
módulo white-label + su billing · verificar en la calculadora el tope de peso vigente (hoy la oferta
post-terremoto permite hasta 1.000 kg, sobre el oficial de 500 kg, para maquinaria).
