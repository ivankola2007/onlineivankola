/**
 * Lampa TV — Online Sources Plugin
 * Источники: Filmix, VeoVeo, ManGo, UaFlix, FXpro, FlixSOD, Alloha, HDRezka, HDVB
 * GitHub Pages: yourname.github.io/plugins/online_mod.js
 */

(function () {
    'use strict';

    /* ─────────────────────────────────────────
       МАНИФЕСТ ПЛАГИНА
    ───────────────────────────────────────── */
    var manifest = {
        type:    'online',
        version: '2.0.0',
        name:    'Online Sources',
        description: 'Filmix, VeoVeo, ManGo, UaFlix, FXpro, FlixSOD, Alloha, HDRezka, HDVB',
        component: 'online_sources'
    };

    /* ─────────────────────────────────────────
       СПИСОК ИСТОЧНИКОВ
       (убраны VIP-метки, добавлен Filmix)
    ───────────────────────────────────────── */
    var SOURCES = [
        {
            id:      'filmix',
            name:    'Filmix',
            voices:  5,
            active:  true,
            apiBase: 'https://filmixapp.cyou/api/v2'
        },
        {
            id:      'veoveo',
            name:    'VeoVeo',
            voices:  1,
            active:  true,
            apiBase: 'https://voidboost.net/embed'
        },
        {
            id:      'mango',
            name:    'ManGo [4K, HDR, +UA]',
            voices:  6,
            active:  true,
            apiBase: 'https://mangomovies.top/api'
        },
        {
            id:      'uaflix',
            name:    'UaFlix',
            voices:  1,
            active:  true,
            apiBase: 'https://uafix.net/api'
        },
        {
            id:      'fxpro',
            name:    'FXpro [4K, HDR, +UA]',
            voices:  6,
            active:  true,
            apiBase: 'https://fxapi.top/api'
        },
        {
            id:      'flixsod',
            name:    'FlixSOD',
            voices:  7,
            active:  true,
            apiBase: 'https://flixsod.com/api'
        },
        {
            id:      'alloha',
            name:    'Alloha [4K]',
            voices:  6,
            active:  true,
            apiBase: 'https://alloha.tv/api'
        },
        {
            id:      'hdrezka',
            name:    'HDRezka',
            voices:  7,
            active:  true,
            apiBase: 'https://rezka.ag/engine/ajax'
        },
        {
            id:      'hdvb',
            name:    'HDVB',
            voices:  2,
            active:  true,
            apiBase: 'https://apivb.info/api'
        }
    ];

    /* ─────────────────────────────────────────
       ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    ───────────────────────────────────────── */

    /**
     * Сохранить/получить настройки выбранного источника
     */
    function getSavedSource() {
        try {
            return Lampa.Storage.get('online_sources_selected', 'filmix');
        } catch (e) {
            return 'filmix';
        }
    }

    function saveSource(id) {
        try {
            Lampa.Storage.set('online_sources_selected', id);
        } catch (e) {}
    }

    /**
     * Показать список источников (меню «Источник»)
     */
    function showSourceMenu(onSelect) {
        var saved = getSavedSource();
        var items = SOURCES.map(function (src) {
            return {
                title:    src.name + ' 🎙' + src.voices,
                subtitle: src.id === saved ? '✔ Выбран' : '',
                value:    src.id
            };
        });

        Lampa.Select.show({
            title: 'Источник',
            items: items,
            onBack: function () { Lampa.Controller.toggle('content'); },
            onSelect: function (item) {
                saveSource(item.value);
                Lampa.Noty.show('Источник: ' + item.title.split(' 🎙')[0]);
                if (typeof onSelect === 'function') onSelect(item.value);
            }
        });
    }

    /* ─────────────────────────────────────────
       КОМПОНЕНТ ОНЛАЙН-ПРОСМОТРА
    ───────────────────────────────────────── */
    function OnlineSourcesComponent(object) {
        var network = new Lampa.Reguest();
        var scroll  = new Lampa.Scroll({ mask: true, over: true });
        var files   = new Lampa.Explorer(object);
        var active_source = getSavedSource();
        var source_data   = SOURCES.find(function(s){ return s.id === active_source; }) || SOURCES[0];

        /* кнопка смены источника */
        files.addHead({
            title: '📡 ' + source_data.name,
            subtitle: 'Нажмите для смены',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>',
            onBack: function () { Lampa.Controller.toggle('content'); },
            onSelect: function () {
                showSourceMenu(function (id) {
                    active_source = id;
                    source_data   = SOURCES.find(function(s){ return s.id === id; }) || SOURCES[0];
                    loadContent();
                });
            }
        });

        /* загрузка контента через выбранный API */
        function loadContent() {
            files.loading(true);
            var card    = object.card || {};
            var title   = card.original_title || card.title || '';
            var year    = card.year || '';
            var imdb_id = card.imdb_id || '';

            var params  = {
                token: Lampa.Storage.get('online_sources_token_' + active_source, ''),
                title: title,
                year:  year,
                imdb:  imdb_id
            };

            network.clear();

            /* ---- Filmix ---- */
            if (active_source === 'filmix') {
                loadFilmix(card, params);

            /* ---- HDVB / VeoVeo (общий API vb) ---- */
            } else if (active_source === 'hdvb' || active_source === 'veoveo') {
                loadVBSource(card, params);

            /* ---- HDRezka ---- */
            } else if (active_source === 'hdrezka') {
                loadRezka(card, params);

            /* ---- Все остальные (Alloha/ManGo/FXpro/UaFlix/FlixSOD) ---- */
            } else {
                loadGenericSource(card, params);
            }
        }

        /* — Filmix — */
        function loadFilmix(card, params) {
            var token = Lampa.Storage.get('filmix_token', '');
            if (!token) {
                showTokenInput('filmix', 'Filmix Token', loadContent);
                return;
            }
            var url = source_data.apiBase + '/post?id=' + (card.imdb_id || '') +
                      '&user_dev_token=' + token +
                      '&user_dev_apk=false';
            network.native(url, function (data) {
                if (!data || !data.player_links) {
                    files.empty(); return;
                }
                var items = parseFilmixLinks(data.player_links);
                renderItems(items);
            }, function () { files.empty(); });
        }

        function parseFilmixLinks(links) {
            var result = [];
            function push(label, url) {
                if (url) result.push({ title: label, url: url, stream: true });
            }
            (links.movie || []).forEach(function(q){ push('[Фильм] ' + q.label, q.link); });
            (links.season || []).forEach(function(s){
                (s.episodes || []).forEach(function(ep){
                    push('Сезон ' + s.season_number + ' Серия ' + ep.episode_number, ep.links && ep.links[0] && ep.links[0].link);
                });
            });
            return result;
        }

        /* — HDVB / VeoVeo — */
        function loadVBSource(card, params) {
            var token = Lampa.Storage.get('hdvb_token', '');
            if (!token) { showTokenInput('hdvb_token', 'HDVB/VeoVeo Token', loadContent); return; }
            var base = 'https://apivb.info/api/videos.json';
            var url  = base + '?token=' + token +
                       '&title=' + encodeURIComponent(params.title) +
                       '&year='  + params.year;
            if (params.imdb) url += '&imdb_id=' + params.imdb;
            network.native(url, function(data){
                if (!data || !data.length) { files.empty(); return; }
                var items = data.map(function(v){
                    return { title: v.title_ru || v.title_en, subtitle: v.year, url: v.iframe_url, stream: false };
                });
                renderItems(items);
            }, function(){ files.empty(); });
        }

        /* — HDRezka — */
        function loadRezka(card, params) {
            var url = source_data.apiBase + '/search.php?do=search&subaction=search&q=' +
                      encodeURIComponent(params.title);
            network.native(url, function(data){
                if (!data || !data.length) { files.empty(); return; }
                renderItems(data.slice(0,10).map(function(v){
                    return { title: v.title, subtitle: v.year, url: v.link, stream: false };
                }));
            }, function(){ files.empty(); });
        }

        /* — Generic (Alloha, ManGo, FXpro, UaFlix, FlixSOD) — */
        function loadGenericSource(card, params) {
            var url = source_data.apiBase + '/search?title=' + encodeURIComponent(params.title) +
                      '&year=' + params.year;
            if (params.imdb) url += '&imdb=' + params.imdb;
            network.native(url, function(data){
                var arr = Array.isArray(data) ? data : (data && data.results ? data.results : []);
                if (!arr.length) { files.empty(); return; }
                renderItems(arr.slice(0,15).map(function(v){
                    return {
                        title:    v.title || v.name || v.ru_title || params.title,
                        subtitle: v.year || '',
                        url:      v.iframe || v.link || v.url || '',
                        stream:   false
                    };
                }));
            }, function(){ files.empty(); });
        }

        /* — Рендер элементов — */
        function renderItems(items) {
            files.loading(false);
            if (!items || !items.length) { files.empty(); return; }
            var elems = items.map(function(item){
                return new Lampa.InteractionLine({
                    title:    item.title,
                    subtitle: item.subtitle || '',
                    url:      item.url,
                    onSelect: function(){
                        if (item.stream) {
                            Lampa.Player.play({ url: item.url, title: item.title });
                            Lampa.Player.playlist([{ url: item.url, title: item.title }]);
                        } else {
                            Lampa.Player.play({ url: item.url, title: item.title });
                            Lampa.Player.playlist([{ url: item.url, title: item.title }]);
                        }
                    }
                });
            });
            files.append(elems);
        }

        /* — Запрос токена — */
        function showTokenInput(key, label, cb) {
            files.loading(false);
            Lampa.Input.edit({
                title:    'Введите ' + label,
                value:    '',
                onBack:   function(){ Lampa.Controller.toggle('content'); },
                onSelect: function(val){
                    Lampa.Storage.set(key, val);
                    Lampa.Noty.show(label + ' сохранён');
                    cb();
                }
            });
        }

        /* — Lifecycle — */
        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () { Lampa.Controller.collectionSet(scroll); Lampa.Controller.collectionFocus(false, scroll); },
                up:     function () { Navigator.move('up'); },
                down:   function () { Navigator.move('down'); },
                back:   this.back
            });
            Lampa.Controller.toggle('content');
            loadContent();
        };

        this.back = function () { Lampa.Activity.backward(); };

        this.render = function () { return scroll.render(); };

        this.pause  = function () {};
        this.stop   = function () { network.clear(); files.destroy(); scroll.destroy(); };
        this.destroy = function () { network.clear(); files.destroy(); scroll.destroy(); };
    }

    /* ─────────────────────────────────────────
       КНОПКА В КАРТОЧКЕ ФИЛЬМА/СЕРИАЛА
       (появляется в меню «Смотреть»)
    ───────────────────────────────────────── */
    function addOnlineButton() {
        if (window.online_sources_button_added) return;
        window.online_sources_button_added = true;

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var btn = Lampa.Template.get('button', {
                icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
                text: 'Онлайн ▶'
            });

            btn.on('hover:enter', function () {
                Lampa.Activity.push({
                    url:       '',
                    title:     'Онлайн — ' + (e.data.movie.title || ''),
                    component: manifest.component,
                    card:      e.data.movie,
                    source:    getSavedSource()
                });
            });

            e.object.activity.render().find('.full-start__buttons').prepend(btn.render());
            Lampa.Controller.toggle('full');
        });
    }

    /* ─────────────────────────────────────────
       РЕГИСТРАЦИЯ ПЛАГИНА
    ───────────────────────────────────────── */
    function init() {
        Lampa.Component.add(manifest.component, OnlineSourcesComponent);
        Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
        Lampa.Manifest.plugins[manifest.component] = manifest;
        addOnlineButton();
        console.log('[Online Sources] плагин загружен ✔');
    }

    /* ждём готовности Lampa */
    if (window.Lampa) {
        init();
    } else {
        document.addEventListener('lampainit', init);
    }

})();
