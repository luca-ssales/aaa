// ============================================================
// LÓGICA DO FRONTEND (CLIENT-SIDE JAVASCRIPT)
// ============================================================

const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const errorAlert = document.getElementById('error-alert');

// Histórico de mensagens mantido na sessão do navegador
let messages = [];

// Ajusta a altura da caixa de texto conforme o usuário digita
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
});

// Envia ao pressionar Enter (Shift+Enter pula linha)
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviarMensagem();
  }
});

sendBtn.addEventListener('click', enviarMensagem);

function rolarParaOFim() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Renderiza um balão de mensagem no chat
function renderizarMensagem(role, content) {
  const row = document.createElement('div');
  row.className = 'message-row ' + role;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '👤' : '📢';

  const bubble = document.createElement('div');
  bubble.className = 'message-content';
  bubble.textContent = content;

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatContainer.appendChild(row);
  rolarParaOFim();
  return row;
}

// Exibe animação de "pensando..."
function mostrarIndicadorDigitando() {
  const row = document.createElement('div');
  row.id = 'typing-indicator-row';
  row.className = 'message-row assistant';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '📢';

  const bubble = document.createElement('div');
  bubble.className = 'message-content typing-indicator';
  bubble.style.display = 'flex';
  bubble.innerHTML = 'Agente está pensando... <div class="typing-dots"><span></span><span></span><span></span></div>';

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatContainer.appendChild(row);
  rolarParaOFim();
}

// Remove animação de "pensando..."
function removerIndicadorDigitando() {
  const row = document.getElementById('typing-indicator-row');
  if (row) row.remove();
}

// Função principal de envio e comunicação com a API
async function enviarMensagem() {
  const texto = userInput.value.trim();
  if (!texto) return;

  errorAlert.style.display = 'none';

  // 1. Adiciona a mensagem do usuário ao histórico e à tela
  messages.push({ role: 'user', content: texto });
  renderizarMensagem('user', texto);

  // Limpa e desativa temporariamente o campo
  userInput.value = '';
  userInput.style.height = 'auto';
  userInput.disabled = true;
  sendBtn.disabled = true;

  // 2. Mostra indicador de carregamento
  mostrarIndicadorDigitando();

  try {
    // Comunicação com o backend Node.js
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });

    const data = await response.json();
    removerIndicadorDigitando();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Erro inesperado na resposta da API.');
    }

    // 3. Adiciona a resposta do assistente ao histórico e à tela
    const respostaAgente = data.content;
    messages.push({ role: 'assistant', content: respostaAgente });
    renderizarMensagem('assistant', respostaAgente);

  } catch (err) {
    removerIndicadorDigitando();
    errorAlert.textContent = 'Erro ao executar o agente: ' + err.message;
    errorAlert.style.display = 'block';
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
    rolarParaOFim();
  }
}

