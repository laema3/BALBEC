import React from 'react';
import { 
  Printer, 
  Download, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Cpu, 
  DollarSign, 
  Calendar, 
  Building2, 
  Wrench,
  Server,
  HardDrive
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HardwareQuote() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 py-8 px-4 sm:px-6 lg:px-8 font-sans print:p-0 print:bg-white">
      {/* Top Action Bar (Hidden when printing/saving PDF) */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-stone-200 print:hidden">
        <div className="flex items-center gap-3">
          <Link 
            to="/admin" 
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <span className="text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1.5 rounded-full border border-stone-200">
            Orçamento de Equipamentos & Serviços
          </span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition transform active:scale-95 cursor-pointer"
        >
          <Printer className="w-4 h-4" /> Baixar PDF / Imprimir
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden print:shadow-none print:border-none print:rounded-none">
        
        {/* Header */}
        <div className="bg-stone-900 text-white p-8 border-b-4 border-emerald-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-emerald-400 font-black text-xs uppercase tracking-widest mb-1">
                Comprovante & Proposta de Fornecimento
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                ORÇAMENTO DE EQUIPAMENTOS & SERVIÇOS
              </h1>
              <p className="text-stone-400 text-xs mt-0.5">
                Infraestrutura de Rede, Armazenamento e Manutenção de PDV
              </p>
            </div>
            
            <div className="bg-stone-800 border border-stone-700 p-3 rounded-xl text-right sm:min-w-[170px]">
              <div className="text-[11px] text-stone-400">Orçamento Nº</div>
              <div className="text-sm font-black text-emerald-400 font-mono">ORC-2026-0889</div>
              <div className="text-[11px] text-stone-400 mt-1">Data: <span className="text-stone-200 font-semibold">{new Date().toLocaleDateString('pt-BR')}</span></div>
              <div className="text-[11px] text-stone-400">Validade: <span className="text-stone-200 font-semibold">10 dias</span></div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          
          {/* Customer & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200/80 text-xs">
            <div>
              <span className="font-bold text-stone-500 uppercase tracking-wider block mb-1">Cliente / Solicitante:</span>
              <p className="font-bold text-stone-900 text-sm">Pão Mania — Panificadora & Confeitaria</p>
              <p className="text-stone-600">Aos cuidados da Gestão / Caixa</p>
            </div>
            <div>
              <span className="font-bold text-stone-500 uppercase tracking-wider block mb-1">Condição de Pagamento:</span>
              <p className="font-bold text-stone-900 text-sm">À Vista (PIX / Transferência / Cartão)</p>
              <p className="text-stone-600">Equipamentos a pronta-entrega / instalados</p>
            </div>
          </div>

          {/* Table of Items */}
          <div>
            <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-600" /> Discriminação dos Produtos e Serviços
            </h2>

            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Item</th>
                    <th className="py-3 px-4">Descrição do Produto / Serviço</th>
                    <th className="py-3 px-3 text-center w-16">Qtd</th>
                    <th className="py-3 px-4 text-right w-28">Valor Unit.</th>
                    <th className="py-3 px-4 text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-stone-800">
                  
                  {/* Item 1 */}
                  <tr className="hover:bg-stone-50/50">
                    <td className="py-3.5 px-4 text-center font-bold text-stone-500">01</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        SWITCH 24 PORTAS GIGABIT 10/100/1000 TP-LINK
                      </div>
                      <div className="text-[11px] text-stone-600 mt-1 space-y-0.5">
                        <p>• Modelo: <strong>TL-SG1024D</strong></p>
                        <p className="font-mono bg-stone-100 inline-block px-1.5 py-0.5 rounded border border-stone-200 text-stone-800 font-bold">
                          N/S: V259027001533
                        </p>
                        <p className="text-stone-500">• 24 Portas RJ45 Gigabit de alta capacidade para automação comercial</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center font-semibold">1 un</td>
                    <td className="py-3.5 px-4 text-right font-medium text-stone-600">R$ 799,00</td>
                    <td className="py-3.5 px-4 text-right font-black text-stone-900">R$ 799,00</td>
                  </tr>

                  {/* Item 2 */}
                  <tr className="hover:bg-stone-50/50">
                    <td className="py-3.5 px-4 text-center font-bold text-stone-500">02</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        SSD 256GB SATA III ALTA VELOCIDADE
                      </div>
                      <div className="text-[11px] text-stone-600 mt-0.5">
                        • Unidade de estado sólido para agilização do sistema operacional e PDV
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center font-semibold">1 un</td>
                    <td className="py-3.5 px-4 text-right font-medium text-stone-600">R$ 289,00</td>
                    <td className="py-3.5 px-4 text-right font-black text-stone-900">R$ 289,00</td>
                  </tr>

                  {/* Item 3 */}
                  <tr className="hover:bg-stone-50/50 bg-stone-50/30">
                    <td className="py-3.5 px-4 text-center font-bold text-stone-500">03</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        MÃO DE OBRA ESPECIALIZADA (TERMINAL CAIXA / PDV)
                      </div>
                      <div className="text-[11px] text-stone-600 mt-0.5">
                        • Montagem física, fixação no rack/caixa, conexão de cabos de rede e testes
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center font-semibold">1 un</td>
                    <td className="py-3.5 px-4 text-right font-medium text-stone-600">R$ 80,00</td>
                    <td className="py-3.5 px-4 text-right font-black text-stone-900">R$ 80,00</td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal Produtos:</span>
                <span className="font-semibold">R$ 1.088,00</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Subtotal Serviços (Mão de Obra):</span>
                <span className="font-semibold">R$ 80,00</span>
              </div>
              <div className="pt-2 border-t border-stone-300 flex justify-between items-baseline">
                <span className="text-sm font-black text-stone-900">TOTAL GERAL:</span>
                <span className="text-xl font-black text-emerald-700">R$ 1.168,00</span>
              </div>
            </div>
          </div>

          {/* Warranty Terms */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-600 space-y-1.5">
            <h4 className="font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Termos de Garantia
            </h4>
            <p>• <strong>Switch TP-Link TL-SG1024D (N/S: V259027001533):</strong> Garantia legal e de fábrica contra defeitos de fabricação.</p>
            <p>• <strong>SSD 256GB:</strong> Garantia de 12 meses contra defeitos de hardware.</p>
            <p>• <strong>Serviço de Mão de Obra:</strong> Garantia de 90 dias sobre a instalação realizada.</p>
          </div>

          {/* Signatures */}
          <div className="pt-6 border-t border-stone-200 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-stone-300 w-44 mx-auto mb-2"></div>
              <p className="font-bold text-stone-800">Responsável Técnico / Fornecedor</p>
              <p className="text-[10px] text-stone-500">Suporte & Infraestrutura de TI</p>
            </div>
            <div>
              <div className="border-b border-stone-300 w-44 mx-auto mb-2"></div>
              <p className="font-bold text-stone-800">De Acordo do Cliente</p>
              <p className="text-[10px] text-stone-500">Pão Mania</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-stone-100 px-6 py-3 border-t border-stone-200 text-center text-[10px] text-stone-500">
          Documento gerado em {new Date().toLocaleDateString('pt-BR')} • Válido por 10 dias
        </div>

      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 1.2cm;
          }
        }
      `}</style>
    </div>
  );
}
