const fileswatch = 'html,htm,txt,json,md,woff2'; // List of files extensions for watching & hard reload

const {
  src, dest, parallel, series, watch,
} = require('gulp');

// Вспомогательные для Gulp

const rename = require('gulp-rename');// переименовывает выходной файл цепочки
const babel = require('gulp-babel');
const newer = require('gulp-newer');
const rsync = require('gulp-rsync');
const del = require('del');// удаляет указанные папки
const merge = require('merge-stream');// несколько потоков в одной функции
const plumber = require('gulp-plumber');// отлов ошибок без остановки галпа
const size = require('gulp-size');
const browserSync = require('browser-sync').create();
const bssi = require('browsersync-ssi');

// Поддержка новых технологий
const magicImporter = require('node-sass-magic-importer');// доп.возможности для импорта в sass
const sass = require('gulp-dart-sass');//добавляет поддержку dart-sass
const pug = require('gulp-pug');// добавляет поддержку pug

// Компрессоры, конвертеры
const htmlmin = require('gulp-html-minifier-terser');// уменьшает размер html файлов
const purgecss = require('gulp-purgecss');// удаляет лишние классы css после анализа html и js файлов
const terser = require('gulp-terser');// чистит неиспользуемый js
const ttf2woff = require('gulp-ttf2woff');// конвертирует шрифты из ttf в woff
const ttf2woff2 = require('gulp-ttf2woff2');// конвертирует шрифты из ttf в woff2
const imagemin = require('gulp-imagemin');// компрессирует изображения


function browsersync() {
  browserSync.init({
    server: {
      baseDir: 'dist/',
      middleware: bssi({ baseDir: 'dist/', ext: '.html' }),
    },
    tunnel: 'mysite', // Attempt to use the URL https://mysite.loca.lt
    notify: false,
    online: true,
  });
}

function scripts() {
  return src('app/js/index.js')
    .pipe(plumber())
    .pipe(babel({
            presets: ['@babel/env']
     }))
    .pipe(terser({  //--раскомментировать для PROD сборки
          ecma: 6,
          keep_fnames: false,
          mangle: {
              toplevel: true,
          },
     }))
    .pipe(rename('app.min.js'))
    .pipe(size())
    .pipe(dest('dist/js'))
    .pipe(browserSync.stream());
}

function styles() {
  return src('app/scss/index.scss')
    .pipe(plumber())

    //.pipe(sass({ importer: magicImporter(), outputStyle: 'expanded' })) // --раскомментировать для DEV сборки
    .pipe(sass({ importer: magicImporter(), outputStyle: 'compressed' })) //--раскомментировать для PROD сборки
    .pipe(purgecss({
      content: ['./dist/**/*.html', './dist/**/*.js'],
    }))

    .pipe(rename('app.min.css'))
    .pipe(size())
    .pipe(dest('dist/css'))
    .pipe(browserSync.stream());
}

function images() {
    const images =  src(['app/images/**/*'])
        .pipe(plumber())

        .pipe(newer('dist/images'))
        .pipe(imagemin())
        .pipe(size())
        .pipe(dest('dist/images'))
        .pipe(browserSync.stream());

    const favicon =  src(['app/favicon.*'])
        .pipe(plumber())

        .pipe(newer('dist/'))
        .pipe(imagemin())
        .pipe(size())
        .pipe(dest('dist/'))
        .pipe(browserSync.stream());

    return merge(images, favicon);
}

function pug2html() {
  //del('dist/pages', { force: true });
  const index = src('app/pug/index.pug')
    .pipe(plumber())

    .pipe(pug({
      pretty: true,
    }))
    .pipe(htmlmin({ collapseWhitespace: true })) //--раскомментировать для PROD сборки
    .pipe(size())
    .pipe(dest('dist'));

  const pages = src('app/pug/pages/*.pug')
    .pipe(plumber())

    .pipe(pug({
      pretty: true,
    }))
    .pipe(htmlmin({ collapseWhitespace: true })) //--раскомментировать для PROD сборки
    .pipe(size())
    .pipe(dest('dist/pages'));

  return merge(index, pages);
}

function fontAwesome() {
  return src('node_modules/@fortawesome/fontawesome-free/webfonts/*.+(woff|woff2)')
    .pipe(plumber())
    .pipe(dest('app/fonts'));
}

function ttfToWoff() {
  return src(['app/fonts/*.ttf'])
    .pipe(plumber())
    .pipe(ttf2woff())
    .pipe(dest('app/fonts'));
}

function ttfToWoff2() {
  return src(['app/fonts/*.ttf'])
    .pipe(plumber())
    .pipe(ttf2woff2())
    .pipe(dest('app/fonts'));
}

function copyFontFolder() {
  return src('app/fonts/*')
    .pipe(plumber())
    .pipe(dest('dist/fonts'));
}

function cleandist() {
  return del('dist/**/*', { force: true });
}

function deploy() {
  return src('dist/')
    .pipe(rsync({
      root: 'dist/',
      hostname: 'username@yousite.com',
      destination: 'yousite/public_html/',
      include: [/* '*.htaccess' */], // Included files to deploy,
      exclude: ['**/Thumbs.db', '**/*.DS_Store'],
      recursive: true,
      archive: true,
      silent: false,
      compress: true,
    }));
}

function startwatch() {
  watch('app/scss/**/*', { usePolling: true }, styles);
  watch('app/pug/**/*.pug', { usePolling: true }, pug2html);
  watch('app/js/**/*.js', { usePolling: true }, scripts);
  watch('app/images/**/*.{jpg,jpeg,png,webp,svg,gif}', { usePolling: true }, images);
  watch(`dist/**/*.{${fileswatch}}`, { usePolling: true }).on('change', browserSync.reload);
}

exports.scripts = scripts;
exports.styles = styles;
exports.images = images;
exports.deploy = deploy;
exports.convertFonts = series(fontAwesome, ttfToWoff, ttfToWoff2);
exports.build = series(cleandist, pug2html, scripts, styles, images, copyFontFolder);
exports.default = series(cleandist, pug2html, scripts, styles, images, copyFontFolder, parallel(browsersync, startwatch));
