# Contrato de acción gobernada — [verbo + objeto]

| Campo | Valor |
|---|---|
| Módulo/superficie | [ruta] |
| Verbo visible | [Crear/Guardar/Anular/etc.] |
| Rol BTN-01 | [primario/secundario/terciario/destructivo/icono/menú] |
| Resultado MP-01 | [P0–P4/no aplica] |
| Fricción | [R1–R3/no aplica] |
| Permiso | [capacidad + condiciones] |
| Política de auditoría | [evento AUD-01/no aplica] |

## Precondiciones

- Estado permitido: [estado].
- Selección/datos válidos: [regla].
- Permiso y tenant: [regla].
- Idempotencia/correlación: [regla].

## Comportamiento

| Momento | UI | Servidor | Auditoría |
|---|---|---|---|
| antes | [habilitado/oculto/explicado] | [validaciones] | [no aplica/preparar contexto] |
| pending | [bloqueo/progreso/cancelación] | [transacción] | [evento atómico] |
| success | [resultado/AVS/navegación] | [estado final] | [correlation id] |
| error | [mensaje/recuperación] | [rollback/idempotencia] | [fallo o evento] |

## Consecuencia y recuperación

- Consecuencia para el usuario: [texto concreto].
- Efectos relacionados: [saldos/documentos/notificaciones/archivos].
- Recuperación: [deshacer/restaurar/revertir/ninguna].
- Motivo: [no requerido/obligatorio + reglas].

## Aceptación

- [ ] Etiqueta y orden cumplen BTN-01.
- [ ] Estado y permanencia cumplen MP-01.
- [ ] Backend revalida permiso, tenant y estado.
- [ ] Doble envío no duplica efectos.
- [ ] Éxito no se anuncia antes de confirmación.
- [ ] Teclado, foco, móvil y lector funcionan.
- [ ] Evento sensible y mutación son atómicos.
