const S3 = require('aws-sdk/clients/s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const AppError = require('./appError');
const fs = require('fs');
const path = require('path');

const imageBucket = process.env.A_AWS_IMAGE_BUCKET_NAME;
const pdfBucket = process.env.A_AWS_IMAGE_BUCKET_NAME;
const region = process.env.A_AWS_BUCKET_REGION;
const accessKeyId = process.env.A_AWS_ACCESS_KEY;
const secretAccessKey = process.env.A_AWS_SECRET_KEY;

const s3 = new S3({
  region,
  accessKeyId,
  secretAccessKey,
});

const multerFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith('image') ||
    file.mimetype.startsWith('application/pdf') ||
    file.mimetype.startsWith('video/mp4')||
    file.mimetype.startsWith('audio/mpeg')||
    file.mimetype.startsWith('image/svg+xml')||
    file.mimetype.startsWith('image/jpg')||
    file.mimetype.startsWith('image/jpeg') ||
    file.mimetype.startsWith('image/png')
  ) {
    cb(null, true);
  } else {
    cb(
      new AppError('Invalid mimetype.', 400),
      false
    );
  }
};

const uploadImage = multer({
  storage: multerS3({
    s3: s3,
    bucket: imageBucket,
    metadata: function (req, file, cb) {
      console.log("🚀 ~ file: s3.js:49 ~ file:", file)
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      let type;
      if (file?.mimetype == 'application/pdf') type = 'pdf';
      else if (file?.mimetype == 'video/mp4') type = 'mp4';
      else if (file?.mimetype == 'audio/mpeg') type = 'mp3';
      else if (file?.mimetype == 'image/svg+xml') type = 'svg';
      else if (file?.mimetype == 'image/jpg') type = 'jpg';
      else if (file?.mimetype == 'image/jpeg') type = 'jpeg';
      else if (file?.mimetype == 'image/png') type = 'png';
      cb(null, `${uuidv4()}.${type}`);
    },
  }),
  fileFilter: multerFilter,
});

exports.uploadUserImage = uploadImage.fields([
  {
    name: 'photo',
    maxCount: 1,
  },
  {
    name: 'image',
    maxCount: 1,
  },
  {
    name: 'thumbnail',
    maxCount: 1,
  },
  {
    name: 'video',
    maxCount: 1,
  },
  {
    name: 'icon',
    maxCount: 1,
  },
  {
    name: 'images',
    maxCount: 20,
  },
]);

exports.getUploadingSignedURL = async (Key, Expires = 15004) => {
  try {
    const url = await s3.getSignedUrlPromise('putObject', {
      Bucket: imageBucket,
      Key: Key,
      Expires,
    });
    return url;
  } catch (error) {
    return error;
  }
};

function getFileStream(fileKey) {
  const downloadParams = {
    Key: fileKey,
    Bucket: imageBucket,
  };

  return s3.getObject(downloadParams).createReadStream();
}
exports.getFileStream = getFileStream;

exports.deleteImage = (fileKey) => {
  if (['default.png'].includes(fileKey)) return;

  const deleteParams = {
    Key: fileKey,
    Bucket: imageBucket,
  };

  return s3.deleteObject(deleteParams).promise();
};

function getPDFFileStream(fileKey) {
  const downloadParams = {
    Key: fileKey,
    Bucket: pdfBucket,
  };

  return s3.getObject(downloadParams).createReadStream();
}



exports.getPDFFileStream = getPDFFileStream;
