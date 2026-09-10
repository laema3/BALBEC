import { Express, Request, Response } from 'express';
import net from 'net';

/**
 * Envia um buffer de comandos ESC/POS diretamente para uma impressora térmica de rede
 * via socket TCP (padrão porta 9100 - Raw / JetDirect).
 */
export function sendRawToNetworkPrinter(
  ip: string,
  port: number = 9100,
  rawBuffer: Buffer,
  timeoutMs: number = 3500
): Promise<{ success: boolean; message: string; code?: string }> {
  return new Promise((resolve) => {
    const trimmedIp = (ip || '').trim();
    const targetPort = Number(port) || 9100;

    if (!trimmedIp) {
      return resolve({
        success: false,
        code: 'INVALID_IP',
        message: 'Endereço IP da impressora não informado.'
      });
    }

    const socket = new net.Socket();
    let isResolved = false;

    const cleanup = () => {
      try {
        if (!socket.destroyed) {
          socket.destroy();
        }
      } catch (e) {}
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      socket.write(rawBuffer, (err) => {
        if (err) {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve({
              success: false,
              code: 'WRITE_ERROR',
              message: `Erro ao enviar dados para a impressora (${trimmedIp}:${targetPort}): ${err.message}`
            });
          }
        } else {
          // Breve delay para garantir o descarregamento do buffer na controladora da impressora
          setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              resolve({
                success: true,
                message: `Comando enviado com sucesso para a impressora de rede (${trimmedIp}:${targetPort})!`
              });
            }
          }, 250);
        }
      });
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve({
          success: false,
          code: 'TIMEOUT',
          message: `Tempo limite esgotado (${timeoutMs}ms) ao tentar conectar em ${trimmedIp}:${targetPort}. Verifique se a impressora está ligada ao cabo de rede e com este IP configurado.`
        });
      }
    });

    socket.on('error', (err: any) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve({
          success: false,
          code: err.code || 'CONNECT_ERROR',
          message: `Falha na conexão com ${trimmedIp}:${targetPort}: ${err.message || 'Host inalcançável'}`
        });
      }
    });

    try {
      socket.connect(targetPort, trimmedIp);
    } catch (err: any) {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve({
          success: false,
          code: 'EXCEPTION',
          message: `Exceção ao conectar com ${trimmedIp}:${targetPort}: ${err.message}`
        });
      }
    }
  });
}

/**
 * Cria comandos ESC/POS básicos para cupom de teste de conexão de rede
 */
function buildTestEscPosBuffer(ip: string, port: number): Buffer {
  const lines: Buffer[] = [];

  // Reset
  lines.push(Buffer.from('\x1B\x40', 'ascii'));
  // Alinhamento centralizado
  lines.push(Buffer.from('\x1B\x61\x01', 'ascii'));
  // Negrito e altura dupla
  lines.push(Buffer.from('\x1B\x45\x01\x1D\x21\x11', 'ascii'));
  lines.push(Buffer.from('BALBEC SALGADOS\n', 'latin1'));
  // Tamanho normal
  lines.push(Buffer.from('\x1D\x21\x00\x1B\x45\x00', 'ascii'));
  lines.push(Buffer.from('*** TESTE DE IMPRESSORA DE REDE ***\n', 'latin1'));
  lines.push(Buffer.from('--------------------------------\n', 'ascii'));
  lines.push(Buffer.from(`IP DA IMPRESSORA: ${ip}\n`, 'latin1'));
  lines.push(Buffer.from(`PORTA RAW TCP: ${port}\n`, 'latin1'));
  lines.push(Buffer.from(`DATA/HORA: ${new Date().toLocaleString('pt-BR')}\n`, 'latin1'));
  lines.push(Buffer.from('STATUS: CONEXAO ESTABELECIDA COM SUCESSO!\n', 'latin1'));
  lines.push(Buffer.from('--------------------------------\n', 'ascii'));
  lines.push(Buffer.from('Esta impressora foi definida como padrao\npara emissao dos pedidos do site.\n', 'latin1'));
  lines.push(Buffer.from('\n\n\n', 'ascii'));
  // Corte parcial / total (GS V 66 0)
  lines.push(Buffer.from('\x1D\x56\x42\x00', 'ascii'));

  return Buffer.concat(lines);
}

export function setupPrinterRoutes(app: Express) {
  // Testar conexão direta com IP da impressora
  app.post('/api/printer/test-ip', async (req: Request, res: Response) => {
    try {
      const { ip, port } = req.body || {};
      const targetIp = (ip || '').trim();
      const targetPort = Number(port) || 9100;

      if (!targetIp) {
        return res.status(400).json({
          success: false,
          message: 'Por favor, informe o endereço IP da impressora de rede.'
        });
      }

      console.log(`[Printer Network] Testando conexão com ${targetIp}:${targetPort}...`);
      const testBuffer = buildTestEscPosBuffer(targetIp, targetPort);
      const result = await sendRawToNetworkPrinter(targetIp, targetPort, testBuffer, 4000);

      return res.json(result);
    } catch (err: any) {
      console.error('[Printer Network] Erro no teste de IP:', err);
      return res.status(500).json({
        success: false,
        message: err?.message || 'Erro interno ao tentar conectar na impressora'
      });
    }
  });

  // Imprimir pedido via Socket TCP na impressora de rede
  app.post('/api/printer/network-print', async (req: Request, res: Response) => {
    try {
      const { ip, port, escPosBase64 } = req.body || {};
      const targetIp = (ip || '').trim();
      const targetPort = Number(port) || 9100;

      if (!targetIp) {
        return res.status(400).json({
          success: false,
          message: 'Endereço IP da impressora de rede não fornecido.'
        });
      }

      if (!escPosBase64) {
        return res.status(400).json({
          success: false,
          message: 'Conteúdo ESC/POS em base64 não fornecido.'
        });
      }

      const buffer = Buffer.from(escPosBase64, 'base64');
      console.log(`[Printer Network] Enviando cupom (${buffer.length} bytes) para ${targetIp}:${targetPort}...`);
      const result = await sendRawToNetworkPrinter(targetIp, targetPort, buffer, 4000);

      return res.json(result);
    } catch (err: any) {
      console.error('[Printer Network] Erro ao imprimir via rede:', err);
      return res.status(500).json({
        success: false,
        message: err?.message || 'Erro ao comunicar com a impressora de rede'
      });
    }
  });
}
