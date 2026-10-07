# Data and content license

Everything in `site/` except its scripts and style sheets is distributed under
[Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
This covers:

- the bilevel instances in `site/study/downloads/<set>/instances.zip`, which
  are derived from BOBILib instances by adding piecewise-linear follower
  objectives, relaxing follower integrality, or relaxing leader integrality;
- the benchmark results: the chart data in `site/study/data/` and the overview
  tables in `site/study/downloads/<set>/overview.csv` and `overview.json`;
- the text and figures of the website, including the TikZ figures in
  `site/study/tikz/`.

The instances keep the license of their sources: BOBILib states that "all
instances are licensed under the Creative Commons CC BY-SA 4.0 license"
(<https://bobilib.org/documentation.html>).

**Attribution.** When you use the instances, please cite BOBILib:
J. Thürauf, T. Kleinert, I. Ljubić, T. Ralphs, and M. Schmidt. BOBILib:
Bilevel Optimization (Benchmark) Instance Library. *Mathematical Programming
Computation*, 2026. <https://doi.org/10.1007/s12532-025-00294-y>.
Library: <https://bobilib.org>.

**Other licenses.** The website's own scripts and style sheets
(`site/assets/*.js`, `site/assets/study.css`) are distributed under the MIT
license (`LICENSE`). The bundled libraries keep their own licenses:
KaTeX (MIT, `site/assets/vendor/katex/LICENSE`); Vega, Vega-Lite and
Vega-Embed (BSD-3-Clause, `site/assets/vendor/vega/LICENSE-*`); jsPDF and
svg2pdf.js (MIT, `site/assets/vendor/pdf/LICENSE-jspdf`, `LICENSE-svg2pdf`);
and the DejaVu Sans font (Bitstream Vera / DejaVu license,
`site/assets/vendor/pdf/LICENSE-dejavu`). The theme
files in `site/assets/javascripts/` and `site/assets/stylesheets/` come from
Material for MkDocs (MIT).
