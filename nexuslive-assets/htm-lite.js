/* htm-lite: small htm-compatible tagged-template parser (htm.bind(h)). Self-hosted so the page has no third-party script dependency. */
(function () {
  function parse(S, V, h) {
    var toks = [];
    S.forEach(function (s, i) { for (var k = 0; k < s.length; k++) toks.push({ c: s[k] }); if (i < V.length) toks.push({ v: V[i], isv: true }); });
    var stack = [{ tag: null, props: null, kids: [] }], cur = stack[0], i = 0, n = toks.length, text = "";
    function isV(t) { return t && t.isv; }
    function flush() { if (text) { var tx = text; if (/\n/.test(tx)) tx = tx.replace(/^\s*\n\s*|\s*\n\s*$/g, "").replace(/\s*\n\s*/g, " "); if (tx) cur.kids.push(tx); text = ""; } }
    function mk(f) { return h.apply(null, [f.tag, f.props && Object.keys(f.props).length ? f.props : null].concat(f.kids)); }
    while (i < n) {
      var t = toks[i];
      if (isV(t)) { flush(); cur.kids.push(t.v); i++; continue; }
      if (t.c === "<") {
        flush();
        if (toks[i + 1] && toks[i + 1].c === "/") { while (isV(toks[i]) || toks[i].c !== ">") i++; i++; var done = stack.pop(); cur = stack[stack.length - 1]; cur.kids.push(mk(done)); continue; }
        i++;
        var tag;
        if (isV(toks[i])) { tag = toks[i].v; i++; } else { var nm = ""; while (!isV(toks[i]) && !/[\s>\/]/.test(toks[i].c)) { nm += toks[i].c; i++; } tag = nm; }
        var props = {}, self = false;
        for (;;) {
          while (!isV(toks[i]) && /\s/.test(toks[i].c)) i++;
          var tt = toks[i];
          if (!isV(tt) && tt.c === ">") { i++; break; }
          if (!isV(tt) && tt.c === "/") { i++; if (toks[i].c === ">") { i++; self = true; break; } continue; }
          if (!isV(tt) && tt.c === "." && toks[i + 1].c === "." && toks[i + 2].c === ".") { i += 3; Object.assign(props, toks[i].v); i++; continue; }
          var an = ""; while (!isV(toks[i]) && !/[\s=>\/]/.test(toks[i].c)) { an += toks[i].c; i++; }
          if (!isV(toks[i]) && toks[i].c === "=") {
            i++; var vt = toks[i];
            if (isV(vt)) { props[an] = vt.v; i++; }
            else if (vt.c === '"' || vt.c === "'") { var q = vt.c, sv = ""; i++; while (isV(toks[i]) || toks[i].c !== q) { sv += isV(toks[i]) ? String(toks[i].v) : toks[i].c; i++; } i++; props[an] = sv; }
            else { var uv = ""; while (!isV(toks[i]) && !/[\s>]/.test(toks[i].c)) { uv += toks[i].c; i++; } props[an] = uv; }
          } else props[an] = true;
        }
        var fr = { tag: tag, props: props, kids: [] };
        if (self) cur.kids.push(mk(fr)); else { stack.push(fr); cur = fr; }
        continue;
      }
      text += t.c; i++;
    }
    flush();
    return stack[0].kids.length === 1 ? stack[0].kids[0] : stack[0].kids;
  }
  window.htm = { bind: function (h) { return function (S) { return parse(S, [].slice.call(arguments, 1), h); }; } };
})();
