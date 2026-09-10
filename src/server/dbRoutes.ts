import { Express, Request, Response } from 'express';
import { db, pool, ensureTablesExist, isDatabaseConfigured, getDatabaseUrl, testDatabaseConnection } from '../db/index.ts';
import { categories, products, orders, storeInfo, users, tvMedia, appInstalls, customers, restaurantTables } from '../db/schema.ts';
import { eq, desc, asc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { registerAiRoutes } from './aiAssistant';
import { cleanProductDescription } from '../constants';

// Initial default data for auto-seeding & in-memory fallback
const DEFAULT_CATEGORIES: any[] = [];

const DEFAULT_PRODUCTS: any[] = [];

const DEFAULT_STORE_INFO = {
  id: 'default',
  name: 'BALBEC SALGADOS',
  themeColor: '#e6a800',
  addButtonColor: '#e6a800',
  iconColor: '#e6a800',
  headerPhrase: 'Os melhores salgados e lanches da região!',
  logoUrl: '/logo.svg',
  address: '',
  hours: 'Segunda a Sábado: 08:00 às 19:00',
  instagram: '@balbecsalgados',
  whatsapp: '',
  categoryTitleColor: '#dc2626',
  deliveryEnabled: true,
  inStoreEnabled: true,
  kioskEnabled: true,
  isOpen: true,
  ntfyTopic: 'balbec_pedidos',
  tvTickerText: '🥟 Salgados quentinhos e crocantes saindo a toda hora! Experimente nossos combos especiais. Peça pelo app ou no balcão!',
  tvMode: 'split_menu',
  tvSelectedCategories: '[]',
  tvSoundEnabled: false,
  tvShowClock: true,
  tvShowCaptions: false,
  isMaintenance: false,
  maintenanceMessage: 'Estamos atualizando nosso cardápio e sistemas para melhor atendê-lo. Voltaremos em breve!',
  weeklySchedule: JSON.stringify([
    { dayOfWeek: 0, dayName: 'Domingo', shortName: 'Dom', isOpen: false, openTime: '08:00', closeTime: '14:00' },
    { dayOfWeek: 1, dayName: 'Segunda-feira', shortName: 'Seg', isOpen: true, openTime: '08:00', closeTime: '19:00' },
    { dayOfWeek: 2, dayName: 'Terça-feira', shortName: 'Ter', isOpen: true, openTime: '08:00', closeTime: '19:00' },
    { dayOfWeek: 3, dayName: 'Quarta-feira', shortName: 'Qua', isOpen: true, openTime: '08:00', closeTime: '19:00' },
    { dayOfWeek: 4, dayName: 'Quinta-feira', shortName: 'Qui', isOpen: true, openTime: '08:00', closeTime: '19:00' },
    { dayOfWeek: 5, dayName: 'Sexta-feira', shortName: 'Sex', isOpen: true, openTime: '08:00', closeTime: '19:00' },
    { dayOfWeek: 6, dayName: 'Sábado', shortName: 'Sáb', isOpen: true, openTime: '08:00', closeTime: '19:00' },
  ]),
  autoOpenClose: false,
  forceOpen: false,
  closedMessage: 'Estamos fechados no momento. Confira nossos horários de atendimento!',
  aiAgentEnabled: false,
  aiAgentName: 'Atendente Virtual',
  aiAgentTone: 'amigavel',
  aiAgentCustomPrompt: 'Salgados fritos e assados fresquinhos todos os dias.',
  aiAgentWhatsAppPhone: '',
  aiAgentWhatsAppDefaultMessage: 'Olá! Vim pelo cardápio digital da BALBEC SALGADOS e gostaria de fazer um pedido.',
  aiAgentTrainingExamples: '[]',
  aiAgentKnowledgeBase: '• Salgados fritos e assados preparados diariamente.\n• Encomendas para festas e eventos com antecedência.\n• Pagamentos em PIX, cartões e dinheiro.',
  aiAgentForbiddenPhrases: 'Não prometa fiado ou cheque; Não invente produtos que não estejam no cardápio.',
  aiAgentCreativity: 0.65,
  aiAgentAntiRepeat: true,
  inStoreGpsValidation: false,
  inStoreLatitude: 0,
  inStoreLongitude: 0,
  inStoreMaxRadiusMeters: 150,
  inStorePinValidation: false,
  inStorePinCode: '1234',
  preferredPrinterName: 'Impressora Térmica 80mm',
  printerCutMode: 'partial',
  printerCopies: 1,
  configuredPrinters: '[]',
  caixaPrinterName: '',
  autoPrintOrdersOnCaixa: false,
  printerConnectionType: 'windows',
  networkPrinterIp: '',
  networkPrinterPort: 9100
};

const STORE_INFO_FILE = path.join(process.cwd(), '.store_info_data.json');
const TV_MEDIA_FILE = path.join(process.cwd(), '.tv_media_data.json');
const CATEGORIES_FILE = path.join(process.cwd(), '.categories_data.json');
const PRODUCTS_FILE = path.join(process.cwd(), '.products_data.json');
const USERS_FILE = path.join(process.cwd(), '.users_data.json');
const ORDERS_FILE = path.join(process.cwd(), '.orders_data.json');
const CUSTOMERS_FILE = path.join(process.cwd(), '.customers_data.json');
const TABLES_FILE = path.join(process.cwd(), '.tables_data.json');
const APP_INSTALLS_FILE = path.join(process.cwd(), '.app_installs_data.json');
const MASTER_STATE_FILE = path.join(process.cwd(), '.app_persistent_state.json');

const DEFAULT_USERS = [
  { id: 1, uid: 'master-1', email: 'camillasites@gmail.com', name: 'Camilla (Master)', role: 'master', password: 'admin' },
  { id: 2, uid: 'admin-1', email: 'admin@balbecsalgados.com.br', name: 'Administrador Balbec', role: 'admin', password: 'admin' },
  { id: 3, uid: 'caixa-1', email: 'caixa@balbecsalgados.com.br', name: 'Operadora do Caixa', role: 'padrao', password: '123' },
];

const DEFAULT_TABLES = [
  { id: 'table-1', number: 1, name: 'Mesa 01', section: 'Salão Principal', capacity: 4, status: 'available', isActive: true, createdAt: Date.now() },
  { id: 'table-2', number: 2, name: 'Mesa 02', section: 'Salão Principal', capacity: 4, status: 'available', isActive: true, createdAt: Date.now() },
  { id: 'table-3', number: 3, name: 'Mesa 03', section: 'Salão Principal', capacity: 4, status: 'available', isActive: true, createdAt: Date.now() },
  { id: 'table-4', number: 4, name: 'Mesa 04', section: 'Salão Principal', capacity: 2, status: 'available', isActive: true, createdAt: Date.now() },
  { id: 'table-5', number: 5, name: 'Mesa 05', section: 'Salão Principal', capacity: 6, status: 'available', isActive: true, createdAt: Date.now() },
  { id: 'table-6', number: 6, name: 'Mesa 06', section: 'Varanda Externa', capacity: 4, status: 'available', isActive: true, createdAt: Date.now() },
  { id: 'table-7', number: 7, name: 'Mesa 07', section: 'Varanda Externa', capacity: 4, status: 'available', isActive: true, createdAt: Date.now() },
  { id: 'table-8', number: 8, name: 'Mesa 08', section: 'Varanda Externa', capacity: 4, status: 'available', isActive: true, createdAt: Date.now() },
];

// In-memory runtime state (serves local preview & instant fallback)
let memCategories: any[] = [...DEFAULT_CATEGORIES];
let memProducts: any[] = [...DEFAULT_PRODUCTS];
let memOrders: any[] = [];
let memStoreInfo: any = { ...DEFAULT_STORE_INFO };
let memCustomers: any[] = [];
let memUsers: any[] = [...DEFAULT_USERS];
let memTvMedia: any[] = [];
let memAppInstalls: any[] = [];
let memTables: any[] = [...DEFAULT_TABLES];

// Helper functions for safe disk persistence
function loadJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed !== undefined && parsed !== null) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`Aviso: Não foi possível ler ${path.basename(filePath)}:`, e);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn(`Aviso: Não foi possível gravar ${path.basename(filePath)}:`, e);
  }
}

function persistAllStateToMasterFile() {
  const masterPayload = {
    storeInfo: memStoreInfo,
    tvMedia: memTvMedia,
    categories: memCategories,
    products: memProducts,
    users: memUsers,
    tables: memTables,
    customers: memCustomers,
    orders: memOrders,
    savedAt: new Date().toISOString()
  };
  writeJsonFile(MASTER_STATE_FILE, masterPayload);
}

// 1. Carregar Estado Inicial de Todos os Arquivos Persistidos
try {
  const masterState = loadJsonFile<any>(MASTER_STATE_FILE, null);

  memCategories = loadJsonFile(CATEGORIES_FILE, masterState?.categories || DEFAULT_CATEGORIES);
  memProducts = loadJsonFile(PRODUCTS_FILE, masterState?.products || DEFAULT_PRODUCTS);
  memTvMedia = loadJsonFile(TV_MEDIA_FILE, masterState?.tvMedia || []);
  memStoreInfo = { ...DEFAULT_STORE_INFO, ...(masterState?.storeInfo || {}), ...loadJsonFile(STORE_INFO_FILE, {}) };
  memOrders = loadJsonFile(ORDERS_FILE, masterState?.orders || []);
  memCustomers = loadJsonFile(CUSTOMERS_FILE, masterState?.customers || []).filter((c: any) => c.source !== 'pedido_totem' && c.source !== 'totem' && (c.name || '').toLowerCase() !== 'cliente totem');
  memUsers = loadJsonFile(USERS_FILE, masterState?.users || DEFAULT_USERS);
  memTables = loadJsonFile(TABLES_FILE, masterState?.tables || DEFAULT_TABLES);
  memAppInstalls = loadJsonFile(APP_INSTALLS_FILE, []);
} catch (e) {
  console.warn('Aviso: Falha na inicialização dos dados persistidos:', e);
}

function persistCategoriesToDisk(data: any[]) {
  writeJsonFile(CATEGORIES_FILE, data);
  persistAllStateToMasterFile();
}

function persistProductsToDisk(data: any[]) {
  writeJsonFile(PRODUCTS_FILE, data);
  persistAllStateToMasterFile();
}

function persistTvMediaToDisk(data: any[]) {
  writeJsonFile(TV_MEDIA_FILE, data);
  persistAllStateToMasterFile();
}

function persistUsersToDisk(data: any[]) {
  writeJsonFile(USERS_FILE, data);
  persistAllStateToMasterFile();
}

function persistOrdersToDisk(data: any[]) {
  writeJsonFile(ORDERS_FILE, data);
  persistAllStateToMasterFile();
}

function persistStoreInfoToDisk(data: any) {
  writeJsonFile(STORE_INFO_FILE, data);
  persistAllStateToMasterFile();
}

function persistCustomersToDisk(data: any[]) {
  writeJsonFile(CUSTOMERS_FILE, data);
  persistAllStateToMasterFile();
}

function persistTablesToDisk(data: any[]) {
  writeJsonFile(TABLES_FILE, data);
  persistAllStateToMasterFile();
}

function persistAppInstallsToDisk(data: any[]) {
  writeJsonFile(APP_INSTALLS_FILE, data);
}

function calculateNextOrderNumber(currentOrders: any[] = []): string {
  const usedNumbers = new Set<number>();
  let maxNum = 0;
  currentOrders.forEach(o => {
    if (!o || !o.id) return;
    const digits = String(o.id).replace(/\D/g, '');
    if (digits) {
      const num = parseInt(digits, 10);
      if (!isNaN(num) && num >= 1 && num <= 99999) {
        usedNumbers.add(num);
        if (num > maxNum) maxNum = num;
      }
    }
  });
  let candidate = maxNum + 1;
  if (candidate > 99999) {
    candidate = 1;
    while (usedNumbers.has(candidate)) {
      candidate++;
    }
  }
  return String(candidate).padStart(4, '0');
}

export function getMemStoreInfo() {
  return memStoreInfo || DEFAULT_STORE_INFO;
}

/**
 * Hidrata o estado em memória diretamente do PostgreSQL ao inicializar o servidor.
 * Garante que em ambientes com disco efêmero (como Render e contêineres),
 * configurações cruciais (horários, status de loja, totem, delivery e agente IA)
 * NUNCA sejam perdidas ao subir novas versões.
 */
export async function hydrateFromPostgres(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('[DB Hydrate] Banco de dados não configurado, mantendo estado do disco/memória.');
    return;
  }

  try {
    console.log('[DB Hydrate] Hidratando estado da loja e cadastros diretamente do PostgreSQL...');
    
    // 1. Hidratar Store Info
    try {
      const storeList = await db.select().from(storeInfo).where(eq(storeInfo.id, 'default'));
      if (storeList.length > 0) {
        const dbRow = storeList[0];
        // Merge order: Default templates -> Local memory -> PostgreSQL database row (authoritative source of truth)
        const merged: any = { ...DEFAULT_STORE_INFO, ...memStoreInfo, ...dbRow };
        for (const [key, val] of Object.entries(dbRow)) {
          if (val !== null && val !== undefined) {
            merged[key] = val;
          }
        }
        memStoreInfo = merged;
        persistStoreInfoToDisk(memStoreInfo);
        console.log(`[DB Hydrate] StoreInfo carregada com sucesso do PostgreSQL: "${memStoreInfo.name}" (Aberta: ${memStoreInfo.isOpen}, Agente IA: ${memStoreInfo.aiAgentEnabled})`);
      } else {
        // Se a linha 'default' ainda não existe no Postgres, salva o estado atual
        await db.insert(storeInfo).values({ ...DEFAULT_STORE_INFO, ...memStoreInfo, id: 'default' }).onConflictDoNothing();
        console.log('[DB Hydrate] Criada linha default em store_info no PostgreSQL.');
      }
    } catch (storeErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar store_info do PostgreSQL:', storeErr?.message || storeErr);
    }

    // 2. Hidratar Categorias
    try {
      const catList = await db.select().from(categories);
      if (catList.length > 0) {
        memCategories = catList.sort((a, b) => (a.order || 0) - (b.order || 0));
        persistCategoriesToDisk(memCategories);
        console.log(`[DB Hydrate] ${memCategories.length} categorias carregadas do PostgreSQL.`);
      }
    } catch (catErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar categories do PostgreSQL:', catErr?.message || catErr);
    }

    // 3. Hidratar Produtos
    try {
      const prodList = await db.select().from(products);
      if (prodList.length > 0) {
        memProducts = prodList;
        persistProductsToDisk(memProducts);
        console.log(`[DB Hydrate] ${memProducts.length} produtos carregados do PostgreSQL.`);
      }
    } catch (prodErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar products do PostgreSQL:', prodErr?.message || prodErr);
    }

    // 4. Hidratar Mesas
    try {
      const tableList = await db.select().from(restaurantTables);
      if (tableList.length > 0) {
        memTables = tableList;
        persistTablesToDisk(memTables);
        console.log(`[DB Hydrate] ${memTables.length} mesas carregadas do PostgreSQL.`);
      }
    } catch (tblErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar restaurant_tables do PostgreSQL:', tblErr?.message || tblErr);
    }

    // 5. Hidratar TV Media
    try {
      const tvList = await db.select().from(tvMedia);
      if (tvList.length > 0) {
        memTvMedia = tvList.sort((a, b) => (a.order || 0) - (b.order || 0));
        persistTvMediaToDisk(memTvMedia);
        console.log(`[DB Hydrate] ${memTvMedia.length} mídias de TV carregadas do PostgreSQL.`);
      }
    } catch (tvErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar tv_media do PostgreSQL:', tvErr?.message || tvErr);
    }

    // Persiste o snapshot mestre atualizado em disco
    persistAllStateToMasterFile();
    console.log('[DB Hydrate] Hidratação do PostgreSQL concluída com sucesso!');
  } catch (globalHydrateErr: any) {
    console.error('[DB Hydrate] Erro durante hidratação inicial do PostgreSQL:', globalHydrateErr);
  }
}

export function cleanPhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

export async function upsertCustomerLead(leadData: {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  source?: string;
  orderTotal?: number;
  isOrder?: boolean;
  tags?: string[];
  notes?: string;
}) {
  // REGRA DE NEGÓCIO: Pedidos feitos pelo totem NÃO viram leads no sistema
  if (leadData.source === 'pedido_totem' || leadData.source === 'totem' || leadData.source === 'kiosk') {
    return null;
  }

  const rawName = (leadData.name || '').trim();
  const phone = (leadData.phone || '').trim();
  const digits = cleanPhoneDigits(phone);
  
  if (!rawName && !digits) return null;
  if (rawName.toLowerCase() === 'cliente totem') return null;

  const now = Date.now();
  const cleanName = rawName || (digits ? `Cliente (${digits.slice(-4)})` : 'Cliente');

  // Buscar cliente existente por telefone ou nome
  let existingIndex = -1;
  if (digits && digits.length >= 8) {
    existingIndex = memCustomers.findIndex(c => {
      const cDigits = cleanPhoneDigits(c.phone || '');
      return cDigits && (cDigits === digits || cDigits.endsWith(digits) || digits.endsWith(cDigits));
    });
  }
  
  if (existingIndex === -1 && cleanName && cleanName.toLowerCase() !== 'cliente') {
    existingIndex = memCustomers.findIndex(c => 
      (c.name || '').trim().toLowerCase() === cleanName.toLowerCase() && 
      (!digits || !c.phone || cleanPhoneDigits(c.phone) === digits)
    );
  }

  let customerRecord: any;

  if (existingIndex >= 0) {
    const existing = memCustomers[existingIndex];
    let parsedTags: string[] = [];
    try {
      parsedTags = Array.isArray(existing.tags) 
        ? existing.tags 
        : typeof existing.tags === 'string' 
        ? JSON.parse(existing.tags || '[]') 
        : [];
    } catch {
      parsedTags = [];
    }

    if (leadData.tags && Array.isArray(leadData.tags)) {
      leadData.tags.forEach(t => {
        if (t && !parsedTags.includes(t)) parsedTags.push(t);
      });
    }

    if (leadData.isOrder) {
      if (!parsedTags.includes('Cliente')) parsedTags.push('Cliente');
      if (leadData.source === 'pedido_delivery' && !parsedTags.includes('Delivery')) parsedTags.push('Delivery');
    } else {
      if (!parsedTags.includes('Lead')) parsedTags.push('Lead');
    }

    const updatedTotalOrders = Number(existing.totalOrders || 0) + (leadData.isOrder ? 1 : 0);
    if (updatedTotalOrders >= 2 && !parsedTags.includes('Recorrente')) {
      parsedTags.push('Recorrente');
    }

    customerRecord = {
      ...existing,
      name: (cleanName && cleanName.toLowerCase() !== 'cliente') ? cleanName : existing.name,
      phone: phone || existing.phone,
      email: leadData.email || existing.email || '',
      address: leadData.address || existing.address || '',
      source: existing.source || leadData.source || 'cadastro_cardapio',
      totalOrders: updatedTotalOrders,
      totalSpent: Number(existing.totalSpent || 0) + (Number(leadData.orderTotal) || 0),
      lastOrderAt: leadData.isOrder ? now : (existing.lastOrderAt || null),
      tags: JSON.stringify(parsedTags),
      notes: leadData.notes !== undefined ? leadData.notes : (existing.notes || ''),
    };

    memCustomers[existingIndex] = customerRecord;
  } else {
    const initialTags: string[] = leadData.tags ? [...leadData.tags] : [];
    if (leadData.isOrder) {
      initialTags.push('Cliente');
      if (leadData.source === 'pedido_delivery') initialTags.push('Delivery');
    } else {
      initialTags.push('Lead');
    }

    customerRecord = {
      id: `cust_${now}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      phone: phone || '',
      email: leadData.email || '',
      address: leadData.address || '',
      source: leadData.source || 'cadastro_cardapio',
      totalOrders: leadData.isOrder ? 1 : 0,
      totalSpent: Number(leadData.orderTotal) || 0,
      lastOrderAt: leadData.isOrder ? now : null,
      createdAt: now,
      tags: JSON.stringify(initialTags),
      notes: leadData.notes || '',
    };

    memCustomers.unshift(customerRecord);
  }

  persistCustomersToDisk(memCustomers);

  if (isDatabaseConfigured()) {
    try {
      const payload = {
        ...customerRecord,
        tags: typeof customerRecord.tags === 'string' ? customerRecord.tags : JSON.stringify(customerRecord.tags || [])
      };
      await db.insert(customers).values(payload).onConflictDoUpdate({
        target: customers.id,
        set: payload
      });
    } catch (err: any) {
      console.warn('Aviso: Falha ao persistir cliente no DB:', err?.message || err);
    }
  }

  return customerRecord;
}

let latestTvCall: {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  type?: string;
  tableOrDesk?: string;
  calledAt: number;
} | null = null;

export function setupDatabaseRoutes(app: Express, onUpdate?: () => void) {
  // Diagnostic Test Connection Route
  app.get('/api/db/test-connection', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const envDetected = {
      DATABASE_URL: !!getDatabaseUrl(),
      PGHOST: !!process.env.PGHOST,
      SQL_HOST: !!process.env.SQL_HOST,
      isVercel: !!process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV
    };

    if (!isDatabaseConfigured()) {
      return res.status(200).json({
        success: false,
        status: 'missing_config',
        message: 'Variável de ambiente do Banco de Dados não configurada.',
        details: 'Acesse o painel da Vercel -> Settings -> Environment Variables e adicione a variável DATABASE_URL com a URL de conexão do Neon/PostgreSQL.',
        envDetected,
        responseTimeMs: Date.now() - startTime
      });
    }

    try {
      const result = await pool.query('SELECT NOW() as current_time, current_database() as db_name, version() as pg_version');
      const row = result.rows[0];

      let productCount = 0;
      let categoryCount = 0;
      try {
        const pRes = await pool.query('SELECT COUNT(*) as c FROM products');
        productCount = parseInt(pRes.rows[0]?.c || '0', 10);
      } catch (_) {}

      try {
        const cRes = await pool.query('SELECT COUNT(*) as c FROM categories');
        categoryCount = parseInt(cRes.rows[0]?.c || '0', 10);
      } catch (_) {}

      return res.status(200).json({
        success: true,
        status: 'connected',
        message: 'Conexão com PostgreSQL Neon estabelecida com sucesso!',
        databaseName: row.db_name,
        dbTime: row.current_time,
        pgVersion: row.pg_version?.split(' ')?.[0] + ' ' + row.pg_version?.split(' ')?.[1],
        productCount,
        categoryCount,
        envDetected,
        responseTimeMs: Date.now() - startTime
      });
    } catch (err: any) {
      return res.status(200).json({
        success: false,
        status: 'connection_error',
        message: 'Falha ao conectar no servidor PostgreSQL.',
        details: err?.message || String(err),
        code: err?.code,
        envDetected,
        responseTimeMs: Date.now() - startTime
      });
    }
  });

  // Categories
  app.get('/api/db/categories', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memCategories);
    }
    try {
      let list = await db.select().from(categories).orderBy(categories.order);
      if (list.length === 0) {
        for (const cat of DEFAULT_CATEGORIES) {
          await db.insert(categories).values(cat).onConflictDoNothing();
        }
        list = await db.select().from(categories).orderBy(categories.order);
      }
      memCategories = list;
      persistCategoriesToDisk(memCategories);
      res.json(list);
    } catch (error: any) {
      res.json(memCategories);
    }
  });

  app.post('/api/db/categories', async (req: Request, res: Response) => {
    const data = req.body;
    const newCat = { ...data, id: data.id || `cat_${Date.now()}` };
    memCategories = [...memCategories.filter(c => c.id !== newCat.id), newCat];
    persistCategoriesToDisk(memCategories);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.insert(categories).values(newCat).returning();
        onUpdate?.();
        return res.json(result[0] || newCat);
      } catch (error: any) {
        onUpdate?.();
        return res.json(newCat);
      }
    }
    onUpdate?.();
    res.json(newCat);
  });

  app.put('/api/db/categories/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    memCategories = memCategories.map(c => c.id === id ? { ...c, ...data } : c);
    persistCategoriesToDisk(memCategories);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
        onUpdate?.();
        return res.json(result[0] || { id, ...data });
      } catch (error: any) {
        onUpdate?.();
        return res.json({ id, ...data });
      }
    }
    onUpdate?.();
    res.json({ id, ...data });
  });

  app.delete('/api/db/categories/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memCategories = memCategories.filter(c => c.id !== id);
    persistCategoriesToDisk(memCategories);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(categories).where(eq(categories.id, id));
      } catch (error: any) {}
    }
    onUpdate?.();
    res.json({ success: true, id });
  });

  // Products
  app.get('/api/db/products', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const defaultCodeMap: Record<string, string> = {
      'prod-1': '1001',
      'prod-2': '1002',
      'prod-3': '2001',
      'prod-4': '2002',
      'prod-5': '3001',
      'prod-6': '3002',
      'prod-7': '4001',
      'prod-8': '4002',
    };

    const attachCodeIfMissing = (p: any, index: number) => {
      let code = p.externalId;
      if (!code || String(code).trim() === '') {
        if (p.id && defaultCodeMap[p.id]) {
          code = defaultCodeMap[p.id];
        } else if (p.id && p.id.startsWith('prod-')) {
          const num = parseInt(p.id.replace('prod-', ''), 10);
          code = isNaN(num) ? String(1000 + index + 1) : String(1000 + num);
        } else {
          code = String(1000 + index + 1);
        }
      }
      return {
        ...p,
        externalId: code,
        description: cleanProductDescription(p.description, false)
      };
    };

    if (!isDatabaseConfigured()) {
      const sanitized = memProducts.map((p, idx) => attachCodeIfMissing(p, idx));
      memProducts = sanitized;
      return res.json(sanitized);
    }
    try {
      let list = await db.select().from(products);
      if (list.length === 0) {
        for (const prod of DEFAULT_PRODUCTS) {
          await db.insert(products).values(prod).onConflictDoNothing();
        }
        list = await db.select().from(products);
      }
      const sanitized = list.map((p, idx) => attachCodeIfMissing(p, idx));
      memProducts = sanitized;
      persistProductsToDisk(memProducts);
      res.json(sanitized);
    } catch (error: any) {
      res.json(memProducts.map((p, idx) => attachCodeIfMissing(p, idx)));
    }
  });

  app.post('/api/db/products', async (req: Request, res: Response) => {
    const data = req.body;
    const cleanDesc = cleanProductDescription(data.description, false);
    const newProd = { ...data, description: cleanDesc, id: data.id || `prod_${Date.now()}` };
    memProducts = [...memProducts.filter(p => p.id !== newProd.id), newProd];
    persistProductsToDisk(memProducts);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.insert(products).values(newProd).returning();
        onUpdate?.();
        return res.json(result[0] || newProd);
      } catch (error: any) {
        onUpdate?.();
        return res.json(newProd);
      }
    }
    onUpdate?.();
    res.json(newProd);
  });

  app.post('/api/db/products/batch', async (req: Request, res: Response) => {
    try {
      const items: any[] = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const sanitizedItems = items.map(item => ({
        ...item,
        description: cleanProductDescription(item.description, false)
      }));

      // Update in-memory cache
      const itemMap = new Map(memProducts.map(p => [p.id, p]));
      for (const item of sanitizedItems) {
        itemMap.set(item.id, { ...(itemMap.get(item.id) || {}), ...item });
      }
      memProducts = Array.from(itemMap.values());
      persistProductsToDisk(memProducts);

      if (isDatabaseConfigured()) {
        const subChunkSize = 10;
        for (let i = 0; i < sanitizedItems.length; i += subChunkSize) {
          const subChunk = sanitizedItems.slice(i, i + subChunkSize);
          await Promise.all(
            subChunk.map(item =>
              db.insert(products)
                .values(item)
                .onConflictDoUpdate({
                  target: products.id,
                  set: {
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    imageUrl: item.imageUrl,
                    isActive: item.isActive,
                    categoryId: item.categoryId,
                    externalId: item.externalId,
                  }
                })
            )
          );
        }
      }
      onUpdate?.();
      res.json({ success: true, count: sanitizedItems.length });
    } catch (error: any) {
      onUpdate?.();
      res.json({ success: true, count: (req.body || []).length });
    }
  });

  app.put('/api/db/products/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    if (data.description !== undefined) {
      data.description = cleanProductDescription(data.description, false);
    }
    memProducts = memProducts.map(p => p.id === id ? { ...p, ...data } : p);
    persistProductsToDisk(memProducts);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.update(products).set(data).where(eq(products.id, id)).returning();
        onUpdate?.();
        return res.json(result[0] || { id, ...data });
      } catch (error: any) {
        onUpdate?.();
        return res.json({ id, ...data });
      }
    }
    onUpdate?.();
    res.json({ id, ...data });
  });

  // Purge/clean all barcodes from descriptions in DB & Memory
  app.post('/api/db/products/clean-barcodes', async (req: Request, res: Response) => {
    try {
      let updatedCount = 0;
      memProducts = memProducts.map(p => {
        const cleaned = cleanProductDescription(p.description, false);
        if (cleaned !== p.description) updatedCount++;
        return { ...p, description: cleaned };
      });
      persistProductsToDisk(memProducts);

      if (isDatabaseConfigured()) {
        const allProds = await db.select().from(products);
        for (const prod of allProds) {
          const cleaned = cleanProductDescription(prod.description, false);
          if (cleaned !== prod.description) {
            await db.update(products).set({ description: cleaned }).where(eq(products.id, prod.id));
            updatedCount++;
          }
        }
      }
      onUpdate?.();
      res.json({ success: true, updatedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/db/products/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memProducts = memProducts.filter(p => p.id !== id);
    persistProductsToDisk(memProducts);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(products).where(eq(products.id, id));
      } catch (error: any) {}
    }
    onUpdate?.();
    res.json({ success: true, id });
  });

  // Orders
  app.get('/api/db/orders', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      // Pedidos do totem são considerados entregues ('completed') diretamente
      const sanitized = memOrders.map(o => o.type === 'kiosk' && (o.status === 'pending' || o.status === 'preparing') ? { ...o, status: 'completed' } : o);
      return res.json(sanitized);
    }
    try {
      const list = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5000);
      const sanitized = list.map(o => o.type === 'kiosk' && (o.status === 'pending' || o.status === 'preparing') ? { ...o, status: 'completed' as const } : o);
      memOrders = sanitized;
      return res.json(sanitized);
    } catch (error: any) {
      const sanitized = memOrders.map(o => o.type === 'kiosk' && (o.status === 'pending' || o.status === 'preparing') ? { ...o, status: 'completed' } : o);
      return res.json(sanitized);
    }
  });

  app.post('/api/db/orders', async (req: Request, res: Response) => {
    const data = req.body || {};
    
    // Obter lista atualizada de pedidos para calcular o próximo número sequencial garantido
    let currentOrders = [...memOrders];
    if (isDatabaseConfigured()) {
      try {
        const dbList = await db.select().from(orders);
        if (Array.isArray(dbList) && dbList.length > 0) {
          currentOrders = dbList;
        }
      } catch (err) {
        console.warn('Erro ao consultar pedidos do banco para numeração:', err);
      }
    }

    // Se o cliente forneceu um ID com 4 dígitos numéricos que ainda não está em uso, utiliza-o; senão calcula o menor número disponível
    let finalId: string;
    if (data.id && /^\d{4}$/.test(String(data.id)) && !currentOrders.some(o => o.id === String(data.id))) {
      finalId = String(data.id);
    } else {
      finalId = calculateNextOrderNumber(currentOrders);
    }

    const isTotem = data.type === 'kiosk';
    const newOrder = {
      ...data,
      id: finalId,
      createdAt: data.createdAt || Date.now(),
      status: isTotem ? 'completed' : (data.status || 'pending'),
      customerName: data.customerName || (isTotem ? 'Cliente Totem' : 'Cliente')
    };

    memOrders = [newOrder, ...memOrders.filter(o => o.id !== newOrder.id)];
    persistOrdersToDisk(memOrders);

    // Auto-capture customer as lead / client for marketing
    // REGRA DE NEGÓCIO: Apenas clientes de delivery e consumo na loja viram leads no sistema.
    // Pedidos feitos pelo totem NÃO viram leads.
    if (!isTotem && newOrder.type !== 'kiosk') {
      const custName = (newOrder.customerName || '').trim();
      const custPhone = (newOrder.customerPhone || '').trim();
      if ((custName && custName.toLowerCase() !== 'cliente' && custName.toLowerCase() !== 'cliente totem') || custPhone) {
        const isDelivery = newOrder.type === 'delivery' || newOrder.deliveryType === 'delivery';
        upsertCustomerLead({
          name: newOrder.customerName,
          phone: newOrder.customerPhone,
          address: newOrder.deliveryAddress || newOrder.address || '',
          source: isDelivery ? 'pedido_delivery' : 'pedido_loja',
          orderTotal: Number(newOrder.total) || 0,
          isOrder: true,
          tags: isDelivery ? ['Cliente', 'Delivery'] : ['Cliente', 'Consumo Loja']
        }).catch(err => console.warn('Erro ao auto-cadastrar lead do pedido:', err));
      }
    }

    if (isDatabaseConfigured()) {
      try {
        const result = await db.insert(orders).values(newOrder).returning();
        onUpdate?.();
        return res.json(result[0] || newOrder);
      } catch (error: any) {
        onUpdate?.();
        return res.json(newOrder);
      }
    }
    onUpdate?.();
    res.json(newOrder);
  });

  // TV Call Order endpoints
  app.get('/api/db/tv-call-order', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(latestTvCall || { calledAt: 0 });
  });

  app.post('/api/db/tv-call-order', (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const orderNumber = data.orderNumber || (data.orderId ? String(data.orderId).slice(-4).padStart(4, '0') : '0001');
      latestTvCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId: data.orderId || `ord_${Date.now()}`,
        orderNumber: String(orderNumber).replace('#', ''),
        customerName: data.customerName || 'Cliente',
        type: data.type || 'balcao',
        tableOrDesk: data.tableOrDesk || '',
        calledAt: Date.now()
      };
      onUpdate?.();
      res.json({ success: true, call: latestTvCall });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to broadcast TV call' });
    }
  });

  app.put('/api/db/orders/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    memOrders = memOrders.map(o => o.id === id ? { ...o, ...data } : o);
    persistOrdersToDisk(memOrders);

    if (data.status === 'ready') {
      const orderData = memOrders.find(o => o.id === id) || { id, ...data };
      latestTvCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId: id,
        orderNumber: String(id).slice(-4).padStart(4, '0'),
        customerName: orderData.customerName || 'Cliente',
        type: orderData.type || 'balcao',
        tableOrDesk: orderData.table || '',
        calledAt: Date.now()
      };
    }

    if (isDatabaseConfigured()) {
      try {
        const result = await db.update(orders).set(data).where(eq(orders.id, id)).returning();
        onUpdate?.();
        return res.json(result[0] || { id, ...data });
      } catch (error: any) {
        onUpdate?.();
        return res.json({ id, ...data });
      }
    }
    onUpdate?.();
    res.json({ id, ...data });
  });

  app.delete('/api/db/orders/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memOrders = memOrders.filter(o => o.id !== id);
    persistOrdersToDisk(memOrders);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(orders).where(eq(orders.id, id));
      } catch (error: any) {}
    }
    onUpdate?.();
    res.json({ success: true, id });
  });

  // Store Info
  app.get('/api/db/store-info', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memStoreInfo);
    }
    try {
      let list = await db.select().from(storeInfo).where(eq(storeInfo.id, 'default'));
      if (list.length > 0) {
        const dbRow = list[0];
        // Merge order: Default templates -> Local memory -> PostgreSQL database row (authoritative source of truth)
        const merged: any = { ...DEFAULT_STORE_INFO, ...memStoreInfo, ...dbRow };
        for (const [key, val] of Object.entries(dbRow)) {
          if (val !== null && val !== undefined) {
            merged[key] = val;
          }
        }
        memStoreInfo = merged;
        persistStoreInfoToDisk(memStoreInfo);
        return res.json(memStoreInfo);
      }
      await db.insert(storeInfo).values({ ...DEFAULT_STORE_INFO, ...memStoreInfo, id: 'default' }).onConflictDoNothing();
      persistStoreInfoToDisk(memStoreInfo);
      res.json(memStoreInfo);
    } catch (error: any) {
      console.warn('[DB] GET store-info erro:', error?.message);
      res.json(memStoreInfo);
    }
  });

  app.put('/api/db/store-info', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const sanitized: any = { id: 'default' };

      if (body.name !== undefined) sanitized.name = String(body.name);
      if (body.themeColor !== undefined) sanitized.themeColor = String(body.themeColor);
      if (body.addButtonColor !== undefined) sanitized.addButtonColor = String(body.addButtonColor);
      if (body.iconColor !== undefined) sanitized.iconColor = String(body.iconColor);
      if (body.headerPhrase !== undefined) sanitized.headerPhrase = String(body.headerPhrase);
      if (body.logoUrl !== undefined && body.logoUrl !== null) {
        const strLogo = String(body.logoUrl).trim();
        // Do not let empty string or default overwrite an already uploaded logo unless explicitly intended
        if (strLogo && strLogo !== '') {
          sanitized.logoUrl = strLogo;
        } else if (memStoreInfo.logoUrl) {
          sanitized.logoUrl = memStoreInfo.logoUrl;
        }
      }
      if (body.address !== undefined) sanitized.address = String(body.address);
      if (body.hours !== undefined) sanitized.hours = String(body.hours);
      if (body.instagram !== undefined) sanitized.instagram = String(body.instagram);
      if (body.whatsapp !== undefined) sanitized.whatsapp = String(body.whatsapp);
      if (body.categoryTitleColor !== undefined) sanitized.categoryTitleColor = String(body.categoryTitleColor);
      if (body.deliveryEnabled !== undefined) sanitized.deliveryEnabled = Boolean(body.deliveryEnabled);
      if (body.inStoreEnabled !== undefined) sanitized.inStoreEnabled = Boolean(body.inStoreEnabled);
      if (body.kioskEnabled !== undefined) sanitized.kioskEnabled = Boolean(body.kioskEnabled);
      if (body.isOpen !== undefined) sanitized.isOpen = Boolean(body.isOpen);
      if (body.ntfyTopic !== undefined) sanitized.ntfyTopic = String(body.ntfyTopic);
      if (body.tvTickerText !== undefined) sanitized.tvTickerText = String(body.tvTickerText);
      if (body.tvMode !== undefined) sanitized.tvMode = String(body.tvMode);
      if (body.tvSoundEnabled !== undefined) sanitized.tvSoundEnabled = Boolean(body.tvSoundEnabled);
      if (body.tvShowClock !== undefined) sanitized.tvShowClock = Boolean(body.tvShowClock);
      if (body.tvShowCaptions !== undefined) sanitized.tvShowCaptions = Boolean(body.tvShowCaptions);
      if (body.isMaintenance !== undefined) sanitized.isMaintenance = Boolean(body.isMaintenance);
      if (body.maintenanceMessage !== undefined) sanitized.maintenanceMessage = String(body.maintenanceMessage);
      if (body.weeklySchedule !== undefined) {
        sanitized.weeklySchedule = typeof body.weeklySchedule === 'string'
          ? body.weeklySchedule
          : JSON.stringify(body.weeklySchedule);
      }
      if (body.autoOpenClose !== undefined) sanitized.autoOpenClose = Boolean(body.autoOpenClose);
      if (body.forceOpen !== undefined) sanitized.forceOpen = Boolean(body.forceOpen);
      if (body.closedMessage !== undefined) sanitized.closedMessage = String(body.closedMessage);
      if (body.aiAgentEnabled !== undefined) sanitized.aiAgentEnabled = Boolean(body.aiAgentEnabled);
      if (body.aiAgentName !== undefined) sanitized.aiAgentName = String(body.aiAgentName);
      if (body.aiAgentTone !== undefined) sanitized.aiAgentTone = String(body.aiAgentTone);
      if (body.aiAgentCustomPrompt !== undefined) sanitized.aiAgentCustomPrompt = String(body.aiAgentCustomPrompt);
      if (body.aiAgentWhatsAppPhone !== undefined) sanitized.aiAgentWhatsAppPhone = String(body.aiAgentWhatsAppPhone);
      if (body.aiAgentWhatsAppDefaultMessage !== undefined) sanitized.aiAgentWhatsAppDefaultMessage = String(body.aiAgentWhatsAppDefaultMessage);
      if (body.aiAgentTrainingExamples !== undefined) {
        sanitized.aiAgentTrainingExamples = typeof body.aiAgentTrainingExamples === 'string'
          ? body.aiAgentTrainingExamples
          : JSON.stringify(body.aiAgentTrainingExamples);
      }
      if (body.aiAgentKnowledgeBase !== undefined) sanitized.aiAgentKnowledgeBase = String(body.aiAgentKnowledgeBase);
      if (body.aiAgentForbiddenPhrases !== undefined) sanitized.aiAgentForbiddenPhrases = String(body.aiAgentForbiddenPhrases);
      if (body.aiAgentCreativity !== undefined) sanitized.aiAgentCreativity = Number(body.aiAgentCreativity) || 0.65;
      if (body.aiAgentAntiRepeat !== undefined) sanitized.aiAgentAntiRepeat = Boolean(body.aiAgentAntiRepeat);
      if (body.preferredPrinterName !== undefined) sanitized.preferredPrinterName = String(body.preferredPrinterName);
      if (body.caixaPrinterName !== undefined) sanitized.caixaPrinterName = String(body.caixaPrinterName);
      if (body.autoPrintOrdersOnCaixa !== undefined) sanitized.autoPrintOrdersOnCaixa = Boolean(body.autoPrintOrdersOnCaixa);
      if (body.printerCutMode !== undefined) sanitized.printerCutMode = String(body.printerCutMode);
      if (body.printerCopies !== undefined) sanitized.printerCopies = Number(body.printerCopies) || 2;
      if (body.configuredPrinters !== undefined) {
        sanitized.configuredPrinters = typeof body.configuredPrinters === 'string'
          ? body.configuredPrinters
          : JSON.stringify(body.configuredPrinters);
      }
      if (body.tvSelectedCategories !== undefined) {
        sanitized.tvSelectedCategories = typeof body.tvSelectedCategories === 'string'
          ? body.tvSelectedCategories
          : JSON.stringify(body.tvSelectedCategories);
      }

      // Preserve existing memory properties if not explicitly provided
      memStoreInfo = { ...memStoreInfo, ...sanitized };
      persistStoreInfoToDisk(memStoreInfo);

      if (isDatabaseConfigured()) {
        try {
          let currentDbRow = {};
          try {
            const list = await db.select().from(storeInfo).where(eq(storeInfo.id, 'default'));
            if (list.length > 0) currentDbRow = list[0];
          } catch (e: any) {
            console.warn('[DB] Select prévio em store_info:', e?.message);
          }

          const fullRecordToPersist = { ...DEFAULT_STORE_INFO, ...currentDbRow, ...memStoreInfo, ...sanitized, id: 'default' };
          memStoreInfo = fullRecordToPersist;
          persistStoreInfoToDisk(memStoreInfo);

          try {
            await db.insert(storeInfo)
              .values(fullRecordToPersist)
              .onConflictDoUpdate({
                target: storeInfo.id,
                set: fullRecordToPersist
              });
            console.log('[DB] store_info salvo com sucesso no PostgreSQL!');
          } catch (dbErr: any) {
            console.error('[DB Error] Falha ao gravar store_info no PostgreSQL, executando ensureTablesExist...', dbErr?.message || dbErr);
            try {
              await ensureTablesExist();
              await db.insert(storeInfo)
                .values(fullRecordToPersist)
                .onConflictDoUpdate({
                  target: storeInfo.id,
                  set: fullRecordToPersist
                });
              console.log('[DB] store_info salvo com sucesso no PostgreSQL após atualizar colunas!');
            } catch (retryErr: any) {
              console.error('[DB Error] Falha persistente ao salvar store_info no PostgreSQL:', retryErr?.message || retryErr);
            }
          }

          onUpdate?.();
          return res.json(memStoreInfo);
        } catch (dbErr: any) {
          console.error('Database update error for storeInfo:', dbErr);
          onUpdate?.();
          return res.json(memStoreInfo);
        }
      }
      onUpdate?.();
      return res.json(memStoreInfo);
    } catch (error: any) {
      console.error('Error in PUT /api/db/store-info:', error);
      return res.status(500).json({ error: error.message || 'Erro ao atualizar dados' });
    }
  });

  // Diagnostic DB connection endpoint
  app.get('/api/db-status', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const configured = isDatabaseConfigured();
    let connected = false;
    let dbHost = 'Nenhum (Modo Local/Memória)';
    let error: string | null = null;

    if (configured) {
      try {
        const testRes = await testDatabaseConnection();
        connected = testRes.ok;
        if (testRes.host) dbHost = testRes.host;
        if (testRes.error) error = testRes.error;
      } catch (err: any) {
        connected = false;
        error = err?.message || String(err);
      }
    }

    res.json({
      configured,
      connected,
      dbHost,
      error,
      mode: connected ? 'postgresql' : (configured ? 'postgresql_error' : 'memory_fallback'),
      counts: {
        products: memProducts.length,
        categories: memCategories.length,
        orders: memOrders.length,
        customers: memCustomers.length,
        tables: memTables.length,
        tvMedia: memTvMedia.length,
      },
      storeName: memStoreInfo?.name || DEFAULT_STORE_INFO.name,
      serverTime: new Date().toISOString()
    });
  });

  // Dynamic App Icon endpoint (serves the exact store logo as real PNG/image for PWA and favicon)
  app.get(['/api/app-icon.png', '/api/app-icon', '/app-icon.png'], (req: Request, res: Response) => {
    try {
      const currentLogo = memStoreInfo?.logoUrl || DEFAULT_STORE_INFO.logoUrl;
      if (currentLogo && currentLogo.startsWith('data:image/')) {
        const matches = currentLogo.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1] === 'svg+xml' ? 'image/svg+xml' : `image/${matches[1]}`;
          const buffer = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
          return res.send(buffer);
        }
      }
      
      // External URL redirect or fallback
      if (currentLogo && currentLogo.startsWith('http')) {
        return res.redirect(currentLogo);
      }
      
      const cleanPath = (currentLogo || 'logo.svg').replace(/^\//, '');
      const localFile = path.join(process.cwd(), 'public', cleanPath);
      if (fs.existsSync(localFile)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        if (cleanPath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
        if (cleanPath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
        return res.sendFile(localFile);
      }
      return res.sendFile(path.join(process.cwd(), 'public', 'logo.svg'));
    } catch (err) {
      return res.sendFile(path.join(process.cwd(), 'public', 'logo.svg'));
    }
  });

  // Auth
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const emailClean = email.trim().toLowerCase();
      let user = memUsers.find(u => u.email?.toLowerCase() === emailClean);

      if (isDatabaseConfigured()) {
        try {
          const dbUsers = await db.select().from(users).where(eq(users.email, emailClean));
          if (dbUsers.length > 0) {
            user = dbUsers[0];
          }
        } catch (_) {}
      }

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.password !== password) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          uid: user.uid,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Login failed', details: error.message });
    }
  });

  // Users
  app.get('/api/db/users', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memUsers);
    }
    try {
      let list = await db.select().from(users);
      if (list.length === 0) {
        for (const admin of DEFAULT_USERS) {
          await db.insert(users).values(admin).onConflictDoNothing();
        }
        list = await db.select().from(users);
      }
      memUsers = list;
      res.json(list);
    } catch (error: any) {
      res.json(memUsers);
    }
  });

  app.post('/api/db/users', async (req: Request, res: Response) => {
    const data = { ...req.body };
    const emailClean = (data.email || '').trim().toLowerCase();
    if (!emailClean) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const uid = data.uid || (data.id && isNaN(Number(data.id)) ? String(data.id) : null) || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const userData = {
      uid,
      email: emailClean,
      name: data.name || emailClean.split('@')[0],
      role: data.role || 'padrao',
      password: data.password || '123456',
    };

    memUsers = [...memUsers.filter(u => (u.email || '').toLowerCase() !== emailClean && u.uid !== uid), userData];
    persistUsersToDisk(memUsers);

    if (isDatabaseConfigured()) {
      try {
        const existing = await db.select().from(users).where(eq(users.email, emailClean));
        if (existing.length > 0) {
          const updatePayload: any = {
            name: userData.name,
            role: userData.role,
          };
          if (data.password) {
            updatePayload.password = data.password;
          }
          const updated = await db.update(users).set(updatePayload).where(eq(users.email, emailClean)).returning();
          return res.json(updated[0] || userData);
        }
        const result = await db.insert(users).values(userData).returning();
        return res.json(result[0] || userData);
      } catch (error: any) {
        console.error('User DB insert error:', error);
        return res.json(userData);
      }
    }
    res.json(userData);
  });

  app.put('/api/db/users/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = { ...req.body };
    delete data.id;

    memUsers = memUsers.map(u => (String(u.id) === String(id) || u.uid === id) ? { ...u, ...data } : u);
    persistUsersToDisk(memUsers);

    if (isDatabaseConfigured()) {
      try {
        let result;
        if (!isNaN(Number(id))) {
          result = await db.update(users).set(data).where(eq(users.id, Number(id))).returning();
        } else {
          result = await db.update(users).set(data).where(eq(users.uid, id)).returning();
        }
        return res.json(result[0] || { id, ...data });
      } catch (error: any) {
        return res.json({ id, ...data });
      }
    }
    res.json({ id, ...data });
  });

  app.delete('/api/db/users/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memUsers = memUsers.filter(u => String(u.id) !== String(id) && u.uid !== id);
    persistUsersToDisk(memUsers);

    if (isDatabaseConfigured()) {
      try {
        if (!isNaN(Number(id))) {
          await db.delete(users).where(eq(users.id, Number(id)));
        } else {
          await db.delete(users).where(eq(users.uid, id));
        }
      } catch (error: any) {}
    }
    res.json({ success: true, id });
  });

  // Smart TV Media Playlist
  app.get('/api/db/tv-media', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memTvMedia);
    }
    try {
      let list = await db.select().from(tvMedia).orderBy(asc(tvMedia.order));
      if (list && list.length > 0) {
        memTvMedia = list;
        persistTvMediaToDisk(memTvMedia);
      }
      return res.json(list && list.length > 0 ? list : memTvMedia);
    } catch (error: any) {
      return res.json(memTvMedia);
    }
  });

  app.post('/api/db/tv-media', async (req: Request, res: Response) => {
    const data = { ...req.body };
    const id = String(data.id || `tv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    
    const url = String(data.url || '').trim();
    let type = String(data.type || 'video');

    if (url.startsWith('data:video') || url.startsWith('blob:') || /\.(mp4|webm|mov|m4v|ogg|avi|mkv)(\?.*)?$/i.test(url)) {
      type = 'video';
    } else if (url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url)) {
      type = 'image';
    } else if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
      type = 'youtube';
    }

    const insertData = {
      id,
      title: String(data.title || 'Vídeo TV').trim(),
      type,
      url,
      durationSeconds: Number(data.durationSeconds || data.duration_seconds || 15),
      order: Number(data.order ?? memTvMedia.length + 1),
      showCaptions: data.showCaptions !== undefined ? Boolean(data.showCaptions) : (data.show_captions !== undefined ? Boolean(data.show_captions) : false),
      fitMode: String(data.fitMode || data.fit_mode || (url.includes('/shorts/') ? 'vertical_smartphone' : 'fit')),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
    };

    memTvMedia = [...memTvMedia.filter(m => String(m.id) !== id), insertData];
    persistTvMediaToDisk(memTvMedia);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.insert(tvMedia).values(insertData).onConflictDoUpdate({
          target: tvMedia.id,
          set: insertData
        }).returning();
        onUpdate?.();
        return res.json(result[0] || insertData);
      } catch {
        onUpdate?.();
        return res.json(insertData);
      }
    }
    onUpdate?.();
    res.json(insertData);
  });

  app.put('/api/db/tv-media/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = { ...req.body };
    delete data.id;

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = String(data.title).trim();
    if (data.type !== undefined) updateData.type = String(data.type);
    if (data.url !== undefined) {
      updateData.url = String(data.url).trim();
      if (updateData.url.startsWith('data:video') || updateData.url.startsWith('blob:') || /\.(mp4|webm|mov|m4v|ogg|avi|mkv)(\?.*)?$/i.test(updateData.url)) {
        updateData.type = 'video';
      } else if (updateData.url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(updateData.url)) {
        updateData.type = 'image';
      } else if (updateData.url.includes('youtube.com') || updateData.url.includes('youtu.be')) {
        updateData.type = 'youtube';
      }
    }
    if (data.durationSeconds !== undefined || data.duration_seconds !== undefined) {
      updateData.durationSeconds = Number(data.durationSeconds ?? data.duration_seconds);
    }
    if (data.order !== undefined) updateData.order = Number(data.order);
    if (data.showCaptions !== undefined || data.show_captions !== undefined) {
      updateData.showCaptions = Boolean(data.showCaptions ?? data.show_captions);
    }
    if (data.fitMode !== undefined || data.fit_mode !== undefined) {
      updateData.fitMode = String(data.fitMode ?? data.fit_mode);
    }
    if (data.isActive !== undefined || data.is_active !== undefined) {
      updateData.isActive = Boolean(data.isActive ?? data.is_active);
    }

    memTvMedia = memTvMedia.map(m => String(m.id) === String(id) ? { ...m, ...updateData } : m);
    persistTvMediaToDisk(memTvMedia);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.update(tvMedia).set(updateData).where(eq(tvMedia.id, id)).returning();
        onUpdate?.();
        return res.json(result[0] || { id, ...updateData });
      } catch (updateErr: any) {
        onUpdate?.();
        return res.json({ id, ...updateData });
      }
    }
    onUpdate?.();
    res.json({ id, ...updateData });
  });

  app.delete('/api/db/tv-media/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memTvMedia = memTvMedia.filter(m => String(m.id) !== String(id));
    persistTvMediaToDisk(memTvMedia);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(tvMedia).where(eq(tvMedia.id, id));
      } catch (delErr: any) {}
    }
    onUpdate?.();
    res.json({ success: true, id });
  });

  // App Installations (PWA tracking)
  app.get('/api/db/app-installs', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json({
        count: memAppInstalls.length,
        installs: memAppInstalls
      });
    }
    try {
      const list = await db.select().from(appInstalls).orderBy(desc(appInstalls.installedAt));
      memAppInstalls = list;
      return res.json({
        count: list.length,
        installs: list
      });
    } catch (err: any) {
      return res.json({
        count: memAppInstalls.length,
        installs: memAppInstalls
      });
    }
  });

  app.post('/api/db/app-installs', async (req: Request, res: Response) => {
    const data = req.body || {};
    const id = String(data.id || `install_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
    const installedAt = Number(data.installedAt || Date.now());
    const platform = String(data.platform || 'unknown');
    const browser = String(data.browser || 'unknown');
    const deviceType = String(data.deviceType || 'mobile');
    const userAgent = String(data.userAgent || req.headers['user-agent'] || '');

    const record = {
      id,
      platform,
      browser,
      deviceType,
      installedAt,
      userAgent
    };

    // Deduplicate in memory
    const existingIndex = memAppInstalls.findIndex(i => i.id === id);
    if (existingIndex >= 0) {
      memAppInstalls[existingIndex] = record;
    } else {
      memAppInstalls = [record, ...memAppInstalls];
    }

    if (isDatabaseConfigured()) {
      try {
        const result = await db.insert(appInstalls).values(record).onConflictDoUpdate({
          target: appInstalls.id,
          set: record
        }).returning();
        onUpdate?.();
        return res.json({ success: true, install: result[0] || record, count: memAppInstalls.length });
      } catch (err: any) {
        onUpdate?.();
        return res.json({ success: true, install: record, count: memAppInstalls.length });
      }
    }

    onUpdate?.();
    return res.json({ success: true, install: record, count: memAppInstalls.length });
  });

  // Customers & Leads Management Endpoints
  app.get('/api/db/customers', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memCustomers);
    }
    try {
      const list = await db.select().from(customers).orderBy(desc(customers.createdAt));
      // Sync memory with DB if DB returned items
      if (list && list.length > 0) {
        memCustomers = list.map(c => ({
          ...c,
          tags: typeof c.tags === 'string' ? c.tags : JSON.stringify(c.tags || [])
        }));
        persistCustomersToDisk(memCustomers);
      }
      return res.json(memCustomers);
    } catch (err: any) {
      return res.json(memCustomers);
    }
  });

  app.post('/api/db/customers', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const saved = await upsertCustomerLead({
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address,
        source: body.source || 'cadastro_cardapio',
        orderTotal: Number(body.orderTotal) || 0,
        isOrder: !!body.isOrder,
        tags: Array.isArray(body.tags) ? body.tags : typeof body.tags === 'string' ? JSON.parse(body.tags || '[]') : [],
        notes: body.notes
      });
      onUpdate?.();
      return res.json(saved || { success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar cliente' });
    }
  });

  app.put('/api/db/customers/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body || {};
    const existingIndex = memCustomers.findIndex(c => c.id === id);
    if (existingIndex >= 0) {
      memCustomers[existingIndex] = {
        ...memCustomers[existingIndex],
        ...data,
        tags: Array.isArray(data.tags) ? JSON.stringify(data.tags) : (data.tags || memCustomers[existingIndex].tags)
      };
      persistCustomersToDisk(memCustomers);
    }

    if (isDatabaseConfigured()) {
      try {
        const payload = {
          ...data,
          tags: Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags
        };
        const result = await db.update(customers).set(payload).where(eq(customers.id, id)).returning();
        onUpdate?.();
        return res.json(result[0] || memCustomers[existingIndex] || { success: true });
      } catch (err: any) {
        onUpdate?.();
        return res.json(memCustomers[existingIndex] || { success: true });
      }
    }
    onUpdate?.();
    res.json(memCustomers[existingIndex] || { success: true });
  });

  app.delete('/api/db/customers/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memCustomers = memCustomers.filter(c => c.id !== id);
    persistCustomersToDisk(memCustomers);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(customers).where(eq(customers.id, id));
      } catch (err: any) {}
    }
    onUpdate?.();
    res.json({ success: true, id });
  });

  // Sync historical leads from orders table
  app.post('/api/db/customers/sync-from-orders', async (req: Request, res: Response) => {
    try {
      let ordersToProcess = [...memOrders];
      if (isDatabaseConfigured()) {
        try {
          const dbOrders = await db.select().from(orders);
          if (dbOrders && dbOrders.length > 0) {
            ordersToProcess = dbOrders;
          }
        } catch (dbErr) {
          // fallback to memOrders
        }
      }

      let count = 0;
      for (const ord of ordersToProcess) {
        // REGRA DE NEGÓCIO: Pedidos feitos pelo totem NÃO viram leads. Apenas delivery e consumo na loja.
        if (ord.type === 'kiosk') continue;

        const custName = (ord.customerName || '').trim();
        const custPhone = (ord.customerPhone || '').trim();
        if ((custName && custName.toLowerCase() !== 'cliente' && custName.toLowerCase() !== 'cliente totem') || custPhone) {
          const isDelivery = ord.type === 'delivery' || ord.deliveryType === 'delivery';
          await upsertCustomerLead({
            name: ord.customerName,
            phone: ord.customerPhone,
            address: ord.deliveryAddress || ord.address || '',
            source: isDelivery ? 'pedido_delivery' : 'pedido_loja',
            orderTotal: Number(ord.total) || 0,
            isOrder: true,
            tags: isDelivery ? ['Cliente', 'Delivery'] : ['Cliente', 'Consumo Loja']
          });
          count++;
        }
      }

      onUpdate?.();
      return res.json({ success: true, synced: count, totalCustomers: memCustomers.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao sincronizar clientes dos pedidos' });
    }
  });

  // Tables & QR Codes endpoints (Controle de Mesas)
  app.get('/api/db/tables', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memTables);
    }
    try {
      const list = await db.select().from(restaurantTables).orderBy(asc(restaurantTables.number));
      if (list && list.length > 0) {
        memTables = list;
        return res.json(list);
      }
      return res.json(memTables);
    } catch (error: any) {
      return res.json(memTables);
    }
  });

  app.post('/api/db/tables', async (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const num = parseInt(data.number, 10) || (memTables.length > 0 ? Math.max(...memTables.map(t => t.number || 0)) + 1 : 1);
      const newTable = {
        id: data.id || `table-${num}-${Date.now()}`,
        number: num,
        name: data.name || `Mesa ${String(num).padStart(2, '0')}`,
        section: data.section || 'Salão Principal',
        capacity: parseInt(data.capacity, 10) || 4,
        status: data.status || 'available',
        isActive: data.isActive !== false,
        createdAt: data.createdAt || Date.now(),
      };

      memTables = [...memTables.filter(t => t.id !== newTable.id), newTable].sort((a, b) => (a.number || 0) - (b.number || 0));
      persistTablesToDisk(memTables);

      if (isDatabaseConfigured()) {
        try {
          const result = await db.insert(restaurantTables).values(newTable).onConflictDoUpdate({
            target: restaurantTables.id,
            set: newTable,
          }).returning();
          onUpdate?.();
          return res.json(result[0] || newTable);
        } catch (dbErr) {
          console.warn('Erro ao salvar mesa no Postgres:', dbErr);
        }
      }

      onUpdate?.();
      return res.json(newTable);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao criar mesa' });
    }
  });

  app.post('/api/db/tables/batch', async (req: Request, res: Response) => {
    try {
      const { tables: newTablesList } = req.body || {};
      if (!Array.isArray(newTablesList) || newTablesList.length === 0) {
        return res.status(400).json({ error: 'Nenhuma mesa enviada para criação em lote' });
      }

      const createdList: any[] = [];
      for (const item of newTablesList) {
        const num = parseInt(item.number, 10) || 1;
        const record = {
          id: item.id || `table-${num}-${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          number: num,
          name: item.name || `Mesa ${String(num).padStart(2, '0')}`,
          section: item.section || 'Salão Principal',
          capacity: parseInt(item.capacity, 10) || 4,
          status: item.status || 'available',
          isActive: item.isActive !== false,
          createdAt: Date.now(),
        };
        createdList.push(record);
      }

      // Merge into memTables
      for (const c of createdList) {
        const idx = memTables.findIndex(t => t.number === c.number || t.id === c.id);
        if (idx >= 0) {
          memTables[idx] = c;
        } else {
          memTables.push(c);
        }
      }
      memTables.sort((a, b) => (a.number || 0) - (b.number || 0));
      persistTablesToDisk(memTables);

      if (isDatabaseConfigured()) {
        for (const c of createdList) {
          try {
            await db.insert(restaurantTables).values(c).onConflictDoUpdate({
              target: restaurantTables.id,
              set: c
            });
          } catch (err) {}
        }
      }

      onUpdate?.();
      return res.json({ success: true, count: createdList.length, tables: memTables });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao processar mesas em lote' });
    }
  });

  app.put('/api/db/tables/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    memTables = memTables.map(t => t.id === id ? { ...t, ...data } : t).sort((a, b) => (a.number || 0) - (b.number || 0));
    persistTablesToDisk(memTables);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.update(restaurantTables).set(data).where(eq(restaurantTables.id, id)).returning();
        onUpdate?.();
        return res.json(result[0] || { id, ...data });
      } catch (error: any) {
        onUpdate?.();
        return res.json({ id, ...data });
      }
    }
    onUpdate?.();
    res.json({ id, ...data });
  });

  app.delete('/api/db/tables/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memTables = memTables.filter(t => t.id !== id);
    persistTablesToDisk(memTables);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(restaurantTables).where(eq(restaurantTables.id, id));
      } catch (err: any) {}
    }
    onUpdate?.();
    res.json({ success: true, id });
  });

  // Full System Data Backup & Restore endpoints
  app.get('/api/db/backup', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', `attachment; filename="balbec-salgados-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      storeInfo: memStoreInfo,
      tvMedia: memTvMedia,
      categories: memCategories,
      products: memProducts,
      users: memUsers,
      tables: memTables,
      customers: memCustomers,
      orders: memOrders,
      exportedAt: new Date().toISOString(),
      version: '2.0.0'
    });
  });

  app.post('/api/db/restore', async (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      let restoredCount = 0;

      if (data.storeInfo && typeof data.storeInfo === 'object') {
        memStoreInfo = { ...DEFAULT_STORE_INFO, ...memStoreInfo, ...data.storeInfo, id: 'default' };
        persistStoreInfoToDisk(memStoreInfo);
        restoredCount++;
      }

      if (Array.isArray(data.tvMedia)) {
        memTvMedia = data.tvMedia;
        persistTvMediaToDisk(memTvMedia);
        restoredCount++;
      }

      if (Array.isArray(data.categories) && data.categories.length > 0) {
        memCategories = data.categories;
        persistCategoriesToDisk(memCategories);
        restoredCount++;
      }

      if (Array.isArray(data.products) && data.products.length > 0) {
        memProducts = data.products;
        persistProductsToDisk(memProducts);
        restoredCount++;
      }

      if (Array.isArray(data.users) && data.users.length > 0) {
        memUsers = data.users;
        persistUsersToDisk(memUsers);
        restoredCount++;
      }

      if (Array.isArray(data.tables) && data.tables.length > 0) {
        memTables = data.tables;
        persistTablesToDisk(memTables);
        restoredCount++;
      }

      if (Array.isArray(data.customers)) {
        memCustomers = data.customers;
        persistCustomersToDisk(memCustomers);
        restoredCount++;
      }

      if (Array.isArray(data.orders)) {
        memOrders = data.orders;
        persistOrdersToDisk(memOrders);
        restoredCount++;
      }

      persistAllStateToMasterFile();

      // If Postgres DB is configured, sync restored items to Postgres tables
      if (isDatabaseConfigured()) {
        try {
          if (data.storeInfo) {
            await db.insert(storeInfo).values(memStoreInfo).onConflictDoUpdate({
              target: storeInfo.id,
              set: memStoreInfo
            });
          }
          if (Array.isArray(data.categories)) {
            for (const c of data.categories) {
              await db.insert(categories).values(c).onConflictDoUpdate({ target: categories.id, set: c });
            }
          }
          if (Array.isArray(data.products)) {
            for (const p of data.products) {
              await db.insert(products).values(p).onConflictDoUpdate({ target: products.id, set: p });
            }
          }
          if (Array.isArray(data.tvMedia)) {
            for (const m of data.tvMedia) {
              await db.insert(tvMedia).values(m).onConflictDoUpdate({ target: tvMedia.id, set: m });
            }
          }
          if (Array.isArray(data.tables)) {
            for (const t of data.tables) {
              await db.insert(restaurantTables).values(t).onConflictDoUpdate({ target: restaurantTables.id, set: t });
            }
          }
        } catch (dbErr) {
          console.warn('Aviso: Falha parcial ao restaurar no PostgreSQL:', dbErr);
        }
      }

      onUpdate?.();
      return res.json({
        success: true,
        message: 'Backup restaurado com sucesso!',
        restoredCategories: memCategories.length,
        restoredProducts: memProducts.length,
        restoredTvMedia: memTvMedia.length,
        restoredTables: memTables.length
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao restaurar backup' });
    }
  });

  app.get('/api/db/storage-status', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      hasPostgres: isDatabaseConfigured(),
      diskFiles: {
        storeInfo: fs.existsSync(STORE_INFO_FILE),
        tvMedia: fs.existsSync(TV_MEDIA_FILE),
        categories: fs.existsSync(CATEGORIES_FILE),
        products: fs.existsSync(PRODUCTS_FILE),
        orders: fs.existsSync(ORDERS_FILE),
        users: fs.existsSync(USERS_FILE),
        tables: fs.existsSync(TABLES_FILE),
        customers: fs.existsSync(CUSTOMERS_FILE),
        masterBackup: fs.existsSync(MASTER_STATE_FILE)
      },
      counts: {
        categories: memCategories.length,
        products: memProducts.length,
        tvMedia: memTvMedia.length,
        tables: memTables.length,
        orders: memOrders.length,
        users: memUsers.length,
        customers: memCustomers.length
      },
      storeName: memStoreInfo.name,
      isOpen: memStoreInfo.isOpen,
      aiAgentEnabled: memStoreInfo.aiAgentEnabled,
      hasCustomLogo: !!(memStoreInfo.logoUrl && memStoreInfo.logoUrl !== '/logo.svg')
    });
  });

  // Mount AI Virtual Agent endpoints
  registerAiRoutes(app, () => ({
    categories: memCategories,
    products: memProducts,
    storeInfo: memStoreInfo
  }));
}

