# AmCOn Saúde — Frontend & Chatbot Concierge 24/7

Frontend moderno, profissional e de alta performance desenvolvido para a **AmCOn Saúde** (Planos de Saúde Individuais, Familiares, Empresariais e Sênior), com sistema integrado e interativo de **Chat Concierge & Triagem Clínica 24/7 (Dra. Sofia)**.

---

## 🚀 Como Executar

Este projeto foi construído para funcionar com **Zero Dependências** locais. Não é necessário ter Node.js, Python ou ferramentas de build instaladas para executá-lo.

1. Navegue até a pasta do projeto:
   ```
   c:\Users\PoSa\Documents\ProjetoAmCOnPlan
   ```
2. Dê um duplo clique no arquivo **`index.html`** para abrir em qualquer navegador moderno (Google Chrome, Microsoft Edge, Firefox, Safari, Opera).
3. Ou abra via terminal PowerShell:
   ```powershell
   Start-Process index.html
   ```

---

## 🩺 Destaques do Sistema de Chat (Dra. Sofia & Concierge 24/7)

A interface e motor do chat foram construídos para entregar a melhor experiência de atendimento em saúde do mercado:

### 1. **Triagem Clínica & Pronto-Atendimento 24h**
- **Protocolo de Sintomas:** Triage sintomas comuns (febre, gripe, tosse, cefaleia, dermatologia, etc.).
- **Detecção de Emergência Vermelha (Red Flags):** Se o paciente relata sintomas graves (dor aguda no peito, falta de ar severa, desmaio), o bot emite um alerta em destaque com telefones diretos de resgate (SAMU 192 e Central de Urgência AmCOn 0800 770 2026).
- **Sala Virtual de Consulta:** Para casos estáveis, direciona para a fila médica em menos de 4 minutos com plantonista identificado (ex: Dr. Lucas Mendes - CRM 149.882-SP).

### 2. **Simulador de Planos Integrado no Chat**
- Seleção de perfil (Individual, Familiar, PME ou Sênior).
- Apresentação de **mini-cards interativos** diretamente dentro das bolhas de conversa com preço por faixa etária, cobertura e botão direto de contratação.

### 3. **Carteirinha Digital Interativa (Virtual Health Card)**
- Gera instantaneamente a carteirinha do beneficiário com design holográfico, matrícula, segmentação assistencial (Amb + Hosp + Obst), acomodação e botão para download do cartão em PDF/Wallet.

### 4. **2ª Via de Fatura & PIX Copia e Cola**
- Simulação de mensalidade em aberto com vencimento, valor, código de barras bancário e botão para **copiar chave PIX em 1 clique** com feedback visual.

### 5. **Transferência Realista para Especialista Humano**
- Simulação de fila de espera e passagem de bastão: o operador muda para a consultora **Camila Duarte**, atualizando foto de perfil, cargo e status de atendimento.

### 6. **Simulação de Mensagem de Voz (Áudio)**
- Botão de microfone interativo com cronômetro em tempo real, cancelamento ou envio com player de áudio estilizado e transcrição automática pelo assistente.

### 7. **Upload & Envio de Pedidos Médicos e Laudos**
- Botão de clipe de papel para anexar exames, laudos e receitas para autorização prévia de guias.

### 8. **Feedback Sonoro via Web Audio API Nativo**
- Notificações acústicas bi-tonais suaves sintetizadas nativamente no navegador, sem requisições HTTP externas e com botão de mute no cabeçalho.

---

## ⚡ Portas de Conexão com o Amazon Connect

O front-end conta com uma camada de integração dedicada (`js/amazon-connect.js`) estruturada para conexão com o **Amazon Connect** (AWS):

### 1. **Arquitetura de Conexão**
- **Sessão do Chat:** Dispara a chamada para a API Gateway / AWS Lambda (`StartChatContact`), enviando nome do cliente, mensagem inicial e atributos dinâmicos (`Origem`, `FilaPrioritaria`, `TipoCliente`).
- **WebSocket em Tempo Real:** Conecta ao Participant Service da AWS Connect com suporte a eventos de digitação (`application/vnd.amazonaws.connect.event.typing`), entrega de mensagens de agentes humanos no CCP e encerramento.
- **Painel de Configuração Rápida:** No cabeçalho do chat, há um badge **"⚡ AWS Connect"** que abre uma janela modal para inserir as credenciais da AWS (Região, Instance ID, Contact Flow ID e URL do API Gateway) com persistência automática no `localStorage`.
- **Modo Híbrido com Fallback Gracioso:** Mesmo sem uma conta AWS configurada de imediato, o chat funciona 100% de ponta a ponta simulando as portas do Amazon Connect para desenvolvimento e homologação.

### 2. **Código AWS Lambda Backend de Referência**
Para conectar sua instância real do Amazon Connect, basta criar uma função Lambda associada a um API Gateway (POST) com o seguinte código:

```javascript
const { ConnectClient, StartChatContactCommand } = require("@aws-sdk/client-connect");
const connect = new ConnectClient({ region: process.env.AWS_REGION || "us-east-1" });

exports.handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const params = {
    InstanceId: process.env.CONNECT_INSTANCE_ID || body.InstanceId,
    ContactFlowId: process.env.CONNECT_CONTACT_FLOW_ID || body.ContactFlowId,
    ParticipantDetails: { DisplayName: body.ParticipantDetails?.DisplayName || "Cliente AmCOn" },
    Attributes: body.Attributes || {},
    InitialMessage: body.InitialMessage
  };
  const command = new StartChatContactCommand(params);
  const response = await connect.send(command);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST,OPTIONS"
    },
    body: JSON.stringify({
      ContactId: response.ContactId,
      ParticipantId: response.ParticipantId,
      ParticipantToken: response.ParticipantToken
    })
  };
};
```

---

## 🏥 Funcionalidades da Landing Page Principal

- **Barra Regulatória Superior:** Registro ANS nº 42.198-7, telefone SAC 0800 e atalho para o Pronto-Atendimento Virtual.
- **Hero Impactante com Cotação Expressa:** Headline de autoridade, selos de qualidade (ANS Ouro, 4.9 estrelas, +650 mil vidas) e simulador rápido.
- **Alternador de Coparticipação Dinâmico:** Atualiza os preços de todos os planos em tempo real na tela (-30% de economia com coparticipação inteligente).
- **Abas de Perfis:** Alternância fluida entre planos para Pessoas Físicas, PME (2 a 29 vidas), Grandes Contratos e Sênior 60+.
- **Rede Credenciada Explorer:** Busca interativa em tempo real com filtros por nome, especialidade médica e tipo de estabelecimento (Hospitais, Clínicas, Laboratórios).
- **Showcase de Telemedicina 24/7:** Mockup de chamada de vídeo de alta fidelidade com estatísticas de tempo de espera (< 4 minutos) e validade de receitas com certificado digital ICP-Brasil.
- **Calculadora / Simulador Passo a Passo:** Adição dinâmica de múltiplos beneficiários por faixas etárias, cálculo de desconto familiar progressivo e seleção de acomodação (Apartamento vs Enfermaria).
- **FAQ Interativo com Busca:** Acordeão com filtro de pesquisa instantâneo.
- **Espaço do Beneficiário (Modal):** Painel de login com abas para Beneficiário, RH da Empresa e Corretor credenciado.

---

## 📁 Estrutura de Arquivos

```
ProjetoAmCOnPlan/
├── index.html        # Estrutura semântica completa e componentes
├── css/
│   └── styles.css    # Estilização médica, animações, carteirinha digital e chat
├── js/
│   ├── app.js        # Lógica da landing page (simulador, filtros de rede, FAQ, modais)
│   └── chat.js       # Motor completo do chat com máquina de estados e triagem clínica
└── README.md         # Documentação e guia de uso
```

---

## 🎨 Paleta de Cores & Design System

- **Navy Primário (`#0A192F`, `#0B2545`):** Solidez, credibilidade e autoridade médica.
- **Sky & Cyan (`#0284C7`, `#38BDF8`):** Clareza, tecnologia e bem-estar.
- **Emerald & Teal (`#10B981`, `#0D9488`):** Saúde, agilidade e vitalidade.
- **Tipografia:** `Plus Jakarta Sans` (Google Fonts).

---
*AmCOn Saúde — Viva com Tranquilidade e Cuidado Completo.*

