# COPY_LEGAL_UI.md — Textos legales exactos para la interfaz
> Fuente única del copy legal del portal/ERP DTD Cargo · 10-jun-2026
> Regla: Claude Code pega estos textos LITERALES. Cambiarlos = decisión en Claude Chat (tienen efecto probatorio).

## 1. Modal de aceptación (bloqueante, antes de confirmar cotización)

**Título:** Acuerdo de Servicios DTD Cargo

**Cuerpo:**
> Antes de confirmar tu cotización, necesitamos tu aceptación del Acuerdo de Servicios y Políticas Generales (v{version}), que incluye la política de reembolso, la lista de mercancía prohibida y el checklist de pre-alerta.
> [Leer el Acuerdo completo →]

**Checkbox 1 (obligatorio):**
> ☐ He leído y acepto el Acuerdo de Servicios y Políticas Generales de DTD Cargo (v{version}), incluyendo sus Anexos A, B y C.

**Checkbox 2 (obligatorio):**
> ☐ Declaro que actúo como comerciante, empresa o emprendedor con fines de lucro (cláusula 1.4).

**Botón primario:** Aceptar y confirmar cotización
**Botón secundario:** Volver

**Texto bajo botones (pequeño):**
> Tu aceptación queda registrada con fecha, hora, dirección IP y huella de integridad (hash), conforme a la Ley sobre Mensajes de Datos y Firmas Electrónicas.

**Re-aceptación (cuando hay versión nueva):**
> Actualizamos nuestro Acuerdo de Servicios a la versión {version} (vigente desde {fecha}). Para confirmar esta cotización, por favor revísalo y acéptalo nuevamente. [Ver qué cambió →]

## 2. Recibo de cobranza (plantilla)

```
RECIBO DE PAGO — DTD CARGO
Gestión de cobranza por cuenta de DTD Cargo (operadora internacional)
Servicio puerta a puerta China–Venezuela

Ref. envío: {shipping_mark}-{n_operacion}
Cliente: {nombre_cliente}
Pagador: {nombre_pagador} {("(tercero — relación: " + relacion + ")") si aplica}
Monto: {monto} {moneda}   ·   Canal: {canal_pago}
Fecha de recepción de fondos: {fecha}
Recibido por: Inversiones DTD Services, C.A., agente de cobranza de la Operadora.

Este recibo acredita la recepción del pago indicado y NO constituye factura fiscal.
Documento sujeto al Acuerdo de Servicios v{version} aceptado por el Cliente.
```

## 3. Reporte de pago (formulario del cliente)

- Campo "Referencia del envío" (obligatorio): ayuda → *"Tu código Shipping Mark + número de operación. Sin la referencia no podemos aplicar tu pago (cláusula 7.3)."*
- Campo "¿Quién realizó el pago?" (obligatorio): opciones **Yo mismo / Un tercero**.
  - Si tercero → "Nombre del pagador" + "Relación contigo" (familiar, socio, empleado, otro).
  - Texto de declaración (checkbox obligatorio): ☐ *"Declaro que estos fondos corresponden a mi operación y son de origen lícito."*
- Estado visible al cliente cuando el pago no cruza: **"Pago recibido — pendiente de identificación. Envíanos tu referencia para aplicarlo. Una vez identificado, se imputará a la fecha en que recibimos los fondos."**

## 4. Notificación de arribo (WhatsApp/email)

> 📦 *DTD Cargo — Tu carga llegó a Venezuela*
> Hola {nombre}, tu envío **{shipping_mark}-{n_operacion}** arribó a nuestro almacén de destino el {fecha_arribo}.
> Saldo pendiente: **{saldo} USD**. Tienes **15 días hábiles de almacenaje gratuito** (hasta el {fecha_fin_gracia}); desde el día 16 se causa bodegaje escalonado por CBM/día (Acuerdo, cláusula 4.2).
> Coordina tu pago y entrega aquí: {link}

## 5. Pre-aviso de liquidación (multicanal, registrado)

> ⚠️ *DTD Cargo — Aviso importante sobre tu carga {shipping_mark}-{n_operacion}*
> Hola {nombre}. Tu mercancía arribó el {fecha_arribo} y a la fecha registra: flete pendiente {saldo} USD + bodegaje acumulado {bodegaje} USD.
> Conforme al Acuerdo de Servicios v{version} (cláusula 4.3) que aceptaste el {fecha_aceptacion}, cumplidos **60 días desde el arribo** ({fecha_limite}) sin pago total, retiro o plan de pago por escrito, procederemos a la venta de la mercancía para cubrir lo adeudado.
> Aún estás a tiempo: responde este mensaje para pagar o acordar un plan. {link}

*(Regla ERP: enviar a los días 30, 45 y 55; registrar canal, fecha y hora de cada envío en la bitácora del expediente.)*

## 6. Flujo de liberación excepcional (override — solo Sam)

**Solicitud (la levanta Luis/operaciones):**
> Solicitud de liberación sin pago completo · {shipping_mark}-{n_operacion} · Cliente: {nombre} · Saldo: {saldo} USD · Motivo: {texto_libre_obligatorio}

**Pantalla de aprobación (Sam, móvil):**
> {cliente} solicita retirar con saldo pendiente de {saldo} USD. Historial: {n_envios} envíos, {dias_promedio_pago} días promedio de pago. ¿Autorizar?
> [Autorizar con plan de pago] [Negar]

**Si autoriza →** el sistema genera y envía al cliente el plan de pago para confirmación digital:
> *Plan de pago — {shipping_mark}-{n_operacion}: saldo {saldo} USD pagadero el/los {fechas}. La mercancía se entrega bajo este compromiso; el incumplimiento hace exigible el total de inmediato (Acuerdo, cláusulas 4.3 y 7.1). Responde "ACEPTO" para confirmar.*
> (El "ACEPTO" + fecha/hora/canal se registra en la bitácora. Sin confirmación del cliente, no hay despacho.)

**Bitácora (automática):** solicitante, aprobador (Sam), justificación, plan, confirmación del cliente, timestamps.

## 7. Microcopy de estados de pago (interno + cliente)

| Estado | Interno | Cliente ve |
|---|---|---|
| `recibido_sin_ref` | Fondos en cuenta sin cruce | "Pago recibido — pendiente de identificación" |
| `identificado` | Cruzado con operación; imputación retroactiva aplicada | "Pago aplicado el {fecha_fondos}" |
| `aplicado` | Saldo actualizado, gate de despacho evaluado | "Saldo: {saldo}" |
| `rendido` | Incluido en rendición quincenal a la Operadora | (no visible) |
| `hold_despacho` | Pago incompleto bloquea despacho | "Pendiente de pago para coordinar entrega" |
| `override_activo` | Liberado por autorización de Sam + plan de pago | "Entrega coordinada — plan de pago activo" |
