/* Classic script so the entry overlay can recover even if modules cannot load. */
(function () {
  var intro = document.getElementById('brand-intro');
  var root = document.documentElement;
  var agent = navigator.userAgent || '';
  var tv = /smart.?tv|tizen|webos|hbbtv|netcast|viera|bravia|googletv|android.?tv|aft\w+|roku|xbox|playstation|\bshield\b/i.test(agent);
  var handheld = /android|iphone|ipad|ipod|mobile/i.test(agent);
  if (!tv && (handheld || !window.matchMedia || !window.matchMedia('(min-width: 800px)').matches)) {
    intro.classList.add('brand-intro--mobile');
  }
  if (tv) root.classList.add('entry-tv');

  function showFallback() {
    window.clearTimeout(deadline);
    controller.failed = true;
    intro.hidden = true;
    document.getElementById('language-screen').hidden = true;
    document.getElementById('start-screen').hidden = true;
    document.getElementById('desk').hidden = true;
    var fallback = document.getElementById('compatible-portfolio');
    fallback.hidden = false;
    fallback.querySelector('a').focus();
  }
  var deadline = window.setTimeout(showFallback, 7500);
  var controller = window.portfolioEntry = {
    failed: false,
    fallback: showFallback,
    loadingShift: function () { deadline = window.setTimeout(showFallback, 12000); },
    ready: function () { window.clearTimeout(deadline); }
  };

  if (!tv) return;
  document.addEventListener('keydown', function (event) {
    var direction = {ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1]}[event.key] ||
      {37: [-1, 0], 38: [0, -1], 39: [1, 0], 40: [0, 1]}[event.keyCode];
    if (!direction || event.defaultPrevented || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    var zone = document.querySelector('dialog[open]') || document.body;
    var controls = zone.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary');
    var current = document.activeElement.getBoundingClientRect();
    var originX = current.left + current.width / 2;
    var originY = current.top + current.height / 2;
    var best = Infinity;
    var next;
    for (var i = 0; i < controls.length; i++) {
      var control = controls[i];
      if (control === document.activeElement || !control.offsetWidth || !control.offsetHeight ||
          control.tabIndex < 0 || getComputedStyle(control).visibility !== 'visible') continue;
      var rect = control.getBoundingClientRect();
      var x = rect.left + rect.width / 2 - originX;
      var y = rect.top + rect.height / 2 - originY;
      var forward = x * direction[0] + y * direction[1];
      var sideways = Math.abs(x * direction[1] + y * direction[0]);
      var score = forward + sideways * 3;
      if ((!current.width || forward > 1) && score < best) {
        best = score;
        next = control;
      }
    }
    if (next) {
      event.preventDefault();
      next.focus();
    }
  });
}());
