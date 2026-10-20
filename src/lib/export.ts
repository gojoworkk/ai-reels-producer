import type { Script, ScriptBlock } from "./types";

const withDot = (s: string) => (/[.!?…:]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

function blockLines(block: ScriptBlock, md: boolean) {
  const lines = [block.label ? `${md ? `**${withDot(block.label)}**` : withDot(block.label)} ${block.text}` : block.text];
  if (block.visual) lines.push(md ? `_В кадре: ${block.visual}_` : `В кадре: ${block.visual}`);
  return lines;
}

export function scriptToText(script: Script, sourceUrl: string, md: boolean): string {
  const h = (t: string) => (md ? `## ${t}` : t.toUpperCase());
  const out: string[] = [
    md ? `# ${script.title}` : script.title,
    "",
    `${md ? "**Идея:**" : "Идея:"} ${script.idea}`,
    `${md ? "**Почему залетело:**" : "Почему залетело:"} ${script.whyItWorks}`,
    "",
    h("Хук"),
    ...blockLines(script.hook, md),
    "",
    h("Скрипт"),
  ];
  script.body.forEach((b, i) => {
    const [first, ...rest] = blockLines(b, md);
    out.push(`${i + 1}. ${first}`, ...rest.map((l) => `   ${l}`));
  });
  out.push("", h("Call to action"), ...blockLines(script.cta, md), "", h("Описание к посту"), script.caption);
  out.push("", `Оригинал: ${sourceUrl}`);
  return out.join("\n");
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "scenariy"
  );
}
