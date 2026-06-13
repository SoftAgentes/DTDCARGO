# SENIAT · investigación normativa (deep search 2026-06-12)

> **Qué es:** síntesis de un deep search (22 fuentes, 25 claims, verificación adversarial 3-votos; 20
> confirmados / 5 refutados) sobre el régimen fiscal del SENIAT vigente en 2026, para fundamentar la
> **configuración** del módulo Fiscal (SDD-0073). **No es asesoría fiscal** — los valores finales los
> confirma el contador (ver §Pendientes). Fuentes secundarias (firmas tributarias) verificadas contra
> texto cuasi-primario (IVECOFI `tributos.ivecofi.net`, PDFs de Gaceta Oficial). No se accedió al
> portal oficial seniat.gob.ve de primera mano.

## 1. Facturación por medios digitales (lo más reciente)

- **Providencias `SNAT/2024/000102` (uso de medios digitales) + `SNAT/2024/000121` (requisitos a los
  proveedores de sistemas)** — ambas en **Gaceta Oficial N° 43.032 del 19-dic-2024**; obligatorias
  desde **~1-mar-2025** (primer día del 3er mes tras publicación). La 102 deroga la vieja
  `SNAT/2014/0032` (mantiene válidas las autorizaciones previas). *(confianza alta, 3-0)*
- **Software homologado obligatorio:** los sistemas que emiten facturas digitales deben estar
  **previamente homologados/autorizados por el SENIAT**, y el **proveedor debe estar domiciliado en
  Venezuela** (Art. 2 de la 121). **Implicación dura: el ERP NO puede autogenerar facturas fiscales
  válidas por su cuenta — requiere integrar un proveedor/sistema homologado.** *(alta, 3-0)*
- **Número de control:** lo **asigna la imprenta digital autorizada** (no el ERP); formato =
  **identificador de 2 dígitos + secuencial de hasta 8** (ej. `00-00000001`). La imprenta también
  valida la estructura de los documentos (Arts. 29-30 de la 102). *(alta, 3-0)*
- **Alcance (CLAVE para DTD):** obligatoria solo para quienes operan **exclusivamente** por medios
  electrónicos/portales web (Art. 4); para usuarios de máquina fiscal que además venden online, solo
  para esas operaciones (Art. 5, separadas en el Libro de Ventas, Art. 6); para los demás es
  **opcional con autorización previa** (Art. 3). **Una transportista exenta que factura por canales
  normales NO está obligada** → confirma el diseño activable/desactivable. *(alta, 3-0)*
- Cubre 5 documentos: factura, **nota de crédito, nota de débito, orden de entrega/guía de despacho,
  comprobante de retención** (Art. 2 de la 102). *(alta, 3-0)*

## 2. Alícuotas de IVA vigentes

- **General 16%** (Art. 63 LIVA) · **reducida 8%** · **exportación 0%** · **suntuaria 31%** = 16% +
  **15% de alícuota adicional**. La banda del Art. 27 (8%–16,5%) faculta al Ejecutivo a mover la
  general. Origen: reforma 2018 (G.O. Ext. 6.396), texto consolidado G.O. 6.507 (29-ene-2020); las 4
  tasas siguen vigentes per PwC ene-2026. *(alta, 3-0)*

## 3. IGTF (Impuesto a las Grandes Transacciones Financieras)

- **3% sobre pagos en divisas / cripto** distintas al bolívar y al petro (Art. 24), reforma **G.O.
  Ext. 6.687 del 25-feb-2022** (aplicación 28-mar-2022). *(alta, 3-0)*
- **Lo perciben los Sujetos Pasivos Especiales** designados **agentes de percepción** (Providencia
  `SNAT/2022/000013`, G.O. 42.339, 17-mar-2022). *(alta, 3-0)*
- **IGTF en bolívares (numerales 1-4) a 0% desde el 15-jul-2024** (Decreto 4.972, G.O. Ext. 6.821);
  **los numerales 5-6 (divisas/cripto) siguen al 3%**. Pagos con **tarjeta** en divisa **exonerados**
  (solo efectivo/no-tarjeta en divisa tributa). *(alta, 3-0)*
- **Relevante para DTD:** cobra en USD → si es SPE, percibe IGTF 3% al cobrar en divisa.

## 4. Libros de IVA

- **Libro de Compras + Libro de Ventas** obligatorios (Art. 56 LIVA + Art. 70 RLIVA). Contenido en
  **Art. 75 RLIVA (Compras, incluye declaración de Aduanas para importaciones)** y **Art. 76 RLIVA
  (Ventas)**; Arts. 77-78 = totalización/resumen. La reforma 2020 no tocó el régimen de libros.
  *(alta, 3-0)* → confirma el diseño de **libros separados**.

## 5. Refutados (NO usar)

- ❌ Número de control de "exactamente 8 dígitos" (es 2 + hasta 8). · ❌ IGTF divisas "2%–20%" (es 3%;
  esa banda mezcla numerales). · ❌ Obligatoriedad de la 102 el "20-mar-2025" (consenso ~1-mar-2025).
  · ❌ "Todas las personas pagan IGTF en divisas desde 2022" (el alcance vía SPE/percepción es más
  matizado).

## 6. Pendientes / a confirmar con el contador (load-bearing)

1. **Base legal exacta de la EXENCIÓN del transporte/flete internacional** — NO quedó verificada.
   Revisar Arts. 16 (no sujeción) y 17-19 (exenciones) de la LIVA + última reforma. **El supuesto
   "exento" de DTD descansa en esto.** ⚠️ Una fuente menciona un **decreto 2026 de SUSPENSIÓN de
   exenciones del IVA a la importación** (Grant Thornton / Acceso a la Justicia) — verificar si afecta.
2. **Columnas exactas de los Arts. 75/76 RLIVA** — para diseñar las tablas de los libros (fecha, nº
   factura, nº control, RIF contraparte, base por alícuota, IVA, exento/exonerado, totales).
3. **Régimen de RETENCIONES de IVA** — providencia histórica `SNAT/2015/0049`; porcentajes (75%/100%),
   formato/numeración del comprobante, plazos. No quedó confirmado el detalle vigente.
4. **Listado oficial de imprentas digitales / sistemas homologados** bajo la PA-00121 (estado abierto).
5. **¿DTD es Sujeto Pasivo Especial?** — dato de hecho ante el SENIAT; determina si activa percepción
   de IGTF y retención de IVA.

## Fuentes principales
- IVECOFI (repo de legislación, cuasi-primario): `tributos.ivecofi.net` — PA 2024-102, 2024-121,
  2022-013, Decreto 4.972.
- PwC Venezuela (facturación digital 2025; corporate other-taxes ene-2026).
- Galac, Nayma, Rodríguez Carracedo, Moore, Grant Thornton, Prodavinci (firmas tributarias).
- Gaceta Oficial (PDFs vía Grant Thornton / Baker Tilly).
