# Investigación — Baterías de litio: exportación marítima China → Venezuela
**DTD Cargo · junio 2026 · fuentes 2024–2026 verificadas**
Síntesis de 5 investigaciones paralelas (IMDG 42-24, normas chinas, navieras, consolidadores, sanciones).

## 1. Resumen ejecutivo
SÍ se pueden enviar baterías y productos con batería por mar desde China — es legal y rutinario —
pero solo por el canal correcto: documentos del fabricante, bodega DG certificada y declaración
como Clase 9. NO hay atajo: desde 2024–2025 los puertos chinos (Ningbo) y las navieras endurecieron
controles con filtros automáticos, y **una sola caja no declarada contamina el contenedor LCL completo**
(afecta a TODOS los clientes de ese contenedor).

La distinción que ordena todo es el tamaño:
- **Pequeñas (≤20 Wh celda / ≤100 Wh pack)** → régimen simplificado SP188: sin declaración DG completa,
  solo marca de batería en la caja, embalaje antichoque/anticorto y drop test 1.2 m. Aquí caen casi todos
  los powerbanks, teléfonos, laptops y electrónica de consumo.
- **Grandes (>100 Wh) o vehículos (scooters/e-bikes)** → DG pleno: UN38.3 + MSDS + 危包证 + caja UN 4G +
  declaración DG + bodega DG + recargo. Vehículos: desde 2026 ya no es UN3171 sino UN3556 (litio-ion);
  las navieras rechazan el código viejo automáticamente.

## 2. Tabla por escenario
| Escenario | UN / régimen | Documentos | ¿LCL en DTD? |
|---|---|---|---|
| Powerbank/celular/laptop ≤100 Wh | UN3481 SP188 | UN38.3 + MSDS + marca en caja + Wh impreso | Sí, embalaje correcto |
| Electrónica con batería ≤100 Wh | UN3481 SP188 | Igual; equipo con protección | Sí |
| Batería suelta >100 Wh (solar/UPS) | UN3480 DG pleno | UN38.3 + MSDS <12m + 危包证 + caja UN 4G + DGD + etiqueta Clase 9 | Solo vía bodega DG + recargo |
| Scooter/e-bike/vehículo | UN3556 (2026; P912) | Todo + SoC ≤30% (Wh>100) + placas 4 lados | Igual; coordinación especial |
| Batería e-bike fabricada en China | + GB 43854-2024 y CCC (nov-2025) | Fabricante debe tener CCC | Verificar CCC |
| Batería usada/dañada | P908/LP904 | Caso por caso | Recomendado rechazar |

## 3. Documentos (qué es y quién lo da)
1. **UN38.3 Test Summary** — el fabricante; resumen de las 8 pruebas; obligatorio junto con MSDS en Ningbo
   desde oct-2025; debe coincidir con el modelo exacto; lab acreditado CNAS (SGS/TÜV/Intertek/UL).
2. **MSDS/SDS** — el fabricante; GHS 16 secciones; <12 meses; Sección 14 (transporte).
3. **危包证 (certificado de embalaje DG)** — el fabricante lo tramita con aduana china; validez 1 año
   marítimo. Si una fábrica no lo tiene → red flag (o la batería no lo necesita por SP188, o no exporta legal).
4. **Declaración DG (DGD)** — el embarcador/forwarder; no aplica a SP188.
5. **Wh impreso en la batería** — obligatorio desde may-2024. Fraude común: vender >100 Wh etiquetadas
   "100 Wh" para colarse en SP188 (verificable: Wh = mAh × V ÷ 1000).

## 4. Cambios 2024–2026
- **IMDG 42-24 (obligatorio ene-2026):** vehículos UN3171 → UN3556/3557/3558; baterías de sodio (UN3551/3552);
  navieras rechazan automáticamente el código viejo.
- **Ningbo (oct-2025):** UN38.3 + SDS ambos obligatorios, ~7 días de antelación (puerto de salida de Yiwu).
- **CCC chino:** powerbanks/portátiles desde ago-2024; e-bikes desde nov-2025. (Aplica a venta doméstica en
  China; pero como el cliente compra en Alibaba/1688 = transacción doméstica, el producto debería traer CCC;
  sin CCC = señal de producto incertificable.)
- **Controles export MOFCOM (≥300 Wh/kg):** suspendidos hasta nov-2026 — no afectan carga de consumo.
- **SoC ≤30%:** obligatorio aéreo; en marítimo es best practice que Maersk/COSCO exigen de facto.

## 5. Flujo operativo real (consolidador en Yiwu)
Documentos al forwarder D-10 → inspección/危包证 3–5 días → entrega en bodega DG certificada D-3 →
declaración portuaria → zarpe. Recargo DG: +20–50% sobre carga general. LCL con baterías existe (en Yiwu
hay consolidadores de "carga sensible" 敏感货), pero exige logística aparte.

## 6. Riesgos si se cuela una caja sin declarar (argumento de negocio)
- **Multas de navieras:** Evergreen USD 35.000/contenedor · OOCL 30.000 · Maersk/Hapag/HMM 15.000 (China);
  el embarcador paga todos los costos derivados.
- **Aduana china:** récord 2025 RMB 6,3 M; multa al embarcador RMB 50.000–300.000 (Art. 109 Ley de Seguridad
  de Tráfico Marítimo 2021); caso Shenzhen nov-2024 (baterías UN3480 declaradas como carga general).
- **Efecto cascada LCL:** una caja no declarada → inspección del contenedor completo → demurrage USD 5–15/CBM/día
  para todos los clientes → si hay incendio, el seguro rechaza el reclamo completo. Los incendios por baterías
  son la causa #1 de pérdidas en seguros marítimos (Allianz: 250 incendios en 2024, +20% interanual; caso COSCO
  Pacific = baterías declaradas como "repuestos").
- **Destino:** SENIAT en Puerto Cabello/La Guaira escanea; DG no declarada = retención + procedimiento.

## 7. Recomendaciones operativas para DTD
1. **Gate en la pre-alerta:** "¿Tu producto tiene batería?" → tipo, Wh celda/pack, ¿sola o en equipo? →
   el sistema clasifica SP188 vs DG pleno y exige UN38.3+MSDS antes de aceptar la caja.
2. **Política de aceptación (DECISIÓN DE SAM PENDIENTE):** SP188 con papeles → canal normal con recargo
   (el ×1.5 del calculador alinea con el +20–50% del mercado); DG pleno → solo con 危包证 y coordinación;
   rechazar: usadas/dañadas, sin papeles, "100 Wh" sospechosos.
3. **Verificación en bodega Yiwu:** balanza + Wh = mAh×V÷1000; Wh impreso obligatorio desde 2024, si no → cuarentena.
4. El Anexo B del Acuerdo v3 ("baterías sin UN38.3" prohibidas) queda respaldado por esta investigación.

## 8. FAQ listas (tuteo)
**¿Puedo enviar powerbanks o electrónica con batería?** Sí — equipos con baterías pequeñas (hasta 100 Wh)
viajan con trámite simplificado si tu proveedor entrega UN38.3 y MSDS, y la caja lleva su marca de batería.
Indícalo en tu pre-alerta.
**¿Puedo enviar baterías grandes/scooter/paneles solares?** Sí, pero son mercancía peligrosa (Clase 9) y
necesitan UN38.3, MSDS y el certificado chino de embalaje (危包证). Canal especial con recargo; escríbenos antes.
**¿Qué le pido a mi proveedor de Alibaba?** UN38.3 del modelo exacto, MSDS <12 meses, y Wh impreso en la batería.
Ata la entrega de esos documentos al pago por Trade Assurance.
**¿Qué pasa si mando una batería sin declararla?** Es el error más caro: multas de 15.000–35.000 USD por
contenedor, retención y el seguro no responde; y como viaja consolidada, afecta a todos. Por eso en DTD toda
batería se declara.
**¿Por qué las baterías pagan recargo?** Bodega certificada, documentos extra, inspección de aduana china y
manejo especial. Es el costo de que tu carga viaje legal y asegurada.

## Fuentes
- IMDG 42-24 / Maersk: https://www.maersk.com/news/articles/2026/01/06/imdg-code-42-24-battery-vehicles-regulatory-changes
- Ningbo MSA (ONE): https://us.one-line.com/news/new-document-submission-dg-lithium-batteries-ningbo-port
- SAFETY4SEA Ningbo: https://www.safety4sea.com/new-requirements-for-lithium-batters-in-the-port-of-ningbo/
- 危包证: https://goodhopefreight.com/dg/lithium-battery-export.html
- SP188: https://shashikallada.com/2025/10/25/understanding-imdg-code-special-provision-sp-188-for-lithium-sodium-batteries/
- CCC/UL: https://www.ul.com/news/ccc-certification-li-ion-batteries-around-corner
- MOFCOM suspensión: https://rareearthexchanges.com/news/china-temporarily-lifts-export-controls-on-rare-earths-and-battery-materials/
- Multas navieras: https://www.shippingandfreightresource.com/dangerous-goods-misdeclaration/
- TT Club CINS jun-2025: https://www.ttclub.com/fileadmin/uploads/tt-club/Documents/CINS_Lithium-ion_Cells_Guidelines_June_2025__003_.pdf
- Allianz AGCS: https://commercial.allianz.com/news-and-insights/news/lithium-ion-batteries.html
- Ley Seguridad Tráfico Marítimo China 2021: https://en.chinajusticeobserver.com/law/x/maritime-traffic-safety-law
