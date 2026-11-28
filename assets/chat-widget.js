/*
 * chat-widget.js: scripted demo chat assistant.
 * Vanilla JS, no dependencies, no network calls.
 * Config: <script type="application/json" id="chat-config"> with
 *   business, phone, city, trade, services (array of strings), and an
 *   optional bottom (px from the bottom edge, default 16) for the launcher.
 * Dock: a page can give its own opener, <button type="button" data-chat-open hidden>,
 *   for example in a phone call bar. The widget unhides it and, while one is on
 *   screen, hides its floating launcher (so nothing floats over the text) and opens
 *   the panel straight above the bar. Escape returns focus to the control that opened it.
 * Every config value and every typed answer is inserted with textContent.
 */
(function () {
  'use strict';

  var CONFIG_ID = 'chat-config';
  var STYLE_ID = 'tfc-chat-style';
  var PANEL_ID = 'tfc-chat-panel';
  var LAUNCH_ID = 'tfc-chat-launch';
  var INPUT_ID = 'tfc-chat-input';
  var NOTE = 'Scripted demo. It sends nothing.'; // one line at 16px, even 320px wide
  var SHORT = 500; // viewport height (px) below which the panel goes full height; matches the CSS media query below

  var CSS = [
    '[hidden]{display:none !important}',
    '.tfc-launch{position:fixed;right:16px;bottom:16px;z-index:2147483000;box-sizing:border-box;max-width:calc(100vw - 32px);padding:12px 18px;border:2px solid transparent;border-radius:999px;background:var(--acc,#1f4e79);color:var(--accink,#ffffff);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;font-weight:600;line-height:1.2;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25)}',
    // Phones: a round 50px launcher (its text stays as the accessible name) so it does not cover page buttons.
    '@media (max-width: 720px){.tfc-launch{width:50px;height:50px;padding:0;font-size:0;line-height:0}.tfc-launch::before{content:"";display:block;width:22px;height:17px;margin:0 auto;border:2.5px solid currentColor;border-radius:8px 8px 8px 2px}}',
    '.tfc-panel{position:fixed;right:16px;bottom:72px;z-index:2147483000;box-sizing:border-box;width:min(360px,calc(100vw - 24px));max-height:min(560px,calc(100vh - 100px));display:flex;flex-direction:column;overflow:hidden;background:var(--bg,#ffffff);color:var(--ink,#1c2024);border:1px solid rgba(0,0,0,.2);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.3);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.4;animation:tfc-in .18s ease-out}',
    '.tfc-panel:focus{outline:none}',
    '.tfc-note{margin:0;padding:8px 12px;font-size:16px;background:rgba(0,0,0,.06);border-bottom:1px solid rgba(0,0,0,.1)}',
    '.tfc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:var(--acc,#1f4e79);color:var(--accink,#ffffff)}',
    '.tfc-title{margin:0;font-size:16px;font-weight:700}',
    '.tfc-title:focus{outline:none}',
    '.tfc-close{padding:4px 10px;border:1px solid var(--accink,#ffffff);border-radius:8px;background:transparent;color:var(--accink,#ffffff);font-family:inherit;font-size:16px;cursor:pointer}',
    '.tfc-log{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:12px}',
    '.tfc-msg{max-width:85%;padding:8px 11px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.tfc-bot{align-self:flex-start;background:rgba(0,0,0,.07)}',
    '.tfc-user{align-self:flex-end;background:var(--acc,#1f4e79);color:var(--accink,#ffffff)}',
    '.tfc-list{margin:6px 0 0;padding-left:18px}',
    '.tfc-tel{color:inherit;font-weight:700}',
    '.tfc-quick{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-top:1px solid rgba(0,0,0,.1)}',
    '.tfc-chip{padding:6px 10px;border:1px solid var(--acc,#1f4e79);border-radius:999px;background:var(--bg,#ffffff);color:var(--ink,#1c2024);font-family:inherit;font-size:16px;cursor:pointer}',
    '.tfc-form{padding:8px 12px 12px;border-top:1px solid rgba(0,0,0,.1)}',
    '.tfc-label{display:block;margin-bottom:4px;font-size:16px;font-weight:600}',
    '.tfc-row{display:flex;gap:6px}',
    // 16px: below that, iPhones zoom the whole page when the input takes focus.
    '.tfc-input{flex:1 1 auto;min-width:0;box-sizing:border-box;padding:9px 10px;border:1px solid rgba(0,0,0,.35);border-radius:8px;background:#ffffff;color:var(--ink,#1c2024);font-family:inherit;font-size:16px}',
    // Short screens (see SHORT): quick replies in one row that scrolls sideways.
    '@media (max-height: 499.98px){.tfc-quick{flex-wrap:nowrap;overflow-x:auto}.tfc-chip{flex:none;white-space:nowrap}}',
    '.tfc-send{padding:9px 14px;border:0;border-radius:8px;background:var(--acc,#1f4e79);color:var(--accink,#ffffff);font-family:inherit;font-size:16px;font-weight:600;cursor:pointer}',
    '.tfc-launch:focus-visible,.tfc-chip:focus-visible,.tfc-send:focus-visible,.tfc-input:focus-visible,.tfc-tel:focus-visible{outline:3px solid var(--ink,#1c2024);outline-offset:2px}',
    '.tfc-close:focus-visible{outline:3px solid var(--accink,#ffffff);outline-offset:2px}',
    '@keyframes tfc-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion: reduce){.tfc-panel{animation:none}.tfc-launch,.tfc-chip,.tfc-send,.tfc-close{transition:none}}'
  ].join('\n');

  var QUICK = [
    { label: 'Urgent problem', intent: 'urgent' },
    { label: 'Request an estimate', intent: 'estimate' },
    { label: 'What do you work on?', intent: 'services' },
    { label: 'Where do you work?', intent: 'location' },
    { label: 'Hours', intent: 'hours' }
  ];

  // Free-text keyword rules. The first rule that matches wins.
  var RULES = [
    { intent: 'urgent', re: /\b(urgent|emergency|asap|leak|leaking|flood|flooding|broken)\b/i },
    { intent: 'estimate', re: /\b(estimates?|quotes?|price|prices|pricing|cost|how much|bid)\b/i },
    { intent: 'services', re: /\b(services?|work on|do you do|offer|provide|repairs?|replacements?|inspections?|roofing)\b/i },
    { intent: 'location', re: /\b(where|location|area|city|based|serve|serving|located)\b/i },
    { intent: 'hours', re: /\b(?:your|business|opening|office|working|what) hours\b|^\s*hours?\b|\b(?:are|r) (?:you|u|y'all) (?:open|closed)\b|\b(?:when|what time) (?:do|does|are) (?:you|u|y'all) (?:open|close)\b(?!\s+(?:a|an|the|my|our|your|claims?|tickets?|accounts?|jobs?)\b)|\bdo you (?:open|close)\b(?!\s+(?:a|an|the|my|our|your|claims?|tickets?|accounts?|jobs?)\b)|\bopen (?:today|now|tonight|tomorrow|late|early|on (?:the )?(?:weekends?|holidays?|(?:mon|tues|wednes|thurs|fri|satur|sun)days?))\b/i }
  ];

  // One labelled field per step of the estimate request.
  var STEPS = [
    {
      key: 'name', label: 'Your name', type: 'text',
      prompt: 'Step 1 of 3. What is your name?',
      check: function (t) { return t ? '' : 'Please enter your name.'; }
    },
    {
      key: 'phone', label: 'Phone number', type: 'tel',
      prompt: 'Step 2 of 3. What is the best phone number to reach you?',
      check: function (t) {
        return t.replace(/\D/g, '').length >= 10 ? '' : 'Please enter a phone number with at least 10 digits.';
      }
    },
    {
      key: 'job', label: 'Short description of the job', type: 'text',
      prompt: 'Step 3 of 3. Describe the job in a sentence or two.',
      check: function (t) {
        if (!t) { return 'Please describe the job.'; }
        return t.length <= 300 ? '' : 'Please keep the description to 300 characters or fewer.';
      }
    }
  ];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function readConfig() {
    var block = document.getElementById(CONFIG_ID);
    if (!block) {
      throw new Error('chat-widget: missing <script type="application/json" id="chat-config"> block. The widget did not start.');
    }
    var cfg;
    try {
      cfg = JSON.parse(block.textContent);
    } catch (e) {
      throw new Error('chat-widget: the chat-config block is not valid JSON (' + e.message + '). The widget did not start.');
    }
    return {
      business: String(cfg.business || 'this business'),
      phone: String(cfg.phone || ''),
      city: String(cfg.city || ''),
      state: String(cfg.state || 'TX'),
      trade: String(cfg.trade || ''),
      services: Array.isArray(cfg.services) ? cfg.services.map(String) : [],
      bottom: bottomPx(cfg.bottom)
    };
  }

  // Launcher distance from the bottom edge, in px. Missing means 16.
  function bottomPx(value) {
    if (value === undefined || value === null || value === '') { return 16; }
    var n = Number(value);
    if (isFinite(n) && n >= 0) { return n; }
    console.warn('chat-widget: "bottom" must be a number of px, 0 or more. Using 16.');
    return 16;
  }

  function articleFor(word) {
    return /^[aeiou]/i.test(word) ? 'an ' : 'a ';
  }

  function telHref(phone) {
    var digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 10) { digits = '1' + digits; }
    return digits.length >= 10 ? 'tel:+' + digits : '';
  }

  function telNode(phone) {
    var href = telHref(phone);
    if (!href) { return document.createTextNode(phone); } // callers check hasPhone first
    var a = el('a', 'tfc-tel', phone);
    a.setAttribute('href', href);
    return a;
  }

  function matchIntent(text) {
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].re.test(text)) { return RULES[i].intent; }
    }
    return 'fallback';
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) { return; }
    var style = el('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function init(cfg) {
    injectStyle();

    var state = { flow: null, step: 0, answers: {}, greeted: false };

    var launcher = el('button', 'tfc-launch', 'Questions? Ask here');
    launcher.type = 'button';
    launcher.id = LAUNCH_ID;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', PANEL_ID);

    var panel = el('div', 'tfc-panel');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    // While it is open the rest of the page is inert (see setInert); aria-modal is set there too.
    panel.setAttribute('aria-label', 'Demo chat assistant for ' + cfg.business);
    panel.tabIndex = -1;
    panel.hidden = true;

    // Page-supplied openers (see Dock above). Only buttons count.
    var openers = Array.prototype.slice.call(document.querySelectorAll('[data-chat-open]')).filter(function (o) {
      return o.tagName === 'BUTTON';
    });
    var controls = [launcher].concat(openers);
    var lastOpener = launcher;

    function onScreen(node) {
      return !node.hidden && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
    }

    // The panel sits just above the launcher (about 46px tall plus a 10px gap), or straight above
    // the page's bar when docked, and never runs off the top of the viewport. On a short screen
    // (a phone held sideways) that leaves no room for the input, so the panel takes the full height
    // over the bar or launcher; its Close button and Escape still shut it.
    launcher.style.bottom = cfg.bottom + 'px';
    function syncDock() {
      var shown = openers.filter(onScreen);
      var docked = shown.length > 0;
      launcher.hidden = docked;
      var short = window.innerHeight < SHORT;
      // Docked: clear the page's bar as drawn, since iPhones add safe-area padding under it.
      var barClear = docked ? Math.ceil(window.innerHeight - shown[0].parentNode.getBoundingClientRect().top) + 12 : 0;
      var panelBottom = short ? 8 : docked ? Math.max(cfg.bottom, barClear) : cfg.bottom + 56;
      panel.style.bottom = panelBottom + 'px';
      panel.style.maxHeight = short ? (window.innerHeight - 16) + 'px' : 'min(560px, calc(100vh - ' + (panelBottom + 28) + 'px))';
    }

    var note = el('p', 'tfc-note', NOTE);

    var head = el('div', 'tfc-head');
    var title = el('h2', 'tfc-title', cfg.business);
    title.tabIndex = -1;
    var closeBtn = el('button', 'tfc-close', 'Close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close chat');
    head.appendChild(title);
    head.appendChild(closeBtn);

    var log = el('div', 'tfc-log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-relevant', 'additions');

    var quick = el('div', 'tfc-quick');

    var form = el('form', 'tfc-form');
    var fieldLabel = el('label', 'tfc-label', 'Ask a question');
    fieldLabel.htmlFor = INPUT_ID;
    var row = el('div', 'tfc-row');
    var input = el('input', 'tfc-input');
    input.type = 'text';
    input.id = INPUT_ID;
    input.placeholder = 'Type a question';
    input.maxLength = 300;
    input.autocomplete = 'off';
    var send = el('button', 'tfc-send', 'Send');
    send.type = 'submit';
    row.appendChild(input);
    row.appendChild(send);
    form.appendChild(fieldLabel);
    form.appendChild(row);

    panel.appendChild(note);
    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(quick);
    panel.appendChild(form);

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    openers.forEach(function (o) {
      o.type = 'button';
      o.setAttribute('aria-controls', PANEL_ID);
      o.setAttribute('aria-expanded', 'false');
      o.hidden = false;
    });
    syncDock();
    var pending = false;
    window.addEventListener('resize', function () {
      if (pending) { return; }
      pending = true;
      requestAnimationFrame(function () { pending = false; syncDock(); });
    });

    function bubble(kind, parts) {
      var b = el('div', 'tfc-msg tfc-' + kind);
      parts.forEach(function (p) {
        b.appendChild(typeof p === 'string' ? document.createTextNode(p) : p);
      });
      log.appendChild(b);
      // Show the new message from its first line: on a short screen it can be taller than the log.
      // (scrollTop stops at the end, so a short message simply scrolls the log to the bottom.)
      log.scrollTop += b.getBoundingClientRect().top - log.getBoundingClientRect().top - 12;
      return b;
    }

    function addBot(parts) { return bubble('bot', parts); }
    function addUser(text) { return bubble('user', [text]); }

    function setField(text, type, placeholder) {
      fieldLabel.textContent = text;
      input.type = type;
      input.placeholder = placeholder;
    }

    function resetField() { setField('Ask a question', 'text', 'Type a question'); }

    function askStep() {
      var s = STEPS[state.step];
      addBot([s.prompt]);
      setField(s.label, s.type, 'Type your answer');
    }

    function finishEstimate() {
      var a = state.answers;
      var list = el('ul', 'tfc-list');
      list.appendChild(el('li', null, 'Name: ' + a.name));
      list.appendChild(el('li', null, 'Phone: ' + a.phone));
      list.appendChild(el('li', null, 'Job: ' + a.job));
      // One bubble, so the note scrolls into view together with what it is about.
      addBot(['Here is what you typed:', list, 'Demo only: nothing was sent.']);
      state.flow = null;
      state.step = 0;
      state.answers = {};
      resetField();
    }

    function runIntent(intent) {
      state.flow = null;
      var hasPhone = telHref(cfg.phone) !== '';
      if (intent === 'urgent') {
        addBot(hasPhone
          ? ['This sounds urgent. Please call now: ', telNode(cfg.phone)]
          : ['This sounds urgent. On the live site, this answer gives ' + cfg.business + "'s phone number so you can call right away. The number is still to be confirmed for this demo. Choose 'Request an estimate' to see how the request form works."]);
      } else if (intent === 'estimate') {
        state.flow = 'estimate';
        state.step = 0;
        state.answers = {};
        addBot(['Happy to take the details. Choose another option at any time to stop.']);
        askStep();
      } else if (intent === 'services') {
        if (cfg.services.length === 0) {
          addBot(['No services are listed yet. Ask the owner (to confirm).']);
        } else {
          var list = el('ul', 'tfc-list');
          cfg.services.forEach(function (s) { list.appendChild(el('li', null, s)); });
          addBot(['Services listed for ' + cfg.business + ' (typical work, to confirm with the owner):', list]);
        }
      } else if (intent === 'location') {
        addBot([cfg.city
          ? 'Serving ' + cfg.city + ', ' + cfg.state + '. Exact service area to confirm with the owner.'
          : 'Service area to confirm with the owner.']);
      } else if (intent === 'hours') {
        addBot([hasPhone
          ? 'Hours to confirm with the owner. For anything urgent, call.'
          : 'Hours to confirm with the owner.']);
      } else {
        addBot(hasPhone
          ? ['I only have scripted answers for a few questions. You can request an estimate with the buttons, or call ', telNode(cfg.phone), '.']
          : ['I only have scripted answers for a few questions. You can request an estimate with the buttons.']);
      }
    }

    QUICK.forEach(function (q) {
      var chip = el('button', 'tfc-chip', q.label);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        addUser(q.label);
        runIntent(q.intent);
      });
      quick.appendChild(chip);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();

      if (state.flow === 'estimate') {
        var step = STEPS[state.step];
        var err = step.check(text);
        if (err) { addBot([err]); return; }
        addUser(text);
        input.value = '';
        state.answers[step.key] = text;
        state.step += 1;
        if (state.step < STEPS.length) { askStep(); } else { finishEstimate(); }
        return;
      }

      if (!text) {
        addBot(['Type a question, or pick an option above.']);
        return;
      }
      addUser(text);
      input.value = '';
      runIntent(matchIntent(text));
    });

    function isOpen() { return !panel.hidden; }

    function setExpanded(value) {
      controls.forEach(function (c) { c.setAttribute('aria-expanded', value); });
    }

    // While the panel is open the page behind it goes inert (no taps, no focus, hidden from screen
    // readers). Two things stay live: the panel, and a docked bar on screen (the phone call bar), so
    // its Call works in one tap. aria-modal is true only when nothing else stays live (no bar).
    // Nodes the page had made inert itself are left alone.
    var madeInert = [];
    function setInert(on) {
      madeInert.forEach(function (n) { n.removeAttribute('inert'); });
      madeInert = [];
      if (!on) { return; }
      var keep = [panel].concat(openers.filter(onScreen).map(function (o) { return o.parentNode; }));
      (function walk(node) {
        Array.prototype.forEach.call(node.children, function (n) {
          if (keep.indexOf(n) !== -1 || n.hasAttribute('inert')) { return; }
          if (keep.some(function (k) { return n.contains(k); })) { walk(n); return; }
          n.setAttribute('inert', '');
          madeInert.push(n);
        });
      })(document.body);
      panel.setAttribute('aria-modal', keep.length === 1 ? 'true' : 'false');
    }

    function openPanel(from) {
      lastOpener = from || launcher;
      panel.hidden = false;
      setInert(true);
      setExpanded('true');
      if (!state.greeted) {
        state.greeted = true;
        addBot([
          'Hi. This is the demo assistant for ' + cfg.business +
          (cfg.trade ? ', ' + articleFor(cfg.trade) + cfg.trade + ' business' : '') +
          (cfg.city ? ' in ' + cfg.city : '') +
          '. Pick an option or type a question.'
        ]);
      }
      title.focus();
    }

    function closePanel(returnFocus) {
      panel.hidden = true;
      setInert(false);
      setExpanded('false');
      if (returnFocus) {
        // back to the control that opened the panel; if it has left the screen, the first one still on it
        var target = onScreen(lastOpener) ? lastOpener : controls.filter(onScreen)[0];
        if (target) { target.focus(); }
      }
    }

    controls.forEach(function (c) {
      c.addEventListener('click', function () {
        if (isOpen()) { closePanel(true); } else { openPanel(c); }
      });
    });

    closeBtn.addEventListener('click', function () { closePanel(true); });

    // With the page inert, a tap outside the panel (the floating launcher too) lands on <body> or
    // <html>: close the chat, so the button that opened it still works as a toggle. A tap on the live
    // bar's other links (Call, Estimate) closes the chat and then does what it says, so the call
    // starts, or the request form it scrolls to is live and not under the panel.
    document.addEventListener('click', function (e) {
      if (!isOpen()) { return; }
      var t = e.target;
      if (t === document.body || t === document.documentElement) { closePanel(true); return; }
      var link = t.closest ? t.closest('a, button') : null;
      if (link && controls.indexOf(link) === -1 && !panel.contains(link)) { closePanel(false); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { closePanel(true); }
    });

    // Keep Tab and Shift+Tab inside the open panel.
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') { return; }
      var items = [closeBtn].concat(Array.prototype.slice.call(quick.querySelectorAll('button')), [input, send]);
      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;
      if (e.shiftKey && (active === first || active === title || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  function start() {
    var cfg;
    try {
      cfg = readConfig();
    } catch (err) {
      console.error(err.message);
      return;
    }
    init(cfg);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
