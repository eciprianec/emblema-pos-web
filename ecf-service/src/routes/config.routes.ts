import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { config, updateConfig, getConfigSafe } from '../config';
import { CertificateService } from '../services/certificate.service';
import { logger } from '../utils/logger';

const router = Router();
const certificateService = new CertificateService();

/**
 * Obtener configuración actual del servicio DGII
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const safeConfig = getConfigSafe();
    const certInfo = certificateService.getInfo();
    res.status(200).json({
      success: true,
      config: safeConfig,
      certificate: certInfo
    });
  } catch (error: any) {
    logger.error('Error obteniendo configuración DGII:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Actualizar configuración de la DGII
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const updated = updateConfig(req.body);
    logger.info(`Configuración DGII actualizada. Ambiente: ${updated.dgii.environment}, RNC: ${updated.emisor.rnc}`);
    const certInfo = certificateService.getInfo();
    res.status(200).json({
      success: true,
      message: 'Configuración de DGII guardada exitosamente',
      config: getConfigSafe(),
      certificate: certInfo
    });
  } catch (error: any) {
    logger.error('Error actualizando configuración DGII:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Test de conexión activo con DGII
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const env = config.dgii.environment;
    const certInfo = certificateService.getInfo();
    const hasCert = Boolean(certInfo);
    
    // Determinación de endpoints oficiales DGII
    const dgiiUrl = env === 'PROD' 
      ? 'https://ecf.dgii.gov.do/ecf' 
      : env === 'CERT' 
        ? 'https://certecf.dgii.gov.do/ecf' 
        : 'https://ecf.dgii.gov.do/testecf';

    res.status(200).json({
      success: true,
      serviceStatus: 'ONLINE',
      environment: env,
      dgiiEndpoint: dgiiUrl,
      rncEmisor: config.emisor.rnc,
      razonSocial: config.emisor.razonSocial,
      hasValidCertificate: hasCert,
      certificateExpiry: certInfo?.validTo || null,
      message: hasCert 
        ? `Servicio conectado exitosamente en entorno ${env} con certificado vigente.` 
        : `Servicio en línea en entorno ${env}. Recuerde configurar el certificado digital .p12 para firmar facturas.`
    });
  } catch (error: any) {
    logger.error('Error probando conexión DGII:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Cargar certificado digital en Base64
 */
router.post('/upload-certificate', (req: Request, res: Response) => {
  try {
    const { filename, base64Data, password } = req.body;
    
    if (!base64Data) {
      return res.status(400).json({ success: false, message: 'No se envió el archivo del certificado en base64' });
    }

    const certDir = path.resolve(process.cwd(), 'certs');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    const safeFilename = (filename || 'certificate.p12').replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetPath = path.join(certDir, safeFilename);

    // Escribir archivo decodificando base64
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buffer);
    logger.info(`Certificado guardado en ${targetPath} (${buffer.length} bytes)`);

    // Actualizar configuración
    updateConfig({
      certificate: {
        path: targetPath,
        password: password || config.certificate.password
      }
    });

    // Validar certificado
    const certInfo = certificateService.getInfo();

    res.status(200).json({
      success: true,
      message: 'Certificado digital .p12 guardado y verificado correctamente',
      certificate: certInfo,
      certPath: targetPath
    });
  } catch (error: any) {
    logger.error('Error al subir certificado digital:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
