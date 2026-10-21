/*
 * Configuración de las subidas de archivos (multer).
 *
 * Se usa para dos cosas: el comprobante de un pago móvil y la foto de un
 * barbero. Los dos archivos se guardan en `backend/uploads` y se sirven como
 * estáticos desde `/uploads`, que es la ruta que guarda la base de datos.
 *
 * El nombre del archivo lo genera `crypto.randomUUID()`: si se usara el
 * nombre que envía el cliente, dos personas podrían subir archivos con el
 * mismo nombre y uno pisaría al otro.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const CARPETA = path.resolve(__dirname, '../../uploads');

// Si la carpeta no existe, multer falla al escribir. Se crea al arrancar.
fs.mkdirSync(CARPETA, { recursive: true });

const TIPOS_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CARPETA),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase().slice(0, 10);
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const subirArchivo = multer({
  storage: almacenamiento,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      return cb(new Error('El archivo debe ser una imagen (JPG, PNG, WEBP o GIF)'));
    }
    cb(null, true);
  },
});

/**
 * Ruta pública de un archivo subido.
 * @param {string} nombreArchivo
 * @returns {string} por ejemplo "/uploads/9f8c....jpg"
 */
const rutaPublica = (nombreArchivo) => `/uploads/${nombreArchivo}`;

module.exports = { subirArchivo, rutaPublica, CARPETA };
