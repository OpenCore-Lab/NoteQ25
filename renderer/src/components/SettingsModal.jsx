import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Type, Save, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../store/AppContext';

const FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Merriweather', 'Playfair Display', 'Fira Code', 'JetBrains Mono'
];

const COLORS = [
  { name: 'Slate', value: 'text-slate-800 dark:text-slate-100' },
  { name: 'Gray', value: 'text-gray-800 dark:text-gray-100' },
  { name: 'Zinc', value: 'text-zinc-800 dark:text-zinc-100' },
  { name: 'Neutral', value: 'text-neutral-800 dark:text-neutral-100' },
  { name: 'Stone', value: 'text-stone-800 dark:text-stone-100' },
];

const THEMES = [
  { id: 'theme-charlie-blue', name: 'Charlie Blue (Default)', color: '#2563EB' },
  { id: 'theme-emerald-green', name: 'Emerald Green', color: '#059669' },
  { id: 'theme-crimson-red', name: 'Crimson Red', color: '#DC2626' },
  { id: 'theme-royal-purple', name: 'Royal Purple', color: '#7C3AED' },
  { id: 'theme-sunset-orange', name: 'Sunset Orange', color: '#EA580C' },
  { id: 'theme-ocean-teal', name: 'Ocean Teal', color: '#0D9488' },
  { id: 'theme-berry-pink', name: 'Berry Pink', color: '#DB2777' },
  { id: 'theme-amber-gold', name: 'Amber Gold', color: '#D97706' },
  { id: 'theme-indigo-violet', name: 'Indigo Violet', color: '#4F46E5' },
  { id: 'theme-graphite-grey', name: 'Graphite Grey', color: '#525252' },
  { id: 'theme-midnight-navy', name: 'Midnight Navy', color: '#1E3A8A' },
];

const SettingsModal = ({ onClose }) => {
  const { colorTheme, changeColorTheme } = useApp();
  const [activeTab, setActiveTab] = useState('editor');
  const [settings, setSettings] = useState({
    fontFamily: 'Inter',
    fontSize: '16px',
    fontColor: 'text-slate-800 dark:text-slate-100',
    autosave: false,
    autosaveInterval: 'manual'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.electron) {
          const loaded = await window.electron.invoke('get-project-settings');
          // If loaded settings are empty (first run), keep defaults (autosave: false)
          if (loaded && Object.keys(loaded).length > 0) {
              setSettings(prev => ({
                ...prev,
                ...loaded,
                // Handle legacy or manual case
                autosave: loaded.autosaveInterval !== 'manual' && loaded.autosaveInterval !== undefined,
                autosaveInterval: (loaded.autosaveInterval === 'manual' || !loaded.autosaveInterval) ? '2m' : loaded.autosaveInterval
              }));
          }
        }
      } catch (e) {
        console.error('Failed to load settings', e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      const settingsToSave = {
        ...settings,
        autosaveInterval: settings.autosave ? settings.autosaveInterval : 'manual'
      };
      
      if (window.electron) {
        await window.electron.invoke('save-project-settings', settingsToSave);
        // Force reload or event emit might be needed, but Editor polls/checks settings or we can use AppContext
        // Ideally, we should update AppContext, but for now, let's just save to disk
        // and trigger a custom event for the Editor to pick up
        window.dispatchEvent(new CustomEvent('project-settings-updated', { detail: settingsToSave }));
      }
      toast.success('Settings saved');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save settings');
    }
  };

  const handleAutosaveToggle = (e) => {
    const isChecked = e.target.checked;
    setSettings(prev => ({ ...prev, autosave: isChecked }));
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-[600px] h-[500px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Type size={20} className="text-primary" />
            Project Settings
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-100 dark:border-slate-800 p-4 flex flex-col gap-1">
            <button 
              onClick={() => setActiveTab('editor')}
              className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'editor' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
            >
              Editor
            </button>
            <button 
              onClick={() => setActiveTab('theme')}
              className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'theme' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
            >
              Theme & Colors
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>
            ) : (
              <div className="space-y-8">
                {/* Editor Settings */}
                {activeTab === 'editor' && (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Typography</h3>
                      
                      {/* Font Family */}
                      <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Font Family</label>
                        <select 
                          value={settings.fontFamily}
                          onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-primary/50"
                        >
                          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>

                      {/* Font Size */}
                      <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Font Size</label>
                        <div className="flex items-center gap-3">
                            <input 
                              type="range" 
                              min="12" 
                              max="24" 
                              step="1"
                              value={parseInt(settings.fontSize)}
                              onChange={(e) => setSettings(s => ({ ...s, fontSize: `${e.target.value}px` }))}
                              className="flex-1 accent-primary h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-sm font-mono w-12 text-center bg-slate-100 dark:bg-slate-800 py-1 rounded">{settings.fontSize}</span>
                        </div>
                      </div>

                      {/* Font Color */}
                      <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                         <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Text Color</label>
                         <div className="flex flex-wrap gap-2">
                            {COLORS.map(c => (
                                <button
                                    key={c.name}
                                    onClick={() => setSettings(s => ({ ...s, fontColor: c.value }))}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${settings.fontColor === c.value ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'}`}
                                >
                                    {c.name}
                                </button>
                            ))}
                         </div>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-6" />

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Saving Behavior</h3>
                      
                      {/* Auto-save Toggle */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/30 rounded-lg border border-slate-100 dark:border-slate-800">
                         <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">Auto-save Mechanism</div>
                            <div className="text-xs text-slate-500 mt-1">Automatically save changes after a set interval.</div>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={settings.autosave} onChange={handleAutosaveToggle} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                         </label>
                      </div>

                      {/* Interval Selector (Only if Auto-save is ON) */}
                      <div className={`grid grid-cols-[120px_1fr] items-center gap-4 transition-opacity ${settings.autosave ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                         <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Save Interval</label>
                         <select 
                            value={settings.autosaveInterval}
                            onChange={(e) => setSettings(s => ({ ...s, autosaveInterval: e.target.value }))}
                            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-primary/50"
                         >
                            <option value="2m">2 Minutes</option>
                            <option value="5m">5 Minutes</option>
                            <option value="1h">1 Hour</option>
                         </select>
                      </div>

                      {/* Manual Save Info (Only if Auto-save is OFF) */}
                      {!settings.autosave && (
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                             <div className="mt-0.5"><Save size={12} /></div>
                             <p>"Hit and Save" mode is active. You must manually press Save (or Ctrl+S) to persist changes.</p>
                          </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">Application Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => changeColorTheme(theme.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${colorTheme === theme.id ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary' : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <div 
                          className="w-8 h-8 rounded-full shadow-sm shrink-0 flex items-center justify-center text-white"
                          style={{ backgroundColor: theme.color }}
                        >
                          {colorTheme === theme.id && <Check size={14} strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{theme.name}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider">{theme.color}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
            <Check size={16} />
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SettingsModal;
