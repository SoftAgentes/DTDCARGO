# Fase 1 · Entrar, volver y comprobar la preorden

Plan de la SDD-0713 aprobado por Sam el 23 de noviembre de 2026. La fase ensaya dos cuentas internas en un destino propio de práctica. El botón de perfil se habilita por configuración de despliegue una vez completado el recorrido de producto. Las cinco pantallas operativas se incorporarán por las fases previstas.

## Archivos previstos

| Finalidad | Archivos |
|---|---|
| Perfil y enlace entre sitios | `app/studio/(app)/layout.tsx`, `app/studio/_components/wiring/ProfileModal.tsx`, `app/studio/_components/wiring/EntradaPractica.tsx` |
| Página personal y regreso | `app/studio/practica/page.tsx`, `app/studio/practica/PracticaPersonal.tsx`, `app/studio/practica/practica.module.css`, `proxy.ts` |
| Autorización y datos | `app/api/practica/[operacion]/route.ts`, `lib/studio/practica/contrato.ts`, `lib/studio/practica/config.ts`, `lib/studio/practica/identidad.ts`, `lib/studio/practica/servidor.ts`, `infra/ops/staging/practica-personal.sql` |
| Entrada de red | `infra/ops/staging/practica-traefik.yml.tmpl` |
| Validación | `lib/studio/practica/__tests__/acceso.test.ts`, `lib/studio/practica/__tests__/almacen.test.ts`, `app/studio/(app)/cn/__tests__/create-receipt-code.test.ts`, `infra/ops/tests/practica-navegador.mjs`, `infra/ops/tests/recepcion-preorden-efimera.sql`, `infra/ops/tests/prueba-resetear-base-efimera.sh`, `.github/workflows/practica-recepcion.yml` |
| Entrega | `docs/specs/0713-modo-prueba-personal/spec.md`, `docs/specs/0713-modo-prueba-personal/fase-1.md`, `docs/specs/README.md`, `.agents/handoffs/sdd-0713-practica-fase-1.md` |

## Aceptación

Una cuenta activa abre la práctica desde el perfil y vuelve al inicio real. El destino asigna un espacio duradero y exclusivo a cada identidad de práctica. La cuenta que perdió permisos deja de poder usarlos. El destino de fase 1 mantiene cerradas las rutas financieras, los emisores externos, los cron y las operaciones todavía pendientes de las siguientes fases. Una instalación con datos de negocio preexistentes es inadecuada para este destino.

La verificación de China distingue el alta de recepción, el vínculo con una orden de venta, la existencia de un documento en estado de preorden y la emisión al consolidar. La prueba utiliza ejemplos inventados y documenta qué partes se ejecutaron y dónde.

## Cuándo aparece el documento en Facturación

La acción de Studio registró tres recepciones nuevas con cajas y su evento de llegada. La primera tenía cliente identificado, la segunda tenía además una compra con orden de venta y la tercera llegó huérfana. En la segunda se guardó el vínculo con la orden existente. En ninguna de las tres la acción solicitó una factura en borrador. La prueba ejecuta la acción de Studio con un doble de PostgREST. [Caracterización](../../../app/studio/(app)/cn/__tests__/create-receipt-code.test.ts)

El control complementario de CI usa una instancia desechable de PostgreSQL con las migraciones y la semilla del repositorio. Compara el total de facturas, incluidos los borradores, inmediatamente antes y después de cada recepción. Comprueba también que la recepción y su evento existen. Cubre las escrituras de las tres variantes de Studio y las tres RPC móviles de alta directa, recepción por conteo y selección de cajas. La transacción termina en rollback. [Prueba con el esquema completo](../../../infra/ops/tests/recepcion-preorden-efimera.sql)

El código actual intenta autoemitir al pasar la recepción a consolidada. Comprueba la orden de venta, las medidas y la verificación aplicable. Si procede, el documento queda **emitido**. Para la recepción huérfana el motor descarta la autoemisión. El comportamiento esperado por operaciones es que una recepción identificada origine una **Pre-orden** en estado borrador en ese mismo momento. Ese cambio financiero requiere su propia decisión antes de enseñarlo como regla vigente en la fase 3. [Alta y consolidación](../../../app/studio/(app)/cn/actions.ts) · [Motor de autoemisión](../../../lib/studio/sales-orders/actions.ts) · [Escritura de la factura](../../../supabase/migrations/0533_fechas_caracas_operaciones.sql)

## Identidad y permisos

El perfil abre una pestaña en una URL fija y limpia. Las dos ventanas comprueban el origen y la ventana interlocutora. El servidor receptor reserva un pase aleatorio de 60 segundos y lo consume una sola vez. El pseudónimo por empresa y cuenta recupera el espacio personal. La referencia cifrada permite consultar el rol vigente en el Studio real y vence a las cuatro horas. Solo el origen puede abrirla. La tabla de sesiones del receptor guarda huellas de credenciales, el identificador de espacio y la referencia cifrada.

El navegador recibe una cookie propia de la práctica, segura, HttpOnly y limitada al host. Cada pestaña recuerda en sessionStorage el identificador opaco del espacio que abrió. En cada lectura, el servidor resuelve la cookie y compara ese identificador. Al cerrar verifica también a qué espacio corresponde, de modo que una pestaña antigua de un navegador compartido no cierre la práctica de otra persona. Al volver al primer plano o recargar se comprueban los permisos otra vez. El regreso revoca la sesión de práctica y abre el panel inicial del Studio real.

La autorización se resuelve en el servidor de origen. Solo consulta la cuenta, la membresía activa, los ajustes de su rol y sus permisos individuales en la empresa. La práctica recibe los módulos permitidos y su nivel de edición. Un fallo al verificar devuelve un estado de indisponibilidad o acceso cerrado. La fase presenta los permisos de los cinco módulos. La semilla operativa, los ejercicios y la ayuda ⓘ están previstos desde la fase 2.

## Preparación de la instalación de prueba

El destino propuesto es una **instancia vacía dedicada dentro de la infraestructura de prueba**. Así la práctica puede coexistir con los ensayos y resets del staging técnico. La instalación y la activación en el servidor requieren la coordinación del Director y la aprobación de Sam.

| Componente | Configuración de despliegue |
|---|---|
| Studio real | `APP_ENV=production`, `PRACTICA_MODO=origen`, `APP_URL` igual a `PRACTICA_STUDIO_REAL`. El origen conserva `PRACTICA_LLAVE_IDENTIDAD`, estable para recuperar la copia, distinta del secreto de canal. |
| Ambos servidores | `PRACTICA_STUDIO_REAL` y `PRACTICA_STUDIO_PRUEBA` son orígenes HTTPS distintos, sin ruta. `PRACTICA_SECRETO_CANAL` autentica el enlace de servidor a servidor y se provisiona por el gestor de secretos. Ambas claves se generan como 32 bytes aleatorios en hexadecimal. |
| Receptor | `APP_ENV=staging`, `PRACTICA_MODO=destino`, `APP_URL` igual al origen de práctica. Construir una imagen de práctica con GA apagado (`NEXT_PUBLIC_GA_ID=off`) y Clarity apagado. Arrancar con una lista explícita de variables, sin credenciales de negocio, canales, pagos ni servicios del ERP. |
| PostgreSQL y PostgREST | Usar una instancia nueva en red privada. El bootstrap comprueba el destino expreso `dtd.destino=practica-personal-nueva` y que la base esté vacía. Registrar el UUID de `practica_privada.destino` como `PRACTICA_DATOS_INSTANCIA`. PostgREST valida la firma del JWT, expone solo `public` y su autenticador solo debe poder asumir el rol `practica_personal_web`. El receptor recibe ese JWT en `PRACTICA_DATOS_TOKEN` y el origen HTTPS privado de PostgREST en `PRACTICA_DATOS_ORIGEN`. |
| Entrada y salida de red | Asignar el vhost dedicado de Traefik exclusivamente a la plantilla de esta fase, con `PRACTICA_HOST` propio. El servidor web y PostgREST quedan sin puertos públicos directos. Restringir las conexiones salientes del receptor a PostgREST privado y a la consulta de permisos en el origen real. Solo el origen y el navegador necesitan llegar al vhost de práctica. La franja y la comprobación del perfil funcionan con los dos hosts indicados. |

Antes de abrir al equipo corresponde comprobar sobre esa instalación el certificado de ambos sitios, el rol efectivo de PostgREST, el bloqueo de salida a proveedores y la ausencia de datos de clientes. La evidencia de fase 1 utiliza cuentas y bases efímeras. La apertura al equipo espera a la entrega del recorrido previsto en la SDD.

## Repetir la validación

- `pnpm exec vitest run lib/studio/practica/__tests__ --maxWorkers=1` ejecuta los handlers en ambos sitios, las consultas de práctica con PGlite, los casos de revocación y los límites de las funciones SQL. La autenticación de origen y el transporte se sustituyen por servicios en memoria.
- `node infra/ops/tests/practica-navegador.mjs` prueba con Chromium los componentes de entrada y salida en dos orígenes HTTPS ficticios, con teclado, recarga y error de apertura. Admite `PRACTICA_CHROMIUM` para indicar un navegador instalado. La API está simulada en esta comprobación.
- El job **Recepción China en una base efímera** ejecuta el diagnóstico con el esquema completo. Se puede reproducir en infraestructura de prueba desechable con `PRUEBA_RECEPCION_PREORDEN=1 bash infra/ops/tests/prueba-resetear-base-efimera.sh`.
