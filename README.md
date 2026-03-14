# 🤖 Freelance AI Bot v5.0

Telegram бот для анализа фриланс-заданий с системой обучения.

## Возможности

- 📖 Чтение заданий по URL
- 🔍 Анализ и классификация задач
- 🤖 Генерация кода на Python
- ✅ Проверка качества кода
- 🔧 Автоматическое исправление ошибок
- 🧠 Система обучения на успешных решениях

## Установка на сервер (Ubuntu 24.04)

### Быстрая установка

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/YOUR_USERNAME/freelance-ai-bot.git
cd freelance-ai-bot

# 2. Запустите скрипт установки
chmod +x setup.sh
./setup.sh

# 3. Вставьте токен бота
nano .env
# Замените YOUR_BOT_TOKEN_HERE на токен от @BotFather

# 4. Запустите бота
./start.sh
```

### Ручная установка

```bash
# Установка Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Установка зависимостей
bun install

# Создание директории данных
mkdir -p data

# Запуск
bun run dev
```

## systemd сервис (автозапуск)

```bash
# Создайте файл сервиса
sudo nano /etc/systemd/system/freelance-bot.service
```

Содержимое:
```ini
[Unit]
Description=Freelance AI Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/freelance-ai-bot
ExecStart=/root/.bun/bin/bun run index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Активация
sudo systemctl daemon-reload
sudo systemctl enable freelance-bot
sudo systemctl start freelance-bot

# Проверка статуса
sudo systemctl status freelance-bot

# Логи
journalctl -u freelance-bot -f
```

## Команды бота

- `/start` - Приветствие и информация
- `/stats` - Статистика обучения
- `URL` - Обработать задание по ссылке
- `Текст` - Описание задания (минимум 20 символов)

## Структура проекта

```
freelance-ai-bot/
├── index.ts          # Основной код бота
├── config.json       # Конфигурация
├── package.json      # Зависимости
├── setup.sh          # Скрипт установки
├── start.sh          # Скрипт запуска
├── .env.example      # Пример переменных окружения
├── data/
│   └── learning.json # База обучения
└── README.md         # Документация
```

## Система обучения

Бот сохраняет:
- ✅ Успешные решения (до 50 записей)
- ❌ Неудачные попытки (до 30 записей)
- 📝 Паттерны по типам задач

При новой задаче бот ищет похожее успешное решение и адаптирует его.
