/**
 * Fotos de iglesias de México para las portadas públicas (`public/landing/`). Licencia gratuita de
 * Unsplash: no exige crédito, pero se muestra en cada portada con el enlace a la foto.
 */
export interface FotoIglesia {
  archivo: string;
  lugar: string;
  autor: string;
  enlace: string;
}

export const FOTOS_IGLESIAS = [
  {
    archivo: 'landing/cholula-remedios.webp',
    lugar: 'Santuario de los Remedios, Cholula, Puebla',
    autor: 'Pedro Lastra',
    enlace: 'https://unsplash.com/photos/8gJqRaAaKx4',
  },
  {
    archivo: 'landing/iglesia-barroca.webp',
    lugar: 'Iglesia barroca de dos torres',
    autor: 'Francisco Fuentes',
    enlace: 'https://unsplash.com/photos/K60B0GolW40',
  },
  {
    archivo: 'landing/santiago-apoala.webp',
    lugar: 'Templo de Santiago Apoala, Oaxaca',
    autor: 'Akshay Pawar',
    enlace: 'https://unsplash.com/photos/_YPrHFLKjyg',
  },
  {
    archivo: 'landing/mamatla.webp',
    lugar: 'Iglesia de Mamatla, Estado de México',
    autor: 'Álvaro Jacobo Lagunas',
    enlace: 'https://unsplash.com/photos/A7ePTjJ81Hk',
  },
] as const satisfies readonly FotoIglesia[];

/** Foto de una iglesia en concreto, con lo que su licencia pide mostrar (autor y licencia). */
export interface FotoDeIglesia {
  archivo: string;
  autor: string;
  licencia: string;
  licenciaUrl: string;
  /** Página de la foto en su sitio de origen. */
  enlace: string;
}

/**
 * SOLO PARA LA DEMO: la API no tiene foto de iglesia (no está en el contrato), así que las fotos de
 * las iglesias reales de los datos simulados se ligan aquí por su id. Con el backend real los ids no
 * coinciden y las tarjetas y la ficha se ven sin foto, como antes. Fotos de Wikimedia Commons
 * (`public/iglesias/`, CC BY y CC BY-SA: piden autor y licencia junto a la foto) y de Unsplash.
 */
export const FOTOS_POR_IGLESIA: Readonly<Record<string, FotoDeIglesia>> = {
  'ig-santo-domingo': {
    archivo: 'iglesias/santo-domingo.jpg',
    autor: 'Diego Delso',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Iglesia_de_Santo_Domingo,_Puebla,_M%C3%A9xico,_2013-10-11,_DD_01.JPG',
  },
  'ig-merida': {
    archivo: 'iglesias/merida.jpg',
    autor: 'Gideonximi',
    licencia: 'CC BY 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Catedral_de_San_Ildefonso,_M%C3%A9rida,_Yucat%C3%A1n,_fachada_principal.jpg',
  },
  'ig-catedral-cdmx': {
    archivo: 'iglesias/catedral-cdmx.jpg',
    autor: 'ProtoplasmaKid',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Catedral_Metropolitana_de_la_Ciudad_de_M%C3%A9xico_1.jpg',
  },
  'ig-basilica': {
    archivo: 'iglesias/basilica.jpg',
    autor: 'Jarek Tuszyński',
    licencia: 'CC BY 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Nueva_Bas%C3%ADlica_de_Nuestra_Se%C3%B1ora_de_Guadalupe_-_Outside_-_1.JPG',
  },
  'ig-catedral-puebla': {
    archivo: 'iglesias/catedral-puebla.jpg',
    autor: 'Juan Carlos Fonseca Mata',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Puebla_(fachada),_nov22.jpg',
  },
  'ig-remedios': {
    archivo: 'landing/cholula-remedios.webp',
    autor: 'Pedro Lastra',
    licencia: 'Licencia de Unsplash',
    licenciaUrl: 'https://unsplash.com/license',
    enlace: 'https://unsplash.com/photos/8gJqRaAaKx4',
  },
  'ig-santa-prisca': {
    archivo: 'iglesias/santa-prisca.jpg',
    autor: 'Carlos Roberto Gobe',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Santa_Prisca,_fachada_oriente.JPG',
  },
  'ig-santo-domingo-oax': {
    archivo: 'iglesias/santo-domingo-oax.jpg',
    autor: 'Luisalvaz',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Fachada_del_Templo_de_Santo_Domingo_de_Guzm%C3%A1n,_Oaxaca,_Oax._(1).JPG',
  },
  'ig-catedral-morelia': {
    archivo: 'iglesias/catedral-morelia.jpg',
    autor: 'Adavyd',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Morelia_Cathedral_DSC_0524_AD.JPG',
  },
  'ig-san-miguel': {
    archivo: 'iglesias/san-miguel.jpg',
    autor: 'Peter K Burian',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Parroquia_de_San_Miguel_Arc%C3%A1ngel_4673.jpg',
  },
  'ig-atlixco': {
    archivo: 'iglesias/atlixco.jpg',
    autor: 'AlejandroLinaresGarcia',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Capilla_de_la_Tercera_Orden,_Atlixco,_Puebla_11.JPG',
  },
  'ig-catedral-gdl': {
    archivo: 'iglesias/catedral-gdl.jpg',
    autor: 'Luisalvaz',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Fachada_de_la_Catedral_de_Guadalajara_01.jpg',
  },
  'ig-expiatorio': {
    archivo: 'iglesias/expiatorio.jpg',
    autor: 'ProtoplasmaKid',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Templo_Expiatorio_del_Sant%C3%ADsimo_Sacramento_de_Guadalajara_3.jpg',
  },
  'ig-catedral-zac': {
    archivo: 'iglesias/catedral-zac.jpg',
    autor: 'Martín Daniel Cordero Amézquita',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Fachada_Frontal_de_la_Catedral_de_Zacatecas,_Zac.jpg',
  },
  'ig-ocotlan': {
    archivo: 'iglesias/ocotlan.jpg',
    autor: 'Juan de la Malinche',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Basilica-de-Ocotl%C3%A1n-Tlaxcala.jpg',
  },
  'ig-tonantzintla': {
    archivo: 'iglesias/tonantzintla.jpg',
    autor: 'Clau Del Lop',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Santa_Mar%C3%ADa_Tonantzintla.jpg',
  },
  'ig-acatepec': {
    archivo: 'iglesias/acatepec.jpg',
    autor: 'Luisalvaz',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Fachada_del_Templo_de_San_Francisco_Acatepec_01.jpg',
  },
  'ig-santa-rosa': {
    archivo: 'iglesias/santa-rosa.jpg',
    autor: 'Juan Carlos Fonseca Mata',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Templo_de_Santa_Rosa_de_Viterbo,_Quer%C3%A9taro.jpg',
  },
  'ig-catedral-sclc': {
    archivo: 'iglesias/catedral-sclc.jpg',
    autor: 'GameOfLight',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Catedral_de_San_Crist%C3%B3bal_de_las_Casas_1.jpg',
  },
  'ig-catedral-ags': {
    archivo: 'iglesias/catedral-ags.jpg',
    autor: 'MIMI.EXE',
    licencia: 'CC0',
    licenciaUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Vista_general_de_la_catedral_bas%C3%ADlica_de_nuestra_se%C3%B1ora_de_la_asunci%C3%B3n_de_Aguascalientes._28-03-25.jpg',
  },
  'ig-catedral-tij': {
    archivo: 'iglesias/catedral-tij.jpg',
    autor: 'Juan.osunacastro',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Catedral_de_Nuestra_Se%C3%B1ora_de_Guadalupe_TIjuana_BC.jpg',
  },
  'ig-loreto': {
    archivo: 'iglesias/loreto.jpg',
    autor: 'Kirt Edblom',
    licencia: 'CC BY-SA 2.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Misi%C3%B3n_de_Nuestra_Se%C3%B1ora_de_Loreto_-_Baja_California_Sur_(14563323178).jpg',
  },
  'ig-catedral-camp': {
    archivo: 'iglesias/catedral-camp.jpg',
    autor: 'Cass D.arq',
    licencia: 'CC BY 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Campeche_Fachada.jpg',
  },
  'ig-catedral-salt': {
    archivo: 'iglesias/catedral-salt.jpg',
    autor: 'Marioli925',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Santiago_de_Saltillo,_fachada.JPG',
  },
  'ig-catedral-col': {
    archivo: 'iglesias/catedral-col.jpg',
    autor: 'Salvador alc',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Colima.jpg',
  },
  'ig-catedral-chih': {
    archivo: 'iglesias/catedral-chih.jpg',
    autor: 'Battroid',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Chihuahua_-_04.JPG',
  },
  'ig-catedral-dgo': {
    archivo: 'iglesias/catedral-dgo.jpg',
    autor: 'Toto the egg',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_bas%C3%ADlica_de_Durango.jpg',
  },
  'ig-actopan': {
    archivo: 'iglesias/actopan.jpg',
    autor: 'RubeHM',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Templo_y_exconvento_de_San_Nicol%C3%A1s_de_Tolentino_(Actopan)._142.jpg',
  },
  'ig-tepotzotlan': {
    archivo: 'iglesias/tepotzotlan.jpg',
    autor: 'Luisalvaz',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Fachada_del_Templo_de_San_Francisco_Javier,_Tepotzotl%C3%A1n_1.jpg',
  },
  'ig-catedral-cva': {
    archivo: 'iglesias/catedral-cva.jpg',
    autor: 'José Luis Tristán Espino',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:02564_COPIA_CATEDRAL_CUERNAVACA.jpg',
  },
  'ig-catedral-tep': {
    archivo: 'iglesias/catedral-tep.jpg',
    autor: 'Christian Frausto Bernal',
    licencia: 'CC BY-SA 2.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Tepic,_Nayarit,_MEXICO.jpg',
  },
  'ig-catedral-mty': {
    archivo: 'iglesias/catedral-mty.jpg',
    autor: '© Peter Potrowl',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Monterrey_-_Catedral_de_la_Inmaculada_Concepci%C3%B3n_-_4.jpg',
  },
  'ig-playa': {
    archivo: 'iglesias/playa.jpg',
    autor: 'Nheyob',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace:
      'https://commons.wikimedia.org/wiki/File:Parroquia_de_Nuestra_Se%C3%B1ora_del_Carmen_(Playa_del_Carmen,_QR)_-_exterior.jpg',
  },
  'ig-carmen-slp': {
    archivo: 'iglesias/carmen-slp.jpg',
    autor: 'Sombra Inquieta',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Templo_del_Carmen,_San_Luis_Potos%C3%AD.jpg',
  },
  'ig-catedral-maz': {
    archivo: 'iglesias/catedral-maz.jpg',
    autor: 'Trevor Cameron',
    licencia: 'CC BY 2.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by/2.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Mazatl%C3%A1n_02.jpg',
  },
  'ig-catedral-hmo': {
    archivo: 'iglesias/catedral-hmo.jpg',
    autor: 'Gabriel Perez Salazar',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Hermosillo_Cathedral_Plaza_Zaragoza.jpg',
  },
  'ig-catedral-vsa': {
    archivo: 'iglesias/catedral-vsa.jpg',
    autor: 'Alfonsobouchot',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Villahermosa_5.JPG',
  },
  'ig-catedral-tam': {
    archivo: 'iglesias/catedral-tam.jpg',
    autor: 'JuanGLoya',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Tampico..JPG',
  },
  'ig-catedral-xal': {
    archivo: 'iglesias/catedral-xal.jpg',
    autor: 'Koffer',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    enlace: 'https://commons.wikimedia.org/wiki/File:Catedral_de_Xalapa_bajo_la_lluvia.jpg',
  },
};

export const fotoDeIglesia = (id: string): FotoDeIglesia | null => FOTOS_POR_IGLESIA[id] ?? null;
