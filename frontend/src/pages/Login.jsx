import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import auditrackLogo from "../assets/images/logo.png";
import { usersAPI } from "../utils/api";
import { useModal } from "../components/UI/ModalProvider";

export default function Login() {
    const navigate = useNavigate();
    const { showAlert } = useModal();
    const location = useLocation();
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [blockedMs, setBlockedMs] = useState(0);
    const [blockedUntil, setBlockedUntil] = useState(null);

    // restore blocked state from localStorage on mount and sync with server
    useEffect(() => {
        try {
            const stored = localStorage.getItem('loginBlockedUntil');
            if (stored) {
                const until = Number(stored);
                if (!Number.isNaN(until) && until > Date.now()) {
                    usersAPI.loginStatus(formData.email || '').then((resp) => {
                        if (!resp?.remainingMs || resp.remainingMs <= 0) {
                            localStorage.removeItem('loginBlockedUntil');
                            setBlockedUntil(null);
                            setBlockedMs(0);
                            setError("");
                        } else {
                            const actualUntil = Date.now() + resp.remainingMs;
                            setBlockedUntil(actualUntil);
                            setBlockedMs(resp.remainingMs);
                            localStorage.setItem('loginBlockedUntil', String(actualUntil));
                        }
                    }).catch(() => {
                        setBlockedUntil(until);
                        setBlockedMs(Math.max(0, until - Date.now()));
                    });
                } else {
                    localStorage.removeItem('loginBlockedUntil');
                    setBlockedUntil(null);
                    setBlockedMs(0);
                }
            }
        } catch (e) {
            // ignore storage errors
        }
    }, []);

    // Server-side pre-check: query login-status when the email changes (debounced)
    useEffect(() => {
        let id;
        const runCheck = async () => {
            try {
                const email = String(formData.email || '').trim();
                if (!email) {
                    setBlockedMs(0);
                    setBlockedUntil(null);
                    localStorage.removeItem('loginBlockedUntil');
                    return;
                }
                const resp = await usersAPI.loginStatus(email);
                const remaining = resp?.remainingMs || 0;
                if (remaining > 0) {
                    const until = Date.now() + remaining;
                    setBlockedMs(remaining);
                    setBlockedUntil(until);
                    try { localStorage.setItem('loginBlockedUntil', String(until)); } catch(e) {}
                    setError(resp?.message || `Too many failed login attempts. Please wait.`);
                } else {
                    setBlockedMs(0);
                    setBlockedUntil(null);
                    try { localStorage.removeItem('loginBlockedUntil'); } catch(e) {}
                    setError("");
                }
            } catch (err) {
                // network errors are non-fatal for UX; keep existing state
            }
        };

        id = setTimeout(runCheck, 300);
        return () => clearTimeout(id);
    }, [formData.email]);

    // Redirect if already logged in
    useEffect(() => {
        const token = localStorage.getItem("token");
        const user = localStorage.getItem("user");
        if (token && user) {
            const userData = JSON.parse(user);
            const roleid = Number(userData?.roleid);
            const rolename = String(userData?.rolename || '').toLowerCase();
            const isAdmin = roleid === 1 || rolename === 'admin';
            const destination = isAdmin ? "/home" : "/home/acc-management";
            navigate(destination, { replace: true });
        }
    }, [navigate]);

    // Show message from previous navigation (e.g., OTP verified or session replaced)
    useEffect(() => {
        const msg = location.state?.message || location.state?.successMessage;
        if (msg) {
            try {
                sessionStorage.removeItem('sessionReplacedMessage');
            } catch {}
            setError("");
            setSuccessMessage(msg);
            navigate(location.pathname, { replace: true, state: null });
            return;
        }

        try {
            const replacedMsg = sessionStorage.getItem('sessionReplacedMessage');
            if (replacedMsg) {
                setError(replacedMsg);
                sessionStorage.removeItem('sessionReplacedMessage');
            }
        } catch {}
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (blockedMs && blockedMs > 0) return;
        setLoading(true);
        setError("");

        try {
            const response = await usersAPI.login({
                email: formData.email,
                password: formData.password,
            });

            if (response.success) {
                localStorage.setItem("token", response.token);
                localStorage.setItem("user", JSON.stringify(response.user));
                if (response.sessionId) {
                    localStorage.setItem("sessionId", response.sessionId);
                }

                try {
                    localStorage.removeItem('loginBlockedUntil');
                    sessionStorage.removeItem('sessionReplacedMessage');
                } catch (e) {}

                axios.defaults.headers.common["Authorization"] =
                    `Bearer ${response.token}`;

                const roleid = Number(response.user?.roleid);
                const rolename = String(response.user?.rolename || '').toLowerCase();
                const isAdmin = roleid === 1 || rolename === 'admin';
                const destination = isAdmin ? "/home" : "/home/acc-management";
                navigate(destination, { replace: true });
            } else {
                if (response.approvalstatus === 'pending') {
                    setError("Your account is pending approval. Please wait for admin approval.");
                    await showAlert("Your account is still pending approval. Please wait for the administrator to review your account.");
                } else if (response.approvalstatus === 'denied') {
                    setError("Your account has been denied access.");
                    await showAlert("Your account has been denied access. Please contact the administrator for more information.");
                } else {
                    setError(response.message || "Login failed");
                }
            }
        } catch (err) {
            const resp = err.response;
            if (resp && resp.status === 429) {
                const remaining = resp.data?.remainingMs || 0;
                const until = Date.now() + remaining;
                setBlockedMs(remaining);
                setBlockedUntil(until);
                try { localStorage.setItem('loginBlockedUntil', String(until)); } catch(e) {}
                setError(resp.data?.message || 'Too many failed login attempts.');
            } else {
                setError(
                    resp?.data?.message ||
                    "Invalid email or password"
                );
            }
        } finally {
            setLoading(false);
        }
    };

    // Countdown for blocked state
    useEffect(() => {
        if (!blockedUntil) return;
        const tick = () => {
            const ms = Math.max(0, blockedUntil - Date.now());
            setBlockedMs(ms);
            if (ms <= 0) {
                setBlockedUntil(null);
                setBlockedMs(0);
                try { localStorage.removeItem('loginBlockedUntil'); } catch(e) {}
                setError("");
            }
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [blockedUntil]);

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: "'Poppins', 'Inter', sans-serif", background: '#ffffff' }}>

            {/* ─── CENTERED FORM PANEL ─── */}
            <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                padding: '2rem',
                overflowY: 'auto',
            }}>
                <div style={{ width: '100%', maxWidth: '420px' }} className="animate-fade-in-right">

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="animate-slide-down">
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                            <img src={auditrackLogo} alt="Auditrack Logo"
                                style={{ width: '48px', height: '48px', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(37,99,235,0.18))' }} />
                            <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.5px' }}>
                                Auditrack
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem', letterSpacing: '-0.4px' }}>
                            Welcome back
                        </h1>
                        <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                            Sign in to your account to continue
                        </p>
                    </div>

                    {/* Card */}
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 24px rgba(15,23,42,0.08)',
                        padding: '2rem',
                    }}>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                            {/* Success message */}
                            {successMessage && !error && (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '10px',
                                    color: '#15803d',
                                    fontSize: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                }}>
                                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    {successMessage}
                                </div>
                            )}

                            {/* Block / error banners */}
                            {blockedMs > 0 ? (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    background: '#fffbeb',
                                    border: '1px solid #fde68a',
                                    borderRadius: '10px',
                                    color: '#92400e',
                                    fontSize: '0.8rem',
                                }}>
                                    {(() => {
                                        const total = Math.ceil(blockedMs / 1000);
                                        const m = Math.floor(total / 60);
                                        const s = total % 60;
                                        return `Too many failed attempts. Please wait ${m}:${String(s).padStart(2, '0')} before retrying.`;
                                    })()}
                                </div>
                            ) : (
                                error && (
                                    <div style={{
                                        padding: '0.75rem 1rem',
                                        background: '#fef2f2',
                                        border: '1px solid #fecaca',
                                        borderRadius: '10px',
                                        color: '#b91c1c',
                                        fontSize: '0.8rem',
                                    }} className="animate-shake">
                                        {error}
                                    </div>
                                )
                            )}

                            {/* Email field */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                                    Email address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="you@lccbonline.edu.ph"
                                    disabled={blockedMs > 0}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.875rem',
                                        border: '1.5px solid #e2e8f0',
                                        borderRadius: '10px',
                                        fontSize: '0.875rem',
                                        outline: 'none',
                                        background: '#f8fafc',
                                        color: '#0f172a',
                                        transition: 'border-color 0.2s, box-shadow 0.2s',
                                        boxSizing: 'border-box',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
                                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>

                            {/* Password field */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                                    Password
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="Enter your password"
                                        disabled={blockedMs > 0}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 2.75rem 0.65rem 0.875rem',
                                            border: '1.5px solid #e2e8f0',
                                            borderRadius: '10px',
                                            fontSize: '0.875rem',
                                            outline: 'none',
                                            background: '#f8fafc',
                                            color: '#0f172a',
                                            transition: 'border-color 0.2s, box-shadow 0.2s',
                                            boxSizing: 'border-box',
                                        }}
                                        onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
                                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={blockedMs > 0}
                                        style={{
                                            position: 'absolute', right: '0.75rem', top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#94a3b8', padding: '0', display: 'flex',
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit button */}
                            <button
                                type="submit"
                                disabled={loading || blockedMs > 0}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '10px',
                                    border: 'none',
                                    cursor: loading || blockedMs > 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    color: '#fff',
                                    background: loading || blockedMs > 0
                                        ? '#94a3b8'
                                        : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                    boxShadow: loading || blockedMs > 0 ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
                                    transition: 'all 0.2s',
                                    marginTop: '0.25rem',
                                }}
                                onMouseEnter={e => { if (!loading && !blockedMs) { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(37,99,235,0.45)'; }}}
                                onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = loading || blockedMs > 0 ? 'none' : '0 4px 14px rgba(37,99,235,0.35)'; }}
                            >
                                {loading ? "Signing in…" : blockedMs > 0 ? `Locked (${Math.ceil(blockedMs / 1000)}s)` : "Sign in"}
                            </button>
                        </form>
                    </div>

                    {/* Sign up link */}
                    <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#64748b', marginTop: '1.25rem' }}>
                        Don't have an account?{" "}
                        <Link to="/register" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                            onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.target.style.textDecoration = 'none'}>
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
