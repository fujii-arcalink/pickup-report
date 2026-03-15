const API_URL = 'https://script.google.com/a/macros/arca-link.com/s/AKfycbzsysqgu1cVEIJU-nBYImfZIclOwFE59ScKr4k_I9uJObfXukC_JlMPOcczAig1Rtgu/exec';

const $ = (id) => document.getElementById(id);

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowHHMM() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

async function api(action, params = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action,
      ...params
    })
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.message || 'API error');
  }
  return json.data;
}

function stamp(id) {
  $(id).value = nowHHMM();
}

function lockBase() {
  const date = $('date').value;
  const driver = $('driver').value;
  const startOdo = $('startOdo').value;

  if (!date || !driver || !startOdo) {
    alert('日付・担当者・出発距離を入力してください');
    return;
  }

  $('date').disabled = true;
  $('driver').disabled = true;
  $('startOdo').disabled = true;

  alert('基本情報を確定しました');
}

async function loadDrivers() {
  try {
    const list = await api('getDriverList');
    const sel = $('driver');
    sel.innerHTML = '<option value="">選択してください</option>';

    (list || []).forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  } catch (err) {
    alert('担当者の取得に失敗: ' + err.message);
  }
}

async function loadCustomers() {
  const date = $('date').value;
  if (!date) {
    alert('先に日付を入れてください');
    return;
  }

  try {
    const list = await api('getCustomersForDate', { date });
    const box = $('customerList');
    box.innerHTML = '';

    if (!list || list.length === 0) {
      box.innerHTML = '<div>対象の回収先がありません</div>';
      return;
    }

    list.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'customer-btn';
      btn.type = 'button';
      btn.textContent = item.name;
      btn.onclick = () => {
        $('customer').value = item.name;
      };
      box.appendChild(btn);
    });
  } catch (err) {
    alert('回収先取得エラー: ' + err.message);
  }
}

async function refreshSummary() {
  const date = $('date').value;
  const driver = $('driver').value;

  if (!date || !driver) return;

  try {
    const s = await api('getDailySummary', { date, driver });
    $('sumStretch').textContent = s.sumStretch ?? 0;
    $('sumPP').textContent = s.sumPP ?? 0;
    $('distanceKm').textContent = s.distanceKm ?? 0;
  } catch (err) {
    console.error(err);
  }
}

async function save() {
  const payload = {
    date: $('date').value,
    driver: $('driver').value,
    startOdo: $('startOdo').value,
    customer: $('customer').value,
    arriveAt: $('arriveAt').value,
    departAt: $('departAt').value,
    kgStretch: $('kgStretch').value,
    kgPP: $('kgPP').value,
    note: $('note').value
  };

  if (!payload.date || !payload.driver || !payload.startOdo || !payload.customer) {
    alert('日付・担当者・出発距離・得意先を確認してください');
    return;
  }

  try {
    const summary = await api('appendPickupRow', { payload });

    $('customer').value = '';
    $('arriveAt').value = '';
    $('departAt').value = '';
    $('kgStretch').value = '';
    $('kgPP').value = '';
    $('note').value = '';

    $('sumStretch').textContent = summary.sumStretch ?? 0;
    $('sumPP').textContent = summary.sumPP ?? 0;
    $('distanceKm').textContent = summary.distanceKm ?? 0;

    await loadCustomers();
    alert('保存しました');
  } catch (err) {
    alert('保存エラー: ' + err.message);
  }
}

async function finalize() {
  const payload = {
    date: $('date').value,
    driver: $('driver').value,
    endOdo: $('endOdo').value,
    dailyComment: $('dailyComment').value
  };

  if (!payload.date || !payload.driver || !payload.endOdo) {
    alert('日付・担当者・終了距離を入力してください');
    return;
  }

  try {
    const res = await api('finalizeDayAndReport', { payload });

    if (res && res.summary) {
      $('sumStretch').textContent = res.summary.sumStretch ?? 0;
      $('sumPP').textContent = res.summary.sumPP ?? 0;
      $('distanceKm').textContent = res.summary.distanceKm ?? 0;
    }

    alert('終業処理完了\nPDF保存・メール送信まで完了しました');
  } catch (err) {
    alert('終業エラー: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  $('date').value = todayStr();

  $('date').addEventListener('change', async () => {
    await loadCustomers();
    await refreshSummary();
  });

  $('driver').addEventListener('change', refreshSummary);

  await loadDrivers();
  await loadCustomers();
  await refreshSummary();
});
