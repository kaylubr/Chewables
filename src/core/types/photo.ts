export interface PhotoModel {
	id: string;
	userId: string;
	frame: string;
	storageKey: string;
	createdAt: Date;
}

export interface CreatePhotoInput {
	userId: string;
	frame: string;
	imageBytes: Uint8Array;
	contentType: string;
}