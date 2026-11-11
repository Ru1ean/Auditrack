import './index.css'
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";


import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import RegisterAuditor from './pages/RegisterAuditor.jsx'
import Otp from './pages/Otp.jsx'
import Home from './pages/Home.jsx'
import AppLayout from './AppLayout/AppLayout.jsx'
import Organization from './pages/Organization.jsx'
import Audit from './pages/Audit.jsx'
import OfficeHead from './pages/OfficeHead.jsx'
import Requirements from './pages/Requirements.jsx'
import Profile from './pages/Profile.jsx'
import Users from './pages/Users.jsx'
import Events from './pages/Events.jsx'
import Criteria from './pages/Criteria.jsx'
import AuditLogs from './pages/AuditLogs.jsx'
import Area from './pages/Area.jsx'
import ALLC from './pages/ALLC.jsx'
import MasterList from './pages/MasterList.jsx'
import ExternalAuditors from './pages/ExternalAuditors.jsx'
import ACCPage from './pages/ACC.jsx'

import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.jsx";
import RoleProtectedRoute from "./components/ProtectedRoute/RoleProtectedRoute.jsx";
import PublicRoute from "./components/ProtectedRoute/PublicRoute.jsx";
import NotFound from './components/UI/NotFound'

export default function App() {
  const router = createBrowserRouter([
    {
      path: "/login",
      element: (
        <PublicRoute>
          <Login />
        </PublicRoute>
      ),
    },
    {
      path: "/register",
      element: (
        <PublicRoute>
          <Register />
        </PublicRoute>
      ),
    },
    {
      path: "/register-auditor",
      element: (
        <PublicRoute>
          <RegisterAuditor />
        </PublicRoute>
      ),
    },
    {
      path: "/otp",
      element: (
        <PublicRoute>
          <Otp />
        </PublicRoute>
      ),
    },
    {
      path: "/home",
      element: (
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      ),
      children: [
        { index: true, element: <Home /> },
        { path: "organizations", element: <Organization /> },
        { path: "audit", element: <Audit /> },
        { path: "requirements", element: <Requirements /> },
        { path: "officehead", element: <RoleProtectedRoute allowedRoles={[1, 'admin']}><OfficeHead /></RoleProtectedRoute> },
        { path: "users", element: <RoleProtectedRoute allowedRoles={[1, 'admin']}><Users /></RoleProtectedRoute> },
        { path: "events", element: <RoleProtectedRoute forbiddenRoles={['auditor', 4]}><Events /></RoleProtectedRoute> },
        { path: "criteria", element: <Criteria /> },
        { path: "audit-logs", element: <RoleProtectedRoute allowedRoles={[1, 'admin']}><AuditLogs /></RoleProtectedRoute> },
        { path: "profile", element: <Profile /> },
        { path: "area", element: <Area /> },
        { path: "setup", element: <ALLC /> },
        { path: "allc", element: <ALLC /> },
        { path: "acc-management", element: <ACCPage /> },
        { path: "master-list", element: <MasterList /> },
        { path: "external-auditors", element: <RoleProtectedRoute allowedRoles={[1, 'admin']}><ExternalAuditors /></RoleProtectedRoute> },
      ],
    },
  
    { path: "/dashboard", element: <Navigate to="/home" replace /> },
    { path: "/organizations", element: <Navigate to="/home/organizations" replace /> },
    { path: "/audit", element: <Navigate to="/home/audit" replace /> },
    { path: "/requirements", element: <Navigate to="/home/requirements" replace /> },
    { path: "/officehead", element: <Navigate to="/home/officehead" replace /> },
    { path: "/users", element: <Navigate to="/home/users" replace /> },
    { path: "/events", element: <Navigate to="/home/events" replace /> },
    { path: "/criteria", element: <Navigate to="/home/criteria" replace /> },
    { path: "/audit-logs", element: <Navigate to="/home/audit-logs" replace /> },
    { path: "/profile", element: <Navigate to="/home/profile" replace /> },
    { path: "/area", element: <Navigate to="/home/area" replace /> },
    { path: "/setup", element: <Navigate to="/home/setup" replace /> },
    { path: "/allc", element: <Navigate to="/home/allc" replace /> },
    { path: "/acc-management", element: <Navigate to="/home/acc-management" replace /> },
    { path: "/master-list", element: <Navigate to="/home/master-list" replace /> },
    { path: "/external-auditors", element: <Navigate to="/home/external-auditors" replace /> },

    { path: "/", element: <Navigate to="/home" replace /> },
    { path: '*', element: <NotFound /> }
  ]);

  return <RouterProvider router={router} />;
}
