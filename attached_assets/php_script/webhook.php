<?php
/**
 * myPay Test Shop — Webhook Receiver
 * URL: https://yourdomain.com/webhook.php
 * Configure this URL in your myPay shop settings as Webhook URL
 */

// ── DB connection (same credentials as index.php) ─────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'mypay_test');
define('DB_USER', 'root');
define('DB_PASS', '');

header('Content-Type: application/json');

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB error']);
    exit;
}

// ── Read raw body ─────────────────────────────────────────────────────────────
$raw     = file_get_contents('php://input');
$payload = json_decode($raw, true);

if (!$payload || !is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$eventType     = $payload['event']          ?? $payload['type']           ?? 'unknown';
$paymentId     = $payload['payment_id']     ?? null;
$invoiceNumber = $payload['invoice_number'] ?? null;
$status        = $payload['status']         ?? null;
$txHash        = $payload['tx_hash']        ?? null;
$amountReceived = $payload['amount_received'] ?? null;

// ── Find matching order ───────────────────────────────────────────────────────
$orderId = null;
$order   = null;

if ($paymentId) {
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE payment_id = ? LIMIT 1");
    $stmt->execute([$paymentId]);
    $order = $stmt->fetch();
} elseif ($invoiceNumber) {
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE invoice_number = ? LIMIT 1");
    $stmt->execute([$invoiceNumber]);
    $order = $stmt->fetch();
}

if ($order) {
    $orderId = $order['id'];
}

// ── Update order status if confirmed ─────────────────────────────────────────
if ($order && in_array($eventType, ['invoice.confirmed', 'payment.confirmed', 'confirmed'])) {
    $pdo->prepare("UPDATE orders SET status='confirmed', tx_hash=?, updated_at=NOW() WHERE id=?")
        ->execute([$txHash, $orderId]);
} elseif ($order && in_array($eventType, ['invoice.expired', 'payment.expired', 'expired'])) {
    $pdo->prepare("UPDATE orders SET status='expired', updated_at=NOW() WHERE id=?")
        ->execute([$orderId]);
} elseif ($order && $status === 'confirmed') {
    $pdo->prepare("UPDATE orders SET status='confirmed', tx_hash=?, updated_at=NOW() WHERE id=?")
        ->execute([$txHash, $orderId]);
} elseif ($order && $status === 'expired') {
    $pdo->prepare("UPDATE orders SET status='expired', updated_at=NOW() WHERE id=?")
        ->execute([$orderId]);
}

// ── Save to webhook log ───────────────────────────────────────────────────────
$pdo->prepare("INSERT INTO webhook_log (event_type, payload, order_id) VALUES (?, ?, ?)")
    ->execute([$eventType, json_encode($payload, JSON_UNESCAPED_UNICODE), $orderId]);

// ── Respond 200 OK ────────────────────────────────────────────────────────────
http_response_code(200);
echo json_encode(['ok' => true, 'event' => $eventType, 'order_id' => $orderId]);
