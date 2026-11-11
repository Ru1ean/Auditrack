import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Eye, EyeOff, CheckCircle2, Circle } from "lucide-react";
import logo from "../assets/images/lccb_logo.png";
import auditrackLogo from "../assets/images/logo.png";
import { usersAPI } from "../utils/api";
import { useModal } from "../components/UI/ModalProvider";

const COMPANY_EMAIL_DOMAIN = "@lccbonline.edu.ph";

export default function Register() {
    const navigate = useNavigate();
    const location = useLocation();
    const { showAlert } = useModal();
    const inviteToken = new URLSearchParams(location.search).get("invite") || "";
    const inviteExpiredRef = useRef(false);
    const [formData, setFormData] = useState({
        firstname: "",
        middleinitial: "",
        lastname: "",
        email: "",
        password: "",
        roleid: "2"
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [inviteChecking, setInviteChecking] = useState(Boolean(inviteToken));
    const [inviteInfo, setInviteInfo] = useState(null);
    const [passwordError, setPasswordError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!inviteToken) return;

        let timerId;
        let cancelled = false;

        const handleExpiredInvite = async () => {
            if (inviteExpiredRef.current) return;
            inviteExpiredRef.current = true;
            await showAlert("Invite expired.", "Invite Expired");
            navigate("/login", { replace: true });
        };

        const validateInvite = async () => {
            setInviteChecking(true);
            try {
                const response = await usersAPI.validateRegistrationInvite(inviteToken);
                if (cancelled) return;

                const invite = response.invite;
                setInviteInfo(invite);
                setFormData((current) => ({
                    ...current,
                    email: invite?.email || current.email,
                    roleid: String(invite?.roleid || current.roleid || "2"),
                }));

                const remainingMs = Math.max(0, Number(invite?.expiresAt || 0) - Date.now());
                timerId = window.setTimeout(handleExpiredInvite, remainingMs);
            } catch {
                if (cancelled) return;
                await handleExpiredInvite();
            } finally {
                if (!cancelled) setInviteChecking(false);
            }
        };

        validateInvite();

        return () => {
            cancelled = true;
            if (timerId) window.clearTimeout(timerId);
        };
    }, [inviteToken, navigate, showAlert]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (name === 'password') validatePassword(value);
        if (name === 'email') validateEmail(value);
    };

    const validateEmail = (email) => {
        const normalizedEmail = email.trim().toLowerCase();
        if (inviteInfo?.allowAnyEmail) {
            const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
            if (!isValidFormat) { setEmailError("Please enter a valid email address"); return false; }
            setEmailError(""); return true;
        }
        if (!normalizedEmail.endsWith(COMPANY_EMAIL_DOMAIN)) {
            setEmailError(`Email must use the ${COMPANY_EMAIL_DOMAIN} domain`); return false;
        }
        setEmailError(""); return true;
    };

    const validatePassword = (password) => {
        const numberCount = (password.match(/\d/g) || []).length;
        if (password.length < 8) { setPasswordError("Password must be at least 8 characters long"); return false; }
        if (numberCount < 3) { setPasswordError("Password must contain at least 3 numbers"); return false; }
        setPasswordError(""); return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (!validateEmail(formData.email)) {
            setLoading(false);
            setError(!inviteInfo?.allowAnyEmail ? `Only ${COMPANY_EMAIL_DOMAIN} email addresses can register` : "Please enter a valid email address");
            return;
        }
        if (!validatePassword(formData.password)) {
            setLoading(false);
            setError("Please fix the password errors before submitting");
            return;
        }

        try {
            navigate("/otp", {
                state: {
                    firstname: formData.firstname,
                    middleinitial: formData.middleinitial,
                    lastname: formData.lastname,
                    email: formData.email,
                    password: formData.password,
                    roleid: parseInt(inviteInfo?.roleid || formData.roleid, 10) || 2,
                    inviteToken: inviteToken || null,
                },
            });
        } catch (err) {
            console.error('Registration error:', err);
            setError(err.response?.data?.message || "An error occurred during registration");
        } finally {
            setLoading(false);
        }
    };

    // ── Shared input style helpers ──
    const inputStyle = (hasError = false) => ({
        width: '100%',
        padding: '0.6rem 0.875rem',
        border: `1.5px solid ${hasError ? '#fca5a5' : '#e2e8f0'}`,
        borderRadius: '10px',
        fontSize: '0.82rem',
        outline: 'none',
        background: '#f8fafc',
        color: '#0f172a',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box',
    });
    const labelStyle = {
        display: 'block', fontSize: '0.77rem', fontWeight: 600,
        color: '#374151', marginBottom: '0.35rem',
    };

    if (inviteChecking) {
        return (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <div style={{ textAlign: 'center' }}>
                    <img src={logo} alt="App Logo" style={{ margin: '0 auto 1rem', height: '64px', width: '64px' }} />
                    <p style={{ fontSize: '0.875rem', color: '#64748b', fontFamily: "'Poppins', sans-serif" }}>Checking invite link…</p>
                </div>
            </div>
        );
    }

    const pwLongEnough = formData.password.length >= 8;
    const pwHasNums = (formData.password.match(/\d/g) || []).length >= 3;

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: "'Poppins', 'Inter', sans-serif", background: '#ffffff' }}>

            {/* ─── CENTERED FORM PANEL ─── */}
            <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                padding: '1.5rem 2rem',
                overflowY: 'auto',
            }}>
                <div style={{ width: '100%', maxWidth: '420px', paddingBottom: '1rem' }} className="animate-fade-in-right">

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }} className="animate-slide-down">
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                            <img src={auditrackLogo} alt="Auditrack Logo"
                                style={{ width: '44px', height: '44px', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(37,99,235,0.18))' }} />
                            <span style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.5px' }}>
                                Auditrack
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem', letterSpacing: '-0.4px' }}>
                            Create Account
                        </h1>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                            Fill in the details below to get started
                        </p>
                    </div>

                    {/* Card */}
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 24px rgba(15,23,42,0.08)',
                        padding: '1.75rem',
                    }}>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

                            {/* Error banner */}
                            {error && (
                                <div style={{
                                    padding: '0.7rem 1rem',
                                    background: '#fef2f2', border: '1px solid #fecaca',
                                    borderRadius: '10px', color: '#b91c1c', fontSize: '0.78rem',
                                }} className="animate-shake">
                                    {error}
                                </div>
                            )}

                            {/* Invite info */}
                            {inviteInfo && (
                                <div style={{
                                    padding: '0.65rem 1rem',
                                    background: '#eff6ff', border: '1px solid #bfdbfe',
                                    borderRadius: '10px', color: '#1d4ed8', fontSize: '0.77rem',
                                }}>
                                    {inviteInfo.allowAnyEmail
                                        ? "Standard Email Invite verified: any valid email accepted."
                                        : "Institutional Invite verified: @lccbonline.edu.ph required."}
                                </div>
                            )}

                            {/* Name row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label htmlFor="firstname" style={labelStyle}>First Name *</label>
                                    <input
                                        type="text" id="firstname" name="firstname" required
                                        value={formData.firstname} onChange={handleChange}
                                        placeholder="First name"
                                        style={inputStyle()}
                                        onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
                                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="lastname" style={labelStyle}>Last Name *</label>
                                    <input
                                        type="text" id="lastname" name="lastname" required
                                        value={formData.lastname} onChange={handleChange}
                                        placeholder="Last name"
                                        style={inputStyle()}
                                        onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
                                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                                    />
                                </div>
                            </div>

                            {/* Middle initial */}
                            <div>
                                <label htmlFor="middleinitial" style={labelStyle}>Middle Initial</label>
                                <input
                                    type="text" id="middleinitial" name="middleinitial" maxLength="1"
                                    value={formData.middleinitial} onChange={handleChange}
                                    placeholder="e.g. A"
                                    style={inputStyle()}
                                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
                                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label htmlFor="email" style={labelStyle}>Email address *</label>
                                <input
                                    type="email" id="email" name="email" required
                                    value={formData.email} onChange={handleChange}
                                    disabled={Boolean(inviteInfo?.email)}
                                    placeholder={inviteInfo?.allowAnyEmail ? 'name@example.com' : `name${COMPANY_EMAIL_DOMAIN}`}
                                    style={inputStyle(Boolean(emailError))}
                                    onFocus={e => { if (!emailError) { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}}
                                    onBlur={e => { e.target.style.borderColor = emailError ? '#fca5a5' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                                />
                                {emailError
                                    ? <p style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#dc2626' }}>{emailError}</p>
                                    : <p style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                                        {inviteInfo?.allowAnyEmail ? 'Any valid email address (Gmail, Yahoo, etc.)' : `Use your ${COMPANY_EMAIL_DOMAIN} email`}
                                      </p>
                                }
                            </div>

                            {/* Password */}
                            <div>
                                <label htmlFor="password" style={labelStyle}>Password *</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password" name="password" required
                                        value={formData.password} onChange={handleChange}
                                        placeholder="Create a password"
                                        style={{ ...inputStyle(Boolean(passwordError)), paddingRight: '2.5rem' }}
                                        onFocus={e => { if (!passwordError) { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}}
                                        onBlur={e => { e.target.style.borderColor = passwordError ? '#fca5a5' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        style={{
                                            position: 'absolute', right: '0.75rem', top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#94a3b8', padding: 0, display: 'flex',
                                        }}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>

                                {/* Password strength indicators */}
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.45rem' }}>
                                    {[
                                        { met: pwLongEnough, label: '8+ characters' },
                                        { met: pwHasNums, label: '3+ numbers' },
                                    ].map(({ met, label }) => (
                                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: met ? '#16a34a' : '#94a3b8' }}>
                                            {met ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || Boolean(passwordError) || Boolean(emailError)}
                                style={{
                                    width: '100%', padding: '0.75rem',
                                    borderRadius: '10px', border: 'none',
                                    cursor: loading || passwordError || emailError ? 'not-allowed' : 'pointer',
                                    fontWeight: 600, fontSize: '0.9rem', color: '#fff',
                                    background: loading || passwordError || emailError
                                        ? '#94a3b8'
                                        : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                    boxShadow: loading || passwordError || emailError ? 'none' : '0 4px 14px rgba(22,163,74,0.3)',
                                    transition: 'all 0.2s',
                                    marginTop: '0.25rem',
                                }}
                                onMouseEnter={e => { if (!loading && !passwordError && !emailError) { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(22,163,74,0.4)'; }}}
                                onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; }}
                            >
                                {loading ? "Creating Account…" : "Create Account"}
                            </button>
                        </form>
                    </div>

                    {/* Sign in link */}
                    <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#64748b', marginTop: '1.25rem' }}>
                        Already have an account?{" "}
                        <Link to="/" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                            onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.target.style.textDecoration = 'none'}>
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
