# Миграция с PostgreSQL на MySQL

## Шаги для переключения на MySQL

### 1. На Replit (Development)

Обновите Secrets:
```
DB_TYPE=mysql
DATABASE_URL=mysql://user:password@host:3306/swiftx_db
```

### 2. На Production сервере (Ubuntu)

#### Установите MySQL (если не установлен):
```bash
sudo apt update
sudo apt install mysql-server -y
sudo mysql_secure_installation
```

#### Создайте базу данных:
```bash
sudo mysql

CREATE DATABASE swiftx_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'swiftx_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON swiftx_db.* TO 'swiftx_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Импортируйте дамп:
```bash
cd /var/www/test/data/www/swiftx.online

# Скопируйте mysql_dump.sql с Replit на сервер

mysql -u swiftx_user -p swiftx_db < uploads/mysql_dump.sql
```

#### Обновите конфигурацию:
```bash
nano ecosystem.config.cjs
```

Измените переменные окружения:
```javascript
env: {
  ...
  DB_TYPE: 'mysql',
  DATABASE_URL: 'mysql://swiftx_user:YOUR_STRONG_PASSWORD@localhost:3306/swiftx_db',
  ...
}
```

#### Пересоберите и перезапустите:
```bash
npm install
npm run build
rm -rf server/public
cp -r dist/public server/public
pm2 restart swiftx --update-env
pm2 logs swiftx --lines 30
```

### 3. Проверка

После перезапуска проверьте:
- Авторизация работает
- Админка открывается
- Курсы обмена отображаются
- /top-up загружает кошельки

## Структура базы данных

### Все 15 таблиц включены:
1. ✅ balances (4 записи)
2. ✅ users 
3. ✅ users_balances
4. ✅ wallets
5. ✅ cards
6. ✅ banks
7. ✅ user_cards
8. ✅ exchanges
9. ✅ stats
10. ✅ transactions
11. ✅ exchange_rates (2 записи)
12. ✅ support_chats
13. ✅ support_tickets
14. ✅ support_messages
15. ✅ admins

### Данные сохранены:
- **balances**: 4 валюты (RUB, TRY, USDT TRC20, USDT BEP20)
- **exchange_rates**: 2 курса обмена (USDT→RUB)

## Преимущества MySQL:
- ✅ Нет проблем с расширениями (pgcrypto)
- ✅ Простая настройка UUID (varchar(36))
- ✅ Стабильная работа на любом хостинге
- ✅ Широкая поддержка
