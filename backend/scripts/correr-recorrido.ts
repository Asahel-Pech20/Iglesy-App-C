// OSC-08: ejecuta la carpeta «Recorrido de la demo» de la colección de Postman con fetch (sin newman).
// Uso: `pnpm --filter backend postman:recorrido [-- --url http://localhost:3000/api/v1]`.
//
// SOLO contra una API local levantada sobre la BASE TEMPORAL DE PRUEBAS con la semilla cargada
// (DATABASE_URL = la de pruebas, nunca la de desarrollo). Para frenar un descuido, el script se
// niega a correr si la URL no es localhost. NO forma parte de `pnpm test` ni del CI.
//
// Interpreta el subconjunto de `pm` que usa el recorrido: pm.test, pm.response (code, json(),
// to.have.status) y pm.environment (get/set).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DIR_SALIDA, ARCHIVO_COLECCION, ARCHIVO_ENTORNO } from './generar-postman';

interface ItemJson {
  name: string;
  item?: ItemJson[];
  event?: { listen: string; script: { exec: string[] } }[];
  request?: {
    method: string;
    header: { key: string; value: string }[];
    url: { raw: string };
    body?: { raw: string };
  };
}

const argumento = (nombre: string) => {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const leer = <T>(archivo: string) =>
  JSON.parse(readFileSync(resolve(DIR_SALIDA, archivo), 'utf8')) as T;

async function main() {
  const coleccion = leer<{ item: ItemJson[] }>(ARCHIVO_COLECCION);
  const entorno = leer<{ values: { key: string; value: string }[] }>(ARCHIVO_ENTORNO);
  const variables = new Map(entorno.values.map((v) => [v.key, v.value]));
  const url = argumento('--url');
  if (url) variables.set('baseUrl', url);

  const host = new URL(variables.get('baseUrl') ?? '').hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
    process.stderr.write(
      `Me niego: ${host} no es local. El recorrido crea datos; úsalo solo en local.\n`,
    );
    process.exit(2);
  }

  const sustituir = (texto: string) =>
    texto.replace(
      /\{\{(\w+)\}\}/g,
      (_, nombre: string) => variables.get(nombre) ?? `{{${nombre}}}`,
    );

  const carpeta = coleccion.item.find((i) => i.name === 'Recorrido de la demo');
  if (!carpeta?.item)
    throw new Error('La colección no trae «Recorrido de la demo». Corre pnpm postman.');

  let fallos = 0;
  for (const paso of carpeta.item) {
    const { request } = paso;
    if (!request) continue;
    const token = variables.get('accessToken') ?? '';
    const headers: Record<string, string> = Object.fromEntries(
      request.header.map((h) => [h.key, sustituir(h.value)]),
    );
    // Las rutas públicas de la colección no llevan Bearer; las demás sí
    const publico = (request as { auth?: { type?: string } }).auth?.type === 'noauth';
    if (!publico && token) headers.Authorization = `Bearer ${token}`;

    const respuesta = await fetch(sustituir(request.url.raw), {
      method: request.method,
      headers,
      ...(request.body ? { body: sustituir(request.body.raw) } : {}),
    });
    const texto = await respuesta.text();
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      json = undefined;
    }

    const resultados: { nombre: string; error?: string }[] = [];
    const pm = {
      test: (nombre: string, fn: () => void) => {
        try {
          fn();
          resultados.push({ nombre });
        } catch (error) {
          resultados.push({
            nombre,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      response: {
        code: respuesta.status,
        json: () => {
          if (json === undefined) throw new Error('la respuesta no es JSON');
          return json;
        },
        to: {
          have: {
            status: (esperado: number) => {
              if (respuesta.status !== esperado) {
                throw new Error(`esperaba ${esperado} y llegó ${respuesta.status}`);
              }
            },
          },
        },
      },
      environment: {
        get: (nombre: string) => variables.get(nombre),
        set: (nombre: string, valor: string) => void variables.set(nombre, valor),
      },
    };

    const script = paso.event?.find((e) => e.listen === 'test')?.script.exec.join('\n') ?? '';
    try {
      new Function('pm', script)(pm);
    } catch (error) {
      resultados.push({
        nombre: 'script',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const mal = resultados.filter((r) => r.error);
    process.stdout.write(
      `${mal.length ? '✘' : '✔'} ${paso.name} → ${respuesta.status} (${resultados.length - mal.length}/${resultados.length} pruebas)\n`,
    );
    for (const r of mal) process.stdout.write(`    ✘ ${r.nombre}: ${r.error}\n`);
    if (mal.length) {
      fallos++;
      if (json) process.stdout.write(`    respuesta: ${texto.slice(0, 300)}\n`);
      break; // los pasos siguientes dependen de este
    }
  }
  process.stdout.write(fallos ? 'Recorrido FALLÓ.\n' : 'Recorrido completo.\n');
  process.exit(fallos ? 1 : 0);
}

await main();
