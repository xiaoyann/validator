var gulp = require('gulp');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var jshint = require('gulp-jshint');

gulp.task('default', function() {
	return gulp.src('src/validator.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default', {verbose: true}))
    .pipe(gulp.dest('dist'))
	.pipe(uglify())
    .pipe(rename({extname: '.min.js'}))
	.pipe(gulp.dest('dist'));
});


