var fs = require('fs'),
	request = require('request'),
	co = require('co');

var handleImage = function(url) {
	console.log(url);

	var regex = /(\/[^\/]+)$/i,
		filename = 'images/' + regex.exec(url)[1];

	fs.writeFileSync('images.txt', url + '\n', {
		flag: 'a'
	});

	request(url).pipe(fs.createWriteStream(filename));
}

var getComments = function(postId, after) {
	if (after == undefined)
		after = 0;

	return function(done) {
		request('https://www.dcard.tw/_api/posts/' + postId + '/comments?after=' + after, function(err, response, body) {
			if (err) return done(err);

			co(function*() {

				var comments = JSON.parse(body);
				if (comments.length == 30) {
					var moreComments = yield getComments(postId, after + 30);
					comments = comments.concat(moreComments);
				}

				done(null, comments);
			}).catch(done);
		});
	}
}

var handlePost = function(post) {
	return function(done) {
		request('https://www.dcard.tw/_api/posts/' + post.id, function(err, response, body) {

			if (err) return done(err);

			co(function*() {
				post = JSON.parse(body);
				console.log(post.id + ' ' + post.gender + ' ' + post.school + ' ' + post.title);
				var regex = /https?:\/\/i\.imgur\.com\/[^\s]+/gi,
					match;
				// console.log(post);
				while (match = regex.exec(post.content)) {
					handleImage(match[0]);
				}

				var comments = yield getComments(post.id);

				for (var c in comments) {
					var comment = comments[c];
					if (comment.school == '北科大')
						console.log(comment);

					while(match = regex.exec(comment.content)) {
						handleImage(match[0]);
					}

				}

				done();
			}).catch(done);
		});
	}
}

var handlePosts = function(posts) {
	return function(done) {
		co(function*() {
			for (var p in posts) {
				var post = posts[p];
				yield handlePost(post);
			}
			done();
		}).catch(done);
	}
}

var handlePage = function(baseUrl, before) {

	return function(done) {
		var url = baseUrl;

		if (before != undefined)
			url += '&before=' + before;
		console.log(url);

		request(url, function(error, response, body) {
			if (error) return done(error);

			co(function*() {
				var posts = JSON.parse(body);
				yield handlePosts(posts);

				if(posts.length > 0)
					yield handlePage(baseUrl, posts[posts.length - 1].id);
				done();
			}).catch(done);
		});
	}
}

co(function*() {
	yield handlePage('https://www.dcard.tw/_api/forums/sex/posts?popular=false');
}).catch(function(err) {
	console.error(err);
})