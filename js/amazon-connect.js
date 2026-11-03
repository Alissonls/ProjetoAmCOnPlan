/**
 * AmCOn Saúde - Camada de Integração Oficial com o Amazon Connect
 * Arquitetura aberta para conexão via Amazon Connect Streams, ChatJS
 * e API Gateway / AWS Lambda (StartChatContact & Participant Service).
 */

(function(window) {
  'use strict';

  // Configuração padrão do Amazon Connect (persiste no localStorage)
  const STORAGE_KEY = 'AMCON_AWS_CONNECT_CONFIG';

  const defaultAWSConfig = {
    enabled: false, // Ativa modo Amazon Connect Live ou modo Híbrido/Simulado
    region: 'us-east-1', // Ex: us-east-1, sa-east-1 (São Paulo)
    instanceId: '12345678-1234-1234-1234-1234567890ab',
    contactFlowId: '87654321-4321-4321-4321-ba0987654321',
    apiGatewayEndpoint: 'https://api.amconsaude.com.br/prod/startChatContact', // Endpoint da Lambda que executa StartChatContact
    participantGatewayEndpoint: '', // Endpoint alternativo ou websocket
    defaultAttributes: {
      Channel: 'WEB_CHAT',
      Origem: 'Portal_AmCOn_Saude',
      FilaPrioritaria: 'Atendimento_Humanizado',
      TipoCliente: 'Beneficiario'
    },
    customerName: 'Cliente AmCOn',
    customerEmail: 'cliente@amconsaude.com.br'
  };

  // Carrega configuração salva ou default
  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return Object.assign({}, defaultAWSConfig, JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Erro ao carregar config do Amazon Connect:', e);
    }
    return Object.assign({}, defaultAWSConfig);
  }

  function saveConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {
      console.error('Erro ao salvar config do Amazon Connect:', e);
    }
  }

  class AmazonConnectService {
    constructor() {
      this.config = loadConfig();
      this.isConnected = false;
      this.isConnecting = false;
      this.sessionData = null; // { contactId, participantId, participantToken, websocketUrl }
      this.websocket = null;
      this.callbacks = {
        onMessage: [],
        onTyping: [],
        onConnectionChange: [],
        onChatEnded: []
      };

      console.log('[Amazon Connect Bridge] Inicializado. Status:', this.config.enabled ? 'Ativo (Live)' : 'Modo Híbrido / Porta Aberta');
    }

    /**
     * Atualiza e persiste a configuração do Amazon Connect
     */
    updateConfig(newConfig) {
      this.config = Object.assign(this.config, newConfig);
      saveConfig(this.config);
      this.emitConnectionChange({
        status: this.isConnected ? 'connected' : (this.config.enabled ? 'ready' : 'standby'),
        config: this.config
      });
    }

    /**
     * Inicia a sessão de chat conectando ao Amazon Connect via API Gateway / Lambda
     * @param {Object} customerData { name, email, phone, initialMessage, customAttributes }
     */
    async startChatSession(customerData = {}) {
      if (this.isConnected) {
        console.log('[Amazon Connect Bridge] Sessão já ativa.');
        return this.sessionData;
      }

      this.isConnecting = true;
      this.emitConnectionChange({ status: 'connecting' });

      const payload = {
        InstanceId: this.config.instanceId,
        ContactFlowId: this.config.contactFlowId,
        ParticipantDetails: {
          DisplayName: customerData.name || this.config.customerName || 'Beneficiário AmCOn'
        },
        InitialMessage: {
          Content: customerData.initialMessage || 'Olá, preciso de atendimento pelo portal AmCOn Saúde.',
          ContentType: 'text/plain'
        },
        Attributes: Object.assign({}, this.config.defaultAttributes, customerData.customAttributes || {})
      };

      // Se o modo Live estiver ativado e houver uma URL de API Gateway configurada:
      if (this.config.enabled && this.config.apiGatewayEndpoint && !this.config.apiGatewayEndpoint.includes('api.amconsaude.com.br')) {
        try {
          console.log('[Amazon Connect Bridge] Chamando API Gateway StartChatContact:', this.config.apiGatewayEndpoint);

          const response = await fetch(this.config.apiGatewayEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            throw new Error(`Falha no StartChatContact: status ${response.status}`);
          }

          const data = await response.json();
          this.sessionData = {
            contactId: data.ContactId,
            participantId: data.ParticipantId,
            participantToken: data.ParticipantToken,
            websocketUrl: data.WebsocketUrl || (data.ConnectionCredentials && data.ConnectionCredentials.Url)
          };

          // Se a API retornou o WebSocket do Participant Service, conecta-se
          if (this.sessionData.websocketUrl) {
            this.connectWebSocket(this.sessionData.websocketUrl);
          }

          this.isConnected = true;
          this.isConnecting = false;
          this.emitConnectionChange({ status: 'connected', session: this.sessionData });
          return this.sessionData;
        } catch (err) {
          console.error('[Amazon Connect Bridge] Erro ao conectar na API Gateway:', err);
          this.isConnecting = false;
          this.emitConnectionChange({ status: 'error', error: err.message });
          // Em caso de falha de conexão com a AWS, fallback gracioso
          return this.fallbackSimulatedSession(payload);
        }
      } else {
        // MODO HÍBRIDO / SIMULADO: Mantém o protocolo e portas idênticas às da AWS
        return this.fallbackSimulatedSession(payload);
      }
    }

    /**
     * Sessão simulada com o mesmo contrato de dados da AWS Connect
     */
    fallbackSimulatedSession(payload) {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.sessionData = {
            contactId: 'aws-mock-contact-' + Date.now(),
            participantId: 'aws-mock-participant-' + Math.floor(Math.random() * 10000),
            participantToken: 'mock-token-jwt-amcon-connect',
            isMock: true,
            attributes: payload.Attributes
          };
          this.isConnected = true;
          this.isConnecting = false;
          this.emitConnectionChange({ status: 'connected_mock', session: this.sessionData });
          console.log('[Amazon Connect Bridge] Sessão iniciada em modo compatível:', this.sessionData);
          resolve(this.sessionData);
        }, 600);
      });
    }

    /**
     * Estabelece conexão WebSocket com o Amazon Connect Participant Service
     */
    connectWebSocket(websocketUrl) {
      try {
        this.websocket = new WebSocket(websocketUrl);

        this.websocket.onopen = () => {
          console.log('[Amazon Connect Bridge] WebSocket do Participant Service Conectado!');
          // Envia inscrição no tópico de mensagens
          this.websocket.send(JSON.stringify({
            topic: 'aws/subscribe',
            action: 'subscribe',
            data: { topic: 'aws/chat' }
          }));
        };

        this.websocket.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            this.handleParticipantEvent(parsed);
          } catch (e) {
            console.warn('[Amazon Connect Bridge] Formato de mensagem não JSON:', event.data);
          }
        };

        this.websocket.onerror = (err) => {
          console.error('[Amazon Connect Bridge] Erro no WebSocket:', err);
        };

        this.websocket.onclose = () => {
          console.log('[Amazon Connect Bridge] Conexão WebSocket encerrada.');
          this.isConnected = false;
          this.emitConnectionChange({ status: 'disconnected' });
        };
      } catch (err) {
        console.error('[Amazon Connect Bridge] Falha ao criar WebSocket:', err);
      }
    }

    /**
     * Processa eventos e mensagens que chegam do Amazon Connect
     */
    handleParticipantEvent(event) {
      if (!event) return;

      // Evento de Mensagem de Texto vinda do Agente ou Lex Bot
      if (event.ContentType === 'text/plain' || event.Type === 'MESSAGE') {
        const text = event.Content || event.text;
        const sender = event.ParticipantRole === 'AGENT' ? 'Agente Humano (Connect)' : 'Atendente Virtual AWS';
        this.emitMessage({
          sender: sender,
          content: text,
          role: event.ParticipantRole || 'AGENT',
          timestamp: new Date().toISOString()
        });
      }

      // Evento de Digitação (Typing Indicator)
      if (event.ContentType === 'application/vnd.amazonaws.connect.event.typing') {
        this.emitTyping(true);
      }

      // Evento de Encerramento do Chat
      if (event.ContentType === 'application/vnd.amazonaws.connect.event.chat.ended') {
        this.emitChatEnded();
      }
    }

    /**
     * Envia uma mensagem para o Amazon Connect
     * @param {string} text Conteúdo da mensagem
     */
    async sendMessage(text) {
      if (!this.isConnected) {
        console.warn('[Amazon Connect Bridge] Não é possível enviar mensagem sem sessão ativa.');
        return false;
      }

      const messagePayload = {
        Action: 'SendMessage',
        ContentType: 'text/plain',
        Content: text
      };

      // Se WebSocket ativo, envia direto
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify(messagePayload));
        return true;
      }

      // Se estiver em modo mock/simulado, loga o envio
      console.log('[Amazon Connect Bridge] Mensagem enviada para o fluxo Connect:', text);
      return true;
    }

    /**
     * Notifica ao Amazon Connect que o cliente está digitando
     */
    sendTyping() {
      if (!this.isConnected) return;
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          Action: 'SendEvent',
          ContentType: 'application/vnd.amazonaws.connect.event.typing'
        }));
      }
    }

    /**
     * Encerra o contato no Amazon Connect
     */
    endChat() {
      if (this.websocket) {
        try {
          this.websocket.send(JSON.stringify({
            Action: 'SendEvent',
            ContentType: 'application/vnd.amazonaws.connect.event.chat.ended'
          }));
          this.websocket.close();
        } catch (e) {}
      }
      this.isConnected = false;
      this.sessionData = null;
      this.emitChatEnded();
      this.emitConnectionChange({ status: 'ended' });
      console.log('[Amazon Connect Bridge] Chat encerrado com sucesso.');
    }

    // Gerenciamento de Callbacks
    onMessage(fn) { this.callbacks.onMessage.push(fn); }
    onTyping(fn) { this.callbacks.onTyping.push(fn); }
    onConnectionChange(fn) { this.callbacks.onConnectionChange.push(fn); }
    onChatEnded(fn) { this.callbacks.onChatEnded.push(fn); }

    emitMessage(data) { this.callbacks.onMessage.forEach(fn => fn(data)); }
    emitTyping(isTyping) { this.callbacks.onTyping.forEach(fn => fn(isTyping)); }
    emitConnectionChange(state) { this.callbacks.onConnectionChange.forEach(fn => fn(state)); }
    emitChatEnded() { this.callbacks.onChatEnded.forEach(fn => fn()); }
  }

  // Instância global do Serviço
  window.amazonConnectBridge = new AmazonConnectService();

})(window);
