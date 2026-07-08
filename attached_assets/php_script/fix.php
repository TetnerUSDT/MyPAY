<?php
$f = __DIR__ . '/index.php';
$c = file_get_contents($f);
if ($c === false) { die('Cannot read index.php'); }

$startMarker = '<!-- ═══════════════════ BALANCES ═══════════';
$startPos = strpos($c, $startMarker);
if ($startPos === false) {
    $startMarker = '<!-- ══════════════════ BALANCES ══════════';
    $startPos = strpos($c, $startMarker);
}
$endMarker = '<!-- ══════════════════ LOG';
$endPos = strpos($c, $endMarker);

if ($startPos === false) { die('BALANCES start marker not found. Nothing changed.'); }
if ($endPos === false) { die('LOG marker not found. Nothing changed.'); }

$correct = '  <!-- ══════════════════ BALANCES ══════════════════ -->
  <?php if ($page === \'balances\'): ?>
  <div style="margin-bottom:16px">
    <div style="font-weight:600;font-size:15px">💰 Пополнение балансов</div>
    <div style="font-size:12px;color:var(--muted);margin-top:3px">Постоянные кошельки для пополнения (payment.received)</div>
  </div>

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
    var wrap = document.querySelector(\'select#topup-user\') ? document.querySelector(\'select#topup-user\').closest(\'[style*="flex:1"]\') : null;
    if (wrap) wrap.style.display = \'none\';
  };
  refreshBalances();
  setInterval(refreshBalances, 15000);
  </script>

  <div class="card card-pad" style="margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">
      Создать постоянный адрес для пополнения
    </div>
    <div class="notice" style="margin-bottom:14px">
      Постоянный адрес не привязан к сумме — принимает любые переводы. Каждый поступивший платёж автоматически зачисляется на баланс пользователя через вебхук <strong>payment.received</strong>.
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:500">Сеть</div>
    <div class="net-list" id="topup-net-list" style="margin-bottom:12px"></div>
    <button class="btn btn-primary" id="topup-btn" onclick="createTopupAddress()">💳 Получить адрес пополнения</button>
    <div id="topup-result" style="margin-top:12px"></div>
  </div>

  <div class="card">
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">История пополнений</span>
      <div style="display:flex;align-items:center;gap:8px">
        <select id="history-user-filter" onchange="refreshBalanceHistory()" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:5px 10px;color:var(--text);font-family:inherit;font-size:12px;outline:none">
          <option value="0">Все пользователи</option>
          <?php foreach ($users as $u): ?><option value="<?= (int)$u[\'id\'] ?>"><?= htmlspecialchars($u[\'avatar\'].\' \'.$u[\'name\'], ENT_QUOTES, \'UTF-8\') ?></option><?php endforeach; ?>
        </select>
      </div>
    </div>
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>#</th><th>Пользователь</th><th>Сумма</th><th>TX Hash</th><th>Заказ</th><th>Дата</th></tr></thead>
        <tbody id="balance-history-body"><tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)"><span class="spin"></span></td></tr></tbody>
      </table>
    </div>
  </div>
  <?php endif; ?>

  ';

$newContent = substr($c, 0, $startPos) . $correct . substr($c, $endPos);
$bytes = file_put_contents($f, $newContent);
if ($bytes === false) {
    die('Write failed — check file permissions.');
}
echo 'OK: patched ' . $bytes . ' bytes. <a href="/?page=balances&user_id=1">Open balances page</a> then delete this file.';
