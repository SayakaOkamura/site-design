/* =========================================================
   003 Alter Design Consulting

   ファーストビュー1画面で完結させる。プレゼンでスクロールはしない。
   左で AI が考え、右に成果物が現れる。この構図自体をインパクトにする。

   - 積み上げず、決まった場所（左/右/下）に入れ替える
   - 自動スクロールは一切しない
   - 選択式が主、打ち込みは隠し（/ でページ内移動）
   - 生成結果はデモとして用意したもの。AI のふりはしない
   ========================================================= */
'use strict';

const genEl    = document.getElementById('gen');
const appEl    = document.getElementById('app');
const closeEl  = document.getElementById('closing');
const chooseEl = document.getElementById('choose');
const keysEl   = document.getElementById('keys');
const msgEl    = document.getElementById('msg');

/* ---------- 小道具 ---------- */

function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html != null) d.innerHTML = html;
  return d;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function yen(n)   { return n.toLocaleString('ja-JP') + ' 円'; }
function hours(n) { return (Math.round(n * 10) / 10).toLocaleString('ja-JP') + ' 時間'; }
function count(n) { return n.toLocaleString('ja-JP') + ' 件'; }

function bar(pct, width) {
  const w = width || 20;
  const on = Math.round(w * Math.min(1, Math.max(0, pct)));
  return '<span>' + '█'.repeat(on) + '</span><span class="rest">' + '░'.repeat(w - on) + '</span>';
}

function keys(pairs) {
  keysEl.innerHTML = pairs.map(function (p) {
    return p[0].split('+').map(function (k) { return '<kbd>' + esc(k) + '</kbd>'; }).join('') + esc(p[1]);
  }).join('　');
}

function say(t) { msgEl.textContent = t || ''; }

/* ---------- 文字送り ---------- */

const typers = [];

function typeInto(node, text, msPerChar) {
  const job = { node: node, text: text, done: false };
  typers.push(job);
  node.classList.add('typing');
  let t0 = null;
  const frame = function (ts) {
    if (job.done) return;
    if (t0 === null) t0 = ts;
    const n = Math.floor((ts - t0) / msPerChar);
    node.textContent = text.slice(0, Math.min(text.length, n));
    if (n >= text.length) { finishTyper(job); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function finishTyper(job) {
  if (job.done) return;
  job.done = true;
  job.node.textContent = job.text;
  job.node.classList.remove('typing');
}

function finishAllTypers() {
  typers.forEach(finishTyper);
  typers.length = 0;
}

/* ---------- 経過時間ベースの進行 ---------- */

function timeline(steps, done) {
  let t0 = null, i = 0, finished = false;

  const finish = function () {
    if (finished) return;
    finished = true;
    if (done) done();
  };

  const frame = function (ts) {
    if (finished) return;
    if (t0 === null) t0 = ts;
    const t = ts - t0;
    let acc = 0;
    for (let k = 0; k < steps.length; k++) {
      acc += steps[k].at;
      if (i <= k && t >= acc) { steps[k].run(); i = k + 1; }
    }
    if (i >= steps.length) { finish(); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return { skip: function () {
    if (finished) return;
    state.skipped = true;
    while (i < steps.length) { steps[i].run(); i++; }
    finishAllTypers();
    finish();
  } };
}

/* ---------- 題材 ---------- */

const SUBJECTS = [
  {
    id: 'quote',
    label: '見積作成',
    sub: '明細を積み上げて承認に回す',
    words: ['見積', 'みつもり', '見積り', 'quote', '受注', '販売', '請求', '価格'],
    spec: {
      screens: ['見積一覧', '見積入力', '承認'],
      tables: ['見積ヘッダ', '見積明細', '承認履歴'],
      rule: '合計 100万円以上は部長承認'
    },
    thoughts: [
      '「見積作成」。明細を積み上げて合計を出す業務ですね。',
      '金額の大小で承認者が変わるはずです。その閾値を探します。',
      '建設業だと100万円で区切るのが一般的でした。これを採用します。'
    ],
    notices: [
      'ここで一つ。部長が不在のとき、この見積は止まりますね。',
      '代理承認を足しておきます。仕様にはありませんが、無いと運用で詰まります。'
    ],
    app: {
      title: '見積入力',
      fields: [
        { label: '顧客', value: '株式会社サンプル建設' },
        { label: '件名', value: '新社屋 空調設備工事' }
      ],
      cols: ['明細', '数量', '単価', '金額'],
      rows: [
        { name: '空調機本体', qty: 1, price: 850000 },
        { name: '据付工事',   qty: 1, price: 320000 },
        { name: '試運転調整', qty: 1, price: 60000 }
      ],
      rowValue: function (r) { return r.qty * r.price; },
      totalLabel: '合計',
      fmt: yen,
      over: function (t) { return t >= 1000000; },
      onText:  function (t) { return yen(t) + ' → 100万円以上のため部長承認へ'; },
      offText: function (t) { return yen(t) + ' → 課長承認で完了'; },
      ruleSrc: '仕様: 合計 100万円以上は部長承認',
      action: '申請する',
      doneOn:  '部長承認へ回しました。',
      doneOff: '課長承認へ回しました。',
      extra: {
        log: '不在時の代理承認',
        field: { label: '代理承認者', value: '（不在時: 設備部 次長）' },
        note: '部長が不在のとき、この見積は止まります。代理承認を足しました。',
        src: '仕様にはありません'
      }
    }
  },
  {
    id: 'attendance',
    label: '勤怠管理',
    sub: '残業を積み上げて上限を見張る',
    words: ['勤怠', '出勤', '残業', '労務', '打刻', '休暇', '就業'],
    spec: {
      screens: ['月次一覧', '勤怠入力', '承認'],
      tables: ['勤怠ヘッダ', '日次明細', '承認履歴'],
      rule: '月の残業 45時間超で警告'
    },
    thoughts: [
      '「勤怠管理」。日々の残業を積み上げて、月で締める業務ですね。',
      '上限は法律で決まっています。36協定なら月45時間です。',
      'これを超えたら警告する、で合っていますか。そう仮定して進めます。'
    ],
    notices: [
      'ただ、超えてから警告しても手遅れですね。もう働いてしまっています。',
      '40時間で予告するようにしておきます。仕様にはありませんが、あった方がいい。'
    ],
    app: {
      title: '勤怠入力',
      fields: [
        { label: '社員', value: '山田 太郎（設備部）' },
        { label: '対象月', value: '2026年8月' }
      ],
      cols: ['期間', '残業', '', '時間'],
      rows: [
        { name: '第1週', qty: 12.0, price: 1 },
        { name: '第2週', qty: 14.5, price: 1 },
        { name: '第3週', qty: 11.0, price: 1 },
        { name: '第4週', qty: 9.5,  price: 1 }
      ],
      rowValue: function (r) { return r.qty; },
      totalLabel: '月間残業',
      fmt: hours,
      over: function (t) { return t > 45; },
      onText:  function (t) { return hours(t) + ' → 45時間を超過。36協定の上限に触れます'; },
      offText: function (t) { return hours(t) + ' → 上限内（45時間まで）'; },
      ruleSrc: '仕様: 月の残業 45時間超で警告',
      action: '提出する',
      doneOn:  '警告付きで提出しました。',
      doneOff: '提出しました。',
      extra: {
        log: '上限に近づいたときの予告',
        note: '超えてから警告しても手遅れです。40時間で予告します。',
        src: '仕様にはありません',
        on: function (t) { return t > 40; },
        text: function (t) {
          if (t > 45) return '上限を超えています。40時間の時点で予告していました。';
          if (t > 40) return '40時間を超えました。上限まで残り ' +
                             (Math.round((45 - t) * 10) / 10) + ' 時間です。';
          return '40時間を超えたら予告します。超えてから言っても遅いので。';
        }
      }
    }
  },
  {
    id: 'inventory',
    label: '在庫管理',
    sub: '発注点を割ったら知らせる',
    words: ['在庫', '倉庫', '発注', '棚卸', '入出庫', '資材', '購買'],
    spec: {
      screens: ['在庫一覧', '入出庫入力', '発注'],
      tables: ['品目マスタ', '在庫残高', '入出庫履歴'],
      rule: '在庫が発注点を下回ったら発注対象'
    },
    thoughts: [
      '「在庫管理」。品目ごとに残高を持って、発注点と比べる業務ですね。',
      '発注点を割ったら発注対象、が基本の判定になります。',
      '品目マスタ、在庫残高、入出庫履歴の3つで足りるはずです。'
    ],
    notices: [
      'ただ、発注してから届くまでに日数がかかりますね。',
      'リードタイムを持たせます。発注点を割った時点で、もう間に合わないものがあるので。'
    ],
    app: {
      title: '在庫一覧',
      fields: [
        { label: '倉庫', value: '東京第一倉庫' },
        { label: '基準日', value: '2026年8月26日' }
      ],
      cols: ['品目', '在庫', '発注点', '判定'],
      rows: [
        { name: '空調フィルタ 400角', qty: 24,  price: 30 },
        { name: '銅管 15mm',          qty: 120, price: 80 },
        { name: '冷媒 R32 10kg',      qty: 6,   price: 10 }
      ],
      perRow: function (r) { return r.qty < r.price; },
      rowValue: function (r) { return r.qty < r.price ? 1 : 0; },
      totalLabel: '発注が必要',
      fmt: count,
      over: function (t) { return t > 0; },
      onText:  function (t) { return count(t) + 'が発注点を下回っています'; },
      offText: function () { return 'すべて発注点を上回っています'; },
      ruleSrc: '仕様: 在庫 < 発注点 なら発注対象',
      action: '発注をかける',
      doneOn:  '発注対象を購買へ回しました。',
      doneOff: '発注は不要です。',
      extra: {
        log: '調達リードタイム',
        field: { label: 'リードタイム', value: '冷媒 R32 は 発注から10日' },
        note: '発注点を割った時点で、もう間に合わないものがあります。',
        src: '仕様にはありません'
      }
    }
  }
];

/* / で飛べる先。情報はページ内のセクションに一元化してある */
const JUMPS = {
  how:        { desc: '上流工程中心とは', id: 'how' },
  services:   { desc: 'サービス',        id: 'services' },
  philosophy: { desc: '企業理念',        id: 'philosophy' },
  company:    { desc: '会社概要',        id: 'company' },
  why:        { desc: 'このページについて', id: 'why' },
  top:        { desc: '先頭に戻る',      id: 'hero' }
};

/* ---------- 状態 ---------- */

const state = {
  phase: 'boot',    // boot | running | app | choose
  sel: 0,
  subject: null,
  running: null,
  t0: 0,
  skipped: false,
  auto: false,
  rows: null
};

/* ---------- 左カラム: 生成 ---------- */

function start(subject, opts) {
  opts = opts || {};
  const rate = opts.fast ? 0.5 : 1;

  state.subject = subject;
  state.phase = 'running';
  state.t0 = performance.now();
  state.skipped = false;
  state.auto = !!opts.auto;
  state.rows = subject.app.rows.map(function (r) { return Object.assign({}, r); });

  genEl.innerHTML = '';
  appEl.innerHTML = '';
  closeEl.innerHTML = '';
  appEl.appendChild(el('div', 'await', '生成待ち'));

  const s1 = el('div', 'step');
  s1.innerHTML = '<div class="step-head"><span class="label">[読む]</span>' +
                 '<span class="pct" data-pct>0%</span></div><div class="bar" data-bar></div>';
  genEl.appendChild(s1);
  const think1 = el('div', 'thoughts');
  genEl.appendChild(think1);

  const specHolder = el('div');
  genEl.appendChild(specHolder);

  const s2 = el('div', 'step');
  s2.hidden = true;
  s2.innerHTML = '<div class="step-head"><span class="label">[作る]</span>' +
                 '<span class="pct" data-pct>0%</span></div><div class="bar" data-bar></div>';
  genEl.appendChild(s2);
  const think2 = el('div', 'thoughts');
  genEl.appendChild(think2);

  const setStep = function (step, pct) {
    step.querySelector('[data-bar]').innerHTML = bar(pct);
    step.querySelector('[data-pct]').textContent = Math.round(pct * 100) + '%';
  };

  const cps = Math.max(8, Math.round(24 * rate));
  const steps = [];

  const pushThoughts = function (lines, holder, step, cls) {
    lines.forEach(function (line, i) {
      const wait = i === 0 ? Math.round(240 * rate)
                           : lines[i - 1].length * cps + Math.round(280 * rate);
      steps.push({ at: wait, run: function () {
        setStep(step, (i + 1) / lines.length);
        const row = el('div', 'thought' + (cls ? ' ' + cls : ''));
        holder.appendChild(row);
        typeInto(row, line, cps);
      } });
    });
    steps.push({ at: lines[lines.length - 1].length * cps + Math.round(240 * rate),
                 run: function () { setStep(step, 1); } });
  };

  pushThoughts(subject.thoughts, think1, s1, null);

  steps.push({ at: Math.round(180 * rate), run: function () {
    specHolder.appendChild(renderSpec(subject.spec));
    s2.hidden = false;
  } });

  pushThoughts(subject.notices, think2, s2, 'notice');

  steps.push({ at: Math.round(300 * rate), run: function () {
    appEl.innerHTML = '';
    appEl.appendChild(buildApp(subject));
    state.phase = 'app';
  } });

  state.running = timeline(steps, function () {
    state.running = null;
    finishRun(subject);
  });

  keys([['Enter', '飛ばす'], ['Esc', '戻る']]);
  say(opts.auto ? '頼まれる前に作りはじめました' : '生成中');
}

function renderSpec(spec) {
  const dl = el('dl', 'spec');
  dl.innerHTML =
    '<dt>画面</dt><dd>' + spec.screens.map(function (s) {
      return '<span class="tag">' + esc(s) + '</span>'; }).join('') + '</dd>' +
    '<dt>表</dt><dd>' + spec.tables.map(function (s) {
      return '<span class="tag">' + esc(s) + '</span>'; }).join('') + '</dd>' +
    '<dt>ルール</dt><dd class="rule">' + esc(spec.rule) + '</dd>';
  return dl;
}

/* ---------- 右カラム: 成果物 ---------- */

function buildApp(subject) {
  const a = subject.app;
  const wrap = el('div', 'app');

  const head = el('div', 'app-head');
  head.innerHTML = '<span>' + esc(a.title) + '</span><span class="gen">generated</span>';
  wrap.appendChild(head);

  const body = el('div', 'app-body');
  wrap.appendChild(body);

  a.fields.forEach(function (f) {
    const row = el('div', 'field');
    row.innerHTML = '<label>' + esc(f.label) + '</label>' +
                    '<input type="text" value="' + esc(f.value) + '">';
    body.appendChild(row);
  });

  if (a.extra && a.extra.field) {
    const row = el('div', 'field added');
    row.innerHTML = '<label>' + esc(a.extra.field.label) + '</label>' +
                    '<input type="text" value="' + esc(a.extra.field.value) + '">';
    body.appendChild(row);
  }

  body.appendChild(el('hr'));

  const table = el('table', 'rows');
  const thead = el('thead');
  thead.innerHTML = '<tr>' + a.cols.map(function (c, i) {
    return '<th class="' + (i > 0 ? 'num' : '') + '">' + esc(c) + '</th>';
  }).join('') + '</tr>';
  table.appendChild(thead);

  const tbody = el('tbody');
  state.rows.forEach(function (r, i) {
    const tr = el('tr');
    tr.dataset.i = i;
    tr.innerHTML =
      '<td>' + esc(r.name) + '</td>' +
      '<td class="num"><input type="number" step="any" min="0" data-edit value="' + r.qty + '"></td>' +
      '<td class="num" data-fixed></td>' +
      '<td class="num" data-derived></td>';
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  body.appendChild(table);

  const total = el('div', 'total');
  total.innerHTML = '<span class="lbl">' + esc(a.totalLabel) + '</span>' +
                    '<span class="val" data-total></span>';
  body.appendChild(total);

  // 注記は改行せず同じ行に置く。2行×2本では 1 画面に入らない
  const alert = el('div', 'alert');
  alert.innerHTML = '<span class="mark">!</span><span><span data-alert></span>' +
                    '<span class="src">' + esc(a.ruleSrc) + '</span></span>';
  body.appendChild(alert);

  let extraAlert = null;
  if (a.extra) {
    extraAlert = el('div', 'alert extra');
    extraAlert.innerHTML = '<span class="mark">+</span><span><span data-extra></span>' +
                           '<span class="src">' + esc(a.extra.src) + 'が足しました</span></span>';
    body.appendChild(extraAlert);
  }

  const actions = el('div', 'actions');
  actions.innerHTML = '<button type="button" class="btn" data-go>' + esc(a.action) + '</button>';
  body.appendChild(actions);

  const log = el('div', 'applog');
  body.appendChild(log);

  const recalc = function () {
    let t = 0;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      const r = state.rows[Number(tr.dataset.i)];
      const inp = tr.querySelector('[data-edit]');
      const v = parseFloat(inp.value);
      r.qty = isNaN(v) ? 0 : v;

      if (subject.id === 'quote') {
        tr.querySelector('[data-fixed]').textContent = r.price.toLocaleString('ja-JP');
        tr.querySelector('[data-derived]').textContent = a.rowValue(r).toLocaleString('ja-JP');
      } else if (subject.id === 'attendance') {
        tr.querySelector('[data-fixed]').textContent = '';
        tr.querySelector('[data-derived]').textContent =
          (Math.round(r.qty * 10) / 10).toLocaleString('ja-JP');
      } else {
        tr.querySelector('[data-fixed]').textContent = r.price.toLocaleString('ja-JP');
        const short = a.perRow(r);
        const cell = tr.querySelector('[data-derived]');
        cell.textContent = short ? '発注' : '—';
        cell.style.color = short ? 'var(--a-warn)' : 'var(--a-dimmer)';
      }
      t += a.rowValue(r);
    });

    total.querySelector('[data-total]').textContent = a.fmt(t);
    const on = a.over(t);
    alert.className = 'alert ' + (on ? 'on' : 'off');
    alert.querySelector('.mark').textContent = on ? '!' : '·';
    alert.querySelector('[data-alert]').textContent = on ? a.onText(t) : a.offText(t);

    if (extraAlert) {
      const dyn = typeof a.extra.text === 'function';
      const xon = dyn ? a.extra.on(t) : true;
      extraAlert.className = 'alert extra ' + (xon ? 'on' : 'off');
      extraAlert.querySelector('.mark').textContent = xon ? '+' : '·';
      extraAlert.querySelector('[data-extra]').textContent = dyn ? a.extra.text(t) : a.extra.note;
    }
    return { total: t, on: on };
  };

  tbody.addEventListener('input', recalc);

  actions.querySelector('[data-go]').addEventListener('click', function () {
    const r = recalc();
    const stamp = new Date().toTimeString().slice(0, 8);
    log.innerHTML = '<span class="t">' + stamp + '</span>  ' + esc(r.on ? a.doneOn : a.doneOff);
  });

  recalc();
  return wrap;
}

/* ---------- 下段: 締めと選択 ---------- */

function finishRun(subject) {
  const secs = Math.round((performance.now() - (state.auto ? 0 : state.t0)) / 100) / 10;

  const head = state.skipped
    ? '飛ばしましたが、<strong>順序は同じ</strong>です。'
    : (state.auto
        ? '頼まれる前に、勝手に作りました。<strong>' + secs + ' 秒</strong>。'
        : '<strong>' + secs + ' 秒</strong>で出てきました。');

  closeEl.innerHTML = head +
    '<span class="sub">　数量を触ると仕様のルールが動きます。' +
    '<b>頼んでいないもの</b>も1つ足しました。</span>';

  state.phase = 'choose';
  renderChoose();
}

function renderChoose() {
  chooseEl.innerHTML = '';
  state.sel = 0;

  chooseEl.appendChild(el('span', 'ask',
    state.auto ? 'では、あなたは何を作りますか？' : '次は何を作りますか？'));
  state.auto = false;

  const list = el('div', 'choices');
  list.setAttribute('role', 'listbox');

  SUBJECTS.forEach(function (s, i) {
    const b = el('button', 'choice');
    b.type = 'button';
    b.setAttribute('role', 'option');
    b.innerHTML = '<span class="caret">▸</span><span>' + esc(s.label) + '</span>';
    if (state.subject && state.subject.id === s.id) b.classList.add('chosen');
    b.addEventListener('click', function () { state.sel = i; paint(list); start(s); });
    list.appendChild(b);
  });

  const free = el('button', 'choice');
  free.type = 'button';
  free.setAttribute('role', 'option');
  free.innerHTML = '<span class="caret">▸</span><span>自分で書く</span>';
  free.addEventListener('click', function () { state.sel = SUBJECTS.length; paint(list); openFree(); });
  list.appendChild(free);

  chooseEl.appendChild(list);
  chooseEl.appendChild(el('span', 'scroll-cue', '↓ 会社概要・サービス　　/ 移動'));

  paint(list);
  keys([['↑', ''], ['↓', '選ぶ'], ['Enter', '決定'], ['/', '移動']]);
  say('マウスは要りません');
}

function paint(list) {
  Array.prototype.forEach.call(list.children, function (c, i) {
    c.setAttribute('aria-selected', i === state.sel ? 'true' : 'false');
  });
}

function currentList() { return chooseEl.querySelector('.choices'); }

function openFree() {
  if (chooseEl.querySelector('.freebox')) {
    chooseEl.querySelector('.freebox input').focus();
    return;
  }
  const box = el('div', 'freebox');
  box.innerHTML = '<input type="text" autocomplete="off" placeholder="例: 発注管理、日報、経費精算 …">' +
                  '<span class="note">Enter で決定</span>';
  chooseEl.appendChild(box);
  const input = box.querySelector('input');
  input.focus();
  input.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape') { box.remove(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    chooseFree(input.value);
  });
  keys([['Enter', '決定'], ['Esc', 'やめる']]);
}

function chooseFree(text) {
  const q = String(text || '').trim();
  if (!q) return;

  let hit = null;
  for (const s of SUBJECTS) {
    if (s.words.some(function (w) { return q.indexOf(w) >= 0; })) { hit = s; break; }
  }

  if (!hit) {
    // 外したときに取り繕わない。ここで嘘をつくと全部が嘘になる。
    closeEl.innerHTML = '「' + esc(q) + '」は、このデモに用意した題材にありません。' +
      '<span class="sub">　適当な結果を出しても意味がないので、正直に止めます。' +
      '実際の案件なら、まずこの要望を業務の単位に分解するところから始めます。</span>';
    const box = chooseEl.querySelector('.freebox');
    if (box) box.remove();
    return;
  }

  const box = chooseEl.querySelector('.freebox');
  if (box) box.remove();
  start(hit);
}

/* ---------- / でページ内移動 ---------- */

let cmdBox = null;

function openCommand() {
  if (cmdBox) { cmdBox.querySelector('input').focus(); return; }
  cmdBox = el('div', 'freebox');
  cmdBox.innerHTML = '<input type="text" autocomplete="off" spellcheck="false" placeholder="' +
                     Object.keys(JUMPS).join(' / ') + '">' +
                     '<span class="note">Tab 補完・Esc で閉じる</span>';
  chooseEl.appendChild(cmdBox);
  const input = cmdBox.querySelector('input');
  input.focus();

  input.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape') { closeCommand(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const hits = Object.keys(JUMPS).filter(function (k) { return k.indexOf(input.value) === 0; });
      if (hits.length === 1) input.value = hits[0];
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = input.value.trim().toLowerCase();
    closeCommand();
    const j = JUMPS[q];
    if (!j) { say(q + ': そんな行き先はありません'); return; }
    const target = document.getElementById(j.id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    say(j.desc);
  });
  say('行き先を入力');
}

function closeCommand() {
  if (!cmdBox) return;
  cmdBox.remove();
  cmdBox = null;
  say('');
}

/* ---------- 後戻り ---------- */

function back() {
  if (cmdBox) { closeCommand(); return; }
  const box = chooseEl.querySelector('.freebox');
  if (box) { box.remove(); keys([['↑', ''], ['↓', '選ぶ'], ['Enter', '決定'], ['/', '移動']]); return; }

  if (state.phase === 'running' && state.running) { state.running.skip(); return; }

  // 先頭へ戻す
  window.scrollTo({ top: 0, behavior: 'smooth' });
  say('');
}

/* ---------- キー操作 ---------- */

document.addEventListener('keydown', function (e) {
  if (e.isComposing) return;

  const tag = document.activeElement && document.activeElement.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.key === '/' && !typing) { e.preventDefault(); openCommand(); return; }
  if (typing) return;

  if (e.key === 'Escape') { e.preventDefault(); back(); return; }

  if (state.phase === 'running') {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (state.running) state.running.skip();
    }
    return;
  }

  const list = currentList();
  if (!list) return;
  const n = list.children.length;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'j' || e.key === 'l') {
    e.preventDefault();
    state.sel = (state.sel + 1) % n; paint(list);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'k' || e.key === 'h') {
    e.preventDefault();
    state.sel = (state.sel - 1 + n) % n; paint(list);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const btn = list.children[state.sel];
    if (btn) btn.click();
  } else if (e.key === 'PageDown') {
    e.preventDefault();
    document.getElementById('how').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (e.key === 'Home') {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

/* ---------- 起動 ---------- */

start(SUBJECTS[0], { fast: true, auto: true });
