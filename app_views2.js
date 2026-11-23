'use strict';

  /* ---------- Wallet ---------- */
  async function viewWallet() {
    page('wallet', t('nav.wallet'), '<p class="muted">' + esc(t('loading')) + '</p>');
    var bal = await guard(function () { return rpc('get_wallet'); });
    if (bal === null) { return; }
    var tx = await state.sb.from('wallet_transactions').select('amount_cents,kind,created_at').order('created_at', { ascending: false }).limit(50);
    var rows = tx.data || [];
    page('wallet', t('nav.wallet'),
      '<div class="card"><div class="muted">' + esc(t('w.balance')) + '</div><h1>' + esc(money(bal)) + '</h1><p class="muted">' + esc(t('w.beta')) + '</p><div class="sp"></div><button class="btn" id="addf">' + esc(t('w.add')) + '</button></div>' +
      '<h2>' + esc(t('w.history')) + '</h2>' + (rows.length ? rows.map(function (r) {
        return '<div class="card spread"><div><div>' + esc(t('kind.' + r.kind)) + '</div><div class="muted">' + esc(fmtDateTime(r.created_at)) + '</div></div><b class="' + (r.amount_cents >= 0 ? 'good' : 'bad') + '">' + esc(money(r.amount_cents)) + '</b></div>';
      }).join('') : '<p class="muted">' + esc(t('w.none')) + '</p>'));
    $('#addf').addEventListener('click', async function () {
      var v = window.prompt(t('w.addPrompt'));
      if (v === null) { return; }
      var cents = Math.round(parseFloat(v) * 100);
      if (!(cents > 0)) { toast(t('err.INVALID_AMOUNT')); return; }
      var ok = await guard(function () { return rpc('add_funds', { p_amount_cents: cents }); });
      if (ok !== null) { viewWallet(); }
    });
  }

  /* ---------- Profile ---------- */
  async function viewProfile() {
    page('profile', t('nav.profile'), '<p class="muted">' + esc(t('loading')) + '</p>');
    var mine = await state.sb.from('listings').select('id,title,city,price_cents,period,status').eq('host_id', state.user.id).order('created_at', { ascending: false });
    var blocked = [];
    try { blocked = await rpc('my_blocked_users'); } catch (e) { blocked = []; }
    var strikes = null;
    try { strikes = await rpc('get_my_strikes'); } catch (e) { strikes = null; }
    var pr = state.profile || {};
    var listings = (mine.data || []);
    page('profile', t('nav.profile'),
      '<div class="card"><b>' + esc(pr.full_name) + '</b><div class="muted">' + esc(pr.email) + '</div><div class="muted" dir="ltr">' + esc(pr.phone || '') + '</div>' +
      (strikes ? '<p class="bad">' + esc(t('p.strikes', { n: strikes })) + '</p>' : '') + '</div>' +
      '<div class="card spread"><span>' + esc(t('p.language')) + '</span><button class="btn small ghost" id="lang">' + (lang === 'ar' ? 'English' : 'العربية') + '</button></div>' +
      '<h2>' + esc(t('p.myListings')) + '</h2>' + (listings.length ? listings.map(function (l) {
        return '<div class="card click" data-ml="' + esc(l.id) + '"><div class="spread"><b>' + esc(l.title) + '</b><span class="badge ' + (l.status === 'AVAILABLE' ? '' : 'off') + '">' + esc(l.status) + '</span></div><div class="muted">' + esc(cityLabel(l.city)) + ' · ' + esc(money(l.price_cents)) + ' / ' + esc(t('per.' + l.period)) + '</div></div>';
      }).join('') : '<p class="muted">' + esc(t('p.none')) + '</p>') +
      '<h2>' + esc(t('p.blocked')) + '</h2>' + ((blocked && blocked.length) ? blocked.map(function (u) {
        return '<div class="card spread"><span>' + esc(u.full_name) + '</span><button class="btn small ghost" data-ub="' + esc(u.user_id) + '">' + esc(t('p.unblock')) + '</button></div>';
      }).join('') : '<p class="muted">' + esc(t('p.none')) + '</p>') +
      '<div class="sp"></div>' + (state.isAdmin ? '<button class="btn warn" id="adm" style="width:100%">' + esc(t('p.admin')) + '</button><div class="sp"></div>' : '') +
      '<button class="btn danger" id="del" style="width:100%">' + esc(t('p.delete')) + '</button><div class="sp"></div>' +
      '<button class="btn ghost" id="out" style="width:100%">' + esc(t('p.logout')) + '</button>');
    $('#lang').addEventListener('click', function () { setLang(lang === 'ar' ? 'en' : 'ar'); viewProfile(); });
    $$('[data-ml]').forEach(function (c) {
      c.addEventListener('click', async function () {
        try {
          var all = await fetchListings({ city: '', period: '', min: null, max: null });
          all.forEach(function (r) { state.cache[r.id] = r; });
        } catch (e) { toast(errMsg(e)); }
        go('listing', { id: c.getAttribute('data-ml') });
      });
    });
    $$('[data-ub]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var ok = await guard(function () { return rpcVoid('unblock_user', { p_user_id: b.getAttribute('data-ub') }); });
        if (ok !== null) { viewProfile(); }
      });
    });
    var adm = $('#adm');
    if (adm) { adm.addEventListener('click', function () { go('admin', { tab: 'disputes' }); }); }
    $('#del').addEventListener('click', async function () {
      if (!window.confirm(t('p.deleteAsk'))) { return; }
      var ok = await guard(function () { return rpc('request_account_deletion', { p_reason: null }); });
      if (ok) { toast(t('p.deleted')); }
    });
    $('#out').addEventListener('click', async function () {
      await state.sb.auth.signOut();
      state.user = null; state.profile = null; state.isAdmin = false; state.cache = {};
      viewAuth('login');
    });
  }

  /* ---------- Admin ---------- */
  async function viewAdmin(p) {
    var tab = p.tab || 'disputes';
    var tabs = [['disputes', 'a.disputes'], ['reports', 'a.reports'], ['deletions', 'a.deletions'], ['tools', 'a.tools']];
    var head = '<div class="chips">' + tabs.map(function (x) {
      return '<button class="chip ' + (tab === x[0] ? 'on' : '') + '" data-t="' + x[0] + '">' + esc(t(x[1])) + '</button>';
    }).join('') + '</div>';
    page('profile', t('p.admin'), head + '<div id="ab"><p class="muted">' + esc(t('loading')) + '</p></div>', true);
    $$('[data-t]').forEach(function (b) { b.addEventListener('click', function () { go('admin', { tab: b.getAttribute('data-t') }, true); }); });
    var box = $('#ab');
    var none = '<p class="muted">' + esc(t('a.none')) + '</p>';

    if (tab === 'disputes') {
      var d = await guard(function () { return rpc('admin_list_disputes'); });
      if (!d) { return; }
      box.innerHTML = d.length ? d.map(function (x) {
        return '<div class="card"><b>' + esc(x.listing_title) + '</b> <span class="badge ' + (x.dispute_status === 'OPEN' ? '' : 'off') + '">' + esc(x.dispute_status) + '</span>' +
          '<div class="muted">' + esc(x.renter_name) + ' → ' + esc(x.host_name) + ' · ' + esc(x.opened_by_name) + '</div><p class="pre">' + esc(x.reason) + '</p>' +
          '<div class="muted">' + esc(t('a.escrow')) + ': ' + esc(money(x.escrow_cents)) + ' ' + esc(t('a.of')) + ' ' + esc(money(x.total_cents)) + '</div>' +
          '<div class="row" style="margin-top:8px"><button class="btn small ghost" data-chat="' + esc(x.booking_id) + '">' + esc(t('a.showChat')) + '</button></div><div id="c' + esc(x.booking_id) + '"></div>' +
          (x.dispute_status === 'OPEN' ? '<label>' + esc(t('a.hostGets')) + '</label><input type="number" step="0.01" min="0" id="h' + esc(x.booking_id) + '" value="' + (x.escrow_cents / 100) + '"><label>' + esc(t('a.note')) + '</label><input id="n' + esc(x.booking_id) + '"><div class="sp"></div><button class="btn small" data-res="' + esc(x.booking_id) + '">' + esc(t('a.resolve')) + '</button>' : '') + '</div>';
      }).join('') : none;
      $$('[data-chat]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var id = b.getAttribute('data-chat');
          var m = await guard(function () { return rpc('admin_dispute_messages', { p_booking_id: id }); });
          if (m) { $('#c' + id).innerHTML = m.map(function (r) { return '<div class="msg"><b>' + esc(r.sender_name) + '</b>: ' + esc(r.body) + '</div>'; }).join('') || none; }
        });
      });
      $$('[data-res]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var id = b.getAttribute('data-res');
          var cents = Math.round(parseFloat($('#h' + id).value) * 100);
          var ok = await guard(function () { return rpcVoid('admin_resolve_dispute', { p_booking_id: id, p_host_cents: cents, p_note: $('#n' + id).value }); });
          if (ok !== null) { viewAdmin(p); }
        });
      });
    } else if (tab === 'reports') {
      var r = await guard(function () { return rpc('admin_list_reports'); });
      if (!r) { return; }
      box.innerHTML = r.length ? r.map(function (x) {
        return '<div class="card"><b>' + esc(x.target_type) + '</b> <span class="badge ' + (x.status === 'OPEN' ? '' : 'off') + '">' + esc(x.status) + '</span><div class="muted">' + esc(x.reporter_name) + ' · ' + esc(fmtDateTime(x.created_at)) + '</div><p class="pre">' + esc(x.reason) + '</p>' +
          (x.status === 'OPEN' ? '<div class="row"><button class="btn small" data-rs="' + esc(x.id) + '">' + esc(t('a.resolve')) + '</button>' +
          (x.target_type === 'LISTING' ? '<button class="btn small danger" data-rm="' + esc(x.target_id) + '">' + esc(t('a.removeListing')) + '</button>' : '') + '</div>' : '') + '</div>';
      }).join('') : none;
      $$('[data-rs]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var ok = await guard(function () { return rpcVoid('admin_resolve_report', { p_report_id: b.getAttribute('data-rs'), p_note: null }); });
          if (ok !== null) { viewAdmin(p); }
        });
      });
      $$('[data-rm]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var ok = await guard(function () { return rpcVoid('admin_remove_listing', { p_listing_id: b.getAttribute('data-rm') }); });
          if (ok !== null) { toast('OK'); }
        });
      });
    } else if (tab === 'deletions') {
      var dl = await guard(function () { return rpc('admin_list_deletion_requests'); });
      if (!dl) { return; }
      box.innerHTML = dl.length ? dl.map(function (x) {
        return '<div class="card"><b>' + esc(x.full_name) + '</b> <span class="badge ' + (x.status === 'PENDING' ? '' : 'off') + '">' + esc(x.status) + '</span><div class="muted">' + esc(x.email) + ' · ' + esc(x.phone) + '</div>' +
          (x.status === 'PENDING' ? '<button class="btn small" data-dn="' + esc(x.id) + '">' + esc(t('a.done')) + '</button>' : '') + '</div>';
      }).join('') : none;
      $$('[data-dn]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var ok = await guard(function () { return rpcVoid('admin_mark_deletion_done', { p_request_id: b.getAttribute('data-dn') }); });
          if (ok !== null) { viewAdmin(p); }
        });
      });
    } else {
      var rev = await guard(function () { return rpc('admin_revenue'); });
      var rv = rev && rev[0];
      box.innerHTML = '<div class="card"><b>' + esc(t('a.revenue')) + '</b>' + (rv ? '<p>' + esc(money(rv.commission_cents)) + ' (commission)</p><p>' + esc(money(rv.listing_fee_cents)) + ' (listing fees)</p><p class="muted">' + esc(fmtDateTime(rv.app_time)) + '</p>' : '') + '</div>' +
        '<div class="card"><b>' + esc(t('a.adv')) + '</b><div class="row" style="margin-top:8px"><button class="btn small" data-adv="1 hour">+1 hour</button><button class="btn small" data-adv="1 day">+1 day</button><button class="btn small" data-adv="3 days">+3 days</button><button class="btn small" data-adv="1 month">+1 month</button></div></div>';
      $$('[data-adv]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var ok = await guard(function () { return rpc('admin_advance_clock', { p_interval: b.getAttribute('data-adv') }); });
          if (ok) { toast(fmtDateTime(ok)); viewAdmin(p); }
        });
      });
    }
  }

  /* ---------- Router ---------- */
  function renderView() {
    clearInterval(state.timer);
    if (!state.user) { viewAuth('login'); return; }
    var v = state.view;
    if (v.name === 'listing') { viewListing(v.params); }
    else if (v.name === 'create') { viewCreate(); }
    else if (v.name === 'bookings') { viewBookings(); }
    else if (v.name === 'chat') { viewChat(v.params); }
    else if (v.name === 'review') { viewReview(v.params); }
    else if (v.name === 'wallet') { viewWallet(); }
    else if (v.name === 'profile') { viewProfile(); }
    else if (v.name === 'admin') { viewAdmin(v.params); }
    else { viewExplore(); }
  }

  /* ---------- Offline overlay ---------- */
  function syncOffline() { document.getElementById('offline').hidden = navigator.onLine; }
  window.addEventListener('online', function () { syncOffline(); if (navigator.onLine && state.user) { renderView(); } });
  window.addEventListener('offline', syncOffline);
  document.getElementById('offRetry').addEventListener('click', function () {
    syncOffline();
    if (navigator.onLine && state.user) { renderView(); }
  });

  /* ---------- Boot ---------- */
  async function boot() {
    applyLang();
    syncOffline();
    if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf('PASTE') === 0 || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.indexOf('PASTE') === 0) {
      app.innerHTML = '<div class="card"><h2>' + esc(cfg.APP_NAME || 'Luplex') + '</h2><p>' + esc(t('setup')) + '</p></div>';
      return;
    }
    if (!window.supabase) {
      app.innerHTML = '<div class="card"><p>' + esc(t('off.msg')) + '</p></div>';
      return;
    }
    state.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    var s = await state.sb.auth.getSession();
    if (s.data && s.data.session) { await afterLogin(); } else { viewAuth('login'); }
  }

  boot();
// END OF FILE app_views2.js
