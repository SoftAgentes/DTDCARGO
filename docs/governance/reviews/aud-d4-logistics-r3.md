# Revisión técnica D4 — logística R3

| Control | Valor |
|---|---|
| Revisión | REV-AUD-021 |
| Migración | `0292_audit_d4_logistics_r3` |
| Resultado | cumplimiento parcial · no conformidad de `search_path` legacy |

El bridge D4 enruta los eventos legacy de las cinco RPC R3 hacia el writer
contractual dentro de la transacción original. La prueba demuestra un único
evento, redacción de claves prohibidas, path fijo y rollback ante fallo de
`append_audit_event`.

El bridge contractual usa `search_path` vacío. Las cinco RPC legacy quedan
fijadas a `pg_catalog, public` porque aún contienen referencias no cualificadas.
Esto elimina la herencia del path de sesión, pero no satisface el contrato
estricto de path vacío. La prueba usa fixtures equivalentes y no demuestra por
sí sola el rollback de cada cuerpo productivo completo; ambos límites quedan
como no conformidades visibles, no como excepciones aprobadas.

No se modificó la semántica logística, el contrato de comentarios ni Cloud.
