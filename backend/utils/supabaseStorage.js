const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function uploadToSupabaseBucket(fileSource, filename, mimeType, bucket = 'proof-documents') {
  const currentUrl = process.env.SUPABASE_URL;
  const currentKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!currentUrl || !currentKey) {
    throw new Error('Supabase Storage key missing in backend/.env! Please add SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const client = createClient(currentUrl, currentKey);

  // 2. Read buffer
  let fileBuffer;
  if (Buffer.isBuffer(fileSource)) {
    fileBuffer = fileSource;
  } else if (typeof fileSource === 'string' && fs.existsSync(fileSource)) {
    fileBuffer = fs.readFileSync(fileSource);
  } else {
    throw new Error('Invalid file source for Supabase upload');
  }

  // 3. Upload
  const cleanPath = filename.replace(/^\//, '');
  const { data, error } = await client.storage.from(bucket).upload(cleanPath, fileBuffer, {
    contentType: mimeType || 'application/octet-stream',
    upsert: true
  });

  if (error) {
    console.error('Supabase Storage upload error:', error);
    throw error;
  }

  // 4. Get public URL
  const { data: urlData } = client.storage.from(bucket).getPublicUrl(cleanPath);
  const publicBaseUrl = (process.env.SUPABASE_PUBLIC_URL || currentUrl || '').replace(/\/$/, '');
  const internalBaseUrl = (currentUrl || '').replace(/\/$/, '');
  const publicUrl = (publicBaseUrl && internalBaseUrl && urlData.publicUrl)
    ? urlData.publicUrl.replace(internalBaseUrl, publicBaseUrl)
    : urlData.publicUrl;

  return {
    success: true,
    path: cleanPath,
    publicUrl: publicUrl
  };
}

/**
 * Deletes a file from Supabase Storage Bucket.
 */
async function deleteFromSupabaseBucket(filepath, bucket = 'proof-documents') {
  const currentUrl = process.env.SUPABASE_URL;
  const currentKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!currentUrl || !currentKey || !filepath) return;
  const client = createClient(currentUrl, currentKey);
  const cleanPath = String(filepath)
    .split('?')[0]
    .replace(/^\//, '')
    .replace(/^.*\/storage\/v1\/object\/public\/[^\/]+\//, '')
    .replace(/^uploads\/profile-pics\//, '');
  if (!cleanPath) return;
  try {
    await client.storage.from(bucket).remove([cleanPath]);
  } catch (err) {
    console.warn('Supabase Storage delete warning:', err.message);
  }
}

/**
 * Deletes an old profile picture from both local disk (uploads/profile-pics)
 * and the Supabase 'profile-pics' storage bucket.
 */
async function deleteProfilePicFile(oldProfilePic) {
  if (!oldProfilePic || typeof oldProfilePic !== 'string') return;
  const cleanName = path.basename(oldProfilePic.split('?')[0].trim());
  if (!cleanName || cleanName === 'null' || cleanName === 'undefined') return;

  const localPath = path.join(__dirname, '..', 'uploads', 'profile-pics', cleanName);
  try {
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch (fsErr) {
    console.warn('Local profile pic delete warning:', fsErr.message);
  }

  await deleteFromSupabaseBucket(cleanName, 'profile-pics');
}

module.exports = {
  uploadToSupabaseBucket,
  deleteFromSupabaseBucket,
  deleteProfilePicFile
};
