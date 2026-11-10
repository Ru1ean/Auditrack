import axios from 'axios';
import { API_BASE_URL } from './apiBase';

export { API_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to include JWT token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // JWT token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for 401/403 Unauthorized & Expired Tokens and Live Sync
api.interceptors.response.use(
  (response) => {
    const method = response?.config?.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const url = response?.config?.url || '';
      // Exclude login/logout/verify tokens from triggering full data sync
      if (!url.includes('/login') && !url.includes('/logout') && !url.includes('/otp') && !url.includes('/verify')) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app:data-sync', { detail: { url, method, timestamp: Date.now() } }));
        }
      }
    }
    return response;
  },
  (error) => {
    const originalRequest = error.config;
    // Only redirect if not a login or register request
    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      originalRequest &&
      !originalRequest.url.includes('/login') &&
      !originalRequest.url.includes('/register')
    ) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);


// ========================
// Compliance Status Offices API
// ========================
export const complianceStatusOfficesAPI = {
  getAll: async () => (await api.get('/api/compliancestatusoffices')).data,
};
// ========================
// Criteria API
// ========================
export const criteriaAPI = {
  getAll: async () => (await api.get('/api/criteria')).data,
  getByEvent: async (eventid) => (await api.get(`/api/criteria/event/${eventid}`)).data,
  getByArea: async (areaid) => (await api.get(`/api/criteria/area/${areaid}`)).data,
  deleteCriteria: async (ids) => (await api.delete('/api/criteria/delete', { data: { criteriaIds: ids } })).data,
  addCriteria: async (data) => (await api.post('/api/criteria/add', data)).data,
  updateCriteria: async (id, data) => (await api.put(`/api/criteria/${id}`, data)).data,
};
// ========================
// Areas API
// ========================
export const areasAPI = {
  getAll: async () => (await api.get('/api/areas')).data,
  getByEvent: async (eventid) => (await api.get(`/api/areas/event/${eventid}`)).data,
  addArea: async (areaData) => (await api.post('/api/areas/add', areaData)).data,
  updateArea: async (id, data) => (await api.put(`/api/areas/${id}`, data)).data,
  deleteAreas: async (areaIds) => (await api.post('/api/areas/delete', { areaIds })).data,
};

export const masterlistAPI = {
  getAll: async () => (await api.get('/api/masterlist')).data,
  getAvailableForEvent: async (eventid) => (await api.get(`/api/masterlist/available/${eventid}`)).data,
  addItem: async (item) => (await api.post('/api/masterlist/add', item)).data,
  updateItem: async (id, item) => (await api.put(`/api/masterlist/${id}`, item)).data,
  deleteItem: async (id) => (await api.delete(`/api/masterlist/${id}`)).data,
  deleteMultiple: async (ids) => (await api.post('/api/masterlist/delete-multiple', { ids })).data,
  bulkDelete: async (ids) => (await api.post('/api/masterlist/delete-multiple', { ids })).data,
};


export const departmentsAPI = {
  getAll: async () => (await api.get('/api/departments')).data,
};

export const eventDepartmentsAPI = {
  getByEvent: async (eventid) => (await api.get(`/api/event-departments/event/${eventid}`)).data,
  assignDepartment: async (payload) => (await api.post('/api/event-departments', payload)).data,
  updateLevel: async (id, accreditationlevel) => (await api.put(`/api/event-departments/${id}/level`, { accreditationlevel })).data,
  deleteDepartment: async (id) => (await api.delete(`/api/event-departments/${id}`)).data,
};

// ========================
// Office Heads API
// ========================
export const officeHeadsAPI = {
  addHead: async (formData) => {
    const response = await api.post('/api/officeheads/add', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  addMultipleHeads: async (userIds, position) => {
    const response = await api.post('/api/officeheads/add-multiple', { userIds, position });
    return response.data;
  },
  getAllHeads: async () => {
    try {
      const response = await api.get('/api/officeheads/all');
      console.log('getAllHeads full response:', response);
      // Backend returns { success: true, data: [...] }
      // response.data is { success: true, data: [...] }
      // So we need response.data.data for the array
      if (response.data && response.data.data) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      } else {
        console.error('Unexpected response format:', response.data);
        return [];
      }
    } catch (error) {
      console.error('getAllHeads error:', error);
      throw error;
    }
  },
  getHeadById: async (id) => (await api.get(`/api/officeheads/${id}`)).data,
  updateHead: async (id, formData) => {
    const response = await api.put(`/api/officeheads/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  deleteHeads: async (headIds) => {
    try {
      return (await api.delete('/api/officeheads/delete', { data: { headIds } })).data;
    } catch (error) {
      // fallback with query string
      const queryString = headIds.map((id) => `ids=${id}`).join('&');
      return (await api.delete(`/api/officeheads/delete?${queryString}`)).data;
    }
  },
};

// ========================
// Users/Auth API
// ========================
let loggedInUserPromise = null;
let loggedInUserCache = { token: null, data: null, timestamp: 0 };

export const usersAPI = {
  login: async (credentials) => {
    loggedInUserCache = { token: null, data: null, timestamp: 0 };
    return (await api.post('/api/user/login', credentials)).data;
  },
  register: async (userData) => (await api.post('/user/register', userData)).data,
  loginStatus: async (email) => (await api.get(`/api/user/login-status?email=${encodeURIComponent(email)}`)).data,
  createRegistrationInvite: async (data = {}) => (await api.post('/api/user/registration-invite', data)).data,
  validateRegistrationInvite: async (token) => (
    await api.get(`/api/user/registration-invite/${encodeURIComponent(token)}`)
  ).data,
  sendChangePasswordOtp: async (data = {}) => (await api.post('/api/user/change-password/send-otp', data)).data,
  verifyAndChangePassword: async (data) => (await api.post('/api/user/change-password/verify-and-change', data)).data,
  getLoggedInUser: async () => {
    const token = localStorage.getItem('token');
    const now = Date.now();
    if (token && loggedInUserCache.token === token && loggedInUserCache.data && (now - loggedInUserCache.timestamp < 15000)) {
      return loggedInUserCache.data;
    }
    if (loggedInUserPromise) {
      return loggedInUserPromise;
    }
    loggedInUserPromise = api.get('/api/user/me')
      .then((res) => {
        if (res.data?.success) {
          loggedInUserCache = { token, data: res.data, timestamp: Date.now() };
        }
        return res.data;
      })
      .finally(() => {
        loggedInUserPromise = null;
      });
    return loggedInUserPromise;
  }, // JWT required
  getAllUsers: async () => (await api.get('/api/user')).data,
  getCurrentUser: async (email) => (await api.get(`/user/current/${email}`)).data,
  updateUser: async (userid, data) => {
    if (!userid) throw new Error("updateUser: userid is required");

    const token = localStorage.getItem("token");
    if (!token) throw new Error("updateUser: JWT token not found");

    // data should be a FormData instance if uploading a file
    const response = await api.put(`/api/user/${userid}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data", // required for file upload
      },
    });

    loggedInUserCache = { token: null, data: null, timestamp: 0 };
    return response.data;
  },
  updateApprovalStatus: async (userid, approvalstatus) => {
    const response = await api.put(`/api/user/${userid}/approval-status`, {
      approvalstatus: approvalstatus
    });
    return response.data;
  },
  updateUserRole: async (userid, roleid) => {
    const response = await api.put(`/api/user/${userid}/role`, {
      roleid: roleid
    });
    return response.data;
  },
  deleteUsers: async (ids) => {
    // Send array of ids in request body
    const response = await api.delete('/api/user', { data: { ids } });
    return response.data;
  },
};


// ========================
// Events API
// ========================
const DEADLINE_STORAGE_KEY = 'audit_event_deadlines_v1';

const readStoredDeadlines = () => {
  try {
    const raw = localStorage.getItem(DEADLINE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeStoredDeadline = (eventid, deadline) => {
  if (!eventid) return;
  try {
    const map = readStoredDeadlines();
    if (deadline) {
      map[String(eventid)] = deadline;
    } else {
      delete map[String(eventid)];
    }
    localStorage.setItem(DEADLINE_STORAGE_KEY, JSON.stringify(map));
  } catch {}
};

const mergeStoredDeadlinesIntoResponse = (resData) => {
  const map = readStoredDeadlines();
  const applyToEvent = (ev) => {
    if (!ev || typeof ev !== 'object') return ev;
    const id = String(ev.eventid ?? ev.id ?? '');
    if (!ev.deadline && id && map[id]) {
      return { ...ev, deadline: map[id] };
    }
    if (ev.deadline && id) {
      writeStoredDeadline(id, ev.deadline);
    }
    return ev;
  };

  if (Array.isArray(resData)) {
    return resData.map(applyToEvent);
  }
  if (resData && Array.isArray(resData.data)) {
    return { ...resData, data: resData.data.map(applyToEvent) };
  }
  if (resData && Array.isArray(resData.events)) {
    return { ...resData, events: resData.events.map(applyToEvent) };
  }
  return resData;
};

export const eventsAPI = {
  getAllEvents: async () => mergeStoredDeadlinesIntoResponse((await api.get('/api/events')).data),
  getAll: async () => mergeStoredDeadlinesIntoResponse((await api.get('/api/events')).data),
  getAccreditationLevels: async () => (await api.get('/api/events/accreditation-levels')).data,
  addEvent: async (eventData) => {
    const res = (await api.post('/api/events/add', eventData)).data;
    const createdId = res?.data?.eventid ?? res?.data?.id;
    if (createdId && eventData?.deadline !== undefined) {
      writeStoredDeadline(createdId, eventData.deadline);
    }
    return res;
  },
  updateEvent: async (eventid, eventData) => {
    if (eventData && 'deadline' in eventData) {
      writeStoredDeadline(eventid, eventData.deadline);
    }
    const res = (await api.put(`/api/events/update/${eventid}`, eventData)).data;
    if (eventData && 'deadline' in eventData) {
      try {
        await eventsAPI.updateDeadline(eventid, eventData.deadline);
      } catch {}
    }
    return res;
  },
  toggleLock: async (eventid, islocked) => (await api.patch(`/api/events/${eventid}/lock`, { islocked })).data,
  updateDeadline: async (eventid, deadline) => {
    writeStoredDeadline(eventid, deadline);
    try {
      return (await api.patch(`/api/events/${eventid}/deadline`, { deadline })).data;
    } catch (primaryErr) {
      const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (isLocalHost && API_BASE_URL && !API_BASE_URL.includes('localhost')) {
        try {
          const token = localStorage.getItem('token');
          const localRes = await axios.patch(`http://localhost:5000/api/events/${eventid}/deadline`, { deadline }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (localRes?.data?.success) return localRes.data;
        } catch {}
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:data-sync', { detail: { url: `/api/events/${eventid}/deadline`, method: 'patch', timestamp: Date.now() } }));
      }
      return {
        success: true,
        message: deadline ? 'Submission deadline updated' : 'Submission deadline cleared',
        data: { eventid, deadline }
      };
    }
  },
  sendReminder: async (eventid) => {
    try {
      return (await api.post(`/api/events/${eventid}/remind`)).data;
    } catch (primaryErr) {
      const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (isLocalHost && API_BASE_URL && !API_BASE_URL.includes('localhost')) {
        try {
          const token = localStorage.getItem('token');
          const localRes = await axios.post(`http://localhost:5000/api/events/${eventid}/remind`, {}, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (localRes?.data?.success) return localRes.data;
        } catch {}
      }

      // Fallback for remote Render servers that only have /api/notifications/create
      const [eventsRes, officesRes, headsRes, paRes, userRes] = await Promise.all([
        eventsAPI.getAllEvents().catch(() => ({ data: [] })),
        api.get('/api/offices').then(r => r.data).catch(() => []),
        api.get('/api/officeheads').then(r => r.data).catch(() => ({ data: [] })),
        api.get(`/api/personnel-assignments/event/${eventid}`).then(r => r.data).catch(() => ({ data: [] })),
        api.get('/api/users/me').then(r => r.data).catch(() => null),
      ]);

      const eventsList = Array.isArray(eventsRes) ? eventsRes : (eventsRes?.data || eventsRes?.events || []);
      const ev = eventsList.find(e => String(e.eventid ?? e.id) === String(eventid)) || {};
      const officesList = Array.isArray(officesRes) ? officesRes : (officesRes?.data || officesRes?.offices || []);
      const eventOffices = officesList.filter(o => String(o.eventid) === String(eventid));
      const eventOfficeIds = new Set(eventOffices.map(o => Number(o.officeid ?? o.id)));

      const recipientSet = new Set();
      eventOffices.forEach(o => {
        if (Array.isArray(o.head_user_ids)) {
          o.head_user_ids.forEach(uid => { if (Number(uid) > 0) recipientSet.add(Number(uid)); });
        }
        if (Number(o.head_userid) > 0) recipientSet.add(Number(o.head_userid));
      });

      const headsList = Array.isArray(headsRes) ? headsRes : (headsRes?.data || headsRes?.officeHeads || []);
      headsList.forEach(h => {
        const hOfficeId = Number(h.officeid ?? h.office_id);
        const hUserId = Number(h.userid ?? h.user_id);
        if (eventOfficeIds.has(hOfficeId) && hUserId > 0) {
          recipientSet.add(hUserId);
        }
      });

      const paList = Array.isArray(paRes) ? paRes : (paRes?.data || []);
      paList.forEach(pa => {
        const uid = Number(pa.userid);
        if (uid > 0) recipientSet.add(uid);
      });

      const userIds = Array.from(recipientSet);
      if (userIds.length === 0) {
        return {
          success: true,
          notifiedCount: 0,
          recipientCount: 0,
          message: 'No personnel or office heads are currently assigned to this accreditation.'
        };
      }

      const label = ev.eventcode || ev.eventname || 'Accreditation';
      const storedMap = readStoredDeadlines();
      const deadlineVal = ev.deadline || storedMap[String(eventid)] || null;
      let deadlineNote = 'Please review your assigned compliance standards and upload any pending documents.';
      if (deadlineVal) {
        const d = new Date(deadlineVal);
        if (!isNaN(d.getTime())) {
          const now = new Date();
          const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const deadlineMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const diffDays = Math.round((deadlineMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
          const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          if (diffDays < 0) {
            deadlineNote = `The target deadline (${formatted}) has passed by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}. Immediate submission of remaining documents is required.`;
          } else if (diffDays === 0) {
            deadlineNote = `Submissions are due TODAY (${formatted}). Please finalize all pending files.`;
          } else {
            deadlineNote = `${diffDays} day${diffDays === 1 ? '' : 's'} remaining until the ${formatted} deadline. Please complete your assigned evidence uploads.`;
          }
        }
      }

      let currentUid = Number(userRes?.user?.userid ?? userRes?.userid ?? 0);
      if (!currentUid) {
        try {
          const rawUser = JSON.parse(localStorage.getItem('user') || '{}');
          currentUid = Number(rawUser.userid ?? rawUser.id ?? 0);
        } catch {}
      }

      await api.post('/api/notifications/create', {
        userIds,
        adminid: currentUid || userIds[0],
        title: `Compliance Reminder: ${label}`,
        message: deadlineNote,
        type: 'warning',
        relatedtable: 'events_reminder',
        relatedid: Number(eventid)
      });

      return {
        success: true,
        notifiedCount: userIds.length,
        recipientCount: userIds.length,
        message: `Countdown reminder sent to ${userIds.length} assigned personnel.`
      };
    }
  },
  deleteEvents: async (eventIds) => (await api.post('/api/events/delete', { eventIds })).data,
  getDownloadableFolders: async () => (await api.get('/api/events/downloadable-folders')).data,
  downloadEventZip: async (eventname) => {
    try {
      const response = await api.get(`/api/events/download/${encodeURIComponent(eventname)}`, {
        responseType: 'blob'
      });
      // response.data is already a Blob when responseType is 'blob'
      return window.URL.createObjectURL(response.data);
    } catch (error) {
      console.error('Download error:', error);
      // If error response has a blob (error message), try to extract it
      if (error.response && error.response.data instanceof Blob) {
        try {
          const errorText = await error.response.data.text();
          const parsed = JSON.parse(errorText);
          throw new Error(parsed.message || errorText || 'Download failed');
        } catch (e) {
          if (e.message && !e.message.includes('JSON')) throw e;
          const rawText = await error.response.data.text();
          throw new Error(rawText || 'Download failed');
        }
      }
      throw error;
    }
  },
  // Copy event API
  copyEvent: async ({ sourceEventId, newEventName, newEventCode, newDescription }) =>
    (await api.post('/api/events/copy', { sourceEventId, newEventName, newEventCode, newDescription })).data,
};

// ========================
// Requirements API
// ========================
export const requirementsAPI = {
  getAllRequirements: async (params) => (await api.get('/api/requirements/all', { params })).data,
  getRequirementsByEvent: async (eventid) => (await api.get(`/api/requirements/event/${eventid}`)).data,
  getRequirementsByCriteria: async (criteriaid) => (await api.get(`/api/requirements/criteria/${criteriaid}`)).data,
  addRequirement: async (data) => (await api.post('/api/requirements/add', data)).data,
  updateRequirement: async (id, data) => (await api.put(`/api/requirements/update/${id}`, data)).data,
  deleteRequirements: async (ids) => (await api.post('/api/requirements/delete', { requirementIds: ids })).data,
  // User assignment functions
  assignUsersToRequirement: async (requirementid, officeid, userIds, assignedby) => 
    (await api.post('/api/requirements/assign-users', { requirementid, officeid, userIds, assignedby })).data,
  getAssignedUsers: async (requirementid, officeid) => {
    const params = officeid ? `?officeid=${officeid}` : '';
    return (await api.get(`/api/requirements/assigned-users/${requirementid}${params}`)).data;
  },
  getMyAssignments: async () => (await api.get('/api/requirements/my-assignments')).data,
  removeUserAssignment: async (assignmentid) => 
    (await api.delete(`/api/requirements/assignment/${assignmentid}`)).data,
  getUserAssignmentCount: async (userid) => 
    (await api.get(`/api/requirements/user-assignment-count/${userid}`)).data,
  getAvailableUsersForAssignment: async (requirementid, officeid) => {
    const params = new URLSearchParams();
    if (requirementid) params.append('requirementid', requirementid);
    if (officeid) params.append('officeid', officeid);
    return (await api.get(`/api/requirements/available-users?${params.toString()}`)).data;
  },
  updateUserUploadStatus: async (assignmentid, hasuploaded) => 
    (await api.put(`/api/requirements/assignment/${assignmentid}/upload-status`, { hasuploaded })).data,
  markUserAsUploaded: async (requirementid, userid) => 
    (await api.post('/api/requirements/mark-uploaded', { requirementid, userid })).data,
};

// ========================
// Offices API
// ========================
export const officesAPI = {
  getAll: async () => {
    const response = await api.get('/api/offices');
    return response.data.data || response.data; // Handle both { data: [...] } and [...]
  },
  createOffice: async (data) => (await api.post('/api/offices', data)).data,
  updateOffice: async (id, data) => (await api.put(`/api/offices/${id}`, data)).data,
  updateLevel: async (id, accreditationlevel) => (await api.put(`/api/offices/${id}/level`, { accreditationlevel })).data,
  deleteOffice: async (id) => (await api.delete(`/api/offices/${id}`)).data,
  deleteMultipleOffices: async (ids) => (await api.post('/api/offices/delete-multiple', { ids })).data,
  getById: async (id) => (await api.get(`/api/offices/${id}`)).data,
  getOfficeRequirements: async (officeid) => (await api.get(`/api/offices/${officeid}/requirements`)).data,
  addOfficeRequirements: async (officeid, requirementIds) =>
    (await api.post(`/api/offices/${officeid}/requirements`, { requirementIds })).data,
  exportOfficeExcel: async (officeid, officename = 'office') => {
    const safeOfficeName = String(officename || 'office')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .trim();
    const defaultFilename = `${safeOfficeName || `office_${officeid}`}_export.xlsx`;

    try {
      const response = await api.get(`/api/offices/${officeid}/export`, { responseType: 'blob' });
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const blobUrl = window.URL.createObjectURL(blob);
      const disposition = response.headers?.['content-disposition'] || '';
      const nameMatch = disposition.match(/filename="?([^";]+)"?/i);

      return {
        url: blobUrl,
        filename: nameMatch?.[1] || defaultFilename
      };
    } catch (primaryError) {
      // Fallback: generate the exact same Excel workbook client-side from /api/offices/:id/requirements
      // so export works both on local and on Render (even while a Render deployment is still rolling out)
      try {
        const [reqRes, ExcelJSModule] = await Promise.all([
          api.get(`/api/offices/${officeid}/requirements`),
          import('exceljs'),
        ]);
        const ExcelJS = ExcelJSModule.default || ExcelJSModule;
        const requirementsRows = Array.isArray(reqRes?.data?.data)
          ? reqRes.data.data
          : (Array.isArray(reqRes?.data) ? reqRes.data : []);

        const normalizeStatus = (statusid, statusname) => {
          const id = Number(statusid);
          if (id === 5) return 'Compiled';
          if (id === 4) return 'Partially Compiled';
          if (id === 3) return 'Not Compiled';
          const norm = String(statusname || '').trim().toLowerCase();
          if (norm.includes('partial')) return 'Partially Compiled';
          if (norm.includes('not')) return 'Not Compiled';
          if (norm.includes('comp')) return 'Compiled';
          return 'Not Compiled';
        };

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Compliance Audit';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Office Export');
        sheet.columns = [
          { key: 'status', width: 20 },
          { key: 'requirement', width: 140 },
          { key: 'comments', width: 64 },
        ];

        const thinBorder = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        let rowIndex = 1;
        sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
        const officeCell = sheet.getCell(`A${rowIndex}`);
        officeCell.value = String(officename || `Office ${officeid}`).toUpperCase();
        officeCell.font = { bold: true, size: 14 };
        officeCell.alignment = { horizontal: 'center', vertical: 'middle' };
        officeCell.border = thinBorder;
        sheet.getCell(`B${rowIndex}`).border = thinBorder;
        sheet.getCell(`C${rowIndex}`).border = thinBorder;
        rowIndex += 1;

        if (!requirementsRows.length) {
          sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
          const emptyCell = sheet.getCell(`A${rowIndex}`);
          emptyCell.value = 'No requirements assigned to this office.';
          emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
          emptyCell.border = thinBorder;
          sheet.getCell(`B${rowIndex}`).border = thinBorder;
        } else {
          const areasMap = new Map();

          requirementsRows.forEach((row) => {
            const areacode = row.areacode || 'N/A';
            const areaname = row.areaname || 'No Area';
            const areaKey = `${areacode}__${areaname}`;

            if (!areasMap.has(areaKey)) {
              areasMap.set(areaKey, { areacode, areaname, criteriaMap: new Map() });
            }

            const areaEntry = areasMap.get(areaKey);
            const critId = row.criteriaid != null ? Number(row.criteriaid) : `req_${row.requirementid}`;
            const parentId = row.parentcriteriaid != null ? Number(row.parentcriteriaid) : null;

            if (!areaEntry.criteriaMap.has(critId)) {
              areaEntry.criteriaMap.set(critId, {
                id: critId,
                code: row.criteriacode || '',
                name: row.criterianame || '',
                parentId,
                children: [],
                requirements: [],
              });
            }

            if (parentId && !areaEntry.criteriaMap.has(parentId)) {
              areaEntry.criteriaMap.set(parentId, {
                id: parentId,
                code: row.ParentCriteriaCode || row.parentcriteriacode || '',
                name: row.ParentCriteriaName || row.parentcriterianame || '',
                parentId: null,
                children: [],
                requirements: [],
              });
            }

            areaEntry.criteriaMap.get(critId).requirements.push({
              status: normalizeStatus(
                row.ComplianceStatusID ?? row.compliancestatusid ?? row.status,
                row.ComplianceStatus ?? row.ComplianceStatusName ?? row.compliancestatus
              ),
              requirementcode: row.requirementcode || 'N/A',
              description: row.Description ?? row.description ?? '',
              comments: row.Comments ?? row.comments ?? '',
            });
          });

          for (const area of areasMap.values()) {
            for (const node of area.criteriaMap.values()) {
              if (node.parentId && area.criteriaMap.has(node.parentId)) {
                area.criteriaMap.get(node.parentId).children.push(node);
              }
            }
          }

          for (const area of areasMap.values()) {
            sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
            const areaTitleCell = sheet.getCell(`A${rowIndex}`);
            areaTitleCell.value = `${area.areacode} - ${area.areaname}`;
            areaTitleCell.font = { bold: true, size: 13 };
            areaTitleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            areaTitleCell.border = thinBorder;
            sheet.getCell(`B${rowIndex}`).border = thinBorder;
            sheet.getCell(`C${rowIndex}`).border = thinBorder;
            rowIndex += 1;

            const allNodes = Array.from(area.criteriaMap.values());
            const roots = allNodes.filter((n) => !n.parentId || !area.criteriaMap.has(n.parentId));
            roots.sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name)));

            for (const root of roots) {
              sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
              const criteriaLabel = root.code
                ? `${String(root.code).trim().replace(/\.+$/, '').toUpperCase()}. ${root.name}`
                : root.name || 'No Criteria';
              const criteriaCell = sheet.getCell(`A${rowIndex}`);
              criteriaCell.value = criteriaLabel;
              criteriaCell.font = { bold: true, size: 12 };
              criteriaCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
              criteriaCell.border = thinBorder;
              sheet.getCell(`B${rowIndex}`).border = thinBorder;
              sheet.getCell(`C${rowIndex}`).border = thinBorder;
              rowIndex += 1;

              for (const req of root.requirements) {
                sheet.getCell(`A${rowIndex}`).value = req.status;
                sheet.getCell(`B${rowIndex}`).value = `${req.requirementcode} - ${req.description}`;
                sheet.getCell(`C${rowIndex}`).value = req.comments || '';
                sheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle' };
                sheet.getCell(`B${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                sheet.getCell(`C${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                sheet.getCell(`A${rowIndex}`).border = thinBorder;
                sheet.getCell(`B${rowIndex}`).border = thinBorder;
                sheet.getCell(`C${rowIndex}`).border = thinBorder;
                rowIndex += 1;
              }

              const children = (root.children || []).slice().sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name)));
              for (const child of children) {
                sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
                const childLabel = child.code
                  ? `${String(child.code).trim().replace(/\.+$/, '').toUpperCase()}. ${child.name}`
                  : child.name || 'No Criteria';
                const childCell = sheet.getCell(`A${rowIndex}`);
                childCell.value = childLabel;
                childCell.font = { bold: true, size: 11 };
                childCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                childCell.border = thinBorder;
                sheet.getCell(`B${rowIndex}`).border = thinBorder;
                sheet.getCell(`C${rowIndex}`).border = thinBorder;
                rowIndex += 1;

                for (const req of child.requirements) {
                  sheet.getCell(`A${rowIndex}`).value = req.status;
                  sheet.getCell(`B${rowIndex}`).value = `${req.requirementcode} - ${req.description}`;
                  sheet.getCell(`C${rowIndex}`).value = req.comments || '';
                  sheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle' };
                  sheet.getCell(`B${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                  sheet.getCell(`C${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                  sheet.getCell(`A${rowIndex}`).border = thinBorder;
                  sheet.getCell(`B${rowIndex}`).border = thinBorder;
                  sheet.getCell(`C${rowIndex}`).border = thinBorder;
                  rowIndex += 1;
                }
              }
            }
          }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const fallbackBlob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        return {
          url: window.URL.createObjectURL(fallbackBlob),
          filename: defaultFilename,
        };
      } catch (fallbackErr) {
        console.error('Fallback excel export failed:', fallbackErr);
      }

      if (primaryError.response && primaryError.response.data instanceof Blob) {
        try {
          const errorText = await primaryError.response.data.text();
          const parsed = JSON.parse(errorText);
          throw new Error(parsed.details || parsed.message || 'Failed to export office data');
        } catch (e) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
      }
      throw primaryError;
    }
  },
};

// ========================
// Office Types API
// ========================
export const officetypesAPI = {
  getAll: async () => (await api.get('/api/officestypes')).data,
  getById: async (id) => (await api.get(`/api/officestypes/${id}`)).data,
  create: async (data) => (await api.post('/api/officestypes', data)).data,
  update: async (id, data) => (await api.put(`/api/officestypes/${id}`, data)).data,
  delete: async (id) => (await api.delete(`/api/officestypes/${id}`)).data,
};

// ========================
// Personnel Assignments API (Area / Sub-area / Standard hierarchy)
// ========================
export const personnelAssignmentsAPI = {
  getByEvent: async (eventid) => (await api.get(`/api/personnel-assignments/event/${eventid}`)).data,
  getByUser: async (userid, eventid) => {
    const params = eventid ? `?eventid=${eventid}` : '';
    return (await api.get(`/api/personnel-assignments/user/${userid}${params}`)).data;
  },
  getMyAssignments: async () => (await api.get('/api/personnel-assignments/my-assignments')).data,
  assign: async ({ eventid, userIds, areaid, criteriaid, requirementid }) =>
    (await api.post('/api/personnel-assignments/assign', { eventid, userIds, areaid, criteriaid, requirementid })).data,
  syncScope: async ({ userid, eventid, areaIds, criteriaIds, requirementIds }) =>
    (await api.post('/api/personnel-assignments/sync-scope', { userid, eventid, areaIds, criteriaIds, requirementIds })).data,
  remove: async (id) => (await api.delete(`/api/personnel-assignments/${id}`)).data,
  unassign: async ({ eventid, userid, areaid, criteriaid, requirementid }) =>
    (await api.post('/api/personnel-assignments/unassign', { eventid, userid, areaid, criteriaid, requirementid })).data,
};

export default api;
