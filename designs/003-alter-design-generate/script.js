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
  },
  {
    id: 'attendance',
    label: '勤怠管理',
    sub: '残業を積み上げて上限を見張る',
    words: ['勤怠', '出勤', '残業', '労務', '打刻', '休暇', '就業'],
    spec: {
      screens: ['月次一覧', '勤怠入力', '承認'],
      tables: ['勤怠ヘッダ', '日次明細', '承認履歴'],
      ruleBefore: '月の残業 ', ruleAfter: ' 時間超で警告', threshold: 45
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
      display: 'plain',
      totalLabel: '月間残業',
      fmt: hours,
      over: function (t, th) { return t > th; },
      onText:  function (t, th) { return hours(t) + ' → ' + hours(th) + 'を超過。上限に触れます'; },
      offText: function (t, th) { return hours(t) + ' → 上限内（' + hours(th) + 'まで）'; },
      ruleSrc: '仕様のルール',
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
      ruleBefore: '発注点割れが ', ruleAfter: ' 件を超えたら通知', threshold: 0
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
      display: 'flag',
      totalLabel: '発注が必要',
      fmt: count,
      over: function (t, th) { return t > th; },
      onText:  function (t, th) { return count(t) + 'が発注点を下回っています（通知は' + count(th) + '超）'; },
      offText: function () { return 'すべて発注点を上回っています'; },
      ruleSrc: '仕様のルール',
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
  },

  /* --- ここから下は冗談。ただし作り方は業務システムと同じ。
         同じ工程で何でも作れる、ということの証明も兼ねている。 --- */
  {
    id: 'meeting',
    label: '会議のコスト',
    sub: '参加者の時間を金額に換算する',
    joke: true,
    words: ['会議', 'ミーティング', '打ち合わせ', 'meeting', '打合せ'],
    spec: {
      screens: ['会議一覧', 'コスト計算', '振り返り'],
      tables: ['会議ヘッダ', '参加者明細', '決定事項'],
      ruleBefore: '', ruleAfter: ' 円超なら意思決定の場として扱う', threshold: 50000
    },
    thoughts: [
      '「会議のコスト」。参加者の時間を金額に換算する業務ですね。',
      '役職ごとに単価が違うはずです。人数 × 時給 で出せます。',
      '幾らを超えたら問題視するか。5万円を目安にしておきます。'
    ],
    notices: [
      'ところで、この会議で何が決まったかを記録する場所がありませんね。',
      '「決まったこと」欄を足します。空欄なら、金額だけ払ったことになります。'
    ],
    app: {
      title: '会議コスト',
      fields: [
        { label: '会議名', value: '週次進捗会議' },
        { label: '所要時間', value: '60分' }
      ],
      cols: ['参加者', '人数', '時給', '金額'],
      rows: [
        { name: '部長', qty: 1, price: 12000 },
        { name: '課長', qty: 2, price: 8000 },
        { name: '担当', qty: 6, price: 4000 }
      ],
      rowValue: function (r) { return r.qty * r.price; },
      totalLabel: 'この会議',
      fmt: yen,
      over: function (t, th) { return t >= th; },
      onText:  function (t, th) { return yen(t) + ' → ' + yen(th) + '超。意思決定の場として扱います'; },
      offText: function (t, th) { return yen(t) + ' → ' + yen(th) + '以下。情報共有の範囲'; },
      ruleSrc: '仕様のルール',
      action: '記録する',
      doneOn:  '意思決定の場として記録しました。',
      doneOff: '記録しました。',
      extra: {
        log: '「決まったこと」欄',
        field: { label: '決まったこと', value: '（未記入）' },
        note: '空欄です。決まっていないなら、金額だけ払ったことになります。',
        src: '仕様にはありません'
      }
    }
  },
  {
    id: 'mood',
    label: '部長の機嫌',
    sub: '観測して声をかける可否を決める',
    joke: true,
    words: ['機嫌', '部長', 'ムード', '空気', '顔色'],
    spec: {
      screens: ['機嫌一覧', '観測入力', '声かけ判定'],
      tables: ['観測ヘッダ', '観測明細', '声かけ履歴'],
      ruleBefore: 'スコア ', ruleAfter: ' 点以下なら声をかけない', threshold: 3
    },
    thoughts: [
      '「部長の機嫌」。……業務システムとして作ります。',
      '観測できる項目に重みを付けて、点数にします。',
      '閾値を下回ったときの行動を決めておきます。3点にします。'
    ],
    notices: [
      '機嫌が悪いときでも、止められない用件はありますね。',
      '代わりに話す人を決めておきました。急ぎはその人へ回します。'
    ],
    app: {
      title: '機嫌モニタ',
      fields: [
        { label: '対象', value: '設備部 部長' },
        { label: '観測日', value: '2026年8月26日' }
      ],
      cols: ['観測項目', '値', '重み', '点'],
      rows: [
        { name: '朝の挨拶の声量', qty: 2, price: 2 },
        { name: 'コーヒーの残量', qty: 1, price: 1 },
        { name: '本日の会議数',   qty: 5, price: -1 }
      ],
      rowValue: function (r) { return r.qty * r.price; },
      totalLabel: '機嫌スコア',
      fmt: function (n) { return (Math.round(n * 10) / 10) + ' 点'; },
      over: function (t, th) { return t <= th; },
      onText:  function (t, th) { return t + '点 → ' + th + '点以下。今日は話しかけないでください'; },
      offText: function (t, th) { return t + '点 → ' + th + '点より上。話しかけて大丈夫です'; },
      ruleSrc: '仕様のルール',
      action: '判定を出す',
      doneOn:  '「今日はやめておきましょう」と判定しました。',
      doneOff: '「大丈夫です」と判定しました。',
      extra: {
        log: '代理で話す人',
        field: { label: '代理で話す人', value: '設備部 次長' },
        note: '止められない用件は、この人へ回します。',
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
    key: 'screens',
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
    key: 'approval',
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
    key: 'threshold',
    q: '部長承認に上げる金額は？',
    opts: [
      { label: '100万円', v: 1000000 },
      { label: '500万円', v: 5000000,
        miss: '500万円は高すぎます。100〜500万円の案件が全部課長止まりになり、部長が把握できません。' },
      { label: '決めない', v: 0,
        miss: '閾値を決めないと、誰に上げるかを毎回人が判断します。判断のばらつきが残ります。' }
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
  state.auto = !!opts.auto;
  state.challenge = !!opts.challenge;
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
    if (state.challenge) showScore();
    else finishRun(subject);
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

/* ---------- 下段: 締めと選択 ---------- */

function finishRun(subject) {
  const secs = Math.round((performance.now() - (state.auto ? 0 : state.t0)) / 100) / 10;

  const head = state.skipped
    ? '飛ばしましたが、<strong>順序は同じ</strong>です。'
    : (state.auto
        ? '頼まれる前に、勝手に作りました。<strong>' + secs + ' 秒</strong>。'
        : '<strong>' + secs + ' 秒</strong>で出てきました。');

  // ここが体験の中心。左のルールを書き換えられることを必ず伝える。
  const sub = subject.joke
    ? '　冗談のような題材でも、工程は業務システムと同じです。' +
      '<b>左のルールの数値を書き換えてください。</b>右の判定がその場で変わります。'
    : '　<b>左のルールの数値を書き換えてください。</b>右の判定がその場で変わります。' +
      '決めるのは人、作るのは AI です。';

  closeEl.innerHTML = head + '<span class="sub">' + sub + '</span>';

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

  // 腕試し: 訪問者が仕様を決める側になる
  const ch = el('button', 'choice challenge');
  ch.type = 'button';
  ch.setAttribute('role', 'option');
  ch.innerHTML = '<span class="caret">▸</span><span>仕様を自分で決める</span>';
  ch.addEventListener('click', function () { state.sel = SUBJECTS.length + 1; paint(list); startChallenge(); });
  list.appendChild(ch);

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

/* -----------------------------------------------------------
   腕試しモード
   ----------------------------------------------------------- */

function startChallenge() {
  state.phase = 'challenge';
  state.cstep = 0;
  state.answers = {};
  state.picked = {};
  state.misses = [];

  genEl.innerHTML = '';
  appEl.innerHTML = '';
  appEl.appendChild(el('div', 'await', 'あなたの仕様を待っています'));
  closeEl.innerHTML = '仕様を決めてください。<span class="sub">' +
    '　決めたとおりに作ります。決めなかったことは、作られません。</span>';

  const head = el('div', 'step');
  head.innerHTML = '<div class="step-head"><span class="label">[あなたの仕様]</span>' +
                   '<span class="pct" data-cpct>0 / ' + CHALLENGE.length + '</span></div>' +
                   '<div class="bar" data-cbar></div>';
  genEl.appendChild(head);
  genEl.appendChild(el('dl', 'spec myspec'));

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
  const dl = genEl.querySelector('.myspec');
  dl.innerHTML += '<dt>' + esc(step.q.replace(/[はをか？]/g, '').slice(0, 8)) + '</dt><dd>' +
                  chosen.map(function (o) {
                    return '<span class="tag">' + esc(o.label) + '</span>';
                  }).join('') + '</dd>';

  state.cstep++;
  state.picked = {};

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

  const custom = Object.assign({}, base);
  custom.fromChallenge = true;
  custom.spec = Object.assign({}, base.spec, {
    screens: ans.screens,
    threshold: ans.threshold[0] || base.spec.threshold
  });
  custom.thoughts = [
    'あなたが決めた仕様を読みます。画面 ' + ans.screens.length + ' つ、承認 ' +
      ans.approval[0] + ' 段。',
    '書かれていることは、そのまま作ります。',
    n === 0 ? '……漏れは見つかりませんでした。お見事です。'
            : '……書かれていないことが ' + n + ' つあります。あとで指摘します。'
  ];
  custom.notices = n === 0
    ? ['漏れがないので、足すものはありません。', 'この状態で運用に入れます。']
    : ['まず、決められたとおりに作りました。ここまでは仕様どおりです。',
       'そのうえで ' + n + ' つ、運用で詰まる箇所があります。下に出します。'];

  custom.app = Object.assign({}, base.app);
  if (ans.approval[0] < 2) {
    custom.app = Object.assign({}, base.app, { extra: base.app.extra });
  } else {
    // 2段承認を選んだ人には、代理承認を勝手に足さない（もう考慮済みだから）
    custom.app = Object.assign({}, base.app, {
      extra: {
        log: '承認の並び順',
        field: { label: '2段目の承認者', value: '設備部 部長' },
        note: '2段にしたので、2段目の承認者欄を用意しました。',
        src: 'あなたの仕様どおり'
      }
    });
  }

  start(custom, { fast: false, challenge: true });
}

/* 採点結果 */
function showScore() {
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

start(SUBJECTS[0], { fast: true, auto: true });
