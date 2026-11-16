/* The illustration and its targets share a fixed, scalable coordinate system. */
(function () {
  'use strict';
  function area(label, x, y) { return {label: label, x: x, y: y}; }
  function pairs(labels, y, x) {
    return [area(labels[0], x, y), area(labels[1], 240 - x, y)];
  }
  function sides(front, names, y, x) { return pairs(front ? names.slice().reverse() : names, y, x); }

  function full(front) {
    return [area('Hoved', 120, 53), area('Nakke', 120, 97)]
      .concat(sides(front, ['Venstre skulder', 'Højre skulder'], 119, 79),
        front ? [area('Bryst', 120, 142), area('Mave', 120, 190)] : [area('Ryg', 120, 156)],
        sides(front, ['Venstre albue', 'Højre albue'], 185, 59),
        sides(front, ['Venstre underarm', 'Højre underarm'], 215, 50),
        sides(front, ['Venstre hånd', 'Højre hånd'], 247, 40),
        sides(front, ['Venstre hofte', 'Højre hofte'], 227, 91),
        sides(front, ['Venstre lår', 'Højre lår'], 273, 98),
        sides(front, ['Venstre knæ', 'Højre knæ'], 317, 99),
        sides(front, ['Venstre underben', 'Højre underben'], 351, 98),
        sides(front, ['Venstre fod', 'Højre fod'], 399, 94));
  }

  function head(front) {
    return front ? [area('Isse',120,85),area('Pande',120,143)]
      .concat(sides(true,['Venstre tinding','Højre tinding'],174,49),
        sides(true,['Bag venstre øje','Bag højre øje'],188,94),
        sides(true,['Venstre kæbe','Højre kæbe'],258,73))
      : [area('Isse',120,85),area('Midt på baghovedet',120,183),area('Nakke',120,293)]
        .concat(pairs(['Venstre baghoved','Højre baghoved'],207,69));
  }

  function back() {
    var zones = [area('Nakke',120,68), area('Venstre skulderblad',57,117), area('Højre skulderblad',183,117)];
    ['Øvre ryg','Midtryg','Lænd'].forEach(function (row, index) {
      ['venstre','midten','højre'].forEach(function (side, column) {
        zones.push(area(row + ', ' + side, 76 + column * 44, 155 + 63 * index));
      });
    });
    return zones.concat([area('Korsben',120,350)]);
  }

  var silhouette = 'M120 26 C99 26 89 40 91 59 C87 58 89 72 97 78 Q103 88 108 91 L105 102 Q98 106 82 109 Q67 112 64 131 L53 175 39 222 Q28 241 30 254 Q33 267 40 264 L50 249 Q55 244 53 236 L68 204 84 158 Q89 177 87 194 Q80 216 82 243 L89 295 Q89 312 87 326 Q84 350 92 378 Q93 388 83 398 Q79 406 87 408 L103 408 Q111 406 109 399 L107 378 Q111 357 110 335 L111 313 120 245 129 313 130 335 Q129 357 133 378 L131 399 Q129 406 137 408 L153 408 Q161 406 157 398 Q147 388 148 378 Q156 350 153 326 Q151 312 151 295 L158 243 Q160 216 153 194 Q151 177 156 158 L172 204 187 236 Q185 244 190 249 L200 264 Q207 267 210 254 Q212 241 201 222 L187 175 176 131 Q173 112 158 109 Q142 106 135 102 L132 91 Q137 88 143 78 C151 72 153 58 149 59 C151 40 141 26 120 26 Z';
  var headOutline = 'M120 65 C70 65 43 104 47 164 C27 159 31 208 51 217 C56 250 76 276 97 286 L93 325 147 325 143 286 C164 276 184 250 189 217 C209 208 213 159 193 164 C197 104 170 65 120 65 Z';
  var backOutline = 'M92 46 Q120 60 148 46 L151 76 Q164 84 187 89 Q218 98 211 140 L187 181 Q169 217 172 238 Q174 269 187 295 L190 349 Q175 378 120 384 Q65 378 50 349 L53 295 Q66 269 68 238 Q71 217 53 181 L29 140 Q22 98 53 89 Q76 84 89 76 Z';

  function details(map, front) {
    if (map === 'back') return 'M120 79 V326 M54 101 Q59 142 95 145 M186 101 Q181 142 145 145 M60 183 Q120 205 180 183 M65 250 Q120 270 175 250 M54 318 Q120 336 186 318';
    if (map === 'head') return front
      ? 'M67 174 Q94 158 110 174 M130 174 Q146 158 173 174 M78 194 Q94 182 106 194 M134 194 Q146 182 162 194 M119 192 L111 228 Q120 232 129 228 M94 254 Q120 244 146 254'
      : 'M49 147 Q120 176 191 147 M55 232 Q120 277 185 232 M120 157 V281';
    return front
      ? 'M104 53 H111 M129 53 H136 M115 71 Q120 74 125 71 M86 122 Q105 115 120 125 Q135 115 154 122 M88 155 Q104 165 120 158 Q136 165 152 155 M120 126 V204 M113 191 Q120 196 127 191 M84 217 Q120 233 156 217 M91 314 Q99 309 107 314 M133 314 Q141 309 149 314'
      : 'M120 105 V224 M81 123 Q83 145 105 151 M159 123 Q157 145 135 151 M92 199 Q120 211 148 199 M88 232 Q99 215 120 236 Q141 215 152 232 M92 327 Q99 323 107 327 M133 327 Q141 323 148 327';
  }

  window.MinDagBody = {
    areas: function (map, front) { return map === 'head' ? head(front) : map === 'back' ? back() : full(front); },
    draw: function (canvas, map, front, selected) {
      var ctx = canvas.getContext('2d');
      ctx.setTransform(canvas.width / 240, 0, 0, canvas.height / 430, 0, 0);
      ctx.clearRect(0,0,240,430);
      ctx.fillStyle = '#ecf1e9';
      ctx.beginPath(); ctx.ellipse(120,220,115,202,0,0,Math.PI * 2); ctx.fill();
      var shape = new Path2D(map === 'head' ? headOutline : map === 'back' ? backOutline : silhouette);
      ctx.fillStyle = '#cbdcd0'; ctx.fill(shape);
      ctx.lineWidth = 1.8; ctx.strokeStyle = '#567d74'; ctx.stroke(shape);
      ctx.strokeStyle = '#8eaa9f'; ctx.stroke(new Path2D(details(map, front)));
      this.areas(map, front).forEach(function (zone) {
        var active = zone.label === selected;
        ctx.beginPath(); ctx.arc(zone.x,zone.y,active ? 10 : 5.2,0,Math.PI * 2);
        ctx.fillStyle = active ? '#b64843' : '#32776e'; ctx.fill();
        ctx.lineWidth = 1.8; ctx.strokeStyle = '#fffefa'; ctx.stroke();
      });
    },
    choose: function (canvas, event, map, front) {
      var rect = canvas.getBoundingClientRect();
      var x = (event.clientX - rect.left) * 240 / rect.width;
      var y = (event.clientY - rect.top) * 430 / rect.height;
      var best = null, distance = map === 'full' ? 34 : 32;
      this.areas(map, front).forEach(function (zone) {
        var next = Math.sqrt(Math.pow(zone.x - x, 2) + Math.pow(zone.y - y, 2));
        if (next < distance) { best = zone.label; distance = next; }
      });
      return best;
    }
  };
}());
