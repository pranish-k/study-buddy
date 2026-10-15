import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export function CodeBlock({ code, language }: { code: string; language: string | undefined }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); selecting the text still works.
    }
  };

  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">{language ?? 'code'}</span>
        <button
          type="button"
          className="code-copy"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
