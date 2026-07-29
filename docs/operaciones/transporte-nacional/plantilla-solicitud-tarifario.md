# Plantilla — qué pedirle a cada transportista

Cuestionario único. **Las mismas preguntas a los 4-6 proveedores**, o las ofertas
no se pueden comparar. Cada respuesta se guarda en la ficha del proveedor.

---

## Parte 1 · Identidad y facturación

| # | Pregunta | Por qué importa |
|---|---|---|
| 1.1 | Razón social exacta y **RIF** | Si la empresa opera con dos nombres, hay que saber **con cuál se factura**. Un RIF distinto = otro contribuyente, otra retención, otro riesgo fiscal. |
| 1.2 | ¿Una sola empresa o varias razones sociales? ¿Cuál emite la factura? | Ídem. |
| 1.3 | Domicilio fiscal y almacén de recepción en Valencia | Define si recogen o hay que llevar la carga. |
| 1.4 | ¿Emiten factura fiscal con IVA? | Sin factura no hay crédito fiscal ni asiento limpio. |
| 1.5 | Póliza de responsabilidad sobre la carga: ¿monto y qué cubre? | Es el riesgo real cuando se pierde un bulto del cliente. |

## Parte 2 · El modelo de cobro (la parte que decide todo)

Preguntar **cuál de los tres** aplican, y si ofrecen más de uno, pedir los dos y
comparar:

**A) Si es % ad valorem (% del valor de la mercancía)**
- 2.1 El % de **cada zona** — no solo una de muestra
- 2.2 ¿% sobre qué base exactamente: valor FOB, CIF, o valor declarado en aduana?
- 2.3 ¿Piso y techo? (un mínimo en USD por despacho y un tope por guía)
- 2.4 ¿Cómo verifican el valor? ¿Exigen factura comercial?
- 2.5 ¿Qué pasa si la mercancía es de bajo valor pero mucho volumen?

**B) Si es USD/kg (peso o volumétrico)**
- 2.6 **El factor volumétrico: ¿cuántos kg por m³?** ← *el número más importante de
  toda la negociación.* GAG usa 200. Con 333 el mismo bulto sube 66%.
- 2.7 ¿Peso facturable = MAX(peso real, volumétrico), o suman ambos?
- 2.8 Tabla completa de **tramos de peso × zona** en USD/kg
- 2.9 ¿Hay tarifa mínima por guía?

**C) Para cualquier modelo**
- 2.10 **Mapa de zonas**: qué ciudad cae en qué zona, saliendo de Valencia
- 2.11 Qué va **aparte** del flete: FPO, seguro, IVA, manejo, estiba, entrega a domicilio
- 2.12 **Vigencia** de la tarifa y cada cuánto la revisan
- 2.13 ¿Tarifa diferenciada por **volumen recurrente / contrato**? (nuestra carta:
  llegada constante de contenedores por Puerto Cabello)
- 2.14 Forma de pago: ¿anticipado, crédito, a cuántos días?

## Parte 3 · Servicio (lo que le prometemos al cliente)

| # | Pregunta | Por qué importa |
|---|---|---|
| 3.1 | **Días de salida** por destino | El cliente no espera el tránsito, espera *salida + tránsito*. |
| 3.2 | **Tiempo de tránsito** por destino | Ídem — son dos números distintos, pedir los dos. |
| 3.3 | ¿La salida está **garantizada** o depende de que se llene el camión? | "Varía según la consolidez de la carga" = no se puede prometer fecha. |
| 3.4 | ¿Entrega a domicilio o solo a su agencia en destino? | Cambia por completo la promesa "puerta a puerta". |
| 3.5 | ¿Recogen en nuestro almacén de Valencia? ¿Con qué aviso? | Costo operativo oculto. |
| 3.6 | Tracking: ¿número de guía, API, o solo WhatsApp? | Define si se puede integrar al ERP o hay que cargarlo a mano. |
| 3.7 | Prueba de entrega: ¿firma, foto, digital? | Es la defensa ante un reclamo del cliente. |
| 3.8 | Qué **no** transportan (baterías, líquidos, frágiles, sobredimensionado) | La carga de China trae mucho de eso. |
| 3.9 | Destinos con despacho quincenal o irregular | Hay que saberlo antes de venderlo. |

---

## Cómo comparar tres modelos distintos: la canasta

Un % y un USD/kg no se comparan de frente. Se comparan **cotizando lo mismo**.
Pedirle a cada proveedor que cotice **estos escenarios exactos**, y anotar el
resultado en su ficha.

> Factor de referencia: **1 m³ = 200 kg** facturables (el de GAG). Los pesos de
> abajo salen de ahí, para que el escenario sea idéntico para todos.

| # | Perfil | CBM | Peso real | Destino | Valor declarado |
|---|---|---|---|---|---|
| E1 | Muestra / caja suelta | 0,2 | 40 kg | Maracaibo | _completar_ |
| E2 | Pedido chico | 0,5 | 100 kg | Puerto Ordaz | _completar_ |
| E3 | Pedido típico | 1,0 | 200 kg | Maturín | _completar_ |
| E4 | Comerciante mediano | 3,0 | 600 kg | Barquisimeto | _completar_ |
| E5 | Mayorista | 8,0 | 1.600 kg | San Cristóbal | _completar_ |
| E6 | Carga liviana voluminosa | 3,0 | **150 kg** | Cumaná | _completar_ |
| E7 | Carga densa | 1,0 | **900 kg** | Mérida | _completar_ |

**E6 y E7 son las pruebas trampa, no las saltes.** E6 tiene mucho volumen y poco
peso: destapa el factor volumétrico. E7 es lo contrario: destapa si el modelo
castiga la densidad. Un proveedor puede verse barato en E1-E5 y carísimo en esos dos.

> ⚠️ **El valor declarado lo define el founder** — depende de la mercancía real que
> mueven los clientes, y es el dato que decide si el % ad valorem conviene o no.
> Sin ese número, los modelos A y B no se pueden enfrentar. Completar antes de
> mandar la canasta.

## Reglas de la comparación

1. **Mismos escenarios a todos.** Si un proveedor cotiza otra cosa, se le devuelve.
2. **Todo en USD.** Anotar la tasa si alguien cotiza en bolívares.
3. **Precio final al cliente**, con FPO, seguro e IVA incluidos — no el flete pelado.
4. **Anotar quién cubre cada destino.** El más barato que no llega a Maturín no
   sirve para Maturín. Probable que haya que combinar 2-3 proveedores por zona.
5. **Guardar el documento original** que manden (PDF/Excel) junto a la ficha.
