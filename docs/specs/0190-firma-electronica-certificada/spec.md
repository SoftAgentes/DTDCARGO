---
sdd: "0190"
title: "Firma electrónica certificada (PSC · SUSCERTE)"
status: draft
author: "Sam (founder) + Claude"
created: 2026-07-30
updated: 2026-07-30
supersedes: null
superseded_by: null
related: ["0054", "0067", "0188", "0189"]
confidencialidad: interno
---

# SDD-0190 — Firma electrónica certificada (PSC · SUSCERTE)

> **`draft` a propósito.** Esta spec **no se implementa** hasta que la abogada
> defina el mecanismo. Existe para que la decisión llegue con los datos ya
> levantados, no para autorizar trabajo. Mismo criterio que la excepción del piso
> de 1 m³ en `docs/legal/ACUERDO-PENDIENTES-v3.1.md` §5.

## 1. El problema, en una tabla

La cláusula **13.1** del Acuerdo de Servicios tiene un placeholder abierto:

> *"Fundamento legal: Ley sobre Mensajes de Datos y Firmas Electrónicas,
> arts. `[__]` (eficacia probatoria de la aceptación electrónica)."*
> — `docs/legal/acuerdo-servicios-v3.mdx:127`

**La respuesta honesta hoy es "arts. 4 y 17", no "16 y 18".** Y esa diferencia es
toda la spec:

| Escalón | Qué es | Valor probatorio | Dónde está DTD |
|---|---|---|---|
| Mensaje de datos | El documento electrónico | **Art. 4** — misma eficacia que un documento escrito | ✅ acá |
| Firma electrónica **no certificada** | Hash propio, casilla, firma dibujada | **Art. 17** — *elemento de convicción valorable conforme a las reglas de la sana crítica*. **No** equivale a firma autógrafa | ✅ acá |
| Firma electrónica **certificada por un PSC** | Certificado de un proveedor acreditado por SUSCERTE | **Arts. 16 y 18** — misma validez y eficacia que la **firma autógrafa** | ❌ no |

**Qué cambia en la práctica.** Hoy, si un cliente niega haber aceptado, le toca a
DTD convencer al juez bajo sana crítica. Con certificado de PSC, el art. 18 remite
al 16 y la equivalencia es **automática**: quien niega es quien tiene que probar.

El hash actual **no es inútil** — es de las mejores evidencias no certificadas que
se pueden armar (append-only por trigger, sellado server-side, IP y user-agent).
Simplemente **no invierte la carga de la prueba**.

⚠️ **Prerrequisito:** sin el Slice A de [SDD-0188](../0188-integridad-documental-derechos-titular/spec.md)
—sellar el contenido y hacer inmutable el documento— un certificado de PSC no
arregla nada, porque el **art. 16.3** exige *no alterar la integridad del Mensaje
de Datos*. Primero se sella; después, si hace falta, se certifica.

## 2. Los 6 PSC acreditados por SUSCERTE

| Marca | Nombre en el listado SUSCERTE | Contacto |
|---|---|---|
| Apacuana | Soluciones Tecnológicas Apacuana C.A. | contacto@apacuana.com |
| FirmeDigital | Documentos Digitales PSC | soporte@firmedigital.com |
| Chinchin | Soluciones Financieras Chinchin | info@pagochinchin.com |
| FIIIDT / CSICE *(público)* | Fundación Instituto de Ingeniería para Investigación y Desarrollo Tecnológico | csice@fii.gob.ve |
| PROCERT | Proveedor de Certificados PROCERT C.A. | contacto@procert.net.ve |
| Authenology | aparece como "Authenticsing" en la web | contacto@authenology.com.ve |

⚠️ La acreditación se otorga **y se revoca** por providencia administrativa.
Verificar vigencia en <https://www.suscerte.gob.ve/> antes de contratar, no contra
esta tabla.

⚠️ **Certificados extranjeros (DocuSign, Adobe Sign):** por el **art. 44** solo
alcanzan la eficacia del art. 16 si un PSC venezolano acreditado los garantiza.
Contratar DocuSign sin eso deja el acto en el art. 17 igual que ahora.

## 3. Recomendación: híbrido por valor del acto

No meter a todos los clientes en un certificado. Tres niveles:

| Nivel | Quién firma | Escalón | Costo y fricción |
|---|---|---|---|
| **Flujo masivo** — aceptar T&C en el Portal | Nadie certifica | Art. 17, **reforzado** por SDD-0188 Slice A | Cero |
| ⭐ **DTD firma el documento publicado** | DTD, como persona jurídica | El documento publicado queda con autoría e integridad certificadas | Un certificado, una vez |
| **Actos de alto valor** | El cliente, con certificado | Arts. 16 y 18 | Alto — solo donde se justifica |

**El escalón del medio es el de mejor costo/beneficio:** certifica la mitad de la
ecuación (que el texto publicado es el que DTD publicó y no cambió) **sin obligar
a ningún cliente a nada**.

**Candidatos al tercer nivel**, por orden de exposición económica:
1. **Renuncia al seguro** (Acuerdo cl. 6.3) — el cliente renuncia a reclamar por
   pérdida total. Es el acto de mayor impacto que hoy descansa en el art. 17.
2. Contratos de **aliados white-label**.
3. Contrato **Canopy ↔ DTD Services**.
4. La excepción del **piso de 1 m³** (`lib/calculadora.ts`, marcada
   `🔶 PENDIENTE LEGAL`).

## 4. Lo que sí se puede hacer ya, sin decisión legal

Esto **no** está bloqueado y se puede sacar en cualquier momento:

- **Corregir el copy.** Quitar "firmado", "firma digital" y equivalentes de toda
  interfaz y documento donde el respaldo sea el art. 17. Decir "aceptado" o
  "aceptación registrada". Publicar que algo está "firmado" cuando no lo está es
  una afirmación falsa sobre el propio sistema.
- **Guardar el texto exacto mostrado** en la aceptación (cubierto por SDD-0188
  Slice A).
- **Cotizar** a Apacuana, FirmeDigital y Authenology el certificado de **persona
  jurídica** para DTD. Es información, no compromiso.

## 5. Decisiones que bloquean

Ninguna de estas la puede tomar un agente ni el equipo técnico:

1. ¿Los arts. del placeholder de la cláusula 13.1 se rellenan con **4 y 17**
   (estado real) o se contrata un PSC para poder poner **16 y 18**?
2. ¿DTD certifica su firma de persona jurídica? ¿Con cuál de los seis?
3. ¿Qué actos exigen certificado del **cliente**, y sobre qué umbral?
4. ¿Se usa algún certificado extranjero? Si sí, ¿qué PSC venezolano lo garantiza
   (art. 44)?

## 6. Allowlist

Vacía mientras siga en `draft`. No hay código autorizado por esta spec.

## 7. Aceptación

- [ ] La abogada responde las cuatro decisiones de §5.
- [ ] El placeholder `[__]` de la cláusula 13.1 queda resuelto en el Acuerdo v3.1.
- [ ] El copy de interfaz no dice "firmado" donde el respaldo es el art. 17.
- [ ] Si se decide contratar un PSC, esta spec pasa a `proposed` con allowlist real.
