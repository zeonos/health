(function () {
  'use strict';
  function byDate(a, b) { return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''); }
  function cycleStarts(profile) {
    return profile.records.filter(function (r) { return r.type === 'cycle' && r.start; }).sort(byDate);
  }
  function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
  function bleedingRuns(profile) {
    var days = profile.records.filter(function (r) { return r.type === 'cycle' && ['Let','Moderat','Kraftig'].indexOf(r.bleeding) >= 0; }).sort(byDate);
    var runs = [];
    days.forEach(function (day) {
      var previous = runs[runs.length - 1];
      if (!previous || day.start || daysBetween(previous.to, day.date) !== 1) {
        runs.push({from: day.date, to: day.date, days: 1});
      } else {
        previous.to = day.date;
        previous.days++;
      }
    });
    return runs;
  }
  function duration(r) {
    if (r.ongoing) return 'I gang';
    if (r.minutes == null) return '';
    var hours = Math.floor(r.minutes / 60), minutes = r.minutes % 60;
    return [hours ? hours + ' t.' : '', minutes ? minutes + ' min.' : ''].filter(Boolean).join(' ');
  }
  function sleepTime(r) {
    return r.hours + ' t.' + (r.minutes ? ' ' + r.minutes + ' min.' : '');
  }
  function date(value) { return value.split('-').reverse().join('.'); }
  function describe(r) {
    if (r.type === 'pain') return r.area + ' · ' + r.score + '/10' + (duration(r) ? ' · ' + duration(r) : '');
    if (r.type === 'noPain') return 'Ingen smerter';
    if (r.type === 'mood') return 'Humør ' + r.mood + '/5' + (r.energy ? ' · Energi ' + r.energy + '/5' : '') + (r.stress ? ' · Stress ' + r.stress + '/5' : '');
    if (r.type === 'sleep') return sleepTime(r) + (r.quality ? ' · Søvnkvalitet ' + r.quality + '/5' : '');
    return r.bleeding + (r.start ? ' · Menstruationens første dag' : '') + (r.symptoms ? ' · ' + r.symptoms : '');
  }
  function create(profile, options) {
    var selected = profile.records.filter(function (r) {
      return r.date >= options.from && r.date <= options.to && (options.cycle || r.type !== 'cycle') &&
        (!options.area || r.type !== 'pain' || r.area === options.area);
    }).sort(byDate);
    var lines = ['HELBREDSRAPPORT', profile.name, date(options.from) + ' – ' + date(options.to),
      '', 'Registreringer på ' + new Set(selected.map(function (r) { return r.date; })).size + ' af ' +
        (daysBetween(options.from, options.to) + 1) + ' dage.'];
    if (options.area) lines.push('Valgt smerteområde · ' + options.area);
    var pain = selected.filter(function (r) { return r.type === 'pain'; });
    if (pain.length) {
      var counts = Object.create(null);
      pain.forEach(function (r) { counts[r.area] = (counts[r.area] || 0) + 1; });
      var ranked = Object.keys(counts).sort(function (a,b) { return counts[b] - counts[a] || a.localeCompare(b, 'da'); });
      lines.push('Smerter registreret på ' + new Set(pain.map(function (r) { return r.date; })).size + ' dage.');
      lines.push('Højeste registrerede smerte · ' + Math.max.apply(null,pain.map(function (r) { return r.score; })) + '/10');
      lines.push('Hyppigste smerteområder · ' + ranked.slice(0,3).map(function (a) { return a + ' (' + counts[a] + ')'; }).join(', '));
    }
    var sleep = selected.filter(function (r) { return r.type === 'sleep'; });
    if (sleep.length) {
      var mean = Math.round(sleep.reduce(function (sum,r) { return sum + r.hours * 60 + r.minutes; },0) / sleep.length);
      lines.push('Gennemsnitlig søvn · ' + sleepTime({hours:Math.floor(mean/60),minutes:mean%60}) + ' (' + sleep.length + ' registreringer)');
    }
    if (options.cycle) {
      var starts = cycleStarts(profile);
      starts.forEach(function (r,i) {
        if (i && r.date >= options.from && r.date <= options.to) {
          lines.push('Afsluttet cyklus · ' + date(starts[i-1].date) + ' → ' + date(r.date) +
            ' · ' + daysBetween(starts[i-1].date,r.date) + ' dage');
        }
      });
      bleedingRuns(profile).forEach(function (run) {
        if (run.from <= options.to && run.to >= options.from) {
          lines.push('Registreret blødning · ' + date(run.from < options.from ? options.from : run.from) +
            ' – ' + date(run.to > options.to ? options.to : run.to) +
            ' · ' + (1 + daysBetween(run.from < options.from ? options.from : run.from, run.to > options.to ? options.to : run.to)) + ' dage i perioden');
        }
      });
    }
    var labels = {pain:'Smerter',noPain:'Smerter',mood:'Trivsel',sleep:'Søvn',cycle:'Cyklus'};
    lines.push('', 'REGISTRERINGER');
    if (!selected.length) lines.push('Ingen registreringer i perioden.');
    var day = '';
    selected.forEach(function (r) {
      if (day !== r.date) { day = r.date; lines.push('', date(day)); }
      lines.push((r.time ? r.time + '  ' : '') + labels[r.type] + '  ·  ' + describe(r));
      if (options.notes && r.note) lines.push('Note · ' + r.note);
    });
    return lines.join('\n');
  }
  window.MinDagReport = {create:create, describe:describe, date:date, cycleStarts:cycleStarts,
    daysBetween:daysBetween, bleedingRuns:bleedingRuns};
}());
