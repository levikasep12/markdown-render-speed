# markdown-render-speed

[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/levikasep12/markdown-render-speed/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/levikasep12/markdown-render-speed/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

This repository contains an experimental, dependency-free Markdown renderer in `parse.js` and a small Node driver in `main.ts`. Each parse builds its reference definitions locally and scans block and inline Markdown, including GFM tables, task lists, strikethrough, and autolinks. The driver reads `cases.json` from `MAKEFUN_INPUT_DIR` (default `/input`) and writes the rendered array to `MAKEFUN_OUTPUT_DIR/html.json` (default `/output`).

Run locally with:

```sh
MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=output node main.ts
```
