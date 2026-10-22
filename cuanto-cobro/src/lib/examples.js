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
