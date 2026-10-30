import PDFDocument from 'pdfkit';
import { openSync, type Font } from 'fontkit';
import { resolve } from 'node:path';
import type { ResumeContent } from '../schemas/resume.schema';

export class PdfValidationError extends Error { status = 422; }
export type TextBlock = { text: string; kind: 'name' | 'headline' | 'contact' | 'section' | 'title' | 'body'; link?: string };
export function resumeBlocks(content: ResumeContent): TextBlock[] {
  const blocks: TextBlock[] = [];
  const add = (text: string, kind: TextBlock['kind'] = 'body', link?: string) => { if (text.trim()) blocks.push({ text, kind, link }); };
  add(content.fullName, 'name'); add(content.headline, 'headline');
  add([content.contact.email, content.contact.phone, content.contact.location].filter(Boolean).join(' · '), 'contact');
  for (const key of ['website', 'linkedin', 'github'] as const) add(content.contact[key], 'contact', content.contact[key]);
  for (const key of content.sectionOrder) {
    const start = blocks.length;
    const labels: Record<string, string> = { summary: 'Summary', skills: 'Skills', experience: 'Experience', projects: 'Projects', education: 'Education', certifications: 'Certifications', achievements: 'Achievements' };
    const custom = content.customSections.find(section => `custom:${section.id}` === key);
    add(labels[key] ?? custom?.title ?? 'Custom section', 'section');
    if (key === 'summary') add(content.summary);
    else if (key === 'skills') add(content.skills.map(skill => skill.trim()).filter(Boolean).join(' · '));
    else if (key === 'experience') for (const item of content.experience) { add([item.role, item.company].filter(Boolean).join(' · '), 'title'); add([item.start, item.end].filter(Boolean).join(' – ')); item.bullets.forEach(bullet => { if (bullet.trim()) add(`• ${bullet}`); }); }
    else if (key === 'projects') for (const item of content.projects) { add(item.name, 'title'); add(item.description); add(item.tech.map(value => value.trim()).filter(Boolean).join(' · ')); add(item.link, 'body', item.link); }
    else if (key === 'education') for (const item of content.education) { add(item.degree, 'title'); add([item.school, item.year].filter(Boolean).join(' · ')); }
    else if (key === 'certifications') for (const item of content.certifications) { add(item.name, 'title'); add([item.issuer, item.date].filter(Boolean).join(' · ')); add(item.link, 'body', item.link); }
    else if (key === 'achievements') for (const item of content.achievements) { add(item.title, 'title'); add(item.date); add(item.description); }
    else if (custom) add(custom.body);
    if (blocks.length === start + 1) blocks.pop();
  }
  return blocks;
}

const fontCache = new Map<string, Font>();
function fontPath(name: string) { return resolve(__dirname, '../../assets/fonts', `${name}-Regular.ttf`); }
function font(name: string) {
  let value = fontCache.get(name);
  if (!value) { value = openSync(fontPath(name)) as Font; fontCache.set(name, value); }
  return value;
}
export function pdfRuns(text: string, primary: string) {
  const runs: { font: string; text: string }[] = [];
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 32 && char !== '\n' && char !== '\t') throw new PdfValidationError('Remove unsupported control characters before exporting.');
    const chosen = code === 0x200d || code === 0x200c ? runs.at(-1)?.font ?? primary : code >= 0x900 && code <= 0x97f ? 'NotoSansDevanagari' : primary;
    if (!/\s/u.test(char) && !font(chosen).hasGlyphForCodePoint(code) && code !== 0x200d && code !== 0x200c) {
      throw new PdfValidationError(`The beta PDF fonts do not support U+${code.toString(16).toUpperCase()}. Remove that symbol or download your JSON draft.`);
    }
    if (runs.at(-1)?.font === chosen) runs[runs.length - 1].text += char;
    else runs.push({ font: chosen, text: char });
  }
  return runs;
}
export async function renderPdf(content: ResumeContent, pageSize: 'A4' | 'LETTER' = 'A4') {
  const blocks = resumeBlocks(content);
  if (!content.fullName.trim()) throw new PdfValidationError('Add your name before exporting a PDF.');
  const primary = { sans: 'NotoSans', serif: 'NotoSerif', mono: 'NotoSansMono' }[content.presentation.font];
  const prepared = blocks.map(block => ({ ...block, runs: pdfRuns(block.text, primary) }));
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: pageSize, margin: 44, bufferPages: true, info: { Title: content.title, Author: content.fullName, Creator: 'DevInterview Hub' } });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(Buffer.from(chunk))); doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    let pages = 1;
    doc.on('pageAdded', () => { if (++pages > 20) throw new PdfValidationError('PDF exports are limited to 20 pages. Shorten the resume or choose compact spacing.'); });
    try {
      const accent = { slate: '#334155', emerald: '#047857', blue: '#1d4ed8', burgundy: '#9f1239' }[content.presentation.color];
      const size = { small: 9, medium: 10.5, large: 12 }[content.presentation.fontSize];
      const gap = { compact: 0.2, comfortable: 0.45, spacious: 0.7 }[content.presentation.spacing];
      const developer = ['developer', 'modern'].includes(content.presentation.template);
      if (developer) doc.rect(44, 35, doc.page.width - 88, 4).fill(accent);
      for (const block of prepared) {
        if (block.kind === 'section') { if (doc.y > doc.page.height - 110) doc.addPage(); doc.moveDown(gap + 0.2); }
        const fontSize = block.kind === 'name' ? 23 : block.kind === 'section' ? size + 1.5 : block.kind === 'headline' ? size + 2 : size;
        doc.fillColor(['section', 'headline'].includes(block.kind) ? accent : '#18181b').fontSize(fontSize);
        for (const [index, run] of block.runs.entries()) {
          doc.font(fontPath(run.font)).text(run.text, { continued: index < block.runs.length - 1,
            lineGap: content.presentation.spacing === 'compact' ? 1 : 3,
            ...(block.link && /^https?:\/\//i.test(block.link.trim()) ? { link: block.link.trim(), underline: true } : {}) });
        }
        if (block.kind === 'section' && content.presentation.template !== 'minimal') doc.moveTo(44, doc.y + 1).lineTo(doc.page.width - 44, doc.y + 1).strokeColor('#d4d4d8').lineWidth(0.5).stroke();
        doc.moveDown(block.kind === 'name' ? 0.25 : gap);
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
