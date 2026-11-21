# Handoff · SDD-0700 · Oficina_Virtual: tapar los datos personales antes del modelo

**Pedido:** la sesión «Director Ofi_Hermes», el 21/11/2026: antes de la etapa 2 (clientes reales), cumplir la primera
parte del punto (a) de privacidad acordado entre los dos directores. El despachador tapa en el texto del cliente los
correos, teléfonos, cédulas, RIF y direcciones antes de llamar al agente, reutilizando los detectores de la salida. Hija
de SDD-0626. Rama `sdd/0626-tapar-datos-entrada`, desde `origin/main` en `f67daa778`.

## Qué se hizo

- **`lib/studio/oficina/tapar-datos.ts` (nuevo).** `taparDatosPersonales`, `taparMensajes` y `quedanDatos`. Marcadores
  «[correo]», «[teléfono]», «[cédula]», «[RIF]» y «[dirección]». Corre las expresiones sobre el texto normalizado como
  el detector y lleva cada hallazgo al texto original con un mapa de posiciones; junta los que se pisan; estira sobre
  dígitos pegados; y estira la dirección hasta el final de la frase (y hacia atrás hasta su palabra de calle). Detalle en
  la spec §3.3.
- **Sin expresiones nuevas.** `lib/news/autopublicar/control.ts` exporta su lista como `PATRONES_DATOS_PERSONALES`
  (con el tipo de cada una; mismas expresiones, `tieneDatosPersonales` igual, `CONTROL_VERSION` sin cambio porque no
  cambió ninguna expresión). `cable-textos.ts` exporta `TELEFONO_INTERNACIONAL`. Juntas son `detectorDelCable`, lo que
  usa `revisarRespuesta`. Las palabras de calle para estirar hacia atrás se leen del código de la expresión de dirección
  (`PALABRAS_DE_CALLE`), con una prueba que cae si cambia de forma.
- **`despachador.ts`.** Después del chequeo de dinero: `taparMensajes` → si `quedanDatos`, escala `datos_sin_tapar` sin
  llamar → `armarEntrada` (exportada) con el id y los guiones tal cual. Una línea nueva en las instrucciones
  (`AVISO_DATOS_TAPADOS`). Se tapan los dos roles. La revisión de la salida no cambió.
- **Pruebas.** `lib/studio/oficina/__tests__/tapar-datos.test.ts` (casos de Venezuela: +58 / 0414-…, 58-424…,
  V-12.345.678, E 1234567, C.I., J-…, correos, direcciones con «Av.» y «Edif.», el +86 de China, texto sin datos, el
  guion y el `conversacion_id` intactos). En `oficina-despachador.test.ts`, la prueba de privacidad ahora mira lo que
  recibe el agente: trae `[teléfono]` y no `0414-555-1234`.
- **Docs.** `privacidad.md`, hallazgo 13: la fila del proveedor decía «respaldo DeepSeek quitado» y era falso. Desde el
  16/11/2026 a las 12:10Z el agente `soporte-chatwoot` tiene glm-5.3 (Z.AI) de principal y deepseek-chat de respaldo
  (comprobado el 20/11 con `hermes fallback list`). Se corrigió con la fecha, y la fila del ERP y la del proveedor
  anotan que desde esta SDD el texto llega tapado. Viñeta nueva con lo que NO se tapa. Spec en
  `docs/specs/0700-oficina-tapar-datos/spec.md`.

## Lo que NO cambió (a propósito)

Sin migración, sin tocar producción, el `.env` ni la base. `revisarRespuesta` igual. El chequeo de dinero sigue sobre
el texto sin tapar (en memoria). Los nombres de personas y los números de guía no se tapan.

## Para quien siga

- **Publicar:** el cambio entra en la próxima corrida del despachador tras el deploy. Coordinar con «Director Ofi_Hermes»
  para no publicar a mitad de una tanda. Un escalado con motivo `datos_sin_tapar` significa que el tapado dejó algo
  que el detector ve: mirar el caso (sin copiar el texto a ningún lado) y sumar la prueba.
- **Lo que falta del punto (a):** revisar a los proveedores (Z.AI y DeepSeek: qué guardan, dónde procesan) y avisar al
  cliente. Fuera de esta SDD.
- **Nombres.** Si se quieren tapar nombres de personas hace falta otro enfoque (no hay regla fiable por expresión); la
  conversación ya llega sin el nombre del contacto de Chatwoot, pero el cliente puede escribirlo.
