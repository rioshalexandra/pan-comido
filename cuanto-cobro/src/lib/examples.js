// Datos de ejemplo para que una cuenta nueva vea cómo funciona la app.
// Se cargan en el celular la primera vez que entra, si la administradora lo eligió al crear la cuenta.

// [nombre, unidad base, cantidad del paquete, precio del paquete, packaging, stock, crítico]
export const INGREDIENTS = [
  ['Harina 0000', 'g', 1000, 1100, 0, 5000, 2000],
  ['Manteca', 'g', 200, 2900, 0, 600, 400],
  ['Azúcar', 'g', 1000, 1300, 0, 3000, 1000],
  ['Huevos', 'un', 30, 6600, 0, 24, 12],
  ['Chocolate semiamargo', 'g', 1000, 16000, 0, 300, 500],
  ['Dulce de leche repostero', 'g', 1000, 5200, 0, 2000, 1000],
  ['Maicena', 'g', 500, 1400, 0, 1000, 500],
  ['Esencia de vainilla', 'ml', 100, 1800, 0, 80, 20],
  ['Limón', 'un', 6, 1500, 0, 4, 3],
  ['Bolsa kraft con visor', 'un', 50, 9000, 1, 40, 20],
];

// [nombre, emoji, rinde, precio, min trabajo, min horno, notas, [[ingrediente, cantidad]]]
export const RECIPES = [
  [
    'Cookies de chocolate', '🍪', 24, 1400, 50, 14,
    'Batir la manteca pomada con el azúcar. Sumar el huevo y la vainilla. Agregar la harina y el chocolate picado. Bolitas de 45 g. Horno 180° por 12-14 minutos.',
    [['Harina 0000', 300], ['Manteca', 200], ['Azúcar', 220], ['Huevos', 2], ['Chocolate semiamargo', 200], ['Esencia de vainilla', 5], ['Bolsa kraft con visor', 24]],
  ],
  [
    'Alfajores de maicena', '🥮', 20, 1500, 90, 10,
    'Batir manteca y azúcar, sumar yemas y vainilla. Agregar maicena y harina. Estirar a 5 mm, cortar y hornear 8-10 minutos a 170°. Rellenar con dulce de leche y pasar por coco.',
    [['Maicena', 300], ['Harina 0000', 200], ['Manteca', 200], ['Azúcar', 150], ['Huevos', 3], ['Dulce de leche repostero', 500], ['Esencia de vainilla', 5]],
  ],
  [
    'Budín de limón', '🍋', 1, 14000, 25, 45,
    'Batir huevos con azúcar hasta blanquear. Sumar la manteca derretida, la ralladura y el jugo. Agregar la harina. Molde de 25 cm, horno 170° por 45 minutos. Glasé de limón.',
    [['Harina 0000', 250], ['Manteca', 150], ['Azúcar', 200], ['Huevos', 3], ['Limón', 2]],
  ],
];

export const EXAMPLE_SETTINGS = { labor_hour_rate: 4000, energy_monthly: 45000, oven_hours_month: 60 };

// Cuenta "demo": lo de arriba más todo esto, para mostrar la app a quien la quiere comprar
export const DEMO = {
  settings: { business_name: 'Sofi Pastelería', target_margin: 60 },
  // Las que se muestran "cobrando de menos" (las demás toman el precio sugerido)
  underpriced: ['Cheesecake de frutilla', 'Brownies'],
  // [nombre, unidad base, cantidad del paquete, precio del paquete, packaging, stock, crítico]
  ingredients: [
    ['Crema de leche', 'ml', 1000, 7800, 0, 1500, 1000],
    ['Queso crema', 'g', 1000, 11500, 0, 1800, 1000],
    ['Frutillas', 'g', 1000, 6000, 0, 400, 1000],
    ['Cacao amargo', 'g', 500, 8200, 0, 450, 200],
    ['Galletitas de vainilla', 'g', 500, 2600, 0, 1000, 500],
    ['Caja para torta', 'un', 10, 14000, 1, 6, 5],
    ['Bandejita + film', 'un', 50, 7500, 1, 60, 20],
  ],
  // [nombre, emoji, rinde, precio, min trabajo, min horno, notas, [[ingrediente, cantidad]]]
  recipes: [
    [
      'Cheesecake de frutilla', '🍰', 1, 30000, 60, 50,
      'Base: galletitas molidas con manteca derretida. Relleno: queso crema, azúcar, huevos y crema. Horno 160° a baño María 50 minutos. Enfriar 6 horas y cubrir con frutillas.',
      [['Galletitas de vainilla', 200], ['Manteca', 80], ['Queso crema', 600], ['Azúcar', 180], ['Huevos', 3], ['Crema de leche', 200], ['Frutillas', 400], ['Caja para torta', 1]],
    ],
    [
      'Brownies', '🍫', 16, 1600, 35, 25,
      'Derretir chocolate con manteca. Batir huevos con azúcar, unir, sumar harina y cacao. Molde de 20×30, horno 180° por 25 minutos. Cortar en 16.',
      [['Chocolate semiamargo', 250], ['Manteca', 200], ['Azúcar', 250], ['Huevos', 4], ['Harina 0000', 120], ['Cacao amargo', 30], ['Bandejita + film', 16]],
    ],
    [
      'Torta de chocolate', '🎂', 1, 22000, 120, 40,
      'Bizcochuelo de chocolate en dos capas, relleno de dulce de leche y crema, cobertura de ganache.',
      [['Harina 0000', 250], ['Azúcar', 250], ['Cacao amargo', 60], ['Huevos', 5], ['Manteca', 100], ['Dulce de leche repostero', 500], ['Crema de leche', 400], ['Chocolate semiamargo', 200], ['Caja para torta', 1]],
    ],
  ],
  // [ingrediente, cuánto subió en %, hace cuántos días]
  rises: [['Manteca', 18, 6], ['Chocolate semiamargo', 12, 12], ['Crema de leche', 9, 3]],
  // [proveedor, notas, ingredientes que le comprás]
  suppliers: [
    ['Molino Don Pepe', 'Entrega martes y viernes', ['Harina 0000', 'Azúcar', 'Maicena', 'Galletitas de vainilla']],
    ['Lácteos La Vaquita', 'Pedir antes de las 10', ['Manteca', 'Crema de leche', 'Queso crema', 'Huevos']],
    ['Distribuidora El Cacao', 'Acepta transferencia', ['Chocolate semiamargo', 'Cacao amargo', 'Dulce de leche repostero', 'Esencia de vainilla']],
    ['Packaging Express', '', ['Caja para torta', 'Bandejita + film', 'Bolsa kraft con visor']],
  ],
  // [proveedor, hace cuántos días, [[ingrediente, paquetes]], [[parte pagada, medio, hace cuántos días]]]
  purchases: [
    ['Molino Don Pepe', 14, [['Harina 0000', 10], ['Azúcar', 5], ['Maicena', 2]], [[1, 'transferencia', 14]]],
    ['Packaging Express', 10, [['Caja para torta', 2], ['Bolsa kraft con visor', 1]], [[1, 'efectivo', 10]]],
    ['Lácteos La Vaquita', 6, [['Manteca', 6], ['Crema de leche', 3], ['Queso crema', 2], ['Huevos', 1]], [[0.5, 'efectivo', 6]]],
    ['Distribuidora El Cacao', 2, [['Chocolate semiamargo', 2], ['Cacao amargo', 1], ['Dulce de leche repostero', 2]], []],
  ],
  // [receta, tandas, hace cuántos días]
  production: [['Cookies de chocolate', 2, 1], ['Brownies', 1, 2], ['Alfajores de maicena', 3, 4], ['Cheesecake de frutilla', 2, 5], ['Budín de limón', 4, 7]],
};
