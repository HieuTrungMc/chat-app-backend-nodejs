const AWS = require('aws-sdk')
require('dotenv').config()

const config = new AWS.Config({
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
    region: process.env.REGION,
})

AWS.config = config;

const dynamo = new AWS.DynamoDB.DocumentClient()
const s3 = new AWS.S3()

module.exports = { dynamo, s3 }