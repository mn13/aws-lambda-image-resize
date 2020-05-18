// dependencies
var AWS = require('aws-sdk');
var util = require('util');
var sharp = require('sharp');

// get reference to S3 client
var s3 = new AWS.S3();

exports.handler = function(event, context, callback) {
    // Read options from the event.
    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
    var srcBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    var srcKey    = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

    // Infer the image type.
    var typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
        callback("Could not determine the image type.");
        return;
    }
    var imageType = typeMatch[1].toLowerCase();

    // Download the image from S3, transform, and upload to S3 bucket.

    function process (response, {width, height, dstKey}) {
      return sharp(response.Body)
        .resize(width, height)
        .toBuffer(imageType)
        .then(data => s3.putObject({
          Bucket: srcBucket,
          Key: dstKey,
          Body: data,
          ContentType: response.ContentType
        }).promise())
        .catch(err => console.error(
          'Unable to resize ' + srcBucket + '/' + srcKey +
          ' and upload to ' + srcBucket + '/' + dstKey +
          ' due to an error: ' + err
      ))
    }

    s3.getObject({
      Bucket: srcBucket,
      Key: srcKey
      }).promise()
        .then(response => {
          const srcName = 'Compressed' + srcKey
            .slice(0, srcKey.lastIndexOf('.'))
            .slice('Incoming'.length);
          console.log(srcName, '.'+imageType);
          const thumbnail = {width: 200, height: 150, dstKey: srcName+'thumbnail.'+imageType};
          const sm = {width: 540, height: 300, dstKey: srcName+'compressed.'+imageType};
          const gallery = {width: 120, height: 90, dstKey: srcName+'gallery.'+imageType};
          return Promise.all([
            process(response, thumbnail),
            process(response, sm),
            process(response, gallery),
          ])
        })
        .catch(console.error);
};
