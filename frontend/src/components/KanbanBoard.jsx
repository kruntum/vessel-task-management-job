import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Clock, CheckSquare, RefreshCw, Eye, ShieldAlert, Layers, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

const COLUMNS = [
  { id: 'PAYMENT', title: 'Payment Validation' },
  { id: 'SURRENDER_ING', title: 'B/L Surrendering' },
  { id: 'FINAL_BL', title: 'Final B/L Processing' },
  { id: 'COMPLETE', title: 'Completed' },
];

function KanbanBoard({ currentUser }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [updatingChecklist, setUpdatingChecklist] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const fetchJobs = () => {
    if (!currentUser) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/jobs?userId=${currentUser.id}`)
      .then((res) => res.json())
      .then((data) => {
        setJobs(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load jobs:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchJobs();
  }, [currentUser]);

  // Check if closing time is within 24 hours
  const isClosingSoon = (closingDateStr, closingTimeStr) => {
    if (!closingDateStr) return false;
    const closing = new Date(closingDateStr);
    if (closingTimeStr) {
      const [hours, minutes] = closingTimeStr.split(':');
      closing.setHours(parseInt(hours || 0), parseInt(minutes || 0), 0, 0);
    }
    const now = new Date();
    const diffTime = closing - now;
    // Highlight if closing date-time is within 24 hours in the future
    return diffTime > 0 && diffTime <= 24 * 60 * 60 * 1000;
  };

  // Drag End handler
  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a valid column
    if (!destination) return;

    // Dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const jobId = parseInt(draggableId);
    const destinationStatus = destination.droppableId;

    // Optimistic UI update
    const updatedJobs = jobs.map((j) => {
      if (j.id === jobId) {
        return {
          ...j,
          status: destinationStatus,
          completedAt: destinationStatus === 'COMPLETE' ? new Date().toISOString() : null,
        };
      }
      return j;
    });
    setJobs(updatedJobs);

    // Call backend API to persist state
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/jobs/${jobId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: destinationStatus }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update status');
        return res.json();
      })
      .then((data) => {
        // Sync with actual database response
        setJobs((curr) => curr.map((j) => (j.id === jobId ? data : j)));
        // If the opened detail modal is for this job, update it
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob(data);
        }
        const colTitle = COLUMNS.find(c => c.id === destinationStatus)?.title || destinationStatus;
        toast.success(`Moved task to "${colTitle}"`);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to update status. Reverting changes.');
        fetchJobs(); // Revert back on error
      });
  };

  // Toggle checklist detail check state
  const handleToggleCheck = (detailId, isChecked) => {
    setUpdatingChecklist(true);
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5550'}/api/jobs/details/${detailId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isChecked }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update checklist item');
        return res.json();
      })
      .then((data) => {
        // Update local state
        setJobs((curr) =>
          curr.map((job) => {
            if (job.id === selectedJob.id) {
              const updatedDetails = job.details.map((d) => (d.id === detailId ? data : d));
              return { ...job, details: updatedDetails };
            }
            return job;
          })
        );
        
        setSelectedJob((curr) => {
          if (!curr) return null;
          const updatedDetails = curr.details.map((d) => (d.id === detailId ? data : d));
          return { ...curr, details: updatedDetails };
        });
        setUpdatingChecklist(false);
        toast.success(isChecked ? 'Sub-task completed!' : 'Sub-task set to pending.');
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to update sub-task status.');
        setUpdatingChecklist(false);
      });
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success(`Copied Booking No: ${text}`);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
        toast.error('Failed to copy to clipboard.');
      });
  };

  // Open detail checklist dialog
  const openDetailDialog = (job) => {
    setSelectedJob(job);
    setIsDetailOpen(true);
  };

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
        Initializing Board...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Please select a staff member to view tasks.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Sync info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">
            Manage your vessel tasks and checklist items. Drag cards to update statuses.
          </p>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Sync Board
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
          Loading Tasks Kanban...
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            {COLUMNS.map((column) => {
              const columnJobs = jobs.filter((j) => j.status === column.id);

              return (
                <div key={column.id} className="rounded-xl border border-border bg-muted/40 p-4">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                    <h3 className="text-sm font-semibold text-foreground tracking-wide">
                      {column.title}
                    </h3>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono font-medium text-secondary-foreground">
                      {columnJobs.length}
                    </span>
                  </div>


                  {/* Droppable Area */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-3 min-h-[450px] rounded-lg transition-colors p-1 ${
                          snapshot.isDraggingOver ? 'bg-slate-900/30' : ''
                        }`}
                      >
                        {columnJobs.map((job, index) => {
                          const sched = job.schedule;
                          const closingDate = sched?.closingDate;
                          const closingTime = sched?.closingTime;
                          const alertClosing = isClosingSoon(closingDate, closingTime);
                          const totalSets = job.totalSets;
                          
                          // Checklist progress calculations
                          const checkedCount = job.details?.filter((d) => d.isChecked).length || 0;
                          const totalCount = job.details?.length || 0;
                          const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

                          return (
                            <Draggable key={job.id} draggableId={job.id.toString()} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={provided.draggableProps.style}
                                  className={`rounded-lg border border-border bg-card p-4 hover:border-border/80 shadow-sm transition-colors duration-200 select-none ${
                                    snapshot.isDragging ? 'shadow-2xl shadow-indigo-500/20 border-indigo-500/50 scale-[1.02]' : ''
                                  }`}
                                >
                                  {/* Vessel Name & Voyage */}
                                  <div className="font-semibold text-foreground truncate text-sm">
                                    {sched?.vessel?.vesselName || 'TEST VESSEL'}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                    Voyage: {sched?.voyage || 'V00'} | Service: {sched?.service || 'S1'}
                                  </div>

                                  {/* ETD date warning */}
                                  <div className="flex items-center gap-1.5 mt-3">
                                    <Clock className={`h-3.5 w-3.5 ${alertClosing ? 'text-rose-500 animate-pulse' : 'text-muted-foreground/60'}`} />
                                    <span
                                      className={`text-xs font-mono font-medium ${
                                        alertClosing ? 'text-rose-500 font-semibold' : 'text-muted-foreground'
                                      }`}
                                    >
                                      ETD: {sched ? new Date(sched.originalEtd).toLocaleDateString('en-GB') : '—'}
                                    </span>
                                    {alertClosing && (
                                      <span className="inline-flex rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-bold text-rose-500 uppercase tracking-wider">
                                        Closing Soon
                                      </span>
                                    )}
                                  </div>

                                  {/* Progress bar and click handler */}
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDetailDialog(job);
                                    }}
                                    className="mt-4 space-y-1 cursor-pointer hover:bg-muted/60 p-1.5 rounded transition-all group"
                                  >
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-indigo-500 dark:text-indigo-400 font-semibold flex items-center gap-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-305">
                                        <CheckSquare className="h-3 w-3" /> Sub-Tasks (Open)
                                      </span>
                                      <span className="text-muted-foreground font-mono font-semibold">
                                        {checkedCount}/{totalCount} ({progressPercent}%)
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                                        }`}
                                        style={{ width: `${progressPercent}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Divider & footer */}
                                  <div className="mt-3 border-t border-border pt-2 flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Total Sets:</span>
                                    <span className="font-semibold text-foreground font-mono">{totalSets} Sets</span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Task Checklist Overlay Dialog */}
      {isDetailOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl text-foreground">
            {/* Dialog Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-500" /> Job Card Sub-Tasks
                </h3>
                <p className="text-muted-foreground text-xs mt-1">
                  Vessel: {selectedJob.schedule?.vessel?.vesselName} | Voyage: {selectedJob.schedule?.voyage}
                </p>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Checklist items */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 my-4">
              {selectedJob.details && selectedJob.details.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">
                  No sub-task checklists found for this job.
                </p>
              ) : (
                selectedJob.details?.map((detail) => (
                  <div
                    key={detail.id}
                    className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                      detail.isChecked 
                        ? 'border-emerald-500/20 bg-emerald-500/5' 
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        disabled={updatingChecklist}
                        checked={detail.isChecked}
                        onChange={(e) => handleToggleCheck(detail.id, e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-input bg-background text-indigo-600 focus:ring-indigo-500 outline-none cursor-pointer disabled:opacity-50"
                      />
                      <div>
                        <p className={`text-sm font-semibold ${detail.isChecked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {detail.customerName}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono flex items-center gap-1.5 flex-wrap">
                          <span>Booking:</span>
                          <span 
                            onClick={() => handleCopyText(detail.bookingNo)}
                            className="bg-muted hover:bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded cursor-pointer inline-flex items-center gap-1 border border-border transition-colors group select-all"
                            title="Click to copy booking number"
                          >
                            {detail.bookingNo}
                            <Copy className="h-3 w-3 text-muted-foreground/60 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
                          </span>
                          <span>| Agent: {detail.agent?.agentName || 'TEST'}</span>
                        </p>
                      </div>
                    </div>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground font-mono">
                      {detail.setsCount} Set(s)
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Dialog Footer */}
            <div className="flex justify-end border-t border-border pt-4 mt-6">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;
