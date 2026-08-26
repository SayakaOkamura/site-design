/* =========================================================
   002 Alter Design Consulting — terminal
   ブートシーケンス → REPL。マウス不要、キーボードのみで完結。
   依存なし。素の DOM。
   ========================================================= */
'use strict';

const screenEl = document.getElementById('screen');
const promptEl = document.getElementById('prompt');
const echoEl   = document.getElementById('inputEcho');
const cursorEl = document.getElementById('cursor');
const statusEl = document.getElementById('statusbar');
const hintEl   = document.getElementById('hintmsg');
const chipsEl  = document.getElementById('chips');

let booting = true;      // true の間はキー入力をブート操作としてのみ扱う
let bootFinishing = false;
let buf = '';
let history = [];
let histIdx = -1;

/* ---------- 出力ヘルパ ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function out(html, cls) {
  const d = document.createElement('div');
  d.className = 'line' + (cls ? ' ' + cls : '');
  d.innerHTML = html;
  screenEl.appendChild(d);
  return d;
}

function gap() {
  const d = document.createElement('div');
  d.className = 'gap';
  screenEl.appendChild(d);
}

function scrollDown() {
  screenEl.scrollTop = screenEl.scrollHeight;
}

function rule(w) {
  return '<div class="rule">' + '─'.repeat(w || 46) + '</div>';
}

/* ---------- コンテンツ ---------- */

const LOGO = [
  '┌─┐ ┬   ┌┬┐ ┌─┐ ┬─┐   ┌┬┐ ┌─┐ ┌─┐ ┬ ┌─┐ ┌┐┌',
  '├─┤ │    │  ├─  ├┬┘    ││ ├─  └─┐ │ │ ┬ │││',
  '┴ ┴ ┴─┘  ┴  └─┘ ┴└─   ─┴┘ └─┘ └─┘ ┴ └─┘ ┘└┘'
].join('\n');

const BOOT = [
  ['0.000000', 'alter-design init', null],
  ['0.128341', 'loading philosophy', 'OK'],
  ['0.402118', 'mounting /services (4 units)', 'OK'],
  ['0.661904', 'linking AI x low-code runtime', 'OK'],
  ['0.883902', 'shareholders: 4 registered', 'OK'],
  ['1.104773', 'upstream-first pipeline', 'OK'],
  ['1.204471', 'all systems nominal.', null]
];

const SERVICES = [
  {
    id: '01',
    slug: '01_lowcode-dev',
    name: '次世代型業務システム開発',
    lead: 'ノーコード／ローコードを土台に、「使う人」を中心に据えて業務を再設計する。',
    body: [
      '既存の業務手順をそのままシステムに写すのではなく、使う人の手の動きから逆算して',
      '業務そのものを組み替える。直感的に触れて、作り手の創造性が湧いてくる状態を目指す。'
    ]
  },
  {
    id: '02',
    slug: '02_ai-decision',
    name: 'AIによる意思決定支援・事業変革',
    lead: '企業に眠るデータ資産を、戦略と予測に変換する。',
    body: [
      '蓄積されたデータを意思決定の材料として使える形に整え、経営の判断速度を上げる。',
      '分析のための分析ではなく、次の一手が決まるところまでを支援の範囲とする。'
    ]
  },
  {
    id: '03',
    slug: '03_org-design',
    name: '自律共創型の組織デザイン',
    lead: 'フラットで柔軟な構造の中で、個の自律とチームの協働を両立させる。',
    body: [
      '権限は与えるものではなく、委ねるもの。指示で動く組織から、自分で決めて動く組織へ。',
      '「遊ぶように働く」状態は、組織の形が変わらないと生まれない。'
    ]
  },
  {
    id: '04',
    slug: '04_regional-dx',
    name: '地域のデジタル格差支援',
    lead: '都市に集中したデジタルの機会を、全国へ開く。',
    body: [
      'ノーコードツールとクラウドAIの導入、そしてDX人材の育成を通じて、',
      '地域の企業と自治体が自力で作れる状態をつくる。'
    ]
  }
];

const COMPANY = [
  ['name',     '株式会社アルターデザインコンサルティング'],
  ['name_en',  'Alter Design Consulting Co., Ltd.'],
  ['founded',  '2025-06'],
  ['capital',  '60,000,000 JPY'],
  ['ceo',      '松岡真功'],
  ['address',  '東京都港区西新橋3-23-5 ANYZ304'],
  ['business', 'AI技術を活用した組織最適化コンサルティング / AI × ローコードの次世代型システム開発']
];

const SHAREHOLDERS = [
  '株式会社BlueMeme',
  '株式会社ハイ・アベイラビリティ・システムズ',
  '株式会社サーバーワークス・キャピタル',
  'リックソフト株式会社'
];

const EXPERIMENTS = [
  ['上流の設計を、そのまま動くものにする', '仕様書を書いてから実装する、という順序自体を疑っている。'],
  ['AIに実装を任せたときの品質保証', '生成されたコードを、人間はどこまで信じてよいのか。'],
  ['受入基準から先に書く開発', '何を満たせば完成なのかを、コードより先に決める。'],
  ['組織図のない組織運営', '役職ではなく、その時の適任で動く。'],
  ['このサイト自体', 'コーポレートサイトは、そもそもマウスを必要とするのか。']
];

/* ---------- コマンド定義 ---------- */

const COMMANDS = {};

function def(name, desc, run, opts) {
  COMMANDS[name] = { name: name, desc: desc, run: run, hidden: !!(opts && opts.hidden) };
}

def('help', 'コマンド一覧', function () {
  out('<span class="h">使えるコマンド</span>');
  gap();
  const rows = Object.keys(COMMANDS).map(function (k) { return COMMANDS[k]; })
    .filter(function (c) { return !c.hidden; });
  let html = '<dl class="kv">';
  rows.forEach(function (c) {
    html += '<dt class="amber">' + esc(c.name) + '</dt><dd>' + esc(c.desc) + '</dd>';
  });
  html += '</dl>';
  out(html);
  gap();
  out('<div class="dimmer" style="padding-left:2ch">Tab で補完、↑↓ で履歴。迷ったら tree。</div>');
});

def('whoami', '何者か', function () {
  out('<div class="body-jp b">株式会社アルターデザインコンサルティング</div>');
  out('<div class="dim" style="padding-left:2ch">Alter Design Consulting Co., Ltd.</div>');
  gap();
  out('<div class="glow jp" style="padding-left:2ch">AI × ローコードで、</div>');
  out('<div class="glow jp" style="padding-left:2ch">「上流工程中心のシステム開発」に革新を</div>');
  gap();
  out('<div class="body-jp dim">コンサルティングによる業務設計から、エンジニアリングまでを行う。</div>');
});

def('philosophy', '企業理念', function () {
  out('<span class="h">企業理念</span>');
  gap();
  out('<div class="glow jp" style="padding-left:2ch;font-size:1.15em">経営の力で</div>');
  out('<div class="glow jp" style="padding-left:2ch;font-size:1.15em">「遊ぶように働く世界」をデザインする</div>');
  gap();
  out('<div class="body-jp">やらされる仕事ではなく、自ら作りにいく仕事へ。' +
      '創造の力と経営の意思をつなぎ、働くことが遊びに近づく状態を設計する。</div>');
});

function showService(key) {
  const k = String(key).replace(/\/+$/, '');
  const s = SERVICES.filter(function (x) {
    return x.id === k || x.slug === k || x.slug.indexOf(k) === 0;
  })[0];
  if (!s) {
    out('<span class="err">services: ' + esc(key) + ': そのようなサービスはありません</span>');
    out('<div class="dimmer">services で一覧</div>');
    return;
  }
  out('<span class="h">' + s.id + ' — ' + esc(s.name) + '</span>');
  gap();
  out('<div class="body-jp">' + esc(s.lead) + '</div>');
  gap();
  // 原文の改行位置ではなく、幅にあわせて自然に折り返させる
  out('<div class="body-jp dim">' + esc(s.body.join('')) + '</div>');
}

def('services', 'サービス（4件）', function (argv) {
  if (argv && argv[1]) { showService(argv[1]); return; }
  out('<span class="h">services/</span>');
  gap();
  let html = '<dl class="kv">';
  SERVICES.forEach(function (s) {
    html += '<dt class="amber">' + s.slug + '</dt><dd>' + esc(s.name) + '</dd>';
  });
  html += '</dl>';
  out(html);
  gap();
  out('<div class="dimmer" style="padding-left:2ch">services 01 で詳細（01〜04）</div>');
});

def('company', '会社概要', function () {
  out('<span class="h">company.json</span>');
  gap();
  let html = '<div class="json"><span class="p">{</span>\n';
  COMPANY.forEach(function (row, i) {
    const comma = i < COMPANY.length - 1 ? '<span class="p">,</span>' : '';
    html += '  <span class="k">"' + row[0] + '"</span><span class="p">: </span>' +
            '<span class="s">"' + esc(row[1]) + '"</span>' + comma + '\n';
  });
  html += '<span class="p">}</span></div>';
  out(html);
  gap();
  out('<div class="dimmer" style="padding-left:2ch">株主は shareholders</div>');
});

def('shareholders', '株主', function () {
  out('<span class="h">株主</span>');
  gap();
  SHAREHOLDERS.forEach(function (s) {
    out('<div class="body-jp"><span class="amber">▸</span> ' + esc(s) + '</div>');
  });
  gap();
  out('<div class="body-jp dim">4社の出資により、2025年6月に設立。</div>');
});

def('why', 'なぜこのサイトなのか', function () {
  out('<span class="h">なぜターミナルなのか</span>');
  gap();
  out('<div class="body-jp">企業理念に「遊ぶように働く世界をデザインする」と書いてある。' +
      'ならばサイトも遊んでいるべきだと考えた。</div>');
  gap();
  const pts = [
    ['マウスを使わない', '手を動かした分だけ情報が返る。読ませるのではなく、触らせる。'],
    ['何が出るか分からない', '探索の余地を残した。全部を最初に見せない。'],
    ['HTML / CSS / JS だけ', 'フレームワークなし、ビルドなし。上流で決めた形が、そのまま動く。']
  ];
  pts.forEach(function (p) {
    out('<div class="body-jp"><span class="amber">▸ ' + esc(p[0]) + '</span></div>');
    out('<div class="body-jp dim" style="padding-left:4ch">' + esc(p[1]) + '</div>');
  });
  gap();
  out('<div class="body-jp">これは提案であって、正解ではない。試して、面白くなければ捨ててほしい。</div>');
});

def('experiment', 'いま試していること', function () {
  const e = EXPERIMENTS[Math.floor(Math.random() * EXPERIMENTS.length)];
  out('<span class="h">実験中</span>');
  gap();
  out('<div class="body-jp"><span class="amber">▸</span> ' + esc(e[0]) + '</div>');
  out('<div class="body-jp dim" style="padding-left:4ch">' + esc(e[1]) + '</div>');
  gap();
  out('<div class="dimmer" style="padding-left:2ch">もう一度 experiment で別のものが出る（全' +
      EXPERIMENTS.length + '件）</div>');
});

def('play', '「遊ぶように働く」を実演', function () {
  out('<span class="h">遊ぶように働く、とは</span>');
  gap();
  // 全角と罫線は等幅で揃わないので、囲み線は使わず 1 行の流れで循環を示す
  const steps = ['仕様', 'AI', 'ローコード', '<span class="n">動くもの</span>', '気づき', 'また仕様へ'];
  const holder = out('<div class="flow"></div>');
  const target = holder.querySelector('.flow');
  let i = 1;
  const tick = function () {
    target.innerHTML = steps.slice(0, i).join(' ─▸ ');
    scrollDown();
    if (++i <= steps.length) { setTimeout(tick, 400); return; }

    gap();
    out('<div class="body-jp">作って、動かして、直す。この一周が短いほど、仕事は遊びに近づく。</div>');
    gap();
    out('<div class="dimmer" style="padding-left:2ch">一周を短くするのが、上流工程中心の開発。</div>');
    scrollDown();
  };
  tick();
});

def('tree', '全体を俯瞰', function () {
  const t = [
    '.',
    '├── philosophy        経営の力で「遊ぶように働く世界」をデザインする',
    '├── services/',
    '│   ├── 01_lowcode-dev    次世代型業務システム開発',
    '│   ├── 02_ai-decision    AIによる意思決定支援・事業変革',
    '│   ├── 03_org-design     自律共創型の組織デザイン',
    '│   └── 04_regional-dx    地域のデジタル格差支援',
    '├── company.json      2025年6月設立 / 資本金6,000万円 / 代表 松岡真功',
    '├── shareholders      BlueMeme 他3社',
    '├── why               なぜこのサイトなのか',
    '└── contact           問い合わせ'
  ];
  const d = out('', 'pre jp dim');
  d.textContent = t.join('\n');
});

def('contact', '問い合わせ', function () {
  out('<span class="h">お問い合わせ</span>');
  gap();
  out('<div class="body-jp">現行サイトのフォームから受け付けている。</div>');
  gap();
  out('<div style="padding-left:2ch"><a class="amber" href="https://alt-dsgn.co.jp/" ' +
      'target="_blank" rel="noopener">https://alt-dsgn.co.jp/</a></div>');
  gap();
  out('<div class="dimmer" style="padding-left:2ch">site と打つと新しいタブで開く</div>');
});

def('site', '現行サイトを開く', function () {
  out('<div class="dim">現行サイトを新しいタブで開く …</div>');
  window.open('https://alt-dsgn.co.jp/', '_blank', 'noopener');
});

def('clear', '画面を消す', function () {
  screenEl.innerHTML = '';
});

/* --- 以下は help に出さない隠しコマンド --- */

def('history', '入力履歴', function () {
  if (!history.length) { out('<div class="dim">まだ何も打っていない。</div>'); return; }
  let html = '';
  history.forEach(function (h, i) {
    html += '<div><span class="dimmer">' + String(i + 1) + '</span>  ' + esc(h) + '</div>';
  });
  out(html);
}, { hidden: true });

def('sudo', null, function () {
  out('<div class="body-jp"><span class="amber">sudo:</span> 権限は与えるものではなく、委ねるもの。</div>');
  out('<div class="dimmer" style="padding-left:2ch">→ services 03（自律共創型の組織デザイン）</div>');
}, { hidden: true });

def('exit', null, function () {
  out('<div class="body-jp">終わりはない。まだ試していないことが残っている。</div>');
  out('<div class="dimmer" style="padding-left:2ch">experiment で、いま試していることが出る。</div>');
}, { hidden: true });

def('ls', null, function (argv) {
  const a = (argv[1] || '').replace(/\/+$/, '');
  if (a === 'services') { COMMANDS.services.run(['services']); return; }
  const d = out('', 'pre');
  d.innerHTML = '<span class="amber">services/</span>  philosophy  company.json  shareholders  why  contact';
}, { hidden: true });

def('cat', null, function (argv) {
  const a = (argv[1] || '').replace(/\/+$/, '');
  if (!a) { out('<span class="err">cat: ファイル名が必要</span>'); return; }
  if (a.indexOf('philosophy') === 0) { COMMANDS.philosophy.run([]); return; }
  if (a.indexOf('company') === 0) { COMMANDS.company.run([]); return; }
  if (a.indexOf('services/') === 0) { showService(a.slice(9)); return; }
  out('<span class="err">cat: ' + esc(a) + ': そのようなファイルはありません</span>');
  out('<div class="dimmer">tree で全体が見える</div>');
}, { hidden: true });

/* 補完候補：コマンド名＋よく使う組み合わせ */
const COMPLETIONS = Object.keys(COMMANDS).concat([
  'services 01', 'services 02', 'services 03', 'services 04',
  'cat philosophy', 'cat company.json', 'ls services/'
]);

/* ---------- 実行 ---------- */

function echoLine(text) {
  const d = out('<span class="echo"><span class="ps1">alter-design:~$</span> <span class="cmd"></span></span>');
  d.querySelector('.cmd').textContent = text;
}

function run(raw) {
  const cmd = String(raw).trim();
  echoLine(cmd);
  if (!cmd) { scrollDown(); return; }

  history.push(cmd);
  histIdx = history.length;

  const argv = cmd.split(/\s+/);
  const name = argv[0].toLowerCase();
  gap();

  if (name === '?') {
    COMMANDS.help.run(argv);
  } else if (COMMANDS[name]) {
    COMMANDS[name].run(argv);
  } else {
    out('<span class="err">' + esc(name) + ': command not found</span>');
    out('<div class="body-jp dim">まだ実装していない。可能性としては存在する。</div>');
    out('<div class="dimmer" style="padding-left:2ch">help でコマンド一覧</div>');
  }
  gap();
  scrollDown();
}

/* ---------- 入力 ---------- */

function render() {
  echoEl.textContent = buf;
  scrollDown();
}

function complete() {
  if (!buf) return;
  const hits = COMPLETIONS.filter(function (c) { return c.indexOf(buf) === 0; });
  if (!hits.length) return;
  if (hits.length === 1) { buf = hits[0] + ' '; render(); return; }

  let pre = hits[0];
  hits.forEach(function (h) {
    let i = 0;
    while (i < pre.length && i < h.length && pre[i] === h[i]) i++;
    pre = pre.slice(0, i);
  });
  if (pre.length > buf.length) { buf = pre; render(); return; }

  echoLine(buf);
  const d = out('', 'dim');
  d.textContent = hits.join('   ');
  gap();
  scrollDown();
}

function onKey(e) {
  if (e.isComposing) return;

  if (booting) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      finishBoot(true);
    }
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 'l') { e.preventDefault(); screenEl.innerHTML = ''; return; }
    if (k === 'c') { e.preventDefault(); echoLine(buf + '^C'); buf = ''; render(); return; }
    if (k === 'u') { e.preventDefault(); buf = ''; render(); return; }
    return;
  }

  switch (e.key) {
    case 'Enter': {
      e.preventDefault();
      const c = buf;
      buf = '';
      render();
      run(c);
      return;
    }
    case 'Backspace':
      e.preventDefault();
      buf = buf.slice(0, -1);
      render();
      return;
    case 'Tab':
      e.preventDefault();
      complete();
      return;
    case 'ArrowUp':
      e.preventDefault();
      if (histIdx > 0) { histIdx--; buf = history[histIdx]; render(); }
      return;
    case 'ArrowDown':
      e.preventDefault();
      if (histIdx < history.length - 1) { histIdx++; buf = history[histIdx]; render(); }
      else { histIdx = history.length; buf = ''; render(); }
      return;
    case 'PageUp':
      screenEl.scrollTop -= screenEl.clientHeight * 0.8;
      return;
    case 'PageDown':
      screenEl.scrollTop += screenEl.clientHeight * 0.8;
      return;
    case 'Escape':
      buf = '';
      render();
      return;
  }

  if (e.key === '?' && buf === '') { e.preventDefault(); run('help'); return; }

  if (e.key.length === 1) {
    buf += e.key;
    render();
    if (hintEl.dataset.used !== '1') {
      hintEl.dataset.used = '1';
      hintEl.textContent = 'Enter で実行';
    }
  }
}

/* ---------- ブートシーケンス ---------- */

let bootTimer = null;
let bootStep = 0;

function bootLine(row) {
  const t = row[0], msg = row[1], ok = row[2];
  const d = out('', 'boot pre');
  let html = '<span class="t">[' + ('           ' + t).slice(-11) + ']</span> ' + esc(msg);
  if (ok) {
    const pad = Math.max(2, 44 - msg.length);
    html += ' ' + new Array(pad + 1).join('.') + ' <span class="ok">' + ok + '</span>';
  }
  d.innerHTML = html;
  scrollDown();
}

function startBoot() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stepMs  = reduce ? 30 : 185;
  const delayMs = reduce ? 30 : 300;

  out('<div class="dimmer">alter-design boot loader v1.0.0 — press ESC to skip</div>');
  gap();

  // setTimeout はバックグラウンドタブで 1 秒間隔まで間引かれ、ブートが
  // 途中で止まって見える。経過時間から「本来出ているべき行数」を計算し、
  // requestAnimationFrame で追いつかせる（タブに戻ると一気に揃う）。
  let t0 = null;
  const frame = function (ts) {
    if (!booting) return;
    if (t0 === null) t0 = ts;
    const want = Math.floor((ts - t0 - delayMs) / stepMs) + 1;
    while (bootStep < BOOT.length && bootStep < want) bootLine(BOOT[bootStep++]);
    if (bootStep >= BOOT.length) { finishBoot(false); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function finishBoot(skipped) {
  if (!booting || bootFinishing) return;
  bootFinishing = true;
  clearTimeout(bootTimer);

  if (skipped) {
    while (bootStep < BOOT.length) bootLine(BOOT[bootStep++]);
  }

  // ブートログを読ませる間を取ってから、画面を入れ替えて表題を出す。
  // 起動が終わってプロンプトが出る、という筋を保ちつつ 1 画面に収める。
  setTimeout(reveal, skipped ? 140 : 480);
}

function reveal() {
  // ここで初めて入力を受け付ける。これより前に打たれた文字は
  // 直後の画面クリアで消えてしまうため、受け取らない。
  booting = false;

  screenEl.innerHTML = '';
  gap();

  const logo = out('', 'logo');
  logo.textContent = LOGO;
  gap();

  out('<div class="dim jp" style="padding-left:2ch">株式会社アルターデザインコンサルティング</div>');
  out('<div class="dimmer" style="padding-left:2ch">Alter Design Consulting Co., Ltd.</div>');
  gap();

  out('<div class="glow jp" style="padding-left:2ch;font-size:1.1em">経営の力で「遊ぶように働く世界」をデザインする</div>');
  out('<div class="dim jp" style="padding-left:2ch">AI × ローコードで、「上流工程中心のシステム開発」に革新を</div>');
  gap();

  out(rule(46));
  gap();
  out('<div class="dim" style="padding-left:2ch">' +
      '<span class="amber">help</span> でコマンド一覧。' +
      '<span class="amber">why</span> でこのサイトの意図。</div>');
  gap();

  promptEl.hidden = false;
  statusEl.hidden = false;
  render();

  if (window.matchMedia('(hover: none)').matches) showChips();
}

function showChips() {
  const names = ['whoami', 'philosophy', 'services', 'why', 'experiment', 'play',
                 'company', 'shareholders', 'contact', 'clear'];
  chipsEl.hidden = false;
  names.forEach(function (n) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = n;
    b.addEventListener('click', function () { run(n); });
    chipsEl.appendChild(b);
  });
  hintEl.textContent = 'キーボードがあれば直接打てます';
}

/* ---------- 起動 ---------- */

document.addEventListener('keydown', onKey);
startBoot();
