const fs = require('fs');

const config = require('../config/config');

const aws = require('aws-sdk');
const s3 = new aws.S3({apiVersion: '2006-03-01'});
	UploadStream = require('s3-upload-stream')(s3);

class S3Upload {
	constructor({maxUploadSec=config.s3.maxUploadSec, bucket=config.s3.bucket, acl='public-read'}={}) {
		this.bucket = bucket;
		this.acl = acl;
		this.maxUploadSec = maxUploadSec;
		this.uploadedThisSec = 0;
		this.toUpload = [];

		this.resetTimeout = setTimeout(() => {
			this.uploadedThisSec = 0;
			this.upload();
		}, 1000);
	}

	delete(itemKey) {
		if (typeof itemKey === 'string')
			return new Promise((resolve, reject) => {
				s3.deleteObject({
					Bucket: this.bucket,
					Key: itemKey
				}, (err, data) => {
					if (err)
						reject(err);
					else
						resolve(data);
				});
			});
		if (itemKey.length < 1000)
			return new Promise((resolve, reject) => {
				s3.deleteObjects({
					Bucket: this.bucket,
					Delete: {
						Objects: itemKey.map(Key => {return {Key}})
					}
				}, (err, data) => {
					if (err)
						reject(err);
					else
						resolve(data);
				});
			});
	}

	upload() {
		while (this.uploadedThisSec < this.maxUploadSec && this.toUpload.length !== 0) {
			this.uploadedThisSec++;

			const request = this.toUpload.shift();
			const uploadStream = UploadStream.upload({Bucket: this.bucket, Key: request[1], ACL: this.acl, ContentType: request[2]})
			.once('uploaded', request[3]);

			fs.createReadStream(request[0])
			.pipe(uploadStream);
		}
		if (this.toUpload.length > 0) {
			if (this.resetTimeout) {
				clearTimeout(this.resetTimeout);
			}
			this.resetTimeout = setTimeout(() => {
				this.uploadedThisSec = 0;
				this.upload();
			}, 1000);
		}
	}

	callback({resolve, reject}, data) {
		resolve(data);
	}

	push(itemUri, itemName, contentType='application/octet-stream') {
		return new Promise((resolve, reject) => {
			this.toUpload.push([itemUri, itemName, contentType, this.callback.bind(this, {resolve, reject})]);
			this.upload();
		});
	}
}

module.exports = S3Upload;