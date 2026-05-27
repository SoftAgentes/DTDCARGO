/* global React */
/* ── DTD Portal · Registro de Cliente ───────────────────────── */
/* 3 pasos: datos personales/empresa → dirección VE → confirmación */
/*                                                                  */
/* ⚠ INSTRUCCIONES PARA CLAUDE CODE / DEVS:                         */
/* La nomenclatura completa del MARKBOX, etiquetas de proveedores,  */
/* nomenclatura de órdenes de compra, etiquetado de cajas, formato  */
/* de packing list, identificadores DTD-XXXX / DTDU-XXXXXX / CN-... */
/* y demás reglas de codificación operativa están especificadas en  */
/* el CLAUDE.md del proyecto y en los docs internos accesibles      */
/* desde Claude Code (NO desde este entorno de diseño).             */
/*                                                                  */
/* Antes de implementar la lógica real (validación de formato del   */
/* MARKBOX, generación del código secuencial, emails de bienvenida  */
/* con la guía adjunta, generación de etiquetas PDF para           */
/* proveedores chinos, etc.), Claude Code DEBE leer:                */
/*   1. CLAUDE.md (sección de codificación/nomenclatura)            */
/*   2. Cualquier README o docs internos sobre formato MARKBOX      */
/*   3. La plantilla 'm-05 · Bienvenida MARKBOX' en erp/data.jsx    */
/*      (campo MAIL_TEMPLATES) que tiene el copy oficial de email   */
/*                                                                  */
/* La guía visual que muestra esta vista (componente Guide) es un   */
/* RESUMEN amigable de esa nomenclatura. Si las reglas difieren     */
/* entre lo que está acá y la nomenclatura oficial, manda la        */
/* oficial — corregí este archivo para alinearlo.                   */
/* ───────────────────────────────────────────────────────────── */


(function () {
  const { useState, useEffect, useMemo } = React;

  function RegistroCliente() {
    const [step, setStep] = useState(1);
    const [data, setData] = useState({
      tipo: 'persona', name: '', company: '', rif: '', cedula: '',
      email: '', phone: '', whatsapp: true,
      photoCedula: null,
      state: '', municipio: '', city: '', parroquia: '', barrio: '',
      postalCode: '', address: '', reference: '',
      photoFachada: null,
    });
    const [markbox, setMarkbox] = useState(null);
    const [emailSent, setEmailSent] = useState(false);

    function update(patch) { setData({ ...data, ...patch }); }

    function nextStep() {
      if (step < 3) setStep(step + 1);
    }
    function prevStep() {
      if (step > 1) setStep(step - 1);
    }
    function submit() {
      // ── Genera MARKBOX secuencial · ahora vía helper server-side ──
      // El helper window.DTDData.nextMarkbox() valida formato + unicidad
      // contra clients del bridge + seed CLIENTS, con retry defensivo.
      let newMarkbox;
      if (window.DTDData && window.DTDData.nextMarkbox) {
        newMarkbox = window.DTDData.nextMarkbox();
        // Doble check defensivo
        if (!window.DTDData.validateMarkboxFormat(newMarkbox)) {
          console.error('[registro] nextMarkbox devolvió formato inválido:', newMarkbox);
          newMarkbox = `DTD-${5500 + Math.floor(Math.random() * 500)}`;
        }
      } else {
        newMarkbox = `DTD-${5500 + Math.floor(Math.random() * 500)}`;
      }
      setMarkbox(newMarkbox);

      // Publicar al bridge (compartido entre módulos)
      let newClient = null;
      if (window.DTDData) {
        newClient = {
          markbox: newMarkbox,
          name: data.name,
          company: data.company || null,
          tipo: data.tipo,
          cedula: data.cedula || data.rif,
          email: data.email,
          phone: data.phone,
          whatsapp: data.whatsapp,
          state: data.state,
          municipio: data.municipio,
          city: data.city,
          barrio: data.barrio === '__other__' ? data.barrioCustom : data.barrio,
          postalCode: data.postalCode,
          address: data.address,
          reference: data.reference,
          photoFachada: data.photoFachada,
          photoCedula: data.photoCedula,
          tier: 'standard',
          since: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
        };
        const cur = window.DTDData.clients.read();
        window.DTDData.clients.write([newClient, ...cur]);
      }

      // ── Email de bienvenida real (template m-05) ────────────
      // Se envía automáticamente vía helper. Guarda en bridge
      // (Mailing → Logs) + audit log. En prod = SMTP real.
      let emailEntry = null;
      if (newClient && window.DTDData && window.DTDData.sendWelcomeEmail) {
        try {
          emailEntry = window.DTDData.sendWelcomeEmail(newClient);
        } catch (e) {
          console.error('[registro] sendWelcomeEmail falló:', e);
        }
      }
      setEmailSent(!!emailEntry);

      setStep(4);
    }

    return (
      <div style={{
        maxWidth: 640, margin: '0 auto', minHeight: '100vh',
        background: 'var(--bg-base)', color: 'var(--ink)',
        padding: '20px 16px 32px',
      }}>
        <Header step={step} />

        {step === 1 && <Step1 data={data} update={update} onNext={nextStep} />}
        {step === 2 && <Step2 data={data} update={update} onNext={nextStep} onBack={prevStep} />}
        {step === 3 && <Step3 data={data} onSubmit={submit} onBack={prevStep} />}
        {step === 4 && <StepSuccess data={data} markbox={markbox} emailSent={emailSent} />}
      </div>
    );
  }

  function Header({ step }) {
    const labels = ['Datos', 'Dirección VE', 'Confirmar', 'Listo'];
    return (
      <header style={{ marginBottom: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 'var(--r-md)',
            background: 'var(--wine)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            font: '900 16px/1 var(--f-display)', margin: '0 auto 12px',
          }}>DTD</div>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Registro de cliente
          </div>
          <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
            Creá tu cuenta DTD-Cargo · 3 minutos
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${labels.length}, 1fr)`, gap: 4 }}>
          {labels.map((l, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={l} style={{
                padding: '8px 6px',
                background: done ? 'var(--success-bg)' : active ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                borderBottom: `2px solid ${done ? 'var(--success)' : active ? 'var(--wine)' : 'var(--border)'}`,
                borderRadius: 'var(--r-sm)',
                textAlign: 'center',
              }}>
                <div style={{ font: '700 9.5px/1 var(--f-sans)', color: done ? 'var(--success)' : active ? 'var(--wine)' : 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {n}. {l}
                </div>
              </div>
            );
          })}
        </div>
      </header>
    );
  }

  function Step1({ data, update, onNext }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const valid = data.name && (data.tipo === 'persona' ? data.cedula : data.rif) && data.email && data.phone;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionLabel>Tipo de cliente</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <TypeCard active={data.tipo === 'persona'} onClick={() => update({ tipo: 'persona' })}
            label="Persona natural" desc="Importás a título personal" icon={I.users(18)} />
          <TypeCard active={data.tipo === 'empresa'} onClick={() => update({ tipo: 'empresa' })}
            label="Empresa" desc="Importás para tu negocio · razón social" icon={I.shield(18)} />
        </div>

        <SectionLabel>Identificación</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: data.tipo === 'empresa' ? '1fr 1fr' : '1fr', gap: 10 }}>
          <U.Input label={data.tipo === 'empresa' ? 'Nombre de contacto' : 'Nombre completo'}
            value={data.name} onChange={(e) => update({ name: e.target.value })} placeholder="Carlos Pérez" />
          {data.tipo === 'empresa' && (
            <U.Input label="Razón social" value={data.company} onChange={(e) => update({ company: e.target.value })} placeholder="Importadora Pérez CA" />
          )}
        </div>
        <U.Input label={data.tipo === 'empresa' ? 'RIF' : 'Cédula'}
          value={data.tipo === 'empresa' ? data.rif : data.cedula}
          onChange={(e) => update(data.tipo === 'empresa' ? { rif: e.target.value } : { cedula: e.target.value })}
          placeholder={data.tipo === 'empresa' ? 'J-XXXXXXXX-X' : 'V-XXXXXXXX'} mono />

        <SectionLabel>Foto de la {data.tipo === 'empresa' ? 'RIF' : 'cédula'}</SectionLabel>
        <PhotoUpload value={data.photoCedula} onChange={(v) => update({ photoCedula: v })}
          label={data.tipo === 'empresa' ? 'Subí foto del RIF · ambos lados' : 'Subí foto de la cédula · anverso y reverso'} />

        <SectionLabel>Contacto</SectionLabel>
        <U.Input label="Email" type="email" value={data.email} onChange={(e) => update({ email: e.target.value })} placeholder="cperez@empresa.com" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <U.Input label="Teléfono" value={data.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="+58 412 XXX-XXXX" mono />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingBottom: 10, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
            <input type="checkbox" checked={data.whatsapp} onChange={(e) => update({ whatsapp: e.target.checked })} style={{ accentColor: 'var(--success)' }} />
            WhatsApp
          </label>
        </div>

        <U.Btn variant="primary" size="lg" full disabled={!valid} onClick={onNext} iconRight={I.arrowR(14)}>Siguiente · Dirección</U.Btn>
      </div>
    );
  }

  function Step2({ data, update, onNext, onBack }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const cat = window.VECatalog;
    const states = cat ? cat.STATES.filter(s => !s.virtual).map(s => s.name).sort() : [];
    const municipios = useMemo(() => {
      if (!cat || !data.state) return [];
      const st = cat.STATES.find(s => s.name === data.state);
      return st ? st.municipios.map(m => m.name) : [];
    }, [data.state]);
    const cities = useMemo(() => {
      if (!cat || !data.state || !data.municipio) return [];
      const st = cat.STATES.find(s => s.name === data.state);
      const mu = st?.municipios.find(m => m.name === data.municipio);
      return mu ? mu.cities : [];
    }, [data.state, data.municipio]);
    const cityObj = cities.find(c => c.name === data.city);
    const barrios = cityObj?.barrios || [];

    // Auto-fill postal code when city changes
    useEffect(() => {
      if (cityObj && cityObj.postalCode && !data.postalCode) {
        update({ postalCode: cityObj.postalCode });
      }
    }, [cityObj]);

    const valid = data.state && data.municipio && data.city && data.address;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionLabel>Dirección de entrega</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <U.Select label="Estado" value={data.state}
            onChange={(e) => update({ state: e.target.value, municipio: '', city: '', postalCode: '' })}
            options={[{ value: '', label: '— Elegí —' }, ...states.map(s => ({ value: s, label: s }))]} />
          <U.Select label="Municipio" value={data.municipio}
            onChange={(e) => update({ municipio: e.target.value, city: '', postalCode: '' })}
            options={[{ value: '', label: '— Elegí —' }, ...municipios.map(m => ({ value: m, label: m }))]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <U.Select label="Ciudad" value={data.city}
            onChange={(e) => {
              const c = cities.find(x => x.name === e.target.value);
              update({ city: e.target.value, postalCode: c?.postalCode || '' });
            }}
            options={[{ value: '', label: '— Elegí —' }, ...cities.map(c => ({ value: c.name, label: c.name }))]} />
          <U.Input label="Código postal" value={data.postalCode}
            onChange={(e) => update({ postalCode: e.target.value })} placeholder="4 dígitos" mono />
        </div>
        <U.Select label="Barrio / urbanización" value={data.barrio}
          onChange={(e) => update({ barrio: e.target.value })}
          options={[{ value: '', label: '— Elegí (opcional) —' }, ...barrios.map(b => ({ value: b, label: b })), { value: '__other__', label: 'Otro · escribir manualmente' }]} />
        {data.barrio === '__other__' && (
          <U.Input label="Barrio (manual)" value={data.barrioCustom || ''} onChange={(e) => update({ barrioCustom: e.target.value })} />
        )}

        <U.Input label="Dirección detallada"
          value={data.address} onChange={(e) => update({ address: e.target.value })}
          placeholder="Av. principal, edif. Tía Mary, piso 3, apto 4-B" hint="Calle, número, edificio, piso, apartamento" />

        <U.Input label="Punto de referencia (opcional)"
          value={data.reference} onChange={(e) => update({ reference: e.target.value })}
          placeholder="Ej: frente a la panadería La Espiga" />

        <SectionLabel>Foto de la fachada (opcional pero útil)</SectionLabel>
        <PhotoUpload value={data.photoFachada} onChange={(v) => update({ photoFachada: v })}
          label="Subí una foto de la entrada de tu casa o local · ayuda al camionero a encontrarte rápido" />

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
          <U.Btn variant="ghost" size="lg" onClick={onBack} icon={I.arrowL(14)}>Volver</U.Btn>
          <U.Btn variant="primary" size="lg" full disabled={!valid} onClick={onNext} iconRight={I.arrowR(14)}>Siguiente · Confirmar</U.Btn>
        </div>
      </div>
    );
  }

  function Step3({ data, onSubmit, onBack }) {
    const U = window.ERPUI;
    const I = window.Icon;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionLabel>Confirmá tus datos</SectionLabel>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine">{data.tipo === 'empresa' ? 'EMPRESA' : 'PERSONA NATURAL'}</div>
          <div style={{ font: '900 17px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.02em' }}>{data.company || data.name}</div>
          {data.company && <div style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Contacto: {data.name}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <Field label={data.tipo === 'empresa' ? 'RIF' : 'Cédula'} value={data.tipo === 'empresa' ? data.rif : data.cedula} mono />
            <Field label="Email" value={data.email} />
            <Field label="Teléfono" value={data.phone + (data.whatsapp ? ' · WhatsApp ✓' : '')} mono />
            <Field label="Foto identidad" value={data.photoCedula ? '✓ Cargada' : '— Falta'} tone={data.photoCedula ? 'success' : 'warning'} />
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine">DIRECCIÓN DE ENTREGA</div>
          <div style={{ font: '700 14px/1.4 var(--f-sans)', color: 'var(--ink)', marginTop: 6 }}>{data.address}</div>
          {(data.barrio && data.barrio !== '__other__') && <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{data.barrio}</div>}
          {data.barrioCustom && <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{data.barrioCustom}</div>}
          <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{data.city} · {data.municipio} · {data.state}</div>
          {data.postalCode && <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 6, display: 'inline-block' }}>CP {data.postalCode}</code>}
          {data.reference && <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 'var(--r-sm)', font: '500 11.5px/1.4 var(--f-sans)' }}>📍 {data.reference}</div>}
          <div style={{ marginTop: 10, font: '500 11.5px/1 var(--f-sans)', color: data.photoFachada ? 'var(--success)' : 'var(--ink-mute)' }}>
            {data.photoFachada ? '✓ Foto fachada cargada' : '— Sin foto fachada'}
          </div>
        </U.Card>

        <div style={{ padding: '10px 12px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 'var(--r-md)', font: '500 11.5px/1.5 var(--f-sans)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
          <span>Al confirmar, se genera tu código <b>MARKBOX</b> personal. Vas a usarlo cuando coordines envíos desde China — tus proveedores deben anotarlo en cada caja.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
          <U.Btn variant="ghost" size="lg" onClick={onBack} icon={I.arrowL(14)}>Volver</U.Btn>
          <U.Btn variant="primary" size="lg" full onClick={onSubmit} icon={I.check(15)}>Confirmar y generar MARKBOX</U.Btn>
        </div>
      </div>
    );
  }

  function StepSuccess({ data, markbox, emailSent }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [showGuide, setShowGuide] = useState(false);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', textAlign: 'center', paddingTop: 20 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.check(40)}</div>
        <div>
          <div style={{ font: '900 26px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em' }}>Bienvenido a la familia de DoorTuDoor Cargo</div>
          <div style={{ font: '500 13.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: '40ch' }}>
            Tu cuenta está activa, {data.name?.split(' ')[0]}. Este es tu código MARKBOX personal — guardalo, vas a usarlo mucho.
          </div>
        </div>

        <div style={{
          padding: '24px 36px',
          background: 'var(--wine)', color: '#fff',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>TU MARKBOX</div>
          <code style={{ font: '900 36px/1 var(--f-mono)', color: '#fff', letterSpacing: '-0.02em' }}>{markbox}</code>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 360 }}>
          <U.Btn variant="secondary" size="lg" icon={I.copy(14)}>Copiar código</U.Btn>
          <U.Btn variant="primary" size="lg" iconRight={I.arrowR(14)}>Ir al portal</U.Btn>
        </div>

        {/* Mini-guía de codificación */}
        <button onClick={() => setShowGuide(!showGuide)} className={showGuide ? '' : 'guide-pulse'} style={{
          width: '100%', maxWidth: 480, padding: '12px 14px',
          background: 'var(--bg-elevated)', color: 'var(--wine)',
          border: '1px solid var(--wine)', borderRadius: 'var(--r-md)',
          font: '700 12.5px/1 var(--f-sans)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          position: 'relative',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {I.info(14)} Cómo usar tu código MARKBOX (1 min)
          </span>
          <span className={showGuide ? '' : 'guide-arrow-bounce'} style={{ transform: `rotate(${showGuide ? 180 : 0}deg)`, transition: 'transform var(--dur) var(--ease)', display: 'inline-flex' }}>{I.chevD(13)}</span>
        </button>

        {showGuide && (
          <div style={{ width: '100%', maxWidth: 480, textAlign: 'left', animation: 'erp-fade 220ms var(--ease)' }}>
            <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>NOMENCLATURA · CÓMO FUNCIONA</div>

              <Guide n="1" title="Cuando compres en China, dale tu MARKBOX al proveedor">
                Cuando coordines un envío con un supplier chino (Yiwu, Guangzhou, Shenzhen, Shanghai), pasale tu código <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)', padding: '1px 5px', background: 'var(--wine-tint)', borderRadius: 4 }}>{markbox}</code>.
                El proveedor lo va a escribir en cada caja antes de despacharla a nuestro almacén CN.
              </Guide>

              <Guide n="2" title="Formato de etiqueta · qué debe ir en cada caja">
                Pedile a tu proveedor que pegue esta etiqueta en TODAS las cajas (frente visible). Sin esto, la caja entra como "huérfana" y no la podemos asociar a tu cuenta.
                <div style={{ marginTop: 10, padding: 14, background: '#fff', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', textAlign: 'center', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ font: '700 9px/1 var(--f-sans)', color: '#9B9B9B', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>SHIPPING TO DTD-CARGO</div>
                  <code style={{ font: '900 22px/1 var(--f-mono)', color: '#0F1E3D', letterSpacing: '-0.01em' }}>{markbox}</code>
                  <div style={{ marginTop: 8, font: '600 11px/1.4 var(--f-sans)', color: '#6B6B6B' }}>{data.name} {data.company && `· ${data.company}`}</div>
                  <div style={{ marginTop: 4, font: '500 10px/1 var(--f-sans)', color: '#9B9B9B' }}>Box ___ / ___</div>
                </div>
              </Guide>

              <Guide n="3" title="Numerá las cajas (Box X / Y)">
                Si tu pedido viene en 12 cajas, etiquetá <b>1/12 · 2/12 · 3/12 …</b> Así controlás si llegaron todas. En el portal vas a ver el conteo en tiempo real.
              </Guide>

              <Guide n="4" title="Lo que pasa después" last>
                <ul style={{ paddingLeft: 18, margin: '4px 0 0' }}>
                  <li>Tus cajas llegan a nuestro almacén China · te avisamos por email/WhatsApp.</li>
                  <li>Consolidamos con otros pedidos para optimizar costos (LCL).</li>
                  <li>Zarpe + tránsito marítimo (~30-40 días según puerto).</li>
                  <li>Aduana VE, liberación SENIAT, entrega final puerta a puerta.</li>
                </ul>
              </Guide>

              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 'var(--r-sm)', font: '500 11.5px/1.4 var(--f-sans)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(12)}</span>
                <span>¿Dudas? Hablá con nosotros por WhatsApp <b>+58 412 DTD-CARG</b> o respondé el email de bienvenida.</span>
              </div>
            </U.Card>
          </div>
        )}

        {/* Email preview */}
        <div style={{ marginTop: 4, padding: '14px 16px', background: emailSent ? 'var(--success-bg)' : 'var(--bg-elevated)', border: emailSent ? '1px solid var(--success)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', maxWidth: 480, font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ color: emailSent ? 'var(--success)' : 'var(--ink-mute)', flexShrink: 0, marginTop: 1 }}>{emailSent ? I.check(15) : I.mail(15)}</span>
          <span>
            {emailSent ? (
              <><b style={{ color: 'var(--success)' }}>Email enviado</b> a <b style={{ color: 'var(--ink)' }}>{data.email}</b> con tu código <b style={{ color: 'var(--wine)' }}>{markbox}</b>, la guía de nomenclatura y el link al portal. <span style={{ color: 'var(--ink-mute)' }}>Revisá la bandeja de entrada o spam.</span></>
            ) : (
              <>Te enviaremos un email a <b style={{ color: 'var(--ink)' }}>{data.email}</b> con tu código <b style={{ color: 'var(--wine)' }}>{markbox}</b>, la guía de nomenclatura y el link al portal.</>
            )}
          </span>
        </div>
      </div>
    );
  }

  function Guide({ n, title, children, last }) {
    return (
      <div style={{ paddingBottom: last ? 0 : 14, marginBottom: last ? 0 : 14, borderBottom: last ? 'none' : '1px dashed var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'var(--wine)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            font: '900 12px/1 var(--f-display)',
          }}>{n}</span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '800 13.5px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 6 }}>{title}</div>
            <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>{children}</div>
          </div>
        </div>
      </div>
    );
  }

  function SectionLabel({ children }) {
    return (
      <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{children}</div>
    );
  }

  function TypeCard({ active, onClick, label, desc, icon }) {
    return (
      <button onClick={onClick} style={{
        padding: 14, textAlign: 'left',
        background: active ? 'var(--wine-tint)' : 'var(--bg-surface)',
        border: `1px solid ${active ? 'var(--wine)' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)',
        boxShadow: active ? '0 0 0 3px var(--wine-tint)' : 'var(--shadow-xs)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: active ? 'var(--wine)' : 'var(--ink-soft)' }}>{icon}</span>
          <div style={{ font: '800 13.5px/1.1 var(--f-display)', color: active ? 'var(--wine)' : 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</div>
        </div>
        <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{desc}</div>
      </button>
    );
  }

  function PhotoUpload({ value, onChange, label }) {
    const I = window.Icon;
    return value ? (
      <div style={{ padding: 12, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--success)' }}>{I.check(16)}</span>
        <div style={{ flex: 1, font: '700 12.5px/1.3 var(--f-sans)', color: 'var(--success)' }}>Foto cargada</div>
        <button onClick={() => onChange(null)} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', padding: '4px 8px' }}>Quitar</button>
      </div>
    ) : (
      <button onClick={() => onChange('mock-photo-' + Date.now())} style={{
        padding: '20px 14px',
        background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--r-md)', color: 'var(--ink-soft)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        font: '600 12px/1.4 var(--f-sans)', textAlign: 'center',
      }}>
        {I.upload(20)}
        <span>{label}</span>
      </button>
    );
  }

  function Field({ label, value, mono, tone }) {
    const color = tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--warning)' : 'var(--ink)';
    return (
      <div>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ font: `${mono ? '700' : '600'} 13px/1.3 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`, color }}>{value || '—'}</div>
      </div>
    );
  }

  window.RegistroCliente = RegistroCliente;
})();
