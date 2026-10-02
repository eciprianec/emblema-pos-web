import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

export interface DGIIConfigType {
  port: number | string;
  nodeEnv: string;
  certificate: {
    path: string;
    password: string;
  };
  dgii: {
    environment: string; // DEV, CERT, PROD
    rncEmisor: string;
  };
  emisor: {
    rnc: string;
    razonSocial: string;
    nombreComercial: string;
    direccion: string;
    municipio: string;
    provincia: string;
    telefono: string;
    email: string;
  };
  backendCallbackUrl: string;
}

export const config: DGIIConfigType = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  certificate: {
    path: process.env.CERTIFICATE_PATH || './certs/certificate.p12',
    password: process.env.CERTIFICATE_PASSWORD || '',
  },

  dgii: {
    environment: process.env.DGII_ENVIRONMENT || 'DEV',
    rncEmisor: process.env.RNC_EMISOR || '101010101',
  },

  emisor: {
    rnc: process.env.RNC_EMISOR || '101010101',
    razonSocial: process.env.EMISOR_RAZON_SOCIAL || 'Ciberemblema S.R.L.',
    nombreComercial: process.env.EMISOR_NOMBRE_COMERCIAL || 'Emblema POS',
    direccion: process.env.EMISOR_DIRECCION || 'Santo Domingo, República Dominicana',
    municipio: process.env.EMISOR_MUNICIPIO || '010100',
    provincia: process.env.EMISOR_PROVINCIA || '010000',
    telefono: process.env.EMISOR_TELEFONO || '809-555-0000',
    email: process.env.EMISOR_EMAIL || 'facturacion@ciberemblema.com',
  },

  backendCallbackUrl: process.env.BACKEND_CALLBACK_URL || 'http://localhost:8000/dgii/callback',
};

/**
 * Actualiza la configuración en memoria y en .env
 */
export function updateConfig(newConfig: any): DGIIConfigType {
  if (newConfig.dgii?.environment) {
    config.dgii.environment = newConfig.dgii.environment;
  }
  if (newConfig.dgii?.rncEmisor) {
    config.dgii.rncEmisor = newConfig.dgii.rncEmisor;
    config.emisor.rnc = newConfig.dgii.rncEmisor;
  }
  if (newConfig.emisor) {
    Object.assign(config.emisor, newConfig.emisor);
    if (newConfig.emisor.rnc) {
      config.dgii.rncEmisor = newConfig.emisor.rnc;
    }
  }
  if (newConfig.certificate) {
    if (newConfig.certificate.path) config.certificate.path = newConfig.certificate.path;
    if (newConfig.certificate.password !== undefined) config.certificate.password = newConfig.certificate.password;
  }

  // Persistir en .env
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = `PORT=${config.port}
NODE_ENV=${config.nodeEnv}
CERTIFICATE_PATH=${config.certificate.path}
CERTIFICATE_PASSWORD=${config.certificate.password}
RNC_EMISOR=${config.emisor.rnc}
DGII_ENVIRONMENT=${config.dgii.environment}
EMISOR_RAZON_SOCIAL=${config.emisor.razonSocial}
EMISOR_NOMBRE_COMERCIAL=${config.emisor.nombreComercial}
EMISOR_DIRECCION=${config.emisor.direccion}
EMISOR_MUNICIPIO=${config.emisor.municipio}
EMISOR_PROVINCIA=${config.emisor.provincia}
EMISOR_TELEFONO=${config.emisor.telefono}
EMISOR_EMAIL=${config.emisor.email}
BACKEND_CALLBACK_URL=${config.backendCallbackUrl}
`;
    fs.writeFileSync(envPath, envContent, 'utf-8');
  } catch (err) {
    console.error('Error escribiendo .env:', err);
  }

  return config;
}

/**
 * Retorna configuración segura para el frontend/cliente sin secretos
 */
export function getConfigSafe() {
  const certExists = fs.existsSync(config.certificate.path);
  return {
    environment: config.dgii.environment,
    rncEmisor: config.dgii.rncEmisor,
    emisor: { ...config.emisor },
    certificate: {
      path: config.certificate.path,
      configured: Boolean(config.certificate.password),
      existsOnDisk: certExists,
    },
    serviceUrl: `http://localhost:${config.port}`,
  };
}
