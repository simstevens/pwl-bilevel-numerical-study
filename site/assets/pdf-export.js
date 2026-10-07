// Vector PDF export of a study chart: the chart's SVG from Vega, drawn into a
// one-page PDF of the same size with the vendored jsPDF and svg2pdf.js.
// Every text uses the vendored DejaVu Sans, which covers the superscripts of
// the log axes (10⁻²) and other symbols that the standard PDF fonts lack.
// The libraries and the font (about 1.3 MB) are loaded on the first export
// only. Runs in the browser as window.StudyPdf.
(function () {
  "use strict";
  var FONT_NAME = "DejaVuSans";
  var FONT_FILE = "DejaVuSans.ttf";
  // The vendored files sit next to this script, in vendor/pdf/.
  var script = document.currentScript;
  var vendorUrl = (script ? script.src : "").replace(/[^/]*$/, "") + "vendor/pdf/";
  var loading = null;

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var element = document.createElement("script");
      element.src = url;
      element.onload = function () { resolve(); };
      element.onerror = function () { reject(new Error("could not load " + url)); };
      document.head.appendChild(element);
    });
  }

  // Encode the font file for jsPDF's virtual file system, in chunks to stay
  // below the argument limit of String.fromCharCode.
  function toBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var parts = [];
    for (var start = 0; start < bytes.length; start += 0x8000) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(start, start + 0x8000)));
    }
    return window.btoa(parts.join(""));
  }

  // Load jsPDF, then svg2pdf.js (which needs the jspdf global), then the font.
  // The font is also registered with the browser, so that text extents are
  // measured with the PDF's glyphs. Resolve with the font as base64; a failed
  // attempt can be retried.
  function loadLibraries() {
    if (loading === null) {
      loading = loadScript(vendorUrl + "jspdf.umd.min.js")
        .then(function () { return loadScript(vendorUrl + "svg2pdf.umd.min.js"); })
        .then(function () { return fetch(vendorUrl + FONT_FILE); })
        .then(function (response) {
          if (!response.ok) throw new Error("could not load " + FONT_FILE);
          return response.arrayBuffer();
        })
        .then(function (buffer) {
          var face = new FontFace(FONT_NAME, buffer);
          return face.load().then(function () { document.fonts.add(face); return toBase64(buffer); });
        });
      loading.catch(function () { loading = null; });
    }
    return loading;
  }

  // Return a jsPDF document with the chart as vector graphics.
  function build(view) {
    var font = null;
    return loadLibraries()
      .then(function (base64) { font = base64; return view.toSVG(); })
      .then(function (markup) {
        // svg2pdf reads the SVG element; it is attached off screen while drawing.
        var holder = document.createElement("div");
        holder.style.cssText = "position:absolute;left:-100000px;top:0;";
        holder.innerHTML = markup;
        document.body.appendChild(holder);
        var svg = holder.querySelector("svg");
        svg.querySelectorAll("text").forEach(function (text) { text.setAttribute("font-family", FONT_NAME); });
        // The page covers the drawing and every label in the PDF font, which
        // can be wider than the browser font the chart was laid out with.
        var extent = svg.getBBox();
        var width = Math.ceil(Math.max(Number(svg.getAttribute("width")), extent.x + extent.width + 4));
        var height = Math.ceil(Math.max(Number(svg.getAttribute("height")), extent.y + extent.height + 4));
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);
        if (svg.getAttribute("viewBox")) svg.setAttribute("viewBox", "0 0 " + width + " " + height);
        var doc = new window.jspdf.jsPDF({ unit: "pt", format: [width, height], orientation: width > height ? "landscape" : "portrait" });
        doc.addFileToVFS(FONT_FILE, font);
        // Bold labels use the regular face; the charts set no bold text.
        doc.addFont(FONT_FILE, FONT_NAME, "normal");
        doc.addFont(FONT_FILE, FONT_NAME, "bold");
        doc.setFont(FONT_NAME, "normal");
        return window.svg2pdf.svg2pdf(svg, doc, { x: 0, y: 0, width: width, height: height }).then(
          function () { holder.remove(); return doc; },
          function (error) { holder.remove(); throw error; }
        );
      });
  }

  // Build the PDF and save it under the given file name.
  function save(view, name) {
    return build(view).then(function (doc) { doc.save(name); });
  }

  window.StudyPdf = { build: build, save: save };
})();
