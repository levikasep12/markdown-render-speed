const escapeHtml = (s) => s.replace(/[&<>"']/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
const escapeHref = (s) => s.replace(/&(?!(?:#\d+|#x[\da-f]+|[A-Za-z][A-Za-z0-9]+);)/gi, '&amp;').replace(/[<>"']/g, c => c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
const entity = /&(?:#(?:[0-9]+|[xX][0-9a-fA-F]+)|[A-Za-z][A-Za-z0-9]*);/y;
const punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
const entities = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", copy:'©', reg:'®', nbsp:'\u00a0', mdash:'—', ndash:'–', hellip:'…', trade:'™', laquo:'«', raquo:'»', lsquo:'‘', rsquo:'’', ldquo:'“', rdquo:'”', euro:'€', pound:'£', yen:'¥', cent:'¢', sect:'§', para:'¶', times:'×', divide:'÷', plusmn:'±', deg:'°', micro:'µ', bull:'•', middot:'·', acute:'´', uml:'¨', not:'¬' };
function decodeEntity(s) { const b=s.slice(1,-1); if (b[0]==='#') { const h=b[1]==='x'||b[1]==='X'; let n=Number.parseInt(b.slice(h?2:1),h?16:10); if(!n||(n>=0xd800&&n<=0xdfff)) return '\uFFFD'; if(n>0x10ffff)return s; return String.fromCodePoint(n); } return Object.prototype.hasOwnProperty.call(entities,b)?entities[b]:s; }

function inline(src, refs, depth = 0, noAuto = false) {
  if (depth > 12) return escapeHtml(src);
  const emphasis = emphasisPairs(src, refs);
  let out = '', plain = '';
  const flush = () => { if (plain) { out += escapeHtml(plain); plain = ''; } };
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length) {
      if (src[i + 1] === '\n') { flush(); out += '<br>'; i += 2; while(src[i]===' ')i++; continue; }
      if (punctuation.includes(src[i + 1])) { plain += src[i + 1]; i += 2; continue; }
    }
    if (c === '&') { entity.lastIndex = i; const m = entity.exec(src); if (m) { if(m[0][1]==='#') plain += decodeEntity(m[0]); else { flush(); out += m[0]; } i += m[0].length; continue; } }
    if (c === '`') {
      let n = 1; while (src[i + n] === '`') n++;
      const mark = '`'.repeat(n); let end = i + n;
      while ((end = src.indexOf(mark, end)) >= 0 && (src[end - 1] === '`' || src[end + n] === '`')) end += n;
      if (end >= 0) { flush(); let code = src.slice(i + n, end).replace(/\n/g, ' '); if (/^ .* $/.test(code) && /[^ ]/.test(code)) code = code.slice(1, -1); out += '<code>' + escapeHtml(code) + '</code>'; i = end + n; continue; }
      plain += mark; i += n; continue;
    }
    if (c === '<') {
      const tagEnd = findTagEnd(src, i);
      if (tagEnd >= 0 && /^(?:<\/?[A-Za-z]|<!--|<\?|<![A-Z])/.test(src.slice(i, tagEnd + 1))) { flush(); out += src.slice(i, tagEnd + 1); i = tagEnd + 1; continue; }
      const m = /^(?:<([A-Za-z][A-Za-z0-9.+-]{1,31}:[^ <>]*)>|<([A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>|(<!--(?:.|\n)*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![A-Z][\s\S]*?>))/.exec(src.slice(i));
      if (m) { flush(); if (m[1]) out += `<a href="${escapeHref(cleanAutolink(m[1]))}">${escapeHtml(m[1])}</a>`; else if (m[2]) out += `<a href="mailto:${escapeHtml(m[2])}">${escapeHtml(m[2])}</a>`; else out += m[3]; i += m[0].length; continue; }
    }
    if (c === '[' || (c === '!' && src[i + 1] === '[')) {
      const image = c === '!', start = i + (image ? 2 : 1), close = findClose(src, start, '[', ']');
      if (close >= 0) {
        const label = src.slice(start, close), after = close + 1;
        let dest = null, title = '';
        const nestedLink = !image && containsLink(label, refs);
        if (!nestedLink && src[after] === '(') {
          const par = findClose(src, after + 1, '(', ')');
          if (par >= 0) { const d = parseDestination(src.slice(after + 1, par)); if (d) { dest = d.href; title = d.title; i = par + 1; } }
        }
        if (dest === null && !nestedLink) {
          let end = after, ref = '';
          if (src[end] === '[') { const r = findClose(src, end + 1, '[', ']'); if (r >= 0) { ref = src.slice(end + 1, r) || label; end = r + 1; } else ref = label; }
          else ref = label;
          const def = refs.get(normalize(ref));
          if (def) { dest = def.href; title = def.title; i = end; }
        }
        if (dest !== null) { flush(); const t = title ? ` title="${escapeHref(title)}"` : ''; if (image) { const alt=inline(label,refs,depth+1).replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g,'$1').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); out += `<img src="${escapeHref(dest)}" alt="${escapeHtml(alt)}"${t}>`; } else out += `<a href="${escapeHref(dest)}"${t}>${inline(label, refs, depth + 1, true)}</a>`; continue; }
      }
    }
    const pair = emphasis.open.get(i);
    if (pair) { const inner = src.slice(i + pair.length, pair.end); flush(); out += `<${pair.tag}>${inline(inner, refs, depth + 1, noAuto)}</${pair.tag}>`; i = pair.end + pair.closeLength; continue; }
    if (c === '\n') { const hard = / {2,}$/.exec(plain); if (hard) plain = plain.slice(0, -hard[0].length); flush(); out += hard ? '<br>' : '\n'; i++; if(hard)while(src[i]===' ')i++; continue; }
    if (noAuto && (/^https?:\/\//i.test(src.slice(i)) || /^www\./i.test(src.slice(i)))) { const m = /^(?:https?:\/\/|www\.)[^\s<>]+/i.exec(src.slice(i)); if (m) { plain += m[0]; i += m[0].length; continue; } }
    if ((src.startsWith('mailto:', i) || src.startsWith('xmpp:', i)) && (i === 0 || !/[\w.+-]/.test(src[i - 1]))) { const xmpp=src.startsWith('xmpp:',i); const m=xmpp?/^xmpp:[^\s<>/]+(?:\/[^\s<>/]+)?/i.exec(src.slice(i)):/^mailto:[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*/i.exec(src.slice(i)); if(m){let u=m[0],tail='';while(/[.,!?;:]$/.test(u)){tail=u.slice(-1)+tail;u=u.slice(0,-1);}if(!/^[-_]/.test(tail)&&!/^[-_]/.test(src[i+m[0].length]||'')){flush();out+=`<a href="${escapeHref(u)}">${escapeHtml(u)}</a>`;if(tail)out+=inline(tail,refs,depth+1);i+=m[0].length;continue;} } }
    if (/[A-Za-z0-9]/.test(c) && (i===0||!/[\w.+:-]/.test(src[i-1]))) { const e=/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/.exec(src.slice(i)); if(e&&/[A-Za-z]$/.test(e[0])&&!/[-_]/.test(src[i+e[0].length]||'')){flush();out+=`<a href="mailto:${escapeHtml(e[0])}">${escapeHtml(e[0])}</a>`;i+=e[0].length;continue;} }
    if ((/^https?:\/\//i.test(src.slice(i)) || /^www\./i.test(src.slice(i))) && (i === 0 || !/[\w@]/.test(src[i - 1]))) { const m = /^(?:https?:\/\/|www\.)[^\s<>]+/i.exec(src.slice(i)); if (m) { let u=m[0], tail=''; if(/^www\./i.test(u)&&/&[^\s]*;/.test(u)){const at=u.indexOf('&');tail=u.slice(at);u=u.slice(0,at);} while(/[.,!?;:]$/.test(u)){tail=u.slice(-1)+tail;u=u.slice(0,-1);} while(u.endsWith(')')&&(u.match(/\)/g)||[]).length>(u.match(/\(/g)||[]).length){tail=')'+tail;u=u.slice(0,-1);} if(u){flush();out+=`<a href="${escapeHtml(/^www\./i.test(u)?'http://'+u:u)}">${escapeHtml(u)}</a>`;out+=tail?inline(tail,refs,depth+1):'';i+=m[0].length;continue;} } }
    plain += c; i++;
  }
  flush();
  return out;
}

function findClose(s, from, open, close) {
  let level = 0, tick = 0;
  for (let i = from - 1; i < s.length; i++) {
    const c = s[i];
    if (c === '`') { let n = 1; while (s[i + n] === '`') n++; if (!tick) tick = n; else if (tick === n) tick = 0; i += n - 1; continue; }
    if (!tick && open === '[' && c === '<') {
      const tagEnd = findTagEnd(s, i);
      if (tagEnd >= 0) { i = tagEnd; continue; }
      const angleEnd = s.indexOf('>', i + 1);
      if (angleEnd >= 0 && /^(?:[A-Za-z][A-Za-z0-9.+-]{1,31}:|[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9.-]+\.)/.test(s.slice(i + 1, angleEnd))) { i = angleEnd; continue; }
    }
    if (!tick && open === '(' && c === '<') { while (i + 1 < s.length) { i++; if (s[i] === '\\') i++; else if (s[i] === '>') break; } continue; }
    if (tick || c === '\\') { if (c === '\\') i++; continue; }
    if (c === open) level++;
    else if (c === close && --level === 0) return i;
  }
  return -1;
}
function containsLink(s, refs) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === '`') { let n=1; while(s[i+n]==='`')n++; const end=s.indexOf('`'.repeat(n),i+n); if(end>=0){i=end+n-1;continue;} }
    if (s[i] === '<') { const end=findTagEnd(s,i); if(end>=0){i=end;continue;} }
    if (s[i] !== '[' || (i > 0 && s[i - 1] === '!')) continue;
    const close=findClose(s,i+1,'[',']'); if(close<0)continue;
    const after=close+1;
    if(s[after]==='('&&findClose(s,after+1,'(',')')>=0)return true;
    if(s[after]==='['){const end=findClose(s,after+1,'[',']');if(end>=0&&refs.has(normalize(s.slice(after+1,end)||s.slice(i+1,close))))return true;}
    else if(refs.has(normalize(s.slice(i+1,close))))return true;
    i=close;
  }
  return false;
}
function findTagEnd(s, at) { const rest=s.slice(at); if(!/^<\/?[A-Za-z][A-Za-z0-9-]*(?=[\s/>])/.test(rest)&&!/^<!--/.test(rest)&&!/^<\?[\s\S]/.test(rest)&&!/^<![A-Z]/.test(rest))return -1; let quote=''; for(let i=at+1;i<s.length;i++){const c=s[i];if(quote){if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='>'){const tag=s.slice(at,i+1);if(/^<!--|^<\?|^<![A-Z]/.test(tag))return i;if(/^<\//.test(tag))return /^<\/[A-Za-z][A-Za-z0-9-]*\s*>$/.test(tag)?i:-1;return /^<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>$/s.test(tag)?i:-1;}}return -1; }
function emphasisPairs(s, refs) {
  const runs = [];
  for (let i = 0; i < s.length;) {
    if (s[i] === '\\') { i += Math.min(2, s.length - i); continue; }
    if (s[i] === '`') {
      let n = 1; while (s[i + n] === '`') n++;
      const mark = '`'.repeat(n);
      let end = s.indexOf(mark, i + n);
      while (end >= 0 && (s[end - 1] === '`' || s[end + n] === '`')) end = s.indexOf(mark, end + n);
      i = end < 0 ? i + n : end + n;
      continue;
    }
    if (s[i] === '<') {
      const tagEnd = findTagEnd(s, i);
      if (tagEnd >= 0) { i = tagEnd + 1; continue; }
      const end = s.indexOf('>', i + 1);
      if (end >= 0 && /^(?:[A-Za-z][A-Za-z0-9.+-]{1,31}:[^ <>]*|[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.test(s.slice(i + 1, end))) { i = end + 1; continue; }
    }
    if (s[i] === '[' || (s[i] === '!' && s[i + 1] === '[')) {
      const start = i + (s[i] === '!' ? 2 : 1);
      const close = findClose(s, start, '[', ']');
      if (close >= 0) {
        const label = s.slice(start, close), after = close + 1;
        if (s[after] === '(') {
          const end = findClose(s, after + 1, '(', ')');
          if (end >= 0 && !containsLink(s.slice(i + 1, close), refs)) { i = end + 1; continue; }
        }
        let ref = label;
        if (s[after] === '[') {
          const end = findClose(s, after + 1, '[', ']');
          if (end >= 0) { ref = s.slice(after + 1, end) || label; if (refs.has(normalize(ref)) && !containsLink(label, refs)) { i = end + 1; continue; } }
        } else if (refs.has(normalize(ref)) && !containsLink(label, refs)) { i = after; continue; }
      }
    }
    const c = s[i];
    if (c !== '*' && c !== '_' && c !== '~') { i++; continue; }
    let end = i + 1; while (s[end] === c) end++;
    const before = s[i - 1] || '\n', after = s[end] || '\n';
    const beforeSpace = /\s/u.test(before), afterSpace = /\s/u.test(after);
    const beforePunct = punctuationChar(before), afterPunct = punctuationChar(after);
    const left = !afterSpace && (!afterPunct || beforeSpace || beforePunct);
    const right = !beforeSpace && (!beforePunct || afterSpace || afterPunct);
    const open = c === '_' ? left && (!/[\p{L}\p{N}]/u.test(before)) : left;
    const close = c === '_' ? right && (!/[\p{L}\p{N}]/u.test(after)) : right;
    runs.push({ c, start: i, length: end - i, originalLength: end - i, remaining: end - i, consumed: 0, open, close });
    i = end;
  }
  const stack = [];
  const pairs = new Map();
  for (const run of runs) {
    if (run.close) {
      while (run.remaining) {
        let at = stack.length - 1;
        while (at >= 0) {
          const op = stack[at];
          if (op.c === run.c && op.open && op.remaining) {
            const ruleOfThree = op.close || run.open;
            if (!(ruleOfThree && (op.originalLength + run.originalLength) % 3 === 0 && (op.originalLength % 3 !== 0 || run.originalLength % 3 !== 0))) break;
          }
          at--;
        }
        if (at < 0) break;
        const op = stack[at];
        const amount = run.c === '~' ? (op.originalLength === 1 && run.originalLength === 1 ? 1 : op.originalLength === 2 && run.originalLength === 2 ? 2 : 0) : (op.remaining >= 2 && run.remaining >= 2 ? 2 : 1);
        if (!amount) break;
        const openAt = op.start + op.remaining - amount;
        const closeAt = run.start + run.consumed;
        pairs.set(openAt, { tag: run.c === '~' ? 'del' : amount === 2 ? 'strong' : 'em', length: amount, end: closeAt, closeLength: amount });
        op.remaining -= amount;
        run.remaining -= amount;
        run.consumed += amount;
        stack.splice(at + 1);
        while (stack.length && !stack[stack.length - 1].remaining) stack.pop();
      }
    }
    if (run.open && run.remaining) stack.push(run);
  }
  return { open: pairs };
}

function findEmphasisEnd(s, from, marker, ch) {
  for (let i = from; i < s.length;) {
    if(s[i]==='`'){let n=1;while(s[i+n]==='`')n++;const run='`'.repeat(n);let close=s.indexOf(run,i+n);while(close>=0&&(s[close-1]==='`'||s[close+n]==='`'))close=s.indexOf(run,close+n);if(close>=0){i=close+n;continue;}i+=n;continue;}
    if(s[i]!==ch){i++;continue;}
    const start=i;while(s[i]===ch)i++;const run=i-start;
    if(run===marker.length&&s[start-1]!=='\\'&&canClose(s,start,ch))return start;
  }
  return -1;
}
function punctuationChar(c) { return !!c && !/[\p{L}\p{N}\s]/u.test(c); }
function canOpen(s,i,c) { const before=s[i-1]||'\n',after=s[i+1]||'\n'; const left=!/\s/u.test(after)&&(!punctuationChar(after)||/\s/u.test(before)||punctuationChar(before)); return c==='_'?left&&(!/[\p{L}\p{N}]/u.test(before)):left; }
function canClose(s,i,c) { const before=s[i-1]||'\n',after=s[i+1]||'\n'; const right=!/\s/u.test(before)&&(!punctuationChar(before)||/\s/u.test(after)||punctuationChar(after)); return c==='_'?right&&(!/[\p{L}\p{N}]/u.test(after)):right; }
function normalize(s) { return s.trim().replace(/[\t\n ]+/g, ' ').toLowerCase().replace(/[\u00df\u1e9e]/g, 'ss'); }
function parseDestination(s) {
  s = s.trim(); if (!s) return { href: '', title: '' };
  let dest = '', rest = '';
  if (s[0] === '<') { let e = 1; for (; e < s.length; e++) { if (s[e] === '\\') e++; else if (s[e] === '>') break; } if (e >= s.length || /\n/.test(s.slice(0, e))) return null; dest = s.slice(1, e); rest = s.slice(e + 1).trim(); }
  else { let i = 0, nest = 0; for (; i < s.length; i++) { if (s[i] === '\\') { i++; continue; } if (s[i] === '(') nest++; else if (s[i] === ')') { if (!nest) break; nest--; } else if (/[ \t\n]/.test(s[i]) && !nest) break; } if (nest) return null; dest = s.slice(0, i); rest = s.slice(i).trim(); }
  let title = ''; if (rest) { const q = rest[0], end = rest[rest.length - 1]; if ((q === '"' || q === "'" || q === '(') && end === (q === '(' ? ')' : q) && !((q === '"' || q === "'") && new RegExp(`(^|[^\\\\])${q}`).test(rest.slice(1, -1)))) title = rest.slice(1, -1); else return null; }
  title = title.replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, '$1').replace(/&(?:#(?:\d+|[xX][\da-fA-F]+)|[A-Za-z][A-Za-z0-9]+);/g, decodeEntity);
  return { href: cleanHref(dest), title };
}
function cleanHref(s) { return encodeURI(s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, '$1')).replace(/%25/gi, '%').replace(/\[/g, '%5B').replace(/\]/g, '%5D').replace(/\\/g, '%5C'); }
function cleanAutolink(s) { return encodeURI(s).replace(/%25/gi, '%').replace(/\[/g, '%5B').replace(/\]/g, '%5D').replace(/\\/g, '%5C'); }
function hasUnescapedOpenBracket(s) { for(let i=0;i<s.length;i++){if(s[i]==='\\'){i++;continue;}if(s[i]==='[')return true;}return false; }

function parseBlocks(markdown, refs) {
  let text = markdown.replace(/\r\n?/g, '\n').replace(/\0/g, '\uFFFD');
  if (!text.endsWith('\n')) text += '\n';
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length - 1;) {
    const line = lines[i], trim = line.trim();
    if (!trim) { i++; continue; }
    const def = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(?!<)(\S+))(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/.exec(line);
    if (def && !hasUnescapedOpenBracket(def[1]) && normalize(def[1])) { refs.set(normalize(def[1]), { href: cleanHref(def[2] || def[3]), title: def[4] || def[5] || def[6] || '' }); i++; continue; }
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) { const indent=line.length-line.trimStart().length, mark = fence[1], ch = mark[0], n = mark.length, info = fence[2].trim().split(/[ \t]/)[0].replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, '$1'); let code = []; i++; while (i < lines.length - 1 && !new RegExp(`^ {0,3}${ch}{${n},}\\s*$`).test(lines[i])) { code.push(lines[i].slice(Math.min(indent, lines[i].match(/^ */)[0].length))); i++; } if (i < lines.length - 1) i++; if (code.length && !code[code.length - 1]) code.pop(); const cls = info ? ` class="language-${escapeHref(info)}"` : ''; out.push(`<pre><code${cls}>${escapeHtml(code.join('\n') + (code.length ? '\n' : ''))}</code></pre>\n`); continue; }
    const atx = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/.exec(line);
    if (atx) { const title = atx[2].replace(/[ \t]+#+[ \t]*$/, '').replace(/^#+[ \t]*$/, '').trim(); out.push(`<h${atx[1].length}>${inline(title, refs)}</h${atx[1].length}>\n`); i++; continue; }
    if (/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line)) { out.push('<hr>\n'); i++; continue; }
    if (/^ {0,3}>/.test(line)) {
      const q = [];
      let lazy = false;
      let quoteFence = false;
      while (i < lines.length - 1) {
        if (/^ {0,3}>/.test(lines[i])) {
          let content = lines[i++].replace(/^ {0,3}> ?/, '');
          if (content.startsWith('\t\t')) content = '      ' + content.slice(2);
          q.push(content && !content.trim() ? (q.some(part => part.trim()) ? '\uE000' : '') : content);
          const fenceLine = /^ {0,3}(`{3,}|~{3,})/.test(content);
          if (fenceLine) quoteFence = !quoteFence;
          lazy = !quoteFence && !!content.trim() && indentColumns(content) < 4 && !/^ {0,3}(?:#{1,6}(?:\s|$)|[-+*][ \t]+|\d{1,9}[.)][ \t]+|```|~~~)/.test(content);
        } else if (lazy && lines[i].trim() && (!isBlockStart(lines, i) || indentColumns(lines[i]) >= 4)) {
          const continuation = indentColumns(lines[i]) >= 4 ? stripIndent(lines[i], 4) : lines[i];
          q.push(/^(?:=+|-+)\s*$/.test(continuation) ? '    ' + continuation : '\uE001' + continuation);
          i++;
        } else break;
      }
      let inner = parseBlocks(q.join('\n') + '\n', refs).replace(/\uE000/g, ' ').replace(/\uE001/g, '');
      if (/^ {0,3}<(?:address|article|aside|blockquote|body|caption|center|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|li|link|main|menu|nav|ol|optgroup|option|p|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|ul)\b/i.test(q[0] || '') && inner.endsWith('\n')) inner = inner.slice(0, -1);
      out.push('<blockquote>\n' + inner + '</blockquote>\n');
      continue;
    }
    if (indented(line)) {
      const code = [];
      while (i < lines.length - 1) {
        if (indented(lines[i])) { code.push(stripIndent(lines[i++], 4)); continue; }
        if (!lines[i].trim()) {
          let j = i;
          while (j < lines.length - 1 && !lines[j].trim()) j++;
          if (j < lines.length - 1 && indented(lines[j])) { while (i < j) { code.push(''); i++; } continue; }
        }
        break;
      }
      while (code.length && !code[code.length - 1]) code.pop();
      out.push(`<pre><code>${escapeHtml(code.join('\n') + '\n')}</code></pre>\n`);
      continue;
    }
    if (/^(?: {0,3}<!--| {0,3}<\?| {0,3}<![A-Z]| {0,3}<!\[CDATA\[| {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|pre|search|section|style|summary|table|tbody|td|textarea|tfoot|th|thead|title|tr|track|ul|script)(?:\s|>|\/|$))/i.test(line)) { const raw = []; const first = line.trimStart(); const type1 = /^<(script|style|pre|textarea)\b/i.test(first); let end = first.startsWith('<!--') ? '-->' : first.startsWith('<?') ? '?>' : /^<!\[CDATA\[/i.test(first) ? ']]>' : /^<![A-Z]/.test(first) ? '>' : type1 ? `</${/^<(script|style|pre|textarea)\b/i.exec(first)[1].toLowerCase()}>` : null; let stoppedAtBlank = false; while (i < lines.length - 1) { if (!end && !lines[i].trim()) { stoppedAtBlank = true; break; } const l = lines[i++]; raw.push(l); if (end && l.toLowerCase().includes(end)) break; } const blankAfter = i < lines.length - 1 && !lines[i].trim(); out.push(raw.join('\n') + (stoppedAtBlank || blankAfter ? '' : '\n')); continue; }
    const tagOffset = line.search(/\S/);
    const tagEnd = tagOffset >= 0 ? findTagEnd(line, tagOffset) : -1;
    if (tagOffset >= 0 && tagOffset <= 3 && line[tagOffset] === '<' && /^<\/?[A-Za-z]/.test(line.slice(tagOffset)) && tagEnd === line.trimEnd().length - 1) {
      const raw = [];
      while (i < lines.length - 1 && lines[i].trim()) raw.push(lines[i++]);
      const atEnd = i >= lines.length - 1;
      out.push(raw.join('\n') + (atEnd ? '\n' : ''));
      continue;
    }
    if (i + 1 < lines.length - 1 && !/^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:[ \t]+.*)?$/.test(line) && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1])) { const level = lines[i + 1].trim()[0] === '=' ? 1 : 2; out.push(`<h${level}>${inline(trim, refs)}</h${level}>\n`); i += 2; continue; }
    if (i + 1 < lines.length - 1 && line.includes('|') && isTableDelimiter(lines[i + 1]) && splitTableRow(line).length===splitTableRow(lines[i+1]).length) {
      const heads = splitTableRow(line), aligns = splitTableRow(lines[i + 1]);
      const alignAttr = k => aligns[k]?.startsWith(':') ? ` align="${aligns[k].endsWith(':') ? 'center' : 'left'}"` : aligns[k]?.endsWith(':') ? ' align="right"' : '';
      const rows = [];
      i += 2;
      while (i < lines.length - 1 && lines[i].trim() && !/^ {0,3}>/.test(lines[i])) rows.push(splitTableRow(lines[i++]));
      out.push('<table>\n<thead>\n<tr>\n' + heads.map((x, k) => `<th${alignAttr(k)}>${inline(x, refs)}</th>\n`).join('') + '</tr>\n</thead>\n');
      if (rows.length) out.push('<tbody>' + rows.map(cells => '<tr>\n' + heads.map((_, k) => `<td${alignAttr(k)}>${inline(cells[k] || '', refs)}</td>\n`).join('') + '</tr>\n').join('') + '</tbody>');
      out.push('</table>\n');
      continue;
    }
    const list = /^ {0,3}([-+*]|\d{1,9}[.)])(?:[ \t]+(.*)|$)/.exec(line);
    if (list) {
      const ordered = /^\d/.test(list[1]);
      const tag = ordered ? 'ol' : 'ul';
      const delim = ordered ? list[1].slice(-1) : list[1];
      const start = ordered ? Number.parseInt(list[1], 10) : 1;
      const items = [];
      let loose = false;
      while (i < lines.length - 1) {
        if (/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(lines[i])) break;
        const m = /^ {0,3}([-+*]|\d{1,9}[.)])(?:[ \t]+(.*)|$)/.exec(lines[i]);
        if (!m || /^\d/.test(m[1]) !== ordered || (ordered ? m[1].slice(-1) : m[1]) !== delim) break;
        const lead = lines[i].length - lines[i].trimStart().length;
        const marker = m[1].length;
        let wsEnd = lead + marker, wsColumn = wsEnd;
        while (lines[i][wsEnd] === ' ' || lines[i][wsEnd] === '\t') { wsColumn += lines[i][wsEnd] === '\t' ? 4 - wsColumn % 4 : 1; wsEnd++; }
        const spacing = wsColumn - (lead + marker) || 1;
        const indentedFirst = !!m[2] && spacing > 4;
        const contentIndent = lead + marker + (m[2] ? (indentedFirst ? 1 : Math.min(spacing, 4)) : 1);
        const body = [(indentedFirst ? ' '.repeat(spacing - 1) : '') + (m[2] || '')];
        i++;
        while (i < lines.length - 1) {
          if (indentColumns(lines[i]) >= contentIndent) {
            body.push(stripIndent(lines[i++], contentIndent));
            continue;
          }
          if (body.length && body[body.length - 1].trim() && lines[i].trim() && (!isBlockStart(lines, i) || /^ {0,3}>/.test(lines[i])) && !/^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:[ \t]+.*|$)/.test(lines[i])) {
            body.push(lines[i++]);
            continue;
          }
          if (!lines[i].trim()) {
            let j = i + 1;
            while (j < lines.length - 1 && !lines[j].trim()) j++;
            if (body.some(part => part.trim()) && j < lines.length - 1 && indentColumns(lines[j]) >= contentIndent) {
              loose = true;
              body.push('');
              i++;
              continue;
            }
          }
          break;
        }
        const task = /^\[([ xX])\][ \t]+/.exec(body[0]);
        items.push({ body, task });
        if (i < lines.length - 1 && !lines[i].trim()) {
          let j = i;
          while (j < lines.length - 1 && !lines[j].trim()) j++;
          const next = j < lines.length - 1 ? /^ {0,3}([-+*]|\d{1,9}[.)])(?:[ \t]+.*|$)/.exec(lines[j]) : null;
          if (next && /^\d/.test(next[1]) === ordered && (ordered ? next[1].slice(-1) : next[1]) === delim) {
            loose = true;
            i = j;
            continue;
          }
          break;
        }
      }
      const rendered = items.map(({ body, task }) => {
        if (task) body[0] = body[0].replace(/^\[[ xX]\][ \t]+/, '');
        let inner = parseBlocks(body.join('\n') + '\n', refs);
        if (!loose) inner = inner.replace(/^<p>([\s\S]*?)<\/p>\n/g, '$1').replace(/\n(?=<p>)/g, '\n').replace(/\n(?=<(?:ul|ol|pre|blockquote|table|h[1-6])(?:\s|>))/g, '');
        let checkbox = task ? `<input${task[1].toLowerCase() === 'x' ? ' checked=""' : ''} disabled="" type="checkbox"> ` : '';
        if (checkbox && loose && inner.startsWith('<p>')) { inner = inner.replace(/^<p>/, `<p>${checkbox}`); checkbox = ''; }
        const blockContent = /<(?:p|ul|ol|pre|blockquote|table|hr|h[1-6])(?:\s|>)/.test(inner);
        const bodyBreak = (loose || blockContent) && (inner.length > 0 || checkbox);
        return `<li>${checkbox}${inner.trimEnd()}${bodyBreak ? '\n' : ''}</li>\n`;
      }).join('');
      const attrs = ordered && start !== 1 ? ` start="${start}"` : '';
      out.push(`<${tag}${attrs}>\n${rendered}</${tag}>\n`);
      continue;
    }
    const para = [line]; i++;
    while (i < lines.length - 1 && lines[i].trim() && !/^ {0,3}(?:=+|-+)\s*$/.test(lines[i]) && (!isBlockStart(lines, i) || (/^ {0,3}<\/pre\s*>/i.test(lines[i]) && out.join('').toLowerCase().lastIndexOf('<pre') > out.join('').toLowerCase().lastIndexOf('</pre')))) para.push(lines[i++]);
    if (i < lines.length - 1 && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i])) { const level=lines[i].trim()[0]==='='?1:2; out.push(`<h${level}>${inline(para.join('\n').trim(),refs)}</h${level}>\n`); i++; }
    else out.push(`<p>${inline(para.join('\n'), refs)}</p>\n`);
  }
  return out.join('');
}
function indentColumns(s) { let col=0; for(let i=0;i<s.length;i++){if(s[i]===' ')col++;else if(s[i]==='\t')col+=4-col%4;else break;} return col; }
function indented(s) { return indentColumns(s)>=4; }
function stripIndent(s,target) { let col=0,i=0,out='';while(i<s.length&&(s[i]===' '||s[i]==='\t')){const next=s[i]===' ' ? col+1 : col+4-col%4;if(next>target)out+=' '.repeat(next-Math.max(col,target));col=next;i++;}return out+s.slice(i); }
function splitTableRow(line) { let s=line.trim(); if(s.startsWith('|'))s=s.slice(1); if(s.endsWith('|')&&!s.endsWith('\\|'))s=s.slice(0,-1); const cells=[];let start=0,ticks=0;for(let i=0;i<s.length;i++){if(s[i]==='\\'){i++;continue;}if(s[i]==='`'){let n=1;while(s[i+n]==='`')n++;if(!ticks)ticks=n;else if(ticks===n)ticks=0;i+=n-1;continue;}if(s[i]==='|'&&!ticks){cells.push(s.slice(start,i).trim().replace(/\\\|/g,'|'));start=i+1;}}cells.push(s.slice(start).trim().replace(/\\\|/g,'|'));return cells; }
function isTableDelimiter(line) { const cells=splitTableRow(line);return cells.length>0&&cells.every(c=>/^:?-+:?$/.test(c)); }
function isBlockStart(lines,i) { const s=lines[i]; return /^ {0,3}(?:#{1,6}(?:\s|$)|>|```|~~~|([-+*])\s+|1[.)]\s+|(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|<\/?(?:div|table|details|pre|script|style|p|ul|ol|li|hr|h[1-6]|thead|tbody|tfoot|tr|td|th|caption|col|colgroup)\b)/i.test(s); }

export function parse(markdown) {
  const refs = new Map();
  const rawSource = String(markdown);
  let source = rawSource.replace(/\r\n?/g, '\n');
  const lines=source.split('\n');
  let fenceChar = '', fenceSize = 0;
  for(let i=0;i<lines.length;i++){
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]);
    if (fenceChar) { if (new RegExp(`^ {0,3}${fenceChar}{${fenceSize},}\\s*$`).test(lines[i])) fenceChar = ''; continue; }
    if (fence) { fenceChar = fence[1][0]; fenceSize = fence[1].length; continue; }
    const quotedLine = lines[i].replace(/^(?: {0,3}>[ \t]?)+/, '');
    let m = /^ {0,3}\[((?:\\.|[^\]])+)\]:[ \t]*(.*)$/.exec(quotedLine);
    let label = m?.[1];
    let value = m?.[2];
    let defEnd = i;
    if (!m) {
      const first = /^ {0,3}\[((?:\\.|[^\]])*)$/.exec(quotedLine);
      if (first) {
        let combined = first[1];
        for (let j = i + 1; j < lines.length && j <= i + 5 && lines[j].trim(); j++) {
          combined += '\n' + lines[j];
          const end = /^((?:\\.|[^\]])*)\]:[ \t]*(.*)$/.exec(combined);
          if (end) { label = end[1]; value = end[2]; defEnd = j; break; }
        }
      }
    }
    if(label === undefined || hasUnescapedOpenBracket(label) || !normalize(label) || (i > 0 && lines[i - 1].trim() && !/^ {0,3}(?:>|#{1,6}(?:\s|$)|[-+*][ \t]+|\d{1,9}[.)][ \t]+|```|~~~)/.test(lines[i - 1])))continue;
    const start=i;
    if(!value&&i+1<lines.length&&lines[i+1].trim()){value=lines[++i].trim();}
    const d=/^(?:<([^>]*)>|(\S+))(.*)$/.exec(value);if(!d || (d[3] && !/^[ \t]/.test(d[3]))){i=start;continue;}
    let rest=d[3].trim(),title='';
    if(!rest&&i+1<lines.length&&lines[i+1].trim()&&/^[ \t]*["'(]/.test(lines[i+1]))rest=lines[++i].trim();
    if(rest){const q=rest[0],close=q==='('?')':q;if((q==='"'||q==="'"||q==='(')&&rest.indexOf(close,1)<0){let titleText=rest.slice(1);let valid=true;while(i+1<lines.length&&lines[i+1].trim()){titleText+='\n'+lines[++i];if(lines[i].includes(close))break;}if(!titleText.includes(close))valid=false;if(!valid){i=start;continue;}rest=q+titleText;}
      const t=/^(?:"([\s\S]*)"|'([\s\S]*)'|\(([\s\S]*)\))$/.exec(rest);if(t)title=t[1]??t[2]??t[3]??'';else{i=start;continue;}}
    if(!refs.has(normalize(label)))refs.set(normalize(label),{href:cleanHref(d[1]??d[2]),title:title.replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, '$1')});
    if (quotedLine === lines[start]) for(let j=start;j<=Math.max(i, defEnd);j++)lines[j]='';
  }
  let html = parseBlocks(lines.join('\n'), refs);
  const lastLine = rawSource.replace(/\r\n?/g, '\n').split('\n').at(-1) || '';
  if (!/[\r\n]$/.test(rawSource) && /^ {0,3}<\//.test(lastLine) && html.endsWith('\n')) html = html.slice(0, -1);
  return html;
}
