import React, { useState } from 'react';
import { Folder, Lock, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { ShootingStarsDOM } from './ui/shooting-stars';
import logo from '../../assets/logo.png';

const LandingPage = ({ onOpenProject, onCreateNew }) => {
    const [projectPath, setProjectPath] = useState('');
    const [pin, setPin] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [recoveryKeyName, setRecoveryKeyName] = useState('');
    const [recoveryKeyContent, setRecoveryKeyContent] = useState(null);

    const handleSelectFolder = async () => {
        try {
            const result = await window.electron.invoke('select-project-folder');
            if (result.success) {
                setProjectPath(result.path);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleKeyUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setRecoveryKeyName(file.name);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            setRecoveryKeyContent(e.target.result);
        };
        reader.readAsText(file);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!projectPath) return toast.error('Please select a project folder');
        if (pin.length !== 4) return toast.error('Enter 4-digit PIN');
        if (!recoveryKeyContent) return toast.error('Please upload Recovery Key');

        setIsLoggingIn(true);
        try {
            const result = await window.electron.invoke('open-project', { path: projectPath, pin, key: recoveryKeyContent });
            if (result.success) {
                onOpenProject();
            } else {
                toast.error(result.error || 'Login failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('Login failed');
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="h-screen w-full bg-black relative overflow-hidden flex flex-col items-center justify-center">
            {/* Background Layers */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,rgba(0,0,0,0)_80%)]" />
                <div className="shooting-stars-stars-bg absolute inset-0" />
                <ShootingStarsDOM minSpeed={15} maxSpeed={35} minDelay={1000} maxDelay={3000} starColor="#9E00FF" trailColor="#2EB9DF" />
            </div>

            {/* Static Stars CSS */}
            <style>{`
                .shooting-stars-stars-bg {
                    background-image:
                        radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)),
                        radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)),
                        radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0)),
                        radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)),
                        radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0)),
                        radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0));
                    background-repeat: repeat;
                    background-size: 200px 200px;
                    animation: shooting-stars-twinkle 5s ease-in-out infinite;
                    opacity: 0.5;
                }
                @keyframes shooting-stars-twinkle {
                    0% { opacity: 0.5; }
                    50% { opacity: 0.8; }
                    100% { opacity: 0.5; }
                }
            `}</style>

            <div className="relative z-10 w-full max-w-md p-8 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center mb-8">
                    <img src={logo} alt="NoteQ" className="h-16 w-auto mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                    <h1 className="text-2xl font-bold text-white tracking-wide">Welcome Back</h1>
                    <p className="text-white/50 text-sm">Secure Markdown Notes</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Project Location</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={projectPath}
                                readOnly
                                placeholder="Select your vault..."
                                className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/50 placeholder:text-white/20 transition-all"
                            />
                            <button 
                                type="button"
                                onClick={handleSelectFolder}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 rounded-xl transition-colors border border-white/10"
                            >
                                <Folder size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Recovery Key</label>
                        <div className="relative">
                            <input 
                                type="file" 
                                id="recovery-key-upload"
                                className="hidden"
                                accept=".txt"
                                onChange={handleKeyUpload}
                            />
                            <button
                                type="button"
                                onClick={() => document.getElementById('recovery-key-upload').click()}
                                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/50 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
                            >
                                <span className={recoveryKeyName ? "text-white" : "text-white/20"}>
                                    {recoveryKeyName || "Upload Recovery Key (.txt)"}
                                </span>
                                <Folder size={18} className="text-white/30" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Security PIN</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                            <input 
                                type="password" 
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                maxLength={4}
                                placeholder="••••"
                                className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-lg tracking-[0.5em] focus:outline-none focus:border-primary/50 placeholder:tracking-normal placeholder:text-white/20 transition-all text-center"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoggingIn}
                        className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {isLoggingIn ? 'Unlocking...' : 'Login & Unlock'}
                        <ArrowRight size={20} />
                    </button>
                </form>

                {/* Create New Account Option */}
                {/* Only shown if we assume multiple users could exist or if this is just a reset mechanism. 
                    However, the user said "First Page... Login button".
                    If no PIN is set globally, we should probably not show this page but show Onboarding.
                    But if PIN IS set, we are here. 
                    Can a user CREATE a new account if one exists? 
                    NoteQ seems single-user (one PIN hash). 
                    So maybe we don't show "Create New" here unless we want to Reset?
                    Actually, Onboarding is for "Initial Setup". 
                    If PIN exists, we shouldn't allow overwriting it easily without resetting.
                    But maybe "Switch Vault" is what this is.
                */}
            </div>
        </div>
    );
};

export default LandingPage;
