import ReactMarkdown from "react-markdown";

/** Page bodies are Markdown. Raw HTML is not rendered. */
export function Markdown({ children }: { children: string }) {
  if (!children.trim()) return <p className="text-stone-400 italic">Empty.</p>;
  return (
    <div className="prose-page">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
