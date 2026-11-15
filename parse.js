const escapeHtml = (s) => s.replace(/[&<>"']/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
const entity = /&(?:#(?:[0-9]+|[xX][0-9a-fA-F]+)|[A-Za-z][A-Za-z0-9]+);/y;
const punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
const entities = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", copy:'©', reg:'®', nbsp:'\u00a0', mdash:'—', ndash:'–', hellip:'…', trade:'™', laquo:'«', raquo:'»', lsquo:'‘', rsquo:'’', ldquo:'“', rdquo:'”', euro:'€', pound:'£', yen:'¥', cent:'¢', sect:'§', para:'¶', times:'×', divide:'÷', plusmn:'±', deg:'°', micro:'µ', bull:'•', middot:'·', acute:'´', uml:'¨', not:'¬' };
function decodeEntity(s) { const b=s.slice(1,-1); if (b[0]==='#') { const h=b[1]==='x'||b[1]==='X'; let n=Number.parseInt(b.slice(h?2:1),h?16:10); if(!n||n>0x10ffff||(n>=0xd800&&n<=0xdfff)) return s; return String.fromCodePoint(n); } return Object.prototype.hasOwnProperty.call(entities,b)?entities[b]:s; }

function inline(src, refs, depth = 0) {
  if (depth > 12) return escapeHtml(src);
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
    }
    if (c === '<') {
      const tagEnd = findTagEnd(src, i);
      if (tagEnd >= 0 && /^(?:<\/?[A-Za-z]|<!--|<\?|<![A-Z])/.test(src.slice(i, tagEnd + 1))) { flush(); out += src.slice(i, tagEnd + 1); i = tagEnd + 1; continue; }
      const m = /^(?:<([A-Za-z][A-Za-z0-9.+-]{1,31}:[^ <>]*)>|<([A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>|(<!--(?:.|\n)*?-->|<\?[\s\S]*?\?>|<![A-Z][\s\S]*?>))/.exec(src.slice(i));
      if (m) { flush(); if (m[1]) out += `<a href="${escapeHtml(m[1].replace(/\\/g,'%5C'))}">${escapeHtml(m[1])}</a>`; else if (m[2]) out += `<a href="mailto:${escapeHtml(m[2])}">${escapeHtml(m[2])}</a>`; else out += m[3]; i += m[0].length; continue; }
    }
    if (c === '[' || (c === '!' && src[i + 1] === '[')) {
      const image = c === '!', start = i + (image ? 2 : 1), close = findClose(src, start, '[', ']');
      if (close >= 0) {
        const label = src.slice(start, close), after = close + 1;
        let dest = null, title = '';
        if (src[after] === '(') {
          const par = findClose(src, after + 1, '(', ')');
          if (par >= 0) { const d = parseDestination(src.slice(after + 1, par)); if (d) { dest = d.href; title = d.title; i = par + 1; } }
        }
        if (dest === null) {
          let end = after, ref = '';
          if (src[end] === '[') { const r = findClose(src, end + 1, '[', ']'); if (r >= 0) { ref = src.slice(end + 1, r) || label; end = r + 1; } else ref = label; }
          else ref = label;
          const def = refs.get(normalize(ref));
          if (def) { dest = def.href; title = def.title; i = end; }
        }
        if (dest !== null) { flush(); const t = title ? ` title="${escapeHtml(title)}"` : ''; if (image) { const alt=inline(label,refs,depth+1).replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g,'$1').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); out += `<img src="${escapeHtml(dest)}" alt="${escapeHtml(alt)}"${t}>`; } else out += `<a href="${escapeHtml(dest)}"${t}>${inline(label, refs, depth + 1)}</a>`; continue; }
      }
    }
    if ((c === '*' || c === '_' || c === '~') && src[i + 1] === c && !(c === '~' && src[i + 2] === '~')) {
      let n = 2; while (src[i + n] === c && n < 3) n++;
      if (c !== '~' || n === 2) {
        const marker = c.repeat(n), end = canOpen(src,i,c) ? findEmphasisEnd(src, i + n, marker, c) : -1;
        if (end >= 0 && canClose(src,end,c) && src[i + n] !== ' ' && src[end - 1] !== ' ') { flush(); const tag = c === '~' ? 'del' : n === 3 ? 'em><strong' : n === 2 ? 'strong' : 'em'; if (n === 3 && c !== '~') out += '<em><strong>' + inline(src.slice(i + n, end), refs, depth + 1) + '</strong></em>'; else out += `<${tag}>${inline(src.slice(i + n, end), refs, depth + 1)}</${tag}>`; i = end + n; continue; }
      }
    }
    if (c === '~' && src[i + 1] !== '~' && src[i - 1] !== '~' && canOpen(src,i,'~')) { const end=findEmphasisEnd(src,i+1,'~','~'); if(end>i+1&&canClose(src,end,'~')&&src[end+1]!=='~'){flush();out+='<del>'+inline(src.slice(i+1,end),refs,depth+1)+'</del>';i=end+1;continue;} }
    if ((c === '*' || c === '_') && canOpen(src, i, c)) {
      const end = findEmphasisEnd(src, i + 1, c, c);
      if (end > i + 1 && canClose(src, end, c)) { flush(); out += `<em>${inline(src.slice(i + 1, end), refs, depth + 1)}</em>`; i = end + 1; continue; }
    }
    if (c === '\n') { const hard = / {2,}$/.exec(plain); if (hard) plain = plain.slice(0, -hard[0].length); flush(); out += hard ? '<br>' : '\n'; i++; if(hard)while(src[i]===' ')i++; continue; }
    if (/[A-Za-z0-9]/.test(c) && (i===0||!/[\w.+-]/.test(src[i-1]))) { const e=/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/.exec(src.slice(i)); if(e&&/[A-Za-z]{2,}$/.test(e[0])){flush();out+=`<a href="mailto:${escapeHtml(e[0])}">${escapeHtml(e[0])}</a>`;i+=e[0].length;continue;} }
    if (((c === 'h' && (src.startsWith('http://', i) || src.startsWith('https://', i))) || src.startsWith('www.', i)) && (i === 0 || !/[\w@]/.test(src[i - 1]))) { const m = /^(?:https?:\/\/|www\.)[^\s<>]+/i.exec(src.slice(i)); if (m) { let u=m[0], tail=''; if(u.startsWith('www.')&&/&[^\s]*;/.test(u)){const at=u.indexOf('&');tail=u.slice(at);u=u.slice(0,at);} while(/[.,!?;:]$/.test(u)){tail=u.slice(-1)+tail;u=u.slice(0,-1);} while(u.endsWith(')')&&(u.match(/\)/g)||[]).length>(u.match(/\(/g)||[]).length){tail=')'+tail;u=u.slice(0,-1);} if(u){flush();out+=`<a href="${escapeHtml(u.startsWith('www.')?'http://'+u:u)}">${escapeHtml(u)}</a>`;out+=tail?inline(tail,refs,depth+1):'';i+=m[0].length;continue;} } }
    plain += c; i++;
  }
  flush();
  out = out.replace(/(?: {2,}|\\)\n/g, '<br>\n');
  return out;
}

function findClose(s, from, open, close) {
  let level = 0, tick = 0;
  for (let i = from - 1; i < s.length; i++) {
    const c = s[i];
    if (c === '`') { let n = 1; while (s[i + n] === '`') n++; if (!tick) tick = n; else if (tick === n) tick = 0; i += n - 1; continue; }
    if (tick || c === '\\') { if (c === '\\') i++; continue; }
    if (c === open) level++;
    else if (c === close && --level === 0) return i;
  }
  return -1;
}
function findTagEnd(s, at) { const rest=s.slice(at); if(!/^<\/?[A-Za-z][A-Za-z0-9-]*(?=[\s/>])/.test(rest)&&!/^<!--/.test(rest)&&!/^<\?[\s\S]/.test(rest)&&!/^<![A-Z]/.test(rest))return -1; let quote=''; for(let i=at+1;i<s.length;i++){const c=s[i];if(quote){if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='>'){const tag=s.slice(at,i+1);if(/^<!--|^<\?|^<![A-Z]/.test(tag))return i;return /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?|\s*\/?)\s*>$/s.test(tag)?i:-1;}}return -1; }
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
function normalize(s) { return s.trim().replace(/[\t\n ]+/g, ' ').replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g,'$1').toLowerCase(); }
function parseDestination(s) {
  s = s.trim(); if (!s) return { href: '', title: '' };
  let dest = '', rest = '';
  if (s[0] === '<') { const e = s.indexOf('>'); if (e < 0) return null; dest = s.slice(1, e); if(/\s/.test(dest))return null; rest = s.slice(e + 1).trim(); }
  else { let i = 0, nest = 0; for (; i < s.length; i++) { if (s[i] === '\\') { i++; continue; } if (s[i] === '(') nest++; else if (s[i] === ')') { if (!nest) break; nest--; } else if (/\s/.test(s[i]) && !nest) break; } if (nest) return null; dest = s.slice(0, i); rest = s.slice(i).trim(); }
  let title = ''; if (rest) { const q = rest[0], end = rest[rest.length - 1]; if ((q === '"' || q === "'" || q === '(') && end === (q === '(' ? ')' : q)) title = rest.slice(1, -1); else return null; }
  return { href: dest.replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, '$1').replace(/\\/g,'%5C').replace(/ /g,'%20'), title };
}

function parseBlocks(markdown, refs) {
  let text = markdown.replace(/\r\n?/g, '\n').replace(/\0/g, '\uFFFD');
  if (!text.endsWith('\n')) text += '\n';
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length - 1;) {
    const line = lines[i], trim = line.trim();
    if (!trim) { i++; continue; }
    const def = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/.exec(line);
    if (def) { refs.set(normalize(def[1]), { href: def[2] || def[3], title: def[4] || def[5] || def[6] || '' }); i++; continue; }
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) { const indent=line.length-line.trimStart().length, mark = fence[1], ch = mark[0], n = mark.length, info = fence[2].trim().split(/[ \t]/)[0]; let code = []; i++; while (i < lines.length - 1 && !new RegExp(`^ {0,3}${ch}{${n},}\\s*$`).test(lines[i])) { code.push(lines[i].slice(Math.min(indent, lines[i].match(/^ */)[0].length))); i++; } if (i < lines.length - 1) i++; const cls = info ? ` class="language-${escapeHtml(info)}"` : ''; out.push(`<pre><code${cls}>${escapeHtml(code.join('\n') + (code.length ? '\n' : ''))}</code></pre>\n`); continue; }
    const atx = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/.exec(line);
    if (atx) { const title = atx[2].replace(/[ \t]+#+[ \t]*$/, '').replace(/^#+[ \t]*$/, '').trim(); out.push(`<h${atx[1].length}>${inline(title, refs)}</h${atx[1].length}>\n`); i++; continue; }
    if (/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line)) { out.push('<hr>\n'); i++; continue; }
    if (/^ {0,3}>/.test(line)) { const q = []; while (i < lines.length - 1) { if(/^ {0,3}>/.test(lines[i])) q.push(lines[i++].replace(/^ {0,3}> ?/,'')); else if(q.length&&lines[i].trim()&&!/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(lines[i])&&!/^ {0,3}(?:#{1,6}\s|[-+*]\s|1[.)]\s|```|~~~|>)/.test(lines[i])) q.push(lines[i++]); else break; } out.push('<blockquote>\n' + parseBlocks(q.join('\n') + '\n', refs) + '</blockquote>\n'); continue; }
    if (indented(line)) { const code = []; while (i < lines.length - 1 && (indented(lines[i]) || (!lines[i].trim() && i + 1 < lines.length - 1 && indented(lines[i + 1])))) code.push(stripIndent(lines[i++],4)); while (code.length && !code[code.length - 1]) code.pop(); out.push(`<pre><code>${escapeHtml(code.join('\n') + '\n')}</code></pre>\n`); continue; }
    if (/^(?: {0,3}<!--| {0,3}<\?| {0,3}<![A-Z]| {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul|script|style)(?:\s|>|\/))/i.test(line)) { const raw = []; const first = line.trimStart(); let end = first.startsWith('<!--') ? '-->' : /^<(script|style|pre|textarea)\b/i.test(first) ? `</${/^<(script|style|pre|textarea)\b/i.exec(first)[1].toLowerCase()}>` : null; while (i < lines.length - 1) { if (!end && !lines[i].trim()) break; const l = lines[i++]; raw.push(l); if (end && l.toLowerCase().includes(end)) break; } out.push(raw.join('\n')); continue; }
    if (i + 1 < lines.length - 1 && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1])) { const level = lines[i + 1].trim()[0] === '=' ? 1 : 2; out.push(`<h${level}>${inline(trim, refs)}</h${level}>\n`); i += 2; continue; }
    if (i + 1 < lines.length - 1 && line.includes('|') && isTableDelimiter(lines[i + 1]) && splitTableRow(line).length===splitTableRow(lines[i+1]).length) { const heads = splitTableRow(line), aligns = splitTableRow(lines[i + 1]); const alignAttr=k=>aligns[k]?.startsWith(':') ? ` align="${aligns[k].endsWith(':')?'center':'left'}"` : aligns[k]?.endsWith(':') ? ' align="right"' : ''; out.push('<table>\n<thead>\n<tr>\n' + heads.map((x,k)=>`<th${alignAttr(k)}>${inline(x,refs)}</th>\n`).join('') + '</tr>\n</thead>\n<tbody>'); i += 2; while (i < lines.length - 1 && lines[i].trim()) { const cells = splitTableRow(lines[i++]); out.push('<tr>\n' + heads.map((_,k)=>`<td${alignAttr(k)}>${inline(cells[k] || '',refs)}</td>\n`).join('') + '</tr>\n'); } out.push('</tbody></table>\n'); continue; }
    const list = /^ {0,3}([-+*]|\d{1,9}[.)])[ \t]+(.*)$/.exec(line);
    if (list) { const ordered = /^\d/.test(list[1]), tag = ordered ? 'ol' : 'ul', delim=ordered?list[1].slice(-1):list[1], start = ordered ? Number.parseInt(list[1],10) : 1, items = []; let loose = false; while (i < lines.length - 1) { const m = /^ {0,3}([-+*]|\d{1,9}[.)])[ \t]+(.*)$/.exec(lines[i]); if (!m || /^\d/.test(m[1]) !== ordered || (ordered?m[1].slice(-1):m[1])!==delim) break; const lead=lines[i].length-lines[i].trimStart().length, marker=m[1].length, spaces=(lines[i].slice(lead+marker).match(/^[ \t]+/)||[' '])[0].length, contentIndent=lead+marker+Math.min(spaces,4), body = [m[2]]; i++; while (i < lines.length - 1 && (indentColumns(lines[i]) >= contentIndent || (!lines[i].trim() && i+1 < lines.length-1 && indentColumns(lines[i+1]) >= contentIndent))) { if (!lines[i].trim()) { loose = true; body.push(''); i++; } else body.push(stripIndent(lines[i++],contentIndent)); } const task = /^\[([ xX])\][ \t]+/.exec(body[0]); items.push({body,task}); if (i < lines.length - 1 && !lines[i].trim()) { let j=i;while(j<lines.length&&!lines[j].trim())j++;const next=j<lines.length?/^ {0,3}([-+*]|\d{1,9}[.)])[ \t]+/.exec(lines[j]):null;if(next&&/^\d/.test(next[1])===ordered&&(ordered?next[1].slice(-1):next[1])===delim){loose=true;i=j;continue;}break;} } const rendered=items.map(({body,task})=>{ if(task) body[0]=body[0].replace(/^\[[ xX]\][ \t]+/,''); let inner=parseBlocks(body.join('\n')+'\n',refs); if(!loose) inner=inner.replace(/^<p>([\s\S]*?)<\/p>\n/g,'$1').replace(/\n(?=<p>)/g,'\n').replace(/\n(?=<(?:ul|ol|pre|blockquote|table|h[1-6])(?:\s|>))/g,''); const checkbox=task?`<input${task[1].toLowerCase()==='x'?' checked=""':''} disabled="" type="checkbox"> `:''; const blockContent=/<(?:p|ul|ol|pre|blockquote|table|h[1-6])(?:\s|>)/.test(inner); return `<li>${checkbox}${inner.trimEnd()}${loose||blockContent?'\n':''}</li>\n`; }).join(''); const attrs=ordered&&start!==1?` start="${start}"`:''; out.push(`<${tag}${attrs}>\n${rendered}</${tag}>\n`); continue; }
    const para = [line]; i++;
    while (i < lines.length - 1 && lines[i].trim() && !/^ {0,3}(?:=+|-+)\s*$/.test(lines[i]) && !isBlockStart(lines, i)) para.push(lines[i++]);
    if (i < lines.length - 1 && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i])) { const level=lines[i].trim()[0]==='='?1:2; out.push(`<h${level}>${inline(para.join('\n').trim(),refs)}</h${level}>\n`); i++; }
    else out.push(`<p>${inline(para.join('\n'), refs)}</p>\n`);
  }
  return out.join('');
}
function indentColumns(s) { let col=0; for(let i=0;i<s.length;i++){if(s[i]===' ')col++;else if(s[i]==='\t')col+=4-col%4;else break;} return col; }
function indented(s) { return indentColumns(s)>=4; }
function stripIndent(s,target) { let col=0,i=0;while(i<s.length&&col<target){if(s[i]===' '){col++;i++;}else if(s[i]==='\t'){const next=col+4-col%4;i++;col=next;if(next>target)return ' '.repeat(next-target)+s.slice(i);}else break;}return s.slice(i); }
function splitTableRow(line) { let s=line.trim(); if(s.startsWith('|'))s=s.slice(1); if(s.endsWith('|')&&!s.endsWith('\\|'))s=s.slice(0,-1); const cells=[];let start=0,ticks=0;for(let i=0;i<s.length;i++){if(s[i]==='\\'){i++;continue;}if(s[i]==='`'){let n=1;while(s[i+n]==='`')n++;if(!ticks)ticks=n;else if(ticks===n)ticks=0;i+=n-1;continue;}if(s[i]==='|'&&!ticks){cells.push(s.slice(start,i).trim().replace(/\\\|/g,'|'));start=i+1;}}cells.push(s.slice(start).trim().replace(/\\\|/g,'|'));return cells; }
function isTableDelimiter(line) { const cells=splitTableRow(line);return cells.length>0&&cells.every(c=>/^:?-+:?$/.test(c)); }
function isBlockStart(lines,i) { const s=lines[i]; return /^ {0,3}(?:#{1,6}(?:\s|$)|>|```|~~~|([-+*])\s+|1[.)]\s+|(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|<\/?(?:div|table|details|pre|script|style|p|ul|ol|li|hr|h[1-6])\b)/i.test(s); }

export function parse(markdown) {
  const refs = new Map();
  let source = String(markdown).replace(/\r\n?/g, '\n');
  const lines=source.split('\n');
  for(let i=0;i<lines.length;i++){
    const m=/^ {0,3}\[((?:\\.|[^\]])+)\]:[ \t]*(.*)$/.exec(lines[i]); if(!m)continue;
    const start=i; let value=m[2];
    if(!value&&i+1<lines.length&&lines[i+1].trim()){value=lines[++i].trim();}
    const d=/^(?:<([^>]*)>|(\S+))(.*)$/.exec(value);if(!d){i=start;continue;}
    let rest=d[3].trim(),title='';
    if(!rest&&i+1<lines.length&&lines[i+1].trim()&&/^[ \t]*["'(]/.test(lines[i+1]))rest=lines[++i].trim();
    if(rest){const q=rest[0],close=q==='('?')':q;if((q==='"'||q==="'"||q==='(')&&rest.indexOf(close,1)<0){let titleText=rest.slice(1);let valid=true;while(i+1<lines.length&&lines[i+1].trim()){titleText+='\n'+lines[++i];if(lines[i].includes(close))break;}if(!titleText.includes(close))valid=false;if(!valid){i=start;continue;}rest=q+titleText;}
      const t=/^(?:"([\s\S]*)"|'([\s\S]*)'|\(([\s\S]*)\))$/.exec(rest);if(t)title=t[1]??t[2]??t[3]??'';else{i=start;continue;}}
    if(!refs.has(normalize(m[1])))refs.set(normalize(m[1]),{href:(d[1]??d[2]).replace(/ /g,'%20'),title});
    for(let j=start;j<=i;j++)lines[j]='';
  }
  return parseBlocks(lines.join('\n'), refs);
}
