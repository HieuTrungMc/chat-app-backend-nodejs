const AWS = require('aws-sdk');
const mysql = require('mysql2/promise');
require('dotenv').config();

const config = new AWS.Config({
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_KEY,
  region: process.env.REGION,
})

AWS.config = config;

const s3 = new AWS.S3();

const pool = mysql.createPool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = { s3, pool };