/* global React */
/* ── DTD ERP · Shared components ────────────────────────────── */
/* Button, Input, Select, Badge, Card, Table, EmptyState,       */
/* PageHeader, Drawer, Modal, KPI, Tabs, Avatar, Progress.      */

const { useState, useEffect, useRef, useCallback } = React;

// ── Button ────────────────────────────────────────────────────
function Btn({ variant = 'secondary', size = 'md', icon, iconRight, children, onClick, type = 'button', disabled = false, style = {}, full = false, ...rest }) {
  const sizes = {
    sm: { h: 30, px: 10, fs: 12.5, gap: 6 },
    md: { h: 36, px: 14, fs: 13,   gap: 8 },
    lg: { h: 42, px: 18, fs: 14,   gap: 8 },
  }[size];
  const variants = {
    primary:   { bg: 'var(--wine)',     fg: '#fff',           bd: 'var(--wine)' },
    secondary: { bg: 'var(--bg-surface)', fg: 'var(--ink)',   bd: 'var(--border-strong)' },
    ghost:     { bg: 'transparent',     fg: 'var(--ink)',     bd: 'transparent' },
    danger:    { bg: 'var(--danger)',   fg: '#fff',           bd: 'var(--danger)' },
    dark:      { bg: 'var(--ink)',      fg: 'var(--ink-inv)', bd: 'var(--ink)' },
    soft:      { bg: 'var(--wine-tint)',fg: 'var(--wine)',    bd: 'transparent' },
  }[variant] || {};
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: sizes.h, padding: `0 ${sizes.px}px`,
        background: variants.bg, color: variants.fg,
        border: `1px solid ${variants.bd}`,
        borderRadius: 'var(--r-md)',
        font: `600 ${sizes.fs}px/1 var(--f-sans)`,
        letterSpacing: '-0.005em',
        display: 'inline-flex', alignItems: 'center', gap: sizes.gap,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all var(--dur-fast) var(--ease)',
        width: full ? '100%' : undefined,
        justifyContent: full ? 'center' : undefined,
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = 'brightness(0.95)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────
function Input({ label, value, onChange, placeholder, type = 'text', prefix, suffix, hint, error, mono, style = {}, inputStyle = {}, ...rest }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 38, padding: '0 12px',
        background: 'var(--bg-surface)',
        border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)',
        transition: 'border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--wine-tint)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        {prefix && <span style={{ color: 'var(--ink-mute)', font: '500 13px/1 var(--f-sans)' }}>{prefix}</span>}
        <input
          type={type}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            flex: 1, height: '100%', border: 0, outline: 'none', background: 'transparent',
            font: `${mono ? '600' : '500'} 13.5px/1 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`,
            color: 'var(--ink)',
            ...inputStyle,
          }}
          {...rest}
        />
        {suffix && <span style={{ color: 'var(--ink-mute)', font: '500 13px/1 var(--f-sans)' }}>{suffix}</span>}
      </div>
      {hint && !error && <span style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>{hint}</span>}
      {error && <span style={{ font: '600 11px/1.4 var(--f-sans)', color: 'var(--danger)' }}>{error}</span>}
    </label>
  );
}

// ── Select ────────────────────────────────────────────────────
function Select({ label, value, onChange, options = [], style = {} }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>}
      <select
        value={value || ''}
        onChange={onChange}
        style={{
          height: 38, padding: '0 32px 0 12px',
          background: `var(--bg-surface) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236B6B6B' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>") no-repeat right 12px center`,
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          font: '500 13.5px/1 var(--f-sans)', color: 'var(--ink)',
          appearance: 'none', outline: 'none', cursor: 'pointer',
        }}
      >
        {options.map(o => {
          const val = typeof o === 'string' ? o : o.value;
          const lbl = typeof o === 'string' ? o : o.label;
          return <option key={val} value={val}>{lbl}</option>;
        })}
      </select>
    </label>
  );
}

// ── Badge ─────────────────────────────────────────────────────
function Badge({ tone = 'neutral', children, size = 'md', dot = false, style = {} }) {
  const tones = {
    success: { bg: 'var(--success-bg)', fg: 'var(--success)' },
    warning: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
    danger:  { bg: 'var(--danger-bg)',  fg: 'var(--danger)' },
    info:    { bg: 'var(--info-bg)',    fg: 'var(--info)' },
    wine:    { bg: 'var(--wine-tint)',  fg: 'var(--wine)' },
    neutral: { bg: 'var(--neutral-bg)', fg: 'var(--ink-soft)' },
  }[tone];
  const sizes = {
    sm: { h: 18, px: 6, fs: 10.5 },
    md: { h: 22, px: 8, fs: 11.5 },
  }[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: sizes.h, padding: `0 ${sizes.px}px`,
      background: tones.bg, color: tones.fg,
      borderRadius: 'var(--r-sm)',
      font: `700 ${sizes.fs}px/1 var(--f-sans)`,
      letterSpacing: '0.02em', whiteSpace: 'nowrap',
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: tones.fg }} />}
      {children}
    </span>
  );
}

function StatusBadge({ status, size }) {
  const tone = window.ERPData.STATUS_TONE[status] || 'neutral';
  return <Badge tone={tone} dot size={size}>{status}</Badge>;
}

// ── Card / Surface ────────────────────────────────────────────
function Card({ children, padded = true, style = {}, hoverable = false, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: padded ? 'var(--s-5)' : 0,
        boxShadow: 'var(--shadow-xs)',
        transition: 'box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease), transform var(--dur) var(--ease)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable || onClick) {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          e.currentTarget.style.borderColor = 'var(--border-strong)';
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable || onClick) {
          e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }
      }}
    >
      {children}
    </div>
  );
}

// ── Page Header ───────────────────────────────────────────────
function PageHeader({ eyebrow, title, subtitle, actions, breadcrumbs, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 'var(--s-6)', ...style }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {breadcrumbs && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: 'var(--ink-mute)' }}>/</span>}
                {b.onClick ? <a onClick={b.onClick} style={{ cursor: 'pointer' }}>{b.label}</a> : <span>{b.label}</span>}
              </React.Fragment>
            ))}
          </div>
        )}
        {eyebrow && <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>{eyebrow}</div>}
        <h1 style={{ font: '900 30px/1.05 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ font: '400 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '8px 0 0', maxWidth: '60ch' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
function KPI({ label, value, delta, tone = 'wine', icon, sub, style = {} }) {
  const tones = {
    wine:    'var(--wine)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger:  'var(--danger)',
    info:    'var(--info)',
    neutral: 'var(--ink-soft)',
  };
  return (
    <Card style={{ padding: 'var(--s-5)', ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
        {icon && <span style={{ color: tones[tone], opacity: 0.7 }}>{icon}</span>}
      </div>
      <div style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>{value}</div>
      {delta && (
        <div style={{ marginTop: 10, font: '700 12px/1 var(--f-sans)', color: tones[tone], letterSpacing: '0.02em' }}>
          {delta}
        </div>
      )}
      {sub && <div style={{ marginTop: 8, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>{sub}</div>}
    </Card>
  );
}

// ── Table ─────────────────────────────────────────────────────
function Table({ columns, rows, onRowClick, empty, dense = false, selectable = false, selected = [], onSelectChange }) {
  if (!rows || rows.length === 0) return empty || null;
  const cellPad = dense ? '10px 14px' : '14px 18px';
  const headPad = dense ? '10px 14px' : '12px 18px';
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {selectable && (
                <th style={{ padding: headPad, width: 36 }}>
                  <input type="checkbox"
                    checked={selected.length === rows.length && rows.length > 0}
                    onChange={(e) => onSelectChange?.(e.target.checked ? rows.map(r => r.id || r.markbox || r._key) : [])}
                  />
                </th>
              )}
              {columns.map((c, i) => (
                <th key={i} style={{
                  padding: headPad, textAlign: c.align || 'left',
                  font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border)',
                  width: c.width,
                }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const rowId = row.id || row.markbox || row._key || ri;
              const isSel = selected.includes(rowId);
              return (
                <tr key={rowId}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    background: isSel ? 'var(--wine-tint)' : 'transparent',
                    transition: 'background var(--dur-fast) var(--ease)',
                  }}
                  onMouseEnter={(e) => { if (onRowClick && !isSel) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                >
                  {selectable && (
                    <td style={{ padding: cellPad, borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 0 }}>
                      <input type="checkbox" checked={isSel}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const next = e.target.checked ? [...selected, rowId] : selected.filter(x => x !== rowId);
                          onSelectChange?.(next);
                        }}
                      />
                    </td>
                  )}
                  {columns.map((c, ci) => (
                    <td key={ci} style={{
                      padding: cellPad, textAlign: c.align || 'left',
                      font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink)',
                      borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 0,
                      whiteSpace: c.nowrap !== false ? 'nowrap' : 'normal',
                    }}>{c.render ? c.render(row) : row[c.key]}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
function EmptyState({ icon, title, body, action, style = {} }) {
  return (
    <div style={{
      padding: 'var(--s-12) var(--s-6)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14,
      background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)',
      ...style,
    }}>
      {icon && (
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--r-pill)',
          background: 'var(--wine-tint)', color: 'var(--wine)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
      )}
      <div>
        <div style={{ font: '800 16px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</div>
        {body && <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '40ch' }}>{body}</div>}
      </div>
      {action}
    </div>
  );
}

// ── Loading ──────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 14, style = {} }) {
  return (
    <div style={{
      width: w, height: h,
      background: 'linear-gradient(90deg, var(--bg-elevated) 0%, var(--border) 50%, var(--bg-elevated) 100%)',
      backgroundSize: '200% 100%',
      borderRadius: 'var(--r-sm)',
      animation: 'erp-shimmer 1.4s linear infinite',
      ...style,
    }} />
  );
}

function LoadingRows({ rows = 5, cols = 4 }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--s-5)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, padding: '10px 0', borderBottom: i < rows-1 ? '1px solid var(--border)' : 0 }}>
          {Array.from({ length: cols }).map((__, j) => <Skeleton key={j} h={14} w={`${60 + Math.random() * 30}%`} />)}
        </div>
      ))}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ initials, color = 'wine', size = 32, style = {} }) {
  const colors = {
    wine:    { bg: 'var(--wine-tint)',  fg: 'var(--wine)' },
    info:    { bg: 'var(--info-bg)',    fg: 'var(--info)' },
    success: { bg: 'var(--success-bg)', fg: 'var(--success)' },
    warning: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
    neutral: { bg: 'var(--neutral-bg)', fg: 'var(--ink-soft)' },
  }[color];
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--r-pill)',
      background: colors.bg, color: colors.fg,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      font: `800 ${Math.round(size * 0.4)}px/1 var(--f-display)`,
      letterSpacing: '-0.01em', flexShrink: 0,
      ...style,
    }}>{initials}</div>
  );
}

// ── Progress bar ──────────────────────────────────────────────
function Progress({ value, tone = 'wine', height = 6, style = {} }) {
  const tones = {
    wine: 'var(--wine)', success: 'var(--success)',
    warning: 'var(--warning)', danger: 'var(--danger)', info: 'var(--info)',
  };
  return (
    <div style={{ height, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', ...style }}>
      <div style={{
        height: '100%', width: `${Math.max(0, Math.min(100, value))}%`,
        background: tones[tone],
        borderRadius: 999,
        transition: 'width var(--dur-slow) var(--ease)',
      }} />
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────
function Tabs({ value, onChange, items, style = {} }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', ...style }}>
      {items.map(item => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            style={{
              padding: '10px 14px', position: 'relative',
              font: `${active ? '700' : '500'} 13px/1 var(--f-sans)`,
              color: active ? 'var(--ink)' : 'var(--ink-soft)',
              borderBottom: `2px solid ${active ? 'var(--wine)' : 'transparent'}`,
              marginBottom: -1,
              transition: 'color var(--dur-fast) var(--ease)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            {item.label}
            {item.count != null && (
              <span style={{
                padding: '1px 6px', borderRadius: 'var(--r-sm)',
                background: active ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                color: active ? 'var(--wine)' : 'var(--ink-mute)',
                font: '700 10.5px/1.4 var(--f-sans)',
              }}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Drawer (right-side panel for detail/create) ──────────────
function Drawer({ open, onClose, title, subtitle, width = 640, children, actions }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.32)',
        backdropFilter: 'blur(2px)', zIndex: 90,
        animation: 'erp-fade 180ms ease',
      }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: width,
        background: 'var(--bg-base)',
        borderLeft: '1px solid var(--border)',
        boxShadow: 'var(--shadow-pop)',
        zIndex: 100, display: 'flex', flexDirection: 'column',
        animation: 'erp-slide-in 220ms var(--ease)',
      }}>
        <header style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          background: 'var(--bg-surface)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            {subtitle && <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' }}>
            {window.Icon.close(16)}
          </button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>
        {actions && (
          <footer style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--bg-surface)' }}>
            {actions}
          </footer>
        )}
      </aside>
    </>
  );
}

// ── Modal ─────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, actions, width = 480 }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.5)',
        backdropFilter: 'blur(3px)', zIndex: 110,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          width: '100%', maxWidth: width,
          background: 'var(--bg-surface)', borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-pop)',
          border: '1px solid var(--border)',
          animation: 'erp-pop 200ms var(--ease)',
        }}>
          {title && (
            <header style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ font: '900 18px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>{title}</div>
              <button onClick={onClose} style={{ width: 28, height: 28, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {window.Icon.close(14)}
              </button>
            </header>
          )}
          <div style={{ padding: 24 }}>{children}</div>
          {actions && (
            <footer style={{ padding: '0 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>{actions}</footer>
          )}
        </div>
      </div>
    </>
  );
}

// ── Toolbar (search + filters above tables) ──────────────────
function Toolbar({ search, onSearchChange, searchPlaceholder = 'Buscar…', filters, actions, style = {} }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      marginBottom: 'var(--s-4)', ...style,
    }}>
      {search != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 36, padding: '0 12px', minWidth: 240, flex: '0 1 320px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        }}>
          <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.search(15)}</span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ flex: 1, height: '100%', border: 0, outline: 'none', background: 'transparent', font: '500 13px/1 var(--f-sans)', color: 'var(--ink)' }}
          />
        </div>
      )}
      {filters}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>
    </div>
  );
}

// ── Detail field row ──────────────────────────────────────────
function Field({ label, value, mono = false, copy = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{
        font: mono ? '700 13px/1.3 var(--f-mono)' : '600 14px/1.3 var(--f-sans)',
        color: 'var(--ink)',
      }}>{value || '—'}</span>
    </div>
  );
}

window.ERPUI = {
  Btn, Input, Select, Badge, StatusBadge, Card, PageHeader, KPI, Table,
  EmptyState, Skeleton, LoadingRows, Avatar, Progress, Tabs, Drawer, Modal,
  Toolbar, Field,
};
