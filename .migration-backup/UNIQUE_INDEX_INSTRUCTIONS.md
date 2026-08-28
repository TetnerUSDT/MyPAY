# Добавление уникального индекса для балансов пользователей

## Проблема
Необходимо запретить создание дублирующих балансов для одного пользователя. Один пользователь должен иметь только один баланс каждого типа.

## Решение
Добавлен уникальный индекс `user_balance_unique` для комбинации `(id_user, id_balance)` в таблице `users_balances`.

## Как применить изменения

### Вариант 1: Через MySQL консоль (рекомендуется)

Подключитесь к базе данных MySQL и выполните SQL-скрипт:

```bash
mysql -h 89.163.242.87 -u swiftx_test -p swiftx_test < add_unique_index.sql
```

Или выполните команды вручную:

```sql
-- 1. Удалить возможные дубликаты (если есть)
DELETE t1 FROM users_balances t1
INNER JOIN users_balances t2 
WHERE 
  t1.id > t2.id AND
  t1.id_user = t2.id_user AND
  t1.id_balance = t2.id_balance;

-- 2. Создать уникальный индекс
ALTER TABLE users_balances 
ADD UNIQUE INDEX user_balance_unique (id_user, id_balance);
```

### Вариант 2: Через phpMyAdmin или другой GUI инструмент

1. Откройте базу данных `swiftx_test`
2. Выберите таблицу `users_balances`
3. Перейдите во вкладку "SQL"
4. Скопируйте и выполните SQL из файла `add_unique_index.sql`

## Что изменилось в коде

### Backend:
- **server/admin-routes.ts**: Добавлена обработка ошибки дублирования (MySQL error 1062)
  - При попытке создать дубликат баланса возвращается понятное сообщение
  - Применяется к endpoints: POST и PUT `/api/user-balances`

### Schema:
- **shared/schema.ts**: Добавлен уникальный индекс в определение таблицы
  ```typescript
  export const usersBalances = mysqlTable("users_balances", {
    // ... поля
  }, (table) => ({
    userBalanceUnique: uniqueIndex("user_balance_unique").on(table.idUser, table.idBalance)
  }));
  ```

## Проверка

После применения индекса попробуйте создать дублирующий баланс в админке:
1. Откройте раздел "Балансы" → "Балансы пользователей"
2. Создайте новый баланс для пользователя
3. Попробуйте создать еще один баланс с тем же `id_balance` для того же пользователя
4. Должна появиться ошибка: "У этого пользователя уже есть баланс данного типа"

## Важно

⚠️ **Перед применением убедитесь, что в базе нет дубликатов балансов!**

Проверить можно SQL запросом:
```sql
SELECT id_user, id_balance, COUNT(*) as count 
FROM users_balances 
GROUP BY id_user, id_balance 
HAVING count > 1;
```

Если дубликаты есть, они будут автоматически удалены при выполнении скрипта (останется только первая запись).
