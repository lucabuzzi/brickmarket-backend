import React from 'react';
import { Coins, Flame, LogOut, ShieldAlert, User } from 'lucide-react';

export default function Navbar({ 
  user, 
  wallet, 
  onLogout, 
  onShowAuthModal, 
  onShowAddCredits, 
  activeDivision, 
  setActiveDivision 
}) {
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-cyber-border bg-cyber-bg/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-cyber-neonCyan bg-black/50 shadow-neon-cyan">
              <Flame className="h-6 w-6 text-cyber-neonCyan animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-wider text-white uppercase font-mono">
                CLUTCH<span className="text-cyber-neonMagenta text-glow-magenta">VAULT</span>
              </span>
              <div className="text-[9px] uppercase tracking-widest text-cyber-muted font-semibold">
                High-Hype Arcade
              </div>
            </div>
          </div>

          {/* Division Toggles (Center) */}
          <div className="hidden md:flex items-center space-x-2 bg-black/40 p-1 rounded-lg border border-cyber-border">
            <button
              onClick={() => setActiveDivision('lego')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all duration-300 ${
                activeDivision === 'lego'
                  ? 'bg-cyber-neonCyan text-black font-extrabold shadow-neon-cyan'
                  : 'text-cyber-muted hover:text-white'
              }`}
            >
              🧱 Brick Division
            </button>
            <button
              onClick={() => setActiveDivision('pokemon')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all duration-300 ${
                activeDivision === 'pokemon'
                  ? 'bg-cyber-neonMagenta text-white font-extrabold shadow-neon-magenta'
                  : 'text-cyber-muted hover:text-white'
              }`}
            >
              🃏 Card Division
            </button>
          </div>

          {/* User Wallet & Authentication (Right) */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* Credits Balance display */}
                <div 
                  onClick={onShowAddCredits}
                  className="flex items-center space-x-2 rounded-lg border border-cyber-neonCyan/30 bg-cyber-neonCyan/5 px-3 py-1.5 cursor-pointer hover:border-cyber-neonCyan transition-all duration-300 group"
                  title="Click to recharge credits"
                >
                  <Coins className="h-4 w-4 text-cyber-neonCyan group-hover:scale-110 transition-transform" />
                  <div className="text-right">
                    <div className="text-[9px] uppercase text-cyber-muted font-bold leading-none">Wallet</div>
                    <span className="font-mono text-sm font-bold text-cyber-neonCyan text-glow-cyan">
                      {wallet.balanceCredits.toFixed(0)} <span className="text-[10px]">CR</span>
                    </span>
                  </div>
                </div>

                {/* Profile Widget */}
                <div className="hidden lg:flex items-center space-x-2 rounded-lg border border-cyber-border bg-black/30 px-3 py-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyber-accent/20 border border-cyber-accent text-cyber-accent">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold max-w-[80px] truncate">{user.username}</div>
                    {user.role === 'admin' && (
                      <span className="inline-flex items-center text-[8px] bg-red-950 border border-red-500 text-red-400 px-1 rounded font-mono font-bold leading-none">
                        <ShieldAlert className="h-2 w-2 mr-0.5" /> ADMIN
                      </span>
                    )}
                  </div>
                </div>

                {/* Log Out */}
                <button
                  onClick={onLogout}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyber-border hover:border-red-500 hover:bg-red-950/20 text-cyber-muted hover:text-red-400 transition-all duration-300"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={onShowAuthModal}
                className="flex items-center space-x-2 rounded-lg border border-cyber-neonCyan bg-cyber-neonCyan/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyber-neonCyan shadow-neon-cyan hover:bg-cyber-neonCyan hover:text-black transition-all duration-300"
              >
                <User className="h-4 w-4" />
                <span>Sign In / Register</span>
              </button>
            )}
          </div>
        </div>

        {/* Division Toggles (Mobile View) */}
        <div className="flex md:hidden items-center justify-center space-x-2 py-2 border-t border-cyber-border">
          <button
            onClick={() => setActiveDivision('lego')}
            className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase transition-all duration-300 text-center ${
              activeDivision === 'lego'
                ? 'bg-cyber-neonCyan text-black font-extrabold shadow-neon-cyan'
                : 'text-cyber-muted'
            }`}
          >
            🧱 Brick Division
          </button>
          <button
            onClick={() => setActiveDivision('pokemon')}
            className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase transition-all duration-300 text-center ${
              activeDivision === 'pokemon'
                ? 'bg-cyber-neonMagenta text-white font-extrabold shadow-neon-magenta'
                : 'text-cyber-muted font-bold'
            }`}
          >
            🃏 Card Division
          </button>
        </div>
      </div>
    </nav>
  );
}
