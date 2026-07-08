<?php
/**
 * myPay Test Shop — Webhook Receiver
 * URL: https://yourdomain.com/webhook.php
 * Set this URL in your myPay shop settings as Webhook URL
 *
 * Supported events:
 *   payment.received  — permanent wallet: any incoming tx (no amount matching)
 *   payment.partial   — temporary/invoice: partial payment accumulated
 *   payment.confirmed — temporary/invoice: fully paid
 *   invoice.confirmed — invoice fully paid (alias)
 *   invoice.expired   — invoice expired
 *   payout.completed  — payout sent
 */

// ── DB credentials (same as index.php) ───────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'mypay_test');
define('DB_USER', 'root');
define('DB_PASS', '');

// ── Logging ───────────────────────────────────────────────────────────────────
function app_log(string $level, string $message, array $context = []): void {
    $ts   = date('Y-m-d H:i:s');
    $ctx  = $context ? ' ' . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '';
    $line = "[{$ts}] [{$level}] {$message}{$ctx}" . PHP_EOL;
    @file_put_contents(__DIR__ . '/log.txt', $line, FILE_APPEND | LOCK_EX);
}

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        app_log('FATAL', $err['message'], ['file' => $err['file'], 'line' => $err['line']]);
    }
});

set_exception_handler(function (Throwable $e) {
    app_log('EXCEPTION', $e->getMessage(), ['file' => $e->getFile(), 'line' => $e->getLine()]);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Internal error']);
    exit;
});

// ── DB connection ─────────────────────────────────────────────────────────────
header('Content-Type: application/json');

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    app_log('ERROR', 'DB connection failed', ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => 'DB error']);
    exit;
}

// ── Accept only POST ──────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Read body ─────────────────────────────────────────────────────────────────
$raw     = file_get_contents('php://input');
$payload = json_decode($raw, true);

if (!$payload || !is_array($payload)) {
    app_log('WARN', 'Webhook: invalid JSON received', ['raw' => substr($raw, 0, 200), 'ip' => $_SERVER['REMOTE_ADDR'] ?? '']);
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// ── Extract common fields ─────────────────────────────────────────────────────
$eventType      = $payload['event']           ?? $payload['type']    ?? 'unknown';
$paymentId      = $payload['payment_id']      ?? null;
$invoiceNumber  = $payload['invoice_number']  ?? null;
$status         = $payload['status']          ?? null;
$txHash         = $payload['tx_hash']         ?? null;
$amountReceived = $payload['amount_received'] ?? $payload['amount']  ?? null;

app_log('INFO', "Webhook received: {$eventType}", [
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
                $pdo->prepare("INSERT INTO order_receipts (order_id, tx_hash, amount, network) VALUES (?,?,?,?)")
                    ->execute([$orderId, $txHash, $txAmount, $payload['network'] ?? null]);
                // Accumulate received amount on the order (informational)
                $pdo->prepare("UPDATE orders SET amount_received = COALESCE(amount_received, 0) + ?, updated_at=NOW() WHERE id=?")
                    ->execute([$txAmount ?? 0, $orderId]);
                app_log('INFO', "Order #{$orderId} received tx {$txHash} +{$txAmount} USDT (permanent)", ['network' => $payload['network'] ?? null]);
            } catch (PDOException $e) {
                app_log('ERROR', "Webhook: receipt insert failed #{$orderId}", ['error' => $e->getMessage()]);
            }
        } else {
            app_log('INFO', "Webhook: duplicate tx {$txHash} for order #{$orderId} — skipped");
        }
    } else {
        app_log('WARN', 'Webhook: payment.received — no matching order', ['payment_id' => $paymentId, 'tx_hash' => $txHash]);
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
if ($eventType === 'payment.partial') {
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
