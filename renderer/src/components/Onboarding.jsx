import React, { useState } from 'react';
import { Folder, Shield, Key, Check, AlertTriangle, User, Upload, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { ShootingStarsDOM } from './ui/shooting-stars';
import logo from '../../assets/logo.png';
import LandingPage from './LandingPage'; // Reuse existing component for Login
import ava01 from '../../assets/ava_01.jpg';
import ava02 from '../../assets/ava_02.jpg';
import ava03 from '../../assets/ava_03.jpg';
import ava04 from '../../assets/ava_04.jpg';
import ava05 from '../../assets/ava_05.jpg';
import ava06 from '../../assets/ava_06.jpg';
import ava07 from '../../assets/ava_07.jpg';
import ava08 from '../../assets/ava_08.jpg';
import ava09 from '../../assets/ava_09.jpg';

const AVATARS = [
    { id: 'ava_01', src: ava01 },
    { id: 'ava_02', src: ava02 },
    { id: 'ava_03', src: ava03 },
    { id: 'ava_04', src: ava04 },
    { id: 'ava_05', src: ava05 },
    { id: 'ava_06', src: ava06 },
    { id: 'ava_07', src: ava07 },
    { id: 'ava_08', src: ava08 },
    { id: 'ava_09', src: ava09 },
];

const Step = ({ title, children, icon: Icon, showIcon = true }) => (
    <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-500 z-10">
        {showIcon && (
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mb-6 text-white border border-white/20">
                {Icon && <Icon size={32} />}
            </div>
        )}
        <h2 className="text-2xl font-bold text-white mb-6 tracking-wide drop-shadow-md">{title}</h2>
        {children}
    </div>
);

const Onboarding = ({ onComplete, initialPath }) => {
    const [step, setStep] = useState(0);
    const [projectPath, setProjectPath] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [recoveryKey, setRecoveryKey] = useState(null);
    const [isSavingKey, setIsSavingKey] = useState(false);
    const [showLogin, setShowLogin] = useState(false); // Toggle between Setup and Login
    
    // Profile State
    const [username, setUsername] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('ava_01'); // Default ID
    const [customAvatar, setCustomAvatar] = useState(null); // File object or path
    const [customAvatarPreview, setCustomAvatarPreview] = useState(null);

    // Pre-fill project path if recovering
    React.useEffect(() => {
        const loadPath = async () => {
            try {
                const status = await window.electron.invoke('auth-status');
                if (status.projectPath) {
                    setProjectPath(status.projectPath);
                }
            } catch (e) {
                console.error(e);
            }
        };
        loadPath();
    }, []);

    const handleSelectFolder = async () => {
        try {
            const result = await window.electron.invoke('select-project-folder');
            if (result.success) {
                setProjectPath(result.path);
            } else if (result.error) {
                toast.error(result.error);
            }
        } catch (error) {
            console.error('Selection failed:', error);
            toast.error('Failed to open folder selector. Please restart the app.');
        }
    };

    const handleCustomAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 500 * 1024) {
            toast.error('Image size must be less than 500KB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setCustomAvatarPreview(reader.result);
            // Store the path if available (Electron) or base64
            setCustomAvatar(file.path || reader.result);
            setSelectedAvatar('custom');
        };
        reader.readAsDataURL(file);
    };

    const handleSetPin = () => {
        if (pin.length !== 4) return toast.error('PIN must be 4 digits');
        if (pin !== confirmPin) return toast.error('PINs do not match');
        if (!projectPath) return toast.error('Please select a project folder');
        
        setStep(2); // Move to Profile Setup
    };

    const handleProfileSubmit = () => {
        if (!username.trim()) return toast.error('Please enter a username');
        setStep(3); // Move to confirm/save step
        handleSetup();
    };

    const handleSetup = async () => {
        try {
            const avatarToSave = selectedAvatar === 'custom' ? customAvatar : selectedAvatar;
            
            const result = await window.electron.invoke('setup-auth', { 
                pin, 
                projectPath,
                username: username.trim(),
                avatar: avatarToSave
            });
            
            if (result.success) {
                setRecoveryKey(result.recoveryKey);
            } else {
                toast.error(result.error || 'Setup failed');
                setStep(1); // Go back
            }
        } catch (error) {
            console.error(error);
            toast.error('Setup failed');
            setStep(1);
        }
    };

    const handleSaveKey = async () => {
        if (!recoveryKey) return;
        setIsSavingKey(true);
        try {
            const result = await window.electron.invoke('save-key-file', recoveryKey);
            if (result.success) {
                toast.success('Recovery key saved safely!');
                onComplete(); // Finish onboarding
            } else {
                toast.error('Please save the recovery key to continue');
            }
        } catch (error) {
            toast.error('Failed to save key file');
        } finally {
            setIsSavingKey(false);
        }
    };

    // If Login mode is active, render LandingPage directly
    if (showLogin) {
        return <LandingPage onOpenProject={onComplete} onCreateNew={() => setShowLogin(false)} />;
    }

    return (
        <div className="h-screen w-full bg-black relative overflow-hidden flex">
            {/* Background Layers (Absolute) */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_0%,rgba(0,0,0,0)_80%)]" />
                <div className="shooting-stars-stars-bg absolute inset-0" />
                <ShootingStarsDOM
                        minSpeed={15}
                        maxSpeed={35}
                        minDelay={1000}
                        maxDelay={3000}
                        starColor="#9E00FF"
                        trailColor="#2EB9DF"
                />
            </div>

            {/* Static Stars CSS */}
            <style>
            {`
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
            `}
            </style>

            {/* Content Container (Relative z-10) */}
            <div className="relative z-10 flex w-full h-full">
                {/* Left Side Content */}
                <div className="w-1/2 flex flex-col items-center justify-center text-center p-8">
                    <p className="text-xl text-white mb-6 font-light tracking-wide opacity-80">Welcome to</p>
                    <img src={logo} alt="NoteQ Logo" className="h-32 w-auto mb-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-in zoom-in duration-700" />
                    <p className="text-lg text-gray-300 max-w-md leading-relaxed font-light opacity-90">
                        A secure, local-first markdown note-taking app.
                    </p>
                </div>

                {/* Right Side Content */}
                <div className="w-1/2 flex flex-col items-center justify-center p-12 relative">
                    {step === 0 && (
                        <Step title="Who Am I?" showIcon={false}>
                            <div className="prose dark:prose-invert text-gray-200 mb-10 leading-relaxed text-lg text-center max-w-sm font-light">
                                <p className="mb-4">
                                    I am your private digital sanctuary.
                                </p>
                                <p className="mb-4">
                                    I store your thoughts in pure Markdown, encrypted and local.
                                </p>
                                <p>
                                    I protect your data with a self-destruct mechanism if tampered with.
                                </p>
                            </div>

                            <button 
                                onClick={() => setStep(1)}
                                className="bg-white hover:bg-white/90 text-black px-12 py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95"
                            >
                                Get Started
                            </button>

                            <button 
                                onClick={() => setShowLogin(true)}
                                className="mt-4 text-sm text-gray-400 hover:text-white transition-colors underline decoration-dotted underline-offset-4"
                            >
                                Already have a vault? Smash on to open it!
                            </button>
                        </Step>
                    )}

                    {step === 1 && (
                        <Step title="Setup Environment" icon={Folder}>
                            <div className="w-full space-y-8 min-w-[320px]">
                                <div className="text-left">
                                    <label className="block text-sm font-semibold mb-2 text-gray-300 uppercase tracking-wider text-xs ml-1">
                                        1. Select Project Location
                                    </label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={projectPath} 
                                            readOnly 
                                            placeholder="No folder selected"
                                            className="flex-1 px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-mono text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
                                        />
                                        <button 
                                            onClick={handleSelectFolder}
                                            className="bg-white/10 backdrop-blur-sm border border-white/20 px-6 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/20 transition-colors whitespace-nowrap"
                                        >
                                            Browse
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 ml-1">All your notes, images, and files will be stored here.</p>
                                </div>

                                <div className="text-left">
                                    <label className="block text-sm font-semibold mb-2 text-gray-300 uppercase tracking-wider text-xs ml-1">
                                        2. Create 4-Digit Security PIN
                                    </label>
                                    <div className="flex gap-4">
                                        <input 
                                            type="password" 
                                            maxLength={4}
                                            value={pin}
                                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                            className="w-full min-w-0 flex-1 px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-center text-xl tracking-[0.5em] text-white focus:outline-none focus:border-primary/50"
                                            placeholder="••••"
                                        />
                                        <input 
                                            type="password" 
                                            maxLength={4}
                                            value={confirmPin}
                                            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                            className="w-full min-w-0 flex-1 px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-center text-xl tracking-[0.5em] text-white focus:outline-none focus:border-primary/50"
                                            placeholder="••••"
                                        />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleSetPin}
                                    className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] mt-4"
                                >
                                    Continue
                                </button>
                            </div>
                        </Step>
                    )}

                    {step === 2 && (
                        <Step title="Create Profile" icon={User}>
                            <div className="w-full space-y-6 min-w-[320px]">
                                <div className="text-left">
                                    <label className="block text-sm font-semibold mb-2 text-gray-300 uppercase tracking-wider text-xs ml-1">
                                        Username
                                    </label>
                                    <input 
                                        type="text" 
                                        value={username} 
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white focus:outline-none focus:border-primary/50"
                                        placeholder="Enter your name"
                                        maxLength={20}
                                    />
                                </div>

                                <div className="text-left">
                                    <label className="block text-sm font-semibold mb-3 text-gray-300 uppercase tracking-wider text-xs ml-1">
                                        Choose Avatar
                                    </label>
                                    <div className="grid grid-cols-5 gap-3 mb-4">
                                        {AVATARS.map((avatar) => (
                                            <button
                                                key={avatar.id}
                                                onClick={() => setSelectedAvatar(avatar.id)}
                                                className={`relative rounded-full overflow-hidden aspect-square border-2 transition-all ${
                                                    selectedAvatar === avatar.id 
                                                    ? 'border-primary scale-110 shadow-[0_0_10px_rgba(168,85,247,0.5)]' 
                                                    : 'border-transparent hover:border-white/30 opacity-70 hover:opacity-100'
                                                }`}
                                            >
                                                <img src={avatar.src} alt={avatar.id} className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                        
                                        <button
                                            onClick={() => document.getElementById('avatar-upload').click()}
                                            className={`relative rounded-full overflow-hidden aspect-square border-2 flex items-center justify-center bg-white/10 transition-all ${
                                                selectedAvatar === 'custom'
                                                ? 'border-primary scale-110 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                                                : 'border-transparent hover:border-white/30 text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            {customAvatarPreview ? (
                                                <img src={customAvatarPreview} alt="Custom" className="w-full h-full object-cover" />
                                            ) : (
                                                <Upload size={20} />
                                            )}
                                        </button>
                                        <input 
                                            id="avatar-upload"
                                            type="file" 
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleCustomAvatarUpload}
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-right">Max size: 500KB</p>
                                </div>

                                <button 
                                    onClick={handleProfileSubmit}
                                    className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] mt-4"
                                >
                                    Create Profile
                                </button>
                            </div>
                        </Step>
                    )}

                    {step === 3 && (
                        <Step title="Backup Recovery Key" icon={Shield}>
                            <div className="w-full space-y-6 text-center">
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 text-left">
                                    <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                                    <p className="text-sm text-red-200">
                                        This key is the <strong>ONLY</strong> way to recover your data if you forget your PIN.
                                        <br/>
                                        <span className="opacity-75 text-xs mt-1 block">Store it in a safe place external to this device.</span>
                                    </p>
                                </div>

                                <div className="bg-white/5 rounded-lg p-4 font-mono text-xs text-gray-400 break-all border border-white/10">
                                    {recoveryKey ? (
                                        <div className="blur-sm hover:blur-none transition-all duration-300 cursor-pointer" title="Hover to reveal">
                                            {recoveryKey}
                                        </div>
                                    ) : (
                                        <span className="animate-pulse">Generating key...</span>
                                    )}
                                </div>

                                <button 
                                    onClick={handleSaveKey}
                                    disabled={isSavingKey || !recoveryKey}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(22,163,74,0.4)]"
                                >
                                    {isSavingKey ? 'Saving...' : 'Save Recovery Key'}
                                </button>
                            </div>
                        </Step>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;