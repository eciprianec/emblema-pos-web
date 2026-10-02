import express from 'express';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import ecfRoutes from './routes/ecf.routes';
import certificateRoutes from './routes/certificate.routes';
import configRoutes from './routes/config.routes';

const app = express();

// Middlewares
app.use(cors({
  origin: 'http://localhost:8000' // Permitir peticiones solo del backend principal
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Mount routers
app.use('/api/ecf', ecfRoutes);
app.use('/api/certificate', certificateRoutes);
app.use('/api/config', configRoutes);

// Iniciar servidor
app.listen(config.port, () => {
  logger.info(`Microservicio e-CF iniciado en el puerto ${config.port}`);
  logger.info(`Entorno: ${config.nodeEnv}`);
  logger.info(`DGII Environment: ${config.dgii.environment}`);
  logger.info(`RNC Emisor: ${config.emisor.rnc}`);
});
