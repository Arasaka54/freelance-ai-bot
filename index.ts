import { appendFileSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ==================== CONFIG ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if exists
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0 && !key.startsWith('#')) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

// Configuration from environment
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const LOG_FILE = join(__dirname, 'bot.log');
const LEARNING_FILE = join(DATA_DIR, 'learning.json');

// Check required tokens
if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_TOKEN not set! Create .env file with your token.');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set! Create .env file with your API key.');
  console.error('Get your key at: https://platform.openai.com/api-keys');
  process.exit(1);
}

const MAX_FIX_ATTEMPTS = 5;
const MIN_SCORE = 7;

// ==================== ENSURE DATA DIR ====================
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ==================== LOGGING ====================
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
  console.log(logLine.trim());
  try { appendFileSync(LOG_FILE, logLine); } catch {}
}

// ==================== LEARNING SYSTEM ====================
interface LearningEntry {
  id: string;
  taskType: string;
  description: string;
  code: string;
  score: number;
  issues: string[];
  success: boolean;
  createdAt: string;
}

interface LearningData {
  successes: LearningEntry[];
  failures: LearningEntry[];
  patterns: Record<string, string[]>;
}

function loadLearning(): LearningData {
  try {
    if (existsSync(LEARNING_FILE)) {
      return JSON.parse(readFileSync(LEARNING_FILE, 'utf-8'));
    }
  } catch (e) {
    log('WARN', 'Could not load learning data');
  }
  return { successes: [], failures: [], patterns: {} };
}

function saveLearning(data: LearningData) {
  try {
    writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    log('ERROR', 'Could not save learning data', e);
  }
}

function addLearningEntry(entry: LearningEntry) {
  const data = loadLearning();
  
  if (entry.success) {
    data.successes.push(entry);
    if (data.successes.length > 50) data.successes = data.successes.slice(-50);
  } else {
    data.failures.push(entry);
    if (data.failures.length > 30) data.failures = data.failures.slice(-30);
  }
  
  if (!data.patterns[entry.taskType]) {
    data.patterns[entry.taskType] = [];
  }
  if (entry.success && entry.issues.length === 0) {
    data.patterns[entry.taskType].push(entry.description.substring(0, 100));
  }
  
  saveLearning(data);
  log('INFO', `Learning saved`, { success: entry.success, total: data.successes.length + data.failures.length });
}

function getSimilarSuccess(taskType: string, description: string): LearningEntry | null {
  const data = loadLearning();
  const descWords = description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  for (const entry of [...data.successes].reverse()) {
    if (entry.taskType === taskType) {
      const entryWords = entry.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const commonWords = descWords.filter(w => entryWords.includes(w));
      if (commonWords.length >= 3) {
        log('INFO', `Found similar success`, { commonWords: commonWords.slice(0, 5) });
        return entry;
      }
    }
  }
  return null;
}

function getCommonIssues(taskType: string): string[] {
  const data = loadLearning();
  const issues: string[] = [];
  for (const entry of data.failures) {
    if (entry.taskType === taskType) {
      issues.push(...entry.issues);
    }
  }
  return [...new Set(issues)].slice(0, 10);
}

// ==================== TELEGRAM API ====================
const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function tgApi(method: string, params: Record<string, any> = {}): Promise<any> {
  try {
    const res = await fetch(`${API_URL}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const result = await res.json();
    if (!result.ok) log('ERROR', `API error (${method})`, result.description);
    return result;
  } catch (e) {
    log('ERROR', `API error (${method})`, e);
    return { ok: false };
  }
}

async function sendMessage(chatId: number, text: string, extra: Record<string, any> = {}): Promise<void> {
  await tgApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

async function sendDocument(chatId: number, content: string, filename: string): Promise<boolean> {
  try {
    const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', blob, filename);
    formData.append('caption', `📎 ${filename}`);
    const res = await fetch(`${API_URL}/sendDocument`, { method: 'POST', body: formData });
    return (await res.json()).ok;
  } catch (e) {
    log('ERROR', 'Document error', e);
    return false;
  }
}

// ==================== OPENAI API ====================
async function openaiChat(messages: Array<{role: string; content: string}>): Promise<string> {
  try {
    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 4096
      })
    });
    
    const data = await res.json();
    if (data.error) {
      log('ERROR', 'OpenAI error', data.error);
      return '';
    }
    return data.choices?.[0]?.message?.content || '';
  } catch (e) {
    log('ERROR', 'OpenAI request error', e);
    return '';
  }
}

// ==================== PAGE READER ====================
async function readPage(url: string): Promise<string> {
  try {
    log('INFO', `Fetching page: ${url}`);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });
    
    if (!res.ok) {
      log('ERROR', `Page fetch failed: ${res.status}`);
      return '';
    }
    
    const html = await res.text();
    
    // Extract text from HTML
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    
    log('INFO', `Page read: ${text.length} chars`);
    return text.substring(0, 25000);
  } catch (e) {
    log('ERROR', 'Page reader error', e);
    return '';
  }
}

// ==================== ANALYZE TASK ====================
async function analyzeTask(content: string): Promise<{ canDo: boolean; reason: string; taskType: string; requirements: string[] }> {
  const knownIssues = getCommonIssues('all');
  const issuesHint = knownIssues.length > 0 ? `\n\nИзвестные частые проблемы для избежания:\n${knownIssues.slice(0, 5).join('\n')}` : '';
  
  const response = await openaiChat([
    { 
      role: 'system', 
      content: `Ты — эксперт по фрилансу. Проанализируй задание.

Формат JSON:
{"canDo": true/false, "reason": "причина", "taskType": "python_script|web_parser|telegram_bot|web_app|api_integration|other", "requirements": ["требование 1", ...]}${issuesHint}` 
    },
    { role: 'user', content: `ЗАДАНИЕ:\n${content.substring(0, 10000)}` }
  ]);
  
  try {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const p = JSON.parse(match[0]);
      return { canDo: p.canDo ?? true, reason: p.reason ?? '', taskType: p.taskType ?? 'other', requirements: p.requirements ?? [] };
    }
  } catch {}
  return { canDo: true, reason: '', taskType: 'other', requirements: [] };
}

// ==================== GENERATE CODE ====================
async function generateCode(
  taskContent: string, 
  taskType: string, 
  requirements: string[],
  similarSuccess?: LearningEntry | null
): Promise<string> {
  const typePrompts: Record<string, string> = {
    python_script: 'Python скрипт с argparse',
    web_parser: 'Python парсер (requests + BeautifulSoup)',
    telegram_bot: 'Telegram бот (python-telegram-bot или aiogram)',
    web_app: 'Web приложение (Flask/FastAPI)',
    api_integration: 'Python API клиент',
    other: 'Python скрипт'
  };
  
  const reqList = requirements.length > 0 
    ? `\n\nОБЯЗАТЕЛЬНЫЕ ТРЕБОВАНИЯ:\n${requirements.map((r, i) => `${i+1}. ${r}`).join('\n')}` 
    : '';
  
  let exampleHint = '';
  if (similarSuccess) {
    exampleHint = `\n\nПРИМЕР УСПЕШНОГО ПОХОЖЕГО РЕШЕНИЯ (адаптируй под текущую задачу):\n${similarSuccess.code.substring(0, 2000)}`;
  }
  
  const commonIssues = getCommonIssues(taskType);
  const avoidHint = commonIssues.length > 0 
    ? `\n\nИЗБЕГАЙ ЭТИХ ЧАСТЫХ ОШИБОК:\n${commonIssues.map((i, idx) => `${idx+1}. ${i}`).join('\n')}`
    : '';

  return await openaiChat([
    { 
      role: 'system', 
      content: `Ты — Senior Python Developer. Пиши КАЧЕСТВЕННЫЙ, РАБОЧИЙ код.

КРИТИЧЕСКИ ВАЖНО:
1. Каждый файл ПОЛНОСТЬЮ — никаких обрывов!
2. Все функции и классы дописаны до конца
3. try/except для ВСЕХ опасных операций
4. Проверь баланс скобок (), [], {}
5. Все импорты в начале файла
6. Docstrings для функций
7. Type hints

ФОРМАТ:
\`\`\`python
# main.py
"""Описание модуля"""
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

def main() -> None:
    """Main function"""
    try:
        # code
        pass
    except Exception as e:
        logger.error(f"Error: {e}")

if __name__ == "__main__":
    main()
\`\`\`

Максимум 200 строк. Код должен запускаться БЕЗ ошибок!${avoidHint}${exampleHint}` 
    },
    { 
      role: 'user', 
      content: `Тип: ${typePrompts[taskType] || 'Python'}${reqList}\n\nЗАДАНИЕ:\n${taskContent.substring(0, 10000)}\n\nНапиши полный рабочий код.` 
    }
  ]);
}

// ==================== REVIEW CODE ====================
interface ReviewResult {
  score: number;
  issues: string[];
  criticalIssues: string[];
}

async function reviewCode(code: string, taskContent: string, requirements: string[]): Promise<ReviewResult> {
  const response = await openaiChat([
    { 
      role: 'system', 
      content: `Ты — QA Engineer. Проверь код на РАБОТОСПОСОБНОСТЬ.

ПРОВЕРЬ КАЖДОЕ:
1. Полнота — функции дописаны? скобки закрыты? return есть?
2. Синтаксис — импорты есть? отступы правильные?
3. Логика — код делает что нужно?
4. ТЗ — требования выполнены?

Шкала:
9-10: Код запустится и работает
7-8: Код запустится, мелкие недочёты
5-6: Код не запустится, нужны исправления
0-4: Код сломан

ФОРМАТ JSON:
{
  "score": 7,
  "issues": ["проблема 1", "проблема 2"],
  "criticalIssues": ["критическая проблема которая сломает запуск"]
}` 
    },
    { 
      role: 'user', 
      content: `ЗАДАНИЕ:\n${taskContent.substring(0, 2000)}\n\nТРЕБОВАНИЯ:\n${requirements.join('\n') || 'Стандартные'}\n\nКОД:\n${code.substring(0, 15000)}\n\nПроверь и оцени.` 
    }
  ]);

  try {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const p = JSON.parse(match[0]);
      return { 
        score: p.score ?? 5, 
        issues: p.issues ?? [], 
        criticalIssues: p.criticalIssues ?? [] 
      };
    }
  } catch {}
  
  return { score: 5, issues: ['Не удалось распарсить'], criticalIssues: [] };
}

// ==================== FIX CODE ====================
async function fixCode(
  code: string, 
  issues: string[], 
  criticalIssues: string[],
  taskContent: string, 
  requirements: string[],
  attempt: number,
  previousAttempts: ReviewResult[]
): Promise<string> {
  const allProblems = [...criticalIssues, ...issues].slice(0, 10);
  const problemsList = allProblems.map((p, i) => `${i+1}. ${p}`).join('\n');
  
  const historyHint = previousAttempts.length > 0
    ? `\n\nИСТОРИЯ ПОПЫТОК:\n${previousAttempts.map((a, i) => `Попытка ${i+1}: ${a.score}/10, критических: ${a.criticalIssues.length}`).join('\n')}`
    : '';
  
  return await openaiChat([
    { 
      role: 'system', 
      content: `Ты — Senior Python Developer. ИСПРАВЬ код.

КРИТИЧНО:
1. Сохрани структуру кода
2. Исправь ТОЛЬКО перечисленные проблемы
3. ПРОВЕРЬ что после исправлений:
   - Все def имеют тело и return
   - Все скобки () [] {} сбалансированы
   - Все try имеют except
   - Все классы закрыты
4. НЕ добавляй новый функционал
5. НЕ переписывай работающие части

Если функция обрывается — ДОПИШИ её полностью.
Если не хватает импорта — ДОБАВЬ.

ФОРМАТ:
\`\`\`python
# ИСПРАВЛЕННЫЙ код
...
\`\`\`` 
    },
    { 
      role: 'user', 
      content: `ЗАДАНИЕ:\n${taskContent.substring(0, 1500)}\n\nПРОБЛЕМЫ:\n${problemsList}\n\nКОД:\n${code.substring(0, 15000)}\n\n---\nПопытка ${attempt}/${MAX_FIX_ATTEMPTS}${historyHint}\n\nИсправь проблемы и проверь что код целый.` 
    }
  ]);
}

// ==================== EXTRACT FILES ====================
function extractFiles(text: string): Map<string, string> {
  const files = new Map<string, string>();
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks: Array<{ lang: string; content: string }> = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match[2].trim().length > 10) {
      blocks.push({ lang: match[1]?.toLowerCase() || 'txt', content: match[2].trim() });
    }
  }
  
  if (blocks.length === 0 && text.trim().length > 50) {
    files.set('result.txt', text.trim());
    return files;
  }
  
  const extMap: Record<string, string> = { python: 'py', py: 'py', javascript: 'js', typescript: 'ts' };
  
  blocks.forEach((b, i) => {
    let name = b.lang === 'python' || b.lang === 'py' ? 'main.py' : `code.${extMap[b.lang] || 'txt'}`;
    if (blocks.length > 1 && i > 0 && b.content.length < 200) name = 'requirements.txt';
    files.set(name, b.content);
  });
  
  return files;
}

// ==================== PROCESS TASK ====================
async function processTask(chatId: number, urlOrContent: string, isUrl: boolean) {
  const startTime = Date.now();
  const taskId = `task_${Date.now()}`;
  log('INFO', `Task started`, { taskId, chatId, isUrl });
  
  let content = urlOrContent;
  
  if (isUrl) {
    await sendMessage(chatId, '📖 <b>Читаю задание...</b>');
    content = await readPage(urlOrContent);
    if (!content) {
      await sendMessage(chatId, '❌ Не удалось прочитать страницу');
      return;
    }
  }
  
  await sendMessage(chatId, '🔍 <b>Анализирую...</b>');
  const analysis = await analyzeTask(content);
  log('INFO', `Analyzed`, { canDo: analysis.canDo, type: analysis.taskType, reqs: analysis.requirements.length });
  
  if (!analysis.canDo) {
    await sendMessage(chatId, `⚠️ Не могу выполнить: ${analysis.reason}`);
    return;
  }
  
  const similarSuccess = getSimilarSuccess(analysis.taskType, content);
  if (similarSuccess) {
    await sendMessage(chatId, '📚 <b>Нашёл похожее успешное решение</b> — адаптирую');
  }
  
  await sendMessage(chatId, `🤖 <b>Генерирую код...</b> (${analysis.taskType})`);
  let code = await generateCode(content, analysis.taskType, analysis.requirements, similarSuccess);
  
  if (!code) {
    await sendMessage(chatId, '❌ Не удалось сгенерировать');
    return;
  }
  
  let review = await reviewCode(code, content, analysis.requirements);
  const reviewHistory: ReviewResult[] = [];
  
  log('INFO', `Review 1`, { score: review.score, critical: review.criticalIssues.length });
  await sendMessage(chatId, `📊 <b>Проверка: ${review.score}/10</b>${review.criticalIssues.length > 0 ? ` (${review.criticalIssues.length} критических)` : ''}`);
  
  let attempt = 0;
  let bestCode = code;
  let bestReview = review;
  
  while (review.score < MIN_SCORE && attempt < MAX_FIX_ATTEMPTS) {
    attempt++;
    await sendMessage(chatId, `🔧 Исправляю... (${attempt}/${MAX_FIX_ATTEMPTS})`);
    
    const oldCode = code;
    reviewHistory.push(review);
    
    code = await fixCode(code, review.issues, review.criticalIssues, content, analysis.requirements, attempt, reviewHistory);
    
    if (!code || code.length < 50) {
      log('ERROR', 'Fix returned empty code');
      code = oldCode;
      break;
    }
    
    review = await reviewCode(code, content, analysis.requirements);
    log('INFO', `Review ${attempt + 1}`, { score: review.score, critical: review.criticalIssues.length });
    
    await sendMessage(chatId, `📊 <b>Проверка: ${review.score}/10</b>${review.criticalIssues.length > 0 ? ` (${review.criticalIssues.length} критических)` : ''}`);
    
    if (review.score > bestReview.score || 
        (review.score === bestReview.score && review.criticalIssues.length < bestReview.criticalIssues.length)) {
      bestCode = code;
      bestReview = review;
    }
    
    if (review.score < bestReview.score - 2) {
      log('WARN', 'Score dropped significantly, reverting');
      code = bestCode;
      review = bestReview;
      break;
    }
    
    if (attempt >= 2 && reviewHistory.length >= 2) {
      const last2 = reviewHistory.slice(-2);
      if (last2[0].score === review.score && last2[1].score === review.score) {
        log('WARN', 'No progress for 2 attempts, stopping');
        break;
      }
    }
  }
  
  code = bestCode;
  review = bestReview;
  
  const entry: LearningEntry = {
    id: taskId,
    taskType: analysis.taskType,
    description: content.substring(0, 500),
    code: code.substring(0, 5000),
    score: review.score,
    issues: review.issues,
    success: review.score >= MIN_SCORE,
    createdAt: new Date().toISOString()
  };
  addLearningEntry(entry);
  
  const emoji = review.score >= 9 ? '✅' : review.score >= 7 ? '👍' : '⚠️';
  await sendMessage(chatId, `${emoji} <b>Результат: ${review.score}/10</b>${attempt > 0 ? ` (${attempt} исправлений)` : ''}${review.score < MIN_SCORE ? '\n\n⚠️ Код требует доработки' : ''}`);
  
  const files = extractFiles(code);
  if (files.size === 0) {
    await sendMessage(chatId, '❌ Нет файлов');
    return;
  }
  
  for (const [name, content] of files) {
    await sendDocument(chatId, content, name);
    await new Promise(r => setTimeout(r, 300));
  }
  
  log('INFO', `Completed`, { 
    taskId,
    score: review.score, 
    attempts: attempt, 
    files: files.size, 
    duration: `${Math.round((Date.now()-startTime)/1000)}s` 
  });
}

// ==================== MAIN ====================
async function main() {
  log('INFO', '🤖 Freelance Bot v5.1 (OpenAI) starting...');
  
  const learning = loadLearning();
  log('INFO', `Learning data loaded`, { successes: learning.successes.length, failures: learning.failures.length });
  
  let result = await tgApi('getUpdates', { timeout: 0 });
  let cleared = 0;
  while (result.ok && result.result?.length > 0) {
    cleared += result.result.length;
    result = await tgApi('getUpdates', { offset: result.result[result.result.length - 1].update_id + 1, timeout: 0 });
  }
  log('INFO', `Cleared ${cleared} old updates`);
  
  let lastId = 0;
  const processed = new Set<number>();
  
  log('INFO', '🔄 Starting polling loop...');
  
  while (true) {
    try {
      const result = await tgApi('getUpdates', { offset: lastId + 1, timeout: 10, limit: 20 });
      
      if (result.ok && result.result && result.result.length > 0) {
        log('INFO', `Received ${result.result.length} updates`);
        
        for (const u of result.result) {
          lastId = u.update_id;
          if (processed.has(u.update_id)) continue;
          processed.add(u.update_id);
          if (processed.size > 1000) processed.clear();
          
          if (u.message?.text) {
            const { chat, text, from } = u.message;
            log('INFO', `📩 From ${from?.username || 'user'}`, { chatId: chat.id, text: text.substring(0, 50) });
            
            if (text === '/start') {
              await sendMessage(chat.id, `
👋 <b>Freelance AI Bot v5.1</b>
Powered by OpenAI GPT-4o-mini

<b>Как работает:</b>
1. Анализирую задание
2. Генерирую код
3. Проверяю качество
4. Исправляю ошибки
5. Сохраняю опыт

🧠 <b>Изучено задач:</b> ${learning.successes.length + learning.failures.length}
✅ <b>Успешных:</b> ${learning.successes.length}

Отправь ссылку или описание задания.
`);
            } else if (text === '/stats') {
              const data = loadLearning();
              await sendMessage(chat.id, `
📊 <b>Статистика обучения</b>

✅ Успешных: ${data.successes.length}
❌ Неудачных: ${data.failures.length}
📝 Паттернов: ${Object.keys(data.patterns).length}
`);
            } else if (text.startsWith('http')) {
              await processTask(chat.id, text, true);
            } else if (text.length > 20) {
              await processTask(chat.id, text, false);
            } else {
              await sendMessage(chat.id, '❓ Отправь ссылку или описание задания (минимум 20 символов)');
            }
          }
        }
      }
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      log('ERROR', 'Loop error', e);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

main().catch(e => log('ERROR', 'Fatal', e));
