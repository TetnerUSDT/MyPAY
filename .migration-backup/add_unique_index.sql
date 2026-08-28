-- Добавление уникального индекса для таблицы users_balances
-- Это предотвращает создание дублирующих балансов для одного пользователя

-- Сначала удалим возможные дубликаты (если есть)
-- Оставим только первую запись для каждой комбинации id_user + id_balance
DELETE t1 FROM users_balances t1
INNER JOIN users_balances t2 
WHERE 
  t1.id > t2.id AND
  t1.id_user = t2.id_user AND
  t1.id_balance = t2.id_balance;

-- Теперь создадим уникальный индекс
ALTER TABLE users_balances 
ADD UNIQUE INDEX user_balance_unique (id_user, id_balance);
