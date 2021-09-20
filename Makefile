hugo:
	rm -rf public
	hugo --minify --buildFuture

preview:
	hugo server --buildFuture

dep:
	cd themes/kagami && git pull
	cd content/posts && git pull