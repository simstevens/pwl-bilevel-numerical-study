// Typeset the math that pymdownx.arithmatex (generic mode) marks with the class
// "arithmatex", using the vendored KaTeX: \( ... \) inline, \[ ... \] display.
// KaTeX renders synchronously and loads nothing else, so the site stays offline.
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".arithmatex").forEach(function (element) {
    renderMathInElement(element, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  });
});
