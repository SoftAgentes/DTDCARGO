# Revisión del diseño correctivo del Corte C

| Control | Valor |
|---|---|
| Revisión | REV-AUD-012 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Inventario | [Corte C · C0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-c-2026-07-28.md) |
| Diseño | [Consulta gobernada y RBAC v1.0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-c.md) |
| Fecha | 2026-07-28 |
| Resultado técnico | aprobado |
| Estado | C0 cerrado; C1 local no abierto |
| Decisión | instrucción de Sam (founder) + revisión técnica Codex |

## 1. Veredicto

Se aprueba técnicamente el diseño C0. El contrato satisface la separación entre
lista redacted y detalle sensible, repite RBAC en aplicación y DB, y permite
retirar el SELECT crudo sin dejar un fallback inseguro.

## 2. Correcciones incorporadas

La revisión exige:

- no usar el acceso al módulo Administración como único gate;
- no devolver payload vacío como sustituto de redacción: las columnas JSON no
  forman parte del tipo de retorno de lista;
- no habilitar reveal material con una allowlist vacía;
- no fingir reautenticación: el contrato exige `aal2` real;
- no convertir actores desconocidos en sistema;
- no ocultar errores como listas vacías;
- retirar Realtime porque publica la tabla base y no tiene consumidor local;
- no depender de que `0268` esté aplicado para ejecutar C1.

## 3. Seguridad

Las RPCs derivan sesión, membership, tenant y rol. No aceptan tenant del
cliente. Las funciones privilegiadas fijan `search_path`, tienen grants exactos
y pruebas de abuso. La lista excluye por firma los campos sensibles. El acceso
sensible requiere motivo y MFA, y su evento no replica datos.

## 4. Rendimiento

Con tres filas Cloud no se aprueban índices adicionales. El diseño reutiliza
los índices de tenant/fecha y tenant/correlación. Los filtros secundarios
quedan sujetos a medición después de carga real.

## 5. Experiencia y accesibilidad

La presentación aprobada distingue error, vacío, sin resultados y fin de
paginación; conserva filtros en URL, zona horaria visible y alternativa móvil.
Antes del commit de UI se deben leer las fuentes visuales canónicas y ejecutar
el check visual requerido por AGENTS.md.

## 6. Límite

REV-AUD-012 no:

- crea `0269`;
- implementa C1;
- aplica `0268` o `0269` en Cloud;
- habilita reveal de PII;
- abre Cortes D o E;
- marca Corte C o SDD-0166 como completados.

La implementación local futura queda limitada por la allowlist exacta del
diseño y requiere revisión REV-AUD-013 antes de cualquier aplicación Cloud.
