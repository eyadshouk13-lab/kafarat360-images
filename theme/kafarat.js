/* KAFARAT 360 - custom JS for Salla (Raed Twig).
   Every feature starts only if its container is on the page, so one file serves all pages:
   [data-k360="finder"]      tire search: by size / by car / by name, results link straight to the product
   [data-k360="collections"] shop by collection, with a product strip
   [data-k360="tabs"]        categories / best sellers switch (best sellers = the Salla section right after)
   [data-k360="garage"]      My Garage: the customer's cars saved in this browser (localStorage)
   [data-k360="shop"]        all products with filters: size, type, brand, model, country, collection
   product page              package table (1 / 2 / 4 tires) under the price
   product cards             animated ribbon
   Data: products.json and cars.json on jsDelivr (built from the store's real product data). */
(function () {
  "use strict";

  var DATA = "https://cdn.jsdelivr.net/gh/eyadshouk13-lab/kafarat360-images@1a604540a7c12a6ef1a2ac91573ce5e4cb6ca913/data/";
  var IMG = "https://raw.githubusercontent.com/eyadshouk13-lab/kafarat360-images/d5004e9/";
  var TYPES = { car: "سيارات ركاب", suv: "SUV ودفع رباعي", truck: "نقل خفيف" };
  var COLLECTIONS = [
    { id: "value", ar: "اقتصادي", desc: "جودة موثوقة بأفضل سعر", test: function (p) { return price(p) < 450; } },
    { id: "runflat", ar: "رن فليت", desc: "تكمل القيادة حتى بعد الثقب", test: function (p) { return p.f === 1; } },
    { id: "offroad", ar: "أوف رود", desc: "متانة للبر والطرق الوعرة", test: function (p) { return /A\/T|M\/T|ALL TERRAIN|KO2|WRANGLER|AT PRO|AT3|MT\b/i.test(p.n); } },
    { id: "luxury", ar: "فخم", desc: "أعلى فئات الإطارات للسيارات الفاخرة", test: function (p) { return price(p) >= 1200; } },
    { id: "suv", ar: "SUV", desc: "إطارات سيارات الدفع الرباعي والكروس أوفر", test: function (p) { return p.t === "suv"; } },
    { id: "comfort", ar: "كومفورت", desc: "هدوء وراحة في كل مشوار", test: function (p) { return /PRIMACY|TURANZA|CINTURATO|ECOCONTACT|EFFICIENTGRIP|PREMIUMCONTACT|ECOPIA|BLUEARTH|VENTUS PRIME|ASSURANCE/i.test(p.n); } },
    { id: "sport", ar: "سبورت", desc: "ثبات على السرعات العالية واستجابة دقيقة", test: function (p) { return /PILOT SPORT|P ?ZERO|POTENZA|EAGLE F1|SPORTCONTACT|VENTUS S1|ADVAN|PS4|SPORT MAXX/i.test(p.n); } }
  ];

  /* ---------- helpers ---------- */
  var loaders = {};
  function load(name) {
    if (!loaders[name]) loaders[name] = fetch(DATA + name).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return loaders[name];
  }
  function price(p) { return p.s && p.s < p.pr ? p.s : p.pr; }
  function money(n) { return Math.round(n).toLocaleString("ar-SA") + " ر.س"; }
  function sizeOf(p) { return p.w + (p.p ? "/" + p.p : "") + "R" + p.r; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function base() { return (window.salla && salla.url && salla.url.get) ? salla.url.get("") : "/"; }
  function productUrl(p) { return base().replace(/\/?$/, "/") + "k360/p" + p.i; }
  function uniq(list) { return list.filter(function (v, i) { return v !== "" && v != null && list.indexOf(v) === i; }); }
  function byNum(a, b) { return a - b; }
  function opts(list, ph, sel) {
    return '<option value="">' + esc(ph) + "</option>" + list.map(function (v) {
      return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? " selected" : "") + ">" + esc(v) + "</option>";
    }).join("");
  }
  function card(p) {
    var off = p.s && p.s < p.pr ? Math.round((1 - p.s / p.pr) * 100) : 0;
    return '<a class="k360-pcard" href="' + productUrl(p) + '">' +
      (off ? '<span class="k360-pcard__off">خصم ' + off + "%</span>" : "") +
      '<span class="k360-pcard__img"><img src="' + IMG + esc(p.im) + '" alt="' + esc(p.b + " " + p.m) + '" loading="lazy"></span>' +
      '<span class="k360-pcard__brand">' + esc(p.b) + (p.c ? " · " + esc(p.c) : "") + (p.y ? " · " + p.y : "") + "</span>" +
      '<b class="k360-pcard__name">' + esc(p.m) + "</b>" +
      '<span class="k360-pcard__size">' + sizeOf(p) + "</span>" +
      '<span class="k360-pcard__price"><b>' + money(price(p)) + "</b>" + (off ? "<s>" + money(p.pr) + "</s>" : "") + "</span></a>";
  }
  function grid(list, limit) {
    if (!list.length) return '<p class="k360-empty">ما لقينا إطارات بهذا الاختيار. جرّب مقاس أو ماركة ثانية.</p>';
    return '<div class="k360-grid">' + list.slice(0, limit || list.length).map(card).join("") + "</div>";
  }
  function fail(el) { el.innerHTML = '<p class="k360-empty">تعذّر تحميل البيانات. <a href="' + base() + '">حدّث الصفحة</a></p>'; }

  /* ---------- shop (all products + filters) ---------- */
  var shop = { el: null, data: null, f: {}, shown: 24 };
  function shopApply(filters) {
    shop.f = filters || {};
    shop.shown = 24;
    if (shop.el) { shopRender(); shop.el.closest("section, .s-block") .scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
  window.k360Shop = shopApply;

  function shopFiltered() {
    var f = shop.f, col = COLLECTIONS.filter(function (c) { return c.id === f.col; })[0];
    var q = (f.q || "").toLowerCase().trim();
    var list = shop.data.filter(function (p) {
      if (f.w && p.w !== +f.w) return false;
      if (f.p && p.p !== +f.p) return false;
      if (f.r && p.r !== +f.r) return false;
      if (f.t && p.t !== f.t) return false;
      if (f.b && p.b !== f.b) return false;
      if (f.m && p.m !== f.m) return false;
      if (f.c && p.c !== f.c) return false;
      if (col && !col.test(p)) return false;
      if (q && (p.n + " " + p.b + " " + p.m + " " + sizeOf(p)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (f.sort === "asc") list.sort(function (a, b) { return price(a) - price(b); });
    else if (f.sort === "desc") list.sort(function (a, b) { return price(b) - price(a); });
    else if (f.sort === "off") list.sort(function (a, b) { return (b.s ? b.pr - b.s : 0) / b.pr - (a.s ? a.pr - a.s : 0) / a.pr; });
    return list;
  }

  function shopRender() {
    var d = shop.data, f = shop.f;
    var inW = d.filter(function (p) { return !f.w || p.w === +f.w; });
    var inWP = inW.filter(function (p) { return !f.p || p.p === +f.p; });
    var inB = d.filter(function (p) { return !f.b || p.b === f.b; });
    var list = shopFiltered();
    shop.el.innerHTML =
      '<div class="k360-shop">' +
      '<details class="k360-shop__filters" open><summary>الفلاتر</summary>' +
      '<label>المقاس</label><div class="k360-row3">' +
      '<select data-f="w" aria-label="العرض">' + opts(uniq(d.map(function (p) { return p.w; })).sort(byNum), "العرض", f.w) + "</select>" +
      '<select data-f="p" aria-label="الارتفاع">' + opts(uniq(inW.map(function (p) { return p.p; })).sort(byNum), "الارتفاع", f.p) + "</select>" +
      '<select data-f="r" aria-label="الجنط">' + opts(uniq(inWP.map(function (p) { return p.r; })).sort(byNum), "الجنط", f.r) + "</select></div>" +
      '<label>الفئة</label><select data-f="t">' + '<option value="">الكل</option>' + Object.keys(TYPES).map(function (k) { return '<option value="' + k + '"' + (f.t === k ? " selected" : "") + ">" + TYPES[k] + "</option>"; }).join("") + "</select>" +
      '<label>الكولكشن</label><select data-f="col"><option value="">الكل</option>' + COLLECTIONS.map(function (c) { return '<option value="' + c.id + '"' + (f.col === c.id ? " selected" : "") + ">" + c.ar + "</option>"; }).join("") + "</select>" +
      '<label>العلامة التجارية</label><select data-f="b">' + opts(uniq(d.map(function (p) { return p.b; })).sort(), "كل الماركات", f.b) + "</select>" +
      '<label>الموديل</label><select data-f="m">' + opts(uniq(inB.map(function (p) { return p.m; })).sort(), "كل الموديلات", f.m) + "</select>" +
      '<label>بلد الصناعة</label><select data-f="c">' + opts(uniq(d.map(function (p) { return p.c; })).sort(), "كل البلدان", f.c) + "</select>" +
      '<label>ترتيب</label><select data-f="sort"><option value="">الافتراضي</option><option value="asc"' + (f.sort === "asc" ? " selected" : "") + '>السعر: من الأقل</option><option value="desc"' + (f.sort === "desc" ? " selected" : "") + '>السعر: من الأعلى</option><option value="off"' + (f.sort === "off" ? " selected" : "") + ">أعلى خصم</option></select>" +
      '<button type="button" class="k360-btn k360-btn--line" data-reset>مسح الفلاتر</button>' +
      "</details>" +
      '<div class="k360-shop__main"><p class="k360-shop__count">' + list.length.toLocaleString("ar-SA") + " إطار" + (f.q ? " · بحث: " + esc(f.q) : "") + "</p>" +
      grid(list, shop.shown) +
      (list.length > shop.shown ? '<button type="button" class="k360-btn k360-btn--primary k360-more" data-more>عرض المزيد</button>' : "") +
      "</div></div>";
    if (window.innerWidth < 768) { var det = shop.el.querySelector("details"); if (det && !shop.keepOpen) det.open = false; }
  }

  function initShop(el) {
    shop.el = el;
    el.addEventListener("change", function (e) {
      var k = e.target.getAttribute("data-f"); if (!k) return;
      shop.f[k] = e.target.value;
      if (k === "w") { shop.f.p = ""; shop.f.r = ""; }
      if (k === "p") shop.f.r = "";
      if (k === "b") shop.f.m = "";
      shop.shown = 24; shop.keepOpen = true; shopRender();
    });
    el.addEventListener("click", function (e) {
      if (e.target.closest("[data-more]")) { shop.shown += 24; shop.keepOpen = true; shopRender(); }
      if (e.target.closest("[data-reset]")) { shop.f = {}; shop.shown = 24; shop.keepOpen = true; shopRender(); }
    });
    load("products.json").then(function (d) { shop.data = d; shopRender(); }).catch(function () { fail(el); });
  }

  /* ---------- finder ---------- */
  function initFinder(el) {
    Promise.all([load("products.json"), load("cars.json")]).then(function (res) {
      var d = res[0], cars = res[1], have = {};
      d.forEach(function (p) { have[sizeOf(p)] = (have[sizeOf(p)] || 0) + 1; });
      var s = { tab: "size", w: "", p: "", r: "", make: "", model: "", size: "", q: "" };
      function results() {
        var list = [];
        if (s.tab === "size" && s.w) list = d.filter(function (p) { return p.w === +s.w && (!s.p || p.p === +s.p) && (!s.r || p.r === +s.r); });
        if (s.tab === "car" && s.size) list = d.filter(function (p) { return sizeOf(p) === s.size; });
        if (s.tab === "name" && s.q.trim().length > 1) { var q = s.q.toLowerCase().trim(); list = d.filter(function (p) { return (p.n + " " + p.b + " " + p.m + " " + sizeOf(p)).toLowerCase().indexOf(q) >= 0; }); }
        return list.sort(function (a, b) { return price(a) - price(b); });
      }
      function render(keepFocus) {
        var inW = d.filter(function (p) { return !s.w || p.w === +s.w; }), inWP = inW.filter(function (p) { return !s.p || p.p === +s.p; });
        var body = "";
        if (s.tab === "size") {
          body = '<div class="k360-row3">' +
            '<select data-s="w" aria-label="العرض">' + opts(uniq(d.map(function (p) { return p.w; })).sort(byNum), "العرض", s.w) + "</select>" +
            '<select data-s="p" aria-label="الارتفاع"' + (s.w ? "" : " disabled") + ">" + opts(uniq(inW.map(function (p) { return p.p; })).sort(byNum), "الارتفاع", s.p) + "</select>" +
            '<select data-s="r" aria-label="الجنط"' + (s.w ? "" : " disabled") + ">" + opts(uniq(inWP.map(function (p) { return p.r; })).sort(byNum), "الجنط", s.r) + "</select></div>" +
            '<p class="k360-hint">المقاس مكتوب على جنب الإطار، مثال: 215/60R16</p>';
        } else if (s.tab === "car") {
          var mk = cars[s.make], md = mk && mk.models[s.model];
          body = '<div class="k360-row2">' +
            '<select data-s="make" aria-label="الشركة"><option value="">الشركة</option>' + Object.keys(cars).map(function (k) { return '<option value="' + k + '"' + (s.make === k ? " selected" : "") + ">" + esc(cars[k].ar) + "</option>"; }).join("") + "</select>" +
            '<select data-s="model" aria-label="الموديل"' + (mk ? "" : " disabled") + '><option value="">الموديل</option>' + (mk ? Object.keys(mk.models).map(function (k) { return '<option value="' + esc(k) + '"' + (s.model === k ? " selected" : "") + ">" + esc(k) + "</option>"; }).join("") : "") + "</select></div>" +
            (md ? '<div class="k360-sizes">' + md.sizes.map(function (z) { var n = have[z] || 0; return '<button type="button" data-size="' + z + '" class="k360-chip' + (s.size === z ? " is-on" : "") + (n ? "" : " is-out") + '"' + (n ? "" : " disabled") + ">" + z + (n ? " <small>(" + n.toLocaleString("ar-SA") + ")</small>" : " <small>غير متوفر</small>") + "</button>"; }).join("") + "</div>" : "") +
            '<p class="k360-hint">مقاسات شائعة لهذا الموديل. تأكد من المقاس المكتوب على جنب إطارك قبل الطلب.</p>';
        } else {
          body = '<div class="k360-row1"><input type="search" data-s="q" value="' + esc(s.q) + '" placeholder="اكتب الماركة أو الموديل أو المقاس، مثل: ميشلان أو PRIMACY أو 265/65R17" aria-label="بحث بالاسم"></div>';
        }
        var list = results(), more = list.length > 8;
        el.innerHTML =
          '<div class="k360-tabsbar" role="tablist">' +
          [["size", "بالمقاس"], ["car", "بنوع السيارة"], ["name", "بالاسم"]].map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" class="' + (s.tab === t[0] ? "is-on" : "") + '">' + t[1] + "</button>"; }).join("") +
          "</div>" + body +
          (list.length || (s.tab === "size" && s.w) || (s.tab === "car" && s.size) || (s.tab === "name" && s.q.trim().length > 1)
            ? '<div class="k360-finder__res"><p class="k360-shop__count">' + list.length.toLocaleString("ar-SA") + " إطار مناسب</p>" + grid(list, 8) +
              (more ? '<button type="button" class="k360-btn k360-btn--primary k360-more" data-all>عرض كل النتائج</button>' : "") + "</div>"
            : "");
        if (keepFocus) { var i = el.querySelector('[data-s="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
      }
      el.addEventListener("change", function (e) {
        var k = e.target.getAttribute("data-s"); if (!k || k === "q") return;
        s[k] = e.target.value;
        if (k === "w") { s.p = ""; s.r = ""; } if (k === "p") s.r = "";
        if (k === "make") { s.model = ""; s.size = ""; } if (k === "model") s.size = "";
        render();
      });
      var t;
      el.addEventListener("input", function (e) {
        if (e.target.getAttribute("data-s") !== "q") return;
        s.q = e.target.value; clearTimeout(t); t = setTimeout(function () { render(true); }, 250);
      });
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-tab]"); if (b) { s.tab = b.getAttribute("data-tab"); render(); return; }
        var z = e.target.closest("[data-size]"); if (z) { s.size = z.getAttribute("data-size"); render(); return; }
        if (e.target.closest("[data-all]")) {
          var f = {};
          if (s.tab === "size") f = { w: s.w, p: s.p, r: s.r };
          if (s.tab === "car") { var m = s.size.match(/^(\d+)\/?(\d*)R(\d+)$/); if (m) f = { w: m[1], p: m[2] || "0", r: m[3] }; }
          if (s.tab === "name") f = { q: s.q };
          if (shop.el) shopApply(f); else window.location.href = base() + "#k360-shop";
        }
      });
      render();
    }).catch(function () { fail(el); });
  }

  /* ---------- collections ---------- */
  function initCollections(el) {
    load("products.json").then(function (d) {
      var cur = COLLECTIONS[0].id;
      function render() {
        var c = COLLECTIONS.filter(function (x) { return x.id === cur; })[0];
        var list = d.filter(c.test).sort(function (a, b) { return price(a) - price(b); });
        el.innerHTML = '<div class="k360-chips">' + COLLECTIONS.map(function (x) { return '<button type="button" data-col="' + x.id + '" class="k360-chip' + (x.id === cur ? " is-on" : "") + '">' + x.ar + "</button>"; }).join("") + "</div>" +
          '<div class="k360-colinfo"><h3>كولكشن ' + c.ar + "</h3><p>" + c.desc + " · " + list.length.toLocaleString("ar-SA") + " إطار</p></div>" +
          '<div class="k360-strip">' + list.slice(0, 12).map(card).join("") + "</div>" +
          '<button type="button" class="k360-btn k360-btn--primary k360-more" data-shopcol="' + c.id + '">تسوّق الكولكشن كامل</button>';
      }
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-col]"); if (b) { cur = b.getAttribute("data-col"); render(); return; }
        var s = e.target.closest("[data-shopcol]"); if (s) { if (shop.el) shopApply({ col: s.getAttribute("data-shopcol") }); else window.location.href = base() + "#k360-shop"; }
      });
      render();
    }).catch(function () { fail(el); });
  }

  /* ---------- categories / best sellers switch ---------- */
  function initTabs(el) {
    var host = el.closest(".s-block--bundle-html-content") || el.closest(".s-block");
    var next = host && host.nextElementSibling;
    var bar = el.querySelector(".k360-tabsbar"), cats = el.querySelector("[data-panel='cats']");
    if (!bar) return;
    function show(which) {
      bar.querySelectorAll("button").forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-tab") === which); });
      if (cats) cats.hidden = which !== "cats";
      if (next) next.style.display = which === "best" ? "" : "none";
    }
    bar.addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (b) show(b.getAttribute("data-tab")); });
    el.addEventListener("click", function (e) {
      var c = e.target.closest("[data-cat]"); if (!c) return;
      e.preventDefault();
      var v = c.getAttribute("data-cat"), f = TYPES[v] ? { t: v } : { col: v };
      if (shop.el) shopApply(f); else window.location.href = base() + "#k360-shop";
    });
    show("cats");
  }

  /* ---------- my garage ---------- */
  function initGarage(el) {
    var KEY = "k360-garage";
    function read() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
    function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { return false; } }
    Promise.all([load("cars.json"), load("products.json")]).then(function (res) {
      var cars = res[0], d = res[1], st = { make: "", model: "" };
      var sizes = uniq(d.map(sizeOf)).sort();
      function render(msg) {
        var list = read(), mk = cars[st.make], md = mk && mk.models[st.model];
        el.innerHTML =
          (list.length ? '<div class="k360-garage__list">' + list.map(function (c, i) {
            return '<div class="k360-garage__car"><b>' + esc(c.name) + "</b><span>" + esc(c.size) + (c.year ? " · " + esc(c.year) : "") + "</span>" +
              '<button type="button" class="k360-btn k360-btn--primary" data-go="' + i + '">اعرض الإطارات المناسبة</button>' +
              '<button type="button" class="k360-btn k360-btn--line" data-del="' + i + '">حذف</button></div>';
          }).join("") + "</div>" : '<p class="k360-hint">ما عندك سيارات محفوظة. أضف سيارتك مرة وحدة، وتلقى إطاراتها كل ما رجعت.</p>') +
          '<form class="k360-garage__form" data-form>' +
          '<select data-g="make" aria-label="الشركة"><option value="">الشركة</option>' + Object.keys(cars).map(function (k) { return '<option value="' + k + '"' + (st.make === k ? " selected" : "") + ">" + esc(cars[k].ar) + "</option>"; }).join("") + "</select>" +
          '<select data-g="model" aria-label="الموديل"' + (mk ? "" : " disabled") + '><option value="">الموديل</option>' + (mk ? Object.keys(mk.models).map(function (k) { return '<option value="' + esc(k) + '"' + (st.model === k ? " selected" : "") + ">" + esc(k) + "</option>"; }).join("") : "") + "</select>" +
          '<input name="year" inputmode="numeric" maxlength="4" placeholder="سنة الصنع (اختياري)" aria-label="سنة الصنع">' +
          '<select name="size" aria-label="مقاس الإطار" required><option value="">مقاس الإطار</option>' + (md ? md.sizes.filter(function (z) { return sizes.indexOf(z) >= 0; }).map(function (z) { return '<option value="' + z + '">' + z + " (شائع لهذا الموديل)</option>"; }).join("") : "") + sizes.map(function (z) { return '<option value="' + z + '">' + z + "</option>"; }).join("") + "</select>" +
          '<button class="k360-btn k360-btn--primary" type="submit">احفظ سيارتي</button></form>' +
          (msg ? '<p class="k360-hint">' + msg + "</p>" : "") +
          '<p class="k360-hint">تنحفظ سياراتك في هذا الجهاز فقط.</p>';
      }
      el.addEventListener("change", function (e) {
        var k = e.target.getAttribute("data-g"); if (!k) return;
        st[k] = e.target.value; if (k === "make") st.model = ""; render();
      });
      el.addEventListener("submit", function (e) {
        e.preventDefault();
        var fm = e.target, size = fm.size.value; if (!size) return;
        var mk = cars[st.make], name = mk ? mk.ar + (st.model ? " " + st.model : "") : "سيارتي";
        var list = read(); list.push({ name: name, size: size, year: fm.year.value.replace(/\D/g, "").slice(0, 4) });
        render(save(list) ? "انحفظت سيارتك ✓" : "المتصفح ما يسمح بالحفظ.");
      });
      el.addEventListener("click", function (e) {
        var g = e.target.closest("[data-go]"), x = e.target.closest("[data-del]"), list = read();
        if (g) { var c = list[+g.getAttribute("data-go")], m = c && c.size.match(/^(\d+)\/?(\d*)R(\d+)$/); if (m) { var f = { w: m[1], p: m[2] || "0", r: m[3] }; if (shop.el) shopApply(f); else window.location.href = base() + "#k360-shop"; } }
        if (x) { list.splice(+x.getAttribute("data-del"), 1); save(list); render(); }
      });
      render();
    }).catch(function () { fail(el); });
  }

  /* ---------- product page: package table ---------- */
  function initPackages() {
    var cfg = window.salla && salla.config;
    if (!cfg || cfg.get("page.slug") !== "product.single" || document.querySelector(".k360-pkg")) return;
    var id = cfg.get("page.id");
    var anchor = document.querySelector("form.product-form .sticky-product-bar") || document.querySelector("salla-add-product-button");
    if (!id || !anchor) return;
    load("products.json").then(function (d) {
      var p = d.filter(function (x) { return x.i === id; })[0]; if (!p) return;
      var u = price(p), box = document.createElement("div");
      box.className = "k360-pkg";
      box.innerHTML = '<p class="k360-pkg__t">قارن الباقات</p><table><thead><tr><th>الباقة</th><th>سعر الكفر</th><th>الإجمالي</th></tr></thead><tbody>' +
        [[1, "كفر واحد"], [2, "كفرين"], [4, "4 كفرات"]].map(function (r) {
          return "<tr><td>" + r[1] + "</td><td>" + money(u) + "</td><td><b>" + money(u * r[0]) + "</b></td></tr>";
        }).join("") + '</tbody></table><p class="k360-hint">اختر العدد من خانة الكمية. ' + (p.g ? "ضمان " + p.g + " سنوات · " : "") + (p.c ? "صنع " + esc(p.c) + (p.y ? " " + p.y : "") : "") + "</p>";
      if (document.querySelector(".k360-pkg")) return;
      anchor.parentNode.insertBefore(box, anchor);
    }).catch(function () {});
  }

  /* ---------- product card ribbon ---------- */
  function addRibbon(cardEl) {
    var box = cardEl.querySelector(".s-product-card-image");
    if (!box || box.querySelector(".k360-rib")) return;
    var promo = cardEl.querySelector(".s-product-card-promotion-title");
    var m = promo && promo.textContent.match(/([0-9٠-٩]+)\s*%/);
    var msg = m ? "خصم حصري " + m[1] + "% ✦ توصيل وتركيب عند باب بيتك" : "توصيل وتركيب عند باب بيتك ✦ ضمان الوكيل";
    var seg = ""; for (var i = 0; i < 4; i++) seg += "<span>" + msg + "</span><i>✦</i>";
    var dv = document.createElement("div");
    dv.className = "k360-rib" + (m ? "" : " k360-rib--alt"); dv.setAttribute("aria-hidden", "true");
    dv.innerHTML = '<div class="k360-rib__track"><div>' + seg + "</div><div>" + seg + "</div></div>";
    box.appendChild(dv);
  }

  /* ---------- start ---------- */
  var INIT = { finder: initFinder, collections: initCollections, tabs: initTabs, garage: initGarage, shop: initShop };
  function scan() {
    document.querySelectorAll("[data-k360]:not([data-k360-on])").forEach(function (el) {
      var fn = INIT[el.getAttribute("data-k360")]; if (!fn) return;
      el.setAttribute("data-k360-on", "1"); fn(el);
    });
    var cards = document.querySelectorAll(".s-product-card-entry");
    for (var i = 0; i < cards.length; i++) addRibbon(cards[i]);
    initPackages();
  }
  var queued = false;
  function queue() { if (queued) return; queued = true; setTimeout(function () { queued = false; scan(); }, 150); }
  function start() {
    scan();
    new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
    if (location.hash === "#k360-shop") setTimeout(function () { var s = document.getElementById("k360-shop"); if (s) s.scrollIntoView(); }, 600);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
