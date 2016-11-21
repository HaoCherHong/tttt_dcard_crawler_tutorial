var fs = require('fs'),
	request = require('request'),
	co = require('co');

//Take a url paramter, log it and download the file into file system
var handleImage = function(url) {
	console.log(url);

	//Log the url into images.txt.
	//We write the url and a linebreak to the file opened in 'a' mode ('a' stands for 'append')
	fs.writeFileSync('images.txt', url + '\n', {
		flag: 'a'
	});

	//Get the image name from url using regex
	var regex = /(\/[^\/]+)$/i,
		filename = 'images/' + regex.exec(url)[1];

	//Download the file using request module. 
	//request(url) creates a data stream (load data from the url provided), when we pipe the stream to a filestream, it downloads the data to the file.
	request(url).pipe(fs.createWriteStream(filename));
}

//Gets all comments in a post with id provided
var getComments = function(postId, after) {
	if (after == undefined)
		after = 0;

	return function(done) {
		//Load comments using the dcard api
		request('https://www.dcard.tw/_api/posts/' + postId + '/comments?after=' + after, function(err, response, body) {
			if (err) return done(err);

			co(function*() {

				//Parse response body into JS object
				var comments = JSON.parse(body);

				//If we get 30 comments here, it means that there might be more comments there
				if (comments.length == 30) {
					//Recursively call the getComments function with after + 30 parameter
					var moreComments = yield getComments(postId, after + 30);
					//Concat the results to the one we get previously
					comments = comments.concat(moreComments);
				}

				//Return the results
				done(null, comments);
			}).catch(done);
		});
	}
}

//Get the detail of a post, download images and read all comments.
var handlePost = function(post) {
	return function(done) {
		//Request detail of the post using Dcard API
		request('https://www.dcard.tw/_api/posts/' + post.id, function(err, response, body) {

			if (err) return done(err);

			co(function*() {
				//Parse response body into JS object
				post = JSON.parse(body);
				console.log(post.id + ' ' + post.gender + ' ' + post.school + ' ' + post.title);

				//Find all images inside this post
				var regex = /https?:\/\/i\.imgur\.com\/[^\s]+/gi,
					match;
				while (match = regex.exec(post.content)) {
					//Call handleImage for each image found
					handleImage(match[0]);
				}

				//Get all comments
				var comments = yield getComments(post.id);

				for (var c in comments) {
					var comment = comments[c];

					//Log the comment which satisfy the condition
					if (comment.school == '北科大')
						console.log(comment);

					//Again, call handleImage for each image found in the comment
					while(match = regex.exec(comment.content)) {
						handleImage(match[0]);
					}

				}

				done();
			}).catch(done);
		});
	}
}

//Calls handlePost for each post in the array
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

//Loads a page and call handlePosts for its posts, loads more when there are more
var handlePage = function(baseUrl, before) {

	return function(done) {
		var url = baseUrl;

		//Add 'before' url parameter when 'before' passed in
		if (before != undefined)
			url += '&before=' + before;

		console.log(url);

		//Request using Dcard API
		request(url, function(error, response, body) {
			if (error) return done(error);

			co(function*() {
				//parse response body into JS object
				var posts = JSON.parse(body);

				//Handle posts
				yield handlePosts(posts);

				//If there are posts, loads posts before the last one
				if(posts.length > 0)
					yield handlePage(baseUrl, posts[posts.length - 1].id);
				done();
			}).catch(done);
		});
	}
}


//Main function, entry point
co(function*() {
	//Ensure that there is a images folder
	if(!fs.existsSync('images/'))
		fs.mkdirSync('images/');

	//Load the first page of specific forum
	yield handlePage('https://www.dcard.tw/_api/forums/photography/posts?popular=true');
}).catch(function(err) {
	//Error handler
	console.error(err);
})