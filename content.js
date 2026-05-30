// content.js - Injected into every tab
// Guard: only register listener once, even if injected multiple times.
// Everything lives inside the `if` block so there's no invalid top-level return.
if (!window.__snaptexLoaded) {
  window.__snaptexLoaded = true;

  // Fire-and-forget listener — no sendResponse, so no "channel closed" warnings
  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.action === 'startRegionSelect') startRegionSelect();
    if (msg.action === 'startFullPageCapture') captureFullPage();
  });

  // ════════════════════════════════════════════════════════════
  //  REGION SELECT
  // ════════════════════════════════════════════════════════════
  function startRegionSelect() {
    if (document.getElementById('__snaptex_overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = '__snaptex_overlay';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
      'z-index:2147483646;cursor:crosshair;background:rgba(10,10,15,0.4);';

    var hint = document.createElement('div');
    hint.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'background:rgba(10,10,15,0.9);color:#e0e0e8;font-family:monospace;' +
      'font-size:12px;padding:8px 16px;border-radius:8px;' +
      'border:1px solid rgba(124,106,247,0.5);pointer-events:none;z-index:2147483647;';
    hint.textContent = 'Drag to select region · ESC to cancel';

    var dpr = window.devicePixelRatio || 1;
    var startX, startY, box;

    overlay.addEventListener('mousedown', function(e) {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      box = document.createElement('div');
      box.style.cssText =
        'position:fixed;border:2px solid #7c6af7;' +
        'background:rgba(124,106,247,0.1);pointer-events:none;z-index:2147483647;';
      document.body.appendChild(box);
    });

    overlay.addEventListener('mousemove', function(e) {
      if (!box) return;
      var x = Math.min(e.clientX, startX);
      var y = Math.min(e.clientY, startY);
      var w = Math.abs(e.clientX - startX);
      var h = Math.abs(e.clientY - startY);
      box.style.left = x + 'px';
      box.style.top = y + 'px';
      box.style.width = w + 'px';
      box.style.height = h + 'px';
    });

    overlay.addEventListener('mouseup', function(e) {
      if (!box) return;
      var x = Math.min(e.clientX, startX);
      var y = Math.min(e.clientY, startY);
      var w = Math.abs(e.clientX - startX);
      var h = Math.abs(e.clientY - startY);

      if (w < 5 || h < 5) { cleanup(); return; }

      // Hide UI before capture so it doesn't tint the screenshot
      overlay.style.display = 'none';
      box.style.display = 'none';
      hint.style.display = 'none';

      setTimeout(function() {
        chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, function(res) {
          cleanup();
          if (!res || res.error || !res.dataUrl) return;
          var img = new Image();
          img.onload = function() {
            var canvas = document.createElement('canvas');
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w * dpr, h * dpr);
            chrome.runtime.sendMessage({ action: 'addToBag', dataUrl: canvas.toDataURL('image/png') });
          };
          img.src = res.dataUrl;
        });
      }, 150);
    });

    function onEsc(e) {
      if (e.key === 'Escape') { cleanup(); document.removeEventListener('keydown', onEsc); }
    }
    document.addEventListener('keydown', onEsc);

    function cleanup() {
      if (box && box.parentNode) box.parentNode.removeChild(box);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (hint.parentNode) hint.parentNode.removeChild(hint);
      box = null;
    }

    document.body.appendChild(hint);
    document.body.appendChild(overlay);
  }

  // ════════════════════════════════════════════════════════════
  //  FULL PAGE CAPTURE
  // ════════════════════════════════════════════════════════════
  function captureFullPage() {
    var origX = window.scrollX;
    var origY = window.scrollY;
    var totalH = document.documentElement.scrollHeight;
    var totalW = document.documentElement.scrollWidth;
    var viewH = window.innerHeight;
    var viewW = window.innerWidth;
    var dpr = window.devicePixelRatio || 1;
    var steps = Math.ceil(totalH / viewH);

    var canvas = document.createElement('canvas');
    canvas.width = totalW * dpr;
    canvas.height = totalH * dpr;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    window.scrollTo(0, 0);

    setTimeout(function() {
      var i = 0;
      function doStep() {
        if (i >= steps) {
          window.scrollTo(origX, origY);
          chrome.runtime.sendMessage({ action: 'addToBag', dataUrl: canvas.toDataURL('image/png') });
          return;
        }
        var scrollY = i * viewH;
        window.scrollTo(0, scrollY);
        setTimeout(function() {
          chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, function(res) {
            if (res && res.dataUrl) {
              var img = new Image();
              img.onload = function() {
                var drawH = Math.min(viewH, totalH - scrollY) * dpr;
                ctx.drawImage(img, 0, 0, viewW * dpr, drawH, 0, scrollY * dpr, viewW * dpr, drawH);
                i++;
                setTimeout(doStep, 100);
              };
              img.src = res.dataUrl;
            } else {
              i++;
              setTimeout(doStep, 100);
            }
          });
        }, 250);
      }
      doStep();
    }, 300);
  }

} // end guard