import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import MasterScheduleList from './components/MasterScheduleList';
import KanbanBoard from './components/KanbanBoard';
import SupervisorDashboard from './components/SupervisorDashboard';
import { Toaster } from 'sonner';

// Create TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function App() {
  const [activeTab, setActiveTab] = useState('schedules');
  const [currentUser, setCurrentUser] = useState(null);
  
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" theme={theme === 'dark' ? 'dark' : 'light'} closeButton richColors />
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        theme={theme}
        setTheme={setTheme}
      >
        {activeTab === 'schedules' && (
          <MasterScheduleList currentUser={currentUser} />
        )}
        
        {activeTab === 'jobs' && (
          <KanbanBoard currentUser={currentUser} />
        )}

        {activeTab === 'supervisor-jobs' && (
          <SupervisorDashboard currentUser={currentUser} theme={theme} />
        )}
      </Layout>
    </QueryClientProvider>
  );
}

export default App;
