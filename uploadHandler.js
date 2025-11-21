const Busboy = require('busboy');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { v4: uuidv4 } = require('uuid');
const { PassThrough } = require('stream');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function handleStreamingUpload(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ 
      headers: req.headers,
      limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB limit
        files: 1
      }
    });

    let uploadPromise = null;
    let fileProcessed = false;

    busboy.on('file', (fieldname, file, info) => {
      const originalName = info.filename;
      const mimeType = info.mimeType;

      if (!mimeType.includes('text') && 
          !mimeType.includes('csv') && 
          !originalName.endsWith('.txt') && 
          !originalName.endsWith('.csv')) {
        file.resume();
        reject(new Error('Only text and CSV files are allowed'));
        return;
      }

      const fileId = uuidv4();
      const fileName = `${fileId}-${originalName}`;
      let fileSize = 0;

      console.log(`Starting upload: ${fileName}`);

      const passThrough = new PassThrough();
      
      file.on('data', (chunk) => {
        fileSize += chunk.length;
      });

      file.pipe(passThrough);

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: fileName,
          Body: passThrough,
          ContentType: mimeType,
        },
      });

      upload.on('httpUploadProgress', (progress) => {
        if (progress.total) {
          const percentage = Math.round((progress.loaded / progress.total) * 100);
          console.log(`Upload progress: ${percentage}%`);
        }
      });

      uploadPromise = upload.done().then(() => {
        fileProcessed = true;
        console.log(`Upload complete: ${fileName} (${fileSize} bytes)`);
        return {
          fileId,
          fileName,
          originalName,
          size: fileSize
        };
      });
    });

    busboy.on('finish', async () => {
      try {
        if (!uploadPromise) {
          reject(new Error('No file was uploaded'));
          return;
        }

        const result = await uploadPromise;
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    busboy.on('error', (error) => {
      console.error('Busboy error:', error);
      reject(error);
    });

    busboy.on('filesLimit', () => {
      reject(new Error('Too many files. Only 1 file allowed.'));
    });

    req.pipe(busboy);
  });
}

module.exports = { handleStreamingUpload };