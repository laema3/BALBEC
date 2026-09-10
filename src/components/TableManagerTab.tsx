import React, { useState, useEffect, useRef } from 'react';
import { 
  UtensilsCrossed, 
  QrCode, 
  Plus, 
  Printer, 
  Download, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Users, 
  Search, 
  Sparkles, 
  Copy, 
  Check, 
  Eye, 
  Layers,
  ShoppingBag,
  RefreshCw,
  X
} from 'lucide-react';
import QRCode from 'qrcode';
import { useStore, DiningTable, Order } from '../store/useStore';

interface TableManagerTabProps {
  orders: Order[];
}

export const TableManagerTab: React.FC<TableManagerTabProps> = ({ orders }) => {
  const { tables, addTable, addTablesBatch, updateTable, deleteTable, fetchTables, storeInfo } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<string, string>>({});
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [selectedTableForQr, setSelectedTableForQr] = useState<DiningTable | null>(null);
  const [showPrintAllModal, setShowPrintAllModal] = useState(false);

  // Form State para mesa individual
  const [formData, setFormData] = useState({
    number: 1,
    name: 'Mesa 01',
    section: 'Salão Principal',
    capacity: 4,
    status: 'available' as 'available' | 'occupied' | 'reserved',
    isActive: true,
  });

  // Form State para criação em lote
  const [batchData, setBatchData] = useState({
    startNumber: 1,
    endNumber: 10,
    section: 'Salão Principal',
    capacity: 4,
  });

  // Gerar QR codes para todas as mesas
  useEffect(() => {
    const generateQrs = async () => {
      const urls: Record<string, string> = {};
      const baseUrl = window.location.origin;

      for (const table of tables) {
        try {
          const tableOrderUrl = `${baseUrl}/?mesa=${table.number}&mode=instore`;
          const dataUrl = await QRCode.toDataURL(tableOrderUrl, {
            width: 512,
            margin: 2,
            color: {
              dark: '#1c1917',
              light: '#ffffff',
            },
            errorCorrectionLevel: 'H'
          });
          urls[table.id] = dataUrl;
        } catch (err) {
          console.error(`Erro ao gerar QR da mesa ${table.number}:`, err);
        }
      }
      setQrCodeDataUrls(urls);
    };

    if (tables.length > 0) {
      generateQrs();
    }
  }, [tables]);

  // Seções únicas
  const sections = ['all', ...Array.from(new Set(tables.map(t => t.section || 'Salão Principal').filter(Boolean)))];

  // Mesas filtradas
  const filteredTables = tables.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      String(t.number).includes(searchQuery) ||
      (t.section && t.section.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSection = selectedSection === 'all' || (t.section || 'Salão Principal') === selectedSection;
    return matchesSearch && matchesSection;
  });

  // Estatísticas
  const totalTables = tables.length;
  const activeTables = tables.filter(t => t.isActive).length;
  
  // Pedidos ativos por mesa
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const getTableActiveOrders = (tableNumber: number) => {
    return activeOrders.filter(o => String(o.tableNumber) === String(tableNumber) || o.tableId === `table-${tableNumber}`);
  };

  const occupiedCount = tables.filter(t => getTableActiveOrders(t.number).length > 0 || t.status === 'occupied').length;

  const handleOpenAdd = () => {
    const nextNum = tables.length > 0 ? Math.max(...tables.map(t => t.number || 0)) + 1 : 1;
    setFormData({
      number: nextNum,
      name: `Mesa ${String(nextNum).padStart(2, '0')}`,
      section: 'Salão Principal',
      capacity: 4,
      status: 'available',
      isActive: true,
    });
    setEditingTable(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (table: DiningTable) => {
    setEditingTable(table);
    setFormData({
      number: table.number,
      name: table.name,
      section: table.section || 'Salão Principal',
      capacity: table.capacity || 4,
      status: table.status || 'available',
      isActive: table.isActive !== false,
    });
    setShowAddModal(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTable) {
      await updateTable(editingTable.id, formData);
    } else {
      await addTable(formData);
    }
    setShowAddModal(false);
    setEditingTable(null);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = Math.min(batchData.startNumber, batchData.endNumber);
    const end = Math.max(batchData.startNumber, batchData.endNumber);
    const newBatch = [];

    for (let num = start; num <= end; num++) {
      newBatch.push({
        number: num,
        name: `Mesa ${String(num).padStart(2, '0')}`,
        section: batchData.section,
        capacity: batchData.capacity,
        status: 'available' as const,
        isActive: true,
      });
    }

    await addTablesBatch(newBatch);
    setShowBatchModal(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir a ${name}?`)) {
      await deleteTable(id);
    }
  };

  const copyTableLink = (tableNumber: number, tableId: string) => {
    const url = `${window.location.origin}/?mesa=${tableNumber}&mode=instore`;
    navigator.clipboard.writeText(url);
    setCopiedTableId(tableId);
    setTimeout(() => setCopiedTableId(null), 2500);
  };

  const downloadQrCode = (table: DiningTable) => {
    const dataUrl = qrCodeDataUrls[table.id];
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QRCode_${table.name.replace(/\s+/g, '_')}_PaoMania.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintSingle = (table: DiningTable) => {
    setSelectedTableForQr(table);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Header com Ações e Estatísticas */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-stone-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-stone-900 flex items-center gap-2">
                  Controle de Mesas & QR Codes
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold border border-orange-200">
                    Consumo na Loja
                  </span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Cadastre as mesas do estabelecimento e imprima QR Codes exclusivos para identificar pedidos no salão.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-stone-300"
              title="Gerar várias mesas sequenciais automaticamente"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Gerar em Lote</span>
            </button>

            <button
              onClick={() => setShowPrintAllModal(true)}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-stone-300"
              title="Imprimir todas as placas de mesa em lote"
            >
              <Printer className="w-4 h-4 text-stone-700" />
              <span>Imprimir Placas</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Mesa</span>
            </button>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200/80">
            <span className="text-xs font-semibold text-stone-500 block">Total de Mesas</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-stone-800">{totalTables}</span>
              <span className="text-[11px] text-stone-400">cadastradas</span>
            </div>
          </div>

          <div className="bg-emerald-50/70 rounded-xl p-3.5 border border-emerald-200/80">
            <span className="text-xs font-semibold text-emerald-800 block">Mesas Livres</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-700">{Math.max(0, activeTables - occupiedCount)}</span>
              <span className="text-[11px] text-emerald-600">disponíveis</span>
            </div>
          </div>

          <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200/80">
            <span className="text-xs font-semibold text-amber-800 block">Mesas com Pedido</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-700">{occupiedCount}</span>
              <span className="text-[11px] text-amber-600">em atendimento</span>
            </div>
          </div>

          <div className="bg-blue-50/70 rounded-xl p-3.5 border border-blue-200/80">
            <span className="text-xs font-semibold text-blue-800 block">QR Codes Ativos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-blue-700">{activeTables}</span>
              <span className="text-[11px] text-blue-600">gerados</span>
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-5 border-t border-stone-200">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por número ou setor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {sections.map(sec => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedSection === sec
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                }`}
              >
                {sec === 'all' ? 'Todas as Seções' : sec}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Mesas */}
      {filteredTables.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 shadow-sm">
          <UtensilsCrossed className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-800">Nenhuma mesa encontrada</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 mb-5">
            {searchQuery ? 'Nenhuma mesa corresponde aos termos pesquisados.' : 'Cadastre sua primeira mesa ou utilize a criação em lote para começar.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Primeira Mesa</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTables.map((table) => {
            const qrDataUrl = qrCodeDataUrls[table.id];
            const tableOrders = getTableActiveOrders(table.number);
            const isOccupied = tableOrders.length > 0 || table.status === 'occupied';

            return (
              <div 
                key={table.id}
                className={`bg-white rounded-2xl p-4 border transition-all duration-200 relative flex flex-col justify-between ${
                  isOccupied
                    ? 'border-amber-400 bg-amber-50/20 shadow-md ring-1 ring-amber-400/40'
                    : table.isActive 
                      ? 'border-stone-200 hover:border-orange-300 shadow-sm hover:shadow-md' 
                      : 'border-stone-200 bg-stone-50/60 opacity-70'
                }`}
              >
                <div>
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-stone-900">{table.name}</span>
                        {isOccupied ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                            Ocupada ({tableOrders.length} {tableOrders.length === 1 ? 'pedido' : 'pedidos'})
                          </span>
                        ) : table.isActive ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Livre
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                            Inativa
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                        <span>{table.section || 'Salão'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-stone-400" />
                          {table.capacity || 4} lugares
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(table)}
                        className="p-1.5 hover:bg-stone-100 text-stone-500 hover:text-stone-800 rounded-lg transition-colors cursor-pointer"
                        title="Editar mesa"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(table.id, table.name)}
                        className="p-1.5 hover:bg-red-50 text-stone-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                        title="Excluir mesa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* QR Code Preview e Link */}
                  <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 flex items-center gap-3 my-2">
                    <div className="w-20 h-20 bg-white rounded-lg p-1 border border-stone-200 shadow-xs flex items-center justify-center shrink-0">
                      {qrDataUrl ? (
                        <img 
                          src={qrDataUrl} 
                          alt={`QR Code ${table.name}`} 
                          className="w-full h-full object-contain cursor-pointer"
                          onClick={() => setSelectedTableForQr(table)}
                        />
                      ) : (
                        <QrCode className="w-8 h-8 text-stone-300 animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-bold text-stone-700 block">QR Code da Mesa</span>
                      <p className="text-[10px] text-stone-500 line-clamp-2 mt-0.5 leading-tight">
                        Abre o cardápio com a {table.name} já identificada.
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => copyTableLink(table.number, table.id)}
                          className="text-[11px] font-bold px-2 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Copiar link da mesa"
                        >
                          {copiedTableId === table.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-stone-500" />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </button>
                        <a
                          href={`/?mesa=${table.number}&mode=instore`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-white text-stone-500 hover:text-stone-800 rounded-md border border-transparent hover:border-stone-200 transition-colors"
                          title="Testar em nova aba"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Pedidos em andamento nesta mesa */}
                  {tableOrders.length > 0 && (
                    <div className="mt-2.5 p-2.5 bg-amber-100/60 rounded-xl border border-amber-300/80 space-y-1.5">
                      <span className="text-[11px] font-extrabold text-amber-900 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3 text-amber-700" />
                        Pedidos Ativos:
                      </span>
                      {tableOrders.map(ord => (
                        <div key={ord.id} className="flex items-center justify-between text-[11px] bg-white/80 px-2 py-1 rounded-md border border-amber-200">
                          <span className="font-bold text-stone-800">#{String(ord.id).slice(-4).padStart(4, '0')}</span>
                          <span className="text-stone-600 truncate max-w-[110px]">{ord.customerName || 'Cliente'}</span>
                          <span className="font-black text-amber-700">R$ {Number(ord.total || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botões de Ação do Card */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-stone-100">
                  <button
                    onClick={() => setSelectedTableForQr(table)}
                    className="py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-stone-600" />
                    <span>Ver Placa</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedTableForQr(table);
                      setTimeout(() => window.print(), 300);
                    }}
                    className="py-1.5 px-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer border border-orange-200"
                  >
                    <Printer className="w-3.5 h-3.5 text-orange-600" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Adicionar / Editar Mesa */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-stone-900">
                  {editingTable ? 'Editar Mesa' : 'Cadastrar Nova Mesa'}
                </h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Número</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.number}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 1;
                      setFormData({
                        ...formData,
                        number: val,
                        name: `Mesa ${String(val).padStart(2, '0')}`
                      });
                    }}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">Nome de Exibição</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Mesa 01, Varanda 04"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Setor / Área</label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="Salão Principal, Varanda..."
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Capacidade (Pessoas)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 4 })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-stone-700">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-orange-600 rounded-md border-stone-300 focus:ring-orange-500"
                  />
                  <span>Mesa Ativa para Pedidos</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {editingTable ? 'Salvar Alterações' : 'Cadastrar Mesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criação em Lote */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">Gerar Mesas em Lote</h3>
                  <p className="text-[11px] text-stone-500">Crie várias mesas sequenciais de uma vez só.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBatchModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Da Mesa Nº</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={batchData.startNumber}
                    onChange={(e) => setBatchData({ ...batchData, startNumber: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Até a Mesa Nº</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={batchData.endNumber}
                    onChange={(e) => setBatchData({ ...batchData, endNumber: parseInt(e.target.value, 10) || 10 })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Setor</label>
                  <input
                    type="text"
                    value={batchData.section}
                    onChange={(e) => setBatchData({ ...batchData, section: e.target.value })}
                    placeholder="Ex: Salão Principal"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Capacidade Padrão</label>
                  <input
                    type="number"
                    min="1"
                    value={batchData.capacity}
                    onChange={(e) => setBatchData({ ...batchData, capacity: parseInt(e.target.value, 10) || 4 })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                💡 Serão criadas ou atualizadas <strong>{Math.abs(batchData.endNumber - batchData.startNumber) + 1} mesas</strong> com QR Codes exclusivos prontos para uso.
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  Gerar Mesas Agora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Visualizar Plaquinha de Mesa Individual */}
      {selectedTableForQr && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <h3 className="text-base font-black text-stone-900">
                Placa Display: {selectedTableForQr.name}
              </h3>
              <button 
                onClick={() => setSelectedTableForQr(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plaquinha Estilizada Pronta para Impressão */}
            <div 
              id="table-display-card"
              className="my-4 p-6 bg-gradient-to-b from-amber-500/10 via-white to-amber-500/5 rounded-2xl border-2 border-amber-400 text-center shadow-inner relative overflow-hidden"
            >
              <div className="inline-block px-3 py-1 bg-stone-900 text-white rounded-full text-[11px] font-black uppercase tracking-wider mb-2">
                {storeInfo.name || 'Pão Mania'}
              </div>

              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                {selectedTableForQr.name.toUpperCase()}
              </h2>
              <p className="text-xs font-semibold text-amber-800 mb-4">
                Consumo no Local • Atendimento na Mesa
              </p>

              <div className="w-48 h-48 mx-auto bg-white p-2.5 rounded-2xl border-2 border-stone-800 shadow-md flex items-center justify-center">
                {qrCodeDataUrls[selectedTableForQr.id] ? (
                  <img 
                    src={qrCodeDataUrls[selectedTableForQr.id]} 
                    alt={`QR Code ${selectedTableForQr.name}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <QrCode className="w-16 h-16 text-stone-300 animate-pulse" />
                )}
              </div>

              <p className="text-xs font-bold text-stone-800 mt-4">
                📱 Aponte a câmera do seu celular
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Faça seu pedido diretamente pelo cardápio digital e receba aqui nesta mesa!
              </p>

              <div className="mt-3 pt-3 border-t border-amber-200/60 text-[10px] text-stone-400 flex items-center justify-center gap-2">
                <span>{selectedTableForQr.section || 'Salão Principal'}</span>
                <span>•</span>
                <span>Pão Mania Cardápio</span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => downloadQrCode(selectedTableForQr)}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar PNG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Placa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Imprimir Todas as Placas de Mesa em Folha A4 */}
      {showPrintAllModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full shadow-2xl border border-stone-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-black text-stone-900">
                  Impressão de Plaquinhas de Mesa ({tables.length} mesas)
                </h3>
              </div>
              <button 
                onClick={() => setShowPrintAllModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <p className="text-xs text-stone-600">
                Visualização do painel de placas prontas para impressão e recorte para displays de mesa acrílicos:
              </p>

              <div className="grid grid-cols-2 gap-4">
                {tables.map(table => (
                  <div 
                    key={table.id}
                    className="p-4 bg-white rounded-2xl border-2 border-stone-800 text-center shadow-xs"
                  >
                    <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">
                      {storeInfo.name || 'Pão Mania'}
                    </span>
                    <h4 className="text-lg font-black text-stone-900 mt-0.5">{table.name.toUpperCase()}</h4>
                    <span className="text-[10px] text-stone-500">{table.section || 'Salão'}</span>

                    <div className="w-28 h-28 mx-auto my-2 p-1 bg-white border border-stone-300 rounded-xl flex items-center justify-center">
                      {qrCodeDataUrls[table.id] ? (
                        <img 
                          src={qrCodeDataUrls[table.id]} 
                          alt={`QR ${table.name}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-8 h-8 text-stone-300" />
                      )}
                    </div>

                    <p className="text-[10px] font-bold text-stone-800">📱 Aponte a câmera do celular</p>
                    <p className="text-[9px] text-stone-500">Faça seu pedido diretamente na mesa</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowPrintAllModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Folhas de Mesas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
