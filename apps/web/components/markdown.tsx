import ReactMarkdown from "react-markdown";
import { autolink, type LinkTarget } from "@continuity/core/autolink";

/**
 * Page bodies are Markdown. Raw HTML is not rendered. With `links`, names of other pages (and [[Name]]) link
 * to them (UX review #14); the stored text is unchanged.
 */
export function Markdown({ children, className = "prose-page", links, self }: { children: string; className?: string; links?: LinkTarget[]; self?: string }) {
  if (!children.trim()) return <p className="text-faint italic">Empty.</p>;
  return (
    <div className={className}>
      <ReactMarkdown>{links?.length ? autolink(children, links, self ? { self } : {}) : children}</ReactMarkdown>
    </div>
  );
}
