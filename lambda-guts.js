'use strict';
console.log('Loading function');
const aws = require('aws-sdk');
const http = require('https');
const querystring = require('querystring');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });

exports.handler = (event, context, callback) => {
	console.log('Invoking function');
	const shared_key_path = {
		Bucket: process.env.BUCKET,
		Key:    process.env.KEY
	};
  s3.getObject(shared_key_path, (err, data) => {
		console.log('Retrieving shared s3 object');
    if(err) {
			console.log('Error in retrieving shared S3 object', err);
			callback(err);
		}
		var postData = querystring.stringify({
      token: data.Body.toString('utf8').replace(/[\n\t\r]$/g,""),
      job_name: process.env.JOB_NAME
    });
		const req = http.request({
			hostname: process.env.HOSTNAME,
			port: 443,
			path: process.env.REQUEST_PATH,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(postData)
			}
		});

		req.on('error', callback);

		console.log('Making scheduled POST');
		req.write(postData);
		req.end(d => callback(null, d));
  });
}
