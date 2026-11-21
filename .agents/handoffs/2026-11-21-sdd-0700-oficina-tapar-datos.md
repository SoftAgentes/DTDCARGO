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
- **Una sola lista para detectar y tapar** (v0.1 la compartía con noticias; ver v0.2 abajo).
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

## v0.2 · Revisión de la #755 (CHANGES_REQUESTED sobre `e909ddb52`)

- **Lista propia: `lib/studio/oficina/datos-personales.ts`.** Copia de la regla de noticias más el teléfono agrupado,
  corregida aquí para no cambiar el detector de noticias: `control.ts` y la export de `cable-textos.ts` volvieron a como
  están en `main`. `detectorDelCable` usa la lista nueva (salida, textos del cable y motivo de la pantalla).
- **B1 y B2:** la cédula entera detrás de «cédula», «C.I.», «CI:», «cédula es» y «N°», con o sin puntos. `estirarDigitos`
  también salta «.» y «-» entre dígitos, y `quedanDatos` escala si un marcador queda con dígitos pegados detrás.
- **M1:** los fijos 02xx (con o sin paréntesis). **M2:** borde al inicio de todos los números, y el móvil sin 0 ni 58
  solo si va separado. Ya no se tocan YT…, SF…, JT…, LP…, «guía 4141234567». **M3:** sector, barrio, quinta, manzana,
  parcela, «av» sin punto, «casa 12», «Casa N.º 14», «torre B». **L3:** RIF de 7 dígitos y con puntos.
- **L2:** código del eval `marcador`: un borrador con «[teléfono]» u otro marcador escala.
- **M4:** pruebas de todos los casos de la revisión (tapa / no toca), de la cola de un número tapado a medias, del
  código `marcador` y de que la regla de noticias sigue igual. **L1** (tapar de más) queda declarado en la spec §5.

## v0.3 · Segunda revisión (CHANGES_REQUESTED sobre `2005f6c56`)

- **M5:** espacio como separador de miles en las tres expresiones de cédula (`datos-personales.ts`): «cédula 12 345 678»,
  «mi cédula: V 12 345 678» y «CI 12 345 678» salen enteras como «[cédula]». En la de la palabra, el espacio solo cuenta
  seguido de tres dígitos (en «cédula 12345678 2 cajas» el «2» queda). `COLA_DE_NUMERO` no cambió: «[teléfono] 3 cajas»
  no escala.
- **L4:** «torre» + vocal sola solo cuenta antes de un signo, del final o de «piso», «apto»…; «la torre a la que va» ya no
  se tapa. El límite que queda está declarado en la spec §5.

## Lo que NO cambió (a propósito)

Sin migración, sin tocar producción, el `.env` ni la base. La regla de noticias (`control.ts`) igual. El chequeo de dinero sigue sobre
el texto sin tapar (en memoria). Los nombres de personas no se tapan; los números de guía tampoco (no son datos).

## Para quien siga

- **Publicar:** el cambio entra en la próxima corrida del despachador tras el deploy. Coordinar con «Director Ofi_Hermes»
  para no publicar a mitad de una tanda. Un escalado con motivo `datos_sin_tapar` significa que el tapado dejó algo
  que el detector ve: mirar el caso (sin copiar el texto a ningún lado) y sumar la prueba.
- **Lo que falta del punto (a):** revisar a los proveedores (Z.AI y DeepSeek: qué guardan, dónde procesan) y avisar al
  cliente. Fuera de esta SDD.
- **Nombres.** Si se quieren tapar nombres de personas hace falta otro enfoque (no hay regla fiable por expresión); la
  conversación ya llega sin el nombre del contacto de Chatwoot, pero el cliente puede escribirlo.
