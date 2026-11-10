import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import logo from "../assets/images/lccb_logo.png";
import auditrackLogo from "../assets/images/logo.png";
import { API_BASE_URL } from '../utils/apiBase';

export default function Otp() {
    const navigate = useNavigate();
    const location = useLocation();
    const registrationData = location.state || {};
    const email = registrationData.email || "";
    const [otp, setOtp] = useState("");
    const [message, setMessage] = useState("Enter the one-time PIN sent to your email.");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const didSendRef = useRef(false);

    const sendOtp = async () => {
        if (!email) {
            setError("Registration email is missing. Please go back and register again.");
            return;
        }

        setSending(true);
        setError("");

        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/user/send-registration-otp`,
                {
                    ...registrationData,
                    email,
                },
                { timeout: 20000 }
            );

            setMessage(response.data.message || "We sent a one-time PIN to your email.");
        } catch (err) {
            const isTimeout = err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout");
            setError(
                err.response?.data?.message ||
                (isTimeout
                    ? "Request timed out while sending OTP. Please click Resend OTP."
                    : "Failed to send one-time PIN.")
            );
        } finally {
            setSending(false);
        }
    };

    useEffect(() => {
        if (!email || didSendRef.current) return;
        didSendRef.current = true;
        sendOtp();
    }, [email]);

    const handleVerify = async (e) => {
        e.preventDefault();

        if (!email) {
            setError("Registration email is missing. Please go back and register again.");
            return;
        }

        if (otp.length !== 6) {
            setError("Enter the 6-digit one-time PIN.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await axios.post(`${API_BASE_URL}/api/user/verify-registration-otp`, {
                email,
                otp,
            });

            if (response.data.success) {
                navigate("/login", {
                    replace: true,
                    state: {
                        message: response.data.message || "Email verified. Your account is pending approval.",
                    },
                });
                return;
            }

            setError(response.data.message || "Wrong one-time PIN. Please try again.");
        } catch (err) {
            setError(err.response?.data?.message || "Wrong one-time PIN. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full overflow-hidden bg-white">
            <div className="w-full flex items-center justify-center bg-white">
                <div className="w-full max-w-md px-8 animate-fade-in-right">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center gap-2.5 mb-3">
                            <img src={auditrackLogo} alt="Auditrack Logo" className="w-11 h-11 object-contain" />
                            <span className="text-2xl font-bold text-slate-900 tracking-tight">Auditrack</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify OTP</h1>
                        <p className="text-gray-600">
                            {email ? `Enter the code sent to ${email}` : "Please register first to receive a one-time PIN"}
                        </p>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-4">
                        {message && (
                            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-sm">
                                {message}
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm animate-shake">
                                {error}
                            </div>
                        )}

                        <input
                            type="text"
                            inputMode="numeric"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                            placeholder="000000"
                            disabled={!email || loading}
                        />

                        <button
                            type="submit"
                            disabled={!email || loading || otp.length !== 6}
                            className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
                                !email || loading || otp.length !== 6
                                    ? "bg-blue-300 cursor-not-allowed text-white"
                                    : "bg-blue-600 hover:bg-blue-700 text-white"
                            }`}
                        >
                            {loading ? "Verifying..." : "Verify OTP"}
                        </button>

                        <button
                            type="button"
                            onClick={sendOtp}
                            disabled={!email || sending}
                            className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-500 disabled:text-gray-400"
                        >
                            {sending ? "Sending..." : "Resend OTP"}
                        </button>

                        <p className="text-center text-sm text-gray-600">
                            Wrong email?{" "}
                            <Link to="/register" className="text-blue-600 hover:text-blue-500 font-medium">
                                Register again
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
