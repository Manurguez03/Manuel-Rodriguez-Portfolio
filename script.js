const $ = id => document.getElementById(id);
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const saved = localStorage.getItem('theme');
if (saved) root.dataset.theme = saved;
$('theme').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('theme', next);
});
$('y').textContent = new Date().getFullYear();

// Court serve animation replay
$('serve').addEventListener('click', () => {
  const t = document.querySelector('.traj'), b = document.querySelector('.ball');
  [t, b].forEach(el => { el.style.animation = 'none'; void el.getBoundingClientRect(); el.style.animation = ''; });
});

// Scoreboard flip cards
document.querySelectorAll('#scoreboard li').forEach(li => {
  const s = document.createElement('span');
  s.className = 'story';
  s.textContent = li.dataset.story;
  li.appendChild(s);
  const flip = () => li.classList.toggle('flip');
  li.addEventListener('click', flip);
  li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
});

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- Lucky Loser draw (toy simulation of the thesis design) ---------- */
const RANKS = [121, 124, 128, 131];
const MONTHS = [-12, -6, 0, 6, 12, 18];
let ltTab = 'rank', ltData = null, ltBusy = false;

function renderHat(winner, spin) {
  $('lt-hat').innerHTML = RANKS.map((r, i) => {
    const cls = winner == null ? (i === spin ? 'spin' : '') : (i === winner ? 'win' : 'lose');
    const tag = winner == null ? '&nbsp;' : (i === winner ? 'Lucky loser · treated' : 'Not selected · control');
    return `<li class="${cls}"><b>Player ${'ABCD'[i]}</b><span>ranked #${r}</span><small>${tag}</small></li>`;
  }).join('');
}

function simulate(r, winner) {
  const noise = s => (r() - .5) * 2 * s;
  const effRank = t => t < 0 ? 0 : 28 * (1 - Math.exp(-(t + 3) / 8));
  const effPrize = t => t < 0 ? 0 : ({ 0: 90, 6: 22, 12: 14, 18: 10 })[t];
  const rank = RANKS.map((b, i) => MONTHS.map(t => b - 3 * t / 6 + 6 + (i === winner ? -effRank(t) + noise(4) : noise(4))));
  const prize = RANKS.map((b, i) => { const lvl = 10 + r() * 6; return MONTHS.map(t => lvl + t / 6 + noise(2.5) + (i === winner ? effPrize(t) + noise(8) * (t >= 0 ? 1 : 0) : 0)); });
  const split = m => ({
    t: m[winner],
    c: MONTHS.map((_, k) => mean(m.filter((_, i) => i !== winner).map(row => row[k])))
  });
  return { rank: split(rank), prize: split(prize) };
}

function lineChart(svg, series, o) {
  const W = 400, H = 230, pl = 46, pr = 12, pt = 16, pb = 42;
  const all = series.flatMap(s => s.vals);
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * .18 || 10; lo -= pad; hi += pad;
  const x = i => pl + (W - pl - pr) * i / (MONTHS.length - 1);
  const y = v => pt + (H - pt - pb) * (o.flip ? (v - lo) / (hi - lo) : 1 - (v - lo) / (hi - lo));
  const path = a => a.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad].map(v => `<text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${o.fmt(v)}</text>`).join('');
  const x0 = x(MONTHS.indexOf(0));
  const ends = series.map(s => y(s.vals[s.vals.length - 1]));
  const top = ends[0] <= ends[1] ? 0 : 1;
  svg.innerHTML =
    `<line class="ax" x1="${pl}" x2="${pl}" y1="${pt}" y2="${H - pb}"/><line class="ax" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>` +
    `<line class="ev" x1="${x0}" x2="${x0}" y1="${pt}" y2="${H - pb}"/><text x="${x0 + 4}" y="${pt + 8}">the draw</text>` +
    ticks + MONTHS.map((t, i) => `<text x="${x(i)}" y="${H - pb + 15}" text-anchor="middle">${t > 0 ? '+' + t : t}</text>`).join('') +
    `<text x="${(pl + W - pr) / 2}" y="${H - 6}" text-anchor="middle">months from the draw</text>` +
    series.map(s => `<path class="${s.cls}" d="${path(s.vals)}"/>`).join('') +
    series.map((s, i) => `<text x="${W - pr - 2}" y="${ends[i] + (i === top ? -9 : 17)}" text-anchor="end" class="lab ${s.cls}">${s.label}</text>`).join('');
}

function renderChart() {
  if (!ltData) return;
  const d = ltData[ltTab], isRank = ltTab === 'rank';
  lineChart($('lt-chart'), [
    { cls: 'l-ll', vals: d.t, label: 'Lucky loser' },
    { cls: 'l-ot', vals: d.c, label: 'Control (avg of 3)' }
  ], { flip: isRank, fmt: v => isRank ? '#' + Math.round(v) : '$' + Math.round(v) + 'K' });
  const pre = a => mean(a.filter((_, k) => MONTHS[k] < 0)), post = a => mean(a.filter((_, k) => MONTHS[k] >= 0));
  const f = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(0);
  const sign = isRank ? -1 : 1;
  const dT = sign * (post(d.t) - pre(d.t)), dC = sign * (post(d.c) - pre(d.c));
  const unit = isRank ? ' spots' : 'K';
  const money = n => isRank ? f(n) + unit : (n >= 0 ? '+$' : '−$') + Math.abs(n).toFixed(0) + 'K';
  $('lt-result').innerHTML = `<span class="eq">Difference-in-Differences = (after − before) for the lucky loser − (after − before) for the control group</span>` +
    `Lucky loser <b>${money(dT)}</b> · Control <b>${money(dC)}</b> · Estimated effect <b class="t">${money(dT - dC)}</b>${isRank ? ' (positive = moved up the rankings)' : ' per 6 months'}`;
}

function drawLoser() {
  if (ltBusy) return;
  ltBusy = true;
  const seed = Math.floor(Math.random() * 0xffffff);
  $('lt-seed').textContent = 'seed 0x' + seed.toString(16).padStart(6, '0');
  const r = rng(seed), winner = Math.floor(r() * 4);
  const done = () => {
    renderHat(winner);
    ltData = simulate(r, winner);
    $('lt-after').hidden = false;
    renderChart();
    ltBusy = false;
  };
  if (reduce) return done();
  let n = 0;
  const id = setInterval(() => { renderHat(null, n++ % 4); if (n > 14) { clearInterval(id); done(); } }, 90);
}
renderHat(null);
$('lt-draw').addEventListener('click', drawLoser);
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  ltTab = b.dataset.m;
  document.querySelectorAll('.tabs button').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
  renderChart();
}));
document.addEventListener('keydown', e => {
  if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey && !/input|textarea/i.test(e.target.tagName)) {
    const b = $('lottery').getBoundingClientRect();
    if (b.top < innerHeight && b.bottom > 0) drawLoser();
  }
});

/* ---------- Pitcher: mechanics -> command (toy model) ---------- */
const IDEAL = { stride: .7, trunk: .55, arm: .6 };
const pit = { ...IDEAL };
const SVGNS = 'http://www.w3.org/2000/svg';

function ik(a, b, l1, l2, dir) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - .01);
  const ang = Math.atan2(dy, dx);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)) * dir;
  return [a[0] + l1 * Math.cos(ang + A), a[1] + l1 * Math.sin(ang + A)];
}
const ln = (...p) => `M${p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L')}`;

function drawPitcher() {
  const G = 260;
  const back = [90, G], front = [90 + 85 + pit.stride * 95, G];
  const hx = 90 + (front[0] - 90) * .5;
  const hipH = Math.sqrt(130 * 130 - (front[0] - hx) ** 2);
  const hip = [hx, G - hipH];
  const bk = ik(hip, back, 70, 70, -1), fk = ik(hip, front, 70, 70, -1);
  const phi = (-10 + pit.trunk * 60) * Math.PI / 180;
  const up = [Math.sin(phi), -Math.cos(phi)];
  const sh = [hip[0] + 80 * up[0], hip[1] + 80 * up[1]];
  const head = [sh[0] + 26 * up[0], sh[1] + 26 * up[1]];
  const th = (10 + pit.arm * 80) * Math.PI / 180;
  const hand = [sh[0] + 66 * Math.cos(th), sh[1] - 66 * Math.sin(th)];
  const el = ik(sh, hand, 36, 36, 1);
  const gEl = [sh[0] + 26, sh[1] + 18], gHand = [sh[0] + 52, sh[1] + 2];
  $('pt-fig').innerHTML =
    `<path class="mound" d="M20 ${G + 6}Q150 ${G - 14} 400 ${G + 6}Z"/>` +
    `<line class="gnd" x1="10" x2="410" y1="${G + 6}" y2="${G + 6}"/>` +
    `<path class="bd" d="${ln(back, bk, hip)}"/><path class="bd" d="${ln(front, fk, hip)}"/>` +
    `<path class="bd" d="${ln(hip, sh)}"/><path class="bd" d="${ln(sh, gEl, gHand)}"/>` +
    `<circle class="head" cx="${head[0]}" cy="${head[1]}" r="12"/>` +
    `<path class="arm" d="${ln(sh, el, hand)}"/>` +
    `<circle class="glove" cx="${gHand[0]}" cy="${gHand[1]}" r="8"/>` +
    `<circle class="ballp" cx="${hand[0]}" cy="${hand[1]}" r="6"/>` +
    `<line class="rel" x1="${hand[0]}" x2="400" y1="${hand[1]}" y2="${hand[1]}"/><text class="reltxt" x="398" y="${hand[1] - 6}" text-anchor="end">release height</text>`;
}

function sigma() {
  const dev = Math.abs(pit.stride - IDEAL.stride) + Math.abs(pit.trunk - IDEAL.trunk) + Math.abs(pit.arm - IDEAL.arm);
  return 2.2 + 11 * dev;
}
function drawZone() {
  const z = $('pt-zone');
  z.innerHTML =
    `<path class="plate" d="M85 276H155L165 262H75Z"/>` +
    `<rect class="szone" x="60" y="60" width="120" height="170" rx="3"/>` +
    `<line class="szl" x1="100" x2="100" y1="60" y2="230"/><line class="szl" x1="140" x2="140" y1="60" y2="230"/>` +
    `<line class="szl" x1="60" x2="180" y1="117" y2="117"/><line class="szl" x1="60" x2="180" y1="174" y2="174"/>` +
    `<path class="tgt" d="M120 137V153M112 145H128"/><g id="pt-dots"></g>`;
}
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
function throwPitch(delay = 0) {
  const s = sigma() * 7.06;
  const x = clamp(120 + gauss() * s, 10, 230), y = clamp(145 + gauss() * s, 10, 250);
  setTimeout(() => {
    const dots = $('pt-dots');
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 7); c.setAttribute('class', 'pdot');
    dots.appendChild(c);
    while (dots.children.length > 20) dots.firstChild.remove();
  }, delay);
}
function updatePitch(clear = true) {
  const labels = { stride: v => v < .35 ? 'short' : v > .85 ? 'long' : 'medium', trunk: v => v < .3 ? 'upright' : v > .75 ? 'far forward' : 'balanced', arm: v => v < .25 ? 'sidearm' : v > .8 ? 'overhead' : 'three-quarter' };
  ['stride', 'trunk', 'arm'].forEach(k => { $('s-' + k).value = Math.round(pit[k] * 100); $('o-' + k).textContent = labels[k](pit[k]); });
  drawPitcher();
  if (clear) $('pt-dots').innerHTML = '';
  const s = sigma(), score = Math.round(100 * Math.exp(-(s - 2.2) / 14)), miss = (1.25 * s).toFixed(1);
  const verdict = score >= 85 ? 'Locked in' : score >= 55 ? 'Decent command' : score >= 30 ? 'Spraying it' : 'Wild';
  $('pt-read').innerHTML = `<b>${verdict}</b> · command score <b class="t">${score}</b>/100 · typical miss ≈ ${miss} in`;
}
drawZone();
['stride', 'trunk', 'arm'].forEach(k => $('s-' + k).addEventListener('input', e => { pit[k] = e.target.value / 100; updatePitch(); }));
$('pt-throw').addEventListener('click', () => throwPitch());
$('pt-ten').addEventListener('click', () => { for (let i = 0; i < 10; i++) throwPitch(reduce ? 0 : i * 90); });
document.querySelectorAll('.pt-presets button').forEach(b => b.addEventListener('click', () => {
  const p = b.dataset.p;
  if (p === 'locked') Object.assign(pit, IDEAL);
  else if (p === 'rushed') Object.assign(pit, { stride: .2, trunk: .92, arm: .12 });
  else Object.assign(pit, { stride: Math.random(), trunk: Math.random(), arm: Math.random() });
  updatePitch();
}));
updatePitch();

/* ---------- Penalty kick: corner decides the skill set ---------- */
const SKILLS = [
  { id: 'tl', title: 'Programming & data', chips: ['Python', 'R', 'SQL', 'pandas', 'NumPy', 'tidyverse', 'API testing'] },
  { id: 'tc', title: 'Statistics & machine learning', chips: ['Regression', 'Classification', 'Clustering', 'Neural networks', 'Time series', 'Causal inference', 'Feature selection'] },
  { id: 'tr', title: 'Visualization & tools', chips: ['Tableau', 'Power BI', 'Matplotlib', 'Jupyter', 'Git/GitHub', 'Excel'] },
  { id: 'bl', title: 'AI & automation', chips: ['LLM integration', 'Prompt engineering', 'AI-assisted data pipelines', 'Agentic AI', 'Generative AI'] },
  { id: 'bc', title: 'Cloud & engineering', chips: ['AWS', 'Cloud architectures', 'Data integration', 'REST APIs', 'Postman', 'Swagger'] },
  { id: 'br', title: 'Spoken languages', chips: ['Spanish · native', 'English · fluent', 'Portuguese · intermediate'] }
];
const chipsHtml = s => `<h4>${s.title}</h4><p class="chips">${s.chips.map(c => `<i>${c}</i>`).join('')}</p>`;
const ball = $('ball'), gk = $('gk'), panel = $('kick-panel');
const SPOT = [400, 305];

$('zones').innerHTML = SKILLS.map((s, i) => {
  const col = i % 3, row = Math.floor(i / 3), x = 100 + col * 200, y = 40 + row * 100;
  return `<g class="gz" data-i="${i}" role="button" tabindex="0" aria-label="Shoot at ${['top','bottom'][row]} ${['left','center','right'][col]}: ${s.title}"><rect x="${x}" y="${y}" width="200" height="100"/><text x="${x + 100}" y="${y + 22}">${s.title}</text></g>`;
}).join('');

function shoot(i) {
  const col = i % 3, row = Math.floor(i / 3);
  const tx = 100 + col * 200 + 100, ty = 40 + row * 100 + 50;
  ball.style.transition = 'none';
  ball.style.transform = `translate(${SPOT[0]}px,${SPOT[1]}px) scale(1)`;
  gk.style.transition = 'none'; gk.style.transform = 'none';
  void ball.getBoundingClientRect();
  ball.style.transition = 'transform .7s cubic-bezier(.2,.7,.3,1)';
  gk.style.transition = 'transform .6s ease-out .12s';
  ball.style.transform = `translate(${tx}px,${ty}px) scale(.62)`;
  const dir = col === 0 ? 1 : col === 2 ? -1 : (Math.random() < .5 ? -1 : 1);
  gk.style.transform = `translate(${dir * 175}px,${row === 0 ? -30 : 24}px) rotate(${dir * 72}deg)`;
  panel.classList.remove('show');
  setTimeout(() => {
    panel.innerHTML = `<p class="goal-txt">GOAL! ⚽</p>${chipsHtml(SKILLS[i])}`;
    panel.classList.add('show');
  }, reduce ? 0 : 650);
}
document.querySelectorAll('.gz').forEach(g => {
  const go = () => shoot(+g.dataset.i);
  g.addEventListener('click', go);
  g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
});
panel.innerHTML = '<p class="goal-txt dim">Pick a corner to take your shot.</p>';
$('kick-all').addEventListener('click', () => {
  panel.innerHTML = `<div class="all">${SKILLS.map(s => `<div>${chipsHtml(s)}</div>`).join('')}</div>`;
  panel.classList.add('show');
});

const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
