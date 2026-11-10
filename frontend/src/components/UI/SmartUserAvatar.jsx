import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../utils/apiBase';

export const avatarPalettes = [
    { bg: 'bg-gradient-to-br from-blue-600 to-indigo-600', ring: 'ring-blue-100', text: 'text-white' },
    { bg: 'bg-gradient-to-br from-sky-500 to-blue-600', ring: 'ring-sky-100', text: 'text-white' },
    { bg: 'bg-gradient-to-br from-blue-500 to-cyan-600', ring: 'ring-cyan-100', text: 'text-white' },
    { bg: 'bg-gradient-to-br from-cyan-600 to-blue-700', ring: 'ring-blue-100', text: 'text-white' },
    { bg: 'bg-gradient-to-br from-blue-600 to-sky-600', ring: 'ring-sky-100', text: 'text-white' },
    { bg: 'bg-gradient-to-br from-slate-600 to-blue-600', ring: 'ring-slate-100', text: 'text-white' },
];

export function getAvatarStyle(identifier = '') {
    let key = '';
    if (typeof identifier === 'object' && identifier !== null) {
        key = String(
            identifier.userid || 
            identifier.id || 
            identifier.headid || 
            identifier.Email || 
            identifier.email || 
            identifier.FullName || 
            identifier.full_name || 
            `${identifier.firstname || identifier.firstname || ''} ${identifier.lastname || identifier.lastname || ''}`.trim() || 
            ''
        ).toLowerCase().trim();
    } else {
        key = String(identifier || '').toLowerCase().trim();
    }
    
    // Normalize middle initials and punctuation (e.g. "VJ a. Javellana" vs "VJ Javellana") for consistent color across pages
    const cleanKey = key.replace(/\b[a-z]\.\s+/g, '').replace(/[^a-z0-9]/g, '');

    let hash = 0;
    const target = cleanKey || key || 'user';
    for (let i = 0; i < target.length; i++) {
        hash = target.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarPalettes[Math.abs(hash) % avatarPalettes.length];
}

export function getInitials(firstname = '', lastname = '', fullName = '') {
    const fn = (firstname || '').trim();
    const ln = (lastname || '').trim();
    if (fn && ln) {
        return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();
    }
    const combined = (fullName || fn || '').trim();
    if (combined) {
        const parts = combined.split(/\s+/).filter(Boolean);
        if (parts.length > 1) {
            return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
        }
        return combined.slice(0, 2).toUpperCase();
    }
    return 'U';
}

const SUPABASE_PROFILE_STORAGE = (import.meta.env.VITE_SUPABASE_PROFILE_STORAGE || '').replace(/\/$/, '');

export default function SmartUserAvatar({
    user,
    src,
    name,
    fullName: explicitFullName,
    initials: explicitInitials,
    size = 'h-8 w-8',
    textSize = 'text-[11px]',
    ring = '',
    shape = 'rounded-full',
    className = '',
    title = '',
    onClick,
}) {
    const [imgFailed, setImgFailed] = useState(false);
    const [triedSupabaseFallback, setTriedSupabaseFallback] = useState(false);

    const firstname = user?.firstname || user?.firstname || '';
    const lastname = user?.lastname || user?.lastname || '';
    const resolvedFullName = explicitFullName || name || user?.full_name || user?.FullName || user?.name || `${firstname} ${lastname}`.trim() || firstname || user?.Email || 'User';
    const initials = explicitInitials || getInitials(firstname, lastname, resolvedFullName);
    const style = getAvatarStyle(user || resolvedFullName);
    const tooltip = title || resolvedFullName;

    const rawPic = src !== undefined
        ? src
        : (user?.profilepic || user?.profilepic || user?.avatar || user?.TempPreview || user?.profilepic || user?.head_profile_pic);

    // Reset error when source changes
    useEffect(() => {
        setImgFailed(false);
        setTriedSupabaseFallback(false);
    }, [rawPic]);

    const resolvedPicUrl = (() => {
        if (!rawPic || rawPic === '/default-avatar.png') return null;
        if (typeof rawPic !== 'string') return null;

        if (triedSupabaseFallback && SUPABASE_PROFILE_STORAGE) {
            const filename = rawPic.split('/').pop().split('?')[0];
            return `${SUPABASE_PROFILE_STORAGE}/${filename}`;
        }

        if (rawPic.startsWith('http') || rawPic.startsWith('data:') || rawPic.startsWith('blob:')) {
            return rawPic;
        }

        const cleanName = rawPic.replace(/^\/?(api\/)?uploads\/profile-pics\//, '').replace(/^\//, '');
        // If clean filename follows standard profile picture naming, prefer direct Supabase permanent storage when configured
        if (SUPABASE_PROFILE_STORAGE && (cleanName.toLowerCase().startsWith('profilepic-') || cleanName.toLowerCase().startsWith('profilepic'))) {
            return `${SUPABASE_PROFILE_STORAGE}/${cleanName}`;
        }

        if (rawPic.startsWith('/uploads')) {
            return `${API_BASE_URL}${rawPic}`;
        }
        return `${API_BASE_URL}/uploads/profile-pics/${cleanName || rawPic}`;
    })();

    const handleImageError = () => {
        if (SUPABASE_PROFILE_STORAGE && !triedSupabaseFallback && typeof rawPic === 'string' && (rawPic.toLowerCase().includes('profilepic') || rawPic.includes('/uploads/profile-pics/'))) {
            setTriedSupabaseFallback(true);
        } else {
            setImgFailed(true);
        }
    };

    if (resolvedPicUrl && !imgFailed) {
        return (
            <img
                src={resolvedPicUrl}
                alt={resolvedFullName}
                title={tooltip}
                onClick={onClick}
                className={`${size} shrink-0 ${shape} object-cover shadow-2xs ${ring} ${className}`}
                onError={handleImageError}
            />
        );
    }

    return (
        <div
            title={tooltip}
            onClick={onClick}
            className={`${size} shrink-0 ${shape} flex items-center justify-center font-bold text-white ${textSize} shadow-2xs select-none ${style.bg} ${ring} ${className}`}
        >
            {initials}
        </div>
    );
}
