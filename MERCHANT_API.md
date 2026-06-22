# SwiftX Merchant Integration API

**Base URL:** `https://your-domain.com`

---

## Оглавление

1. [Аутентификация](#аутентификация)
2. [Кабинет мерчанта (Cabinet API)](#кабинет-мерчанта)
3. [Публичный API для приёма платежей](#публичный-api-для-приёма-платежей)
4. [Инвойс-система](#инвойс-система)
5. [API выплат (Payout API)](#api-выплат)
6. [Вебхуки](#вебхуки)
7. [Поддерживаемые сети](#поддерживаемые-сети)
8. [Режимы приёма платежей](#режимы-приёма-платежей)
9. [Коды ошибок](#коды-ошибок)

---

## Аутентификация

В SwiftX Merchant API используются **два вида ключей**:

| Ключ | Заголовок | Где используется |
|------|-----------|-----------------|
| User API Key | `x-api-key` | Кабинет мерчанта (управление магазинами, выплатами, кошельками) |
| Shop API Key | `x-shop-key` | Публичный API (генерация адресов, проверка платежей) |

**User API Key** выдаётся пользователю при регистрации. Найти его можно в личном кабинете.

**Shop API Key** генерируется для каждого магазина и используется на стороне вашего сервера.

---

## Кабинет мерчанта

> Все эндпоинты кабинета требуют заголовок `x-api-key: <User API Key>`.

---

### Магазины

#### Список магазинов

```
GET /api/business/shops
```

**Ответ 200:**
```json
[
  {
    "id": 1,
    "name": "Мой магазин",
    "domain": "myshop.com",
    "status": "active",
    "balance_usdt": "150.500000",
    "total_received": "500.000000",
    "total_paid_out": "349.500000",
    "address_mode": "invoice",
    "enabled_networks": "[\"TRON\",\"BSC\",\"TON\"]",
    "webhook_url": "https://myshop.com/webhook",
    "api_key": "sk_live_xxxx",
    "created_at": "2026-06-01T10:00:00.000Z"
  }
]
```

---

#### Получить магазин

```
GET /api/business/shops/:id
```

**Ответ 200:** Объект магазина (см. выше).

---

#### Создать магазин

```
POST /api/business/shops
```

**Тело запроса:**
```json
{
  "name": "Мой магазин",
  "domain": "myshop.com"
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| name | string | Да | Название магазина |
| domain | string | Да | Домен магазина |

**Ответ 200:** Созданный объект магазина.

---

#### Обновить настройки магазина

```
PATCH /api/business/shops/:id
```

**Тело запроса:**
```json
{
  "name": "Новое название",
  "domain": "newdomain.com",
  "webhook_url": "https://myshop.com/webhook",
  "address_mode": "invoice",
  "enabled_networks": ["TRON", "BSC", "TON"]
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| name | string | Название магазина |
| domain | string | Домен |
| webhook_url | string | URL для вебхуков |
| address_mode | string | Режим платежей: `permanent` / `temporary` / `invoice` |
| enabled_networks | string[] | Разрешённые сети (пустой массив = все) |

**Ответ 200:** Обновлённый объект магазина.

---

#### Перегенерировать API ключ магазина

```
POST /api/business/shops/:id/regenerate-key
```

**Ответ 200:**
```json
{ "apiKey": "sk_live_new_xxxx" }
```

---

### История платежей

#### Список платежей магазина

```
GET /api/business/shops/:id/payments
```

**Ответ 200:**
```json
[
  {
    "id": 42,
    "shop_id": 1,
    "order_id": "order_123",
    "external_user_id": "user_456",
    "wallet_address": "TXyz123...",
    "network": "TRON",
    "currency": "USDT",
    "amount": "50.000000",
    "amount_received": "50.000000",
    "status": "confirmed",
    "tx_hash": "abc123def...",
    "address_type": "temporary",
    "confirmed_at": "2026-06-15T12:30:00.000Z",
    "created_at": "2026-06-15T12:00:00.000Z"
  }
]
```

---

### Кошельки пула

#### Список кошельков магазина

```
GET /api/business/shops/:id/wallets
```

**Ответ 200:**
```json
[
  {
    "id": 8,
    "shop_id": 1,
    "address": "TXyz123...",
    "network": "TRON",
    "mode": "standard",
    "gasfree_address": null,
    "status": "active",
    "external_user_id": null,
    "order_id": null,
    "reserved_until": null,
    "balance_usdt": "245.500000",
    "balance_updated_at": "2026-06-22T18:00:00.000Z",
    "created_at": "2026-06-10T09:00:00.000Z"
  }
]
```

---

#### Добавить кошелёк в пул

```
POST /api/business/shops/:id/wallets/generate
```

**Тело запроса:**
```json
{
  "network": "TRON",
  "mode": "standard"
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| network | string | Да | Сеть: `TRON`, `BSC`, `TON`, `POLYGON` |
| mode | string | Нет | `standard` (по умолчанию) или `gasfree` (только TRON) |

**Ответ 200:**
```json
{
  "id": 12,
  "address": "TNewAddr...",
  "network": "TRON",
  "mode": "standard",
  "status": "active"
}
```

---

#### Проверить баланс кошелька

Обновляет баланс кошелька — сначала через on-chain API (TronGrid / BSCScan / TON API), при неудаче — через внутренний Wallet API.

```
POST /api/business/shops/:id/wallets/:wid/check-balance
```

**Ответ 200:**
```json
{
  "balance_usdt": "245.500000",
  "updated_at": "2026-06-22T18:00:00.000Z"
}
```

---

## Публичный API для приёма платежей

> Эндпоинты используют заголовок `x-shop-key: <Shop API Key>`.
> Вызываются **только с вашего сервера**, никогда не с фронтенда клиента.

---

### Получить адрес для оплаты

Основной эндпоинт. Поведение зависит от режима (`address_mode`) магазина.

```
POST /api/merchant/address
```

**Заголовок:** `x-shop-key: <Shop API Key>`

---

#### Режим `permanent` — постоянный адрес

Возвращает один и тот же адрес для одного `user_id`.

**Запрос:**
```json
{
  "user_id": "user_123",
  "network": "TRON",
  "currency": "USDT"
}
```

**Ответ 200:**
```json
{
  "address": "TXyz123...",
  "network": "TRON",
  "mode": "standard",
  "currency": "USDT",
  "type": "permanent",
  "payment_id": 42,
  "expires_at": null
}
```

---

#### Режим `temporary` — временный адрес

Создаёт новый адрес под каждый `order_id`. TTL — 30 минут.

**Запрос:**
```json
{
  "order_id": "order_789",
  "network": "BSC",
  "currency": "USDT",
  "amount": "99.99"
}
```

**Ответ 200:**
```json
{
  "address": "0xAbc123...",
  "network": "BSC",
  "mode": "standard",
  "currency": "USDT",
  "type": "temporary",
  "payment_id": 43,
  "expires_at": "2026-06-22T19:30:00.000Z"
}
```

---

#### Режим `invoice` — инвойс-ссылка 🆕

Вместо адреса возвращает публичную ссылку. Покупатель сам выбирает сеть на странице оплаты. Вебхук отправляется при подтверждении.

**Запрос:**
```json
{
  "order_id": "order_999",
  "amount": "150.00",
  "currency": "USDT",
  "networks": ["TRON", "BSC", "TON"]
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| amount | number | Да | Сумма к оплате |
| currency | string | Нет | Валюта (по умолчанию `USDT`) |
| order_id | string | Нет | Ваш идентификатор заказа |
| networks | string[] | Нет | Разрешённые сети (по умолчанию — все включённые) |

**Ответ 200:**
```json
{
  "type": "invoice",
  "invoice_number": "INV-A1B2C3D4E5",
  "invoice_url": "https://your-domain.com/pay/INV-A1B2C3D4E5",
  "amount": "150.00",
  "currency": "USDT",
  "networks": ["TRON", "BSC", "TON"],
  "expires_at": "2026-06-22T19:30:00.000Z"
}
```

> Перенаправьте покупателя по `invoice_url`. После оплаты придёт вебхук `payment.confirmed`.

---

#### GasFree режим (TRON)

Добавьте `"mode": "gasfree"` для работы через GasFree (комиссия в USDT, без TRX).

**Запрос:**
```json
{
  "user_id": "user_123",
  "network": "TRON",
  "mode": "gasfree",
  "currency": "USDT"
}
```

**Ответ:** Возвращает `gasfree_address` вместо обычного адреса.

---

### Проверить статус платежа

```
GET /api/merchant/payment/:payment_id
```

**Ответ 200:**
```json
{
  "status": "confirmed",
  "tx_hash": "abc123...",
  "amount_received": "50.000000",
  "confirmed_at": "2026-06-22T12:30:00.000Z"
}
```

**Статусы платежа:**

| Статус | Описание |
|--------|----------|
| `pending` | Ожидает оплаты |
| `confirmed` | Подтверждён |
| `expired` | Истёк срок (только временные) |

---

### Запустить проверку платежа вручную

```
POST /api/merchant/check-payment
```

**Тело:**
```json
{ "payment_id": 42 }
```

**Ответ 200:**
```json
{ "status": "pending", "message": "Checking started" }
```

---

### Верифицировать транзакцию вручную

Если вы знаете хэш транзакции, можно верифицировать его напрямую.

```
POST /api/merchant/verify-tx
```

**Тело:**
```json
{
  "payment_id": 42,
  "tx_hash": "abc123def456..."
}
```

**Ответ 200 (подтверждено):**
```json
{ "confirmed": true, "amount_received": "50.000000" }
```

**Ответ 200 (не подтверждено):**
```json
{ "confirmed": false, "message": "Transaction not confirmed on chain" }
```

---

## Инвойс-система

### Как работает инвойс

```
Магазин → POST /api/merchant/address (invoice mode)
        ← { invoice_url: "https://domain.com/pay/INV-xxx" }

Магазин → Перенаправляет покупателя на invoice_url

Покупатель → Открывает страницу инвойса
           → Выбирает сеть (TRON / BSC / TON / ...)
           → Видит адрес и QR-код для оплаты
           → Переводит USDT

Система → Опрашивает адрес на наличие транзакции
        → Обнаруживает оплату
        → Отправляет вебхук payment.confirmed на ваш сервер
```

---

### Получить данные инвойса (публичный)

Используется страницей `/pay/:invoiceNumber`. Вызывать можно без авторизации.

```
GET /api/merchant/invoice/:invoice_number
```

**Ответ 200:**
```json
{
  "invoice_number": "INV-A1B2C3D4E5",
  "shop_name": "Мой магазин",
  "order_ref": "order_999",
  "amount": "150.000000",
  "currency": "USDT",
  "networks": ["TRON", "BSC", "TON"],
  "status": "pending",
  "wallet_address": null,
  "network_chosen": null,
  "expires_at": "2026-06-22T19:30:00.000Z",
  "confirmed_at": null,
  "tx_hash": null
}
```

**Статусы инвойса:**

| Статус | Описание |
|--------|----------|
| `pending` | Ожидает выбора сети или оплаты |
| `confirmed` | Оплачен |
| `expired` | Истёк (30 минут с момента создания) |

---

### Покупатель выбирает сеть

```
POST /api/merchant/invoice/:invoice_number/select-network
```

**Тело:**
```json
{ "network": "TRON" }
```

**Ответ 200:**
```json
{
  "address": "TXyz123...",
  "network": "TRON",
  "expires_at": "2026-06-22T19:30:00.000Z"
}
```

Система автоматически начинает мониторинг адреса на поступление средств.

---

## API выплат

> Доступны два способа создать выплату:
> - **Ручная** — через кабинет или Cabinet API (источник `manual`)
> - **API-выплата** — через публичный Payout API (источник `api`)
>
> Только API-выплаты отправляют вебхук при завершении.

---

### Создать выплату (кабинет / Cabinet API)

```
POST /api/business/shops/:id/payouts
```

**Заголовок:** `x-api-key: <User API Key>`

**Тело:**
```json
{
  "to_address": "TRecipient123...",
  "network": "TRON",
  "currency": "USDT",
  "amount": 100.00,
  "note": "Вывод прибыли",
  "from_wallet_id": 8
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| to_address | string | Да | Адрес получателя |
| network | string | Да | Сеть: `TRON`, `BSC`, `TON`, `POLYGON` |
| amount | number | Да | Сумма в USDT |
| currency | string | Нет | Валюта (по умолчанию `USDT`) |
| note | string | Нет | Комментарий |
| from_wallet_id | integer | Нет | ID кошелька из пула — если указан, перевод выполнится автоматически через блокчейн |

**Ответ 200:**
```json
{
  "ok": true,
  "message": "Payout request created",
  "reference": "MyPay-A1B2C3D4"
}
```

---

### Создать API-выплату 🆕

Предназначен для автоматических выплат со стороны вашего сервера. Отправляет вебхук `payout.completed` при завершении.

```
POST /api/merchant/payout
```

**Заголовок:** `x-shop-key: <Shop API Key>`

**Тело:**
```json
{
  "to_address": "TRecipient123...",
  "network": "TRON",
  "currency": "USDT",
  "amount": 50.00,
  "order_id": "withdrawal_456"
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| to_address | string | Да | Адрес получателя |
| network | string | Да | Сеть |
| amount | number | Да | Сумма |
| currency | string | Нет | Валюта (по умолчанию `USDT`) |
| order_id | string | Нет | Ваш идентификатор — возвращается в вебхуке |

**Ответ 200:**
```json
{
  "ok": true,
  "payout_id": 15,
  "reference": "API-withdrawal_456",
  "status": "pending"
}
```

---

### Список выплат

```
GET /api/business/shops/:id/payouts
```

**Заголовок:** `x-api-key: <User API Key>`

**Ответ 200:**
```json
[
  {
    "id": 15,
    "shop_id": 1,
    "to_address": "TRecipient123...",
    "network": "TRON",
    "currency": "USDT",
    "amount": "50.000000",
    "status": "completed",
    "source": "api",
    "reference": "API-withdrawal_456",
    "external_order_id": "withdrawal_456",
    "from_wallet_id": null,
    "tx_hash": "txhash123...",
    "note": null,
    "processed_at": "2026-06-22T15:00:00.000Z",
    "created_at": "2026-06-22T14:55:00.000Z"
  }
]
```

**Поля `source`:**

| Значение | Описание |
|----------|----------|
| `manual` | Создана вручную через кабинет |
| `api` | Создана через публичный Payout API |

---

### Обновить статус выплаты

```
PATCH /api/business/shops/:id/payouts/:payout_id
```

**Заголовок:** `x-api-key: <User API Key>`

**Тело:**
```json
{
  "status": "completed",
  "tx_hash": "txhash123..."
}
```

| status | Описание |
|--------|----------|
| `processing` | В обработке |
| `completed` | Выполнена (отправляет вебхук для API-выплат) |
| `cancelled` | Отменена (возвращает баланс) |

---

## Вебхуки

Вебхуки отправляются `POST`-запросом на `webhook_url` вашего магазина.

**Заголовки:**
```
Content-Type: application/json
X-SwiftX-Event: <event_name>
```

---

### `payment.confirmed` — платёж получен

Отправляется при подтверждении платежа (все режимы: permanent, temporary, invoice).

```json
{
  "event": "payment.confirmed",
  "payment_id": 42,
  "order_id": "order_999",
  "external_user_id": "user_123",
  "address": "TXyz123...",
  "network": "TRON",
  "currency": "USDT",
  "amount_received": "150.000000",
  "tx_hash": "abc123def...",
  "invoice_number": "INV-A1B2C3D4E5"
}
```

> `invoice_number` присутствует только для инвойс-платежей.

---

### `payout.completed` — выплата завершена 🆕

Отправляется только для API-выплат (`source: "api"`) при переводе в статус `completed`.

```json
{
  "event": "payout.completed",
  "payout_id": 15,
  "external_order_id": "withdrawal_456",
  "reference": "API-withdrawal_456",
  "to_address": "TRecipient123...",
  "network": "TRON",
  "amount": "50.000000",
  "currency": "USDT",
  "tx_hash": "txhash123..."
}
```

---

### Повторные попытки

Если ваш сервер не ответил со статусом `2xx`, вебхук будет повторён. Рекомендуется обрабатывать идемпотентно по `payout_id` / `payment_id`.

---

## Поддерживаемые сети

| Сеть | Параметр `network` | Токен | Описание |
|------|--------------------|-------|----------|
| TRON (TRC20) | `TRON` | USDT | Основная сеть для приёма USDT |
| BNB Chain (BEP20) | `BSC` | USDT | Binance Smart Chain |
| TON | `TON` | USDT | The Open Network |
| Polygon | `POLYGON` | USDT, DAI, POL | Polygon PoS |
| TRON GasFree | `TRON` + `mode: gasfree` | USDT | Без комиссии TRX |

---

## Режимы приёма платежей

| Режим | `address_mode` | Описание | Лучше для |
|-------|----------------|----------|-----------|
| Постоянный | `permanent` | Один адрес на `user_id`. Не истекает | Подписки, повторные платежи |
| Временный | `temporary` | Новый адрес на `order_id`. TTL 30 мин | Разовые заказы |
| Инвойс-ссылка | `invoice` | API возвращает URL `/pay/INV-...` Покупатель выбирает сеть сам | Публичные магазины, маркетплейсы |

---

## Примеры интеграции

### Пример 1 — Постоянный адрес (подписка)

```javascript
// Ваш сервер → SwiftX
const resp = await fetch('https://your-domain.com/api/merchant/address', {
  method: 'POST',
  headers: { 'x-shop-key': 'sk_live_xxxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: 'user_123', network: 'TRON', currency: 'USDT' })
});
const { address, payment_id } = await resp.json();
// Показываем address пользователю
```

### Пример 2 — Инвойс-ссылка (магазин)

```javascript
// Ваш сервер → SwiftX
const resp = await fetch('https://your-domain.com/api/merchant/address', {
  method: 'POST',
  headers: { 'x-shop-key': 'sk_live_xxxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    order_id: 'order_999',
    amount: 99.99,
    networks: ['TRON', 'BSC', 'TON']
  })
});
const { invoice_url } = await resp.json();
// Перенаправляем пользователя на invoice_url
res.redirect(invoice_url);
```

### Пример 3 — Вебхук (обработка)

```javascript
app.post('/webhook', express.json(), (req, res) => {
  const { event, payment_id, amount_received, order_id, tx_hash } = req.body;

  if (event === 'payment.confirmed') {
    // Найти заказ по order_id, проверить amount_received
    // Обновить статус заказа
    fulfillOrder(order_id, amount_received, tx_hash);
  }

  if (event === 'payout.completed') {
    const { payout_id, external_order_id } = req.body;
    // Отметить выплату как исполненную
    markWithdrawalComplete(external_order_id, req.body.tx_hash);
  }

  res.sendStatus(200);
});
```

### Пример 4 — API-выплата (вывод средств пользователя)

```javascript
// Пользователь запрашивает вывод → ваш сервер → SwiftX
const resp = await fetch('https://your-domain.com/api/merchant/payout', {
  method: 'POST',
  headers: { 'x-shop-key': 'sk_live_xxxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to_address: 'TUserWallet...',
    network: 'TRON',
    amount: 50.00,
    order_id: `withdrawal_${userId}_${Date.now()}`
  })
});
const { reference, payout_id } = await resp.json();
// Сохранить reference — придёт в вебхуке payout.completed
```

---

## Коды ошибок

| HTTP | Описание |
|------|----------|
| 200 | Успех |
| 400 | Неверный запрос (отсутствуют обязательные поля, недостаточно баланса, неверная сеть) |
| 401 | Неверный API ключ или магазин не активен |
| 403 | Магазин не активен (не прошёл проверку) |
| 404 | Ресурс не найден |
| 500 | Внутренняя ошибка сервера |
| 503 | Внешний сервис недоступен (временно) |

**Формат ошибки:**
```json
{ "error": "Описание ошибки" }
```

---

## Объекты данных

### Магазин (Shop)

| Поле | Тип | Описание |
|------|-----|----------|
| id | integer | ID магазина |
| name | string | Название |
| domain | string | Домен |
| status | string | `pending` / `active` / `suspended` |
| balance_usdt | string | Текущий баланс USDT |
| total_received | string | Всего принято |
| total_paid_out | string | Всего выплачено |
| address_mode | string | Режим: `permanent` / `temporary` / `invoice` |
| enabled_networks | string | JSON-массив разрешённых сетей |
| webhook_url | string | URL для вебхуков |
| api_key | string | Shop API Key |

### Платёж (Payment)

| Поле | Тип | Описание |
|------|-----|----------|
| id | integer | ID платежа |
| order_id | string | Ваш ID заказа |
| external_user_id | string | Ваш ID пользователя |
| wallet_address | string | Адрес для оплаты |
| network | string | Сеть |
| amount | string | Ожидаемая сумма |
| amount_received | string | Фактически получено |
| status | string | `pending` / `confirmed` / `expired` |
| tx_hash | string | Хэш транзакции |
| address_type | string | `permanent` / `temporary` |

### Выплата (Payout)

| Поле | Тип | Описание |
|------|-----|----------|
| id | integer | ID выплаты |
| to_address | string | Адрес получателя |
| network | string | Сеть |
| amount | string | Сумма |
| status | string | `pending` / `processing` / `completed` / `cancelled` |
| source | string | `manual` / `api` |
| reference | string | Внутренний референс (`MyPay-xxx` или `API-xxx`) |
| external_order_id | string | Ваш order_id (только для API-выплат) |
| from_wallet_id | integer | ID кошелька-источника (если авто-перевод) |
| tx_hash | string | Хэш транзакции |

### Инвойс (Invoice)

| Поле | Тип | Описание |
|------|-----|----------|
| invoice_number | string | Номер вида `INV-XXXXXXXXXX` |
| amount | string | Сумма к оплате |
| currency | string | Валюта |
| networks | string[] | Разрешённые сети |
| status | string | `pending` / `confirmed` / `expired` |
| wallet_address | string | Адрес (после выбора сети покупателем) |
| network_chosen | string | Выбранная сеть |
| expires_at | datetime | Истекает через 30 минут |
| tx_hash | string | Хэш транзакции |
