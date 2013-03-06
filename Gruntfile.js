module.exports = function(grunt) {

	var mainJSFiles = ['site/scripts/jquery-*.js', 'site/scripts/rainbow*.js', 'site/scripts/main.js'];
	var galleryJSFiles = ['site/scripts/jquery.isotope*.js', 'site/scripts/gallery.js'];

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		sass: {
			options: {
				trace: true,
				style: 'compressed'
			},
			styles: {
				files: {
					'assets/styles/styles.css': ['site/sass/styles.scss'],
					'assets/styles/gallery.css': ['site/sass/gallery.scss']
				}
			}
		},

		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
			},
			main: {
				files: {
					'assets/scripts/main.min.js': mainJSFiles
				}
			},
			gallery: {
				files: {
					'assets/scripts/gallery.min.js': galleryJSFiles
				}
			}
		},

		watch: {
			sass: {
				files: ['site/sass/*.scss'],
				tasks: ['sass']
			},
			scripts_main: {
				files: mainJSFiles,
				tasks: ['uglify:main']
			},
			scripts_gallery: {
				files: galleryJSFiles,
				tasks: ['uglify:gallery']
			}
		}
	});

	//Load packages
	grunt.loadNpmTasks('grunt-contrib-sass');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');

	// Default task(s).
	grunt.registerTask('default', ['sass', 'uglify']);
};