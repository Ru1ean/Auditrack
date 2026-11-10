import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usersAPI } from "../../utils/api";
import { DashboardSkeleton, CardListSkeleton } from "../UI/Skeleton";

export default function ProtectedRoute({ children }) {
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
  const [isValid, setIsValid] = useState(() => !!token);

  useEffect(() => {
    if (!token) {
      setIsValid(false);
      setLoading(false);
      return;
    }

    let mounted = true;
    const verifyAuth = async () => {
      try {
        const res = await usersAPI.getLoggedInUser();
        if (mounted && res?.success && res.user) {
          setCurrentUser(res.user);
          setIsValid(true);
          try {
            localStorage.setItem("user", JSON.stringify(res.user));
          } catch {}
        } else if (mounted) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setIsValid(false);
        }
      } catch (err) {
        if (mounted) {
          if (err.response?.status === 401 || err.response?.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setIsValid(false);
          } else {
            // Keep existing cached user on temporary network offline
            const cachedUser = localStorage.getItem("user");
            if (!cachedUser) {
              setIsValid(false);
            }
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    verifyAuth();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (!token || !isValid) {
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

  return children;
}

