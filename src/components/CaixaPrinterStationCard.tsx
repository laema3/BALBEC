import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Check, 
  AlertCircle, 
  Zap, 
  Download, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  Sliders,
  Laptop,
  Usb,
  Network,
  Globe,
  Wifi
} from 'lucide-react';
import { StoreInfo } from '../store/useStore';
import { 
  getActiveOrderPrinter, 
  getLocalCaixaPrinter, 
  setLocalCaixaPrinter, 
  downloadChromeKioskShortcut,
  connectWebSerialPrinter,
  disconnectWebSerialPrinter,
  hasActiveSerialConnection,
  isWebSerialSupported,
  printReceipt,
  createSampleOrder,
  getNetworkPrinterConfig,
  setNetworkPrinterConfig,
  testNetworkPrinterIp,
  downloadWindowsNetworkPrinterScript
} from '../utils/printer';

interface CaixaPrinterStationCardProps {
  storeInfo: StoreInfo;
  onUpdateStoreInfo?: (updates: Partial<StoreInfo>) => Promise<void> | void;
  currentUserEmail?: string;
  isCaixaUser?: boolean;
}

export const CaixaPrinterStationCard: React.FC<CaixaPrinterStationCardProps> = ({
  storeInfo,
  onUpdateStoreInfo,
  currentUserEmail,
  isCaixaUser = false
}) => {
  const [connectionType, setConnectionType] = useState<'network' | 'windows'>('network');
  const [networkIp, setNetworkIp] = useState('192.168.1.200');
  const [networkPort, setNetworkPort] = useState(9100);
  const [isTestingNetIp, setIsTestingNetIp] = useState(false);

  const [selectedPrinterName, setSelectedPrinterName] = useState('');
  const [customPrinterInput, setCustomPrinterInput] = useState('');
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [isAutoPrint, setIsAutoPrint] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Determina a impressora ativa atual
  const activePrinter = getActiveOrderPrinter(storeInfo);

  useEffect(() => {
    const netConf = getNetworkPrinterConfig(storeInfo);
    setNetworkIp(netConf.ip || '192.168.1.200');
    setNetworkPort(netConf.port || 9100);
    setConnectionType(storeInfo?.printerConnectionType === 'windows' ? 'windows' : 'network');

    const local = getLocalCaixaPrinter();
    const current = local || storeInfo?.caixaPrinterName || storeInfo?.preferredPrinterName || 'Elgin i9 (Balcão / Caixa)';
    setSelectedPrinterName(current);
    setCustomPrinterInput(current);

    const autoPrintStorage = localStorage.getItem('paomania_auto_print_caixa');
    if (autoPrintStorage !== null) {
      setIsAutoPrint(autoPrintStorage === 'true');
    } else {
      setIsAutoPrint(Boolean(storeInfo?.autoPrintOrdersOnCaixa));
    }

    setIsSerialConnected(hasActiveSerialConnection());
  }, [storeInfo]);

  // Lista de impressoras cadastradas na loja
  const configuredList = React.useMemo(() => {
    try {
      if (storeInfo?.configuredPrinters) {
        const parsed = typeof storeInfo.configuredPrinters === 'string'
          ? JSON.parse(storeInfo.configuredPrinters)
          : storeInfo.configuredPrinters;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return [
      { id: 'p1', name: 'Elgin i9 (Balcão / Caixa)', model: 'Térmica 80mm', isOrderPrinter: true },
      { id: 'p2', name: 'Epson TM-T20 / TM-T20X', model: 'Térmica 80mm', isOrderPrinter: true },
      { id: 'p3', name: 'Bematech MP-4200 TH', model: 'Térmica 80mm', isOrderPrinter: true },
      { id: 'p4', name: 'Daruma DR800', model: 'Térmica 80mm', isOrderPrinter: true }
    ];
  }, [storeInfo?.configuredPrinters]);

  const handleSaveNetworkPrinter = async () => {
    const trimmedIp = networkIp.trim();
    if (!trimmedIp) return;

    setIsSaving(true);
    setNetworkPrinterConfig(trimmedIp, networkPort);

    try {
      if (onUpdateStoreInfo) {
        await onUpdateStoreInfo({
          printerConnectionType: 'network',
          networkPrinterIp: trimmedIp,
          networkPrinterPort: networkPort
        });
      }
      setFeedbackMsg({
        type: 'success',
        text: `Impressora de Rede ${trimmedIp}:${networkPort} salva e fixada como padrão do site!`
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      setFeedbackMsg({
        type: 'info',
        text: `Impressora de Rede salva localmente no navegador deste computador como ${trimmedIp}:${networkPort}.`
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNetworkIp = async () => {
    const trimmedIp = networkIp.trim();
    if (!trimmedIp) return;

    setIsTestingNetIp(true);
    try {
      const res = await testNetworkPrinterIp(trimmedIp, networkPort);
      setFeedbackMsg({
        type: res.success ? 'success' : 'error',
        text: res.message
      });
      setTimeout(() => setFeedbackMsg(null), 7000);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Falha ao conectar no IP da impressora'
      });
      setTimeout(() => setFeedbackMsg(null), 7000);
    } finally {
      setIsTestingNetIp(false);
    }
  };

  const handleSavePrinterChoice = async (nameToSave: string) => {
    const trimmed = nameToSave.trim();
    if (!trimmed) return;

    setIsSaving(true);
    setLocalCaixaPrinter(trimmed);
    setSelectedPrinterName(trimmed);

    try {
      if (onUpdateStoreInfo) {
        await onUpdateStoreInfo({ 
          printerConnectionType: 'windows',
          caixaPrinterName: trimmed 
        });
      }
      setFeedbackMsg({
        type: 'success',
        text: `Impressora "${trimmed}" fixada com sucesso para esta estação do Caixa!`
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      setFeedbackMsg({
        type: 'info',
        text: `Impressora salva localmente no computador do Caixa como "${trimmed}".`
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } finally {
      setIsSaving(false);
      setIsEditingCustom(false);
    }
  };

  const handleToggleAutoPrint = async (enabled: boolean) => {
    setIsAutoPrint(enabled);
    localStorage.setItem('paomania_auto_print_caixa', String(enabled));

    try {
      if (onUpdateStoreInfo) {
        await onUpdateStoreInfo({ autoPrintOrdersOnCaixa: enabled });
      }
      setFeedbackMsg({
        type: 'success',
        text: enabled 
          ? 'Impressão automática de novos pedidos ATIVADA! Novos pedidos serão impressos no Caixa.' 
          : 'Impressão automática desativada. Os pedidos poderão ser impressos manualmente no botão Imprimir.'
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (e) {}
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    try {
      const sample = createSampleOrder(storeInfo);
      sample.customerName = 'TESTE CAIXA';
      sample.id = 'TEST-' + Math.floor(1000 + Math.random() * 9000);
      
      const res = await printReceipt(sample, storeInfo);
      setFeedbackMsg({
        type: 'success',
        text: `Cupom de teste enviado para a impressora [${activePrinter.name}] (${
          res === 'network-ip' ? 'via Rede TCP/IP Direta' :
          res === 'webserial' ? 'via USB Direto' : 'via Diálogo do Navegador'
        }).`
      });
      setTimeout(() => setFeedbackMsg(null), 6000);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Erro ao testar impressão: ${err?.message || 'Falha no envio'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnectSerial = async () => {
    if (isSerialConnected) {
      await disconnectWebSerialPrinter();
      setIsSerialConnected(false);
      setFeedbackMsg({ type: 'info', text: 'Conexão USB direta desconectada. O sistema voltará ao modo padrão.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
      return;
    }

    const res = await connectWebSerialPrinter();
    if (res.success) {
      setIsSerialConnected(true);
      setFeedbackMsg({ type: 'success', text: res.message });
    } else {
      setFeedbackMsg({ type: 'error', text: res.message });
    }
    setTimeout(() => setFeedbackMsg(null), 6000);
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 border-2 border-orange-300/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-orange-200/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-stone-900">
                Estação de Impressão do Caixa
              </h3>
              <span className="bg-orange-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Impressora Fixa
              </span>
              {isCaixaUser && (
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Laptop className="w-2.5 h-2.5" /> Estação: caixa@paomania.com.br
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 mt-0.5">
              Defina exatamente para qual impressora os pedidos do site serão enviados, sem risco de confusão na hora de imprimir.
            </p>
          </div>
        </div>

        {/* Status Atual e Botão de Teste Rápido */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTesting}
            className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Emite um cupom de teste agora para conferir a impressora física"
          >
            <Printer className="w-3.5 h-3.5 text-orange-400" />
            <span>{isTesting ? 'Imprimindo...' : 'Testar Impressão Agora'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
          feedbackMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
          feedbackMsg.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
          'bg-blue-100 text-blue-800 border border-blue-300'
        }`}>
          {feedbackMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Alternância de Modo: Rede por IP vs Driver do Windows */}
      <div className="flex items-center justify-between gap-2 bg-white/70 p-1.5 rounded-xl border border-orange-200">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setConnectionType('network');
              if (onUpdateStoreInfo) onUpdateStoreInfo({ printerConnectionType: 'network' });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              connectionType === 'network'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Impressora de Rede (por IP)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConnectionType('windows');
              if (onUpdateStoreInfo) onUpdateStoreInfo({ printerConnectionType: 'windows' });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              connectionType === 'windows'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Driver Windows / USB Local</span>
          </button>
        </div>

        <div className="text-[11px] font-bold text-stone-700 hidden sm:flex items-center gap-1">
          <span>Destino Atual:</span>
          <span className="text-orange-700 font-mono bg-orange-100/70 px-2 py-0.5 rounded-md">
            {activePrinter.name}
          </span>
        </div>
      </div>

      {/* Conteúdo do Modo: Rede por IP */}
      {connectionType === 'network' ? (
        <div className="bg-white/95 p-4 rounded-xl border border-orange-200 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-orange-600" />
                <span>Endereço IP da Impressora de Cupom na Rede:</span>
                <span className="text-orange-600 font-mono">[{networkIp}:{networkPort}]</span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Ex: 192.168.1.200 ou 192.168.0.150"
                  value={networkIp}
                  onChange={(e) => setNetworkIp(e.target.value)}
                  className="w-full sm:w-64 font-mono font-bold bg-stone-50 border border-orange-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-orange-500 outline-none"
                />

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-500">Porta:</span>
                  <input
                    type="number"
                    value={networkPort}
                    onChange={(e) => setNetworkPort(Number(e.target.value) || 9100)}
                    className="w-20 font-mono font-bold bg-stone-50 border border-stone-300 rounded-xl px-2 py-2 text-xs text-stone-900 text-center focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveNetworkPrinter}
                    disabled={isSaving || !networkIp.trim()}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar e Fixar como Padrão</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestNetworkIp}
                    disabled={isTestingNetIp || !networkIp.trim()}
                    className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    <Wifi className="w-3.5 h-3.5 text-orange-400" />
                    <span>{isTestingNetIp ? 'Conectando...' : 'Testar Conexão IP'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Toggle de Auto-Impressão */}
            <div className="shrink-0 p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-black text-stone-900 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  Impressão Automática
                </span>
                <span className="text-[10px] text-stone-500">Imprimir na hora ao chegar pedido</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoPrint}
                  onChange={(e) => handleToggleAutoPrint(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>
          </div>

          {/* Ações e Ferramentas para Impressora de Rede */}
          <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  downloadWindowsNetworkPrinterScript(
                    networkIp || '192.168.1.200',
                    selectedPrinterName || 'Impressora Cupom Rede'
                  );
                }}
                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Gera um instalador .bat para configurar a porta de rede Standard TCP/IP no Windows"
              >
                <Download className="w-3.5 h-3.5 text-orange-600" />
                <span>Instalar Porta TCP/IP no Windows (.bat)</span>
              </button>

              <button
                type="button"
                onClick={downloadChromeKioskShortcut}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Baixa um atalho do Windows para abrir o sistema em modo direto sem diálogo de confirmação"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span>Atalho Sem Diálogo (--kiosk-printing)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-stone-600 hover:text-stone-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-orange-500" />
              <span>Como funciona a impressora por IP</span>
              {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      ) : (
        /* Conteúdo do Modo: Driver Windows / USB Local */
        <div className="bg-white/90 p-4 rounded-xl border border-orange-200 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <span>Impressora de Cupom Selecionada para Este Computador:</span>
                <span className="text-orange-600 font-bold font-mono">[{activePrinter.name}]</span>
              </label>

              {!isEditingCustom ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={selectedPrinterName}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsEditingCustom(true);
                      } else {
                        handleSavePrinterChoice(e.target.value);
                      }
                    }}
                    className="w-full sm:w-80 bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none cursor-pointer"
                  >
                    <optgroup label="Impressoras Cadastradas">
                      {configuredList.map((p: any) => (
                        <option key={p.id} value={p.name}>
                          {p.name} ({p.model || 'Térmica'})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Outras Opções">
                      <option value="custom">✏️ Digitar outro nome exato da impressora no Windows...</option>
                    </optgroup>
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsEditingCustom(true)}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Alterar Nome / Digitar Manual
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Elgin i9, EPSON TM-T20, Bematech..."
                    value={customPrinterInput}
                    onChange={(e) => setCustomPrinterInput(e.target.value)}
                    className="flex-1 max-w-md bg-stone-50 border border-orange-400 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 focus:ring-2 focus:ring-orange-500 outline-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSavePrinterChoice(customPrinterInput)}
                      disabled={isSaving || !customPrinterInput.trim()}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Salvar e Fixar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingCustom(false)}
                      className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle de Auto-Impressão */}
            <div className="shrink-0 p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-black text-stone-900 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  Impressão Automática
                </span>
                <span className="text-[10px] text-stone-500">Imprimir na hora ao chegar pedido</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoPrint}
                  onChange={(e) => handleToggleAutoPrint(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>
          </div>

          {/* Garantia Anti-Erro & Ações */}
          <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Opção Web Serial Direto */}
              {isWebSerialSupported() && (
                <button
                  type="button"
                  onClick={handleConnectSerial}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSerialConnected
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                  }`}
                  title="Conecta o cabo USB/Serial diretamente à impressora térmica, imprimindo sem abrir telas"
                >
                  <Usb className="w-3.5 h-3.5 text-stone-600" />
                  <span>{isSerialConnected ? 'Cabo USB Conectado (ESC/POS Direto)' : 'Conectar Cabo USB Direto'}</span>
                </button>
              )}

              {/* Download do Atalho Kiosk do Windows */}
              <button
                type="button"
                onClick={downloadChromeKioskShortcut}
                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Baixa um atalho pronto do Windows para abrir o sistema com impressão direta sem janela de diálogo"
              >
                <Download className="w-3.5 h-3.5 text-orange-600" />
                <span>Baixar Atalho Windows Sem Diálogo (--kiosk-printing)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-stone-600 hover:text-stone-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-orange-500" />
              <span>Como garantir que a operadora nunca erre a impressora</span>
              {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Guia Rápido Passo-a-Passo */}
      {showInstructions && (
        <div className="bg-white p-4 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-3 animate-in fade-in duration-200">
          <div className="font-bold text-stone-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-600" />
            <span>Vantagens e Como Configurar a Impressora de Rede por IP:</span>
          </div>

          <ol className="list-decimal pl-5 space-y-2 text-stone-600 leading-relaxed">
            <li>
              <strong>Mais Assertivo (Por IP):</strong> Com o IP definido (ex: <code>{networkIp}</code> na porta <code>{networkPort}</code>), os pedidos do site são enviados diretamente ao endereço fixo da impressora, eliminando qualquer risco da operadora se confundir com outras impressoras instaladas no computador.
            </li>
            <li>
              <strong>Porta Standard TCP/IP no Windows:</strong> Caso queira que o próprio Windows também imprima sempre nela, clique em <em>"Instalar Porta TCP/IP no Windows (.bat)"</em>. O script configura a porta de rede no Windows automaticamente.
            </li>
            <li>
              <strong>Aviso Visual no Cupom:</strong> O sistema coloca no cabeçalho do cupom impresso a identificação <code>🖨️ DESTINO: IMPRESSORA DE REDE ({networkIp}:{networkPort})</code>.
            </li>
            <li>
              <strong>Modo Sem Janelas (Kiosk Printing):</strong> Com a impressão automática ligada e o atalho Kiosk, ao chegar um novo pedido ele é impresso diretamente sem abrir caixas de diálogo na tela.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
};
