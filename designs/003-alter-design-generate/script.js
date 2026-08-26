/* =========================================================
   003 Alter Design Consulting

   ファーストビュー1画面で完結させる。プレゼンでスクロールはしない。
   左で AI が考え、右に成果物が現れる。この構図自体をインパクトにする。

   - 積み上げず、決まった場所（左/右/下）に入れ替える
   - 自動スクロールは一切しない
   - 題材を選ばせるデモは廃止。訪問者が仕様を決める問いだけにした
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
      ruleBefore: '合計 ', ruleAfter: ' 円以上は部長承認', threshold: 1000000
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
      over: function (t, th) { return t >= th; },
      onText:  function (t, th) { return yen(t) + ' → ' + yen(th) + '以上のため部長承認へ'; },
      offText: function (t, th) { return yen(t) + ' → ' + yen(th) + '未満なので課長承認で完了'; },
      ruleSrc: '仕様のルール',
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
  }
];

/* -----------------------------------------------------------
   腕試し。訪問者が仕様を決め、その仕様で作られ、漏れを指摘される。
   上流工程の本質は「漏れなく決められるか」なので、それを挑戦にする。
   ----------------------------------------------------------- */
const CHALLENGE = [
  {
    key: 'screens', short: '画面',
    q: 'どの画面が必要ですか？',
    hint: '複数選べます。Enter で確定',
    multi: true,
    opts: [
      { label: '見積一覧', v: '見積一覧' },
      { label: '見積入力', v: '見積入力' },
      { label: '承認',     v: '承認',
        miss: '承認画面がありません。金額の大きい見積が、誰の確認も通らずに社外へ出ます。' },
      { label: '月次集計', v: '月次集計',
        miss: '月次集計がありません。月末に「今月いくら出したか」を数えられません。' }
    ]
  },
  {
    key: 'approval', short: '承認',
    q: '承認は何段階にしますか？',
    opts: [
      { label: '1段', v: 1,
        miss: '承認が1段だと、その人が不在のとき見積が止まります。代理を決める必要があります。' },
      { label: '2段', v: 2 },
      { label: '承認なし', v: 0,
        miss: '承認がありません。金額に関わらず、担当者の判断だけで見積が出ます。' }
    ]
  },
  {
    key: 'threshold', short: '金額',
    q: '部長承認に上げる金額は？',
    opts: [
      { label: '100万円', v: 1000000 },
      { label: '500万円', v: 5000000,
        miss: '500万円は高すぎます。100〜500万円の案件が全部課長止まりになり、部長が把握できません。' },
      { label: '決めない', v: 0,
        miss: '閾値を決めないと、誰に上げるかを毎回人が判断します。判断のばらつきが残ります。' }
    ]
  },
  {
    key: 'absent', short: '不在時',
    q: '承認する人が不在のときは？',
    opts: [
      { label: '代理を決めておく', v: 'proxy' },
      { label: '戻ってくるまで待つ', v: 'wait',
        miss: '承認者が休むたびに見積が止まります。月に数日は必ず止まる計算になります。' },
      { label: '決めない', v: 'none',
        miss: '不在時の扱いが決まっていません。現場がその場の判断で回避しはじめ、記録が残らなくなります。' }
    ]
  },
  {
    key: 'revision', short: '修正時',
    q: '出した見積を直すときは？',
    opts: [
      { label: '版を分けて残す', v: 'version' },
      { label: '上書きする', v: 'overwrite',
        miss: '上書きすると前の見積が消えます。顧客と金額が食い違ったとき、出した証拠が残りません。' },
      { label: '決めない', v: 'none',
        miss: '修正の扱いが決まっていません。人によって上書きと再発行が混ざり、どれが最新か分からなくなります。' }
    ]
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
  state.challenge = true;
  state.rows = subject.app.rows.map(function (r) { return Object.assign({}, r); });
  state.threshold = subject.spec.threshold;
  state.recalc = null;

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

  /* --- ここから右カラムが組み上がる。左の思考と交互に進む --- */
  let app = null, table = null;
  const a = subject.app;
  const beat = Math.round(150 * rate);
  const genFrom = steps.length;   // ここから [作る] の進捗を割り振る

  steps.push({ at: beat, run: function () {
    appEl.innerHTML = '';
    app = appShell(subject);
    appEl.appendChild(app);
  } });

  a.fields.forEach(function (f) {
    steps.push({ at: beat, run: function () { addField(app, f, false); } });
  });

  steps.push({ at: beat, run: function () { table = addTable(app, subject); } });

  state.rows.forEach(function (r, i) {
    steps.push({ at: Math.round(110 * rate), run: function () { addRow(table, r, i); } });
  });

  steps.push({ at: beat, run: function () { addTotal(app, subject); } });
  steps.push({ at: beat, run: function () { addAlert(app, subject); } });

  /* 気づきの1文目 */
  steps.push({ at: Math.round(320 * rate), run: function () {
    const row = el('div', 'thought notice');
    think2.appendChild(row);
    typeInto(row, subject.notices[0], cps);
  } });

  /* 2文目を言いながら、右にフィールドが挿入される */
  steps.push({ at: subject.notices[0].length * cps + Math.round(240 * rate), run: function () {
    const row = el('div', 'thought notice');
    think2.appendChild(row);
    typeInto(row, subject.notices[1], cps);
    // 明細の上（フィールド群の末尾）に割り込ませる
    if (a.extra && a.extra.field) addField(app, a.extra.field, true, app.querySelector('hr'));
  } });

  steps.push({ at: Math.round(subject.notices[1].length * cps * 0.55), run: function () {
    if (a.extra) addExtraAlert(app, subject);
  } });

  steps.push({ at: Math.round(subject.notices[1].length * cps * 0.5), run: function () {
    addActions(app, subject);
    wireApp(app, subject);
    state.phase = 'app';
  } });

  // 組み上げの各段階に [作る] の進捗を割り振る
  const genCount = steps.length - genFrom;
  for (let k = genFrom; k < steps.length; k++) {
    const orig = steps[k].run;
    const pct = (k - genFrom + 1) / genCount;
    steps[k].run = function () { orig(); setStep(s2, pct); };
  }

  state.running = timeline(steps, function () {
    state.running = null;
    showScore();
  });

  keys([['Enter', '飛ばす'], ['Esc', '戻る']]);
  say(opts.auto ? '頼まれる前に作りはじめました' : '生成中');
}

/* -----------------------------------------------------------
   仕様は読み物ではなく、書き換えられるものにする。
   ルールの数値を触ると右の成果物の判定が変わる。
   「上流で決めたことがそのまま動く」を、訪問者自身の手でやってもらう。
   ----------------------------------------------------------- */
function renderSpec(spec) {
  const dl = el('dl', 'spec');
  dl.innerHTML =
    '<dt>画面</dt><dd>' + spec.screens.map(function (s) {
      return '<span class="tag">' + esc(s) + '</span>'; }).join('') + '</dd>' +
    '<dt>表</dt><dd>' + spec.tables.map(function (s) {
      return '<span class="tag">' + esc(s) + '</span>'; }).join('') + '</dd>' +
    '<dt>ルール</dt><dd class="rule">' + esc(spec.ruleBefore) +
      '<input type="number" step="any" class="th" data-th value="' + spec.threshold + '">' +
      esc(spec.ruleAfter) + '</dd>';

  const input = dl.querySelector('[data-th]');
  input.addEventListener('input', function () {
    const v = parseFloat(input.value);
    state.threshold = isNaN(v) ? spec.threshold : v;
    if (state.recalc) state.recalc();
    say('仕様を書き換えました');
  });
  return dl;
}

/* -----------------------------------------------------------
   右カラム: 成果物
   一気に出さず、部品ごとに組み上げる。左の思考と同期させ、
   「代理承認を足します」と言った瞬間に右へフィールドが挿入される。
   ----------------------------------------------------------- */

function appShell(subject) {
  const a = subject.app;
  const wrap = el('div', 'app');
  const head = el('div', 'app-head part');
  head.innerHTML = '<span>' + esc(a.title) + '</span><span class="gen">generating…</span>';
  wrap.appendChild(head);
  wrap.appendChild(el('div', 'app-body'));
  return wrap;
}

function appBody(app) { return app.querySelector('.app-body'); }

function addField(app, f, added, before) {
  const row = el('div', 'field part' + (added ? ' added' : ''));
  row.innerHTML = '<label>' + esc(f.label) + '</label>' +
                  '<input type="text" value="' + esc(f.value) + '">';
  // 後から足すフィールドも、フォームとして正しい位置に差し込む。
  // 末尾に付けると明細より下に来てしまい、様にならない。
  if (before) appBody(app).insertBefore(row, before);
  else appBody(app).appendChild(row);
  return row;
}

function addTable(app, subject) {
  const a = subject.app;
  const body = appBody(app);
  body.appendChild(el('hr', 'part'));

  const table = el('table', 'rows part');
  const thead = el('thead');
  thead.innerHTML = '<tr>' + a.cols.map(function (c, i) {
    return '<th class="' + (i > 0 ? 'num' : '') + '">' + esc(c) + '</th>';
  }).join('') + '</tr>';
  table.appendChild(thead);
  table.appendChild(el('tbody'));
  body.appendChild(table);
  return table;
}

function addRow(table, r, i) {
  const tr = el('tr', 'part');
  tr.dataset.i = i;
  tr.innerHTML =
    '<td>' + esc(r.name) + '</td>' +
    '<td class="num"><input type="number" step="any" min="0" data-edit value="' + r.qty + '"></td>' +
    '<td class="num" data-fixed></td>' +
    '<td class="num" data-derived></td>';
  table.querySelector('tbody').appendChild(tr);
}

function addTotal(app, subject) {
  const total = el('div', 'total part');
  total.innerHTML = '<span class="lbl">' + esc(subject.app.totalLabel) + '</span>' +
                    '<span class="val" data-total></span>';
  appBody(app).appendChild(total);
}

function addAlert(app, subject) {
  const alert = el('div', 'alert part');
  alert.innerHTML = '<span class="mark">!</span><span><span data-alert></span>' +
                    '<span class="src">' + esc(subject.app.ruleSrc) + '</span></span>';
  appBody(app).appendChild(alert);
}

function addExtraAlert(app, subject) {
  const x = el('div', 'alert extra part');
  x.innerHTML = '<span class="mark">+</span><span><span data-extra></span>' +
                '<span class="src">' + esc(subject.app.extra.src) + 'が足しました</span></span>';
  appBody(app).appendChild(x);
}

function addActions(app, subject) {
  const actions = el('div', 'actions part');
  actions.innerHTML = '<button type="button" class="btn" data-go>' +
                      esc(subject.app.action) + '</button>';
  appBody(app).appendChild(actions);
  appBody(app).appendChild(el('div', 'applog'));
  app.querySelector('.app-head .gen').textContent = 'generated';
}

/* 部品が揃ったところで計算とルールを配線する */
function wireApp(app, subject) {
  const a = subject.app;
  const tbody = app.querySelector('tbody');
  const total = app.querySelector('.total');
  const alert = app.querySelector('.alert:not(.extra)');
  const extraAlert = app.querySelector('.alert.extra');
  const actions = app.querySelector('.actions');
  const log = app.querySelector('.applog');

  const recalc = function () {
    let t = 0;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      const r = state.rows[Number(tr.dataset.i)];
      const inp = tr.querySelector('[data-edit]');
      const v = parseFloat(inp.value);
      r.qty = isNaN(v) ? 0 : v;

      // 題材の id で分岐すると、題材を足すたびに壊れる。表示形式をデータで持つ。
      const disp = a.display || 'unit';
      const fixed = tr.querySelector('[data-fixed]');
      const derived = tr.querySelector('[data-derived]');

      if (disp === 'plain') {
        fixed.textContent = '';
        derived.textContent = (Math.round(r.qty * 10) / 10).toLocaleString('ja-JP');
      } else if (disp === 'flag') {
        fixed.textContent = r.price.toLocaleString('ja-JP');
        const hit = a.perRow(r);
        derived.textContent = hit ? '発注' : '—';
        derived.style.color = hit ? 'var(--a-warn)' : 'var(--a-dimmer)';
      } else {
        fixed.textContent = r.price.toLocaleString('ja-JP');
        derived.textContent = a.rowValue(r).toLocaleString('ja-JP');
      }
      t += a.rowValue(r);
    });

    total.querySelector('[data-total]').textContent = a.fmt(t);
    const th = state.threshold;
    const on = a.over(t, th);
    alert.className = 'alert ' + (on ? 'on' : 'off');
    alert.querySelector('.mark').textContent = on ? '!' : '·';
    alert.querySelector('[data-alert]').textContent = on ? a.onText(t, th) : a.offText(t, th);

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

  state.recalc = recalc;
  recalc();
}

/* ---------- 下段: 採点のあと ---------- */

function renderChoose() {
  chooseEl.innerHTML = '';
  state.sel = 0;

  const list = el('div', 'choices');
  list.setAttribute('role', 'listbox');

  // 漏れが残っていれば「直す」を先に出す。
  // 指摘して終わりでは、上流工程の一般論にしかならない。
  // 指摘 → その場で直る → 動くもので確かめる、までやるのが
  // AI × ローコードの効きどころなので、ここを体験させる。
  if (state.misses.length && !state.fixed) {
    const fix = el('button', 'choice challenge');
    fix.type = 'button';
    fix.setAttribute('role', 'option');
    fix.innerHTML = '<span class="caret">▸</span><span>指摘を反映して直す（' +
                    state.misses.length + '件）</span>';
    fix.addEventListener('click', fixAll);
    list.appendChild(fix);
  }

  const again = el('button', 'choice');
  again.type = 'button';
  again.setAttribute('role', 'option');
  again.innerHTML = '<span class="caret">▸</span><span>別の決め方でもう一度</span>';
  again.addEventListener('click', startChallenge);
  list.appendChild(again);

  chooseEl.appendChild(list);
  chooseEl.appendChild(el('span', 'scroll-cue',
    '↓ 上流工程中心とは・サービス・会社概要　　/ 移動'));

  paint(list);
  keys([['↑', ''], ['↓', '選ぶ'], ['Enter', '決定'], ['/', '移動']]);
  say('');
}

/* 指摘を全部反映して作り直す。ここの速さが強みの中身。 */
function fixAll() {
  state.fixCount = state.misses.length;
  state.answers.screens  = ['見積一覧', '見積入力', '承認', '月次集計'];
  state.answers.approval = [2];
  state.answers.threshold = [1000000];
  state.answers.absent   = ['proxy'];
  state.answers.revision = ['version'];
  state.misses = [];
  state.fixing = true;
  state.fixT0 = performance.now();
  buildFromAnswers();
}

function paint(list) {
  Array.prototype.forEach.call(list.children, function (c, i) {
    c.setAttribute('aria-selected', i === state.sel ? 'true' : 'false');
  });
}

function currentList() { return chooseEl.querySelector('.choices'); }

/* -----------------------------------------------------------
   腕試しモード
   ----------------------------------------------------------- */

function startChallenge() {
  state.phase = 'challenge';
  state.cstep = 0;
  state.answers = {};
  state.picked = {};
  state.misses = [];
  state.fixing = false;
  state.fixed = false;
  state.fixCount = 0;

  genEl.innerHTML = '';
  appEl.innerHTML = '';
  appEl.appendChild(el('div', 'await', 'あなたの仕様を待っています<br><span class="rest-q">あと ' + CHALLENGE.length + ' 問</span>'));
  closeEl.innerHTML = 'この会社の仕事を、やってみてください。<span class="sub">' +
    '　仕様を決めると、そのとおりに作ります。決めなかったことは、作られません。</span>';

  const head = el('div', 'step');
  head.innerHTML = '<div class="step-head"><span class="label">[あなたの仕様]</span>' +
                   '<span class="pct" data-cpct>0 / ' + CHALLENGE.length + '</span></div>' +
                   '<div class="bar" data-cbar></div>';
  genEl.appendChild(head);
  const dl = el('dl', 'spec myspec');
  CHALLENGE.forEach(function (q) {
    dl.innerHTML += '<dt>' + esc(q.short) + '</dt>' +
                    '<dd class="pending" data-slot="' + q.key + '">まだ決まっていません</dd>';
  });
  genEl.appendChild(dl);

  askChallenge();
}

function askChallenge() {
  const step = CHALLENGE[state.cstep];
  const head = genEl.querySelector('.step');
  head.querySelector('[data-cbar]').innerHTML = bar(state.cstep / CHALLENGE.length);
  head.querySelector('[data-cpct]').textContent = state.cstep + ' / ' + CHALLENGE.length;

  chooseEl.innerHTML = '';
  state.sel = 0;

  chooseEl.appendChild(el('span', 'ask', step.q));

  const list = el('div', 'choices');
  list.setAttribute('role', 'listbox');

  step.opts.forEach(function (o, i) {
    const b = el('button', 'choice');
    b.type = 'button';
    b.setAttribute('role', 'option');
    b.innerHTML = '<span class="caret">▸</span><span>' + esc(o.label) + '</span>';
    b.addEventListener('click', function () {
      state.sel = i;
      if (step.multi) {
        state.picked[i] = !state.picked[i];
        b.classList.toggle('picked', !!state.picked[i]);
        paint(list);
      } else {
        answerChallenge([o]);
      }
    });
    list.appendChild(b);
  });

  if (step.multi) {
    const done = el('button', 'choice go');
    done.type = 'button';
    done.setAttribute('role', 'option');
    done.innerHTML = '<span class="caret">▸</span><span>これで確定</span>';
    done.addEventListener('click', function () {
      const chosen = step.opts.filter(function (o, i) { return state.picked[i]; });
      if (!chosen.length) { say('ひとつ以上選んでください'); return; }
      answerChallenge(chosen);
    });
    list.appendChild(done);
  }

  chooseEl.appendChild(list);
  if (step.hint) chooseEl.appendChild(el('span', 'scroll-cue', step.hint));

  paint(list);
  keys([['↑', ''], ['↓', '選ぶ'], ['Enter', step.multi ? '選択/確定' : '決定']]);
  say('');
}

function answerChallenge(chosen) {
  const step = CHALLENGE[state.cstep];
  state.answers[step.key] = chosen.map(function (o) { return o.v; });

  // 選ばなかったもの／選んだものに紐づく漏れを集める
  if (step.multi) {
    step.opts.forEach(function (o) {
      if (o.miss && chosen.indexOf(o) < 0) state.misses.push(o.miss);
    });
  } else if (chosen[0].miss) {
    state.misses.push(chosen[0].miss);
  }

  // 決めたことを左に積む
  const slot = genEl.querySelector('[data-slot="' + step.key + '"]');
  if (slot) {
    slot.className = 'filled';
    slot.innerHTML = chosen.map(function (o) {
      return '<span class="tag">' + esc(o.label) + '</span>';
    }).join('');
  }

  state.cstep++;
  state.picked = {};
  const rest = appEl.querySelector('.rest-q');
  if (rest) rest.textContent = 'あと ' + (CHALLENGE.length - state.cstep) + ' 問';

  if (state.cstep < CHALLENGE.length) { askChallenge(); return; }

  genEl.querySelector('.step [data-cbar]').innerHTML = bar(1);
  genEl.querySelector('.step [data-cpct]').textContent = CHALLENGE.length + ' / ' + CHALLENGE.length;
  buildFromAnswers();
}

/* 回答から題材を組み立て、そのまま既存の生成フローに乗せる */
function buildFromAnswers() {
  const base = SUBJECTS[0];
  const ans = state.answers;
  const n = state.misses.length;

  // 決めたことを仕様に反映する。決めなかったことは作られない。
  const tables = base.spec.tables.slice();
  if (ans.revision[0] === 'version') tables.push('見積版数');

  const custom = Object.assign({}, base);
  custom.fromChallenge = true;
  custom.spec = Object.assign({}, base.spec, {
    screens: ans.screens,
    tables: tables,
    threshold: ans.threshold[0] || base.spec.threshold
  });
  custom.thoughts = state.fixing ? [
    '指摘した ' + state.fixCount + ' 件を、仕様に反映します。',
    '承認画面と月次集計を足し、不在時の代理と版管理を入れます。',
    'このまま作り直します。前に作ったものは捨てます。'
  ] : [
    'あなたが決めた仕様を読みます。画面 ' + ans.screens.length + ' つ、承認 ' +
      ans.approval[0] + ' 段。',
    '書かれていることは、そのまま作ります。書かれていないことは作りません。',
    n === 0 ? '……漏れは見つかりませんでした。お見事です。'
            : '……決められていないことが ' + n + ' つあります。あとで指摘します。'
  ];
  custom.notices = state.fixing
    ? ['指摘した箇所は全部埋まりました。足すものはもうありません。',
       'ここまでで、仕様を直してから動くものが出るまでが一周しました。']
    : n === 0
    ? ['漏れがないので、足すものはありません。', 'この状態で運用に入れます。']
    : ['まず、決められたとおりに作りました。ここまでは仕様どおりです。',
       'そのうえで ' + n + ' つ、運用で詰まる箇所があります。下に出します。'];

  // 決めた内容に応じて、右の画面に出るものが変わる
  let extra;
  if (ans.absent[0] === 'proxy') {
    extra = { log: '不在時の代理承認',
              field: { label: '代理承認者', value: '（不在時: 設備部 次長）' },
              note: '不在時は代理へ回す、と決められていたので用意しました。',
              src: 'あなたの仕様どおり' };
  } else if (ans.revision[0] === 'version') {
    extra = { log: '版の管理',
              field: { label: '版数', value: 'Rev.2（前版あり）' },
              note: '版を分けて残す、と決められていたので用意しました。',
              src: 'あなたの仕様どおり' };
  } else if (ans.approval[0] >= 2) {
    extra = { log: '2段目の承認者',
              field: { label: '2段目の承認', value: '設備部 部長' },
              note: '承認2段と決められていたので、2段目の欄を用意しました。',
              src: 'あなたの仕様どおり' };
  } else {
    // 何も決まっていないので、こちらで足す
    extra = base.app.extra;
  }
  custom.app = Object.assign({}, base.app, { extra: extra });

  start(custom, { fast: false, challenge: true });
}

/* 採点結果 */
/* -----------------------------------------------------------
   直したあと。ここが AI × ローコードの効きどころの説明になる。
   「漏れを指摘できる」だけなら AI 単体、「作るのが速い」だけなら
   ローコード単体の話。掛け算の中身は、指摘された漏れがその場で
   直り、直った状態を触って確かめられること。
   ----------------------------------------------------------- */
function showFixed() {
  const secs = Math.max(0.1, (performance.now() - state.fixT0) / 1000);
  state.fixing = false;
  state.fixed = true;

  closeEl.innerHTML =
    '<strong>' + state.fixCount + ' 件、直りました。' +
    (Math.round(secs * 10) / 10) + ' 秒。</strong>' +
    '<span class="sub">　仕様を直したら、動くものも直っています。右を触って確かめてください。' +
    '<br>同じ直しを、要件を固めてから作る進め方でやると、' +
    '漏れが見つかるのは結合テストです。設計まで戻って作り直しになります。' +
    '<b>この差が、AI とローコードを組み合わせている理由です。</b></span>';

  state.phase = 'choose';
  renderChoose();
}

function showScore() {
  // 直したあとは、採点ではなく「直るまでの速さ」を見せる
  if (state.fixing) { showFixed(); return; }
  const n = state.misses.length;
  const total = CHALLENGE.reduce(function (a, s) {
    return a + s.opts.filter(function (o) { return o.miss; }).length;
  }, 0);

  const head = n === 0
    ? '<strong>漏れなし</strong>。上流で全部決められています。'
    : '見つかった漏れ <strong>' + n + ' 件</strong>　<span class="sub">（想定 ' + total + ' 件中）</span>';

  let html = head + '<div class="misses">';
  if (n === 0) {
    html += '<p class="ok-line">この仕様なら、作ったものがそのまま使えます。' +
            '上流で決めきるのは、実際にはこれくらい難しいことです。</p>';
  } else {
    state.misses.forEach(function (m) {
      html += '<p class="miss-line"><span class="mk">!</span>' + esc(m) + '</p>';
    });
    html += '<p class="ok-line">上流で気づけば、直すのは今この場です。' +
            '運用で気づくと、作り直しになります。<b>ここに張るのが私たちの仕事です。</b></p>';
  }
  html += '</div>';

  closeEl.innerHTML = html;
  state.phase = 'choose';
  renderChoose();
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
    // 複数選択の問いは、最後の「これで確定」以外は選択のトグルになる
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

startChallenge();
