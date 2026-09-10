import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useStore } from '../store/useStore';
import { BakeryLoader } from './BakeryLoader';

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const { fetchData, fetchOrdersOnly, setIsOnline } = useStore();
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    console.log('FirebaseProvider mounted');

    fetchData().catch((err) => {
      console.error('Initial data fetch error:', err);
    });

    // Setup Server-Sent Events (SSE) for instant real-time sync across desktop & mobile
    let eventSource: EventSource | null = null;
    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'sync' || data.type === 'connected') {
              console.log('[SSE] Received sync event, refreshing data...');
              fetchData().catch(() => {});
              fetchOrdersOnly().catch(() => {});
            }
          } catch (e) {
            // ignore
          }
        };
        eventSource.onerror = () => {
          eventSource?.close();
          // Try reconnecting after 3 seconds
          setTimeout(connectSSE, 3000);
        };
      } catch (e) {
        console.warn('SSE not supported or failed:', e);
      }
    };
    connectSSE();

    // Polling inteligente e econômico:
    // O sistema conta com SSE (/api/events) que avisa instantaneamente em milissegundos sobre qualquer novo pedido ou atualização.
    // O polling serve apenas como fallback de segurança:
    // - Somente executa se a tela/aba estiver visível
    // - Pedidos: a cada 15 segundos como backup (em vez de 3s contínuos)
    // - Catálogo de produtos: a cada 90 segundos como backup (em vez de 10s contínuos)
    const ordersInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOrdersOnly().catch(() => {});
      }
    }, 15000);

    const fullCatalogInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData().catch(() => {});
      }
    }, 90000);

    // Auto sync when app tab is refocused, unlocked, pageshow (iOS bfcache), or network reconnects
    const handleSyncTrigger = () => {
      if (document.visibilityState === 'visible' || navigator.onLine) {
        fetchData().catch(() => {});
        fetchOrdersOnly().catch(() => {});
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log('[PageShow] Restored from bfcache, refreshing data...');
        fetchData().catch(() => {});
        fetchOrdersOnly().catch(() => {});
      }
    };

    window.addEventListener('focus', handleSyncTrigger);
    document.addEventListener('visibilitychange', handleSyncTrigger);
    window.addEventListener('online', handleSyncTrigger);
    window.addEventListener('pageshow', handlePageShow);

    // Auth state listener
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
      setIsOnline(true);
    });

    return () => {
      eventSource?.close();
      clearInterval(ordersInterval);
      clearInterval(fullCatalogInterval);
      window.removeEventListener('focus', handleSyncTrigger);
      document.removeEventListener('visibilitychange', handleSyncTrigger);
      window.removeEventListener('online', handleSyncTrigger);
      window.removeEventListener('pageshow', handlePageShow);
      unsubAuth();
    };
  }, [fetchData, fetchOrdersOnly, setIsOnline]);

  if (!isReady) {
    return <BakeryLoader isLoading={true} />;
  }

  return <>{children}</>;
}
