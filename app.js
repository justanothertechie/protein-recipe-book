
      // ---- Category tabs (filter) + search ----
      (function () {
        var search = document.getElementById('search');
        var emptyMsg = document.getElementById('emptyMsg');
        var tabsEl = document.getElementById('tabs');
        var tabBtns = Array.prototype.slice.call(tabsEl.querySelectorAll('button[data-tab]'));
        var srcEl = document.getElementById('srcTabs');
        var srcBtns = Array.prototype.slice.call(srcEl.querySelectorAll('button[data-src]'));
        var countEl = document.getElementById('resultMeta');
        var sortEl = document.getElementById('sortRecipes');
        var prepFilter = document.getElementById('prepFilter');
        var cookFilter = document.getElementById('cookFilter');
        var equipmentFilter = document.getElementById('equipmentFilter');
        var pageNav = document.getElementById('pageNav');
        var pageInfo = document.getElementById('pageInfo');
        var pageSize = 12, currentPage = 1, sortMode = 'newest';
        var appliedSort = 'newest';
        var activePrep = 'all', activeCook = 'all', activeEquipment = 'all';
        var cookingMeta = new WeakMap();
        var activeSource = 'all';

        // Veg / Non-Veg toggle: 'all' (default), 'veg' ya 'nonveg'.
        // Choice is phone ke browser mein yaad rehti hai (localStorage),
        // taaki agli visit pe wahi filter laga mile.
        var dietEl = document.getElementById('dietTabs');
        var dietBtns = dietEl ? Array.prototype.slice.call(dietEl.querySelectorAll('button[data-diet-filter]')) : [];
        var DIET_KEY = 'recipeDietFilter';
        var activeDiet = 'all';
        try {
          var savedDiet = localStorage.getItem(DIET_KEY);
          if (savedDiet === 'veg' || savedDiet === 'nonveg') activeDiet = savedDiet;
        } catch (e) {}

        // Top-level view: 'recipes' (browse + filters) ya 'plan' (Meal Plan).
        // Meal Plan ab ek alag view hai, category filter chip nahi.
        var viewEl = document.getElementById('viewSwitch');
        var viewBtns = viewEl ? Array.prototype.slice.call(viewEl.querySelectorAll('button[data-view-top]')) : [];
        var activeView = 'recipes';

        // Which sections each tab shows. Lunch/Dinner dishes are the same
        // main-meal sections (headings literally say "Lunch & Dinner").
        var tabSections = {
          all: ['nonveg', 'veg', 'breakfast', 'snacks', 'soups', 'condiments', 'dessert'],
          lunch: ['nonveg', 'veg'],
          dinner: ['nonveg', 'veg'],
          breakfast: ['breakfast'],
          snacks: ['snacks'],
          soups: ['soups'],
          condiments: ['condiments'],
          dessert: ['dessert']
        };
        var activeTab = 'all';

        // Group cards under their section heading (direct children of .wrap).
        // Ye grouping ab DOMContentLoaded pe hoti hai (initCards mein), taaki
        // upar wale controls page ke poora download hone se pehle hi kaam karein.
        var groups = [];
        var cardsReady = false;

        // Each card's source, read from its link: an Instagram reel, a Reddit
        // thread, a YouTube Short, or an article page. Cards with no link are
        // the Roz ke home set.
        function sourceOf(card) {
          var a = card.querySelector('.reel-link');
          if (!a) return 'roz';
          var href = a.getAttribute('href') || '';
          if (href.indexOf('instagram.com') !== -1) return 'instagram';
          if (href.indexOf('reddit.com') !== -1) return 'reddit';
          if (href.indexOf('youtube.com') !== -1 || href.indexOf('youtu.be') !== -1) return 'youtube';
          return 'articles';
        }
        function applySources() {
          groups.forEach(function (g) {
            g.cards.forEach(function (card) { card.setAttribute('data-source', sourceOf(card)); });
          });
        }

        // Har card ka diet: section ka default, kuch cards ke liye override.
        // Ye wahi classification hai jo neeche wala recipe picker use karta hai.
        var dietBySection = {
          nonveg: 'nonveg', veg: 'veg', breakfast: 'nonveg', snacks: 'veg',
          soups: 'veg', condiments: 'nonveg', dessert: 'veg'
        };
        var dietOverrides = {
          'egg chutney stuffed eggs anda laal chutney snack': 'nonveg',
          'zero oil chicken shorba soup bina tel': 'nonveg',
          'paneer bhurji roz veg': 'veg',
          'palak paneer light roz veg': 'veg',
          'tofu shimla stir fry roz veg': 'veg',
          'soya chunk curry roz veg': 'veg',
          'dal tadka roz moong arhar masoor': 'veg',
          'paneer soya chilla breakfast': 'veg',
          'protein oats whey breakfast': 'veg',
          'curd protein muesli breakfast': 'veg',
          'egg salad bowl sprouts anda protein': 'nonveg',
          'foxtail millet upma breakfast kangni': 'veg',
          'oats berries bowl whey chia reddit': 'veg',
          'overnight oats bowl almond milk reddit': 'veg',
          'everyday oats bowl seeds reddit': 'veg',
          'healthy fats oats bowl reddit': 'veg',
          'chocolate whey oats no cook reddit': 'veg',
          'tuna cheese burger reddit': 'nonveg',
          'viral chocolate egg pudding cocoa protein anda meetha': 'nonveg',
          'healthy blondies banana oat peanut butter kela meetha': 'nonveg'
        };
        function applyDiets() {
          groups.forEach(function (g) {
            g.cards.forEach(function (card, index) {
              card.setAttribute('data-original-order', index);
              var d = dietOverrides[card.getAttribute('data-name')] || dietBySection[g.id] || 'veg';
              card.setAttribute('data-diet', d);
            });
          });
        }

        function parseMinutes(text) {
          var total = 0, found = false;
          var re = /(\d+)\s*(?:[-–]\s*(\d+)\s*)?(hours?|hrs?|minutes?|mins?)/gi, match;
          while ((match = re.exec(text))) {
            found = true;
            var value = Number(match[2] || match[1]);
            total += /h/i.test(match[3]) ? value * 60 : value;
          }
          return found ? total : null;
        }
        function detailsFor(card) {
          var stepRows = Array.prototype.slice.call(card.querySelectorAll('.card-body ol li'));
          var equipment = [], cookMins = 0, prepMins = 0, timedCook = false, timedPrep = false;
          var rules = [
            ['Air fryer', /air[- ]?fry|air fryer|ninja crispi/i],
            ['Oven', /\boven\b|\bbake[sd]?\b/i],
            ['Pressure cooker', /pressure cooker|\bcooker\b|pressure cook/i],
            ['Microwave', /microwave/i],
            ['Blender', /blender|mixer/i],
            ['Steamer', /steam(?:er|ed|ing)?/i],
            ['Grill', /grill(?:ed|ing)?/i],
            ['Stovetop', /\bpan\b|kadhai|tawa|skillet|stir.?fry|sear|simmer|saute|sauté|boil|fry|bhuno/i]
          ];
          var allText = card.querySelector('.card-body') ? card.querySelector('.card-body').textContent : '';
          rules.forEach(function (rule) { if (rule[1].test(allText)) equipment.push(rule[0]); });
          stepRows.forEach(function (li) {
            var text = li.textContent || '';
            var mins = parseMinutes(text);
            if (mins === null) return;
            if (/marinat|rest|soak|refrigerat|chill|cool|stand|set aside/i.test(text)) { timedPrep = true; prepMins += mins; }
            else { cookMins += mins; timedCook = true; }
          });
          if (!equipment.length) equipment.push(/overnight|no.?cook|refrigerat/i.test(allText) ? 'No-cook' : 'Not listed');
          return { prep: timedPrep ? prepMins : null, timedPrep: timedPrep, cook: timedCook ? cookMins : null, equipment: equipment };
        }
        function applyNutrition(card) {
          var badges = Array.prototype.slice.call(card.querySelectorAll('.card-top .badge'));
          var summary = card.querySelector('.card-top .nutrition-note');
          badges.forEach(function (badge) {
            var text = badge.textContent.trim();
            if (!/\d/.test(text) || !/protein|carb|cal|kcal/i.test(text)) return;
            text = text.replace(/^(?!~)/, '~').replace(/\s*cal(?:ories)?\b/i, ' kcal').replace(/\s*kcal\b/i, ' kcal').replace(/(\d)(g\s)/i, '$1 $2');
            badge.textContent = text.replace(/\s+/g, ' ');
          });
          if (!summary) {
            summary = document.createElement('span');
            summary.className = 'nutrition-note';
            var by = card.querySelector('.card-top .by');
            var basisText = card.textContent.toLowerCase();
            var basis = /protein for the whole batch|whole batch/i.test(basisText) ? 'whole batch' : (/per serving/i.test(basisText) ? 'per serving' : 'serving basis not stated');
            summary.textContent = badges.some(function (b) { return /protein|carb|cal|kcal/i.test(b.textContent); })
              ? 'Approx. nutrition · ' + basis
              : 'Approx. nutrition not listed';
            (by || card.querySelector('.card-top')).appendChild(summary);
          }
        }

        function initCards() {
          if (cardsReady) return;
          var current = null;
          Array.prototype.forEach.call(document.querySelector('.wrap').children, function (el) {
            if (el.tagName === 'H2' && el.id && tabSections.all.indexOf(el.id) !== -1) {
              current = { id: el.id, heading: el, sub: null, cards: [] };
              groups.push(current);
            } else if (el.tagName === 'P' && el.classList.contains('part-sub')) {
              if (current) current.sub = el;
            } else if (el.tagName === 'ARTICLE' && current) {
              current.cards.push(el);
            }
          });
          applySources();
          applyDiets();
          groups.forEach(function (g) {
            g.cards.forEach(function (card) {
              var details = detailsFor(card);
              cookingMeta.set(card, details);
              card.setAttribute('data-cook-min', details.cook === null ? '' : details.cook);
              card.setAttribute('data-prep-min', details.prep === null ? '' : details.prep);
              card.setAttribute('data-prep-known', details.prep !== null ? 'true' : 'false');
              card.setAttribute('data-equipment', details.equipment.join('|'));
              applyNutrition(card);
              var meta = document.createElement('p');
              meta.className = 'cook-meta';
              meta.textContent = 'Prep/rest: ' + (details.prep === null ? 'Not listed' : '~' + details.prep + ' min (from timed steps)') + ' · Cook: ' + (details.cook === null ? 'Not listed' : '~' + details.cook + ' min (from timed steps)') + ' · Equipment: ' + details.equipment.join(', ');
              card.querySelector('.card-top').appendChild(meta);
            });
          });
          if (equipmentFilter) {
            var equipmentValues = {};
            groups.forEach(function (g) { g.cards.forEach(function (card) { cookingMeta.get(card).equipment.forEach(function (item) { if (item !== 'Not listed') equipmentValues[item] = true; }); }); });
            Object.keys(equipmentValues).sort().forEach(function (name) { var option = document.createElement('option'); option.value = name; option.textContent = name; equipmentFilter.appendChild(option); });
          }
          cardsReady = true;
          render();
        }

        function applySort() {
          if (appliedSort === sortMode) return;
          function protein(card) {
            var badge = Array.prototype.find.call(card.querySelectorAll('.card-top .badge'), function (item) { return /protein/i.test(item.textContent); });
            var match = badge && badge.textContent.match(/[\d.]+/);
            return match ? Number(match[0]) : -1;
          }
          groups.forEach(function (g, index) {
            var nextHeading = groups[index + 1] && groups[index + 1].heading;
            var lastInDom = g.cards.reduce(function (last, card) {
              return !last || (last.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING) ? card : last;
            }, null);
            var insertionPoint = nextHeading || (lastInDom && lastInDom.nextElementSibling);
            if (sortMode === 'name') g.cards.sort(function (a, b) { return a.querySelector('.card-top h3').textContent.localeCompare(b.querySelector('.card-top h3').textContent); });
            else if (sortMode === 'protein') g.cards.sort(function (a, b) { return protein(b) - protein(a) || a.querySelector('.card-top h3').textContent.localeCompare(b.querySelector('.card-top h3').textContent); });
            else g.cards.sort(function (a, b) { return Number(a.getAttribute('data-original-order')) - Number(b.getAttribute('data-original-order')); });
            if (sortMode !== 'newest' || appliedSort !== 'newest') {
              g.cards.forEach(function (card) { card.remove(); });
              g.cards.forEach(function (card) { document.querySelector('.wrap').insertBefore(card, insertionPoint); });
            }
          });
          appliedSort = sortMode;
        }

        function render() {
          if (!cardsReady) return;
          applySort();
          var q = search.value.trim().toLowerCase();
          var inPlan = activeView === 'plan', inShopping = activeView === 'shopping';
          var inUtilityView = inPlan || inShopping;
          var allowed = inUtilityView ? [] : (tabSections[activeTab] || []);
          var matching = [];
          groups.forEach(function (g) {
            var inTab = allowed.indexOf(g.id) !== -1;
            var groupVisible = false;
            g.cards.forEach(function (card) {
              var text = (card.getAttribute('data-name') + ' ' + card.textContent).toLowerCase();
              var removed = card.classList.contains('user-hidden') && !document.body.classList.contains('show-removed');
              var srcOk = activeSource === 'all' || card.getAttribute('data-source') === activeSource;
              var dietOk = activeDiet === 'all' || card.getAttribute('data-diet') === activeDiet;
              var details = cookingMeta.get(card) || { cook: null, prep: null, equipment: ['Not listed'] };
              var prepOk = activePrep === 'all' || (activePrep === 'unknown' ? details.prep === null : details.prep !== null && (activePrep === 'under15' ? details.prep < 15 : activePrep === '15to30' ? details.prep >= 15 && details.prep <= 30 : details.prep > 30));
              var cookOk = activeCook === 'all' || (activeCook === 'unknown' ? details.cook === null : details.cook !== null && (activeCook === 'under30' ? details.cook < 30 : activeCook === '30to60' ? details.cook >= 30 && details.cook <= 60 : details.cook > 60));
              var equipmentOk = activeEquipment === 'all' || details.equipment.indexOf(activeEquipment) !== -1;
              var show = !inUtilityView && inTab && srcOk && dietOk && prepOk && cookOk && equipmentOk && (!q || text.indexOf(q) !== -1) && !removed;
              if (show) matching.push(card);
              card.classList.add('hidden');
            });
          });
          var pages = Math.max(1, Math.ceil(matching.length / pageSize));
          currentPage = Math.min(currentPage, pages);
          var first = (currentPage - 1) * pageSize, pageCards = matching.slice(first, first + pageSize);
          pageCards.forEach(function (card) { card.classList.remove('hidden'); });
          groups.forEach(function (g) {
            var visible = g.cards.some(function (card) { return pageCards.indexOf(card) !== -1; });
            g.heading.classList.toggle('hidden', !visible);
            if (g.sub) g.sub.classList.toggle('hidden', !visible);
          });
          emptyMsg.style.display = (matching.length || inUtilityView) ? 'none' : 'block';
          if (countEl) countEl.textContent = matching.length ? 'Showing ' + (first + 1) + '–' + Math.min(first + pageSize, matching.length) + ' of ' + matching.length + ' recipes' : '0 recipes found';
          if (pageInfo) pageInfo.textContent = matching.length ? 'Page ' + currentPage + ' of ' + pages : 'Page 1 of 1';
          if (pageNav) pageNav.classList.toggle('hidden', inUtilityView || matching.length <= pageSize);
          var prev = document.getElementById('prevPage'), next = document.getElementById('nextPage');
          if (prev) prev.disabled = currentPage <= 1;
          if (next) next.disabled = currentPage >= pages;
          // Meal Plan and Shopping List are separate personal views.
          var planSec = document.getElementById('mealplan');
          var shopSec = document.getElementById('shopping');
          if (planSec) planSec.classList.toggle('hidden', !inPlan);
          if (shopSec) shopSec.classList.toggle('hidden', !inShopping);
          document.body.classList.toggle('view-plan', inPlan);
          document.body.classList.toggle('view-shopping', inShopping);
        }

        function setViewTop(name) {
          currentPage = 1;
          activeView = name;
          viewBtns.forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-view-top') === name);
          });
          render();
          if (name === 'shopping' && window.renderShoppingList) window.renderShoppingList();
        }

        if (viewEl) viewEl.addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('button[data-view-top]') : null;
          if (!b) return;
          setViewTop(b.getAttribute('data-view-top'));
        });

        function setTab(name) {
          currentPage = 1;
          activeTab = name;
          tabBtns.forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-tab') === name);
          });
          render();
        }

        tabsEl.addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('button[data-tab]') : null;
          if (!b) return;
          setTab(b.getAttribute('data-tab'));
        });

        function setSource(name) {
          currentPage = 1;
          activeSource = name;
          srcBtns.forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-src') === name);
          });
          render();
        }

        srcEl.addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('button[data-src]') : null;
          if (!b) return;
          setSource(b.getAttribute('data-src'));
        });

        function setDiet(name) {
          currentPage = 1;
          activeDiet = name;
          dietBtns.forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-diet-filter') === name);
          });
          try { localStorage.setItem(DIET_KEY, name); } catch (e) {}
          render();
        }

        if (dietEl) dietEl.addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('button[data-diet-filter]') : null;
          if (!b) return;
          setDiet(b.getAttribute('data-diet-filter'));
        });
        // Saved choice ko buttons pe pehle se laga do (render neeche chalta hai).
        dietBtns.forEach(function (x) {
          x.classList.toggle('active', x.getAttribute('data-diet-filter') === activeDiet);
        });

        search.addEventListener('input', function () {
          currentPage = 1;
          // Searching looks across the whole book, so jump back to "All".
          if (search.value.trim() && activeTab !== 'all') setTab('all');
          else render();
        });

        function filterChanged() {
          currentPage = 1; render();
          if (filterDrawer && window.innerWidth < 700) filterDrawer.open = false;
        }
        if (sortEl) sortEl.addEventListener('change', function () { sortMode = sortEl.value; filterChanged(); });
        if (prepFilter) prepFilter.addEventListener('change', function () { activePrep = prepFilter.value; filterChanged(); });
        if (cookFilter) cookFilter.addEventListener('change', function () { activeCook = cookFilter.value; filterChanged(); });
        if (equipmentFilter) equipmentFilter.addEventListener('change', function () { activeEquipment = equipmentFilter.value; filterChanged(); });
        if (pageNav) pageNav.addEventListener('click', function (e) {
          var button = e.target.closest ? e.target.closest('button[data-page]') : null;
          if (!button || button.disabled) return;
          currentPage += button.getAttribute('data-page') === 'next' ? 1 : -1;
          render();
          var anchor = document.querySelector('.tools');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        var filterDrawer = document.getElementById('filterDrawer');
        if (filterDrawer) filterDrawer.addEventListener('click', function (e) {
          if (e.target.closest('button[data-tab],button[data-src],button[data-diet-filter]') && window.innerWidth < 700) filterDrawer.open = false;
        });

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCards, { once: true });
        else initCards();
        // The script is deferred near the top of the long recipe document.
        // Recheck at load so slow asset parsing cannot leave the controls uninitialized.
        window.addEventListener('load', function () { if (!cardsReady) initCards(); }, { once: true });
      })();

      // ---- "Kya banau?" recipe picker ----
      (function () {
        var btn = document.getElementById('pickerBtn');
        var panel = document.getElementById('picker');
        var step1 = document.getElementById('pickStep1');
        var step2 = document.getElementById('pickStep2');
        var result = document.getElementById('pickResult');
        var noteEl = document.getElementById('pickNote');
        var cardSlot = document.getElementById('pickCard');

        // Diet/meal defaults come from the section a card sits in.
        var sectionMap = {
          nonveg:    { diet: 'nonveg', meal: 'both' },
          veg:       { diet: 'veg',    meal: 'both' },
          breakfast: { diet: 'nonveg', meal: 'breakfast' },
          snacks:    { diet: 'veg',    meal: 'snack' },
          soups:     { diet: 'veg',    meal: 'soup' },
          dessert:   { diet: 'veg',    meal: 'dessert' },
          roz:       { diet: 'nonveg', meal: 'both' }
        };
        // Cards whose diet differs from their section default.
        var dietOverrides = {
          'egg chutney stuffed eggs anda laal chutney snack': 'nonveg',
          'zero oil chicken shorba soup bina tel': 'nonveg',
          'paneer bhurji roz veg': 'veg',
          'palak paneer light roz veg': 'veg',
          'tofu shimla stir fry roz veg': 'veg',
          'soya chunk curry roz veg': 'veg',
          'dal tadka roz moong arhar masoor': 'veg',
          'paneer soya chilla breakfast': 'veg',
          'protein oats whey breakfast': 'veg',
          'curd protein muesli breakfast': 'veg',
          'egg salad bowl sprouts anda protein': 'nonveg',
          'foxtail millet upma breakfast kangni': 'veg',
          'oats berries bowl whey chia reddit': 'veg',
          'overnight oats bowl almond milk reddit': 'veg',
          'everyday oats bowl seeds reddit': 'veg',
          'healthy fats oats bowl reddit': 'veg',
          'tuna cheese burger reddit': 'nonveg',
          'viral chocolate egg pudding cocoa protein anda meetha': 'nonveg',
          'healthy blondies banana oat peanut butter kela meetha': 'nonveg'
        };

        var tagged = [];
        function initTagged() {
          var current = null;
          Array.prototype.forEach.call(document.querySelector('.wrap').children, function (el) {
            if (el.tagName === 'H2') {
              current = sectionMap[el.id] || null;
            } else if (el.tagName === 'ARTICLE' && current) {
              var diet = dietOverrides[el.getAttribute('data-name')] || current.diet;
              tagged.push({ el: el, diet: diet, meal: current.meal });
            }
          });
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTagged);
        else initTagged();

        var chosenDiet = 'any', chosenMeal = 'any', lastPick = null;

        function dietOk(t) { return chosenDiet === 'any' || t.diet === chosenDiet; }
        function mealOk(t) {
          if (chosenMeal === 'any') return true;
          if (t.meal === chosenMeal) return true;
          return t.meal === 'both' && (chosenMeal === 'lunch' || chosenMeal === 'dinner');
        }
        function showOnly(el) {
          step1.classList.add('hidden');
          step2.classList.add('hidden');
          result.classList.add('hidden');
          el.classList.remove('hidden');
        }

        function doPick() {
          if (!tagged.length) return;
          var pool = tagged.filter(function (t) { return dietOk(t) && mealOk(t); });
          var note = '';
          if (!pool.length) {
            pool = tagged.filter(dietOk);
            note = "No recipe for that exact combo yet — try this similar one:";
          }
          if (!pool.length) {
            pool = tagged.slice();
            note = 'Try this one:';
          }
          var pick, guard = 0;
          do {
            pick = pool[Math.floor(Math.random() * pool.length)];
            guard++;
          } while (pool.length > 1 && pick === lastPick && guard < 12);
          lastPick = pick;
          cardSlot.innerHTML = '';
          cardSlot.appendChild(pick.el.cloneNode(true));
          noteEl.textContent = note;
          noteEl.classList.toggle('hidden', !note);
          showOnly(result);
          modalBody.scrollTop = 0;
        }

        var modalBody = panel.querySelector('.modal-body');
        function openModal() {
          showOnly(step1);
          panel.classList.remove('hidden');
          document.body.classList.add('noscroll');
        }
        function closeModal() {
          panel.classList.add('hidden');
          document.body.classList.remove('noscroll');
        }

        btn.addEventListener('click', openModal);
        document.getElementById('pickX').addEventListener('click', closeModal);
        panel.addEventListener('click', function (e) {
          if (e.target === panel) closeModal();
        });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && !panel.classList.contains('hidden')) closeModal();
        });
        step1.addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('button[data-diet]') : null;
          if (!b) return;
          chosenDiet = b.getAttribute('data-diet');
          showOnly(step2);
        });
        step2.addEventListener('click', function (e) {
          if (e.target.id === 'pickBack1') { showOnly(step1); return; }
          var b = e.target.closest ? e.target.closest('button[data-meal]') : null;
          if (!b) return;
          chosenMeal = b.getAttribute('data-meal');
          doPick();
        });
        document.getElementById('pickAnother').addEventListener('click', doPick);
        document.getElementById('pickRestart').addEventListener('click', function () { showOnly(step1); });
        document.getElementById('pickClose').addEventListener('click', closeModal);
      })();

      // Hinglish recipe text used only for the WhatsApp share message
      // (the cook reads Hinglish; the page itself is in English).
      var SHARE = {"lime herb masala chicken nimbu thigh": {"badges": ["77g protein", "570 cal"], "ing": [{"t": "800g chicken thigh (1 cm cubes)"}, {"t": "1 tbsp namak, 1 tbsp laal mirch, 1.5 tbsp dhaniya powder, 1 tbsp garam masala, 1 tsp haldi"}, {"t": "4 tbsp dahi, 1 tbsp ghee, 1 tbsp adrak-lehsun paste"}, {"t": "1 nimbu, hara dhaniya + pudina"}], "steps": ["Chicken mein saare masale, dahi, ghee, nimbu milao.", "Pan mein medium aanch pe 4 min ek taraf pakao, palto, 4 min doosri taraf.", "Paani chhode to 4 min aur chalate hue sukhao, jab tak masala chipak jaye.", "Dhaniya-pudina upar se. Ready!"], "link": "Reel: https://www.instagram.com/reel/DZXVLajTl82/"}, "lemon pepper chicken rice bowl nimbu dahi kheera sauce": {"badges": ["62g protein", "630 cal"], "ing": [{"t": "500g chicken thighs, 4–6 tsp lemon pepper seasoning"}, {"t": "Sauce: 200g plain Greek yogurt (dahi), 1 kheera (sliced), 6–8 lehsun (pressed/kuta), fresh dhaniya/pudina"}, {"t": "3 cup uble chawal"}], "steps": ["Chicken thighs mein fork se ched karo taaki masala andar jaye.", "Lemon pepper seasoning dono taraf achhe se lagao.", "Air fryer mein daalo, beech mein palto, golden-crispy hone tak pakao.", "Sauce banao: dahi + kata kheera + kuta lehsun + hari dhaniya/pudina — sab mix karo.", "Pake chicken ko strips mein kaato.", "Bowl mein chawal ki base, upar chicken strips, upar se dahi-kheera sauce daalo. Ready!"], "link": "Reel: https://www.instagram.com/reel/DMLLYU4xfMt/"}, "chicken steak mashed potato beans aloo": {"badges": ["60g protein", "650 cal"], "ing": [{"t": "Chicken: 360g chicken breast, namak, kali mirch, thyme/rosemary, 2–4 tsp nimbu ras/vinegar, 2 tsp garlic powder, 2 tbsp tel"}, {"t": "Beans: 160–200g green beans (uble hue), 1/2 stock cube, 400ml paani, 1 tsp butter + 1 tsp maida"}, {"t": "Mash: 300g aloo (uble), 1 tsp butter, namak, kali mirch, onion powder, garlic powder, thoda doodh"}], "steps": ["Chicken mein namak, mirch, thyme, nimbu, garlic powder lagao, 1 hr marinate.", "2 tbsp tel mein tez aanch pe dono taraf golden karo, phir 4–6 tbsp paani daal ke dhak do, medium pe 5 min.", "Usi pan mein paani + stock cube daal ke beans pakao, nikaal lo. Butter-maida mix daal ke sauce gaadha karo.", "Uble aloo mein butter, namak, masale, doodh mila ke mash karo. Plate mein sajao."], "link": "Reel: https://www.instagram.com/reel/DdEN8T4Pgdj/"}, "garlic chicken lehsun sauce coconut milk": {"badges": ["58.6g protein", "456 cal"], "ing": [{"t": "500g chicken breast cubes (poori recipe = 2 servings)"}, {"t": "1 tsp adrak-lehsun paste, 1 tsp adrak-lehsun powder, 1 tsp chilli flakes, 1/2 tsp laal mirch powder"}, {"t": "1 tbsp cornflour, 1/2 tsp kali mirch, 1.5 tsp namak"}, {"t": "Sauce: 1 tbsp kata lehsun, 1/2 tbsp soy sauce, 2 tbsp coconut milk, 1 tsp honey, 2 tsp nimbu ras"}], "steps": ["Chicken mein saare marinade masale milao, 15 min rakh do.", "Sauce ke ingredients alag bowl mein mix karo.", "Pan mein 1 tbsp tel garam karo, chicken daalo, medium aanch pe 5 min pakao.", "Sauce daal ke mix karo, 2–3 min aur pakao.", "Upar se nimbu ras aur hara dhaniya. Ready!"], "link": "Reel: https://www.instagram.com/reel/C-9W2EeSpcN/"}, "chicken cutlet salad bowl tikki keema": {"badges": ["50g protein", "28g carbs", "550 cal"], "ing": [{"t": "500g chicken keema, 10–12 lehsun, 2 inch adrak, 2–4 hari mirch, 2 pyaaz (bareek)"}, {"t": "2 tbsp soy sauce, 2 slice whole wheat bread (chura), 2 tsp tel"}, {"t": "Salad: shimla mirch, kheera, cherry tomatoes, pyaaz"}, {"t": "Dressing: olive oil, balsamic/nimbu, kali mirch, namak"}], "steps": ["Keema mein lehsun, adrak, mirch, pyaaz, soy sauce, bread chura mix karke tikkiya banao.", "Non-stick pan mein 2 tsp tel, tikkiya dono taraf 10–12 min sek lo.", "Salad kaato, dressing milao, tikkiyon ke saath serve karo."], "link": "Reel: https://www.instagram.com/reel/DcvsWdax757/"}, "nepali chicken chukauni dahi tadka": {"badges": ["38g protein", "380 cal"], "ing": [{"t": "400g chicken thigh, 2 tsp adrak-lehsun paste, 1/2 tsp namak, 1/2 tsp kali mirch, 1 tsp laal mirch, 1/2 tsp haldi, 1 tsp nimbu ras"}, {"t": "Mix: 1/2 pyaaz (patla kata), 1 hari mirch, 3 tbsp dhaniya"}, {"t": "Dahi base: 1 cup Greek yogurt (low fat), 1 tsp lehsun paste, 1/2 tsp namak, 1/2 tsp cheeni"}, {"t": "Tadka: 1 tsp sarson tel, 1/2 tsp haldi, 1/2 tsp laal mirch, 1 tsp kasuri methi"}], "steps": ["Chicken mein masale + nimbu milao, 10–15 min rakh do.", "Bahut kam tel mein tez aanch pe golden fry karo.", "Kati pyaaz, mirch, dhaniya milao.", "Dahi mein lehsun, namak, cheeni milao.", "Sarson tel dhuaan aane tak garam karo, gas band karke haldi, mirch, kasuri methi daalo, dahi mein daal do.", "Dahi chicken pe daalo, mix karo. Roti ya chawal ke saath."], "link": "Reel: https://www.instagram.com/reel/DXsvETmE3KW/"}, "chicken mushroom broccoli stir fry": {"badges": ["28g protein", "240 cal"], "ing": [{"t": "Chicken: 250g breast strips, 1 tbsp cornflour, 1/4 tsp baking soda, 1 tsp soy sauce, namak, kali mirch, 1 tsp tel"}, {"t": "Stir fry: 1 tsp tel, 1.5 tbsp adrak-lehsun (crushed), 1/4 cup pyaaz, 1 cup mushrooms, 1 cup broccoli, namak"}, {"t": "1.5 tsp soy sauce, 1 tsp chilli crisp (na ho to chilli flakes), 1 tsp honey, 2 tbsp spring onion greens"}], "steps": ["Chicken mein cornflour, baking soda, soy sauce, namak, mirch milao, 10–15 min.", "Tez aanch pe golden karo (har taraf 2 min max), nikaal lo.", "Usi pan mein tel, adrak-lehsun, pyaaz; mushrooms, broccoli, namak — tez aanch pe.", "Soy sauce, chicken wapas, chilli crisp + honey — 1–2 min toss karo glossy hone tak.", "Spring onion upar se."], "link": "Reel: https://www.instagram.com/reel/DXTMuK4gd2C/"}, "egg ghee roast anda masala": {"badges": ["20g protein", "400 cal"], "ing": [{"t": "Masala (sukha bhun ke peeso): 1 dalchini, 3 laung, 1 tsp saunf, 1/2 tsp kali mirch, 1/4 tsp methi, 1/2 tsp jeera, 1.5 tsp dhaniya seeds, curry patta"}, {"t": "Paste (peeso): 6 bheegi Kashmiri mirch, 6 lehsun, 10 kaju, 1/2 tsp imli + 50ml paani"}, {"t": "5 ande, 1 tsp tel, 1 tbsp ghee, 1/2 tsp jeera, 1 pyaaz (bareek), namak, curry patta"}], "steps": ["1 tsp tel mein 5 ande + 1 tsp namak — scramble karke nikaal lo.", "1 tbsp ghee mein 1/2 tsp jeera + 1 pyaaz (bareek) + namak + curry patta — sunehra karo.", "Paste + pisa masala + 200ml paani daalo, dhak ke pakao jab tak tel alag ho.", "Ande milao, masala lapet lo. Ready!"], "link": "Reel: https://www.instagram.com/reel/DcbJ2KBzz8u/"}, "chicken tikka rice bowl kesar chawal": {"badges": [], "ing": [{"sub": "Tikka"}, {"t": "250g boneless chicken, 2 tbsp hung curd, 1 tsp adrak-lehsun paste"}, {"t": "1/2 tsp haldi, 1 tsp Kashmiri laal mirch, 1/2 tsp kasuri methi, 1 tsp dhaniya powder, 1 tsp tandoori masala, namak"}, {"t": "1 tsp sarson tel, aadhe nimbu ka ras"}, {"sub": "Rice"}, {"t": "1/2 cup chawal (10–15 min bhigo do), 1 tbsp ghee, 3–4 laung, 1 pyaaz (sliced), kesar, namak, dhaniya"}, {"sub": "Salad"}, {"t": "1 tamatar (beej nikaal ke kata), 1 chhoti pyaaz, 1 kheera, dhaniya, namak, 1/2 tsp laal mirch, aadha nimbu"}], "steps": ["Tikka ke saare masale chicken mein milao, 20 min marinate.", "Pan mein thoda tel, chicken pakao jab tak paani sukh jaye aur gal jaye.", "Chawal: ghee mein laung + pyaaz sunehra karo. Chawal + 1 cup paani + kesar + namak + dhaniya, dhak ke pakao.", "Salad ki cheezein mila lo.", "Bowl mein sab assemble karo."], "link": "Reel: https://www.instagram.com/reel/C6OQlI5SS0N/"}, "tohan mosdeng tripura chicken salad bharta": {"badges": [], "ing": [{"t": "250g chicken, 10–12 lehsun, 1 inch adrak, 5–6 hari mirch"}, {"t": "2 sukhi laal mirch, 1 pyaaz, 1 tbsp olive oil, hara dhaniya"}], "steps": ["Chicken ko lehsun, adrak, hari mirch ke saath ubalo — 6 min mein nikaal lo. Bache paani ko aur ubal ke gaadha karo.", "Lehsun, mirch ko sukha bhun ke koot lo.", "Chicken shred karo, kati pyaaz, dhaniya, koota masala aur gaadha paani milao.", "Roti/chawal ke saath ya salad ki tarah khao."], "link": "Reel: https://www.instagram.com/reel/CvhNQedILVX/"}, "steamed ginger scallion chicken adrak spring onion steam": {"badges": [], "ing": [{"t": "2 chicken thighs (skin ke saath), 1 bada adrak (sliced), namak"}, {"t": "3–4 spring onion (bareek), 2–3 tbsp tel, 1–2 tbsp soy sauce"}, {"t": "Saath mein: steamed rice"}], "steps": ["Plate mein adrak slices bichhao, chicken upar rakho, namak chhidko.", "15–20 min steam karo. Neeche jo soup jama ho use phenko mat.", "Chicken nikaal ke shred karo.", "Steamed adrak + spring onion kaato, garam tel upar daalo (khushboo aayegi).", "Soy sauce + bacha hua chicken soup milao.", "Chicken pe daal ke garam chawal ke saath serve karo."], "link": "Reel: https://www.instagram.com/reel/DZ661CTtCtC/"}, "healthy chicken rice bowl butter garlic corn salad": {"badges": [], "ing": [{"sub": "Chicken (500g)"}, {"t": "Namak, laal mirch, haldi, dhaniya powder, chicken masala, garam masala, adrak-lehsun paste, nimbu ras"}, {"sub": "Butter garlic rice"}, {"t": "2 tbsp butter, 8–10 kate lehsun, chilli flakes, namak, uble chawal, hara dhaniya"}, {"sub": "Salad aur corn"}, {"t": "Salad: kheera, gajar, tamatar, pyaaz, dhaniya, nimbu, namak, kali mirch"}, {"t": "Sweet corn: ubla corn + namak + chilli flakes + dhaniya + nimbu"}], "steps": ["Chicken ko masalon mein 20 min marinate karke pan/air fryer mein pakao.", "Butter garlic rice: butter mein lehsun, chilli flakes, namak bhuno; uble chawal milao, hara dhaniya upar se.", "Salad kaat ke milao. Corn mein namak, chilli flakes, dhaniya, nimbu milao.", "Bowl mein chawal, chicken, salad, corn — sab assemble karo."], "link": "Reel: https://www.instagram.com/reel/Da7vb1Gzsbc/"}, "chicken souvlaki bowl greek tzatziki aloo": {"badges": [], "ing": [{"sub": "Chicken marinade"}, {"t": "400g chicken breast, 1/4 cup Greek yogurt, 1 tbsp nimbu ras, 1.5 tsp olive oil, 2 lehsun"}, {"t": "1 tsp oregano, 1 tsp paprika, 3/4 tsp namak, 1/2 tsp kali mirch — 30 min marinate"}, {"sub": "Aloo"}, {"t": "600g aloo (chhote cubes), oil spray, 1 tsp oregano, 1.5 tsp garlic powder, 1 tsp paprika, namak, mirch"}, {"sub": "Salad"}, {"t": "1/2 bada kheera, 1 tamatar, 1/4 laal pyaaz, 1 tbsp dhaniya/parsley, 1/2 tbsp nimbu, chutki namak"}, {"sub": "Tzatziki"}, {"t": "3/4 cup Greek yogurt, 1/4 kheera (kaddukas + paani nichod ke), 1 lehsun, 1/2 tbsp nimbu, namak, mirch"}], "steps": ["Chicken marinade mein 30 min rakho.", "Aloo air fryer 200°C pe 20 min (beech mein hilao), 1.5 tsp nimbu ras upar se.", "Chicken air fryer 200°C pe 12 min (halka char aane do).", "Salad aur tzatziki bana lo. 2 bowls mein baanto."], "link": "Reel: https://www.instagram.com/reel/DYlF4TKtJT8/"}, "bhuna chicken wings masala": {"badges": [], "ing": [{"sub": "Marinade"}, {"t": "500g chicken wings, 2 tbsp adrak-lehsun paste, 1 tbsp hari mirch paste, 1 tbsp laal mirch, 1 tbsp dhaniya powder"}, {"t": "1 tsp haldi, 1/2 tsp garam masala, 1/2 tsp kali mirch, namak, 1 tbsp dahi, hara dhaniya"}, {"sub": "Bhuna masala (peeso)"}, {"t": "1 tbsp dhaniya seeds, 3–4 hari elaichi, 1 badi elaichi, 1 tbsp jeera, 1 tbsp kali mirch, 10–12 laung, namak"}], "steps": ["Wings ko marinade mein 1 hr rakh do.", "1 tbsp tel + 1 tbsp ghee mein wings sear karo golden hone tak, nikaal lo.", "1.5 tbsp tel + 1 tsp ghee mein kali mirch + 1 cup kati pyaaz bhuno.", "Pisa masala + thoda paani daalo, phir wings wapas daalo.", "2–3 tbsp dahi milao, dhak ke pakao jab tak gal jaye.", "Nimbu + dhaniya upar se."], "link": "Reel: https://www.instagram.com/reel/Cqxlcx9IL0K/"}, "freezer chicken kebabs tikki meal prep": {"badges": [], "ing": [{"t": "3 chicken breast (cubes), 1 muthi dhaniya, 1 muthi pudina, 6–7 lehsun, 1 inch adrak, 2–3 hari mirch"}, {"t": "2 pyaaz (tel mein brown karke), namak, kali mirch, laal mirch, garam masala, cheese (optional)"}], "steps": ["Sab kuch mixer mein pees ke keema banao.", "Kebab tikkiya banao — zyada banao to freezer mein rakho.", "Jab chahiye, tawa/air fryer mein sek lo."], "link": "Reel: https://www.instagram.com/reel/DeRUOg3s61f/"}, "low carb chicken cutlet tikki keema": {"badges": [], "ing": [{"t": "500g chicken keema, 2 uble kacche kele (raw banana — low-carb binder, aloo/breadcrumb ki jagah), 2 ande"}, {"t": "2 tamatar (kate), 2 pyaaz (kate), hara dhaniya"}, {"t": "2 tsp laal mirch powder, namak, kali mirch, 2 tsp tel"}], "steps": ["Keema mein uble kele ke slices, kata tamatar, pyaaz, dhaniya milao.", "2 ande phod ke daalo (binding ke liye).", "Namak, kali mirch, laal mirch daal ke haath se achhe se mix karo.", "Gol tikkiya banao.", "Non-stick pan mein bahut kam tel mein dono taraf golden-brown sek lo, spatula se halka dabao.", "Garam serve karo — bahar crisp, andar juicy!"], "link": "Reel: https://www.instagram.com/reel/DNCy65OJZYt/"}, "zucchini curd rice grilled chicken dahi chawal low carb": {"badges": ["54.5g protein", "461 cal"], "ing": [{"sub": "Curd rice"}, {"t": "300g zucchini, 300g dahi, namak"}, {"t": "Tadka: rai, urad dal, 4 sukhi laal mirch, 2 tbsp kata adrak, 4 hari mirch, curry patta, 3 tsp tel"}, {"sub": "Chicken"}, {"t": "460g chicken, 4 tbsp hung curd, 4 hari mirch, 2 tbsp adrak, 8–10 lehsun, 2 nimbu ras, namak"}], "steps": ["Zucchini KACCHA kaddukas karo (pakana nahi!), dahi + namak milao.", "3 tsp tel mein rai, urad dal, mirch, adrak, curry patta ka tadka — dahi mein daal do.", "Chicken pe hung curd + hari mirch + adrak + lehsun + nimbu + namak ka paste lagao, 2–3 hr fridge mein.", "Air fryer 180°C pe 18 min, phir 200°C pakne tak (3/4 pe halka tel spray).", "Curd rice ke saath serve karo — low carb meal!"], "link": "Link: https://www.reddit.com/r/Fitness_India/comments/1vyq2um/just_sharing_a_high_proteinlow_carb_lunch_idea/"}, "kosambari salad moong dal kheera anaar paneer": {"badges": ["27g protein", "410 cal"], "ing": [{"t": "300g kheera, 100g bheegi moong dal, 100g gajar (kaddukas), 20g nariyal, 80g anaar"}, {"t": "100g paneer (crumbled, low fat), 20g moongfali (bhuni), dhaniya, 2 hari mirch, 1 tsp namak, 1 nimbu"}], "steps": ["Sab kuch ek bowl mein daalo, achhe se milao. Bas ready! (Pakana nahi hai)"], "link": "Reel: https://www.instagram.com/reel/Dc-5JbGzIEG/"}, "chickpea quinoa bhel chana dahi chutney": {"badges": ["25g protein"], "ing": [{"t": "2 tamatar, 2 pyaaz, 2 kheera (sab bareek), 1 cup uble chane, 1 cup ubli quinoa"}, {"t": "Namak, kali mirch, dhaniya, 1 tsp jeera powder"}, {"t": "220g Greek yogurt, 4 tbsp hari chutney, 2 tbsp sriracha"}], "steps": ["Kati sabzi + chane + quinoa + masale milao.", "Dahi + chutney + sriracha alag milao.", "Plate mein dahi mix bichhao, upar bhel daalo. Ready!"], "link": "Reel: https://www.instagram.com/reel/DbxNgGChr8A/"}, "cucumber boats kheera chana skyr avocado": {"badges": ["25g protein", "~440 cal"], "ing": [{"t": "4 kheere, 160g uble chawal, 160g uble chane, 60g avocado, 240g skyr/dahi"}, {"t": "2 tsp chilli oil, 2 jalapeno/hari mirch, namak, til, sriracha"}, {"t": "Dip: soy sauce + paani + nimbu + shahad"}], "steps": ["Kheere lambe kaato, beej nikaal ke boat banao.", "Chawal halka mash karke boat mein bichhao.", "Chane + avocado + skyr + chilli oil + mirch + namak mash karke upar lagao.", "Til + sriracha upar se.", "Dip ke saath serve karo."], "link": "Reel: https://www.instagram.com/reel/Db5oiioMm3r/"}, "peri peri mushroom paneer": {"badges": ["21.6g protein", "210 cal"], "ing": [{"t": "200g mushrooms (kate), 120g high-protein paneer, 2 tsp tel, 5–6 lehsun, 1 pyaaz (bareek)"}, {"t": "2 tbsp peri-peri masala, 1 tsp Kashmiri mirch, chilli flakes, oregano, dhaniya, namak"}], "steps": ["Mushroom bina tel ke pakao jab tak paani sukh jaye.", "2 tsp tel, lehsun, pyaaz — 4–5 min bhuno.", "Paneer + peri-peri + Kashmiri mirch pees ke paste banao (thoda paani).", "Mushroom mein chilli flakes, phir paneer paste daal ke 2–3 min pakao.", "Oregano + dhaniya upar se. Roti ya herb rice ke saath."], "link": "Reel: https://www.instagram.com/reel/DblIuaUCGwy/"}, "chikkar chole kabuli chana dahi": {"badges": [], "ing": [{"t": "250g kabuli chana (raat bhar bheega), 1 aloo (150g), 1 tez patta, namak"}, {"t": "Paste: ubla aloo + 1 tbsp chana + 80g Greek yogurt + cooker ka paani (pees lo)"}, {"t": "Tadka: 1.5 tbsp sarson tel, 2 pyaaz (200g, bareek), 15g adrak, 2 hari mirch, 1/2 tsp haldi, 1 tsp laal mirch, 2 tsp dhaniya, 1 tbsp chana masala, 1 tsp brown sugar, 1/2 tsp namak"}], "steps": ["Chana + aloo + tez patta + namak + paani — cooker mein 4–5 seeti, phir 5 min dheemi.", "Aloo + chana + dahi + paani pees ke paste banao.", "Sarson tel mein pyaaz, adrak, mirch sunehri karo.", "Masale daalo, phir dahi-aloo paste 3 min pakao.", "Chane + thoda cooker paani daalo, sugar + namak, gaadha hone tak simmer karo."], "link": "Reel: https://www.instagram.com/reel/DcyEpdRzHtu/"}, "kala chana paneer kabab roll wrap": {"badges": [], "ing": [{"t": "Kabab: 2 cup kala chana (6–7 hr bheega, ubal lo), 100g paneer (kaddukas), 1 pyaaz, 2 hari mirch, 1 inch adrak, 8–10 lehsun"}, {"t": "2 tsp dhaniya, 1/2 tsp mirch, 1/2 tsp dhaniya powder, 1/2 tsp garam masala, 1 tsp chaat masala, 1/2 tsp kali mirch, 1 tsp namak, 1 tsp tel"}, {"t": "Roll ke liye: paratha/whole wheat roti, pyaaz, chutney"}], "steps": ["Chana ubal ke mash karo, paneer + masale + pyaaz milao, kabab banao.", "Tawa pe 1 tsp tel mein sek lo.", "Paratha/whole wheat roti mein kabab + pyaaz + chutney lapet ke roll banao."], "link": "Reel: https://www.instagram.com/reel/DbK_MUch-6Q/"}, "bhuna paneer shimla dahi": {"badges": [], "ing": [{"t": "200g paneer, 1/2 hari + 1/2 orange shimla (lambe kate), 1/2 pyaaz (lambe kata), hari mirch, adrak, namak, kali mirch, 2–3 tbsp butter"}, {"t": "Masala: 1/2 tbsp jeera, kali mirch, chutki heeng, 1 chhoti pyaaz (bareek), 1 tbsp adrak-lehsun paste, 2 tamatar (puree)"}, {"t": "Dahi mix: 1.5 tbsp dahi, 1/2 tbsp namak, 1/2 tbsp laal mirch, 1/2 tbsp Kashmiri mirch, 1/2 tbsp kali mirch, 1/2 tbsp jeera powder, 1/2 tbsp haldi, 1/2 tbsp dhaniya, 1/2 tbsp kasuri methi"}], "steps": ["Butter mein paneer + shimla + pyaaz + mirch + adrak — tez aanch pe 5 min toss karo, nikaal lo.", "Usi pan mein jeera, kali mirch, heeng, pyaaz, adrak-lehsun — bhuno.", "Tamatar puree + dahi masala mix daal ke bhuno jab tak tel alag ho.", "Paneer-veggies wapas daalo, mix karo. Garam parathe ke saath."], "link": "Reel: https://www.instagram.com/reel/DdF-EdQu02O/"}, "soya kebab wrap roll tikki": {"badges": [], "ing": [{"t": "1 cup soya chunks, 1 pyaaz + mixed sabzi (bareek kati)"}, {"t": "Namak, laal mirch, dhaniya powder, garam masala, 1 tsp tel"}, {"t": "2 hari mirch, hara dhaniya/pudina, 3 tbsp dahi"}, {"t": "2 whole wheat tortilla/rotis, patta gobhi (shredded)"}], "steps": ["Soya chunks bhigo ke bareek pees lo.", "Kati sabzi + masale mila ke kebab mixture banao, tikkiya banao.", "Pan mein thode tel mein dono taraf golden sek lo.", "Hari mirch + dhaniya + dahi pees ke hari chutney banao.", "Tortilla pe chutney lagao, tikkiya + patta gobhi rakho, roll karo."], "link": "Reel: https://www.instagram.com/reel/Dbw_gCDOb0L/"}, "paneer steak raita makhani patta gobhi": {"badges": [], "ing": [{"t": "250g paneer (mote steak slices)"}, {"t": "Makhani marinade: 2 tamatar + 8–10 kaju + 1 tbsp adrak-lehsun + 1 tsp garam masala (pees lo)"}, {"t": "Raita: 150g Greek yogurt/dahi, 1 cup patta gobhi (shredded), 1 pyaaz (sliced), namak, basic masale"}], "steps": ["Makhani marinade banao aur pees lo, paneer steaks mein lapet ke 20 min rakho.", "Pan mein dono taraf golden sek lo.", "Raita: dahi + patta gobhi + pyaaz + namak + masale milao.", "Plate mein raita bichhao, upar paneer steak rakho. Serve!"], "link": "Reel: https://www.instagram.com/reel/Dars5PIhktB/"}, "paneer steak fried rice bowl chawal sabzi": {"badges": [], "ing": [{"t": "200g paneer (mote steak slices), 1.5 cup paka hua chawal"}, {"t": "1 pyaaz, 1 gajar, 1 shimla mirch (sab bareek kate)"}, {"t": "1 tsp laal mirch powder (paneer seasoning ke liye), 1/2 tsp haldi, namak, basic masale, hara dhaniya, 1 tsp tel/makkhan"}], "steps": ["Pyaaz, gajar, shimla mirch bareek kaato.", "Pan mein thode tel mein sabziyan bhuno.", "Paneer ke mote steak slices kaato, laal mirch-masala lagao, dono taraf sek lo.", "Sabziyon mein haldi, namak, masale daalo.", "Paka chawal daal ke achhe se toss karo — fried rice ready.", "Bowl mein rice rakho (gol shape), upar paneer steak, dhaniya se garnish karo."], "link": "Reel: https://www.instagram.com/reel/Ddl3KBDvWYq/"}, "oatmeal egg sandwich anda oats nashta": {"badges": [], "ing": [{"t": "6 tbsp oats, 4 ande, paani (chhidkao), til/sesame (optional)"}, {"t": "Filling: cheese, hari sabzi, tamatar, ketchup"}], "steps": ["Non-stick pan mein 6 tbsp oats bichhao, halka paani chhidko.", "4 ande phod ke faila do, til upar se.", "Palto, filling rakho (cheese, sabzi, tamatar), fold karo."], "link": "Reel: https://www.instagram.com/reel/DZbRdwLyMw_/"}, "moong dal vada air fryer snack": {"badges": ["19g protein", "~360 cal"], "ing": [{"t": "150g peeli moong dal (3 hr bheegi), 2 hari mirch, 2 lehsun, 20g chawal atta"}, {"t": "1 tbsp pyaaz, 1 tbsp dhaniya, 1/2 tsp jeera, 1/4 tsp ajwain, 1/4 tsp laal mirch, 1/4 tsp haldi, 1/2 tsp chaat masala, namak"}, {"t": "1/4 tsp baking soda, 1 tsp garam tel"}, {"t": "Dip: 50g skyr + 1 tbsp hari chutney"}], "steps": ["100g dal + mirch + lehsun pees ke gaadha paste banao, 2 min phento.", "Bachi 50g dal + atta + masale milao (namak, soda, pyaaz abhi nahi).", "Air fryer 200°C pe 5 min preheat.", "Batter mein pyaaz, namak, soda, garam tel milao, tikkiya banao.", "200°C pe golden hone tak air fry karo. Dip ke saath."], "link": "Reel: https://www.instagram.com/reel/DcLgffas8Ud/"}, "trail mix makhana chana poha seeds snack": {"badges": [], "ing": [{"t": "Makhana, bhune chane, patla poha, mixed seeds — sab handful"}], "steps": ["Sab ko 180°C pe 15 min roast karo crunchy hone tak.", "Dabbe mein rakho — bhookh lage to muthi bhar khao."], "link": "Reel: https://www.instagram.com/reel/DcsVM2vPNd3/"}, "egg chutney stuffed eggs anda laal chutney snack": {"badges": [], "ing": [{"t": "6 ande"}, {"t": "Chutney: 8–10 lehsun (bareek kata), 2–3 tbsp laal mirch powder, 2–3 tbsp til ka tel"}], "steps": ["Lehsun + laal mirch + tel mila ke gadi laal chutney banao.", "Ande hard-boil karke aadhe kaato.", "Peeli jagah (yolk cavity) mein chutney bharo.", "Serve karo. (Street-style snack!)"], "link": "Reel: https://www.instagram.com/reel/DbSzoILTAMv/"}, "vrat thecha raita paneer makhana tikki": {"badges": [], "ing": [{"t": "Tikki: 1 cup makhana, 150g paneer (kaddukas), 2 tbsp dhaniya, 1 gajar (kaddukas), vrat namak + masale"}, {"t": "Thecha: 2 tbsp moongfali, 3–4 hari mirch, 4–5 lehsun"}, {"t": "Raita: 200g dahi, 1 tsp chilli oil"}], "steps": ["Makhana bhun ke pees lo.", "Paneer + makhana powder + dhaniya + gajar + masale mila ke chhoti tikkiya banao, pan mein golden sek lo.", "Thecha: moongfali + hari mirch + lehsun bhun ke pees lo.", "Dahi mein thecha milao = thecha raita.", "Bowl mein raita, upar tikkiya, chilli oil drizzle karo."], "link": "Reel: https://www.instagram.com/reel/DeYjtBgJz-e/"}, "zero oil chicken shorba soup bina tel": {"badges": [], "ing": [{"t": "Paste (pees lo): 2 pyaaz, aadha katori lehsun, 1 adrak, 2 hari mirch, dhaniya, pudina, 1 tbsp jeera, 1 tsp kali mirch, paani"}, {"t": "Cooker: 750ml paani, 800g bone-in chicken, 1 dalchini, 5–7 laung, 2 tez patta, 1 badi + 3–4 chhoti elaichi, 1 tsp dhaniya powder, namak"}], "steps": ["Cooker mein paani + chicken + khade masale + namak — 3–4 seeti.", "Hari paste milao, 5 min aur ubalo. Garam serve karo. (Bilkul tel nahi!)"], "link": "Reel: https://www.instagram.com/reel/DcQ7F7cAfHf/"}, "coriander stem soup dhaniya danthal": {"badges": [], "ing": [{"t": "Dhaniya ke danthal + jad (dhule hue), 1 tamatar, kuta lehsun"}, {"t": "Bhuna jeera powder, nimbu ras, namak, tadke ke liye thoda tel"}], "steps": ["Danthal, tamatar, lehsun ko paani mein ubalo, phir chhaan lo (ya pees ke chhaan lo).", "Thode tel mein jeera ka tadka, soup mein milao.", "Nimbu + namak. Garam piyo."], "link": "Reel: https://www.instagram.com/reel/Dc0w2Wzsms1/"}, "high protein mayonnaise mayo anda": {"badges": ["20g protein", "360 cal"], "ing": [{"t": "3 uble ande, 2 lehsun, 3 sukhi laal mirch (10 min bheegi)"}, {"t": "1 tsp kali mirch, 1 tsp brown sugar, 1 tbsp olive oil, 100ml paani, 1 tsp namak"}], "steps": ["Sab mixer mein daal ke smooth pees lo. Mayo ready!"], "link": "Reel: https://www.instagram.com/reel/DbzzOXoTYLt/"}, "berry cheesecake no bake meetha dessert": {"badges": [], "ing": [{"t": "Base: oats + badam + beej nikale khajoor, pighla butter"}, {"t": "Cheese layer: paneer + Greek yogurt + thoda cheese (meetha chahiye to monk fruit)"}, {"t": "Berry jam: frozen berries"}], "steps": ["Base: oats + badam + khajoor pees lo, pighla butter milao, dabbe mein daba ke set karo.", "Cheese layer: paneer + Greek yogurt + cheese pees ke smooth karo, base pe daalo, 4–5 hr fridge.", "Berry jam: frozen berries ko dheemi aanch pe gaadha hone tak pakao, thanda karke upar failao.", "Fridge mein rakho, jab meetha mann kare khao!"], "link": "Reel: https://www.instagram.com/reel/DdYrF99B7c3/"}, "tiramisu protein shake coffee whey": {"badges": [], "ing": [{"t": "Espresso/coffee, brown rice crackers (unsalted), Greek yogurt, whey protein, creatine (optional), cacao powder"}], "steps": ["Sab mixer mein daal ke blend karo, upar se cacao chhidko. Pre-workout ke liye solid!"], "link": "Reel: https://www.instagram.com/reel/DakuEyBIzGV/"}, "banana blueberry peanut butter muffins kela meetha dessert": {"badges": ["20g protein", "500 cal"], "ing": [{"t": "2 pake kele, 180g natural peanut butter (bina cheeni wali)"}, {"t": "2 ande, 1 cup blueberry (150g), 1 tsp baking powder"}], "steps": ["Bowl mein sab daal ke kele mash karte hue achhe se milao.", "Muffin moulds mein daalo (3 bade).", "Pehle se garam air fryer/oven mein 180°C pe ~25 min bake karo — andar stick daal ke dekho, saaf nikle to ready!"], "link": "Reel: https://www.instagram.com/reel/DeN3ZVjzgcX/"}, "dahi chicken roz dahi wala": {"badges": ["~75g protein"], "ing": [{"t": "500g chicken, 200g phenta dahi"}, {"t": "1 tsp haldi, 2 tsp dhaniya, 1 tsp mirch, namak"}, {"t": "2 tsp tel, 2 tbsp adrak-lehsun paste, hara dhaniya"}], "steps": ["Chicken + dahi + haldi + dhaniya + mirch + namak — 15 min marinate.", "2 tsp tel mein adrak-lehsun 1 min bhuno.", "Chicken daal ke 5 min tez aanch, phir dhak ke 12–15 min.", "Dhaniya upar se. Chawal ke saath."], "link": null}, "tawa chicken tikka roz": {"badges": ["~75g protein"], "ing": [{"t": "500g chicken, 6 tbsp dahi, 2 tbsp tikka masala, nimbu, namak, 2 tsp tel"}], "steps": ["Chicken + dahi + tikka masala + nimbu + namak — 30 min marinate.", "Tawa pe 2 tsp tel, har taraf 4–5 min seko.", "Ya air fryer 200°C pe 12 min (beech mein palto).", "Salad + roti ke saath."], "link": null}, "palak chicken roz spinach": {"badges": ["~72g protein"], "ing": [{"t": "500g chicken, 400g palak, 2 pyaaz, 2 tbsp adrak-lehsun paste, garam masala, namak, 2 tsp tel"}], "steps": ["Palak 2 min ubal ke pees lo (puree).", "2 tsp tel, pyaaz + adrak-lehsun 3 min bhuno.", "Chicken 5 min tez aanch pe.", "Palak puree + garam masala + namak, dhak ke 12 min. Chawal ke saath."], "link": null}, "chicken curry roz tamatar pyaaz": {"badges": ["~75g protein"], "ing": [{"t": "500g chicken, 2 pyaaz, 4 tamatar (puree), khade masale, 2 tbsp adrak-lehsun paste"}, {"t": "Haldi, dhaniya, mirch, namak, 2 tsp tel"}], "steps": ["2 tsp tel, khade masale + pyaaz sunehra (5–6 min).", "Adrak-lehsun + haldi/dhaniya/mirch + tamatar puree — 5 min bhuno.", "Chicken 5 min, phir 1 cup paani, dhak ke 15 min.", "Roti ke saath."], "link": null}, "lemon pepper chicken roz sukha nimbu": {"badges": ["~72g protein"], "ing": [{"t": "500g chicken (patle tukde), 2 tbsp kata lehsun, 2 tsp kali mirch, 2 nimbu, namak, 2 tsp tel"}], "steps": ["2 tsp tel, kata lehsun 30 sec bhuno.", "Chicken 6–7 min tez aanch pe.", "Kali mirch + namak, 2 min aur.", "Gas band karke nimbu nichodo. Dal-chawal ke saath."], "link": null}, "paneer bhurji roz veg": {"badges": ["~38g protein"], "ing": [{"t": "400g paneer (kaddukas), 2 pyaaz, 2 shimla mirch, 2 tamatar, haldi, mirch, namak, 2 tsp tel"}], "steps": ["2 tsp tel, pyaaz 2 min bhuno.", "Shimla + tamatar 3 min.", "Haldi, mirch, namak milao.", "Paneer daal ke sirf 2 min (zyada mat pakao). Roti ke saath."], "link": null}, "palak paneer light roz veg": {"badges": ["~36g protein"], "ing": [{"t": "300g paneer, palak puree (Palak Chicken jaisa), adrak-lehsun paste, garam masala, namak, 2 tsp tel"}], "steps": ["2 tsp tel, adrak-lehsun 1 min bhuno.", "Palak puree + garam masala + namak 5 min pakao.", "Paneer daal ke 3 min. Cream nahi dalni."], "link": null}, "tofu shimla stir fry roz veg": {"badges": ["~22g protein"], "ing": [{"t": "500g tofu, 2 shimla mirch, 2 pyaaz, 2 tbsp soy sauce, kali mirch, 2 tsp tel"}], "steps": ["Tofu kapde mein 10 min daba ke paani nikaalo.", "Tez kadhai, 2 tsp tel. Tofu golden karo (2–2 min), nikaal lo.", "Pyaaz + shimla 3 min tez aanch pe.", "Tofu wapas + soy sauce + kali mirch, 1 min."], "link": null}, "fish curry roz machli": {"badges": ["~50g protein"], "ing": [{"t": "500g fish, 2 pyaaz, 4 tamatar (puree), rai, curry patta, masale (haldi, dhaniya, mirch), namak, 2 tsp tel"}], "steps": ["2 tsp tel, rai + curry patta tadka.", "Pyaaz 4 min bhuno. Tamatar puree + masale 5 min.", "1 cup paani, ubal aane do.", "Fish 8–10 min dheemi aanch (zyada chalana nahi, toot jayegi). Chawal ke saath."], "link": null}, "soya chunk curry roz veg": {"badges": ["~32g protein"], "ing": [{"t": "120g soya chunks, 2 pyaaz, 4 tamatar (puree), adrak-lehsun paste, masale, namak, 2 tsp tel"}], "steps": ["Soya chunks 15 min garam paani mein bhigo ke 2–3 baar nichod do.", "2 tsp tel, pyaaz + adrak-lehsun + masale + tamatar puree 5 min bhuno.", "Soya + 1 cup paani, dhak ke 10 min. Chawal ke saath."], "link": null}, "dal tadka roz moong arhar masoor": {"badges": [], "ing": [{"t": "120g dal (moong/arhar/masoor badal ke), haldi, namak, 4 cup paani"}, {"t": "Tadka: 2 tsp tel, jeera, 8–10 lehsun, 2 laal mirch, heeng"}], "steps": ["Dal + haldi + namak + 4 cup paani — cooker mein 3–4 seeti.", "2 tsp tel mein jeera + lehsun + laal mirch + heeng ka tadka.", "Dal mein daal ke 2 min ubalo."], "link": null}, "chicken sweet potato tray bake roz air fryer": {"badges": ["~65g protein"], "ing": [{"t": "500g chicken, 400g sweet potato (1 inch tukde), 1 pyaaz, 8–10 lehsun"}, {"t": "2 tsp olive oil, namak, kali mirch, paprika"}], "steps": ["Sab kuch oil + namak + kali mirch + paprika mila ke mix karo.", "Air fryer 200°C pe 5 min preheat.", "Single layer mein 20–25 min (12 min pe palto)."], "link": null}, "soya paneer iffa youtube": {"badges": ["~75g protein", "~700 kcal"], "ing": [{"t": "400g low-fat paneer, 100g soya chunks (dry), 200g dahi, 40g cheese, 100ml milk"}, {"t": "2 pyaaz, 2 tsp adrak-lehsun paste, 1 tsp laal mirch, 1 tsp dhaniya powder, 1 tsp garam masala, 1/2 tsp haldi, kali mirch, namak"}, {"t": "2 tbsp honey (optional)"}], "steps": ["Soya chunks 5 min ubalo, paani nikaal ke nichod do.", "2 tsp tel mein pyaaz + adrak-lehsun paste naram hone tak bhuno.", "Dahi + sukhe masale daalo, 2-3 min pakao.", "Soya + 1 cup paani daalo, 8-10 min simmer karo.", "Paneer + cheese + doodh milao, creamy hone tak chalao. 5 min rakh ke serve karo."], "link": "Watch: https://www.youtube.com/shorts/uUbJ6lL14o4"}, "chicken eggs rice dal power plate": {"badges": ["~75g protein", "~830 kcal"], "ing": [{"t": "400g chicken breast, 4 ande"}, {"t": "400g pake chawal, 400ml dal"}, {"t": "100g broccoli + 40g beans"}], "steps": ["Chicken pe namak, haldi, mirch laga ke pan mein sek lo ya air-fry karo.", "Chawal pakao, dal garam karo.", "Sabzi steam ya stir-fry karo.", "Ande ubalo ya fry karo.", "Sab ek plate mein saja ke serve karo."], "link": "Watch: https://www.youtube.com/shorts/JM0g0GWY6YA"}, "paneer soya chilla breakfast": {"badges": ["~55g protein", "~460 kcal"], "ing": [{"t": "200g low-fat paneer (mashed), 100g soya chunks (dry), 40g besan"}, {"t": "Pyaaz, shimla mirch, gajar (kate hue), hari mirch"}, {"t": "Namak + masale, paani, halka tel"}], "steps": ["Soya chunks ubal ke nichod do, mota pees lo.", "Soya + paneer + besan + sabzi + masale + paani mila ke batter banao.", "Tawa pe halka tel lagao, chhote chille failao, dheemi aanch pe dono taraf crisp karo."], "link": "Link: https://www.hindustantimes.com/lifestyle/recipe/woman-reveals-high-protein-low-fat-paneer-and-soya-chunks-breakfast-chilla-recipe-that-helped-her-lose-17-kg-101782874401006.html"}, "pesto paneer sandwich": {"badges": ["~55.7g protein", "~955 kcal"], "ing": [{"t": "300-400g paneer (crumbled)"}, {"t": "4-6 tbsp pesto (ya hari chutney + olive oil)"}, {"t": "8 multigrain bread slices, tamatar, pyaaz, shimla mirch, lettuce"}, {"t": "Namak, kali mirch, chilli flakes"}], "steps": ["Paneer mein pesto, namak, kali mirch milao.", "Bread pe sabzi ke saath bhar do.", "Grill/toast karo crisp hone tak."], "link": "Watch: https://www.youtube.com/shorts/MK_yLw8csxk"}, "protein oats whey breakfast": {"badges": ["~50g protein", "~688 kcal"], "ing": [{"t": "120-160g oats, 500ml doodh, 2 scoops whey"}, {"t": "20g mixed seeds, kela ya berries"}], "steps": ["Oats doodh mein pakao (ya raat bhar bhigo do).", "Halka thanda ho to whey + seeds milao.", "Upar se phal daalo."], "link": "Watch: https://www.youtube.com/shorts/MK_yLw8csxk"}, "fish khichdi dinner": {"badges": ["~50g protein", "~596 kcal"], "ing": [{"t": "300g fish fillet (rohu/basa/surmai, cubes)"}, {"t": "120g chawal + 80g moong dal"}, {"t": "2 pyaaz, 2 tamatar, adrak-lehsun paste, haldi, jeera, namak, 2 tsp tel"}], "steps": ["Chawal + dal ko haldi, namak aur 3 guna paani ke saath cooker mein 3-4 seeti pakao.", "Tel mein pyaaz, tamatar, adrak-lehsun + jeera bhuno.", "Fish daalo, 5-6 min pakao phisalne (flaky) tak.", "Khichdi mein milao, 5 min simmer karo."], "link": "Watch: https://www.youtube.com/shorts/MK_yLw8csxk"}, "soya paneer rice one pot": {"badges": ["~47g protein", "~684 kcal"], "ing": [{"t": "80g soya chunks (dry), 200g low-fat paneer, 160g kaccha chawal"}, {"t": "200g dahi, 10ml ghee/tel, mixed sabzi"}, {"t": "Laal mirch, dhaniya, haldi, namak"}], "steps": ["Soya chunks ubal ke nichod do. Chawal pakao.", "Ghee mein sabzi + masale bhuno, soya daal ke 5 min toss karo.", "Chawal + paneer cubes milao, halke se mix karo.", "Dahi ke saath serve karo."], "link": "Link: https://www.ucook.org/617439/high-protein-soya-paneer-rice-recipe-45-grams-of-protein-vegetarian-diet/"}, "shirataki noodles paneer reddit": {"badges": ["~38g protein", "~405 kcal", "~5g net carbs"], "ing": [{"t": "2 packs shirataki/konjac noodles (~400g, paani nikala hua)"}, {"t": "300g high-protein paneer (cubes)"}, {"t": "2 tbsp fresh cream + 2 tbsp cream cheese"}, {"t": "8-10 lehsun (bareek), 2 tsp chilli flakes, 1 tsp garlic powder"}, {"t": "2 tbsp soy sauce, 2 tsp vinegar, 2 tsp chilli sauce, 1 tsp peri-peri masala"}, {"t": "2 tsp tel/makkhan, namak, kali mirch, chutki stevia"}], "steps": ["Noodles 1-2 min dho ke paani nikaalo, garam pan mein 2-3 min sukha seko.", "Paneer ko chilli flakes, garlic powder, namak, kali mirch, soy sauce, stevia ke saath sunehra seko, nikaal lo.", "Usi pan mein lehsun bhuno, aanch kam karke cream + cream cheese milao smooth hone tak.", "Vinegar, soy, chilli sauce, peri-peri, namak, kali mirch daalo; noodles daal ke achhe se lapeto.", "Upar paneer rakho."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wxgvqm/creamy_chili_garlic_shirataki_noodles_with_sauted/"}, "soya chunk curry home style": {"badges": ["~26g protein", "~350 kcal"], "ing": [{"t": "100g soya chunks (dry)"}, {"t": "2 pyaaz, 2 tamatar, 2 tsp adrak-lehsun paste"}, {"t": "1 tsp jeera, 1/2 tsp haldi, 1 tsp laal mirch, 2 tsp dhaniya, 1 tsp garam masala"}, {"t": "2 tbsp tel, 3 cup paani, namak, hara dhaniya"}], "steps": ["Soya ko namak wale paani mein 5 min ubalo; dho ke nichod do.", "Tel garam karo, jeera tadka, pyaaz bhuno.", "Adrak-lehsun, tamatar + masale daalo, gaadha hone tak pakao.", "Soya + paani daalo, 8-10 min simmer karo. Chawal/roti ke saath."], "link": "Link: https://www.hindustantimes.com/lifestyle/recipe/soya-vs-paneer-5-reasons-why-soya-chunks-are-a-better-protein-source-for-vegetarians-101767681710101.html"}, "egg veg stir fry dinner": {"badges": ["~28g protein", "~500 kcal"], "ing": [{"t": "4 ande, 2 cup broccoli, 2 shimla mirch, 2 gajar, 2 cup palak"}, {"t": "2 tbsp olive oil, 2 tsp lehsun, 2 tsp adrak, 2 tsp soy sauce, chilli flakes, kali mirch"}], "steps": ["Tel tez garam karo; lehsun + adrak 30 sec bhuno.", "Sakht sabziyan daalo, 3-4 min toss karo.", "Ek taraf hata ke ande scramble karo pakne tak.", "Palak + soy sauce + kali mirch daalo, 1 min toss karo."], "link": "Source: Medium article"}, "paneer bhurji classic veg": {"badges": ["~40g protein", "~600 kcal"], "ing": [{"t": "220-300g paneer (kaddukas)"}, {"t": "2 pyaaz, 2 tamatar, 2 shimla mirch"}, {"t": "2 tsp tel, 1 tsp jeera, 1 tsp haldi, 1 tsp laal mirch, namak"}], "steps": ["Tel garam karo, jeera tadka, pyaaz 2 min bhuno.", "Shimla + tamatar daalo, 3 min pakao; masale milao.", "Paneer daalo, milao, dhak ke 2 min."], "link": "Link: https://www.mensxp.com/health/nutrition/75155-best-vegetarian-protein-sources-that-are-better-than-chicken-along-with-easy-recipes.html"}, "curd protein muesli breakfast": {"badges": ["~50g protein", "~900 kcal"], "ing": [{"t": "400g dahi, 80g high-protein muesli, 400ml doodh"}], "steps": ["Muesli ko dahi + doodh mein milao.", "5 min rakh do (ya raat bhar). Kha lo."], "link": "Link: https://economictimes.indiatimes.com/magazines/panache/reddit-user-shares-16-kg-weight-loss-journey-using-a-basic-5-day-workout-plan/articleshow/125806080.cms"}, "boiled eggs oats peanut butter toast": {"badges": ["~60g protein", "~1200 kcal"], "ing": [{"t": "6-8 uble ande, 100g oats"}, {"t": "4 brown-bread toast + 2 tbsp peanut butter"}], "steps": ["Ande 8-9 min ubalo, aadhe kaato, namak/kali mirch/chaat masala daalo.", "Oats pakao; bread toast karke peanut butter lagao.", "Sab saath khao."], "link": "Watch: https://www.youtube.com/shorts/Kx7hUf2IIfI"}, "soya chunks banana dessert kela elaichi": {"badges": [], "ing": [{"t": "60g soya chunks (ubal ke, paani nikaal ke, halka pees lo)"}, {"t": "Oat milk — chunks doobne bhar"}, {"t": "2 kele (masle hue), 1/2 tsp elaichi powder, 4 boond vanilla essence"}], "steps": ["Soya chunks ko oat milk mein dheemi aanch pe simmer karo.", "Elaichi + vanilla milao.", "Masle kele daal ke kuch min aur pakao. Garam serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wy8mwb/soya_bean_chunks_dessert/"}, "cheesecake ish dessert hung curd protein": {"badges": ["17g protein", "~205 cal"], "ing": [{"t": "6 tbsp hung curd (taanga hua dahi), 2 tsp cream cheese (room temperature pe)"}, {"t": "2 tsp nimbu ras, 5 tsp sugar-free sweetener, 4 boond vanilla"}, {"t": "1 scoop vanilla protein powder"}, {"t": "Optional: 4 biscuit (koot ke)"}], "steps": ["Hung curd + cream cheese achhe se milao.", "Nimbu, sweetener, vanilla, protein powder milao.", "Freezer mein ~40 min rakho set hone ke liye.", "Upar se biscuit ka chura daalo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wq0dhw/made_cheesecakeish_dessert_with_17g_protein/"}, "sugarfree protein mousse paneer chocolate": {"badges": ["~19g protein", "~225 cal"], "ing": [{"t": "100g paneer, 75ml doodh"}, {"t": "1/2 scoop chocolate whey, 7-10g cocoa powder"}, {"t": "3-4 tukde dark chocolate, 5-7g stevia, vanilla essence, chutki namak"}], "steps": ["Sab kuch mixer mein smooth pees lo.", "Fridge mein ~1 ghanta rakho set hone ke liye."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wp2n83/sugarfree_protein_mousse_7478g_protein_900/"}, "fudgy protein brownies chocolate whey": {"badges": ["10g protein", "~90 cal"], "ing": [{"t": "60g chocolate whey, 40g oats (pees ke atta), 30g maida, 30g cocoa"}, {"t": "125g hung curd, 1 masla kela (~100g), 1 anda + 1 ande ki safedi"}, {"t": "100g zero-calorie sweetener, 60ml badam/toned doodh, 10g pighla nariyal tel/ghee"}, {"t": "1 tsp vanilla, 1/2 tsp baking powder, 1/4 tsp namak"}], "steps": ["Geeli cheezein phent lo, phir sukhi cheezein halke se milao.", "Oven 190°C pe 14-17 min bake karo (ya air fryer 160°C pe 11-14 min).", "Poora thanda hone ke baad 8 tukdon mein kaato."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wc1nps/highprotein_lowcal_fudgy_brownies_no_pumpkin/"}, "spiced tofu cubes sauteed tadka": {"badges": [], "ing": [{"t": "400g tofu (chhote cubes), 2 tbsp tel"}, {"t": "1 tsp rai, 1 tsp jeera, 1/2 tsp haldi, 1 tsp dhaniya powder, namak"}], "steps": ["Tel mein rai-jeera ka tadka lagao.", "Tofu daal ke 4+ min bhuno.", "Haldi, dhaniya powder, namak daal ke 2-3 min aur bhuno."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1x08zyz/need_tofu_recipe/"}, "tofu bhurji magic masala": {"badges": [], "ing": [{"t": "400g tofu (kaddukas kiya), 2 pyaaz (kate), 1-2 tamatar (kate)"}, {"t": "Mushroom (optional), namak, roz wala masala, magic masala ya peri-peri masala"}], "steps": ["Sabzi ko halke tel mein shallow fry karo.", "Kaddukas tofu milao.", "Namak + masala daalo, aakhir mein magic/peri-peri masala chhidko."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1x08zyz/need_tofu_recipe/"}, "high protein soya paneer masala": {"badges": ["~35g protein", "~500 kcal", "10g fibre"], "ing": [{"t": "60g soya chunks (bhigo ke, ubal ke, paani nikaala), 400g paneer"}, {"t": "2 pyaaz, 3 tamatar, 4-5 lehsun"}, {"t": "1 tsp jeera, 1 tsp haldi, 2 tsp dhaniya powder, 1 tsp garam masala"}, {"t": "2 tbsp tomato ketchup, 2 tsp soy sauce, 1 tbsp olive oil, namak, paani"}], "steps": ["Jeera tadka, phir pyaaz + lehsun bhuno.", "Tamatar daal ke gaala (mushy) hone tak pakao.", "Masale daalo, phir soya chunks + paneer + ketchup + soy sauce milao.", "Thoda paani daal ke dhak ke 10-15 min simmer karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1w8qpew/high_protien_soya_paneer/"}, "ramen shirataki noodles maggi masala diet": {"badges": ["~80–100 kcal"], "ing": [{"t": "500g shirataki noodles, namak"}, {"t": "2 instant ramen ke masala packet (sirf masala + tel use karna, noodle cake nahi)"}], "steps": ["Noodles achhe se dho lo.", "Garam pan mein namak ke saath ~5 min sukha bhuno — paani poora sukhna chahiye, yahi main step hai.", "Ramen masala milake toss karo.", "Soupy chahiye to: aadha glass paani mein tastemaker ubalo, sukhe noodles daal do."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1w459kw/for_anyone_whos_on_a_diet_and_combatting_a/"}, "air fried chicken breast juicy dahi marinade": {"badges": [], "ing": [{"t": "2 skinless chicken breast"}, {"t": "2 tbsp dahi, 2 tsp olive oil, degi mirch, namak, chicken masala"}], "steps": ["Breast ko butterfly kaat ke patla peeto (pound karo).", "Dahi, tel, masale laga ke 30 min marinate karo.", "Air fryer mein 12-15 min ek taraf, palat ke 5 min doosri taraf.", "Kaanne se pehle 3-5 min rest do."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wqmwfv/i_figured_out_how_to_make_the_chicken_breast/"}, "egg salad bowl sprouts anda protein": {"badges": ["45g+ protein", "~650 kcal", "8g+ fibre"], "ing": [{"t": "8 uble ande, 300g ankurit moong/moth"}, {"t": "2 muthi bhuni moongfali"}, {"t": "2 pyaaz, 4 tamatar, 2 gajar (sab kate), shimla mirch + hari mirch"}, {"t": "Nimbu, kala namak, chaat masala, kali mirch"}], "steps": ["Ankurit ko microwave mein 3 min garam karo.", "Saari sabzi kaato, sab kuch bade bowl mein milao.", "Nimbu, kala namak, chaat masala, kali mirch daal ke mix karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1vror7t/simple_high_protein_salad_for_my_eggetarian_folks/"}, "foxtail millet upma breakfast kangni": {"badges": ["9–10g protein", "~350 kcal"], "ing": [{"t": "1/2 cup foxtail millet (kangni), 1 tbsp tel"}, {"t": "1 tsp rai, 1 tsp jeera, 1 tsp urad dal, 1-2 hari mirch, 1 inch adrak (kaddukas), 10 curry patta, 1/4 tsp haldi"}, {"t": "1 pyaaz, 2-3 tamatar, 1/2 cup mix sabzi (gajar, matar, shimla), 2-3 tbsp moongfali"}, {"t": "1 3/4 cup paani, 1 tsp nimbu ras, namak"}], "steps": ["Millet ko 5-8 min sukha bhun lo.", "Tel mein rai, jeera, urad dal, mirch, adrak, curry patta ka tadka.", "Pyaaz, tamatar, sabzi, moongfali bhuno.", "Paani + namak daal ke ubalo, millet milao, dhak ke dheemi aanch pe 10-15 min pakao.", "Aakhir mein nimbu ras milao."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1w162mv/foxtail_millet_upma_healthy_easy/"}, "dhaba style paneer masala dahi shimla": {"badges": ["~17g protein", "~234 cal"], "ing": [{"sub": "Dahi mix"}, {"t": "2 tbsp dahi, 1 tbsp fresh cream"}, {"t": "1 tsp laal mirch, 1/2 tsp dhaniya powder, 1/4 tsp garam masala"}, {"t": "3/4 tsp kasuri methi (masli hui), 1/2 tsp chaat masala, namak, chutki cheeni"}, {"sub": "Pan fry"}, {"t": "2 tsp light butter, 1.25 pyaaz (gol slices), 3/4 shimla mirch (patli)"}, {"t": "200g low-fat paneer (mote slices), namak, thodi cheeni, 1/2 tsp garam masala, 1/2 tsp kali mirch"}, {"sub": "Masala base"}, {"t": "3/4 tbsp tel, 1/4 tsp jeera, 1 sukhi laal mirch (tukde)"}, {"t": "1/2 pyaaz (bareek), 3/4 tsp adrak-lehsun paste, 2 tbsp tomato puree"}], "steps": ["Dahi mix ki saari cheezein bowl mein mila ke side rakh do.", "Butter tez aanch pe garam karo; pyaaz ke gol slices, shimla mirch aur paneer halka char aur golden hone tak fry karo, nikaal lo.", "Usi pan mein tel garam karo, jeera tadkao, sukhi laal mirch aur kata pyaaz golden hone tak bhuno.", "Adrak-lehsun paste daal ke 1 min bhuno.", "Dahi mix daalo, medium aanch pe 2-3 min chalate hue pakao, kachchi khushboo jane tak.", "Tomato puree daal ke 2 min aur pakao.", "Paneer mix wapas daalo, halke se milao, 1 min garam karke serve karo."], "link": "Reel: https://www.instagram.com/reel/DZHKxtvJAeW/"}, "egg char minar anda sarson tel masala": {"badges": ["~14g protein", "~305 cal"], "ing": [{"t": "2 ande"}, {"t": "Sarson tel: 1 tbsp (talne ke liye) + 1/2 tbsp (masale ke liye)"}, {"t": "Khade masale: 1/2 dalchini, 1 laung, 1/4 tsp jeera, 2-3 kali mirch, 1/2 tej patta, 1 elaichi"}, {"t": "1/2 pyaaz (kata), 5 curry patte, 1/2 tbsp adrak-lehsun paste, 1/2 hari mirch (kati)"}, {"t": "125g tamatar paste, hara dhaniya (kata)"}, {"t": "1/4 tsp haldi, 1/2 tsp Kashmiri laal mirch, 1/2 tsp dhaniya powder, 1/4 tsp jeera powder, 1/2 tsp Maggi masala, 1/2 tsp namak"}, {"t": "75ml paani"}], "steps": ["1 tbsp sarson tel mein dono ande dono taraf golden tal ke nikaal lo.", "Usi pan mein 1/2 tbsp sarson tel daalo; khade masale, kata pyaaz, curry patte, adrak-lehsun paste, hari mirch — pyaaz naram hone tak bhuno.", "Tamatar paste, hara dhaniya, saare sukhe masale aur namak daal ke achhe se milao.", "75ml paani daalo, mix karke gravy banne tak simmer karo.", "Tale ande wapas daalo, masale mein lapet ke ek final mix karke serve karo."], "link": "Reel: https://www.instagram.com/reel/DeYMBiaTZQp/"}, "oats berries bowl whey chia reddit": {"badges": ["~50g protein", "~620 kcal"], "ing": [{"t": "80g oats, 2 scoop whey, 200g Greek yogurt (dahi), paani"}, {"t": "40g chia seeds (alag se bhigo ke gel bana lo)"}, {"t": "20g badam, 20g pumpkin seeds, cocoa + sweetener"}, {"t": "200g mixed berries (frozen bhi chalega)"}], "steps": ["Chia ko alag paani mein bhigo ke gel hone do.", "Oats, whey, dahi aur paani mix karo.", "Usme gel wala chia, badam, seeds, cocoa, sweetener milao.", "Upar berries daal ke khao."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1vsq6t1/oats_with_berries/"}, "overnight oats bowl almond milk reddit": {"badges": ["~17g protein", "~570 kcal"], "ing": [{"t": "1.5 cup instant oats, 3 cup badam doodh (~14 badam se bana)"}, {"t": "1 cup blueberries, 2 tbsp alsi powder, 2 tbsp pumpkin seeds, 2 tbsp sunflower seeds"}, {"t": "4 akhrot (kute hue), 2 tbsp shahad"}], "steps": ["Oats ko badam doodh mein 3-4 ghante ya raat bhar bhigo do.", "Soft ho jaye to blueberries, seeds, akhrot aur shahad milao.", "Thanda-thanda khao."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wvmv5o/new_breakfast_routine/"}, "everyday oats bowl seeds reddit": {"badges": [], "ing": [{"t": "120g high-protein oats, 40g seed mix (chia, pumpkin, magaj, tarbooz ke beej)"}, {"t": "240ml doodh (ya paani), 40-50g plant protein powder, 20g peanut butter"}, {"t": "Kata seb ya anaar, bhige badam"}], "steps": ["Oats aur seeds ko doodh mein raat bhar bhigo do (ya microwave mein 2-2.5 min garam karo).", "Protein powder aur peanut butter achhe se milao.", "Upar kata phal aur bhige badam daalo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wc9wsa/everyday_breakfast/"}, "healthy fats oats bowl reddit": {"badges": ["~500 kcal"], "ing": [{"t": "80g oats, 400ml doodh"}, {"t": "30g badam, 20g akhrot, 20g pumpkin seeds, 20g sunflower seeds, 20g kishmish"}, {"t": "40g protein powder, 20g nariyal burada, 20g dark chocolate (kati hui)"}], "steps": ["Saari sukhi cheezein ek bowl mein milao.", "Upar doodh daalo, 1 min ruko, khao."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wqk0ex/my_everyday_breakfast_for_healthy_fats/"}, "paneer soya plate jeera rice reddit": {"badges": ["~57g protein", "~700 kcal", "~7-8g fibre"], "ing": [{"t": "120g soya chunks; marinade: 2 tbsp gaadha dahi, tel ki boondein, kasuri methi, chole masala"}, {"t": "100g low-fat paneer, 1 tsp ghee"}, {"t": "2 tsp tel, 2 pyaaz (bareek kate), 130g chawal, saath mein 360g dahi"}], "steps": ["Soya ubal ke dho lo, achhe se nichod ke sukha karo.", "Dahi wale marinade mein lapeto.", "Tel mein pyaaz sunehra bhuno, soya daal ke kinare crispy hone tak chalate hue pakao.", "Paneer ko ghee mein seko.", "Chawal ko dugne paani mein pakao; dahi ke saath serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1t5hvqq/my_goto_meal_for_protein_intake_57g/"}, "schezwan soya fried rice reddit": {"badges": ["~57g protein", "~575 kcal"], "ing": [{"t": "200g soya chunks (sukha wazan), 200g pake basmati chawal"}, {"t": "80g shimla mirch, 20g gajar, 2 chhote pyaaz, 2 chhote tamatar"}, {"t": "6-8 lehsun, 2 inch adrak, 2-3 hari mirch, 2 tsp sarson tel"}, {"t": "6-8g schezwan sauce, 2-4g soy sauce, namak"}], "steps": ["Soya ko namak wale paani mein 2-3 min ubalo, nichod ke sukha karo.", "Sarson tel mein adrak, lehsun, mirch, pyaaz bhura hone tak bhuno.", "Tamatar daal ke 1-2 min pakao.", "Soya daal ke 2-3 min tez bhuno.", "Chawal, shimla, gajar aur dono sauce daal ke tez aanch pe 2-3 min toss karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1vtcusd/highprotein_schezwan_soya_fried_rice_57g_protein/"}, "grilled fish lemon herb reddit": {"badges": ["~45g protein", "~380 kcal"], "ing": [{"t": "400g fish fillet, 2 tbsp olive oil, 2 tsp seasoning mix"}, {"t": "200g broccoli, 2 gajar, 100g beans"}, {"t": "Sauce: 4 lehsun (bareek), 4 tbsp vegetable broth, 2 tbsp nimbu ras, 1 tbsp light makkhan, parsley, namak"}], "steps": ["Fish pe tel aur seasoning lagao.", "Har taraf 3-4 min seko, galne tak.", "Sabzi ko 4-5 min bhaap mein pakao.", "Lehsun 30 sec bhuno, broth + nimbu daal ke 1 min ubalo, makkhan + parsley milao.", "Sauce fish ke upar daal ke serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1uudhgx/my_postworkout_dinner/"}, "chicken wrap curd marinade reddit": {"badges": ["~50g protein", "~510 kcal"], "ing": [{"t": "280g chicken breast; marinade: 2 tbsp dahi, namak, adrak-lehsun paste, 1 tbsp paneer tikka masala, kasuri methi"}, {"t": "1 tbsp sarson tel, 2 whole wheat wrap, kheera-tamatar-pyaaz"}, {"t": "3 andon ka omelette, cheesy sauce + sweet onion sauce"}], "steps": ["Chicken ko marinade laga ke kuch der rakho.", "Sarson tel mein pakao, phir slices kaato.", "3 andon ka omelette banao.", "Wrap mein chicken, omelette, sabzi aur sauce daal ke roll karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wwlwbt/high_protein_chicken_wrap/"}, "chicken marinations three styles reddit": {"badges": [], "ing": [{"sub": "Style 1 - Tandoori"}, {"t": "500g chicken, 2 tbsp tandoori masala, 2 tbsp dahi"}, {"sub": "Style 2 - Dahi masala"}, {"t": "500g chicken, 4 tbsp dahi, 1 tbsp adrak-lehsun paste, namak, 1 tsp haldi, 1 tsp mirch, 1 tsp dhaniya, 1/2 tsp garam masala, 1 tsp kasuri methi"}, {"sub": "Style 3 - Sukha rub"}, {"t": "500g chicken, namak, 1 tsp mirch, 1 tsp dhaniya, 1/2 tsp haldi (dahi nahi)"}], "steps": ["Ek style chuno, marinade chicken pe achhe se lagao, jitna ho sake rest do.", "Style 1 aur 2: pan mein fry karo.", "Style 3: poora breast pan-fry karo, phir kaato."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1voe44w/"}, "juicy chicken tawa ten minute reddit": {"badges": ["~70g protein"], "ing": [{"t": "500-600g chicken breast, namak, kali mirch"}, {"t": "2 tsp tikka masala, 2 tsp peri peri mix, nimbu ras, tel spray"}], "steps": ["Chicken mein halke cuts lagao, saare masale aur nimbu rub karo; jitna ho sake marinate karo.", "Bahut garam tawe pe 1-2 min ek taraf seko.", "Palto, dhak do, medium-low pe 8-10 min pakao.", "Serve se pehle thoda rest do."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1w6claz/guide_how_to_cook_your_chicken_juicy_and_in_10/"}, "paneer egg air fryer reddit": {"badges": ["~54g protein", "~625 kcal"], "ing": [{"t": "400g paneer, 6 ande + 6 ande ki safedi"}, {"t": "1 pyaaz, 1 shimla, 2 tamatar, 20g mushroom (sab kate)"}, {"t": "2 chammach schezwan chutney, 2 chammach hari chutney, 2 chammach adrak-lehsun paste, namak, haldi, 1 chammach ghee"}], "steps": ["Sab kuch ek bowl mein achhe se milao.", "Air fryer ko ghee se grease karo, mixture daalo.", "185 degree pe 10 min air-fry karo. Garam serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wjwf2m/made_this_dinner_meal_54gm_protein_in_625/"}, "tuna cheese burger reddit": {"badges": ["~45-50g protein", "~550-625 kcal"], "ing": [{"t": "1 can tuna (paani wala, ~130g paani nikala hua), 2 high-protein bun, 3 cheese slice"}, {"t": "1/2 pyaaz, 1/2 shimla, 1 hari mirch, dhaniya, nimbu ras"}, {"t": "Thoda dahi, sauce, namak, kali mirch, lettuce, 1 tsp tel"}], "steps": ["Tel mein pyaaz, shimla, hari mirch bhuno.", "Tuna, 1 cheese slice, dahi, sauce, dhaniya, nimbu, namak-kali mirch milao.", "Bun pe lettuce ke saath bharo, upar cheese slice rakho, grill karo jab tak cheese pighle."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1x3fumk/homemade_tuna_cheese_burgers_highprotein_meal/"}, "soya tikki besan reddit": {"badges": ["~60g protein", "~590 kcal"], "ing": [{"t": "200g soya granules, 6 tbsp besan, 2 tbsp cornstarch"}, {"t": "4 pyaaz (bareek kate), adrak-lehsun paste, hari mirch, dhaniya"}, {"t": "Namak, laal mirch, haldi, garam masala, chaat masala, bahut kam tel"}], "steps": ["Granules ko garam paani mein 10-15 min bhigo, nichodo, dho ke phir nichodo.", "Saari cheezein mila ke tikki ka aakar do.", "Kam tel mein dheemi aanch pe dono taraf sunehra-crispy talo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wmg30f/made_soya_tikki_today_60g_protein/"}, "air fryer cheesecake greek yogurt reddit": {"badges": ["~21g protein", "~218 kcal"], "ing": [{"t": "300g Greek yogurt, 2 ande"}, {"t": "1 tbsp vanilla, 1 tbsp nimbu ras, 60g stevia (swaad anusar), 30g corn starch"}], "steps": ["Dahi, ande, vanilla, stevia, nimbu milao; corn starch sabse aakhir mein.", "Butter paper lagi katori mein daalo.", "210 degree pe 12-15 min air-fry karo (beech halka hila hua rahe).", "Fridge mein 2 ghante tak thanda karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wdbfrf/air_fryer_protein_cheesecakefound_a_hack_to/"}, "psyllium kheer isabgol reddit": {"badges": ["~30g protein", "~312 kcal"], "ing": [{"t": "100g oats, 400ml toned doodh, 400ml paani"}, {"t": "20g isabgol, 60g chocolate protein powder"}, {"t": "40g peanut butter, 20g bhune badam"}], "steps": ["Oats ko doodh mein 5-7 min ubalo.", "Paani milao, isabgol chhidak ke dheemi aanch pe 1-2 min chalao jab tak gaadha ho.", "Thoda thanda hone do.", "Protein powder, peanut butter aur badam milao."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1wthk1k/psyllium_protein_kheer_30g_p_10g_fiber_312_cal/"}, "malai mushroom kali mirch reddit": {"badges": ["~10g protein", "~250 kcal"], "ing": [{"t": "400g mushroom, pyaaz"}, {"t": "Dahi, thodi cream, kaju (malai paste ke liye)"}, {"t": "Adrak, lehsun, hari mirch"}, {"t": "Kali mirch (kuti hui), garam masala, haldi, namak, ghee"}], "steps": ["Kaju + dahi + cream ko pees ke malai paste banao, haldi-garam masala-namak milao.", "Ghee mein pyaaz, adrak, lehsun, hari mirch bhuno; mushroom daal ke uska paani sukhao.", "Malai paste daal ke kuch min pakao, jab tak mushroom pe coat ho jaye.", "Upar se khoob kuti kali mirch. Poster ne dish ko 180°C pe bake kiya tha."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1qjtxfv/thought_of_sharing_my_meals/"}, "chicken eggs potato bowl reddit": {"badges": ["70g+ protein", "650 kcal"], "ing": [{"t": "250g chicken"}, {"t": "Ande"}, {"t": "Aloo"}], "steps": ["Chicken ko apne masalo ke saath grill ya pan-fry karke pakao.", "Ande (uble ya tale) aur aloo (uble ya roast) banao.", "Sab ek bowl mein saath serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1mxusmk/post_workout_meal/"}, "cutting dinner plate chicken eggs reddit": {"badges": ["97g protein", "~950 kcal"], "ing": [{"t": "250g chicken, 250g mix sabzi"}, {"t": "4 ande"}, {"t": "Kheera, low-fat dahi"}, {"t": "Sarson tel, masala mix, 1 nimbu"}], "steps": ["Chicken ko masala mix mein pehle se marinate karo; sarson tel mein har taraf 2-3 min seko.", "Sabzi ko thode sarson tel mein dhak ke 8-10 min pakao.", "Ande banao, kheera kaato.", "Plate mein sab sajao, dahi aur nimbu ke saath."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1kk8531/"}, "seared chicken mashed potato veg reddit": {"badges": ["60g protein", "600 kcal"], "ing": [{"t": "250g chicken breast, 1 tsp olive oil, nimbu ras"}, {"t": "300g mix sabzi"}, {"t": "Aloo, 1 tbsp doodh, namak, kali mirch, laal mirch powder, parsley"}], "steps": ["Chicken ko olive oil mein har taraf 4-6 min seko, aakhir mein nimbu ras.", "Mix sabzi bhaap mein pakao, namak-mirch-parsley daalo.", "Aloo ubal ke doodh, namak, mirch ke saath mash karo.", "Chicken mash ke upar, sabzi side mein serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1uxaz4x/a_quick_simple_dinner_600_cal60g_protein/"}, "chicken oat kebabs reddit": {"badges": ["~16g protein", "~100 kcal"], "ing": [{"t": "2kg chicken keema (breast + thigh)"}, {"t": "120g oats (powder), 2 ande"}, {"t": "2 pyaaz, hara dhaniya, hari mirch, adrak-lehsun paste"}, {"t": "Laal mirch powder, kali mirch, garam masala, namak"}], "steps": ["Keeme mein oats powder, ande, kata pyaaz, dhaniya, hari mirch, adrak-lehsun paste aur saare masale milao.", "Kebab ki shape do.", "200°C pe 20-25 min bake karo.", "Roti, dahi, salad ke saath khao."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1t6bfq3/chicken_kebab_meal_prep/"}, "eggy cheese sandwich chicken stir fry reddit": {"badges": ["~93g protein", "~934 kcal"], "ing": [{"t": "200g chicken breast, lehsun, shimla mirch, broccoli, gajar, baby corn, corn"}, {"t": "1 tsp soya sauce, 1 tsp vinegar, thoda tel"}, {"t": "Sandwich: 2 ande, 2 bread slice, 1 cheese slice, thoda makkhan"}], "steps": ["Chicken ko lehsun aur saari sabziyon ke saath stir fry karo; soya sauce + vinegar aakhir mein.", "2 ande phent ke bread slices ko usme dubo (French toast style).", "Makkhan mein seko, beech mein cheese slice rakho.", "Sandwich + chicken stir fry saath serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1of2nmk/92g_protein_tasty_dinner/"}, "chicken fried rice egg edamame reddit": {"badges": ["~50g protein", "~550 kcal"], "ing": [{"t": "125g pake chawal (fridge ke thande — achhe fry hote hain)"}, {"t": "120g paka chicken"}, {"t": "1 anda + egg whites"}, {"t": "Edamame, pasand ki sauces"}], "steps": ["Garam kadhai mein anda + egg whites scramble karke nikaal lo.", "Thande chawal tez aanch pe fry karo, jab tak alag-alag aur halke crisp hon.", "Chicken aur edamame milao.", "Sauces + anda wapas milake serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1oo8u2o/what_else_i_should_be_adding_my_daily_high/"}, "butter chicken meal prep reddit": {"badges": ["~45g protein", "~600 kcal"], "ing": [{"t": "5 chicken breast (chhote tukde)"}, {"t": "Marinade: full-fat dahi, adrak-lehsun paste, namak, dhaniya powder, haldi, laal mirch, garam masala, nimbu ras"}, {"t": "Gravy: pyaaz, tamatar, kaju (pise hue)"}, {"t": "~50g makkhan"}], "steps": ["Chicken ko dahi wale marinade mein 2 ghante ya raat bhar rakho.", "Chicken ko kinaro pe halka char hone tak pakao.", "Pyaaz-tamatar-kaju ki gravy pees ke ubalo.", "Chicken gravy mein milao, makkhan se finish karo, chawal ke saath hafte ke liye portion karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1kq1p9u/meal_prepped_for_the_coming_week/"}, "lemon garlic chicken rice reddit": {"badges": ["~62g protein", "~590 kcal"], "ing": [{"t": "Chicken pe starch coating: laal mirch flakes, dhaniya powder, namak, haldi, kali mirch (chicken ki quantity post mein nahi di)"}, {"t": "Sauce: nimbu ka chilka + nimbu ras, 2 spoon light soya sauce, kata lehsun, 1/3 cup chicken stock, shahad, mirch, hara dhaniya, nimbu ke patle slice"}, {"t": "120g pake chawal"}], "steps": ["Coated chicken ko air fryer mein ~180°C pe ~20 min crisp karo.", "Nimbu chilka, ras, soya sauce, lehsun ubalo; stock, shahad, mirch, dhaniya, nimbu slice daal ke halka gaadha karo.", "Chicken ko sauce mein lapeto.", "Chawal ke upar serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1l6ag3a/lemongarlic_chicken/"}, "dahi tadka paneer rice reddit": {"badges": ["~42g protein", "~440 kcal"], "ing": [{"t": "125g chawal"}, {"t": "120g low-fat paneer (masala marinated)"}, {"t": "150g high-protein dahi"}, {"t": "Tadka: thoda ghee, lehsun, pyaaz, masale, hari mirch, hara dhaniya"}, {"t": "Side mein kachhi sabzi"}], "steps": ["Chawal pakao.", "Marinated paneer ko kinaro pe golden hone tak grill karo.", "Dahi tadka: ghee mein lehsun-pyaaz-masale-hari mirch ka tadka, phente dahi pe daalo.", "Chawal + paneer + tadka dahi + kachhi sabzi serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1s1nvvy/my_current_fav_meal_gives_me_42g_of_protein_for/"}, "masoor dal tadka reddit": {"badges": ["~14g protein", "~305 kcal"], "ing": [{"t": "Masoor dal"}, {"t": "Tadka: sarson tel, pyaaz, adrak-lehsun, tamatar, masale, namak"}], "steps": ["Masoor dal ko paani-namak ke saath cooker mein naram hone tak pakao.", "Sarson tel mein pyaaz, adrak-lehsun, tamatar, masale bhuno.", "Tadka dal mein daalo, 2 min ubalo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1lxz1oe/i_thought_i_had_no_time_to_cook_i_was_wrong/"}, "one pot veg pulao reddit": {"badges": ["~7g protein", "~380 kcal"], "ing": [{"t": "Chawal, mix sabzi"}, {"t": "Dahi mein biryani masala phenta hua"}, {"t": "Khade masale, namak"}], "steps": ["Bartaan mein khade masale ka tadka, sabzi halki bhuno.", "Dahi-biryani masala milao, phir chawal + paani.", "Dhak ke ek hi bartan mein pakao; 5 min rest karke phulake serve karo."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1lxz1oe/i_thought_i_had_no_time_to_cook_i_was_wrong/"}, "aloo bhindi sabzi reddit": {"badges": ["~3g protein", "~150 kcal"], "ing": [{"t": "Aloo, bhindi"}, {"t": "Pyaaz, tamatar, namak, roz ke masale"}], "steps": ["Bhindi ko chipchipahat khatm hone tak fry karke nikaal lo.", "Aloo ko pyaaz-tamatar masale ke saath lagbhag pakao.", "Bhindi wapas milao, 2-3 min aur pakao."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1lxz1oe/i_thought_i_had_no_time_to_cook_i_was_wrong/"}, "aloo baingan sabzi reddit": {"badges": ["~3g protein", "~150 kcal"], "ing": [{"t": "Aloo, baingan"}, {"t": "Pyaaz, namak, roz ke masale"}], "steps": ["Pyaaz ko masalo ke saath bhuno.", "Aloo aur baingan milao.", "Dhak ke dheemi aanch pe dono naram hone tak pakao."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1lxz1oe/i_thought_i_had_no_time_to_cook_i_was_wrong/"}, "chocolate whey oats no cook reddit": {"badges": ["29g protein", "~400 kcal"], "ing": [{"t": "50g oats"}, {"t": "100ml low-fat doodh"}, {"t": "Dahi"}, {"t": "1 scoop chocolate whey"}], "steps": ["Oats, doodh, dahi aur chocolate whey ek bowl/jar mein milao.", "Fridge mein rakho (raat bhar, ya kam se kam 2 ghante) — oats naram ho jayenge.", "Thanda hi khao, pakana nahi hai."], "link": "Reddit thread: https://www.reddit.com/r/Fitness_India/comments/1lt28qa/default_dinner_of_2025/"}, "chicken sweet potato curry kadhai": {"badges": ["~28g protein", "~290 kcal"], "ing": [{"t": "250g chicken"}, {"t": "200g shakarkandi (chhil ke tukde)"}, {"t": "Kadhai base: pyaaz, tamatar, adrak-lehsun paste, roz ke curry masale, namak, thoda tel"}], "steps": ["Kadhai mein pyaaz sunahra bhuno; adrak-lehsun paste aur masale milao.", "Tamatar daal ke masala gaadha hone tak pakao.", "Chicken aur shakarkandi + thoda paani milao.", "Dhak ke 15-18 min dheemi aanch pe pakao. Chawal ya roti ke saath."], "link": null}, "lahori chicken korma dahi kaju pyaaz": {"badges": [], "ing": [{"sub": "Brown onion paste"}, {"t": "4 medium pyaaz (400g), sliced, air fryer mein brown kiye hue, 1 tsp tel"}, {"t": "12-15 bheeghe kaju (15g)"}, {"t": "1/2 cup Greek dahi (100g)"}, {"sub": "Marinade"}, {"t": "300g boneless chicken thigh (tukde)"}, {"t": "1 tsp adrak-lehsun paste, 1/4 tsp haldi, 1 tsp laal mirch, 1 tsp dhaniya powder, namak, 1 tbsp nimbu ras"}, {"t": "1 tbsp ghee (chicken talne ke liye)"}, {"sub": "Gravy"}, {"t": "1 tbsp ghee, 1 tej patta, 2 elaichi, 2 laung, chhota dalchini tukda"}, {"t": "1 tsp adrak-lehsun paste, 2 tamatar pise hue (150g)"}, {"t": "Wahi marinade wale masale, 1/2 tsp garam masala, namak, 1/2 cup garam paani (120ml)"}, {"t": "1 tsp kasuri methi (masli hui), 2 tbsp kata hara dhaniya, 1.5 tbsp fresh cream (22g)"}], "steps": ["Brown pyaaz, kaju aur dahi ko pees ke gaadha paste banao.", "Chicken mein masale aur nimbu ras milao, 10 min rakho.", "Ghee mein chicken tal ke alag rakho.", "Ghee mein khade masale aur adrak-lehsun paste ka tadka lagao.", "Tamatar puree daal ke achhe se pakao.", "Pyaaz paste, masale, garam masala, namak aur garam paani milao; kacchi khushbu jaane tak pakao.", "Kasuri methi, dhaniya aur cream se finish karo.", "Chicken wapas milao, tel alag hone tak dheemi aanch pe pakao. Naram chapati ke saath khao."], "link": "Reel: https://www.instagram.com/reel/Dd-qr6msXGb/"}, "glowing skin brownies kela khajoor cocoa": {"badges": ["High-protein", "Gluten-free", "Adapted"], "ing": [{"t": "2 ripe kele"}, {"t": "8-10 pitted khajoor"}, {"t": "3 tbsp Greek dahi"}, {"t": "1/2 cup rolled oats"}, {"t": "2 tbsp peanut butter"}, {"t": "1/4 cup cocoa powder"}, {"t": "1 tsp vanilla extract"}, {"t": "Upar se: kata hua dark chocolate"}], "steps": ["Sab kuch blender mein daal ke smooth blend karo.", "Parchment-lagaye pan mein batter daalo.", "Upar kata hua dark chocolate chhidko.", "180°C pe 20-25 minute bake karo (toothpick test).", "Thanda karke pieces kaato."], "link": "Reel: https://www.instagram.com/reel/DdbbofyskSV/"}, "apple berry crumble seb blueberry": {"badges": [], "ing": [{"t": "4 seb (diced)"}, {"t": "200g blueberries"}, {"t": "2 tbsp cinnamon sugar"}, {"sub": "Crumble ke liye"}, {"t": "~150g maida (adapted)"}, {"t": "100g makkhan"}, {"t": "50g coconut sugar"}, {"t": "Serve karne ke liye: cream ya caramel (optional)"}], "steps": ["Fruit aur cinnamon sugar milao, air-fryer mein 15 minute.", "Crumble mix haath se milao.", "Naram fruit pe crumble daal ke 15 minute aur golden hone tak air-fry karo.", "Cream ke saath garam serve karo."], "link": "Reel: https://www.instagram.com/reel/DdrA9ETz41G/"}, "viral chocolate egg pudding cocoa protein anda meetha": {"badges": ["~40g protein"], "ing": [{"t": "3 uble hue ande"}, {"t": "1 bada chammach cheeni"}, {"t": "30g cocoa powder"}, {"t": "1 chhota chammach vanilla essence"}, {"t": "1 scoop protein powder"}, {"t": "Thoda doodh (lagbhag 50ml)"}], "steps": ["Ande chheel kar mixer mein daalo.", "Cheeni, cocoa powder, vanilla essence, protein powder aur doodh daalo.", "Bilkul smooth hone tak peeso, koi guthli na rahe.", "Katori mein nikaal kar fridge mein kam se kam 4 ghante rakho."], "link": "Reel: https://www.instagram.com/reel/DRAft1cE20N/"}, "healthy blondies banana oat peanut butter kela meetha": {"badges": ["~35g protein"], "ing": [{"t": "1 bada paka kela (masla hua)"}, {"t": "1 anda"}, {"t": "1/4 cup peanut butter"}, {"t": "1/4 cup maple syrup (ya shahad)"}, {"t": "1 cup oats ka aata"}, {"t": "1/2 chhota chammach baking powder"}, {"t": "1/4 cup chocolate chips (optional)"}], "steps": ["Oven 180°C par garam karo, loaf tin tel laga kar taiyaar rakho.", "Pehle geeli cheezein milao: masla kela, anda, peanut butter, maple syrup.", "Phir oats ka aata, baking powder aur chocolate chips mila do.", "15-20 minute bake karo — toothpick saaf nikle to ready."], "link": "Reel: https://www.instagram.com/reel/C-508GDqwpt/"}, "oats banana cake kela meetha dessert": {"badges": [], "ing": [{"t": "1 cup oats (lagbhag 90g)"}, {"t": "2 pake hue kele"}, {"t": "2 ande"}, {"t": "2 tbsp shahad"}, {"t": "1 tbsp baking powder"}, {"t": "1 tbsp vanilla essence"}, {"t": "Chutki bhar namak"}], "steps": ["Kele ko bowl mein achhe se mash karo.", "Ande, shahad aur vanilla essence mila kar whisk karo.", "Oats, baking powder aur namak halke haath se milao — zyada whisk mat karo.", "Batter ko tel lage hue glass dish mein daalo.", "Air fryer mein 180°C pe lagbhag 15 minute rakho, upar se set aur golden hone tak.", "Thoda thanda karke serve karo."], "link": "Reel: https://www.instagram.com/reel/DQqt1dWkhAW/"}, "dhaba style paneer ghotala pav bhaji masala": {"badges": [], "ing": [{"t": "200g low-fat paneer (kasa hua)"}, {"t": "1 bada chammach ghee, 1 chhota chammach makkhan, 1 chhota chammach jeera"}, {"t": "2 pyaaz (bareek kate), 1 hari mirch (kati hui), 1 chhoti hari shimla mirch (bareek kati), 1 tamatar (bareek kata)"}, {"t": "1 chhota chammach laal mirch powder, 1/2 chhota chammach haldi, 2 chhote chammach dhaniya powder, 1 chhota chammach namak, 1 chhota chammach pav bhaji masala"}, {"t": "250ml paani, hara dhaniya, 1 chhota chammach kasuri methi"}], "steps": ["Ghee aur makkhan garam karo, jeera aur pyaaz daal ke golden brown hone tak bhuno.", "Hari mirch aur shimla mirch daal ke 2 minute pakao.", "Tamatar daal ke naram aur ghul jaane tak pakao.", "Saare masale aur namak daal ke achhe se milao.", "Paani daal ke 2 minute pakao.", "Kasa hua paneer daal ke milao, dhak kar dheemi aanch par 8 minute pakao.", "Upar se hara dhaniya aur kasuri methi daal ke serve karo."], "link": "Reel: https://www.instagram.com/reel/Des0oWdTiXl/"}};

      // ---- Card actions: Remove / Meal plan / Share ----
      // Everything is saved in this phone's browser (localStorage), so each
      // device keeps its own meal plan.
      (function () {
        var KEY = 'recipeMarksV1';
        var store = {};
        try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
        function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

        var search = document.getElementById('search');
        var showBtn = document.getElementById('showHiddenBtn');

        // Tab/search filter ko dobara chalao (uska render isi event pe chalta hai)
        function refresh() {
          var ev;
          try { ev = new Event('input'); }
          catch (e) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); }
          search.dispatchEvent(ev);
        }

        var cardByKey = {};

        function hiddenCount() {
          var n = 0;
          Object.keys(store).forEach(function (k) { if (store[k] && store[k].hidden) n++; });
          return n;
        }
        function updateShowBtn() {
          var n = hiddenCount();
          showBtn.classList.toggle('hidden', n === 0 && !document.body.classList.contains('show-removed'));
          showBtn.textContent = document.body.classList.contains('show-removed')
            ? 'Hide removed recipes'
            : 'Show removed recipes (' + n + ')';
        }
        showBtn.addEventListener('click', function () {
          document.body.classList.toggle('show-removed');
          updateShowBtn();
          refresh();
        });

        function getState(card) {
          var key = card.getAttribute('data-name');
          return store[key] || (store[key] = {});
        }
        function cleanup(card) {
          var key = card.getAttribute('data-name');
          var st = store[key];
          if (st && !st.hidden && !st.mp && !st.shop) delete store[key];
        }

        function applyState(card) {
          var st = store[card.getAttribute('data-name')] || {};
          card.classList.toggle('user-hidden', !!st.hidden);
          var delBtn = card.querySelector('.act-delete');
          if (delBtn) delBtn.textContent = st.hidden ? '↩ Bring back' : 'Remove';
          var mpBtn = card.querySelector('.act-mp');
          if (mpBtn) {
            mpBtn.classList.toggle('on-plan', !!st.mp);
            mpBtn.textContent = st.mp
              ? '✓ In meal plan · ' + (st.mp === 'lunch' ? 'Lunch' : 'Dinner')
              : '📅 Add to meal plan';
          }
          var mpPanel = card.querySelector('.mp-panel');
          if (mpPanel) {
            mpPanel.querySelector('.mp-remove').classList.toggle('hidden', !st.mp);
          }
          var shopBtn = card.querySelector('.act-shop');
          if (shopBtn) {
            shopBtn.classList.toggle('on-plan', !!st.shop);
            shopBtn.textContent = st.shop ? '✓ In shopping list' : '🛒 Add ingredients';
          }
        }

        function buildBar(card) {
          var body = card.querySelector('.card-body');
          if (!body || card.querySelector('.card-actions')) return;
          var bar = document.createElement('div');
          bar.className = 'card-actions';
          bar.innerHTML =
            '<button type="button" class="act-btn act-mp">📅 Add to meal plan</button>' +
            '<button type="button" class="act-btn act-shop">🛒 Add ingredients</button>' +
            '<button type="button" class="act-btn act-delete">Remove</button>' +
            '<button type="button" class="act-btn act-share">💬 Share on WhatsApp</button>';
          var panel = document.createElement('div');
          panel.className = 'plan-panel mp-panel hidden';
          panel.innerHTML =
            '<p class="plan-q">Add to next week\'s meal plan as:</p>' +
            '<div class="opt-row">' +
            '<button type="button" class="opt mp-opt" data-meal="lunch">Lunch</button>' +
            '<button type="button" class="opt mp-opt" data-meal="dinner">Dinner</button>' +
            '</div>' +
            '<button type="button" class="plink mp-remove hidden">Remove from meal plan</button>';
          body.appendChild(bar);
          body.appendChild(panel);
        }

        function setMealPlan(card, meal) {
          var st = getState(card);
          if (meal) st.mp = meal; else delete st.mp;
          cleanup(card);
          save();
          applyState(card);
          renderPlan();
          var p = card.querySelector('.mp-panel');
          if (p) p.classList.add('hidden');
        }

        function dishInfo(key) {
          var card = cardByKey[key];
          if (!card) return null;
          var titleEl = card.querySelector('.card-top h3');
          var badgeEl = card.querySelector('.card-top .badge');
          return {
            title: titleEl ? titleEl.textContent.trim() : key,
            badge: badgeEl ? badgeEl.textContent.trim() : ''
          };
        }

        // Meal Plan view: list the picked recipes under Lunch and Dinner.
        function renderPlan() {
          var boxes = { lunch: document.getElementById('mpLunch'), dinner: document.getElementById('mpDinner') };
          if (!boxes.lunch || !boxes.dinner) return;
          ['lunch', 'dinner'].forEach(function (meal) {
            var box = boxes[meal];
            box.innerHTML = '';
            var keys = Object.keys(store).filter(function (k) { return store[k] && store[k].mp === meal; });
            keys.sort(function (a, b) {
              var ia = dishInfo(a), ib = dishInfo(b);
              return (ia ? ia.title : a).localeCompare(ib ? ib.title : b);
            });
            if (!keys.length) {
              box.innerHTML = '<p class="mp-none">Nothing picked yet.</p>';
              return;
            }
            keys.forEach(function (k) {
              var info = dishInfo(k);
              if (!info) return;
              var row = document.createElement('div');
              row.className = 'mp-item';
              row.innerHTML = '<span class="mp-name"></span>' +
                (info.badge ? '<span class="badge"></span>' : '') +
                '<button type="button" class="mp-share">💬 Share</button>' +
                '<button type="button" class="mp-del">✕ Remove</button>';
              row.querySelector('.mp-name').textContent = info.title;
              if (info.badge) row.querySelector('.badge').textContent = info.badge;
              row.querySelector('.mp-share').setAttribute('data-key', k);
              row.querySelector('.mp-del').setAttribute('data-key', k);
              box.appendChild(row);
            });
          });
        }

        // One WhatsApp message with the whole plan (simple Hinglish for the cook).
        function sharePlan() {
          var lines = ['*Agli hafte ka meal plan* 🍽️'];
          ['lunch', 'dinner'].forEach(function (meal) {
            lines.push('', meal === 'lunch' ? '*Lunch:*' : '*Dinner:*');
            var keys = Object.keys(store).filter(function (k) { return store[k] && store[k].mp === meal; });
            if (!keys.length) { lines.push('— abhi kuch decide nahi hua'); return; }
            keys.forEach(function (k) {
              var info = dishInfo(k);
              if (info) lines.push('• ' + info.title);
            });
          });
          window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
        }

        // WhatsApp message for the cook: dish name, ingredients, steps and
        // the reel link only (no protein/calorie badges, no serving info) —
        // always in simple Hinglish (from the SHARE data), even though the
        // card itself is in English.
        function shareOnWhatsApp(card) {
          var titleEl = card.querySelector('.card-top h3');
          var lines = ['*' + (titleEl ? titleEl.textContent.trim() : 'Recipe') + '*'];
          var d = SHARE[card.getAttribute('data-name')];
          if (d) {
            if (d.ing && d.ing.length) {
              lines.push('', '*Ingredients*');
              d.ing.forEach(function (it) {
                if (it.sub) lines.push('', '_' + it.sub + '_');
                else lines.push('• ' + it.t);
              });
            }
            if (d.steps && d.steps.length) {
              lines.push('', '*Steps*');
              d.steps.forEach(function (s, i) { lines.push((i + 1) + '. ' + s); });
            }
            if (d.link) lines.push('', d.link);
          }
          window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
        }

        function initActions() {
          Array.prototype.forEach.call(document.querySelectorAll('article.card'), function (c) {
            cardByKey[c.getAttribute('data-name')] = c;
          });
          var cards = Array.prototype.slice.call(document.querySelectorAll('article.card'));
          cards.forEach(function (card) { buildBar(card); applyState(card); });
          updateShowBtn();
          renderPlan();
          var mpShareBtn = document.getElementById('mpShare');
          if (mpShareBtn) mpShareBtn.addEventListener('click', sharePlan);
          refresh();
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initActions);
        else initActions();

        document.addEventListener('click', function (e) {
          var t = e.target;
          if (!t.closest) return;
          if (t.closest('.modal-overlay')) return; // nothing inside the picker popup
          var mpShareBtn = t.closest('.mp-share');
          if (mpShareBtn) {
            var sk = mpShareBtn.getAttribute('data-key');
            if (cardByKey[sk]) shareOnWhatsApp(cardByKey[sk]);
            return;
          }
          var mpDel = t.closest('.mp-del');
          if (mpDel) {
            var dk = mpDel.getAttribute('data-key');
            if (store[dk]) {
              delete store[dk].mp;
              if (cardByKey[dk]) { cleanup(cardByKey[dk]); applyState(cardByKey[dk]); }
              save();
              renderPlan();
            }
            return;
          }
          var card = t.closest('article.card');
          if (!card || !card.querySelector('.card-actions')) return;

          if (t.closest('.act-share')) {
            shareOnWhatsApp(card);
          } else if (t.closest('.act-shop')) {
            var shopState = getState(card);
            shopState.shop = !shopState.shop;
            cleanup(card); save(); applyState(card);
            if (window.renderShoppingList) window.renderShoppingList();
          } else if (t.closest('.act-mp')) {
            card.querySelector('.mp-panel').classList.toggle('hidden');
          } else if (t.closest('.act-delete')) {
            var st3 = getState(card);
            st3.hidden = !st3.hidden;
            cleanup(card); save(); applyState(card); updateShowBtn(); refresh();
          } else if (t.closest('.mp-opt')) {
            setMealPlan(card, t.closest('.mp-opt').getAttribute('data-meal'));
          } else if (t.closest('.mp-remove')) {
            setMealPlan(card, null);
          }
        });
      })();

      // ---- Personal shopping list; selected recipes and check-offs stay on this device ----
      (function () {
        var marksKey = 'recipeMarksV1', checksKey = 'recipeShoppingChecksV1';
        function readMarks() { try { return JSON.parse(localStorage.getItem(marksKey) || '{}') || {}; } catch (e) { return {}; } }
        function readChecks() { try { return JSON.parse(localStorage.getItem(checksKey) || '{}') || {}; } catch (e) { return {}; } }
        function ingredientKey(text) { return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
        function renderShoppingList() {
          var list = document.getElementById('shoppingItems'), empty = document.getElementById('shoppingEmpty');
          if (!list || !empty) return;
          var marks = readMarks(), checks = readChecks(), items = {}, cards = document.querySelectorAll('article.card');
          Array.prototype.forEach.call(cards, function (card) {
            var key = card.getAttribute('data-name');
            if (!marks[key] || !marks[key].shop) return;
            var title = card.querySelector('.card-top h3');
            Array.prototype.forEach.call(card.querySelectorAll('.card-body ul li'), function (li) {
              var text = li.textContent.trim(), normalized = ingredientKey(text);
              if (!normalized) return;
              if (!items[normalized]) items[normalized] = { text: text, recipes: [] };
              if (title && items[normalized].recipes.indexOf(title.textContent.trim()) === -1) items[normalized].recipes.push(title.textContent.trim());
            });
          });
          list.innerHTML = '';
          var keys = Object.keys(items).sort(function (a, b) { return a.localeCompare(b); });
          empty.classList.toggle('hidden', !!keys.length);
          keys.forEach(function (key) {
            var li = document.createElement('li'), label = document.createElement('label'), box = document.createElement('input'), text = document.createElement('span');
            li.className = 'shopping-item';
            box.type = 'checkbox'; box.className = 'shopping-check'; box.setAttribute('data-key', key); box.checked = !!checks[key];
            text.textContent = items[key].text;
            var source = document.createElement('small'); source.textContent = items[key].recipes.join(', ');
            label.appendChild(box); label.appendChild(text); label.appendChild(source); li.appendChild(label); list.appendChild(li);
          });
          list.classList.toggle('hidden', !keys.length);
        }
        document.addEventListener('change', function (e) {
          if (!e.target.classList || !e.target.classList.contains('shopping-check')) return;
          var checks = readChecks(); checks[e.target.getAttribute('data-key')] = e.target.checked;
          try { localStorage.setItem(checksKey, JSON.stringify(checks)); } catch (err) {}
          e.target.closest('.shopping-item').classList.toggle('checked', e.target.checked);
        });
        window.renderShoppingList = renderShoppingList;
      })();

      // ---- View toggle: Full cards / Compact list ----
      (function () {
        var vt = document.getElementById('viewTabs');
        if (!vt) return;
        var btns = Array.prototype.slice.call(vt.querySelectorAll('button[data-view]'));
        function setView(v) {
          document.body.classList.toggle('list-view', v === 'list');
          btns.forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-view') === v);
          });
          if (v !== 'list') {
            Array.prototype.forEach.call(document.querySelectorAll('article.card.expanded'), function (c) {
              c.classList.remove('expanded');
            });
          }
        }
        vt.addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('button[data-view]') : null;
          if (b) setView(b.getAttribute('data-view'));
        });
        // Compact list mein row pe tap = pura recipe kholo / band karo.
        document.addEventListener('click', function (e) {
          if (!document.body.classList.contains('list-view')) return;
          if (!e.target.closest) return;
          if (e.target.closest('.modal-overlay')) return;
          var card = e.target.closest('.wrap > article.card');
          if (!card) return;
          if (e.target.closest('.card-body') || e.target.closest('a') || e.target.closest('button')) return;
          card.classList.toggle('expanded');
        });
      })();

      // Filters stay reachable on long recipe lists; the drawer collapses after mobile filter taps.
    
