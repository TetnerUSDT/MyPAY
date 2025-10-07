# SwiftX - Инструкция по развертыванию на Ubuntu

## Системные требования

- Ubuntu 20.04 LTS или выше
- Минимум 2GB RAM
- Минимум 10GB свободного места на диске
- Доступ к интернету

## 1. Установка зависимостей

### 1.1 Обновление системы
```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 Установка Node.js 20.x
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Проверка установки:
```bash
node --version  # должно быть v20.x.x
npm --version   # должно быть v10.x.x или выше
```

### 1.3 Установка PostgreSQL 15
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Проверка установки:
```bash
sudo systemctl status postgresql
```

### 1.4 Установка дополнительных утилит
```bash
sudo apt install -y git curl wget build-essential
```

## 2. Настройка PostgreSQL

### 2.1 Создание пользователя и базы данных
```bash
# Войти в PostgreSQL
sudo -u postgres psql

# В консоли PostgreSQL выполнить:
CREATE DATABASE swiftx_db;
CREATE USER swiftx_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE swiftx_db TO swiftx_user;
\q
```

### 2.2 Восстановление дампа базы данных
```bash
# Если у вас есть файл database_dump.sql
psql -U swiftx_user -d swiftx_db -f database_dump.sql

# Или с использованием переменной DATABASE_URL:
# psql $DATABASE_URL < database_dump.sql
```

## 3. Настройка проекта

### 3.1 Клонирование репозитория (или загрузка файлов)
```bash
cd /var/www
sudo mkdir swiftx
sudo chown $USER:$USER swiftx
cd swiftx

# Если у вас есть git репозиторий:
# git clone <your-repo-url> .

# Если загружаете вручную - скопируйте все файлы проекта в /var/www/swiftx
```

### 3.2 Установка npm пакетов
```bash
npm install
```

### 3.3 Создание файла .env
Создайте файл `.env` в корне проекта:
```bash
nano .env
```

Добавьте следующие переменные окружения:
```env
# Database
DATABASE_URL=postgresql://swiftx_user:your_secure_password_here@localhost:5432/swiftx_db
PGHOST=localhost
PGPORT=5432
PGUSER=swiftx_user
PGPASSWORD=your_secure_password_here
PGDATABASE=swiftx_db

# Environment
NODE_ENV=production

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=your_bot_username

# Admin Panel Access
ADMIN_URL=your_secret_admin_url_path
ADMIN_LOGIN=your_admin_login
ADMIN_PASSWORD=your_admin_password

# Wallet API (если используется)
WALLET_API_KEY=your_wallet_api_key
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X)

## 4. Настройка базы данных через Drizzle

### 4.1 Применение миграций
```bash
npm run db:push
```

Если появляется предупреждение о потере данных:
```bash
npm run db:push -- --force
```

## 5. Сборка проекта

```bash
npm run build
```

## 6. Настройка Telegram Bot

### 6.1 Создание бота через BotFather
1. Откройте Telegram и найдите @BotFather
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните полученный токен в переменную `TELEGRAM_BOT_TOKEN`

### 6.2 Настройка домена для Telegram Widget
```bash
# В Telegram отправьте BotFather:
/setdomain

# Выберите вашего бота
# Введите домен БЕЗ https:// (например: example.com)
```

## 7. Запуск приложения

### 7.1 Для разработки
```bash
npm run dev
```

### 7.2 Для production с использованием PM2

#### Установка PM2
```bash
sudo npm install -g pm2
```

#### Создание ecosystem файла
Создайте файл `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'swiftx',
    script: 'tsx',
    args: 'server/index.ts',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
```

#### Запуск через PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Следуйте инструкциям команды `pm2 startup` для автозапуска при перезагрузке сервера.

#### Управление PM2
```bash
pm2 list              # Список процессов
pm2 logs swiftx       # Просмотр логов
pm2 restart swiftx    # Перезапуск
pm2 stop swiftx       # Остановка
pm2 delete swiftx     # Удаление процесса
```

## 8. Настройка Nginx (рекомендуется для production)

### 8.1 Установка Nginx
```bash
sudo apt install -y nginx
```

### 8.2 Создание конфигурации
```bash
sudo nano /etc/nginx/sites-available/swiftx
```

Добавьте конфигурацию:
```nginx
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 8.3 Активация конфигурации
```bash
sudo ln -s /etc/nginx/sites-available/swiftx /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 9. Настройка SSL с Let's Encrypt (опционально)

### 9.1 Установка Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 9.2 Получение SSL сертификата
```bash
sudo certbot --nginx -d your_domain.com
```

Следуйте инструкциям certbot.

### 9.3 Автообновление сертификата
```bash
sudo certbot renew --dry-run
```

## 10. Настройка Firewall

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status
```

## 11. Проверка работы приложения

### 11.1 Проверка процесса
```bash
pm2 status
```

### 11.2 Проверка портов
```bash
sudo netstat -tlnp | grep 5000
```

### 11.3 Проверка логов
```bash
pm2 logs swiftx
# или
tail -f /var/log/nginx/error.log
```

### 11.4 Проверка в браузере
Откройте в браузере:
- `http://your_domain.com` или `http://your_server_ip`

## 12. Резервное копирование

### 12.1 Создание скрипта для бэкапа базы данных
```bash
nano ~/backup_swiftx.sh
```

Добавьте:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/swiftx"
mkdir -p $BACKUP_DIR

pg_dump -U swiftx_user swiftx_db > $BACKUP_DIR/backup_$DATE.sql

# Удаление бэкапов старше 7 дней
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.sql"
```

Сделайте скрипт исполняемым:
```bash
chmod +x ~/backup_swiftx.sh
```

### 12.2 Настройка автоматического бэкапа через cron
```bash
crontab -e
```

Добавьте строку для ежедневного бэкапа в 2:00 ночи:
```
0 2 * * * /home/your_username/backup_swiftx.sh >> /var/log/swiftx_backup.log 2>&1
```

## 13. Обновление приложения

```bash
cd /var/www/swiftx

# Если используете git:
git pull

# Установка зависимостей
npm install

# Применение миграций базы данных
npm run db:push

# Сборка проекта
npm run build

# Перезапуск приложения
pm2 restart swiftx
```

## 14. Мониторинг и поддержка

### 14.1 Мониторинг через PM2
```bash
pm2 monit
```

### 14.2 Просмотр системных ресурсов
```bash
htop           # Использование CPU/RAM
df -h          # Дисковое пространство
free -h        # Память
```

### 14.3 Просмотр логов базы данных
```bash
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

## Полезные команды для устранения неполадок

### Проверка подключения к базе данных
```bash
psql -U swiftx_user -d swiftx_db -c "SELECT version();"
```

### Перезапуск PostgreSQL
```bash
sudo systemctl restart postgresql
```

### Очистка логов PM2
```bash
pm2 flush
```

### Проверка использования портов
```bash
sudo lsof -i :5000
sudo lsof -i :5432
```

## Контакты и поддержка

Для получения помощи обратитесь к документации проекта или свяжитесь с командой разработки.

---

**Версия инструкции:** 1.0  
**Дата:** Октябрь 2025  
**Проект:** SwiftX Cryptocurrency Exchange Platform
