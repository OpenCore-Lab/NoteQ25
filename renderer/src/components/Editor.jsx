import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store/AppContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import UnderlineExtension from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

import { 
  Bold, Italic, Underline, List, ListOrdered, Image as ImageIcon, 
  Type, Paperclip, Printer, Share2, Trash2, Eye, Tag, Minus, Square, 
  X, Plus, Maximize2, Minimize2, Bell, Moon, Sun, RefreshCw, Trash, 
  FileX, ChevronRight, Calendar, User, AlignLeft, AlignCenter, 
  AlignRight, AlignJustify, Link as LinkIcon, MoreHorizontal,
  CheckSquare, Highlighter, Palette, Undo, Redo, Heading1, Heading2, Heading3,
  Save, Code, FileText
} from 'lucide-react';
import { Markdown } from 'tiptap-markdown';
import { clsx } from 'clsx';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

import CharacterCount from '@tiptap/extension-character-count';
import { Extension, wrappingInputRule } from '@tiptap/core';

const AutoListExtension = Extension.create({
  name: 'autoList',
  addInputRules() {
    return [
      wrappingInputRule({
        find: /^(\d+)\.\s$/,
        type: this.editor.schema.nodes.orderedList,
        getAttributes: match => ({ start: +match[1] }),
      }),
      wrappingInputRule({
        find: /^([-+*])\s$/,
        type: this.editor.schema.nodes.bulletList,
      }),
    ];
  },
});

const SmartListKeyboardExtension = Extension.create({
  name: 'smartListKeyboard',
  addKeyboardShortcuts() {
    return {
      'Tab': () => {
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return this.editor.commands.sinkListItem(this.editor.isActive('taskItem') ? 'taskItem' : 'listItem');
        }
        return false;
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return this.editor.commands.liftListItem(this.editor.isActive('taskItem') ? 'taskItem' : 'listItem');
        }
        return false;
      },
      'Enter': () => {
        // Special behavior for empty task items: convert to paragraph (break out of list)
        if (this.editor.isActive('taskItem')) {
            const { empty } = this.editor.state.selection;
            const { $from } = this.editor.state.selection;
            const isAtEnd = $from.parentOffset === $from.parent.content.size;
            const isEmpty = $from.parent.content.size === 0;
            
            // If empty task item, splitListItem usually creates another empty one.
            // We want standard Tiptap behavior but ensure it breaks out if empty.
            if (isEmpty) {
                return this.editor.commands.liftListItem('taskItem');
            }
        }
        return false; // Let default handlers work
      }
    };
  },
});

const LineHeightExtension = Extension.create({
  name: 'lineHeight',
  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      defaultHeight: '1.0',
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: this.options.defaultHeight,
            parseHTML: element => element.style.lineHeight || this.options.defaultHeight,
            renderHTML: attributes => {
              if (attributes.lineHeight === this.options.defaultHeight) {
                return {};
              }
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight: (height) => ({ commands }) => {
        return this.options.types.every(type => commands.updateAttributes(type, { lineHeight: height }));
      },
      unsetLineHeight: () => ({ commands }) => {
        return this.options.types.every(type => commands.resetAttributes(type, 'lineHeight'));
      },
    };
  },
});

// ... imports ...

  // ...


const TrashPopover = ({ onClose }) => {
  const { trashedNotes, restoreNote, permanentlyDeleteNote } = useApp();
  
  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  const openConfirm = (title, message, onConfirm, type = 'danger') => {
      setConfirmModal({ isOpen: true, title, message, onConfirm, type });
  };

  const closeConfirm = () => {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleRestore = (id) => {
    restoreNote(id);
    toast.success('Note restored');
  };

  const handleDelete = (id) => {
    openConfirm(
        'Delete Forever',
        'Permanently delete this note? This cannot be undone.',
        () => {
            permanentlyDeleteNote(id);
            toast.success('Note permanently deleted');
        }
    );
  };

  return (
    <>
    <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Trash Bin</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{trashedNotes.length} items</span>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {trashedNotes.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
            Trash is empty
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {trashedNotes.map(note => (
              <div key={note.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 group">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1 pr-2">{note.title || 'Untitled'}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {(() => {
                      try {
                        const date = new Date(note.trashedAt);
                        return isNaN(date.getTime()) ? 'Unknown' : format(date, 'MMM d');
                      } catch {
                        return 'Unknown';
                      }
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleRestore(note.id)}
                    className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                    title="Restore"
                  >
                    <RefreshCw size={12} />
                  </button>
                  <button 
                    onClick={() => handleDelete(note.id)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    title="Delete Forever"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    
    <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
    />
    </>
  );
};

const NotificationPopover = () => {
  const { notifications, clearNotifications } = useApp();

  const groupedNotifications = notifications.reduce((acc, note) => {
    const date = new Date(note.timestamp);
    let key = 'Earlier';
    if (isToday(date)) key = 'Today';
    else if (isYesterday(date)) key = 'Yesterday';
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(note);
    return acc;
  }, {});

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Notifications</span>
        {notifications.length > 0 && (
          <button 
            onClick={clearNotifications}
            className="text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
            No notifications
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
             {['Today', 'Yesterday', 'Earlier'].map(group => (
               groupedNotifications[group] && (
                 <div key={group}>
                   <div className="px-4 py-1 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                     {group}
                   </div>
                   {groupedNotifications[group].map(note => (
                     <div key={note.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <p className="text-xs text-slate-700 dark:text-slate-300 mb-1">{note.message}</p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {(() => {
                             try {
                               const date = new Date(note.timestamp);
                               return isNaN(date.getTime()) ? '' : format(date, 'h:mm a');
                             } catch { return ''; }
                          })()}
                        </span>
                     </div>
                   ))}
                 </div>
               )
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

const WindowControls = () => {
  const handleMinimize = () => window.electron?.send('window-minimize');
  const handleMaximize = () => window.electron?.send('window-maximize');
  const handleClose = () => window.electron?.send('window-close');
  const { trashedNotes, theme, toggleTheme, notifications } = useApp();
  const [showTrashMenu, setShowTrashMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  return (
    <div className="flex items-center gap-3 no-drag relative z-50">
      {/* Theme Toggle */}
      <button 
        onClick={toggleTheme}
        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Notifications */}
      <div 
        className="relative"
        onMouseEnter={() => setShowNotifMenu(true)}
        onMouseLeave={() => setShowNotifMenu(false)}
      >
        <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors relative">
          <Bell size={16} />
          {/* Notification Badge */}
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-blue-500 text-white text-[9px] flex items-center justify-center rounded-full font-bold px-0.5 border-2 border-white dark:border-slate-900 leading-none">
              {notifications.length > 99 ? '99+' : notifications.length}
            </span>
          )}
        </button>
        {showNotifMenu && <NotificationPopover />}
      </div>

      {/* Trash */}
      <div 
        className="relative"
        onMouseEnter={() => setShowTrashMenu(true)}
        onMouseLeave={() => setShowTrashMenu(false)}
      >
        <button 
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors relative"
        >
          <Trash2 size={16} />
          {/* Trash Badge */}
          {trashedNotes.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full font-bold px-0.5 border-2 border-white dark:border-slate-900 leading-none">
              {trashedNotes.length > 99 ? '99+' : trashedNotes.length}
            </span>
          )}
        </button>
        {showTrashMenu && <TrashPopover />}
      </div>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
      
      {/* Mac-style Window Controls */}
      <div className="flex items-center gap-2 group">
        <button 
          onClick={handleMinimize} 
          className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-500 flex items-center justify-center text-black/0 hover:text-black/50 transition-all"
        >
          <Minus size={8} strokeWidth={3} />
        </button>
        <button 
          onClick={handleMaximize} 
          className="w-3 h-3 rounded-full bg-green-400 hover:bg-green-500 flex items-center justify-center text-black/0 hover:text-black/50 transition-all"
        >
          <Maximize2 size={8} strokeWidth={3} />
        </button>
        <button 
          onClick={handleClose} 
          className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 flex items-center justify-center text-black/0 hover:text-black/50 transition-all"
        >
          <X size={8} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

const ToolbarButton = ({ onClick, isActive, icon, disabled = false, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={clsx(
      "p-1.5 rounded-md transition-all duration-200",
      isActive 
        ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white" 
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
      disabled && "opacity-50 cursor-not-allowed"
    )}
  >
    {icon}
  </button>
);

const Editor = () => {
  const { selectedNote, updateNote, deleteNote, focusMode, setFocusMode, addNotification, tags, setUnsavedChanges } = useApp();
  const [viewMode, setViewMode] = useState('visualize'); // 'visualize' | 'raw'
  const [rawContent, setRawContent] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const selectedNoteId = selectedNote?.id;
  const [isAddingTag, setIsAddingTag] = useState(false);
  const addTagButtonRef = useRef(null);
  const [tagMenuPosition, setTagMenuPosition] = useState({ top: 0, left: 0 });
  const [tagSearch, setTagSearch] = useState('');
  
  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  const openConfirm = (title, message, onConfirm, type = 'danger') => {
      setConfirmModal({ isOpen: true, title, message, onConfirm, type });
  };

  const closeConfirm = () => {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };
  
  // Debounce save logic
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [syncInterval, setSyncInterval] = useState('2m'); // auto, 2m, 15m, 30m
  const [charCount, setCharCount] = useState(0);
  
  // Force update for toolbar state
  const [, forceUpdate] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Image,
      UnderlineExtension,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      LineHeightExtension,
      CharacterCount,
      AutoListExtension,
      SmartListKeyboardExtension,
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true
      }),
    ],
    content: '',
    onSelectionUpdate: () => {
        // Force re-render to update toolbar state
        forceUpdate(n => n + 1);
    },
    onUpdate: ({ editor }) => {
      const md = editor.storage.markdown.getMarkdown();
      const text = editor.getText();
      setCharCount(editor.storage.characterCount.characters());
      
      // Only mark dirty if content ACTUALLY changed from what we loaded
      if (selectedNote && md !== selectedNote.content) {
          setUnsavedChanges(true); // Mark as dirty
          
          updateNote({
            ...selectedNote,
            content: md,
            preview: text.substring(0, 100),
            updated_at: new Date().toISOString()
          }, false);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-base xl:prose-lg mx-auto focus:outline-none h-full max-w-none custom-task-list',
      },
    },
  });

  // Auto-save interval
  useEffect(() => {
    if (syncInterval === 'auto') return; // Handled by debounce if we implemented it, or manual only? User said "auto, 2 min...". "Auto" usually means debounce.
    // Let's interpret "Auto" as "Smart/Debounce" and others as fixed intervals.
    // For now, if "auto", we can default to 2m or implement debounce.
    // Let's stick to the requested explicit intervals.
    
    let ms = 2 * 60 * 1000;
    if (syncInterval === '15m') ms = 15 * 60 * 1000;
    if (syncInterval === '30m') ms = 30 * 60 * 1000;
    
    const interval = setInterval(() => {
        if (selectedNote) {
            handleSave();
        }
    }, ms);

    return () => clearInterval(interval);
  }, [selectedNote, title, syncInterval]); 

  // Debounce for "Auto" mode
  useEffect(() => {
      if (syncInterval !== 'auto') return;
      
      const timeout = setTimeout(() => {
          if (selectedNote) handleSave();
      }, 5000); // 5 seconds debounce
      
      return () => clearTimeout(timeout);
  }, [editor?.getHTML(), title, syncInterval]);

  const handleSave = async () => {
      if (!selectedNote) return;
      setIsSaving(true);
      try {
          // Determine content to save based on view mode
          let noteUpdate = {
              ...selectedNote,
              title: title,
              updated_at: new Date().toISOString()
          };

          if (viewMode === 'raw') {
              // In Raw mode, save the raw content directly
              noteUpdate.content = rawContent; 
              noteUpdate.preview = rawContent.substring(0, 100);
          } else {
              // In Visualize mode, use editor Markdown
              noteUpdate.content = editor?.storage.markdown.getMarkdown() || selectedNote.content;
              noteUpdate.preview = editor?.getText().substring(0, 100) || selectedNote.preview;
          }

          // Force save to disk
          await updateNote(noteUpdate, true); 
          
          setLastSaved(new Date());
          setUnsavedChanges(false); // Mark as clean
          // toast.success('Saved'); // Too noisy for auto-save
      } catch (e) {
          console.error(e);
      } finally {
          setIsSaving(false);
      }
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  // Intelligent List Toggle (Prevents "Whole Page" bugs)
  const toggleList = useCallback((listType, itemType = 'listItem') => {
      if (!editor) return;
      
      let chain = editor.chain().focus();
      const { selection } = editor.state;
      
      // 1. Normalize/Collapse empty selection to current block
      // This prevents "wrapping the whole document" if the selection is ambiguous
      if (selection.empty) {
          chain = chain.selectParentNode();
      } else {
           // 2. Handle Range Selection (User marked text)
           // "Enterprise Principle": Normalize to smallest logical block range
           let startBlockPos = null;
           let endBlockPos = null;
           
           editor.state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
               if (node.isBlock) {
                   if (startBlockPos === null) startBlockPos = pos;
                   endBlockPos = pos + node.nodeSize;
               }
           });
           
           if (startBlockPos !== null && endBlockPos !== null) {
               chain = chain.setTextSelection({ from: startBlockPos, to: endBlockPos });
           }
      }
      
      // 3. Toggle logic
      if (editor.isActive(listType)) {
          chain = chain.liftListItem(itemType);
      } else {
          chain = chain.wrapInList(listType);
      }
      
      chain.run();
  }, [editor]);

  const addImage = useCallback(async () => {
    if (!editor) return;
    // Use Electron dialog if available
    if (window.electron) {
        try {
            const category = selectedNote?.category || 'General';
            const result = await window.electron.invoke('save-image', { category });
            if (result.success && result.url) {
                editor.chain().focus().setImage({ src: result.url }).run();
            } else if (!result.canceled) {
                toast.error('Failed to load image');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error selecting image');
        }
    } else {
        const url = window.prompt('Image URL');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    }
  }, [editor, selectedNote]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const setColor = useCallback((e) => {
      if (!editor) return;
      editor.chain().focus().setColor(e.target.value).run();
  }, [editor]);

  const toggleHighlight = useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleHighlight().run();
  }, [editor]);

  const setLineHeight = useCallback((height) => {
    if (!editor) return;
    editor.chain().focus().setLineHeight(height).run();
  }, [editor]);

  // Sync editor with selected note
  useEffect(() => {
    if (selectedNote && editor) {
      if (title !== selectedNote.title) {
        setTitle(selectedNote.title);
      }
      // Only set content if different (e.g. switching notes)
      // selectedNote.content is now Markdown string
      // We check against current editor markdown
      const currentMd = editor.storage.markdown.getMarkdown();
      
      if (currentMd !== selectedNote.content) {
        editor.commands.setContent(selectedNote.content || '');
        // Reset dirty state only when content is programmatically loaded/replaced
        setTimeout(() => setUnsavedChanges(false), 0);
      }
    }
  }, [selectedNote?.id, selectedNote?.content, selectedNote?.title, editor]);

  // Reset state when switching notes
  useEffect(() => {
    if (selectedNote?.id) {
        setUnsavedChanges(false);
        const date = selectedNote.updated_at || selectedNote.created_at;
        setLastSaved(date ? new Date(date) : null);
    }
  }, [selectedNote?.id]);

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    setUnsavedChanges(true); // Mark as dirty
    if (selectedNote) {
      updateNote({ 
        ...selectedNote, 
        title: e.target.value,
        updated_at: new Date().toISOString()
      }, false);
    }
  };

  const handleAddTagClick = (e) => {
      e.stopPropagation();
      if (isAddingTag) {
          setIsAddingTag(false);
          setTagSearch('');
      } else {
          if (addTagButtonRef.current) {
              const rect = addTagButtonRef.current.getBoundingClientRect();
              setTagMenuPosition({ top: rect.bottom + 5, left: rect.left });
          }
          setIsAddingTag(true);
      }
  };

  const addTagToNote = (tagName) => {
    if (selectedNote) {
      const currentTags = selectedNote.tags || [];
      if (currentTags.length >= 5) {
          toast.error('Max 5 tags allowed per note');
          return;
      }
      if (!currentTags.includes(tagName)) {
        updateNote({ 
            ...selectedNote, 
            tags: [...currentTags, tagName],
            updated_at: new Date().toISOString()
        });
      }
      setIsAddingTag(false);
      setTagSearch('');
    }
  };

  const handleDelete = () => {
    openConfirm(
        'Move to Trash',
        'Are you sure you want to move this note to trash?',
        () => {
            deleteNote(selectedNote.id);
            toast.success('Note moved to trash');
            addNotification({
                title: 'Note Deleted',
                message: 'Note moved to trash',
                type: 'success'
            });
        }
    );
  };

  // Handle View Mode Toggle
  const toggleViewMode = () => {
    if (viewMode === 'visualize') {
        // Switch to Raw: Get Markdown from storage
        const md = editor?.storage.markdown.getMarkdown() || '';
        setRawContent(md);
        setViewMode('raw');
    } else {
        // Switch to Visualize: Set Markdown content
        // Tiptap with Markdown extension can accept markdown string if configured or if we use setContent properly
        // Actually, with the extension, setContent might still expect JSON/HTML unless we use a specific command.
        // But usually standard setContent parses correctly if it looks like MD? No.
        // We should use: editor.commands.setContent(rawContent) and rely on extension?
        // Let's verify. The extension intercepts setContent?
        // Documentation says: editor.commands.setContent(markdown) works.
        editor?.commands.setContent(rawContent, { contentType: 'markdown' });
        setViewMode('visualize');
        
        // Sync back to store
        if (selectedNote) {
             updateNote({
                ...selectedNote,
                content: rawContent,
                updated_at: new Date().toISOString()
             }, false);
        }
    }
  };

  // Handle Raw Content Change
  const handleRawChange = (e) => {
      const newMd = e.target.value;
      setRawContent(newMd);
      setUnsavedChanges(true);
      
      updateNote({
        ...selectedNote,
        content: newMd,
        preview: newMd.substring(0, 100),
        updated_at: new Date().toISOString()
      }, false);
  };

  if (!selectedNote) {
    return (
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 font-sans transition-colors duration-200">
        <div className="h-12 flex items-center justify-end px-4 border-b border-transparent" style={{ WebkitAppRegion: 'drag' }}>
          <WindowControls />
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-300 dark:text-slate-700">
          <div className="text-center">
             <Type size={48} className="mx-auto mb-4 opacity-50" />
             <p className="font-serif italic">Select a note to view</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 h-full flex flex-col font-sans transition-colors duration-200">
      {/* Top Bar: Breadcrumbs & Window Controls */}
      <div className="px-6 py-2 flex items-center justify-between border-b border-transparent" style={{ WebkitAppRegion: 'drag' }}>
         {/* Breadcrumbs */}
         <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 no-drag">
            <span className="hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors">{selectedNote.category || 'General'}</span>
            <ChevronRight size={14} />
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{selectedNote.title || 'Untitled'}</span>
         </div>

         {/* Right Controls */}
         <div className="flex items-center gap-3 no-drag">
             <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors" title="Delete Note">
                <FileX size={18} />
             </button>
             <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
             <button 
               onClick={() => setFocusMode(!focusMode)} 
               className={clsx("p-1.5 rounded-md transition-colors", focusMode ? "text-primary dark:text-blue-400 bg-primary/10" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")}
               title="Toggle Focus Mode"
             >
               {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
             </button>
             <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
             <WindowControls />
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className={clsx(
            "w-full px-8 pt-4 pb-20 transition-all duration-300",
            focusMode ? "max-w-none mx-0" : "max-w-4xl mx-auto"
        )}>
            {/* Title */}
            <input 
                type="text" 
                value={title}
                onChange={handleTitleChange}
                className="text-4xl font-bold text-slate-900 dark:text-slate-100 w-full border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-600 bg-transparent mb-8"
                placeholder="Note Title"
            />

            {/* Metadata Grid */}
            <div className="grid grid-cols-[100px_1fr] gap-y-5 gap-x-4 mb-10 text-sm border-b border-slate-100 dark:border-slate-800 pb-8">
                {/* Created By */}
                <div className="text-slate-400 dark:text-slate-500 font-medium self-center">Created by</div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center overflow-hidden shadow-sm">
                        <User size={14} className="text-blue-600 dark:text-blue-300" />
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">You</span>
                </div>

                {/* Last Modified */}
                <div className="text-slate-400 dark:text-slate-500 font-medium self-center">Last Modified</div>
                <div className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-2">
                    {(() => {
                        try {
                            const dateStr = selectedNote.updated_at || selectedNote.created_at;
                            const date = new Date(dateStr);
                            return isNaN(date.getTime()) ? 'Unknown Date' : format(date, 'd MMMM yyyy, h:mm a');
                        } catch {
                            return 'Unknown Date';
                        }
                    })()}
                </div>

                {/* Tags */}
                <div className="text-slate-400 dark:text-slate-500 font-medium self-center">Tags</div>
                <div className="flex flex-wrap gap-2 items-center">
                    {selectedNote.tags?.length > 0 ? selectedNote.tags.map(tagName => {
                        const tagInfo = tags.find(t => t.name === tagName);
                        const color = tagInfo ? tagInfo.color : '#f1f5f9';
                        return (
                        <span key={tagName} className="px-3 py-1 rounded-md flex items-center gap-2 text-xs font-medium shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: color }}>
                            <span className="text-slate-800">#{tagName}</span>
                            <button 
                              onClick={() => {
                                const newTags = selectedNote.tags.filter(t => t !== tagName);
                                updateNote({ ...selectedNote, tags: newTags, updated_at: new Date().toISOString() });
                              }}
                              className="text-slate-500 hover:text-red-500 transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </span>
                        );
                    }) : <span className="text-slate-400 italic text-xs">No tags</span>}
                    
                    <div className="relative">
                        <button 
                            ref={addTagButtonRef}
                            onClick={handleAddTagClick} 
                            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
                        >
                            <Plus size={12} />
                            <span>Add new tag</span>
                        </button>

                        {isAddingTag && createPortal(
                            <>
                            <div className="fixed inset-0 z-40 bg-transparent" onClick={() => { setIsAddingTag(false); setTagSearch(''); }} />
                            <div 
                                className="fixed w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-2 max-h-72 overflow-hidden border border-slate-100 dark:border-slate-700"
                                style={{ top: tagMenuPosition.top, left: tagMenuPosition.left }}
                            >
                                <input
                                    type="text"
                                    value={tagSearch}
                                    onChange={(e) => setTagSearch(e.target.value)}
                                    placeholder="Search or create tag..."
                                    autoFocus
                                    className="w-full px-3 py-1.5 text-xs rounded-md bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                                
                                <div className="flex flex-wrap gap-2 overflow-y-auto min-h-0 content-start p-1">
                                    {tags.filter(t => !selectedNote.tags?.includes(t.name) && t.name.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 ? (
                                        <p className="text-[10px] text-slate-400 p-2 italic w-full text-center">No matching tags.</p>
                                    ) : (
                                        tags.filter(t => !selectedNote.tags?.includes(t.name) && t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(tag => (
                                            <button 
                                                key={tag.name} 
                                                className="group flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-slate-800 font-medium cursor-pointer hover:shadow-md transition-all"
                                                style={{ backgroundColor: tag.color }}
                                                onClick={() => addTagToNote(tag.name)}
                                            >
                                                <span className="truncate max-w-[120px]">#{tag.name}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                            </>,
                            document.body
                        )}
                    </div>
                </div>
            </div>

            {/* Rich Text Toolbar - Compact & Adaptive */}
            <div className="sticky top-0 z-30 mb-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 py-1 flex items-center justify-between shadow-sm w-full transition-all">
                 {/* Left: Formatting Tools (Only in Visualize) */}
                 <div className="flex items-center gap-1 flex-wrap">
                     {viewMode === 'visualize' ? (
                        <>
                        {/* History */}
                        <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-700 pr-1 mr-1">
                            <ToolbarButton onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} icon={<Undo size={14} />} title="Undo" />
                            <ToolbarButton onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} icon={<Redo size={14} />} title="Redo" />
                        </div>

                        {/* Font Formatting */}
                        <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-700 pr-1 mr-1">
                            <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} isActive={editor?.isActive('bold')} icon={<Bold size={14} />} title="Bold" />
                            <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} isActive={editor?.isActive('italic')} icon={<Italic size={14} />} title="Italic" />
                            <ToolbarButton onClick={() => editor?.chain().focus().toggleUnderline().run()} isActive={editor?.isActive('underline')} icon={<Underline size={14} />} title="Underline" />
                            <ToolbarButton onClick={setLink} isActive={editor?.isActive('link')} icon={<LinkIcon size={14} />} title="Link" />
                            <ToolbarButton onClick={toggleHighlight} isActive={editor?.isActive('highlight')} icon={<Highlighter size={14} />} title="Highlight" />
                        </div>

                        {/* Lists & Align */}
                        <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-700 pr-1 mr-1">
                            <ToolbarButton onClick={() => toggleList('bulletList')} isActive={editor?.isActive('bulletList')} icon={<List size={14} />} title="Bullet List" />
                            <ToolbarButton onClick={() => toggleList('orderedList')} isActive={editor?.isActive('orderedList')} icon={<ListOrdered size={14} />} title="Ordered List" />
                            <ToolbarButton onClick={() => toggleList('taskList', 'taskItem')} isActive={editor?.isActive('taskList')} icon={<CheckSquare size={14} />} title="Checklist" />
                        </div>
                        
                        {/* Media */}
                        <div className="flex items-center gap-0.5">
                            <ToolbarButton onClick={addImage} icon={<ImageIcon size={14} />} title="Insert Image" />
                        </div>
                        </>
                     ) : (
                        <div className="flex items-center gap-2 px-2 py-1">
                            <Code size={16} className="text-slate-400" />
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Raw Markdown Mode</span>
                        </div>
                     )}
                 </div>

                 {/* Right: View Mode Toggle */}
                 <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 ml-2 shrink-0">
                    <button 
                        onClick={() => viewMode === 'raw' && toggleViewMode()}
                        className={clsx(
                            "px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all",
                            viewMode === 'visualize' 
                                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        )}
                        title="Visualize Mode (Rich Text)"
                    >
                        <Eye size={14} />
                        <span className="hidden sm:inline">Visualize</span>
                    </button>
                    <button 
                        onClick={() => viewMode === 'visualize' && toggleViewMode()}
                        className={clsx(
                            "px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all",
                            viewMode === 'raw' 
                                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        )}
                        title="Raw Mode (Markdown Source)"
                    >
                        <Code size={14} />
                        <span className="hidden sm:inline">Raw</span>
                    </button>
                 </div>
            </div>

            {/* Editor Content or Raw Textarea */}
            {viewMode === 'visualize' ? (
                <EditorContent editor={editor} className="min-h-[400px] text-base leading-relaxed text-slate-700 dark:text-slate-300" />
            ) : (
                <textarea
                    value={rawContent}
                    onChange={handleRawChange}
                    className="w-full min-h-[500px] p-4 font-mono text-sm bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y leading-relaxed"
                    placeholder="# Start writing markdown..."
                />
            )}
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="h-9 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 text-xs select-none no-drag">
        <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
           <span className="font-variant-numeric tabular-nums">{charCount} characters</span>
           {lastSaved && <span>Saved: {format(lastSaved, 'h:mm:ss a')}</span>}
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/50 rounded p-0.5 border border-slate-200 dark:border-slate-700 relative">
              {/* Dynamic Sync Button Logic */}
              <button
                onClick={() => setSyncInterval(syncInterval === 'auto' ? '2m' : 'auto')}
                className={clsx(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-all uppercase flex items-center gap-1",
                    "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                )}
                title="Click to toggle Auto/Interval"
              >
                {syncInterval === 'auto' ? 'Auto' : `Auto ${syncInterval}`}
              </button>
              
              {/* Simplified interval selection for now, or use context menu if requested. 
                  User asked for "Syncbutton right click - show Many called Auto and Hit & Save".
                  Let's implement a simple dropdown for intervals.
              */}
              <select 
                value={syncInterval} 
                onChange={(e) => setSyncInterval(e.target.value)}
                className="absolute opacity-0 inset-0 cursor-pointer"
                title="Right click or click to change interval"
              >
                 <option value="auto">Auto (Smart)</option>
                 <option value="2m">Auto (2 min)</option>
                 <option value="15m">Auto (15 min)</option>
                 <option value="30m">Auto (30 min)</option>
              </select>
           </div>
           
           <button 
             onClick={handleSave}
             disabled={isSaving}
             className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
             title="Hit & Save"
           >
             <RefreshCw size={12} className={clsx(isSaving && "animate-spin")} />
             <span className="font-medium">Sync</span>
           </button>
        </div>
      </div>
    </div>
    
    <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
    />
    </>
  );
};

export default Editor;
