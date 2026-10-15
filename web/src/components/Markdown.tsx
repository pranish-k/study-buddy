import { isValidElement, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

const components: Components = {
  // Fenced code blocks arrive as <pre><code class="language-x">; render them as a copyable block.
  pre({ children }) {
    const code = Array.isArray(children) ? children[0] : children;
    const className = isValidElement(code)
      ? ((code as ReactElement<{ className?: string }>).props.className ?? '')
      : '';
    const language = /language-([\w+-]+)/.exec(className)?.[1];
    return <CodeBlock code={textOf(code).replace(/\n$/, '')} language={language} />;
  },
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
};

export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}
