(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = new Intl.NumberFormat('ru-RU');
  const number = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const value = v => number(v) === null ? '—' : fmt.format(v);
  const text = v => typeof v === 'string' && v.trim() ? v.trim() : 'Не указано';
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0,10) === v;
  const date = v => isDate(v) ? new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${v}T00:00:00Z`)) : '—';
  const list = (data, key) => Array.isArray(data[key]) ? data[key].filter(x => x && typeof x === 'object' && !Array.isArray(x)) : [];
  const empty = message => `<div class="empty">${esc(message)}</div>`;
  let data, dates;

  function metric(label, val, caption) {
    return `<article class="metric"><div class="metric-label">${esc(label)}</div><div class="metric-value">${value(val)}</div><div class="metric-caption">${esc(caption)}</div></article>`;
  }
  function ranking(id, items, mode) {
    const sorted = items.slice().sort((a,b) => (number(b.views) ?? -Infinity) - (number(a.views) ?? -Infinity));
    if (!sorted.length) { $(id).innerHTML = empty('Нет данных на выбранную дату'); return; }
    const max = Math.max(0, ...sorted.map(r => number(r.views) ?? 0));
    $(id).innerHTML = sorted.slice(0,10).map((r,i) => {
      const name = mode === 'videos' ? text(r.title) : text(r.name);
      let sub = mode === 'videos' ? [r.channel, r.genre, r.format].filter(x => typeof x === 'string' && x.trim()).join(' · ') : mode === 'channels' ? (typeof r.handle === 'string' ? r.handle : '') : (number(r.videos) === null ? '' : `${value(r.videos)} видео`);
      if (mode === 'videos' && r.is_short === true) sub += `${sub ? ' · ' : ''}Shorts`;
      const width = number(r.views) !== null && max > 0 ? Math.max(0, Math.min(100, r.views / max * 100)) : 0;
      return `<div class="list-row"><span class="rank">${i+1}</span><div><div class="row-name">${esc(name)}</div>${sub ? `<div class="row-sub">${esc(sub)}</div>` : ''}${mode === 'genres' || mode === 'formats' ? `<div class="bar"><span style="width:${width}%"></span></div>` : ''}</div><div class="row-value">${value(r.views)}<div class="row-sub">просмотров</div></div></div>`;
    }).join('');
  }
  function chart(points) {
    const valid = points.filter(p => number(p.views) !== null);
    if (!valid.length) return empty('Нет данных о просмотрах в выбранном окне');
    if (points.length === 1 || valid.length === 1) return empty(`Для графика нужны минимум два среза с просмотрами. Доступный показатель: ${value(valid[0].views)}.`);
    const w=800,h=230,left=64,right=20,top=20,bottom=40, max=Math.max(0,...valid.map(p=>p.views)), min=Math.min(0,...valid.map(p=>p.views)), range=max-min || 1;
    const x=i=>left+i*(w-left-right)/(points.length-1), y=v=>top+(max-v)*(h-top-bottom)/range;
    let grid=''; for(let i=0;i<4;i++){const yy=top+i*(h-top-bottom)/3;grid+=`<line class="grid" x1="${left}" y1="${yy}" x2="${w-right}" y2="${yy}"/><text x="${left-8}" y="${yy+4}" text-anchor="end">${esc(new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:1}).format(max-i*range/3))}</text>`;}
    let segments=[], segment=[]; points.forEach((p,i)=>{if(number(p.views)===null){if(segment.length) segments.push(segment);segment=[];}else segment.push([x(i),y(p.views)]);});if(segment.length) segments.push(segment);
    const paths=segments.filter(s=>s.length>1).map(s=>`<polyline class="line" points="${s.map(p=>p.join(',')).join(' ')}"/>`).join('');
    const dots=points.map((p,i)=>number(p.views)===null?'':`<circle cx="${x(i)}" cy="${y(p.views)}" r="4"><title>${esc(date(p.date))}: ${value(p.views)} просмотров</title></circle>`).join('');
    const labels=[0,Math.floor((points.length-1)/2),points.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>`<text x="${x(i)}" y="${h-8}" text-anchor="${i===0?'start':i===points.length-1?'end':'middle'}">${esc(date(points[i].date))}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Просмотры по 30-дневным срезам">${grid}${paths}${dots}${labels}</svg>`;
  }
  function render() {
    const selected=$('date-select').value, n=$('window-select').value;
    const eligible=dates.filter(d=>d<=selected), windowDates=n==='all'?eligible:eligible.slice(-Number(n));
    const snapshots=list(data,'snapshots'), current=snapshots.find(s=>s.date===selected) || {};
    const genre=$('genre-select').value, groups=list(data,'genres');
    const overall=windowDates.map(d=>({date:d,views:snapshots.find(s=>s.date===d)?.views}));
    const points=windowDates.map(d=>{const group=groups.find(g=>g.date===d && g.name===genre);return {date:d,views:genre?(group?group.views:0):snapshots.find(s=>s.date===d)?.views}});
    const valid=overall.filter(p=>number(p.views)!==null), best=valid.reduce((a,b)=>!a||b.views>a.views?b:a,null);
    $('selected-label').textContent=`На ${date(selected)} · показатели за предыдущие 30 дней`;
    $('metrics').innerHTML=metric('Просмотры',current.views,'за 30 дней')+metric('Видео',current.videos,'в срезе')+metric('Shorts',current.shorts,'в срезе')+metric('Лайки',current.likes,'за 30 дней')+metric('Комментарии',current.comments,'за 30 дней');
    $('chart').innerHTML=chart(points);
    const previous=overall.length>1?overall[overall.length-2]:null;
    let comparison='Недостаточно данных для сравнения';
    if(previous && number(previous.views)!==null && number(current.views)!==null){const diff=current.views-previous.views; comparison=`${diff>0?'+':''}${value(diff)} к предыдущему срезу`;}
    const errors=Array.isArray(current.channel_errors)?current.channel_errors.length:number(current.channel_errors);
    $('highlights').innerHTML=`<div class="highlight"><div class="highlight-label">Лучший срез по просмотрам</div><div class="highlight-value">${best?value(best.views):'—'}</div><div class="highlight-detail">${best?date(best.date):'Нет данных в выбранном окне'}</div></div><div class="highlight"><div class="highlight-label">Выбранный срез</div><div class="highlight-value">${date(selected)}</div><div class="highlight-detail">${esc(comparison)}</div></div><div class="highlight"><div class="highlight-label">Ошибки каналов</div><div class="highlight-value">${value(errors)}</div><div class="highlight-detail">На выбранную дату</div></div>`;
    for (const key of ['genres','formats','channels','videos']) ranking(key,list(data,key).filter(r=>r.date===selected),key);
  }
  async function init() {
    try {
      const response=await fetch('./data.json',{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      data=await response.json();
      if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('Некорректный формат данных');
      dates=[...new Set((Array.isArray(data.dates)?data.dates:[]).filter(isDate))].sort();
      const generated=typeof data.generated_at==='string' && !Number.isNaN(Date.parse(data.generated_at)) ? new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.generated_at)) : null;
      $('freshness').textContent=generated?`Данные сформированы: ${generated}`:'Время формирования данных неизвестно';
      if(!dates.length){$('notice').textContent='Нет доступных дат срезов. Проверьте содержимое data.json.';return;}
      $('date-select').innerHTML=dates.slice().reverse().map(d=>`<option value="${d}">${esc(date(d))}</option>`).join('');
      $('date-select').disabled=false;$('window-select').disabled=false;$('notice').hidden=true;$('dashboard').hidden=false;
      const genres=[...new Set(list(data,'genres').map(g=>g.name).filter(x=>typeof x==='string' && x.trim()))].sort();
      $('genre-select').innerHTML='<option value="">Все тематики</option>'+genres.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
      $('date-select').addEventListener('change',render);$('window-select').addEventListener('change',render);$('genre-select').addEventListener('change',render);render();
    } catch(e) {
      $('freshness').textContent='Данные не загружены';
      $('notice').classList.add('error');
      $('notice').textContent=`Не удалось загрузить data.json: ${e.message}. Проверьте файл и доступность веб-сервера.`;
    }
  }
  init();
})();