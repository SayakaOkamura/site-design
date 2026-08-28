/* =========================================================
   006-A ほんとうに動く

   一行 → 画面が立ち上がる → 入力できる → 保存される → 一覧に出る
        → 承認が回る → 開き直しても残っている

   005 の extract() を土台にしているが、目的が違う。
   005 は「決めていないところ」を出すためのもの。
   ここは「本当に動く画面」を組むためのもので、欄に型が要る。
   ========================================================= */

const $ = function(id){ return document.getElementById(id); };

/* ---------------------------------------------------------
   何の話か（対象語）
   --------------------------------------------------------- */
const STOP = ('申請 承認 決裁 許可 登録 入力 記録 保存 一覧 検索 閲覧 集計 分析 通知 連絡 管理 確認 '
  + '提出 届出 作成 報告 共有 削除 修正 変更 設定 対応 処理 実施 発行 送信 受付 '
  + '上長 上司 部長 課長 社長 役員 担当 担当者 本人 社員 従業員 '
  + '金額 予算 費用 期限 締切 必要 以上 以下 場合 自動 手動 '
  + '機能 業務 仕組 システム データ 情報 内容 状態 結果 '
  + 'とき こと もの ため よう').split(/\s+/);

function subject(text){
  const cand = text.match(/[一-龥ァ-ヴー][一-龥ァ-ヴーA-Za-z0-9]{1,7}/g) || [];
  for (let i = 0; i < cand.length; i++){
    if (STOP.indexOf(cand[i]) < 0) return cand[i];
  }
  return 'この業務';
}

/* ---------------------------------------------------------
   欄には型が要る。絵ではなく、本当に入力させるため。
   t: text / num / date / area / sel
   --------------------------------------------------------- */
const ACTIONS = [
  { f:'apply',  k:['申請','届出','提出','願い'],
    fl:[['申請者','text','あなた'], ['申請日','date','today']] },
  { f:'approve',k:['承認','決裁','許可','上長','上司','部長','課長'],
    fl:[['承認者','text','所属長']] },
  { f:'record', k:['登録','入力','記録','管理','保存'],
    fl:[['{o}名','text',''], ['登録日','date','today']] },
  { f:'report', k:['集計','レポート','分析','可視化','見える化','グラフ'],
    fl:[['集計期間','sel','今月|先月|今期']] },
  { f:'money',  k:['金額','円','予算','費用','コスト','単価','経費'],
    fl:[['金額','num','']] },
  { f:'due',    k:['期限','締切','月末','以内','までに','遅れ'],
    fl:[['期限','date','today']] },
  { f:'stock',  k:['在庫','発注','仕入','納品','入荷','出荷'],
    fl:[['数量','num','']] },
  { f:'book',   k:['予約','貸出','貸し','空き','割り当て','アサイン'],
    fl:[['日時','date','today'], ['{o}','sel','A|B|C']] },
  { f:'time',   k:['勤怠','出勤','退勤','休暇','有給','残業','工数'],
    fl:[['日付','date','today'], ['時間','num','']] },
  { f:'crm',    k:['顧客','案件','商談','取引先','見込'],
    fl:[['会社名','text',''], ['担当','text','']] },
  { f:'bill',   k:['請求','見積','入金','支払','領収'],
    fl:[['宛先','text',''], ['金額','num','']] },
  { f:'assign', k:['割り振','振り分','担当を','アサイン','引き継'],
    fl:[['担当','text','']] },
  { f:'note',   k:['問い合わせ','要望','意見','相談','質問','ヒヤリ','報告'],
    fl:[['内容','area','']] }
];

const SUFFIX = [['apply','申請','申請する'], ['book','予約','予約する'],
                ['bill','請求','発行する'], ['report','集計','集計する'],
                ['time','入力','登録する'], ['stock','管理','登録する'],
                ['crm','管理','登録する'], ['record','登録','登録する']];

function extract(text){
  const o = subject(text);
  const flags = {};
  ACTIONS.forEach(function(a){
    if (a.k.some(function(w){ return text.indexOf(w) >= 0; })) flags[a.f] = true;
  });

  const seen = {}, fields = [];
  ACTIONS.forEach(function(a){
    if (!flags[a.f]) return;
    a.fl.forEach(function(x){
      const label = x[0].replace('{o}', o);
      if (seen[label]) return;
      seen[label] = 1;
      fields.push({ label:label, type:x[1], def:x[2] });
    });
  });
  if (!fields.length) fields.push({ label:'内容', type:'area', def:'' });

  let suffix = '', verb = '登録する';
  for (let i = 0; i < SUFFIX.length; i++){
    if (!flags[SUFFIX[i][0]]) continue;
    suffix = o.indexOf(SUFFIX[i][1]) >= 0 ? '' : SUFFIX[i][1];
    verb = SUFFIX[i][2];
    break;
  }

  return { o:o, title:o + suffix, verb:verb,
           needApprove: !!flags.approve,
           fields: fields.slice(0, 6) };
}

/* =========================================================
   保存。ここが 005 との差。絵ではなく、本当に残る。
   ========================================================= */
const KEY = 'ad006a';

function load(){
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
  catch (e){ return null; }
}
function save(db){
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e){}
}

let db = null;   // { line, plan, rows:[] }

/* =========================================================
   段1
   ========================================================= */
const EGS = [
  '経費を申請して、金額によって上長が承認する',
  '会議室を予約して、空きを見られるようにしたい',
  '取引先への請求を発行して、入金を消し込む',
  '社員の残業時間を記録して、月ごとに集計する'
];

(function buildEgs(){
  EGS.forEach(function(t){
    const li = document.createElement('li');
    const b  = document.createElement('button');
    b.type = 'button';
    b.textContent = t;
    b.onclick = function(){ $('in').value = t; $('in').focus(); };
    li.appendChild(b);
    $('egs').appendChild(li);
  });
})();

function start(line){
  const t0 = performance.now();
  db = { line:line, plan:extract(line), rows:[] };
  save(db);
  buildApp(t0);
}

$('go').onclick = function(){
  const t = $('in').value.trim() || EGS[0];
  $('in').value = t;
  start(t);
};
$('in').addEventListener('keydown', function(e){
  if (e.key === 'Enter'){ e.preventDefault(); $('go').click(); }
});

/* =========================================================
   段2：画面を組む。組んだ瞬間から使える。
   ========================================================= */
function buildApp(t0){
  const p = db.plan;
  $('appTitle').textContent = p.title;
  $('from').textContent = '「' + db.line + '」から';
  $('formHead').textContent = p.needApprove ? '申請' : '登録';
  $('submit').textContent = p.verb;

  // 入力欄。ここは本物。type を持たせて、実際に打てるようにする。
  const box = $('fields');
  box.innerHTML = '';
  p.fields.forEach(function(f, i){
    const wrap = document.createElement('label');
    wrap.className = 'f';
    wrap.style.animationDelay = (i * 0.05) + 's';

    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = f.label;

    let el;
    if (f.type === 'area'){
      el = document.createElement('textarea');
      el.rows = 3;
    } else if (f.type === 'sel'){
      el = document.createElement('select');
      f.def.split('|').forEach(function(v){
        const op = document.createElement('option');
        op.value = op.textContent = v;
        el.appendChild(op);
      });
    } else {
      el = document.createElement('input');
      el.type = f.type === 'num' ? 'number' : (f.type === 'date' ? 'date' : 'text');
      if (f.type === 'date' && f.def === 'today') el.value = today();
      else if (f.type !== 'num') el.value = f.def;
      if (f.type === 'num') el.placeholder = '0';
    }
    el.name = f.label;
    el.dataset.type = f.type;

    wrap.appendChild(k);
    wrap.appendChild(el);
    box.appendChild(wrap);
  });

  // 何秒で立ち上がったか。ここは言葉ではなく数字で出す。
  const ms = Math.max(1, Math.round(performance.now() - t0));
  $('built').textContent = ms + ' ms で組みました';

  render();
  go2();
  setTimeout(function(){
    const first = $('fields').querySelector('input,select,textarea');
    if (first) first.focus();
  }, 380);
}

function today(){
  const d = new Date();
  const p = function(n){ return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function go2(){
  $('s1').classList.remove('on');
  $('s2').classList.add('on');
  $('reset').hidden = false;
}

/* =========================================================
   登録。本当に保存する。
   ========================================================= */
$('form').addEventListener('submit', function(e){
  e.preventDefault();
  const rec = { id: (db.rows.length ? db.rows[0].id : 0) + 1, v:{} };
  let empty = true;
  $('fields').querySelectorAll('input,select,textarea').forEach(function(el){
    rec.v[el.name] = el.value;
    if (el.value !== '') empty = false;
  });
  if (empty){ say('何か入れてください。'); return; }

  rec.state = db.plan.needApprove ? '承認待ち' : '登録済';
  db.rows.unshift(rec);          // 新しいものが上
  save(db);
  render(rec.id);
  say('保存しました。');

  // 次を打てる状態に戻す。数量・金額・自由記述だけ空にする。
  $('fields').querySelectorAll('input,select,textarea').forEach(function(el){
    if (el.dataset.type === 'num' || el.dataset.type === 'area') el.value = '';
    else if (el.dataset.type === 'text' && el.value === '') el.value = '';
  });
  const first = $('fields').querySelector('input,select,textarea');
  if (first) first.focus();
});

function say(t){
  $('said').textContent = t;
  setTimeout(function(){ if ($('said').textContent === t) $('said').textContent = ''; }, 2200);
}

/* =========================================================
   一覧。承認が要るものは、ここで回る。
   ========================================================= */
function render(flashId){
  const p = db.plan;
  const cols = p.fields.map(function(f){ return f.label; });

  $('thead').innerHTML = '<tr>'
    + '<th class="no">#</th>'
    + cols.map(function(c){ return '<th>' + esc(c) + '</th>'; }).join('')
    + '<th class="st">状態</th></tr>';

  $('tbody').innerHTML = db.rows.map(function(r){
    return '<tr' + (r.id === flashId ? ' class="flash"' : '') + '>'
      + '<td class="no">' + r.id + '</td>'
      + cols.map(function(c){ return '<td>' + esc(r.v[c] || '—') + '</td>'; }).join('')
      + '<td class="st">' + stateCell(r) + '</td>'
      + '</tr>';
  }).join('');

  $('count').textContent = db.rows.length;
  $('empty').hidden = db.rows.length > 0;

  // 承認は、押せば本当に状態が変わる
  $('tbody').querySelectorAll('button[data-ok]').forEach(function(b){
    b.onclick = function(){
      const r = db.rows.find(function(x){ return x.id === +b.dataset.ok; });
      if (!r) return;
      r.state = '承認済';
      save(db);
      render(r.id);
    };
  });
}

function stateCell(r){
  if (r.state === '承認待ち')
    return '<span class="badge wait">承認待ち</span>'
         + '<button class="mini" data-ok="' + r.id + '">承認</button>';
  if (r.state === '承認済') return '<span class="badge ok">承認済</span>';
  return '<span class="badge ok">登録済</span>';
}

function esc(s){
  return String(s).replace(/[<>&"]/g, function(c){
    return { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;' }[c];
  });
}

/* =========================================================
   残っていることを、その場で確かめられるようにする。
   言葉で「保存されます」と書くより、閉じて開き直すほうが早い。
   ========================================================= */
$('reload').onclick = function(){ location.reload(); };

$('wipe').onclick = function(){
  db.rows = [];
  save(db);
  render();
};

$('reset').onclick = function(){
  try { localStorage.removeItem(KEY); } catch (e){}
  location.reload();
};

/* =========================================================
   開いたとき。前に作ったものがあれば、それがもう立ち上がっている。
   ========================================================= */
(function boot(){
  const saved = load();
  if (saved && saved.plan){
    db = saved;
    $('in').value = db.line;
    buildApp(performance.now());
    $('built').textContent = '前回のつづき';
  } else {
    $('in').focus();
  }
})();
