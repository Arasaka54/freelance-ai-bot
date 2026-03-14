# 🤖 Freelance AI Bot v5.2

Telegram бот для анализа фриланс-заданий с системой обучения. **Бесплатно** работает на Groq (Llama 3.1 70B)!

## Возможности

- 📖 Чтение заданий по URL
- 🔍 Анализ и классификация задач
- 🤖 Генерация кода на Python
- ✅ Проверка качества кода
- 🔧 Автоматическое исправление ошибок
- 🧠 Система обучения на успешных решениях

## 💰 100% Бесплатно!

Бот использует **Groq** — бесплатный сверхбыстрый AI-провайдер:
- 🆓 Бесплатный тариф с щедрыми лимитами
- ⚡ Молниеносная скорость (Llama 3.1 70B)
- 📈 ~14,000 токенов в минуту бесплатно
- 🚫 Не нужна банковская карта

## Быстрая установка

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/Arasaka54/freelance-ai-bot.git
cd freelance-ai-bot

# 2. Получите бесплатный Groq API ключ
# 👉 https://console.groq.com
# Зарегистрируйтесь через GitHub/Google и создайте API Key

# 3. Создайте .env файл
cp .env.example .env
nano .env
# Вставьте: GROQ_API_KEY=gsk_ваш-ключ

# 4. Установите Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 5. Запустите
chmod +x start.sh
./start.sh
```

## Конфигурация (.env)

```env
# Обязательно
TELEGRAM_TOKEN=8627215057:AAEsVrGt5ygsGJHFJBbdZKwp_738_BkmY1A
GROQ_API_KEY=gsk_ваш-groq-api-ключ

# Опционально
GROQ_MODEL=llama-3.1-70b-versatile
DATA_DIR=./data
```

## Доступные модели Groq

| Модель | Скорость | Качество | Рекомендация |
|--------|----------|----------|--------------|
| `llama-3.1-70b-versatile` | Быстрая | ⭐⭐⭐⭐⭐ | **Рекомендуется** |
| `llama-3.1-8b-instant` | Очень быстрая | ⭐⭐⭐⭐ | Для простых задач |
| `mixtral-8x7b-32768` | Средняя | ⭐⭐⭐⭐ | Альтернатива |

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

## Система обучения

Бот сохраняет:
- ✅ Успешные решения (до 50 записей)
- ❌ Неудачные попытки (до 30 записей)
- 📝 Паттерны по типам задач

При новой задаче бот ищет похожее успешное решение и адаптирует его.

## Лимиты Groq (бесплатный тариф)

- **Запросы**: 30 в минуту
- **Токены**: ~14,000 в минуту
- **Достаточно для**: ~20-30 задач в час

Если нужно больше — можно перейти на платный план.

## Альтернативные провайдеры

Можно использовать другие OpenAI-совместимые API:

```env
# DeepSeek (дешёвый)
GROQ_BASE_URL=https://api.deepseek.com/v1
GROQ_API_KEY=sk-...
GROQ_MODEL=deepseek-coder

# OpenAI
GROQ_BASE_URL=https://api.openai.com/v1
GROQ_API_KEY=sk-...
GROQ_MODEL=gpt-4o-mini
```

## Структура проекта

```
freelance-ai-bot/
├── index.ts          # Основной код бота
├── config.json       # Конфигурация
├── start.sh          # Скрипт запуска
├── install-service.sh # Установка как сервис
├── .env.example      # Пример конфигурации
└── data/
    └── learning.json # База обучения
```

## Помощь

Проблемы? Пишите: [@AgentAiHelperv2_bot](https://t.me/AgentAiHelperv2_bot)
