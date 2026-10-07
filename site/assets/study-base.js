// Resolve study data URLs. In the standalone site every data and TikZ
// URL is relative to its page. A page embedded in another website can name a
// publication base instead: <meta name="pwl-study-base" content="/path/to/study/">.
(function (root) {
  "use strict";

  function base() {
    var meta = root.document ? root.document.querySelector('meta[name="pwl-study-base"]') : null;
    return meta && meta.content ? meta.content.replace(/\/?$/, "/") : "";
  }

  function url(path) {
    return base() + path;
  }

  root.StudyBase = { base: base, url: url };
})(typeof window !== "undefined" ? window : globalThis);
