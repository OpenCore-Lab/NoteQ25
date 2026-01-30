import React, { useEffect, useRef } from 'react';
import { Clipboard, FileText, Eraser, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

const EditorContextMenu = ({ position, onClose, onAction, selectionEmpty }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!position) return null;

  // Adjust position to keep within viewport
  const style = {
    top: position.y,
    left: position.x,
  };
  
  // Simple boundary check (can be improved)
  if (position.y + 200 > window.innerHeight) style.top = position.y - 200;
  if (position.x + 200 > window.innerWidth) style.left = position.x - 200;

  return createPortal(
    <div 
      ref={menuRef}
      className="fixed z-[100] w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-100 dark:border-slate-700 py-1.5 animate-in fade-in zoom-in-95 duration-100 flex flex-col overflow-hidden"
      style={style}
    >
      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700 mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Editor Actions</span>
        <kbd className="text-[10px] text-slate-400 dark:text-slate-600 font-sans">Esc</kbd>
      </div>

      <button 
        onClick={() => onAction('paste-formatted')}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <Clipboard size={14} className="text-blue-500" />
        <span>Paste (Formatted)</span>
      </button>

      <button 
        onClick={() => onAction('paste-plain')}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <FileText size={14} className="text-slate-500" />
        <span>Paste as Plain Text</span>
      </button>

      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />

      <button 
        onClick={() => onAction('remove-formatting')}
        disabled={selectionEmpty}
        className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
            selectionEmpty 
            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' 
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        <Eraser size={14} className={selectionEmpty ? 'text-slate-300' : 'text-orange-500'} />
        <span>Remove Formatting</span>
      </button>

      <button 
        onClick={() => onAction('clear-all')}
        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
      >
        <Trash2 size={14} />
        <span>Clear All Formatting</span>
      </button>
    </div>,
    document.body
  );
};

export default EditorContextMenu;
