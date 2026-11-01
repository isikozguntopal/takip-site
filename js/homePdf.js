// Builds the home activity PDF on the phone. The PDF library and the font are loaded only when a PDF is made,
// and nothing leaves the phone: the file is handed to the share sheet or downloaded.
import { illustration } from './illustrations.js';
import { adaptationsFor, tipsFor } from './activities.js';

const PAGE = { w: 210, h: 297, margin: 16, bottom: 278 };
const COLOR = {
  ink: [61, 26, 94],
  purple: [91, 42, 134],
  muted: [142, 91, 194],
  soft: [243, 235, 250],
  line: [217, 196, 239],
  pink: [194, 24, 91],
  pinkSoft: [253, 231, 239],
  white: [255, 255, 255],
};

const TURKISH_ASCII = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u' };

// "Ilgaz Yılmaz", "2026-11-01" -> "ev-aktiviteleri-ilgaz-yilmaz-2026-11-01.pdf"
export function pdfFileName(childName, dateKey) {
  const slug = childName
    .toLocaleLowerCase('tr-TR')
    .replace(/i̇|[çğıöşü]/g, (c) => TURKISH_ASCII[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `ev-aktiviteleri-${slug || 'danisan'}-${dateKey}.pdf`;
}

let library;
function loadLibrary() {
  library ??= new Promise((resolve, reject) => {
    if (window.jspdf) return resolve(window.jspdf.jsPDF);
    const script = document.createElement('script');
    script.src = 'vendor/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = () => {
      library = null;
      reject(new Error('PDF kütüphanesi yüklenemedi'));
    };
    document.head.appendChild(script);
  });
  return library;
}

async function fontBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Yazı tipi yüklenemedi: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function svgToPng(svg) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 320;
  canvas.getContext('2d').drawImage(image, 0, 0, 480, 320);
  return canvas.toDataURL('image/png');
}

// items: [{ activity, note }] in the order they should appear.
export async function buildHomePdf({ childName, author, dateLabel, intro, flags, items, areaLabels }) {
  const JsPDF = await loadLibrary();
  const [regular, bold] = await Promise.all([fontBase64('fonts/Nunito-Regular.ttf'), fontBase64('fonts/Nunito-Bold.ttf')]);
  const images = await Promise.all(items.map(({ activity }) => svgToPng(illustration(activity.id))));

  // Compressed, so a program with many pictures stays small enough to send over WhatsApp.
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('Nunito-Regular.ttf', regular);
  doc.addFont('Nunito-Regular.ttf', 'Nunito', 'normal');
  doc.addFileToVFS('Nunito-Bold.ttf', bold);
  doc.addFont('Nunito-Bold.ttf', 'Nunito', 'bold');

  const width = PAGE.w - PAGE.margin * 2;
  let y = PAGE.margin;

  const lineHeight = (size) => size * 0.3528 * 1.38;
  const style = (size, weight = 'normal', color = COLOR.ink) => {
    doc.setFont('Nunito', weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const wrap = (text, size, w, weight = 'normal') => {
    style(size, weight);
    return doc.splitTextToSize(String(text), w);
  };
  const ensure = (height) => {
    if (y + height > PAGE.bottom) {
      doc.addPage();
      y = PAGE.margin;
    }
  };
  const write = (text, { size = 10.5, weight = 'normal', color = COLOR.ink, x = PAGE.margin, w = width, after = 1.5 } = {}) => {
    const lines = wrap(text, size, w, weight);
    for (const line of lines) {
      ensure(lineHeight(size));
      style(size, weight, color);
      doc.text(line, x, y, { baseline: 'top' });
      y += lineHeight(size);
    }
    y += after;
  };
  const heart = (cx, cy, s, color) => {
    doc.setFillColor(...color);
    doc.circle(cx - s / 2, cy, s / 2, 'F');
    doc.circle(cx + s / 2, cy, s / 2, 'F');
    doc.triangle(cx - s * 0.98, cy + s * 0.2, cx + s * 0.98, cy + s * 0.2, cx, cy + s * 1.35, 'F');
  };
  // A soft box behind a few lines of text, kept on one page.
  const box = (label, text, { fill = COLOR.soft, labelColor = COLOR.purple } = {}) => {
    const lines = wrap(text, 10.5, width - 10);
    const height = 4 + lineHeight(10) + lines.length * lineHeight(10.5) + 2.5;
    ensure(height);
    doc.setFillColor(...fill);
    doc.roundedRect(PAGE.margin, y, width, height, 3, 3, 'F');
    let ty = y + 4;
    style(10, 'bold', labelColor);
    doc.text(label, PAGE.margin + 5, ty, { baseline: 'top' });
    ty += lineHeight(10);
    style(10.5, 'normal', COLOR.ink);
    for (const line of lines) {
      doc.text(line, PAGE.margin + 5, ty, { baseline: 'top' });
      ty += lineHeight(10.5);
    }
    y += height + 4;
  };
  const heading = (text) => {
    ensure(14);
    y += 2;
    write(text, { size: 14, weight: 'bold', color: COLOR.purple, after: 2 });
  };

  // ---- Cover band ----
  doc.setFillColor(...COLOR.purple);
  doc.rect(0, 0, PAGE.w, 48, 'F');
  doc.setFillColor(142, 91, 194);
  doc.circle(190, 8, 24, 'F');
  doc.circle(206, 44, 12, 'F');
  heart(PAGE.margin + 4, 16, 3.4, [255, 209, 230]);
  style(22, 'bold', COLOR.white);
  doc.text('Ev Aktivite Programı', PAGE.margin + 11, 12, { baseline: 'top' });
  style(13, 'normal', COLOR.white);
  doc.text(`${childName} için hazırlandı`, PAGE.margin, 27, { baseline: 'top' });
  style(10, 'normal', [231, 214, 251]);
  doc.text(author ? `${dateLabel}  ·  Hazırlayan: ${author}` : dateLabel, PAGE.margin, 36, { baseline: 'top' });
  y = 58;

  if (intro?.trim()) box('Aileye not', intro.trim());

  write('Her gün 1-2 aktivite seçin; 10-15 dakika yeterlidir. Oyun gibi tutun, çabasını övün ve zorlamayın. '
    + 'Zorlandığı bir adım olursa bir sonraki seansta birlikte bakalım.', { size: 10.5, color: COLOR.ink, after: 3 });

  if (areaLabels.length) {
    heading('Çalıştığımız alanlar');
    write(areaLabels.join('  ·  '), { size: 10.5, after: 2 });
  }

  const tips = tipsFor(flags);
  if (tips.length) {
    heading('Çocuğunuz için dikkat edilecekler');
    for (const tip of tips) write(`•  ${tip.label}: ${tip.text}`, { x: PAGE.margin + 2, w: width - 2, after: 1 });
    y += 2;
  }

  heading('Aktiviteler');

  items.forEach(({ activity, note }, index) => {
    const imageW = 54;
    const imageH = 36;
    const textX = PAGE.margin + imageW + 6;
    const textW = width - imageW - 6;
    const titleLines = wrap(`${index + 1}. ${activity.title}`, 13.5, textW, 'bold');
    const goalLines = wrap(activity.goal, 10.5, textW);
    ensure(Math.max(imageH, titleLines.length * lineHeight(13.5) + goalLines.length * lineHeight(10.5)) + 20);

    if (index > 0) {
      doc.setDrawColor(...COLOR.line);
      doc.setLineWidth(0.4);
      doc.line(PAGE.margin, y, PAGE.margin + width, y);
      y += 5;
    }
    const top = y;
    doc.addImage(images[index], 'PNG', PAGE.margin, top, imageW, imageH, `art-${activity.id}`, 'FAST');
    let ty = top + 1;
    style(13.5, 'bold', COLOR.purple);
    for (const line of titleLines) {
      doc.text(line, textX, ty, { baseline: 'top' });
      ty += lineHeight(13.5);
    }
    ty += 1;
    style(10.5, 'normal', COLOR.ink);
    for (const line of goalLines) {
      doc.text(line, textX, ty, { baseline: 'top' });
      ty += lineHeight(10.5);
    }
    y = Math.max(top + imageH, ty) + 4;

    write('Malzemeler', { size: 10.5, weight: 'bold', color: COLOR.purple, after: 0.5 });
    write(activity.materials, { after: 2.5 });

    write('Nasıl yapılır', { size: 10.5, weight: 'bold', color: COLOR.purple, after: 0.5 });
    activity.steps.forEach((step, i) => {
      const lines = wrap(step, 10.5, width - 8);
      ensure(lineHeight(10.5));
      style(10.5, 'bold', COLOR.muted);
      doc.text(`${i + 1}.`, PAGE.margin + 1, y, { baseline: 'top' });
      style(10.5, 'normal', COLOR.ink);
      for (const line of lines) {
        ensure(lineHeight(10.5));
        doc.text(line, PAGE.margin + 8, y, { baseline: 'top' });
        y += lineHeight(10.5);
      }
      y += 0.8;
    });
    y += 1.5;

    write(`İpucu: ${activity.tip}`, { size: 10, color: COLOR.muted, after: 2.5 });

    const adaptations = adaptationsFor(activity, flags);
    if (adaptations.length) {
      box('Çocuğunuza özel', adaptations.map((a) => `•  ${a.label}: ${a.text}`).join('\n'), {
        fill: COLOR.pinkSoft,
        labelColor: COLOR.pink,
      });
    }
    if (note?.trim()) box('Terapist notu', note.trim());
    y += 3;
  });

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...COLOR.line);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, 285, PAGE.w - PAGE.margin, 285);
    heart(PAGE.margin + 1.6, 289.2, 1.6, COLOR.pink);
    style(8.5, 'normal', COLOR.muted);
    doc.text(`Küçük adımlar, büyük gelişmeler.  ·  ${childName}`, PAGE.margin + 5, 288, { baseline: 'top' });
    doc.text(`${page} / ${pages}`, PAGE.w - PAGE.margin, 288, { baseline: 'top', align: 'right' });
  }

  return doc.output('blob');
}

// On a phone the share sheet offers "Dosyalara Kaydet" and messaging apps; elsewhere the file downloads directly.
export async function savePdf(blob, name) {
  const file = new File([blob], name, { type: 'application/pdf' });
  if (navigator.maxTouchPoints > 0 && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
