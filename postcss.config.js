const tailwindcss = require('tailwindcss');
const purgecss = require('@fullhuman/postcss-purgecss');
const cssnano = require('cssnano');
const autoprefixer = require('autoprefixer');


class TailwindExtractor {
  static extract(content) {
    return content.match(/[A-Za-z0-9-_:/]+/g) || [];
  }
}

const plugins = [
  tailwindcss('./tailwind.js'),
  process.env.NODE_ENV === 'production'
    ? purgecss({
      content: ['./src/index.html'],
      extractors: [
        {
          extractor: TailwindExtractor,
          extensions: ['html', 'js'],
        },
      ],
    })
    : () => [],
  cssnano({
    preset: 'default',
  }),
  autoprefixer,
];

module.exports = {
  plugins,
};
