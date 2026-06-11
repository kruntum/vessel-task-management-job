import React, { useState, useEffect } from 'react';
import { useReactTable, getCoreRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { Search, Filter, Plus, Calendar, AlertTriangle, Clock, RefreshCw, Layers, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

function MasterScheduleList({ currentUser }) {
  const [schedules, setSchedules] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering states
  const [globalFilter, setGlobalFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [weekFilter, setWeekFilter] = useState('');

  // Pagination states
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);

  // Modal states for creating Job Card
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [checklistItems, setChecklistItems] = useState([
    { agentId: '', customerName: '', bookingNo: '', setsCount: 1 }
  ]);
  const [creatingJob, setCreatingJob] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSchedules = () => {
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/schedules`)
      .then((res) => res.json())
      .then((data) => {
        setSchedules(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSchedules();
    
    // Fetch agents for dropdown
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/master/agents`)
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch((err) => console.error(err));
  }, []);

  const getDelayStatus = (originalEtd, actualDpr) => {
    if (!actualDpr) return { label: 'PENDING', color: 'bg-muted text-muted-foreground border border-border' };
    
    const etd = new Date(originalEtd);
    const dpr = new Date(actualDpr);
    
    // Compare dates (ignoring time)
    const etdDate = new Date(etd.getFullYear(), etd.getMonth(), etd.getDate());
    const dprDate = new Date(dpr.getFullYear(), dpr.getMonth(), dpr.getDate());

    const diffTime = dprDate - etdDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return { label: 'DELAY', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20', days: diffDays };
    } else if (diffDays < 0) {
      return { label: 'EARLY', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', days: Math.abs(diffDays) };
    }
    return { label: 'ON TIME', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20', days: 0 };
  };

  // TanStack Table columns config memoized to prevent infinite recalculation loops
  const columns = React.useMemo(
    () => [
      {
        header: 'Vessel / Voyage',
        accessorFn: (row) => `${row.vessel?.vesselName || ''} / ${row.voyage}`,
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-foreground">{row.original.vessel?.vesselName}</div>
            <div className="text-xs text-muted-foreground">Voyage: {row.original.voyage} | Service: {row.original.service}</div>
          </div>
        ),
      },
      {
        header: 'Agent',
        accessorKey: 'agent.agentName',
        cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue()}</span>,
      },
      {
        header: 'Week No',
        accessorKey: 'weekNo',
        cell: ({ getValue }) => <span className="text-foreground text-center block font-mono">{getValue()}</span>,
      },
      {
        header: 'Dates',
        cell: ({ row }) => {
          const etd = new Date(row.original.originalEtd).toLocaleDateString('en-GB');
          const dpr = row.original.actualDpr 
            ? new Date(row.original.actualDpr).toLocaleDateString('en-GB') 
            : '—';
          return (
            <div className="space-y-0.5 text-xs font-mono">
              <div><span className="text-muted-foreground/60 mr-2">ETD:</span><span className="text-foreground">{etd}</span></div>
              <div><span className="text-muted-foreground/60 mr-2">DPR:</span><span className="text-foreground">{dpr}</span></div>
            </div>
          );
        },
      },
      {
        header: 'Status',
        cell: ({ row }) => {
          const status = getDelayStatus(row.original.originalEtd, row.original.actualDpr);
          return (
            <div className="flex flex-col items-start gap-1">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${status.color}`}>
                {status.label}
              </span>
              {status.days > 0 && (
                <span className="text-[10px] text-rose-400 font-mono">+{status.days} Day(s)</span>
              )}
              {status.days < 0 && (
                <span className="text-[10px] text-emerald-400 font-mono">-{status.days} Day(s)</span>
              )}
            </div>
          );
        },
      },
      {
        header: 'Closing Time',
        cell: ({ row }) => {
          const closeDate = new Date(row.original.closingDate).toLocaleDateString('en-GB');
          return (
            <div className="text-xs font-mono">
              <div className="text-foreground">{closeDate}</div>
              <div className="text-muted-foreground">{row.original.closingTime}</div>
            </div>
          );
        },
      },
      {
        header: 'Actions',
        cell: ({ row }) => {
          const schedId = row.original.id;
          const hasJob = row.original.jobCards && row.original.jobCards.length > 0;

          if (hasJob) {
            return (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Assigned
              </span>
            );
          }

          if (currentUser && ['ADMIN', 'SUPERVISOR'].includes(currentUser.role)) {
            return (
              <button
                onClick={() => {
                  setSelectedSchedule(row.original);
                  setChecklistItems([{ agentId: row.original.agentId.toString(), customerName: '', bookingNo: '', setsCount: 1 }]);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Job Card
              </button>
            );
          }

          return <span className="text-xs text-muted-foreground">—</span>;
        },
      },
    ],
    [currentUser]
  );

  // Custom filter logic memoized to prevent table updates loops
  const filteredData = React.useMemo(() => {
    return schedules.filter((row) => {
      const searchStr = `${row.vessel?.vesselName || ''} ${row.voyage} ${row.service}`.toLowerCase();
      if (globalFilter && !searchStr.includes(globalFilter.toLowerCase())) return false;
      if (agentFilter !== 'ALL' && row.agentId !== parseInt(agentFilter)) return false;
      if (weekFilter && row.weekNo !== parseInt(weekFilter)) return false;
      return true;
    });
  }, [schedules, globalFilter, agentFilter, weekFilter]);

  // Reset page index when filters change
  useEffect(() => {
    setPageIndex(0);
  }, [globalFilter, agentFilter, weekFilter]);

  const paginatedData = React.useMemo(() => {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, pageIndex, pageSize]);

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pageStart = filteredData.length === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = Math.min(filteredData.length, (pageIndex + 1) * pageSize);

  // Checklist handler inside Job Creation Form Modal
  const handleAddChecklistItem = () => {
    setChecklistItems([...checklistItems, { agentId: selectedSchedule?.agentId.toString() || '', customerName: '', bookingNo: '', setsCount: 1 }]);
  };

  const handleRemoveChecklistItem = (index) => {
    const list = [...checklistItems];
    list.splice(index, 1);
    setChecklistItems(list);
  };

  const handleChecklistChange = (index, field, value) => {
    const list = [...checklistItems];
    list[index][field] = value;
    setChecklistItems(list);
  };

  const handleCreateJobCardSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setCreatingJob(true);

    // Validate entries
    const invalidItem = checklistItems.find(item => !item.agentId || !item.customerName || !item.bookingNo || !item.setsCount);
    if (invalidItem) {
      setErrorMsg('Please fill in all checklist fields.');
      setCreatingJob(false);
      return;
    }

    const payload = {
      scheduleId: selectedSchedule.id,
      details: checklistItems.map(item => ({
        agentId: parseInt(item.agentId),
        customerName: item.customerName,
        bookingNo: item.bookingNo,
        setsCount: parseInt(item.setsCount)
      }))
    };

    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create Job Card');
        return data;
      })
      .then((data) => {
        setCreatingJob(false);
        setIsModalOpen(false);
        toast.success(`Job Card successfully assigned to ${data.user?.name || 'Staff'}!`);
        fetchSchedules(); // Reload data table
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg(err.message);
        toast.error(`Error: ${err.message}`);
        setCreatingJob(false);
      });
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col overflow-hidden h-full">
      {/* Search & Filters Panel */}
      <div className="rounded-xl border border-border bg-card/30 p-4 backdrop-blur-md shadow-sm shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Vessel, Voyage, Service..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            {/* Agent Filter */}
            <div className="relative w-full sm:w-48">
              <Filter className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground pointer-events-none" />
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground outline-none focus:border-primary/50 cursor-pointer appearance-none transition-colors"
              >
                <option value="ALL" className="bg-card text-foreground">All Agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id} className="bg-card text-foreground">{a.agentName}</option>
                ))}
              </select>
            </div>

            {/* Week No Filter */}
            <div className="relative w-full sm:w-36">
              <input
                type="number"
                placeholder="Week No."
                value={weekFilter}
                onChange={(e) => setWeekFilter(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-primary/50 font-mono transition-colors"
              />
            </div>
          </div>
          
          <button 
            onClick={fetchSchedules}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-md flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border shadow-[0_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)]">
                {columns.map((col, index) => (
                  <th key={index} className="px-6 py-4 bg-muted/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground align-middle">{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-8 w-8 animate-spin text-indigo-500 mb-2" />
                    Loading Schedules...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-muted-foreground">
                    No vessel schedules matched your filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 align-middle text-sm text-foreground">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="border-t border-border px-6 py-3.5 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 text-xs text-muted-foreground font-medium select-none">
          {/* Row count stats */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>Showing</span>
            <span className="font-semibold text-foreground">{pageStart}</span>
            <span>to</span>
            <span className="font-semibold text-foreground">{pageEnd}</span>
            <span>of</span>
            <span className="font-semibold text-foreground">{filteredData.length}</span>
            <span>rows</span>
          </div>

          <div className="flex items-center gap-6">
            {/* Rows per page selector */}
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  onClick={() => setPageSizeOpen(!pageSizeOpen)}
                  className="flex items-center gap-1 bg-background border border-input rounded-md px-2 py-1 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer transition-colors shadow-sm"
                >
                  <span>{pageSize}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {pageSizeOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setPageSizeOpen(false)} />
                    <div className="absolute bottom-full mb-1 left-0 z-30 w-20 rounded-md border border-border bg-popover p-1 shadow-md">
                      {[100, 200, 300, 400].map((size) => (
                        <button
                          key={size}
                          onClick={() => {
                            setPageSize(size);
                            setPageIndex(0);
                            setPageSizeOpen(false);
                          }}
                          className={`flex w-full items-center rounded px-2.5 py-1 text-xs font-medium hover:bg-accent hover:text-accent-foreground text-left cursor-pointer ${
                            pageSize === size ? 'bg-accent text-accent-foreground font-semibold' : ''
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Current page indicator */}
            <div className="flex items-center gap-1 font-mono">
              <span>Page</span>
              <span className="font-semibold text-foreground">{pageIndex + 1}</span>
              <span>of</span>
              <span className="font-semibold text-foreground">{totalPages}</span>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex(pageIndex - 1)}
                className="p-1.5 rounded border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:hover:bg-background transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPageIndex(pageIndex + 1)}
                className="p-1.5 rounded border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:hover:bg-background transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Supervisor: Create Job Card Modal */}
      {isModalOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-500" /> Create Job Card Checklist
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xl"
              >
                &times;
              </button>
            </div>

            <div className="mb-4 bg-muted/50 rounded-lg p-3 border border-border text-sm">
              <p className="text-muted-foreground font-medium">Vessel Info:</p>
              <div className="flex gap-4 mt-1">
                <div><span className="text-muted-foreground">Vessel:</span> <span className="font-semibold text-foreground">{selectedSchedule.vessel?.vesselName}</span></div>
                <div><span className="text-muted-foreground">Voyage:</span> <span className="font-semibold text-foreground">{selectedSchedule.voyage}</span></div>
                <div><span className="text-muted-foreground">ETD:</span> <span className="font-mono text-indigo-500 dark:text-indigo-400">{new Date(selectedSchedule.originalEtd).toLocaleDateString('en-GB')}</span></div>
              </div>
            </div>

            <form onSubmit={handleCreateJobCardSubmit} className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {checklistItems.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-3 items-end bg-muted/20 border border-border p-3 rounded-lg">
                    {/* Agent Select */}
                    <div className="flex-1 w-full">
                      <label className="block text-xs text-muted-foreground mb-1">Agent</label>
                      <select
                        value={item.agentId}
                        onChange={(e) => handleChecklistChange(index, 'agentId', e.target.value)}
                        className="w-full rounded-md border border-input bg-background py-1.5 px-2.5 text-xs text-foreground outline-none focus:border-primary/50"
                      >
                        <option value="" className="bg-card text-foreground">Select Agent</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id} className="bg-card text-foreground">{a.agentName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Customer Name */}
                    <div className="flex-1 w-full">
                      <label className="block text-xs text-muted-foreground mb-1">Customer Name</label>
                      <input
                        type="text"
                        placeholder="Customer Ltd."
                        value={item.customerName}
                        onChange={(e) => handleChecklistChange(index, 'customerName', e.target.value)}
                        className="w-full rounded-md border border-input bg-background py-1.5 px-2.5 text-xs text-foreground outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* Booking No */}
                    <div className="flex-1 w-full font-mono">
                      <label className="block text-xs text-muted-foreground mb-1">Booking No.</label>
                      <input
                        type="text"
                        placeholder="BKK102049"
                        value={item.bookingNo}
                        onChange={(e) => handleChecklistChange(index, 'bookingNo', e.target.value)}
                        className="w-full rounded-md border border-input bg-background py-1.5 px-2.5 text-xs text-foreground outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* Sets Count */}
                    <div className="w-full sm:w-20">
                      <label className="block text-xs text-muted-foreground mb-1">Sets Count</label>
                      <input
                        type="number"
                        min="1"
                        value={item.setsCount}
                        onChange={(e) => handleChecklistChange(index, 'setsCount', e.target.value)}
                        className="w-full rounded-md border border-input bg-background py-1.5 px-2.5 text-xs text-foreground outline-none focus:border-primary/50 font-mono"
                      />
                    </div>

                    {/* Delete Item Button */}
                    {checklistItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(index)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 p-2 rounded-md transition-colors text-xs font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add checklist button */}
              <button
                type="button"
                onClick={handleAddChecklistItem}
                className="w-full py-2 border border-dashed border-input hover:border-primary/50 text-xs text-indigo-500 dark:text-indigo-400 font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Sub-Task
              </button>

              {errorMsg && (
                <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                  {errorMsg}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-border pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingJob}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  {creatingJob ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  {creatingJob ? 'Assigning...' : 'Assign Work (Auto-Balance)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterScheduleList;
