# infra/chatwoot · Chatwoot CE en el VPS del ERP (SDD-0583 · etapa E1 de SDD-0582)

Compose de Chatwoot `v4.19.1-ce` para el VPS de Contabo, al lado de la producción de
DTD. En el servidor la carpeta se copia (sin `pruebas/`) a `/srv/chatwoot/`; el repo
solo guarda plantillas, nunca el `.env` ni los datos.

```
compose.yml                 prepare (migra), rails, sidekiq, postgres+pgvector, redis · límites · labels de Traefik
.env.example                TODAS las variables, solo nombres y placeholders
rails/zz_dtd_redaccion_logs.rb   redacción de logs (montado solo lectura sobre la imagen)
respaldo.sh · restaurar.sh  respaldo y restauración CONJUNTOS (base, adjuntos, claves), cifrados con age
vigilar.sh                  recursos del host, de Chatwoot y de la web de DTD → CSV + Push de Uptime Kuma
pegar-smtp.sh               va a /root: Sam pega usuario y clave SMTP sin eco en el .env (runbook §2 bis)
systemd/                    timers de respaldo (06:30 UTC) y vigilancia (5 min)
pruebas/                    ensayo local con Docker (NUNCA en el VPS): ensayo-local.sh y sus piezas
```

## Probar en local

```bash
bash infra/chatwoot/pruebas/ensayo-local.sh          # ~6 min; corrida pesada: una a la vez
```

Levanta un Traefik de prueba con los middlewares reales de `infra/ops/traefik/dynamic`,
un stack de control sin redacción, el stack real, un respaldo, una restauración en
otro proyecto y un control con claves equivocadas. Imprime `PASÓ`/`FALLÓ` por
comprobación y sale con el número de fallas. Solo datos sintéticos.

## Desplegar

No sin el OK nominal de Sam (puertas P1–P5 de la spec). Procedimiento:
[docs/runbooks/chatwoot-servidor.md](../../docs/runbooks/chatwoot-servidor.md).
Respaldo: [chatwoot-respaldo-restauracion.md](../../docs/runbooks/chatwoot-respaldo-restauracion.md).
Vigilancia: [chatwoot-vigilancia.md](../../docs/runbooks/chatwoot-vigilancia.md).

## Qué cambia respecto del compose oficial de Chatwoot

| Compose oficial de Chatwoot (`docker-compose.production.yaml`; referencia de su documentación, NV aquí) | Aquí | Por qué |
|---|---|---|
| `chatwoot/chatwoot:latest` | `v4.19.1-ce` + digest | las versiones se suben en E3, con runbook |
| `env_file: .env` | variables una por una (`x-entorno`) | una línea vacía llega como `""` y rompe `MAX_USER_SESSIONS`, `LOG_LEVEL`… |
| migración a mano (`rails db:chatwoot_prepare`) | servicio `prepare` one-shot del que dependen rails y sidekiq | cada `up` migra antes de arrancar |
| `ports: 127.0.0.1:3000:3000` | ningún puerto; Traefik por la red `chatwoot_edge` | igual que DTD |
| `pgvector/pgvector:pg16` sin etiqueta fija | `pgvector/pgvector:0.8.1-pg16`, `shared_buffers=192MB`, 40 conexiones | memoria a la medida del límite |
| `redis:alpine` | `redis:7.2.11-alpine`, `appendonly`, `noeviction`, 160 MB | no perder trabajos encolados |
| sin límites | CPU, memoria y PIDs por servicio; `cpu_shares: 512`; `oom_score_adj: 500` | convive con la producción de DTD (E0-D1) |
| telemetría, relay de push y Gravatar por defecto | apagados | revisión de datos E1 (H3, H4, H5) |
| `/super_admin`, `/monitoring`, `/installation` públicos | solo desde `100.64.0.0/10` | revisión de datos E1 (H6) |
