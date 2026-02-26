/**
 * Lampa TV — Online Sources Plugin v3.0
 * Источники: Filmix, VeoVeo, ManGo, UaFlix, FXpro, FlixSOD, Alloha, HDRezka, HDVB
 */

(function () {
    'use strict';

    /* ══════════════════════════════════════════════
       КОНФИГ ИСТОЧНИКОВ (без VIP, добавлен Filmix)
    ══════════════════════════════════════════════ */
    var SOURCES = [
        { id: 'filmix',   name: 'Filmix',               voices: 5 },
        { id: 'veoveo',   name: 'VeoVeo',                voices: 1 },
        { id: 'mango',    name: 'ManGo [4K, HDR, +UA]',  voices: 6 },
        { id: 'uaflix',   name: 'UaFlix',                voices: 1 },
        { id: 'fxpro',    name: 'FXpro [4K, HDR, +UA]',  voices: 6 },
        { id: 'flixsod',  name: 'FlixSOD',               voices: 7 },
        { id: 'alloha',   name: 'Alloha [4K]',           voices: 6 },
        { id: 'hdrezka',  name: 'HDRezka',                voices: 7 },
        { id: 'hdvb',     name: 'HDVB',                  voices: 2 }
    ];

    /* ══════════════════════════════════════════════
       ХРАНИЛИЩЕ
    ══════════════════════════════════════════════ */
    function store(key, val) {
        if (val === undefined) {
            try { return Lampa.Storage.get(key, ''); } catch (e) { return ''; }
        }
        try { Lampa.Storage.set(key, val); } catch (e) {}
    }

    /* ══════════════════════════════════════════════
       КОМПОНЕНТ ОНЛАЙН-ПРОСМОТРА
    ══════════════════════════════════════════════ */
    function OnlineComponent(object) {
        var comp        = this;
        var network     = new Lampa.Reguest();
        var scroll      = new Lampa.Scroll({ mask: true, over: true });
        var files       = new Lampa.Explorer(object);
        var last_source = store('online_src_sel') || 'veoveo';

        /* ── Заголовок с кнопкой смены источника ── */
        var currentSrcName = function () {
            var s = SOURCES.find(function (x) { return x.id === last_source; });
            return s ? s.name : last_source;
        };

        files.appendHead(Lampa.Template.get('explorer_filter', {
            title: 'Источник: ' + currentSrcName(),
            icon:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
        }));

        files.onHead = showMenu;

        function showMenu() {
            Lampa.Select.show({
                title: 'Источник',
                items: SOURCES.map(function (s) {
                    return {
                        title:    s.name + '  🎙' + s.voices,
                        subtitle: s.id === last_source ? '✔ Активен' : '',
                        value:    s.id
                    };
                }),
                onBack:   function () { Lampa.Controller.toggle('content'); },
                onSelect: function (item) {
                    last_source = item.value;
                    store('online_src_sel', last_source);
                    Lampa.Noty.show('Источник: ' + item.title.split('  ')[0]);
                    load();
                }
            });
        }

        /* ── Загрузка контента ── */
        function load() {
            files.loading(true);
            network.clear();
            scroll.clear();

            var card = object.card || {};
            var q = {
                title:   card.original_title || card.title || '',
                year:    card.year || '',
                imdb_id: card.imdb_id || '',
                tmdb_id: card.id || ''
            };

            if (last_source === 'filmix')       loadFilmix(q);
            else if (last_source === 'hdrezka') loadRezka(q);
            else if (last_source === 'hdvb' || last_source === 'veoveo') loadVB(q);
            else loadGeneric(q);
        }

        /* ─── Filmix ─── */
        function loadFilmix(q) {
            var token = store('filmix_token');
            if (!token) { askToken('filmix_token', 'Filmix Dev-токен', load); return; }

            var url = 'https://filmixapp.cyou/api/v2/post?user_dev_token=' + token +
                      '&user_dev_apk=false';
            if (q.imdb_id) url += '&imdb_id=' + q.imdb_id;
            else url += '&title=' + encodeURIComponent(q.title);

            network.native(url, function (data) {
                if (!data || !data.player_links) { files.empty(); return; }
                var items = [];
                var pl = data.player_links;
                (pl.movie || []).forEach(function (v) {
                    if (v.link) items.push({ title: '[Фильм] ' + v.label, url: v.link });
                });
                (pl.season || []).forEach(function (s) {
                    (s.episodes || []).forEach(function (ep) {
                        var u = ep.links && ep.links[0] ? ep.links[0].link : null;
                        if (u) items.push({ title: 'S' + s.season_number + 'E' + ep.episode_number, url: u });
                    });
                });
                render(items);
            }, function () { files.empty(); });
        }

        /* ─── HDVB / VeoVeo ─── */
        function loadVB(q) {
            var token = store('hdvb_token');
            if (!token) { askToken('hdvb_token', 'HDVB / VeoVeo токен', load); return; }

            var url = 'https://apivb.info/api/videos.json?token=' + token +
                      '&title=' + encodeURIComponent(q.title) +
                      '&year=' + q.year;
            if (q.imdb_id) url += '&imdb_id=' + q.imdb_id;

            network.native(url, function (data) {
                if (!Array.isArray(data) || !data.length) { files.empty(); return; }
                render(data.map(function (v) {
                    return { title: v.title_ru || v.title_en || q.title, subtitle: v.year, url: v.iframe_url };
                }));
            }, function () { files.empty(); });
        }

        /* ─── HDRezka ─── */
        function loadRezka(q) {
            Lampa.Noty.show('HDRezka: поиск «' + q.title + '»');
            var url = 'https://rezka.ag/?do=search&subaction=search&q=' + encodeURIComponent(q.title);
            network.native(url, function (html) {
                var items = [];
                var re = /class="b-content__inline_item-link">\s*<a href="([^"]+)">([^<]+)<\/a>/g;
                var m;
                while ((m = re.exec(String(html))) !== null) {
                    items.push({ title: m[2].trim(), url: m[1] });
                    if (items.length >= 8) break;
                }
                render(items);
            }, function () { files.empty(); });
        }

        /* ─── Alloha / ManGo / FXpro / UaFlix / FlixSOD ─── */
        var GENERIC_API = {
            alloha:  'https://alloha.tv/api',
            mango:   'https://mangomovies.top/api',
            fxpro:   'https://fxapi.top/api',
            uaflix:  'https://uafix.net/api',
            flixsod: 'https://flixsod.com/api'
        };

        function loadGeneric(q) {
            var base = GENERIC_API[last_source] || 'https://alloha.tv/api';
            var url  = base + '/search?title=' + encodeURIComponent(q.title) + '&year=' + q.year;
            if (q.imdb_id) url += '&imdb=' + q.imdb_id;

            network.native(url, function (data) {
                var arr = Array.isArray(data) ? data : (data && data.results ? data.results : []);
                if (!arr.length) { files.empty(); return; }
                render(arr.slice(0, 20).map(function (v) {
                    return {
                        title:    v.title || v.name || v.ru_title || q.title,
                        subtitle: String(v.year || ''),
                        url:      v.iframe || v.link || v.url || ''
                    };
                }));
            }, function () { files.empty(); });
        }

        /* ─── Рендер списка ─── */
        function render(items) {
            files.loading(false);
            if (!items || !items.length) { files.empty(); return; }

            items.forEach(function (item) {
                var line = new Lampa.InteractionLine({
                    title:    item.title || '—',
                    subtitle: item.subtitle || '',
                    url:      item.url || ''
                });

                line.on('hover:enter', function () {
                    Lampa.Player.play({ url: item.url, title: item.title });
                    Lampa.Player.playlist([{ url: item.url, title: item.title }]);
                });

                scroll.append(line.render());
                line.render()[0].addEventListener('visible', line.visible.bind(line));
            });
        }

        /* ─── Ввод токена ─── */
        function askToken(key, label, cb) {
            files.loading(false);
            Lampa.Input.edit({
                title:    'Введите ' + label,
                value:    '',
                onBack:   function () { Lampa.Controller.toggle('content'); },
                onSelect: function (val) {
                    store(key, val);
                    Lampa.Noty.show(label + ' сохранён!');
                    cb();
                }
            });
        }

        /* ─── Lifecycle ─── */
        comp.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll);
                    Lampa.Controller.collectionFocus(false, scroll);
                },
                back: comp.back
            });
            Lampa.Controller.toggle('content');
            load();
        };

        comp.render  = function () { return scroll.render(); };
        comp.back    = function () { Lampa.Activity.backward(); };
        comp.pause   = function () {};
        comp.stop    = function () { network.clear(); files.destroy(); scroll.destroy(); };
        comp.destroy = comp.stop;
    }

    /* ══════════════════════════════════════════════
       КНОПКА В КАРТОЧКЕ
    ══════════════════════════════════════════════ */
    var SVG_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

    function hookCard() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var object = e.object;
            var card   = object.card || {};

            /* ── создаём кнопку «Онлайн» ── */
            var btn = Lampa.Template.get('full_start_button', {
                title: 'Онлайн'
            });

            /* fallback если шаблон не нашёлся */
            if (!btn || !btn.length) {
                btn = $('<div class="full-start__button selector">' +
                        '<div class="full-start__button-icon">' + SVG_ICON + '</div>' +
                        '<div class="full-start__button-name">Онлайн</div>' +
                        '</div>');
            }

            btn.on('hover:enter', function () {
                Lampa.Activity.push({
                    url:       '',
                    title:     'Онлайн — ' + (card.title || card.original_title || ''),
                    component: 'online_sources_v3',
                    card:      card,
                    source:    'online'
                });
            });

            /* Вставляем первой кнопкой */
            var wrap = object.activity.render().find('.full-start__buttons');
            if (wrap.length) wrap.prepend(btn);
        });
    }

    /* ══════════════════════════════════════════════
       РЕГИСТРАЦИЯ В МЕНЮ «ИСТОЧНИК»
       (отображается как пункт рядом с Торренты/Трейлеры)
    ══════════════════════════════════════════════ */
    function hookSource() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var object = e.object;
            var card   = object.card || {};

            /* Добавляем пункт «Онлайн» в секцию Источник */
            if (object.addSource) {
                object.addSource({
                    icon:     SVG_ICON,
                    title:    'Онлайн',
                    subtitle: 'Filmix, VeoVeo, ManGo, HDRezka…',
                    onSelect: function () {
                        Lampa.Activity.push({
                            url:       '',
                            title:     'Онлайн — ' + (card.title || ''),
                            component: 'online_sources_v3',
                            card:      card,
                            source:    'online'
                        });
                    }
                });
            }
        });
    }

    /* ══════════════════════════════════════════════
       INIT
    ══════════════════════════════════════════════ */
    function init() {
        Lampa.Component.add('online_sources_v3', OnlineComponent);
        hookSource();
        hookCard();
        console.log('[Online Sources v3] ✔ Загружен');
    }

    /* Надёжное ожидание загрузки Lampa */
    var _t = setInterval(function () {
        if (window.Lampa && Lampa.Listener && Lampa.Component && Lampa.Storage) {
            clearInterval(_t);
            init();
        }
    }, 100);

})();
