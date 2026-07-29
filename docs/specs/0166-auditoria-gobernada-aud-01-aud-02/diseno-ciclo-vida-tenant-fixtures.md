# Diseño de ciclo de vida del tenant y fixtures

| Control | Valor |
|---|---|
| Diseño | SDD-0166 · prerrequisito de cierre |
| Versión | 1.0 |
| Fecha | 2026-07-28 |
| Estado | aprobado técnicamente |
| Políticas | [AUD-01](../../governance/policies/aud-01.md) · [AUD-02](../../governance/policies/aud-02.md) |
| Revisión | [REV-AUD-010](../../governance/reviews/aud-tenant-fixtures.md) |
| Implementación | no abierta; requiere SDD y migración propios |

## 1. Decisión

No se crea una función de purga de auditoría ni se permite borrar tenants de
negocio para resolver la limpieza E2E.

El contrato objetivo separa dos ciclos:

1. **tenant de negocio:** se suspende o archiva; nunca se elimina físicamente
   por una ruta ordinaria de aplicación;
2. **tenant fixture:** solo existe dentro de un Supabase efímero y se elimina
   al destruir el entorno completo, no mediante `DELETE` sobre tablas.

Después de retirar el camino de fixtures en bases persistentes, un SDD propio
podrá cambiar `entity_audit_log_tenant_id_fkey` a `ON DELETE RESTRICT` y
revocar `DELETE` de `service_role` sobre `tenants`. Este diseño no ejecuta esas
acciones.

## 2. Evidencia comprobada

### 2.1 Repositorio

- no existe una ruta de producto que elimine tenants;
- `scripts/cleanup-e2e.ts` es el único caller encontrado que ejecuta
  `.from("tenants").delete()`;
- `scripts/seed-e2e.ts` admite hoy Producción mediante una confirmación
  adicional y usa un tenant determinista de SDD-0168;
- ese seed intenta eliminar directamente eventos previos de
  `entity_audit_log`, pero `0267` ya retiró `DELETE` a `service_role`;
- el cleanup elimina primero usuarios Auth y después el tenant; las FK eliminan
  memberships y perfiles por cascada;
- las pruebas SQL de `0261`, `0261b`, `0262`, `0263`, `0264` y `0267` ya usan
  fixtures desechables y `ROLLBACK`, patrón que debe conservarse.

### 2.2 Cloud

El inventario metadata-only posterior a `0267` comprobó:

| Control | Resultado |
|---|---:|
| FK directas hacia `public.tenants` | 192 |
| FK con `ON DELETE CASCADE` | 192 |
| FK directas con otra acción | 0 |
| columnas `tenant_id` en `public`/`storage` | 193 |
| columna sin FK directa | `public.supplier_scorecard_v` · vista |
| `service_role` puede borrar `tenants` | sí |
| policies DELETE sobre `tenants` | 0 |
| funciones SQL que borran `tenants` | 0 |
| tenant fixture SDD-0168 | 0 |
| memberships fixture | 0 |
| eventos audit fixture | 0 |
| objetos Storage fixture | 0 |

La ausencia del fixture confirma el cierre anterior, pero no corrige el camino
estructural: borrar un tenant todavía puede eliminar transitivamente 192
familias de datos, incluida auditoría.

## 3. Riesgos que gobierna el diseño

| Riesgo | Consecuencia | Control |
|---|---|---|
| Cascade de tenant | borra historia aunque la tabla audit sea append-only | FK audit objetivo `RESTRICT` |
| `service_role` con DELETE | un script o bug puede iniciar las 192 cascadas | revocar DELETE sobre `tenants` |
| “fixture” como bandera | un dato mutable podría habilitar purga en Producción | no existe RPC de purga ni excepción por bandera |
| seed en Producción | mezcla datos sintéticos con negocio | hard deny por project ref |
| cleanup fila por fila | orden incompleto, huérfanos externos y pérdida audit | destruir entorno efímero |
| Auth/Storage externos | no están gobernados solo por FK SQL | teardown del proyecto completo |
| base de staging compartida | fixtures pueden convivir con datos persistentes | E2E destructivo solo en entorno efímero |
| backups | un borrado lógico no garantiza desaparición física | sin PII en fixtures; retención real queda en Corte E |

## 4. Ciclo de vida del tenant de negocio

Estados conceptuales:

```text
activo → suspendido → archivado
   ↑          │           │
   └──────────┴───────────┘  solo mediante operación aprobada
```

- **activo:** usuarios y procesos autorizados operan normalmente;
- **suspendido:** bloquea sesiones/mutaciones nuevas sin destruir historia;
- **archivado:** conserva información, auditoría y referencias; queda fuera de
  operación ordinaria;
- **eliminado:** no es un estado de producto.

Una implementación futura debe resolver autorización, efecto sobre sesiones,
jobs, integraciones, Storage, facturación, obligaciones legales y
reactivación. No puede reutilizar `deleted_at` de entidades hijas como sustituto
del estado del tenant.

La purga extraordinaria por mandato legal, contractual o jurisdiccional no
forma parte de este diseño. Requiere política de retención/hold aprobada, SDD
propio, doble autorización y evidencia; permanece vinculada al Corte E.

## 5. Ciclo de vida de fixtures

### 5.1 Entorno permitido

Una fixture E2E que crea tenant, usuarios Auth o datos persistidos solo puede
ejecutarse cuando todas estas condiciones sean verdaderas:

- el project ref no es `xpfuzqombmjmxvprjgmi`;
- el entorno se declaró explícitamente `ephemeral`;
- el proyecto fue creado para una única ejecución o suite;
- no contiene tenants o usuarios ajenos a esa suite;
- usa exclusivamente datos sintéticos, sin PII ni credenciales reales;
- existe un teardown del proyecto por el proveedor/orquestador.

No existe variable de confirmación capaz de levantar la prohibición de
Producción.

### 5.2 Seed

El seed futuro debe:

1. validar project ref, URL y clase efímera;
2. abortar si detecta tenants, usuarios o objetos fuera de su contrato;
3. crear datos deterministas dentro del proyecto fresco;
4. no borrar auditoría, comentarios ni tenants previos;
5. emitir solo IDs sintéticos y contadores de control;
6. registrar el identificador del entorno, nunca secretos.

Si el entorno ya contiene una ejecución anterior, falla cerrado. No “repara”
el estado mediante DELETE.

### 5.3 Cleanup

El cleanup futuro no ejecuta DML destructivo. Según el entorno:

- **Supabase efímero remoto:** destruir el proyecto completo;
- **Supabase local:** `supabase db reset` o eliminación del stack local
  desechable;
- **prueba SQL contractual:** transacción con `ROLLBACK`;
- **Preview persistente o Producción:** fixture E2E prohibida.

Eliminar el proyecto cubre Postgres, Auth, Storage y secretos efímeros bajo un
solo límite de vida. La evidencia de cierre exige estado terminal del teardown,
no solo ausencia de una fila tenant.

## 6. Contrato DB objetivo

Un SDD posterior y su migración independiente deben, como mínimo:

1. verificar que no existen rutas de producto ni scripts que borren tenants;
2. verificar que fixtures persistentes de SDD-0168 permanecen en cero;
3. cambiar únicamente
   `entity_audit_log_tenant_id_fkey` de `CASCADE` a `RESTRICT`;
4. revocar `DELETE` de `service_role` sobre `public.tenants`;
5. conservar RLS y ausencia de policy DELETE;
6. demostrar que un tenant con evento audit no puede eliminarse;
7. demostrar que el evento y el tenant sobreviven al intento;
8. no crear función `SECURITY DEFINER` de purga;
9. no cambiar las otras 191 FK como efecto colateral;
10. aplicar forward-fix; nunca reabrir DELETE como rollback ordinario.

El basename de la migración no se reserva en este documento: debe asignarse y
revalidarse cuando se abra el SDD de implementación.

## 7. Contrato de aplicación objetivo

La implementación futura debe revisar, como allowlist inicial:

- `scripts/e2e/sdd-0168-fixture.ts`;
- `scripts/seed-e2e.ts`;
- `scripts/cleanup-e2e.ts`;
- `package.json`;
- configuración CI/Preview que crea y destruye el Supabase efímero;
- una migración y una prueba SQL nuevas;
- SDD, recibos e índice de gobernanza.

Cambios esperados:

- retirar `E2E_PRODUCTION_CONFIRM_PROJECT_REF` como escape hatch;
- introducir una señal fail-closed de entorno efímero;
- retirar DELETE directo sobre auditoría y tenant;
- reemplazar `cleanup:e2e` por verificación/teardown del entorno;
- comprobar residuo cero en Postgres, Auth y Storage antes de cerrar.

La allowlist definitiva se determina mediante B0 read-only del nuevo SDD; esta
lista no autoriza editar esos archivos.

## 8. Criterios de aceptación

- Producción rechaza el seed aunque se definan variables de confirmación;
- una base persistente rechaza fixtures destructivas;
- el seed falla si el proyecto efímero no está vacío;
- el seed no contiene DELETE de auditoría, comentarios o tenants;
- el cleanup no contiene DML destructivo;
- teardown remoto termina y el proyecto deja de estar disponible;
- local/SQL deja residuo cero por reset o rollback;
- `service_role` no puede borrar `tenants`;
- la FK audit es `ON DELETE RESTRICT`;
- un intento de borrar tenant con auditoría falla sin pérdida;
- no existe RPC o función de purga de auditoría;
- las 191 FK restantes no cambian accidentalmente;
- `docs:check`, `git diff --check` y pruebas PostgreSQL 15/17 pasan;
- Cloud se aplica por basename exacto y recibe advisors posteriores.

## 9. Secuencia de implementación futura

```text
SDD propio + B0 read-only
          ↓
hard deny de Producción + Supabase efímero
          ↓
retirar cleanup DML y verificar teardown
          ↓
migración FK audit RESTRICT + revocar DELETE tenants
          ↓
pruebas local/Preview/Cloud y recibo
```

El orden evita bloquear el cleanup actual antes de tener el entorno efímero y
evita conservar un camino destructivo solo para compatibilidad de tests.

## 10. Fuera de alcance

- implementar este diseño;
- abrir los Cortes C, D o E;
- definir plazos de retención o hold;
- purgar tenants, auditoría, Auth, Storage o backups;
- cambiar las 191 FK restantes;
- crear una ruta de administración de tenants;
- reabrir SDD-0168;
- aplicar otra migración Cloud o modificar Vercel.
