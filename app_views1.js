'use strict';

  /* ---------- Listing detail ---------- */
  async function viewListing(p) {
    page('explore', '', '<p class="muted">' + esc(t('loading')) + '</p>', true);
    var l = state.cache[p.id];
    if (!l) {
      var rows = await guard(function () { return fetchListings({ city: '', period: '', min: null, max: null }); });
      l = (rows || []).filter(function (x) { return x.id === p.id; })[0];
    }
    if (!l) { page('explore', t('err.LISTING_NOT_FOUND'), '', true); return; }
    var mine = l.host_id === state.user.id;
    var contact = [];
    var reviews = [];
    try { contact = await rpc('host_contact', { p_listing_id: l.id }); } catch (e) { contact = []; }
    try { reviews = await rpc('list_reviews', { p_listing_id: l.id }); } catch (e) { reviews = []; }
    var gallery = (l.images || []).map(function (u) { return '<img src="' + esc(u) + '" onerror="this.style.display=\'none\'">'; }).join('');
    var contactHtml = contact && contact.length
      ? '<div class="card"><b>' + esc(t('l.contact')) + '</b><p>' + esc(contact[0].full_name) + '</p><p>' + esc(contact[0].email) + '</p><p dir="ltr">' + esc(contact[0].phone) + '</p></div>'
      : '<div class="card muted"><b>' + esc(t('l.contact')) + '</b><br>' + esc(t('l.contactHidden')) + '</div>';
    var revHtml = reviews && reviews.length ? reviews.map(function (r) {
      return '<div class="card"><div class="spread"><b>' + esc(r.author_name) + '</b><span>' + '★'.repeat(r.rating) + '</span></div><p class="pre">' + esc(r.body) + '</p>' +
        (r.status === 'PENDING_HOLD' ? '<p class="muted">' + esc(t('r.pending')) + '</p>' : '') +
        (!r.is_mine ? '<button class="btn small ghost" data-rr="' + esc(r.id) + '">' + esc(t('l.report')) + '</button>' : '') + '</div>';
    }).join('') : '<p class="muted">' + esc(t('l.noReviews')) + '</p>';

    var bookHtml = '';
    if (mine) {
      bookHtml = '<div class="card muted">' + esc(t('l.own')) + '</div>' +
        (l.status === 'RENTED' ? '<button class="btn warn" id="relist">' + esc(t('l.relist')) + '</button>' : '');
    } else if (l.status === 'AVAILABLE') {
      var maxUnits = { NIGHT: 365, MONTH: 36, YEAR: 10 }[l.period];
      bookHtml = '<div class="card"><h3>' + esc(t('l.book')) + '</h3>' +
        '<label>' + esc(t('l.start')) + '</label><input type="date" id="bstart" min="' + cairoToday() + '" value="' + cairoToday() + '">' +
        '<label>' + esc(t('l.units')) + ' (' + esc(t('per.' + l.period)) + ', 1-' + maxUnits + ')</label><input type="number" id="bunits" min="1" max="' + maxUnits + '" value="1">' +
        '<div id="quote" class="muted" style="margin-top:10px"></div>' +
        '<p class="muted" style="margin-top:8px">' + esc(t('l.escrowNote')) + '</p>' +
        '<div class="sp"></div><button class="btn" id="bgo" style="width:100%" disabled>' + esc(t('l.confirmBook')) + '</button></div>';
    } else {
      bookHtml = '<div class="card muted">' + esc(t('l.rented')) + '</div>';
    }

    page('explore', l.title,
      '<div class="gallery">' + gallery + '</div>' +
      '<div class="spread" style="margin-top:10px"><span class="price">' + esc(money(l.price_cents)) + ' / ' + esc(t('per.' + l.period)) + '</span><span class="muted">' + esc(cityLabel(l.city)) + '</span></div>' +
      '<p class="muted">' + esc(t('l.host')) + ': ' + esc(l.host_name) + (l.host_verified ? '<span class="badge">' + esc(t('l.verified')) + '</span>' : '') + '</p>' +
      '<p class="pre" style="margin:12px 0">' + esc(l.description) + '</p>' + contactHtml + bookHtml +
      (!mine ? '<div class="row" style="margin-top:10px"><button class="btn small ghost" id="rep">' + esc(t('l.report')) + '</button><button class="btn small danger" id="blk">' + esc(t('l.block')) + '</button></div>' : '') +
      '<h2>' + esc(t('l.reviews')) + '</h2>' + revHtml, true);

    $$('[data-rr]').forEach(function (b) {
      b.addEventListener('click', function () { doReport('REVIEW', b.getAttribute('data-rr')); });
    });
    var rep = $('#rep');
    if (rep) { rep.addEventListener('click', function () { doReport('LISTING', l.id); }); }
    var blk = $('#blk');
    if (blk) {
      blk.addEventListener('click', async function () {
        if (!window.confirm(t('l.blockAsk'))) { return; }
        var ok = await guard(function () { return rpcVoid('block_user', { p_user_id: l.host_id }); });
        if (ok !== null) { history.back(); }
      });
    }
    var rel = $('#relist');
    if (rel) {
      rel.addEventListener('click', async function () {
        var ok = await guard(function () { return rpcVoid('relist_listing', { p_listing_id: l.id }); });
        if (ok !== null) { toast(t('b.relisted')); delete state.cache[l.id]; viewListing(p); }
      });
    }

    var bgo = $('#bgo');
    if (bgo) {
      var lastQuote = null;
      var refreshQuote = async function () {
        bgo.disabled = true;
        var units = parseInt($('#bunits').value, 10);
        var start = $('#bstart').value;
        var q = await guard(function () { return rpc('quote_booking', { p_listing_id: l.id, p_units: units, p_starts_on: start }); });
        var box = $('#quote');
        if (!q || !q[0]) { box.textContent = ''; return; }
        lastQuote = q[0];
        box.innerHTML = '<div class="spread"><span>' + esc(t('l.total')) + '</span><b>' + esc(money(lastQuote.total_cents)) + '</b></div>' +
          '<div class="spread"><span>' + esc(t('l.fee')) + ' (' + lastQuote.fee_percent + '%)</span><span>' + esc(money(lastQuote.fee_cents)) + '</span></div>' +
          '<div class="spread"><span>' + esc(t('l.escrow')) + '</span><span>' + esc(money(lastQuote.escrow_cents)) + '</span></div>' +
          '<div class="spread"><span>' + esc(t('b.dates', { a: fmtDate(lastQuote.starts_on), b: fmtDate(lastQuote.ends_on) })) + '</span></div>' +
          '<div class="spread"><span>' + esc(t('l.wallet')) + '</span><span class="' + (lastQuote.can_afford ? 'good' : 'bad') + '">' + esc(money(lastQuote.wallet_cents)) + '</span></div>' +
          (lastQuote.can_afford ? '' : '<p class="bad">' + esc(t('l.cantAfford')) + '</p>');
        bgo.disabled = !lastQuote.can_afford;
      };
      $('#bunits').addEventListener('change', refreshQuote);
      $('#bstart').addEventListener('change', refreshQuote);
      refreshQuote();
      bgo.addEventListener('click', async function () {
        bgo.disabled = true;
        var id = await guard(function () {
          return rpc('book_listing', { p_listing_id: l.id, p_units: parseInt($('#bunits').value, 10), p_starts_on: $('#bstart').value });
        });
        if (id) { toast(t('l.booked')); delete state.cache[l.id]; go('bookings', {}, true); } else { bgo.disabled = false; refreshQuote(); }
      });
    }
  }

  async function doReport(type, id) {
    var reason = window.prompt(t('l.reasonPrompt'));
    if (reason === null) { return; }
    var ok = await guard(function () { return rpc('report_content', { p_target_type: type, p_target_id: id, p_reason: reason }); });
    if (ok) { toast(t('l.reported')); }
  }

  /* ---------- Create listing ---------- */
  function viewCreate() {
    var cityOptions = CITIES.map(function (c) { return '<option value="' + esc(c[0]) + '">' + esc(lang === 'ar' ? c[1] : c[0]) + '</option>'; }).join('');
    page('explore', t('explore.list'),
      '<div class="card"><label>' + esc(t('c.title')) + '</label><input id="ctitle" maxlength="80">' +
      '<label>' + esc(t('c.city')) + '</label><select id="ccity">' + cityOptions + '</select>' +
      '<label>' + esc(t('c.desc')) + ' — <span id="wc">0</span> ' + esc(t('c.words')) + '</label><textarea id="cdesc"></textarea>' +
      '<label>' + esc(t('c.period')) + '</label><select id="cper"><option value="NIGHT">' + esc(t('tab.NIGHT')) + '</option><option value="MONTH">' + esc(t('tab.MONTH')) + '</option><option value="YEAR">' + esc(t('tab.YEAR')) + '</option></select>' +
      '<label>' + esc(t('c.price')) + '</label><input id="cprice" type="number" min="1" step="0.01" inputmode="decimal">' +
      '<label>' + esc(t('c.photos')) + '</label><input id="cphotos" type="file" accept="image/*" multiple><div class="thumbs" id="thumbs"></div>' +
      '<div class="sp"></div><button class="btn" id="cpub" style="width:100%">' + esc(t('c.publish')) + '</button><p class="muted" id="cstat"></p></div>', true);

    $('#cdesc').addEventListener('input', function () {
      var n = countWords($('#cdesc').value);
      var el = $('#wc'); el.textContent = n; el.className = n > 399 ? 'bad' : '';
    });
    $('#cphotos').addEventListener('change', function () {
      var files = Array.prototype.slice.call($('#cphotos').files);
      if (files.length > 11) { toast(t('c.maxPhotos')); $('#cphotos').value = ''; $('#thumbs').innerHTML = ''; return; }
      $('#thumbs').innerHTML = files.map(function (f) { return '<img src="' + URL.createObjectURL(f) + '">'; }).join('');
    });
    $('#cpub').addEventListener('click', async function () {
      var btn = $('#cpub'), stat = $('#cstat');
      var title = $('#ctitle').value.trim(), desc = $('#cdesc').value.trim();
      var price = Math.round(parseFloat($('#cprice').value) * 100);
      var files = Array.prototype.slice.call($('#cphotos').files);
      if (title.length < 3 || desc === '' || !(price > 0)) { toast(t('c.fill')); return; }
      if (countWords(desc) > 399) { toast(t('err.DESCRIPTION_TOO_LONG')); return; }
      if (files.length < 1) { toast(t('c.noPhoto')); return; }
      if (files.length > 11) { toast(t('c.maxPhotos')); return; }
      btn.disabled = true;
      try {
        var urls = [];
        for (var i = 0; i < files.length; i++) {
          stat.textContent = t('c.uploading', { n: i + 1, t: files.length });
          var blob = await compressImage(files[i]);
          if (!blob) { toast(t('c.badPhoto')); btn.disabled = false; stat.textContent = ''; return; }
          var path = state.user.id + '/' + Date.now() + '_' + i + '.jpg';
          var up = await state.sb.storage.from('listing-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
          if (up.error) {
            if (/size|large|maximum/i.test(up.error.message || '')) { up.error.message = 'PHOTO_TOO_LARGE'; }
            throw up.error;
          }
          urls.push(state.sb.storage.from('listing-photos').getPublicUrl(path).data.publicUrl);
        }
        stat.textContent = '';
        await rpc('create_listing', {
          p_title: title, p_city: $('#ccity').value, p_description: desc,
          p_period: $('#cper').value, p_price_cents: price, p_images: urls
        });
        toast(t('c.done'));
        state.cache = {};
        go('explore', {}, true);
      } catch (error) {
        toast(errMsg(error));
        btn.disabled = false;
        stat.textContent = '';
      }
    });
  }

  /* ---------- Bookings ---------- */
  async function viewBookings() {
    page('bookings', t('nav.bookings'), '<p class="muted">' + esc(t('loading')) + '</p>');
    var rows = await guard(function () { return rpc('my_bookings'); });
    if (rows === null) { return; }
    var html = rows.length ? rows.map(function (b) {
      var isRenter = b.my_role === 'RENTER';
      var held = b.status === 'ESCROW_HELD';
      var actions = '';
      if (isRenter && held) { actions += '<button class="btn small" data-a="confirm" data-id="' + esc(b.id) + '">' + esc(t('b.confirm')) + '</button>'; }
      if (held) { actions += '<button class="btn small warn" data-a="dispute" data-id="' + esc(b.id) + '">' + esc(t('b.dispute')) + '</button>'; }
      actions += '<button class="btn small ghost" data-a="chat" data-id="' + esc(b.id) + '">' + esc(t('b.chat')) + '</button>';
      if (isRenter) { actions += '<button class="btn small ghost" data-a="review" data-id="' + esc(b.id) + '">' + esc(t('b.review')) + '</button>'; }
      if (!isRenter && (b.status === 'COMPLETED' || b.status === 'RESOLVED')) { actions += '<button class="btn small ghost" data-a="relist" data-lid="' + esc(b.listing_id) + '">' + esc(t('b.relist')) + '</button>'; }
      return '<div class="card"><div class="spread"><b>' + esc(b.listing_title) + '</b><span class="badge ' + (held ? '' : 'off') + '">' + esc(t('b.status.' + b.status)) + '</span></div>' +
        '<div class="muted">' + esc(t('b.role.' + b.my_role)) + ' · ' + esc(b.other_party_name) + '</div>' +
        '<div class="muted">' + esc(t('b.dates', { a: fmtDate(b.starts_on), b: fmtDate(b.ends_on) })) + ' · ' + esc(b.units + ' ' + t('per.' + b.period)) + '</div>' +
        '<div class="spread"><span>' + esc(t('l.total')) + ': <b>' + esc(money(b.total_cents)) + '</b></span><span class="muted">' + esc(t('l.escrow')) + ': ' + esc(money(b.escrow_cents)) + '</span></div>' +
        (held ? '<div class="muted">' + esc(t('b.autoRelease', { d: fmtDate(b.release_at) })) + '</div>' : '') +
        '<div class="row" style="margin-top:8px">' + actions + '</div></div>';
    }).join('') : '<p class="muted">' + esc(t('b.none')) + '</p>';
    page('bookings', t('nav.bookings'), html);
    var byId = {};
    rows.forEach(function (b) { byId[b.id] = b; });
    $$('[data-a]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var a = btn.getAttribute('data-a'), id = btn.getAttribute('data-id'), b = byId[id];
        if (a === 'confirm') {
          if (!window.confirm(t('b.confirmAsk'))) { return; }
          var ok = await guard(function () { return rpcVoid('confirm_stay', { p_booking_id: id }); });
          if (ok !== null) { toast(t('b.released')); viewBookings(); }
        } else if (a === 'dispute') {
          var reason = window.prompt(t('b.disputePrompt'));
          if (reason === null) { return; }
          var ok2 = await guard(function () { return rpc('open_dispute', { p_booking_id: id, p_reason: reason }); });
          if (ok2) { toast(t('b.disputed')); viewBookings(); }
        } else if (a === 'chat') {
          go('chat', { id: id, title: b.listing_title, open: b.status === 'ESCROW_HELD' || b.status === 'DISPUTED' });
        } else if (a === 'review') {
          go('review', { id: id, title: b.listing_title });
        } else if (a === 'relist') {
          var ok3 = await guard(function () { return rpcVoid('relist_listing', { p_listing_id: btn.getAttribute('data-lid') }); });
          if (ok3 !== null) { toast(t('b.relisted')); state.cache = {}; viewBookings(); }
        }
      });
    });
  }

  /* ---------- Chat ---------- */
  function viewChat(p) {
    page('bookings', p.title, '<div id="msgs"><p class="muted">' + esc(t('loading')) + '</p></div>' +
      '<div id="composer"></div>', true);
    var open = p.open;
    async function load() {
      var rows;
      try { rows = await rpc('list_messages', { p_booking_id: p.id }); } catch (error) { return; }
      var box = $('#msgs');
      if (!box) { return; }
      if (rows.length) { open = rows[0].chat_open; }
      box.innerHTML = rows.length ? rows.map(function (m) {
        return '<div class="msg ' + (m.is_mine ? 'me' : '') + '"><div class="muted" style="color:inherit;opacity:.7;font-size:12px">' + esc(m.sender_name) + ' · ' + esc(fmtDateTime(m.created_at)) + '</div>' + esc(m.body) + '</div>';
      }).join('') : '<p class="muted">' + esc(t('ch.none')) + '</p>';
      var comp = $('#composer');
      if (open) {
        if (!comp.firstChild) {
          comp.innerHTML = '<div class="searchbar" style="margin-top:10px"><input id="mtext" maxlength="500" placeholder="' + esc(t('ch.placeholder')) + '"><button class="btn small" id="msend">' + esc(t('ch.send')) + '</button></div>';
          var send = async function () {
            var txt = $('#mtext').value.trim();
            if (!txt) { return; }
            var ok = await guard(function () { return rpc('send_message', { p_booking_id: p.id, p_body: txt }); });
            if (ok) { $('#mtext').value = ''; load(); }
          };
          $('#msend').addEventListener('click', send);
          $('#mtext').addEventListener('keydown', function (e) { if (e.key === 'Enter') { send(); } });
        }
      } else {
        comp.innerHTML = '<p class="muted" style="margin-top:10px">' + esc(t('ch.closed')) + '</p>';
      }
    }
    load();
    state.timer = setInterval(load, 5000);
  }

  /* ---------- Review ---------- */
  function viewReview(p) {
    page('bookings', t('b.review') + ' — ' + p.title,
      '<div class="card"><label>' + esc(t('r.rating')) + '</label><select id="rt"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>' +
      '<label>' + esc(t('r.text')) + '</label><textarea id="rtext" maxlength="500"></textarea><div class="sp"></div>' +
      '<button class="btn" id="rsend" style="width:100%">' + esc(t('r.submit')) + '</button></div>', true);
    $('#rsend').addEventListener('click', async function () {
      var res = await guard(function () { return rpc('submit_review', { p_booking_id: p.id, p_rating: parseInt($('#rt').value, 10), p_body: $('#rtext').value }); });
      if (res) {
        var msg = t('r.sent');
        if (res.masked) { msg += ' ' + t('r.masked'); }
        if (res.strikes) { msg += ' ' + t('r.strike', { n: res.strikes }); }
        toast(msg);
        history.back();
      }
    });
  }
// END OF FILE app_views1.js
