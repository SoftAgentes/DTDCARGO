# Revisión técnica D3 — ciclo comercial

| Control | Valor |
|---|---|
| Revisión | REV-AUD-020 |
| Migración | `0291_audit_d3_commercial_cycle` |
| Resultado | cumplimiento parcial · no conformidad de motivo legacy |

D3 retira trece llamadas best-effort y cubre rendiciones, compras, ventas y
asignación de prealertas con cuatro triggers de dominio. La prueba aislada
verifica cantidad, payload, razón no vacía y rollback forzado.

Los callers legacy de cancelación no siempre capturan un motivo humano. La
razón controlada del trigger no sustituye ese contexto obligatorio; su adopción
queda en un slice R2/R3 con SDD y allowlist propios.

La revisión no aplica `0291` en Cloud ni abre D4/D5 por implicación.
