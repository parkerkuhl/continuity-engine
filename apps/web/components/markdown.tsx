import ReactMarkdown from "react-markdown";

/** Page bodies are Markdown. Raw HTML is not rendered. */
export function Markdown({ children, className = "prose-page" }: { children: string; className?: string }) {
  if (!children.trim()) return <p className="text-faint italic">Empty.</p>;
  return (
    <div className={className}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
