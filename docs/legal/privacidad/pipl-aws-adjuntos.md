# Evaluación PIPL · adjuntos enviados a AWS

**Versión:** 1.0 · 2026-08-03
**Estado:** evaluación técnica preparada; decisión/consentimientos humanos
**NO VERIFICABLES**
**Conservación:** expediente y registro mínimo durante 3 años
**Receptor previsto:** Amazon Web Services, Inc. · `us-east-1` · EE.UU.

## 1 · Alcance territorial

PIPL aplica porque DTD Cargo tiene equipo propio en Yiwu que puede consultar,
capturar o decidir sobre información personal. Un recibo o foto tratado allí y
replicado a `us-east-1` constituye una salida de China. El análisis se apoya en
PIPL arts. 3, 21, 23, 28–30, 38–39 y 55–56.

## 2 · Inventario del flujo

| Dato | Titular | Finalidad | Sensibilidad PIPL | Minimización | Retención AWS |
|---|---|---|---|---|---|
| binario de recibo/factura | empleado, proveedor o tercero | evidencia fiscal/operativa y recuperación | puede contener cuenta financiera, firma, rostro o ubicación | no copiar nombre original ni actor al path | 10 años + 1 día por versión |
| UUID de tenant/documento | usuario/organización seudonimizada | correlación técnica | no sensible por sí solo | key opaca | igual al binario |
| SHA-256, MIME, tamaño y versión | no identifican solos | integridad/restore | metadata técnica | conjunto mínimo | igual al binario |
| resultado antivirus | documento | cuarentena y seguridad | puede revelar nombre de amenaza, no contenido | primera firma, sin volcado del evento | auditoría restringida |

No se envían nombre original, correo, teléfono, Shipping Mark, usuario, URL
firmada, token de Supabase ni payload completo de la entidad.

## 3 · Mecanismo de transferencia

La regla elegida es conservadora y fail-closed:

1. **Datos sintéticos:** pueden usarse para laboratorio y EICAR; no hay titular.
2. **Datos de Venezuela no tratados en China:** se rigen por el aviso/contrato
   venezolano y la evaluación del tercero.
3. **Datos tratados en China:** no se transfieren hasta clasificar y documentar
   uno de estos caminos:
   - excepción de las Disposiciones CAC 2024 art. 5 por necesidad estricta de un
     contrato individual de transporte transfronterizo o gestión laboral; o
   - contrato estándar CAC/certificación cuando no exista excepción y el flujo
     quede bajo los umbrales aplicables; o
   - evaluación de seguridad CAC si DTD fuera infraestructura crítica, tratara
     datos importantes o superara los umbrales regulatorios.

Los recibos pueden incluir información financiera sensible. No se presume la
excepción ni el umbral leyendo el código. La cantidad anual, condición de CII,
datos importantes y necesidad contractual son **NO VERIFICABLES** y debe
confirmarlas asesoría en China. Las Disposiciones CAC 2024 art. 10 mantienen el
aviso, consentimiento separado y evaluación de impacto aun cuando exista una
exención del trámite de contrato/certificación/evaluación.

**Decisión técnica:** hasta esa firma, el gate
`DTD_ATTACHMENTS_PIPL_TRANSFER_VERIFIED_AT` permanece vacío y Producción no
arranca el worker.

## 4 · Consentimiento separado propuesto

Este acto no se incluye dentro de “acepto términos” ni viene premarcado. Debe
registrarse por finalidad y versión, con otorgamiento y revocación separados.

> Autorizo por separado que DTD Cargo transfiera fuera de China los adjuntos que
> entregue o genere durante la operación logística —incluidos recibos, facturas
> o fotografías que puedan contener mi información personal— a Amazon Web
> Services, Inc., 410 Terry Avenue North, Seattle, WA 98109-5210, EE.UU., para
> análisis antimalware, respaldo inmutable y recuperación ante incidentes. Los
> datos se almacenarán en la región AWS `us-east-1`; las evidencias de Gastos se
> conservarán por 10 años y 1 día cuando corresponda la obligación fiscal o
> probatoria. Puedo solicitar acceso, copia, corrección, explicación o retiro de
> este consentimiento escribiendo a info@dtdcargo.com. Entiendo que retirar el
> consentimiento no invalida el tratamiento anterior ni permite borrar datos
> sujetos a una obligación vigente o retención legal.

Campos mínimos de evidencia, en registro append-only o documento externo:

| Campo | Requisito |
|---|---|
| `titular_id` | identificador interno, no documento en claro |
| `finalidad` | `transferencia_aws_adjuntos_cn` |
| `version_texto` | `1.0-2026-08-03` |
| `otorgado_en` / `revocado_en` | hora de servidor |
| `canal` | contrato, RR.HH. o portal |
| `texto_sha256` | hash del texto exacto mostrado |
| `receptor` | Amazon Web Services, Inc. |
| `region` | `us-east-1` |

No existe todavía ese registro específico ni consentimientos obtenidos:
**NO VERIFICABLE**. Una casilla o documento no equivale a firma autógrafa
certificada; en Venezuela sería evidencia valorable conforme al art. 17 de la
Ley sobre Mensajes de Datos y Firmas Electrónicas.

## 5 · Evaluación de impacto previa

| Prueba PIPL arts. 55–56 | Evaluación |
|---|---|
| finalidad legítima y necesaria | recuperación independiente, antimalware e integridad; no analítica ni publicidad |
| alternativas menos invasivas | copia local no es independiente; path y metadata seudonimizados reducen exposición, pero el binario sigue siendo personal |
| impacto | acceso estatal/soporte, fuga, retención larga, dificultad de supresión y salida a EE.UU. |
| probabilidad | baja si IAM/KMS/WORM funcionan; **NO VERIFICABLE** hasta pruebas reales |
| medidas | SSE-KMS, TLS, bucket privado, EventBridge/SQS cerrado, Object Lock, roles separados, hashes, alertas y restore drill |
| residual | contrato CAC/consentimiento y titularidad de cuenta pendientes; no aceptable para datos China todavía |
| revisión | anual, ante cambio de región/proveedor/subprocesador/finalidad o incidente |

## 6 · Dictamen técnico

Resumen focalizado: `CORRECTO` 3 · `ENCONTRADO` 0 · `NO VERIFICABLE` 3.

- `CORRECTO`: minimización de object key y metadata en
  `scripts/attachments-guardduty-adapter.mjs:33`.
- `CORRECTO`: el preflight bloquea Producción sin fecha de evidencia PIPL en
  `scripts/attachments-pilot-preflight.mjs:154`.
- `CORRECTO`: la plantilla exige versionado y Object Lock en
  `infra/attachments-aws/cloudformation.json:101`.
- `NO VERIFICABLE`: mecanismo CAC aplicable, volúmenes, condición CII/datos
  importantes, firma del receptor y asesoría china.
- `NO VERIFICABLE`: consentimiento separado obtenido y revocable.
- `NO VERIFICABLE`: funcionamiento real de KMS, GuardDuty, Object Lock y restore.

No se activa el piloto con datos personales hasta convertir todos los puntos
`NO VERIFICABLE` necesarios en evidencia fechada. Esto no es asesoría legal.

## Fuentes

- PIPL: [referencia interna](../../../.claude/skills/revisar-datos-ve/references/marco-legal-cn-pipl.md)
- [Disposiciones CAC 2024](https://www.gov.cn/gongbao/2024/issue_11366/202405/content_6954192.html)
- [Contrato estándar CAC](https://www.cac.gov.cn/2023-02/24/c_1678884831596384.htm)
- [Expediente contractual AWS](aws-adjuntos-expediente-contractual.md)
