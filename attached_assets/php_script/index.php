<?php
/**
 * myPay Test Shop — index.php
 * PHP 8.0+ / MySQL 8.0+
 *
 * Установка:
 *   1. mysql -u root -p < database.sql
 *   2. Отредактируй DB_* константы ниже
 *   3. Залей на сервер, открой в браузере
 *   4. Перейди в Настройки, введи ключи магазинов и URL сервера
 *   5. В настройках магазина myPay укажи:
 *      Webhook URL: https://yourdomain.com/webhook.php
 */

// ═══════════════════════════════════════════════════════════════
// НАСТРОЙКИ ПОДКЛЮЧЕНИЯ К БД
// ═══════════════════════════════════════════════════════════════
define('DB_HOST', 'localhost');
define('DB_NAME', 'mypay_test');
define('DB_USER', 'root');
define('DB_PASS', '');
define('LOG_FILE', __DIR__ . '/log.txt');
// ═══════════════════════════════════════════════════════════════

// ── Логирование ───────────────────────────────────────────────────────────────
function app_log(string $level, string $message, array $context = []): void {
    $ts   = date('Y-m-d H:i:s');
    $ctx  = $context ? ' ' . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '';
    $line = "[{$ts}] [{$level}] {$message}{$ctx}" . PHP_EOL;
    @file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

// Перехват PHP исключений
set_exception_handler(function (Throwable $e) {
    app_log('EXCEPTION', $e->getMessage(), [
        'file'  => $e->getFile(),
        'line'  => $e->getLine(),
        'trace' => substr($e->getTraceAsString(), 0, 500),
    ]);
    if (isset($_GET['action'])) {
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Internal server error']);
    } else {
        http_response_code(500);
        echo '<pre style="color:red">Error: ' . htmlspecialchars($e->getMessage()) . '</pre>';
    }
    exit;
});

// Перехват фатальных ошибок
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        app_log('FATAL', $err['message'], ['file' => $err['file'], 'line' => $err['line']]);
    }
});

session_start();

// ── DB подключение ────────────────────────────────────────────────────────────
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    app_log('ERROR', 'DB connection failed', ['error' => $e->getMessage()]);
    if (isset($_GET['action'])) {
        header('Content-Type: application/json');
        echo json_encode(['error' => 'DB: ' . $e->getMessage()]);
        exit;
    }
    die('<h2 style="color:#ff4444;font-family:monospace;padding:40px">Ошибка подключения к БД: '
        . htmlspecialchars($e->getMessage())
        . '<br><br>Проверь константы DB_* в начале index.php</h2>');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function cfg(PDO $pdo, string $key, string $default = ''): string {
    static $cache = [];
    if (!isset($cache[$key])) {
        $s = $pdo->prepare("SELECT value FROM config WHERE `key`=? LIMIT 1");
        $s->execute([$key]);
        $val = $s->fetchColumn();
        $cache[$key] = ($val !== false && $val !== '') ? $val : $default;
    }
    return $cache[$key];
}

function setcfg(PDO $pdo, string $key, string $value): void {
    $pdo->prepare("INSERT INTO config(`key`,`value`) VALUES(?,?) ON DUPLICATE KEY UPDATE `value`=?")
        ->execute([$key, $value, $value]);
}

/**
 * HTTP-запрос через cURL (не зависит от allow_url_fopen).
 * Логирует ошибки и нестандартные статусы.
 */
function api(string $base, string $shopKey, string $method, string $path, array $body = []): array {
    $url = rtrim($base, '/') . $path;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-shop-key: ' . $shopKey,
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => false,
    ]);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $raw    = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $curlErr) {
        app_log('ERROR', "API request failed: {$method} {$url}", ['curl_error' => $curlErr]);
        return ['error' => 'Запрос не выполнен: ' . $curlErr];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        app_log('ERROR', "API invalid JSON: {$method} {$url}", ['http' => $httpCode, 'raw' => substr($raw, 0, 300)]);
        return ['error' => "Невалидный JSON (HTTP {$httpCode})", 'raw' => substr($raw, 0, 300)];
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        app_log('WARN', "API non-2xx: {$method} {$url}", ['http' => $httpCode, 'response' => $decoded]);
    }

    return $decoded;
}

/** Генерирует уникальный order reference */
function makeOrderRef(int $uid, int $productId): string {
    return 'ord_' . $uid . '_' . $productId . '_' . bin2hex(random_bytes(5));
}

// ── Текущий пользователь ──────────────────────────────────────────────────────
if (isset($_GET['user_id'])) {
    $_SESSION['uid'] = (int)$_GET['user_id'];
}
$uid = (int)($_SESSION['uid'] ?? 1);

// ═══════════════════════════════════════════════════════════════
// AJAX HANDLERS
// ═══════════════════════════════════════════════════════════════
$action = $_GET['action'] ?? '';

if ($action) {
    header('Content-Type: application/json; charset=utf-8');

    $baseUrl = cfg($pdo, 'base_url',           'https://mypay.casa');
    $keyPerm = cfg($pdo, 'shop_key_permanent',  '');
    $keyTemp = cfg($pdo, 'shop_key_temporary',  '');
    $keyInv  = cfg($pdo, 'shop_key_invoice',    '');
    $defNet  = cfg($pdo, 'default_network',     'TRON');
    $input   = json_decode(file_get_contents('php://input'), true) ?? [];

    // ── Сохранить настройки ───────────────────────────────────
    if ($action === 'save_settings') {
        $allowed = ['base_url','shop_key_permanent','shop_key_temporary','shop_key_invoice','default_network'];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $input)) {
                setcfg($pdo, $f, trim((string)$input[$f]));
            }
        }
        app_log('INFO', 'Settings updated');
        echo json_encode(['ok' => true]);
        exit;
    }

    // ── Загрузить настройки ───────────────────────────────────
    if ($action === 'get_settings') {
        echo json_encode([
            'base_url'           => $baseUrl,
            'shop_key_permanent' => $keyPerm,
            'shop_key_temporary' => $keyTemp,
            'shop_key_invoice'   => $keyInv,
            'default_network'    => $defNet,
        ]);
        exit;
    }

    // ── Получить адрес (постоянный / временный) ───────────────
    if ($action === 'get_address') {
        $mode      = in_array($input['mode'] ?? '', ['permanent','temporary']) ? $input['mode'] : 'permanent';
        $productId = (int)($input['product_id'] ?? 0);
        $network   = in_array($input['network'] ?? '', ['TRON','BSC','TON','POLYGON']) ? $input['network'] : $defNet;
        $shopKey   = ($mode === 'temporary') ? $keyTemp : $keyPerm;

        if (!$shopKey) {
            echo json_encode(['error' => "Не задан ключ магазина для режима «{$mode}»"]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT * FROM products WHERE id=? LIMIT 1");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) { echo json_encode(['error' => 'Товар не найден']); exit; }

        $ordRef  = makeOrderRef($uid, $productId);
        $apiResp = api($baseUrl, $shopKey, 'POST', '/api/merchant/address', [
            'network'  => $network,
            'user_id'  => (string)$uid,
            'order_id' => $ordRef,
            'amount'   => (float)$product['price_usdt'],
            'currency' => 'USDT',
        ]);

        $paymentId = $apiResp['payment_id'] ?? null;
        $address   = $apiResp['address']    ?? null;

        try {
            $pdo->prepare("INSERT INTO orders (user_id,product_id,payment_mode,network,amount,payment_id,wallet_address,api_response) VALUES (?,?,?,?,?,?,?,?)")
                ->execute([$uid, $productId, $mode, $network, $product['price_usdt'], $paymentId, $address, json_encode($apiResp)]);
        } catch (PDOException $e) {
            app_log('ERROR', 'Order insert failed', ['error' => $e->getMessage()]);
        }

        app_log('INFO', "New {$mode} payment", ['uid' => $uid, 'product_id' => $productId, 'network' => $network, 'payment_id' => $paymentId]);
        echo json_encode(['api' => $apiResp, 'order_id' => $pdo->lastInsertId(), 'product' => $product['name']]);
        exit;
    }

    // ── Получить инвойс ───────────────────────────────────────
    if ($action === 'get_invoice') {
        $productId = (int)($input['product_id'] ?? 0);
        if (!$keyInv) { echo json_encode(['error' => 'Не задан ключ магазина для режима «invoice»']); exit; }

        $stmt = $pdo->prepare("SELECT * FROM products WHERE id=? LIMIT 1");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) { echo json_encode(['error' => 'Товар не найден']); exit; }

        $ordRef  = makeOrderRef($uid, $productId);
        $apiResp = api($baseUrl, $keyInv, 'POST', '/api/merchant/address', [
            'user_id'  => (string)$uid,
            'order_id' => $ordRef,
            'amount'   => (float)$product['price_usdt'],
            'currency' => 'USDT',
        ]);

        $invoiceNumber = $apiResp['invoice_number'] ?? null;

        try {
            $pdo->prepare("INSERT INTO orders (user_id,product_id,payment_mode,network,amount,invoice_number,api_response) VALUES (?,?,?,?,?,?,?)")
                ->execute([$uid, $productId, 'invoice', null, $product['price_usdt'], $invoiceNumber, json_encode($apiResp)]);
        } catch (PDOException $e) {
            app_log('ERROR', 'Invoice order insert failed', ['error' => $e->getMessage()]);
        }

        app_log('INFO', 'New invoice payment', ['uid' => $uid, 'product_id' => $productId, 'invoice_number' => $invoiceNumber]);
        echo json_encode(['api' => $apiResp, 'order_id' => $pdo->lastInsertId(), 'product' => $product['name']]);
        exit;
    }

    // ── Проверить статус платежа ──────────────────────────────
    if ($action === 'check_status') {
        $orderId = (int)($input['order_id'] ?? 0);
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id=? LIMIT 1");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if (!$order) { echo json_encode(['error' => 'Заказ не найден']); exit; }

        $mode    = $order['payment_mode'];
        $shopKey = match($mode) { 'temporary' => $keyTemp, 'invoice' => $keyInv, default => $keyPerm };
        if (!$shopKey) { echo json_encode(['error' => "Ключ магазина для режима «{$mode}» не задан"]); exit; }

        if ($mode === 'invoice' && $order['invoice_number']) {
            // Invoice endpoint is public — no shop key needed, but we send it anyway (ignored)
            $apiResp = api($baseUrl, $shopKey, 'GET', '/api/merchant/invoice/' . rawurlencode($order['invoice_number']));
            $status  = $apiResp['status']  ?? null;
            $txHash  = $apiResp['tx_hash'] ?? null;
        } else {
            // Триггер re-check
            api($baseUrl, $shopKey, 'POST', '/api/merchant/check-payment', ['payment_id' => (int)$order['payment_id']]);
            // Получить актуальный статус
            $apiResp = api($baseUrl, $shopKey, 'GET', '/api/merchant/payment/' . rawurlencode($order['payment_id']));
            $status  = $apiResp['status']  ?? null;
            $txHash  = $apiResp['tx_hash'] ?? null;
        }

        // Обновить локальный заказ
        try {
            if ($status === 'confirmed' && $order['status'] !== 'confirmed') {
                $pdo->prepare("UPDATE orders SET status='confirmed', tx_hash=?, updated_at=NOW() WHERE id=?")
                    ->execute([$txHash, $orderId]);
                app_log('INFO', "Order #{$orderId} confirmed via manual check", ['tx_hash' => $txHash]);
            } elseif ($status === 'expired' && $order['status'] === 'pending') {
                $pdo->prepare("UPDATE orders SET status='expired', updated_at=NOW() WHERE id=?")
                    ->execute([$orderId]);
                app_log('INFO', "Order #{$orderId} expired via manual check");
            }
        } catch (PDOException $e) {
            app_log('ERROR', "Order status update failed #{$orderId}", ['error' => $e->getMessage()]);
        }

        $order['status'] = $status ?: $order['status'];
        echo json_encode(['api' => $apiResp, 'local_status' => $order['status'], 'mode' => $mode]);
        exit;
    }

    // ── Данные заказов для таблицы ────────────────────────────
    if ($action === 'get_orders') {
        $rows = $pdo->query("
            SELECT o.*, u.name AS uname, u.avatar AS uavatar, p.name AS pname, p.emoji AS pemoji
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            LEFT JOIN products p ON p.id = o.product_id
            ORDER BY o.created_at DESC LIMIT 100
        ")->fetchAll();
        echo json_encode($rows);
        exit;
    }

    // ── Данные вебхуков для таблицы ───────────────────────────
    if ($action === 'get_webhooks') {
        $rows = $pdo->query("SELECT * FROM webhook_log ORDER BY received_at DESC LIMIT 50")->fetchAll();
        echo json_encode($rows);
        exit;
    }

    // ── Последние строки лога ─────────────────────────────────
    if ($action === 'get_log') {
        $logFile = LOG_FILE;
        if (!file_exists($logFile)) {
            echo json_encode(['lines' => [], 'size' => 0]);
            exit;
        }
        $lines = array_filter(explode("\n", file_get_contents($logFile)));
        $lines = array_values(array_slice(array_reverse($lines), 0, 100));
        echo json_encode(['lines' => $lines, 'size' => filesize($logFile)]);
        exit;
    }

    // ── Очистить лог ──────────────────────────────────────────
    if ($action === 'clear_log') {
        file_put_contents(LOG_FILE, '');
        app_log('INFO', 'Log cleared by user');
        echo json_encode(['ok' => true]);
        exit;
    }

    echo json_encode(['error' => 'Неизвестный action']);
    exit;
}

// ═══════════════════════════════════════════════════════════════
// РЕНДЕР СТРАНИЦЫ
// ═══════════════════════════════════════════════════════════════
$page     = in_array($_GET['page'] ?? '', ['shop','orders','webhooks','settings','log']) ? $_GET['page'] : 'shop';
$users    = $pdo->query("SELECT * FROM users ORDER BY id")->fetchAll();
$products = $pdo->query("SELECT * FROM products ORDER BY id")->fetchAll();
$curUser  = array_values(array_filter($users, fn($u) => (int)$u['id'] === $uid))[0] ?? ($users[0] ?? []);

$orderCount   = (int)$pdo->query("SELECT COUNT(*) FROM orders WHERE status='pending'")->fetchColumn();
$webhookCount = (int)$pdo->query("SELECT COUNT(*) FROM webhook_log WHERE received_at > NOW() - INTERVAL 1 HOUR")->fetchColumn();
$logExists    = file_exists(LOG_FILE);

$proto   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$webRoot = $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(dirname($_SERVER['PHP_SELF']), '/');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>myPay · Test Shop</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:     #0A0D12;  --card:   #13151A;  --card2: #1A1D24;
    --border: rgba(255,255,255,0.07);
    --green:  #3ab368;  --green2: #2EEA7F;
    --text:   #ffffff;  --muted:  rgba(255,255,255,0.45);
    --danger: #ff4f4f;  --warn:   #f5a623;
    --radius: 16px;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; font-size: 14px; min-height: 100vh; }
  a { color: inherit; text-decoration: none; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 0 16px 80px; }

  /* Header */
  .header { position: sticky; top: 0; z-index: 100; background: rgba(10,13,18,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); padding: 12px 16px; }
  .header-inner { max-width: 920px; margin: 0 auto; display: flex; align-items: center; gap: 12px; }
  .logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; }
  .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); }
  .logo-badge { font-size: 10px; font-weight: 600; background: rgba(58,179,104,0.15); color: var(--green); border: 1px solid rgba(58,179,104,0.3); padding: 2px 8px; border-radius: 20px; }
  .user-sel { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; }
  .user-sel select { background: none; border: none; color: var(--text); font-family: inherit; font-size: 13px; cursor: pointer; outline: none; max-width: 150px; }
  .user-sel select option { background: #1A1D24; }

  /* Nav */
  .nav { display: flex; gap: 4px; padding: 16px 0 8px; overflow-x: auto; scrollbar-width: none; }
  .nav::-webkit-scrollbar { display: none; }
  .nav a { padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 500; color: var(--muted); white-space: nowrap; transition: all .15s; }
  .nav a:hover { color: var(--text); background: rgba(255,255,255,0.04); }
  .nav a.active { background: rgba(58,179,104,0.12); color: var(--green); }
  .nav-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; background: var(--green); color: #fff; font-size: 10px; font-weight: 700; border-radius: 9px; padding: 0 4px; margin-left: 4px; }

  /* Cards */
  .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); }
  .card-pad { padding: 20px; }

  /* Products */
  .products { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .product-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; cursor: pointer; transition: all .2s; }
  .product-card:hover { border-color: rgba(58,179,104,0.4); background: rgba(58,179,104,0.04); transform: translateY(-2px); }
  .product-emoji { font-size: 36px; margin-bottom: 12px; display: block; }
  .product-name  { font-weight: 600; font-size: 15px; margin-bottom: 6px; }
  .product-desc  { font-size: 12px; color: var(--muted); margin-bottom: 14px; line-height: 1.5; }
  .product-price { font-size: 18px; font-weight: 700; color: var(--green); }
  .product-price small { font-size: 12px; font-weight: 400; color: var(--muted); }
  .btn-buy { width: 100%; margin-top: 14px; padding: 10px; background: var(--green); color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity .15s; }
  .btn-buy:hover { opacity: .85; }

  /* Modal */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 200; align-items: center; justify-content: center; padding: 16px; }
  .modal-overlay.open { display: flex; }
  .modal { background: var(--card); border: 1px solid var(--border); border-radius: 20px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
  .modal-head { padding: 20px 20px 0; display: flex; align-items: flex-start; gap: 12px; }
  .modal-emoji { font-size: 28px; }
  .modal-close { margin-left: auto; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: none; color: var(--muted); cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .modal-close:hover { color: var(--text); }
  .tabs { display: flex; gap: 4px; padding: 14px 20px 0; }
  .tab-btn { flex: 1; padding: 8px 4px; border-radius: 8px; border: 1px solid var(--border); background: none; color: var(--muted); font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all .15s; white-space: nowrap; }
  .tab-btn.active { background: rgba(58,179,104,0.12); border-color: rgba(58,179,104,0.35); color: var(--green); }
  .tab-panel { display: none; padding: 16px 20px 20px; }
  .tab-panel.active { display: block; }

  /* Forms */
  .field { margin-bottom: 12px; }
  .field label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 5px; font-weight: 500; }
  .field select, .field input[type=text], .field input[type=url] {
    width: 100%; background: var(--card2); border: 1px solid var(--border); border-radius: 10px;
    padding: 10px 12px; color: var(--text); font-family: inherit; font-size: 13px; outline: none; transition: border-color .15s;
  }
  .field select:focus, .field input:focus { border-color: rgba(58,179,104,0.5); }
  .field select option { background: #1A1D24; }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 20px; border-radius: 10px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity .15s; }
  .btn:disabled { opacity: .4; cursor: default; }
  .btn-primary { background: var(--green); color: #fff; width: 100%; padding: 12px; }
  .btn-primary:hover:not(:disabled) { opacity: .85; }
  .btn-outline { background: rgba(255,255,255,0.06); color: var(--text); border: 1px solid var(--border); }
  .btn-outline:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
  .btn-sm { padding: 5px 12px; font-size: 11px; }

  /* Result */
  .result-box { margin-top: 14px; background: var(--card2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .result-head { padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .result-body { padding: 14px; }
  .result-status { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
  .s-pending   { background: rgba(245,166,35,0.15); color: var(--warn); }
  .s-confirmed { background: rgba(58,179,104,0.15); color: var(--green); }
  .s-expired   { background: rgba(255,79,79,0.15);  color: var(--danger); }
  .s-failed    { background: rgba(255,79,79,0.15);  color: var(--danger); }

  .address-block { background: rgba(58,179,104,0.06); border: 1px solid rgba(58,179,104,0.2); border-radius: 10px; padding: 14px; margin-bottom: 12px; }
  .address-label { font-size: 10px; color: var(--green); font-weight: 600; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 6px; }
  .address-value { font-family: monospace; font-size: 12px; word-break: break-all; }
  .address-copy  { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .btn-copy { padding: 5px 12px; background: rgba(58,179,104,0.15); border: 1px solid rgba(58,179,104,0.3); color: var(--green); border-radius: 7px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .btn-copy:hover { background: rgba(58,179,104,0.25); }
  .invoice-link { color: var(--green); text-decoration: underline; font-size: 12px; word-break: break-all; }

  .qr-wrap { display: flex; justify-content: center; margin: 10px 0; }
  .qr-wrap img { border-radius: 8px; border: 3px solid white; }

  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
  .info-row:last-child { border-bottom: none; }
  .info-row .k { color: var(--muted); }
  .info-row .v { font-weight: 500; font-family: monospace; font-size: 11px; }

  .json-toggle { width: 100%; text-align: left; background: none; border: none; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; font-family: inherit; cursor: pointer; padding: 8px 14px; display: flex; align-items: center; gap: 4px; }
  .json-toggle:hover { color: var(--text); }
  .json-pre { display: none; background: #0A0D12; padding: 12px 14px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #a8d5b5; border-top: 1px solid var(--border); max-height: 220px; overflow-y: auto; }
  .json-pre.open { display: block; }

  /* Notice */
  .notice { background: rgba(245,166,35,0.08); border: 1px solid rgba(245,166,35,0.2); border-radius: 10px; padding: 12px 14px; font-size: 12px; color: var(--warn); margin-top: 10px; line-height: 1.5; }

  /* Tables */
  .tbl-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 10px 14px; font-size: 10px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 11px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  .mode-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; text-transform: uppercase; white-space: nowrap; }
  .mode-permanent { background: rgba(58,179,104,0.1);  color: #3ab368; }
  .mode-temporary { background: rgba(99,179,237,0.1);  color: #63b3ed; }
  .mode-invoice   { background: rgba(245,166,35,0.1);  color: #f5a623; }
  .mono { font-family: monospace; font-size: 11px; }

  /* Settings */
  .settings-section { margin-bottom: 28px; }
  .settings-section h4 { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
  .settings-note { font-size: 12px; color: var(--muted); background: rgba(58,179,104,0.05); border: 1px solid rgba(58,179,104,0.15); border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; line-height: 1.7; }
  .settings-note strong { color: var(--green); }

  /* Log page */
  .log-line { font-family: monospace; font-size: 11px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04); word-break: break-all; }
  .log-line.ERROR, .log-line.FATAL { color: #ff6b6b; }
  .log-line.WARN  { color: var(--warn); }
  .log-line.INFO  { color: var(--muted); }
  .log-line.EXCEPTION { color: #ff6b6b; }

  /* Utils */
  .empty { text-align: center; padding: 60px 20px; color: var(--muted); }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .spin { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  #toast { position: fixed; bottom: 24px; right: 16px; background: var(--card2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 18px; font-size: 13px; font-weight: 500; z-index: 999; transform: translateY(80px); opacity: 0; transition: all .25s; max-width: 280px; }
  #toast.show { transform: translateY(0); opacity: 1; }
  #toast.ok  { border-color: rgba(58,179,104,0.4); }
  #toast.err { border-color: rgba(255,79,79,0.4); color: var(--danger); }
  @media (max-width: 500px) { .products { grid-template-columns: 1fr 1fr; } .tab-btn { font-size: 11px; } }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-inner">
    <div class="logo">
      <div class="logo-dot"></div>
      myPay <span class="logo-badge">Test Shop</span>
    </div>
    <div style="flex:1"></div>
    <form class="user-sel" method="get" style="gap:8px">
      <span><?= htmlspecialchars($curUser['avatar'] ?? '👤', ENT_QUOTES, 'UTF-8') ?></span>
      <select name="user_id" onchange="this.form.submit()">
        <?php foreach ($users as $u): ?>
        <option value="<?= (int)$u['id'] ?>" <?= ((int)$u['id'] === $uid) ? 'selected' : '' ?>>
          <?= htmlspecialchars($u['name'], ENT_QUOTES, 'UTF-8') ?>
        </option>
        <?php endforeach; ?>
      </select>
      <input type="hidden" name="page" value="<?= htmlspecialchars($page, ENT_QUOTES, 'UTF-8') ?>">
    </form>
  </div>
</div>

<div class="wrap">
  <nav class="nav">
    <a href="?page=shop&user_id=<?= $uid ?>"     class="<?= $page==='shop'     ? 'active':'' ?>">🛍 Магазин</a>
    <a href="?page=orders&user_id=<?= $uid ?>"   class="<?= $page==='orders'   ? 'active':'' ?>">
      📦 Заказы<?php if ($orderCount>0): ?><span class="nav-badge"><?= $orderCount ?></span><?php endif; ?>
    </a>
    <a href="?page=webhooks&user_id=<?= $uid ?>" class="<?= $page==='webhooks' ? 'active':'' ?>">
      🔔 Вебхуки<?php if ($webhookCount>0): ?><span class="nav-badge"><?= $webhookCount ?></span><?php endif; ?>
    </a>
    <a href="?page=settings&user_id=<?= $uid ?>" class="<?= $page==='settings' ? 'active':'' ?>">⚙️ Настройки</a>
    <a href="?page=log&user_id=<?= $uid ?>"      class="<?= $page==='log'      ? 'active':'' ?>">
      📋 Лог<?php if ($logExists && filesize(LOG_FILE)>0): ?><span class="nav-badge" style="background:var(--warn)">!</span><?php endif; ?>
    </a>
  </nav>

  <!-- ══════════════════ SHOP ══════════════════ -->
  <?php if ($page === 'shop'): ?>
  <div style="margin-bottom:18px">
    <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Покупатель</div>
    <div style="font-size:15px;font-weight:600">
      <?= htmlspecialchars(($curUser['avatar'] ?? '') . ' ' . ($curUser['name'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
      <span style="font-size:12px;color:var(--muted);font-weight:400">(ID: <?= $uid ?>)</span>
    </div>
  </div>
  <div class="products">
    <?php foreach ($products as $p): ?>
    <div class="product-card" onclick="openModal(<?= htmlspecialchars(json_encode([
      'id'          => (int)$p['id'],
      'name'        => $p['name'],
      'description' => $p['description'],
      'price_usdt'  => $p['price_usdt'],
      'emoji'       => $p['emoji'],
    ]), ENT_QUOTES, 'UTF-8') ?>)">
      <span class="product-emoji"><?= htmlspecialchars($p['emoji'], ENT_QUOTES, 'UTF-8') ?></span>
      <div class="product-name"><?= htmlspecialchars($p['name'], ENT_QUOTES, 'UTF-8') ?></div>
      <div class="product-desc"><?= htmlspecialchars($p['description'], ENT_QUOTES, 'UTF-8') ?></div>
      <div class="product-price"><?= number_format((float)$p['price_usdt'], 2) ?> <small>USDT</small></div>
      <button class="btn-buy" onclick="event.stopPropagation();openModal(<?= htmlspecialchars(json_encode([
        'id'         => (int)$p['id'],
        'name'       => $p['name'],
        'price_usdt' => $p['price_usdt'],
        'emoji'      => $p['emoji'],
      ]), ENT_QUOTES, 'UTF-8') ?>)">Купить</button>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>

  <!-- ══════════════════ ORDERS ══════════════════ -->
  <?php if ($page === 'orders'): ?>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div style="font-weight:600;font-size:15px">История заказов</div>
    <button class="btn btn-outline btn-sm" onclick="refreshOrders()">↻ Обновить</button>
  </div>
  <div class="card">
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>#</th><th>Покупатель</th><th>Товар</th><th>Режим</th><th>Сумма</th><th>Статус</th><th>Дата</th><th>ID платежа</th></tr></thead>
        <tbody id="orders-body"><tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)"><span class="spin"></span></td></tr></tbody>
      </table>
    </div>
  </div>
  <?php endif; ?>

  <!-- ══════════════════ WEBHOOKS ══════════════════ -->
  <?php if ($page === 'webhooks'): ?>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div>
      <div style="font-weight:600;font-size:15px">Входящие вебхуки</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">
        Webhook URL для myPay:
        <code style="color:var(--green);font-size:11px"><?= htmlspecialchars($webRoot . '/webhook.php', ENT_QUOTES, 'UTF-8') ?></code>
      </div>
    </div>
    <button class="btn btn-outline btn-sm" onclick="refreshWebhooks()">↻ Обновить</button>
  </div>
  <div class="card">
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>#</th><th>Событие</th><th>Заказ</th><th>Получен</th><th>Payload</th></tr></thead>
        <tbody id="webhooks-body"><tr><td colspan="5" style="text-align:center;padding:40px;color:var(--muted)"><span class="spin"></span></td></tr></tbody>
      </table>
    </div>
  </div>
  <?php endif; ?>

  <!-- ══════════════════ SETTINGS ══════════════════ -->
  <?php if ($page === 'settings'): ?>
  <div style="font-weight:600;font-size:15px;margin-bottom:20px">Настройки</div>
  <div class="card card-pad">
    <div class="settings-note">
      <strong>Схема подключения:</strong><br>
      1. Создай <strong>3 магазина</strong> в myPay в разных режимах (постоянный / временный / инвойс)<br>
      2. Скопируй API ключ каждого магазина и вставь ниже<br>
      3. В каждом магазине укажи Webhook URL:
      <strong><?= htmlspecialchars($webRoot . '/webhook.php', ENT_QUOTES, 'UTF-8') ?></strong>
    </div>

    <div class="settings-section">
      <h4>Сервер myPay</h4>
      <div class="field"><label>Base URL сервера</label><input type="url" id="cfg_base_url" placeholder="https://mypay.casa"></div>
      <div class="field">
        <label>Сеть по умолчанию</label>
        <select id="cfg_default_network">
          <option value="TRON">TRON (TRC20 USDT)</option>
          <option value="BSC">BNB Chain (BEP20 USDT)</option>
          <option value="TON">TON (USDT)</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h4>Ключи магазинов (x-shop-key)</h4>
      <div class="field"><label>🟢 Постоянный адрес — магазин в режиме «permanent»</label><input type="text" id="cfg_key_perm" placeholder="sk_live_..."></div>
      <div class="field"><label>🔵 Временный адрес — магазин в режиме «temporary»</label><input type="text" id="cfg_key_temp" placeholder="sk_live_..."></div>
      <div class="field"><label>🟡 Инвойс-ссылка — магазин в режиме «invoice»</label><input type="text" id="cfg_key_inv" placeholder="sk_live_..."></div>
    </div>

    <button class="btn btn-primary" onclick="saveSettings()">Сохранить настройки</button>
    <div id="settings-msg" style="margin-top:12px;font-size:13px;color:var(--green);display:none">✓ Настройки сохранены</div>
  </div>
  <?php endif; ?>

  <!-- ══════════════════ LOG ══════════════════ -->
  <?php if ($page === 'log'): ?>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-weight:600;font-size:15px">Журнал ошибок — log.txt</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">
        Последние 100 строк · Автообновление каждые 10 сек
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline btn-sm" onclick="refreshLog()">↻ Обновить</button>
      <button class="btn btn-outline btn-sm" onclick="clearLog()" style="color:var(--danger);border-color:rgba(255,79,79,0.3)">🗑 Очистить</button>
    </div>
  </div>
  <div class="card card-pad" style="padding-bottom:8px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-size:11px;color:var(--muted)">Размер файла: <span id="log-size">—</span></span>
      <span style="font-size:11px;color:var(--muted)">Путь: <code style="color:var(--green)"><?= htmlspecialchars(LOG_FILE, ENT_QUOTES, 'UTF-8') ?></code></span>
    </div>
    <div id="log-lines" style="min-height:200px">
      <div style="text-align:center;padding:40px;color:var(--muted)"><span class="spin"></span></div>
    </div>
  </div>
  <?php endif; ?>

</div><!-- /wrap -->

<!-- ══════════════════ MODAL ══════════════════ -->
<div class="modal-overlay" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <div class="modal-head">
      <span class="modal-emoji" id="m-emoji"></span>
      <div>
        <div style="font-weight:700;font-size:16px" id="m-name"></div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px" id="m-price"></div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('permanent',this)">🟢 Постоянный</button>
      <button class="tab-btn"        onclick="switchTab('temporary',this)">🔵 Временный</button>
      <button class="tab-btn"        onclick="switchTab('invoice',this)">🟡 Инвойс</button>
    </div>

    <!-- Permanent -->
    <div class="tab-panel active" id="tab-permanent">
      <div class="field"><label>Сеть</label>
        <select id="perm-network">
          <option value="TRON">TRON (TRC20 USDT)</option>
          <option value="BSC">BNB Chain (BEP20 USDT)</option>
          <option value="TON">TON (USDT)</option>
        </select>
      </div>
      <div class="notice">Один адрес на пользователя. Повторная покупка тем же ID вернёт тот же адрес. <strong>Вебхук не приходит</strong> — используй кнопку «Проверить».</div>
      <button class="btn btn-primary" id="perm-btn" onclick="getAddress('permanent')" style="margin-top:12px">Создать оплату</button>
      <div id="perm-result"></div>
    </div>

    <!-- Temporary -->
    <div class="tab-panel" id="tab-temporary">
      <div class="field"><label>Сеть</label>
        <select id="temp-network">
          <option value="TRON">TRON (TRC20 USDT)</option>
          <option value="BSC">BNB Chain (BEP20 USDT)</option>
          <option value="TON">TON (USDT)</option>
        </select>
      </div>
      <div class="notice">Новый адрес на каждый заказ, действует 30 минут. <strong>Вебхук не приходит</strong> — используй кнопку «Проверить».</div>
      <button class="btn btn-primary" id="temp-btn" onclick="getAddress('temporary')" style="margin-top:12px">Создать оплату</button>
      <div id="temp-result"></div>
    </div>

    <!-- Invoice -->
    <div class="tab-panel" id="tab-invoice">
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.7">
        Покупатель выбирает сеть на странице инвойса.
        <strong style="color:var(--green)">Вебхук приходит автоматически</strong> после оплаты — статус обновится сам.
      </p>
      <button class="btn btn-primary" id="inv-btn" onclick="getInvoice()">Создать инвойс</button>
      <div id="inv-result"></div>
    </div>
  </div>
</div>

<div id="toast"></div>

<script>
const UID = <?= (int)$uid ?>;
let currentProduct = null;

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(p) {
  currentProduct = p;
  document.getElementById('m-emoji').textContent = p.emoji || '📦';
  document.getElementById('m-name').textContent  = p.name  || '';
  document.getElementById('m-price').textContent = parseFloat(p.price_usdt || 0).toFixed(2) + ' USDT';
  document.getElementById('modal').classList.add('open');
  ['perm-result','temp-result','inv-result'].forEach(id => { document.getElementById(id).innerHTML = ''; });
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }

function switchTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────
async function post(action, body) {
  try {
    const r = await fetch('?action=' + action, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
    });
    return await r.json();
  } catch(e) {
    return {error: 'Fetch failed: ' + e.message};
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────
async function getAddress(mode) {
  if (!currentProduct) return;
  const netSel  = document.getElementById(mode === 'permanent' ? 'perm-network' : 'temp-network');
  const btn     = document.getElementById(mode === 'permanent' ? 'perm-btn' : 'temp-btn');
  const resultEl= document.getElementById(mode === 'permanent' ? 'perm-result' : 'temp-result');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Запрос...';
  const data = await post('get_address', {mode, product_id: currentProduct.id, network: netSel.value});
  btn.disabled = false; btn.textContent = 'Создать оплату';
  resultEl.innerHTML = data.error ? renderError(data.error) : renderAddressResult(data, mode);
}

async function getInvoice() {
  if (!currentProduct) return;
  const btn = document.getElementById('inv-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Запрос...';
  const data = await post('get_invoice', {product_id: currentProduct.id});
  btn.disabled = false; btn.textContent = 'Создать инвойс';
  document.getElementById('inv-result').innerHTML = data.error ? renderError(data.error) : renderInvoiceResult(data);
}

async function checkStatus(orderId, mode) {
  const btn = document.getElementById('chk-' + orderId);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
  const data = await post('check_status', {order_id: orderId, mode});
  if (btn) { btn.disabled = false; btn.textContent = '↻ Проверить'; }
  const st = data.api?.status || data.local_status || '?';
  const sb = document.getElementById('sb-' + orderId);
  if (sb) sb.outerHTML = renderStatusBadge(st, 'sb-' + orderId);
  const jd = document.getElementById('jd-' + orderId);
  if (jd) jd.textContent = JSON.stringify(data.api, null, 2);
  if (st === 'confirmed') toast('✅ Платёж подтверждён!', 'ok');
  else if (st === 'expired') toast('⚠️ Срок истёк', 'err');
  else toast('Статус: ' + st);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderAddressResult(data, mode) {
  const api = data.api || {}, oid = data.order_id || 0;
  const addr = esc(api.address || '');
  const qr   = addr ? `<div class="qr-wrap"><img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(api.address)}" alt="QR" loading="lazy"></div>` : '';
  const exp  = api.expires_at ? `<div class="info-row"><span class="k">Истекает</span><span class="v">${esc(new Date(api.expires_at).toLocaleString('ru'))}</span></div>` : '';
  return `<div class="result-box">
    <div class="result-head">Заказ #${oid} &nbsp; <span id="sb-${oid}">${renderStatusBadge('pending','sb-'+oid)}</span></div>
    <div class="result-body">
      <div class="address-block">
        <div class="address-label">Адрес ${esc(api.network||'')} · ${esc(api.type||mode)}</div>
        <div class="address-value">${addr}</div>
        <div class="address-copy">
          <button class="btn-copy" onclick="copyText(${JSON.stringify(api.address||'')})">Копировать</button>
        </div>
      </div>
      ${qr}
      <div>
        ${exp}
        <div class="info-row"><span class="k">Payment ID</span><span class="v">${esc(String(api.payment_id||'—'))}</span></div>
        <div class="info-row"><span class="k">Сеть</span><span class="v">${esc(api.network||'—')}</span></div>
        <div class="info-row"><span class="k">Сумма</span><span class="v">${esc(String(api.amount||'—'))} ${esc(api.currency||'USDT')}</span></div>
      </div>
      <button class="btn btn-outline" id="chk-${oid}" onclick="checkStatus(${oid},'${esc(mode)}')" style="width:100%;margin-top:12px">↻ Проверить статус</button>
    </div>
    <button class="json-toggle" onclick="toggleJson(${oid})">▶ Ответ API (JSON)</button>
    <pre class="json-pre" id="jp-${oid}"><span id="jd-${oid}">${esc(JSON.stringify(api,null,2))}</span></pre>
  </div>`;
}

function renderInvoiceResult(data) {
  const api = data.api || {}, oid = data.order_id || 0;
  const url = api.invoice_url || '';
  const qr  = url ? `<div class="qr-wrap"><img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}" alt="QR" loading="lazy"></div>` : '';
  const exp = api.expires_at ? `<div class="info-row"><span class="k">Истекает</span><span class="v">${esc(new Date(api.expires_at).toLocaleString('ru'))}</span></div>` : '';
  return `<div class="result-box">
    <div class="result-head">Инвойс #${oid} &nbsp; <span id="sb-${oid}">${renderStatusBadge('pending','sb-'+oid)}</span></div>
    <div class="result-body">
      <div class="address-block">
        <div class="address-label">Ссылка на инвойс</div>
        <a class="invoice-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>
        <div class="address-copy">
          <button class="btn-copy" onclick="copyText(${JSON.stringify(url)})">Копировать</button>
          <a href="${esc(url)}" target="_blank" rel="noopener" class="btn-copy">Открыть ↗</a>
        </div>
      </div>
      ${qr}
      <div>
        ${exp}
        <div class="info-row"><span class="k">Номер инвойса</span><span class="v">${esc(api.invoice_number||'—')}</span></div>
        <div class="info-row"><span class="k">Валюта</span><span class="v">${esc(api.currency||'USDT')}</span></div>
        <div class="info-row"><span class="k">Сети</span><span class="v">${esc((api.networks||[]).join(', ')||'—')}</span></div>
      </div>
      <button class="btn btn-outline" id="chk-${oid}" onclick="checkStatus(${oid},'invoice')" style="width:100%;margin-top:12px">↻ Проверить статус</button>
    </div>
    <button class="json-toggle" onclick="toggleJson(${oid})">▶ Ответ API (JSON)</button>
    <pre class="json-pre" id="jp-${oid}"><span id="jd-${oid}">${esc(JSON.stringify(api,null,2))}</span></pre>
  </div>`;
}

function renderStatusBadge(status, id='') {
  const m = {pending:'⏳ pending', confirmed:'✅ confirmed', expired:'❌ expired', failed:'❌ failed'};
  const idAttr = id ? ` id="${esc(id)}"` : '';
  return `<span class="result-status s-${esc(status)}"${idAttr}>${esc(m[status]||status)}</span>`;
}

function renderError(msg) {
  return `<div class="notice" style="background:rgba(255,79,79,0.08);border-color:rgba(255,79,79,0.25);color:var(--danger);margin-top:12px">❌ ${esc(msg)}</div>`;
}

function toggleJson(oid) {
  const el = document.getElementById('jp-' + oid);
  if (el) el.classList.toggle('open');
}

// ─── Settings ─────────────────────────────────────────────────────────────────
<?php if ($page === 'settings'): ?>
(async () => {
  const s = await fetch('?action=get_settings').then(r=>r.json()).catch(()=>({}));
  document.getElementById('cfg_base_url').value        = s.base_url           || '';
  document.getElementById('cfg_key_perm').value        = s.shop_key_permanent  || '';
  document.getElementById('cfg_key_temp').value        = s.shop_key_temporary  || '';
  document.getElementById('cfg_key_inv').value         = s.shop_key_invoice    || '';
  document.getElementById('cfg_default_network').value = s.default_network     || 'TRON';
})();

async function saveSettings() {
  const r = await post('save_settings', {
    base_url:           document.getElementById('cfg_base_url').value.trim(),
    shop_key_permanent: document.getElementById('cfg_key_perm').value.trim(),
    shop_key_temporary: document.getElementById('cfg_key_temp').value.trim(),
    shop_key_invoice:   document.getElementById('cfg_key_inv').value.trim(),
    default_network:    document.getElementById('cfg_default_network').value,
  });
  if (r.ok) {
    const msg = document.getElementById('settings-msg');
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
    toast('✅ Настройки сохранены', 'ok');
  } else {
    toast('Ошибка: ' + (r.error || '?'), 'err');
  }
}
<?php endif; ?>

// ─── Orders ───────────────────────────────────────────────────────────────────
<?php if ($page === 'orders'): ?>
async function refreshOrders() {
  const rows = await fetch('?action=get_orders').then(r=>r.json()).catch(()=>[]);
  const modeLabel = {permanent:'🟢 Постоянный', temporary:'🔵 Временный', invoice:'🟡 Инвойс'};
  const tbody = document.getElementById('orders-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty"><div class="empty-icon">📦</div>Заказов пока нет</div></td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(o => `
    <tr>
      <td class="mono">#${o.id}</td>
      <td>${esc(o.uavatar||'')} ${esc(o.uname||'')}</td>
      <td>${esc(o.pemoji||'')} ${esc(o.pname||'')}</td>
      <td><span class="mode-badge mode-${esc(o.payment_mode)}">${esc(modeLabel[o.payment_mode]||o.payment_mode)}</span></td>
      <td class="mono">${parseFloat(o.amount||0).toFixed(4)} USDT</td>
      <td>${renderStatusBadge(o.status)}</td>
      <td style="color:var(--muted);font-size:11px;white-space:nowrap">${esc(o.created_at||'')}</td>
      <td class="mono" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(o.payment_id||o.invoice_number||'')}">
        ${esc(o.payment_id ? 'PID:'+o.payment_id : (o.invoice_number ? 'INV:'+o.invoice_number : '—'))}
        ${o.tx_hash ? '<br><span style="color:var(--green)">TX:'+esc(o.tx_hash.slice(0,12))+'…</span>' : ''}
      </td>
    </tr>`).join('');
}
refreshOrders();
setInterval(refreshOrders, 15000);
<?php endif; ?>

// ─── Webhooks ─────────────────────────────────────────────────────────────────
<?php if ($page === 'webhooks'): ?>
async function refreshWebhooks() {
  const rows = await fetch('?action=get_webhooks').then(r=>r.json()).catch(()=>[]);
  const tbody = document.getElementById('webhooks-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty"><div class="empty-icon">🔔</div>Вебхуков нет<br><small style="font-size:12px">Укажи Webhook URL в настройках магазина myPay</small></div></td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((w, i) => {
    let pl = {};
    try { pl = JSON.parse(w.payload); } catch(e) {}
    return `<tr>
      <td class="mono">#${w.id}</td>
      <td><code style="font-size:11px;background:rgba(58,179,104,0.1);color:var(--green);padding:2px 7px;border-radius:5px">${esc(w.event_type||'—')}</code></td>
      <td class="mono">${w.order_id ? '#'+esc(String(w.order_id)) : '—'}</td>
      <td style="font-size:11px;color:var(--muted);white-space:nowrap">${esc(w.received_at||'')}</td>
      <td>
        <details>
          <summary style="cursor:pointer;font-size:11px;color:var(--muted)">${esc(JSON.stringify(pl).slice(0,70))}…</summary>
          <pre style="margin-top:6px;background:#0A0D12;padding:8px;border-radius:6px;font-size:11px;color:#a8d5b5;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow-y:auto">${esc(JSON.stringify(pl,null,2))}</pre>
        </details>
      </td>
    </tr>`;
  }).join('');
}
refreshWebhooks();
setInterval(refreshWebhooks, 8000);
<?php endif; ?>

// ─── Log page ─────────────────────────────────────────────────────────────────
<?php if ($page === 'log'): ?>
async function refreshLog() {
  const data = await fetch('?action=get_log').then(r=>r.json()).catch(()=>({lines:[],size:0}));
  const container = document.getElementById('log-lines');
  const sizeEl    = document.getElementById('log-size');
  if (sizeEl) sizeEl.textContent = data.size ? (data.size / 1024).toFixed(1) + ' KB' : '0 KB';
  if (!data.lines || !data.lines.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">✅</div>Лог пуст — ошибок нет</div>';
    return;
  }
  container.innerHTML = data.lines.map(line => {
    const levelMatch = line.match(/\[(INFO|WARN|ERROR|FATAL|EXCEPTION)\]/);
    const level = levelMatch ? levelMatch[1] : 'INFO';
    return `<div class="log-line ${level}">${esc(line)}</div>`;
  }).join('');
}

async function clearLog() {
  if (!confirm('Очистить лог?')) return;
  await post('clear_log', {});
  refreshLog();
  toast('Лог очищен', 'ok');
}

refreshLog();
setInterval(refreshLog, 10000);
<?php endif; ?>

// ─── Utils ────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Скопировано!','ok')).catch(() => toast('Ошибка копирования','err'));
}
function toast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  setTimeout(() => t.className = '', 2800);
}
</script>
</body>
</html>
