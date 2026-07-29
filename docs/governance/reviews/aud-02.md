# Revisión normativa AUD-02

| Control | Valor |
|---|---|
| Revisión | REV-AUD-001 |
| Política | [AUD-02 v1.0](../policies/aud-02.md) |
| Fecha | 2026-07-21 |
| Resultado técnico | aprobado |
| Estado normativo | AUD-02 v1.0 aprobada |
| Decisión | 2026-07-21 · Sam (founder) · defaults de REV-AUD-001 |

## 1. Veredicto

AUD-02 puede aprobarse como política sin fingir que el ERP ya cumple ni fijar
plazos legales sin fuente. El borrador v1.0 ahora tiene defaults conservadores,
separa aprobación normativa de pruebas de implementación y cierra los huecos
de redacción detectados.

## 2. Evidencia real

| Evidencia | Consecuencia normativa |
|---|---|
| El viewer consulta hasta 100 filas y filtra en cliente | Filtros/paginación deben pasar al servidor antes de escalar. |
| `authenticated` tiene SELECT por tenant sobre la tabla base | No permite redacción por campo ni capability fina; requiere vista/RPC. |
| `service_role all` y grant total | RLS no asegura inmutabilidad; service role omite RLS. |
| Payload se muestra como JSON crudo | Unknown keys deben ocultarse; el frontend no es frontera de privacidad. |
| Actor desconocido se convierte en `system` | Debe mostrarse no resuelto para no falsificar autoría. |
| No existen hold, retención ni exportación | La política puede aprobarse; la implementación sigue ausente. |
| AUD-01 detectó best-effort y whitelist regresiva | Se corrigen antes de declarar el sistema de auditoría conforme. |

## 3. Cambios de la revisión

1. Se fijó admin-only como default v1 y se separaron crear/liberar hold.
2. Payload redacted por defecto con allowlist por entidad/evento.
3. La revelación sensible y exportación dejan evento sin duplicar PII.
4. Se evitó recursión infinita al consultar eventos de acceso.
5. Cursor opaco, UTC + zona IANA, coincidencia exacta y rate limit.
6. CSV quedó como copia de revisión con defensa contra fórmula; JSON/NDJSON
   conserva estructura.
7. Hash + archivo ya no se presentan como prueba suficiente; el manifiesto se
   firma/sella o se ancla externamente.
8. Exportaciones: Storage privado, URL ≤15 minutos y artefacto ≤24 horas.
9. Sin calendario legal aprobado no existe purga automática.
10. Se reconoció explícitamente que `service_role` omite RLS y necesita grants
    estrechos/RPCs separadas.

## 4. Fundamento externo

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  minimizar datos sensibles, proteger integridad, registrar acceso y controlar
  retención/disposición.
- [NIST SP 800-92](https://csrc.nist.gov/pubs/sp/800/92/final): gestión integral
  de generación, almacenamiento, acceso y disposición de logs.
- [Supabase · RLS](https://supabase.com/docs/guides/database/postgres/row-level-security):
  las service keys pueden omitir RLS.
- [Supabase · Securing your API](https://supabase.com/docs/guides/api/securing-your-api):
  grants y RLS son controles complementarios; las funciones con privilegios
  requieren revisión cuidadosa.

## 5. Decisión aprobada

| Tema | Regla v1.0 |
|---|---|
| Acceso | Admin-only + capability explícita. |
| Datos | Redacción deny-by-default. |
| Sensible/masivo | Motivo, reautenticación, evento y doble control. |
| Retención | Cero purga automática sin calendario aprobado. |
| Hold | Crear favorece conservación; liberar exige dos decisiones. |
| Exportación | Privada, temporal, trazable y con manifiesto verificable. |
| Integridad | Append-only/grants estrechos; criptografía solo con amenaza definida. |

## 6. Lo que no se aprobaría

- plazos fiscales o legales inventados;
- acceso para roles no-admin;
- conformidad actual del visor o la tabla;
- una migración, RPC, capability o bucket;
- que SHA-256 solo demuestre no manipulación;
- usar `service_role` como sustituto de autorización.

## 7. Decisión registrada

El founder aprobó AUD-02 v1.0 con todos los defaults de §5 el 2026-07-21, sin
excepciones. El siguiente paso es crear un SDD correctivo que combine AUD-01 y
AUD-02, pero las migraciones se dividen en cambios revisables y se aplican de
una en una con autorización explícita.
