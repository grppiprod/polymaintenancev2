import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  LogOut, 
  Plus, 
  Search, 
  Filter, 
  Wrench, 
  ClipboardList,
  History,
  Trash2,
  Printer,
  X,
  Save,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileImage,
  Menu,
  Loader2,
  Database,
  Terminal,
  Copy,
  RefreshCw,
  Lock,
  CheckSquare,
  Square,
  Info,
  Bell,
  BellRing,
  Wifi,
  Download,
  ImageOff,
  ArrowUpDown,
  MessageCircle,
  MessageSquare,
  Siren,
  Zap,
  Activity
} from 'lucide-react';
import { Role, LogType, LogStatus, Priority, User, MaintenanceLog, HistoryItem } from './types';
import { MOCK_USERS, PRIORITY_COLORS, ROLE_BADGES } from './constants';
import { supabase } from './supabaseClient';

// --- UTILS ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const getLogLastActivity = (log: MaintenanceLog) => {
    if (log.history && log.history.length > 0) {
        return log.history[log.history.length - 1].createdAt;
    }
    return log.createdAt;
};

// Priority Weights for Sorting
const PRIORITY_WEIGHTS = {
  [Priority.CRITICAL]: 4,
  [Priority.HIGH]: 3,
  [Priority.MEDIUM]: 2,
  [Priority.LOW]: 1,
};

// Image Compression Utility
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; 
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- DATA MAPPING UTILS ---

const mapUserFromDB = (u: any): User => ({
  id: u.id,
  username: u.username,
  password: u.password,
  fullName: u.full_name,
  role: u.role as Role
});

const mapLogFromDB = (l: any): MaintenanceLog => ({
  id: l.id,
  title: l.title,
  description: l.description,
  type: l.type as LogType,
  priority: l.priority as Priority,
  status: l.status as LogStatus,
  imageUrl: l.image_url,
  createdBy: l.created_by,
  creatorName: l.creator_name,
  creatorRole: l.creator_role as Role,
  createdAt: l.created_at,
  closedAt: l.closed_at,
  history: l.history || []
});

const mapUserToDB = (u: User) => ({
  id: u.id,
  username: u.username,
  password: u.password,
  full_name: u.fullName,
  role: u.role
});

const mapLogToDB = (l: MaintenanceLog) => ({
  id: l.id,
  title: l.title,
  description: l.description,
  type: l.type,
  priority: l.priority,
  status: l.status,
  image_url: l.imageUrl,
  created_by: l.createdBy,
  creator_name: l.creatorName,
  creator_role: l.creatorRole,
  created_at: l.createdAt,
  closed_at: l.closedAt,
  history: l.history
});

interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

type SortOption = 'priority' | 'date_newest' | 'date_oldest';

// --- COMPONENTS ---

// SKELETON LOADER COMPONENT
const SkeletonLogCard = () => (
    <div className="bg-dark-900 border border-dark-800 rounded-lg md:rounded-xl overflow-hidden flex flex-row md:flex-col min-h-[6rem] md:h-full relative items-stretch animate-pulse">
        <div className="w-20 md:w-full h-auto md:h-40 shrink-0 bg-dark-800"></div>
        <div className="p-3 md:p-4 flex-1 flex flex-col justify-between min-w-0 space-y-3">
            <div className="flex justify-between items-start">
                <div className="h-4 bg-dark-800 rounded w-3/4"></div>
                <div className="h-4 bg-dark-800 rounded w-10"></div>
            </div>
            <div className="space-y-2">
                <div className="h-3 bg-dark-800 rounded w-full"></div>
                <div className="h-3 bg-dark-800 rounded w-5/6"></div>
            </div>
            <div className="mt-auto pt-2 space-y-2">
                <div className="h-2 bg-dark-800 rounded w-1/3"></div>
                <div className="h-2 bg-dark-800 rounded w-1/2"></div>
            </div>
        </div>
    </div>
);

// 0. DB ERROR SCREEN
const DatabaseErrorScreen = ({ error, onRetry }: { error: any, onRetry: () => void }) => {
  const [copied, setCopied] = useState(false);
  const errorMessage = error?.message || JSON.stringify(error);
  
  const sqlSetup = `-- Run this in Supabase SQL Editor

create table if not exists users (
  id text primary key,
  username text not null,
  password text not null,
  full_name text not null,
  role text not null
);

create table if not exists logs (
  id text primary key,
  title text not null,
  description text not null,
  type text not null,
  priority text not null,
  status text not null,
  image_url text,
  created_by text not null,
  creator_name text not null,
  creator_role text not null,
  created_at timestamptz not null,
  closed_at timestamptz,
  history jsonb default '[]'::jsonb
);

create table if not exists user_log_views (
  user_id text not null,
  log_id text not null,
  last_viewed_at timestamptz not null,
  primary key (user_id, log_id)
);

-- Enable Replication for Realtime
alter publication supabase_realtime add table logs;
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table user_log_views;
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlSetup);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <div className="bg-red-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-red-500" size={24} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Database Connection Error</h2>
          <p className="text-red-300 font-mono text-sm bg-dark-950 p-2 rounded border border-red-500/20 inline-block">
            {errorMessage}
          </p>
        </div>

        <div className="bg-dark-900 border border-dark-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-dark-800 bg-dark-950 flex justify-between items-center">
            <div className="flex items-center gap-2 text-zinc-400">
               <Database size={18} />
               <span className="font-medium text-sm">Required Database Setup</span>
            </div>
            <button 
              onClick={handleCopy}
              className="flex items-center gap-2 text-xs font-medium bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 px-3 py-1.5 rounded transition-colors"
            >
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              {copied ? 'Copied SQL' : 'Copy SQL'}
            </button>
          </div>
          <div className="p-4 bg-black/50 overflow-x-auto">
             <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">{sqlSetup}</pre>
          </div>
        </div>

        <button 
          onClick={onRetry}
          className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw size={20} /> Retry Connection
        </button>
      </div>
    </div>
  );
};

// 1. LOGIN COMPONENT
const Login = ({ onLogin, users, isLoading }: { onLogin: (u: User) => void, users: User[], isLoading: boolean }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (users.length === 0 && username === 'admin' && password === '1234') {
       onLogin({ id: 'temp_admin', username: 'admin', fullName: 'System Admin', role: Role.ADMIN });
       return;
    }
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-dark-800 p-8 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-600 to-brand-400"></div>
        <div className="flex flex-col items-center mb-8">
          <div className="bg-brand-500/10 p-4 rounded-full mb-4">
             <Wrench className="w-10 h-10 text-brand-500" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">PolyMaintenance</h1>
          <p className="text-zinc-400 mt-2 text-center">Enter your credentials to access the tracking system.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-dark-950 border border-dark-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="e.g. admin"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark-950 border border-dark-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center animate-pulse">{error}</p>}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold p-3 rounded-lg transition-colors shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

// 2. MODAL & SUB-COMPONENTS (Kept same logic, just compressed for brevity in response where unchanged)
const Modal = ({ isOpen, onClose, title, children, size = 'md' }: any) => {
  if (!isOpen) return null;
  const sizeClasses = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', full: 'max-w-6xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm no-print">
      <div className={`bg-dark-900 rounded-xl border border-dark-800 w-full ${sizeClasses[size as keyof typeof sizeClasses]} max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-up`}>
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-dark-800">
          <h2 className="text-lg md:text-xl font-bold text-white line-clamp-1">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>
        <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1">{children}</div>
      </div>
    </div>
  );
};

const CreateLogModal = ({ isOpen, onClose, onSubmit, activeTab, currentUser, isLoading }: any) => {
    const [form, setForm] = useState({ title: '', description: '', priority: Priority.MEDIUM, image: null as File | null });
    useEffect(() => { if (isOpen) setForm({ title: '', description: '', priority: Priority.MEDIUM, image: null }); }, [isOpen]);
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(form); };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Create New ${activeTab === LogType.REPAIR ? 'Repair' : 'Maintenance'} Log`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Attach Picture</label>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-dark-950 border border-dashed border-dark-700 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                            {form.image ? <img src={URL.createObjectURL(form.image)} className="w-full h-full object-cover" /> : <span className="text-[10px] text-zinc-600">No Image</span>}
                        </div>
                        <label className="cursor-pointer bg-dark-800 hover:bg-dark-700 border border-dark-700 text-zinc-300 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                            <FileImage size={16} /> Upload Image
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => setForm({...form, image: e.target.files ? e.target.files[0] : null})} />
                        </label>
                    </div>
                </div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-1">Title</label><input required type="text" className="w-full bg-dark-950 border border-dark-700 rounded-lg p-2.5 text-white text-sm" placeholder="Title..." value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-1">Description</label><textarea required rows={4} className="w-full bg-dark-950 border border-dark-700 rounded-lg p-2.5 text-white text-sm" placeholder="Description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})}></textarea></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-zinc-400 mb-1">Priority</label><select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as Priority})} className="w-full bg-dark-950 border border-dark-700 rounded-lg p-2.5 text-white text-sm">{Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                </div>
                <div className="flex justify-end pt-4 gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                    <button type="submit" disabled={isLoading} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2">{isLoading && <Loader2 className="animate-spin" size={16} />} Create Log</button>
                </div>
            </form>
        </Modal>
    );
};

const CreateUserModal = ({ isOpen, onClose, onSubmit, isLoading }: any) => {
    const [form, setForm] = useState({ username: '', fullName: '', role: Role.PRODUCTION });
    useEffect(() => { if(isOpen) setForm({ username: '', fullName: '', role: Role.PRODUCTION }); }, [isOpen]);
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New User" size="sm">
            <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
                <div><label className="block text-sm font-medium text-zinc-400 mb-1">Full Name</label><input required className="w-full bg-dark-950 border border-dark-700 rounded-lg p-2.5 text-white text-sm" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-1">Username</label><input required className="w-full bg-dark-950 border border-dark-700 rounded-lg p-2.5 text-white text-sm" value={form.username} onChange={e => setForm({...form, username: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-1">Role</label><select className="w-full bg-dark-950 border border-dark-700 rounded-lg p-2.5 text-white text-sm" value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}><option value={Role.PRODUCTION}>Production</option><option value={Role.ENGINEERING}>Engineering</option><option value={Role.ADMIN}>Admin</option></select></div>
                <button type="submit" disabled={isLoading} className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2">{isLoading && <Loader2 className="animate-spin" size={16} />} Create User</button>
            </form>
        </Modal>
    );
};

const ChangePasswordModal = ({ isOpen, onClose, onSubmit, isLoading }: any) => {
    const [form, setForm] = useState({ current: '', new: '', confirm: '' });
    const [error, setError] = useState('');
    useEffect(() => { if(isOpen) setForm({ current: '', new: '', confirm: '' }); }, [isOpen]);
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (form.new !== form.confirm) { setError("Passwords do not match."); return; }
      onSubmit(form.current, form.new, (err: string) => setError(err));
    };
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Change Password" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-zinc-400 mb-1">Current</label><input required type="password" className="w-full bg-dark-950 border border-dark-700 rounded-lg p-2.5 text-white text-sm" value={form.current} onChange={e => setForm({...form, current: e.target.value})} /></div>
          <div><label className="block text-sm font-medium text-zinc-400 mb-1">New</label><input required type="password" className="w-full bg-dark-950 border border-dark-700 rounded-lg p-2.5 text-white text-sm" value={form.new} onChange={e => setForm({...form, new: e.target.value})} /></div>
          <div><label className="block text-sm font-medium text-zinc-400 mb-1">Confirm</label><input required type="password" className="w-full bg-dark-950 border border-dark-700 rounded-lg p-2.5 text-white text-sm" value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})} /></div>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <button type="submit" disabled={isLoading} className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white py-2 rounded-lg font-medium">{isLoading ? <Loader2 className="animate-spin inline" size={16} /> : 'Update Password'}</button>
        </form>
      </Modal>
    );
};

const LogDetailModal = ({ log, currentUser, isOpen, onClose, onAddHistory, onCloseLog, onDeleteLog, onDeleteHistory }: any) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  if (!log) return null;

  const handleAddNote = async () => {
      setIsSubmitting(true);
      await onAddHistory(log.id, note);
      setNote('');
      setIsSubmitting(false);
  }
  const canDeleteLog = currentUser.role === Role.ADMIN || currentUser.id === log.createdBy;
  const isCreatorOrAdmin = (userId: string) => currentUser.role === Role.ADMIN || currentUser.id === userId;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Log Details" size="lg">
        <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white mb-2">{log.title}</h1>
              <div className="flex flex-wrap gap-2 mb-2 md:mb-4">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${PRIORITY_COLORS[log.priority as Priority]}`}>{log.priority}</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${log.status === LogStatus.ACTIVE ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' : 'bg-zinc-700 text-zinc-300 border-zinc-600'}`}>{log.status}</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${ROLE_BADGES[log.creatorRole as Role]}`}>{log.creatorRole}</span>
              </div>
            </div>
            {log.status === LogStatus.ACTIVE && (
               <button onClick={() => onCloseLog(log.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 justify-center"><CheckCircle size={16} /> Mark as Closed</button>
            )}
          </div>
          {log.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-dark-700 bg-black/50 aspect-video flex items-center justify-center relative group">
              <img src={log.imageUrl} alt="Issue" className="w-full h-full object-contain" />
              <a href={log.imageUrl} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 bg-black/80 text-white px-3 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">View Full</a>
            </div>
          )}
          <div className="bg-dark-950 p-3 md:p-4 rounded-lg border border-dark-800">
            <h3 className="text-sm font-medium text-zinc-400 mb-1">Description</h3>
            <p className="text-zinc-100 whitespace-pre-wrap text-sm md:text-base">{log.description}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500"><span className="font-medium text-zinc-400">{log.creatorName}</span><span>•</span><span>{formatDate(log.createdAt)}</span></div>
          </div>
          {canDeleteLog && (
            <div className="flex justify-end"><button onClick={() => { if(confirm('Delete log?')) { onDeleteLog(log.id); onClose(); } }} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"><Trash2 size={14} /> Delete Log</button></div>
          )}
          <hr className="border-dark-800" />
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><History size={18} className="text-brand-500" /> Activity History</h3>
            <div className="space-y-4 mb-6 relative pl-4 border-l-2 border-dark-800">
               {log.history.sort((a: HistoryItem, b: HistoryItem) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((item: HistoryItem) => (
                 <div key={item.id} className="relative pl-6 pb-2">
                   <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-dark-950 border-2 border-brand-500 box-content"></div>
                   <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 hover:border-dark-600 transition-colors group">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2"><span className="font-medium text-white text-xs md:text-sm">{item.creatorName}</span><span className={`text-[10px] px-1.5 rounded border ${ROLE_BADGES[item.creatorRole]}`}>{item.creatorRole}</span></div>
                        <span className="text-[10px] md:text-xs text-zinc-500">{formatDate(item.createdAt)}</span>
                      </div>
                      <p className="text-zinc-300 text-sm">{item.content}</p>
                      {isCreatorOrAdmin(item.createdBy) && (<button onClick={() => onDeleteHistory(log.id, item.id)} className="mt-2 text-xs text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>)}
                   </div>
                 </div>
               ))}
               {log.history.length === 0 && <p className="text-zinc-500 text-sm italic pl-6">No history recorded yet.</p>}
            </div>
            {log.status === LogStatus.ACTIVE && (
              <div className="flex gap-2 items-start bg-dark-950 p-4 rounded-lg border border-dark-800">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a progress update..." className="flex-1 bg-dark-900 border border-dark-700 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-brand-500 outline-none resize-none h-20"></textarea>
                <button disabled={!note.trim() || isSubmitting} onClick={handleAddNote} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg">{isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}</button>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t border-dark-800"><button onClick={() => window.print()} className="flex items-center gap-2 text-zinc-300 hover:text-white bg-dark-800 hover:bg-dark-700 px-4 py-2 rounded-lg transition-colors"><Printer size={18} /> Print Log</button></div>
        </div>
      </Modal>
      <div id="print-area" className="print-only hidden bg-white text-black p-6 font-serif max-w-[210mm] mx-auto">
        {/* Simplified Print View for brevity */}
        <h1 className="text-2xl font-bold mb-4">{log.title}</h1>
        <p>{log.description}</p>
      </div>
    </>
  );
};

// 4. MAIN APP COMPONENT
const App = () => {
  // State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('polymaintenance_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [lastViewedLogs, setLastViewedLogs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<LogType>(LogType.REPAIR);
  const [statusFilter, setStatusFilter] = useState<LogStatus>(LogStatus.ACTIVE);
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbConnectionError, setDbConnectionError] = useState<any>(null);
  
  // Realtime Status
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Ref to hold logs for comparison in realtime callback without re-triggering subscription
  const logsRef = useRef<MaintenanceLog[]>([]);
  useEffect(() => { logsRef.current = logs; }, [logs]);

  // Notification Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const channelRef = useRef<any>(null);

  // Audio Context Ref for Mobile Unlock
  const audioContextRef = useRef<AudioContext | null>(null);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'users'>('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<MaintenanceLog | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // User Management State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Bulk Delete State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

  // --- AUDIO UNLOCKER FOR MOBILE ---
  useEffect(() => {
    const unlockAudio = () => {
      if (!audioContextRef.current) {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                audioContextRef.current = new AudioContext();
                const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContextRef.current.destination);
                source.start(0);
            }
        } catch(e) { console.error("Audio unlock failed", e); }
      } else if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const playNotificationSound = () => {
    try {
       const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
       if (ctx.state === 'suspended') ctx.resume();
       const osc = ctx.createOscillator();
       const gain = ctx.createGain();
       osc.connect(gain);
       gain.connect(ctx.destination);
       osc.type = 'sine';
       osc.frequency.setValueAtTime(880, ctx.currentTime); 
       osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1); 
       gain.gain.setValueAtTime(0.1, ctx.currentTime);
       gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
       osc.start();
       osc.stop(ctx.currentTime + 0.1);
    } catch (e) { console.error("Audio play failed", e); }
  };

  const getLogNotificationStatus = (log: MaintenanceLog): 'new' | 'updated' | 'read' => {
    const lastViewed = lastViewedLogs[log.id];
    const lastActivity = getLogLastActivity(log);
    if (!lastViewed) return 'new';
    if (new Date(lastActivity).getTime() > new Date(lastViewed).getTime()) return 'updated';
    return 'read';
  };

  const markLogAsRead = async (logId: string) => {
      const now = new Date().toISOString();
      setLastViewedLogs(prev => ({ ...prev, [logId]: now }));
      if (!currentUser) return;
      try { await supabase.from('user_log_views').upsert({ user_id: currentUser.id, log_id: logId, last_viewed_at: now }); } catch (e) {}
  };

  const handleOpenLogCard = (log: MaintenanceLog) => {
      if (isSelectionMode) { toggleLogSelection(log.id); } 
      else { setSelectedLog(log); markLogAsRead(log.id); }
  };

  const unreadCounts = {
      [LogType.REPAIR]: logs.filter(l => l.type === LogType.REPAIR && getLogNotificationStatus(l) !== 'read').length,
      [LogType.PREVENTIVE_MAINTENANCE]: logs.filter(l => l.type === LogType.PREVENTIVE_MAINTENANCE && getLogNotificationStatus(l) !== 'read').length,
      active: logs.filter(l => l.type === activeTab && l.status === LogStatus.ACTIVE && getLogNotificationStatus(l) !== 'read').length
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('polymaintenance_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('polymaintenance_user');
    setLastViewedLogs({});
  };

  const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 5000);
  };

  useEffect(() => { if ('Notification' in window) setNotificationPermission(Notification.permission); }, []);

  // Service Worker Listener
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OPEN_LOG' && event.data.logId) {
        const targetLog = logs.find(l => l.id === event.data.logId);
        if (targetLog) { setSelectedLog(targetLog); markLogAsRead(targetLog.id); } 
        else { refreshLogs(); }
      }
    };
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => { if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage); };
  }, [logs]);

  const requestNotificationPermission = async () => {
    if (!window.isSecureContext) { alert("System notifications require HTTPS."); return; }
     const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
     const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
     if (isIOS && !isStandalone) { alert("To enable notifications on iOS, please add this app to your Home Screen first."); return; }
     if (!('Notification' in window)) { alert("This browser does not support system notifications."); return; }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        addToast("Notifications enabled!", 'success');
        showSystemNotification("Notifications Enabled", "You will now receive alerts for new logs.", null);
      }
    } catch (e) { alert("Error requesting notification permission."); }
  };

  const handleTestNotification = async () => {
      if (Notification.permission === 'granted') { await showSystemNotification("Test Notification", "If you see this, notifications are working!", null); } 
      else { alert("Please enable notifications first."); }
  };

  const handleSimulateRemoteEvent = async () => {
     if (Notification.permission !== 'granted') { alert("Enable notifications first."); return; }
     if (channelRef.current) {
         addToast("Simulating remote event...", "info");
         // We manually trigger the logic that would normally happen inside the Realtime callback
         // This is purely for testing purposes locally since we can't easily fake a Postgres event from client
         showSystemNotification("Simulated: New Update", "A remote user added a note.", null);
     } else { alert("Realtime channel not connected yet."); }
  };

  const showSystemNotification = async (title: string, body: string, logId: string | null = null) => {
      if (Notification.permission === 'granted') {
          playNotificationSound();
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
          const options: any = {
            body: body,
            icon: "https://aistudiocdn.com/lucide-react/wrench.png",
            tag: logId || 'general',
            data: { logId: logId, url: window.location.origin }
          };
          if (!isIOS) { options.badge = "https://aistudiocdn.com/lucide-react/wrench.png"; options.vibrate = [200, 100, 200]; }
          try {
              if ('serviceWorker' in navigator) {
                  const registration = await navigator.serviceWorker.ready;
                  await registration.showNotification(title, options);
              } else { new Notification(title, options); }
          } catch (e) { 
              try { new Notification(title, options); } catch(e2) {} 
          }
      }
  };

  const refreshLogs = async () => {
    try {
      const { data: logData, error: logError } = await supabase.from('logs').select('*');
      if (logError) throw logError;
      const mappedLogs = (logData || []).map(mapLogFromDB);
      mappedLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLogs(mappedLogs);
    } catch (e) { console.error("Silent refresh failed", e); }
  };

  useEffect(() => {
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') refreshLogs(); };
    window.addEventListener('focus', refreshLogs);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', refreshLogs);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setDbConnectionError(null);
    try {
      // Parallel Fetch for Speed
      const [userRes, logRes] = await Promise.all([
          supabase.from('users').select('*'),
          supabase.from('logs').select('*')
      ]);

      if (userRes.error) throw userRes.error;
      const mappedUsers = (userRes.data || []).map(mapUserFromDB);
      setUsers(mappedUsers);
      
      // Auto-seed admin if empty
      if (mappedUsers.length === 0) {
         const defaultAdmin = MOCK_USERS[0];
         await supabase.from('users').insert([mapUserToDB(defaultAdmin)]);
         setUsers([defaultAdmin]);
      }

      if (logRes.error) throw logRes.error;
      const mappedLogs = (logRes.data || []).map(mapLogFromDB);
      setLogs(mappedLogs);

    } catch (error: any) {
      console.error("Error fetching data:", error);
      setDbConnectionError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch Receipts
    supabase.from('user_log_views').select('log_id, last_viewed_at').eq('user_id', currentUser.id)
      .then(({data}) => {
          if (data) {
             const map: Record<string, string> = {};
             data.forEach((item: any) => map[item.log_id] = item.last_viewed_at);
             setLastViewedLogs(map);
          }
      });

    const channel = supabase.channel('polymaintenance_global');
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, (payload) => {
          if (payload.eventType === 'INSERT') {
              const newLog = mapLogFromDB(payload.new);
              setLogs(prev => {
                  if (prev.some(l => l.id === newLog.id)) return prev;
                  return [newLog, ...prev];
              });
              if (newLog.createdBy !== currentUser.id) {
                  addToast(`New Log: ${newLog.title}`, 'info');
                  showSystemNotification("New Maintenance Log", `${newLog.title} by ${newLog.creatorName}`, newLog.id);
              }
          } else if (payload.eventType === 'UPDATE') {
              const updatedLog = mapLogFromDB(payload.new);
              // NOTIFICATION LOGIC
              const existingLog = logsRef.current.find(l => l.id === updatedLog.id);
              // Use lax comparison or fallback if existingLog is missing to ensure we notify on important changes
              const oldHistoryLen = existingLog ? existingLog.history.length : 0;
              const newHistoryLen = updatedLog.history.length;

              if (newHistoryLen > oldHistoryLen) {
                  const latestHistory = updatedLog.history[newHistoryLen - 1];
                  if (latestHistory.createdBy !== currentUser.id) {
                        addToast(`Update on "${updatedLog.title}"`, 'info');
                        showSystemNotification(`Update: ${updatedLog.title}`, latestHistory.content, updatedLog.id);
                  }
              } else if (updatedLog.status === LogStatus.CLOSED && existingLog?.status === LogStatus.ACTIVE) {
                    addToast(`Log Closed: ${updatedLog.title}`, 'success');
                    showSystemNotification(`Log Closed`, `"${updatedLog.title}" marked as closed.`, updatedLog.id);
              }
              setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
          } else if (payload.eventType === 'DELETE') {
              setLogs(prev => prev.filter(l => l.id !== payload.old.id));
          }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
          if (payload.eventType === 'INSERT') setUsers(prev => [...prev, mapUserFromDB(payload.new)]);
          if (payload.eventType === 'UPDATE') setUsers(prev => prev.map(u => u.id === payload.new.id ? mapUserFromDB(payload.new) : u));
          if (payload.eventType === 'DELETE') setUsers(prev => prev.filter(u => u.id !== payload.old.id));
      })
      .subscribe((status) => {
         setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // --- ACTIONS (Simplified for brevity as logic logic is same) ---
  const handleCreateLog = async (formData: any) => {
    if (!currentUser) return;
    setIsActionLoading(true);
    let imageUrl = '';
    if (formData.image) { try { imageUrl = await compressImage(formData.image); } catch (err) { alert("Image error"); setIsActionLoading(false); return; } }
    const now = new Date().toISOString();
    const newLog: MaintenanceLog = {
      id: generateId(), title: formData.title, description: formData.description, priority: formData.priority,
      status: LogStatus.ACTIVE, type: activeTab, createdBy: currentUser.id, creatorName: currentUser.fullName,
      creatorRole: currentUser.role, createdAt: now, imageUrl: imageUrl, history: []
    };
    try {
      const { error } = await supabase.from('logs').insert([mapLogToDB(newLog)]);
      if (error) throw error;
      setLogs(prev => [newLog, ...prev]);
      await supabase.from('user_log_views').upsert({ user_id: currentUser.id, log_id: newLog.id, last_viewed_at: now });
      setLastViewedLogs(prev => ({ ...prev, [newLog.id]: now }));
      setIsCreateModalOpen(false);
      addToast('Log created', 'success');
    } catch (error: any) { alert("Failed to save log."); } finally { setIsActionLoading(false); }
  };

  const handleAddHistory = async (logId: string, content: string) => {
    if (!currentUser) return;
    const currentLog = logs.find(l => l.id === logId);
    if (!currentLog) return;
    const newHistory: HistoryItem = { id: generateId(), content, createdBy: currentUser.id, creatorName: currentUser.fullName, creatorRole: currentUser.role, createdAt: new Date().toISOString() };
    const updatedHistory = [...currentLog.history, newHistory];
    try {
      const { error } = await supabase.from('logs').update({ history: updatedHistory }).eq('id', logId);
      if (error) throw error;
      setLogs(prev => prev.map(log => log.id === logId ? { ...log, history: updatedHistory } : log));
      markLogAsRead(logId);
      if (selectedLog?.id === logId) setSelectedLog({ ...selectedLog, history: updatedHistory });
      addToast('Note added', 'success');
    } catch (error: any) { alert("Failed to update."); }
  };

  const handleCloseLog = async (logId: string) => {
    if(!currentUser) return;
    const currentLog = logs.find(l => l.id === logId);
    if (!currentLog) return;
    const closeNote: HistoryItem = { id: generateId(), content: 'Log marked as CLOSED.', createdBy: currentUser.id, creatorName: currentUser.fullName, creatorRole: currentUser.role, createdAt: new Date().toISOString() };
    const updatedHistory = [...currentLog.history, closeNote];
    const closedAt = new Date().toISOString();
    try {
      const { error } = await supabase.from('logs').update({ status: LogStatus.CLOSED, closed_at: closedAt, history: updatedHistory }).eq('id', logId);
      if (error) throw error;
      setLogs(prev => prev.map(log => log.id === logId ? { ...log, status: LogStatus.CLOSED, closedAt, history: updatedHistory } : log));
      markLogAsRead(logId);
      addToast('Log closed', 'success');
    } catch (error: any) { alert("Failed to close."); }
  };

  const handleDeleteLog = async (logId: string) => {
     try {
       const { error } = await supabase.from('logs').delete().eq('id', logId);
       if (error) throw error;
       setLogs(prev => prev.filter(l => l.id !== logId));
       if (selectedLog?.id === logId) setSelectedLog(null);
       addToast('Log deleted', 'success');
     } catch (error: any) { alert("Failed to delete."); }
  };

  const handleBulkDelete = async () => {
    if (!currentUser || currentUser.role !== Role.ADMIN || selectedLogIds.size === 0) return;
    if(!confirm(`Delete ${selectedLogIds.size} logs?`)) return;
    setIsActionLoading(true);
    try {
        const idsToDelete = Array.from(selectedLogIds);
        const { error } = await supabase.from('logs').delete().in('id', idsToDelete);
        if (error) throw error;
        setLogs(prev => prev.filter(l => !selectedLogIds.has(l.id)));
        setSelectedLogIds(new Set());
        setIsSelectionMode(false);
        addToast(`${idsToDelete.length} logs deleted`, 'success');
    } catch (error: any) { alert("Failed to delete."); } finally { setIsActionLoading(false); }
  };

  const handleDeleteHistory = async (logId: string, historyId: string) => {
      const currentLog = logs.find(l => l.id === logId);
      if (!currentLog) return;
      const updatedHistory = currentLog.history.filter(h => h.id !== historyId);
      try {
        const { error } = await supabase.from('logs').update({ history: updatedHistory }).eq('id', logId);
        if (error) throw error;
        setLogs(prev => prev.map(log => log.id === logId ? { ...log, history: updatedHistory} : log));
        if(selectedLog) setSelectedLog({ ...selectedLog, history: updatedHistory });
        addToast('History item removed', 'success');
      } catch (error: any) { alert("Failed."); }
  };

  const handleCreateUser = async (formData: any) => {
      setIsActionLoading(true);
      const newUser: User = { id: generateId(), username: formData.username, password: 'password', fullName: formData.fullName, role: formData.role };
      try {
        const { error } = await supabase.from('users').insert([mapUserToDB(newUser)]);
        if (error) throw error;
        setUsers(prev => [...prev, newUser]);
        setIsUserModalOpen(false);
        addToast('User created', 'success');
      } catch (error: any) { alert("Failed."); } finally { setIsActionLoading(false); }
  };

  const handleChangePassword = async (current: string, newPass: string, onError: (msg: string) => void) => {
      if (!currentUser) return;
      setIsActionLoading(true);
      if (currentUser.password !== current) { onError("Incorrect current password."); setIsActionLoading(false); return; }
      try {
          const { error } = await supabase.from('users').update({ password: newPass }).eq('id', currentUser.id);
          if (error) throw error;
          const updatedUser = { ...currentUser, password: newPass };
          setCurrentUser(updatedUser);
          localStorage.setItem('polymaintenance_user', JSON.stringify(updatedUser));
          setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
          setIsChangePasswordOpen(false);
          addToast('Password updated', 'success');
      } catch (error: any) { onError("Failed."); } finally { setIsActionLoading(false); }
  };

  const handleDeleteUser = async (userId: string) => {
      if(userId === currentUser?.id || !confirm("Are you sure?")) return;
      try {
        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) throw error;
        setUsers(prev => prev.filter(u => u.id !== userId));
        addToast('User deleted', 'success');
      } catch (error: any) { alert("Failed."); }
  };

  const toggleSelectionMode = () => { setIsSelectionMode(!isSelectionMode); setSelectedLogIds(new Set()); };
  const toggleLogSelection = (logId: string) => {
      const newSet = new Set(selectedLogIds);
      if (newSet.has(logId)) newSet.delete(logId); else newSet.add(logId);
      setSelectedLogIds(newSet);
  };

  if (dbConnectionError) return <DatabaseErrorScreen error={dbConnectionError} onRetry={fetchData} />;
  if (!currentUser) return <Login onLogin={handleLogin} users={users} isLoading={loading} />;

  const filteredLogs = logs.filter(l => l.type === activeTab && l.status === statusFilter);
  filteredLogs.sort((a, b) => {
    if (sortBy === 'priority') {
      const weightA = PRIORITY_WEIGHTS[a.priority];
      const weightB = PRIORITY_WEIGHTS[b.priority];
      if (weightA !== weightB) return weightB - weightA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortBy === 'date_oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); }
  });

  return (
    <div className="flex h-screen bg-dark-950 text-zinc-100 overflow-hidden relative">
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 no-print w-full max-w-xs pointer-events-none">
        {toasts.map(toast => (
            <div key={toast.id} className={`pointer-events-auto p-4 rounded-lg shadow-xl border border-white/10 text-white text-sm font-medium animate-in slide-in-from-right fade-in flex items-start gap-3 backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-600/90' : toast.type === 'error' ? 'bg-red-600/90' : 'bg-brand-600/90'}`}>
                <div className="mt-0.5 shrink-0">{toast.type === 'success' ? <CheckCircle size={16} /> : toast.type === 'error' ? <AlertTriangle size={16} /> : <Info size={16} />}</div>
                <div className="flex-1 leading-snug">{toast.message}</div>
                <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="opacity-70 hover:opacity-100"><X size={14}/></button>
            </div>
        ))}
      </div>

      <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 z-40 w-64 bg-dark-900 border-r border-dark-800 transition-transform duration-300 ease-in-out flex flex-col no-print`}>
        <div className="p-6 border-b border-dark-800 flex items-center gap-3">
          <div className="bg-brand-500 rounded p-1"><Wrench className="text-white w-5 h-5" /></div>
          <span className="font-bold text-lg tracking-tight">PolyMaintenance</span>
          {/* Connection Status Dot */}
          <div className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'} shadow-[0_0_8px] ml-auto`} title={isRealtimeConnected ? "Connected to Live Updates" : "Disconnected"}></div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20' : 'text-zinc-400 hover:bg-dark-800 hover:text-white'}`}><LayoutDashboard size={20} /> Dashboard</button>
          {currentUser.role === Role.ADMIN && (<button onClick={() => { setView('users'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'users' ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20' : 'text-zinc-400 hover:bg-dark-800 hover:text-white'}`}><Users size={20} /> User Management</button>)}
           <button onClick={() => { setIsChangePasswordOpen(true); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-400 hover:bg-dark-800 hover:text-white`}><Lock size={20} /> Change Password</button>

          <div className="mt-4 pt-4 border-t border-dark-800">
              <p className="px-4 text-xs font-semibold text-zinc-500 uppercase mb-2">Notifications</p>
              {notificationPermission !== 'granted' ? (
                <button onClick={requestNotificationPermission} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-400 hover:bg-dark-800 hover:text-white`}><BellRing size={20} /> Enable Notifications</button>
              ) : (
                <>
                <div className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-emerald-500 bg-emerald-500/10 border border-emerald-500/20"><Wifi size={20} /> Active</div>
                 <button onClick={handleTestNotification} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-400 hover:bg-dark-800 hover:text-white mt-1`}><Siren size={20} /> Test Notification</button>
                 <button onClick={handleSimulateRemoteEvent} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-400 hover:bg-dark-800 hover:text-white mt-1`}><Zap size={20} /> Simulate Update</button>
                </>
              )}
          </div>
        </nav>

        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${currentUser.role === Role.ADMIN ? 'bg-purple-600' : currentUser.role === Role.ENGINEERING ? 'bg-cyan-600' : 'bg-emerald-600'}`}>{currentUser.fullName.charAt(0)}</div>
            <div className="overflow-hidden"><p className="text-sm font-medium truncate">{currentUser.fullName}</p><p className="text-xs text-zinc-500 truncate capitalize">{currentUser.role.toLowerCase()}</p></div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-red-400 transition-colors text-sm py-2"><LogOut size={16} /> Sign Out</button>
        </div>
      </aside>
      {isSidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden no-print" onClick={() => setIsSidebarOpen(false)}></div>}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative no-print">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-dark-800 bg-dark-900">
           <div className="flex items-center gap-2"><button onClick={() => setIsSidebarOpen(true)} className="text-zinc-400"><Menu size={24} /></button><span className="font-bold">PolyMaintenance</span></div>
        </header>

        {view === 'dashboard' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-8">
                <div><h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Maintenance Logs</h1><p className="text-zinc-400 text-sm">Track repairs and preventive measures in real-time.</p></div>
                <div className="flex gap-2">
                    {currentUser.role === Role.ADMIN && (<button onClick={toggleSelectionMode} className={`px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${isSelectionMode ? 'bg-zinc-700 text-white' : 'bg-dark-800 text-zinc-300 hover:bg-dark-700'}`}>{isSelectionMode ? <X size={20} /> : <CheckSquare size={20} />}{isSelectionMode ? 'Cancel Selection' : 'Select Logs'}</button>)}
                    <button onClick={() => setIsCreateModalOpen(true)} className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-brand-500/20 transition-all hover:scale-105 justify-center"><Plus size={20} /> Create Log</button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-dark-800 pb-1">
                <div className="flex gap-4 md:gap-6 overflow-x-auto w-full md:w-auto">
                  <button onClick={() => setActiveTab(LogType.REPAIR)} className={`pb-3 text-xs md:text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab === LogType.REPAIR ? 'text-brand-500' : 'text-zinc-400 hover:text-zinc-200'}`}>Repairs {unreadCounts[LogType.REPAIR] > 0 && (<span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">{unreadCounts[LogType.REPAIR]}</span>)}{activeTab === LogType.REPAIR && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500 rounded-t-full"></span>}</button>
                  <button onClick={() => setActiveTab(LogType.PREVENTIVE_MAINTENANCE)} className={`pb-3 text-xs md:text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab === LogType.PREVENTIVE_MAINTENANCE ? 'text-brand-500' : 'text-zinc-400 hover:text-zinc-200'}`}>Preventive Maintenance {unreadCounts[LogType.PREVENTIVE_MAINTENANCE] > 0 && (<span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">{unreadCounts[LogType.PREVENTIVE_MAINTENANCE]}</span>)}{activeTab === LogType.PREVENTIVE_MAINTENANCE && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500 rounded-t-full"></span>}</button>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                  <div className="relative flex-1 md:flex-none">
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="w-full md:w-auto appearance-none bg-dark-900 border border-dark-800 text-zinc-400 text-xs md:text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-brand-500 cursor-pointer h-full"><option value="priority">Sort: Priority</option><option value="date_newest">Sort: Newest</option><option value="date_oldest">Sort: Oldest</option></select>
                    <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={14} />
                  </div>
                  <div className="flex bg-dark-900 p-1 rounded-lg border border-dark-800 flex-1 md:flex-none">
                      <button onClick={() => setStatusFilter(LogStatus.ACTIVE)} className={`flex-1 md:flex-none px-3 py-1 text-xs rounded-md transition-all flex items-center justify-center gap-2 ${statusFilter === LogStatus.ACTIVE ? 'bg-dark-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Active ({logs.filter(l => l.type === activeTab && l.status === LogStatus.ACTIVE).length}) {unreadCounts.active > 0 && (<span className="w-2 h-2 rounded-full bg-red-500"></span>)}</button>
                      <button onClick={() => setStatusFilter(LogStatus.CLOSED)} className={`flex-1 md:flex-none px-3 py-1 text-xs rounded-md transition-all ${statusFilter === LogStatus.CLOSED ? 'bg-dark-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Closed ({logs.filter(l => l.type === activeTab && l.status === LogStatus.CLOSED).length})</button>
                  </div>
                </div>
              </div>

              {/* LOADING & EMPTY STATES */}
              {loading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-4 pb-20">
                     {[1,2,3,4,5,6].map(i => <SkeletonLogCard key={i} />)}
                 </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-4 pb-20">
                  {filteredLogs.map(log => {
                    const status = getLogNotificationStatus(log);
                    return (
                    <div key={log.id} onClick={() => handleOpenLogCard(log)} className={`bg-dark-900 border rounded-lg md:rounded-xl p-0 transition-all cursor-pointer group overflow-hidden flex flex-row md:flex-col min-h-[6rem] md:h-full relative items-stretch ${isSelectionMode && selectedLogIds.has(log.id) ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-500/5' : 'border-dark-800 hover:border-brand-500/50'}`}>
                      {status === 'new' && !isSelectionMode && (<div className="absolute top-0 right-0 z-10 p-2"><div className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg animate-pulse">NEW</div></div>)}
                       {status === 'updated' && !isSelectionMode && (<div className="absolute top-0 right-0 z-10 p-2"><div className="flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg animate-pulse">UPDATED</div></div>)}
                      {isSelectionMode && (<div className="absolute top-2 right-2 z-10"><div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${selectedLogIds.has(log.id) ? 'bg-brand-500 text-white' : 'bg-dark-800 border border-zinc-600 text-transparent'}`}><CheckSquare size={16} /></div></div>)}
                      <div className="w-20 md:w-full h-auto md:h-40 shrink-0 overflow-hidden relative border-r md:border-r-0 md:border-b border-dark-800 bg-dark-900/50 flex items-center justify-center">
                        {log.imageUrl ? (<><img src={log.imageUrl} alt={log.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /><div className="hidden md:block absolute inset-0 bg-gradient-to-t from-dark-900 to-transparent opacity-80"></div></>) : (<div className="flex flex-col items-center justify-center text-zinc-600 gap-1 p-1 text-center"><ImageOff size={20} /><span className="text-[8px] font-bold uppercase leading-tight">No Attachment</span></div>)}
                      </div>
                      <div className="p-3 md:p-4 flex-1 flex flex-col justify-between min-w-0">
                        <div className="flex justify-between items-start mb-1 md:mb-2 pr-8 md:pr-0"><h3 className={`font-semibold text-sm md:text-lg text-white line-clamp-1 ${status !== 'read' ? 'text-white font-bold' : 'text-zinc-300'}`}>{log.title}</h3><span className={`px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold border ${PRIORITY_COLORS[log.priority]} uppercase shrink-0 ml-2`}>{log.priority === Priority.CRITICAL ? 'CRIT' : log.priority}</span></div>
                        <p className={`text-xs md:text-sm line-clamp-2 mb-2 md:mb-4 flex-1 md:flex-none ${status !== 'read' ? 'text-zinc-200' : 'text-zinc-500'}`}>{log.description}</p>
                        <div className="mt-auto flex flex-col gap-1 text-[10px] md:text-xs text-zinc-500">
                             <div className="flex items-center gap-1.5"><Clock size={12} /><span>{formatDate(log.createdAt)}</span>{log.history.length > 0 && (<span className={`flex items-center gap-1 ml-2 ${status !== 'read' ? 'text-zinc-300' : 'text-zinc-500'}`}><MessageCircle size={10} />{log.history.length}</span>)}</div>
                             <div className="flex items-center gap-1.5"><span className="text-zinc-400">by {log.creatorName}</span><span className={`px-1.5 py-0.5 rounded-[4px] border ${ROLE_BADGES[log.creatorRole]} text-[9px] md:text-[10px] font-medium leading-none`}>{log.creatorRole}</span></div>
                        </div>
                      </div>
                    </div>
                  );})}
                </div>
              )}
              {!loading && filteredLogs.length === 0 && (<div className="flex flex-col items-center justify-center py-20 text-zinc-600"><div className="bg-dark-900 p-4 rounded-full mb-4"><ClipboardList size={40} className="opacity-20" /></div><p>No logs found in this category.</p></div>)}
            </div>
            {isSelectionMode && selectedLogIds.size > 0 && (<div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-8 md:translate-x-0 z-50 animate-in fade-in slide-in-from-bottom-4"><button onClick={handleBulkDelete} disabled={isActionLoading} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2">{isActionLoading ? <Loader2 className="animate-spin" /> : <Trash2 size={20} />} Delete Selected ({selectedLogIds.size})</button></div>)}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
             <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6 md:mb-8"><h1 className="text-xl md:text-2xl font-bold text-white">User Management</h1><button onClick={() => setIsUserModalOpen(true)} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600">Add User</button></div>
                <div className="bg-dark-900 border border-dark-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-dark-950 text-zinc-400 text-xs uppercase"><tr><th className="p-3 md:p-4 font-medium">User</th><th className="p-3 md:p-4 font-medium">Role</th><th className="p-3 md:p-4 font-medium text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-dark-800">
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-dark-800/50 transition-colors">
                          <td className="p-3 md:p-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-dark-800 flex items-center justify-center text-xs font-bold text-zinc-400">{user.fullName.charAt(0)}</div><div><p className="text-white font-medium text-sm">{user.fullName}</p><p className="text-zinc-500 text-xs">@{user.username}</p></div></div></td>
                          <td className="p-3 md:p-4"><span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-medium border ${ROLE_BADGES[user.role]}`}>{user.role}</span></td>
                          <td className="p-3 md:p-4 text-right">{user.username !== 'admin' && (<button onClick={() => handleDeleteUser(user.id)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}
      </main>

      <CreateLogModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateLog} activeTab={activeTab} currentUser={currentUser} isLoading={isActionLoading} />
      <CreateUserModal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} onSubmit={handleCreateUser} isLoading={isActionLoading} />
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} onSubmit={handleChangePassword} isLoading={isActionLoading} />
      <LogDetailModal log={selectedLog} currentUser={currentUser} isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} onAddHistory={handleAddHistory} onCloseLog={handleCloseLog} onDeleteLog={handleDeleteLog} onDeleteHistory={handleDeleteHistory} />
    </div>
  );
};

export default App;