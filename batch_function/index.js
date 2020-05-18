// dependencies
const AWS = require('aws-sdk');
const util = require('util');
const sharp = require('sharp');

// get reference to S3 client
const s3 = new AWS.S3();

exports.handler = function(event, context, callback) {
  console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
  const invocationId = event.invocationId;
  const invocationSchemaVersion = event.invocationSchemaVersion;
  

  function process (response, bucket, {width, height, dstKey}) {
    return sharp(response.Body)
      .resize(width, height)
      .toBuffer(dstKey.match(/\.([^.]*)$/)[1].toLowerCase())
      .then(data => s3.putObject({
          Bucket: bucket,
          Key: dstKey,
          Body: data,
          ContentType: response.ContentType})
      .promise())
      .then(
        function(response) {
          return {resultCode: 'Succeeded', resultString: response}
        },
        function(e) {
          let resultCode, resultString;
          // # If request timed out, mark as a temp failure
          // # and Amason S3 batch operations will make the task for retry. If
          // # any other exceptions are received, mark as permanent failure.
          if (e.message.includes('RequestTimeout')) {
            resultCode = 'TemporaryFailure'
            resultString = 'Retry request to Amazon S3 due to timeout.'
          }
          else {
            resultCode = 'PermanentFailure'
            resultString = e
          }
          return {resultCode, resultString};
        })
  }

  function processTask(task) {
    // # Parse Amazon S3 Key, Key Version, and Bucket ARN
    const s3Key = decodeURIComponent(task['s3Key'].replace(/\+/g, " "))
    const s3BucketArn = task['s3BucketArn']
    const s3Bucket = s3BucketArn.split(':::')[s3BucketArn.split(':::').length - 1]
    
    const typeMatch = s3Key.match(/\.([^.]*)$/);
    const imageType = typeMatch[1].toLowerCase();
      // # Compress
    return s3.getObject({
      Bucket: s3Bucket,
      Key: s3Key
      })
      .promise()
      .then(response => {
        const srcName = 'Compressed' + s3Key
          .slice(0, s3Key.lastIndexOf('.'))
          .slice('Incoming'.length);
        console.log(srcName, '.'+imageType);
        const thumbnail = {width: 200, height: 150, dstKey: srcName+'thumbnail.'+imageType};
        const sm = {width: 540, height: 300, dstKey: srcName+'compressed.'+imageType};
        const gallery = {width: 120, height: 90, dstKey: srcName+'gallery.'+imageType};
        return Promise.all([
          process(response, s3Bucket, thumbnail),
          process(response, s3Bucket, sm),
          process(response, s3Bucket, gallery),
        ])
      })
  }

  const rockets = event.tasks.map(t => processTask(t));

  Promise.all(rockets)
    .then(results => {
      callback(null, {
        invocationSchemaVersion,
        treatMissingKeysAs: 'PermanentFailure',
        invocationId,
        results: results.reduce((acc, r) => [...acc, ...r], [])
      })
    })
    .catch(console.error);
}