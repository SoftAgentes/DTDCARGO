# Registro de fuentes de retención de auditoría

Fecha de corte: 2026-07-31

| Clase | Jurisdicción | Fuente verificable | Plazo | Inicio | Tratamiento al vencer | Responsable | Estado |
|---|---|---|---|---|---|---|---|
| eventos fiscales | Venezuela | [Calendario v1.0](../../legal/retention-schedule-v1.md) + COT arts. 55, 56, 59–62 y 155.3 | mínimo 10 años y confirmación humana de prescripción | 1 de enero siguiente al hecho imponible o firmeza aplicable | lote controlado; nunca automático | finanzas + asesoría fiscal | approved · 2026-07-31 |
| eventos operativos | organizacional | [Calendario v1.0](../../legal/retention-schedule-v1.md) | 5 años | `occurred_at` | lote controlado con manifiesto | operaciones + founder | approved · 2026-07-31 |
| eventos de seguridad | organizacional | [Calendario v1.0](../../legal/retention-schedule-v1.md) | 2 años | `occurred_at` | lote controlado con manifiesto | seguridad + founder | approved · 2026-07-31 |
| eventos sin clasificar | todas | [Calendario v1.0](../../legal/retention-schedule-v1.md) | no ejecutable | clasificación | preservar | owner del dominio | fail-closed |
| artefactos temporales de exportación | técnica | AUD-02 v1.0 | máximo 24 horas | generación | expirar artefacto, nunca evento fuente | ingeniería | diseño aprobado; capacidad inexistente |
| URL firmada de descarga | técnica | AUD-02 v1.0 | máximo 15 minutos | emisión | invalidar acceso | ingeniería | diseño aprobado; capacidad inexistente |
| legal hold | todas | AUD-02 v1.0 + [Calendario v1.0](../../legal/retention-schedule-v1.md) | hasta liberación válida | activación | preservar; liberar con doble decisión | founder + asesoría legal | approved · precedencia total |
| backups y réplicas | infraestructura | [Calendario v1.0](../../legal/retention-schedule-v1.md) + ciclo contratado | ciclo del proveedor | creación de copia | envejecimiento; no reactivar vencidos | infraestructura | approved con verificación de proveedor pendiente por ejecución |

## Requisitos de incorporación

Una fuente nueva sólo puede cambiar este registro si incluye:

1. documento o enlace verificable y versión;
2. jurisdicción y alcance;
3. clase de eventos afectada;
4. plazo y evento que inicia el cómputo;
5. tratamiento al vencer;
6. excepciones y precedencia de hold;
7. responsable y fecha de revisión;
8. aprobación humana registrada.

## Aprobación humana

Sam (founder) aprobó expresamente el 2026-07-31 identificar y adoptar esta
fuente para abrir E2–E5. La aprobación habilita diseño e implementación; cada
migration conserva su autorización nominal de Producción y cada lote de E5 su
propia aprobación destructiva.
