# Recibo técnico local — SDD-0373 · frontera Web Push

Fecha: 2026-09-04

Estado: cierre técnico local verificable; sin publicación ni acciones externas.

## Aislamiento y alcance

- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\push-endpoint-hardening`
- Rama sin upstream: `codex/push-endpoint-hardening-20260904`
- Base exacta: `origin/main` en `2a2e81bf554dbe7bd4f05170847e8f02e988d320`
- Se trasladó sin commit únicamente el cambio atómico local `c1e44555` de la
  rama `codex/saneamiento-integral`; no se incorporaron sus demás commits.
- Sin cambios de dependencias, lockfile, schema, migraciones, configuración de
  Vercel o archivos de entorno.

## Resultado de seguridad

- Un parser compartido y fail-closed valida tanto las cuatro entradas como los
  dos emisores antes de cualquier escritura o llamada a `web-push`.
- Sólo acepta HTTPS, puerto predeterminado y los hosts documentados de FCM,
  Mozilla, Apple Push y Windows Notification Service. Rechaza loopback, IP
  privada, hosts ajenos, credenciales, fragmentos, espacios, controles,
  autoridades ambiguas, sufijos/prefijos engañosos y endpoints de más de 4096
  caracteres.
- Valida forma y tamaño canónicos de `p256dh` y `auth`, limita
  `expirationTime` y proyecta únicamente el contrato persistible.
- Cada envío conserva su TTL y pasa `timeout: 10000` a `web-push`. Es un
  timeout de socket, no un deadline total del fanout.
- Una fila persistida inválida se conserva, no se envía, no se borra y no se
  marca exitosa. El cleanup continúa limitado a respuestas 404/410.
- Los diagnósticos no incluyen endpoint, claves, usuario, payload ni texto del
  proveedor.

## Evidencia ejecutada

### RED causal

Sobre `origin/main`, antes de incorporar la corrección, la prueba de regresión
con `https://localhost/private` llegó al mock de `web-push`: se esperaba cero
entregas y se recibió una. No hubo red real. Después se afinó el fixture para
usar claves públicas sintéticas válidas, de modo que el verde dependa del
destino rechazado y no de otra forma inválida.

### GREEN enfocado

Comando:

```text
pnpm exec vitest run lib/studio/notify/__tests__/push-subscription.test.ts lib/studio/notify/__tests__/send-user-push.test.ts lib/studio/notify/__tests__/send-user-push-boundary.test.ts lib/studio/notify/__tests__/send-operario-push.test.ts app/api/studio/push/__tests__/subscribe-boundary.test.ts app/api/studio/push/__tests__/subscribe-identity.test.ts --reporter=verbose --maxWorkers=1
```

Resultado final: **6 archivos, 322 pruebas aprobadas, exit 0**. Las pruebas
simulan VAPID, Supabase y `sendNotification`; usan el punto generador público
P-256 y un `auth` determinista de 16 bytes, nunca una clave privada ni una
suscripción real.

### Gates deterministas

- ESLint sobre los 14 archivos de código/pruebas: exit 0.
- `pnpm typecheck`: exit 0.
- `pnpm docs:check`: exit 0.
- `pnpm governance:check`: 28 políticas aprobadas, exit 0.
- `pnpm components:check`: 5 fuentes reproducibles y 0 rutas rotas, exit 0.
- Suite Vitest completa dentro de `node scripts/verify.mjs`: **501 archivos,
  6181 pruebas aprobadas**.
- El mismo verificador aprobó lint, frontera RSC, TypeScript, cuatro Edge
  Functions, documentación, numeración, constantes de features, componentes y
  gobernanza. Lint reportó 8 warnings preexistentes fuera de la allowlist.
- `pnpm build`: compilación y TypeScript aprobados; **158 páginas estáticas
  generadas; exit 0**. Los mensajes por variables Supabase ausentes fueron
  manejados por los fallbacks del build y no lo hicieron fallar.

### Límite observado del verificador canónico

El paso E2E de `node scripts/verify.mjs` se ejecutó deliberadamente sin copiar
`.env.local` ni usar credenciales. En el primer pase obtuvo 132 aprobadas, 18
omitidas, 3 inestables que aprobaron al reintentar y 15 fallidas. Esas 15 son
las mismas rutas de auth/búsqueda en los tres navegadores y el servidor mostró
de forma explícita `Faltan NEXT_PUBLIC_SUPABASE_URL o
NEXT_PUBLIC_SUPABASE_ANON_KEY`. El runner además forzó un worker que no salió
en 300 segundos.

El reintento global repitió la causa ambiental y completó los casos visibles,
pero ocho workers no terminaron. Tras superar ampliamente el timeout interno y
35 minutos totales, el proceso se interrumpió a las 15:16 para no mantener un
servidor de prueba colgado. Por eso el verificador canónico queda **no verde por
entorno y shutdown de Playwright**, no como aprobado ni como fallo atribuido a
Push. Los gates deterministas anteriores y el build se ejecutaron por separado
y sí cerraron en verde.

Los pasos `migrations-applied`, SQL y schema rebuild quedaron omitidos: no había
credenciales Supabase ni Docker. Esto respeta el alcance solicitado y no se
intentó compensar con accesos reales.

## Confirmación de no acción externa

- No se usaron claves VAPID, endpoints, usuarios, datos ni notificaciones reales.
- No hubo llamadas Push externas ni escrituras Supabase/Cloud.
- No hubo migraciones, deploy, cambios Vercel o publicación.
- No hubo push. La rama queda local, aislada y sin upstream.

## Conclusión

La frontera Push queda cerrada localmente con defensa en profundidad antes de
persistencia y antes de transporte, pruebas negativas y timeout contractual.
La integración, publicación y cualquier smoke con proveedor real permanecen
como gates externos independientes.
