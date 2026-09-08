import type { RequestHandler } from 'express';
import multer from 'multer';
import { getSessionUser } from '../auth/auth.service.js';
import { photoIdParamsSchema } from './photos.schema.js';
import {
	InvalidFrameError,
	InvalidImageError,
	MAX_UPLOAD_BYTES,
	PhotoNotFoundError,
	createPhoto,
	deletePhoto,
	getPhotoUrl,
	listUserPhotos,
} from './photos.service.js';

declare global {
	namespace Express {
		interface Request {
			currentUser?: { id: string; email: string; username: string };
		}
	}
}

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_UPLOAD_BYTES },
});

export const requireUser: RequestHandler = async (req, res, next) => {
	const user = await getSessionUser(req.headers);
	if (!user) {
		res.status(401).json({ detail: 'Not authenticated' });
		return;
	}
	req.currentUser = user;
	next();
};

export const uploadPhoto: RequestHandler = async (req, res, next) => {
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
};

export const listPhotos: RequestHandler = async (req, res, next) => {
	if (!req.currentUser) return;
	try {
		const photos = await listUserPhotos(req.currentUser.id);
		return res.json(photos);
	} catch (error) {
		next(error);
	}
};

export const getPhotoUrlHandler: RequestHandler = async (req, res, next) => {
	if (!req.currentUser) return;
	const parsed = photoIdParamsSchema.safeParse(req.params);
	if (!parsed.success) {
		return res.status(404).json({ detail: 'Photo not found' });
	}
	try {
		const url = await getPhotoUrl(req.currentUser.id, parsed.data.id);
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
};

export const deletePhotoHandler: RequestHandler = async (req, res, next) => {
	if (!req.currentUser) return;
	const parsed = photoIdParamsSchema.safeParse(req.params);
	if (!parsed.success) {
		return res.status(404).json({ detail: 'Photo not found' });
	}
	try {
		await deletePhoto({ userId: req.currentUser.id, photoId: parsed.data.id });
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
};