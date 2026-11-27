import './config/zod';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { montarDocumentacion } from './docs';
import { logger } from './lib/logger';
import { manejarErrores, noEncontrado } from './middlewares/errores';
import { RUTA_UPLOADS } from './modules/configuracion/configuracion.service';
import { crearApiRouter } from './routes';

export function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  // Detrás de proxies (Render), la IP real del cliente para el límite de intentos (ver env.ts)
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Logotipos: el frontend (otro origen) los muestra en <img>
  app.use(
    RUTA_UPLOADS,
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(path.resolve(env.UPLOAD_DIR), { index: false, dotfiles: 'deny' }),
  );

  montarDocumentacion(app);
  app.use('/api/v1', crearApiRouter());

  app.use(noEncontrado);
  app.use(manejarErrores);

  return app;
}
