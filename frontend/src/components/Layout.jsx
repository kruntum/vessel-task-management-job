import React, { useEffect, useState } from 'react';
import { Calendar, LayoutDashboard, CheckSquare, ShieldAlert, LogOut, ChevronRight, Menu, X, User, Sun, Moon, ChevronDown } from 'lucide-react';

function Layout({ activeTab, setActiveTab, currentUser, setCurrentUser, theme, setTheme, children }) {
  const [users, setUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // Fetch users from backend for role switcher
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/auth/users`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        // Default to first user (Admin) if none is active
        setCurrentUser((curr) => curr || (data.length > 0 ? data[0] : null));
      })
      .catch((err) => console.error('Failed to load users:', err));
  }, [setCurrentUser]);

  const handleUserChange = (selected) => {
    if (selected) {
      setCurrentUser(selected);
      // Reset view to schedules when changing user to prevent access to hidden tabs
      setActiveTab('schedules');
    }
  };

  const menuItems = [
    { id: 'schedules', label: 'Master Schedule', icon: Calendar, roles: ['ADMIN', 'SUPERVISOR', 'STAFF'] },
    { id: 'jobs', label: 'My Tasks (Kanban)', icon: CheckSquare, roles: ['STAFF'] },
    { id: 'supervisor-jobs', label: 'Job Cards Panel', icon: LayoutDashboard, roles: ['ADMIN', 'SUPERVISOR'] },
  ];

  const visibleMenuItems = menuItems.filter(
    (item) => currentUser && item.roles.includes(currentUser.role)
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {!sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <Calendar className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Logistics Flow
            </span>
          </div>
          <button className="md:hidden text-slate-400 hover:text-slate-200" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Switcher Info */}
        <div className="p-4 border-b border-border bg-muted/30">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Simulate User Role
          </label>
          <div className="relative">
            <button
              onClick={() => setIsSelectorOpen(!isSelectorOpen)}
              className="flex w-full items-center justify-between gap-2 bg-background border border-input rounded-lg p-2.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring transition-all hover:bg-accent/50 cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <User className="h-4 w-4 text-indigo-500 shrink-0" />
                <span className="truncate">{currentUser ? `${currentUser.name} (${currentUser.role})` : 'Select User...'}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
            
            {isSelectorOpen && (
              <>
                {/* Click outside overlay */}
                <div className="fixed inset-0 z-30" onClick={() => setIsSelectorOpen(false)} />
                {/* Floating list */}
                <div className="absolute left-0 right-0 mt-1.5 z-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md max-h-60 overflow-y-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        handleUserChange(u);
                        setIsSelectorOpen(false);
                      }}
                      className={`flex w-full items-center rounded px-2.5 py-2 text-xs font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-left cursor-pointer ${
                        currentUser?.username === u.username ? 'bg-accent text-accent-foreground font-semibold' : ''
                      }`}
                    >
                      {u.name} ({u.role})
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 768) setSidebarOpen(false); // Auto close sidebar on mobile click
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-500 border border-indigo-500/20 dark:text-indigo-400'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-border p-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
              {currentUser?.name ? currentUser.name.charAt(0) : '?'}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium text-foreground">{currentUser?.name || 'Loading...'}</p>
              <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {currentUser?.role || '...'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card/60 backdrop-blur-md px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {activeTab === 'schedules' && 'Master Vessel Schedule'}
              {activeTab === 'jobs' && 'My Tasks Board'}
              {activeTab === 'supervisor-jobs' && 'Job Cards Panel'}
            </h1>
          </div>
          
          {/* Active Role and Theme Switcher */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="flex items-center gap-1.5 rounded-full bg-indigo-950/40 border border-indigo-500/20 px-3 py-1 text-xs text-indigo-400">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              Mode: <span className="font-semibold">{currentUser?.role}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Container */}
        <main className="flex-1 overflow-hidden p-6 bg-background transition-colors duration-200">
          <div className="mx-auto max-w-7xl h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
