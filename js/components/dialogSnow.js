const segmentWidth = 11;
const colors = ['#edf7fc', '#c9e1ef', '#a8c5da'];
const random = (min, max) => min + Math.random() * (max - min);

export function createDialogSnow(refresh) {
  const canvas = document.createElement('canvas');
  if (typeof canvas.showPopover !== 'function') return null;
  const context = canvas.getContext('2d');
  if (!context) return null;

  // A modal lives in the browser's top layer, above any ordinary z-index.
  canvas.className = 'winter-dialog-snow';
  canvas.setAttribute('popover', 'manual');
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const openDialogs = new Map();
  const falling = [];
  let front, width, height;

  function release({ rect, depths }) {
    if (!rect) return;
    depths.forEach((depth, index) => {
      for (let i = 0; i < Math.ceil(depth / 2.4); i++) {
        falling.push({
          x: Math.min(rect.right - 2, rect.left + (index + Math.random()) * segmentWidth),
          y: rect.top - random(1, depth + 1),
          vx: random(-43, 43), vy: random(18, 86), size: random(1.8, 4),
          lifetime: random(.55, 1.1), age: 0, color: colors[i % colors.length],
        });
      }
    });
    if (falling.length > 400) falling.splice(0, falling.length - 400);
  }

  const observer = new MutationObserver((changes) => {
    let changed = false;
    for (const { target } of changes) {
      if (target.tagName !== 'DIALOG') continue;
      changed = true;
      if (target.open && !openDialogs.has(target)) openDialogs.set(target, { depths: [], age: 0 });
      else if (!target.open && openDialogs.has(target)) {
        release(openDialogs.get(target));
        openDialogs.delete(target);
      }
    }
    if (!changed) return;
    const next = Array.from(openDialogs.keys()).at(-1);
    if (next && next !== front && canvas.matches(':popover-open')) canvas.hidePopover();
    front = next;
    if ((front || falling.length) && !canvas.matches(':popover-open')) canvas.showPopover();
    refresh();
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });

  return {
    resize(viewWidth, viewHeight, scale) {
      width = viewWidth;
      height = viewHeight;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
    },
    draw(delta, reduced, storm) {
      if (!front && !falling.length) {
        if (canvas.matches(':popover-open')) canvas.hidePopover();
        return;
      }
      context.clearRect(0, 0, width, height);
      if (front) {
        const bank = openDialogs.get(front);
        const paper = front.querySelector(':scope > article, :scope > .noticeboard, :scope > .dispatch, :scope > .visitor-guide__paper, :scope > .capture-shield__order') ?? front;
        const rect = paper.getBoundingClientRect();
        if (rect.width && rect.height) {
          bank.rect = rect;
          bank.age += delta;
          const segments = Math.ceil(rect.width / segmentWidth);
          bank.depths.length = Math.min(bank.depths.length, segments);
          for (let i = 0; i < segments; i++) {
            const crest = 2 + (i * 13 % 9) * .55;
            const depth = reduced ? 3 : Math.min(storm ? 12 : 8, 1 + Math.min(bank.age / 2, 1) * crest + bank.age * (storm ? 1.4 : .84));
            bank.depths[i] = depth;
            const x = Math.round(rect.left + i * segmentWidth);
            const span = Math.min(segmentWidth, rect.right - x);
            if (span <= 0) continue;
            const rim = Math.max(2, Math.round(rect.top));
            context.fillStyle = colors[1];
            context.fillRect(x, rim - 1, span, 2);
            context.fillStyle = colors[0];
            context.fillRect(x, rim - Math.round(depth), span, Math.round(depth));
          }
        }
      }
      if (reduced) falling.length = 0;
      for (let i = falling.length - 1; i >= 0; i--) {
        const flake = falling[i];
        flake.age += delta;
        flake.vy += 480 * delta;
        flake.x += flake.vx * delta;
        flake.y += flake.vy * delta;
        if (flake.age >= flake.lifetime || flake.y > height + 4) {
          falling.splice(i, 1);
          continue;
        }
        context.globalAlpha = Math.min(1, (flake.lifetime - flake.age) * 4);
        context.fillStyle = flake.color;
        context.fillRect(Math.round(flake.x), Math.round(flake.y), flake.size, flake.size);
      }
      context.globalAlpha = 1;
      if (!front && !falling.length) canvas.hidePopover();
    },
  };
}
