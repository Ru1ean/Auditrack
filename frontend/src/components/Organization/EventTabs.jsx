import React, { useEffect, useState, useCallback } from 'react';
import { eventsAPI, usersAPI } from '../../utils/api';
import { API_BASE_URL } from '../../utils/apiBase';
import { getDeadlineInfo } from '../../utils/deadlineHelpers';
import { useLiveRefresh } from '../../utils/liveSync';

export default function EventTabs({ selectedEventId, onChange }) {
  const [events, setEvents] = useState([]);

  const loadEvents = useCallback(async () => {
    try {
      const userRes = await usersAPI.getLoggedInUser().catch(() => null);
      const currentUser = userRes?.user || userRes?.data || userRes;
      const isAuditor = Number(currentUser?.roleid) === 4 || 
                        String(currentUser?.rolename || '').toLowerCase().includes('auditor') || 
                        Boolean(currentUser?.isExternalAuditor);

      let assignedEventIds = null;
      if (isAuditor && currentUser?.userid) {
        const token = localStorage.getItem('token');
        const assignRes = await fetch(`${API_BASE_URL}/api/areas/assignments/${currentUser.userid}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }).then(r => r.json()).catch(() => null);
        if (assignRes?.success && Array.isArray(assignRes.assignments)) {
          assignedEventIds = new Set(assignRes.assignments.map(a => Number(a.eventid)));
        }
      }

      const res = await eventsAPI.getAllEvents();
      const list = Array.isArray(res) ? res : (res?.data || res?.events || []);
      
      // Filter active events (exclude only explicitly inactive events)
      let active = list.filter(e => {
        const status = String(e.Status || e.status || '').toLowerCase().trim();
        return status !== 'inactive';
      });

      // Auditor Scoping: if user is auditor, only show events they are assigned to!
      if (isAuditor && assignedEventIds) {
        active = active.filter(e => assignedEventIds.has(Number(e.eventid || e.id)));
      }

      const toShow = Array.isArray(active) ? active : [];
      setEvents(toShow);

      // If current selectedEventId is not in toShow list (or empty), pick persisted or first available
      const currentValid = toShow.some(e => String(e.eventid || e.id) === String(selectedEventId));
      if (!currentValid && toShow.length > 0 && typeof onChange === 'function') {
        const savedEventId = localStorage.getItem('acc_selected_event_id') || localStorage.getItem('selected_audit_event_id');
        const validSaved = toShow.find(e => String(e.eventid || e.id) === String(savedEventId));
        const target = validSaved || toShow[0];
        const targetId = target.eventid || target.id || '';
        localStorage.setItem('acc_selected_event_id', String(targetId));
        localStorage.setItem('selected_audit_event_id', String(targetId));
        onChange(targetId);
      }
    } catch (err) {
      console.error('Failed to load events for tabs', err);
      setEvents([]);
    }
  }, [selectedEventId, onChange]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useLiveRefresh(loadEvents);

  const handleSelect = (ev) => {
    const id = ev.eventid || ev.id || ev.eventcode || ev.eventname || ev.name || '';
    if (id) {
      localStorage.setItem('acc_selected_event_id', String(id));
      localStorage.setItem('selected_audit_event_id', String(id));
    }
    if (typeof onChange === 'function') onChange(id);
  };

  if (events.length === 0) {
    return (
      <div className="w-full border-b-2 border-slate-300 px-1">
        <div className="text-xs text-slate-500 py-1 italic">No assigned accreditation events</div>
      </div>
    );
  }

  const activeEvent = events.find(ev => {
    const id = ev.eventid || ev.id || ev.eventcode || '';
    return String(id) === String(selectedEventId);
  }) || events[0];
  const dlInfo = getDeadlineInfo(activeEvent?.deadline, activeEvent);

  return (
    <div className="w-full border-b-2 border-slate-300 px-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-end justify-start gap-4 flex-nowrap overflow-x-auto">
          {events.map(ev => {
            const id = ev.eventid || ev.id || ev.eventcode || '';
            const isactive = String(id) === String(selectedEventId);
            const fullName = ev.eventcode || ev.eventname || ev.name || '';
            return (
              <button
                key={id || JSON.stringify(ev)}
                onClick={() => handleSelect(ev)}
                className={`relative -mb-[2px] h-8 whitespace-nowrap border-b-4 px-0.5 text-xs transition-colors cursor-pointer ${isactive ? 'border-blue-600 font-medium text-slate-900' : 'border-transparent font-normal text-slate-600 hover:text-slate-800'}`}
              >
                <span>{fullName}</span>
              </button>
            );
          })}
        </div>

        {/* Far-right Deadline Capsule matching Header Clock Pill */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 mb-1 rounded-lg border text-xs font-medium select-none shadow-2xs shrink-0 transition-colors ${
            !dlInfo.hasDeadline
              ? 'bg-slate-50/80 border-slate-200/70 text-slate-500'
              : dlInfo.status === 'completed'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : dlInfo.status === 'overdue' || dlInfo.status === 'due-today'
                  ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                  : dlInfo.status === 'urgent' || dlInfo.status === 'upcoming'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-800'
                    : 'bg-slate-50/80 border-slate-200/70 text-slate-600'
          }`}
          title={dlInfo.hasDeadline ? `Target submission deadline: ${dlInfo.label}` : 'No target submission deadline set for this accreditation'}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              dlInfo.hasDeadline
                ? dlInfo.status === 'completed'
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]'
                  : dlInfo.status === 'overdue' || dlInfo.status === 'due-today'
                    ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.45)]'
                    : `${dlInfo.dotClasses} shadow-[0_0_6px_rgba(245,158,11,0.35)]`
                : 'bg-slate-400'
            }`}
          />
          <span className={`font-semibold ${
            dlInfo.status === 'completed'
              ? 'text-emerald-900'
              : dlInfo.status === 'overdue' || dlInfo.status === 'due-today'
                ? 'text-rose-900'
                : 'text-slate-700'
          }`}>
            {dlInfo.hasDeadline ? `Due ${dlInfo.formattedDate}` : (dlInfo.status === 'completed' ? 'Completed' : 'No Deadline')}
          </span>
          {dlInfo.hasDeadline ? (
            <>
              <span className="text-slate-300 font-light">·</span>
              <span className={`font-medium ${
                dlInfo.status === 'completed'
                  ? 'text-emerald-700 font-bold'
                  : dlInfo.status === 'overdue' || dlInfo.status === 'due-today'
                    ? 'text-rose-700 font-bold'
                    : dlInfo.status === 'urgent' || dlInfo.status === 'upcoming'
                      ? 'text-amber-700 font-semibold'
                      : 'text-slate-500'
              }`}>
                {dlInfo.shortLabel}
              </span>
            </>
          ) : dlInfo.status === 'completed' ? (
            <>
              <span className="text-slate-300 font-light">·</span>
              <span className="text-emerald-700 font-bold">100% Complied</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
