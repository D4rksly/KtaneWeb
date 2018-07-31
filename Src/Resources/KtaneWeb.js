﻿// Handle access to localStorage
var lStorage = localStorage;

try
{
    localStorage.setItem("testStorage", "testData");
    localStorage.removeItem("testStorage");
} catch (e)
{
    lStorage = {
        storage: {},
        getItem: function(key)
        {
            return this.storage[key] || null;
        },
        setItem: function(key, data)
        {
            this.storage[key] = data;
        },
        removeItem: function(key)
        {
            delete this.storage[key];
        },
        clear: function()
        {
            this.storage = {};
        }
    };
}

// Change the theme CSS before the page renders
var theme = lStorage.getItem("theme");
if (!(theme in Ktane.Themes))
    theme = null;
if (theme in Ktane.Themes)
    document.getElementById("theme-css").setAttribute('href', Ktane.Themes[theme]);
else
    document.getElementById("theme-css").setAttribute('href', '');

$(function()
{
    var filter = {};
    try { filter = JSON.parse(lStorage.getItem('filters') || '{}') || {}; }
    catch (exc) { }
    var selectable = lStorage.getItem('selectable') || 'manual';
    if (Ktane.Selectables.indexOf(selectable) === -1)
        selectable = 'manual';
    var preferredManuals = {};
    try { preferredManuals = JSON.parse(lStorage.getItem('preferredManuals') || '{}') || {}; }
    catch (exc) { }

    function compare(a, b, rev) { return (rev ? -1 : 1) * ((a < b) ? -1 : ((a > b) ? 1 : 0)); }
    var sorts = {
        'name': { fnc: function(elem) { return $(elem).data('sortkey').toLowerCase(); }, reverse: false, bodyCss: 'sort-name', radioButton: '#sort-name' },
        'defdiff': { fnc: function(elem) { return Ktane.Filters[3].values.indexOf($(elem).data('defdiff')); }, reverse: false, bodyCss: 'sort-defdiff', radioButton: '#sort-defuser-difficulty' },
        'expdiff': { fnc: function(elem) { return Ktane.Filters[4].values.indexOf($(elem).data('expdiff')); }, reverse: false, bodyCss: 'sort-expdiff', radioButton: '#sort-expert-difficulty' },
        'twitchscore': { fnc: function(elem) { return $(elem).data('twitchscore') || 0; }, reverse: false, bodyCss: 'sort-twitch-score', radioButton: '#sort-twitch-score' },
        'published': { fnc: function(elem) { return $(elem).data('published'); }, reverse: true, bodyCss: 'sort-published', radioButton: '#sort-published' }
    };
    var sort = lStorage.getItem('sort') || 'name';
    if (!(sort in sorts))
        sort = 'name';
    var displays = ['author', 'type', 'origin', 'difficulty', 'twitch', 'souvenir', 'id', 'description', 'published'];
    var defaultDisplay = ['author', 'type', 'difficulty', 'description', 'published'];
    var display = defaultDisplay;
    try { display = JSON.parse(lStorage.getItem('display')) || defaultDisplay; } catch (exc) { }

    var validSearchOptions = ['names', 'authors', 'descriptions'];
    var defaultSearchOptions = ['names'];
    var searchOptions = defaultSearchOptions;
    try { searchOptions = JSON.parse(lStorage.getItem('searchOptions')) || defaultSearchOptions; } catch (exc) { }

    var version = lStorage.getItem('version');
    if (version < 2)
    {
        sort = 'name';
        selectable = 'manual';
        display = defaultDisplay;
        filter = {};
    }
    lStorage.setItem('version', '2');

    var selectedRow = 0;
    function updateSearchHighlight()
    {
        $("tr.mod").removeClass('selected');
        $(`tr.mod:visible:eq(${selectedRow})`).addClass('selected');
    }

    function setSelectable(sel)
    {
        selectable = sel;
        $('a.modlink').each(function(_, e) { $(e).attr('href', sel === 'manual' ? null : ($(e).parents('tr').data(sel) || null)); });
        $('label.set-selectable').removeClass('selected');
        $('label#selectable-label-' + sel).addClass('selected');
        $('#selectable-' + sel).prop('checked', true);
        lStorage.setItem('selectable', sel);
        updateFilter();
        setPreferredManuals();
        $('#main-table').css({ display: 'table' });
        if ($("input#search-field").is(':focus'))
            updateSearchHighlight();
    }

    function setSort(srt)
    {
        sort = srt;
        lStorage.setItem('sort', srt);
        var arr = $('tr.mod').toArray();
        arr.sort(function(a, b)
        {
            var c = compare(sorts[srt].fnc(a), sorts[srt].fnc(b), sorts[srt].reverse);
            return (c === 0) ? compare($(a).data('mod'), $(b).data('mod'), false) : c;
        });
        var table = $('#main-table');
        for (var i = 0; i < arr.length; i++)
            table.append(arr[i]);

        $(document.body).removeClass(document.body.className.split(' ').filter(cls => cls.startsWith('sort-')).join(' ')).addClass(sorts[srt].bodyCss);
        $(sorts[srt].radioButton).prop('checked', true);
    }

    function setDisplay(set)
    {
        display = (set instanceof Array) ? set.filter(function(x) { return displays.indexOf(x) !== -1; }) : defaultDisplay;
        $(document.body).removeClass(document.body.className.split(' ').filter(function(x) { return x.startsWith('display-'); }).join(' '));
        $('input.display').prop('checked', false);
        $(document.body).addClass(display.map(function(x) { return "display-" + x; }).join(' '));
        $(display.map(function(x) { return '#display-' + x; }).join(',')).prop('checked', true);
        lStorage.setItem('display', JSON.stringify(display));
    }

    function setSearchOptions(set)
    {
        searchOptions = (set instanceof Array) ? set.filter(function(x) { return validSearchOptions.indexOf(x) !== -1; }) : defaultSearchOptions;
        $('input.search-option-input').prop('checked', false);
        $(searchOptions.map(function(x) { return '#search-' + x; }).join(',')).prop('checked', true);
        lStorage.setItem('searchOptions', JSON.stringify(searchOptions));
    }

    function setTheme(theme)
    {
        if (theme === null || !(theme in Ktane.Themes))
        {
            lStorage.removeItem('theme');
            theme = null;
        }
        else
            lStorage.setItem('theme', theme);
        $('#theme-css').attr('href', theme in Ktane.Themes ? Ktane.Themes[theme] : '');
        $('#theme-' + (theme || 'default')).prop('checked', true);
    }

    function updateFilter()
    {
        filter.includeMissing = $('input#filter-include-missing').prop('checked');

        var noneSelected = {};
        for (var i = 0; i < Ktane.Filters.length; i++)
        {
            var none = true;
            switch (Ktane.Filters[i].type)
            {
                case "slider":
                    filter[Ktane.Filters[i].id] = {
                        min: $('div#filter-' + Ktane.Filters[i].id).slider('values', 0),
                        max: $('div#filter-' + Ktane.Filters[i].id).slider('values', 1)
                    };
                    var x = function(str) { return str.replace(/[A-Z][a-z]*/g, function(m) { return " " + m.toLowerCase(); }).trim(); };
                    var y = function(s1, s2) { return s1 === s2 ? x(s1) : x(s1) + ' – ' + x(s2); };
                    $('div#filter-label-' + Ktane.Filters[i].id).text(y(Ktane.Filters[i].values[filter[Ktane.Filters[i].id].min], Ktane.Filters[i].values[filter[Ktane.Filters[i].id].max]));
                    none = false;
                    break;

                case "checkboxes":
                    filter[Ktane.Filters[i].id] = {};
                    for (var j = 0; j < Ktane.Filters[i].values.length; j++)
                    {
                        filter[Ktane.Filters[i].id][Ktane.Filters[i].values[j]] = $('input#filter-' + Ktane.Filters[i].id + '-' + Ktane.Filters[i].values[j]).prop('checked');
                        if (filter[Ktane.Filters[i].id][Ktane.Filters[i].values[j]])
                            none = false;
                    }
                    break;

                case "boolean":
                    filter[Ktane.Filters[i].id] = $('input#filter-' + Ktane.Filters[i].id).prop('checked');
                    break;
            }
            noneSelected[Ktane.Filters[i].id] = none;
        }

        var searchKeywords = $("input#search-field").val().toLowerCase().split(' ').filter(x => x.length > 0);

        var modCount = 0;
        $('tr.mod').each(function(_, e)
        {
            var data = $(e).data();

            var filteredIn = true;
            for (var i = 0; i < Ktane.Filters.length; i++)
            {
                if (Ktane.Filters[i].id in data)
                {
                    switch (Ktane.Filters[i].type)
                    {
                        case "slider":
                            filteredIn = filteredIn && Ktane.Filters[i].values.indexOf(data[Ktane.Filters[i].id]) >= filter[Ktane.Filters[i].id].min && Ktane.Filters[i].values.indexOf(data[Ktane.Filters[i].id]) <= filter[Ktane.Filters[i].id].max;
                            break;
                        case "checkboxes":
                            filteredIn = filteredIn && (filter[Ktane.Filters[i].id][data[Ktane.Filters[i].id]] || noneSelected[Ktane.Filters[i].id]);
                            break;
                        case "boolean":
                            filteredIn = filteredIn && (!filter[Ktane.Filters[i].id] || data[Ktane.Filters[i].id] === 'True');
                            break;
                    }
                }
            }
            var searchWhat = '';
            if (searchOptions.indexOf('names') !== -1)
                searchWhat += ' ' + data.mod.toLowerCase();
            if (searchOptions.indexOf('authors') !== -1)
                searchWhat += ' ' + data.author.toLowerCase();
            if (searchOptions.indexOf('descriptions') !== -1)
                searchWhat += ' ' + data.description.toLowerCase();
            if (filteredIn && (filter.includeMissing || selectable === 'manual' || data[selectable]) && searchKeywords.filter(x => searchWhat.indexOf(x) !== -1).length === searchKeywords.length)
            {
                modCount++;
                $(e).show();
            }
            else
                $(e).hide();
        });

        $('#module-count').text(modCount);
        lStorage.setItem('filters', JSON.stringify(filter));
    }

    function setPreferredManuals()
    {
        $('tr.mod').each(function(_, e)
        {
            var data = $(e).data(), i;
            if (data.manual.length === 0)
                return;

            var manual = data.manual[0];
            for (i = 0; i < data.manual.length; i++)
                if (data.manual[i].name === data.mod + " (PDF)")
                    manual = data.manual[i];
            for (i = 0; i < data.manual.length; i++)
                if (data.manual[i].name === data.mod + " (HTML)")
                    manual = data.manual[i];
            if (data.mod in preferredManuals)
                for (i = 0; i < data.manual.length; i++)
                    if (preferredManuals[data.mod] === data.manual[i].name)
                        manual = data.manual[i];
            $(e).find(selectable === 'manual' ? 'a.modlink,a.manual' : 'a.manual').attr('href', manual.url);
            $(e).find('img.manual-icon').attr('src', manual.icon);
        });
        lStorage.setItem('preferredManuals', JSON.stringify(preferredManuals));
    }

    // Set filters from saved settings
    for (var i = 0; i < Ktane.Filters.length; i++)
    {
        switch (Ktane.Filters[i].type)
        {
            case "slider":
                if (!(Ktane.Filters[i].id in filter) || typeof filter[Ktane.Filters[i].id] !== 'object')
                    filter[Ktane.Filters[i].id] = {};

                if (!('min' in filter[Ktane.Filters[i].id]))
                    filter[Ktane.Filters[i].id].min = 0;
                if (!('max' in filter[Ktane.Filters[i].id]))
                    filter[Ktane.Filters[i].id].max = Ktane.Filters[i].values.length - 1;
                var e = $('div#filter-' + Ktane.Filters[i].id);
                e.slider({
                    range: true,
                    min: 0,
                    max: Ktane.Filters[i].values.length - 1,
                    values: [filter[Ktane.Filters[i].id].min, filter[Ktane.Filters[i].id].max],
                    slide: function(event, ui) { window.setTimeout(updateFilter, 1); }
                });
                break;

            case "checkboxes":
                if (!(Ktane.Filters[i].id in filter) || typeof filter[Ktane.Filters[i].id] !== 'object')
                    filter[Ktane.Filters[i].id] = {};

                for (var j = 0; j < Ktane.Filters[i].values.length; j++)
                {
                    if (!(Ktane.Filters[i].values[j] in filter[Ktane.Filters[i].id]))
                        filter[Ktane.Filters[i].id][Ktane.Filters[i].values[j]] = true;
                    $('input#filter-' + Ktane.Filters[i].id + '-' + Ktane.Filters[i].values[j]).prop('checked', filter[Ktane.Filters[i].id][Ktane.Filters[i].values[j]]);
                }
                break;

            case "boolean":
                if (!(Ktane.Filters[i].id in filter) || typeof filter[Ktane.Filters[i].id] !== 'boolean')
                    filter[Ktane.Filters[i].id] = false;

                $('input#filter-' + Ktane.Filters[i].id).prop('checked', filter[Ktane.Filters[i].id]);
                break;
        }

        $('input#filter-include-missing').prop('checked', filter.includeMissing);
    }

    setPreferredManuals();
    setSort(sort);
    setTheme(theme);
    setDisplay(display);
    setSearchOptions(searchOptions);

    // This also calls updateFilter()
    setSelectable(selectable);

    var preventDisappear = 0;
    function disappear()
    {
        if (preventDisappear === 0)
        {
            $('.disappear.stay').hide();
            $('.disappear:not(.stay)').remove();

            if ($('#more>#icons').length)
                $('#icons').insertAfter('#logo');
        }
        else
            preventDisappear--;
    }
    $(document).click(disappear);

    $('input.set-selectable').click(function() { setSelectable($(this).data('selectable')); });
    $('input.filter').click(function() { updateFilter(); });
    $("input.set-theme").click(function() { setTheme($(this).data('theme')); });
    $('input.display').click(function() { setDisplay(displays.filter(function(x) { return !$('#display-' + x).length || $('#display-' + x).prop('checked'); })); });
    $('#search-field-clear').click(function() { disappear(); $('input#search-field').val(''); updateFilter(); return false; });
    $('input.search-option-input').click(function() { setSearchOptions(validSearchOptions.filter(function(x) { return !$('#search-' + x).length || $('#search-' + x).prop('checked'); })); updateFilter(); });

    $('tr.mod').each(function(_, e)
    {
        var data = $(e).data();
        var mod = data.mod;
        var sheets = data.manual;

        // Click handler for selecting manuals/cheat sheets (both mobile and non)
        function makeClickHander(lnk, isMobileOpt)
        {
            return function()
            {
                disappear();
                var menuDiv = $('<div>').addClass('popup disappear');
                menuDiv.click(function() { preventDisappear++; });
                if (isMobileOpt)
                {
                    menuDiv.append($('<div class="close">').click(disappear));
                    var iconsDiv = $('<div>').addClass('icons');
                    $(e).find('td.selectable:not(.manual) img.icon').each(function(_, ic)
                    {
                        var iconDiv = $("<div class='icon'><a class='icon-link'><img class='icon-img' /><span class='icon-label'></span></a></div>");
                        iconDiv.find('a').attr('href', $(ic).parent().attr('href'));
                        iconDiv.find('img').attr('src', $(ic).attr('src'));
                        iconDiv.find('span').text($(ic).attr('title'));
                        iconsDiv.append(iconDiv);
                    });
                    menuDiv.append(iconsDiv);
                    if ($('#display-souvenir').prop('checked'))
                        menuDiv.append($('<div class="module-further-info"></div>').text($(e).find('.inf-souvenir').attr('title')));
                    if ($('#display-twitch').prop('checked'))
                        menuDiv.append($('<div class="module-further-info"></div>').text($(e).find('.inf-twitch').attr('title')));
                }
                menuDiv.append('<p class="manual-select">Select your preferred manual for this module.</p>');
                var menu = $('<menu>').addClass('manual-select');
                for (var i = 0; i < sheets.length; i++)
                {
                    var li = $('<li>').text(sheets[i].name);
                    if (mod in preferredManuals && preferredManuals[mod] === sheets[i].name)
                        li.addClass('checked');
                    var ahref = $('<a>').attr('href', sheets[i].url).append(li);
                    ahref.click(function(sh)
                    {
                        return function()
                        {
                            menuDiv.remove();
                            preferredManuals[mod] = sh;
                            setPreferredManuals();
                            return false;
                        };
                    }(sheets[i].name));
                    menu.append(ahref);
                }
                menuDiv.append(menu);
                $(document.body).append(menuDiv);
                if (!isMobileOpt)
                    menuDiv.position({ my: 'right top', at: 'right bottom', of: lnk, collision: 'fit none' });
                return false;
            };
        }

        // Add a copy of the .infos divs from the last column into the next-to-last (used by medium-width layout only)
        $(e).find('td.infos-1').append($('<div class="infos">').html($(e).find('td.infos-2>div.infos').html()));

        // Add UI for selecting manuals/cheat sheets (both mobile and non)
        if (sheets.length > 1)
        {
            var lnk1 = $('<a>').attr('href', '#').addClass('manual-selector').text('▼');
            $(e).find('td.infos-1').append(lnk1.click(makeClickHander(lnk1, false)));
        }

        var lnk2 = $(e).find('a.mobile-opt');
        lnk2.click(makeClickHander(lnk2, true));
    });

    // Page options pop-up (mobile only)
    $('#page-opt').click(function()
    {
        $('#icons').insertAfter('#more > div.close');
        $('#more').css({ left: '', top: '', width: '' }).show();
        return false;
    });

    function popup(lnk, wnd, width)
    {
        if (!wnd.is(':visible'))
        {
            disappear();
            wnd.show();
            if (window.innerWidth <= 650)
            {
                // Mobile interface: CSS does it all
                wnd.css({ width: '', left: '', top: '' });
            } else
            {
                // Desktop interface: position relative to the tab
                wnd.css({ width: width }).position({ my: 'right top', at: 'right bottom', of: lnk, collision: 'fit none' });
            }
        }
        else
            disappear();
        return false;
    }

    $('#icon-page-next').click(function()
    {
        var th = $(this), curPage = th.data('cur-page');
        var pages = $('#icons').children('.icon-page');
        if (typeof curPage === 'undefined')
            curPage = 0;
        curPage = (curPage + 1) % pages.length;
        th.data('cur-page', curPage);
        pages.removeClass('shown');
        $(pages[curPage]).addClass('shown');
        return false;
    });

    $('#more-link').click(function() { return popup($('#more-tab'), $('#more'), '90%'); });
    $('#profiles-link').click(function() { return popup($('#profiles-rel'), $('#profiles-menu'), '25em'); });

    $('.popup>.close').click(disappear);

    // Links in the table headers (not visible on mobile UI)
    $('.sort-header').click(function()
    {
        var arr = Object.keys(sorts);
        var ix = -1;
        for (var i = 0; i < arr.length; i++)
            if (arr[i] === sort)
                ix = i;
        ix = (ix + 1) % arr.length;
        setSort(arr[ix]);
        return false;
    });

    // Radio buttons (mobile UI and “Filters & More” tab)
    $('input.sort').click(function() { setSort(this.value); return true; });
    $('#more,#profiles-menu').click(function() { preventDisappear++; });

    $("#search-field")
        .focus(updateSearchHighlight)
        .blur(function(e) { $("tr.mod").removeClass('selected'); })
        .keyup(function(e)
        {
            updateFilter();

            // Reducing results, move highlight
            if (selectedRow >= $("tr.mod:visible").length)
                selectedRow = $("tr.mod:visible").length - 1;

            updateSearchHighlight();
        })
        .keydown(function(e)
        {
            if (e.keyCode === 38 && selectedRow > 0)   // up arrow
                selectedRow--;
            else if (e.keyCode === 40 && selectedRow < $("tr.mod:visible").length - 1)      // down arrow
                selectedRow++;
            else if (e.keyCode === 13)
            {
                if (!e.originalEvent.ctrlKey && !e.originalEvent.shiftKey && !e.originalEvent.altKey)  // enter
                    window.location.href = $(`tr.mod:visible:eq(${selectedRow}) a.modlink`).attr("href");
                else
                {
                    // This seems to work in Firefox (it dispatches the keypress to the link), but not in Chrome. Adding .trigger(e) also doesn’t work
                    $(`tr.mod:visible:eq(${selectedRow}) a.modlink`).focus();
                    setTimeout(function()
                    {
                        var inp = document.getElementById('search-field');
                        inp.focus();
                        inp.selectionStart = 0;
                        inp.selectionEnd = inp.value.length;
                    }, 1);
                }
            }

            updateSearchHighlight();
        });

    $('#generate-pdf').click(function()
    {
        $('#generate-pdf-json').val(JSON.stringify({
            preferredManuals: preferredManuals,
            sort: sort,
            filter: filter,
            selectable: selectable,
            searchOptions: searchOptions,
            search: $("input#search-field").val()
        }));
        return true;
    });
});