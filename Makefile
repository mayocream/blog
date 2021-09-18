hugo:
	rm -rf public
	hugo --minify

preview:
	hugo server