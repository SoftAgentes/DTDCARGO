# Kit de prueba — Secretaria Bitácora ERP / Escucha Activa SAM

Pega las TABLAS en `{{LISTA_EMPLEADOS}}` y `{{LISTA_CLIENTES}}`, y la TRANSCRIPCIÓN
como mensaje `user`. Corre el mismo kit contra los dos agentes y compara.

Trampas puestas a propósito: plazo corregido 15->10 (hilos) · cliente "González" ambiguo
entre dos fichas (vínculo por confirmar) · tarea sin dueño ("que alguien les recuerde") ·
proveedor Julio -> pendiente, no tarea · compromiso blando "voy a tratar" (tentativo) ·
pregunta sin respuesta ("¿ya pagamos el almacén?").

## {{LISTA_EMPLEADOS}}
| id  | nombre           | rol                         | alias        |
|-----|------------------|-----------------------------|--------------|
| E01 | Sam Méndez       | Fundador                    | Sam          |
| E02 | María Rodríguez  | Coordinadora de operaciones | María        |
| E03 | Luis Paredes     | Almacén Valencia            | Luis         |

## {{LISTA_CLIENTES}}
| id      | nombre                        | empresa                   | alias                  | tel        |
|---------|-------------------------------|---------------------------|------------------------|------------|
| CLI-001 | Comercial González 2010, C.A. | Comercial González 2010   | "González de Maracay"  | 0424-111…  |
| CLI-002 | Inversiones González Hnos     | Inversiones González Hnos | "González de Valencia" | 0412-222…  |
| CLI-014 | Ferretería El Tornillo        | Ferretería El Tornillo    | "El Tornillo"          | 0414-333…  |

## TRANSCRIPCIÓN (reunión interna, 05-jul, oficina Valencia)

Sam: Bueno María, arranquemos. ¿Cómo quedó lo de la entrega a González?
María: Sí, el pedido de González está listo para despacho. Les dije que la entrega
       a Maracaibo sale en 15 días.
Sam: Ok. ¿Ese González es el de Maracay o el de acá de Valencia?
María: Eh… el de González. El que siempre nos compra los consumibles.
Sam: Ajá, pero tenemos dos. Bueno, después lo vemos. ¿Qué falta de parte de ellos?
María: Falta que ellos manden la orden de compra firmada. Sin eso no facturamos.
Sam: Perfecto, que alguien les recuerde eso.
María: Dale.
[Entra llamada al proveedor de transporte, Julio]
Sam: Julio, ¿cómo va la ruta Maracaibo?
Julio: Mira Sam, sí puedo, pero necesito que me confirmen el peso total antes del
       jueves para poder cerrar el precio.
Sam: Ok. Oye, y respecto a lo de la entrega que te comentaba, mejor cuadramos 10 días,
     no 15, porque el cliente lo pidió antes.
Julio: 10 días trabajable, sí.
María: Ah, ok, entonces corrijo a 10.
Sam: ¿Y la cotización nueva de los filaments de Loop3D, quién la está viendo?
María: Voy a tratar de tenerla para mañana, pero depende de si me responde el de aduana.
Sam: ¿Ya pagamos lo del almacén de este mes?
María: [pausa] … eso lo tenía Luis. Yo creo que sí.
Sam: Bueno, confírmame eso. Dale, cerramos.
