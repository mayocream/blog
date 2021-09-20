hugo:
	rm -rf public
	hugo --minify

preview:
	hugo server

dep:
	cd themes/kagami && git pull
	cd content/posts && git pull