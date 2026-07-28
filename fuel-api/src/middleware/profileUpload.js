import path from 'path';
import { createUploadKind } from './uploadCommon.js';

const UPLOAD_DIR = process.env.PROFILE_UPLOAD_DIR || path.join(process.cwd(), 'data', 'profile-avatars');

const kind = createUploadKind({ uploadDir: UPLOAD_DIR, fileTypeLabel: 'avatar' });

export const getProfileUploadDir = kind.getUploadDir;
export const ensureProfileUploadDir = kind.ensureUploadDir;
export const profileUpload = kind.upload;
export const resolveStoredProfilePath = kind.resolveStoredPath;

export function buildProfileAvatarPath(fileId) {
  return `/api/me/avatar/${encodeURIComponent(fileId)}`;
}
