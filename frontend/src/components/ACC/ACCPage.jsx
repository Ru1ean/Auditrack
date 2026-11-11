import React, { useState, useEffect, useCallback } from 'react';
import { officesAPI, eventsAPI, areasAPI, requirementsAPI, usersAPI } from '../../utils/api';
import AccreditationOfficesView from './AccreditationOfficesView';
import AccreditationMasterList from './AccreditationMasterList';
import AssignToOfficesModal from './AssignToOfficesModal';
import ViewReqPasscuModal from '../ViewReqPasscuModal/ViewReqPasscuModal';
import AddEventModal from '../Events/AddEventModal';
import AddOfficeModal from '../Organization/AddOfficeModal';
import Organization from '../../pages/Organization.jsx';
import ALL from '../../pages/ALLC.jsx';
import { useModal } from '../UI/ModalProvider';
import { Layers, LayoutGrid, SlidersHorizontal, Loader2, Plus, Calendar } from 'lucide-react';
import { useLiveRefresh } from '../../utils/liveSync';

import axios from 'axios';
import { API_BASE_URL } from '../../utils/apiBase';

export default function ACCPage() {
  const { showAlert } = useModal();

  const [activeTab, setActiveTab] = useState('categories'); // 'categories' (Photo 3) or 'master-list' (Photo 1)
  const [offices, setOffices] = useState([]);
  const [events, setEvents] = useState([]);
  const [areasData, setAreasData] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddOfficeOpen, setIsAddOfficeOpen] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  const rolename = String(currentUser?.rolename || '').toLowerCase();
  const roleid = Number(currentUser?.roleid);
  const isAuditor = roleid === 4 || rolename.includes('auditor') || Boolean(currentUser?.isExternalAuditor);
  const isOfficer = roleid === 2 || roleid === 3 || rolename.includes('office') || rolename === 'user' || rolename === 'personnel' || rolename === 'head';
  const isAdmin = (roleid === 1 || rolename === 'admin') && !isAuditor && !isOfficer;

  // Helper to load full hierarchy for selected event
  const loadEventStructure = useCallback(async (eventid) => {
    if (!eventid || eventid === 'all') return;
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch areas for event
      let areas = [];
      try {
        const res = await axios.get(`${API_BASE_URL}/api/areas/event/${eventid}`, { headers });
        areas = res.data?.data || res.data || [];
      } catch {
        areas = await areasAPI.getAll().catch(() => []);
      }

      // 2. Fetch criteria for event
      let allCriteria = [];
      try {
        const res = await axios.get(`${API_BASE_URL}/api/criteria/event/${eventid}`, { headers });
        allCriteria = res.data?.data || res.data || [];
      } catch {
        allCriteria = [];
      }

      // 3. Batch-fetch all requirements for the event in one fast request
      let allEventReqs = [];
      try {
        const reqRes = await axios.get(`${API_BASE_URL}/api/requirements/all?eventid=${eventid}`, { headers });
        allEventReqs = reqRes.data?.data || reqRes.data || [];
      } catch (rErr) {
        console.warn('Batch requirements fetch notice:', rErr.message);
      }

      const reqsByCriteria = {};
      allEventReqs.forEach((r) => {
        const cId = String(r.criteriaid || r.criteriaid);
        if (!reqsByCriteria[cId]) reqsByCriteria[cId] = [];
        reqsByCriteria[cId].push(r);
      });

      const criteriaWithReqs = await Promise.all(
        allCriteria.map(async (crit) => {
          const critId = String(crit.criteriaid || crit.id);
          let reqs = reqsByCriteria[critId] || [];
          if (reqs.length === 0 && allEventReqs.length === 0) {
            try {
              const res = await axios.get(`${API_BASE_URL}/api/requirements/criteria/${critId}`, { headers });
              reqs = res.data?.data || res.data || [];
            } catch {
              reqs = [];
            }
          }
          return {
            ...crit,
            requirements: reqs
          };
        })
      );

      // Group criteria by areaid
      const criteriaByArea = {};
      criteriaWithReqs.forEach((crit) => {
        const areaid = String(crit.areaid || crit.areaid || 'no_area');
        if (!criteriaByArea[areaid]) criteriaByArea[areaid] = [];
        criteriaByArea[areaid].push(crit);
      });

      // Attach criteria to areas
      const structuredAreas = areas.map((area) => {
        const aId = String(area.areaid || area.id);
        return {
          ...area,
          criteria: criteriaByArea[aId] || []
        };
      });

      setAreasData(structuredAreas);
    } catch (err) {
      console.error('Failed to load event structure:', err);
    }
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const [officesRes, eventsRes, userRes] = await Promise.all([
        officesAPI.getAll().catch(() => []),
        eventsAPI.getAllEvents().catch(() => []),
        usersAPI.getLoggedInUser().catch(() => null),
      ]);

      if (userRes && userRes.success && userRes.user) {
        setCurrentUser(userRes.user);
      }

      const officesList = Array.isArray(officesRes) ? officesRes : (officesRes?.data || []);
      const eventsList = Array.isArray(eventsRes) ? eventsRes : (eventsRes?.data || eventsRes?.events || []);

      setOffices(officesList);
      setEvents(eventsList);

      if (eventsList.length > 0) {
        setSelectedEventId((prev) => {
          if (prev && prev !== 'all' && eventsList.some(e => String(e.eventid || e.id) === String(prev))) {
            return prev;
          }
          const firstId = String(eventsList[0].eventid || eventsList[0].id);
          setSelectedEvent(eventsList[0]);
          return firstId;
        });
      }
    } catch (err) {
      console.error('Failed to load ACC page data:', err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time live data syncing
  useLiveRefresh(fetchData);

  // Handle Event selection
  const handleSelectEvent = async (eventid) => {
    setSelectedEventId(eventid);
    const match = events.find(e => String(e.eventid || e.id) === String(eventid));
    if (match) setSelectedEvent(match);
    await loadEventStructure(eventid);
  };

  // Handle office selection -> opens ViewReqPasscuModal
  const handleSelectOffice = (office) => {
    if (!office) return;
    const normalized = {
      ...office,
      id: office.id ?? office.officeid,
      officeid: office.officeid ?? office.id,
      officename: office.officename ?? office.officename,
      officename: office.officename ?? office.officename,
      eventid: office.eventid ?? office.eventid ?? selectedEventId,
      eventid: office.eventid ?? office.eventid ?? selectedEventId,
      eventcode: office.eventcode ?? office.eventcode ?? selectedEvent?.eventcode ?? selectedEvent?.eventname,
      eventcode: office.eventcode ?? office.eventcode ?? selectedEvent?.eventcode ?? selectedEvent?.eventname,
      eventname: office.eventname ?? office.eventname ?? selectedEvent?.eventname,
      eventname: office.eventname ?? office.eventname ?? selectedEvent?.eventname,
      department_name: office.department_name ?? office.DepartmentName,
      DepartmentName: office.DepartmentName ?? office.department_name,
    };
    setSelectedOffice(normalized);
    setIsInspectionOpen(true);
  };

  // Bulk assignment submit (Photo 2)
  const handleAssignToOffices = async (officeIds, requirementIds) => {
    try {
      setAssignSaving(true);
      for (const officeid of officeIds) {
        await officesAPI.addOfficeRequirements(officeid, requirementIds);
      }

      setIsAssignModalOpen(false);

      if (showAlert) {
        showAlert(
          `Successfully assigned ${requirementIds.length} requirement(s) to ${officeIds.length} office(s).`,
          'success'
        );
      }

      const currentEventId = selectedEventId;
      const [officesRes, eventsRes] = await Promise.all([
        officesAPI.getAll().catch(() => []),
        eventsAPI.getAllEvents().catch(() => []),
      ]);

      const officesList = Array.isArray(officesRes) ? officesRes : (officesRes?.data || []);
      const eventsList = Array.isArray(eventsRes) ? eventsRes : (eventsRes?.data || eventsRes?.events || []);

      setOffices(officesList);
      setEvents(eventsList);

      const targetId = currentEventId && currentEventId !== 'all' ? currentEventId : (eventsList[0]?.eventid || eventsList[0]?.id);
      if (targetId) {
        await loadEventStructure(targetId);
      }
    } catch (err) {
      console.error('Failed to assign requirements to offices:', err);
      if (showAlert) {
        showAlert(
          err.response?.data?.message || err.message || 'Error assigning requirements',
          'error'
        );
      }
    } finally {
      setAssignSaving(false);
    }
  };

  const handleEventAddedSuccess = async () => {
    setIsAddEventOpen(false);
    await fetchData();
    if (showAlert) {
      showAlert({
        title: 'Accreditation Created',
        message: 'New Accreditation / Event created successfully.',
        type: 'success'
      });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-slate-100 font-sans overflow-hidden flex">
      {/* Left Sub-Navigation Sidebar */}
      <aside className="fixed top-14 bottom-0 left-0 lg:left-[var(--sidebar-width)] w-60 bg-white border-r border-slate-200 shadow-xs z-20 flex flex-col justify-between p-4 transition-[left] duration-200">
        <div className="space-y-4">
          {/* Header Title */}
          <div className="px-2 pt-1 pb-1 border-b border-slate-100">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 mb-0.5">
              Programs & Offices
            </div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              Management
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5 pb-2">
              Workspace & categories
            </p>
          </div>

          {/* Navigation Items (Accreditation first, Category Management second) */}
          <nav className="space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('master-list')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer group ${
                activeTab === 'master-list'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div
                className={`p-2 rounded-lg transition-colors ${
                  activeTab === 'master-list'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-200'
                }`}
              >
                <Layers className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate font-bold">Accreditation</div>
                <div
                  className={`text-[10px] truncate ${
                    activeTab === 'master-list' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  Areas, Criteria & Reqs
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer group ${
                activeTab === 'categories'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div
                className={`p-2 rounded-lg transition-colors ${
                  activeTab === 'categories'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-200'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate font-bold">Programs & Offices</div>
                <div
                  className={`text-[10px] truncate ${
                    activeTab === 'categories' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  Offices & Programs
                </div>
              </div>
            </button>
          </nav>

          {/* Quick Actions (Admin Only) */}
          {isAdmin && (
            <div className="pt-2">
              <div className="px-2 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Actions
              </div>
              <button
                type="button"
                onClick={async () => {
                  setIsAssignModalOpen(true);
                  await fetchData();
                }}
                className="w-full text-left p-3 bg-gradient-to-br from-blue-50/90 to-indigo-50/90 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-xl transition-all shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-600 text-white rounded-lg shadow-2xs group-hover:scale-105 transition-transform">
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-blue-950 truncate">
                      Assign to Offices
                    </div>
                    <div className="text-[10px] text-blue-600/90 truncate font-medium">
                      Bulk requirement setup
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="pt-3 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-[11px] text-slate-500 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <div className="truncate min-w-0">
              <span className="font-semibold text-slate-700">Events:</span>{' '}
              {events.length} active
            </div>
          </div>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="flex-1 ml-60 overflow-hidden min-h-0 bg-slate-50/40">
        {initialLoading ? (
          <div className="h-full flex items-center justify-center text-slate-400 gap-2 text-xs font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Loading workspace...
          </div>
        ) : activeTab === 'categories' ? (
          /* Photo 3: Category Management View - Organization Component */
          <Organization
            selectedEventIdProp={selectedEventId}
            onEventSelect={handleSelectEvent}
          />
        ) : (
          /* Master Structure List View - ALL Component occupying all space */
          <div className="h-full w-full overflow-y-auto p-4">
            <ALL />
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {isAddEventOpen && (
        <AddEventModal
          isOpen={isAddEventOpen}
          onClose={() => setIsAddEventOpen(false)}
          onSuccess={handleEventAddedSuccess}
        />
      )}

      {/* Add Office Modal */}
      {isAddOfficeOpen && (
        <AddOfficeModal
          visible={isAddOfficeOpen}
          onClose={() => setIsAddOfficeOpen(false)}
          onSave={async () => {
            setIsAddOfficeOpen(false);
            await fetchData();
          }}
          events={events}
        />
      )}

      {/* Photo 2: Assign Requirements to Offices Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-6xl h-[90vh]">
            <AssignToOfficesModal
              offices={offices}
              areasData={areasData}
              events={events}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              onAssign={handleAssignToOffices}
              onClose={() => setIsAssignModalOpen(false)}
              saving={assignSaving}
            />
          </div>
        </div>
      )}

      {/* Office Requirement Audit Inspection Modal */}
      {isInspectionOpen && selectedOffice && (
        <ViewReqPasscuModal
          isOpen={isInspectionOpen}
          onClose={() => {
            setIsInspectionOpen(false);
            setSelectedOffice(null);
          }}
          office={selectedOffice}
        />
      )}
    </div>
  );
}
