export function fileNameFromUrl(url) {
    try {
        const path = new URL(String(url)).pathname;
        const base = path.split('/').pop() || '';
        return decodeURIComponent(base) || 'download';
    } catch {
        const s = String(url || '');
        const part = s.split('?')[0].split('#')[0];
        return part.split('/').pop() || 'download';
    }
}

export async function downloadFileFromUrl(fileUrl, filename) {
    if (!fileUrl) throw new Error('No file URL');

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(fileUrl, { headers });
    if (!res.ok) throw new Error('Failed to download file');

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || fileNameFromUrl(fileUrl);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 2000);
}
