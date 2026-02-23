const CACHE_NAME = 'running-trainer-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/treinos_fixos.js',
  '/manifest.json',
  '/icon.png'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✓ Cache aberto:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('✗ Erro ao cachear arquivos:', err))
  );
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar requisições - Cache First Strategy
self.addEventListener('fetch', event => {
  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - retorna resposta
        if (response) {
          return response;
        }

        // Clone da requisição
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Verificar se é uma resposta válida
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clone da resposta
          const responseToCache = response.clone();

          // Cache da resposta para requisições futuras
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(err => console.warn('Erro ao cachear:', err));

          return response;
        })
        .catch(err => {
          console.warn('Erro ao fazer fetch:', err);
          // Retornar página offline se disponível
          return caches.match('/index.html');
        });
      })
  );
});

// Background Sync - Sincronizar dados quando online
self.addEventListener('sync', event => {
  console.log('🔄 Background Sync disparado:', event.tag);
  
  if (event.tag === 'sync-treino-data') {
    event.waitUntil(
      sincronizarDadosTreino()
        .then(() => console.log('✓ Dados sincronizados'))
        .catch(err => console.error('✗ Erro ao sincronizar:', err))
    );
  }
});

async function sincronizarDadosTreino() {
  // Implementar sincronização de dados do treino
  // Por exemplo, enviar histórico de treinos para servidor
  try {
    // Placeholder para sincronização futura
    console.log('Sincronizando dados do treino...');
    return Promise.resolve();
  } catch (err) {
    console.error('Erro na sincronização:', err);
    throw err;
  }
}

// Push Notifications - Receber notificações em background
self.addEventListener('push', event => {
  console.log('📬 Push notification recebida');
  
  let data = {
    title: 'Running Trainer',
    body: 'Hora de treinar!',
    icon: '/icon.png'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/icon.png',
      tag: 'running-trainer-notification',
      requireInteraction: false
    })
  );
});

// Clique em notificação
self.addEventListener('notificationclick', event => {
  console.log('👆 Notificação clicada');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Procurar por janela aberta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Abrir nova janela se não houver
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Message Handler - Comunicação com o app
self.addEventListener('message', event => {
  console.log('💬 Mensagem recebida:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SYNC_TREINO') {
    // Disparar sincronização sob demanda
    if (self.registration.sync) {
      self.registration.sync.register('sync-treino-data');
    }
  }
});

console.log('✓ Service Worker carregado e pronto');