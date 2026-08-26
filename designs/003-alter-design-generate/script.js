/* =========================================================
   003 Alter Design Consulting
   「仕様を入れたら、動くものが出てくる」を体験させる。

   設計方針
   - 選択式が主、打ち込みは隠し（/ でコマンド）
   - 生成結果はデモとして事前に用意したもの。AI のふりはしない
   - 仕様に出したルールが、生成された画面で実際に発火する
   - 進行は経過時間ベース（バックグラウンドタブでも復帰時に追いつく）
   ========================================================= */
'use strict';

const mainEl  = document.getElementById('main');
const keysEl  = document.getElementById('keys');
const msgEl   = document.getElementById('msg');
const discEl  = document.getElementById('disclaimer');

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

function yen(n) { return n.toLocaleString('ja-JP') + ' 円'; }
function hours(n) { return (Math.round(n * 10) / 10).toLocaleString('ja-JP') + ' 時間'; }
function count(n) { return n.toLocaleString('ja-JP') + ' 件'; }

function bar(pct, width) {
  const w = width || 24;
  const on = Math.round(w * Math.min(1, Math.max(0, pct)));
  return '<span>' + '█'.repeat(on) + '</span>' +
         '<span class="rest">' + '░'.repeat(w - on) + '</span>';
}

function keys(pairs) {
  keysEl.innerHTML = pairs.map(function (p) {
    return p[0].split('+').map(function (k) { return '<kbd>' + esc(k) + '</kbd>'; }).join('') + esc(p[1]);
  }).join('　');
}

function say(text) { msgEl.textContent = text || ''; }

function scrollToEnd() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

/* 経過時間ベースの進行。setTimeout はバックグラウンドタブで間引かれるため使わない。 */
function timeline(steps, done) {
  let t0 = null, i = 0;
  const total = steps.reduce(function (a, s) { return a + s.at; }, 0);
  const frame = function (ts) {
    if (t0 === null) t0 = ts;
    const t = ts - t0;
    let acc = 0;
    for (let k = 0; k < steps.length; k++) {
      acc += steps[k].at;
      if (i <= k && t >= acc) { steps[k].run(); i = k + 1; }
    }
    if (i >= steps.length) { if (done) done(); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return { total: total, skip: function () {
    state.skipped = true;
    while (i < steps.length) { steps[i].run(); i++; }
    if (done) done();
  } };
}

/* ---------- 題材 ---------- */

const SUBJECTS = [
  {
    id: 'quote',
    label: '見積作成システム',
    sub: '明細を積み上げて、承認に回す',
    words: ['見積', 'みつもり', '見積り', 'quote', '受注', '販売', '請求', '価格'],
    spec: {
      screens: ['見積一覧', '見積入力', '承認'],
      tables: ['見積ヘッダ', '見積明細', '承認履歴'],
      rule: '合計 100万円以上は部長承認が必要'
    },
    app: {
      title: '見積入力',
      fields: [
        { label: '顧客', value: '株式会社サンプル建設' },
        { label: '件名', value: '新社屋 空調設備工事' }
      ],
      cols: ['明細', '数量', '単価', '金額'],
      rows: [
        { name: '空調機本体',   qty: 1, price: 850000 },
        { name: '据付工事',     qty: 1, price: 320000 },
        { name: '試運転調整',   qty: 1, price: 60000 }
      ],
      editable: 'qty',
      rowValue: function (r) { return r.qty * r.price; },
      totalLabel: '合計',
      fmt: yen,
      over: function (t) { return t >= 1000000; },
      onText:  function (t) { return '合計 ' + yen(t) + ' → 100万円以上のため、部長承認が必要です'; },
      offText: function (t) { return '合計 ' + yen(t) + ' → 課長承認で完了します'; },
      ruleSrc: '仕様: 合計 100万円以上は部長承認',
      action: '申請する',
      doneOn:  '部長承認へ回しました。',
      doneOff: '課長承認へ回しました。'
    }
  },
  {
    id: 'attendance',
    label: '勤怠管理',
    sub: '残業を積み上げて、上限を見張る',
    words: ['勤怠', '出勤', '残業', '労務', '打刻', '休暇', '就業', 'working'],
    spec: {
      screens: ['月次一覧', '勤怠入力', '承認'],
      tables: ['勤怠ヘッダ', '日次明細', '承認履歴'],
      rule: '月の残業 45時間超で警告（36協定）'
    },
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
      editable: 'qty',
      rowValue: function (r) { return r.qty; },
      totalLabel: '月間残業',
      fmt: hours,
      over: function (t) { return t > 45; },
      onText:  function (t) { return '月間 ' + hours(t) + ' → 45時間を超過。36協定の上限に触れます'; },
      offText: function (t) { return '月間 ' + hours(t) + ' → 上限内です（45時間まで）'; },
      ruleSrc: '仕様: 月の残業 45時間超で警告',
      action: '提出する',
      doneOn:  '警告付きで提出しました。上長の確認が必要です。',
      doneOff: '提出しました。'
    }
  },
  {
    id: 'inventory',
    label: '在庫管理',
    sub: '在庫が発注点を割ったら知らせる',
    words: ['在庫', '倉庫', '発注', '棚卸', '入出庫', '資材', 'inventory', '購買'],
    spec: {
      screens: ['在庫一覧', '入出庫入力', '発注'],
      tables: ['品目マスタ', '在庫残高', '入出庫履歴'],
      rule: '在庫が発注点を下回ったら発注対象にする'
    },
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
      editable: 'qty',
      perRow: function (r) { return r.qty < r.price; },   // 発注点割れ
      rowValue: function (r) { return r.qty < r.price ? 1 : 0; },
      totalLabel: '発注が必要',
      fmt: count,
      over: function (t) { return t > 0; },
      onText:  function (t) { return count(t) + 'が発注点を下回っています'; },
      offText: function () { return 'すべて発注点を上回っています'; },
      ruleSrc: '仕様: 在庫 < 発注点 なら発注対象',
      action: '発注をかける',
      doneOn:  '発注対象を購買へ回しました。',
      doneOff: '発注は不要です。'
    }
  }
];

/* / で開く隠しコマンド。会社の情報はここから全部たどれる。 */
const INFO = {
  philosophy: {
    desc: '企業理念',
    run: function () {
      return '<p class="closing lead" style="border:0;padding:0">経営の力で<strong>「遊ぶように働く世界」</strong>をデザインする</p>' +
        '<p class="closing body">やらされる仕事ではなく、自ら作りにいく仕事へ。' +
        '創造の力と経営の意思をつなぎ、働くことが遊びに近づく状態を設計する。</p>';
    }
  },
  services: {
    desc: 'サービス',
    run: function () {
      const s = [
        ['次世代型業務システム開発', 'ノーコード／ローコードを土台に、「使う人」を中心に据えて業務を再設計する。'],
        ['AIによる意思決定支援・事業変革', '企業に眠るデータ資産を、戦略と予測に変換する。'],
        ['自律共創型の組織デザイン', 'フラットで柔軟な構造の中で、個の自律とチームの協働を両立させる。'],
        ['地域のデジタル格差支援', '都市に集中したデジタルの機会を、全国へ開く。']
      ];
      return '<dl class="spec">' + s.map(function (x, i) {
        return '<dt>' + ('0' + (i + 1)) + '</dt><dd><b>' + esc(x[0]) + '</b><br>' +
               '<span style="color:var(--fg-2)">' + esc(x[1]) + '</span></dd>';
      }).join('') + '</dl>';
    }
  },
  company: {
    desc: '会社概要',
    run: function () {
      const c = [
        ['設立', '2025年6月'], ['資本金', '6,000万円'], ['代表取締役', '松岡 真功'],
        ['所在地', '東京都港区西新橋3-23-5 ANYZ304'],
        ['事業', 'AI技術を活用した組織最適化コンサルティング / AI × ローコードの次世代型システム開発'],
        ['株主', '株式会社BlueMeme、株式会社ハイ・アベイラビリティ・システムズ、株式会社サーバーワークス・キャピタル、リックソフト株式会社']
      ];
      return '<dl class="spec">' + c.map(function (x) {
        return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>';
      }).join('') + '</dl>';
    }
  },
  ai: {
    desc: 'このページと AI の関係',
    run: function () {
      return '<p class="closing body" style="margin-top:0">' +
        'このページは AI（Claude）が実装した。HTML / CSS / JavaScript だけで、' +
        'フレームワークもビルド工程もない。仕様を決めて渡したら、動くものが出てきた。' +
        '<br><br>' +
        'ページ内の「生成」はデモとして事前に用意したもので、その場で AI が推論しているわけではない。' +
        'そこは正直に書いておく。実演したいのは推論そのものではなく、' +
        '<b>上流で決めたことが、そのまま動くものになる</b>という順序の方だから。</p>';
    }
  },
  why: {
    desc: 'なぜこの作りなのか',
    run: function () {
      return '<p class="closing body" style="margin-top:0">' +
        '企業理念に「遊ぶように働く世界をデザインする」と書いてある。' +
        'ならばサイトも遊んでいるべきだと考えた。' +
        '<br><br>' +
        '会社案内を読ませる代わりに、事業内容をその場でやってもらう形にした。' +
        '仕様を選ぶと、画面とテーブルと業務ルールに分解され、触れるものが組み上がる。' +
        'これがこの会社の仕事の順序そのものである。' +
        '<br><br>' +
        'マウスは要らない。矢印キーと Enter だけで進む。' +
        'そして気づいた人は、こうしてコマンドも打てる。</p>';
    }
  },
  contact: {
    desc: '問い合わせ',
    run: function () {
      return '<p class="closing body" style="margin-top:0">現行サイトのフォームから受け付けています。<br>' +
        '<a href="https://alt-dsgn.co.jp/" target="_blank" rel="noopener" ' +
        'style="color:var(--amber);text-decoration:underline;text-underline-offset:3px">alt-dsgn.co.jp</a></p>';
    }
  }
};

/* ---------- 状態 ---------- */

const state = {
  phase: 'choose',   // choose | running | app | closing | command
  sel: 0,
  subject: null,
  running: null,
  t0: 0,
  rows: null
};

/* ---------- 1. 選択 ---------- */

function renderChoose(again) {
  state.phase = 'choose';
  state.sel = 0;

  const block = el('section', 'block');

  block.appendChild(el('div', 'ask',
    (again ? 'では、次は何を作りますか？' : '何を作りますか？') +
    '<span class="hint">選ぶと、その場で作ります。' +
    (again ? '' : '会社案内を読む必要はありません。') + '</span>'));

  const list = el('div', 'choices');
  list.setAttribute('role', 'listbox');

  SUBJECTS.forEach(function (s, i) {
    const b = el('button', 'choice');
    b.type = 'button';
    b.dataset.idx = i;
    b.setAttribute('role', 'option');
    b.innerHTML = '<span class="caret">▸</span><span><b>' + esc(s.label) + '</b> ' +
                  '<span class="sub">' + esc(s.sub) + '</span></span>';
    b.addEventListener('click', function () { state.sel = i; paintSel(list); choose(i); });
    list.appendChild(b);
  });

  const free = el('button', 'choice freeform');
  free.type = 'button';
  free.dataset.idx = SUBJECTS.length;
  free.setAttribute('role', 'option');
  free.innerHTML = '<span class="caret">▸</span><span class="blanks">＿＿＿＿＿＿＿＿</span>' +
                   '<span class="sub">自分で書く</span>';
  free.addEventListener('click', function () { state.sel = SUBJECTS.length; paintSel(list); openFree(); });
  list.appendChild(free);

  block.appendChild(list);
  mainEl.appendChild(block);
  paintSel(list);

  keys([[ '↑', '' ], [ '↓', '選ぶ' ], [ 'Enter', '決定' ]]);
  say('マウスは要りません');
  if (again) scrollToEnd();
}

function paintSel(list) {
  Array.prototype.forEach.call(list.children, function (c, i) {
    c.setAttribute('aria-selected', i === state.sel ? 'true' : 'false');
  });
}

function currentList() {
  const lists = mainEl.querySelectorAll('.choices');
  return lists[lists.length - 1];
}

function openFree() {
  const list = currentList();
  if (list.querySelector('.freebox')) { list.querySelector('.freebox input').focus(); return; }

  const box = el('div', 'freebox');
  box.innerHTML = '<label for="freein">作りたいものを書いてください</label>' +
                  '<input id="freein" type="text" autocomplete="off" ' +
                  'placeholder="例: 発注管理、日報、経費精算 …">' +
                  '<p class="note">Enter で決定。デモとして用意した題材に寄せて解釈します。</p>';
  list.appendChild(box);

  const input = box.querySelector('input');
  input.focus();
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); chooseFree(input.value); }
    if (e.key === 'Escape') { e.preventDefault(); input.blur(); }
    e.stopPropagation();
  });
  keys([[ 'Enter', '決定' ], [ 'Esc', '戻る' ]]);
}

function chooseFree(text) {
  const q = String(text || '').trim();
  if (!q) return;

  let hit = null;
  for (const s of SUBJECTS) {
    if (s.words.some(function (w) { return q.indexOf(w) >= 0; })) { hit = s; break; }
  }

  const chosen = lockChoices();
  if (chosen) {
    // 「＿＿＿＿ 自分で書く」のままでは何を書いたか残らない
    chosen.innerHTML = '<span class="caret">▸</span><span>' + esc(q) + '</span>';
  }

  if (!hit) {
    // 外したときに取り繕わない。ここで嘘をつくと全部が嘘になる。
    const b = el('section', 'block');
    b.innerHTML = '<p class="closing body" style="margin-top:0">' +
      '「' + esc(q) + '」は、このデモに用意した題材にありませんでした。' +
      'ここで適当な結果を出しても意味がないので、正直に止めます。' +
      '<br><br>実際の案件なら、まずこの要望を業務の単位に分解するところから始めます。' +
      '下の題材でその工程を見てください。</p>';
    mainEl.appendChild(b);
    renderChoose(true);
    return;
  }

  const note = el('section', 'block');
  note.innerHTML = '<div class="step-head"><span class="label">[解釈]</span>' +
    '<span>「' + esc(q) + '」→ ' + esc(hit.label) + ' として扱います</span></div>';
  mainEl.appendChild(note);

  start(hit);
}

/* 選んだあとは、選ばなかったものを畳む。
   残しておくとページが延々伸びて、繰り返すほど読みにくくなる。 */
function lockChoices() {
  const list = currentList();
  if (!list) return null;

  const box = list.querySelector('.freebox');
  if (box) box.remove();

  const chosen = list.querySelector('.choice[aria-selected="true"]');
  Array.prototype.slice.call(list.children).forEach(function (c) {
    if (c !== chosen) c.remove();
  });

  if (chosen) {
    chosen.disabled = true;
    chosen.setAttribute('aria-selected', 'false');
    chosen.classList.add('chosen');
  }

  const ask = list.parentElement && list.parentElement.querySelector('.ask');
  if (ask) {
    const hint = ask.querySelector('.hint');
    if (hint) hint.remove();
    ask.classList.add('done');
  }
  return chosen;
}

function choose(i) {
  lockChoices();
  start(SUBJECTS[i]);
}

/* ---------- 2. 解釈 → 生成 ---------- */

function start(subject) {
  state.subject = subject;
  state.phase = 'running';
  state.t0 = performance.now();
  state.skipped = false;
  state.rows = subject.app.rows.map(function (r) { return Object.assign({}, r); });

  const block = el('section', 'block');
  mainEl.appendChild(block);

  const s1 = el('div', 'step');
  s1.innerHTML = '<div class="step-head"><span class="label">[仕様を解釈]</span>' +
                 '<span class="pct" data-pct>0%</span></div><div class="bar" data-bar></div>';
  block.appendChild(s1);
  const sub1 = el('div', 'substep');
  block.appendChild(sub1);

  const specHolder = el('div');
  block.appendChild(specHolder);

  const s2 = el('div', 'step');
  s2.hidden = true;
  s2.innerHTML = '<div class="step-head"><span class="label">[生成]</span>' +
                 '<span class="pct" data-pct>0%</span></div><div class="bar" data-bar></div>';
  block.appendChild(s2);
  const sub2 = el('div', 'substep');
  sub2.hidden = true;
  block.appendChild(sub2);

  const appHolder = el('div');
  appHolder.style.marginTop = '1.4em';
  block.appendChild(appHolder);

  const setStep = function (step, pct, text, holder) {
    step.querySelector('[data-bar]').innerHTML = bar(pct);
    step.querySelector('[data-pct]').textContent = Math.round(pct * 100) + '%';
    if (holder && text) holder.textContent = '└ ' + text;
  };

  const spec = subject.spec;
  const steps = [
    { at: 260, run: function () { setStep(s1, .25, '業務の単位を抽出', sub1); } },
    { at: 300, run: function () { setStep(s1, .55, '画面を割り出す', sub1); } },
    { at: 280, run: function () { setStep(s1, .8,  'テーブルを設計', sub1); } },
    { at: 300, run: function () { setStep(s1, 1,   '業務ルールを抽出', sub1); } },
    { at: 200, run: function () {
        sub1.textContent = '';
        specHolder.appendChild(renderSpec(spec));
        s2.hidden = false; sub2.hidden = false;
        scrollToEnd();
      } },
    { at: 300, run: function () { setStep(s2, .3, esc(spec.screens[0]) + ' を構築', sub2); } },
    { at: 320, run: function () { setStep(s2, .55, esc(spec.screens[1]) + ' を構築', sub2); } },
    { at: 300, run: function () { setStep(s2, .78, esc(spec.screens[2]) + ' を構築', sub2); } },
    { at: 340, run: function () { setStep(s2, 1, '業務ルールを配線', sub2); } },
    { at: 220, run: function () {
        sub2.textContent = '';
        appHolder.appendChild(buildApp(subject));
        state.phase = 'app';
        scrollToEnd();
      } }
  ];

  state.running = timeline(steps, function () {
    state.running = null;
    afterApp(block, subject);
  });

  keys([[ 'Enter', '飛ばす' ]]);
  say('生成中');
  scrollToEnd();
}

function renderSpec(spec) {
  const dl = el('dl', 'spec');
  dl.innerHTML =
    '<dt>画面</dt><dd>' + spec.screens.map(function (s) {
      return '<span class="tag">' + esc(s) + '</span>';
    }).join('') + '</dd>' +
    '<dt>テーブル</dt><dd>' + spec.tables.map(function (s) {
      return '<span class="tag">' + esc(s) + '</span>';
    }).join('') + '</dd>' +
    '<dt>ルール</dt><dd class="rule">' + esc(spec.rule) + '</dd>';
  return dl;
}

/* ---------- 3. 生成された画面（本当に動く） ---------- */

function buildApp(subject) {
  const a = subject.app;
  const wrap = el('div', 'app');

  const head = el('div', 'app-head');
  head.innerHTML = '<span>' + esc(a.title) + '</span>' +
                   '<span class="gen">generated</span>';
  wrap.appendChild(head);

  const body = el('div', 'app-body');
  wrap.appendChild(body);

  a.fields.forEach(function (f) {
    const row = el('div', 'field');
    row.innerHTML = '<label>' + esc(f.label) + '</label>' +
                    '<input type="text" value="' + esc(f.value) + '">';
    body.appendChild(row);
  });

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

  const alert = el('div', 'alert');
  alert.innerHTML = '<span class="mark">!</span><span><span data-alert></span>' +
                    '<br><span class="src">' + esc(a.ruleSrc) + '</span></span>';
  body.appendChild(alert);

  const actions = el('div', 'actions');
  actions.innerHTML = '<button type="button" class="btn" data-go>' + esc(a.action) + '</button>' +
                      '<button type="button" class="btn ghost" data-again>別のものを作る</button>';
  body.appendChild(actions);

  const log = el('div', 'applog');
  body.appendChild(log);

  /* --- 計算とルールの配線 --- */
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
        tr.querySelector('[data-derived]').textContent = (Math.round(r.qty * 10) / 10).toLocaleString('ja-JP');
      } else {
        tr.querySelector('[data-fixed]').textContent = r.price.toLocaleString('ja-JP');
        const short = a.perRow(r);
        const cell = tr.querySelector('[data-derived]');
        cell.textContent = short ? '発注' : '—';
        cell.style.color = short ? 'var(--warn)' : 'var(--dimmer)';
      }
      t += a.rowValue(r);
    });

    total.querySelector('[data-total]').textContent = a.fmt(t);
    const on = a.over(t);
    alert.className = 'alert ' + (on ? 'on' : 'off');
    alert.querySelector('.mark').textContent = on ? '!' : '·';
    alert.querySelector('[data-alert]').textContent = on ? a.onText(t) : a.offText(t);
    return { total: t, on: on };
  };

  tbody.addEventListener('input', recalc);

  actions.querySelector('[data-go]').addEventListener('click', function () {
    const r = recalc();
    const stamp = new Date().toTimeString().slice(0, 8);
    log.innerHTML = '<span class="t">' + stamp + '</span>  ' +
                    esc(r.on ? a.doneOn : a.doneOff);
  });
  actions.querySelector('[data-again]').addEventListener('click', function () {
    renderChoose(true);
  });

  recalc();
  return wrap;
}

/* ---------- 4. 締め ---------- */

function afterApp(block, subject) {
  const secs = Math.max(0.1, (performance.now() - state.t0) / 1000);

  // 飛ばした場合に実測を出すと「0.1秒で出来た」ように読めてしまう。嘘は書かない。
  const lead = state.skipped
    ? '<p class="lead">飛ばしましたが、<strong>順序は同じ</strong>です。' +
      '仕様 → 画面・テーブル・ルール → 動くもの。</p>'
    : '<p class="lead">仕様を決めてから、触れるものが出てくるまで <strong>' +
      (Math.round(secs * 10) / 10) + ' 秒</strong>。</p>';

  const c = el('section', 'block closing');
  c.innerHTML = lead +
    '<p class="body">数字を変えてみてください。' +
      '<b>「' + esc(subject.spec.rule) + '」</b>が本当に効いています。' +
      '仕様に書いた一行が、そのまま動いている。<br><br>' +
      'これが「上流工程中心のシステム開発」です。上流で決めたことが下流で作り直されず、' +
      'そのまま動くものになる。AI とローコードは、その順序を守るための道具として使っています。</p>';
  mainEl.appendChild(c);

  const list = el('div', 'choices');
  list.setAttribute('role', 'listbox');
  const items = [
    ['別のものを作る', function () { renderChoose(true); }],
    ['この会社について', function () { showInfo('company'); }],
    ['なぜこの作りなのか', function () { showInfo('why'); }],
    ['AI との関係', function () { showInfo('ai'); }],
    ['問い合わせ', function () { showInfo('contact'); }]
  ];
  items.forEach(function (it, i) {
    const b = el('button', 'choice');
    b.type = 'button';
    b.dataset.idx = i;
    b.setAttribute('role', 'option');
    b.innerHTML = '<span class="caret">▸</span><span>' + esc(it[0]) + '</span>';
    b.addEventListener('click', it[1]);
    list.appendChild(b);
  });
  c.appendChild(list);

  c.appendChild(el('p', null,
    '<span style="color:var(--dimmer);font-size:.85em;font-family:var(--mono)">' +
    '/ …</span>'));

  state.phase = 'closing';
  state.sel = 0;
  state.actions = items.map(function (it) { return it[1]; });
  paintSel(list);

  keys([[ '↑', '' ], [ '↓', '選ぶ' ], [ 'Enter', '決定' ]]);
  say('');

  discEl.hidden = false;
  discEl.innerHTML =
    'このページの「生成」は、デモとして事前に用意した結果を出しています。' +
    'その場で AI が推論しているわけではありません。' +
    'ページ自体の実装は AI（Claude）が行いました。' +
    '<br>現行サイト: <a href="https://alt-dsgn.co.jp/" target="_blank" rel="noopener">alt-dsgn.co.jp</a>';

  scrollToEnd();
}

function showInfo(key) {
  const info = INFO[key];
  if (!info) return;
  const b = el('section', 'block');
  b.innerHTML = '<div class="step-head" style="margin-bottom:.8em"><span class="label">' +
                esc(info.desc) + '</span></div>' + info.run();
  mainEl.appendChild(b);
  scrollToEnd();
}

/* ---------- 5. 隠しコマンド（/） ---------- */

let cmdBox = null;

function openCommand() {
  if (cmdBox) { cmdBox.querySelector('input').focus(); return; }
  cmdBox = el('section', 'block');
  cmdBox.innerHTML =
    '<div class="freebox" style="padding-left:0">' +
    '<label>コマンド</label>' +
    '<input type="text" autocomplete="off" spellcheck="false" placeholder="' +
    Object.keys(INFO).join(' / ') + '">' +
    '<p class="note">Tab 補完、Esc で閉じる</p></div>';
  mainEl.appendChild(cmdBox);

  const input = cmdBox.querySelector('input');
  input.focus();
  input.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape') { closeCommand(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const hits = Object.keys(INFO).filter(function (k) { return k.indexOf(input.value) === 0; });
      if (hits.length === 1) input.value = hits[0];
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = input.value.trim().toLowerCase();
    closeCommand();
    if (INFO[q]) { showInfo(q); return; }
    const b = el('section', 'block');
    b.innerHTML = '<p class="closing body" style="margin-top:0;color:var(--dim)">' +
      esc(q) + ': そのコマンドはありません。' +
      '<br><span style="color:var(--dimmer)">使えるもの: ' +
      Object.keys(INFO).join(' / ') + '</span></p>';
    mainEl.appendChild(b);
    scrollToEnd();
  });

  say('コマンド入力中');
  scrollToEnd();
}

function closeCommand() {
  if (!cmdBox) return;
  cmdBox.remove();
  cmdBox = null;
  say('');
}

/* ---------- キー操作 ---------- */

document.addEventListener('keydown', function (e) {
  if (e.isComposing) return;

  const tag = document.activeElement && document.activeElement.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.key === '/' && !typing) { e.preventDefault(); openCommand(); return; }
  if (typing) return;

  if (state.phase === 'running') {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      if (state.running) state.running.skip();
    }
    return;
  }

  if (state.phase !== 'choose' && state.phase !== 'closing') return;

  const list = currentList();
  if (!list) return;
  const n = list.children.length;

  if (e.key === 'ArrowDown' || e.key === 'j') {
    e.preventDefault();
    state.sel = (state.sel + 1) % n; paintSel(list);
  } else if (e.key === 'ArrowUp' || e.key === 'k') {
    e.preventDefault();
    state.sel = (state.sel - 1 + n) % n; paintSel(list);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const btn = list.children[state.sel];
    if (btn && !btn.disabled) btn.click();
  }
});

/* ---------- 起動 ---------- */

renderChoose(false);
