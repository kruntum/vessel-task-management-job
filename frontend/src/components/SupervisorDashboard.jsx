import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, ClipboardList, AlertTriangle, RefreshCw, Calendar, Clock, User } from 'lucide-react';

const STATUS_LABELS = {
  PAYMENT: 'Payment Validation',
  SURRENDER_ING: 'B/L Surrendering',
  FINAL_BL: 'Final B/L Processing',
  COMPLETE: 'Completed',
};

const STATUS_COLORS = {
  PAYMENT: '#818cf8',      // Indigo 400
  SURRENDER_ING: '#22d3ee',  // Cyan 400
  FINAL_BL: '#f43f5e',       // Rose 500
  COMPLETE: '#10b981',       // Emerald 500
};

const MONTHS = [
  { value: 'ALL', label: 'All Months' },
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
];

function SupervisorDashboard({ currentUser, theme }) {
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#cbd5e1';
  const axisColor = isDark ? '#64748b' : '#475569';
  const tooltipBg = isDark ? '#090d16' : '#ffffff';
  const tooltipBorder = isDark ? '#1e293b' : '#cbd5e1';
  const tooltipLabelColor = isDark ? '#cbd5e1' : '#0f172a';

  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');

  const fetchData = () => {
    setLoading(true);
    const jobsPromise = fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/jobs`)
      .then((res) => res.json())
      .catch((err) => console.error('Error fetching jobs:', err));

    const logsPromise = fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/schedules/logs/all`)
      .then((res) => res.json())
      .catch((err) => console.error('Error fetching global logs:', err));

    const schedulesPromise = fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/schedules`)
      .then((res) => res.json())
      .catch((err) => console.error('Error fetching schedules:', err));

    Promise.all([jobsPromise, logsPromise, schedulesPromise]).then(([jobsData, logsData, schedulesData]) => {
      if (jobsData) setJobs(jobsData);
      if (logsData) setLogs(logsData);
      if (schedulesData) setSchedules(schedulesData);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dynamically extract unique years from loaded jobs
  const availableYears = React.useMemo(() => {
    const years = new Set();
    jobs.forEach((j) => {
      if (j.createdAt) {
        years.add(new Date(j.createdAt).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [jobs]);

  // Filter data based on year and month selections
  const filteredJobs = React.useMemo(() => {
    return jobs.filter((j) => {
      const date = new Date(j.createdAt);
      if (selectedYear !== 'ALL' && date.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== 'ALL' && date.getMonth() !== parseInt(selectedMonth)) return false;
      return true;
    });
  }, [jobs, selectedYear, selectedMonth]);

  const filteredSchedules = React.useMemo(() => {
    return schedules.filter((s) => {
      const date = new Date(s.originalEtd);
      if (selectedYear !== 'ALL' && date.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== 'ALL' && date.getMonth() !== parseInt(selectedMonth)) return false;
      return true;
    });
  }, [schedules, selectedYear, selectedMonth]);

  const filteredLogs = React.useMemo(() => {
    return logs.filter((l) => {
      const date = new Date(l.updatedAt);
      if (selectedYear !== 'ALL' && date.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== 'ALL' && date.getMonth() !== parseInt(selectedMonth)) return false;
      return true;
    });
  }, [logs, selectedYear, selectedMonth]);

  // 1. Calculate KPI Metrics based on filtered data
  const totalJobs = filteredJobs.length;
  const totalSets = filteredJobs.reduce((sum, j) => sum + (j.totalSets || 0), 0);
  
  const delayedCount = filteredSchedules.filter((s) => {
    if (!s.actualDpr) return false;
    const etd = new Date(s.originalEtd);
    const dpr = new Date(s.actualDpr);
    // Compare dates (ignoring time)
    const etdDate = new Date(etd.getFullYear(), etd.getMonth(), etd.getDate());
    const dprDate = new Date(dpr.getFullYear(), dpr.getMonth(), dpr.getDate());
    return dprDate > etdDate;
  }).length;

  // 2. Prepare Staff Workload Chart Data based on filtered data
  const staffWorkloadMap = {};
  filteredJobs.forEach((j) => {
    const staffName = j.user?.name || 'Unassigned';
    staffWorkloadMap[staffName] = (staffWorkloadMap[staffName] || 0) + (j.totalSets || 0);
  });
  const staffWorkloadData = Object.keys(staffWorkloadMap).map((name) => ({
    name,
    Sets: staffWorkloadMap[name],
  })).sort((a, b) => b.Sets - a.Sets);

  // 3. Prepare Status Pie Chart Data based on filtered data
  const statusCountMap = { PAYMENT: 0, SURRENDER_ING: 0, FINAL_BL: 0, COMPLETE: 0 };
  filteredJobs.forEach((j) => {
    if (statusCountMap[j.status] !== undefined) {
      statusCountMap[j.status] += 1;
    }
  });
  const statusChartData = Object.keys(statusCountMap)
    .map((key) => ({
      name: STATUS_LABELS[key],
      value: statusCountMap[key],
      color: STATUS_COLORS[key],
      key,
    }))
    .filter((d) => d.value > 0); // only show statuses that have jobs

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">
            Real-time workload metrics, status distributions, and schedule change history logs.
          </p>
        </div>

        {/* Filters and Sync Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground">
            <span className="text-muted-foreground font-medium">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-foreground border-none outline-none cursor-pointer font-semibold focus:ring-0"
            >
              <option value="ALL" className="bg-card text-foreground">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr} className="bg-card text-foreground">{yr}</option>
              ))}
            </select>
          </div>

          {/* Month Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground">
            <span className="text-muted-foreground font-medium">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-foreground border-none outline-none cursor-pointer font-semibold focus:ring-0"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value} className="bg-card text-foreground">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Metrics
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
          Loading Operations Dashboard...
        </div>
      ) : (
        <>
          {/* KPI Highlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Active Jobs */}
            <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Job Cards</p>
                <p className="text-3xl font-bold text-foreground font-mono">{totalJobs}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 border border-indigo-500/10">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>

            {/* Card 2: Total Sets */}
            <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Sets Processed</p>
                <p className="text-3xl font-bold text-foreground font-mono">{totalSets}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-500 dark:text-cyan-400 border border-cyan-500/10">
                <Users className="h-6 w-6" />
              </div>
            </div>

            {/* Card 3: Delayed Vessels */}
            <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delayed Vessels</p>
                <p className="text-3xl font-bold text-rose-500 dark:text-rose-400 font-mono">{delayedCount}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 dark:text-rose-400 border border-rose-500/10">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Recharts Graphics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Staff Workload */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-bold text-foreground tracking-wide mb-6 uppercase border-b border-border pb-2 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" /> Staff Workload (Sets)
              </h3>
              <div className="h-80 w-full">
                {staffWorkloadData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No active workload logs found for the selected period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={staffWorkloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="name" stroke={axisColor} fontSize={11} tickLine={false} />
                      <YAxis stroke={axisColor} fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px' }}
                        labelStyle={{ color: tooltipLabelColor, fontWeight: 'bold' }}
                        itemStyle={{ color: '#818cf8' }}
                      />
                      <Bar dataKey="Sets" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={50}>
                        {staffWorkloadData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#4f46e5'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Task Status Distribution */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-bold text-foreground tracking-wide mb-6 uppercase border-b border-border pb-2 flex items-center gap-2">
                <ClipboardList className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400" /> Task Status Distribution
              </h3>
              <div className="h-80 w-full flex flex-col sm:flex-row items-center justify-center gap-4">
                {statusChartData.length === 0 ? (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                    No active tasks in this period to display metrics.
                  </div>
                ) : (
                  <>
                    <div className="h-60 w-60 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {statusChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px' }}
                            itemStyle={{ color: tooltipLabelColor }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex-1 space-y-3 w-full">
                      {statusChartData.map((item) => (
                        <div key={item.key} className="flex items-center justify-between border-b border-border pb-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-foreground font-medium">{item.name}</span>
                          </div>
                          <span className="font-semibold text-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
                            {item.value} {item.value === 1 ? 'Job' : 'Jobs'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground tracking-wide uppercase flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-rose-500 dark:text-rose-400" /> Recent Schedule Audit Logs
              </h3>
            </div>
            
            <div className="overflow-x-auto max-h-96">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/20 font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3">Vessel & Voyage</th>
                    <th className="px-6 py-3">Log Reason</th>
                    <th className="px-6 py-3">Old DPR</th>
                    <th className="px-6 py-3">New DPR</th>
                    <th className="px-6 py-3">Modified By</th>
                    <th className="px-6 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-foreground">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-muted-foreground font-sans">
                        No schedule modifications have been logged for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const oldDpr = log.oldActualDpr 
                        ? new Date(log.oldActualDpr).toLocaleDateString('en-GB') 
                        : '—';
                      const newDpr = log.newActualDpr 
                        ? new Date(log.newActualDpr).toLocaleDateString('en-GB') 
                        : '—';
                      const updateTime = new Date(log.updatedAt).toLocaleString('en-GB');

                      return (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-3">
                            <div className="font-sans font-semibold text-foreground">
                              {log.schedule?.vessel?.vesselName || 'Vessel'}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Voyage: {log.schedule?.voyage || '—'}
                            </div>
                          </td>
                          <td className="px-6 py-3 max-w-xs truncate font-sans text-muted-foreground" title={log.reason}>
                            {log.reason}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground">{oldDpr}</td>
                          <td className="px-6 py-3 text-indigo-600 dark:text-indigo-400 font-semibold">{newDpr}</td>
                          <td className="px-6 py-3 font-sans">
                            <span className="inline-flex items-center gap-1 text-[11px] rounded bg-muted px-1.5 py-0.5 border border-border text-muted-foreground">
                              <User className="h-3 w-3 text-indigo-500 dark:text-indigo-400" /> {log.user?.name || 'Staff'}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-muted-foreground">{updateTime}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SupervisorDashboard;
