import { Router, Request, Response } from 'express';
import { CertificateService } from '../services/certificate.service';
import { logger } from '../utils/logger';

const router = Router();
const certificateService = new CertificateService();

router.get('/info', (req: Request, res: Response) => {
  try {
    const info = certificateService.getInfo();
    if (info) {
      res.status(200).json({ success: true, data: info });
    } else {
      res.status(400).json({ success: false, message: 'No se pudo leer el certificado' });
    }
  } catch (error: any) {
    logger.error('Error en GET /info', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/upload', (req: Request, res: Response) => {
  // Aquí se manejaría multipart/form-data (p.ej. usando multer)
  res.status(501).json({ success: false, message: 'Not implemented yet. Use multer for file uploads.' });
});

export default router;
