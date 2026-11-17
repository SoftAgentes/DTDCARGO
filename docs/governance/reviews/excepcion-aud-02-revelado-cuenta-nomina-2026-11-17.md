# Excepción de comportamiento · AUD-02 §3 — revelado de la cuenta bancaria del empleado

Estado: **aprobada por Sam el 2026-11-17** (decisión D9, opción b, de la SDD-0652) · Dueño: Sam · Revisión: **2027-02-17**, o antes si cambia el equipo de Contabilidad.

Registro pedido por [SGE-00 §7](../policies/sge-00.md) y por el [índice maestro §5](../README.md): una excepción de comportamiento lleva política afectada, motivo, alcance, mitigación, responsable y fecha de revisión. La entrada en la línea base está en la fila de AUD-02 del [registro maestro](../README.md) (protocolo L3), por delegación del Director General; este documento es la decisión escrita.

## 1. Principio y política afectados

[AUD-02 §3](../policies/aud-02.md), capacidad `audit:view_sensitive`: revelar un campo sensible exige **motivo, reautenticación y evento de acceso**, y por defecto **solo `admin`** la recibe.

AUD-02 rige los logs de auditoría. Aquí se aplica **por analogía** a un dato sensible de Nómina (la cuenta bancaria del empleado), como lo clasifica la SDD-0652 §10.

## 2. Qué se aparta de la regla

| AUD-02 §3 | Lo que hace el revelado de la ficha |
|---|---|
| Solo `admin` | `admin` **y `accounting`** |
| Motivo | Motivo, obligatorio, de 4 a 500 caracteres (igual) |
| Reautenticación | **No se vuelve a pedir la contraseña** |
| Evento de acceso | Evento `bank_account_revealed`, en la misma transacción (igual) |

Son dos diferencias: quién puede y la reautenticación. El motivo y el evento se conservan.

## 3. Motivo y riesgo aceptado

- **Motivo.** Contabilidad necesita la cuenta completa para pagar la nómina; es su trabajo de cada quincena. Con «solo admin», cada pago dependería de que un administrador abriera la cuenta por ella. Pedir la contraseña en cada consulta, varias veces por corte, empuja a copiar las cuentas a una hoja aparte, que es peor.
- **Riesgo aceptado.** Una sesión abierta de Contabilidad, en un equipo desatendido, puede revelar cuentas sin que se vuelva a comprobar quién está delante. Sam lo acepta con las mitigaciones de abajo.

Decisión literal: en el chat del Director General, a «¿Apruebas las 13 decisiones recomendadas de la ficha de empleado?», con la tabla de recomendadas a la vista, Sam respondió **«Sí, las recomendadas»**. En D9 la recomendada es la (b).

## 4. Alcance exacto

- **Un solo dato:** `nomina_employees.bank_account`.
- **Una sola vía:** la RPC `nomina_reveal_bank_account` (migración 0555), llamada desde «Mostrar» en la ficha del empleado.
- **Solo** rol `admin` o `accounting` con **una** membresía activa, en el tenant de la ficha. Un acceso extra al módulo Nómina (SDD-0635) y la lectura propia de la ficha (migración 0181) **no** pasan.
- No cubre ningún otro campo sensible, ni los logs de auditoría, ni exportaciones. Cualquier otro revelado sigue el estándar de AUD-02 §3.

## 5. Mitigación

1. **El número no viaja salvo que se pida.** La lista, la ficha y el formulario de edición traen la cuenta enmascarada desde el servidor (últimos 4). La bandeja de solicitudes ya no trae la cuenta.
2. **Cada consulta queda registrada** con quién, cuándo y para qué (`bank_account_revealed`, tipo `nomina_employee_sensitive_view`, dominio `security`, 2 años). El evento **no guarda el número**.
3. **Falla cerrado.** El evento se escribe antes de devolver la cuenta, en la misma transacción. Si no se puede escribir, la RPC falla y la cuenta no sale. Lo mide el contrato de la migración.
4. **La consulta se ve.** Aparece en la línea de tiempo de la ficha, para admin y para Contabilidad.
5. **No se guarda en el navegador.** Vive en memoria, se oculta sola al minuto y al salir de la ficha.
6. **Pruebas negativas** en el contrato de la 0555: comercial, acceso extra, lectura propia, usuario suspendido, sin sesión, otro tenant, sin motivo.

## 6. Responsable, aprobador y revisión

- **Aprobador y responsable:** Sam.
- **Revisión:** 2027-02-17. Se revisa antes si entra una persona nueva a Contabilidad, si aparece una consulta sin motivo creíble, o si se construye la reautenticación reutilizable (`lib/db/password-confirmed.ts`) para Nómina: en ese caso se evalúa volver al estándar.
- **Cómo se retira:** quitando `accounting` de la RPC (un parámetro) y sumando la reautenticación en la acción. No toca datos.

## 7. Estado de la evidencia

Diseño implementado en la PR de la fase 2 de la SDD-0652. La migración 0555 **no está aplicada en producción**: hasta que se aplique, «Mostrar» responde que la función todavía no está disponible y la cuenta completa no se puede ver desde el Studio.
