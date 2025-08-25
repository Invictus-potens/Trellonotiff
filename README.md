# Trello Monitor

Monitor automático de cartas do Trello com notificações em tempo real.

## 🚀 Deploy no Railway

### Pré-requisitos
- Conta no [Railway](https://railway.app)
- API Key e Token do Trello
- Configuração da API de notificação

### Passos para Deploy

1. **Fork/Clone este repositório**

2. **Conecte ao Railway**
   - Acesse [Railway](https://railway.app)
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Escolha este repositório

3. **Configure as Variáveis de Ambiente**
   No painel do Railway, adicione as seguintes variáveis:
   
   ```
   TRELLO_API_KEY=sua_api_key_do_trello
   TRELLO_API_TOKEN=seu_token_do_trello
   BOARD_ID=id_do_seu_board
   API_KEY=sua_api_key_de_notificacao
   PHONE_NUMBER=numero_para_notificacoes
   NODE_ENV=production
   ```

4. **Deploy Automático**
   - O Railway fará o deploy automaticamente
   - O serviço ficará disponível em uma URL gerada

### 🔧 Configuração Local

1. **Instale as dependências**
   ```bash
   npm install
   ```

2. **Configure as variáveis de ambiente**
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com suas credenciais
   ```

3. **Execute o projeto**
   ```bash
   npm start
   ```

### 📋 Funcionalidades

- ✅ Monitoramento contínuo de cartas do Trello
- ✅ Detecção de mudanças de coluna
- ✅ Notificações automáticas via API
- ✅ Health check endpoint (`/health`)
- ✅ Tratamento gracioso de erros
- ✅ Logs detalhados

### 🌐 Endpoints

- `GET /` - Status do serviço
- `GET /health` - Health check (JSON)

### 📝 Logs

O serviço gera logs detalhados sobre:
- Cartas monitoradas
- Mudanças detectadas
- Notificações enviadas
- Erros e status do sistema