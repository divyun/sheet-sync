const tailwindcss = require('tailwindcss');
const cssnano = require('cssnano');
const autoprefixer = require('autoprefixer');

const plugins = [
  tailwindcss('./tailwind.js'),
  cssnano({
    preset: 'default',
  }),
  autoprefixer,
];

module.exports = {
  plugins,
};
