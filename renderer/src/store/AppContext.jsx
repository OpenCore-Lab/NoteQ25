import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

import ConfirmModal from '../components/ConfirmModal';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // New Auth/Setup State
  const [isSetup, setIsSetup] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const [categories, setCategories] = useState(['All', 'Daily Note', 'Business', 'Design', 'Journal', 'Personal', 'Programming']);
  const [tags, setTags] = useState([]);
  const [sortOption, setSortOption] = useState('date-desc'); // date-desc, date-asc, title-asc
  const [focusMode, setFocusMode] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  
  // Color Theme State
  const [colorTheme, setColorTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('colorTheme') || 'theme-charlie-blue';
    }
    return 'theme-charlie-blue';
  });

  // Notification History State
  const [notifications, setNotifications] = useState([]);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // Confirm Modal State for Navigation
  const [navConfirm, setNavConfirm] = useState({
    isOpen: false,
    onConfirm: () => {},
    onCancel: () => {}
  });

  // New wrapper for navigation protection
  const checkUnsavedChanges = (action) => {
    if (unsavedChanges) {
        setNavConfirm({
            isOpen: true,
            onConfirm: () => {
                setUnsavedChanges(false);
                setNavConfirm(prev => ({ ...prev, isOpen: false }));
                action();
            },
            onCancel: () => {
                setNavConfirm(prev => ({ ...prev, isOpen: false }));
            }
        });
    } else {
      action();
    }
  };
  
  // Wrapped Setters
  const handleSetSelectedNoteId = (id) => {
      checkUnsavedChanges(() => setSelectedNoteId(id));
  };
  
  const handleSetSelectedCategory = (cat) => {
      checkUnsavedChanges(() => setSelectedCategory(cat));
  };

  // ... existing code ...

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Apply Color Theme
  useEffect(() => {
    const root = window.document.documentElement;
    // Remove all known theme classes
    const themeClasses = [
      'theme-charlie-blue', 'theme-emerald-green', 'theme-crimson-red',
      'theme-royal-purple', 'theme-sunset-orange', 'theme-ocean-teal',
      'theme-berry-pink', 'theme-amber-gold', 'theme-indigo-violet',
      'theme-graphite-grey', 'theme-midnight-navy'
    ];
    root.classList.remove(...themeClasses);
    root.classList.add(colorTheme);
    localStorage.setItem('colorTheme', colorTheme);
  }, [colorTheme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const changeColorTheme = (newTheme) => {
    setColorTheme(newTheme);
  };

  const addNotification = (notification) => {
    const newNotification = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Check Auth & Load Data
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
      try {
          if (window.electron) {
              const status = await window.electron.invoke('auth-status');
              setIsSetup(status.isSetup);
              setIsLocked(status.isLocked);
              
              // New state for Landing Page logic
              // If hasPin is true but !projectPath, isSetup is false (per old logic), 
              // but we need to know if we should show Onboarding or LandingPage.
              // Let's store raw status too if needed, or rely on isSetup.
              // In auth.js: isSetup = !!(hasPin && projectPath)
              // If logged out: isSetup = false. 
              // App.jsx will check status.hasPin to differentiate.
              
              if (status.isSetup && !status.isLocked) {
                  loadNotes();
              }
          }
      } catch (error) {
          console.error('Auth check failed:', error);
      } finally {
          setAuthChecked(true);
      }
  };
  
  // Exposed function to reload after unlock
  const unlockApp = () => {
      setIsLocked(false);
      loadNotes();
  };
  
  const finishSetup = () => {
      setIsSetup(true);
      setIsLocked(false);
      loadNotes();
  };

  const loginApp = () => {
      setIsSetup(true);
      setIsLocked(false);
      loadNotes();
  };

  const addCategory = async (categoryName) => {
    if (categoryName.startsWith('.')) return; // Prevent hidden categories
    if (!categories.includes(categoryName)) {
      setCategories(prev => [...prev, categoryName]);
      try {
        if (window.electron) await window.electron.invoke('create-category', categoryName);
      } catch (error) {
        console.error('Failed to create category:', error);
      }
    }
  };

  const deleteCategory = async (categoryName) => {
    if (categoryName === 'All' || categoryName === 'Daily Note') return; 
    
    const trashedAt = new Date().toISOString();
    const notesInCat = notes.filter(n => n.category === categoryName);

    setCategories(prev => prev.filter(c => c !== categoryName));
    if (selectedCategory === categoryName) setSelectedCategory('All');
    
    // In file system mode, we might just mark them as trashed inside the note file
    // OR we just remove them from UI for now.
    // Ideally we update the file content to have trashed: true
    
    setNotes(prev => prev.map(n => n.category === categoryName ? { ...n, trashed: true, trashedAt } : n));
    
    if (notesInCat.length > 0) {
      addNotification({
        title: 'Category Deleted',
        message: `${categoryName} category with ${notesInCat.length} Notes deleted`,
        type: 'info'
      });
    }

    try {
      if (window.electron) {
        for (const note of notesInCat) {
             await window.electron.invoke('save-note', { ...note, trashed: true, trashedAt });
        }
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      loadNotes();
    }
  };

  const deleteNote = async (id) => {
    const noteToDelete = notes.find(n => n.id === id);
    if (!noteToDelete) return;

    const updatedNote = { ...noteToDelete, trashed: true, trashedAt: new Date().toISOString() };
    setNotes(prev => prev.map(n => n.id === id ? updatedNote : n));
    
    if (selectedNoteId === id) setSelectedNoteId(null);
    
    addNotification({
        title: 'Note Deleted',
        message: `Note "${noteToDelete.title}" moved to trash`,
        type: 'info'
    });

    try {
      if (window.electron) await window.electron.invoke('save-note', updatedNote);
    } catch (error) {
      console.error('Failed to move note to trash:', error);
      loadNotes();
    }
  };

  const addTag = async (tagName) => {
    if (tags.some(t => t.name === tagName)) return;

    const colors = [
        '#FFEBEE', '#F3E5F5', '#E3F2FD', '#E8F5E9', '#FFFDE7', '#FFF3E0', 
        '#E0F7FA', '#F9FBE7', '#FCE4EC', '#F1F8E9'
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const newTag = { name: tagName, color };
    const newTags = [...tags, newTag];
    setTags(newTags);
    
    // In file system mode, tags are stored in notes. 
    // We don't have a global 'tags.json' anymore. 
    // But we can keep state here for UI.
  };

  const deleteTag = async (tagName) => {
    const newTags = tags.filter(t => t.name !== tagName);
    setTags(newTags);
  };

  const loadNotes = async () => {
    setLoading(true);
    try {
      if (window.electron) {
        // 1. Get Categories from folders
        const loadedCategories = await window.electron.invoke('get-categories');
        
        // Ensure "Daily Note" exists in the list even if folder is missing (it will be created on note save)
        // STRICTLY filter out any hidden folders starting with dot
        const filteredCategories = (loadedCategories || []).filter(c => !c.startsWith('.'));
        const uniqueCategories = new Set(['All', 'Daily Note', ...filteredCategories]);
        setCategories(Array.from(uniqueCategories));

        // 2. Get Notes (recursively from folders)
        const loadedNotes = await window.electron.invoke('get-notes');
        
        // Notes are already Markdown. We don't need to convert to HTML anymore.
        // Tiptap with Markdown extension will handle it.
        setNotes(loadedNotes);

        // 3. Extract Tags from notes
        const allTags = new Set();
        loadedNotes.forEach(n => {
            if (n.tags) n.tags.forEach(t => allTags.add(t));
        });
        
        const colors = ['#E3F2FD', '#E8F5E9', '#FFFDE7', '#FFEBEE', '#F3E5F5', '#FFF3E0'];
        const tagObjects = Array.from(allTags).map(t => ({
            name: t,
            color: colors[Math.floor(Math.random() * colors.length)]
        }));
        setTags(tagObjects);

        // 4. Handle "Business Proposal" restoration (using save-note)
        const hasRestoredBusinessNote = localStorage.getItem('businessNoteRestored_v4'); // Bump version
        if (!hasRestoredBusinessNote) {
             const businessNoteContent = `# Business Proposal\n\n## Company Overview\n**Company Name:** BrightPath Solutions...`; 
             
             const businessNote = {
                id: uuidv4(),
                title: 'Business Proposal',
                category: 'Business',
                tags: ['proposal', 'business'],
                color: '#E3F2FD',
                content: businessNoteContent, // Already Markdown
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                preview: 'Company Name: BrightPath Solutions...'
             };
             
             if (!loadedNotes.find(n => n.title === 'Business Proposal')) {
                 await window.electron.invoke('save-note', businessNote);
                 // Push HTML version to state - No, just push note
                 loadedNotes.push(businessNote);
                 if (!loadedCategories.includes('Business')) {
                     await window.electron.invoke('create-category', 'Business');
                     setCategories(prev => [...prev, 'Business']);
                 }
             }

             // 5. Create Sample Rich Text Note (New Request)
             const sampleNoteContent = `# Rich Text Feature Showcase

This is a **comprehensive guide** to the rich text capabilities of NoteQ.

## Typography
You can use **bold text**, *italic text*, and underlined text (via toolbar).

### Headings
We support multiple heading levels (H1-H3).

## Lists
### Bullet List
*   Item 1
*   Item 2
    *   Nested Item
*   Item 3

### Ordered List
1.  First Step
2.  Second Step
3.  Third Step

### Task List
- [ ] To Do Item
- [x] Completed Item

## Code and Quotes
> This is a blockquote. It's great for emphasizing text.

\`\`\`javascript
// This is a code block
function hello() {
  console.log("Hello NoteQ!");
}
\`\`\`

## Links
[Visit Google](https://google.com)

## Alignment
The editor supports left, center, right, and justified alignment.
`;
             
             const sampleNote = {
                id: uuidv4(),
                title: 'Rich Text Feature Showcase',
                category: 'General',
                tags: ['showcase', 'demo'],
                color: '#F3E5F5',
                content: sampleNoteContent,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                preview: 'This is a comprehensive guide to the rich text capabilities of NoteQ.'
             };

             if (!notesWithHtml.find(n => n.title === 'Rich Text Feature Showcase')) {
                 await window.electron.invoke('save-note', sampleNote);
                 notesWithHtml.push({
                     ...sampleNote,
                     content: marked.parse(sampleNoteContent)
                 });
             }

             localStorage.setItem('businessNoteRestored_v5', 'true');
        }

        setNotes(notesWithHtml);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async (overrides = {}) => {
    // Safety check: if overrides is an Event object (from onClick), ignore it
    const safeOverrides = (overrides && overrides.preventDefault) ? {} : overrides;

    const categoryToUse = selectedCategory === 'All' ? 'General' : selectedCategory;

    const colors = [
      '#E3F2FD', '#E8F5E9', '#FFFDE7', '#FFEBEE', '#F3E5F5', '#FFF3E0', 
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newNote = {
      id: uuidv4(),
      title: 'Untitled Note',
      category: categoryToUse,
      tags: [],
      color: randomColor,
      content: '# Untitled Note\n\nStart writing...',
      created_at: new Date().toISOString(),
      preview: 'Start writing...',
      ...safeOverrides
    };
    
    setNotes(prev => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);

    try {
      if (window.electron) {
        // Convert content to Markdown if it's HTML (though new notes start as MD usually)
        // But for consistency, if we ever init with HTML:
        const isHtml = /<[a-z][\s\S]*>/i.test(newNote.content);
        const contentToSave = isHtml ? turndownService.turndown(newNote.content) : newNote.content;
        
        await window.electron.invoke('save-note', { ...newNote, content: contentToSave });
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const updateNote = async (updatedNote, saveToDisk = true) => {
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? { ...n, ...updatedNote } : n));
    
    if (saveToDisk) {
        try {
          // Content is already Markdown
          if (window.electron) await window.electron.invoke('save-note', updatedNote);
        } catch (error) {
          console.error('Failed to update note:', error);
        }
    }
  };

  const duplicateNote = async (id) => {
    const noteToDuplicate = notes.find(n => n.id === id);
    if (!noteToDuplicate) return;

    const newNote = {
      ...noteToDuplicate,
      id: uuidv4(),
      title: `${noteToDuplicate.title} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setNotes(prev => [newNote, ...prev]);
    
    try {
      if (window.electron) await window.electron.invoke('save-note', newNote);
    } catch (error) {
      console.error('Failed to duplicate note:', error);
      loadNotes(); // Revert
    }
  };

  const restoreNote = async (id) => {
    const noteToRestore = notes.find(n => n.id === id);
    if (!noteToRestore) return;

    const updatedNote = { ...noteToRestore, trashed: false, trashedAt: null };
    
    if (!categories.includes(updatedNote.category) && updatedNote.category !== 'All') {
        setCategories(prev => [...prev, updatedNote.category]);
        try {
            if (window.electron) await window.electron.invoke('create-category', updatedNote.category);
        } catch (e) {
            console.error('Failed to recreate category:', e);
        }
    }

    setNotes(prev => prev.map(n => n.id === id ? updatedNote : n));

    try {
      if (window.electron) await window.electron.invoke('save-note', updatedNote);
    } catch (error) {
      console.error('Failed to restore note:', error);
      loadNotes();
    }
  };

  const permanentlyDeleteNote = async (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    try {
      if (window.electron) await window.electron.invoke('delete-note', id);
    } catch (error) {
      console.error('Failed to permanently delete note:', error);
      loadNotes();
    }
  };

  const filteredNotes = notes.filter(note => {
    if (note.trashed) return false; 
    const matchesCategory = selectedCategory === 'All' || note.category === selectedCategory;
    const safeTitle = note.title || '';
    const safeQuery = searchQuery || '';
    const matchesSearch = safeTitle.toLowerCase().includes(safeQuery.toLowerCase()) || 
                          (note.preview && note.preview.toLowerCase().includes(safeQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (sortOption === 'date-desc') return new Date(b.created_at) - new Date(a.created_at);
    if (sortOption === 'date-asc') return new Date(a.created_at) - new Date(b.created_at);
    if (sortOption === 'title-asc') return (a.title || '').localeCompare(b.title || '');
    return 0;
  });

  const trashedNotes = notes.filter(n => n.trashed);
  const selectedNote = notes.find(n => n.id === selectedNoteId);

  return (
    <AppContext.Provider value={{
      isSetup,
      isLocked,
      authChecked,
      finishSetup,
      unlockApp,
      loginApp,
      notes,
      filteredNotes,
      trashedNotes,
      selectedNote,
      selectedNoteId,
      setSelectedNoteId: handleSetSelectedNoteId,
      selectedCategory,
      setSelectedCategory: handleSetSelectedCategory,
      unsavedChanges,
      setUnsavedChanges,
      searchQuery,
      setSearchQuery,
      addNote,
      updateNote,
      deleteNote,
      duplicateNote,
      restoreNote,
      permanentlyDeleteNote,
      loadNotes,
      categories,
      addCategory,
      deleteCategory,
      tags,
      addTag,
      deleteTag,
      sortOption,
      setSortOption,
      focusMode,
      setFocusMode,
      loading,
      theme,
      toggleTheme,
      colorTheme,
      changeColorTheme,
      notifications,
      addNotification,
      clearNotifications
    }}>
      {children}
      <ConfirmModal 
        isOpen={navConfirm.isOpen}
        onClose={navConfirm.onCancel}
        onConfirm={navConfirm.onConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to discard them and switch?"
        type="warning"
      />
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
