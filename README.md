# 🤖 Freelance AI Bot v5.1

Telegram бот для анализа фриланс-заданий с системой обучения. Работает на OpenAI GPT-4o-mini.

## Возможности

- 📖 Чтение заданий по URL
- 🔍 Анализ и классификация задач
- 🤖 Генерация кода на Python
- ✅ Проверка качества кода
- 🔧 Автоматическое исправление ошибок
- 🧠 Система обучения на успешных решениях

## Требования

- **Telegram Bot Token** — получить у [@BotFather](https://t.me/BotFather)
- **OpenAI API Key** — получить на [platform.openai.com](https://platform.openai.com/api-keys)

## Быстрая установка

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/Arasaka54/freelance-ai-bot.git
cd freelance-ai-bot

# 2. Создайте .env файл
cp .env.example .env
nano .env
# Вставьте свой OpenAI API ключ: OPENAI_API_KEY=sk-...

# 3. Установите Bun (если ещё нет)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 4. Запустите бота
chmod +x start.sh
./start.sh
```

## Конфигурация (.env)

```env
# Обязательно
TELEGRAM_TOKEN=8627215057:AAEsVrGt5ygsGJHFJBbdZKwp_738_BkmY1A
OPENAI_API_KEY=sk-your-openai-api-key-here

# Опционально
OPENAI_BASE_URL=https://api.openai.com/v1
DATA_DIR=./data
```

## systemd сервис (автозапуск)

```bash
chmod +x install-service.sh
sudo ./install-service.sh
```

Команды:
- `sudo systemctl status freelance-bot` — статус
- `journalctl -u freelance-bot -f` — логи
- `sudo systemctl restart freelance-bot` — перезапуск

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие и информация |
| `/stats` | Статистика обучения |
| `URL` | Обработать задание по ссылке |
| `Текст` | Описание задания (мин. 20 символов) |

## Структура проекта

```
freelance-ai-bot/
├── index.ts          # Основной код бота
├── config.json       # Конфигурация
├── package.json      # Зависимости
├── start.sh          # Скрипт запуска
├── install-service.sh # Установка как сервис
├── .env.example      # Пример переменных окружения
└── data/
    └── learning.json # База обучения
```

## Система обучения

Бот сохраняет:
- ✅ Успешные решения (до 50 записей)
- ❌ Неудачные попытки (до 30 записей)
- 📝 Паттерны по типам задач

При новой задаче бот ищет похожее успешное решение и адаптирует его.

## Стоимость

Бот использует **GPT-4o-mini** — это дешёвая модель:
- ~$0.00015 за 1K input токенов
- ~$0.0006 за 1K output токенов
- Одна задача ~$0.01-0.05

## Альтернативные провайдеры

Можно использовать другие OpenAI-совместимые API:

```env
# DeepSeek
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_API_KEY=sk-...

# Together AI
OPENAI_BASE_URL=https://api.together.xyz/v1
OPENAI_API_KEY=...

# Локальный Ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
```
