import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Check, Copy, Code2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../store/AppContext';

const CodeBlockComponent = ({ node }) => {
  const { theme: appTheme } = useApp();
  const [copied, setCopied] = useState(false);

  // Determine theme based on app theme
  // User request: Github Dark if light mode, Github Light if dark mode
  const codeBlockTheme = appTheme === 'light' ? 'github-dark' : 'github-light';

  const handleCopy = () => {
    const code = node.textContent;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <NodeViewWrapper className={`code-block-wrapper relative group my-6 rounded-lg overflow-hidden border shadow-sm transition-all duration-200 theme-${codeBlockTheme}`}>
      {/* Header Bar */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b select-none code-block-header transition-colors duration-200"
        contentEditable={false}
      >
        <div className="flex items-center gap-2 text-xs opacity-70">
            <Code2 size={14} />
            <span className="font-medium uppercase tracking-wider">Code</span>
        </div>

        <button 
            onClick={handleCopy}
            className="opacity-60 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
            title="Copy code"
        >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>

      {/* Code Content */}
      <pre className="!m-0 !p-4 overflow-x-auto code-block-content">
        <NodeViewContent as="code" className="font-mono text-sm" />
      </pre>
    </NodeViewWrapper>
  );
};

export default CodeBlockComponent;
