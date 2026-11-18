/* 014 組む：玉と部品の動き。画面（play.html）と確かめ（node）の両方から読む */
(function (root) {
  var W = 320, H = 180, R = 4, G = 0.09, SUB = 4;
  var PLANK = 44, SPRING = 16, LAUNCH = 4.3;
  var ANG = [-40, -20, 0, 20, 40];          // いたの向き（度）。押すたびに次へ

  // 面（動かせない形）。[x1,y1,x2,y2]
  var LEVEL = {
    start: { x: 32, y: 14, vx: 0.45 },
    walls: [
      [0, 0, 0, 180],                       // 左の壁
      [0, 170, 196, 170], [212, 170, 320, 170],                          // 地面（玉は落ちずに止まる）
      [196, 100, 196, 180], [196, 100, 212, 100], [212, 100, 212, 180],   // まんなかの壁
      [236, 148, 236, 166], [236, 166, 292, 166], [292, 118, 292, 166]    // ゴールの箱
    ],
    goal: { x1: 237, x2: 291, y1: 150, y2: 166 },
    stock: { plank: 3, spring: 1 }
  };

  function segs(part) {
    if (part.kind === 'spring') return [[part.x - SPRING / 2, part.y, part.x + SPRING / 2, part.y, 'spring']];
    var a = ANG[part.a] * Math.PI / 180, dx = Math.cos(a) * PLANK / 2, dy = Math.sin(a) * PLANK / 2;
    return [[part.x - dx, part.y - dy, part.x + dx, part.y + dy, 'plank']];
  }

  function hit(b, s) {
    var ax = s[0], ay = s[1], ex = s[2] - ax, ey = s[3] - ay, L = ex * ex + ey * ey;
    var t = L ? ((b.x - ax) * ex + (b.y - ay) * ey) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var px = ax + ex * t, py = ay + ey * t, dx = b.x - px, dy = b.y - py, d = Math.sqrt(dx * dx + dy * dy);
    var reach = R + 1.5;
    if (d >= reach || d === 0) return false;
    var nx = dx / d, ny = dy / d;
    b.x += nx * (reach - d); b.y += ny * (reach - d);
    var vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return false;
    if (s[4] === 'spring' && ny < -0.5) {
      b.vy = -LAUNCH;                       // 横の速さはそのまま、決まった強さで上へ（角に当たっても横へは飛ばさない）
      return 'spring';
    }
    b.vx -= 1.25 * vn * nx; b.vy -= 1.25 * vn * ny;   // 少しだけ跳ねる
    b.vx *= 0.997; b.vy *= 0.997;
    return 'plank';
  }

  function world(parts) {
    var all = LEVEL.walls.map(function (w) { return [w[0], w[1], w[2], w[3], 'wall']; });
    parts.forEach(function (p) { all = all.concat(segs(p)); });
    return all;
  }

  function ball() { return { x: LEVEL.start.x, y: LEVEL.start.y, vx: LEVEL.start.vx, vy: 0, still: 0, t: 0 }; }

  // 一コマ進める。返す：null（まだ）／'goal'／'fall'／'stop'
  function tick(b, all, onHit) {
    for (var s = 0; s < SUB; s++) {
      b.vy += G / SUB; b.x += b.vx / SUB; b.y += b.vy / SUB;
      for (var i = 0; i < all.length; i++) { var h = hit(b, all[i]); if (h && onHit) onHit(h, all[i]); }
    }
    b.t++;
    var g = LEVEL.goal;
    if (b.x > g.x1 && b.x < g.x2 && b.y > g.y1 && b.y < g.y2) return 'goal';
    if (b.y > H + 20 || b.x > W + 20 || b.x < -20) return 'fall';
    b.still = (Math.abs(b.vx) + Math.abs(b.vy) < 0.06) ? b.still + 1 : 0;
    if (b.still > 60 || b.t > 60 * 25) return 'stop';
    return null;
  }

  var api = { W: W, H: H, R: R, PLANK: PLANK, SPRING: SPRING, ANG: ANG, LEVEL: LEVEL, segs: segs, world: world, ball: ball, tick: tick };
  if (typeof module !== 'undefined') module.exports = api; else root.PHYS = api;
})(this);
