# ERR-01 v0.1 — Taxonomía de errores y recuperación

| Control | Valor |
|---|---|
| Código | ERR-01 |
| Estado | redactada — pendiente de aprobación |
| Creado | 2026-07-21 |
| Depende de | SGE-00, AVS-01 y AUD-01 |

## Taxonomía

| Nivel | Ejemplo | Canal principal |
|---|---|---|
| Campo | Formato, requerido, rango | Debajo del campo + relación accesible. |
| Formulario | Inconsistencia entre campos | Resumen en cabecera + campos marcados. |
| Transacción | Conflicto, período cerrado, saldo insuficiente | Bloque persistente en contexto; toast solo complementa. |
| Conectividad | Offline, timeout, dependencia externa | Estado de conexión + reintento seguro. |
| Sistema | Fallo inesperado | Mensaje recuperable + ID de soporte/correlación. |
| Seguridad | Permiso o sesión | Mensaje mínimo, sin revelar existencia/datos no autorizados. |

## Reglas

- Prevenir antes de informar siempre que sea posible.
- El mensaje responde: qué ocurrió, qué se conservó y qué puede hacer la persona.
- El error aparece cerca de su causa; no se depende de un toast que expira.
- Color danger se acompaña con texto/icono y contraste.
- El primer error bloqueante recibe foco mediante resumen o campo.
- Errores del servidor se traducen a códigos/copy seguros; no se muestran stack,
  SQL, tokens, rutas internas ni PII.
- Reintentar no duplica la mutación.
- Un error crítico genera observabilidad y, si corresponde, AUD-01; no todo
  error de validación contamina el audit log.
- Al corregir, el error desaparece o cambia de forma predecible sin borrar otros.

## Gate

Probar cada nivel, múltiples errores, teclado/lector, móvil, error después de
optimistic update, reintento, conflicto concurrente y correlación de soporte.
