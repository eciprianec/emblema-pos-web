import { P12Reader, Signature, ECF, ENVIRONMENT, getCodeSixDigitfromSignature } from 'dgii-ecf';
import { InvoiceRequest, ECFResponse } from '../types';
import { XMLBuilderService } from './xml-builder.service';
import { config } from '../config';
import { logger } from '../utils/logger';
import fs from 'fs';

export class EcfService {
  private xmlBuilder: XMLBuilderService;
  private cachedToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    this.xmlBuilder = new XMLBuilderService();
  }

  /**
   * Obtiene y cachea el token de autenticación de DGII.
   */
  private async getAuthToken(p12Reader: any, env: ENVIRONMENT): Promise<string> {
    const now = new Date();
    
    // Validar caché (expira en aprox 1 hora, ponemos 50 min = 3000000 ms de margen de seguridad)
    if (this.cachedToken && this.tokenExpiresAt && now.getTime() < this.tokenExpiresAt.getTime() - 300000) {
      logger.debug('Usando token de autenticación desde la caché');
      return this.cachedToken;
    }

    logger.info('Solicitando nuevo token de autenticación a DGII');
    const authEcf = new (ECF as any)(p12Reader, env);
    const authResult = await authEcf.authenticate();
    
    // asume que puede ser un string o un objeto con propiedad token
    const token = typeof authResult === 'string' ? authResult : authResult?.token;

    if (!token) {
      throw new Error('No se pudo obtener el token de autenticación de DGII');
    }

    this.cachedToken = token;
    // Asumimos 1 hora de validez
    this.tokenExpiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    
    return token;
  }

  private getDgiiEnvironment(envStr?: string): ENVIRONMENT {
    const clean = (envStr || config.dgii.environment || 'DEV').toUpperCase();
    if (clean === 'CERT') return ENVIRONMENT.CERT;
    if (clean === 'PROD') return ENVIRONMENT.PROD;
    return ENVIRONMENT.DEV;
  }

  /**
   * Procesa, firma y envía un e-CF a la DGII
   * @param request Datos de la factura
   */
  public async sendECF(request: InvoiceRequest): Promise<ECFResponse> {
    try {
      // 1. Construir XML
      const xmlString = this.xmlBuilder.buildECF(request);
      logger.debug('XML generado correctamente');

      // 2. Leer certificado
      if (!fs.existsSync(config.certificate.path)) {
        throw new Error(`Certificado no encontrado en la ruta: ${config.certificate.path}`);
      }

      const fileBuffer = fs.readFileSync(config.certificate.path);
      const password = config.certificate.password;
      const p12Reader = new (P12Reader as any)(fileBuffer.toString('base64'), password);

      // 3. Firmar XML
      const signature = new (Signature as any)(p12Reader);
      const signedXml = signature.signXml(xmlString, 'ECF');
      logger.debug('XML firmado correctamente');

      // 4. Autenticación y envío
      const env = this.getDgiiEnvironment();
      const token = await this.getAuthToken(p12Reader, env);
      
      const ecfClient = new (ECF as any)(p12Reader, env);
      
      logger.info(`Enviando factura ${request.encf} a DGII (Ambiente: ${env})...`);
      // Llama a sendInvoice, sendEcf, o lo que esté disponible
      const response = await (ecfClient.sendEcf ? ecfClient.sendEcf(signedXml, token) : ecfClient.sendInvoice(signedXml, token));

      // 5. Retornar y procesar resultados
      if (response && response.trackId) {
        const securityCode = (getCodeSixDigitfromSignature as any)(signedXml);
        logger.info(`Envío exitoso. TrackId: ${response.trackId}, SecurityCode: ${securityCode}`);
        return {
          success: true,
          trackId: response.trackId,
          codigoSeguridad: securityCode,
          securityCode: securityCode
        };
      } else {
        logger.warn('Respuesta de DGII no contiene trackId', response);
        return {
          success: false,
          error: 'Respuesta de envío inválida o sin trackId'
        };
      }
    } catch (error: any) {
      logger.error('Error al enviar ECF a DGII:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al enviar el e-CF'
      };
    }
  }

  /**
   * Consulta el estado de un e-CF a través de su trackId
   * @param trackId ID de rastreo
   */
  public async checkStatus(trackId: string): Promise<any> {
    try {
      if (!fs.existsSync(config.certificate.path)) {
        throw new Error(`Certificado no encontrado`);
      }
      const fileBuffer = fs.readFileSync(config.certificate.path);
      const p12Reader = new (P12Reader as any)(fileBuffer.toString('base64'), config.certificate.password);
      const env = this.getDgiiEnvironment();
      
      const token = await this.getAuthToken(p12Reader, env);
      const ecfClient = new (ECF as any)(p12Reader, env);
      
      const status = await ecfClient.statusTrackId(trackId, token);
      logger.info(`Estado consultado para trackId ${trackId}:`, status);
      return status;
    } catch (error: any) {
      logger.error(`Error consultando estado del trackId ${trackId}:`, error);
      throw error;
    }
  }
}

