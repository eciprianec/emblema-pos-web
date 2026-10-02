import { P12Reader } from 'dgii-ecf';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { CertificateInfo } from '../types';
import { logger } from '../utils/logger';

export class CertificateService {
  /**
   * Lee la información real del certificado digital configurado
   * @returns Metadatos del certificado
   */
  public getInfo(): CertificateInfo | null {
    try {
      const certPath = config.certificate.path;
      const resolvedPath = path.isAbsolute(certPath) ? certPath : path.resolve(process.cwd(), certPath);
      
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`El archivo del certificado no existe en: ${resolvedPath}`);
      }

      const reader = new (P12Reader as any)(config.certificate.password);
      const certInfo = reader.getCertificateInfo(resolvedPath);
      
      logger.info('Certificado digital leído correctamente:', certInfo.subject);

      return {
        subject: certInfo.subject || 'Certificado DGII',
        issuer: certInfo.issuer || 'DGII CA',
        validFrom: certInfo.validFrom ? new Date(certInfo.validFrom) : new Date(),
        validTo: certInfo.validTo ? new Date(certInfo.validTo) : new Date(),
        serialNumber: certInfo.serialNumber || '1234567890'
      };
    } catch (error: any) {
      logger.error('Error leyendo el certificado digital:', error);
      return null;
    }
  }
}
