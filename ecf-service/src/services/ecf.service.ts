import { P12Reader, Signature, ECF, ENVIRONMENT, getCodeSixDigitfromSignature } from 'dgii-ecf';
import { InvoiceRequest, ECFResponse, CertificateInfo } from '../types';
import { XMLBuilderService } from './xml-builder.service';
import { config } from '../config';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class EcfService {
  private xmlBuilder: XMLBuilderService;
  private cachedToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    this.xmlBuilder = new XMLBuilderService();
  }

  /**
   * Obtiene la ruta absoluta y segura del certificado
   */
  private getResolvedCertPath(): string {
    const certPath = config.certificate.path;
    return path.isAbsolute(certPath) ? certPath : path.resolve(process.cwd(), certPath);
  }

  /**
   * Carga el par de llaves criptográficas desde el archivo .p12
   */
  private loadP12KeyData(): any {
    const resolvedPath = this.getResolvedCertPath();
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Certificado no encontrado en: ${resolvedPath}`);
    }
    const reader = new (P12Reader as any)(config.certificate.password);
    return reader.getKeyFromFile(resolvedPath);
  }

  /**
   * Obtiene y cachea el token de autenticación de DGII.
   */
  private async getAuthToken(p12Data: any, env: ENVIRONMENT): Promise<string> {
    const now = new Date();
    
    // Validar caché (expira en aprox 1 hora, margen de 5 min)
    if (this.cachedToken && this.tokenExpiresAt && now.getTime() < this.tokenExpiresAt.getTime() - 300000) {
      logger.debug('Usando token de autenticación DGII desde la caché');
      return this.cachedToken;
    }

    logger.info('Solicitando nuevo token de autenticación a DGII');
    const authEcf = new (ECF as any)(p12Data, env);
    const authResult = await authEcf.authenticate();
    
    const token = typeof authResult === 'string' ? authResult : authResult?.token;
    if (!token) {
      throw new Error('No se pudo obtener el token de autenticación de DGII');
    }

    this.cachedToken = token;
    this.tokenExpiresAt = new Date(now.getTime() + 55 * 60 * 1000);
    return token;
  }

  private getDgiiEnvironment(envStr?: string): ENVIRONMENT {
    const clean = (envStr || config.dgii.environment || 'DEV').toUpperCase();
    if (clean === 'CERT') return ENVIRONMENT.CERT;
    if (clean === 'PROD') return ENVIRONMENT.PROD;
    return ENVIRONMENT.DEV;
  }

  /**
   * Genera el XML estructurado y lo firma digitalmente si existe el certificado
   */
  public generateXmlOnly(request: InvoiceRequest): { xml: string; securityCode?: string; isSigned: boolean } {
    const xmlString = this.xmlBuilder.buildECF(request);
    
    const resolvedPath = this.getResolvedCertPath();
    if (fs.existsSync(resolvedPath)) {
      try {
        const p12Data = this.loadP12KeyData();
        if (p12Data.key && p12Data.cert) {
          const signature = new (Signature as any)(p12Data.key, p12Data.cert);
          const signedXml = signature.signXml(xmlString, 'ECF');
          let secCode = undefined;
          try {
            secCode = (getCodeSixDigitfromSignature as any)(signedXml);
          } catch (_) {}
          return { xml: signedXml, securityCode: secCode, isSigned: true };
        }
      } catch (err) {
        logger.warn('Aviso: No se pudo firmar con certificado local, retornando XML crudo:', err);
      }
    }

    return { xml: xmlString, isSigned: false };
  }

  /**
   * Procesa, firma y envía un e-CF a la DGII
   * @param request Datos de la factura
   */
  public async sendECF(request: InvoiceRequest): Promise<ECFResponse> {
    let xmlString = '';
    let signedXml = '';
    let securityCode = '';

    try {
      // 1. Construir XML
      xmlString = this.xmlBuilder.buildECF(request);
      logger.debug(`XML generado correctamente para eNCF: ${request.encf}`);

      // 2. Cargar certificado y firmar
      const p12Data = this.loadP12KeyData();
      if (!p12Data.key || !p12Data.cert) {
        throw new Error('El archivo de certificado no contiene una clave privada y certificado válidos');
      }

      // 3. Firmar XML
      const signature = new (Signature as any)(p12Data.key, p12Data.cert);
      signedXml = signature.signXml(xmlString, 'ECF');
      try {
        securityCode = (getCodeSixDigitfromSignature as any)(signedXml);
      } catch (_) {}
      logger.debug(`XML firmado correctamente. Código de seguridad: ${securityCode}`);

      // 4. Autenticación y envío
      const env = this.getDgiiEnvironment();
      const token = await this.getAuthToken(p12Data, env);
      const ecfClient = new (ECF as any)(p12Data, env);
      
      const fileName = `${config.emisor.rnc}${request.encf}.xml`;
      logger.info(`Enviando factura ${request.encf} a DGII (Ambiente: ${env}, Archivo: ${fileName})...`);

      const response = await ecfClient.sendElectronicDocument(signedXml, fileName);

      // 5. Evaluar respuesta
      if (response && response.trackId) {
        logger.info(`Envío exitoso a DGII. TrackId: ${response.trackId}, SecurityCode: ${securityCode}`);
        return {
          success: true,
          trackId: response.trackId,
          codigoSeguridad: securityCode,
          securityCode: securityCode,
          xml: signedXml
        };
      } else {
        logger.warn('Respuesta de DGII sin trackId:', response);
        return {
          success: false,
          error: (response as any)?.mensaje || 'Respuesta de envío DGII sin trackId',
          codigoSeguridad: securityCode,
          securityCode: securityCode,
          xml: signedXml
        };
      }
    } catch (error: any) {
      logger.error('Error al enviar ECF a DGII:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al enviar el e-CF',
        codigoSeguridad: securityCode || undefined,
        securityCode: securityCode || undefined,
        xml: signedXml || xmlString
      };
    }
  }

  /**
   * Consulta el estado de un e-CF a través de su trackId
   * @param trackId ID de rastreo DGII
   */
  public async checkStatus(trackId: string): Promise<any> {
    try {
      const p12Data = this.loadP12KeyData();
      const env = this.getDgiiEnvironment();
      const token = await this.getAuthToken(p12Data, env);
      const ecfClient = new (ECF as any)(p12Data, env);
      
      const status = await ecfClient.statusTrackId(trackId, token);
      logger.info(`Estado consultado para trackId ${trackId}:`, status);
      return status;
    } catch (error: any) {
      logger.error(`Error consultando estado del trackId ${trackId}:`, error);
      throw error;
    }
  }

  /**
   * Extrae la metadata del certificado digital actual
   */
  public getCertificateInfo(): CertificateInfo {
    const resolvedPath = this.getResolvedCertPath();
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Certificado no encontrado en: ${resolvedPath}`);
    }
    const reader = new (P12Reader as any)(config.certificate.password);
    return reader.getCertificateInfo(resolvedPath);
  }
}
