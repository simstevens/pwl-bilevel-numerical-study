// Instance explorer of the study website.
// Reads data/tasks.json and shows one row per (instance set, instance) with one
// column per method. Filters: set, q, p, text search; click a header to sort;
// the current selection can be exported as CSV.
(function () {
  "use strict";

  var SYMBOLS = { proved: "✓", limit_incumbent: "◐", limit_none: "○", failed: "✗", infeasible: "∅" };

  function outcome(task) {
    if (task.proved_optimal) return "proved";
    if (String(task.status).indexOf("infeasible") >= 0) return "infeasible";
    // The public site publishes outcomes directly as its status values.
    if (task.status === "incumbent") return "limit_incumbent";
    if (task.status === "none") return "limit_none";
    if (task.failed) return "failed";
    if (task.censored && task.has_incumbent) return "limit_incumbent";
    return "limit_none";
  }

  // Short set names for the table cells, as in the paper ("KI, integer");
  // the filter and the CSV export keep the full names.
  function shortSet(label) {
    return String(label).replace("Knapsack interdiction", "KI").replace(" leader", "");
  }

  function element(tag, attributes, text) {
    var node = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, attributes[key]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function select(label, values) {
    var wrapper = element("label", { class: "study-explorer-filter" }, label + " ");
    var input = element("select");
    input.appendChild(element("option", { value: "" }, "all"));
    values.forEach(function (value) { input.appendChild(element("option", { value: String(value) }, String(value))); });
    wrapper.appendChild(input);
    return { wrapper: wrapper, input: input };
  }

  function unique(values) {
    return Array.from(new Set(values)).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
  }

  function build(container, records) {
    var methods = unique(records.map(function (r) { return r.method_rank + "\u0000" + r.method_label; }))
      .sort(function (a, b) { return Number(a.split("\u0000")[0]) - Number(b.split("\u0000")[0]); })
      .map(function (key) { return key.split("\u0000")[1]; });
    var rows = {};
    records.forEach(function (task) {
      var key = task.set + "\u0000" + task.instance_id;
      if (!rows[key]) {
        rows[key] = { set: task.set, instance: task.instance_id, source: task.source_id, size: task.source_size, q: task.q, p: task.pieces, tasks: {} };
      }
      rows[key].tasks[task.method_label] = task;
    });
    rows = Object.keys(rows).map(function (key) { return rows[key]; });

    var setFilter = select("Instance set", unique(rows.map(function (r) { return r.set; })));
    var qFilter = select("q", unique(rows.map(function (r) { return r.q; })));
    var pFilter = select("p", unique(rows.map(function (r) { return r.p; })));
    var search = element("input", { type: "search", placeholder: "search instance or source" });
    var exportButton = element("button", { type: "button", class: "md-button" }, "Export selection as CSV");
    var count = element("span", { class: "study-explorer-count" });
    var controls = element("div", { class: "study-explorer-controls" });
    [setFilter.wrapper, qFilter.wrapper, pFilter.wrapper, search, exportButton, count].forEach(function (node) { controls.appendChild(node); });

    var columns = ["set", "instance", "size", "q", "p"].concat(methods);
    var sortColumn = "instance";
    var sortAscending = true;
    var table = element("table", { class: "study-explorer-table" });
    var scroller = element("div", { class: "study-explorer-scroll" });
    scroller.appendChild(table);
    container.appendChild(controls);
    container.appendChild(scroller);

    function sortValue(row, column) {
      if (methods.indexOf(column) < 0) return row[column];
      var task = row.tasks[column];
      if (!task) return Infinity;
      return task.proved_optimal ? task.solver_seconds : 1e12 + ["limit_incumbent", "limit_none", "failed", "infeasible"].indexOf(outcome(task));
    }

    function visibleRows() {
      var text = search.value.trim().toLowerCase();
      return rows.filter(function (row) {
        return (!setFilter.input.value || row.set === setFilter.input.value) &&
          (!qFilter.input.value || String(row.q) === qFilter.input.value) &&
          (!pFilter.input.value || String(row.p) === pFilter.input.value) &&
          (!text || row.instance.toLowerCase().indexOf(text) >= 0 || String(row.source).toLowerCase().indexOf(text) >= 0);
      }).sort(function (a, b) {
        var x = sortValue(a, sortColumn), y = sortValue(b, sortColumn);
        var order = x < y ? -1 : x > y ? 1 : 0;
        return sortAscending ? order : -order;
      });
    }

    function render() {
      var selection = visibleRows();
      table.innerHTML = "";
      var head = element("tr");
      columns.forEach(function (column) {
        var cell = element("th", { title: "click to sort" }, column + (column === sortColumn ? (sortAscending ? " ▲" : " ▼") : ""));
        cell.addEventListener("click", function () {
          sortAscending = column === sortColumn ? !sortAscending : true;
          sortColumn = column;
          render();
        });
        head.appendChild(cell);
      });
      var thead = element("thead");
      thead.appendChild(head);
      table.appendChild(thead);
      var body = element("tbody");
      selection.forEach(function (row) {
        var line = element("tr");
        ["set", "instance", "size", "q", "p"].forEach(function (column) {
          var value = row[column] === null ? "–" : String(row[column]);
          line.appendChild(element("td", {}, column === "set" ? shortSet(value) : value));
        });
        methods.forEach(function (method) {
          var task = row.tasks[method];
          if (!task) { line.appendChild(element("td", { class: "missing" }, "")); return; }
          var kind = outcome(task);
          var text = SYMBOLS[kind] + (kind === "proved" ? " " + Number(task.solver_seconds).toFixed(1) : "");
          var title = task.status + "; objective " + (task.objective_value === null ? "–" : task.objective_value) +
            "; solver time " + (task.solver_seconds === null ? "–" : Number(task.solver_seconds).toFixed(2) + " s");
          line.appendChild(element("td", { class: "outcome-" + kind, title: title }, text));
        });
        body.appendChild(line);
      });
      table.appendChild(body);
      count.textContent = selection.length + " of " + rows.length + " instances";
    }

    function exportCsv() {
      var header = ["set", "instance", "source", "size", "q", "p"];
      methods.forEach(function (method) { header.push(method + " status", method + " objective", method + " solver_seconds"); });
      var lines = [header];
      visibleRows().forEach(function (row) {
        var line = [row.set, row.instance, row.source, row.size, row.q, row.p];
        methods.forEach(function (method) {
          var task = row.tasks[method];
          line.push(task ? task.status : "", task && task.objective_value !== null ? task.objective_value : "", task && task.solver_seconds !== null ? task.solver_seconds : "");
        });
        lines.push(line);
      });
      var csv = lines.map(function (line) {
        return line.map(function (value) { var text = String(value === null || value === undefined ? "" : value); return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; }).join(",");
      }).join("\n");
      var link = element("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "instance-selection.csv" });
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    [setFilter.input, qFilter.input, pFilter.input].forEach(function (input) { input.addEventListener("change", render); });
    search.addEventListener("input", render);
    exportButton.addEventListener("click", exportCsv);
    render();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("div.study-explorer").forEach(function (container) {
      container.textContent = "Loading tasks …";
      fetch(window.StudyBase.url(container.getAttribute("data-tasks")))
        .then(function (response) { return response.json(); })
        .then(function (document_) { container.textContent = ""; build(container, document_.records); })
        .catch(function (error) { container.textContent = "The task data could not be loaded: " + error; });
    });
  });
})();
