import { Router, Request, Response } from 'express';
import { EcfService } from '../services/ecf.service';
import { logger } from '../utils/logger';

const router = Router();
const ecfService = new EcfService();

// Recibir factura, generar XML, firmar y enviar a DGII
router.post('/send', async (req: Request, res: Response) => {
  try {
    const invoiceData = req.body;
    logger.info(`Recibida petición de envío para eNCF: ${invoiceData.encf}`);
    
    const result = await ecfService.sendECF(invoiceData);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    logger.error('Error no manejado en POST /send', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint exclusivo para generar e inspeccionar XML (con firma digital si hay cert)
router.post('/generate-xml', async (req: Request, res: Response) => {
  try {
    const invoiceData = req.body;
    logger.info(`Generando XML de prueba/inspección para eNCF: ${invoiceData.encf}`);
    
    const result = ecfService.generateXmlOnly(invoiceData);
    res.status(200).json({
      success: true,
      encf: invoiceData.encf,
      xml: result.xml,
      securityCode: result.securityCode,
      isSigned: result.isSigned
    });
  } catch (error: any) {
    logger.error('Error en POST /generate-xml', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Consultar estado de trackId
router.get('/status/:trackId', async (req: Request, res: Response) => {
  try {
    const trackId = req.params.trackId;
    logger.info(`Recibida petición de status para trackId: ${trackId}`);
    
    const status = await ecfService.checkStatus(trackId);
    res.status(200).json(status);
  } catch (error: any) {
    logger.error('Error no manejado en GET /status/:trackId', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Anulación
router.post('/void', async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
});

// Envío de resumen RFCE
router.post('/summary', async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
});

// Directorio de contribuyentes
router.get('/directory/:rnc', async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
});

export default router;
