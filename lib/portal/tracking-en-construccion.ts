/**
 * Interruptor único del aviso «Seguimiento en construcción» del Portal
 * (SDD-0514 · pedido de Sam, 2026-10-14).
 *
 * Por qué existe: los clientes cargan sus pre-alertas, pero el almacén de China
 * todavía registra la mercancía en Excel y no en el sistema. Lo que sigue a la
 * pre-alerta (recepción en bodega, envío, tracking) sale vacío y el cliente cree
 * que el Portal «no funciona». El aviso le dice que la herramienta está por
 * activarse.
 *
 * Cómo se apaga: cuando el almacén empiece a registrar en el sistema, cambia este
 * valor a `false`. El aviso depende sólo de este valor: el componente
 * `app/portal/_components/PortalTrackingEnConstruccion.tsx` lo lee y todas las
 * pantallas que lo muestran (portada, Envíos, detalle de envío y detalle de
 * compra) dejan de pintarlo a la vez.
 *
 * Con el mismo valor se suavizan los textos que prometen un aviso o una
 * recepción automática de bodega (SDD-0516): el detalle de una compra sin
 * recepciones (`app/portal/(app)/compras/[code]/page.tsx`) y la tarjeta de
 * notificaciones de la portada (`app/portal/(app)/page.tsx`). Fuera del Portal,
 * el paso Contacto del registro público (`app/registro/RegisterForm.tsx`,
 * SDD-0517) deja de prometer avisos por WhatsApp y la ficha de pre-alerta de
 * `/servicios` (`components/servicios/hub-fichas.tsx`, SDD-0519) deja de
 * prometer el aviso de llegada.
 *
 * Y la web pública deja de prometer rastreo (SDD-0521): el enlace del pie de
 * página (`components/Footer.tsx`), la tarjeta y los metadatos de `/enlaces`
 * (`app/enlaces/page.tsx`), el botón de la 404 (`app/not-found.tsx`), el acceso
 * de Actualidad (`app/noticias/_components/ActualidadHub.tsx`), el botón de
 * `/verificar` (`app/verificar/page.tsx`), la tarjeta de trazabilidad de
 * `/brochure` (`components/Philosophy.tsx`, con su texto en `lib/design-tokens.ts`),
 * el paso 06 de `/shipping-mark` (`components/ShippingMark.tsx`) y la
 * descripción, la entrada y un beneficio de `/pre-alertas`
 * (`app/pre-alertas/page.tsx`).
 *
 * También dejan de prometer seguimiento (SDD-0528) la puerta de acceso
 * `/entrar` (`app/entrar/EntrarForm.tsx`: dos beneficios y el párrafo del panel
 * lateral; el acceso no cambia) y los términos DTDU y POD de `/glosario`
 * (`app/glosario/page.tsx`, con su texto en `lib/design-tokens.ts`; la ficha y
 * su JSON-LD). `public/llms.txt` es estático y no lee este valor: su enlace al
 * Portal dice «Portal del cliente», que es cierto en las dos posiciones.
 *
 * Al apagarlo, vuelven todos esos textos de siempre en el mismo momento.
 *
 * Este módulo no importa nada a propósito: lo leen también páginas y
 * componentes públicos (algunos de cliente, como el registro), y no debe
 * arrastrar código del Portal ni de la base al navegador. Lo vigila
 * `components/servicios/hub-fichas-sin-promesa-bodega.test.tsx`.
 *
 * En el mismo commit, cambia también su `value` en `scripts/feature-constants.json`.
 * Eso no cambia el comportamiento: deja dicho en qué estado quedó para el
 * cliente. Si se te olvida, el paso `feature-constants` de `pnpm verify` se pone
 * rojo y te dice qué archivo falta.
 *
 * Es una constante en el código y no una variable de entorno a propósito: el
 * 2026-10-15 la web se muda de Vercel al VPS, y una variable nueva quedaría sin
 * configurar en uno de los dos lados. Apagarlo es un commit, que viaja igual a
 * los dos.
 *
 * El tipo `boolean` explícito evita que TypeScript lo estreche a `true` y trate
 * la rama apagada como imposible.
 */
export const TRACKING_EN_CONSTRUCCION: boolean = true;
