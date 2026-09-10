export const DEFAULT_STUDENT_PHOTO = '/default-student-photo.svg';

/**
 * Determina si la URL proporcionada es una fotografía real del estudiante
 * y no un avatar prediseñado / cartoon (ej: dicebear) ni un valor nulo o vacío.
 */
export const isValidStudentPhoto = (url) => {
    if (!url || typeof url !== 'string') return false;
    const cleanUrl = url.trim();
    if (!cleanUrl) return false;
    if (cleanUrl.includes('dicebear.com')) return false;
    if (cleanUrl.includes('avataaars')) return false;
    if (cleanUrl === 'null' || cleanUrl === 'undefined') return false;
    return true;
};

/**
 * Retorna la URL de la fotografía real del estudiante si existe,
 * o la imagen indicadora estándar de foto pendiente ("/default-student-photo.svg").
 */
export const getStudentPhoto = (url) => {
    return isValidStudentPhoto(url) ? url : DEFAULT_STUDENT_PHOTO;
};
