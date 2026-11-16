(function () {
  'use strict';
  var android = window.MinDagAndroid;
  var app = document.getElementById('app');
  var toast = document.getElementById('toast');
  var body = window.MinDagBody;
  var report = window.MinDagReport;
  var storage = load();
  var active = null, page = 'home', unlock = null, editor = null;
  var inactiveAfter = 2 * 60 * 1000;
  var inactivity, toastTimer, lastAction = Date.now(), attempts = {};
  var calendar = {status:'pending'}, calendarRequest = 0;
  var weatherRequest = 0, citiesRequest = 0, weatherState = '', cityResults = [];
  var reportOptions, reportText = '';
  var moods = ['Meget dårligt','Dårligt','Hverken godt eller dårligt','Godt','Meget godt'];
  var qualities = ['Meget dårlig','Dårlig','Middel','God','Meget god'];
  var activityLevels = ['Meget lav','Lav','Middel','Høj','Meget høj'];
  var labels = {pain:'Smerter', noPain:'Smerter', sleep:'Søvn', mood:'Trivsel', cycle:'Menstruation'};
  var editorTitles = {pain:'Smerter',mood:'Trivsel',sleep:'Søvn',cycle:'Menstruation',noPain:'Ingen smerter'};

  function load() {
    try {
      var raw = android ? android.load() : localStorage.getItem('min-dag');
      if (android && !raw) throw new Error('storage');
      var saved = JSON.parse(raw || '{}');
      saved.profiles = saved.profiles || [];
      if (!saved.calendars) {
        var previous = saved.profiles.map(function (p) { return p.calendars || []; }).filter(function (ids) { return ids.length; });
        saved.calendars = previous.length ? previous[0].filter(function (id) {
          return previous.every(function (ids) { return ids.indexOf(id) >= 0; });
        }) : [];
      }
      return saved;
    } catch (error) { return {failed:true, profiles:[]}; }
  }
  function save(change) {
    var previous = JSON.stringify(storage);
    change();
    try {
      var json = JSON.stringify(storage);
      if (android) {
        if (!android.save(json)) throw new Error('storage');
      } else localStorage.setItem('min-dag',json);
      return true;
    } catch (error) {
      storage = JSON.parse(previous);
      showToast('Ændringen kunne ikke gemmes. Prøv igen.');
      return false;
    }
  }
  function profile() { return storage.profiles.find(function (p) { return p.id === active; }); }
  function id() {
    var values = new Uint32Array(4);
    window.crypto.getRandomValues(values);
    return Array.prototype.map.call(values,function (value) { return value.toString(36); }).join('-');
  }
  function pad(n) { return ('0' + n).slice(-2); }
  function localDate(date) { return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate()); }
  function today() { return localDate(new Date()); }
  function currentTime() { var now = new Date(); return pad(now.getHours())+':'+pad(now.getMinutes()); }
  function shift(day, count) {
    var date = new Date(day+'T12:00:00');
    date.setDate(date.getDate()+count);
    return localDate(date);
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g,function (char) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }
  function button(label, action, kind, extra) {
    return '<button type="button" data-action="'+action+'"'+(kind ? ' class="'+kind+'"' : '')+' '+(extra || '')+'>'+esc(label)+'</button>';
  }
  function field(label, html) { return '<label class="field">'+label+html+'</label>'; }
  function input(name,type,value,attributes) {
    return '<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(attributes || '')+'>';
  }
  function select(name, options, current, attributes) {
    return '<select name="'+name+'" '+(attributes || '')+'>'+options.map(function (option) {
      var value = Array.isArray(option) ? option[0] : option;
      var label = Array.isArray(option) ? option[1] : option;
      return '<option value="'+esc(value)+'"'+(String(current) === String(value) ? ' selected' : '')+'>'+esc(label)+'</option>';
    }).join('')+'</select>';
  }
  function scale(name, values, current) {
    return select(name,[['','Vælg']].concat(values.map(function (v,i) { return [i+1,(i+1)+' · '+v]; })),current);
  }
  function note(value) {
    return '<details class="note" '+(value ? 'open' : '')+'><summary>Note (valgfrit)</summary>'+
      '<textarea name="note" aria-label="Note" maxlength="600">'+esc(value)+'</textarea></details>';
  }
  function showToast(text) {
    toast.textContent = text;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.style.display = 'none'; toast.textContent = ''; },3500);
  }
  function render() {
    var p = profile();
    var compact = p && (page === 'edit' || page === 'pain' || page === 'area');
    var nav = p ? '<nav aria-label="Navigation">'+[['Fælles overblik','home'],['Registrér','today'],['Historik','history'],['Rapport','report'],['Min profil','settings']].map(function (entry) {
      return button(entry[0],entry[1],'',page === entry[1] ? 'aria-current="page"' : '');
    }).join('')+'</nav>' : '<nav aria-label="Navigation">'+button('Fælles overblik','home','')+button('Indstillinger','sharedSettings','')+'</nav>';
    var title = compact ? (page === 'area' ? 'Vælg smerteområde' : editorTitles[editor.type]) : '';
    var top = compact ? '<header class="entry-header">'+button('‹ Tilbage','editorBack','')+'<h1>'+title+'</h1><span class="entry-person">'+esc(p.name)+'</span></header>'
      : '<header><div class="brand"><span class="logo" aria-hidden="true">☀</span>Min Dag</div>'+nav+'</header>';
    var content = views[page](p);
    app.innerHTML = '<div class="shell'+(compact ? ' entry-shell' : '')+'">'+top+'<main>'+content+'</main></div>';
    drawBody();
  }
  function navigate(next) {
    page = next;
    editor = null;
    if (next === 'report') reportOptions = {from:shift(today(),-6),to:today(),cycle:false,notes:false,area:''};
    render();
    window.scrollTo(0,0);
    if (next === 'home' || next === 'sharedSettings') refreshCalendar();
    if (next === 'home') refreshWeather(false);
  }
  function lock() {
    clearTimeout(inactivity);
    active = null;
    unlock = null;
    editor = null;
    reportOptions = null;
    reportText = '';
    toast.style.display = 'none';
    toast.textContent = '';
    navigate('home');
  }
  function activity() {
    if (active && Date.now() - lastAction >= inactiveAfter) lock();
    lastAction = Date.now();
    clearTimeout(inactivity);
    if (active) inactivity = setTimeout(lock,inactiveAfter);
  }
  function profiles() {
    if (storage.failed) return '<div class="screen"><h1>Min Dag</h1><p class="error">Data kunne ikke læses. Luk appen, og prøv at åbne den igen.</p></div>';
    var list = storage.profiles.map(function (p) {
      return button(p.name,'unlock','', 'data-id="'+esc(p.id)+'"');
    }).join('');
    var chosen = storage.profiles.find(function (p) { return p.id === unlock; });
    var form = chosen
      ? '<h2>Åbn '+esc(chosen.name)+'</h2><form data-form="unlock">'+field('PIN',input('pin','password','','inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" required'))+'<button class="primary">Åbn profil</button></form>'
      : '<h2>Opret profil</h2><form data-form="profile">'+field('Navn',input('name','text','','maxlength="40" required'))+
        field('PIN med 4–8 cifre (valgfri)',input('pin','password','','inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8"'))+
        '<label class="field"><input type="checkbox" name="cycle">Vis menstruationslog</label><button class="primary">Opret profil</button></form>';
    return '<div class="screen"><h1>'+(list ? 'Vælg person' : 'Din dag begynder her')+'</h1>'+
      (list ? '<div class="card toolbar">'+list+button('Ny profil','newProfile','')+'</div>' : '')+
      '<div class="card">'+form+'</div></div>';
  }
  function openProfile(p) {
    active = p.id;
    unlock = null;
    lastAction = Date.now();
    activity();
    navigate('today');
  }
  function lastRecord(p,type) {
    return p.records.filter(function (r) { return r.type === type && r.date === today(); }).slice(-1)[0];
  }
  function summary(p,type,title,css,empty) {
    var r = lastRecord(p,type);
    return '<section class="card summary '+css+'"><h2>'+title+'</h2><p>'+(r ? esc(report.describe(r)) : empty)+'</p>'+
      button(r ? 'Redigér' : 'Registrér',r ? 'editRecord' : type,'','data-id="'+(r ? esc(r.id) : '')+'"' )+'</section>';
  }
  function daily(p) {
    var records = p.records.filter(function (r) { return (r.type === 'pain' || r.type === 'noPain') && r.date === today(); });
    var list = records.map(function (r) {
      return '<li class="record"><span>'+esc((r.time ? r.time+' · ' : '')+report.describe(r))+'</span>'+button('Redigér','editRecord','','data-id="'+esc(r.id)+'"')+'</li>';
    }).join('');
    return '<div class="hero"><div><h1>Registrér</h1><p class="muted">'+esc(p.name)+'</p></div></div>'+
      '<div class="grid"><section class="card"><h2>Kropskort</h2>'+bodyCard()+
      (list ? '<ul class="rows">'+list+'</ul>' : '')+'</section>'+
      '<div class="stack">'+summary(p,'mood','Trivsel','mood','Hvordan har du det?')+
      summary(p,'sleep','Søvn','sleep','Hvordan sov du?')+
      (p.cycle ? summary(p,'cycle','Menstruation','cycle','Registrér blødning og symptomer') : '')+'</div></div>';
  }
  function home() {
    if (storage.failed) return profiles();
    var formatted = new Intl.DateTimeFormat('da-DK',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
    var people = storage.profiles.map(function (p) {
      return button(p.name,'unlock','','data-id="'+esc(p.id)+'"');
    }).join('');
    return '<div class="hero home-hero"><div><p class="eyebrow">'+esc(formatted)+'</p><h1>I dag</h1></div>'+
      '<section class="card people"><h2>Registrér helbred</h2><div class="toolbar">'+people+
      button('Ny profil','newProfile',people ? '' : 'primary')+'</div></section></div>'+
      '<div class="grid"><section class="card" id="agenda-card">'+agendaCard()+'</section>'+
      '<section class="card weather" id="weather-card">'+weatherCard()+'</section></div>';
  }
  function draft() {
    if (!editor || editor.type !== 'pain') editor = {type:'pain',map:'full',front:true,area:'',score:0,date:today(),time:currentTime(),returnTo:'today'};
    return editor;
  }
  function bodyCard() {
    var d = draft();
    var locations = body.areas(d.map,d.front,d.part).map(function (a) { return a.label; });
    if (d.area && locations.indexOf(d.area) < 0) locations.push(d.area);
    var sides = d.map === 'hand' ? ['Håndflade','Håndryg'] : d.map === 'foot' ? ['Overside','Fodsål'] : ['Forside','Bagside'];
    return '<div class="toolbar">'+button(sides[0],'front','','aria-pressed="'+(d.front && d.map !== 'back')+'"')+
      button(sides[1],'backside','','aria-pressed="'+(!d.front || d.map === 'back')+'"')+
      (d.map !== 'full' ? button('Hele kroppen','fullBody','') : '')+'</div>'+
      '<div class="body-wrap"><canvas id="body" class="body-art" width="480" height="860" role="img" aria-label="Klikbart kropskort. Områder kan også vælges på listen."></canvas>'+
      '<div class="body-control"><p class="eyebrow">'+esc(d.part || ({head:'Hoved',back:'Ryg'}[d.map] || 'Vælg område'))+'</p>'+
      field('Område',select('area',['Vælg område'].concat(locations),d.area).replace('<select','<select class="area-select"'))+
      '<small><span class="body-key"></span>Tryk på kortet eller vælg på listen.</small>'+
      '<div class="toolbar">'+button('Hoved','head','')+button('Ryg','backMap','')+'</div></div></div>'+
      (page === 'today' ? '<div class="toolbar">'+button('Ingen smerter i dag','noPain','')+'</div>' : '');
  }
  function drawBody() {
    var canvas = document.getElementById('body');
    if (canvas) body.draw(canvas,editor.map,editor.front,editor.area,editor.part);
  }
  function areaView() {
    return '<div class="screen"><section class="card">'+bodyCard()+'</section></div>';
  }
  function painView(p) {
    return '<div class="screen"><section class="card">'+painForm(p,editor)+'</section></div>';
  }
  function clockField(time) {
    var parts = time.split(':');
    var hours = Array.from({length:24},function (_, index) { return pad(index); });
    var minutes = Array.from({length:60},function (_, index) { return pad(index); });
    return '<fieldset class="field time-field"><legend>Klokkeslæt</legend><div class="clock-fields">'+
      select('clockHour',hours,parts[0],'aria-label="Time (00–23)"')+'<span aria-hidden="true">:</span>'+
      select('clockMinute',minutes,parts[1],'aria-label="Minut (00–59)"')+'</div></fieldset>';
  }
  function clockValue(elements) { return elements.clockHour.value+':'+elements.clockMinute.value; }
  function painForm(p,d) {
    var faces = '';
    for (var score = 1; score <= 10; score++) {
      var image = window.MinDagFaceImages ? window.MinDagFaceImages[score-1] : 'faces/'+score+'.png';
      faces += '<button type="button" data-action="score" data-score="'+score+'" aria-pressed="'+(d.score === score)+
        '" aria-label="'+score+' af 10"><img alt="" src="'+image+'">'+score+'</button>';
    }
    return '<form data-form="pain" id="pain-form"><div class="entry-line"><h2>'+esc(d.area)+'</h2>'+
      button('Skift område','changeArea','')+'</div>'+
      '<div class="pain-scale" role="group" aria-label="Smerteintensitet">'+faces+'</div>'+
      '<div class="scale-caption"><small>1 · Meget mild smerte</small><small>10 · Værst tænkelige</small></div>'+
      '<div class="entry-fields"><div class="cols">'+field('Dato',input('date','date',d.date,'required max="'+today()+'"'))+clockField(d.time)+'</div>'+
      '<div class="cols">'+field('Varighed i timer',input('hours','number',d.hours,'min="0" max="999" step="1"'))+
      field('Minutter',input('minutes','number',d.minutes,'min="0" max="59" step="1"'))+'</div></div>'+
      '<label class="field"><input name="ongoing" type="checkbox" '+(d.ongoing ? 'checked' : '')+'>Smerten er stadig i gang</label>'+
      note(d.note)+'<div class="toolbar"><button class="primary" '+(!d.score ? 'disabled' : '')+'>Gem for '+esc(p.name)+'</button>'+
      button('Annullér','editorBack','')+(d.id ? button('Slet','deleteRecord','','data-id="'+esc(d.id)+'"') : '')+'</div></form>';
  }
  function readPainDraft() {
    var form = document.getElementById('pain-form');
    if (!form) return;
    ['date','hours','minutes','note'].forEach(function (name) { editor[name] = form.elements[name].value; });
    editor.time = clockValue(form.elements);
    editor.ongoing = form.elements.ongoing.checked;
  }
  function setMap(map, front, part) {
    var d = draft();
    readPainDraft();
    d.map = map;
    d.front = front;
    d.part = part || '';
    if (map !== 'full' && page === 'today') {
      page = 'area';
      render();
      window.scrollTo(0,0);
      return;
    }
    render();
  }
  function chooseArea(area) {
    var d = draft();
    readPainDraft();
    if (area === 'Hoved') return setMap('head', d.front);
    if (area === 'Ryg') return setMap('back', false);
    if (/^(Venstre|Højre) hånd$/.test(area)) return setMap('hand', true, area);
    if (/^(Venstre|Højre) fod$/.test(area)) return setMap('foot', true, area);
    if (area === 'Vælg område') return;
    d.area = area;
    page = 'pain';
    render();
    window.scrollTo(0,0);
  }
  function scorePain(score) {
    editor.score = score;
    var form = document.getElementById('pain-form');
    Array.prototype.forEach.call(form.querySelectorAll('[data-score]'),function (btn) {
      btn.setAttribute('aria-pressed',Number(btn.dataset.score) === score);
    });
    form.querySelector('[type=submit],button.primary').disabled = false;
  }
  function editorView(p) {
    var d = editor;
    var date = field(d.type === 'sleep' ? 'Dato du vågnede' : 'Dato',input('date','date',d.date,'required max="'+today()+'"'));
    var fields = date;
    if (d.type === 'mood') fields = '<div class="cols">'+date+field('Hvordan har du det?',scale('mood',moods,d.mood))+
      field('Energi (valgfrit)',scale('energy',activityLevels,d.energy))+field('Stress (valgfrit)',scale('stress',activityLevels,d.stress))+'</div>';
    if (d.type === 'sleep') fields = '<div class="cols">'+date+field('Søvnkvalitet (valgfrit)',scale('quality',qualities,d.quality))+
      field('Timer du sov',input('hours','number',d.hours,'required min="0" max="24" step="1"'))+
      field('Minutter',input('minutes','number',d.minutes,'min="0" max="59" step="1"'))+'</div>';
    if (d.type === 'cycle') {
      var starts = report.cycleStarts(p);
      var last = starts[starts.length - 1];
      var runs = report.bleedingRuns(p);
      var run = runs[runs.length - 1];
      var cycleInfo = last ? 'Seneste start · '+report.date(last.date) : '';
      if (starts.length > 1) cycleInfo += ' · Seneste afsluttede cyklus '+report.daysBetween(starts[starts.length-2].date,last.date)+' dage';
      if (run) cycleInfo += ' · Seneste sammenhængende registrering af blødning '+run.days+' dage';
      if (cycleInfo) fields += '<p class="banner">'+esc(cycleInfo)+'</p>';
      fields += field('Blødning',select('bleeding',['Vælg','Ingen blødning','Pletblødning','Let','Moderat','Kraftig'],d.bleeding))+
        '<label class="field"><input name="start" type="checkbox" '+(d.start ? 'checked' : '')+'>Første menstruationsdag</label>'+
        field('Andre symptomer (valgfrit)',input('symptoms','text',d.symptoms,'maxlength="120" placeholder="Fx kvalme eller oppustethed"'))+
        '<p class="muted">Smerter som kramper og hovedpine kan registreres på kropskortet på samme dato.</p>';
    }
    return '<div class="screen"><section class="card"><form data-form="record">'+fields+note(d.note)+
      '<div class="toolbar"><button class="primary">Gem for '+esc(p.name)+'</button>'+button('Annullér','editorBack','')+
      (d.id ? button('Slet','deleteRecord','','data-id="'+esc(d.id)+'"') : '')+'</div></form></section></div>';
  }
  function startEditor(type) {
    var p = profile();
    if (type === 'cycle' && !p.cycle) return;
    editor = {type:type,date:today(),returnTo:page};
    page = 'edit';
    render();
    window.scrollTo(0,0);
  }
  function editRecord(recordId) {
    var r = profile().records.find(function (item) { return item.id === recordId; });
    if (!r) return;
    editor = Object.assign({},r,{returnTo:page});
    if (r.type === 'pain') {
      if (r.minutes != null) {
        editor.hours = Math.floor(r.minutes / 60);
        editor.minutes = r.minutes % 60;
      }
      editor.map = 'full';
      editor.front = true;
      page = 'pain';
    } else page = 'edit';
    render();
    window.scrollTo(0,0);
  }
  function recordFromForm(form) {
    var p = profile();
    var d = editor;
    var elements = form.elements;
    var r = {id:d.id || id(),type:d.type,date:elements.date.value,note:elements.note.value.trim()};
    if (!r.date || r.date > today()) return showToast('Vælg en dato frem til i dag.');
    if (d.type === 'pain') {
      if (!d.score || !d.area) return showToast('Vælg område og smertestyrke.');
      r.area = d.area; r.score = d.score; r.time = clockValue(elements);
      r.ongoing = elements.ongoing.checked;
      var total = Number(elements.hours.value) * 60 + Number(elements.minutes.value);
      r.minutes = !r.ongoing && total ? total : null;
    }
    if (d.type === 'mood') {
      r.mood = Number(elements.mood.value);
      if (!r.mood) return showToast('Vælg dit humør.');
      r.energy = Number(elements.energy.value); r.stress = Number(elements.stress.value);
    }
    if (d.type === 'sleep') {
      r.hours = Number(elements.hours.value); r.minutes = Number(elements.minutes.value);
      if (r.hours === 24 && r.minutes) return showToast('Søvn kan højst være 24 timer.');
      r.quality = Number(elements.quality.value);
    }
    if (d.type === 'cycle') {
      r.bleeding = elements.bleeding.value;
      r.start = elements.start.checked;
      r.symptoms = elements.symptoms.value.trim();
      if (r.bleeding === 'Vælg') return showToast('Vælg blødningsniveau.');
      if (r.start && ['Let','Moderat','Kraftig'].indexOf(r.bleeding) < 0) return showToast('Vælg blødning for første menstruationsdag.');
    }
    var duplicate = r.type !== 'pain' && p.records.find(function (item) {
      return item.type === r.type && item.date === r.date && item.id !== r.id;
    });
    if (duplicate && !window.confirm('Erstat den eksisterende registrering på denne dato?')) return;
    if (save(function () {
      p.records = p.records.filter(function (item) { return item.id !== r.id && (!duplicate || item.id !== duplicate.id); });
      p.records.push(r);
    })) {
      activity();
      if (active) navigate('today');
      showToast('Gemt for '+p.name);
    }
  }

  function history(p) {
    var ordered = p.records.slice().sort(function (a,b) { return b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''); });
    return '<div class="screen"><h1>Historik</h1><section class="card">'+
      (ordered.length ? '<ul class="rows">'+ordered.map(function (r) {
        return '<li class="record"><div><small>'+report.date(r.date)+(r.time ? ' · '+esc(r.time) : '')+' · '+labels[r.type]+'</small><div>'+
          esc(report.describe(r))+'</div>'+(r.note ? '<small>'+esc(r.note)+'</small>' : '')+'</div>'+
          button('Redigér','editRecord','','data-id="'+esc(r.id)+'"')+'</li>';
      }).join('')+'</ul>' : '<p>Der er endnu ingen registreringer for '+esc(p.name)+'.</p>')+
      button('Lav helbredsrapport','report','primary')+'</section></div>';
  }
  function reportView(p) {
    var options = reportOptions;
    var areas = p.records.filter(function (r) { return r.type === 'pain'; }).map(function (r) { return r.area; });
    var hasCycle = p.records.some(function (r) { return r.type === 'cycle'; });
    return '<div class="screen"><h1>Helbredsrapport</h1><section class="card report-controls"><h2>'+esc(p.name)+'</h2>'+
      '<div class="toolbar">'+button('Seneste 7 dage','range7','')+button('Seneste 30 dage','range30','')+'</div>'+
      '<form data-form="report"><div class="cols">'+field('Fra dato',input('from','date',options.from,'required max="'+today()+'"'))+
      field('Til dato',input('to','date',options.to,'required max="'+today()+'"'))+'</div>'+
      field('Smerteområde',select('area',[['','Alle områder']].concat(Array.from(new Set(areas)).sort(function (a,b) { return a.localeCompare(b,'da'); })),options.area))+
      (hasCycle ? '<label class="field"><input type="checkbox" name="cycle" '+(options.cycle ? 'checked' : '')+'>Medtag cyklusdata</label>' : '')+
      '<label class="field"><input type="checkbox" name="notes" '+(options.notes ? 'checked' : '')+'>Medtag fritekstnoter</label>'+
      '<button type="button" class="primary" data-action="pdf" id="pdf">Gem som PDF</button></form></section>'+
      '<section class="card"><div id="report-reading" class="reading" aria-live="polite">'+esc(computeReport(p))+'</div></section></div>';
  }
  function computeReport(p) {
    var o = reportOptions;
    reportText = o.from && o.to && o.from <= o.to && o.to <= today() ? report.create(p,o) : '';
    return reportText || 'Vælg en gyldig start- og slutdato.';
  }
  function updateReport() {
    var form = document.querySelector('[data-form=report]');
    if (!form) return;
    var e = form.elements;
    reportOptions = {from:e.from.value,to:e.to.value,area:e.area.value,cycle:!!(e.cycle && e.cycle.checked),notes:e.notes.checked};
    document.getElementById('report-reading').textContent = computeReport(profile());
    document.getElementById('pdf').disabled = !reportText;
  }
  function settings(p) {
    return '<div class="screen"><h1>Indstillinger</h1><section class="card"><h2>'+esc(p.name)+'</h2>'+
      '<label class="field"><input id="profile-cycle" type="checkbox" '+(p.cycle ? 'checked' : '')+'>Vis menstruationslog</label>'+
      '<form data-form="pin">'+field('Ny PIN med 4–8 cifre',input('pin','password','','inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" required'))+
      '<div class="toolbar"><button class="primary">Gem PIN</button>'+(p.pin ? button('Fjern PIN','removePin','') : '')+'</div></form></section></div>';
  }
  function sharedSettings() {
    return '<div class="screen"><h1>Fælles indstillinger</h1><section class="card"><h2>Vejrby</h2><p class="muted">'+(storage.city ? 'Valgt by · '+esc(storage.city.label) : 'Vælg en by til dagens vejr.')+'</p>'+
      '<form data-form="city"><div class="toolbar">'+input('city','search','','minlength="2" maxlength="80" required aria-label="Bynavn" placeholder="Fx Aarhus"')+
      '<button class="primary">Find by</button></div></form><div id="city-results" aria-live="polite"></div></section>'+
      '<section class="card" id="calendar-settings">'+calendarSettings()+'</section></div>';
  }
  function calendarSettings() {
    if (calendar.status !== 'ok') return agendaCard();
    var checkboxes = calendar.calendars.map(function (c) {
      return '<label class="field"><input type="checkbox" name="calendar" value="'+esc(c.id)+'" '+(storage.calendars.indexOf(c.id) >= 0 ? 'checked' : '')+
        '>'+esc(c.name)+(c.account ? ' · '+esc(c.account) : '')+'</label>';
    }).join('');
    return '<h2>Fælles kalendere</h2>'+
      (checkboxes ? checkboxes : '<p>Tabletten har endnu ingen synkroniserede kalendere. Tilføj Google-kontoen i Androids indstillinger.</p>');
  }
  function agendaCard() {
    var heading = '<h2>Kommende aftaler</h2>';
    if (!android) return heading+'<p>Kalenderen vises i Android-appen.</p>';
    if (calendar.status === 'pending') return heading+'<p>Henter kalender …</p>';
    if (calendar.status === 'permission') return heading+'<p>Giv Min Dag adgang til at læse kalenderne på tabletten.</p>'+
      button('Giv kalenderadgang','calendarPermission','');
    if (calendar.status !== 'ok') return heading+'<p>Kalenderen kunne ikke læses.</p>'+button('Prøv igen','reloadCalendar','');
    if (!storage.calendars.length) return heading+'<p>Vælg hvilke Google-kalendere der vises på det fælles overblik.</p>'+button('Vælg kalendere','sharedSettings','');
    var now = Date.now();
    var events = calendar.events.filter(function (event) {
      if (event.allDay) return new Date(event.end).toISOString().slice(0,10) > today();
      return event.end >= now;
    }).slice(0,8);
    if (!events.length) return heading+'<p>Ingen kommende aftaler i de næste syv dage.</p>'+button('Opdatér','reloadCalendar','');
    return heading+'<ul class="rows">'+events.map(function (event) {
      var at = new Date(event.start);
      var day = event.allDay ? at.toISOString().slice(0,10) : localDate(at);
      var when = (day <= today() ? 'I dag' : report.date(day))+' · '+(event.allDay ? 'Hele dagen' : pad(at.getHours())+':'+pad(at.getMinutes()));
      return '<li><small>'+esc(when)+'</small><div>'+esc(event.title || 'Aftale')+'</div>'+(event.place ? '<small>'+esc(event.place)+'</small>' : '')+'</li>';
    }).join('')+'</ul>'+button('Opdatér','reloadCalendar','');
  }
  function refreshCalendar() {
    if (!android || storage.failed) return;
    var start = new Date(today()+'T00:00:00').getTime();
    var end = new Date(shift(today(),7)+'T00:00:00').getTime();
    android.calendar(start - 86400000,end,JSON.stringify(storage.calendars),++calendarRequest);
  }
  function updateCard(card, html) {
    var element = document.getElementById(card);
    if (element) element.innerHTML = html;
  }
  function weatherCard() {
    var city = storage.city;
    var data = storage.forecast;
    var heading = '<div class="weather-top"><h2>Vejret i dag</h2><span class="eyebrow">'+esc(city && city.label)+'</span></div>';
    if (!city) return heading+'<p>Vælg en by for at se dagens vejr.</p>'+button('Vælg by','sharedSettings','');
    if (!data || data.day !== today()) return heading+'<p>'+(weatherState === 'loading' ? 'Henter prognose …' : 'Ingen tilgængelig prognose for i dag.')+'</p>'+
      button('Opdatér vejr','reloadWeather','');
    var places = {0:'Klart',1:'Mest klart',2:'Delvist skyet',3:'Overskyet',45:'Tåge',48:'Rimtåge'};
    var code = data.code;
    var wording = places[code] || (code >= 95 ? 'Torden' : code >= 85 ? 'Snebyger' : code >= 80 ? 'Regnbyger' :
      code >= 71 ? 'Sne' : code >= 61 ? 'Regn' : 'Støvregn');
    return heading+'<p class="weather-value">'+data.temp+'°</p><p>'+wording+' · '+data.low+'° / '+data.high+'° · '+data.wind+' m/s</p>'+
      (data.rain !== null ? '<p>Højeste nedbørssandsynlighed · '+data.rain+' %'+(data.rain ? ' omkring kl. '+esc(data.rainTime) : '')+'</p>' : '')+
      '<p><small>'+(weatherState === 'error' ? 'Senest hentede prognose · ' : 'Opdateret · ')+esc(data.updatedTime)+' · Open-Meteo</small></p>'+
      button('Opdatér vejr','reloadWeather','');
  }
  function refreshWeather(force) {
    if (!storage.city || weatherState === 'loading') return;
    if (!force && storage.forecast && storage.forecast.day === today() && Date.now()-storage.forecast.updated < 1800000) return;
    weatherState = 'loading';
    updateCard('weather-card',weatherCard());
    var coords = storage.city.lat+','+storage.city.lon;
    if (android) android.weather(coords,false,++weatherRequest);
    else previewWeather('https://api.open-meteo.com/v1/forecast?latitude='+storage.city.lat+'&longitude='+storage.city.lon+
      '&timezone=auto&forecast_days=1&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=ms&daily=temperature_2m_min,temperature_2m_max&hourly=precipitation_probability',
      window.minDagWeather,++weatherRequest);
  }
  function previewWeather(url, callback, request) {
    fetch(url).then(function (response) { return response.json(); }).then(function (json) {
      callback(request,JSON.stringify(json));
    }).catch(function () { callback(request,'{"error":true}'); });
  }

  function selectProfile(el) {
    var chosen = storage.profiles.find(function (p) { return p.id === el.dataset.id; });
    if (!chosen) return;
    if (!chosen.pin) return openProfile(chosen);
    unlock = chosen.id;
    navigate('profiles');
    app.querySelector('[name=pin]').focus();
  }
  function editorBack() {
    if (page === 'area' && editor.area) {
      page = 'pain';
      render();
      window.scrollTo(0,0);
      return;
    }
    navigate(editor.returnTo || 'today');
  }
  function setPin(value) {
    var pin = value && android ? android.createPin(value) : value;
    if (value && !pin) return showToast('PIN kunne ikke gemmes.');
    var p = profile();
    if (save(function () { p.pin = pin; })) {
      render();
      showToast(pin ? 'PIN gemt.' : 'PIN fjernet.');
    }
  }
  var views = {home:home,profiles:profiles,sharedSettings:sharedSettings,today:daily,edit:editorView,
    pain:painView,area:areaView,history:history,report:reportView,settings:settings};
  var actions = {
    home:lock, sharedSettings:function () { navigate('sharedSettings'); },
    today:function () { navigate('today'); }, history:function () { navigate('history'); },
    report:function () { navigate('report'); }, settings:function () { navigate('settings'); },
    newProfile:function () { unlock = null; navigate('profiles'); },
    unlock:selectProfile, removePin:function () { setPin(''); },
    front:function () { setMap(editor.map === 'back' ? 'full' : editor.map,true,editor.part); },
    backside:function () { setMap(editor.map,false,editor.part); },
    fullBody:function () { setMap('full',editor.front); },
    head:function () { setMap('head',editor.front); }, backMap:function () { setMap('back',false); },
    score:function (el) { scorePain(Number(el.dataset.score)); },
    editorBack:editorBack,
    changeArea:function () {
      readPainDraft();
      page = 'area';
      render();
      window.scrollTo(0,0);
    },
    noPain:function () { startEditor('noPain'); }, mood:function () { startEditor('mood'); },
    sleep:function () { startEditor('sleep'); }, cycle:function () { startEditor('cycle'); },
    editRecord:function (el) { editRecord(el.dataset.id); },
    deleteRecord:function (el) {
      var p = profile(), back = editor.returnTo || 'today';
      if (window.confirm('Vil du slette denne registrering?') && save(function () {
        p.records = p.records.filter(function (r) { return r.id !== el.dataset.id; });
      })) { navigate(back); showToast('Registreringen er slettet.'); }
    },
    range7:function () { range(7); }, range30:function () { range(30); },
    pdf:function () {
      updateReport();
      if (!reportText) return;
      if (android) android.report(reportText,'Min Dag '+reportOptions.from+' til '+reportOptions.to+'.pdf');
      else window.print();
    },
    calendarPermission:function () { if (android) android.calendarPermission(); },
    reloadCalendar:refreshCalendar,
    reloadWeather:function () { refreshWeather(true); },
    cityPick:function (el) {
      var chosen = cityResults[Number(el.dataset.index)];
      if (!chosen) return;
      if (save(function () { storage.city = chosen; delete storage.forecast; })) {
        weatherRequest++; weatherState = ''; render(); refreshWeather(true); showToast('Vejrby gemt');
      }
    }
  };
  function range(days) {
    var form = document.querySelector('[data-form=report]');
    form.elements.from.value = shift(today(),1-days);
    form.elements.to.value = today();
    updateReport();
  }
  app.addEventListener('click',function (event) {
    activity();
    if (!app.contains(event.target)) return;
    if (event.target.id === 'body') {
      var zone = body.choose(event.target,event,editor.map,editor.front,editor.part);
      if (zone) chooseArea(zone);
      return;
    }
    var trigger = event.target.closest('[data-action]');
    if (trigger && app.contains(trigger) && actions[trigger.dataset.action]) actions[trigger.dataset.action](trigger);
  });
  app.addEventListener('input',activity);
  app.addEventListener('keydown',activity);
  app.addEventListener('wheel',activity,{passive:true});
  app.addEventListener('touchmove',activity,{passive:true});
  app.addEventListener('change',function (event) {
    var el = event.target, p = profile();
    if (el.classList.contains('area-select')) chooseArea(el.value);
    if (el.id === 'profile-cycle') {
      if (!save(function () { p.cycle = el.checked; })) el.checked = !el.checked;
    }
    if (el.name === 'calendar') {
      var ids = Array.prototype.map.call(app.querySelectorAll('[name=calendar]:checked'),function (box) { return box.value; });
      if (save(function () { storage.calendars = ids; })) refreshCalendar();
      else el.checked = !el.checked;
    }
    if (page === 'report') updateReport();
  });
  app.addEventListener('submit',function (event) {
    event.preventDefault();
    var form = event.target, e = form.elements;
    switch (form.dataset.form) {
      case 'profile':
        var name = e.name.value.trim();
        if (!name) return showToast('Skriv et navn.');
        var pin = e.pin.value && android ? android.createPin(e.pin.value) : e.pin.value;
        if (e.pin.value && !pin) return showToast('PIN kunne ikke gemmes.');
        var p = {id:id(),name:name,pin:pin,records:[],cycle:e.cycle.checked};
        if (save(function () { storage.profiles.push(p); })) openProfile(p);
        break;
      case 'unlock':
        var selected = storage.profiles.find(function (item) { return item.id === unlock; });
        var fails = attempts[unlock] || {count:0,until:0};
        if (!selected) return;
        if (fails.until > Date.now()) return showToast('For mange forsøg. Vent ét minut.');
        if (android ? android.checkPin(e.pin.value,selected.pin) : e.pin.value === selected.pin) {
          delete attempts[unlock]; openProfile(selected);
        } else {
          fails.count++;
          if (fails.count >= 5) { fails.until=Date.now()+60000; fails.count=0; }
          attempts[unlock]=fails; showToast('PIN er forkert.'); e.pin.value=''; e.pin.focus();
        }
        break;
      case 'pain': case 'record': recordFromForm(form); break;
      case 'pin': setPin(e.pin.value); break;
      case 'city':
        var query = e.city.value.trim();
        if (query.length < 2) return showToast('Skriv mindst to bogstaver.');
        updateCard('city-results','<p>Søger efter by …</p>');
        if (android) android.weather(query,true,++citiesRequest);
        else previewWeather('https://geocoding-api.open-meteo.com/v1/search?count=8&language=da&name='+encodeURIComponent(query),
          window.minDagCities,++citiesRequest);
        break;
    }
  });
  window.minDagCalendar = function (request,json) {
    if (request !== calendarRequest) return;
    calendar = JSON.parse(json);
    updateCard('agenda-card',agendaCard());
    updateCard('calendar-settings',calendarSettings());
  };
  window.minDagCities = function (request,json) {
    if (request !== citiesRequest || page !== 'sharedSettings') return;
    var data = JSON.parse(json);
    cityResults = (data.results || []).map(function (r) {
      return {label:[r.name,r.admin1,r.country].filter(Boolean).filter(function (v,i,a) { return a.indexOf(v) === i; }).join(', '),
        lat:r.latitude,lon:r.longitude};
    });
    updateCard('city-results',cityResults.length ? '<div class="toolbar">'+cityResults.map(function (city,index) {
      return button(city.label,'cityPick','','data-index="'+index+'"');
    }).join('')+'</div>' : '<p>'+(data.error ? 'Bysøgningen kunne ikke hente data.' : 'Ingen byer fundet.')+'</p>');
  };
  window.minDagWeather = function (request,json) {
    if (request !== weatherRequest) return;
    var data = JSON.parse(json);
    weatherState = 'error';
    if (data.current && data.daily && data.hourly) {
      var maximum = null, hour = '';
      data.hourly.precipitation_probability.forEach(function (value,index) {
        if (value != null && (maximum === null || value > maximum)) {
          maximum = value; hour = data.hourly.time[index].slice(-5);
        }
      });
      var forecast = {day:data.daily.time[0],temp:Math.round(data.current.temperature_2m),code:data.current.weather_code,
        wind:Math.round(data.current.wind_speed_10m),low:Math.round(data.daily.temperature_2m_min[0]),
        high:Math.round(data.daily.temperature_2m_max[0]),rain:maximum,rainTime:hour,updated:Date.now(),updatedTime:currentTime()};
      if (save(function () { storage.forecast = forecast; })) weatherState = 'ready';
    }
    updateCard('weather-card',weatherCard());
  };
  window.minDagRefreshCalendar = refreshCalendar;
  window.minDagLock = lock;
  window.minDagResume = function () {
    activity();
    if (page === 'home') { refreshCalendar(); refreshWeather(false); }
  };
  window.minDagBack = function () {
    if (!active) return lock();
    if (page === 'edit' || page === 'pain' || page === 'area') return editorBack();
    if (page !== 'today') return navigate('today');
    lock();
  };
  window.addEventListener('focus',window.minDagResume);
  navigate('home');
}());
