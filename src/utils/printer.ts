import { Order, StoreInfo, useStore } from '../store/useStore';

/**
 * Utilitário de impressão de cupom térmico (58mm e 80mm).
 * Gera estritamente 1 via única limpa e centralizada com avanço e picote de corte.
 */

export interface ActivePrinterInfo {
  name: string;
  model: string;
  isConfigured: boolean;
  isNetwork?: boolean;
  ip?: string;
  port?: number;
}

export const getNetworkPrinterConfig = (storeInfo: StoreInfo): { ip: string; port: number; enabled: boolean } => {
  let localIp = '';
  let localPort = '';
  try {
    if (typeof window !== 'undefined') {
      localIp = localStorage.getItem('balbec_network_printer_ip') || '';
      localPort = localStorage.getItem('balbec_network_printer_port') || '';
    }
  } catch (e) {}

  const ip = (localIp || storeInfo?.networkPrinterIp || '192.168.1.200').trim();
  const port = Number(localPort) || Number(storeInfo?.networkPrinterPort) || 9100;
  const enabled = storeInfo?.printerConnectionType === 'network' || !storeInfo?.printerConnectionType;

  return { ip, port, enabled };
};

export const setLocalNetworkPrinter = (ip: string, port: number = 9100) => {
  try {
    if (typeof window !== 'undefined') {
      if (ip && ip.trim()) {
        localStorage.setItem('balbec_network_printer_ip', ip.trim());
      }
      if (port) {
        localStorage.setItem('balbec_network_printer_port', String(port));
      }
    }
  } catch (e) {}
};

export const setNetworkPrinterConfig = setLocalNetworkPrinter;

export const testNetworkPrinterIp = async (ip: string, port: number = 9100): Promise<{ success: boolean; message: string; code?: string }> => {
  try {
    const res = await fetch('/api/printer/test-ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: `Não foi possível conectar na impressora: ${err?.message || 'Servidor inalcançável'}`
    };
  }
};

export const printViaNetworkIp = async (order: Order, storeInfo: StoreInfo): Promise<{ success: boolean; message?: string }> => {
  const { ip, port } = getNetworkPrinterConfig(storeInfo);
  if (!ip) return { success: false, message: 'IP da impressora não definido.' };

  const b64 = getEscPosReceiptBase64(order, storeInfo);

  // 1. Tenta envio direto pelo backend (Socket TCP porta 9100)
  try {
    const res = await fetch('/api/printer/network-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, escPosBase64: b64 })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true, message: data.message };
      }
    }
  } catch (err) {
    console.warn('[Network Print] Envio TCP via backend falhou:', err);
  }

  // 2. Se for Android com RawBT, dispara via protocolo net://
  if (isAndroidDevice() || isTabletOrAndroidEnvironment()) {
    try {
      const rawbtNetUrl = `rawbt:net://${ip}:${port}#base64,${b64}`;
      const link = document.createElement('a');
      link.href = rawbtNetUrl;
      link.target = '_top';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try { document.body.removeChild(link); } catch (e) {}
      }, 500);
      return { success: true, message: 'Disparado para a impressora de rede via RawBT' };
    } catch (e) {}
  }

  return { success: false, message: 'Conexão direta não alcançada' };
};

export const downloadWindowsNetworkPrinterScript = (ip: string, portOrPrinterName: number | string = 9100, customPrinterName?: string) => {
  const safeIp = (ip || '192.168.1.200').trim();
  const safePort = typeof portOrPrinterName === 'number' ? portOrPrinterName : 9100;
  const suggestedPrinterName = typeof portOrPrinterName === 'string' ? portOrPrinterName : (customPrinterName || 'Impressora Cupom Termica');
  const batContent = `@echo off
chcp 65001 > nul
title Pao Mania - Configurador de Impressora de Rede no Windows
cls
echo ======================================================================
echo       PAO MANIA - CONFIGURADOR DE PORTA TCP/IP DA IMPRESSORA DE REDE
echo ======================================================================
echo.
echo Endereco IP da Impressora: ${safeIp}
echo Porta TCP Raw: ${safePort}
echo Nome Sugerido da Impressora: ${suggestedPrinterName}
echo.
echo 1. Criando Porta de Rede Standard TCP/IP no Windows...
powershell -Command "Add-PrinterPort -Name 'IP_${safeIp}' -PrinterHostAddress '${safeIp}' -PortNumber ${safePort} -ErrorAction SilentlyContinue"
echo.
echo 2. Porta 'IP_${safeIp}' criada com sucesso no Windows!
echo.
echo ======================================================================
echo INSTRUCAO FINAL:
echo Se voce ainda nao adicionou o driver da sua impressora termica no Windows:
echo - Va em Painel de Controle ^> Dispositivos e Impressoras
echo - Clique em 'Adicionar impressora'
echo - Escolha 'Usar uma porta existente' e selecione 'IP_${safeIp}'
echo - Selecione o driver da sua impressora (Elgin, Epson, Bematech, etc.)
echo ======================================================================
echo.
pause
exit
`;

  const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Configurar_Porta_Rede_${safeIp.replace(/\./g, '_')}.bat`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 1000);
};

export const resolveItemCode = (item: any): string => {
  if (item?.externalId && String(item.externalId).trim()) return String(item.externalId).trim();
  if (item?.code && String(item.code).trim()) return String(item.code).trim();
  try {
    const products = useStore.getState?.()?.products;
    if (Array.isArray(products) && item?.productId) {
      const p = products.find(prod => prod.id === item.productId);
      if (p?.externalId && String(p.externalId).trim()) return String(p.externalId).trim();
      if (p && (p as any).code && String((p as any).code).trim()) return String((p as any).code).trim();
    }
  } catch (e) {}
  return '';
};

export const resolveAddonCode = (addon: any): string => {
  if (!addon) return '';
  if (addon?.externalId && String(addon.externalId).trim()) return String(addon.externalId).trim();
  if (addon?.code && String(addon.code).trim()) return String(addon.code).trim();
  try {
    const products = useStore.getState?.()?.products;
    if (Array.isArray(products)) {
      if (addon?.productId) {
        const p = products.find(prod => prod.id === addon.productId);
        if (p?.externalId && String(p.externalId).trim()) return String(p.externalId).trim();
        if (p && (p as any).code && String((p as any).code).trim()) return String((p as any).code).trim();
      }
      if (addon?.name) {
        const cleanName = String(addon.name).trim().toLowerCase();
        const p = products.find(prod => prod.name && prod.name.trim().toLowerCase() === cleanName);
        if (p?.externalId && String(p.externalId).trim()) return String(p.externalId).trim();
        if (p && (p as any).code && String((p as any).code).trim()) return String((p as any).code).trim();
      }
    }
  } catch (e) {}
  return '';
};

export const getActiveOrderPrinter = (storeInfo: StoreInfo): ActivePrinterInfo => {
  const netConfig = getNetworkPrinterConfig(storeInfo);
  const isNetworkPreferred = storeInfo?.printerConnectionType === 'network' || (!storeInfo?.printerConnectionType && !!netConfig.ip);

  // 1. Se estiver configurado para impressora de rede por IP
  if (isNetworkPreferred && netConfig.ip) {
    return {
      name: `Impressora de Rede (${netConfig.ip}:${netConfig.port})`,
      model: `Rede TCP/IP Porta ${netConfig.port}`,
      isConfigured: true,
      isNetwork: true,
      ip: netConfig.ip,
      port: netConfig.port
    };
  }

  // 2. Checa se este computador local (estação do caixa) tem impressora fixa definida no navegador
  try {
    if (typeof window !== 'undefined') {
      const localCaixa = localStorage.getItem('paomania_caixa_printer');
      if (localCaixa && localCaixa.trim()) {
        return { name: localCaixa.trim(), model: 'Térmica (Estação Caixa)', isConfigured: true };
      }
    }
  } catch (e) {}

  // 2. Checa a impressora definida nas configurações da loja especificamente para o Caixa
  if (storeInfo?.caixaPrinterName && storeInfo.caixaPrinterName.trim()) {
    return { name: storeInfo.caixaPrinterName.trim(), model: 'Térmica (Caixa)', isConfigured: true };
  }

  // 3. Checa impressoras cadastradas na loja marcadas para pedidos
  try {
    if (storeInfo?.configuredPrinters) {
      const printers = typeof storeInfo.configuredPrinters === 'string' 
        ? JSON.parse(storeInfo.configuredPrinters) 
        : storeInfo.configuredPrinters;
      if (Array.isArray(printers) && printers.length > 0) {
        const marked = printers.find((p: any) => p.isOrderPrinter);
        if (marked && marked.name && marked.name.trim()) {
          return { name: marked.name.trim(), model: marked.model || 'Térmica 80mm', isConfigured: true };
        }
        if (printers[0]?.name && printers[0].name.trim()) {
          return { name: printers[0].name.trim(), model: printers[0].model || 'Térmica 80mm', isConfigured: true };
        }
      }
    }
  } catch (e) {}

  if (storeInfo?.preferredPrinterName && storeInfo.preferredPrinterName.trim()) {
    return { name: storeInfo.preferredPrinterName.trim(), model: 'Térmica 80mm', isConfigured: true };
  }

  return { name: 'Elgin i9 (Balcão / Caixa)', model: 'Térmica 80mm', isConfigured: false };
};

export const getLocalCaixaPrinter = (): string => {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('balbec_caixa_printer') || '';
    }
  } catch (e) {}
  return '';
};

export const setLocalCaixaPrinter = (printerName: string) => {
  try {
    if (typeof window !== 'undefined') {
      if (printerName && printerName.trim()) {
        localStorage.setItem('balbec_caixa_printer', printerName.trim());
      } else {
        localStorage.removeItem('balbec_caixa_printer');
      }
    }
  } catch (e) {}
};

export const getFullReceiptHTML = (order: Order, storeInfo: StoreInfo, autoPrint: boolean = false): string => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const customerNameStr = order.customerName ? order.customerName.trim().toUpperCase() : 'CLIENTE';
  const orderNumber = order.id ? String(order.id).slice(-4).padStart(4, '0') : '0001';
  const storeName = (storeInfo?.name || 'PÃO MANIA').toUpperCase();
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const items = Array.isArray(order.items) ? order.items : [];

  const activePrinter = getActiveOrderPrinter(storeInfo);
  const activeOrderPrinterName = activePrinter.name;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>🖨️ DESTINO: ${activeOrderPrinterName.toUpperCase()} | Pedido #${orderNumber}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    @page {
      margin: 0 !important;
      size: auto;
    }
    html, body {
      width: 100%;
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: fit-content !important;
      background-color: #fff;
      color: #000;
      font-family: 'Arial Black', Arial, 'Helvetica Neue', Helvetica, 'Courier New', monospace, sans-serif;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .receipt-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 !important;
      margin: 0 auto !important;
      height: auto !important;
    }
    .receipt-box {
      width: 100%;
      max-width: 270px;
      margin: 0 auto !important;
      padding: 2px 4px 4px 4px !important;
      height: auto !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .receipt-box-attendant {
      border-top: 1px dashed #000;
      padding-top: 8px !important;
    }
    .via-tag {
      text-align: center;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.5px;
      padding: 3px 4px;
      margin: 2px 0 6px 0;
      border: 1.5px solid #000;
      text-transform: uppercase;
      border-radius: 3px;
    }
    .via-tag-client {
      background-color: #f3f3f3;
      color: #000;
    }
    .via-tag-attendant {
      background-color: #000 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .cut-separator {
      width: 100%;
      max-width: 270px;
      text-align: center;
      margin: 12px 0 10px 0;
      page-break-after: always !important;
      break-after: page !important;
    }
    .cut-line-dashes {
      font-size: 11px;
      font-weight: 900;
      border-top: 2px dashed #000;
      border-bottom: 2px dashed #000;
      padding: 6px 0;
      letter-spacing: 0.5px;
    }
    .check-box {
      font-family: monospace;
      font-weight: 900;
      margin-right: 2px;
    }
    .title {
      text-align: center;
      margin: 2px 0 6px 0;
      font-weight: 900;
      font-size: 18px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .customer-order-box {
      background-color: #000 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      padding: 8px 6px;
      margin: 8px 0 10px 0;
      text-align: center;
      border-radius: 4px;
    }
    .box-client {
      font-size: 15px;
      font-weight: 900;
      line-height: 1.3;
      word-break: break-word;
      color: #fff !important;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .box-order {
      font-size: 18px;
      font-weight: 900;
      line-height: 1.3;
      color: #fff !important;
      margin-top: 2px;
      letter-spacing: 0.5px;
    }
    .divider {
      border-top: 2px dashed #000;
      margin: 8px 0;
      width: 100%;
    }
    .divider-solid {
      border-top: 3px solid #000;
      margin: 8px 0;
      width: 100%;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 5px;
      font-weight: 900;
      font-size: 14px;
      gap: 6px;
      color: #000;
    }
    .item-name {
      flex: 1;
      word-break: break-word;
      text-align: left;
      font-weight: 900;
    }
    .item-price {
      white-space: nowrap;
      text-align: right;
      font-weight: 900;
    }
    .item-description {
      font-size: 11px;
      font-weight: 300 !important;
      font-style: italic !important;
      color: #333 !important;
      padding-left: 8px;
      margin-top: 1px;
      margin-bottom: 2px;
      line-height: 1.25;
      word-break: break-word;
    }
    .item-code-badge {
      display: inline-block;
      background-color: #000 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-family: monospace, Courier, monospace;
      font-size: 11px;
      font-weight: 900;
      padding: 1px 6px;
      border-radius: 3px;
      margin: 1px 0 2px 0;
      letter-spacing: 0.5px;
    }
    .addons {
      font-size: 12px;
      padding-left: 10px;
      color: #000;
      font-weight: 700;
      margin-bottom: 3px;
      word-break: break-word;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 900;
      font-size: 17px;
      margin-top: 4px;
      padding: 2px 0;
      color: #000;
    }
    .center {
      text-align: center;
      word-break: break-word;
    }
    .text-sm {
      font-size: 13px;
      font-weight: 700;
    }
    .bold {
      font-weight: 900;
    }
    .cut-line {
      text-align: center;
      padding: 6px 0 8px 0;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: -0.5px;
    }

    @media print {
      html, body {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: fit-content !important;
        background-color: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .receipt-container {
        padding: 0 !important;
        margin: 0 auto !important;
        height: auto !important;
      }
      .receipt-box {
        width: 100%;
        max-width: 270px;
        margin: 0 auto !important;
        padding: 2px 4px 4px 4px !important;
        height: auto !important;
      }
      .cut-separator {
        page-break-after: always !important;
        break-after: page !important;
      }
      .item-description {
        font-size: 11px !important;
        font-weight: 300 !important;
        font-style: italic !important;
        color: #000 !important;
        padding-left: 8px !important;
        margin-top: 1px !important;
        margin-bottom: 2px !important;
      }
      .item-code-badge {
        background-color: #000 !important;
        color: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .cut-line {
        padding-top: 4px !important;
        padding-bottom: 2px !important;
      }
    }
  </style>
</head>
<body>
  ${(() => {
    const isSingleCopy = storeInfo?.printerCopies === 1;

    const renderSingleVia = (viaType: 'cliente' | 'balcao') => {
      const isClient = viaType === 'cliente';
      return `
      <div class="receipt-box ${!isClient ? 'receipt-box-attendant' : ''}">
        ${activeOrderPrinterName ? `
        <div style="text-align: center; font-size: 11px; font-weight: 900; background: #000; color: #fff; padding: 4px 6px; border-radius: 4px; margin-bottom: 6px; letter-spacing: 0.5px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
          🖨️ DESTINO: ${activeOrderPrinterName.toUpperCase()}
        </div>` : ''}
        <div class="title">${storeName}</div>
        
        <div class="via-tag ${isClient ? 'via-tag-client' : 'via-tag-attendant'}">
          ${isSingleCopy ? '*** VIA ÚNICA ***' : (isClient ? '*** 1ª VIA - CLIENTE ***' : '*** 2ª VIA - BALCÃO (ATENDENTE) ***')}
        </div>

        <div class="customer-order-box">
          ${order.customerName && order.customerName.trim() !== '' && order.customerName.trim().toUpperCase() !== 'CLIENTE'
            ? `<div class="box-client">CLIENTE: ${customerNameStr}</div>`
            : (isClient && order.type === 'kiosk' ? '' : `<div class="box-client">CLIENTE: BALCÃO / TOTEM</div>`)}
          <div class="box-order">PEDIDO #${orderNumber}</div>
        </div>

        ${order.customerPhone ? `<div class="center text-sm">Tel: ${order.customerPhone}</div>` : ''}
        ${order.deliveryAddress ? `<div class="center text-sm" style="margin-top: 2px;">End: ${order.deliveryAddress}</div>` : ''}
        
        <div class="center text-sm" style="margin-top: 2px;">${orderDate}</div>
        <div class="center text-sm bold" style="margin-top: 2px;">
          ${order.type === 'kiosk' ? 'Tipo: Retirada no Balcão (Totem)' : (order.deliveryType === 'delivery' ? 'Tipo: Entrega em Domicílio' : 'Tipo: Retirada no Balcão')}
        </div>

        <div class="divider"></div>

        <div class="items-list">
          ${items.map(item => {
            const itemCode = resolveItemCode(item);
            const itemTotal = ((item.price || 0) + (item.flavor?.price || 0) + (item.addons?.reduce((s, a) => s + (a.price || 0), 0) || 0)) * (item.quantity || 1);
            return `
            <div class="item-row">
              <span class="item-name">${!isClient ? '<span class="check-box">[ ] </span>' : ''}${item.quantity || 1}x ${item.name || ''}</span>
              <span class="item-price">${formatCurrency(itemTotal)}</span>
            </div>
            ${itemCode ? `<div style="padding-left: 4px; margin: 1px 0 3px 0;"><span class="item-code-badge">CÓD: ${itemCode}</span></div>` : ''}
            ${item.description && item.description.trim() !== '' ? `<div class="item-description">${item.description.trim()}</div>` : ''}
            ${(() => {
              if (!item.flavor) return '';
              const fCode = resolveAddonCode(item.flavor);
              return `<div class="addons">Sabor: ${item.flavor.name}${fCode ? ` <span class="item-code-badge" style="font-size: 10px; padding: 0 4px; margin-left: 4px;">CÓD: ${fCode}</span>` : ''}</div>`;
            })()}
            ${(() => {
              if (!item.addons || item.addons.length === 0) return '';
              return item.addons.map(a => {
                const aCode = resolveAddonCode(a);
                return `<div class="addons">+ ${a.name}${aCode ? ` <span class="item-code-badge" style="font-size: 10px; padding: 0 4px; margin-left: 4px;">CÓD: ${aCode}</span>` : ''}</div>`;
              }).join('');
            })()}
          `;
          }).join('')}
        </div>

        <div class="divider"></div>

        <div class="total-row">
          <span>TOTAL :</span>
          <span>${formatCurrency(order.total || 0)}</span>
        </div>

        <div class="center text-sm bold" style="margin-top: 4px;">
          Pagamento: ${order.paymentMethod || 'Não informado'}
        </div>

        ${!isClient ? `
        <div class="attendant-box" style="margin-top: 8px; font-size: 11px; border-top: 1px dashed #000; padding-top: 5px; text-align: left;">
          <div>Conferido / Atendente: ___________________</div>
        </div>
        ` : ''}

        <div class="divider-solid"></div>
        <div class="center text-sm" style="font-size: 11px; margin-top: 2px; font-weight: 900;">
          ${isClient ? '*** OBRIGADO PELA PREFERÊNCIA ***' : '*** CONTROLE INTERNO / BALCÃO ***'}
        </div>
        
        <div class="cut-line">
          ✂ - - - - - - - - - - - - ✂
        </div>
      </div>
      `;
    };

    if (isSingleCopy) {
      return `<div class="receipt-container">${renderSingleVia('cliente')}</div>`;
    }

    return `
      <div class="receipt-container">
        ${renderSingleVia('cliente')}
        <div class="cut-separator">
          <div class="cut-line-dashes">✂ - - - - - - DESTACAR AQUI - - - - - - ✂</div>
        </div>
      </div>
      <div class="receipt-container" style="page-break-before: always; break-before: page;">
        ${renderSingleVia('balcao')}
      </div>
    `;
  })()}
  ${autoPrint ? `
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
    window.onafterprint = function() {
      setTimeout(function() {
        try { window.close(); } catch(e) {}
      }, 200);
    };
  </script>` : ''}
</body>
</html>`;
};

export const normalizeEscPosText = (text: string): string => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ');
};

export const getEscPosReceiptBase64 = (order: Order, storeInfo: StoreInfo): string => {
  const formatCurrency = (value: number) => {
    return 'R$ ' + (value || 0).toFixed(2).replace('.', ',');
  };
  const storeName = normalizeEscPosText((storeInfo?.name || 'PAO MANIA').toUpperCase());
  const orderNumber = order.id ? String(order.id).slice(-4).padStart(4, '0') : '0001';
  const customerName = order.customerName ? normalizeEscPosText(order.customerName.trim().toUpperCase()) : 'CLIENTE';
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const items = Array.isArray(order.items) ? order.items : [];
  const cutMode = storeInfo?.printerCutMode || 'partial';
  const isSingleCopy = storeInfo?.printerCopies === 1;

  const buildViaLines = (viaType: 'cliente' | 'balcao', single: boolean = false): string[] => {
    const isClient = viaType === 'cliente';
    const lines: string[] = [];

    // Initialize printer
    lines.push('\x1B\x40'); 
    lines.push('\x1B\x74\x00'); // Standard code page

    // Center alignment
    lines.push('\x1B\x61\x01'); 
    // Bold + Double height
    lines.push('\x1B\x45\x01\x1D\x21\x11');
    lines.push(`${storeName}\n`);
    lines.push('\x1D\x21\x00\x1B\x45\x00'); // Reset size

    // Via Header
    if (single) {
      lines.push('\x1B\x45\x01*** VIA UNICA ***\x1B\x45\x00\n');
    } else if (isClient) {
      lines.push('\x1B\x45\x01*** 1a VIA - CLIENTE ***\x1B\x45\x00\n');
    } else {
      lines.push('\x1B\x45\x01*** 2a VIA - BALCAO (ATENDENTE) ***\x1B\x45\x00\n');
    }

    lines.push('--------------------------------\n');
    lines.push('\x1B\x45\x01\x1D\x21\x11');
    lines.push(`PEDIDO #${orderNumber}\n`);
    lines.push('\x1D\x21\x00\x1B\x45\x00');

    if (order.customerName && order.customerName.trim() !== '' && customerName !== 'CLIENTE') {
      lines.push(`CLIENTE: ${customerName}\n`);
    } else if (!isClient) {
      lines.push(`CLIENTE: BALCAO / TOTEM\n`);
    }

    if (order.customerPhone) {
      lines.push(`Tel: ${order.customerPhone}\n`);
    }
    if (order.deliveryAddress) {
      lines.push(`End: ${normalizeEscPosText(order.deliveryAddress)}\n`);
    }
    lines.push(`${orderDate}\n`);
    lines.push(`${order.type === 'kiosk' ? 'Tipo: Autoatendimento (Totem)' : (order.deliveryType === 'delivery' ? 'Tipo: Entrega' : 'Tipo: Retirada')}\n`);
    lines.push('--------------------------------\n');
    
    // Left alignment for items
    lines.push('\x1B\x61\x00'); 
    
    items.forEach(item => {
      const itemTotal = ((item.price || 0) + (item.flavor?.price || 0) + (item.addons?.reduce((s, a) => s + (a.price || 0), 0) || 0)) * (item.quantity || 1);
      const itemName = normalizeEscPosText(item.name || '');
      const itemCode = normalizeEscPosText(resolveItemCode(item));
      const checkbox = !isClient ? '[ ] ' : '';
      lines.push(`\x1B\x45\x01${checkbox}${item.quantity || 1}x ${itemName}\x1B\x45\x00\n`);
      if (itemCode) {
        lines.push(`   \x1D\x42\x01 COD: ${itemCode} \x1D\x42\x00\n`);
      }
      lines.push(`   Subtotal: ${formatCurrency(itemTotal)}\n`);
      if (item.description) lines.push(`   * ${normalizeEscPosText(item.description)}\n`);
      if (item.flavor) {
        const fCode = normalizeEscPosText(resolveAddonCode(item.flavor));
        lines.push(`   * Sabor: ${normalizeEscPosText(item.flavor.name)}${fCode ? ` \x1D\x42\x01 COD: ${fCode} \x1D\x42\x00` : ''}\n`);
      }
      if (item.addons && item.addons.length > 0) {
        item.addons.forEach(a => {
          const aCode = normalizeEscPosText(resolveAddonCode(a));
          lines.push(`   * + ${normalizeEscPosText(a.name)}${aCode ? ` \x1D\x42\x01 COD: ${aCode} \x1D\x42\x00` : ''}\n`);
        });
      }
    });

    lines.push('--------------------------------\n');
    lines.push('\x1B\x61\x02'); // Right alignment
    lines.push('\x1B\x45\x01\x1D\x21\x01'); // Bold + Double height total
    lines.push(`TOTAL: ${formatCurrency(order.total || 0)}\n`);
    lines.push('\x1D\x21\x00\x1B\x45\x00'); // Normal font

    lines.push('\x1B\x61\x01'); // Center alignment
    lines.push(`Pagamento: ${normalizeEscPosText(order.paymentMethod || 'Balcao / Dinheiro')}\n`);
    lines.push('--------------------------------\n');

    if (isClient) {
      lines.push('*** OBRIGADO PELA PREFERENCIA ***\n');
    } else {
      lines.push('Conferido: _____________________\n');
      lines.push('*** CONTROLE INTERNO / BALCAO ***\n');
    }
    
    // Feed 4 lines before cut so the footer text is completely clear of the cutter blade
    lines.push('\n\n\n\n');
    
    // Cut command based on configuration
    if (cutMode === 'partial') {
      // GS V 1: 1 único corte parcial / picote com retenção central para fácil destaque no Totem
      lines.push('\x1D\x56\x01');
    } else if (cutMode === 'full') {
      // GS V 0: 1 único corte total
      lines.push('\x1D\x56\x00');
    }
    // Se for 'none', não envia comando binário para o RawBT cuidar do corte por conta própria

    return lines;
  };

  let allLines: string[] = [];
  if (isSingleCopy) {
    allLines = buildViaLines('cliente', true);
  } else {
    // 2 vias: Via 1 para o cliente (com corte) + Via 2 para a atendente do balcão (com corte)
    const via1 = buildViaLines('cliente', false);
    const via2 = buildViaLines('balcao', false);
    allLines = [...via1, '\n\n', ...via2];
  }

  const fullText = allLines.join('');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fullText);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const isAndroidDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|Linux.*arm|Silk|AFT/i.test(ua);
};

export const isTabletOrAndroidEnvironment = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
  return isAndroidDevice() || /Tablet|iPad/i.test(ua) || (Boolean(isTouch) && /Mobile/i.test(ua));
};

// Guarda de debounce para evitar disparos duplicados ou triplicados apenas em chamadas automáticas
let lastPrintedOrderId: string | number | null = null;
let lastPrintTimestamp: number = 0;

/**
 * Retorna a URI oficial do RawBT para disparo em links diretos ou scripts.
 */
export const getRawBTIntentUrl = (order: Order, storeInfo: StoreInfo): string => {
  const b64 = getEscPosReceiptBase64(order, storeInfo);
  return `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
};

/**
 * Dispara a impressão diretamente no aplicativo RawBT no Android/Tablet.
 * Utiliza o esquema oficial e consolidado rawbt:base64 com fallbacks para máxima compatibilidade.
 */
export const printViaRawBT = (order: Order, storeInfo: StoreInfo, isAuto: boolean = false): boolean => {
  try {
    if (!order) return false;

    // Prevenção de disparo duplo/triplo simultâneo APENAS se for chamada automática (ex: checkout totem)
    const now = Date.now();
    if (isAuto && order.id && lastPrintedOrderId === order.id && (now - lastPrintTimestamp) < 2000) {
      console.log('Ignorando disparo automático duplicado do RawBT para o pedido #', order.id);
      return true;
    }
    lastPrintedOrderId = order.id || null;
    lastPrintTimestamp = now;

    const b64 = getEscPosReceiptBase64(order, storeInfo);
    const rawbtUri = `rawbt:base64,${b64}`;

    // 1. Método Principal (Consolidado): window.location direto para o protocolo rawbt:
    // Este é o método padrão da documentação do RawBT que sempre funcionou com perfeição
    try {
      window.location.href = rawbtUri;
    } catch (locErr) {
      console.warn('Tentativa via window.location falhou, tentando elemento âncora:', locErr);
    }

    // 2. Método de apoio via elemento âncora (para navegadores com restrição em iframe)
    try {
      const link = document.createElement('a');
      link.href = rawbtUri;
      link.target = '_top';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try { document.body.removeChild(link); } catch(e) {}
      }, 500);
    } catch (linkErr) {
      console.warn('Tentativa via link rawbt falhou:', linkErr);
    }

    return true;
  } catch (e) {
    console.warn('Erro ao disparar RawBT:', e);
    return false;
  }
};

/**
 * Dispara a caixa de diálogo nativa do navegador/Windows para impressão em folha/térmica
 */
export const printNativeDialog = async (order: Order, storeInfo: StoreInfo): Promise<string | null> => {
  const fullHtml = getFullReceiptHTML(order, storeInfo, false);

  return new Promise((resolve) => {
    try {
      // Remove iframe de impressão anterior se houver
      const existingIframe = document.getElementById('receipt-print-frame');
      if (existingIframe) {
        try { existingIframe.remove(); } catch (e) {}
      }

      // Cria iframe oculto posicionado fora da tela para acionar a caixa nativa sem abrir/fechar abas
      const iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '-9999px';
      iframe.style.bottom = '-9999px';
      iframe.style.width = '320px';
      iframe.style.height = '450px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';

      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc) {
        fallbackToWindowPrint(fullHtml);
        resolve('window-fallback');
        return;
      }

      frameDoc.open();
      frameDoc.write(fullHtml);
      frameDoc.close();

      // Aguarda renderização dos estilos e fontes
      setTimeout(() => {
        try {
          const frameWin = iframe.contentWindow;
          if (frameWin) {
            frameWin.focus();

            const originalDocTitle = document.title;
            const activePrinter = getActiveOrderPrinter(storeInfo);
            const orderNumStr = order.id ? String(order.id).slice(-4).padStart(4, '0') : '0001';
            
            // Define o título da janela principal para que a caixa de diálogo do Windows/Chrome
            // exiba com destaque absoluto para a operadora qual impressora deve ser usada
            document.title = `[DESTINO: ${activePrinter.name.toUpperCase()}] - Pedido #${orderNumStr}`;

            // Ao concluir ou cancelar a caixa de impressão, remove o iframe suavemente e restaura o título
            frameWin.onafterprint = () => {
              document.title = originalDocTitle;
              setTimeout(() => {
                try { iframe.remove(); } catch (e) {}
              }, 800);
            };

            // Fallback para restaurar título após 4 segundos
            setTimeout(() => {
              document.title = originalDocTitle;
            }, 4000);

            // Dispara a caixa de diálogo do Windows
            frameWin.print();
            resolve('dialog');
          } else {
            fallbackToWindowPrint(fullHtml);
            resolve('window-fallback');
          }
        } catch (err) {
          console.warn('[Impressão Desktop] Erro ao chamar print no iframe:', err);
          fallbackToWindowPrint(fullHtml);
          resolve('window-fallback');
        }
      }, 250);

    } catch (err) {
      console.error('[Impressão Desktop] Falha no fluxo de impressão:', err);
      fallbackToWindowPrint(fullHtml);
      resolve('window-fallback');
    }
  });
};

// ==========================================
// SUPORTE A WEB SERIAL (CABO USB/SERIAL DIRETO)
// ==========================================
let activeWebSerialPort: any = null;

export const isWebSerialSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
};

export const hasActiveSerialConnection = (): boolean => {
  return activeWebSerialPort !== null && !!activeWebSerialPort.writable;
};

export const connectWebSerialPrinter = async (): Promise<{ success: boolean; message: string }> => {
  if (!isWebSerialSupported()) {
    return {
      success: false,
      message: 'Este navegador não suporta Web Serial. Use Google Chrome ou Edge no Windows para conexão direta via cabo USB.'
    };
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });
    activeWebSerialPort = port;
    return {
      success: true,
      message: 'Impressora conectada diretamente via porta USB/Serial! Agora todas as impressões serão enviadas sem abrir nenhuma tela do Windows.'
    };
  } catch (err: any) {
    console.warn('Erro ao conectar Web Serial:', err);
    return {
      success: false,
      message: err?.message || 'Seleção cancelada ou porta indisponível.'
    };
  }
};

export const disconnectWebSerialPrinter = async () => {
  if (activeWebSerialPort) {
    try {
      await activeWebSerialPort.close();
    } catch (e) {}
    activeWebSerialPort = null;
  }
};

export const printViaWebSerial = async (order: Order, storeInfo: StoreInfo): Promise<boolean> => {
  if (!activeWebSerialPort || !activeWebSerialPort.writable) return false;
  try {
    const b64 = getEscPosReceiptBase64(order, storeInfo);
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const writer = activeWebSerialPort.writable.getWriter();
    await writer.write(bytes);
    writer.releaseLock();
    return true;
  } catch (err) {
    console.error('Falha na escrita Web Serial:', err);
    return false;
  }
};

/**
 * Faz download de um atalho do Windows (.bat) configurado com Chrome --kiosk-printing.
 * Com esse atalho, o Chrome imprime direto na impressora padrão sem abrir NENHUMA caixa de diálogo,
 * impedindo 100% que a operadora selecione a impressora errada!
 */
export const downloadChromeKioskShortcut = () => {
  const currentUrl = window.location.origin + '/admin';
  const batContent = `@echo off
chcp 65001 > nul
title Pao Mania - Modo Caixa Terminal
cls
echo ======================================================================
echo           PAO MANIA - MODO TERMINAL DE IMPRESSAO DO CAIXA
echo ======================================================================
echo.
echo * As impressoes serao enviadas DIRETAMENTE para a Impressora Padrao
echo   configurada no seu Windows, sem abrir nenhuma janela de confirmacao!
echo.
echo * Abra o Painel de Controle do Windows e certifique-se de que a sua
echo   impressora de cupom termica esta marcada como 'Impressora Padrao'.
echo.
echo Iniciando o sistema agora...
echo ======================================================================
start chrome.exe --app="${currentUrl}" --kiosk-printing
exit
`;

  const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'PaoMania_Caixa_Impressao_Direta.bat';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 1000);
};

/**
 * Dispara a impressão do cupom.
 * - Conexão USB/Serial Direta: Envia ESC/POS puro sem caixa de diálogo.
 * - Android/Tablet: Aciona o RawBT para impressoras térmicas via bluetooth/USB.
 * - Desktop (Windows, Mac, Linux): Abre diretamente a caixa de diálogo nativa com o destino pré-marcado.
 */
export const printReceipt = async (order: Order, storeInfo: StoreInfo): Promise<string | null> => {
  if (!order) return null;

  // 1. Se a loja ou estação estiver configurada para Impressora de Rede por IP
  const netConfig = getNetworkPrinterConfig(storeInfo);
  const isNetworkPreferred = storeInfo?.printerConnectionType === 'network' || (!storeInfo?.printerConnectionType && !!netConfig.ip);

  if (isNetworkPreferred && netConfig.ip) {
    try {
      const netResult = await printViaNetworkIp(order, storeInfo);
      if (netResult && netResult.success) {
        return 'network-ip';
      }
    } catch (e) {
      console.warn('Tentativa via socket TCP de rede falhou, caindo para impressão com aviso visual:', e);
    }
  }

  // 2. Se estiver conectado via Web Serial (Cabo USB Direto), imprime instantaneamente
  if (hasActiveSerialConnection()) {
    const serialSuccess = await printViaWebSerial(order, storeInfo);
    if (serialSuccess) return 'webserial';
  }

  // 3. Dispara a impressão via RawBT (Android, Tablets, Totem, etc.)
  try {
    const rawbtSuccess = printViaRawBT(order, storeInfo);
    if (rawbtSuccess && (isAndroidDevice() || isTabletOrAndroidEnvironment())) {
      return 'rawbt';
    }
  } catch (e) {
    console.warn('Falha ao disparar RawBT:', e);
  }

  // 4. Se for ambiente desktop que não utiliza RawBT, aciona a caixa de diálogo nativa
  if (!isAndroidDevice() && !isTabletOrAndroidEnvironment()) {
    return printNativeDialog(order, storeInfo);
  }

  return 'rawbt';
};

/**
 * Fallback via janela pop-up caso o iframe seja restringido pelo navegador
 */
const fallbackToWindowPrint = (html: string) => {
  try {
    const printWindow = window.open('', '_blank', 'width=420,height=650,resizable=yes,scrollbars=yes');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (e) {
          console.warn('Falha no print da janela:', e);
        }
      }, 350);
    }
  } catch (e) {
    console.error('Falha no fallback de janela:', e);
  }
};

/**
 * Cria um pedido fictício para testes rápidos de impressão no Windows
 */
export const createSampleOrder = (storeInfo: StoreInfo): Order => {
  return {
    id: 'TEST-0001',
    customerName: 'Cliente Teste (Balcão)',
    customerPhone: '(11) 99999-9999',
    type: 'kiosk',
    deliveryType: 'pickup',
    deliveryAddress: '',
    items: [
      {
        productId: 'sample_prod_1',
        name: 'Coxinha de Frango com Catupiry (2 un)',
        price: 15.00,
        quantity: 1,
        description: 'Frito na hora, crocante'
      },
      {
        productId: 'sample_prod_2',
        name: 'Suco de Laranja 500ml',
        price: 9.00,
        quantity: 1,
        flavor: { productId: 'sample_flv_1', name: 'Sem Açúcar', price: 0 }
      }
    ],
    total: 24.00,
    status: 'completed',
    paymentMethod: 'Cartão de Débito / Balcão',
    createdAt: Date.now()
  };
};
