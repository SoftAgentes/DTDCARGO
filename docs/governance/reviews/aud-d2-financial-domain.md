# Revisión técnica D2 — núcleo financiero

| Control | Valor |
|---|---|
| Revisión | REV-AUD-019 |
| Migración | `0290_audit_d2_financial_domain` |
| Fecha | 2026-07-30 |
| Resultado | cumplimiento parcial · no conformidad de motivo legacy |

## Veredicto

La implementación retira cinco writers best-effort y cubre las siete tablas
financieras mediante triggers de dominio explícitos. El evento y cada mutación
de fila comparten transacción; si `append_audit_event` falla, la escritura no
persiste.

La elección evita copiar PII o montos y corrige el defecto histórico que
intentaba usar `accounts.code` donde el contrato exige un UUID: el trigger usa
siempre `accounts.id`.

## Evidencia

- `check-schema-rebuild` aplicó 269 migraciones y verificó 17 solo-ledger;
- el test SQL produjo diez eventos `source=rpc`, probó razón no vacía y rollback forzado;
- el contrato TypeScript limita tablas y claves;
- los callers ya no escriben directamente `entity_audit_log`;
- TypeScript y lint proporcional pasaron.

## No conformidad y límite

Los callers legacy de anulación no siempre capturan un motivo humano. El
trigger conserva una razón controlada, pero eso no satisface por sí solo el
motivo contextual exigido por AUD-01 para toda operación R3. Su adopción queda
en un slice R2/R3 con SDD y allowlist propios; no se abre un barrido masivo.

Producción requiere gate individual de `0290`. D3–D5 no se presuponen aprobados
por esta revisión.
