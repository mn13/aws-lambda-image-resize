# aws-lambda-image-resize
AWS Lambda function for creating thumbnails from images served by S3

## How to use

### Create function
1. `npm install`
2. `zip -r function.zip ../node_modules ./index.js`
3. `aws configure` to login
4. `aws lambda create-function --function-name <your-function-name> --zip-file fileb://function.zip --handler index.handler --runtime nodejs12.x --role arn:aws:iam::<your-arn>:role/<your-role-name>`

### Update function
1. optional `rm function.zip`
2. `zip -r function.zip ../node_modules ./index.js`
3. `aws configure` to login
4. `aws lambda update-function-code --function-name <your_function_name> --zip-file fileb://function.zip`
