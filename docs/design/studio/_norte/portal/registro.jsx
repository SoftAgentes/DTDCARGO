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
      email: '', phone: '', phoneOffice: '', whatsapp: true,
      photoCedula: null,
      state: '', municipio: '', city: '', parroquia: '', barrio: '',
      postalCode: '', address: '', reference: '',
      photoFachada: null
    });
    const [markbox, setMarkbox] = useState(null);
    const [emailSent, setEmailSent] = useState(false);

    function update(patch) {setData({ ...data, ...patch });}

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
        // ── Pre-chequeo CNE interno (solo persona natural) ──
        // No bloquea ni se muestra al cliente. Si la cédula + nombre
        // no coinciden con el registro, queda una pre-alerta interna
        // en el cliente + una notificación discreta al ERP.
        let cneFlag = null;
        if (data.tipo === 'persona' && data.cedula && window.DTDData.cneVerify) {
          try {cneFlag = window.DTDData.cneVerify(data.cedula, data.name);}
          catch (e) {console.error('[registro] cneVerify falló:', e);}
        }

        newClient = {
          markbox: newMarkbox,
          name: data.name,
          company: data.company || null,
          tipo: data.tipo,
          cedula: data.cedula || data.rif,
          rif: data.tipo === 'empresa' ? data.rif : null,
          email: data.email,
          phone: data.phone,
          phoneOffice: data.phoneOffice || null,
          whatsapp: true,
          cneFlag, // pre-alerta interna · no visible al cliente
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
          createdAt: new Date().toISOString()
        };
        const cur = window.DTDData.clients.read();
        window.DTDData.clients.write([newClient, ...cur]);
        // Aviso al ERP (badge + notificación para aprobar el registro)
        if (window.DTDData.pushPortalEvent) {
          try {
            window.DTDData.pushPortalEvent({
              kind: 'registro', tone: 'wine', markbox: newMarkbox,
              title: 'Registro nuevo · ' + (newClient.name || 'cliente'),
              detail: (newClient.company ? newClient.company + ' · ' : '') + 'Esperando aprobación',
              channel: 'portal-web'
            });
          } catch (e) {console.error('[registro] pushPortalEvent falló:', e);}
        }
        // Pre-alerta CNE interna · solo si hay discrepancia (no la ve el cliente)
        if (cneFlag && cneFlag.status === 'mismatch' && window.DTDData.pushPortalEvent) {
          try {
            window.DTDData.pushPortalEvent({
              kind: 'cne-alert', tone: 'danger', markbox: newMarkbox,
              title: 'Pre-alerta CNE · ' + (newClient.name || 'cliente'),
              detail: `Cédula ${data.cedula} no coincide con el nombre del registro CNE` + (
              cneFlag.registryName ? ` (CNE: ${cneFlag.registryName})` : ''),
              channel: 'interno', internal: true
            });
          } catch (e) {console.error('[registro] pushPortalEvent CNE falló:', e);}
        }
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
        padding: '20px 16px 32px'
      }}>
        <Header step={step} />

        {step === 1 && <Step1 data={data} update={update} onNext={nextStep} />}
        {step === 2 && <Step2 data={data} update={update} onNext={nextStep} onBack={prevStep} />}
        {step === 3 && <Step3 data={data} update={update} onSubmit={submit} onBack={prevStep} />}
        {step === 4 && <StepSuccess data={data} markbox={markbox} emailSent={emailSent} />}
      </div>);

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
            font: '900 16px/1 var(--f-display)', margin: '0 auto 12px'
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
                textAlign: 'center'
              }}>
                <div style={{ font: '700 9.5px/1 var(--f-sans)', color: done ? 'var(--success)' : active ? 'var(--wine)' : 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {n}. {l}
                </div>
              </div>);

          })}
        </div>
      </header>);

  }

  function Step1({ data, update, onNext }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const esEmpresa = data.tipo === 'empresa';
    const docValue = esEmpresa ? data.rif : data.cedula;

    // ── Chequeo en vivo · ¿el documento ya está registrado? ──
    // Persona → cédula · Empresa → RIF. Si ya existe, no dejamos avanzar:
    // ofrecemos recuperar la cuenta (ver DupAlert).
    const dupClient = useMemo(() => {
      const q = (docValue || '').trim();
      if (q.length < 6 || !window.DTDData || !window.DTDData.findClientByDoc) return null;
      return window.DTDData.findClientByDoc(q);
    }, [docValue]);

    const [tried, setTried] = useState(false);

    const valid =
    data.name &&
    docValue && (
    !esEmpresa || data.company) &&
    data.photoCedula && // foto de identidad obligatoria
    data.email &&
    data.phone && // WhatsApp obligatorio (oficina es opcional)
    !dupClient; // bloqueado si ya existe

    // Errores por campo · solo se muestran tras intentar continuar.
    const errName = tried && !data.name;
    const errCompany = tried && esEmpresa && !data.company;
    const errDoc = dupClient ? true : tried && !docValue;
    const errPhoto = tried && !data.photoCedula;
    const errEmail = tried && !data.email;
    const errPhone = tried && !data.phone;

    function handleNext() {
      if (valid) onNext();else setTried(true);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionLabel>Tipo de cliente</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <TypeCard active={!esEmpresa} onClick={() => update({ tipo: 'persona' })}
          label="Persona natural" desc="Importás a título personal" icon={I.users(18)} />
          <TypeCard active={esEmpresa} onClick={() => update({ tipo: 'empresa' })}
          label="Empresa" desc="Importás para tu negocio · razón social" icon={I.shield(18)} />
        </div>

        <SectionLabel>Identificación · todos los campos son obligatorios</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: esEmpresa ? '1fr 1fr' : '1fr', gap: 10 }}>
          <U.Input label={esEmpresa ? 'Nombre de contacto' : 'Nombre completo'} required
          error={errName ? 'Campo obligatorio' : undefined}
          value={data.name} onChange={(e) => update({ name: e.target.value })} placeholder="Carlos Pérez" />
          {esEmpresa &&
          <U.Input label="Razón social" required error={errCompany ? 'Campo obligatorio' : undefined}
          value={data.company} onChange={(e) => update({ company: e.target.value })} placeholder="Importadora Pérez CA" />
          }
        </div>
        <U.Input label={esEmpresa ? 'RIF' : 'Cédula'} required
        value={docValue}
        onChange={(e) => update(esEmpresa ? { rif: e.target.value } : { cedula: e.target.value })}
        placeholder={esEmpresa ? 'J-XXXXXXXX-X' : 'V-XXXXXXXX'} mono
        error={dupClient ? `Este ${esEmpresa ? 'RIF' : 'cédula'} ya está registrado` : errDoc ? 'Campo obligatorio' : undefined} />

        {dupClient && <DupAlert client={dupClient} esEmpresa={esEmpresa} />}

        <SectionLabel required error={errPhoto}>Foto de la {esEmpresa ? 'RIF' : 'cédula'}</SectionLabel>
        <PhotoUpload value={data.photoCedula} onChange={(v) => update({ photoCedula: v })} error={errPhoto}
        label={esEmpresa ? 'Subí foto del RIF · ambos lados' : 'Subí foto de la cédula · anverso y reverso'} />
        {errPhoto && <span style={{ font: '600 11px/1.4 var(--f-sans)', color: 'var(--danger)' }}>Tenés que subir la foto.</span>}

        <SectionLabel>Contacto</SectionLabel>
        <U.Input label="Email" type="email" required error={errEmail ? 'Campo obligatorio' : undefined}
        value={data.email} onChange={(e) => update({ email: e.target.value })} placeholder="cperez@empresa.com" />

        {/* Teléfono WhatsApp · siempre WhatsApp, sin opción de desvincular */}
        <U.Input label="Teléfono WhatsApp" required error={errPhone ? 'Campo obligatorio' : undefined}
        value={data.phone} onChange={(e) => update({ phone: e.target.value })}
        placeholder="+58 412 XXX-XXXX" mono
        hint="Es el número por el que te contactamos · siempre es WhatsApp, no se puede desvincular." />

        {/* Teléfono de oficina / oficial · NO es WhatsApp · opcional */}
        <U.Input label="Teléfono de oficina (opcional)"
        value={data.phoneOffice} onChange={(e) => update({ phoneOffice: e.target.value })}
        placeholder="+58 212 XXX-XXXX" mono
        hint="Teléfono fijo u oficial de la empresa · este no se usa para WhatsApp." />

        {tried && !valid && !dupClient &&
        <div style={{ padding: '9px 12px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--r-sm)', font: '600 11.5px/1.4 var(--f-sans)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{I.warn ? I.warn(13) : I.info(13)}</span>
          <span>Faltan datos obligatorios · completá los campos marcados en rojo.</span>
        </div>
        }

        <U.Btn variant="primary" size="lg" full onClick={handleNext} iconRight={I.arrowR(14)}>Siguiente · Dirección</U.Btn>
      </div>);

  }

  // ── Cuenta ya existente · ofrecer recuperación ──────────────
  // Si el documento (cédula/RIF) ya está en el padrón de clientes,
  // no creamos duplicado: mostramos "¿Querés recuperar tu cuenta?".
  function DupAlert({ client, esEmpresa }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [recovering, setRecovering] = useState(false);
    const maskedEmail = client.email ?
    client.email.replace(/^(.).*(@.*)$/, (_, a, b) => a + '•••' + b) :
    null;

    if (recovering) {
      return (
        <div style={{ padding: '14px 16px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>{I.check(16)}</span>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            <b style={{ color: 'var(--success)' }}>Enlace de recuperación enviado</b>
            {maskedEmail ? <> al correo registrado <b>{maskedEmail}</b>.</> : <> al correo registrado de la cuenta.</>}
            {' '}Revisá tu bandeja para volver a entrar con tu MARKBOX <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{client.markbox}</code>.
          </div>
        </div>);
    }

    return (
      <div style={{ padding: '14px 16px', background: 'var(--wine-tint)', border: '1px solid var(--wine)', borderRadius: 'var(--r-md)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wine)', flexShrink: 0, marginTop: 1 }}>{I.info(16)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '800 13px/1.3 var(--f-display)', color: 'var(--wine)' }}>
              Este {esEmpresa ? 'RIF' : 'cédula'} ya tiene una cuenta en DTD-Cargo
            </div>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
              {client.company || client.name ? <>Registrada a nombre de <b style={{ color: 'var(--ink)' }}>{client.company || client.name}</b>. </> : null}
              ¿Querés recuperar tu cuenta en vez de crear una nueva?
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <U.Btn variant="primary" size="md" icon={I.mail(14)} onClick={() => setRecovering(true)}>Recuperar mi cuenta</U.Btn>
        </div>
      </div>);

  }

  function Step2({ data, update, onNext, onBack }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const cat = window.VECatalog;
    const states = cat ? cat.STATES.filter((s) => !s.virtual).map((s) => s.name).sort() : [];
    const municipios = useMemo(() => {
      if (!cat || !data.state) return [];
      const st = cat.STATES.find((s) => s.name === data.state);
      return st ? st.municipios.map((m) => m.name) : [];
    }, [data.state]);
    const cities = useMemo(() => {
      if (!cat || !data.state || !data.municipio) return [];
      const st = cat.STATES.find((s) => s.name === data.state);
      const mu = st?.municipios.find((m) => m.name === data.municipio);
      return mu ? mu.cities : [];
    }, [data.state, data.municipio]);
    const cityObj = cities.find((c) => c.name === data.city);
    const barrios = cityObj?.barrios || [];

    // Auto-fill postal code when city changes
    useEffect(() => {
      if (cityObj && cityObj.postalCode && !data.postalCode) {
        update({ postalCode: cityObj.postalCode });
      }
    }, [cityObj]);

    const barrioOk = data.barrio && (data.barrio !== '__other__' || data.barrioCustom && data.barrioCustom.trim());
    // Todos los campos de la tabla son obligatorios salvo punto de referencia
    // y foto de la fachada.
    const valid = data.state && data.municipio && data.city && data.postalCode && barrioOk && data.address;

    const [tried, setTried] = useState(false);
    const errState = tried && !data.state;
    const errMuni = tried && !data.municipio;
    const errCity = tried && !data.city;
    const errCP = tried && !data.postalCode;
    const errBarrio = tried && !barrioOk;
    const errAddress = tried && !data.address;
    function handleNext() {
      if (valid) onNext();else setTried(true);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionLabel>Dirección de entrega</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <U.Select label="Estado" required error={errState ? 'Obligatorio' : undefined} value={data.state}
          onChange={(e) => update({ state: e.target.value, municipio: '', city: '', postalCode: '' })}
          options={[{ value: '', label: '— Elegí —' }, ...states.map((s) => ({ value: s, label: s }))]} />
          <U.Select label="Municipio" required error={errMuni ? 'Obligatorio' : undefined} value={data.municipio}
          onChange={(e) => update({ municipio: e.target.value, city: '', postalCode: '' })}
          options={[{ value: '', label: '— Elegí —' }, ...municipios.map((m) => ({ value: m, label: m }))]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <U.Select label="Ciudad" required error={errCity ? 'Obligatorio' : undefined} value={data.city}
          onChange={(e) => {
            const c = cities.find((x) => x.name === e.target.value);
            update({ city: e.target.value, postalCode: c?.postalCode || '' });
          }}
          options={[{ value: '', label: '— Elegí —' }, ...cities.map((c) => ({ value: c.name, label: c.name }))]} />
          <U.Input label="Código postal" required error={errCP ? 'Obligatorio' : undefined} value={data.postalCode}
          onChange={(e) => update({ postalCode: e.target.value })} placeholder="4 dígitos" mono />
        </div>
        <U.Select label="Barrio / urbanización" required error={errBarrio && data.barrio !== '__other__' ? 'Obligatorio' : undefined} value={data.barrio}
        onChange={(e) => update({ barrio: e.target.value })}
        options={[{ value: '', label: '— Elegí —' }, ...barrios.map((b) => ({ value: b, label: b })), { value: '__other__', label: 'Otro · escribir manualmente' }]} />
        {data.city && barrios.length === 0 &&
        <span style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginTop: -6 }}>Todavía no tenemos urbanizaciones cargadas para esta ciudad · elegí "Otro" y escribila.</span>
        }
        {data.barrio === '__other__' &&
        <U.Input label="Barrio (manual)" required error={errBarrio ? 'Obligatorio' : undefined} value={data.barrioCustom || ''} onChange={(e) => update({ barrioCustom: e.target.value })} placeholder="Ej. Urb. La Esmeralda" />
        }

        <U.Input label="Dirección detallada" required error={errAddress ? 'Campo obligatorio' : undefined}
        value={data.address} onChange={(e) => update({ address: e.target.value })}
        placeholder="Av. principal, edif. Tía Mary, piso 3, apto 4-B" hint="Calle, número, edificio, piso, apartamento" />

        <U.Input label="Punto de referencia (opcional)" hint="Opcional · ayuda al transportista a ubicarte."
        value={data.reference} onChange={(e) => update({ reference: e.target.value })}
        placeholder="Ej: frente a la panadería La Espiga" />

        <SectionLabel>Foto de la fachada (opcional pero útil)</SectionLabel>
        <PhotoUpload value={data.photoFachada} onChange={(v) => update({ photoFachada: v })}
        label="Subí una foto de la entrada de tu casa o local · ayuda al transportista a encontrarte rápido" />

        {tried && !valid &&
        <div style={{ padding: '9px 12px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--r-sm)', font: '600 11.5px/1.4 var(--f-sans)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{I.warn ? I.warn(13) : I.info(13)}</span>
          <span>Faltan datos obligatorios · completá los campos marcados en rojo.</span>
        </div>
        }

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
          <U.Btn variant="ghost" size="lg" onClick={onBack} icon={I.arrowL(14)}>Volver</U.Btn>
          <U.Btn variant="primary" size="lg" full onClick={handleNext} iconRight={I.arrowR(14)}>Siguiente · Confirmar</U.Btn>
        </div>
      </div>);

  }

  function Step3({ data, update, onSubmit, onBack }) {
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
            <Field label="WhatsApp" value={data.phone} mono />
            <Field label="Tel. oficina" value={data.phoneOffice || '—'} mono />
            <Field label="Foto identidad" value={data.photoCedula ? '✓ Cargada' : '— Falta'} tone={data.photoCedula ? 'success' : 'warning'} />
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine">DIRECCIÓN DE ENTREGA</div>
          <div style={{ font: '700 14px/1.4 var(--f-sans)', color: 'var(--ink)', marginTop: 6 }}>{data.address}</div>
          {data.barrio && data.barrio !== '__other__' && <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{data.barrio}</div>}
          {data.barrioCustom && <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{data.barrioCustom}</div>}
          <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{data.city} · {data.municipio} · {data.state}</div>
          {data.postalCode && <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 6, display: 'inline-block' }}>CP {data.postalCode}</code>}
          {data.reference && <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 'var(--r-sm)', font: '500 11.5px/1.4 var(--f-sans)' }}>📍 {data.reference}</div>}
          <div style={{ marginTop: 10, font: '500 11.5px/1 var(--f-sans)', color: data.photoFachada ? 'var(--success)' : 'var(--ink-mute)' }}>
            {data.photoFachada ? '✓ Foto fachada cargada' : '— Sin foto fachada'}
          </div>
        </U.Card>

        {/* ── CTA opcional · ¿ya tenés una compra en China? ── */}
        <PurchaseCTA data={data} update={update} />

        {/* ── Instrucción operativa · regla de caja huérfana ──────────────
               Si la caja llega a China con el MARKBOX pero SIN proveedor /
               grupo WeChat asociado, el almacén CN la marca automáticamente
               como "caja huérfana por falta de datos": sabemos quién es el
               cliente, pero no de qué proveedor (grupo WeChat) viene.
               ⚠ BACKEND: el registro del proveedor de acá (PurchaseCTA) debe
               conectarse al pipeline del almacén CN — mapear MARKBOX ↔ grupo
               WeChat ↔ proveedor — para que la asociación sea automática en
               recepción. Ver erp/data.jsx (SUPPLIER_CLIENTS.wechatGroup) y el
               módulo Almacén CN. */}
        {data.supplierName ?
        <div style={{ padding: '10px 12px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 'var(--r-md)', font: '500 11.5px/1.5 var(--f-sans)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
            <span>Al confirmar generamos tu <b>MARKBOX</b> y el código de compra de tu proveedor. Tus cajas llegarán a China ya asociadas a tu cuenta y a tu proveedor (grupo WeChat).</span>
          </div> :

        <div style={{ padding: '10px 12px', background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 'var(--r-md)', font: '500 11.5px/1.5 var(--f-sans)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.warn ? I.warn(13) : I.info(13)}</span>
            <span>Al confirmar se genera tu <b>MARKBOX</b>. <b>Importante:</b> si tu caja llega a China solo con el MARKBOX y sin un proveedor registrado, nuestro almacén la marca como <b>caja huérfana</b> — sabemos que es tuya, pero no de qué proveedor (grupo WeChat) viene, y se retrasa. Registrá tu proveedor arriba o desde el portal apenas tengas la compra.</span>
          </div>
        }

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
          <U.Btn variant="ghost" size="lg" onClick={onBack} icon={I.arrowL(14)}>Volver</U.Btn>
          <U.Btn variant="primary" size="lg" full onClick={onSubmit} icon={I.check(15)}>Confirmar y generar MARKBOX</U.Btn>
        </div>
      </div>);

  }

  // ── Tarjeta roja del MARKBOX · reacciona al registrar la compra ──
  // Estados: 'TU MARKBOX' (solo código de cliente) → al registrar proveedor
  // + compra muta a MARKBOX-1-1 y, si el registro fue en vivo (purchase),
  // dispara la celebración (pop + ring success + badge + shimmer + swap).
  function MarkboxCard({ markbox, data, purchase }) {
    const I = window.Icon;
    const registered = purchase || (data.supplierName ? { supplier: data.supplierName, orderCode: `${markbox}-1-1` } : null);
    const code = registered ? registered.orderCode : markbox;
    const celebrate = !!purchase; // solo el registro en vivo anima
    const tone = 'rgba(255,255,255,0.65)';
    return (
      <div className={celebrate ? 'markbox-card celebrate' : 'markbox-card'} style={{
        position: 'relative', width: '100%', maxWidth: 480, boxSizing: 'border-box',
        padding: '24px 36px', background: 'var(--wine)', color: '#fff',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)'
      }}>
        {celebrate && <span className="markbox-shimmer" aria-hidden="true" />}
        {celebrate &&
        <span className="markbox-badge" style={{
          position: 'absolute', top: -12, right: -12, width: 36, height: 36, borderRadius: '50%',
          background: 'var(--success)', color: '#fff', display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 4px 12px rgba(31,138,91,0.45)', border: '2px solid #fff'
        }}>{I.check(18)}</span>
        }
        <div style={{ position: 'relative', font: '700 10px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
          {registered ? celebrate ? 'Tu MARKBOX · compra registrada' : 'Tu MARKBOX · proveedor · compra' : 'Tu MARKBOX'}
        </div>
        <code key={code} className={celebrate ? 'markbox-code swap' : 'markbox-code'} style={{ position: 'relative', font: '900 36px/1 var(--f-mono)', color: '#fff', letterSpacing: '-0.02em' }}>{code}</code>
        {registered &&
        <div style={{ position: 'relative', marginTop: 12, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ font: '500 11px/1.4 var(--f-sans)', color: tone }}>MARKBOX <b style={{ color: '#fff', fontFamily: 'var(--f-mono)' }}>{markbox}</b></span>
          <span style={{ font: '500 11px/1.4 var(--f-sans)', color: tone }}>Proveedor ID <b style={{ color: '#fff', fontFamily: 'var(--f-mono)' }}>1</b>{registered.supplier ? ` · ${registered.supplier}` : ''}</span>
          <span style={{ font: '500 11px/1.4 var(--f-sans)', color: tone }}>Compra <b style={{ color: '#fff', fontFamily: 'var(--f-mono)' }}>1</b></span>
        </div>
        }
        {celebrate &&
        <div style={{ position: 'relative', marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)', display: 'flex', gap: 8, alignItems: 'flex-start', font: '600 11.5px/1.5 var(--f-sans)', color: '#fff' }}>
          <span style={{ flexShrink: 0, marginTop: 1, color: 'var(--wine-soft)' }}>{I.arrowR(13)}</span>
          <span>Este es el código que le mandás a tu proveedor ahora — va en la etiqueta de cada caja.</span>
        </div>
        }
      </div>);

  }

  function StepSuccess({ data, markbox, emailSent }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [showGuide, setShowGuide] = useState(false);
    // ── Compra registrada en vivo desde esta pantalla (CTA de abajo) ──
    // Cuando el cliente genera el código de compra inline, la tarjeta
    // roja de arriba reacciona: muta al código con proveedor + compra
    // (MARKBOX-1-1) y dispara la celebración.
    const [purchase, setPurchase] = useState(null);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', textAlign: 'center', paddingTop: 20 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.check(40)}</div>
        <div>
          <div style={{ font: '900 26px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em' }}>Bienvenido a la familia de DoorTuDoor Cargo</div>
          <div style={{ font: '500 13.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: '40ch' }}>
            Tu cuenta está activa, {data.name?.split(' ')[0]}. Este es tu código MARKBOX personal — guardalo, vas a usarlo mucho.
          </div>
        </div>

        <MarkboxCard markbox={markbox} data={data} purchase={purchase} />

        {/* Banner de felicitación · aparece al registrar la compra inline */}
        {purchase &&
        <div className="celebrate-banner" style={{ width: '100%', maxWidth: 480, padding: '14px 16px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', boxSizing: 'border-box' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.check(16)}</span>
          <div>
            <div style={{ font: '800 14px/1.25 var(--f-display)', color: 'var(--success)' }}>¡Felicitaciones! Tu compra quedó registrada</div>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Está completo: mandale el código de arriba a tu proveedor y ya podés entrar a tu portal.</div>
          </div>
        </div>
        }

        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CopyCodeButton data={data} markbox={markbox} />
            <U.Btn variant="primary" size="lg" iconRight={I.arrowR(14)} style={{ background: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => {try {sessionStorage.setItem('dtd-from-registro', '1');} catch (e) {}window.location.href = 'Portal del Cliente.html';}}>Ir al portal</U.Btn>
          </div>
        </div>

        {/* Acceso al portal · usuario + clave (= cédula/RIF) */}
        <div style={{ width: '100%', maxWidth: 480, padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', textAlign: 'left', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>Usuario</div>
            <code style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--success)' }}>{markbox}</code>
          </div>
          <div>
            <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>Contraseña</div>
            <code style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--success)' }}>{data.cedula || data.rif || '—'}</code>
            <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Es tu {data.tipo === 'persona' ? 'cédula' : 'RIF'} · recomendado cambiar al entrar al portal</div>
          </div>
        </div>

        {/* Faltan pasos para la trazabilidad · solo si no registró proveedor
            (ni en el paso 3 ni inline acá) */}
        {!data.supplierName && !purchase &&
        <div style={{ width: '100%', maxWidth: 480, padding: '14px 16px', background: 'var(--wine-tint)', border: '1px solid var(--wine)', borderRadius: 'var(--r-md)', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--wine)', flexShrink: 0, marginTop: 1 }}>{I.info(16)}</span>
            <div>
              <div style={{ font: '800 13px/1.3 var(--f-display)', color: 'var(--wine)' }}>Tu código está listo, pero faltan pasos para la trazabilidad completa</div>
              <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
                Para que tus cajas lleguen identificadas y no entren como "huérfanas", aprendé cómo usar tu código + sticker y registrá tu proveedor. Mirá la guía acá abajo <span className="guide-arrow-bounce" style={{ display: 'inline-block' }}>↓</span>
              </div>
            </div>
          </div>
        }

        {/* Mini-guía de codificación */}
        <button onClick={() => setShowGuide(!showGuide)} className={showGuide ? '' : 'guide-pulse'} style={{
          width: '100%', maxWidth: 480, padding: '12px 14px',
          background: 'var(--bg-elevated)', color: 'var(--wine)',
          border: '1px solid var(--wine)', borderRadius: 'var(--r-md)',
          font: '700 12.5px/1 var(--f-sans)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          position: 'relative'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {I.info(14)} Cómo usar tu código + sticker · por qué registrar un proveedor (1 min)
          </span>
          <span className={showGuide ? '' : 'guide-arrow-bounce'} style={{ transform: `rotate(${showGuide ? 180 : 0}deg)`, transition: 'transform var(--dur) var(--ease)', display: 'inline-flex' }}>{I.chevD(13)}</span>
        </button>

        {showGuide &&
        <div style={{ width: '100%', maxWidth: 480, textAlign: 'left', animation: 'erp-fade 220ms var(--ease)' }}>
            <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>NOMENCLATURA · CÓMO FUNCIONA</div>

              <div style={{ marginBottom: 14, padding: '14px 14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 6 }}>
                  {/* Código de cliente (MARKBOX) · wine */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <code style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--wine)' }}>{markbox}</code>
                    <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine)' }}>↑</span>
                    <span style={{ font: '700 8.5px/1.2 var(--f-sans)', color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Código de<br />cliente</span>
                  </div>
                  <span style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 1 }}>-</span>
                  {/* Proveedor · navy (mismo color que el número) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <code style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--ink)' }}>1</code>
                    <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink)' }}>↑</span>
                    <span style={{ font: '700 8.5px/1.2 var(--f-sans)', color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Proveedor<br />n.º 1</span>
                  </div>
                  <span style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 1 }}>-</span>
                  {/* Compra · azul (mismo color que el número) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <code style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--info)' }}>2</code>
                    <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--info)' }}>↑</span>
                    <span style={{ font: '700 8.5px/1.2 var(--f-sans)', color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Compra<br />n.º 2</span>
                  </div>
                </div>
              </div>

              <Guide n="1" title="Tu MARKBOX te identifica a vos">
                <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)', padding: '1px 5px', background: 'var(--wine-tint)', borderRadius: 4 }}>{markbox}</code> es tu identificador único como cliente. Es la base de todos tus códigos.
              </Guide>

              <Guide n="2" title="Cada proveedor lleva su propio número">
                Si tenés varios proveedores en China (ej. 5), a cada uno le asignamos un <b>código de proveedor</b> (1, 2, 3…). Así sabés exactamente de cuál proveedor te está llegando la mercancía. Tu primera compra al proveedor 1 sería <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{markbox}-1-1</code>; al proveedor 2 sería <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{markbox}-2-1</code>.
              </Guide>

              <Guide n="3" title="Cada compra suma correlativamente">
                Cada vez que le volvés a comprar al mismo proveedor, el número de compra avanza. Tres compras al proveedor 1 serían <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--wine)' }}>-1-1</code>, <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--wine)' }}>-1-2</code> y <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--wine)' }}>-1-3</code>. Así cada pedido queda separado y trazable. <b>Y lo mejor:</b> desde tu portal vas a llevar el control de todas tus compras en un solo lugar, sin manejar sistemas externos.
              </Guide>

              <Guide n="4" title="Etiquetas · qué pegar en cada caja">
                Cuando registres tu compra, te vamos a asignar las <b>etiquetas</b> de esa compra. Pedile a tu proveedor que pegue <b>esas etiquetas</b> en TODAS las cajas, en el frente visible. Sin la etiqueta correcta, la caja entra como "huérfana" y no la podemos asociar a tu cuenta.
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--wine-tint)', border: '1px solid var(--wine)', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Cómo registrar tu compra · 3 pasos</div>
                  <ol style={{ margin: 0, paddingLeft: 18, font: '500 12px/1.7 var(--f-sans)', color: 'var(--ink)' }}>
                    <li>Entrá al <b>panel de control</b> (tu portal).</li>
                    <li>Andá a <b>"Tus proveedores"</b>.</li>
                    <li>Tocá <b>"Nueva compra"</b> y te asignamos el código + etiquetas.</li>
                  </ol>
                </div>
                <div style={{ marginTop: 8, font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>El número de cajas (1/12, 2/12…) lo genera el sistema automáticamente cuando registres la compra e indiques cuántas cajas son — todavía no hace falta.</div>
              </Guide>

              <Guide n="5" title="Lo que pasa después" last>
                <ul style={{ paddingLeft: 18, margin: '4px 0 0' }}>
                  <li>Tus cajas llegan a nuestro almacén China · te avisamos por email/WhatsApp.</li>
                  <li>Consolidamos con otros pedidos para optimizar costos (LCL).</li>
                  <li>Zarpe + tránsito marítimo · lo podés trackear desde tu portal o la app.</li>
                  <li>Aduana VE, liberación SENIAT, entrega final puerta a puerta.</li>
                </ul>
              </Guide>

              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 'var(--r-sm)', font: '500 11.5px/1.4 var(--f-sans)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(12)}</span>
                <span>¿Dudas? Hablá con nosotros por WhatsApp <b>+58 412 DTD-CARG</b> o respondé el email de bienvenida.</span>
              </div>
            </U.Card>
          </div>
        }

        {/* Email preview */}
        <div style={{ marginTop: 4, padding: '14px 16px', background: emailSent ? 'var(--success-bg)' : 'var(--bg-elevated)', border: emailSent ? '1px solid var(--success)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', maxWidth: 480, font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ color: emailSent ? 'var(--success)' : 'var(--ink-mute)', flexShrink: 0, marginTop: 1 }}>{emailSent ? I.check(15) : I.mail(15)}</span>
          <span>
            {emailSent ?
            <><b style={{ color: 'var(--success)' }}>Email enviado</b> a <b style={{ color: 'var(--ink)' }}>{data.email}</b> con tu código <b style={{ color: 'var(--wine)' }}>{markbox}</b>, la guía de nomenclatura y el link al portal. <span style={{ color: 'var(--ink-mute)' }}>Revisá la bandeja de entrada o spam.</span></> :

            <>Te enviaremos un email a <b style={{ color: 'var(--ink)' }}>{data.email}</b> con tu código <b style={{ color: 'var(--wine)' }}>{markbox}</b>, la guía de nomenclatura y el link al portal.</>
            }
          </span>
        </div>

        {/* CTA · registrar compra acá (no lleva al portal: aún no hay clave) */}
        <SuccessPurchaseCTA data={data} markbox={markbox} onRegistered={(info) => setPurchase(info)} />
      </div>);

  }

  // ── Instructivo para el proveedor (chino simplificado) ─────────
  // Se copia tal cual, reemplazando {{MARKBOX}} por el código EXACTO que
  // muestra la tarjeta roja. Usamos la misma fuente (`markbox`) que rinde
  // la tarjeta, así el texto copiado y la tarjeta SIEMPRE coinciden.
  const PROVIDER_MSG_ZH = `发货前请确认以下事项：
一、发货前，请先确认是否已建立微信群。
二、微信群名称须包含客户 Shipping Mark 代码（例如：{{MARKBOX}}）。
三、若尚未建立微信群，请先联系吴小姐：18606891419 建群，并将微信号"DTDLogistic"加入该群。
四、唛头（Shipping Mark）将在群内提供；此外，我司将为每个箱子提供标签。
五、未经确认，不得自行发货。群内将发送相关指示及其他信息，确认后方可发货。
六、仓库地址（此地址供您提前核算运费；建群后将提供完整地址）：义乌市义乌港二期直通仓2栋2`;

  function CopyCodeButton({ data, markbox }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [copied, setCopied] = useState(false);
    // Código exacto mostrado en la tarjeta roja (mismo origen que el render).
    const cardCode = markbox ? data.supplierName ? `${markbox}-1-1` : markbox : '';
    const disabled = !cardCode;

    function onCopy() {
      if (!cardCode) return; // nunca copiar con el token sin reemplazar
      const text = PROVIDER_MSG_ZH.split('{{MARKBOX}}').join(cardCode);
      // Fallback execCommand si la Clipboard API no está disponible/permitida.
      function legacyCopy() {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (e) {/* no-op */}
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(legacyCopy);
        } else {
          legacyCopy();
        }
      } catch (e) {legacyCopy();}
      setCopied(true);
      setTimeout(() => setCopied(false), 7000);
    }

    return (
      <React.Fragment>
        <U.Btn variant="secondary" size="lg" icon={I.copy(14)} disabled={disabled} onClick={onCopy}>
          {copied ? '¡Copiado!' : 'Copiar para proveedor'}
        </U.Btn>
        {copied &&
        <div style={{
          gridColumn: '1 / -1', marginTop: 4, padding: '10px 12px',
          background: 'var(--success-bg)', color: 'var(--ink)',
          border: '1px solid var(--success)', borderRadius: 'var(--r-sm)',
          font: '600 11.5px/1.5 var(--f-sans)', textAlign: 'left',
          display: 'flex', gap: 8, alignItems: 'flex-start'
        }}>
          <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>{I.check(13)}</span>
          <span>Ya lo copiaste. Pegá esto en el <b>WhatsApp o WeChat de tu proveedor</b> para que siga las instrucciones.</span>
        </div>
        }
      </React.Fragment>);

  }

  // ── CTA en éxito · registrar compra inline + clave = cédula ──
  function SuccessPurchaseCTA({ data, markbox, onRegistered }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [open, setOpen] = useState(false);
    const [supplier, setSupplier] = useState('');
    const [docs, setDocs] = useState({ packing: false, factura: false, fotos: 0 });
    const [done, setDone] = useState(false);
    const orderCode = `${markbox || 'DTD-5502'}-1-1`;
    // Clave por defecto = cédula del cliente (o RIF si es empresa)
    const tempPass = data.cedula || data.rif || '—';

    // Si ya registró el proveedor en el paso anterior → no mostrar el CTA,
    // mostrar el estado "listo" con instrucciones para avanzar.
    if (data.supplierName) {
      return (
        <div style={{ maxWidth: 480, width: '100%', padding: '16px 18px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', boxSizing: 'border-box', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ color: 'var(--success)' }}>{I.check(15)}</span>
            <span style={{ font: '800 13.5px/1.2 var(--f-display)', color: 'var(--success)' }}>Tu compra ya quedó registrada</span>
          </div>
          <div style={{ font: '500 12px/1.6 var(--f-sans)', color: 'var(--ink)' }}>
            Proveedor <b>{data.supplierName}</b> · código <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{orderCode}</code>. Ya generamos tus etiquetas con QR.
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', font: '600 11.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>
            Próximos pasos:
            <ol style={{ margin: '6px 0 0', paddingLeft: 18, font: '500 11.5px/1.7 var(--f-sans)' }}>
              <li>Descargá las etiquetas y enviáselas a tu proveedor.</li>
              <li>Entrá al portal (usuario <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{markbox}</code> · clave: tu {data.tipo === 'persona' ? 'cédula' : 'RIF'}).</li>
              <li>Seguí tu envío en "Mis envíos".</li>
            </ol>
          </div>
        </div>);

    }

    if (done) {
      return (
        <div style={{ maxWidth: 480, width: '100%', padding: '16px 18px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', boxSizing: 'border-box', textAlign: 'left' }}>
          <div style={{ font: '800 13.5px/1.2 var(--f-display)', color: 'var(--success)', marginBottom: 8 }}>✓ Compra registrada</div>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)', marginBottom: 10 }}>
            Tu código de compra es <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{orderCode}</code>. Generamos las etiquetas con QR para que tu proveedor las pegue en cada caja.
          </div>
          <div style={{ padding: '10px 12px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
            <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>Acceso al portal</div>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>Usuario: <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{markbox}</code> · Clave: <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{tempPass}</code></div>
            <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>Tu clave por defecto es tu {data.tipo === 'persona' ? 'cédula' : 'RIF'}. Cambiala la primera vez que entres.</div>
          </div>
        </div>);

    }

    if (!open) {
      return (
        <button onClick={() => setOpen(true)} style={{
          marginTop: 4, maxWidth: 480, width: '100%', padding: '14px 18px', cursor: 'pointer',
          background: 'var(--wine-tint)', border: '1px solid var(--wine)', borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 12, boxSizing: 'border-box', textAlign: 'left'
        }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', font: '800 13.5px/1.2 var(--f-display)', color: 'var(--wine)' }}>¿Ya tenés una compra? Registrala acá</span>
            <span style={{ display: 'block', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Si la omitiste antes, agregá el proveedor ahora y te asignamos el código + etiquetas al instante.</span>
          </span>
          <span style={{ color: 'var(--wine)', font: '700 16px/1' }}>+</span>
        </button>);

    }

    return (
      <U.Card padded style={{ maxWidth: 480, width: '100%', border: '1px solid var(--wine)', textAlign: 'left' }}>
        <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--wine)', marginBottom: 12 }}>🛒 Registrá tu compra</div>
        <U.Input label="Nombre del proveedor en China" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ej. Yiwu Standard Co" />
        <div style={{ marginTop: 12, font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Adjuntá los documentos</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[{ k: 'packing', label: 'Packing list' }, { k: 'factura', label: 'Factura' }].map((d) =>
          <button key={d.k} onClick={() => setDocs({ ...docs, [d.k]: !docs[d.k] })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', textAlign: 'left', border: `1px solid ${docs[d.k] ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: docs[d.k] ? 'var(--success-bg)' : 'var(--bg-surface)', cursor: 'pointer' }}>
              <span style={{ color: docs[d.k] ? 'var(--success)' : 'var(--ink-mute)' }}>{docs[d.k] ? I.check(14) : I.upload(14)}</span>
              <span style={{ font: '600 12px/1.2 var(--f-sans)', color: docs[d.k] ? 'var(--success)' : 'var(--ink)' }}>{d.label}{docs[d.k] ? ' ✓' : ''}</span>
            </button>
          )}
          <button onClick={() => setDocs({ ...docs, fotos: docs.fotos + 1 })} style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', textAlign: 'left', border: `1px solid ${docs.fotos ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: docs.fotos ? 'var(--success-bg)' : 'var(--bg-surface)', cursor: 'pointer' }}>
            <span style={{ color: docs.fotos ? 'var(--success)' : 'var(--ink-mute)' }}>{I.upload(14)}</span>
            <span style={{ font: '600 12px/1.2 var(--f-sans)', color: docs.fotos ? 'var(--success)' : 'var(--ink)' }}>Fotos de mercancía {docs.fotos ? `· ${docs.fotos}` : ''}</span>
          </button>
        </div>
        <U.Btn variant="primary" full size="lg" icon={I.check(15)} style={{ marginTop: 14 }} onClick={() => {setDone(true);if (onRegistered) onRegistered({ supplier: supplier.trim(), orderCode });}} disabled={!supplier.trim()}>Generar mi código de compra</U.Btn>
      </U.Card>);

  }

  // ── CTA opcional · registrar compra/proveedor + adjuntos ────
  function PurchaseCTA({ data, update }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [open, setOpen] = useState(!!data.supplierName);
    const docs = data.purchaseDocs || { packing: false, factura: false, fotos: 0 };
    const setDocs = (patch) => update({ purchaseDocs: { ...docs, ...patch } });

    if (!open) {
      return (
        <button onClick={() => setOpen(true)} className="guide-pulse" style={{
          width: '100%', padding: '16px 18px', textAlign: 'left', cursor: 'pointer',
          background: 'var(--wine-tint)', border: '1px solid var(--wine)', borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 14
        }}>
          <span style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 20 }}>🛒</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', font: '800 14px/1.2 var(--f-display)', color: 'var(--wine)' }}>¿Ya tenés una compra en China lista?</span>
            <span style={{ display: 'block', font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Registrá tu proveedor ahora y dejá tu compra con <b>trazabilidad perfecta</b> desde el día 1. Opcional — podés hacerlo después.</span>
          </span>
          <span style={{ color: 'var(--wine)', font: '700 18px/1' }}>+</span>
        </button>);

    }

    return (
      <U.Card padded style={{ border: '1px solid var(--wine)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--wine)' }}>🛒 Tu primera compra (opcional)</div>
          <button onClick={() => {setOpen(false);update({ supplierName: '' });}} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', font: '600 12px/1 var(--f-sans)' }}>Quitar</button>
        </div>
        <U.Input label="Nombre del proveedor en China" value={data.supplierName || ''} onChange={(e) => update({ supplierName: e.target.value })} placeholder="Ej. Yiwu Standard Co" />
        <div style={{ marginTop: 12, font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Adjuntá los documentos de la compra</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
          { k: 'packing', label: 'Packing list', icon: 'doc', on: docs.packing },
          { k: 'factura', label: 'Factura proveedor', icon: 'invoice', on: docs.factura }].
          map((d) =>
          <button key={d.k} onClick={() => setDocs({ [d.k]: !d.on })} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left',
            border: `1px solid ${d.on ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--r-md)',
            background: d.on ? 'var(--success-bg)' : 'var(--bg-surface)', cursor: 'pointer'
          }}>
              <span style={{ color: d.on ? 'var(--success)' : 'var(--ink-mute)' }}>{d.on ? I.check(15) : I.upload(15)}</span>
              <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: d.on ? 'var(--success)' : 'var(--ink)' }}>{d.label}{d.on ? ' ✓' : ''}</span>
            </button>
          )}
          <button onClick={() => setDocs({ fotos: (docs.fotos || 0) + 1 })} style={{
            gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left',
            border: `1px solid ${docs.fotos ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--r-md)',
            background: docs.fotos ? 'var(--success-bg)' : 'var(--bg-surface)', cursor: 'pointer'
          }}>
            <span style={{ color: docs.fotos ? 'var(--success)' : 'var(--ink-mute)' }}>{I.upload(15)}</span>
            <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: docs.fotos ? 'var(--success)' : 'var(--ink)' }}>Fotos de la mercancía {docs.fotos ? `· ${docs.fotos} cargada${docs.fotos > 1 ? 's' : ''}` : ''}</span>
          </button>
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--r-md)', font: '600 11.5px/1.5 var(--f-sans)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{I.check(13)}</span>
          <span>Al confirmar, generamos tu código de compra <b>(MARKBOX-{data.supplierName ? '1-1' : 'N-1'})</b> y las etiquetas con QR para que el proveedor las pegue en cada caja. Nosotros recibimos todo asociado a tu cuenta.</span>
        </div>
      </U.Card>);

  }

  function Guide({ n, title, children, last }) {
    return (
      <div style={{ paddingBottom: last ? 0 : 14, marginBottom: last ? 0 : 14, borderBottom: last ? 'none' : '1px dashed var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'var(--wine)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            font: '900 12px/1 var(--f-display)'
          }}>{n}</span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '800 13.5px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 6 }}>{title}</div>
            <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>{children}</div>
          </div>
        </div>
      </div>);

  }

  function SectionLabel({ children, required, error }) {
    return (
      <div style={{ font: '700 10.5px/1 var(--f-sans)', color: error ? 'var(--danger)' : 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{children}{required && <span style={{ color: 'inherit' }}> *</span>}</div>);

  }

  function TypeCard({ active, onClick, label, desc, icon }) {
    return (
      <button onClick={onClick} style={{
        padding: 14, textAlign: 'left',
        background: active ? 'var(--wine-tint)' : 'var(--bg-surface)',
        border: `1px solid ${active ? 'var(--wine)' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)',
        boxShadow: active ? '0 0 0 3px var(--wine-tint)' : 'var(--shadow-xs)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: active ? 'var(--wine)' : 'var(--ink-soft)' }}>{icon}</span>
          <div style={{ font: '800 13.5px/1.1 var(--f-display)', color: active ? 'var(--wine)' : 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</div>
        </div>
        <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{desc}</div>
      </button>);

  }

  function PhotoUpload({ value, onChange, label, error }) {
    const I = window.Icon;
    return value ?
    <div style={{ padding: 12, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--success)' }}>{I.check(16)}</span>
        <div style={{ flex: 1, font: '700 12.5px/1.3 var(--f-sans)', color: 'var(--success)' }}>Foto cargada</div>
        <button onClick={() => onChange(null)} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', padding: '4px 8px' }}>Quitar</button>
      </div> :

    <button onClick={() => onChange('mock-photo-' + Date.now())} style={{
      padding: '20px 14px',
      background: error ? 'var(--danger-bg)' : 'var(--bg-elevated)',
      border: `1px dashed ${error ? 'var(--danger)' : 'var(--border-strong)'}`,
      borderRadius: 'var(--r-md)', color: error ? 'var(--danger)' : 'var(--ink-soft)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      font: '600 12px/1.4 var(--f-sans)', textAlign: 'center'
    }}>
        {I.upload(20)}
        <span>{label}</span>
      </button>;

  }

  function Field({ label, value, mono, tone }) {
    const color = tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--warning)' : 'var(--ink)';
    return (
      <div>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ font: `${mono ? '700' : '600'} 13px/1.3 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`, color }}>{value || '—'}</div>
      </div>);

  }

  window.RegistroCliente = RegistroCliente;
})();