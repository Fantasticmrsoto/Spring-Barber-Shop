const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Las fotos se guardan en backend/uploads (fuera de src/) y se sirven en /uploads.
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const fileFilter = (req, file, cb) => {
  if (TIPOS_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Formato no permitido. Usa JPG, PNG, WEBP o GIF.'));
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `barbero-${req.params.id}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter
});

// Comprobantes de pago móvil: nombre propio para no mezclarlos con las fotos.
const storageComprobante = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `comprobante-${req.usuario?.usuarioID ?? 'anon'}-${Date.now()}${ext}`);
  }
});

const uploadComprobante = multer({
  storage: storageComprobante,
  limits: { fileSize: MAX_BYTES },
  fileFilter
});

// Traduce los errores de multer a una respuesta JSON 400 clara.
const mensajeMulter = (error) =>
  error.code === 'LIMIT_FILE_SIZE'
    ? 'La imagen supera el máximo de 5 MB.'
    : error.message || 'No se pudo procesar la imagen.';

// Envuelve upload.single y traduce sus errores a una respuesta JSON 400 clara.
const subirUnaImagen = (campo) => (req, res, next) => {
  upload.single(campo)(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({ ok: false, message: mensajeMulter(error) });
  });
};

const subirComprobante = (campo = 'comprobante') => (req, res, next) => {
  uploadComprobante.single(campo)(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({ ok: false, message: mensajeMulter(error) });
  });
};

module.exports = { upload, subirUnaImagen, subirComprobante, uploadsDir };
