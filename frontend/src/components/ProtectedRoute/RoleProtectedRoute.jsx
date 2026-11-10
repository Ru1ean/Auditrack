import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usersAPI } from "../../utils/api";
import { DashboardSkeleton, CardListSkeleton } from "../UI/Skeleton";

export default function RoleProtectedRoute({ allowedRoles = [], forbiddenRoles = [], children }) {
    const location = useLocation();
    const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const stored = localStorage.getItem("user");
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(() => !currentUser && !!token);
    const [authFailed, setAuthFailed] = useState(false);

    useEffect(() => {
        if (!token) {
            setAuthFailed(true);
            setLoading(false);
            return;
        }

        let mounted = true;
        const fetchUser = async () => {
            try {
                const res = await usersAPI.getLoggedInUser();
                if (mounted && res?.success && res.user) {
                    setCurrentUser(res.user);
                    try {
                        localStorage.setItem("user", JSON.stringify(res.user));
                    } catch {}
                } else if (mounted) {
                    setAuthFailed(true);
                }
            } catch (err) {
                console.error("RoleProtectedRoute fetch error:", err);
                if (mounted) {
                    if (err.response?.status === 401 || err.response?.status === 403) {
                        localStorage.removeItem("token");
                        localStorage.removeItem("user");
                        setAuthFailed(true);
                    } else {
                        const cached = localStorage.getItem("user");
                        if (!cached) {
                            setAuthFailed(true);
                        }
                    }
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchUser();
        return () => { mounted = false; };
    }, [token]);

    if (!token || authFailed) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (loading) {
        const isDashboard = location.pathname === '/home' || location.pathname === '/home/';
        return (
            <div className="w-full p-6">
                {isDashboard ? <DashboardSkeleton /> : <CardListSkeleton count={4} />}
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const userRoleId = Number(currentUser?.roleid);
    const userRoleName = String(currentUser?.rolename || currentUser?.rolename || '').toLowerCase();
    const isAuditor = userRoleId === 4 || userRoleName.includes('auditor') || currentUser?.isExternalAuditor;

    // Check forbidden roles
    if (forbiddenRoles.length > 0) {
        if (forbiddenRoles.includes('auditor') && isAuditor) {
            return <Navigate to="/home" replace />;
        }
        if (forbiddenRoles.includes(userRoleId)) {
            return <Navigate to="/home" replace />;
        }
    }

    // Check allowed roles
    if (allowedRoles.length > 0) {
        const isAllowed = allowedRoles.includes(userRoleId) || 
                          allowedRoles.some(r => typeof r === 'string' && r.toLowerCase() === userRoleName);
        if (!isAllowed) {
            return <Navigate to="/home" replace />;
        }
    }

    return children;
}

