<?php
$f = __DIR__ . '/index.php';
$c = file_get_contents($f);
if ($c === false) { die('Cannot read index.php'); }

$fixes = 0;
$log = [];

// Fix 1: corrupted topup-net-list ID
$pattern = '/id="topup-net-list[^"]*"/';
if (preg_match($pattern, $c, $m) && $m[0] !== 'id="topup-net-list"') {
    $c = preg_replace($pattern, 'id="topup-net-list"', $c, 1);
    $log[] = 'Fixed corrupted id: ' . htmlspecialchars($m[0]);
    $fixes++;
}

// Fix 2: net-list div missing style attribute (add it back if div lost style)
$c = str_replace(
    'id="topup-net-list">',
    'id="topup-net-list" style="margin-bottom:12px">',
    $c
);

// Fix 3: ensure the balance card and inline script exist before the topup form
// If current-balance is missing, inject balance card before the create-address section
$hasBalanceCard = strpos($c, 'id="current-balance"') !== false;
$hasScript = strpos($c, 'window.refreshBalances') !== false;

if (!$hasBalanceCard || !$hasScript) {
    $inject = '
  <div class="card card-pad" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Ваш баланс</div>
      <div id="current-balance" style="font-size:24px;font-weight:700;color:var(--green)"><span class="spin"></span></div>
    </div>
  </div>
  <script>
  window.refreshBalances = async function() {
    var el = document.getElementById(\'current-balance\');
    if (!el) return;
    var data = await fetch(\'?action=get_balances\').then(function(r){return r.json();}).catch(function(){return [];});
    var uid = <?= $uid ?>;
    var user = Array.isArray(data) ? data.find(function(u){return +u.id===uid;}) : null;
    el.textContent = parseFloat((user && user.balance_usdt) || 0).toFixed(4) + \' USDT\';
  };
  refreshBalances();
  setInterval(refreshBalances, 15000);
  </script>
';
    // Insert before the "Создать постоянный адрес" card
    $anchor = '<div class="card card-pad" style="margin-bottom:16px">';
    $pos = strpos($c, $anchor);
    if ($pos !== false) {
        $c = substr($c, 0, $pos) . $inject . substr($c, $pos);
        $log[] = 'Injected balance card + script';
        $fixes++;
    }
}

$bytes = file_put_contents($f, $c);
if ($bytes === false) { die('Write failed - check permissions'); }

echo '<pre>';
echo 'Fixes applied: ' . $fixes . "\n";
foreach ($log as $l) echo '  • ' . $l . "\n";
if ($fixes === 0) echo "  No corruption found — file looks OK\n";
echo 'File size: ' . $bytes . " bytes\n";
echo '</pre>';
echo '<a href="/?page=balances&user_id=1">→ Open balances page</a> | ';
echo 'Then delete this file from the server.';
