/* global */
/* ── DTD ERP · Traducción runtime ES → 简体中文 (Camino B) ──────── */
/* Recorre el DOM y reemplaza términos del diccionario curado.     */
/* Cubre la chrome visible (módulos, botones, estados, labels).    */
/* Para i18n string-por-string completo, ver handoff (Camino A).   */

(function () {
  // Diccionario curado · términos core de la plataforma · 简体中文
  // Orden importa: frases largas primero para no romper sub-cadenas.
  const DICT = [
    // Módulos / navegación
    ['Dashboard', '仪表板'], ['Embarques', '货运'], ['Tracking', '追踪'],
    ['Clientes', '客户'], ['Cotizador', '报价'], ['Cotizaciones', '报价单'],
    ['Almacén CN', '中国仓库'], ['Almacén VE', '委内瑞拉仓库'], ['Almacén', '仓库'],
    ['Despacho', '发货'], ['Proveedores CN', '中国供应商'], ['Proveedores', '供应商'],
    ['Facturación', '开票'], ['Contabilidad', '会计'], ['Tarifas', '费率'],
    ['Calendario', '日历'], ['Reportes', '报告'], ['Usuarios', '用户'],
    ['Administración', '管理'], ['Operarios PWA', '操作员应用'], ['Operarios', '操作员'],
    ['Aduana', '海关'], ['Transporte', '运输'], ['Conciliación bancaria', '银行对账'],
    ['Costing & Margen', '成本与利润'], ['Leads', '潜在客户'], ['Mailing', '邮件'],
    ['Cola de QR', 'QR队列'], ['Etiquetas CN', '中国标签'], ['Reglas de despacho', '发货规则'],
    ['Reglas', '规则'], ['Conciliación', '对账'], ['Vault', '保险库'],
    ['Administrar rutas', '管理路线'], ['Administrar', '管理'],
    // Acciones / botones
    ['Nuevo embarque', '新货运'], ['Nuevo', '新建'], ['Nueva', '新建'],
    ['Crear', '创建'], ['Editar', '编辑'], ['Eliminar', '删除'], ['Borrar', '删除'],
    ['Guardar cambios', '保存更改'], ['Guardar', '保存'], ['Cancelar', '取消'],
    ['Confirmar', '确认'], ['Siguiente', '下一步'], ['Atrás', '返回'],
    ['Buscar', '搜索'], ['Filtrar', '筛选'], ['Más filtros', '更多筛选'],
    ['Limpiar filtros', '清除筛选'], ['Limpiar', '清除'], ['Exportar CSV', '导出CSV'],
    ['Exportar', '导出'], ['Imprimir', '打印'], ['Descargar', '下载'],
    ['Consolidar', '合并'], ['Asignar reparto', '分配派送'], ['Asignar', '分配'],
    ['Ver factura', '查看发票'], ['Ver en tracking', '查看追踪'], ['Ver', '查看'],
    ['Marcar todas', '全选'], ['Marcar leídas', '标记已读'], ['Cerrar', '关闭'],
    ['Nueva campaña', '新活动'], ['Hacer parcial', '部分拆分'], ['partir envío', '拆分货物'],
    // Estados de embarque
    ['pendiente consolidación', '待合并'], ['consolidado', '已合并'],
    ['cotizado', '已报价'], ['confirmado', '已确认'], ['recibido CN', '中国已收'],
    ['zarpado', '已起航'], ['tránsito', '运输中'], ['en tránsito', '运输中'],
    ['aduana VE', '委内瑞拉海关'], ['liberado', '已放行'], ['entregado', '已交付'],
    ['en aduana', '海关中'], ['listo para retiro', '可提货'], ['en reparto', '派送中'],
    ['pendiente', '待处理'], ['incidencia', '异常'], ['activo', '活跃'],
    ['onboarding', '入驻中'], ['en línea', '在线'], ['en ruta', '在途'],
    // Labels de tabla / formularios
    ['Recepciones', '收货'], ['Recepción', '收货'], ['Cliente', '客户'],
    ['Proveedor', '供应商'], ['Cajas', '箱数'], ['Peso total', '总重量'],
    ['Peso', '重量'], ['Estado', '状态'], ['Progreso', '进度'], ['Valor', '价值'],
    ['Ruta', '路线'], ['Tipo', '类型'], ['Destino', '目的地'], ['Origen', '产地'],
    ['Bodega', '仓库'], ['Recibido', '已收'], ['Entrega', '交付'],
    ['Descripción mercancía', '货物描述'], ['Descripción de la mercancía', '货物描述'],
    ['Descripción', '描述'], ['Dirección final', '最终地址'], ['Puerto', '港口'],
    ['Total CBM', '总CBM'], ['Total', '总计'], ['Totales', '总计'],
    ['Documentos', '文件'], ['Fotos de la caja', '箱子照片'], ['Fotos', '照片'],
    ['Proveedor chino', '中国供应商'], ['Dimensiones y supplier', '尺寸和供应商'],
    ['Cajas mín.', '最少箱数'], ['Todos los puertos', '所有港口'],
    ['Todos los tipos', '所有类型'], ['Todos los estados', '所有状态'],
    ['Todos los hubs', '所有枢纽'], ['CBM mínimo', '最小CBM'],
    // Plataforma / usuarios
    ['Super Admin', '超级管理员'], ['Administrador de Tenant', '租户管理员'],
    ['Gestor de Bugs', '错误管理员'], ['Editor de Configuración', '配置编辑'],
    ['Plataforma', '平台'], ['Tenant', '租户'], ['Tenants gestionados', '管理的租户'],
    ['Usuarios de plataforma', '平台用户'], ['Usuarios del Tenant', '租户用户'],
    ['Sistema de marca', '品牌系统'], ['Íconos de perfil', '头像图标'],
    ['Aplicaciones de marca', '品牌应用'], ['Publicidad activa', '活跃广告'],
    ['Roles', '角色'], ['Permisos', '权限'], ['Permisos por rol', '角色权限'],
    // Misc
    ['Hoy', '今天'], ['Ayer', '昨天'], ['hace', '约'], ['Notificaciones', '通知'],
    ['Sin resultados', '无结果'], ['Cargando', '加载中'], ['Mostrar', '显示'],
  ];

  // Normaliza: separa por longitud descendente para reemplazar frases largas primero
  const SORTED = DICT.slice().sort((a, b) => b[0].length - a[0].length);

  let active = (localStorage.getItem('dtd-lang') === 'cn');
  let observer = null;

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'KBD', 'INPUT', 'TEXTAREA']);

  function translateNode(node) {
    let txt = node.nodeValue;
    if (!txt || !txt.trim()) return;
    let out = txt;
    for (const [es, cn] of SORTED) {
      if (out.includes(es)) {
        // Reemplazo simple de substring (case-sensitive para respetar mayúsculas de labels)
        out = out.split(es).join(cn);
      }
    }
    if (out !== txt) {
      if (!node.__dtdOrig) node.__dtdOrig = txt;
      node.nodeValue = out;
    }
  }

  function restoreNode(node) {
    if (node.__dtdOrig != null) {
      node.nodeValue = node.__dtdOrig;
      node.__dtdOrig = null;
    }
  }

  function walk(root, fn) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentNode;
        if (!p || SKIP_TAGS.has(p.tagName) || p.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = tw.nextNode())) fn(n);
  }

  function applyAll() { walk(document.body, translateNode); }
  function restoreAll() { walk(document.body, restoreNode); }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((muts) => {
      if (!active) return;
      for (const m of muts) {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 3) translateNode(node);
          else if (node.nodeType === 1) walk(node, translateNode);
        });
        if (m.type === 'characterData' && m.target.nodeType === 3) translateNode(m.target);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function setActive(on) {
    active = on;
    localStorage.setItem('dtd-lang', on ? 'cn' : 'es');
    if (on) { applyAll(); startObserver(); }
    else { restoreAll(); }
    window.dispatchEvent(new CustomEvent('dtd-lang-change', { detail: { lang: on ? 'cn' : 'es' } }));
  }

  window.DTDTranslate = {
    isActive: () => active,
    toggle: () => setActive(!active),
    set: setActive,
  };

  // Auto-aplicar si quedó activo de antes
  if (active) {
    const boot = () => { applyAll(); startObserver(); };
    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 300);
    else document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 300));
  } else {
    startObserver(); // observer listo, inactivo hasta toggle
  }
})();
