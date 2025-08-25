// Script para monitorar cartas do Trello e notificar mudanças de coluna
const fetch = require('node-fetch');
const fs = require('fs');

// Carregar variáveis de ambiente
require('dotenv').config();

// Configurações do Trello
const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;
const BOARD_ID = process.env.BOARD_ID;

// Configurações da API de notificação
const API_URL = process.env.API_URL || 'https://api-krolik.telezapy.tech';
const API_KEY = process.env.API_KEY;
const PHONE_NUMBER = process.env.PHONE_NUMBER;

// Configurações do ambiente
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validar variáveis de ambiente obrigatórias
const requiredEnvVars = ['TRELLO_API_KEY', 'TRELLO_API_TOKEN', 'BOARD_ID', 'API_KEY', 'PHONE_NUMBER'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variáveis de ambiente obrigatórias não encontradas:', missingVars.join(', '));
  console.error('📝 Configure essas variáveis no Railway ou crie um arquivo .env');
  process.exit(1);
}

// Arquivo para armazenar o estado anterior das cartas
const STATE_FILE = 'trello-state.json';
const INIT_FLAG_FILE = 'trello-initialized.flag';

// Função para verificar se é a primeira execução
function isFirstRun() {
  return !fs.existsSync(INIT_FLAG_FILE);
}

// Função para marcar que a inicialização foi feita
function markAsInitialized() {
  try {
    fs.writeFileSync(INIT_FLAG_FILE, new Date().toISOString());
    console.log('✅ Sistema inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao marcar inicialização:', error.message);
  }
}

// Função para carregar o estado anterior
function loadPreviousState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('Erro ao carregar estado anterior:', error.message);
  }
  return {};
}

// Função para salvar o estado atual
function saveCurrentState(cards) {
  try {
    const state = {};
    cards.forEach(card => {
      state[card.id] = {
        id: card.id,
        name: card.name,
        idList: card.idList,
        listName: card.listName || 'Unknown'
      };
    });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('Estado salvo com sucesso');
  } catch (error) {
    console.error('Erro ao salvar estado:', error.message);
  }
}

// Função para buscar todas as cartas do board
async function fetchAllCards() {
  try {
    const response = await fetch(`https://api.trello.com/1/boards/${BOARD_ID}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}&list=true`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const cards = await response.json();
    console.log(`\n✅ ${cards.length} cartas encontradas no board`);
    
    // Adicionar nome da lista para cada carta
    const cardsWithListNames = cards.map(card => ({
      ...card,
      listName: card.list ? card.list.name : 'Unknown'
    }));

    return cardsWithListNames;
  } catch (error) {
    console.error('❌ Erro ao buscar cartas:', error.message);
    return [];
  }
}

// Função para buscar informações das listas
async function fetchLists() {
  try {
    const response = await fetch(`https://api.trello.com/1/boards/${BOARD_ID}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const lists = await response.json();
    return lists;
  } catch (error) {
    console.error('❌ Erro ao buscar listas:', error.message);
    return [];
  }
}

// Função para enviar notificação
async function sendNotification(message) {
  try {
    const response = await fetch(`${API_URL}/api/send/${PHONE_NUMBER}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: message,
        connectionFrom: 5,
        ticketStrategy: "create"
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Notificação enviada com sucesso:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error.message);
    return null;
  }
}

// Função para detectar mudanças de coluna
function detectColumnChanges(previousState, currentCards) {
  const changes = [];
  
  currentCards.forEach(card => {
    const previousCard = previousState[card.id];
    
    if (previousCard) {
      // Verificar se a carta mudou de lista
      if (previousCard.idList !== card.idList) {
        const change = {
          cardId: card.id,
          cardName: card.name,
          fromList: previousCard.listName,
          toList: card.listName,
          message: `🔄 Carta "${card.name}" movida de "${previousCard.listName}" para "${card.listName}"`
        };
        changes.push(change);
        console.log(`\n🔄 Mudança detectada: ${change.message}`);
      }
    } else {
      // Nova carta
      const change = {
        cardId: card.id,
        cardName: card.name,
        toList: card.listName,
        message: `🆕 Nova carta "${card.name}" criada na lista "${card.listName}"`
      };
      changes.push(change);
      console.log(`\n🆕 Nova carta detectada: ${change.message}`);
    }
  });

  // Verificar cartas removidas
  Object.keys(previousState).forEach(cardId => {
    const cardExists = currentCards.find(card => card.id === cardId);
    if (!cardExists) {
      const removedCard = previousState[cardId];
      const change = {
        cardId: cardId,
        cardName: removedCard.name,
        fromList: removedCard.listName,
        message: `🗑️ Carta "${removedCard.name}" foi removida da lista "${removedCard.listName}"`
      };
      changes.push(change);
      console.log(`\n🗑️ Carta removida detectada: ${change.message}`);
    }
  });

  return changes;
}

// Função principal de monitoramento
async function monitorTrello() {
  const firstRun = isFirstRun();
  
  if (firstRun) {
    console.log('🎯 PRIMEIRA EXECUÇÃO - Coletando estado inicial...');
  } else {
    console.log('🚀 Iniciando monitoramento do Trello...');
  }
  
  // Carregar estado anterior
  const previousState = loadPreviousState();
  console.log(`📊 Estado anterior carregado: ${Object.keys(previousState).length} cartas`);
  
  // Buscar estado atual
  const currentCards = await fetchAllCards();
  if (currentCards.length === 0) {
    console.log('❌ Não foi possível buscar cartas. Tentando novamente em 30 segundos...');
    setTimeout(monitorTrello, 30000);
    return;
  }

  // Buscar informações das listas para nomes mais legíveis
  const lists = await fetchLists();
  const listNames = {};
  lists.forEach(list => {
    listNames[list.id] = list.name;
  });

  // Atualizar nomes das listas nas cartas
  currentCards.forEach(card => {
    card.listName = listNames[card.idList] || 'Unknown';
  });

  if (firstRun) {
    // PRIMEIRA EXECUÇÃO: Apenas salvar estado inicial
    console.log('📝 Salvando estado inicial das cartas...');
    saveCurrentState(currentCards);
    markAsInitialized();
    
    console.log(`✅ Estado inicial salvo com ${currentCards.length} cartas`);
    console.log('🔔 A partir da próxima verificação, notificações serão enviadas para mudanças');
    
    // Mostrar resumo das cartas coletadas
    console.log('\n📋 Cartas coletadas no estado inicial:');
    const listSummary = {};
    currentCards.forEach(card => {
      if (!listSummary[card.listName]) {
        listSummary[card.listName] = 0;
      }
      listSummary[card.listName]++;
    });
    
    Object.entries(listSummary).forEach(([listName, count]) => {
      console.log(`  📌 ${listName}: ${count} cartas`);
    });
    
  } else {
    // EXECUÇÕES SEGUINTES: Detectar mudanças e notificar
    const changes = detectColumnChanges(previousState, currentCards);
    
    // Enviar notificações para cada mudança
    if (changes.length > 0) {
      console.log(`\n📱 Enviando ${changes.length} notificação(ões)...`);
      
      for (const change of changes) {
        await sendNotification(change.message);
        // Aguardar 2 segundos entre notificações para evitar spam
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log('✅ Todas as notificações foram enviadas!');
    } else {
      console.log('✅ Nenhuma mudança detectada');
    }

    // Salvar estado atual
    saveCurrentState(currentCards);
    
    // Mostrar resumo das cartas atuais (apenas se houver mudanças ou a cada 10 verificações)
    if (changes.length > 0) {
      console.log('\n📋 Resumo após mudanças:');
      const listSummary = {};
      currentCards.forEach(card => {
        if (!listSummary[card.listName]) {
          listSummary[card.listName] = 0;
        }
        listSummary[card.listName]++;
      });
      
      Object.entries(listSummary).forEach(([listName, count]) => {
        console.log(`  📌 ${listName}: ${count} cartas`);
      });
    }
  }

  // Agendar próxima verificação (a cada 30 segundos)
  console.log('\n⏰ Próxima verificação em 30 segundos...');
  setTimeout(monitorTrello, 30000);
}

// Servidor HTTP simples para Railway (health check)
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'trello-monitor' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Trello Monitor está rodando!');
  }
});

// Função para iniciar o monitoramento
function startMonitoring() {
  const firstRun = isFirstRun();
  
  console.log('🎯 Monitor de Trello iniciado!');
  
  if (firstRun) {
    console.log('🆕 PRIMEIRA EXECUÇÃO DETECTADA');
    console.log('📝 Coletando estado inicial das cartas (sem notificações)');
    console.log('🔔 Notificações começarão a partir da segunda verificação');
  } else {
    console.log(`📱 Notificações serão enviadas para: ${PHONE_NUMBER}`);
    console.log('🔔 Sistema já inicializado - monitorando mudanças');
  }
  
  console.log(`🔍 Verificando mudanças a cada 30 segundos...`);
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
  console.log('Pressione Ctrl+C para parar o monitoramento\n');
  
  // Iniciar servidor HTTP
  server.listen(PORT, () => {
    console.log(`✅ Servidor HTTP iniciado na porta ${PORT}`);
  });
  
  monitorTrello();
}

// Tratamento de saída graciosa
process.on('SIGINT', () => {
  console.log('\n\n🛑 Monitoramento interrompido pelo usuário');
  server.close(() => {
    console.log('🛑 Servidor HTTP fechado');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Recebido SIGTERM, encerrando graciosamente...');
  server.close(() => {
    console.log('🛑 Servidor HTTP fechado');
    process.exit(0);
  });
});

// Iniciar monitoramento
startMonitoring();


