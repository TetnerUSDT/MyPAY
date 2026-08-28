<?php
/**
 * myPay Webhook Handler — webhook.php
 *
 * Установка:
 *   1. Залей этот файл на сервер рядом с index.php
 *   2. В настройках магазина myPay укажи Webhook URL:
 *      https://yourdomain.com/webhook.php
 *   3. DB_* константы должны совпадать с index.php
 */

// ═══════════════════════════════════════════════════════════════
// НАСТРОЙКИ ПОДКЛЮЧЕНИЯ К БД (должны совпадать с index.php)
// ═══════════════════════════════════════════════════════════════
define('DB_HOST', 'localhost');
define('DB_NAME', 'mypay_test');
define('DB_USER', 'mypay_test');
define('DB_PASS', '');
define('LOG_FILE', __DIR__ . '/log.txt');
// ═══════════════════════════════════════════════════════════════

// ── Логирование ───────────────────────────────────────────────
function app_log(string $level, string $message, array $context = []): void {
    $ts   = date('Y-m-d H:i:s');
    $ctx  = $context ? ' ' . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '';
    $line = "[{$ts}] [{$level}] {$message}{$ctx}" . PHP_EOL;
    @file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

// ── DB подключение ────────────────────────────────────────────
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    app_log('ERROR', 'Webhook: DB connection failed', ['error' => $e->getMessage()]);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'DB connection failed']);
    exit;
}

// ── Авто-миграция: создаём таблицы баланса если ещё нет ───────
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users_balances (
          user_id      INT UNSIGNED   NOT NULL,
          balance_usdt DECIMAL(18,8)  NOT NULL DEFAULT 0.00000000,
          last_updated TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS balance_transactions (
          id         INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
          user_id    INT UNSIGNED   NOT NULL,
          order_id   INT UNSIGNED   DEFAULT NULL,
          tx_hash    VARCHAR(200)   NOT NULL,
          amount     DECIMAL(18,8)  NOT NULL,
          direction  ENUM('credit','debit') NOT NULL DEFAULT 'credit',
          event_type VARCHAR(100)   DEFAULT NULL,
          created_at TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_tx_hash (tx_hash),
          INDEX idx_user_id   (user_id),
          INDEX idx_order_id  (order_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (PDOException $e) {
    app_log('WARN', 'Webhook: auto-migrate failed', ['error' => $e->getMessage()]);
}

// ── Чтение config ─────────────────────────────────────────────
function cfg_wh(PDO $pdo, string $key, string $default = ''): string {
    try {
        $s = $pdo->prepare("SELECT value FROM config WHERE `key`=? LIMIT 1");
        $s->execute([$key]);
        $val = $s->fetchColumn();
        return ($val !== false && $val !== '') ? $val : $default;
    } catch (PDOException $e) {
        return $default;
    }
}

// ── Читаем тело запроса ───────────────────────────────────────
header('Content-Type: application/json');

$rawBody = (string)file_get_contents('php://input');
$payload = json_decode($rawBody, true);

if (!is_array($payload)) {
    app_log('WARN', 'Webhook: invalid JSON body', ['raw' => substr($rawBody, 0, 200)]);
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// ── Проверка HMAC-подписи (опционально, если настроен shop_key) ──
$shopKey   = cfg_wh($pdo, 'shop_key', '');
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
if ($shopKey && $signature) {
    $expected = hash_hmac('sha256', $rawBody, $shopKey);
    if (!hash_equals($expected, $signature)) {
        app_log('WARN', 'Webhook: invalid signature', ['ip' => $_SERVER['REMOTE_ADDR'] ?? '']);
        http_response_code(401);
        echo json_encode(['error' => 'Invalid signature']);
        exit;
    }
}

// ── Общие поля ────────────────────────────────────────────────
$eventType      = (string)($payload['event_type'] ?? $payload['event'] ?? '');
$paymentId      = isset($payload['payment_id'])       ? (int)$payload['payment_id'] : null;
$invoiceNumber  = $payload['invoice_number']          ?? null;
$status         = $payload['status']                  ?? null;
$amountReceived = $payload['amount_received']         ?? ($payload['amount'] ?? null);
$txHash         = $payload['tx_hash']                 ?? null;

if (!$eventType) {
    app_log('WARN', 'Webhook: missing event_type', ['payload' => $payload]);
    http_response_code(400);
    echo json_encode(['error' => 'Missing event_type']);
    exit;
}

app_log('INFO', 'Webhook received', [
    'event'          => $eventType,
    'payment_id'     => $paymentId,
    'invoice_number' => $invoiceNumber,
    'status'         => $status,
    'tx_hash'        => $txHash ? substr((string)$txHash, 0, 16) . '…' : null,
    'amount'         => $amountReceived,
    'ip'             => $_SERVER['REMOTE_ADDR'] ?? '',
]);

// ── Handle payout.completed ───────────────────────────────────────────────────
if ($eventType === 'payout.completed') {
    $apiPayoutId     = $payload['payout_id']         ?? null;
    $externalOrderId = $payload['external_order_id'] ?? null;

    $payout = null;
    try {
        if ($apiPayoutId !== null) {
            $stmt = $pdo->prepare("SELECT * FROM payouts WHERE payout_id = ? LIMIT 1");
            $stmt->execute([(int)$apiPayoutId]);
            $payout = $stmt->fetch();
        }
        if (!$payout && $externalOrderId) {
            $stmt = $pdo->prepare("SELECT * FROM payouts WHERE external_order_id = ? LIMIT 1");
            $stmt->execute([$externalOrderId]);
            $payout = $stmt->fetch();
        }
    } catch (PDOException $e) {
        app_log('ERROR', 'Webhook: payout lookup failed', ['error' => $e->getMessage()]);
    }

    if ($payout) {
        if ($payout['status'] !== 'completed') {
            try {
                $pdo->prepare("UPDATE payouts SET status='completed', tx_hash=?, updated_at=NOW() WHERE id=?")
                    ->execute([$txHash, $payout['id']]);
                app_log('INFO', "Payout #{$payout['id']} marked completed", ['payout_id' => $apiPayoutId, 'tx_hash' => $txHash]);
            } catch (PDOException $e) {
                app_log('ERROR', "Webhook: payout update failed #{$payout['id']}", ['error' => $e->getMessage()]);
            }
        } else {
            app_log('INFO', "Payout #{$payout['id']} already completed — idempotent skip");
        }
    } else {
        app_log('WARN', 'Webhook: no matching payout found', ['payout_id' => $apiPayoutId, 'external_order_id' => $externalOrderId]);
    }

    try {
        $pdo->prepare("INSERT INTO webhook_log (event_type, payload, order_id) VALUES (?, ?, ?)")
            ->execute([$eventType, json_encode($payload, JSON_UNESCAPED_UNICODE), null]);
    } catch (PDOException $e) {
        app_log('ERROR', 'Webhook: failed to save payout event to webhook_log', ['error' => $e->getMessage()]);
    }

    http_response_code(200);
    echo json_encode(['ok' => true, 'event' => $eventType, 'payout_id' => $apiPayoutId]);
    exit;
}

// ── Handle payout.cancelled ───────────────────────────────────────────────────
if ($eventType === 'payout.cancelled') {
    $apiPayoutId     = $payload['payout_id']         ?? null;
    $externalOrderId = $payload['external_order_id'] ?? null;

    $payout = null;
    try {
        if ($apiPayoutId !== null) {
            $stmt = $pdo->prepare("SELECT * FROM payouts WHERE payout_id = ? LIMIT 1");
            $stmt->execute([(int)$apiPayoutId]);
            $payout = $stmt->fetch();
        }
        if (!$payout && $externalOrderId) {
            $stmt = $pdo->prepare("SELECT * FROM payouts WHERE external_order_id = ? LIMIT 1");
            $stmt->execute([$externalOrderId]);
            $payout = $stmt->fetch();
        }
    } catch (PDOException $e) {
        app_log('ERROR', 'Webhook: payout lookup failed', ['error' => $e->getMessage()]);
    }

    if ($payout) {
        if ($payout['status'] === 'pending') {
            try {
                $pdo->prepare("UPDATE payouts SET status='failed', updated_at=NOW() WHERE id=?")
                    ->execute([$payout['id']]);
                app_log('INFO', "Payout #{$payout['id']} marked cancelled/failed", ['payout_id' => $apiPayoutId]);
            } catch (PDOException $e) {
                app_log('ERROR', "Webhook: payout cancel update failed #{$payout['id']}", ['error' => $e->getMessage()]);
            }
        } else {
            app_log('INFO', "Payout #{$payout['id']} already {$payout['status']} — idempotent skip");
        }
    } else {
        app_log('WARN', 'Webhook: no matching payout found for cancellation', ['payout_id' => $apiPayoutId, 'external_order_id' => $externalOrderId]);
    }

    try {
        $pdo->prepare("INSERT INTO webhook_log (event_type, payload, order_id) VALUES (?, ?, ?)")
            ->execute([$eventType, json_encode($payload, JSON_UNESCAPED_UNICODE), null]);
    } catch (PDOException $e) {
        app_log('ERROR', 'Webhook: failed to save payout.cancelled to webhook_log', ['error' => $e->getMessage()]);
    }

    http_response_code(200);
    echo json_encode(['ok' => true, 'event' => $eventType, 'payout_id' => $apiPayoutId]);
    exit;
}

// ── Find matching order ───────────────────────────────────────────────────────
$orderId = null;
$order   = null;

try {
    if ($paymentId) {
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE payment_id = ? LIMIT 1");
        $stmt->execute([$paymentId]);
        $order = $stmt->fetch();
    } elseif ($invoiceNumber) {
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE invoice_number = ? LIMIT 1");
        $stmt->execute([$invoiceNumber]);
        $order = $stmt->fetch();
    }
} catch (PDOException $e) {
    app_log('ERROR', 'Webhook: order lookup failed', ['error' => $e->getMessage()]);
}

if ($order) {
    $orderId = $order['id'];
}

// ── payment.received — permanent wallet: any incoming tx ─────────────────────
// Do NOT close the order — just record the receipt and let the admin handle it.
if ($eventType === 'payment.received') {
    $txAmount = $payload['amount'] ?? null;

    if ($order && $txHash) {
        // Idempotent: skip if this tx_hash already recorded
        $dup = false;
        try {
            $stmt = $pdo->prepare("SELECT 1 FROM order_receipts WHERE tx_hash = ? LIMIT 1");
            $stmt->execute([$txHash]);
            $dup = (bool)$stmt->fetchColumn();
        } catch (PDOException $e) {
            app_log('ERROR', 'Webhook: receipt dedup check failed', ['error' => $e->getMessage()]);
        }

        if (!$dup) {
            try {
                $pdo->beginTransaction();

                // 1) Record receipt
                $pdo->prepare("INSERT INTO order_receipts (order_id, tx_hash, amount, network) VALUES (?,?,?,?)")
                    ->execute([$orderId, $txHash, $txAmount, $payload['network'] ?? null]);

                // 2) Accumulate received amount on the order
                $pdo->prepare("UPDATE orders SET amount_received = COALESCE(amount_received, 0) + ?, updated_at=NOW() WHERE id=?")
                    ->execute([$txAmount ?? 0, $orderId]);

                // 3) Credit user balance (idempotent via UNIQUE tx_hash in balance_transactions)
                $userId = $order['user_id'] ?? null;
                if ($userId && $txAmount) {
                    $btStmt = $pdo->prepare("
                        INSERT IGNORE INTO balance_transactions (user_id, order_id, tx_hash, amount, direction, event_type)
                        VALUES (?, ?, ?, ?, 'credit', 'payment.received')
                    ");
                    $btStmt->execute([$userId, $orderId, $txHash, $txAmount]);

                    if ($btStmt->rowCount() > 0) {
                        // Upsert user balance
                        $pdo->prepare("
                            INSERT INTO users_balances (user_id, balance_usdt)
                            VALUES (?, ?)
                            ON DUPLICATE KEY UPDATE balance_usdt = balance_usdt + VALUES(balance_usdt), last_updated = NOW()
                        ")->execute([$userId, $txAmount]);
                        app_log('INFO', "Balance credited: user #{$userId} +{$txAmount} USDT from tx {$txHash}");
                    }
                }

                $pdo->commit();
                app_log('INFO', "Order #{$orderId} received tx {$txHash} +{$txAmount} USDT (permanent)", ['network' => $payload['network'] ?? null]);
            } catch (PDOException $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                app_log('ERROR', "Webhook: receipt insert failed #{$orderId}", ['error' => $e->getMessage()]);
            }
        } else {
            app_log('INFO', "Webhook: duplicate tx {$txHash} for order #{$orderId} — skipped");
        }
    } else {
        // No matching order — try to credit balance directly via external_user_id from payload
        $extUserId = isset($payload['external_user_id']) ? (int)$payload['external_user_id'] : 0;
        $txAmount  = $payload['amount'] ?? null;
        if ($extUserId > 0 && $txAmount && $txHash) {
            $dup2 = false;
            try {
                $s2 = $pdo->prepare("SELECT 1 FROM balance_transactions WHERE tx_hash = ? LIMIT 1");
                $s2->execute([$txHash]);
                $dup2 = (bool)$s2->fetchColumn();
            } catch (PDOException $e) {
                app_log('ERROR', 'Webhook: balance dedup check failed', ['error' => $e->getMessage()]);
            }
            if (!$dup2) {
                try {
                    $pdo->beginTransaction();
                    $btStmt2 = $pdo->prepare("
                        INSERT IGNORE INTO balance_transactions (user_id, order_id, tx_hash, amount, direction, event_type)
                        VALUES (?, NULL, ?, ?, 'credit', 'payment.received')
                    ");
                    $btStmt2->execute([$extUserId, $txHash, $txAmount]);
                    if ($btStmt2->rowCount() > 0) {
                        $pdo->prepare("
                            INSERT INTO users_balances (user_id, balance_usdt)
                            VALUES (?, ?)
                            ON DUPLICATE KEY UPDATE balance_usdt = balance_usdt + VALUES(balance_usdt), last_updated = NOW()
                        ")->execute([$extUserId, $txAmount]);
                        app_log('INFO', "Balance credited via external_user_id: user #{$extUserId} +{$txAmount} USDT from tx {$txHash}");
                    }
                    $pdo->commit();
                } catch (PDOException $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    app_log('ERROR', "Webhook: direct balance credit failed user #{$extUserId}", ['error' => $e->getMessage()]);
                }
            } else {
                app_log('INFO', "Webhook: duplicate tx {$txHash} for user #{$extUserId} — skipped");
            }
        } else {
            app_log('WARN', 'Webhook: payment.received — no matching order and no external_user_id', ['payment_id' => $paymentId, 'tx_hash' => $txHash]);
        }
    }

    // Save to webhook_log
    try {
        $pdo->prepare("INSERT INTO webhook_log (event_type, payload, order_id) VALUES (?, ?, ?)")
            ->execute([$eventType, json_encode($payload, JSON_UNESCAPED_UNICODE), $orderId]);
    } catch (PDOException $e) {
        app_log('ERROR', 'Webhook: failed to save to webhook_log', ['error' => $e->getMessage()]);
    }

    http_response_code(200);
    echo json_encode(['ok' => true, 'event' => $eventType, 'order_id' => $orderId]);
    exit;
}

// ── payment.partial — temporary/invoice: partial accumulation ─────────────────
if (in_array($eventType, ['payment.partial', 'invoice.partial'])) {
    $amountReq  = $payload['amount_required']  ?? null;
    $amountRem  = $payload['amount_remaining'] ?? null;

    if ($order) {
        try {
            $pdo->prepare("UPDATE orders SET status='partially_paid', amount_received=?, tx_hash=?, updated_at=NOW() WHERE id=? AND status IN ('pending','partially_paid')")
                ->execute([$amountReceived, $txHash, $orderId]);
            app_log('INFO', "Order #{$orderId} partially paid", ['received' => $amountReceived, 'required' => $amountReq, 'remaining' => $amountRem]);
        } catch (PDOException $e) {
            app_log('ERROR', "Webhook: partial update failed #{$orderId}", ['error' => $e->getMessage()]);
        }
    } else {
        app_log('WARN', 'Webhook: payment.partial — no matching order', ['payment_id' => $paymentId]);
    }

    try {
        $pdo->prepare("INSERT INTO webhook_log (event_type, payload, order_id) VALUES (?, ?, ?)")
            ->execute([$eventType, json_encode($payload, JSON_UNESCAPED_UNICODE), $orderId]);
    } catch (PDOException $e) {
        app_log('ERROR', 'Webhook: failed to save to webhook_log', ['error' => $e->getMessage()]);
    }

    http_response_code(200);
    echo json_encode(['ok' => true, 'event' => $eventType, 'order_id' => $orderId]);
    exit;
}

// ── payment.confirmed / invoice.confirmed — full payment ──────────────────────
if ($order) {
    $isConfirmed = in_array($eventType, ['invoice.confirmed', 'payment.confirmed', 'confirmed'])
                   || $status === 'confirmed';
    $isExpired   = in_array($eventType, ['invoice.expired', 'payment.expired', 'expired'])
                   || $status === 'expired';

    try {
        if ($isConfirmed && $order['status'] !== 'confirmed') {
            $pdo->prepare("UPDATE orders SET status='confirmed', tx_hash=?, amount_received=?, updated_at=NOW() WHERE id=?")
                ->execute([$txHash, $amountReceived ?? $order['amount_received'], $orderId]);
            app_log('INFO', "Order #{$orderId} marked confirmed", ['tx_hash' => $txHash, 'amount' => $amountReceived]);
        } elseif ($isExpired && $order['status'] === 'pending') {
            $pdo->prepare("UPDATE orders SET status='expired', updated_at=NOW() WHERE id=?")
                ->execute([$orderId]);
            app_log('INFO', "Order #{$orderId} marked expired");
        }
    } catch (PDOException $e) {
        app_log('ERROR', "Webhook: order update failed #{$orderId}", ['error' => $e->getMessage()]);
    }
} else {
    app_log('WARN', 'Webhook: no matching order found', [
        'event'          => $eventType,
        'payment_id'     => $paymentId,
        'invoice_number' => $invoiceNumber,
    ]);
}

// ── Save to webhook_log ───────────────────────────────────────────────────────
try {
    $pdo->prepare("INSERT INTO webhook_log (event_type, payload, order_id) VALUES (?, ?, ?)")
        ->execute([$eventType, json_encode($payload, JSON_UNESCAPED_UNICODE), $orderId]);
} catch (PDOException $e) {
    app_log('ERROR', 'Webhook: failed to save to webhook_log', ['error' => $e->getMessage()]);
}

http_response_code(200);
echo json_encode(['ok' => true, 'event' => $eventType, 'order_id' => $orderId]);
