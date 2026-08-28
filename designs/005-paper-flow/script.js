/* =========================================================
   005 — 書く / 決める / 通す

   段1 白紙に書く
   段2 触れる画面が出てくる（ここでは穴を見せない）
   段3 稟議に出す → 決裁で止まる → 画面に空欄が現れる → 埋める → 通る

   言葉ではなく物を出す。穴も、言葉ではなく物の上に見せる。
   切り出しは規則による対応づけ。本物にするなら extract() だけを差し替える。
   ========================================================= */

const $ = function(id){ return document.getElementById(id); };

/* ---------------------------------------------------------
   何の話なのか（対象語）を拾う。形態素解析は使わず、見当をつけるだけ。
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

/* 書かれた語から、画面の中身を組み立てる。
   fl = 入力欄、rl = 業務ルール。{o} は対象語。
   本番はここを差し替える：
     const r = await fetch('/api/extract', {method:'POST', body: JSON.stringify({text})});
     return await r.json(); */
const ACTIONS = [
  { f:'apply',  k:['申請','届出','提出','出す','願い'],
    fl:[['申請者','あなた'], ['申請日','today']],
    rl:['出したものは記録に残る'] },
  { f:'approve',k:['承認','決裁','許可','上長','上司','部長','課長'],
    fl:[['承認者','所属長']],
    rl:['承認されるまで確定しない'] },
  { f:'record', k:['登録','入力','記録','管理','保存'],
    fl:[['{o}名',''], ['登録日','today']],
    rl:[] },
  { f:'list',   k:['一覧','検索','探す','閲覧','見る','見え'],
    fl:[],
    rl:['一覧から探せる'] },
  { f:'report', k:['集計','レポート','分析','可視化','見える化','グラフ'],
    fl:[['集計期間','今月']],
    rl:['期間で区切って集計する'] },
  { f:'notify', k:['通知','メール','知らせ','連絡','アラート','リマインド'],
    fl:[],
    rl:['関係者に通知を出す'] },
  { f:'money',  k:['金額','円','予算','費用','コスト','単価','経費'],
    fl:[['金額','3,000', '円']],
    rl:['金額によって承認者が変わる'] },
  { f:'due',    k:['期限','締切','月末','以内','までに','遅れ'],
    fl:[['期限','today']],
    rl:['期限を過ぎたものを分けて扱う'] },
  { f:'stock',  k:['在庫','発注','仕入','納品','入荷','出荷'],
    fl:[['数量','10', '個']],
    rl:['数が動いたら在庫に反映する'] },
  { f:'book',   k:['予約','貸出','貸し','空き','割り当て','アサイン'],
    fl:[['日時','today'], ['{o}','A']],
    rl:['空いているものだけ選べる'] },
  { f:'time',   k:['勤怠','出勤','退勤','休暇','有給','残業','工数'],
    fl:[['日付','today'], ['時間','2.0', '時間']],
    rl:[] },
  { f:'crm',    k:['顧客','案件','商談','取引先','見込'],
    fl:[['会社名',''], ['担当','']],
    rl:[] },
  { f:'bill',   k:['請求','見積','入金','支払','領収'],
    fl:[['宛先',''], ['金額','120,000', '円']],
    rl:['発行したものは番号で追える'] },
  { f:'assign', k:['割り振','振り分','担当を','アサイン','引き継'],
    fl:[['担当','']],
    rl:['担当者を決めて割り当てる'] }
];

/* 書かれなかったところ。
   t = 空欄の見出し（画面の上に出る問い）
   n = 書類に載る言葉（名詞句）
   a = 打合せで決まった答え
   by = それを持ち帰った部署。誰が決めたのかが分かると、AI が決めたことにならない */
const GAPS = [
  { when:function(f){ return f.approve; },
    t:'承認する人が不在のとき', n:'承認者が不在のときの扱い', a:'代理者に自動で回す', by:'総務' },
  { when:function(f){ return f.apply && !f.approve; },
    t:'これを承認する人', n:'承認の要否と、その相手', a:'所属長が承認する', by:'総務' },
  { when:function(f){ return f.money && f.approve; },
    t:'決裁が上に上がる金額', n:'決裁を分ける金額の基準', a:'5万円以上は部長決裁', by:'経理' },
  { when:function(f){ return f.money && !f.approve; },
    t:'本人の判断で通せる上限', n:'本人の判断で通せる上限', a:'1万円まで', by:'経理' },
  { when:function(f){ return f.money; },
    t:'金額を間違えたとき', n:'誤った金額の取り消し', a:'承認前なら取り消せる', by:'経理' },
  { when:function(f){ return f.stock || f.book; },
    t:'二人が同時に押さえたとき', n:'同時に取り合ったときの扱い', a:'先に押さえたほうが通る', by:'情シス' },
  { when:function(f){ return f.assign; },
    t:'担当が抜けたとき', n:'担当が抜けたときの引き継ぎ', a:'上長がいったん引き取る', by:'人事' },
  { when:function(f){ return f.bill; },
    t:'出したあとに金額が変わったとき', n:'発行後に金額が変わったときの扱い', a:'出し直して番号を繋ぐ', by:'経理' },
  { when:function(f){ return f.time; },
    t:'月をまたいだ分', n:'月をまたぐ分の帰属', a:'着手した月に入れる', by:'経理' },
  { when:function(f){ return f.report; },
    t:'数え方が分かれたとき', n:'集計の基準と、正とする値', a:'締め日の値を正とする', by:'経営企画' },
  { when:function(f){ return f.crm; },
    t:'取引先が変わったとき', n:'取引先が変わったときの名寄せ', a:'新しい会社に寄せる', by:'営業' },
  { when:function(f){ return f.list; },
    t:'他の部署から見えるか', n:'他部署からの閲覧範囲', a:'自分の部署の分だけ見える', by:'情シス' },
  { when:function(f){ return f.apply; },
    t:'出したあとの取り下げ', n:'提出後の取り下げ', a:'承認前なら取り下げられる', by:'総務' },
  { when:function(f){ return f.record; },
    t:'同じものが二度登録されたとき', n:'二重登録の扱い', a:'同じ名前なら警告を出す', by:'情シス' },
  { when:function(f){ return f.notify; },
    t:'通知が届く範囲', n:'通知を出す範囲', a:'関係者だけに送る', by:'情シス' },
  { when:function(f){ return !f.notify; },
    t:'終わったことの知らせ方', n:'完了の知らせ方', a:'申請者にだけ通知する', by:'総務' },
  { when:function(f){ return !f.due; },
    t:'いつまでにやるか', n:'期限と、遅れたときの扱い', a:'月末締め。遅れたら翌月扱い', by:'経理' },
  { when:function(){ return true; },
    t:'入力を間違えたとき', n:'入力の訂正', a:'確定前なら直せる', by:'情シス' },
  { when:function(){ return true; },
    t:'記録を残す期間', n:'記録の保存期間', a:'7年間残す', by:'法務' },
  { when:function(){ return true; },
    t:'これを見られる人', n:'閲覧できる人の範囲', a:'本人と承認者だけ', by:'情シス' }
];

function flagsOf(text){
  const f = {};
  ACTIONS.forEach(function(a){
    if (a.k.some(function(w){ return text.indexOf(w) >= 0; })) f[a.f] = true;
  });
  return f;
}

function extract(text){
  const o = subject(text);
  const flags = flagsOf(text);
  const seen = {};
  const fields = [], rules = [];

  const words = [];   // 反応した語。書いた文のどこから出たかを見せる。

  ACTIONS.forEach(function(a){
    if (!flags[a.f]) return;
    let hit = '';
    for (let i = 0; i < a.k.length; i++){
      if (text.indexOf(a.k[i]) >= 0){ hit = a.k[i]; break; }
    }
    if (hit && words.indexOf(hit) < 0) words.push(hit);

    a.fl.forEach(function(x){
      const label = x[0].replace('{o}', o);
      if (seen['f:' + label]) return;
      seen['f:' + label] = 1;
      fields.push({label:label, value:x[1], unit:x[2] || '', src:hit});
    });
    a.rl.forEach(function(r){
      const t = r.replace('{o}', o);
      if (seen['r:' + t]) return;
      seen['r:' + t] = 1;
      rules.push({t:t, src:hit});
    });
  });

  // 何も引っかからなくても、書いた語だけは形にする
  if (fields.length === 0) fields.push({label:'内容', value:'', unit:'', src:''});
  if (rules.length === 0)  rules.push({t:o + 'を記録に残す', src:''});

  const gaps = [];
  GAPS.forEach(function(g){
    if (gaps.length >= 3 || !g.when(flags)) return;
    gaps.push(g);
  });

  // 画面の名前は、書かれた動作から付ける。「会議室」ではなく「会議室予約」。
  // 対象語がすでにその語を含むときは足さない（請求書請求、にならないように）。
  const SUFFIX = [['apply','申請','申請する'], ['book','予約','予約する'],
                  ['bill','請求','発行する'], ['report','集計','集計する'],
                  ['time','入力','登録する'], ['stock','管理','登録する'],
                  ['crm','管理','登録する'], ['record','登録','登録する']];
  let suffix = '', verb = '登録する';
  for (let i = 0; i < SUFFIX.length; i++){
    if (!flags[SUFFIX[i][0]]) continue;
    suffix = o.indexOf(SUFFIX[i][1]) >= 0 ? '' : SUFFIX[i][1];
    verb = SUFFIX[i][2];
    break;
  }

  return { o:o, title:o + suffix, verb:verb, words:words,
           fields:fields.slice(0, 5), rules:rules.slice(0, 4), gaps:gaps };
}

/* =========================================================
   段の切り替え
   ========================================================= */
let stage = 1;

function goStage(n){
  stage = n;
  [1,2,3].forEach(function(i){
    $('s'+i).classList.toggle('on', i === n);
    const r = $('r'+i);
    r.classList.toggle('on', i === n);
    r.classList.toggle('done', i < n);
  });
  keys();
  if (n === 1) setTimeout(function(){ $('in').focus(); }, 60);
}

function keys(){
  const k = $('keys');
  if (stage === 1) k.innerHTML = '<kbd>Enter</kbd> 確定';
  if (stage === 2){
    k.innerHTML = $('toRingi').disabled ? '' : '<kbd>Enter</kbd> 稟議に上げる';
  }
  if (stage === 3){
    k.innerHTML = $('holdBtns').hidden ? '' : '<kbd>Enter</kbd> 打合せを開く';
  }
}

function say(t){
  $('msg').textContent = t || '';
  if (t) setTimeout(function(){ if ($('msg').textContent === t) $('msg').textContent = ''; }, 3200);
}

function stamp(v){
  if (v !== 'today') return v;
  const d = new Date();
  return (d.getMonth() + 1) + '/' + d.getDate();
}

/* =========================================================
   段1：書く
   ========================================================= */
let written = '';
let plan = null;
const inp = $('in');

function submitLine(){
  // 空のまま押されたら、例をそのまま採る。
  let text = inp.value.trim();
  if (!text){
    text = EGS[0];
    inp.value = text;
  }
  written = text;
  inp.disabled = true;
  plan = extract(text);

  // 書いた語が返ってくること自体が、読まれた証拠になる
  const line = '「' + plan.o + '」の話として読みました。画面を組み立てます。';
  const el = $('reply');
  let i = 0;
  const iv = setInterval(function(){
    el.textContent = line.slice(0, ++i);
    if (i >= line.length){
      clearInterval(iv);
      setTimeout(function(){ buildApp(); goStage(2); }, 600);
    }
  }, 24);
}

inp.addEventListener('keydown', function(e){
  if (e.key === 'Enter') submitLine();
});

/* 初見で何を書けばいいか分からない。手がかりとして並べる。 */
const EGS = [
  '経費を申請して、金額によって上長が承認する',
  '会議室を予約して、空きを見られるようにしたい',
  '顧客からの問い合わせを記録して、担当者に割り振る',
  '社員の残業時間を集計して、グラフで見せる'
];

(function buildEgs(){
  const ul = $('egs');
  EGS.forEach(function(t, i){
    const li = document.createElement('li');
    li.innerHTML = '<span class="k"></span><button type="button"></button>';
    li.querySelector('.k').textContent = i + 1;
    const b = li.querySelector('button');
    b.textContent = t;
    b.onclick = function(){ fillEg(t); };
    ul.appendChild(li);
  });
})();

function fillEg(t){
  inp.value = t;
  inp.focus();
}

addEventListener('keydown', function(e){
  if (stage !== 1 || inp.disabled || inp.value !== '') return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= EGS.length){
    e.preventDefault();
    fillEg(EGS[n - 1]);
  }
});

/* =========================================================
   段2：触れる画面が出てくる

   ここでは穴を出さない。「これで通せる」と思わせる場面。
   ========================================================= */
/* 書いた一行から、画面が書き上がっていく。
   ここで人に選ばせない。選ばせても答えが一つしかない偽の選択になる。
   「決めたことがそのまま形になる」は、動き自体で見せる。 */
function buildApp(){
  $('appTitle').textContent = plan.title;
  $('fields').innerHTML = '';
  $('rules').innerHTML = '';
  $('rulesHead').textContent = '決まったこと';
  $('toRingi').disabled = true;
  $('s2hint').textContent = '';

  $('from').textContent = '「' + written + '」から';

  // 入力欄は最初から出ている。機械的に決まるもので、決めごとではない。
  plan.fields.forEach(function(f){ writeOne({kind:'f', d:f}); });

  // 決まったことは全部そろえて置いておき、斜めの一筆で一気に現す。
  plan.rules.forEach(function(r){ writeOne({kind:'r', d:r}); });
  const rs = $('rules');
  rs.classList.remove('sweep');
  void rs.offsetWidth;
  // 速度は3箇所（この 320・下の合計・CSS の #rules.sweep）を揃えること。
  setTimeout(function(){ rs.classList.add('sweep'); }, 320);

  setTimeout(function(){
    $('toRingi').disabled = false;
    keys();
  }, 320 + 1250 + 130);
}

function writeOne(s){
  if (s.kind === 'f'){
    const dt = document.createElement('dt');
    dt.textContent = s.d.label;
    const dd = document.createElement('dd');
    const v = stamp(s.d.value);
    dd.innerHTML = '<span class="box">' + (v || '&nbsp;') + '</span>'
                 + (s.d.unit ? '<span class="unit">' + s.d.unit + '</span>' : '');
    dt.style.animation = dd.style.animation = 'rise .28s ease both';
    $('fields').appendChild(dt); $('fields').appendChild(dd);
  } else {
    // 斜めの塗りつぶしで、左から現れる
    const li = document.createElement('li');
    li.className = 'written';
    li.textContent = s.d.t;
    $('rules').appendChild(li);
  }
}


$('toRingi').onclick = function(){ toRingi(); };

/* =========================================================
   段3：稟議に出す。そこで止まる。
   ========================================================= */
let leftBlank = [];
let filled = [];

function toRingi(){
  if (stage !== 2) return;
  leftBlank = []; filled = [];

  $('title').textContent = written;
  const d = new Date();
  $('today').textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  // 稟議に載るのは、人が入れると決めたきまりだけ。
  $('keptList').textContent = plan.title + 'の画面（入力欄 ' + plan.fields.length
                            + ' 件・きまり ' + plan.rules.length + ' 件）';
  $('blankRow').hidden = true;
  $('hold').hidden = true;
  $('foldLine').hidden = true;
  $('attach').hidden = true;
  document.querySelector('.ringi').classList.remove('folded', 'holding');
  goStage(3);
  roll();
}

/* 起案と確認は通る。決裁で止まる。 */
const SEALS = ['p0', 'p1', 'p2'];

function roll(){
  SEALS.forEach(function(id){ $(id).classList.remove('done', 'stuck'); });
  $('st').textContent = '';
  setTimeout(function(){ $('p0').classList.add('done'); }, 345);
  setTimeout(function(){ $('p1').classList.add('done'); }, 690);
  setTimeout(hold, 1190);
}

/* ここが山場。通ると思ったものが、決裁で止まる。
   さっき見た画面がそのまま降りてきて、そこに空欄が現れる。 */
function hold(){
  $('st').textContent = 'このままでは決裁できません。';
  $('p2').classList.add('stuck');

  const fl = $('foldLine');
  fl.innerHTML = '件名：<b>' + written.replace(/[<>&]/g, '') + '</b>　／　'
               + plan.title + 'の画面　／　'
               + '<span class="stuck-mark">決裁 差戻し</span>';
  fl.hidden = false;
  document.querySelector('.ringi').classList.add('folded', 'holding');

  // 見つけたのは AI。決めるのは、この先の打合せ。
  $('holdLead').innerHTML = '<b>AI が画面を見直し</b>、'
                          + '<b>決まっていない欄を ' + plan.gaps.length + ' つ</b>見つけました。';
  $('hold').hidden = false;
  $('holdBtns').hidden = false;
  $('hold').insertBefore($('app'), $('holdBtns'));   // 同じ画面が、そのまま添付になる
  // 押すものは、空欄のすぐ下・画面の中に置く。外にあると押すべきものに見えない。
  $('fillBtn').textContent = '打 合 せ を 開 く';
  $('app').querySelector('.app-body').appendChild($('holdBtns'));
  $('app').classList.add('attached');
  addHoles();
  keys();
}

/* 空欄を、画面の上に出す。言葉のカードではなく、物の穴として。 */
let holes = [];
let cur = 0;

function addHoles(){
  const fs = $('fields');

  // 埋まっている欄は出さない。段2で見たものの繰り返しで、決める邪魔になる。
  // 添付に残すのは、画面の名前と、空いている欄だけ。
  fs.innerHTML = '';

  // 誰が見つけたのかを、欄のすぐ上に置く。
  const head = document.createElement('p');
  head.className = 'ai-found';
  head.textContent = 'AI が見つけた、決まっていない欄';
  fs.parentElement.insertBefore(head, fs);

  holes = [];
  plan.gaps.forEach(function(g, i){
    const dt = document.createElement('dt');
    dt.className = 'hole-k';
    dt.textContent = g.n;   // 欄の名前。付箋には場面の問いを書く。
    const dd = document.createElement('dd');
    dd.className = 'hole-v';
    dd.innerHTML = '<span class="blank">＿＿＿＿＿＿＿</span>';
    dt.style.animation = dd.style.animation = 'rise .3s ease both';
    dt.style.animationDelay = dd.style.animationDelay = (i * 0.12) + 's';
    fs.appendChild(dt); fs.appendChild(dd);
    holes.push({g:g, dt:dt, dd:dd});
  });
  cur = 0;   // 押されるまで書き込まない
}

/* 打合せを開くと、決まったことが順に埋まる。
   値には出どころを付ける。誰が持ち帰ったかが見えないと、AI が決めたことになる。 */
function startFill(){
  if ($('holdBtns').hidden) return;
  $('holdBtns').hidden = true;
  // ここから先は何も書かない。AI が見つけたという一行だけ残す。
  // 値が部署名つきで埋まり、決裁の判子が入る。見れば分かる。
  keys();
  fillNext();
}

function fillNext(){
  if (cur >= holes.length){ setTimeout(settle, 450); return; }
  const h = holes[cur];
  h.dt.classList.add('now'); h.dd.classList.add('now');

  setTimeout(function(){
    h.dt.classList.remove('now'); h.dd.classList.remove('now');
    h.dt.classList.add('done'); h.dd.classList.add('done');
    h.dd.innerHTML = '<span class="box filled wrote">' + h.g.a + '</span>'
                   + '<span class="said">' + h.g.by + '</span>';
    filled.push(h.g.n);
    cur++;
    setTimeout(fillNext, 340);
  }, 380);
}


/* 決まったら、空のままだった決裁欄に、ようやく判子が入る。
   起案と確認は押し直さない。紙は同じ、押されていなかったのは決裁だけ。 */
function settle(){
  $('holdBtns').hidden = true;
  $('p2').classList.remove('stuck');
  keys();
  setTimeout(function(){
    $('p2').classList.add('done');
    $('st').textContent = '決裁されました。';
  }, 420);
  setTimeout(finish, 1350);
}

/* =========================================================
   完了通知
   ========================================================= */
function finish(){
  $('hold').hidden = true;
  document.querySelector('.ringi').classList.remove('holding');

  const fl = $('foldLine');
  fl.innerHTML = '件名：<b>' + written.replace(/[<>&]/g, '') + '</b>　／　'
               + plan.title + 'の画面'
               + (filled.length ? '・差戻し <b>1</b> 回・決めた <b>' + filled.length + '</b> 件' : '')
               + '　／　<span class="ok">決 裁 済</span>';

  // 決めたのは打合せ。AI がしたのは、決まっていないところを先に見つけたこと。
  $('doneLead').innerHTML = filled.length
    ? '出したときは、この <b>' + filled.length + ' 件</b>が決まっていませんでした。<br>'
      + filled.map(function(g){ return '「' + g + '」'; }).join('、') + '。'
    : '決めていないところは、ありませんでした。';

  const act = $('doneAct');
  act.innerHTML = '<a href="#" id="again">別の仕事で試す</a>'
                + '<a href="#" id="more">会社の説明を読む</a>';
  $('again').onclick = function(e){ e.preventDefault(); location.reload(); };
  $('more').onclick = function(e){
    e.preventDefault();
    document.querySelector('.below').scrollIntoView({behavior:'smooth', block:'start'});
  };
  $('attach').hidden = false;
}

/* =========================================================
   キー操作。マウスなしで最後まで行ける。
   ========================================================= */
$('fillBtn').onclick = function(){ startFill(); };

addEventListener('keydown', function(e){
  if (stage === 2){
    if (e.key === 'Enter' && !$('toRingi').disabled){ e.preventDefault(); toRingi(); }
  } else if (stage === 3){
    if (e.key === 'Enter' && !$('holdBtns').hidden){ e.preventDefault(); startFill(); }
  }
});

goStage(1);
