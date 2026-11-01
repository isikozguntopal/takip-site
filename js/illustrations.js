// One drawing per activity, in the app's pastel palette. Each is a complete SVG document so it can be shown on screen
// and also drawn onto a canvas for the PDF.
const C = {
  ink: '#3d1a5e', purple: '#8e5bc2', lilac: '#d9c4ef', pink: '#f48fb1', yellow: '#ffd166',
  teal: '#4fc3c7', green: '#8bd17c', orange: '#ffad5c', blue: '#7fb3ff', white: '#ffffff',
};
const S = `stroke="${C.ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const T = `stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

const frame = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 240 160">
<rect width="240" height="160" rx="18" fill="#f6effc"/>
<circle cx="214" cy="26" r="30" fill="#efe4fa"/><circle cx="24" cy="142" r="22" fill="#efe4fa"/>
${inner}</svg>`;

const ART = {
  mandal: `
    <rect x="50" y="46" width="140" height="84" rx="10" fill="${C.white}" ${S}/>
    ${[[66, C.pink], [98, C.teal], [130, C.yellow], [162, C.green]].map(([x, c]) => `
      <rect x="${x}" y="28" width="12" height="40" rx="4" fill="${c}" ${S}/>
      <circle cx="${x + 6}" cy="42" r="3" fill="${C.white}" ${T}/>`).join('')}`,
  hamur: `
    <path d="M44 118c-12-26 10-52 40-50 14-24 64-26 80 0 26 2 36 36 14 52-30 14-108 16-134-2z" fill="${C.pink}" ${S}/>
    <circle cx="92" cy="98" r="9" fill="${C.yellow}" ${T}/><circle cx="89" cy="96" r="1.5" fill="${C.ink}"/><circle cx="95" cy="100" r="1.5" fill="${C.ink}"/>
    <circle cx="140" cy="88" r="9" fill="${C.teal}" ${T}/><circle cx="137" cy="86" r="1.5" fill="${C.ink}"/><circle cx="143" cy="90" r="1.5" fill="${C.ink}"/>
    <circle cx="118" cy="114" r="7" fill="${C.green}" ${T}/>`,
  boncuk: `
    <path d="M28 56 Q120 150 212 56" fill="none" ${S}/>
    ${[[58, 84, C.pink], [88, 101, C.yellow], [120, 106, C.teal], [152, 101, C.green], [182, 84, C.orange]].map(([x, y, c]) => `
      <circle cx="${x}" cy="${y}" r="13" fill="${c}" ${S}/><circle cx="${x}" cy="${y}" r="3" fill="${C.ink}"/>`).join('')}`,
  masa: `
    <path d="M28 112h64a32 20 0 0 1-64 0z" fill="${C.lilac}" ${S}/>
    <path d="M148 112h64a32 20 0 0 1-64 0z" fill="${C.lilac}" ${S}/>
    <circle cx="48" cy="104" r="8" fill="${C.pink}" ${T}/><circle cx="66" cy="102" r="8" fill="${C.yellow}" ${T}/><circle cx="180" cy="104" r="8" fill="${C.teal}" ${T}/>
    <path d="M100 40 L126 88 M112 36 L132 86" fill="none" stroke="${C.purple}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="129" cy="92" r="8" fill="${C.green}" ${T}/>`,
  cizgi: `
    <rect x="16" y="104" width="208" height="14" rx="4" fill="${C.yellow}" ${S}/>
    ${[[40, 96], [84, 92], [128, 96], [172, 92]].map(([x, y], i) => `
      <ellipse cx="${x}" cy="${y - 40}" rx="9" ry="14" fill="${i % 2 ? C.teal : C.pink}" ${T}/>
      <circle cx="${x - 5}" cy="${y - 58}" r="3" fill="${C.ink}"/><circle cx="${x + 3}" cy="${y - 59}" r="3" fill="${C.ink}"/>`).join('')}`,
  hayvan: [[56, 112], [120, 82], [184, 52]].map(([x, y], i) => `
    <ellipse cx="${x}" cy="${y}" rx="18" ry="14" fill="${[C.orange, C.pink, C.teal][i]}" ${S}/>
    <circle cx="${x - 18}" cy="${y - 20}" r="6" fill="${[C.orange, C.pink, C.teal][i]}" ${T}/>
    <circle cx="${x - 4}" cy="${y - 26}" r="6" fill="${[C.orange, C.pink, C.teal][i]}" ${T}/>
    <circle cx="${x + 12}" cy="${y - 24}" r="6" fill="${[C.orange, C.pink, C.teal][i]}" ${T}/>`).join(''),
  top: `
    <path d="M30 120 Q70 40 120 70" fill="none" stroke="${C.purple}" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round"/>
    <circle cx="154" cy="76" r="36" fill="${C.pink}" ${S}/>
    <path d="M118 76h72M154 40v72" fill="none" ${S}/>
    <path d="M128 52 Q154 76 128 100M180 52 Q154 76 180 100" fill="none" ${T}/>`,
  parkur: `
    <rect x="22" y="104" width="56" height="22" rx="10" fill="${C.teal}" ${S}/>
    <rect x="30" y="84" width="40" height="20" rx="9" fill="${C.yellow}" ${S}/>
    <rect x="104" y="64" width="110" height="10" rx="3" fill="${C.orange}" ${S}/>
    <path d="M112 74v52M206 74v52" ${S}/>
    <path d="M118 126 Q160 92 200 126" fill="${C.lilac}" ${T}/>
    <path d="M60 70 Q90 30 130 50" fill="none" stroke="${C.purple}" stroke-width="3" stroke-dasharray="5 7" stroke-linecap="round"/>`,
  yirtma: `
    <path d="M30 40l50-6 6 12 8-4 4 44-62 6z" fill="${C.pink}" ${S}/>
    <path d="M104 30l56 4-4 10 8 8-6 40-56-4z" fill="${C.teal}" ${S}/>
    <path d="M150 92l60 6-4 38-8-6-6 10-46-6z" fill="${C.yellow}" ${S}/>
    <path d="M52 110l48 2-2 30-50-4z" fill="${C.green}" ${S}/>`,
  kavanoz: `
    <rect x="44" y="60" width="62" height="74" rx="14" fill="${C.lilac}" ${S}/>
    <rect x="40" y="44" width="70" height="18" rx="5" fill="${C.pink}" ${S}/>
    <rect x="134" y="74" width="56" height="60" rx="12" fill="${C.lilac}" ${S}/>
    <rect x="130" y="58" width="64" height="16" rx="5" fill="${C.teal}" ${S}/>
    <path d="M58 28 Q75 16 92 28" fill="none" ${T}/><path d="M88 22l4 6-7 1" fill="none" ${T}/>`,
  kesme: `
    <rect x="96" y="30" width="124" height="100" rx="6" fill="${C.white}" ${S}/>
    <path d="M100 80h116" fill="none" stroke="${C.purple}" stroke-width="3" stroke-dasharray="8 6"/>
    <circle cx="40" cy="64" r="14" fill="none" stroke="${C.pink}" stroke-width="6"/>
    <circle cx="40" cy="98" r="14" fill="none" stroke="${C.pink}" stroke-width="6"/>
    <path d="M52 70 L112 82 M52 92 L112 78" fill="none" ${S}/>`,
  ritim: `
    <path d="M70 128 v-40 a50 18 0 0 1 100 0 v40z" fill="${C.lilac}" ${S}/>
    <ellipse cx="120" cy="88" rx="50" ry="14" fill="${C.purple}" ${S}/>
    <path d="M64 36 L100 76 M176 36 L140 76" fill="none" stroke="${C.orange}" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="62" cy="33" rx="9" ry="6" fill="${C.orange}" ${T}/><ellipse cx="178" cy="33" rx="9" ry="6" fill="${C.orange}" ${T}/>
    <path d="M118 30v20" ${T}/><circle cx="114" cy="50" r="5" fill="${C.ink}"/><path d="M118 30l10 4" ${T}/>`,
  duyu: `
    <path d="M30 70h180l-14 64H44z" fill="${C.orange}" ${S}/>
    ${Array.from({ length: 26 }, (_, i) => `<circle cx="${46 + (i % 13) * 12 + (i > 12 ? 6 : 0)}" cy="${76 + (i > 12 ? 10 : 0)}" r="3.5" fill="${C.yellow}"/>`).join('')}
    <path d="M120 40l7 14 15 2-11 10 3 15-14-7-14 7 3-15-11-10 15-2z" fill="${C.pink}" ${S}/>`,
  agir: `
    <path d="M52 64h136l-12 66H64z" fill="${C.lilac}" ${S}/>
    <path d="M70 64l6 66M94 64l3 66M120 64v66M146 64l-3 66M170 64l-6 66" fill="none" ${T}/>
    <rect x="80" y="36" width="20" height="30" rx="2" fill="${C.teal}" ${S}/>
    <rect x="104" y="30" width="20" height="36" rx="2" fill="${C.pink}" ${S}/>
    <rect x="128" y="40" width="20" height="26" rx="2" fill="${C.yellow}" ${S}/>
    <path d="M208 120V40M198 52l10-12 10 12" fill="none" stroke="${C.purple}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  sandvic: `
    <rect x="70" y="100" width="140" height="30" rx="14" fill="${C.teal}" ${S}/>
    <rect x="70" y="58" width="140" height="30" rx="14" fill="${C.pink}" ${S}/>
    <rect x="76" y="86" width="128" height="16" rx="6" fill="${C.yellow}" ${T}/>
    <circle cx="52" cy="94" r="20" fill="#ffe0c2" ${S}/>
    <circle cx="45" cy="90" r="2.5" fill="${C.ink}"/><circle cx="58" cy="90" r="2.5" fill="${C.ink}"/>
    <path d="M45 100 Q52 106 59 100" fill="none" ${T}/>`,
  nefes: `
    <ellipse cx="84" cy="62" rx="34" ry="40" fill="${C.pink}" ${S}/>
    <path d="M84 102l-6 8h12z" fill="${C.pink}" ${T}/><path d="M84 110 Q74 128 88 146" fill="none" ${T}/>
    <path d="M138 108h56" stroke="${C.teal}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="214" cy="108" r="10" fill="${C.white}" ${S}/>
    <path d="M150 90h20M160 80h22M154 126h18" stroke="${C.purple}" stroke-width="3" stroke-linecap="round"/>`,
  sekil: `
    <circle cx="44" cy="54" r="18" fill="${C.pink}" ${S}/>
    <rect x="74" y="36" width="34" height="34" rx="3" fill="${C.teal}" ${S}/>
    <path d="M52 92l20 36H32z" fill="${C.yellow}" ${S}/>
    <path d="M96 92l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="${C.green}" ${S}/>
    <g fill="none" stroke="${C.purple}" stroke-width="3" stroke-dasharray="5 5">
      <circle cx="160" cy="54" r="18"/><rect x="186" y="36" width="34" height="34" rx="3"/>
      <path d="M168 92l20 36h-40z"/><path d="M208 92l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z"/>
    </g>`,
  labirent: `
    <rect x="40" y="24" width="160" height="112" rx="8" fill="${C.white}" ${S}/>
    <path d="M72 24v56M104 136V64M136 24v52M168 136V60M72 108h-32M136 104h32" fill="none" ${S}/>
    <path d="M56 40v52h32V50h32v62h32V44h32v70" fill="none" stroke="${C.pink}" stroke-width="4" stroke-dasharray="2 7" stroke-linecap="round"/>
    <circle cx="56" cy="40" r="6" fill="${C.green}" ${T}/>
    <path d="M184 112l4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1z" fill="${C.yellow}" ${T}/>`,
  gizli: `
    <circle cx="44" cy="44" r="10" fill="${C.teal}" ${T}/><rect x="168" y="30" width="20" height="20" rx="3" fill="${C.yellow}" ${T}/>
    <path d="M40 112l12 22H28z" fill="${C.green}" ${T}/><circle cx="196" cy="118" r="10" fill="${C.orange}" ${T}/>
    <rect x="60" y="74" width="18" height="18" rx="3" fill="${C.pink}" ${T}/>
    <circle cx="124" cy="76" r="34" fill="${C.white}" ${S}/>
    <path d="M124 64l5 10 11 1-8 7 2 11-10-5-10 5 2-11-8-7 11-1z" fill="${C.pink}" ${T}/>
    <path d="M148 100l26 26" stroke="${C.purple}" stroke-width="9" stroke-linecap="round"/>`,
  blok: `
    ${[[40, 104, C.pink], [40, 74, C.teal], [40, 44, C.yellow], [70, 104, C.green]].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="30" height="30" rx="4" fill="${c}" ${S}/>`).join('')}
    ${[[140, 104, C.pink], [140, 74, C.teal], [170, 104, C.green]].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="30" height="30" rx="4" fill="${c}" ${S}/>`).join('')}
    <rect x="140" y="44" width="30" height="30" rx="4" fill="none" stroke="${C.purple}" stroke-width="3" stroke-dasharray="5 5"/>
    <path d="M108 86h20M120 78l8 8-8 8" fill="none" ${T}/>`,
  dugme: `
    <path d="M70 30l30-6 20 14 20-14 30 6 30 30-18 16-12-10v74H70V66l-12 10-18-16z" fill="${C.teal}" ${S}/>
    <path d="M120 38v112" fill="none" ${T}/>
    ${[60, 86, 112, 138].map((y) => `<circle cx="120" cy="${y}" r="7" fill="${C.yellow}" ${T}/>`).join('')}`,
  giyinme: `
    <path d="M24 46h18v40l14 10a8 8 0 0 1-6 14H32a8 8 0 0 1-8-8z" fill="${C.pink}" ${S}/>
    <path d="M90 50l14-8h24l14 8 10 18-12 6-6-8v40h-36V66l-6 8-12-6z" fill="${C.yellow}" ${S}/>
    <path d="M178 46h40v24l-6 52h-12l-2-40-2 40h-12l-6-52z" fill="${C.teal}" ${S}/>
    <path d="M62 78h18M74 72l6 6-6 6M156 78h16M166 72l6 6-6 6" fill="none" ${T}/>`,
  dis: `
    <path d="M62 44c14-12 30-4 38 0 8-4 24-12 38 0 12 12 4 40-2 58-4 14-8 30-16 30s-8-22-20-22-12 22-20 22-12-16-16-30c-6-18-14-46-2-58z" fill="${C.white}" ${S}/>
    <circle cx="86" cy="70" r="3" fill="${C.ink}"/><circle cx="114" cy="70" r="3" fill="${C.ink}"/>
    <path d="M90 84 Q100 92 110 84" fill="none" ${T}/>
    <rect x="150" y="96" width="74" height="14" rx="7" fill="${C.teal}" ${S}/>
    <rect x="198" y="74" width="26" height="22" rx="3" fill="${C.white}" ${S}/>
    <path d="M204 74v-8M211 74v-10M218 74v-8" ${T}/>`,
  kasik: `
    <path d="M24 104h66a33 22 0 0 1-66 0z" fill="${C.lilac}" ${S}/>
    <path d="M150 104h66a33 22 0 0 1-66 0z" fill="${C.lilac}" ${S}/>
    ${[[42, 98], [56, 96], [70, 99], [176, 99]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="4.5" fill="${C.orange}" ${T}/>`).join('')}
    <ellipse cx="120" cy="58" rx="16" ry="11" fill="${C.white}" ${S}/>
    <path d="M134 64l40 26" stroke="${C.purple}" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="118" cy="56" rx="6" ry="4" fill="${C.orange}" ${T}/>`,
  trafik: `
    <rect x="94" y="16" width="52" height="128" rx="14" fill="${C.ink}"/>
    <circle cx="120" cy="44" r="15" fill="#ef5350"/><circle cx="120" cy="80" r="15" fill="${C.yellow}"/><circle cx="120" cy="116" r="15" fill="${C.green}"/>
    <path d="M40 60 Q56 46 72 60 M168 104 Q184 90 200 104" fill="none" stroke="${C.purple}" stroke-width="3" stroke-linecap="round"/>`,
  yonerge: [[20, C.pink, '1'], [92, C.yellow, '2'], [164, C.teal, '3']].map(([x, c, n], i) => `
    <rect x="${x}" y="46" width="56" height="70" rx="10" fill="${c}" ${S}/>
    <text x="${x + 28}" y="92" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="${C.ink}" text-anchor="middle">${n}</text>
    ${i < 2 ? `<path d="M${x + 60} 81h10M${x + 66} 76l5 5-5 5" fill="none" ${T}/>` : ''}`).join(''),
  kumsaati: `
    <rect x="80" y="18" width="80" height="12" rx="5" fill="${C.orange}" ${S}/>
    <rect x="80" y="130" width="80" height="12" rx="5" fill="${C.orange}" ${S}/>
    <path d="M92 30h56c0 30-22 38-22 50s22 20 22 50H92c0-30 22-38 22-50s-22-20-22-50z" fill="${C.white}" ${S}/>
    <path d="M104 46h32c-4 12-16 18-16 24-0-6-12-12-16-24z" fill="${C.yellow}"/>
    <path d="M98 128c2-14 14-22 22-22s20 8 22 22z" fill="${C.yellow}"/>
    <path d="M120 82v20" stroke="${C.yellow}" stroke-width="3"/>`,
  hafiza: [0, 1, 2, 3, 4, 5].map((i) => {
    const x = 36 + (i % 3) * 60;
    const y = 26 + Math.floor(i / 3) * 60;
    const open = i === 1 || i === 5;
    return `<rect x="${x}" y="${y}" width="48" height="50" rx="8" fill="${open ? C.white : C.purple}" ${S}/>
      ${open ? `<path d="M${x + 24} ${y + 38}c-14-10-18-16-12-22 4-4 10-2 12 2 2-4 8-6 12-2 6 6 2 12-12 22z" fill="${C.pink}" ${T}/>` : `<circle cx="${x + 24}" cy="${y + 25}" r="6" fill="${C.lilac}"/>`}`;
  }).join(''),
  tuz: `
    <rect x="26" y="40" width="188" height="96" rx="12" fill="${C.orange}" ${S}/>
    <rect x="38" y="52" width="164" height="72" rx="8" fill="#fff4dc"/>
    <path d="M52 100 Q72 64 92 100 T132 100 T172 100" fill="none" stroke="${C.purple}" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="178" cy="94" rx="10" ry="14" fill="#ffe0c2" ${S}/>`,
  dikey: `
    <rect x="52" y="14" width="136" height="110" rx="4" fill="${C.white}" ${S}/>
    <rect x="70" y="8" width="24" height="10" fill="${C.yellow}" opacity="0.8"/><rect x="146" y="8" width="24" height="10" fill="${C.yellow}" opacity="0.8"/>
    <path d="M120 68m-30 0a30 30 0 1 0 60 0a30 30 0 1 0-60 0M120 68m-16 0a16 16 0 1 0 32 0a16 16 0 1 0-32 0" fill="none" stroke="${C.pink}" stroke-width="5"/>
    <path d="M150 140l30-36" stroke="${C.teal}" stroke-width="10" stroke-linecap="round"/>
    <path d="M118 140h20" ${T}/>`,
  nokta: (() => {
    const pts = [[120, 22], [136, 60], [178, 62], [146, 88], [158, 130], [120, 106], [82, 130], [94, 88], [62, 62], [104, 60]];
    const done = pts.slice(0, 6).map(([x, y]) => `${x},${y}`).join(' ');
    return `<polyline points="${done}" fill="none" stroke="${C.purple}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="5" fill="${i < 6 ? C.pink : C.white}" ${T}/>`).join('')}`;
  })(),
  kisaboya: `
    ${[[40, C.pink], [84, C.teal], [128, C.yellow]].map(([x, c]) => `
      <rect x="${x}" y="40" width="20" height="36" rx="4" fill="${c}" ${S}/><path d="M${x} 48h20" ${T}/>
      <path d="M${x + 2} 40l8-12 8 12" fill="${c}" ${T}/>`).join('')}
    <path d="M36 118 Q60 96 80 118 T124 118 T168 118 T208 112" fill="none" stroke="${C.purple}" stroke-width="5" stroke-linecap="round"/>
    <path d="M176 44 Q196 30 212 52" fill="none" stroke="${C.green}" stroke-width="5" stroke-linecap="round"/>`,
};

export function illustration(id) {
  return frame(ART[id] ?? '');
}

export function hasIllustration(id) {
  return id in ART;
}
