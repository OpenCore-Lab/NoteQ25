import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store/AppContext';
import { LayoutGrid, FileText, Trash2, Tag, Hash, Plus, Settings, MoreHorizontal, X, LogOut, ChevronDown, ChevronUp, Calendar as CalendarIcon } from 'lucide-react';
import { clsx } from 'clsx';
import logo from '../../assets/logo.png';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay, parseISO } from 'date-fns';
import TrashModal from './TrashModal';
import ConfirmModal from './ConfirmModal';
import SettingsModal from './SettingsModal';
import toast, { Toaster } from 'react-hot-toast';

import ava01 from '../../assets/ava_01.jpg';
import ava02 from '../../assets/ava_02.jpg';
import ava03 from '../../assets/ava_03.jpg';
import ava04 from '../../assets/ava_04.jpg';
import ava05 from '../../assets/ava_05.jpg';
import ava06 from '../../assets/ava_06.jpg';
import ava07 from '../../assets/ava_07.jpg';
import ava08 from '../../assets/ava_08.jpg';
import ava09 from '../../assets/ava_09.jpg';

const AVATARS = {
    ava_01: ava01,
    ava_02: ava02,
    ava_03: ava03,
    ava_04: ava04,
    ava_05: ava05,
    ava_06: ava06,
    ava_07: ava07,
    ava_08: ava08,
    ava_09: ava09,
};

const Sidebar = () => {
  const { notes, selectedCategory, setSelectedCategory, addCategory, deleteCategory, categories, addNote, setSelectedNoteId, trashedNotes, addNotification, tags, addTag, deleteTag } = useApp();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Tag State
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [showTagsMenu, setShowTagsMenu] = useState(false);
  const moreTagsButtonRef = useRef(null);

  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const moreButtonRef = useRef(null);
  
  // Profile State
  const [userProfile, setUserProfile] = useState({ username: 'User', avatar: 'ava_01' });

  // Calendar State
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);

  useEffect(() => {
      const loadProfile = async () => {
          try {
              const profile = await window.electron.invoke('get-user-profile');
              if (profile && profile.username) {
                  setUserProfile(profile);
              }
          } catch (e) {
              console.error('Failed to load profile', e);
          }
      };
      loadProfile();
  }, []);
  
  const getAvatarSrc = (avatar) => {
      if (!avatar) return ava01;
      if (AVATARS[avatar]) return AVATARS[avatar];
      if (avatar.startsWith('data:')) return avatar;
      
      // Handle relative path from project root (saved in auth.js)
      if (avatar.startsWith('.noteq')) {
          // We need the absolute path. Since we don't have project path here easily, 
          // we can rely on the IPC to serve it or just assume we can construct it if we knew the root.
          // BUT, for local file access in Electron renderer, we need absolute path.
          // The 'userProfile' state should ideally contain the full path or we need to fetch it.
          // Let's check how we get userProfile. 
          // We invoke 'get-user-profile'. Let's update that handler to return absolute path.
          return `file://${avatar}`; // Placeholder, see below
      }
      
      if (avatar.startsWith('/') || avatar.match(/^[a-zA-Z]:\\/)) return `file://${avatar}`; 
      return ava01; 
  };

  const handleLogout = async () => {
      try {
          await window.electron.invoke('logout');
          window.location.reload(); // Reload to trigger App.jsx logic which will see !isSetup and show LandingPage
      } catch (e) {
          console.error('Logout failed', e);
      }
  };
  
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

  // Tags Limit Logic
  // Sort tags: highest usage first, then alphabetical
  // Usage = number of notes using the tag
  const getTagUsage = (tagName) => {
      return notes.filter(n => !n.trashed && n.tags?.includes(tagName)).length;
  };

  const sortedTags = [...tags].sort((a, b) => {
      const usageA = getTagUsage(a.name);
      const usageB = getTagUsage(b.name);
      if (usageA !== usageB) return usageB - usageA;
      return a.name.localeCompare(b.name);
  });

  // Categories Limit
  const VISIBLE_CATEGORIES_LIMIT = 7;
  const sortedCategories = [...categories].sort((a, b) => {
    // ... sorting logic duplicated from original or simplified?
    // Let's use the logic:
    const getCount = (cat) => {
        if (cat === 'All') return notes.filter(n => !n.trashed).length;
        return notes.filter(n => n.category === cat && !n.trashed).length;
    };

    if (a === 'All') return -1;
    if (b === 'All') return 1;
    if (a === 'Daily Note') return -1;
    if (b === 'Daily Note') return 1;
    
    const countA = getCount(a);
    const countB = getCount(b);
    if (countA !== countB) return countB - countA;
    return a.localeCompare(b);
  });
  
  const visibleCategories = sortedCategories.slice(0, VISIBLE_CATEGORIES_LIMIT);
  const hiddenCategories = sortedCategories.slice(VISIBLE_CATEGORIES_LIMIT);
  
  // Helper for counts
  const getCount = (cat) => {
    if (cat === 'All') return notes.filter(n => !n.trashed).length;
    return notes.filter(n => n.category === cat && !n.trashed).length;
  };

  const VISIBLE_TAGS_LIMIT = 10;
  const visibleTags = sortedTags.slice(0, VISIBLE_TAGS_LIMIT);
  const hiddenTags = sortedTags.slice(VISIBLE_TAGS_LIMIT);

  const handleAddTag = async () => {
    const trimmedTag = newTagName.trim();
    if (trimmedTag) {
      if (trimmedTag.length > 10) {
        toast.error('Tag name must be max 10 characters');
        return;
      }
      if (/\s/.test(trimmedTag)) {
        toast.error('Tag name cannot contain spaces');
        return;
      }
      
      if (tags.some(t => t.name === trimmedTag)) {
        toast.error(`Tag "${trimmedTag}" already exists`);
        return;
      }

      await addTag(trimmedTag);
      setNewTagName('');
      setIsAddingTag(false);
    }
  };

  const handleMoreTagsClick = (e) => {
    e.stopPropagation();
    if (showTagsMenu) {
        setShowTagsMenu(false);
    } else {
        if (moreTagsButtonRef.current) {
            const rect = moreTagsButtonRef.current.getBoundingClientRect();
            setMenuPosition({ top: rect.bottom + 5, left: rect.left });
        }
        setShowTagsMenu(true);
    }
  };

  const handleAddCategory = async () => {
    if (newCategoryName.trim()) {
      await addCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = (e, cat) => {
    e.stopPropagation();
    
    // Count items in category
    const noteCount = notes.filter(n => n.category === cat && !n.trashed).length;
    
    openConfirm(
        'Delete Category',
        `This category contains ${noteCount} notes. Are you sure you want to delete "${cat}"?`,
        () => {
            deleteCategory(cat);
            // Notifications handled in AppContext
        }
    );
  };

  const handleDeleteTag = (e, tag) => {
    e.stopPropagation();
    
    // Count usage
    const usageCount = getTagUsage(tag.name);
    
    openConfirm(
        'Delete Tag',
        `This tag is used in ${usageCount} notes. Deleting it will remove it from all these notes.`,
        () => {
            deleteTag(tag.name);
            toast.success(`Tag #${tag.name} deleted`);
            addNotification({
                title: 'Tag Deleted',
                message: `Tag #${tag.name} deleted`,
                type: 'success'
            });
        }
    );
  };

  const handleDateClick = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingNote = notes.find(n => n.category === 'Daily Note' && n.title === dateStr && !n.trashed);

    setSelectedCategory('Daily Note');
    
    if (existingNote) {
      setSelectedNoteId(existingNote.id);
    } else {
      addNote({
        title: dateStr,
        category: 'Daily Note',
        content: `# ${dateStr}\n\nDaily Log...`,
        created_at: date.toISOString()
      });
    }
  };

  const getTileClassName = ({ date, view }) => {
    if (view === 'month') {
      const dateStr = format(date, 'yyyy-MM-dd');
      const hasNote = notes.some(n => n.category === 'Daily Note' && n.title === dateStr && !n.trashed);
      return hasNote ? 'has-daily-note' : null;
    }
    return null;
  };

  const handleMoreClick = (e) => {
    e.stopPropagation();
    if (showCategoryMenu) {
        setShowCategoryMenu(false);
    } else {
        if (moreButtonRef.current) {
            const rect = moreButtonRef.current.getBoundingClientRect();
            // Position as a dropdown menu
            setMenuPosition({ top: rect.bottom + 5, left: rect.left });
        }
        setShowCategoryMenu(true);
    }
  };

  return (
    <>
    <div data-testid="sidebar" className="w-[260px] h-full bg-primary dark:bg-slate-950 text-white flex flex-col pt-4 transition-colors duration-200">
      {/* App Drag Region */}
      <div className="h-4 w-full absolute top-0 left-0" style={{ WebkitAppRegion: 'drag' }} />

      {/* Logo Header - Compact */}
      <div className="px-4 pb-2 flex items-center justify-center shrink-0">
        <img src={logo} alt="NoteQ" className="h-8 w-auto object-contain" />
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-hide min-h-0">
        <div className="px-4 mb-1 flex items-center justify-between text-[10px] font-semibold text-white/40 tracking-wider uppercase">
          <span>Categories</span>
          <Plus 
            size={12} 
            className="cursor-pointer hover:text-white" 
            onClick={() => setIsAddingCategory(true)}
          />
        </div>
        
        {isAddingCategory && (
          <div className="px-3 mb-1">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              placeholder="New Category..."
              autoFocus
              maxLength={200}
              className="w-full px-2 py-1 text-xs rounded bg-white/10 dark:bg-slate-900 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/50"
            />
          </div>
        )}

        <div className="flex flex-col gap-0.5 px-2">
          {visibleCategories.map(cat => (
            <div
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                "group flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all duration-200 cursor-pointer border border-transparent",
                selectedCategory === cat 
                  ? "bg-white text-slate-900 font-bold shadow-md transform scale-[1.02]" 
                  : "text-white/70 hover:text-white hover:bg-white/10 hover:translate-x-1"
              )}
              title={cat}
            >
              <span className="flex items-center gap-2 truncate">
                {/* Icons could be dynamic based on category */}
                {cat.length > 20 ? cat.substring(0, 20) + '...' : cat}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={clsx("text-[10px]", selectedCategory === cat ? "text-slate-500 font-semibold" : "text-white/40")}>
                  {getCount(cat)}
                </span>
                {cat !== 'All' && cat !== 'Daily Note' && (
                  <Trash2 
                    size={12} 
                    className={clsx(
                      "hidden group-hover:block hover:text-red-500",
                      selectedCategory === cat ? "text-slate-400" : "text-white/40"
                    )}
                    onClick={(e) => handleDeleteCategory(e, cat)}
                  />
                )}
              </div>
            </div>
          ))}

          {/* More Categories Menu */}
          {hiddenCategories.length > 0 && (
            <div className="relative">
              <div 
                ref={moreButtonRef}
                className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-white/60 hover:text-white hover:bg-white/5 dark:hover:bg-slate-900/50"
                onClick={handleMoreClick}
              >
                <span className="flex items-center gap-2">
                  <MoreHorizontal size={14} />
                  More...
                </span>
              </div>
              
              {showCategoryMenu && createPortal(
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowCategoryMenu(false)} />
                  <div 
                    className="fixed w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                  >
                    {hiddenCategories.map(cat => (
                      <div
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setShowCategoryMenu(false);
                        }}
                        className={clsx(
                          "group flex items-center justify-between px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer",
                          selectedCategory === cat ? "text-primary dark:text-blue-400 font-medium bg-primary/5 dark:bg-blue-900/20" : "text-slate-600 dark:text-slate-300"
                        )}
                      >
                        <span className="truncate flex-1 pr-2">{cat}</span>
                        <div className="flex items-center gap-2">
                          <span className={clsx("text-[10px]", selectedCategory === cat ? "text-primary/60 dark:text-blue-400/60" : "text-slate-400")} >
                            {getCount(cat)}
                          </span>
                          {cat !== 'All' && cat !== 'Daily Note' && (
                            <Trash2 
                              size={12} 
                              className="hidden group-hover:block text-slate-400 hover:text-red-500"
                              onClick={(e) => handleDeleteCategory(e, cat)}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>,
                document.body
              )}
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="mt-4 px-4 mb-1 flex items-center justify-between text-[10px] font-semibold text-white/40 tracking-wider uppercase">
          <span>Tags</span>
          <Plus 
            size={12} 
            className="cursor-pointer hover:text-white" 
            onClick={() => setIsAddingTag(true)}
          />
        </div>

        {isAddingTag && (
          <div className="px-3 mb-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Tag (max 10 chars, no spaces)"
              autoFocus
              maxLength={10}
              className="w-full px-2 py-1 text-xs rounded bg-white/10 dark:bg-slate-900 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/50"
            />
          </div>
        )}

        <div className="px-4 flex flex-wrap gap-1.5 pb-2">
           {visibleTags.map(tag => (
             <div 
                key={tag.name} 
                className="group flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-800 font-medium cursor-pointer hover:opacity-90 transition-opacity"
                style={{ backgroundColor: tag.color }}
                title={tag.name}
             >
                <span className="truncate max-w-[80px]">#{tag.name}</span>
                <button 
                  onClick={(e) => handleDeleteTag(e, tag)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                >
                  <X size={10} />
                </button>
             </div>
           ))}

           {hiddenTags.length > 0 && (
             <div className="relative">
                <span 
                    ref={moreTagsButtonRef}
                    className="text-[10px] text-white/60 hover:text-white cursor-pointer bg-white/5 dark:bg-slate-900/50 px-1.5 py-0.5 rounded flex items-center gap-1"
                    onClick={handleMoreTagsClick}
                >
                    {hiddenTags.length}+ more
                </span>

                {showTagsMenu && createPortal(
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowTagsMenu(false)} />
                  <div 
                    className="fixed w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-wrap gap-1.5 max-h-60 overflow-y-auto"
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                  >
                    {hiddenTags.map(tag => (
                      <div 
                        key={tag.name} 
                        className="group flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-800 font-medium cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: tag.color }}
                      >
                        <span className="truncate max-w-[100px]">#{tag.name}</span>
                        <button 
                          onClick={(e) => handleDeleteTag(e, tag)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>,
                document.body
              )}
             </div>
           )}
        </div>
      </div>

      {/* Calendar Section - Fixed at bottom of sidebar (outside scroll area) */}
      <div className="mt-auto px-3 mb-2 shrink-0">
         <div className="bg-white dark:bg-slate-900/80 rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-800 backdrop-blur-sm overflow-hidden transition-all duration-300">
            {/* Header / Toggle Handle */}
            <div 
                onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                className={clsx(
                    "flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                    isCalendarExpanded ? "border-b border-slate-100 dark:border-slate-800" : ""
                )}
            >
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <CalendarIcon size={14} className="text-primary dark:text-blue-400" />
                    <span className="text-xs font-semibold">
                        {isCalendarExpanded ? 'Calendar' : format(new Date(), 'do MMMM')}
                    </span>
                </div>
                {isCalendarExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
            </div>

            {/* Calendar Content */}
            <div className={clsx(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isCalendarExpanded ? "max-h-[300px] opacity-100 p-2" : "max-h-0 opacity-0"
            )}>
                <Calendar 
                  onChange={handleDateClick} 
                  value={new Date()} 
                  tileClassName={getTileClassName}
                  className="text-[10px] border-none bg-transparent w-full font-medium"
                  prev2Label={null}
                  next2Label={null}
                  showNeighboringMonth={false}
                  formatShortWeekday={(locale, date) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()]}
                />
            </div>
         </div>
      </div>

      {/* Footer / User Profile & Settings */}
      <div className="p-3 border-t border-white/10 dark:border-slate-800 shrink-0 flex items-center justify-between">
        <div 
            className="flex items-center gap-2 group relative cursor-pointer overflow-hidden max-w-[170px]"
            onClick={handleLogout}
            title="Click to Logout"
        >
             <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0">
                 <img src={getAvatarSrc(userProfile.avatar)} alt="Avatar" className="w-full h-full object-cover" />
             </div>
             
             <div className="flex flex-col overflow-hidden relative w-full">
                 <span className="text-xs font-medium truncate group-hover:opacity-0 transition-opacity duration-200">
                    {userProfile.username}
                 </span>
                 <div className="absolute inset-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-300 gap-1.5">
                    <LogOut size={12} />
                    <span className="text-[10px] font-semibold whitespace-nowrap">Logout</span>
                 </div>
             </div>
        </div>

        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 text-white/60 hover:text-white hover:bg-white/5 dark:hover:bg-slate-900/50 rounded-md transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>

    {/* Modals */}
    {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    {showTrashModal && <TrashModal onClose={() => setShowTrashModal(false)} />}
    
    <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
    />
    
    <Toaster position="bottom-right" />
    </>
  );
};

export default Sidebar;
