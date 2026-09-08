/**
 * Photo HTTP layer: thin route handlers that validate input, enforce
 * ownership, and delegate to the photo service. No DB or storage internals.
 */
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { getSessionUser } from '../auth/auth.service.js';
import {
	InvalidFrameError,
	InvalidImageError,
	MAX_UPLOAD_BYTES,
	PhotoNotFoundError,
	createPhoto,
	deletePhoto,
	getOwnedPhoto,
	listUserPhotos,
} from './photos.service.js';
import { storage } from '../../adapters/storage/storage.js';

export const photoRoutes = Router();

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_UPLOAD_BYTES },
});

const requireUser: RequestHandler = async (req, res, next) => {
	const user = await getSessionUser(req.headers);
	if (!user) {
		res.status(401).json({ detail: 'Not authenticated' });
		return;
	}
	req.currentUser = user;
	next();
};

declare global {
	namespace Express {
		interface Request {
			currentUser?: { id: string; email: string; username: string };
		}
	}
}

/** POST /api/photos — save a composed image as a photo for the user. */
photoRoutes.post(
	'/',
	requireUser,
	(req, res, next) => {
		upload.single('file')(req, res, (err) => {
			if (err instanceof multer.MulterError) {
				// e.g. LIMIT_FILE_SIZE (oversized upload) → 422 like the old API.
				return res.status(422).json({ detail: err.message });
			}
			if (err) return next(err);
			return next();
		});
	},
	async (req, res, next) => {
		if (!req.currentUser) return;
		const frame = typeof req.body.frame === 'string' ? req.body.frame : '';
		try {
			const photo = await createPhoto({
				userId: req.currentUser.id,
				frame,
				imageBytes: req.file?.buffer ?? new Uint8Array(0),
				contentType: req.file?.mimetype ?? '',
			});
			return res.status(201).json(photo);
		} catch (error) {
			if (error instanceof InvalidFrameError || error instanceof InvalidImageError) {
				return res
					.status(422)
					.json({ detail: error instanceof InvalidFrameError ? `Unsupported frame identifier: ${frame}` : error.message });
			}
			if ((error as Error).name === 'StorageError') {
				return res.status(503).json({ detail: 'Could not store the image; please try again' });
			}
			next(error);
		}
	},
);

/** GET /api/photos — list the current user's photos. */
photoRoutes.get('/', requireUser, async (req, res, next) => {
	if (!req.currentUser) return;
	try {
		const photos = await listUserPhotos(req.currentUser.id);
		return res.json(photos);
	} catch (error) {
		next(error);
	}
});

/** GET /api/photos/:id/url — short-lived object URL after verifying ownership. */
photoRoutes.get('/:id/url', requireUser, async (req, res, next) => {
	if (!req.currentUser) return;
	try {
		const photo = await getOwnedPhoto(req.currentUser.id, String(req.params.id));
		const url = await storage.url(photo.storageKey);
		return res.json({ url });
	} catch (error) {
		if (error instanceof PhotoNotFoundError) {
			return res.status(404).json({ detail: 'Photo not found' });
		}
		if ((error as Error).name === 'StorageError') {
			return res.status(503).json({ detail: 'Could not retrieve the image; please try again' });
		}
		next(error);
	}
});

/** DELETE /api/photos/:id — delete the photo after verifying ownership. */
photoRoutes.delete('/:id', requireUser, async (req, res, next) => {
	if (!req.currentUser) return;
	try {
		await deletePhoto({ userId: req.currentUser.id, photoId: String(req.params.id) });
		return res.status(204).end();
	} catch (error) {
		if (error instanceof PhotoNotFoundError) {
			return res.status(404).json({ detail: 'Photo not found' });
		}
		if ((error as Error).name === 'StorageError') {
			return res.status(503).json({ detail: 'Could not delete the image; please try again' });
		}
		next(error);
	}
});