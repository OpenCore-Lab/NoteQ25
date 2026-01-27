import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { Search, Plus, Filter, ArrowDownUp, Trash2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

const NotesList = () => {
  const { filteredNotes, selectedNoteId, setSelectedNoteId, addNote, searchQuery, setSearchQuery, selectedCategory, sortOption, setSortOption, deleteNote, duplicateNote, addNotification } = useApp();
  
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

  const toggleSort = () => {
    if (sortOption === 'date-desc') setSortOption('date-asc');
    else if (sortOption === 'date-asc') setSortOption('title-asc');
    else setSortOption('date-desc');
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    openConfirm(
        'Move to Trash',
        'Are you sure you want to move this note to trash?',
        () => {
            deleteNote(id);
            toast.success('Note moved to trash');
            addNotification({
                title: 'Note Deleted',
                message: 'Note moved to trash',
                type: 'success'
            });
        }
    );
  };

  const handleDuplicate = (e, id) => {
    e.stopPropagation();
    duplicateNote(id);
    toast.success('Note duplicated');
    addNotification({
      title: 'Note Duplicated',
      message: 'Note duplicated successfully',
      type: 'success'
    });
  };

  return (
    <div className="w-[300px] h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col font-sans transition-colors duration-200">
      {/* Header */}
      <div className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate pr-2 tracking-tight" title={selectedCategory}>
             {selectedCategory.length > 13 ? selectedCategory.substring(0, 13) + '...' : selectedCategory}
          </h2>
          <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
             <div className="relative group">
                <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors" onClick={toggleSort}>
                  <ArrowDownUp size={14} className="cursor-pointer" />
                </button>
                <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-slate-800 dark:bg-slate-700 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 shadow-lg">
                   {sortOption === 'date-desc' ? 'Newest' : sortOption === 'date-asc' ? 'Oldest' : 'Title'}
                </div>
             </div>
          </div>
        </div>
        
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
          <input 
            type="text" 
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
          />
        </div>

        <button 
          onClick={addNote}
          className="w-full py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:border-primary/30 dark:hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 rounded-md font-medium text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Plus size={14} />
          <span>New Note</span>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredNotes.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-600 mt-10 text-xs italic">
            No notes found.
          </div>
        ) : (
          filteredNotes.map(note => (
            <div
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              style={{ backgroundColor: note.color || '#ffffff' }}
              className={clsx(
                "p-3 rounded-lg cursor-pointer transition-all duration-300 border group relative animate-in fade-in slide-in-from-bottom-2",
                selectedNoteId === note.id 
                  ? "border-primary/40 shadow-lg ring-2 ring-primary/20 z-10 scale-[1.02]" 
                  : "border-transparent hover:shadow-md hover:scale-[1.01] opacity-95 hover:opacity-100"
              )}
            >
              <div className="flex justify-between items-start mb-0.5">
                <h4 className={clsx(
                  "font-semibold truncate text-sm flex-1 pr-2 text-slate-800"
                )}>{note.title || 'Untitled'}</h4>
                
                {/* Action Buttons (Visible on hover or selected) */}
                <div className={clsx(
                  "flex items-center gap-1 opacity-0 transition-opacity",
                  (selectedNoteId === note.id) ? "opacity-100" : "group-hover:opacity-100"
                )}>
                  <button 
                    onClick={(e) => handleDuplicate(e, note.id)}
                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white/50 rounded"
                    title="Duplicate"
                  >
                    <Copy size={12} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(e, note.id)}
                    className="p-1 text-slate-500 hover:text-red-600 hover:bg-white/50 rounded"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              
              <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-serif opacity-80 mb-1.5">
                {note.preview || 'No content...'}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium">{format(new Date(note.created_at), 'MMM d')}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
};

export default NotesList;
