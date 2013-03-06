module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		sass: {
			options: {
				trace: true,
				style: 'expanded'
			},
			styles: {
				files: {
					'tweets/css/styles.css': ['tweets/sass/styles.scss']
				}
			}
		},

		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
			},
			scripts: {
				files: {
					'tweets/js/simplebird.min.js': ['tweets/js/jquery*.js', 'tweets/js/hogan*.js', 'tweets/js/simplebird.js']
				}
			}
		},

		watch: {
			sass: {
				files: ['tweets/sass/*.scss'],
				tasks: ['sass']
			},
			scripts: {
				files: ['!tweets/js/*.min.js', 'tweets/js/*.js'],
				tasks: ['uglify']
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