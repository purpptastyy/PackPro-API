const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { PDFDocument } = require('pdf-lib');
const { execFile } = require('child_process');
const gifsicle = require('gifsicle');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const API_KEYS = new Set([process.env.API_KEY || 'test-key']);

function auth(req, res, next) {
  const key = req.header('x-api-key');
  if (!key || !API_KEYS.has(key)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

app.use(express.json());
app.use(auth);

function sendFile(res, filePath, fileName) {
  res.download(filePath, fileName, err => {
    fs.unlink(filePath, () => {});
  });
}

app.post('/convert/image', upload.single('file'), async (req, res) => {
  const format = req.query.format;
  const input = req.file.path;
  const output = `${input}.${format}`;
  try {
    await sharp(input).toFormat(format).toFile(output);
    sendFile(res, output, path.basename(req.file.originalname, path.extname(req.file.originalname)) + '.' + format);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(input, () => {});
  }
});

app.post('/convert/audio', upload.single('file'), (req, res) => {
  const format = req.query.format;
  const input = req.file.path;
  const output = `${input}.${format}`;
  ffmpeg(input)
    .toFormat(format)
    .on('end', () => {
      sendFile(res, output, path.basename(req.file.originalname, path.extname(req.file.originalname)) + '.' + format);
      fs.unlink(input, () => {});
    })
    .on('error', err => {
      res.status(500).json({ error: err.message });
      fs.unlink(input, () => {});
    })
    .save(output);
});

app.post('/convert/video', upload.single('file'), (req, res) => {
  const format = req.query.format;
  const input = req.file.path;
  const output = `${input}.${format}`;
  ffmpeg(input)
    .toFormat(format)
    .on('end', () => {
      sendFile(res, output, path.basename(req.file.originalname, path.extname(req.file.originalname)) + '.' + format);
      fs.unlink(input, () => {});
    })
    .on('error', err => {
      res.status(500).json({ error: err.message });
      fs.unlink(input, () => {});
    })
    .save(output);
});

app.post('/convert/document', upload.single('file'), async (req, res) => {
  // simple passthrough for now
  sendFile(res, req.file.path, req.file.originalname);
});

app.post('/compress/file', upload.single('file'), (req, res) => {
  const output = `${req.file.path}.zip`;
  const archive = archiver('zip');
  const stream = fs.createWriteStream(output);
  stream.on('close', () => {
    sendFile(res, output, path.basename(req.file.originalname) + '.zip');
    fs.unlink(req.file.path, () => {});
  });
  archive.on('error', err => res.status(500).json({ error: err.message }));
  archive.pipe(stream);
  archive.file(req.file.path, { name: req.file.originalname });
  archive.finalize();
});

app.post('/pdf/merge', upload.array('files'), async (req, res) => {
  try {
    const merged = await PDFDocument.create();
    for (const file of req.files) {
      const pdfBytes = fs.readFileSync(file.path);
      const pdf = await PDFDocument.load(pdfBytes);
      const copied = await merged.copyPages(pdf, pdf.getPageIndices());
      copied.forEach(p => merged.addPage(p));
      fs.unlink(file.path, () => {});
    }
    const out = await merged.save();
    const outPath = 'merged.pdf';
    fs.writeFileSync(outPath, out);
    sendFile(res, outPath, 'merged.pdf');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/pdf/split', upload.single('file'), async (req, res) => {
  try {
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const archivePath = `${req.file.path}.zip`;
    const archive = archiver('zip');
    const output = fs.createWriteStream(archivePath);
    output.on('close', () => {
      sendFile(res, archivePath, 'split.zip');
      fs.unlink(req.file.path, () => {});
    });
    archive.pipe(output);
    for (let i = 0; i < pdf.getPageCount(); i++) {
      const newDoc = await PDFDocument.create();
      const [page] = await newDoc.copyPages(pdf, [i]);
      newDoc.addPage(page);
      const bytes = await newDoc.save();
      archive.append(Buffer.from(bytes), { name: `page-${i + 1}.pdf` });
    }
    archive.finalize();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/pdf/compress', upload.single('file'), async (req, res) => {
  try {
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const outBytes = await pdf.save({ useObjectStreams: false });
    const outPath = `${req.file.path}-compressed.pdf`;
    fs.writeFileSync(outPath, outBytes);
    sendFile(res, outPath, 'compressed.pdf');
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.post('/audio/trim', upload.single('file'), (req, res) => {
  const { start = 0, duration } = req.body;
  const input = req.file.path;
  const output = `${input}-trim.${path.extname(req.file.originalname).slice(1)}`;
  let command = ffmpeg(input).setStartTime(start);
  if (duration) command = command.setDuration(duration);
  command
    .on('end', () => {
      sendFile(res, output, path.basename(output));
      fs.unlink(input, () => {});
    })
    .on('error', err => {
      res.status(500).json({ error: err.message });
      fs.unlink(input, () => {});
    })
    .save(output);
});

app.post('/gif/optimize', upload.single('file'), (req, res) => {
  const output = `${req.file.path}-optimized.gif`;
  execFile(gifsicle, ['-O3', req.file.path, '-o', output], err => {
    if (err) return res.status(500).json({ error: err.message });
    sendFile(res, output, 'optimized.gif');
    fs.unlink(req.file.path, () => {});
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));

module.exports = app;
