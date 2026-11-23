'use strict';

  var cfg = window.APP_CONFIG || {};
  var app = document.getElementById('app');

  var CITIES = [
    ['Cairo', 'القاهرة'], ['Giza', 'الجيزة'], ['Alexandria', 'الإسكندرية'], ['New Cairo', 'القاهرة الجديدة'],
    ['6th of October', 'السادس من أكتوبر'], ['Sheikh Zayed', 'الشيخ زايد'], ['North Coast', 'الساحل الشمالي'],
    ['Ain Sokhna', 'العين السخنة'], ['Hurghada', 'الغردقة'], ['Sharm El Sheikh', 'شرم الشيخ'], ['Dahab', 'دهب'],
    ['Marsa Alam', 'مرسى علم'], ['Luxor', 'الأقصر'], ['Aswan', 'أسوان'], ['Port Said', 'بورسعيد'],
    ['Mansoura', 'المنصورة'], ['Tanta', 'طنطا'], ['Other', 'أخرى']
  ];


  var lang = 'en';
  try {
    var saved = localStorage.getItem('lang');
    lang = saved || ((navigator.language || 'en').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en');
  } catch (e) {
    lang = (navigator.language || 'en').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  function t(key, vars) {
    var s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    }
    return s;
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = cfg.APP_NAME || 'Luplex';
    document.getElementById('offTitle').textContent = t('off.title');
    document.getElementById('offMsg').textContent = t('off.msg');
    document.getElementById('offRetry').textContent = t('retry');
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(cents) {
    var n = Number(cents || 0) / 100;
    return n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + t('currency');
  }

  function fmtDate(v) {
    if (!v) { return ''; }
    var d = new Date(v);
    return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtDateTime(v) {
    var d = new Date(v);
    return d.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function cityLabel(c) {
    for (var i = 0; i < CITIES.length; i++) {
      if (CITIES[i][0].toLowerCase() === String(c).toLowerCase()) { return lang === 'ar' ? CITIES[i][1] : CITIES[i][0]; }
    }
    return c;
  }

  function cairoToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  function errMsg(error) {
    var m = error && error.message ? String(error.message) : '';
    var key = 'err.' + m.trim();
    if (I18N.en[key]) { return t(key); }
    return t('err.generic');
  }

  var state = {
    sb: null, user: null, profile: null, isAdmin: false, view: { name: 'explore', params: {} },
    filters: { city: '', period: '', min: null, max: null }, cache: {}, timer: null
  };

  async function rpc(name, args) {
    var res = await state.sb.rpc(name, args || {});
    if (res.error) { throw res.error; }
    return res.data;
  }

  async function rpcVoid(name, args) {
    var res = await state.sb.rpc(name, args || {});
    if (res.error) { throw res.error; }
    return true;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function go(name, params, replace) {
    state.view = { name: name, params: params || {} };
    var st = { name: name, params: params || {} };
    if (replace) { history.replaceState(st, ''); } else { history.pushState(st, ''); }
    renderView();
  }

  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.name) { state.view = e.state; renderView(); }
  });

  function navHtml(active) {
    var items = [['explore', 'nav.explore'], ['bookings', 'nav.bookings'], ['wallet', 'nav.wallet'], ['profile', 'nav.profile']];
    return '<nav>' + items.map(function (it) {
      return '<button data-nav="' + it[0] + '" class="' + (active === it[0] ? 'on' : '') + '">' + esc(t(it[1])) + '</button>';
    }).join('') + '</nav>';
  }

  function page(active, title, body, showBack) {
    app.innerHTML =
      '<div class="top"><div class="row">' +
      (showBack ? '<button class="btn small ghost" id="backBtn">←</button>' : '') +
      '<h1>' + esc(title) + '</h1></div></div>' + body + (state.user ? navHtml(active) : '');
    $$('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.getAttribute('data-nav')); });
    });
    var back = $('#backBtn');
    if (back) { back.addEventListener('click', function () { history.back(); }); }
  }

  async function guard(fn) {
    try { return await fn(); } catch (error) { toast(errMsg(error)); return null; }
  }

  function compressImage(file) {
    return new Promise(function (resolve) {
      (async function () {
        var bitmap;
        try {
          try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
          catch (e) { bitmap = await createImageBitmap(file); }
        } catch (e2) { resolve(null); return; }
        var MAX = 300 * 1024, TARGET = 280 * 1024, side = 1200;
        while (side >= 640) {
          var scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
          var w = Math.max(1, Math.round(bitmap.width * scale));
          var h = Math.max(1, Math.round(bitmap.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(bitmap, 0, 0, w, h);
          var q = 0.70, blob = null;
          while (q >= 0.40) {
            blob = await new Promise(function (r) { canvas.toBlob(r, 'image/jpeg', q); });
            if (!blob) { break; }
            if (blob.size <= TARGET) { if (bitmap.close) { bitmap.close(); } resolve(blob); return; }
            q -= 0.07;
          }
          if (blob && blob.size <= MAX) { if (bitmap.close) { bitmap.close(); } resolve(blob); return; }
          side = Math.round(side * 0.85);
        }
        if (bitmap.close) { bitmap.close(); }
        resolve(null);
      })().catch(function () { resolve(null); });
    });
  }

  function countWords(s) {
    var x = String(s).trim();
    return x === '' ? 0 : x.split(/\s+/).length;
  }

  /* ---------- Auth ---------- */
  function viewAuth(mode) {
    var signup = mode === 'signup';
    app.innerHTML =
      '<div class="top"><h1>' + esc(cfg.APP_NAME || 'Luplex') + '</h1><button class="btn small ghost" id="langBtn">' + (lang === 'ar' ? 'EN' : 'عربي') + '</button></div>' +
      '<p class="muted">' + esc(t('auth.tagline')) + '</p>' +
      '<div class="card"><h2>' + esc(signup ? t('auth.signup') : t('auth.login')) + '</h2>' +
      (signup ? '<label>' + esc(t('auth.name')) + '</label><input id="name" autocomplete="name">' : '') +
      '<label>' + esc(t('auth.email')) + '</label><input id="email" type="email" autocomplete="email">' +
      (signup ? '<label>' + esc(t('auth.phone')) + '</label><input id="phone" type="tel" autocomplete="tel" placeholder="+20…">' : '') +
      '<label>' + esc(t('auth.password')) + '</label><input id="pass" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '">' +
      '<div class="sp"></div><button class="btn" id="go" style="width:100%">' + esc(signup ? t('auth.signup') : t('auth.login')) + '</button>' +
      '<div class="sp"></div><button class="btn ghost" id="swap" style="width:100%">' + esc(signup ? t('auth.haveAccount') : t('auth.noAccount')) + '</button></div>';
    $('#langBtn').addEventListener('click', function () { setLang(lang === 'ar' ? 'en' : 'ar'); viewAuth(mode); });
    $('#swap').addEventListener('click', function () { viewAuth(signup ? 'login' : 'signup'); });
    $('#go').addEventListener('click', async function () {
      var btn = $('#go');
      var email = $('#email').value.trim().toLowerCase();
      var pass = $('#pass').value;
      btn.disabled = true;
      try {
        if (signup) {
          var name = $('#name').value.trim();
          var phone = $('#phone').value.replace(/[\s()-]/g, '');
          if (name.length < 2 || name.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?[0-9]{7,15}$/.test(phone) || pass.length < 6) {
            toast(t('auth.invalid')); btn.disabled = false; return;
          }
          var free = await rpc('check_phone_available', { p_phone: phone });
          if (!free) { toast(t('auth.phoneTaken')); btn.disabled = false; return; }
          var su = await state.sb.auth.signUp({ email: email, password: pass, options: { data: { full_name: name, phone: phone } } });
          if (su.error) { toast(su.error.message); btn.disabled = false; return; }
          if (!su.data.session) { toast(t('auth.checkEmail')); viewAuth('login'); return; }
        } else {
          var li = await state.sb.auth.signInWithPassword({ email: email, password: pass });
          if (li.error) { toast(li.error.message); btn.disabled = false; return; }
        }
        await afterLogin();
      } catch (error) {
        toast(errMsg(error));
        btn.disabled = false;
      }
    });
  }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem('lang', l); } catch (e) { /* storage unavailable */ }
    applyLang();
  }

  async function afterLogin() {
    var s = await state.sb.auth.getSession();
    if (!s.data.session) { viewAuth('login'); return; }
    state.user = s.data.session.user;
    var p = await state.sb.from('profiles').select('full_name,email,phone,created_at').eq('id', state.user.id).single();
    state.profile = p.data || { full_name: '', email: state.user.email };
    try { state.isAdmin = (await rpc('is_admin')) === true; } catch (e) { state.isAdmin = false; }
    go('explore', {}, true);
  }

  /* ---------- Explore ---------- */
  async function fetchListings(f) {
    var res = await state.sb.rpc('list_listings', { p_city: f.city || null, p_period: f.period || null, p_min_cents: f.min, p_max_cents: f.max });
    if (res.error && (res.error.code === 'PGRST202' || /Could not find the function/i.test(res.error.message || ''))) {
      res = await state.sb.rpc('list_listings', { p_city: f.city || null });
    }
    if (res.error) { throw res.error; }
    var rows = res.data || [];
    rows.forEach(function (r) { state.cache[r.id] = r; });
    return rows;
  }

  function cardHtml(l) {
    var img = l.images && l.images[0] ? '<img loading="lazy" src="' + esc(l.images[0]) + '" onerror="this.style.display=\'none\'">' : '';
    var rating = l.avg_rating ? '★ ' + Number(l.avg_rating).toFixed(1) + ' (' + l.review_count + ')' : t('l.noRating');
    return '<div class="card click listing" data-id="' + esc(l.id) + '">' + img +
      '<div class="spread"><b>' + esc(l.title) + '</b><span class="price">' + esc(money(l.price_cents)) + ' / ' + esc(t('per.' + l.period)) + '</span></div>' +
      '<div class="muted">' + esc(cityLabel(l.city)) + ' · ' + esc(rating) + (l.status === 'RENTED' ? ' · ' + esc(t('l.rented')) : '') + '</div>' +
      '<div class="muted">' + esc(t('l.host')) + ': ' + esc(l.host_name) + (l.host_verified ? '<span class="badge">' + esc(t('l.verified')) + '</span>' : '') + '</div></div>';
  }

  async function viewExplore() {
    var f = state.filters;
    page('explore', t('nav.explore'),
      '<div class="searchbar"><input id="q" type="search" placeholder="' + esc(t('explore.search')) + '" value="' + esc(f.city) + '"><button class="btn small" id="qgo">' + esc(t('explore.go')) + '</button></div>' +
      '<div class="chips" id="chips"></div><div class="chips" id="periods"></div><div id="range"></div>' +
      '<div id="list" class="muted">' + esc(t('loading')) + '</div>' +
      '<button class="fab" id="newl">+ ' + esc(t('explore.list')) + '</button>');

    $('#newl').addEventListener('click', function () { go('create'); });
    function runSearch() { f.city = $('#q').value.trim(); viewExplore(); }
    $('#qgo').addEventListener('click', runSearch);
    $('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { runSearch(); } });

    var periods = [['', t('explore.all')], ['NIGHT', t('tab.NIGHT')], ['MONTH', t('tab.MONTH')], ['YEAR', t('tab.YEAR')]];
    $('#periods').innerHTML = periods.map(function (p) {
      return '<button class="chip ' + (f.period === p[0] ? 'on' : '') + '" data-p="' + p[0] + '">' + esc(p[1]) + '</button>';
    }).join('');
    $$('[data-p]').forEach(function (b) {
      b.addEventListener('click', function () { f.period = b.getAttribute('data-p'); f.min = null; f.max = null; viewExplore(); });
    });

    guard(async function () {
      try {
        var cities = await rpc('list_cities');
        $('#chips').innerHTML = '<button class="chip ' + (f.city === '' ? 'on' : '') + '" data-c="">' + esc(t('explore.all')) + '</button>' +
          (cities || []).map(function (c) {
            return '<button class="chip ' + (f.city.toLowerCase() === c.city.toLowerCase() ? 'on' : '') + '" data-c="' + esc(c.city) + '">' + esc(cityLabel(c.city)) + ' (' + c.listing_count + ')</button>';
          }).join('');
        $$('[data-c]').forEach(function (b) {
          b.addEventListener('click', function () { f.city = b.getAttribute('data-c'); viewExplore(); });
        });
      } catch (e) { $('#chips').innerHTML = ''; }

      try {
        var pr = await rpc('price_range', { p_period: f.period || null });
        var r = pr && pr[0];
        if (r && r.min_cents !== null && r.max_cents !== null && r.max_cents > r.min_cents) {
          var lo = Math.floor(r.min_cents / 100), hi = Math.ceil(r.max_cents / 100);
          var curMin = f.min === null ? lo : Math.max(lo, Math.floor(f.min / 100));
          var curMax = f.max === null ? hi : Math.min(hi, Math.ceil(f.max / 100));
          var step = Math.max(1, Math.round((hi - lo) / 100));
          $('#range').innerHTML = '<div class="card"><div class="spread"><b>' + esc(t('explore.price')) + '</b><span class="muted" id="rl"></span></div>' +
            '<div class="range2"><input type="range" id="rmin" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + curMin + '"><input type="range" id="rmax" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + curMax + '"></div></div>';
          var label = function () {
            var a = Number($('#rmin').value), b = Number($('#rmax').value);
            $('#rl').textContent = Math.min(a, b) + ' – ' + Math.max(a, b) + ' ' + t('currency');
          };
          label();
          $('#rmin').addEventListener('input', label);
          $('#rmax').addEventListener('input', label);
          var apply = function () {
            var a = Number($('#rmin').value), b = Number($('#rmax').value);
            f.min = Math.min(a, b) * 100; f.max = Math.max(a, b) * 100;
            loadList();
          };
          $('#rmin').addEventListener('change', apply);
          $('#rmax').addEventListener('change', apply);
        }
      } catch (e) { $('#range').innerHTML = ''; }

      await loadList();
    });

    async function loadList() {
      await guard(async function () {
        var rows = await fetchListings(f);
        var el = $('#list');
        if (!el) { return; }
        el.className = '';
        el.innerHTML = rows.length ? rows.map(cardHtml).join('') : '<p class="muted">' + esc(t('explore.none')) + '</p>';
        $$('.listing', el).forEach(function (c) {
          c.addEventListener('click', function () { go('listing', { id: c.getAttribute('data-id') }); });
        });
      });
    }
  }
// END OF FILE app_core.js
