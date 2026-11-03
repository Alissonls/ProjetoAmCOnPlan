/**
 * AmCOn Saúde - Motor de Chat & Concierge Inteligente 24/7
 * Totalmente funcional com triagem clínica, cotação interativa, 
 * carteirinha virtual, 2ª via PIX/Boleto, áudio e transferência humana.
 * Integrado com a porta de comunicação do Amazon Connect (Streams / ChatJS).
 */

class AmCOnChatEngine {
  constructor() {
    this.isOpen = false;
    this.isMaximized = false;
    this.soundEnabled = true;
    this.isTyping = false;
    this.isRecording = false;
    this.recordingTimer = null;
    this.recordingSeconds = 0;
    this.activeOperator = {
      name: "AmCo Atendente",
      role: "Assistente Virtual & Triagem AmCOn",
      avatar: "🩺",
      status: "Online agora • Resposta imediata"
    };
    this.conversationHistory = [];
    this.currentFlow = null;
    this.chatState = {};
    
    // Audio Context para sons suaves de notificação (sem dependência de arquivos externos)
    this.audioCtx = null;

    this.init();
  }

  init() {
    this.cacheDOM();
    this.bindEvents();
    this.initAmazonConnectBridge();
    this.loadInitialGreeting();
  }

  cacheDOM() {
    this.widgetContainer = document.getElementById('chat-widget-container');
    this.chatBox = document.getElementById('chat-box');
    this.chatTriggerBtn = document.getElementById('chat-trigger-btn');
    this.unreadBadge = document.getElementById('chat-unread-badge');
    
    this.messagesContainer = document.getElementById('chat-messages');
    this.messageInput = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send-btn');
    this.micBtn = document.getElementById('chat-mic-btn');
    this.attachBtn = document.getElementById('chat-attach-btn');
    this.fileInput = document.getElementById('chat-file-input');
    
    this.operatorNameEl = document.getElementById('chat-operator-name');
    this.operatorRoleEl = document.getElementById('chat-operator-role');
    this.operatorAvatarEl = document.getElementById('chat-operator-avatar');
    
    this.minimizeBtn = document.getElementById('chat-minimize-btn');
    this.maximizeBtn = document.getElementById('chat-maximize-btn');
    this.soundBtn = document.getElementById('chat-sound-btn');
    this.resetBtn = document.getElementById('chat-reset-btn');
    
    this.recordingBar = document.getElementById('chat-recording-bar');
    this.recordingTimeEl = document.getElementById('recording-timer');
    this.cancelRecordBtn = document.getElementById('cancel-record-btn');
    this.sendRecordBtn = document.getElementById('send-record-btn');

    // Elementos do Amazon Connect
    this.awsBadgeBtn = document.getElementById('aws-connect-badge-btn');
    this.awsStatusDot = document.getElementById('aws-status-dot');
    this.awsStatusText = document.getElementById('aws-status-text');
    this.awsModal = document.getElementById('amazon-connect-modal');
    this.closeAwsModalBtn = document.getElementById('close-aws-modal-btn');
  }

  bindEvents() {
    if (this.chatTriggerBtn) {
      this.chatTriggerBtn.addEventListener('click', () => this.toggleChat());
    }

    if (this.minimizeBtn) {
      this.minimizeBtn.addEventListener('click', () => this.closeChat());
    }

    if (this.maximizeBtn) {
      this.maximizeBtn.addEventListener('click', () => this.toggleMaximize());
    }

    if (this.soundBtn) {
      this.soundBtn.addEventListener('click', () => this.toggleSound());
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => this.resetConversation());
    }

    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.handleSendMessage());
    }

    if (this.messageInput) {
      this.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
      
      this.messageInput.addEventListener('input', () => {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendBtn.disabled = !hasText;

        // Dispara evento de digitação para o Amazon Connect
        if (window.amazonConnectBridge && window.amazonConnectBridge.isConnected) {
          window.amazonConnectBridge.sendTyping();
        }
      });
    }

    // Gravação de Áudio Simulada
    if (this.micBtn) {
      this.micBtn.addEventListener('click', () => this.startAudioRecording());
    }

    if (this.cancelRecordBtn) {
      this.cancelRecordBtn.addEventListener('click', () => this.cancelAudioRecording());
    }

    if (this.sendRecordBtn) {
      this.sendRecordBtn.addEventListener('click', () => this.sendAudioRecording());
    }

    // Anexo de Arquivos
    if (this.attachBtn && this.fileInput) {
      this.attachBtn.addEventListener('click', () => this.fileInput.click());
      this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // Delegação para Quick Chips e Botões interativos gerados no chat
    if (this.messagesContainer) {
      this.messagesContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.quick-chip');
        if (chip) {
          const action = chip.getAttribute('data-action');
          const value = chip.getAttribute('data-value') || chip.innerText.trim();
          this.handleQuickAction(action, value);
        }

        const actionBtn = e.target.closest('[data-chat-action]');
        if (actionBtn) {
          const act = actionBtn.getAttribute('data-chat-action');
          const val = actionBtn.getAttribute('data-chat-value');
          this.handleActionCardClick(act, val);
        }
      });
    }

    // Modal de Configuração do Amazon Connect
    if (this.awsBadgeBtn) {
      this.awsBadgeBtn.addEventListener('click', () => this.openAwsModal());
    }

    if (this.closeAwsModalBtn) {
      this.closeAwsModalBtn.addEventListener('click', () => this.closeAwsModal());
    }

    if (this.awsModal) {
      this.awsModal.addEventListener('click', (e) => {
        if (e.target === this.awsModal) this.closeAwsModal();
      });
    }

    // Formulário de Configuração do Amazon Connect
    const awsForm = document.getElementById('aws-connect-config-form');
    if (awsForm) {
      awsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveAmazonConnectForm();
      });
    }

    const testAwsBtn = document.getElementById('test-aws-connection-btn');
    if (testAwsBtn) {
      testAwsBtn.addEventListener('click', () => this.testAwsConnection());
    }

    // Listeners globais para gatilhos vindos da landing page
    document.addEventListener('openAmCOnChat', (event) => {
      this.openChat();
      if (event.detail && event.detail.flow) {
        setTimeout(() => {
          this.handleQuickAction(event.detail.flow, event.detail.value || '');
        }, 300);
      }
    });
  }

  // ==========================================================================
  // INTEGRAÇÃO COM AMAZON CONNECT
  // ==========================================================================
  initAmazonConnectBridge() {
    if (!window.amazonConnectBridge) return;

    this.updateAWSBadge();

    // 1. Mensagem recebida da AWS (seja do Amazon Lex ou de Atendente Humano no CCP)
    window.amazonConnectBridge.onMessage((data) => {
      this.removeTypingIndicator();
      if (data.role === 'AGENT') {
        this.activeOperator = {
          name: data.sender || "Atendente Humano (AWS Connect)",
          role: "Central de Relacionamento AmCOn",
          avatar: "👩‍💼",
          status: "Conectado via Amazon Connect"
        };
        this.updateOperatorUI();
      }
      this.addBotMessage(data.content);
    });

    // 2. Indicador de digitação do atendente remoto na AWS
    window.amazonConnectBridge.onTyping((isTyping) => {
      if (isTyping) {
        this.showTypingIndicator();
      } else {
        this.removeTypingIndicator();
      }
    });

    // 3. Atualização de estado da conexão
    window.amazonConnectBridge.onConnectionChange((state) => {
      this.updateAWSBadge();
    });

    // 4. Encerramento do chat no Amazon Connect
    window.amazonConnectBridge.onChatEnded(() => {
      this.addBotMessage(`
        <div class="p-2.5 bg-slate-100 rounded-lg border border-slate-200 text-xs text-slate-600">
          Atendimento via Amazon Connect encerrado pelo operador. Se precisar de mais alguma coisa, basta enviar uma mensagem!
        </div>
      `);
    });
  }

  updateAWSBadge() {
    if (!this.awsBadgeBtn) return;
    const bridge = window.amazonConnectBridge;
    if (!bridge) return;

    const isConnected = bridge.isConnected;
    const isLive = bridge.config && bridge.config.enabled;

    if (isConnected && isLive) {
      if (this.awsStatusDot) this.awsStatusDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping";
      if (this.awsStatusText) this.awsStatusText.innerText = "AWS: Live";
      this.awsBadgeBtn.className = "text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded font-mono transition flex items-center gap-1 cursor-pointer hover:bg-emerald-500/30";
      this.awsBadgeBtn.title = "Amazon Connect Conectado em Tempo Real (Clique para ver/editar configs)";
    } else if (isConnected) {
      if (this.awsStatusDot) this.awsStatusDot.className = "w-1.5 h-1.5 rounded-full bg-teal-400";
      if (this.awsStatusText) this.awsStatusText.innerText = "AWS: Híbrido";
      this.awsBadgeBtn.className = "text-[10px] bg-teal-500/20 text-teal-200 border border-teal-400/40 px-2 py-0.5 rounded font-mono transition flex items-center gap-1 cursor-pointer hover:bg-teal-500/30";
      this.awsBadgeBtn.title = "Amazon Connect em modo Híbrido/Portas Abertas (Clique para ver/editar configs)";
    } else {
      if (this.awsStatusDot) this.awsStatusDot.className = "w-1.5 h-1.5 rounded-full bg-amber-400";
      if (this.awsStatusText) this.awsStatusText.innerText = "AWS Connect";
      this.awsBadgeBtn.className = "text-[10px] bg-amber-500/20 text-amber-200 border border-amber-400/40 px-2 py-0.5 rounded font-mono transition flex items-center gap-1 cursor-pointer hover:bg-amber-500/30";
      this.awsBadgeBtn.title = "Amazon Connect: Portas Prontas para Conectar (Clique para configurar)";
    }
  }

  openAwsModal() {
    if (!this.awsModal) return;
    const bridge = window.amazonConnectBridge;
    if (bridge && bridge.config) {
      const cfg = bridge.config;
      const enableCheck = document.getElementById('aws-config-enabled');
      const apiEndpoint = document.getElementById('aws-config-endpoint');
      const region = document.getElementById('aws-config-region');
      const instanceId = document.getElementById('aws-config-instance');
      const flowId = document.getElementById('aws-config-flow');

      if (enableCheck) enableCheck.checked = !!cfg.enabled;
      if (apiEndpoint) apiEndpoint.value = cfg.apiGatewayEndpoint || '';
      if (region) region.value = cfg.region || 'us-east-1';
      if (instanceId) instanceId.value = cfg.instanceId || '';
      if (flowId) flowId.value = cfg.contactFlowId || '';
    }
    this.awsModal.classList.remove('hidden');
  }

  closeAwsModal() {
    if (this.awsModal) this.awsModal.classList.add('hidden');
  }

  saveAmazonConnectForm() {
    const bridge = window.amazonConnectBridge;
    if (!bridge) return;

    const enableCheck = document.getElementById('aws-config-enabled');
    const apiEndpoint = document.getElementById('aws-config-endpoint');
    const region = document.getElementById('aws-config-region');
    const instanceId = document.getElementById('aws-config-instance');
    const flowId = document.getElementById('aws-config-flow');

    const updated = {
      enabled: enableCheck ? enableCheck.checked : false,
      apiGatewayEndpoint: apiEndpoint ? apiEndpoint.value.trim() : '',
      region: region ? region.value.trim() : 'us-east-1',
      instanceId: instanceId ? instanceId.value.trim() : '',
      contactFlowId: flowId ? flowId.value.trim() : ''
    };

    bridge.updateConfig(updated);
    this.updateAWSBadge();
    this.closeAwsModal();

    alert("✅ Configurações do Amazon Connect salvas com sucesso! As portas de integração estão prontas.");
  }

  async testAwsConnection() {
    const statusEl = document.getElementById('aws-test-status-box');
    if (statusEl) {
      statusEl.className = "p-3 rounded-xl border text-xs bg-sky-50 border-sky-200 text-sky-800 block";
      statusEl.innerHTML = "<span class='font-bold animate-pulse'>🔄 Testando handshake com Amazon Connect...</span>";
    }

    const bridge = window.amazonConnectBridge;
    if (!bridge) return;

    try {
      const session = await bridge.startChatSession({
        name: "Teste de Diagnóstico AmCOn",
        initialMessage: "Ping de verificação de portas de comunicação"
      });

      if (statusEl) {
        statusEl.className = "p-3 rounded-xl border text-xs bg-emerald-50 border-emerald-200 text-emerald-900 block";
        statusEl.innerHTML = `
          <strong>✅ Conexão Estabelecida com Sucesso!</strong><br>
          <span class="text-[11px] font-mono text-emerald-800">
            ContactId: ${session.contactId}<br>
            ParticipantId: ${session.participantId}<br>
            Status: Pronto para receber chamadas de chat e voz
          </span>
        `;
      }
      this.updateAWSBadge();
    } catch (err) {
      if (statusEl) {
        statusEl.className = "p-3 rounded-xl border text-xs bg-rose-50 border-rose-200 text-rose-900 block";
        statusEl.innerHTML = `<strong>✕ Erro ao conectar:</strong> ${err.message}`;
      }
    }
  }

  updateOperatorUI() {
    if (this.operatorNameEl) this.operatorNameEl.innerText = this.activeOperator.name;
    if (this.operatorRoleEl) this.operatorRoleEl.innerText = this.activeOperator.role;
    if (this.operatorAvatarEl) this.operatorAvatarEl.innerHTML = this.activeOperator.avatar;
  }

  // ==========================================================================
  // REPRODUÇÃO DE ÁUDIO & CONTROLES GERAIS
  // ==========================================================================
  playNotificationSound(type = 'incoming') {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'incoming') {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'outgoing') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.21);
      }
    } catch (e) {
      console.warn('Audio notification unavailable:', e);
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    if (this.soundBtn) {
      this.soundBtn.innerHTML = this.soundEnabled 
        ? `<svg class="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>`
        : `<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path></svg>`;
      this.soundBtn.title = this.soundEnabled ? 'Silenciar sons' : 'Ativar sons';
    }
  }

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    if (this.chatBox) {
      this.chatBox.classList.toggle('chat-maximized', this.isMaximized);
    }
    if (this.maximizeBtn) {
      this.maximizeBtn.innerHTML = this.isMaximized
        ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9L4 4m0 0l5 0M4 4l0 5m11 0l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5m16 5l-5-5m5 5l0-5m-5 5l5 0"></path></svg>`
        : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>`;
    }
  }

  toggleChat() {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  openChat() {
    this.isOpen = true;
    if (this.chatBox) {
      this.chatBox.classList.remove('chat-hidden');
    }
    if (this.unreadBadge) {
      this.unreadBadge.classList.add('hidden');
    }
    if (this.messageInput) {
      setTimeout(() => this.messageInput.focus(), 300);
    }
    this.scrollToBottom();
  }

  closeChat() {
    this.isOpen = false;
    if (this.chatBox) {
      this.chatBox.classList.add('chat-hidden');
    }
  }

  scrollToBottom() {
    if (this.messagesContainer) {
      setTimeout(() => {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }, 50);
    }
  }

  getCurrentTimeFormatted() {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  loadInitialGreeting() {
    const greetingHTML = `
      <p class="font-medium text-slate-800">
        Olá! Eu sou o <strong>AmCo Atendente</strong>, assistente virtual da <strong>AmCOn Saúde</strong>. 👋
      </p>
      <p class="mt-1 text-slate-600 text-xs">
        Como posso cuidar de você hoje? Escolha uma das opções rápidas abaixo ou digite sua dúvida:
      </p>
      
      <div class="quick-chips-wrapper">
        <button class="quick-chip" data-action="flow_telemedicina">
          <span>🩺</span> Triagem Médica 24h
        </button>
        <button class="quick-chip" data-action="flow_cotacao">
          <span>💰</span> Simular Planos & Preços
        </button>
        <button class="quick-chip" data-action="flow_carteirinha">
          <span>🪪</span> Carteirinha Digital
        </button>
        <button class="quick-chip" data-action="flow_boleto">
          <span>📄</span> 2ª Via Boleto / PIX
        </button>
        <button class="quick-chip" data-action="flow_rede">
          <span>🏥</span> Buscar Hospitais & Médicos
        </button>
        <button class="quick-chip" data-action="flow_humano">
          <span>👤</span> Falar com Consultor Humano (AWS Connect)
        </button>
      </div>
    `;

    this.addBotMessage(greetingHTML, false);
  }

  addBotMessage(contentHTML, playSound = true) {
    if (!this.messagesContainer) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg bot';
    msgEl.innerHTML = `
      <div class="chat-avatar bg-gradient-to-tr from-cyan-600 to-teal-500 shadow-sm">
        ${this.activeOperator.avatar}
      </div>
      <div class="max-w-[85%]">
        <div class="chat-bubble">
          ${contentHTML}
        </div>
        <div class="chat-time text-slate-400">
          ${this.activeOperator.name} • ${this.getCurrentTimeFormatted()}
        </div>
      </div>
    `;

    this.messagesContainer.appendChild(msgEl);
    this.scrollToBottom();

    if (playSound) {
      this.playNotificationSound('incoming');
    }
  }

  addUserMessage(text, isAudio = false, audioDuration = 0) {
    if (!this.messagesContainer) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg user';

    let bodyHTML = '';
    if (isAudio) {
      bodyHTML = `
        <div class="flex items-center gap-3 py-1">
          <button class="w-8 h-8 rounded-full bg-white text-sky-700 flex items-center justify-center shadow-sm hover:scale-105 transition" onclick="this.classList.toggle('bg-sky-100')">
            <svg class="w-4 h-4 ml-0.5 fill-current" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <div class="flex-1">
            <div class="h-1.5 w-28 bg-sky-300 rounded-full overflow-hidden">
              <div class="h-full bg-white w-2/3 rounded-full"></div>
            </div>
            <span class="text-[10px] text-sky-100 mt-1 block">Mensagem de voz • ${audioDuration}s</span>
          </div>
        </div>
      `;
    } else {
      bodyHTML = `<p>${this.escapeHTML(text)}</p>`;
    }

    msgEl.innerHTML = `
      <div class="chat-avatar bg-gradient-to-tr from-sky-600 to-blue-700 shadow-sm text-xs">
        Você
      </div>
      <div class="max-w-[85%]">
        <div class="chat-bubble">
          ${bodyHTML}
        </div>
        <div class="chat-time">
          ${this.getCurrentTimeFormatted()}
          <svg class="w-3.5 h-3.5 text-sky-200 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7m-14 6l4 4L19 7"></path>
          </svg>
        </div>
      </div>
    `;

    this.messagesContainer.appendChild(msgEl);
    this.scrollToBottom();
    this.playNotificationSound('outgoing');
  }

  showTypingIndicator() {
    if (this.isTyping) return;
    this.isTyping = true;

    const typingEl = document.createElement('div');
    typingEl.id = 'chat-typing-indicator';
    typingEl.className = 'chat-msg bot';
    typingEl.innerHTML = `
      <div class="chat-avatar bg-gradient-to-tr from-cyan-600 to-teal-500 shadow-sm text-xs">
        ${this.activeOperator.avatar}
      </div>
      <div>
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
        <span class="text-[10px] text-slate-400 ml-1 font-medium">${this.activeOperator.name} está digitando...</span>
      </div>
    `;

    this.messagesContainer.appendChild(typingEl);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const el = document.getElementById('chat-typing-indicator');
    if (el) el.remove();
    this.isTyping = false;
  }

  handleSendMessage() {
    if (!this.messageInput) return;
    const text = this.messageInput.value.trim();
    if (!text) return;

    this.addUserMessage(text);
    this.messageInput.value = '';
    this.sendBtn.disabled = true;

    // Encaminha a mensagem para o Amazon Connect Bridge se ativo
    if (window.amazonConnectBridge && window.amazonConnectBridge.isConnected && window.amazonConnectBridge.config.enabled) {
      window.amazonConnectBridge.sendMessage(text);
      return;
    }

    this.processUserTextInput(text);
  }

  // Gravação de Áudio Interativa
  startAudioRecording() {
    this.isRecording = true;
    this.recordingSeconds = 0;
    if (this.recordingBar) this.recordingBar.classList.remove('hidden');
    if (this.messageInput) this.messageInput.classList.add('hidden');
    if (this.sendBtn) this.sendBtn.classList.add('hidden');
    if (this.micBtn) this.micBtn.classList.add('hidden');

    this.recordingTimer = setInterval(() => {
      this.recordingSeconds++;
      const mins = Math.floor(this.recordingSeconds / 60).toString().padStart(2, '0');
      const secs = (this.recordingSeconds % 60).toString().padStart(2, '0');
      if (this.recordingTimeEl) this.recordingTimeEl.innerText = `${mins}:${secs}`;
    }, 1000);
  }

  cancelAudioRecording() {
    this.stopAudioTimer();
    this.restoreInputBar();
  }

  sendAudioRecording() {
    const duration = this.recordingSeconds || 1;
    this.stopAudioTimer();
    this.restoreInputBar();
    this.addUserMessage("", true, duration);

    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();
      this.addBotMessage(`
        <div class="flex items-center gap-2 text-teal-800 font-semibold mb-1">
          <svg class="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
          Áudio recebido e transcrito
        </div>
        <p class="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
          "Compreendi perfeitamente sua mensagem de voz. Já estou verificando os dados no sistema da operadora."
        </p>
        <p class="mt-2 text-xs text-slate-700">Como prefere prosseguir?</p>
        <div class="quick-chips-wrapper">
          <button class="quick-chip" data-action="flow_telemedicina">🩺 Iniciar Teleconsulta</button>
          <button class="quick-chip" data-action="flow_humano">👤 Falar com Especialista</button>
        </div>
      `);
    }, 1500);
  }

  stopAudioTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  restoreInputBar() {
    this.isRecording = false;
    if (this.recordingBar) this.recordingBar.classList.add('hidden');
    if (this.messageInput) this.messageInput.classList.remove('hidden');
    if (this.sendBtn) this.sendBtn.classList.remove('hidden');
    if (this.micBtn) this.micBtn.classList.remove('hidden');
  }

  handleFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const fileName = file.name;
    const fileSize = (file.size / 1024).toFixed(1) + ' KB';

    this.addUserMessage(`[Arquivo Anexado: ${fileName}]`);

    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();
      this.addBotMessage(`
        <div class="chat-interactive-card bg-teal-50 border-teal-200">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
              DOC
            </div>
            <div class="flex-1 min-w-0">
              <h5 class="text-xs font-bold text-slate-800 truncate">${this.escapeHTML(fileName)}</h5>
              <p class="text-[11px] text-teal-700">Tamanho: ${fileSize} • Upload Seguro Concluído</p>
            </div>
          </div>
        </div>
        <p class="mt-2 text-xs text-slate-700">
          Documento ou pedido médico registrado com sucesso! Nosso setor de auditoria médica já pode analisar para liberação de guias ou laudos.
        </p>
      `);
    }, 1200);

    this.fileInput.value = '';
  }

  // Processador NLP Inteligente em Português
  processUserTextInput(rawText) {
    const text = rawText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    this.showTypingIndicator();

    setTimeout(() => {
      this.removeTypingIndicator();

      // Reconhecimento de Emergência / Risco Vermelho
      if (text.includes('dor no peito') || text.includes('infarto') || text.includes('falta de ar') || text.includes('desmaio') || text.includes('sangramento grave')) {
        this.addBotMessage(`
          <div class="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900">
            <div class="flex items-center gap-2 font-bold text-sm text-rose-700">
              <span class="text-lg">🚨</span> ALERTA DE EMERGÊNCIA MÉDICA
            </div>
            <p class="text-xs mt-1 leading-relaxed">
              Os sintomas relatados podem indicar um quadro clínico urgente. Recomendamos procurar imediatamente a unidade de <strong>Pronto-Socorro mais próxima</strong> ou acionar o resgate:
            </p>
            <div class="mt-2 flex flex-col gap-1.5 font-semibold text-xs">
              <a href="tel:192" class="bg-rose-600 text-white py-1.5 px-3 rounded-lg text-center hover:bg-rose-700 transition">
                Ligar SAMU (192)
              </a>
              <a href="tel:08007702026" class="bg-white border border-rose-300 text-rose-700 py-1.5 px-3 rounded-lg text-center hover:bg-rose-50 transition">
                Central de Resgate AmCOn: 0800 770 2026
              </a>
            </div>
          </div>
        `);
        return;
      }

      // 1. Cotação / Preços
      if (text.includes('cotac') || text.includes('preco') || text.includes('quanto custa') || text.includes('valor') || text.includes('tabela') || text.includes('plano')) {
        this.startCotacaoFlow();
        return;
      }

      // 2. Telemedicina / Sintomas / Médico
      if (text.includes('dor') || text.includes('febre') || text.includes('gripe') || text.includes('medico') || text.includes('consulta') || text.includes('telemedicina') || text.includes('receita')) {
        this.startTelemedicinaFlow();
        return;
      }

      // 3. Carteirinha Digital
      if (text.includes('carteirin') || text.includes('cartao') || text.includes('identificacao') || text.includes('app')) {
        this.startCarteirinhaFlow();
        return;
      }

      // 4. 2ª Via Boleto / PIX
      if (text.includes('boleto') || text.includes('pix') || text.includes('fatura') || text.includes('pagar') || text.includes('segunda via') || text.includes('2 via')) {
        this.startBoletoFlow();
        return;
      }

      // 5. Rede Credenciada / Hospitais
      if (text.includes('hospital') || text.includes('clinica') || text.includes('laboratorio') || text.includes('rede') || text.includes('onde ir') || text.includes('especialista')) {
        this.startRedeFlow();
        return;
      }

      // 6. Atendente Humano (Dispara sessão no Amazon Connect)
      if (text.includes('humano') || text.includes('atendente') || text.includes('falar com pessoa') || text.includes('consultor') || text.includes('operador') || text.includes('connect')) {
        this.startHumanoFlow("Cliente solicitou atendimento humano via mensagem de texto");
        return;
      }

      // 7. Carência / Portabilidade
      if (text.includes('carencia') || text.includes('portabilidade') || text.includes('trocar de plano')) {
        this.addBotMessage(`
          <div class="text-xs text-slate-800 space-y-2">
            <p class="font-bold text-sky-800 text-sm">Informações sobre Carência & Portabilidade:</p>
            <p>• <strong>Urgência e Emergência:</strong> 24 horas</p>
            <p>• <strong>Consultas e Exames Simples:</strong> 30 dias (ou <strong>Zero Carência</strong> em campanhas vigentes)</p>
            <p>• <strong>Portabilidade de outro plano:</strong> Redução ou isenção total de carências sem custo adicional!</p>
            <div class="mt-3">
              <button class="quick-chip" data-action="flow_cotacao">Quero Isenção de Carência</button>
              <button class="quick-chip" data-action="flow_humano">Falar com Consultor</button>
            </div>
          </div>
        `);
        return;
      }

      // Resposta padrão
      this.addBotMessage(`
        <p class="text-xs text-slate-700">
          Entendi sua solicitação! Como sou um assistente especializado em saúde e planos da <strong>AmCOn</strong>, veja qual dos serviços abaixo melhor resolve sua necessidade:
        </p>
        <div class="quick-chips-wrapper mt-2">
          <button class="quick-chip" data-action="flow_telemedicina">🩺 Fazer Triagem Médica</button>
          <button class="quick-chip" data-action="flow_cotacao">💰 Ver Tabela de Planos</button>
          <button class="quick-chip" data-action="flow_carteirinha">🪪 Emitir Carteirinha</button>
          <button class="quick-chip" data-action="flow_boleto">📄 2ª Via de Pagamento</button>
          <button class="quick-chip" data-action="flow_humano">👤 Falar com Humano (AWS Connect)</button>
        </div>
      `);
    }, 900);
  }

  handleQuickAction(action, value) {
    if (action === 'flow_cotacao') {
      this.addUserMessage("Quero simular planos e ver valores");
      this.startCotacaoFlow();
    } else if (action === 'flow_telemedicina') {
      this.addUserMessage("Acessar Telemedicina e Triagem 24h");
      this.startTelemedicinaFlow();
    } else if (action === 'flow_carteirinha') {
      this.addUserMessage("Consultar minha Carteirinha Digital");
      this.startCarteirinhaFlow();
    } else if (action === 'flow_boleto') {
      this.addUserMessage("Gerar 2ª via de Boleto ou chave PIX");
      this.startBoletoFlow();
    } else if (action === 'flow_rede') {
      this.addUserMessage("Consultar a Rede Credenciada");
      this.startRedeFlow();
    } else if (action === 'flow_humano') {
      this.addUserMessage("Falar com um atendente humano");
      this.startHumanoFlow();
    } else if (action === 'select_plan_profile') {
      this.addUserMessage(value);
      this.showPlansForProfile(value);
    } else if (action === 'select_symptom') {
      this.addUserMessage(value);
      this.processSymptomSelection(value);
    }
  }

  handleActionCardClick(action, value) {
    if (action === 'copy_pix') {
      navigator.clipboard.writeText("00020126580014BR.GOV.BCB.PIX0136amcon-saude-recebimentos@pix.banco.br5204000053039865406289.905802BR5916AMCON SAUDE S/A6009SAO PAULO62070503***63041D2A");
      alert("✅ Chave Copia e Cola PIX copiada com sucesso para a sua área de transferência!");
    } else if (action === 'download_carteirinha') {
      alert("📥 Gerando PDF de alta resolução da sua Carteirinha AmCOn Digital com QR Code ICP...");
    } else if (action === 'entrar_teleconsulta') {
      alert("🩺 Conectando com a Sala Virtual Segura... O médico Dr. Lucas Arantes está a postos!");
    } else if (action === 'contratar_plano') {
      this.addUserMessage(`Tenho interesse no plano ${value}`);
      this.startHumanoFlow(`O cliente quer contratar o plano ${value}`);
    }
  }

  // 1. FLUXO DE COTAÇÃO INTERATIVA
  startCotacaoFlow() {
    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();
      this.addBotMessage(`
        <p class="font-semibold text-slate-800 text-xs">Perfeito! Nossos planos contam com cobertura nacional, telemedicina 24h e reembolso ágil.</p>
        <p class="mt-1 text-xs text-slate-600">Para qual perfil você gostaria de simular?</p>
        <div class="quick-chips-wrapper">
          <button class="quick-chip" data-action="select_plan_profile" data-value="Individual (Para Mim)">
            👤 Individual
          </button>
          <button class="quick-chip" data-action="select_plan_profile" data-value="Familiar (Com Dependentes)">
            👨‍👩‍👧 Familiar
          </button>
          <button class="quick-chip" data-action="select_plan_profile" data-value="Empresarial (PME a partir de 2 vidas)">
            🏢 Empresarial (CNPJ / MEI)
          </button>
          <button class="quick-chip" data-action="select_plan_profile" data-value="Sênior 60+ (Cuidado Especializado)">
            👵 Sênior 60+
          </button>
        </div>
      `);
    }, 700);
  }

  showPlansForProfile(profile) {
    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();
      this.addBotMessage(`
        <p class="text-xs text-slate-700">Encontrei 2 opções ideais para o perfil <strong>${this.escapeHTML(profile)}</strong>:</p>

        <!-- Card Plano 1 -->
        <div class="chat-interactive-card border-sky-200 bg-sky-50/50 mt-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-sky-900">AmCOn Conforto Plus</span>
            <span class="bg-sky-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Mais Escolhido</span>
          </div>
          <div class="text-lg font-black text-slate-900 mt-1">
            R$ 299,90 <span class="text-[11px] font-normal text-slate-500">/mês</span>
          </div>
          <ul class="text-[11px] text-slate-600 mt-2 space-y-1">
            <li>✓ Cobertura Nacional Completa</li>
            <li>✓ Acomodação em Quarto Individual</li>
            <li>✓ Telemedicina 24/7 sem coparticipação</li>
            <li>✓ Reembolso de consultas em 48h</li>
          </ul>
          <button data-chat-action="contratar_plano" data-chat-value="AmCOn Conforto Plus" class="mt-3 w-full bg-sky-600 hover:bg-sky-700 text-white py-1.5 px-3 rounded-lg text-xs font-semibold shadow-sm transition">
            Quero Este Plano
          </button>
        </div>

        <!-- Card Plano 2 -->
        <div class="chat-interactive-card border-slate-200 bg-white mt-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-800">AmCOn Essencial Regional</span>
            <span class="text-[11px] text-emerald-600 font-bold">Econômico</span>
          </div>
          <div class="text-lg font-black text-slate-900 mt-1">
            R$ 189,00 <span class="text-[11px] font-normal text-slate-500">/mês</span>
          </div>
          <ul class="text-[11px] text-slate-600 mt-2 space-y-1">
            <li>✓ Rede regional de excelência</li>
            <li>✓ Consultas, exames e cirurgias</li>
            <li>✓ Desconto de até 70% em farmácias</li>
          </ul>
          <button data-chat-action="contratar_plano" data-chat-value="AmCOn Essencial Regional" class="mt-3 w-full bg-slate-800 hover:bg-slate-900 text-white py-1.5 px-3 rounded-lg text-xs font-semibold shadow-sm transition">
            Quero Este Plano
          </button>
        </div>

        <p class="text-[11px] text-slate-500 mt-2 text-center">Deseja receber uma proposta formal detalhada em PDF?</p>
      `);
    }, 800);
  }

  // 2. FLUXO DE TELEMEDICINA & TRIAGEM DE SINTOMAS
  startTelemedicinaFlow() {
    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();
      this.addBotMessage(`
        <div class="flex items-center gap-2 text-sky-800 font-bold text-xs mb-1">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Pronto-Atendimento Virtual 24h Ativo
        </div>
        <p class="text-xs text-slate-700">
          Tempo médio de espera no momento: <strong>< 4 minutos</strong>.
        </p>
        <p class="text-xs text-slate-600 mt-1">Qual o principal motivo ou sintoma da consulta?</p>

        <div class="quick-chips-wrapper">
          <button class="quick-chip" data-action="select_symptom" data-value="Sintomas Gripais / Resfriado / Tosse">
            🤧 Sintomas Gripais / Tosse
          </button>
          <button class="quick-chip" data-action="select_symptom" data-value="Febre ou Dores no Corpo">
            🤒 Febre ou Dor no Corpo
          </button>
          <button class="quick-chip" data-action="select_symptom" data-value="Dor de Cabeça / Enxaqueca">
            🤕 Dor de Cabeça
          </button>
          <button class="quick-chip" data-action="select_symptom" data-value="Problemas de Pele / Alergia">
            🌿 Pele ou Alergia
          </button>
          <button class="quick-chip" data-action="select_symptom" data-value="Renovação de Receita / Atestado">
            💊 Renovação de Receita
          </button>
        </div>
      `);
    }, 700);
  }

  processSymptomSelection(symptom) {
    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();
      this.addBotMessage(`
        <div class="chat-interactive-card bg-emerald-50 border-emerald-200">
          <div class="flex items-center gap-2 font-bold text-emerald-900 text-xs">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Triagem Pré-Clínica Finalizada
          </div>
          <p class="text-[11px] text-slate-700 mt-1">
            Queixa: <strong>${this.escapeHTML(symptom)}</strong>.<br>
            Você foi direcionado para a fila de atendimento da <strong>Clínica Geral</strong>.
          </p>
          <div class="mt-3 p-2 bg-white rounded-lg border border-emerald-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                MD
              </div>
              <div>
                <p class="text-xs font-bold text-slate-800">Dr. Lucas Mendes</p>
                <p class="text-[10px] text-slate-500">CRM 149.882-SP • Plantonista</p>
              </div>
            </div>
            <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Livre</span>
          </div>
          <button data-chat-action="entrar_teleconsulta" class="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            Iniciar Consulta por Vídeo Agora
          </button>
        </div>
      `);
    }, 800);
  }

  // 3. FLUXO DE CARTEIRINHA DIGITAL
  startCarteirinhaFlow() {
    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();
      this.addBotMessage(`
        <p class="text-xs text-slate-700 mb-2">Aqui está sua <strong>Carteirinha Digital AmCOn</strong> válida em todo o território nacional:</p>
        
        <div class="digital-health-card">
          <div class="flex justify-between items-start">
            <div>
              <span class="text-[10px] uppercase tracking-wider text-cyan-200 font-bold">Plano de Saúde</span>
              <h4 class="text-base font-black text-white tracking-wide">AmCOn Saúde</h4>
            </div>
            <span class="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-mono">ANS: 42.198-7</span>
          </div>

          <div class="mt-4">
            <p class="text-[11px] text-cyan-100">Beneficiário:</p>
            <p class="text-sm font-bold text-white tracking-wider">CARLOS EDUARDO SILVA</p>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span class="text-cyan-200">Matrícula:</span>
              <p class="font-mono font-bold text-white text-xs">884.209.112-01</p>
            </div>
            <div>
              <span class="text-cyan-200">Acomodação:</span>
              <p class="font-bold text-white">Apartamento Individual</p>
            </div>
            <div>
              <span class="text-cyan-200">Segmentação:</span>
              <p class="font-bold text-white">Amb + Hosp + Obst</p>
            </div>
            <div>
              <span class="text-cyan-200">Validade:</span>
              <p class="font-bold text-white">11/2028</p>
            </div>
          </div>

          <div class="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-[10px]">
            <span class="text-cyan-200 font-mono">CNS: 708.204.991.002</span>
            <span class="text-emerald-300 font-bold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Ativo
            </span>
          </div>
        </div>

        <div class="mt-3 flex gap-2">
          <button data-chat-action="download_carteirinha" class="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Baixar PDF (Wallet)
          </button>
        </div>
      `);
    }, 700);
  }

  // 4. FLUXO DE 2ª VIA DE BOLETO & PIX
  startBoletoFlow() {
    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();
      this.addBotMessage(`
        <div class="chat-interactive-card border-amber-200 bg-amber-50/50">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-900">Mensalidade em Aberto</span>
            <span class="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded font-bold">Vencendo Hoje</span>
          </div>
          <div class="text-base font-black text-slate-800 mt-2">
            R$ 299,90
          </div>
          <p class="text-[11px] text-slate-600 mt-1">Competência: <strong>Novembro / 2026</strong> • Beneficiário: Carlos Eduardo Silva</p>
          
          <div class="mt-3 p-2 bg-white rounded border border-amber-200">
            <p class="text-[10px] text-slate-500 font-semibold mb-1">Chave Pix Copia e Cola:</p>
            <div class="font-mono text-[9px] text-slate-700 bg-slate-100 p-1.5 rounded break-all select-all">
              00020126580014BR.GOV.BCB.PIX0136amcon-saude-recebimentos@pix.banco.br5204000053039865406289.90
            </div>
            <button data-chat-action="copy_pix" class="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2 rounded text-xs flex items-center justify-center gap-1 transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              Copiar Código Pix
            </button>
          </div>

          <a href="#" onclick="alert('Download do boleto bancário bancado pelo Banco Itaú S.A.'); return false;" class="mt-2 text-center block text-sky-700 text-xs font-semibold hover:underline">
            Baixar Boleto Bancário em PDF 📄
          </a>
        </div>
      `);
    }, 700);
  }

  // 5. FLUXO DE REDE CREDENCIADA
  startRedeFlow() {
    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();
      this.addBotMessage(`
        <p class="text-xs text-slate-700">Aqui estão os hospitais e centros de diagnóstico credenciados mais procurados:</p>
        
        <div class="space-y-2 mt-2">
          <div class="p-2.5 bg-white border border-slate-200 rounded-lg text-xs">
            <div class="flex justify-between items-start">
              <span class="font-bold text-slate-800">Hospital Samaritano & Pronto-Socorro</span>
              <span class="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 rounded">24h Aberto</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">Av. Paulista, 1800 - Bela Vista • 1.4 km</p>
            <p class="text-[10px] text-sky-700 mt-1 font-medium">Pronto-Socorro Adulto, Infantil e Maternidade</p>
          </div>

          <div class="p-2.5 bg-white border border-slate-200 rounded-lg text-xs">
            <div class="flex justify-between items-start">
              <span class="font-bold text-slate-800">Laboratório Fleury / A+ Medicina</span>
              <span class="text-[10px] text-sky-600 font-bold bg-sky-50 px-1.5 rounded">Exames & Imagem</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">Rua Oscar Freire, 920 - Jardins • 2.8 km</p>
            <p class="text-[10px] text-sky-700 mt-1 font-medium">Ressonância, Tomografia, Sangue e Genética</p>
          </div>
        </div>

        <p class="text-[11px] text-slate-500 mt-2">Precisa agendar uma especialidade específica como Pediatria ou Ortopedia?</p>
      `);
    }, 700);
  }

  // 6. TRANSFERÊNCIA PARA ATENDENTE HUMANO (INTEGRAÇÃO COM AMAZON CONNECT)
  startHumanoFlow(customContext = "") {
    this.showTypingIndicator();
    setTimeout(() => {
      this.removeTypingIndicator();

      // Inicia sessão no Amazon Connect
      if (window.amazonConnectBridge) {
        window.amazonConnectBridge.startChatSession({
          name: "Beneficiário AmCOn",
          initialMessage: customContext || "Cliente solicitou atendimento humano no portal AmCOn Saúde",
          customAttributes: {
            Origem: "Portal_Web_AmCOn",
            Motivo: "Atendimento_Humano",
            FilaSugerida: "Fila_Geral_AmCOn"
          }
        });
      }

      this.addBotMessage(`
        <div class="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-slate-800">
          <div class="flex items-center gap-2 font-bold text-sky-900 mb-1">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            Transferindo para Atendimento Humano via Amazon Connect...
          </div>
          <p class="text-slate-600">
            Você é o <strong>1º da fila</strong>. Conectando com nossa consultora especialista em planos de saúde.
          </p>
        </div>
      `);

      // Transição visual do operador
      setTimeout(() => {
        this.activeOperator = {
          name: "Camila Duarte",
          role: "Especialista AmCOn • Amazon Connect",
          avatar: "👩‍💼",
          status: "Conectada • Atendimento Humano"
        };
        this.updateOperatorUI();

        this.addBotMessage(`
          <p class="text-xs text-slate-800">
            Olá! Me chamo <strong>Camila Duarte</strong> e assumi seu atendimento via Amazon Connect agora. Já estou com todo o histórico da conversa na tela.
          </p>
          <p class="mt-1 text-xs text-slate-700">
            ${customContext ? customContext + ". " : ""}Como posso te apoiar hoje? Se preferir, também posso te ligar ou mandar a proposta por WhatsApp!
          </p>
        `);
      }, 2200);
    }, 600);
  }

  resetConversation() {
    if (confirm("Deseja reiniciar a conversa do chat?")) {
      if (this.messagesContainer) {
        this.messagesContainer.innerHTML = '';
      }
      if (window.amazonConnectBridge && window.amazonConnectBridge.isConnected) {
        window.amazonConnectBridge.endChat();
      }
      this.activeOperator = {
        name: "AmCo Atendente",
        role: "Assistente Virtual & Triagem AmCOn",
        avatar: "🩺",
        status: "Online agora • Resposta imediata"
      };
      this.updateOperatorUI();
      this.loadInitialGreeting();
    }
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
}

// Inicializar quando o documento carregar
document.addEventListener('DOMContentLoaded', () => {
  window.amconChat = new AmCOnChatEngine();
});
