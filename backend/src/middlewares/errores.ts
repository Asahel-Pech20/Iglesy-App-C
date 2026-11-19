import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError, type CodigoError, type DetalleError } from '../lib/appError';

interface ErrorPrisma {
  name: string;
  code: string;
  meta?: {
    target?: string[] | string;
    modelName?: string;
    // Prisma 7 con adaptador pg: el error original de PostgreSQL
    driverAdapterError?: { cause?: { originalCode?: string; originalMessage?: string } };
  };
}

/** SQLSTATE 23514: la fila viola un CHECK de la BD (A2-E1-02). */
const VIOLACION_CHECK = '23514';

/** Nombre de la restricción violada, para el log (nunca la fila: puede traer datos personales). */
function restriccionDe(err: ErrorPrisma): string | undefined {
  const mensaje = err.meta?.driverAdapterError?.cause?.originalMessage ?? '';
  return /constraint "([^"]+)"/.exec(mensaje)?.[1];
}

function esErrorPrisma(err: unknown): err is ErrorPrisma {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as ErrorPrisma).name === 'PrismaClientKnownRequestError' &&
    typeof (err as ErrorPrisma).code === 'string'
  );
}

function cuerpo(code: CodigoError, message: string, details?: unknown) {
  return { error: { code, message, ...(details !== undefined && { details }) } };
}

// Ruta no encontrada dentro de la API
export const noEncontrado: RequestHandler = (req, res) => {
  res.status(404).json(cuerpo('NOT_FOUND', `La ruta ${req.method} ${req.path} no existe.`));
};

// Único punto donde los errores se convierten en respuesta HTTP (AGENTS.md §3)
export const manejarErrores: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(cuerpo(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    const details: DetalleError[] = err.issues.map((issue) => ({
      campo: issue.path.join('.') || undefined,
      mensaje: issue.message,
    }));
    res.status(400).json(cuerpo('VALIDATION_ERROR', 'Los datos enviados no son válidos.', details));
    return;
  }

  if (esErrorPrisma(err)) {
    if (err.code === 'P2002') {
      const campos = [err.meta?.target].flat().filter(Boolean).join(', ');
      res
        .status(409)
        .json(
          cuerpo('CONFLICT', `Ya existe un registro con ese valor${campos ? ` (${campos})` : ''}.`),
        );
      return;
    }
    if (err.meta?.driverAdapterError?.cause?.originalCode === VIOLACION_CHECK) {
      // Una regla de la BD que Zod no anticipó: es un dato inválido, no un fallo del servidor
      req.log?.warn({ restriccion: restriccionDe(err) }, 'Violación de CHECK en la BD');
      res
        .status(422)
        .json(cuerpo('BUSINESS_RULE', 'Los datos no cumplen una regla de integridad del sistema.'));
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json(cuerpo('NOT_FOUND', 'El recurso solicitado no existe.'));
      return;
    }
  }

  // Subida de archivos (Multer): tamaño excedido o campo inesperado
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera 2 MB.'
        : 'El archivo enviado no es válido.';
    res.status(400).json(cuerpo('VALIDATION_ERROR', message));
    return;
  }

  // JSON mal formado en el body
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json(cuerpo('VALIDATION_ERROR', 'El cuerpo de la petición no es JSON válido.'));
    return;
  }

  req.log?.error({ err }, 'Error no controlado');
  const detalle = env.NODE_ENV === 'production' ? undefined : { stack: (err as Error).stack };
  res.status(500).json(cuerpo('INTERNAL_ERROR', 'Ocurrió un error inesperado.', detalle));
};
