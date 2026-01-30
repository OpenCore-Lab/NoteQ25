import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Type } from 'lucide-react';
import { createPortal } from 'react-dom';

const InputModal = ({ isOpen, onClose, onConfirm, title, fields = [], submitText = 'Save' }) => {
  const [values, setValues] = useState({});

  useEffect(() => {
    if (isOpen) {
      const initialValues = {};
      fields.forEach(field => {
        initialValues[field.name] = field.defaultValue || '';
      });
      setValues(initialValues);
    }
  }, [isOpen, fields]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(values);
    onClose();
  };

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[400px] max-w-[90vw] p-6 transform scale-100 animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {field.label}
              </label>
              <div className="relative">
                {field.icon && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {field.icon}
                  </div>
                )}
                <input
                  type={field.type || 'text'}
                  value={values[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  autoFocus={field.autoFocus}
                  className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 ${field.icon ? 'pl-10' : 'px-3'} pr-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all`}
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-3 mt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              {submitText}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default InputModal;
