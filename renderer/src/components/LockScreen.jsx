import React, { useState, useEffect } from 'react';
import { Lock, AlertOctagon, FileKey, Unlock, RefreshCw, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const LockScreen = ({ onUnlock }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [remaining, setRemaining] = useState(2);
    const [isDestructing, setIsDestructing] = useState(false);
    const [destructTimer, setDestructTimer] = useState(null); // in seconds
    const [showRecovery, setShowRecovery] = useState(false);
    
    // Reset PIN State
    const [isResetting, setIsResetting] = useState(false);
    const [newPin, setNewPin] = useState('');
    const [confirmNewPin, setConfirmNewPin] = useState('');
    const [showPin, setShowPin] = useState(false);

    useEffect(() => {
        // Listen for self-destruct events
        const removeWarning = window.electron?.on('self-destruct-warning', (data) => {
            setIsDestructing(true);
            setDestructTimer(data.minutes * 60);
        });

        const removeComplete = window.electron?.on('self-destruct-complete', () => {
            alert('System Reset Complete. Application will close.');
        });

        return () => {
            if (removeWarning) removeWarning();
            if (removeComplete) removeComplete();
        };
    }, []);

    useEffect(() => {
        let interval;
        if (isDestructing && destructTimer > 0) {
            interval = setInterval(() => {
                setDestructTimer(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isDestructing, destructTimer]);

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        if (pin.length !== 4) return;

        try {
            const result = await window.electron.invoke('verify-pin', pin);
            if (result.success) {
                onUnlock();
            } else {
                setPin('');
                setError(result.error);
                if (result.remaining !== undefined) {
                    setRemaining(result.remaining);
                }
                if (result.destruct) {
                    setIsDestructing(true);
                }
            }
        } catch (err) {
            console.error(err);
            setError('Verification failed');
        }
    };

    const handleRecoveryFile = async () => {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const text = await file.text();
                const result = await window.electron.invoke('recover-with-key', text);
                
                if (result.success) {
                    toast.success('Recovery Key Verified');
                    setIsDestructing(false); // Stop destruct sequence
                    setDestructTimer(null); // Clear timer
                    setIsResetting(true); // Switch to reset mode
                    setShowRecovery(false);
                } else {
                    toast.error('Invalid Recovery Key');
                }
            };
            input.click();
            
        } catch (err) {
            toast.error('Recovery failed');
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        if (newPin.length !== 4) return toast.error('PIN must be 4 digits');
        if (newPin !== confirmNewPin) return toast.error('PINs do not match');

        try {
            const result = await window.electron.invoke('reset-pin', { pin: newPin });
            if (result.success) {
                toast.success('PIN Reset Successful');
                onUnlock();
            } else {
                toast.error(result.error || 'Reset failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('Reset failed');
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (isDestructing) {
        return (
            <div className="h-screen w-full bg-red-950 text-white flex flex-col items-center justify-center p-8 text-center animate-pulse relative z-50">
                <AlertOctagon size={64} className="mb-6 text-red-500" />
                <h1 className="text-4xl font-bold mb-4 text-red-500">SELF DESTRUCT INITIATED</h1>
                <div className="text-6xl font-mono font-bold mb-8 text-red-400">
                    {formatTime(destructTimer)}
                </div>
                <p className="max-w-md mb-8 text-red-200">
                    All data will be permanently erased. <br/>
                    Use your Recovery Key IMMEDIATELY to stop this process.
                </p>
                <button 
                    onClick={handleRecoveryFile}
                    className="bg-white text-red-900 px-8 py-3 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                >
                    <FileKey size={20} />
                    Emergency Override
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen w-full relative flex items-center justify-center overflow-hidden bg-slate-900">
            {/* Blurred Dashboard Background */}
            <div className="absolute inset-0 z-0 flex blur-md opacity-50 pointer-events-none select-none transform scale-105">
                {/* Sidebar Placeholder */}
                <div className="w-64 h-full bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4">
                    <div className="h-10 w-32 bg-slate-800 rounded mb-4"></div>
                    <div className="h-8 w-full bg-slate-800/50 rounded"></div>
                    <div className="h-8 w-full bg-slate-800/50 rounded"></div>
                    <div className="h-8 w-full bg-slate-800/50 rounded"></div>
                    <div className="mt-auto h-40 w-full bg-slate-800/30 rounded"></div>
                </div>
                {/* Notes List Placeholder */}
                <div className="w-80 h-full bg-slate-900/95 border-r border-slate-800 p-4 flex flex-col gap-4">
                     <div className="h-10 w-full bg-slate-800 rounded mb-2"></div>
                     <div className="space-y-3">
                        {[1,2,3,4,5].map(i => (
                            <div key={i} className="h-24 w-full bg-slate-800/40 rounded p-3">
                                <div className="h-4 w-3/4 bg-slate-700/50 rounded mb-2"></div>
                                <div className="h-3 w-full bg-slate-800/50 rounded mb-1"></div>
                                <div className="h-3 w-1/2 bg-slate-800/50 rounded"></div>
                            </div>
                        ))}
                     </div>
                </div>
                {/* Editor Placeholder */}
                <div className="flex-1 h-full bg-slate-950 p-8">
                    <div className="h-12 w-1/2 bg-slate-800/50 rounded mb-8"></div>
                    <div className="space-y-4">
                        <div className="h-4 w-full bg-slate-800/30 rounded"></div>
                        <div className="h-4 w-full bg-slate-800/30 rounded"></div>
                        <div className="h-4 w-3/4 bg-slate-800/30 rounded"></div>
                        <div className="h-4 w-5/6 bg-slate-800/30 rounded"></div>
                    </div>
                </div>
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 z-0 backdrop-blur-sm"></div>

            {/* Lock Modal */}
            <div className="relative z-10 w-full max-w-sm bg-slate-900/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-700/50 text-center animate-in zoom-in-95 duration-300">
                
                {!isResetting ? (
                    <>
                        <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 text-primary border border-slate-700 shadow-inner">
                            <Lock size={36} />
                        </div>
                        
                        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome Back</h2>
                        <p className="text-slate-400 text-sm mb-8">Enter your secure PIN to continue</p>

                        <form onSubmit={handlePinSubmit}>
                            <input 
                                type="password" 
                                maxLength={4}
                                autoFocus
                                value={pin}
                                onChange={(e) => {
                                    setPin(e.target.value.replace(/\D/g, ''));
                                    setError('');
                                }}
                                className="w-full bg-slate-950/50 text-white text-center text-4xl tracking-[1em] py-5 rounded-2xl border border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none mb-6 transition-all placeholder:tracking-normal shadow-inner"
                                placeholder="••••"
                            />
                            
                            {error && (
                                <div className="text-red-400 text-sm mb-4 animate-shake bg-red-950/30 py-2 rounded-lg border border-red-900/50">
                                    {error} ({remaining} attempts remaining)
                                </div>
                            )}

                            <button 
                                type="submit"
                                className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                            >
                                <Unlock size={20} />
                                Unlock Dashboard
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-800">
                            <button 
                                onClick={() => setShowRecovery(!showRecovery)}
                                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                Forgot PIN?
                            </button>
                            
                            {showRecovery && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                     <button 
                                        onClick={handleRecoveryFile}
                                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 border border-slate-700"
                                    >
                                        <FileKey size={16} />
                                        Upload Recovery Key
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary border border-primary/30 shadow-inner">
                            <RefreshCw size={36} />
                        </div>
                        
                        <h2 className="text-2xl font-bold text-white mb-2">Reset PIN</h2>
                        <p className="text-slate-400 text-sm mb-6">Create a new 4-digit PIN</p>

                        <form onSubmit={handleResetSubmit} className="space-y-4">
                            <div className="relative">
                                <input 
                                    type={showPin ? "text" : "password"}
                                    maxLength={4}
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-slate-950/50 text-white text-center text-2xl tracking-[0.5em] py-4 rounded-xl border border-slate-700 focus:border-primary focus:outline-none"
                                    placeholder="New PIN"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPin(!showPin)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            <input 
                                type="password" 
                                maxLength={4}
                                value={confirmNewPin}
                                onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                                className="w-full bg-slate-950/50 text-white text-center text-2xl tracking-[0.5em] py-4 rounded-xl border border-slate-700 focus:border-primary focus:outline-none"
                                placeholder="Confirm"
                            />

                            <button 
                                type="submit"
                                className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                <RefreshCw size={20} />
                                Set New PIN
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default LockScreen;
