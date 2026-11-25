'use strict';

var ICONS = {
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M12 14h2M16 14h.01M8 18h2M12 18h2"/>',
  wallet: '<path d="M3 8a2 2 0 0 1 2-2h12v3"/><rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="16.5" cy="14" r="1.2"/>',
  user: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5c1.5-2.5 3.5-3.5 5.5-3.5s4 1 5.5 3.5"/>',
  heart: '<path d="M12 20.5s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9.5c0 6-8 11-8 11z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  trash: '<path d="M4 7h16M10 3h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  send: '<path d="M4 12l16-8-6 16-3-6z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>'
};

function icon(name, cls) {
  var p = ICONS[name];
  if (!p) { return ''; }
  return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
}

var ICON_MAP = [
  ['#qgo', 'search'], ['#gqgo', 'search'], ['#newl', 'plus'], ['#bgo', 'check'], ['#rep', 'flag'], ['#blk', 'ban'],
  ['#relist', 'refresh'], ['#dellist', 'trash'], ['#cpub', 'check'], ['#addf', 'plus'], ['#lang', 'globe'],
  ['#out', 'logout'], ['#del', 'trash'], ['#adm', 'shield'], ['#msend', 'send'], ['#rsend', 'send'],
  ['[data-a="confirm"]', 'check'], ['[data-a="dispute"]', 'flag'], ['[data-a="chat"]', 'chat'],
  ['[data-a="review"]', 'star'], ['[data-a="relist"]', 'refresh'], ['[data-rr]', 'flag'], ['[data-rs]', 'check'],
  ['[data-rm]', 'trash'], ['[data-dn]', 'check'], ['[data-res]', 'check'], ['[data-chat]', 'chat'],
  ['[data-del]', 'trash'], ['[data-ub]', 'refresh']
];

function decorate() {
  ICON_MAP.forEach(function (m) {
    $$(m[0]).forEach(function (el) {
      if (el.getAttribute('data-ic')) { return; }
      el.setAttribute('data-ic', '1');
      el.insertAdjacentHTML('afterbegin', icon(m[1]));
    });
  });
  var back = $('#backBtn');
  if (back && !back.getAttribute('data-ic')) {
    back.setAttribute('data-ic', '1');
    back.innerHTML = icon('back', 'flip');
  }
}
// END OF FILE app_icons.js
