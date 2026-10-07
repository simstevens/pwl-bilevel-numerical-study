// Filter the paper's TikZ files to the methods selected on the study website.
// The paper's figure files mark every method's
// lines ("% begin method K" ... "% end method K") and, in the heat maps, the
// row and column labels ("% begin group K1 K2 ..." ... "% end group") and every
// positioned line ("% grid row=R column=C"). Runs in the browser (window.StudyTikz)
// and in Node (module.exports), where the tests load it.
(function (root) {
  "use strict";

  var HEAT_MAP_GRID = "% heat map grid:";
  var GRID_MARKER = /% grid((?: (?:row|column)=\d+)+| height)\s*$/;
  var CENTIMETRE_POINT = /\((-?[0-9.e+-]+)cm,(-?[0-9.e+-]+)cm\)/g;
  var AXIS_LABEL = /^\s*[xy]label=\{.*\},\s*$/;

  // Python's "{:.8g}" for the coordinate range of the heat maps (see _format_float).
  function formatFloat(value) {
    if (Math.abs(value) < 1e-12) return "0";
    return String(parseFloat(value.toPrecision(8)));
  }

  // Remove unselected methods: their marked blocks, then any remaining line that
  // uses their TikZ colour (and the legend entry after a removed legend image),
  // as in report.html. A row or column label stays only if one of its methods
  // is selected. Finally restack the coloured solved counts of each axis.
  function filterMethods(source, methods, selectedKeys) {
    var unselected = methods.filter(function (method) { return selectedKeys.indexOf(method.key) < 0; });
    var unselectedKeys = unselected.map(function (method) { return method.key; });
    var unselectedColours = unselected.map(function (method) { return method.colour; });
    var skipping = null;
    var groupSkipping = false;
    var dropLegendEntry = false;
    var kept = [];
    source.split("\n").forEach(function (line) {
      var trimmed = line.trim();
      if (skipping !== null) {
        if (trimmed === "% end method " + skipping) skipping = null;
        return;
      }
      if (trimmed.indexOf("% begin method ") === 0 && unselectedKeys.indexOf(trimmed.slice(15)) >= 0) {
        skipping = trimmed.slice(15);
        return;
      }
      if (trimmed.indexOf("% begin group ") === 0) {
        var members = trimmed.slice(14).split(" ").filter(function (key) { return unselectedKeys.indexOf(key) < 0; });
        groupSkipping = members.length === 0;
        if (!groupSkipping) kept.push(line.slice(0, line.indexOf("% begin group ")) + "% begin group " + members.join(" "));
        return;
      }
      if (trimmed === "% end group") {
        if (!groupSkipping) kept.push(line);
        groupSkipping = false;
        return;
      }
      if (groupSkipping) return;
      if (dropLegendEntry) {
        dropLegendEntry = false;
        if (trimmed.indexOf("\\addlegendentry") === 0) return;
      }
      var colour = unselectedColours.find(function (name) { return new RegExp("\\b" + name + "\\b").test(line); });
      if (colour) {
        if (line.indexOf("\\addlegendimage") >= 0) dropLegendEntry = true;
        return;
      }
      kept.push(line);
    });
    return restackCounts(kept).join("\n");
  }

  // Restack per axis with the paper's spacing rule: 0.08, or 0.80 / count when crowded.
  function restackCounts(lines) {
    var countPattern = /(\\node\[text=method[^\]]*font=\\small\] at \(rel axis cs:0\.03,)[0-9.]+(\))/;
    var countsPerAxis = [];
    lines.forEach(function (line) {
      if (line.indexOf("\\begin{axis}") >= 0) countsPerAxis.push(0);
      if (countPattern.test(line) && countsPerAxis.length) countsPerAxis[countsPerAxis.length - 1] += 1;
    });
    var axisIndex = -1;
    var position = 0;
    var step = 0.08;
    return lines.map(function (line) {
      if (line.indexOf("\\begin{axis}") >= 0) {
        axisIndex += 1;
        position = 0;
        step = Math.min(0.08, 0.80 / Math.max(1, countsPerAxis[axisIndex]));
      }
      return line.replace(countPattern, function (match, head, tail) {
        var y = 0.88 - step * position;
        position += 1;
        return head + y.toFixed(3) + tail;
      });
    });
  }

  function gridSteps(lines) {
    var header = lines.find(function (line) { return line.indexOf(HEAT_MAP_GRID) === 0; });
    if (!header) return null;
    function value(name) {
      var match = new RegExp(name + "=(-?[0-9.e+-]+)cm").exec(header);
      return match ? parseFloat(match[1]) : null;
    }
    return { x: value("step-x"), y: value("step-y"), gapY: value("gap-y") };
  }

  function gridIndex(marker, name) {
    var match = new RegExp(name + "=(\\d+)").exec(marker);
    return match ? parseInt(match[1], 10) : null;
  }

  // The new index of an old row or column: the number of kept ones before it.
  // The column after the last one (the colour bar) moves along.
  function packedIndex(kept, index) {
    return kept.filter(function (keptIndex) { return keptIndex < index; }).length;
  }

  // Pack a filtered heat map: remove rows and columns without panels, move the
  // remaining panels, labels and the colour bar together, and give the q and p
  // axis labels to the panels of the first column and of each column's bottom
  // row, as the paper's figure generator does for a figure of these methods only. The axis labels
  // are read from the unfiltered file (labelSource), since a filtered one may
  // lack them. The colour scale keeps the range of all methods.
  function packHeatMap(source, labelSource) {
    var lines = source.split("\n");
    var steps = gridSteps(lines);
    if (steps === null) return source;
    var panels = [];
    var method = null;
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (trimmed.indexOf("% begin method ") === 0) method = trimmed.slice(15);
      if (trimmed.indexOf("% end method ") === 0) method = null;
      var marker = GRID_MARKER.exec(line);
      if (method !== null && marker && gridIndex(marker[1], "row") !== null) {
        panels.push({ key: method, row: gridIndex(marker[1], "row"), column: gridIndex(marker[1], "column") });
      }
    });
    if (!panels.length) return source;
    function unique(values) {
      return values.filter(function (value, index) { return values.indexOf(value) === index; }).sort(function (a, b) { return a - b; });
    }
    var rows = unique(panels.map(function (panel) { return panel.row; }));
    var columns = unique(panels.map(function (panel) { return panel.column; }));
    var bottomRow = {};
    panels.forEach(function (panel) {
      var column = packedIndex(columns, panel.column);
      bottomRow[column] = Math.max(bottomRow[column] === undefined ? -1 : bottomRow[column], packedIndex(rows, panel.row));
    });
    var labels = { x: null, y: null };
    (labelSource === undefined ? source : labelSource).split("\n").forEach(function (line) {
      if (AXIS_LABEL.test(line)) labels[line.trim().charAt(0)] = line;
    });
    var height = rows.length * steps.y - steps.gapY;
    var packed = [];
    lines.forEach(function (line) {
      if (AXIS_LABEL.test(line)) return;
      var marker = GRID_MARKER.exec(line);
      if (!marker) {
        packed.push(line);
        return;
      }
      if (marker[1] === " height") {
        packed.push(line.replace(/height=-?[0-9.e+-]+cm/g, "height=" + formatFloat(height) + "cm"));
        return;
      }
      var row = gridIndex(marker[1], "row");
      var column = gridIndex(marker[1], "column");
      var newRow = row === null ? null : packedIndex(rows, row);
      var newColumn = column === null ? null : packedIndex(columns, column);
      var dx = column === null ? 0 : (newColumn - column) * steps.x;
      var dy = row === null ? 0 : -(newRow - row) * steps.y;
      var moved = line.replace(CENTIMETRE_POINT, function (match, x, y) {
        return "(" + formatFloat(parseFloat(x) + dx) + "cm," + formatFloat(parseFloat(y) + dy) + "cm)";
      });
      moved = moved.replace(/row=\d+/, "row=" + newRow).replace(/column=\d+/, "column=" + newColumn);
      // A panel line: its axis labels come right before its position.
      if (row !== null && column !== null) {
        var indent = line.slice(0, line.length - line.trimStart().length);
        if (newColumn === 0 && labels.y !== null) packed.push(indent + labels.y.trim());
        if (bottomRow[newColumn] === newRow && labels.x !== null) packed.push(indent + labels.x.trim());
      }
      packed.push(moved);
    });
    return packed.join("\n");
  }

  function filterTikz(source, methods, selectedKeys) {
    return packHeatMap(filterMethods(source, methods, selectedKeys), source);
  }

  var api = { filterTikz: filterTikz, filterMethods: filterMethods, packHeatMap: packHeatMap, formatFloat: formatFloat };
  root.StudyTikz = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
