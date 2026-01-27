import React from 'react';
import { useApp } from '../store/AppContext';
import { X, RefreshCw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const TrashModal = ({ onClose }) => {
  const { trashedNotes, restoreNote, permanentlyDeleteNote } = useApp();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Trash2 size={20} className="text-slate-400" />
            <h3 className="font-semibold text-slate-800">Trash Bin</h3>
            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{trashedNotes.length}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {trashedNotes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Trash2 size={48} className="mx-auto mb-3 opacity-20" />
              <p>Trash is empty</p>
            </div>
          ) : (
            trashedNotes.map(note => (
              <div key={note.id} className="group flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:shadow-sm hover:bg-slate-50/50 transition-all">
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="font-medium text-slate-800 truncate text-sm">{note.title || 'Untitled'}</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium">
                      {note.category}
                    </span>
                    <span>•</span>
                    <span>Deleted {format(new Date(note.trashedAt || note.updated_at), 'MMM d, h:mm a')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => restoreNote(note.id)}
                    className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                    title="Restore"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button 
                    onClick={() => {
                        if(confirm('Delete this note permanently? This cannot be undone.')) {
                            permanentlyDeleteNote(note.id);
                        }
                    }}
                    className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete Forever"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400 flex justify-between items-center">
          <p>Items in trash are visible here until permanently deleted.</p>
          {trashedNotes.length > 0 && (
             <button 
               className="text-red-500 hover:text-red-600 hover:underline"
               onClick={() => {
                   if(confirm('Empty Trash? All items will be permanently deleted.')) {
                       trashedNotes.forEach(n => permanentlyDeleteNote(n.id));
                   }
               }}
             >
               Empty Trash
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrashModal;
