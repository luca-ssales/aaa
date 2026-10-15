import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================
// 1. CONFIGURAÇÕES DE AMBIENTE E CAMINHOS
// ============================================================
const __filename = fileURLToPath(import.meta.url);
const BASE_DIR = path.dirname(__filename);
const PROMPT_PATH = path.join(BASE_DIR, 'prompt.txt');
const PUBLIC_DIR = path.join(BASE_DIR, 'public');

// Carrega as variáveis do arquivo .env
function carregarEnv() {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile();
    }
  } catch {
    // Caso process.loadEnvFile não esteja disponível, usa fallback manual
  }

  const envPath = path.join(BASE_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        val = val.trim().replace(/^['"](.*)['"]$/, '$1');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

carregarEnv();

// ============================================================
// 2. FUNÇÕES DO AGENTE
// ============================================================
export function carregarPrompt() {
  if (!fs.existsSync(PROMPT_PATH)) {
    throw new Error('O arquivo prompt.txt não foi encontrado.');
  }
  return fs.readFileSync(PROMPT_PATH, 'utf-8').trim();
}

export async function executarAgente(historicoMensagens) {
  const promptSistema = carregarPrompt();

  const mensagens = [
    { role: 'system', content: promptSistema },
    ...historicoMensagens,
  ];

  // ==========================================================
  // CONFIGURAÇÃO DA CHAVE DE API
  // A chave é obtida automaticamente do arquivo .env (GROQ_API_KEY)
  // ==========================================================
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey || apiKey === 'SUA-CHAVE-AQUI') {
    throw new Error('Chave GROQ_API_KEY não configurada! Adicione sua chave no arquivo .env.');
  }

  const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',  // Altere aqui para outro modelo se desejar (ex: llama-3.3-70b-versatile)
      messages: mensagens,
    }),
  });

  if (!resposta.ok) {
    const erroTexto = await resposta.text();
    throw new Error(`Erro na API Groq (${resposta.status}): ${erroTexto}`);
  }

  const dados = await resposta.json();
  return dados.choices?.[0]?.message?.content || '';
}

// ============================================================
// 3. SERVIDOR HTTP (ENTREGA HTML/CSS/JS E ROTA DE CHAT)
// ============================================================
const PORT = process.env.PORT || 3000;

// Tipos MIME para os arquivos estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  // Rota da API de Chat
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const historico = Array.isArray(payload.messages) ? payload.messages : [];
        const resposta = await executarAgente(historico);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ role: 'assistant', content: resposta }));
      } catch (erro) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: erro.message }));
      }
    });
    return;
  }

  // Roteamento de Arquivos Estáticos (HTML, CSS, JS)
  if (req.method === 'GET') {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/' || urlPath === '') {
      urlPath = '/index.html';
    }

    // Tenta encontrar o arquivo na pasta public/ ou na pasta raiz
    let filePath = path.join(PUBLIC_DIR, urlPath);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(BASE_DIR, urlPath);
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Arquivo não encontrado');
});

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun || !process.env.TEST_MODE) {
  server.listen(PORT, () => {
    console.log('====================================================');
    console.log('🤖 Agente IA Base (JavaScript) rodando!');
    console.log(`🌐 Acesse no seu navegador: http://localhost:${PORT}`);
    console.log('====================================================');
  });
}

export { server };

