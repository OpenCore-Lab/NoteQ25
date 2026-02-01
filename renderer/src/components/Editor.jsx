import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp, colors } from '../store/AppContext';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
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
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, all } from 'lowlight';

import { 
  Bold, Italic, Underline, List, ListOrdered, Image as ImageIcon, 
  Type, Paperclip, Printer, Share2, Trash2, Eye, Tag, Minus, Square, 
  X, Plus, Maximize2, Minimize2, Bell, Moon, Sun, RefreshCw, Trash, 
  FileX, ChevronRight, Calendar, User, AlignLeft, AlignCenter, 
  AlignRight, AlignJustify, Link as LinkIcon, MoreHorizontal,
  CheckSquare, Highlighter, Palette, Undo, Redo, Heading1, Heading2, Heading3,
  Save, Code, FileText, Terminal
} from 'lucide-react';
import { Markdown } from 'tiptap-markdown';
import { clsx } from 'clsx';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import InputModal from './InputModal';
import EditorContextMenu from './EditorContextMenu';
import CodeBlockComponent from './CodeBlockComponent';

import CharacterCount from '@tiptap/extension-character-count';
import { Extension, wrappingInputRule } from '@tiptap/core';

// Initialize lowlight
const lowlight = createLowlight(all);

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
      'Shift-Control-v': () => {
        // Trigger paste-plain action
        // We can't easily trigger the context menu action directly from here without access to handleContextMenuAction
        // But we can implement the logic directly
        navigator.clipboard.readText().then(text => {
             this.editor.commands.insertContent(text);
        }).catch(err => {
             toast.error("Could not read clipboard");
        });
        return true; // Prevent default
      },
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
  const { selectedNote, updateNote, deleteNote, focusMode, setFocusMode, addNotification, tags, setUnsavedChanges, unsavedChanges } = useApp();
  const [viewMode, setViewMode] = useState('visualize'); // 'visualize' | 'raw'
  const [rawContent, setRawContent] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const selectedNoteId = selectedNote?.id;
  const [isAddingTag, setIsAddingTag] = useState(false);
  const addTagButtonRef = useRef(null);
  const [tagMenuPosition, setTagMenuPosition] = useState({ top: 0, left: 0 });
  const [tagSearch, setTagSearch] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [editorStyle, setEditorStyle] = useState({
    fontFamily: 'Inter',
    fontSize: '16px',
    colorClass: 'text-slate-800 dark:text-slate-100'
  });
  
  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  const [inputModal, setInputModal] = useState({
    isOpen: false,
    title: '',
    fields: [],
    onConfirm: () => {},
    submitText: 'Save'
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
  const [syncInterval, setSyncInterval] = useState('2m'); // 2m, 5m, 1h, manual
  const [charCount, setCharCount] = useState(0);
  
  // Force update for toolbar state
  const [, forceUpdate] = useState(0);

  // Ref to hold the latest handleSave function to avoid stale closures in setInterval
  const handleSaveRef = useRef(null);
  // Ref to track programmatic updates to prevent autosave triggering on load
  const isProgrammaticUpdate = useRef(false);

  const loadSettings = async () => {
    if (window.electron) {
        try {
            const settings = await window.electron.invoke('get-project-settings');
            if (settings.autosaveInterval) {
                setSyncInterval(settings.autosaveInterval);
            }
            if (settings.fontFamily || settings.fontSize || settings.fontColor) {
                setEditorStyle({
                    fontFamily: settings.fontFamily || 'Inter',
                    fontSize: settings.fontSize || '16px',
                    colorClass: settings.fontColor || 'text-slate-800 dark:text-slate-100'
                });
            }
        } catch (e) {
            console.error('Failed to load project settings', e);
        }
    }
  };

  // Load project settings on mount and listen for updates
  useEffect(() => {
    loadSettings();
    
    const handleSettingsUpdate = (e) => {
        const settings = e.detail;
        if (settings) {
            if (settings.autosaveInterval) setSyncInterval(settings.autosaveInterval);
            setEditorStyle({
                fontFamily: settings.fontFamily || 'Inter',
                fontSize: settings.fontSize || '16px',
                colorClass: settings.fontColor || 'text-slate-800 dark:text-slate-100'
            });
        }
    };

    window.addEventListener('project-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('project-settings-updated', handleSettingsUpdate);
  }, [selectedNote?.id]);

  const handleIntervalChange = async (e) => {
      const newVal = e.target.value;
      setSyncInterval(newVal);
      if (window.electron) {
          // Fetch current settings to preserve other fields
          const current = await window.electron.invoke('get-project-settings');
          await window.electron.invoke('save-project-settings', { ...current, autosaveInterval: newVal });
      }
  };

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
        codeBlock: false, // Disable default codeBlock to use lowlight
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: null,
      }).extend({
        addAttributes() {
          return {
            language: {
              default: null,
            },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent);
        },
        // IMPORTANT: Move Markdown Logic directly into the Node Extension
        // This is the standard way for tiptap-markdown to pick it up reliably
        renderMarkdown(state, node) {
             const lang = node.attrs.language;
             state.ensureNewLine();
             state.write('```' + (lang || '') + '\n');
             state.text(node.textContent, false);
             state.ensureNewLine();
             state.write('```');
             state.closeBlock(node);
        },
        parseMarkdown: {
             fence: {
                 block: 'codeBlock',
                 getAttrs: token => {
                     const info = token.info ? token.info.trim() : '';
                     // Handle legacy format (lang:theme) by taking just the first part
                     const lang = info.split(':')[0] || null;
                     return {
                         language: lang
                     };
                 }
             }
        }
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
        transformCopiedText: true,
        // Removed custom extensions override to rely on Node extension logic
      }),
    ],
    content: '',
    onSelectionUpdate: () => {
        // Force re-render to update toolbar state
        forceUpdate(n => n + 1);
    },
    onUpdate: ({ editor }) => {
      // Skip change detection if this update was triggered programmatically (e.g. loading a note)
      if (isProgrammaticUpdate.current) return;

      const md = editor.storage.markdown.getMarkdown();
      const text = editor.getText();
      setCharCount(editor.storage.characterCount.characters());
      
      // Only mark dirty if content ACTUALLY changed from what we loaded
      // Normalize comparison to avoid false positives (e.g. trailing newlines)
      const normalize = (str) => (str || '').replace(/\r\n/g, '\n').trim();
      
      if (selectedNote && normalize(md) !== normalize(selectedNote.content)) {
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

  const handleSave = async () => {
      if (!selectedNote) return;
      setIsSaving(true);
      try {
          // Force get latest markdown from editor directly to avoid stale state
          const currentContent = editor?.storage.markdown?.getMarkdown() || '';
          const currentText = editor?.getText() || '';
          
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
              // CRITICAL: Ensure we are sending the actual editor content
              noteUpdate.content = currentContent;
              noteUpdate.preview = currentText.substring(0, 100);
          }
          
          // Log for debugging (optional, removed in prod)
          // console.log('Saving note content:', noteUpdate.content);

          // Force save to disk
          await updateNote(noteUpdate, true); 
          
          setLastSaved(new Date());
          setUnsavedChanges(false); // Mark as clean
      } catch (e) {
          console.error('Save failed:', e);
          toast.error('Failed to save note');
      } finally {
          setIsSaving(false);
      }
  };

  // Update ref whenever handleSave changes (which depends on state like title, editor content)
  useEffect(() => {
      handleSaveRef.current = handleSave;
  }, [handleSave]);

  // Auto-save interval logic
  useEffect(() => {
    if (syncInterval === 'manual') return; 
    
    let ms = 2 * 60 * 1000; // Default 2m
    if (syncInterval === '5m') ms = 5 * 60 * 1000;
    if (syncInterval === '1h') ms = 60 * 60 * 1000;
    
    const interval = setInterval(() => {
        // Only autosave if there are unsaved changes
        if (handleSaveRef.current && selectedNote && unsavedChanges) {
            handleSaveRef.current();
        }
    }, ms);

    return () => clearInterval(interval);
  }, [selectedNote?.id, syncInterval, unsavedChanges]); // Add unsavedChanges dependency

  const setLink = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const isTextSelected = from < to;
    const previousUrl = editor.getAttributes('link').href || '';

    const fields = [];
    if (!isTextSelected) {
        fields.push({ name: 'text', label: 'Anchor Text', placeholder: 'Enter text to link', autoFocus: true });
    }
    fields.push({ name: 'url', label: 'Link URL', placeholder: 'https://example.com', defaultValue: previousUrl, icon: <LinkIcon size={14}/> });

    setInputModal({
        isOpen: true,
        title: isTextSelected ? 'Edit Link' : 'Insert Link',
        fields,
        submitText: 'Save Link',
        onConfirm: (values) => {
            let url = values.url;
            // Basic URL validation/fix
            if (url && !/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }

            if (!url) {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                return;
            }

            if (isTextSelected) {
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            } else {
                if (values.text) {
                     editor.chain().focus().insertContent({
                        type: 'text',
                        text: values.text,
                        marks: [{ type: 'link', attrs: { href: url } }]
                     }).run();
                }
            }
        }
    });
  }, [editor]);

  const toggleCodeBlock = useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleCodeBlock().run();
  }, [editor]);

  const setCodeLanguage = useCallback((lang) => {
      if (!editor) return;
      editor.chain().focus().updateAttributes('codeBlock', { language: lang }).run();
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

  const handleContextMenu = (e) => {
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY;
      setContextMenu({ x, y });
  };

  const handleContextMenuAction = async (action) => {
      setContextMenu(null);
      if (!editor) return;
      
      editor.chain().focus().run(); // Ensure focus

      switch(action) {
          case 'copy':
              const selectedText = editor.state.selection.content().content.textBetween(0, editor.state.selection.content().size, '\n');
              if (selectedText) {
                  navigator.clipboard.writeText(selectedText);
                  toast.success("Copied to clipboard");
              }
              break;
          case 'paste-formatted':
              try {
                  const items = await navigator.clipboard.read();
                  let hasHtml = false;
                  for (const item of items) {
                      if (item.types.includes('text/html')) {
                          const blob = await item.getType('text/html');
                          const html = await blob.text();
                          editor.commands.insertContent(html);
                          hasHtml = true;
                          break;
                      }
                  }
                  if (!hasHtml) {
                      // Fallback to text
                      const text = await navigator.clipboard.readText();
                      editor.commands.insertContent(text);
                  }
              } catch (e) {
                  console.error("Paste failed", e);
                  // Fallback to simple readText if permissions fail
                  try {
                    const text = await navigator.clipboard.readText();
                    editor.commands.insertContent(text);
                  } catch (err) {
                    toast.error("Could not paste from clipboard");
                  }
              }
              break;
          case 'paste-plain':
              try {
                  const text = await navigator.clipboard.readText();
                  editor.commands.insertContent(text);
              } catch (e) {
                  toast.error("Could not read clipboard");
              }
              break;
          case 'remove-formatting':
              editor.chain().focus().unsetAllMarks().clearNodes().run();
              break;
          case 'clear-all':
              openConfirm(
                  'Clear All Formatting',
                  'Are you sure you want to clear all formatting? This will reset the document to plain paragraphs.',
                  () => {
                      editor.chain().focus().selectAll().unsetAllMarks().clearNodes().run();
                  },
                  'danger'
              );
              break;
      }
  };

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
      
      // Normalize comparison to prevent unnecessary reloads
      const normalize = (str) => (str || '').replace(/\r\n/g, '\n').trim();

      if (normalize(currentMd) !== normalize(selectedNote.content)) {
        // Flag this as a programmatic update to skip onUpdate logic
        isProgrammaticUpdate.current = true;
        
        // Use contentType: 'markdown' to ensure proper parsing of code blocks and other MD syntax
        editor.commands.setContent(selectedNote.content || '', { contentType: 'markdown' });
        
        // Reset flags after Tiptap has processed the content
        // Increased timeout to ensure all internal Tiptap events have fired
        setTimeout(() => {
             isProgrammaticUpdate.current = false;
             setUnsavedChanges(false); 
        }, 100);
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

  const getTagColor = (color) => {
    if (!color) return '#f1f5f9';
    if (typeof color === 'string') {
        if (theme === 'dark') {
            const matchedColor = colors.find(c => c.light.toLowerCase() === color.toLowerCase());
            return matchedColor ? matchedColor.dark : color;
        }
        return color;
    }
    return theme === 'dark' ? color.dark : color.light;
  };

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
                        const color = tagInfo ? getTagColor(tagInfo.color) : '#f1f5f9';
                        return (
                        <span key={tagName} className="px-3 py-1 rounded-md flex items-center gap-2 text-xs font-medium shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: color }}>
                            <span className="text-slate-800 dark:text-slate-100">#{tagName}</span>
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
                        
                        {/* Media & Code */}
                        <div className="flex items-center gap-0.5">
                            <ToolbarButton onClick={addImage} icon={<ImageIcon size={14} />} title="Insert Image" />
                            <ToolbarButton onClick={toggleCodeBlock} isActive={editor?.isActive('codeBlock')} icon={<Terminal size={14} />} title="Code Block" />
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
                        <span className="hidden sm:inline"></span>
                    </button>
                    <button 
                        onClick={() => viewMode === 'visualize' && toggleViewMode()}
                        className={clsx(
                            "px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all",
                            viewMode === 'raw' 
                                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        )}
                        title="Raw Markdown Mode"
                    >
                        <Code size={14} />
                        <span className="hidden sm:inline"></span>
                    </button>
                 </div>
            </div>

            {/* Editor Content Area */}
            <div 
                className={clsx(
                    "min-h-[500px] pb-32 transition-colors duration-300",
                    viewMode === 'raw' ? "font-mono" : "",
                    editorStyle.colorClass
                )}
                style={{
                    fontFamily: viewMode === 'raw' ? 'monospace' : editorStyle.fontFamily,
                    fontSize: editorStyle.fontSize
                }}
                onContextMenu={handleContextMenu}
            >
                {viewMode === 'visualize' ? (
                   <EditorContent editor={editor} />
                ) : (
                   <textarea 
                     value={rawContent}
                     onChange={handleRawChange}
                     className={clsx(
                        "w-full h-full min-h-[500px] bg-transparent resize-none focus:outline-none leading-relaxed p-0",
                        editorStyle.colorClass
                     )}
                     style={{
                        fontFamily: 'monospace',
                        fontSize: editorStyle.fontSize
                     }}
                     placeholder="Start writing..."
                   />
                )}
            </div>
        </div>
      </div>
      
      {/* Footer (Fixed outside scrollable area) */}
      <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between select-none z-40 transition-colors">
            <div className="flex items-center gap-4 text-[10px] text-slate-400">
                    <span>{charCount} characters</span>
                    <span>{editor?.storage.characterCount?.words() || 0} words</span>
            </div>
            <div className="flex items-center gap-3">
                    {/* Only show selector if in Auto mode or logic requires it. 
                        User asked: "If Autosaving meachnism on then HIt Save toggle will be disabled, if hit and save is on then auto savingmeachnism will be turned of"
                        This implies strict separation. 
                        If syncInterval === 'manual', we show Hit and Save button.
                        If syncInterval !== 'manual', we show Auto save indicator.
                    */}
                    
                    {syncInterval !== 'manual' ? (
                        <div className="flex items-center gap-2">
                            <select 
                                value={syncInterval}
                                onChange={handleIntervalChange}
                                className="bg-transparent border-none text-[10px] text-slate-400 focus:ring-0 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                title="Auto-save Interval"
                            >
                                <option value="2m">Auto (2 min)</option>
                                <option value="5m">Auto (5 min)</option>
                                <option value="1h">Auto (1 hour)</option>
                            </select>
                            
                            <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
                            
                            {isSaving ? (
                                <span className="text-blue-500 animate-pulse text-[10px]">Saving...</span>
                            ) : (
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                                    Saved {lastSaved ? format(lastSaved, 'h:mm a') : ''}
                                </span>
                            )}
                        </div>
                    ) : (
                        /* Manual Mode: Show Hit and Save Button */
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 mr-2">Manual Mode</span>
                            <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
                            
                            {isSaving ? (
                                <span className="text-blue-500 animate-pulse text-[10px]">Saving...</span>
                            ) : (
                                <>
                                    {lastSaved && !unsavedChanges && (
                                        <span className="text-[10px] text-slate-400">
                                            Saved {format(lastSaved, 'h:mm a')}
                                        </span>
                                    )}
                                    <button 
                                        onClick={handleSave}
                                        disabled={!unsavedChanges}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                                            unsavedChanges 
                                            ? 'text-white bg-red-500 hover:bg-red-600 shadow-sm animate-pulse cursor-pointer' 
                                            : 'text-slate-400 bg-slate-100 dark:bg-slate-800 cursor-default opacity-50'
                                        }`}
                                    >
                                        <Save size={10} />
                                        {unsavedChanges ? 'Hit to Save' : 'Saved'}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
            </div>
      </div>
    </div>

    {/* Modals & Popups */}
    <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
    />

    <InputModal
        isOpen={inputModal.isOpen}
        onClose={() => setInputModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={inputModal.onConfirm}
        title={inputModal.title}
        fields={inputModal.fields}
        submitText={inputModal.submitText}
    />

    <EditorContextMenu
        position={contextMenu}
        onClose={() => setContextMenu(null)}
        onAction={handleContextMenuAction}
        selectionEmpty={editor?.state.selection.empty}
    />
    </>
  );
};

export default Editor;
