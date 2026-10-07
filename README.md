# Bilevel optimization with a piecewise-linear follower — numerical study

This repository hosts the website with the numerical results of our work on
mixed-integer linear bilevel problems whose follower minimizes a
piecewise-linear objective:

**<https://simstevens.github.io/pwl-bilevel-numerical-study/>**

The site presents the benchmark instance sets, the run settings, and all
results, with interactive charts, an instance explorer, and downloads of the
data, instances, and solution vectors.

The code of the solution approaches and of this study will be made available
once the preprint is published.

## Contents

- `site/`: the published website. It is generated and must not be edited by
  hand. `site/publication-manifest.json` names the release and its build
  date, and lists every file with its size and SHA-256 checksum.
- `.github/workflows/pages.yml`: publishes `site/` to GitHub Pages on every
  push to `main`. It builds nothing.

The site works offline and on any static file server, for example:

```sh
python3 -m http.server --directory site
```

## License

Data, instances, results, text and figures are distributed under CC BY-SA 4.0;
the instances are derived from [BOBILib](https://bobilib.org). The website's
own scripts and style sheets are distributed under the MIT license. See
`LICENSE-DATA.md` and `LICENSE`.
