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
      .concat(sides(true,['Isse, foran til venstre','Isse, foran til højre'],111,80),
        sides(true,['Venstre tinding','Højre tinding'],174,49),
        sides(true,['Bag venstre øje','Bag højre øje'],188,94),
        sides(true,['Venstre kæbe','Højre kæbe'],258,73))
      : [area('Isse',120,85),area('Midt på baghovedet',120,183),area('Nakke',120,293)]
        .concat(pairs(['Isse, bagtil til venstre','Isse, bagtil til højre'],111,80),
          pairs(['Venstre baghoved','Højre baghoved'],207,69));
  }

  function extremity(map, front, part) {
    var hand = [area('Tommelfinger',54,213),area('Pegefinger',82,119),area('Langfinger',116,87),
      area('Ringfinger',149,109),area('Lillefinger',183,144),area('Knofladen',130,183),
      area(front ? 'Håndflade' : 'Håndryg',121,255),area('Håndled',121,345)];
    var foot = [area('Storetå',64,91),area('Anden tå',104,80),area('Tredje tå',138,92),
      area('Fjerde tå',169,107),area('Lilletå',192,132),area('Forfod',117,159),
      area(front ? 'Vrist' : 'Svang',113,225),area('Hæl',122,326),area('Ankel',124,271)];
    var side = part.split(' ')[0].toLowerCase();
    return (map === 'hand' ? hand : foot).map(function (zone) {
      return area(zone.label + ', ' + side, side === 'venstre' ? 240 - zone.x : zone.x, zone.y);
    });
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
  var handOutline = 'M92 372 L89 314 Q69 291 59 263 L36 220 C28 203 47 190 57 204 L76 226 L68 115 C66 94 87 92 91 113 L100 174 L103 76 C104 53 130 55 130 77 L132 167 L138 96 C140 74 162 76 163 98 L161 177 L174 133 C179 114 200 121 196 141 L188 226 Q184 285 151 315 L151 372 Z';
  var footOutline = 'M102 359 Q77 342 84 305 L92 263 Q89 231 65 199 Q45 169 43 124 L43 91 Q43 55 67 59 Q88 59 86 112 L89 83 Q93 56 110 62 Q123 65 121 111 L124 95 Q130 71 145 78 Q156 84 152 124 L156 111 Q163 90 177 99 Q188 106 181 136 L184 132 Q193 113 205 124 Q219 139 196 173 Q181 197 174 224 Q169 257 165 291 L165 321 Q159 363 128 367 Z';

  function details(map, front) {
    if (map === 'hand') return front ? 'M75 223 Q107 201 161 207 M87 232 Q112 250 105 296 M133 239 Q147 248 165 240 M95 325 Q122 335 149 326'
      : 'M98 189 Q109 220 112 296 M130 183 L128 285 M160 186 Q150 238 142 290 M95 325 Q122 335 149 326';
    if (map === 'foot') return 'M64 132 Q107 112 177 155 M71 191 Q124 169 176 194 M99 254 Q130 233 169 245 M91 303 Q125 284 161 303';
    if (map === 'back') return 'M120 79 V326 M54 101 Q59 142 95 145 M186 101 Q181 142 145 145 M60 183 Q120 205 180 183 M65 250 Q120 270 175 250 M54 318 Q120 336 186 318';
    if (map === 'head') return front
      ? 'M67 174 Q94 158 110 174 M130 174 Q146 158 173 174 M78 194 Q94 182 106 194 M134 194 Q146 182 162 194 M119 192 L111 228 Q120 232 129 228 M94 254 Q120 244 146 254'
      : 'M49 147 Q120 176 191 147 M55 232 Q120 277 185 232 M120 157 V281';
    return front
      ? 'M104 53 H111 M129 53 H136 M115 71 Q120 74 125 71 M86 122 Q105 115 120 125 Q135 115 154 122 M88 155 Q104 165 120 158 Q136 165 152 155 M120 126 V204 M113 191 Q120 196 127 191 M84 217 Q120 233 156 217 M91 314 Q99 309 107 314 M133 314 Q141 309 149 314'
      : 'M120 105 V224 M81 123 Q83 145 105 151 M159 123 Q157 145 135 151 M92 199 Q120 211 148 199 M88 232 Q99 215 120 236 Q141 215 152 232 M92 327 Q99 323 107 327 M133 327 Q141 323 148 327';
  }

  window.MinDagBody = {
    areas: function (map, front, part) {
      if (map === 'hand' || map === 'foot') return extremity(map, front, part);
      return map === 'head' ? head(front) : map === 'back' ? back() : full(front);
    },
    draw: function (canvas, map, front, selected, part) {
      var ctx = canvas.getContext('2d');
      ctx.setTransform(canvas.width / 240, 0, 0, canvas.height / 430, 0, 0);
      ctx.clearRect(0,0,240,430);
      ctx.fillStyle = '#ecf1e9';
      ctx.beginPath(); ctx.ellipse(120,220,115,202,0,0,Math.PI * 2); ctx.fill();
      var outlines = {head:headOutline,back:backOutline,hand:handOutline,foot:footOutline};
      var shape = new Path2D(outlines[map] || silhouette);
      ctx.save();
      if (part && part.indexOf('Venstre ') === 0) { ctx.translate(240,0); ctx.scale(-1,1); }
      ctx.fillStyle = '#cbdcd0'; ctx.fill(shape);
      ctx.lineWidth = 1.8; ctx.strokeStyle = '#567d74'; ctx.stroke(shape);
      ctx.strokeStyle = '#8eaa9f'; ctx.stroke(new Path2D(details(map, front)));
      ctx.restore();
      this.areas(map, front, part).forEach(function (zone) {
        var active = zone.label === selected;
        ctx.beginPath(); ctx.arc(zone.x,zone.y,active ? 10 : 5.2,0,Math.PI * 2);
        ctx.fillStyle = active ? '#b64843' : '#32776e'; ctx.fill();
        ctx.lineWidth = 1.8; ctx.strokeStyle = '#fffefa'; ctx.stroke();
      });
    },
    choose: function (canvas, event, map, front, part) {
      var rect = canvas.getBoundingClientRect();
      var x = (event.clientX - rect.left) * 240 / rect.width;
      var y = (event.clientY - rect.top) * 430 / rect.height;
      var best = null, distance = map === 'full' ? 34 : 32;
      this.areas(map, front, part).forEach(function (zone) {
        var next = Math.sqrt(Math.pow(zone.x - x, 2) + Math.pow(zone.y - y, 2));
        if (next < distance) { best = zone.label; distance = next; }
      });
      return best;
    }
  };
}());
