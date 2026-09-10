/** Operational guidance only. The request status is persisted separately. */
export const RECEPTION_INSTRUCTIONS: Record<string, { zh: string; es: string }> = {
  verificacion: { zh: "开箱核对装箱单数量并拍照。", es: "Abrir, contar contra el packing list y tomar fotos." },
  inspeccion_recepcion: { zh: "按已确认的验货要求检查质量并记录结果。", es: "Revisar calidad según el alcance acordado y registrar resultados." },
  reempaque_unificar: { zh: "按要求合并包装，保留货物标识。", es: "Unificar bultos según la solicitud, conservando la identificación." },
  compactar: { zh: "按要求压缩包装体积，记录新尺寸。", es: "Reducir volumen según la solicitud y registrar las medidas finales." },
  etiquetado_pieza: { zh: "按要求逐件贴标签。", es: "Etiquetar por pieza según la solicitud." },
  cotizar_medir: { zh: "测量重量和体积，供报价使用。", es: "Medir peso y volumen para la cotización." },
  hold_consolidar: { zh: "暂存货物，等待合柜指示。", es: "Retener la mercancía hasta recibir instrucciones de consolidación." },
};
