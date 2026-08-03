# Handoff — cierre final de Gobernanza 9

## Estado

- Carril: `codex/governance-9-final-integration-20260803`.
- Base reconciliada: `origin/main@f3cf5fe0`.
- Supabase Producción: 0316 y 0326–0329 aplicadas individualmente.
- Nómina Tier-3: 3/3 verde en rama efímera eliminada.
- Baseline vigente: LB-SGE-106.
- Recibos finales: REV-SGE-055 y REV-SGE-056.
- Integración: `origin/main@f7a5f478`; Vercel Producción `5724733320` verde.

## Qué queda canónico

- La implementación de SDD-0235 integrada en este carril conserva las pruebas
  conductuales reconciliadas con `codex/sdd-0235-continuity`.
- El fixture de Nómina crea `borrador`, agrega el desglose y luego confirma;
  cualquier orden distinto debe fallar por el guard de 0316.
- El E2E de Nómina usa `/studio/login?next=/studio/nomina`, sidebar colapsado y
  activación por teclado para verificar el flujo R3 en los tres perfiles.

## Fronteras

- No se ejecutó una anulación real ni se leyó PII productiva.
- E5 no creó lote porque la elegibilidad fue cero.
- La adopción de 18 `BE` y ocho `NA+BE` continúa por slices futuros.
- Los gates externos de adjuntos y los worktrees históricos permanecen
  conservados.
