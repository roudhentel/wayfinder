var gulp = require('gulp');
var sass = require('gulp-sass');
gulp.task('sass', function () {
  gulp.src('./css/main.scss')
    .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
    .pipe(gulp.dest('./'));
});

gulp.task('sass:watch', function () {
  gulp.watch('./css/**/*.scss', ['sass']);
});