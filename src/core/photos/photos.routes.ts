import { Router } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from './photos.service.js';
import { requireUser, uploadPhoto, listPhotos, getPhotoUrlHandler, deletePhotoHandler } from './photos.controller.js';

export const photoRoutes = Router();

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_UPLOAD_BYTES },
});

photoRoutes.use(requireUser);
photoRoutes.post('/', (req, res, next) => {
	upload.single('file')(req, res, (err) => {
		if (err instanceof multer.MulterError) {
			return res.status(422).json({ detail: err.message });
		}
		if (err) return next(err);
		return next();
	});
}, uploadPhoto);
photoRoutes.get('/', listPhotos);
photoRoutes.get('/:id/url', getPhotoUrlHandler);
photoRoutes.delete('/:id', deletePhotoHandler);