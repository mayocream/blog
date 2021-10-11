---
title: About
date: "2021-09-21"
---

## Mayo

<canvas id="year" style="width: 16px" width="32" height="32"></canvas><noscript>17</noscript> y/o.
<script type="module">
  const year = new Date().getFullYear().toString().substr(-2)
  const ctx = document.getElementById('year').getContext('2d')
  ctx.font = '32px serif'
  ctx.fillText(year, 0, 32)
</script>  

Infrastructure Engineer.

Email: [mayo@shoujo.io](mailto:mayo@shoujo.io)

License: [Creative Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/)
