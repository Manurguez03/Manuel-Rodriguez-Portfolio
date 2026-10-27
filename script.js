const root = document.documentElement;
const saved = localStorage.getItem('theme');
if (saved) root.dataset.theme = saved;
document.getElementById('theme').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('theme', next);
});
document.getElementById('y').textContent = new Date().getFullYear();

// Court serve animation replay
document.getElementById('serve').addEventListener('click', () => {
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

// Lucky Loser lottery (toy simulation)
const NAMES = ['Player A', 'Player B', 'Player C', 'Player D'];
const TRUE_EFFECT = 30;
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function drawLottery() {
  const seed = Math.floor(Math.random() * 0xffffff);
  document.getElementById('lt-seed').textContent = 'seed 0x' + seed.toString(16).padStart(6, '0');
  const r = rng(seed), noise = s => (r() - 0.5) * 2 * s;
  const winner = Math.floor(r() * 4);
  const ul = document.getElementById('lt-players');
  ul.innerHTML = NAMES.map((n, i) =>
    `<li class="${i === winner ? 'win' : ''}"><span>${n}</span><span>${i === winner ? 'lucky loser ✓' : 'out'}</span></li>`).join('');

  const years = [0, 1, 2, 3, 4, 5];
  const gain = (effect, s) => years.map(t => t === 0 ? 0 : effect * (1 - Math.exp(-t / 2)) + noise(s));
  const ll = gain(TRUE_EFFECT, 22);
  const others = years.map(() => 0);
  for (let k = 0; k < 3; k++) gain(0, 22).forEach((v, i) => others[i] += v / 3);

  const W = 400, H = 200, pl = 36, pb = 24, pt = 10, pr = 10, ymin = -40, ymax = 80;
  const x = t => pl + (W - pl - pr) * t / 5;
  const y = v => pt + (H - pt - pb) * (1 - (v - ymin) / (ymax - ymin));
  const path = a => a.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  document.getElementById('lt-chart').innerHTML =
    `<line class="ax" x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}"/>` +
    `<line class="ax" x1="${pl}" x2="${pl}" y1="${pt}" y2="${H - pb}"/>` +
    years.map(t => `<text x="${x(t)}" y="${H - 8}" text-anchor="middle">${t}</text>`).join('') +
    `<text x="${pl + 4}" y="${pt + 10}">spots gained</text><text x="${W - pr}" y="${H - 8}" text-anchor="end">years →</text>` +
    `<path class="l-ot" d="${path(others)}"/><path class="l-ll" d="${path(ll)}"/>` +
    `<text x="${x(5) - 4}" y="${y(ll[5]) - 8}" text-anchor="end" fill="var(--lime)">${NAMES[winner]}</text>` +
    `<text x="${x(5) - 4}" y="${y(others[5]) + 16}" text-anchor="end" fill="var(--clay)">other three (avg)</text>`;
  const est = ll[5] - others[5];
  document.getElementById('lt-result').textContent =
    `Estimated effect this draw: ${est >= 0 ? '+' : ''}${est.toFixed(0)} spots. The effect built into the simulation is +${TRUE_EFFECT}. Draw again and watch it wobble.`;
}
document.getElementById('lt-draw').addEventListener('click', drawLottery);
document.addEventListener('keydown', e => {
  if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) drawLottery();
});
drawLottery();

const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
