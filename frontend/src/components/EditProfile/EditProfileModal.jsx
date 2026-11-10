import React, { useEffect, useState, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { usersAPI } from "../../utils/api";
import ImageCropModal from "./ImageCropModal";
import SmartUserAvatar from "../UI/SmartUserAvatar";

const EditProfileModal = ({ user, isOpen, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        firstname: "",
        middleinitial: "",
        lastname: "",
        profilepic: null
    });
    const [profilePicPreview, setProfilePicPreview] = useState("");
    const [rawImageForCrop, setRawImageForCrop] = useState("");
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (user) {
            setFormData({
                firstname: user.firstname || "",
                middleinitial: user.middleinitial || "",
                lastname: user.lastname || "",
                profilepic: null
            });
            // If profilepic exists, use /uploads/profile-pics/filename, else null
            setProfilePicPreview(user.profilepic ? `/uploads/profile-pics/${user.profilepic}` : null);
            setRawImageForCrop("");
            setIsCropModalOpen(false);
        }
    }, [user]);

    if (!isOpen) return null;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setRawImageForCrop(objectUrl);
            setIsCropModalOpen(true);
        }
        e.target.value = '';
    };

    const handleCropComplete = (croppedFile, finalPreview) => {
        setFormData(prev => ({ ...prev, profilepic: croppedFile }));
        setProfilePicPreview(finalPreview);
        setIsCropModalOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const formDataObj = new FormData();
            formDataObj.append('firstname', formData.firstname);
            formDataObj.append('middleinitial', formData.middleinitial || '');
            formDataObj.append('lastname', formData.lastname);

            if (formData.profilepic instanceof File) {
                formDataObj.append('profilepic', formData.profilepic);
            }

            const response = await usersAPI.updateUser(user.userid, formDataObj);
            if (response.success) {
                // If a new profile pic was uploaded, use the new path from backend
                if (response.user && response.user.profilepic) {
                    setProfilePicPreview(`/uploads/profile-pics/${response.user.profilepic}`);
                }
                onUpdate(response.user);
                // Emit a custom event to trigger navbar refresh
                window.dispatchEvent(new Event('profileUpdated'));
                onClose();
            } else {
                console.error("Update failed:", response.message);
            }
        } catch (error) {
            console.error("Update error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[50] p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Edit Profile</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Manage your personal details and avatar</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* First Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">First Name *</label>
                        <input
                            type="text"
                            name="firstname"
                            value={formData.firstname}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Middle Initial */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Middle Initial</label>
                        <input
                            type="text"
                            name="middleinitial"
                            value={formData.middleinitial}
                            onChange={handleInputChange}
                            maxLength={1}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Last Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Last Name *</label>
                        <input
                            type="text"
                            name="lastname"
                            value={formData.lastname}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Profile Picture */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Profile Picture</label>
                        <div className="flex items-start gap-3">
                            <div className="shrink-0 -mt-0.5">
                                <SmartUserAvatar
                                    user={user}
                                    src={profilePicPreview}
                                    fullName={`${formData.firstname} ${formData.lastname}`.trim() || user?.full_name || 'User'}
                                    size="w-12 h-12"
                                    textSize="text-sm font-bold"
                                    ring="border border-slate-200 shadow-2xs"
                                />
                            </div>

                            <div className="flex-1">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                                    disabled={isSubmitting}
                                />
                                <div className="flex items-center justify-between mt-1.5">
                                    <p className="text-[11px] text-slate-400">Upload an image file (JPG, PNG)</p>
                                    {rawImageForCrop && (
                                        <button
                                            type="button"
                                            onClick={() => setIsCropModalOpen(true)}
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                                        >
                                            <span>Crop / Adjust</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSubmitting && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>

            {/* Image Crop Modal */}
            <ImageCropModal
                isOpen={isCropModalOpen}
                imageSrc={rawImageForCrop}
                onClose={() => setIsCropModalOpen(false)}
                onCropComplete={handleCropComplete}
            />
        </div>
    );
};

export default EditProfileModal;

