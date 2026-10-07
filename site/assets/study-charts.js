// Render every study chart of a page with the vendored Vega-Lite.
// A chart is <div class="study-chart"> carrying its Vega-Lite spec in its
// data-spec attribute (HTML-escaped JSON). Data URLs
// inside the specs are relative to the page.
//
// A <div class="study-method-panel" data-methods='[...]'> becomes one checkbox
// per method plus "All" and "None". Charts that declare the parameter
// "shown_methods" show only the ticked methods. The selection is shared by all
// panels and charts of the site and remembered in this browser.
(function () {
  "use strict";
  // Bump the key when method labels change, so stale selections are ignored.
  var STORAGE_KEY = "pwl-study-shown-methods-v2";
  var views = [];
  var shown = null;

  function loadSelection() {
    try { var stored = window.localStorage.getItem(STORAGE_KEY); return stored ? JSON.parse(stored) : null; } catch (error) { return null; }
  }

  function saveSelection(methods) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(methods)); } catch (error) { /* storage unavailable */ }
  }

  function applySelection() {
    if (shown === null) return;
    views.forEach(function (view) {
      try { view.signal("shown_methods", shown.slice()).runAsync(); } catch (error) { /* chart without method selection */ }
    });
  }

  // Build the method-selection matrix: rows = method kinds, columns = master
  // formulations (as in the per-analysis report). Row, column, and "All IOM"
  // checkboxes tick their whole group and show a partial state when mixed.
  function buildPanel(panel) {
    if (panel.getAttribute("data-built") === "true") return;
    panel.setAttribute("data-built", "true");
    var matrix = JSON.parse(panel.getAttribute("data-matrix"));
    var labels = matrix.methods.map(function (method) { return method.label; });
    var stored = loadSelection();
    shown = stored ? labels.filter(function (label) { return stored.indexOf(label) >= 0; }) : labels.slice();
    var boxes = [];
    var groups = [];

    function checkbox(text, members) {
      var label = document.createElement("label");
      label.className = "study-matrix-group";
      var box = document.createElement("input");
      box.type = "checkbox";
      box.addEventListener("change", function () {
        boxes.forEach(function (entry) { if (members(entry.method)) entry.box.checked = box.checked; });
        update();
      });
      groups.push({ box: box, members: members });
      label.appendChild(box);
      label.appendChild(document.createTextNode(" " + text));
      return label;
    }

    var toolbar = document.createElement("div");
    toolbar.className = "study-method-buttons";
    var title = document.createElement("strong");
    title.textContent = "Methods shown:";
    toolbar.appendChild(title);
    [["All", true], ["None", false]].forEach(function (entry) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "md-button";
      button.textContent = entry[0];
      button.addEventListener("click", function () {
        boxes.forEach(function (item) { item.box.checked = entry[1]; });
        update();
      });
      toolbar.appendChild(button);
    });
    var iterativeKinds = matrix.kinds.filter(function (kind) { return kind.oov; }).map(function (kind) { return kind.key; });
    if (iterativeKinds.length) {
      toolbar.appendChild(checkbox("All IOM variants", function (method) { return iterativeKinds.indexOf(method.kind) >= 0; }));
    }

    var table = document.createElement("table");
    table.className = "study-method-matrix";
    var head = document.createElement("tr");
    var corner = document.createElement("th");
    corner.textContent = "Kind \\ master";
    head.appendChild(corner);
    matrix.masters.forEach(function (master) {
      var cell = document.createElement("th");
      cell.appendChild(checkbox(master.label, function (method) { return method.master === master.key; }));
      head.appendChild(cell);
    });
    var thead = document.createElement("thead");
    thead.appendChild(head);
    table.appendChild(thead);
    var body = document.createElement("tbody");
    matrix.kinds.forEach(function (kind) {
      var row = document.createElement("tr");
      var rowHead = document.createElement("th");
      rowHead.appendChild(checkbox(kind.label, function (method) { return method.kind === kind.key; }));
      row.appendChild(rowHead);
      matrix.masters.forEach(function (master) {
        var cell = document.createElement("td");
        var members = matrix.methods.filter(function (method) { return method.kind === kind.key && method.master === master.key; });
        if (!members.length) cell.textContent = "—";
        members.forEach(function (method) {
          var label = document.createElement("label");
          label.className = "study-matrix-method";
          var box = document.createElement("input");
          box.type = "checkbox";
          box.checked = shown.indexOf(method.label) >= 0;
          box.addEventListener("change", update);
          boxes.push({ box: box, method: method });
          label.appendChild(box);
          label.appendChild(document.createTextNode(" " + method.label));
          cell.appendChild(label);
        });
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    table.appendChild(body);

    function refreshGroups() {
      groups.forEach(function (group) {
        var members = boxes.filter(function (entry) { return group.members(entry.method); });
        var checked = members.filter(function (entry) { return entry.box.checked; }).length;
        group.box.checked = members.length > 0 && checked === members.length;
        group.box.indeterminate = checked > 0 && checked < members.length;
      });
    }

    function update() {
      shown = boxes.filter(function (entry) { return entry.box.checked; }).map(function (entry) { return entry.method.label; });
      saveSelection(shown);
      refreshGroups();
      applySelection();
    }

    var wrap = document.createElement("div");
    wrap.className = "study-method-matrix-wrap";
    wrap.appendChild(table);
    panel.appendChild(toolbar);
    panel.appendChild(wrap);
    refreshGroups();
  }

  // Plain download buttons below a chart (the Vega action menu clashes with the theme).
  function addDownloadButtons(container, view) {
    var bar = document.createElement("div");
    bar.className = "study-chart-downloads";
    [["svg", "Download SVG"], ["png", "Download PNG"]].forEach(function (entry) {
      bar.appendChild(button(entry[1], function () {
        view.toImageURL(entry[0], entry[0] === "png" ? 2 : 1).then(function (url) { saveUrl(url, "chart." + entry[0]); });
      }));
    });
    if (container.getAttribute("data-tikz-name")) {
      var status = document.createElement("span");
      status.className = "study-tikz-status";
      bar.appendChild(button("Download TikZ", function () {
        downloadTikz(container, view).then(
          function (names) { status.textContent = "Saved " + names.join(" and ") + " (selected methods only)."; },
          function (error) { status.textContent = "TikZ export failed: " + error; }
        );
      }));
      bar.appendChild(status);
    }
    container.insertAdjacentElement("afterend", bar);
  }

  function button(text, action) {
    var element = document.createElement("button");
    element.type = "button";
    element.className = "md-button";
    element.textContent = text;
    element.addEventListener("click", action);
    return element;
  }

  function saveUrl(url, name) {
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function saveText(text, name) {
    var url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    saveUrl(url, name);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  // ----- TikZ export: the paper's own files, filtered to the selected methods -----
  var tikzIndex = null;

  function loadTikzIndex() {
    if (tikzIndex === null) {
      tikzIndex = fetch(window.StudyBase.url("data/tikz-index.json")).then(function (response) { return response.json(); });
    }
    return tikzIndex;
  }

  function signalOr(view, name, fallback) {
    try { return view.signal(name); } catch (error) { return fallback; }
  }

  // Pick the paper file that matches the chart's current set and source size.
  function tikzFileName(container, view, files) {
    var base = container.getAttribute("data-tikz-name");
    var size = signalOr(view, "source_size", "all");
    if (size !== "all") {
      var faceted = [base + "_by_instance_size", base + "_by_item_count"].filter(function (name) {
        return files.indexOf(name + ".tikz") >= 0;
      });
      if (faceted.length) return faceted[0];
    }
    return base;
  }

  function downloadTikz(container, view) {
    return loadTikzIndex().then(function (index) {
      var setLabel = container.getAttribute("data-tikz-set") || signalOr(view, "instance_set", null);
      var entry = index.sets[setLabel];
      if (!entry) throw new Error("no TikZ files for " + setLabel);
      var name = tikzFileName(container, view, entry.files);
      var labels = shown === null ? index.methods.map(function (method) { return method.label; }) : shown;
      var selectedKeys = index.methods.filter(function (method) { return labels.indexOf(method.label) >= 0; })
        .map(function (method) { return method.key; });
      var names = [name + ".tikz"];
      if (entry.files.indexOf(name + "__legend.tikz") >= 0) names.push(name + "__legend.tikz");
      return Promise.all(names.map(function (file) {
        return fetch(window.StudyBase.url("tikz/" + entry.key + "/" + file)).then(function (response) { return response.text(); });
      })).then(function (sources) {
        sources.forEach(function (source, position) { saveText(window.StudyTikz.filterTikz(source, index.methods, selectedKeys), names[position]); });
        return names;
      });
    });
  }

  // A single-panel chart (data-grow) is sized to the window at the aspect ratio
  // of its specification: the plot, its controls and its download buttons fit
  // the page width and the window height below the site header, so the whole
  // chart is visible without scrolling. Fonts keep their size.
  var GROW_MINIMUM_WIDTH = 240;
  var GROW_MARGIN = 24;

  function growWithPage(container, view) {
    var ratio = view.height() / view.width();
    var scale = Number(container.getAttribute("data-grow-scale")) || 1;
    function fit() {
      var svg = container.querySelector("svg");
      if (!svg) return;
      // Axes, titles and legends take the rest of the SVG's width; the controls
      // and the download buttons below take the rest of the block's height.
      var overheadX = Number(svg.getAttribute("width")) - view.width();
      var downloads = container.nextElementSibling;
      var bottom = downloads ? downloads.getBoundingClientRect().bottom : container.getBoundingClientRect().bottom;
      var overheadY = bottom - container.getBoundingClientRect().top - view.height();
      // The site header stays on screen (optional: the page also works without it).
      var header = document.querySelector("header");
      var headerHeight = header ? header.getBoundingClientRect().height : 0;
      var availableWidth = container.clientWidth - overheadX - 4;
      var availableHeight = window.innerHeight - headerHeight - overheadY - GROW_MARGIN;
      var fittedWidth = Math.max(GROW_MINIMUM_WIDTH, Math.min(availableWidth, availableHeight / ratio));
      var width = Math.floor(fittedWidth * scale);
      if (width !== view.width()) view.width(width).height(Math.round(width * ratio)).runAsync();
    }
    fit();
    window.addEventListener("resize", fit);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("div.study-method-panel").forEach(buildPanel);
    renderCharts();
  });

  function renderCharts() {
    document.querySelectorAll("div.study-chart").forEach(function (container) {
      if (container.getAttribute("data-rendered") === "true") return;
      container.setAttribute("data-rendered", "true");
      var text = container.getAttribute("data-spec");
      if (!text) {
        container.textContent = "Chart specification missing.";
        return;
      }
      var spec = JSON.parse(text);
      var options = { actions: false, renderer: "svg" };
      if (window.StudyBase.base()) options.loader = { baseURL: window.StudyBase.base() };
      vegaEmbed(container, spec, options)
        .then(function (result) {
          views.push(result.view);
          addDownloadButtons(container, result.view);
          if (container.getAttribute("data-grow") === "true") growWithPage(container, result.view);
          applySelection();
        })
        .catch(function (error) { container.textContent = "Chart could not be rendered: " + error; });
    });
  }
})();

// Make the generated tables inside <div class="study-sortable"> sortable by
// clicking a column header (numbers sort numerically; "–" sorts last).
document.addEventListener("DOMContentLoaded", function () {
  function value(cell) {
    var text = cell.textContent.trim().replace(/[,%\s]/g, "");
    if (text === "–" || text === "") return { missing: true };
    var number = Number(text);
    return isNaN(number) ? { text: cell.textContent.trim().toLowerCase() } : { number: number };
  }
  document.querySelectorAll("div.study-sortable table").forEach(function (table) {
    var headers = table.querySelectorAll("thead th");
    headers.forEach(function (header, index) {
      var ascending = true;
      header.style.cursor = "pointer";
      header.title = "click to sort";
      header.addEventListener("click", function () {
        var body = table.tBodies[0];
        var rows = Array.from(body.rows);
        rows.sort(function (a, b) {
          var x = value(a.cells[index]), y = value(b.cells[index]);
          if (x.missing || y.missing) return x.missing === y.missing ? 0 : x.missing ? 1 : -1;
          var order = "number" in x && "number" in y ? x.number - y.number : String(x.text || x.number).localeCompare(String(y.text || y.number));
          return ascending ? order : -order;
        });
        rows.forEach(function (row) { body.appendChild(row); });
        ascending = !ascending;
      });
    });
  });
});
