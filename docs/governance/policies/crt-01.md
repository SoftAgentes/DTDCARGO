# CRT-01 v0.1 — Creación rápida desde contexto

| Control | Valor |
|---|---|
| Estado | redactada — pendiente de aprobación |
| Depende de | BUS-01, FRM-01, BTN-01 y AUD-01 |

## Contrato

La creación rápida se ofrece cuando falta una entidad necesaria y abandonar el
flujo causaría retrabajo. Debe:

1. preservar el formulario y punto de foco original;
2. comprobar permiso antes de mostrar/ejecutar;
3. buscar duplicados con los identificadores relevantes;
4. pedir solo datos mínimos válidos y enlazar al formulario completo;
5. crear en drawer/modal, no dentro del popup de resultados;
6. volver al flujo original, seleccionar la entidad creada y anunciarlo;
7. permitir cancelar sin perder datos;
8. registrar auditoría si la entidad/acción lo exige.

No se ofrece para entidades legales, financieras o maestras cuya creación
requiera revisión extensa. Un duplicado probable detiene y ofrece abrir el
existente; nunca crea primero y pregunta después.

## Gate

Probar duplicado, permiso, cancelación, error, retorno, foco, selección,
formulario original intacto y móvil.
